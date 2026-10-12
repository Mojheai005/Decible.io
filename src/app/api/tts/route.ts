import { NextRequest, NextResponse, after } from 'next/server';
import { generateTTS, TTS_OUTPUT_FORMAT } from '@/lib/kieai';
import { generateFishTTS, FISH_OUTPUT_FORMAT } from '@/lib/fishaudio';
import { generateSmallestTTS, SMALLEST_OUTPUT_FORMAT } from '@/lib/smallest';
import { getVoiceById, getVoiceEngine } from '@/lib/voices-data';
import {
    CREDITS_CONFIG,
    ENGINE_LIMITS,
    ENGINE_MS_PER_CHAR,
    FUNCTION_BUDGET_MS,
    CAPACITY_RETRY_DELAYS_MS,
    TRANSIENT_RETRY_DELAYS_MS,
    RETRY_JITTER_RATIO,
    MAX_PLAUSIBLE_CHARS_PER_SECOND,
    TTS_MAX_ATTEMPTS,
} from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { checkUserRateLimit, getRateLimitHeaders, TIER_RATE_LIMITS } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { alertOps } from '@/lib/alerts';
import { ClassifiedFailure, classifyEngineFailure, failureFor, shortReason } from '@/lib/tts-errors';

// Extend Vercel serverless function timeout to the project's fluid-compute limit.
// Must comfortably exceed worst-case Kie polling + audio download + storage
// upload + refund, so a timeout can never kill the function between the credit
// deduction and the refund.
export const maxDuration = 300;

// ===========================================
// LOGGING CONTRACT
// ===========================================
// Every request ends in exactly one of these log events (JSON in production,
// so Vercel's log search and any log drain can filter on `event`):
//   tts.refused    refused before anything was charged (status + reason)
//   tts.completed  audio delivered
//   tts.failed     charged, failed, refunded (category + provider message)
// with tts.engine_error / tts.retry_skipped / tts.truncated for each attempt,
// and ops.alert when a whole engine is down (out of funds, bad key), when
// storage fails, or when a refund cannot be paid.
//
// Failed generations are also written to generation_history (status
// 'failed', details under settings.failure) and every refund names its cause
// in credit_transactions, so the database answers "why did it fail" after
// the logs have expired.
// ===========================================

const ENGINE_LABEL: Record<string, string> = {
    smallest: 'Smallest.ai',
    fish: 'Fish Audio',
    gemini: 'Kie.ai (Gemini voices)',
};

type Profile = { credits_remaining: number; subscription_tier: string; credits_used_this_month: number };

// Get authenticated user
async function getAuthenticatedUser() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
}

/**
 * Load the caller's profile. A database error is kept apart from "no row":
 * both used to answer 404 "User profile not found", so a Supabase hiccup
 * told users their account was missing.
 */
async function getUserProfile(userId: string): Promise<{ profile: Profile | null; dbError: string | null }> {
    const admin = getAdminClient();
    const { data, error } = await admin
        .from('user_profiles')
        .select('credits_remaining, subscription_tier, credits_used_this_month')
        .eq('id', userId)
        .maybeSingle();

    if (error) return { profile: null, dbError: `${error.code ?? ''} ${error.message}`.trim() };
    return { profile: (data as Profile | null) ?? null, dbError: null };
}

/** Answer a request we refuse before charging, and log why. */
function refuse(
    status: number,
    body: Record<string, unknown> & { error: string; code: string; message: string },
    context: Record<string, unknown>,
    headers?: Record<string, string>,
) {
    logger.warn('Generation refused before charging', { event: 'tts.refused', status, reason: body.code, ...context });
    return NextResponse.json(body, { status, headers });
}

// Pre-deduct credits atomically using stored procedure (row-level locking)
async function preDeductCredits(userId: string, amount: number, description: string, referenceId: string) {
    const admin = getAdminClient();

    const { data, error } = await admin.rpc('use_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_description: description,
        p_reference_id: referenceId,
    });

    if (error) {
        return { success: false as const, rpcError: `${error.code ?? ''} ${error.message}`.trim(), insufficient: false, newBalance: 0 };
    }

    // use_credits returns TABLE (success, new_balance, error_message)
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) {
        const msg = String(result?.error_message || 'Credit deduction failed');
        return { success: false as const, rpcError: msg, insufficient: /insufficient/i.test(msg), newBalance: result?.new_balance ?? 0 };
    }

    return { success: true as const, newBalance: result.new_balance as number };
}

// Refund credits on generation failure using stored procedure.
// Retries with backoff; if every attempt fails, a PENDING_REFUND marker row is
// written to generation_history and the team is alerted, because a silent log
// line alone is not durable.
async function refundCredits(userId: string, amount: number, referenceId: string, reason: string): Promise<boolean> {
    const admin = getAdminClient();
    const RETRY_DELAYS_MS = [0, 500, 2000];
    let lastError = '';

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
        if (RETRY_DELAYS_MS[attempt] > 0) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        }
        try {
            const { error } = await admin.rpc('add_credits', {
                p_user_id: userId,
                p_amount: amount,
                p_type: 'refund',
                p_description: `Refund: ${reason}`,
                p_reference_id: referenceId,
            });
            if (!error) return true;
            lastError = `${error.code ?? ''} ${error.message}`.trim();
        } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
        }
    }

    logger.error('Refund failed after all retries', undefined, {
        event: 'tts.refund_failed', userId, amount, generationId: referenceId, reason, detail: lastError,
    });

    try {
        await admin.from('generation_history').insert({
            user_id: userId,
            text: `PENDING_REFUND: ${amount} credits for ${referenceId} — ${reason}. Automatic refund failed; resolve manually via add_credits.`,
            voice_id: 'system',
            voice_name: 'Pending Refund',
            audio_url: '',
            characters_used: 0,
            credits_used: 0,
            settings: { type: 'pending_refund', amount, referenceId, reason },
            status: 'failed',
        });
    } catch (markerErr) {
        logger.error('Could not write PENDING_REFUND marker', markerErr instanceof Error ? markerErr : undefined, {
            event: 'tts.refund_marker_failed', userId, amount, generationId: referenceId,
        });
    }

    alertAfterResponse('refund_failed', `A refund of ${amount} credits could not be paid automatically (${referenceId}). `
        + 'Find it with: generation_history where text starts with PENDING_REFUND.', { userId, amount, generationId: referenceId });

    return false;
}

// Read the real duration of a WAV buffer from its RIFF header.
// Returns null if the buffer is not parseable as WAV.
function wavDurationSeconds(buffer: ArrayBuffer): number | null {
    try {
        const view = new DataView(buffer);
        if (buffer.byteLength < 44) return null;
        const tag = (off: number) =>
            String.fromCharCode(view.getUint8(off), view.getUint8(off + 1),
                                view.getUint8(off + 2), view.getUint8(off + 3));
        if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;

        let pos = 12;
        let byteRate = 0;
        let dataBytes = 0;
        while (pos + 8 <= buffer.byteLength) {
            const id = tag(pos);
            const size = view.getUint32(pos + 4, true);
            if (id === 'fmt ') {
                byteRate = view.getUint32(pos + 12, true);
            } else if (id === 'data') {
                dataBytes = Math.min(size, buffer.byteLength - (pos + 8));
                break;
            }
            pos += 8 + size + (size % 2);
        }
        if (!byteRate || !dataBytes) return null;
        return dataBytes / byteRate;
    } catch {
        return null;
    }
}

/**
 * Detect the silent-truncation failure that was overcharging users.
 *
 * Engines (Gemini especially) sometimes return audio covering only part of the
 * submitted text while reporting success — measured at 21.9%-96.9% coverage
 * across 17 of 26 Gemini voices. The user was charged for every character.
 *
 * Real speech runs ~13-18 chars/sec. If the returned audio implies a rate
 * faster than MAX_PLAUSIBLE_CHARS_PER_SECOND, text was skipped.
 * Returns null when the audio looks complete.
 */
function detectTruncation(audio: ArrayBuffer, charCount: number, speed = 1.0): string | null {
    // Only parses WAV. MP3 (Fish, Smallest) returns null and is never flagged:
    // both measured 100% coverage. The detector exists for Gemini, which does.
    const seconds = wavDurationSeconds(audio);
    if (seconds === null || seconds <= 0) return null; // unparseable — do not block
    const rate = charCount / seconds;
    // A faster requested pace legitimately raises chars/sec; don't punish it.
    const ceiling = MAX_PLAUSIBLE_CHARS_PER_SECOND * Math.max(1, speed);
    if (rate > ceiling) {
        const pct = Math.round((ceiling / rate) * 100);
        return `engine returned ~${pct}% of the requested text `
             + `(${charCount} chars in ${seconds.toFixed(1)}s = ${rate.toFixed(1)} chars/sec, `
             + `ceiling ${ceiling.toFixed(1)})`;
    }
    return null;
}

// Store audio in Supabase Storage and return public URL
async function storeAudioInBucket(
    userId: string,
    generationId: string,
    audioBuffer: ArrayBuffer,
    format: { extension: string; mimeType: string },
): Promise<{ url: string | null; error: string | null }> {
    try {
        const admin = getAdminClient();
        const filePath = `${userId}/${generationId}.${format.extension}`;

        const { error: uploadError } = await admin.storage
            .from('audio-generations')
            .upload(filePath, audioBuffer, {
                contentType: format.mimeType,
                upsert: true,
            });

        if (uploadError) return { url: null, error: uploadError.message };

        const { data: urlData } = admin.storage
            .from('audio-generations')
            .getPublicUrl(filePath);

        return { url: urlData?.publicUrl || null, error: urlData?.publicUrl ? null : 'no public URL returned' };
    } catch (err) {
        return { url: null, error: err instanceof Error ? err.message : String(err) };
    }
}

// Save generation to history (non-critical: the user already has the audio)
async function saveToHistory(
    userId: string,
    text: string,
    voiceId: string,
    voiceName: string,
    audioUrl: string,
    charactersUsed: number,
    creditsUsed: number,
    settings: Record<string, unknown>
) {
    const admin = getAdminClient();
    const { error } = await admin
        .from('generation_history')
        .insert({
            user_id: userId,
            text: text.substring(0, 500), // Store first 500 chars
            voice_id: voiceId,
            voice_name: voiceName,
            audio_url: audioUrl,
            characters_used: charactersUsed,
            credits_used: creditsUsed,
            settings: settings,
            status: 'completed',
        });

    if (error) {
        logger.warn('Could not save completed generation to history', {
            event: 'tts.history_write_failed', userId, voiceId, code: error.code, detail: error.message,
        });
    }
}

// Production's generation_history was built from an older schema with no
// error_message column, and the insert that used it failed silently from
// 16 Sep to 12 Oct 2026, so not one failure was recorded. Failure details now
// always go in settings.failure; the column is used only once it exists.
let historyHasErrorColumn = true;

/** Record a failed generation so the cause is answerable from the database. */
async function recordFailedGeneration(
    ctx: { userId: string; generationId: string; text: string; voiceId: string; voiceName: string; engine: string; characters: number },
    failure: ClassifiedFailure,
    reason: string,
    attempts: number,
    elapsedMs: number,
): Promise<void> {
    const base = {
        user_id: ctx.userId,
        text: ctx.text.substring(0, 500),
        voice_id: ctx.voiceId,
        voice_name: ctx.voiceName,
        audio_url: '',
        characters_used: ctx.characters,
        credits_used: 0, // refunded, so nothing was charged
        settings: {
            engine: ctx.engine,
            generationId: ctx.generationId,
            failure: {
                category: failure.category,
                providerStatus: failure.providerStatus ?? null,
                attempts,
                elapsedMs,
                reason: reason.substring(0, 500),
            },
        },
        status: 'failed',
    };

    try {
        const admin = getAdminClient();
        let error = null as null | { code?: string; message: string };
        if (historyHasErrorColumn) {
            ({ error } = await admin.from('generation_history').insert({
                ...base,
                error_message: `${failure.category}: ${reason}`.substring(0, 500),
            }));
            if (error && /error_message/.test(error.message)) {
                historyHasErrorColumn = false;
                logger.warn('generation_history has no error_message column; run step40-error-logging.sql', {
                    event: 'tts.history_missing_error_column',
                });
                ({ error } = await admin.from('generation_history').insert(base));
            }
        } else {
            ({ error } = await admin.from('generation_history').insert(base));
        }
        if (error) {
            logger.error('Could not record failed generation', undefined, {
                event: 'tts.failure_record_failed', generationId: ctx.generationId, code: error.code, detail: error.message,
            });
        }
    } catch (err) {
        // Diagnostics must never break the user-facing path.
        logger.error('Could not record failed generation', err instanceof Error ? err : undefined, {
            event: 'tts.failure_record_failed', generationId: ctx.generationId,
        });
    }
}

/** Spread simultaneous retries so throttled callers do not collide again. */
function withJitter(ms: number): number {
    const spread = ms * RETRY_JITTER_RATIO;
    return Math.max(0, Math.round(ms - spread + Math.random() * spread * 2));
}

/** Rough wall time one attempt needs, used to decide if a retry still fits. */
function estimateAttemptMs(engine: string, characters: number): number {
    const rate = ENGINE_MS_PER_CHAR[engine as keyof typeof ENGINE_MS_PER_CHAR]
        ?? ENGINE_MS_PER_CHAR.gemini;
    // 2x the measured rate: providers demonstrably run slower under load
    // (Smallest measured 2.2x slower on 7 Sep than on 16 Sep for identical work).
    return characters * rate * 2;
}

/** Answer a charged request that failed. Only claims "nothing was charged" if the refund went through. */
function failureResponse(failure: ClassifiedFailure, generationId: string, refunded: number) {
    return NextResponse.json({
        error: failure.userError,
        code: failure.category,
        message: refunded > 0
            ? failure.userMessage
            : `${failure.userError}. We could not return your credits automatically; our team has been alerted `
              + `and will restore them. Reference: ${generationId}.`,
        generationId,
        refunded,
    }, { status: failure.httpStatus });
}

/** Send an ops alert after the user has their answer, never on the request's critical path. */
function alertAfterResponse(key: string, text: string, context: Record<string, unknown>) {
    after(() => alertOps(key, text, context));
}

export async function POST(request: NextRequest) {
    const requestStartedAt = Date.now();
    // Set once credits are taken, cleared once they are refunded or the audio
    // is delivered, so an unexpected error can never keep a user's credits.
    let charge: { userId: string; credits: number; generationId: string } | null = null;
    let delivered = false;

    try {
        // 1. Authenticate user
        const user = await getAuthenticatedUser();
        if (!user) {
            return refuse(401, {
                error: 'Authentication required',
                code: 'auth_required',
                message: 'Your session has expired. Please log in again, then retry. Nothing was charged.',
            }, {});
        }
        const userId = user.id;

        // 2. Get user profile and check credits
        const { profile, dbError } = await getUserProfile(userId);
        if (dbError) {
            logger.error('Profile lookup failed', undefined, { event: 'tts.profile_lookup_failed', userId, detail: dbError });
            return refuse(503, {
                error: 'Service temporarily unavailable',
                code: 'database_unavailable',
                message: 'We could not load your account just now, so nothing was charged. Please try again in a few seconds.',
            }, { userId });
        }
        if (!profile) {
            return refuse(404, {
                error: 'User profile not found',
                code: 'profile_missing',
                message: 'Your account is not fully set up yet. Please refresh the page and try again. Nothing was charged.',
            }, { userId });
        }

        // 3. Parse request body
        const body = await request.json().catch(() => null);
        const { text, voice_id, voice_name, voice_settings } = (body ?? {}) as {
            text?: string; voice_id?: string; voice_name?: string;
            voice_settings?: { stability?: number; similarity_boost?: number; style?: number; speed?: number };
        };

        if (!text || !voice_id) {
            return refuse(400, {
                error: 'Missing text or voice_id',
                code: 'bad_request',
                message: 'Please enter some text and pick a voice.',
            }, { userId });
        }

        // 4. Calculate credits needed (1 credit per character)
        const charactersUsed = text.length;
        const creditsNeeded = charactersUsed * CREDITS_CONFIG.COST_PER_CHARACTER;

        // 4b. Reject anything above the engine's proven-safe ceiling BEFORE
        // charging. Oversized text used to be billed in full and truncated.
        const engine = getVoiceEngine(voice_id);
        const engineMaxChars = ENGINE_LIMITS[engine].maxCharsPerRequest;
        const logCtx = { userId, voiceId: voice_id, engine, chars: charactersUsed };
        if (charactersUsed > engineMaxChars) {
            return refuse(413, {
                error: 'Text too long for this voice',
                code: 'text_too_long',
                engine,
                maxCharsPerRequest: engineMaxChars,
                charactersSubmitted: charactersUsed,
                message: `This voice can read up to ${engineMaxChars.toLocaleString('en-IN')} characters at a time. `
                    + 'Split the text into smaller parts (Script to Voice does this automatically). Nothing was charged.',
            }, logCtx);
        }

        // 5. Check if user has enough credits
        if (profile.credits_remaining < creditsNeeded) {
            return refuse(402, {
                error: 'Insufficient credits',
                code: 'insufficient_credits',
                creditsNeeded,
                creditsRemaining: profile.credits_remaining,
                message: `This needs ${creditsNeeded.toLocaleString('en-IN')} credits and you have `
                    + `${profile.credits_remaining.toLocaleString('en-IN')}. Buy more credits or upgrade your plan to continue.`,
            }, { ...logCtx, creditsRemaining: profile.credits_remaining });
        }

        // 6. Check rate limits
        const tier = profile.subscription_tier as keyof typeof TIER_RATE_LIMITS || 'free';
        const rateLimitResult = await checkUserRateLimit(userId, tier, 'generation');
        if (!rateLimitResult.success) {
            return refuse(429, {
                error: 'Rate limit exceeded',
                code: 'rate_limited',
                retryAfter: rateLimitResult.retryAfter,
                message: `You have reached the ${tier} plan's limit of generations for now. `
                    + `Please wait ${rateLimitResult.retryAfter} seconds and try again. Nothing was charged.`,
            }, { ...logCtx, tier, retryAfter: rateLimitResult.retryAfter }, getRateLimitHeaders(rateLimitResult));
        }

        // 7. Get the voice name to send to the engine
        const voiceData = getVoiceById(voice_id);
        const voiceNameForApi = voiceData?.voiceName || voice_name || voice_id;

        // 8. Generate unique ID for this generation
        const generationId = `gen_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const ctx = {
            userId, generationId, text, voiceId: voice_id,
            voiceName: voice_name || voiceNameForApi, engine, characters: charactersUsed,
        };

        // 9. PRE-DEDUCT credits atomically (row-locked, prevents race conditions)
        const creditResult = await preDeductCredits(
            userId,
            creditsNeeded,
            `TTS Generation: ${charactersUsed} characters`,
            generationId,
        );

        if (!creditResult.success) {
            if (creditResult.insufficient) {
                return refuse(402, {
                    error: 'Insufficient credits',
                    code: 'insufficient_credits',
                    creditsNeeded,
                    creditsRemaining: creditResult.newBalance,
                    message: `This needs ${creditsNeeded.toLocaleString('en-IN')} credits and you have `
                        + `${creditResult.newBalance.toLocaleString('en-IN')}. Buy more credits or upgrade your plan to continue.`,
                }, logCtx);
            }
            logger.error('Credit deduction failed', undefined, { event: 'tts.charge_failed', generationId, ...logCtx, detail: creditResult.rpcError });
            return refuse(503, {
                error: 'Service temporarily unavailable',
                code: 'charge_failed',
                message: 'We could not update your credit balance just now, so nothing was generated. Please try again in a few seconds.',
            }, { generationId, ...logCtx });
        }
        charge = { userId, credits: creditsNeeded, generationId };

        // 10. Generate, VERIFYING each result and retrying where it can help.
        // Each attempt may use only what is left of the function's budget, so a
        // hung provider call is cut off while there is still time to refund.
        const runEngine = async (timeoutMs: number): Promise<ArrayBuffer> => {
            if (voiceData?.engine === 'smallest' && voiceData.smallestVoiceId) {
                return generateSmallestTTS({
                    text,
                    voiceId: voiceData.smallestVoiceId,
                    speed: Math.round((voice_settings?.speed ?? 1.0) * 100) / 100,
                    timeoutMs,
                });
            }
            if (voiceData?.engine === 'fish' && voiceData.fishReferenceId) {
                return generateFishTTS({
                    text,
                    referenceId: voiceData.fishReferenceId,
                    speed: Math.round((voice_settings?.speed ?? 1.0) * 100) / 100,
                    timeoutMs,
                });
            }
            return generateTTS({
                text,
                voice: voiceNameForApi,
                voice_settings: voice_settings ? {
                    stability: Math.round((voice_settings.stability ?? 0.5) * 100) / 100,
                    similarity_boost: Math.round((voice_settings.similarity_boost ?? 0.75) * 100) / 100,
                    speed: Math.round((voice_settings.speed ?? 1.0) * 100) / 100,
                    style: Math.round((voice_settings.style ?? 0) * 100) / 100,
                } : undefined,
                timeoutMs,
            });
        };
        const MIN_ATTEMPT_MS = 15_000;

        let audioBuffer: ArrayBuffer | null = null;
        let lastOutcome: { kind: 'error'; failure: ClassifiedFailure; reason: string } | { kind: 'truncated'; detail: string } | null = null;
        let attempts = 0;

        for (let attempt = 1; attempt <= TTS_MAX_ATTEMPTS; attempt++) {
            attempts = attempt;
            const attemptStarted = Date.now();
            let candidate: ArrayBuffer;
            try {
                candidate = await runEngine(
                    Math.max(MIN_ATTEMPT_MS, FUNCTION_BUDGET_MS - (attemptStarted - requestStartedAt)),
                );
            } catch (genError) {
                const failure = classifyEngineFailure(genError);
                const reason = shortReason(genError);
                lastOutcome = { kind: 'error', failure, reason };
                const elapsed = Date.now() - requestStartedAt;

                logger.warn('Voice engine attempt failed', {
                    event: 'tts.engine_error', generationId, ...logCtx, attempt,
                    category: failure.category, providerStatus: failure.providerStatus, elapsedMs: elapsed, reason,
                });

                if (failure.retryable && attempt < TTS_MAX_ATTEMPTS) {
                    // Capacity errors wait for a slot to free; other blips retry fast.
                    const schedule = failure.capacity ? CAPACITY_RETRY_DELAYS_MS : TRANSIENT_RETRY_DELAYS_MS;
                    const backoffMs = withJitter(schedule[Math.min(attempt - 1, schedule.length - 1)]);
                    // Only retry if the wait AND the next attempt still fit
                    // inside the function's life; otherwise refund now.
                    const needed = backoffMs + estimateAttemptMs(engine, charactersUsed);
                    if (elapsed + needed <= FUNCTION_BUDGET_MS) {
                        await new Promise(resolve => setTimeout(resolve, backoffMs));
                        continue;
                    }
                    logger.warn('Out of time budget, refunding instead of retrying', {
                        event: 'tts.retry_skipped', generationId, engine, attempt, elapsedMs: elapsed, neededMs: needed,
                        category: failure.category,
                    });
                }
                break;
            }

            const truncation = detectTruncation(candidate, charactersUsed, voice_settings?.speed ?? 1.0);
            if (!truncation) {
                audioBuffer = candidate;
                break;
            }

            lastOutcome = { kind: 'truncated', detail: truncation };
            const elapsed = Date.now() - requestStartedAt;
            logger.warn('Engine returned truncated audio', {
                event: 'tts.truncated', generationId, ...logCtx, attempt, elapsedMs: elapsed, detail: truncation,
            });
            // Retry only if another attempt of the length just measured still
            // fits. (This path used to ignore the budget; the 2x model used for
            // errors is too pessimistic here, since this attempt finished and its
            // real duration is known.)
            const attemptMs = Date.now() - attemptStarted;
            if (attempt < TTS_MAX_ATTEMPTS && elapsed + attemptMs > FUNCTION_BUDGET_MS) {
                logger.warn('Out of time budget, refunding instead of retrying', {
                    event: 'tts.retry_skipped', generationId, engine, attempt, elapsedMs: elapsed, neededMs: attemptMs,
                    category: 'truncated',
                });
                break;
            }
        }

        const elapsedMs = () => Date.now() - requestStartedAt;

        // Engine failed (or every attempt came back short): refund, record, explain.
        if (!audioBuffer) {
            const failure = lastOutcome?.kind === 'error' ? lastOutcome.failure : failureFor('truncated');
            const reason = lastOutcome?.kind === 'error'
                ? lastOutcome.reason
                : `truncated after ${attempts} attempts: ${lastOutcome?.kind === 'truncated' ? lastOutcome.detail : ''}`;

            // Refund first: the user's credits matter more than the paperwork.
            const refunded = await refundCredits(userId, creditsNeeded, generationId,
                `${engine} ${failure.category}: ${reason.substring(0, 140)}`);
            charge = null;

            logger.error('Generation failed', undefined, {
                event: 'tts.failed', generationId, ...logCtx, attempts, category: failure.category,
                providerStatus: failure.providerStatus, elapsedMs: elapsedMs(), refunded, reason,
            });
            await recordFailedGeneration(ctx, failure, reason, attempts, elapsedMs());

            if (failure.alert) {
                alertAfterResponse(`${engine}:${failure.category}`,
                    `${ENGINE_LABEL[engine] ?? engine} is refusing requests (${failure.category.replace(/_/g, ' ')}). `
                    + `Every voice on it is down until this is fixed. Provider said: ${reason.substring(0, 200)}`,
                    { engine, category: failure.category, providerStatus: failure.providerStatus });
            }
            return failureResponse(failure, generationId, refunded ? creditsNeeded : 0);
        }

        // 11. Store audio in Supabase Storage — if this fails, REFUND credits.
        // Fish and Smallest return MP3, Kie/Gemini returns WAV; storing one
        // under the other's extension makes the file unplayable.
        const outputFormat =
            engine === 'smallest' ? SMALLEST_OUTPUT_FORMAT
            : engine === 'fish'   ? FISH_OUTPUT_FORMAT
            : TTS_OUTPUT_FORMAT;
        const stored = await storeAudioInBucket(userId, generationId, audioBuffer, outputFormat);

        if (!stored.url) {
            const failure = failureFor('storage');
            const reason = `audio storage failed: ${stored.error ?? 'unknown'}`;
            const refunded = await refundCredits(userId, creditsNeeded, generationId, 'Audio storage failed');
            charge = null;
            logger.error('Generation failed', undefined, {
                event: 'tts.failed', generationId, ...logCtx, attempts, category: failure.category,
                elapsedMs: elapsedMs(), refunded, reason,
            });
            await recordFailedGeneration(ctx, failure, reason, attempts, elapsedMs());
            alertAfterResponse('storage', `Generated audio could not be saved to Supabase Storage: ${stored.error ?? 'unknown'}`,
                { engine, generationId });
            return failureResponse(failure, generationId, refunded ? creditsNeeded : 0);
        }

        // 12. Save to history (non-critical — no refund if this fails)
        charge = null;
        delivered = true;
        await saveToHistory(
            userId,
            text,
            voice_id,
            voice_name || voiceNameForApi,
            stored.url,
            charactersUsed,
            creditsNeeded,
            voice_settings || {}
        );

        logger.info('Generation completed', {
            event: 'tts.completed', generationId, ...logCtx, attempts, elapsedMs: elapsedMs(),
        });

        // 13. Return success response
        return NextResponse.json({
            success: true,
            audioUrl: stored.url,
            taskId: generationId,
            usage: {
                characters: charactersUsed,
                creditsUsed: creditsNeeded,
                creditsRemaining: creditResult.newBalance,
            }
        });

    } catch (error) {
        // Unexpected error (a bug, not an engine answer). If credits were
        // taken and not yet returned, return them before answering.
        const reason = shortReason(error);
        const pending = charge;
        logger.error('Unexpected error in TTS route', error instanceof Error ? error : new Error(reason), {
            event: 'tts.unexpected_error', generationId: pending?.generationId, userId: pending?.userId,
            charged: !!pending, delivered, elapsedMs: Date.now() - requestStartedAt,
        });

        let message = 'Something went wrong on our side, so nothing was charged. Please try again.';
        if (pending) {
            const refunded = await refundCredits(pending.userId, pending.credits, pending.generationId,
                `unexpected error: ${reason.substring(0, 120)}`);
            if (!refunded) {
                message = 'Something went wrong on our side. We could not return your credits automatically; '
                    + `our team has been alerted and will restore them. Reference: ${pending.generationId}.`;
            }
        } else if (delivered) {
            // The audio was made, stored and paid for; only the reply failed.
            message = 'Your audio was created, but something went wrong showing it. Please refresh the page.';
        }

        return NextResponse.json(
            {
                error: 'Generation failed',
                code: 'unexpected_error',
                message,
                generationId: pending?.generationId,
            },
            { status: 500 }
        );
    }
}
