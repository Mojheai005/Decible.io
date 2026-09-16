// ===========================================
// PROVIDER HEALTH — "can production actually reach the TTS engines?"
// ===========================================
// This exists because that question cost nine days.
//
// Smallest.ai went live on 7 Sep 2026 with 249 voices — 69% of the catalog,
// including the default selection — and its dashboard showed no customer
// traffic afterwards. Nothing on either side could distinguish between
// "nobody chose those voices", "the key is missing in Production", and "the
// account is out of money", because a request that never leaves Vercel and a
// request the provider refuses both cost nothing and both appear nowhere.
//
// GET /api/health/providers            -> is each key present in THIS runtime?
// GET /api/health/providers?probe=1    -> also make one tiny real call per
//                                         engine and report what came back.
//
// The probe costs a fraction of a cent and is the only thing that proves the
// whole path works from inside the deployment that serves customers. Key
// VALUES are never returned — only whether one is present and how long it is,
// which is enough to catch an empty or truncated variable.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function checkAuth(request: NextRequest): NextResponse | null {
    const secret = process.env.ADMIN_API_SECRET;
    if (!secret) {
        return NextResponse.json(
            { error: 'ADMIN_API_SECRET not configured' },
            { status: 503 },
        );
    }
    const provided = request.headers.get('x-admin-secret') ?? '';
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return unauthorized();
    return null;
}

/** Presence only — never the value. Length catches an empty or truncated var. */
function keyState(name: string) {
    const v = process.env[name];
    return {
        env_var: name,
        present: typeof v === 'string' && v.length > 0,
        length: v?.length ?? 0,
        // A value pasted with its quotes still attached is a real and very
        // confusing failure: it produces a 401 that looks like a dead key.
        looks_quoted: !!v && (/^["']/.test(v) || /["']$/.test(v)),
    };
}

type ProbeResult = {
    reached: boolean;
    status: number | string;
    ms: number;
    detail?: string;
};

async function probe(fn: () => Promise<Response>): Promise<ProbeResult> {
    const t0 = Date.now();
    try {
        const r = await fn();
        const ms = Date.now() - t0;
        if (r.ok) {
            const buf = await r.arrayBuffer();
            return { reached: true, status: r.status, ms, detail: `${buf.byteLength} bytes of audio` };
        }
        const body = await r.text().catch(() => '');
        return { reached: true, status: r.status, ms, detail: body.slice(0, 200) };
    } catch (e) {
        return {
            reached: false,
            status: 'NETWORK',
            ms: Date.now() - t0,
            detail: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
        };
    }
}

const PROBE_TEXT = 'Health check.';

export async function GET(request: NextRequest) {
    const denied = checkAuth(request);
    if (denied) return denied;

    const keys = {
        smallest: keyState('SMALLEST_API_KEY'),
        fish: keyState('FISH_AUDIO_API_KEY'),
        gemini: keyState('KIEAI_API_KEY'),
    };

    const wantProbe = request.nextUrl.searchParams.get('probe') === '1';
    let probes: Record<string, ProbeResult | { skipped: string }> | undefined;

    if (wantProbe) {
        const smallestKey = process.env.SMALLEST_API_KEY;
        const fishKey = process.env.FISH_AUDIO_API_KEY;

        const [smallest, fish] = await Promise.all([
            smallestKey
                ? probe(() => fetch('https://api.smallest.ai/waves/v1/tts', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${smallestKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        text: PROBE_TEXT,
                        voice_id: 'aarini',
                        model: process.env.SMALLEST_TTS_MODEL || 'lightning_v3.1_pro',
                        output_format: 'mp3',
                        sample_rate: 24000,
                        speed: 1.0,
                        language: 'en',
                    }),
                }))
                : Promise.resolve({ skipped: 'SMALLEST_API_KEY not set in this runtime' }),
            fishKey
                ? probe(() => fetch('https://api.fish.audio/v1/tts', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${fishKey}`,
                        'Content-Type': 'application/json',
                        'model': process.env.FISH_TTS_MODEL || 's2.1-pro',
                    },
                    body: JSON.stringify({
                        text: PROBE_TEXT,
                        reference_id: '2a1036d645634680b3cc69aeeb60375b',
                        format: 'mp3',
                        mp3_bitrate: 128,
                        latency: 'normal',
                        prosody: { speed: 1.0, volume: 0 },
                    }),
                }))
                : Promise.resolve({ skipped: 'FISH_AUDIO_API_KEY not set in this runtime' }),
        ]);

        probes = { smallest, fish };
    }

    return NextResponse.json({
        checked_at: new Date().toISOString(),
        vercel_env: process.env.VERCEL_ENV ?? 'unknown',
        deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown',
        keys,
        probes,
        how_to_read: wantProbe
            ? 'reached=true with status 200 means this deployment can generate on that engine right now. '
              + '401/403 = key wrong. 402 or a billing message = account out of funds. 429 = all concurrency slots busy.'
            : 'Add ?probe=1 to make one real call per engine and prove the whole path, not just that a variable exists.',
    });
}
