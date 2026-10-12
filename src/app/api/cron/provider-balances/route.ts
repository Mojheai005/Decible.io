// ===========================================
// SCHEDULED: PROVIDER BALANCE CHECK
// ===========================================
// All three voice providers are prepaid. From 28 Sep to 12 Oct 2026 Smallest.ai
// and Fish Audio sat at zero and refused every request, and nothing told
// anyone: a refused request costs nothing, so the providers' dashboards stay
// quiet. This reads each balance (no audio is generated) and alerts below a
// threshold, so an account is topped up before users notice.
//
// Called daily by Vercel Cron (vercel.json), which sends CRON_SECRET as a
// bearer token. Hourly is better if the Vercel plan allows it.
// Also callable by hand: GET with header x-admin-secret: <ADMIN_API_SECRET>.
//
// Thresholds (optional env vars, defaults in brackets):
//   LOW_BALANCE_SMALLEST_USD [25]    ~ half a day at normal volume
//   LOW_BALANCE_FISH_USD     [5]
//   LOW_BALANCE_KIE_CREDITS  [3000]
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { alertOps } from '@/lib/alerts';
import { logger } from '@/lib/logger';
import { safeEqual } from '@/lib/secure-compare';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorised(request: NextRequest): boolean {
    const cron = process.env.CRON_SECRET;
    const admin = process.env.ADMIN_API_SECRET;
    return (!!cron && safeEqual(request.headers.get('authorization'), `Bearer ${cron}`))
        || (!!admin && safeEqual(request.headers.get('x-admin-secret'), admin));
}

/** A threshold from the environment; 0 is a valid choice (alert only when unreadable). */
function threshold(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '') return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
        logger.warn('Ignoring invalid balance threshold', { event: 'ops.bad_threshold', name, value: raw, using: fallback });
        return fallback;
    }
    return n;
}

type Check = {
    provider: string;
    ok: boolean;
    balance: number | null;
    unit: 'USD' | 'credits';
    threshold: number;
    detail?: string;
};

async function read(url: string, key: string | undefined): Promise<{ status: number | string; json: unknown }> {
    if (!key) return { status: 'NO_KEY', json: null };
    try {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(10_000),
        });
        return { status: res.status, json: await res.json().catch(() => null) };
    } catch (err) {
        return { status: 'NETWORK', json: { error: err instanceof Error ? err.message : String(err) } };
    }
}

const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

export async function GET(request: NextRequest) {
    if (!process.env.CRON_SECRET && !process.env.ADMIN_API_SECRET) {
        return NextResponse.json({ error: 'CRON_SECRET or ADMIN_API_SECRET must be configured' }, { status: 503 });
    }
    if (!authorised(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const thresholds = {
        smallest: threshold('LOW_BALANCE_SMALLEST_USD', 25),
        fish: threshold('LOW_BALANCE_FISH_USD', 5),
        kie: threshold('LOW_BALANCE_KIE_CREDITS', 3000),
    };

    const [smallest, fish, kie] = await Promise.all([
        read('https://api.smallest.ai/payment/v1/credits/balance', process.env.SMALLEST_API_KEY),
        read('https://api.fish.audio/wallet/self/api-credit', process.env.FISH_AUDIO_API_KEY),
        read('https://api.kie.ai/api/v1/chat/credit', process.env.KIEAI_API_KEY),
    ]);

    const checks: Check[] = [
        {
            provider: 'Smallest.ai',
            balance: num((smallest.json as { data?: { creditBalance?: unknown } } | null)?.data?.creditBalance),
            unit: 'USD', threshold: thresholds.smallest, ok: false, detail: `HTTP ${smallest.status}`,
        },
        {
            provider: 'Fish Audio',
            balance: num((fish.json as { credit?: unknown } | null)?.credit),
            unit: 'USD', threshold: thresholds.fish, ok: false, detail: `HTTP ${fish.status}`,
        },
        {
            provider: 'Kie.ai',
            balance: num((kie.json as { data?: unknown } | null)?.data),
            unit: 'credits', threshold: thresholds.kie, ok: false, detail: `HTTP ${kie.status}`,
        },
    ];

    for (const c of checks) {
        c.ok = c.balance !== null && c.balance >= c.threshold;
        const amount = c.balance === null ? null : (c.unit === 'USD' ? `$${c.balance.toFixed(2)}` : `${Math.round(c.balance).toLocaleString('en-IN')} credits`);
        if (c.balance === null) {
            await alertOps(`balance:${c.provider}`, `Could not read the ${c.provider} balance (${c.detail}). `
                + 'Check the key and the account dashboard.', { provider: c.provider, detail: c.detail });
        } else if (!c.ok) {
            await alertOps(`balance:${c.provider}`, `${c.provider} balance is low: ${amount} `
                + `(alert below ${c.unit === 'USD' ? `$${c.threshold}` : `${c.threshold} credits`}). Top it up `
                + 'before it reaches zero, or every voice on it will fail.', { provider: c.provider, balance: c.balance });
        }
    }

    logger.info('Provider balances checked', {
        event: 'ops.balances_checked',
        balances: Object.fromEntries(checks.map(c => [c.provider, c.balance])),
        allOk: checks.every(c => c.ok),
    });

    return NextResponse.json({ checked_at: new Date().toISOString(), all_ok: checks.every(c => c.ok), checks });
}
