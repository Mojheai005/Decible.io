import { NextRequest, NextResponse } from 'next/server';
import { generateTTS, TTS_OUTPUT_FORMAT } from '@/lib/kieai';
import { generateFishTTS } from '@/lib/fishaudio';
import { getVoiceById, getVoiceEngine } from '@/lib/voices-data';
import { CREDITS_CONFIG, ENGINE_LIMITS, MAX_PLAUSIBLE_CHARS_PER_SECOND, TTS_MAX_ATTEMPTS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { checkUserRateLimit, getRateLimitHeaders, TIER_RATE_LIMITS } from '@/lib/rate-limiter';

// Extend Vercel serverless function timeout to the project's fluid-compute limit.
// Must comfortably exceed worst-case Kie polling (90s) + audio download + storage
// upload + refund, so a timeout can never kill the function between the credit
// deduction and the refund.
export const maxDuration = 300;

// Get authenticated user
async function getAuthenticatedUser() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
}

// Get user profile with credits
async function getUserProfile(userId: string): Promise<{ credits_remaining: number; subscription_tier: string; credits_used_this_month: number } | null> {
    const admin = getAdminClient();
    const { data, error } = await admin
        .from('user_profiles')
        .select('credits_remaining, subscription_tier, credits_used_this_month')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
    return data as { credits_remaining: number; subscription_tier: string; credits_used_this_month: number };
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
        console.error('Credit deduction RPC error:', error);
        return { success: false, error: error.message, newBalance: 0 };
    }

    // use_credits returns TABLE (success, new_balance, error_message)
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) {
        return { success: false, error: result?.error_message || 'Credit deduction failed', newBalance: result?.new_balance ?? 0 };
    }

    return { success: true, newBalance: result.new_balance };
}

// Refund credits on generation failure using stored procedure.
// Retries with backoff; if every attempt fails, a PENDING_REFUND marker row is
// written to generation_history so support can find and resolve it (a silent
// log line alone is not durable).
async function refundCredits(userId: string, amount: number, referenceId: string, reason: string) {
    const admin = getAdminClient();
    const RETRY_DELAYS_MS = [0, 500, 2000];

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

            if (!error) {
                console.log(`[Credits] Refunded ${amount} credits to ${userId} — ${reason} (attempt ${attempt + 1})`);
                return true;
            }
            console.error(`Credit refund attempt ${attempt + 1} failed`, { userId, amount, referenceId, error });
        } catch (err) {
            console.error(`Credit refund attempt ${attempt + 1} exception`, { userId, amount, referenceId, err });
        }
    }

    console.error('CRITICAL: Credit refund failed after all retries', { userId, amount, referenceId, reason });

    // Durable marker so the missing refund is discoverable in the database
    // (uses only columns the normal history insert already relies on)
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
        console.error('CRITICAL: Failed to write PENDING_REFUND marker', { userId, amount, referenceId, markerErr });
    }

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
async function storeAudioInBucket(userId: string, generationId: string, audioBuffer: ArrayBuffer): Promise<string | null> {
    try {
        const admin = getAdminClient();
        const filePath = `${userId}/${generationId}.${TTS_OUTPUT_FORMAT.extension}`;

        // Upload to Supabase Storage bucket "audio-generations"
        const { error: uploadError } = await admin.storage
            .from('audio-generations')
            .upload(filePath, audioBuffer, {
                contentType: TTS_OUTPUT_FORMAT.mimeType,
                upsert: true,
            });

        if (uploadError) {
            console.error('Failed to upload audio to storage:', uploadError.message);
            return null;
        }

        // Get public URL
        const { data: urlData } = admin.storage
            .from('audio-generations')
            .getPublicUrl(filePath);

        return urlData?.publicUrl || null;
    } catch (err) {
        console.error('Error storing audio in bucket:', err);
        return null;
    }
}

// Save generation to history
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
        console.error('Error saving to history:', error);
    }
}

export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate user
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const userId = user.id;

        // 2. Get user profile and check credits
        const profile = await getUserProfile(userId);

        if (!profile) {
            return NextResponse.json(
                { error: 'User profile not found' },
                { status: 404 }
            );
        }

        // 3. Parse request body
        const body = await request.json();
        const { text, voice_id, voice_name, voice_settings } = body;

        if (!text || !voice_id) {
            return NextResponse.json(
                { error: 'Missing text or voice_id' },
                { status: 400 }
            );
        }

        // 4. Calculate credits needed (1 credit per character)
        const charactersUsed = text.length;
        const creditsNeeded = charactersUsed * CREDITS_CONFIG.COST_PER_CHARACTER;

        // 4b. Reject anything above the engine's proven-safe ceiling BEFORE
        // charging. Previously this was unbounded: oversized text was accepted,
        // billed in full, and silently truncated by the engine.
        const engine = getVoiceEngine(voice_id);
        const engineMaxChars = ENGINE_LIMITS[engine].maxCharsPerRequest;
        if (charactersUsed > engineMaxChars) {
            return NextResponse.json({
                error: 'Text too long for this voice',
                engine,
                maxCharsPerRequest: engineMaxChars,
                charactersSubmitted: charactersUsed,
                message: `This voice runs on ${engine}, which reliably handles `
                    + `${engineMaxChars} characters per request. Split the text into `
                    + `smaller parts (Script to Voice does this automatically).`,
            }, { status: 413 });
        }

        // 5. Check if user has enough credits
        if (profile.credits_remaining < creditsNeeded) {
            return NextResponse.json({
                error: 'Insufficient credits',
                creditsNeeded,
                creditsRemaining: profile.credits_remaining,
                message: `You need ${creditsNeeded} credits but only have ${profile.credits_remaining}. Please upgrade or purchase more credits.`,
            }, { status: 402 }); // 402 Payment Required
        }

        // 6. Check rate limits
        const tier = profile.subscription_tier as keyof typeof TIER_RATE_LIMITS || 'free';
        const rateLimitResult = await checkUserRateLimit(userId, tier, 'generation');

        if (!rateLimitResult.success) {
            return NextResponse.json(
                {
                    error: 'Rate limit exceeded',
                    retryAfter: rateLimitResult.retryAfter,
                    message: `Too many requests. Please wait ${rateLimitResult.retryAfter} seconds.`,
                },
                {
                    status: 429,
                    headers: getRateLimitHeaders(rateLimitResult),
                }
            );
        }

        // 7. Get the voice name to send to Kie.ai API
        const voiceData = getVoiceById(voice_id);
        const voiceNameForApi = voiceData?.voiceName || voice_name || voice_id;

        // 8. Generate unique ID for this generation
        const generationId = `gen_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // 9. PRE-DEDUCT credits atomically (row-locked, prevents race conditions)
        const creditResult = await preDeductCredits(
            userId,
            creditsNeeded,
            `TTS Generation: ${charactersUsed} characters`,
            generationId
        );

        if (!creditResult.success) {
            const status = creditResult.error?.includes('Insufficient') ? 402 : 500;
            return NextResponse.json({
                error: creditResult.error || 'Credit deduction failed',
                creditsNeeded,
                creditsRemaining: creditResult.newBalance,
            }, { status });
        }

        // 10. Generate, VERIFYING each result and retrying partial output.
        //
        // Gemini returns a "success" response containing only part of the text
        // roughly 1 in 4 times, at any length — it is non-deterministic, so no
        // input size makes it safe. Previously that partial audio was stored
        // and billed in full. Now every result is measured, and a truncated
        // one is thrown away and re-requested rather than sold to the user.
        const runEngine = async (): Promise<ArrayBuffer> => {
            if (voiceData?.engine === 'fish' && voiceData.fishReferenceId) {
                // Fish Audio S2.1 Pro (synchronous streaming API)
                return generateFishTTS({
                    text,
                    referenceId: voiceData.fishReferenceId,
                    speed: Math.round((voice_settings?.speed ?? 1.0) * 100) / 100,
                });
            }
            // Gemini 3.1 Flash TTS via Kie.ai
            return generateTTS({
                text,
                voice: voiceNameForApi,
                voice_settings: voice_settings ? {
                    stability: Math.round((voice_settings.stability ?? 0.5) * 100) / 100,
                    similarity_boost: Math.round((voice_settings.similarity_boost ?? 0.75) * 100) / 100,
                    speed: Math.round((voice_settings.speed ?? 1.0) * 100) / 100,
                    style: Math.round((voice_settings.style ?? 0) * 100) / 100,
                } : undefined,
            });
        };

        let audioBuffer: ArrayBuffer | null = null;
        let lastTruncation: string | null = null;

        for (let attempt = 1; attempt <= TTS_MAX_ATTEMPTS; attempt++) {
            let candidate: ArrayBuffer;
            try {
                candidate = await runEngine();
            } catch (genError) {
                // Hard failure from the engine — refund and surface it.
                await refundCredits(userId, creditsNeeded, generationId, 'TTS generation failed');
                throw genError;
            }

            const truncation = detectTruncation(candidate, charactersUsed,
                voice_settings?.speed ?? 1.0);
            if (!truncation) {
                if (attempt > 1) {
                    console.log(`[TTS] Recovered from truncation on attempt ${attempt}`,
                        { generationId, voice_id, engine });
                }
                audioBuffer = candidate;
                break;
            }

            lastTruncation = truncation;
            console.warn(`[TTS] Truncated output on attempt ${attempt}/${TTS_MAX_ATTEMPTS}`,
                { userId, generationId, voice_id, engine, charactersUsed, truncation });
        }

        // Every attempt came back short — refund in full rather than selling
        // the user a partial voiceover.
        if (!audioBuffer) {
            console.error('[TTS] All attempts truncated', {
                userId, generationId, voice_id, engine, charactersUsed, lastTruncation,
            });
            await refundCredits(userId, creditsNeeded, generationId,
                `Truncated after ${TTS_MAX_ATTEMPTS} attempts: ${lastTruncation}`);
            return NextResponse.json({
                error: 'Incomplete audio',
                message: 'The voice engine kept returning only part of your script, '
                    + 'so nothing was charged. Please try a different voice — '
                    + 'the Fish Audio voices are the most reliable for long text.',
                detail: lastTruncation,
                refunded: creditsNeeded,
            }, { status: 502 });
        }

        // 11. Store audio in Supabase Storage — if this fails, REFUND credits
        const storedAudioUrl = await storeAudioInBucket(userId, generationId, audioBuffer);

        if (!storedAudioUrl) {
            await refundCredits(userId, creditsNeeded, generationId, 'Audio storage failed');
            return NextResponse.json(
                { error: 'Failed to store generated audio' },
                { status: 500 }
            );
        }

        // 12. Save to history (non-critical — no refund if this fails)
        await saveToHistory(
            userId,
            text,
            voice_id,
            voice_name || voiceNameForApi,
            storedAudioUrl,
            charactersUsed,
            creditsNeeded,
            voice_settings || {}
        );

        // 13. Return success response
        return NextResponse.json({
            success: true,
            audioUrl: storedAudioUrl,
            taskId: generationId,
            usage: {
                characters: charactersUsed,
                creditsUsed: creditsNeeded,
                creditsRemaining: creditResult.newBalance,
            }
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('TTS API Error:', errorMessage, error);

        // Handle specific error types
        if (error instanceof Error) {
            if (error.message.includes('Rate limit')) {
                return NextResponse.json(
                    { error: 'Rate limit exceeded', message: error.message },
                    { status: 429 }
                );
            }
            if (error.message.includes('KIEAI_API_KEY') || error.message.includes('FISH_AUDIO_API_KEY')) {
                return NextResponse.json(
                    { error: 'API configuration error', message: 'TTS service not configured' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json(
            { error: 'Generation failed', message: errorMessage },
            { status: 500 }
        );
    }
}
