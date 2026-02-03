import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

// Get authenticated user
async function getAuthenticatedUser() {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
}

export async function GET(request: Request) {
    try {
        // Authenticate user
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50', 10);

        const admin = getAdminClient();

        // Fetch history from Supabase generation_history table
        const { data: historyData, error } = await admin
            .from('generation_history')
            .select('id, text, voice_id, voice_name, audio_url, characters_used, credits_used, settings, status, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching history:', error);
            return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
        }

        // Transform to match frontend expectations
        const history = (historyData || []).map((item: {
            id: string;
            text: string | null;
            voice_id: string;
            voice_name: string | null;
            audio_url: string | null;
            characters_used: number | null;
            credits_used: number | null;
            settings: Record<string, unknown> | null;
            status: string | null;
            created_at: string;
        }) => ({
            id: item.id,
            text: item.text || 'Voice Generation',
            voiceName: item.voice_name || 'Unknown Voice',
            voiceId: item.voice_id,
            date: item.created_at,
            duration: item.characters_used ? `${item.characters_used} chars` : 'Audio',
            url: item.audio_url,
            audioUrl: item.audio_url,
            status: item.status || 'completed',
            creditsUsed: item.credits_used,
            settings: item.settings,
        }));

        return NextResponse.json({ history });

    } catch (error) {
        console.error('History API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
