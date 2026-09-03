// ===========================================
// SCHEDULED: PURGE OLD GENERATED AUDIO
// ===========================================
// Deletes audio older than AUDIO_RETENTION_DAYS from the storage bucket.
//
// Storing uncompressed WAV with no retention put 75 GB into Supabase and blew
// the storage and egress quotas. Audio is now MP3 (~5x smaller) and this keeps
// the bucket at a steady size instead of growing forever.
//
// Deletion is driven by FILE AGE, not by generation_history rows, because
// cleanup_old_history() deletes rows after 90 days without touching the files —
// so a large share of the bucket is orphaned with no row pointing at it.
//
// Called by Vercel Cron (see vercel.json), which sends CRON_SECRET as a bearer
// token. Also runnable by hand with the same header.
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 300;

const BUCKET = 'audio-generations';
const PAGE = 1000;
// Cap per run so a huge backlog cannot exhaust the function timeout. The job
// runs daily, so a backlog drains over a few days and steady state is trivial.
const MAX_DELETES_PER_RUN = 5000;

function retentionDays(): number {
    const raw = Number(process.env.AUDIO_RETENTION_DAYS);
    return Number.isFinite(raw) && raw > 0 ? raw : 15;
}

export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const days = retentionDays();
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const admin = getAdminClient();

    try {
        const listAll = async (prefix: string) => {
            const out: Array<{ name: string; id: string | null; created_at: string;
                               metadata: Record<string, unknown> | null }> = [];
            for (let offset = 0; ; offset += PAGE) {
                const { data, error } = await admin.storage.from(BUCKET)
                    .list(prefix, { limit: PAGE, offset });
                if (error) throw new Error(`list ${prefix || '/'}: ${error.message}`);
                if (!data?.length) break;
                out.push(...(data as typeof out));
                if (data.length < PAGE) break;
            }
            return out;
        };

        const folders = (await listAll('')).filter(e => e.id === null);

        const doomed: string[] = [];
        let bytes = 0;
        let scanned = 0;

        for (const folder of folders) {
            if (doomed.length >= MAX_DELETES_PER_RUN) break;
            for (const f of await listAll(folder.name)) {
                if (f.id === null) continue;
                scanned++;
                if (new Date(f.created_at) < cutoff) {
                    doomed.push(`${folder.name}/${f.name}`);
                    bytes += Number(f.metadata?.size ?? 0);
                    if (doomed.length >= MAX_DELETES_PER_RUN) break;
                }
            }
        }

        let deleted = 0;
        for (let i = 0; i < doomed.length; i += 100) {
            const { error } = await admin.storage.from(BUCKET).remove(doomed.slice(i, i + 100));
            if (error) {
                console.error('[cleanup-audio] batch failed', { at: i, error: error.message });
                continue;
            }
            deleted += Math.min(100, doomed.length - i);
        }

        const result = {
            success: true,
            retention_days: days,
            files_scanned: scanned,
            files_deleted: deleted,
            megabytes_freed: Number((bytes / 1024 / 1024).toFixed(1)),
            capped: doomed.length >= MAX_DELETES_PER_RUN,
        };
        console.log('[cleanup-audio]', JSON.stringify(result));
        return NextResponse.json(result);

    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.error('[cleanup-audio] failed:', detail);
        return NextResponse.json({ success: false, error: detail }, { status: 500 });
    }
}
