// ===========================================
// UNFINISHED SCRIPT TO VOICE RUNS
// ===========================================
// Runs from the last 14 days whose parts were made (and paid for) but never
// joined into a file, e.g. because the page was closed before the last step.
// The Script to Voice page lists them with a free "Join" button.
// ===========================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

const LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

interface PartRow {
    created_at: string;
    voice_name: string | null;
    settings: { scriptRun?: { id: string; part: number; total: number } } | null;
}

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

        const admin = getAdminClient();
        const since = new Date(Date.now() - LOOKBACK_MS).toISOString();

        const [{ data: parts, error: partsError }, { data: joins, error: joinsError }] = await Promise.all([
            admin.from('generation_history')
                .select('created_at, voice_name, settings')
                .eq('user_id', user.id)
                .eq('status', 'completed')
                .not('settings->scriptRun', 'is', null)
                .gte('created_at', since)
                .limit(2000),
            admin.from('generation_history')
                .select('settings')
                .eq('user_id', user.id)
                .eq('voice_id', 'batch')
                .gte('created_at', since)
                .limit(500),
        ]);
        if (partsError || joinsError) {
            return NextResponse.json({ error: 'Could not load your voiceovers' }, { status: 500 });
        }

        const joined = new Set(
            ((joins ?? []) as Array<{ settings: { runId?: string } | null }>)
                .map(j => j.settings?.runId)
                .filter(Boolean) as string[],
        );

        const runs = new Map<string, { id: string; voiceName: string; total: number; parts: Set<number>; lastAt: string }>();
        for (const row of (parts ?? []) as PartRow[]) {
            const tag = row.settings?.scriptRun;
            if (!tag) continue;
            const run = runs.get(tag.id) ?? { id: tag.id, voiceName: row.voice_name || 'Script Voice', total: tag.total, parts: new Set<number>(), lastAt: row.created_at };
            run.parts.add(Number(tag.part));
            if (row.created_at > run.lastAt) run.lastAt = row.created_at;
            runs.set(tag.id, run);
        }

        const unfinished = [...runs.values()]
            .filter(r => !joined.has(r.id))
            .map(r => {
                let ready = 0;
                while (r.parts.has(ready)) ready++; // parts in order from the start
                return { runId: r.id, voiceName: r.voiceName, totalParts: r.total, partsReady: ready, lastPartAt: r.lastAt };
            })
            .filter(r => r.partsReady > 0)
            .sort((a, b) => b.lastPartAt.localeCompare(a.lastPartAt))
            .slice(0, 10);

        return NextResponse.json({ unfinished });
    } catch {
        return NextResponse.json({ error: 'Could not load your voiceovers' }, { status: 500 });
    }
}
