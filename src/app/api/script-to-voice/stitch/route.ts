// ===========================================
// AUDIO STITCHER — join a Script to Voice run into one file
// ===========================================
// The joining itself lives in lib/stitch, shared with the automatic join
// that runs on the server when the last part of a run is made.
//
// With a runId the server reads the run's saved parts itself, so "Join"
// works after a refresh and can never include someone else's audio. The
// audioUrls form is kept for pages opened before runs had ids.
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { SCRIPT_TO_VOICE_MAX_PARTS } from '@/lib/constants';
import { JoinFailure, RUN_ID_PATTERN, joinAndStore, loadRunParts } from '@/lib/stitch';
import { logger } from '@/lib/logger';

export const maxDuration = 120;

interface StitchRequest {
    audioUrls?: string[];
    voiceName?: string;
    runId?: string;
}

export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate user
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // 2. Parse request
        const body = await request.json().catch(() => ({})) as StitchRequest;
        const { audioUrls, voiceName, runId } = body;
        const admin = getAdminClient();

        // 3a. A run: join the parts saved on the server, in order.
        if (typeof runId === 'string' && RUN_ID_PATTERN.test(runId)) {
            const run = await loadRunParts(admin, user.id, runId);
            if (!run.urls.length) {
                return NextResponse.json({ error: 'No saved parts were found for this voiceover.' }, { status: 404 });
            }
            const joined = await joinAndStore(admin, {
                userId: user.id, audioUrls: run.urls, voiceName: voiceName || run.voiceName, runId, totalParts: run.total,
            });
            return NextResponse.json({
                success: true,
                audioUrl: joined.url,
                totalChunks: joined.parts,
                totalSize: joined.totalSize,
                partial: run.total !== null && joined.parts < run.total,
            });
        }

        // 3b. A list of part addresses (pages opened before runs had ids).
        if (!Array.isArray(audioUrls) || audioUrls.length === 0) {
            return NextResponse.json({ error: 'No audio URLs provided' }, { status: 400 });
        }
        if (audioUrls.length > SCRIPT_TO_VOICE_MAX_PARTS) {
            return NextResponse.json(
                { error: `Too many parts to join (the most is ${SCRIPT_TO_VOICE_MAX_PARTS})` },
                { status: 400 },
            );
        }
        // Only the caller's own saved parts. This route used to download any
        // address the browser sent it. The normalised address is compared, so
        // "/../" cannot step outside the folder.
        const ownFolder = admin.storage.from('audio-generations').getPublicUrl(`${user.id}/`).data.publicUrl;
        const isOwnPart = (url: unknown) => {
            if (typeof url !== 'string') return false;
            try { return new URL(url).href.startsWith(ownFolder) && !/%2e%2e|\.\./i.test(url); } catch { return false; }
        };
        if (!audioUrls.every(isOwnPart)) {
            return NextResponse.json({ error: 'These audio parts do not belong to your account.' }, { status: 400 });
        }

        const joined = await joinAndStore(admin, { userId: user.id, audioUrls, voiceName });
        return NextResponse.json({
            success: true,
            audioUrl: joined.url,
            totalChunks: joined.parts,
            totalSize: joined.totalSize,
        });

    } catch (error) {
        if (error instanceof JoinFailure) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }
        const msg = error instanceof Error ? error.message : 'Stitch failed';
        logger.error('Joining voiceover parts failed', error instanceof Error ? error : undefined, { event: 's2v.join_failed', detail: msg });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
