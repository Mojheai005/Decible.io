import { NextRequest, NextResponse } from 'next/server';
import { generateTTS } from '@/lib/kieai';
import { getVoiceById } from '@/lib/voices-data';
import { CREDITS_CONFIG } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { checkUserRateLimit, getRateLimitHeaders, TIER_RATE_LIMITS } from '@/lib/rate-limiter';

// Extend Vercel serverless function timeout (max 300s on Pro, 60s on Hobby)
export const maxDuration = 60;

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

// Deduct credits and log transaction
async function useCredits(userId: string, amount: number, description: string, referenceId?: string) {
    const admin = getAdminClient();

    // Get current balance and usage
    const { data: profile, error: fetchError } = await admin
        .from('user_profiles')
        .select('credits_remaining, credits_used_this_month')
        .eq('id', userId)
        .single();

    if (fetchError || !profile) {
        console.error('Error fetching profile for credit deduction:', fetchError);
        return { success: false, error: fetchError?.message || 'Profile not found' };
    }

    const newBalance = profile.credits_remaining - amount;
    if (newBalance < 0) {
        return { success: false, error: 'Insufficient credits', newBalance: profile.credits_remaining };
    }

    // Update credits_remaining and credits_used_this_month
    const { error: updateError } = await admin
        .from('user_profiles')
        .update({
            credits_remaining: newBalance,
            credits_used_this_month: (profile.credits_used_this_month || 0) + amount,
        })
        .eq('id', userId);

    if (updateError) {
        console.error('Error updating credits:', updateError);
        return { success: false, error: updateError.message };
    }

    // Log credit transaction
    const { error: txError } = await admin.from('credit_transactions').insert({
        user_id: userId,
        amount: -amount,
        balance_before: profile.credits_remaining,
        balance_after: newBalance,
        type: 'generation',
        description,
        reference_id: referenceId || null,
        reference_type: 'generation',
    });
    if (txError) {
        console.error('Error logging credit transaction:', txError.message);
    }

    return { success: true, newBalance };
}

// Store audio in Supabase Storage and return public URL
async function storeAudioInBucket(userId: string, generationId: string, audioBuffer: ArrayBuffer): Promise<string | null> {
    try {
        const admin = getAdminClient();
        const filePath = `${userId}/${generationId}.mp3`;

        // Upload to Supabase Storage bucket "audio-generations"
        const { error: uploadError } = await admin.storage
            .from('audio-generations')
            .upload(filePath, audioBuffer, {
                contentType: 'audio/mpeg',
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
        // voice_id from our system maps to voice name for Kie.ai
        const voiceData = getVoiceById(voice_id);
        const voiceNameForApi = voiceData?.voiceName || voice_name || voice_id;

        // 8. Generate TTS using Kie.ai (direct response, no polling!)
        const audioBuffer = await generateTTS({
            text,
            voice: voiceNameForApi,
            voice_settings: voice_settings ? {
                stability: voice_settings.stability ?? 0.5,
                similarity_boost: voice_settings.similarity_boost ?? 0.75,
                speed: voice_settings.speed ?? 1.0,
                style: voice_settings.style ?? 0,
            } : undefined,
        });

        // 9. Generate a unique ID for this generation
        const generationId = `gen_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // 10. Store audio in Supabase Storage
        const storedAudioUrl = await storeAudioInBucket(userId, generationId, audioBuffer);

        if (!storedAudioUrl) {
            // If storage fails, create a blob URL as fallback (for immediate playback)
            // Note: This won't persist, but at least the user gets their audio
            console.error('Failed to store audio, returning error');
            return NextResponse.json(
                { error: 'Failed to store generated audio' },
                { status: 500 }
            );
        }

        // 11. Deduct credits
        const creditResult = await useCredits(
            userId,
            creditsNeeded,
            `TTS Generation: ${charactersUsed} characters`,
            generationId
        );

        if (!creditResult.success) {
            console.error('Failed to deduct credits:', creditResult.error);
        }

        // 12. Save to history
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
                creditsRemaining: creditResult.newBalance ?? (profile.credits_remaining - creditsNeeded),
            }
        });

    } catch (error) {
        console.error('TTS API Error:', error);

        // Handle specific error types
        if (error instanceof Error) {
            if (error.message.includes('Rate limit')) {
                return NextResponse.json(
                    { error: 'Rate limit exceeded', message: error.message },
                    { status: 429 }
                );
            }
            if (error.message.includes('KIEAI_API_KEY')) {
                return NextResponse.json(
                    { error: 'API configuration error', message: 'TTS service not configured' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json(
            { error: 'Internal Server Error', message: 'Failed to generate audio' },
            { status: 500 }
        );
    }
}
