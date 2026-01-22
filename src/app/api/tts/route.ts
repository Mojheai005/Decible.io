import { NextRequest, NextResponse } from 'next/server';
import { getNextApiKey, getCurrentApiKey } from '@/lib/dubvoice';
import { API_CONFIG, CREDITS_CONFIG } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { checkUserRateLimit, getRateLimitHeaders, TIER_RATE_LIMITS } from '@/lib/rate-limiter';

const DUBVOICE_BASE_URL = API_CONFIG.DUBVOICE_BASE_URL;

// Get authenticated user
async function getAuthenticatedUser() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
}

// Get user profile with credits
async function getUserProfile(userId: string) {
    const admin = getAdminClient();
    const { data, error } = await admin
        .from('user_profiles')
        .select('credits_remaining, subscription_tier')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
    return data;
}

// Deduct credits and log transaction
async function useCredits(userId: string, amount: number, description: string, referenceId?: string) {
    const admin = getAdminClient();

    const { data, error } = await admin.rpc('use_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_description: description,
        p_reference_id: referenceId || null,
    });

    if (error) {
        console.error('Error deducting credits:', error);
        return { success: false, error: error.message };
    }

    // The RPC returns a table, so data is an array
    const result = Array.isArray(data) ? data[0] : data;
    return {
        success: result?.success ?? false,
        newBalance: result?.new_balance ?? 0,
        error: result?.error_message,
    };
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

        // 7. Submit Generation Task to DubVoice
        const apiKey = getNextApiKey();

        console.log(`[TTS] User: ${userId}, Characters: ${charactersUsed}, Credits: ${creditsNeeded}`);

        const initResponse = await fetch(`${DUBVOICE_BASE_URL}/tts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text,
                voice_id,
                model_id: 'eleven_multilingual_v2',
                voice_settings: voice_settings || {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    speed: 1.0,
                    style: 0,
                    use_speaker_boost: true
                }
            })
        });

        if (!initResponse.ok) {
            const errorText = await initResponse.text();
            console.error('DubVoice TTS Init Failed:', errorText);
            return NextResponse.json(
                { error: 'TTS Generation Failed', message: 'Failed to start voice generation' },
                { status: initResponse.status }
            );
        }

        const initData = await initResponse.json();
        const taskId = initData.task_id;

        if (!taskId) {
            return NextResponse.json(
                { error: 'No task_id returned from API' },
                { status: 500 }
            );
        }

        // 8. Poll for Completion
        const pollKey = getCurrentApiKey();
        const maxAttempts = API_CONFIG.MAX_POLL_ATTEMPTS;
        const delayMs = API_CONFIG.POLL_INTERVAL_MS;

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, delayMs));

            const statusResponse = await fetch(`${DUBVOICE_BASE_URL}/tts/${taskId}`, {
                headers: { 'Authorization': `Bearer ${pollKey}` },
                cache: 'no-store'
            });

            if (statusResponse.ok) {
                const statusData = await statusResponse.json();

                if (statusData.status === 'completed') {
                    // 9. SUCCESS - Deduct credits
                    const creditResult = await useCredits(
                        userId,
                        creditsNeeded,
                        `TTS Generation: ${charactersUsed} characters`,
                        taskId
                    );

                    if (!creditResult.success) {
                        console.error('Failed to deduct credits:', creditResult.error);
                        // Still return the audio since it was generated
                    }

                    // 10. Save to history
                    await saveToHistory(
                        userId,
                        text,
                        voice_id,
                        voice_name || 'Unknown Voice',
                        statusData.result,
                        charactersUsed,
                        creditsNeeded,
                        voice_settings || {}
                    );

                    return NextResponse.json({
                        success: true,
                        audioUrl: statusData.result,
                        taskId: taskId,
                        usage: {
                            characters: charactersUsed,
                            creditsUsed: creditsNeeded,
                            creditsRemaining: creditResult.newBalance ?? (profile.credits_remaining - creditsNeeded),
                        }
                    });
                } else if (statusData.status === 'failed') {
                    return NextResponse.json(
                        { error: 'Generation Failed', message: statusData.error || 'Voice generation failed' },
                        { status: 500 }
                    );
                }
            }
        }

        // Timeout reached
        return NextResponse.json({
            error: 'Generation Timed Out',
            taskId: taskId,
            isPending: true,
            message: 'Generation is taking longer than expected. Please try again.',
        }, { status: 202 });

    } catch (error) {
        console.error('TTS API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
