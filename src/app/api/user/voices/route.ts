import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

// Slot limits by tier (matching your pricing plans)
const SLOT_LIMITS: Record<string, number> = {
    free: 5,
    starter: 10,
    creator: 20,
    pro: 30,
    advanced: 50,
};

// Get authenticated user from request
async function getAuthenticatedUser() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return null;
    }
    return user;
}

// Get user profile from database
async function getUserProfile(userId: string) {
    const admin = getAdminClient();
    const { data, error } = await admin
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching user profile:', error);
        return { subscription_tier: 'free' };
    }
    return data;
}

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const admin = getAdminClient();
        const userId = user.id;

        // Get user's subscription tier
        const profile = await getUserProfile(userId);
        const tier = profile?.subscription_tier || 'free';
        const slotsTotal = SLOT_LIMITS[tier] || 5;

        // Get saved voices from database
        const { data: voices, error } = await admin
            .from('saved_voices')
            .select('voice_id, voice_name, voice_category, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching saved voices:', error);
            return NextResponse.json(
                { error: 'Failed to fetch voices' },
                { status: 500 }
            );
        }

        // Transform to match expected format
        const transformedVoices = (voices || []).map(v => ({
            voiceId: v.voice_id,
            voiceName: v.voice_name,
            category: v.voice_category,
            addedAt: v.created_at,
        }));

        return NextResponse.json({
            voices: transformedVoices,
            slotsUsed: transformedVoices.length,
            slotsTotal,
            slotsRemaining: Math.max(0, slotsTotal - transformedVoices.length),
            tier,
        });
    } catch (error) {
        console.error('My Voices GET Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const admin = getAdminClient();
        const userId = user.id;
        const body = await request.json();
        const { voiceId, voiceName, voiceCategory } = body;

        if (!voiceId || !voiceName) {
            return NextResponse.json(
                { error: 'Voice ID and name are required' },
                { status: 400 }
            );
        }

        // Get user's subscription tier and current voice count
        const profile = await getUserProfile(userId);
        const tier = profile?.subscription_tier || 'free';
        const slotsTotal = SLOT_LIMITS[tier] || 5;

        // Count current voices
        const { count, error: countError } = await admin
            .from('saved_voices')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (countError) {
            console.error('Error counting voices:', countError);
            return NextResponse.json(
                { error: 'Failed to check slot limit' },
                { status: 500 }
            );
        }

        const currentCount = count || 0;

        // Check slot limit
        if (currentCount >= slotsTotal) {
            return NextResponse.json({
                error: 'Slot limit reached',
                message: `You have reached your limit of ${slotsTotal} voices. Upgrade to add more.`,
            }, { status: 403 });
        }

        // Insert the voice
        const { error: insertError } = await admin
            .from('saved_voices')
            .insert({
                user_id: userId,
                voice_id: voiceId,
                voice_name: voiceName,
                voice_category: voiceCategory || null,
            });

        if (insertError) {
            // Check for unique constraint violation (voice already added)
            if (insertError.code === '23505') {
                return NextResponse.json(
                    { error: 'Voice already in My Voices' },
                    { status: 409 }
                );
            }
            console.error('Error saving voice:', insertError);
            return NextResponse.json(
                { error: 'Failed to save voice' },
                { status: 500 }
            );
        }

        const newCount = currentCount + 1;

        return NextResponse.json({
            success: true,
            message: 'Voice added to My Voices',
            slotsUsed: newCount,
            slotsTotal,
            slotsRemaining: slotsTotal - newCount,
        });
    } catch (error) {
        console.error('My Voices POST Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const admin = getAdminClient();
        const userId = user.id;
        const { searchParams } = new URL(request.url);
        const voiceId = searchParams.get('voiceId');

        if (!voiceId) {
            return NextResponse.json(
                { error: 'Voice ID is required' },
                { status: 400 }
            );
        }

        // Delete the voice
        const { error: deleteError } = await admin
            .from('saved_voices')
            .delete()
            .eq('user_id', userId)
            .eq('voice_id', voiceId);

        if (deleteError) {
            console.error('Error deleting voice:', deleteError);
            return NextResponse.json(
                { error: 'Failed to remove voice' },
                { status: 500 }
            );
        }

        // Get updated count
        const profile = await getUserProfile(userId);
        const tier = profile?.subscription_tier || 'free';
        const slotsTotal = SLOT_LIMITS[tier] || 5;

        const { count } = await admin
            .from('saved_voices')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        const currentCount = count || 0;

        return NextResponse.json({
            success: true,
            message: 'Voice removed from My Voices',
            slotsUsed: currentCount,
            slotsTotal,
            slotsRemaining: slotsTotal - currentCount,
        });
    } catch (error) {
        console.error('My Voices DELETE Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
