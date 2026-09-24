// ===========================================
// PABBLY CONNECT — COURSE PURCHASE GRANT
// ===========================================
// Called by the Pabbly Connect workflow the moment a course purchase completes.
// Records a Pro-plan grant against the buyer's EMAIL, and applies it straight
// away if they already have a Decible account. If they don't, the grant waits
// and the existing database triggers claim it the moment they sign up or log
// in — which is why this works for buyers who have never visited the app.
//
//   POST /api/webhooks/pabbly/grant
//   x-admin-secret: <ADMIN_API_SECRET>
//   { "email": "...", "order_id": "...", "name": "...", "plan": "pro",
//     "amount_paid": 3998 }
//
// IDEMPOTENT ON order_id. Pabbly auto-retries failed steps up to 5 times and
// operators can press "Re-execute Now", so this WILL be called more than once
// for the same purchase. A replay returns the original result and grants
// nothing — enforced by a unique index, not by a check-then-act race.
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase/admin';
import { validateEmail } from '@/lib/validation';
import { getPlanById } from '@/lib/pricing';

const DEFAULT_PLAN = 'pro';

// How long the PLAN runs. This is NOT how long the credits last.
//
// Credits are permanent as of 24 Sep 2026. On day 31 the buyer moves to the
// free plan and keeps every credit they have not spent — expire_credit_grants()
// ends the subscription and never touches the balance, and
// reset_monthly_credits() treats the monthly allowance as a floor rather than
// a ceiling. Before that change, 88 people had 41,961,302 credits reclaimed
// from them; the wording below exists so no buyer is ever told otherwise.
const PLAN_DAYS = 30;

// Domains that are almost certainly a mistyped provider. We do NOT rewrite the
// address — on a paid purchase, guessing could send someone else's credits to
// the wrong inbox — but we flag it so the team can follow up before the buyer
// complains they never received anything. ~1% of addresses have carried one.
const LIKELY_TYPO_DOMAINS = /@(gmai|gamail|gmgmail|ggmail|gmial|gnail)\.com$|\.(con|col|cm|comm)$/i;

function unauthorized(): NextResponse {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

function checkAuth(request: NextRequest): NextResponse | null {
    const secret = process.env.ADMIN_API_SECRET;
    if (!secret) {
        return NextResponse.json(
            { success: false, error: 'Grant webhook not configured' },
            { status: 503 },
        );
    }
    const provided = request.headers.get('x-admin-secret') ?? '';
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    // Length check first — timingSafeEqual throws on a length mismatch.
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return unauthorized();
    return null;
}

export async function POST(request: NextRequest) {
    const denied = checkAuth(request);
    if (denied) return denied;

    try {
        const body = await request.json().catch(() => ({}));

        const email = String(body.email ?? '').trim().toLowerCase();
        const orderId = String(body.order_id ?? body.orderId ?? '').trim();
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : null;
        const planId = String(body.plan ?? DEFAULT_PLAN).trim().toLowerCase();
        const amountPaid = Number.isFinite(Number(body.amount_paid))
            ? Math.round(Number(body.amount_paid) * 100)   // rupees -> paise
            : null;

        // 400s are permanent: the payload is wrong and retrying cannot fix it.
        if (!email || !validateEmail(email)) {
            return NextResponse.json(
                { success: false, error: 'A valid "email" is required' },
                { status: 400 },
            );
        }
        if (!orderId) {
            return NextResponse.json(
                { success: false, error: 'An "order_id" is required — it is what makes retries safe' },
                { status: 400 },
            );
        }

        const plan = getPlanById(planId);
        if (!plan || plan.id === 'free') {
            return NextResponse.json(
                { success: false, error: `Unknown plan "${planId}"` },
                { status: 400 },
            );
        }

        const admin = getAdminClient();

        // 1. Record the grant. The unique index on source_order_id means a
        //    replayed webhook inserts nothing and we detect it below.
        const { data: inserted, error: insertError } = await admin
            .from('pending_credit_grants')
            .insert({
                email,
                credits: plan.credits,
                grant_tier: plan.id,
                batch_key: `pabbly_${plan.id}`,
                note: name ? `Course purchase — ${name}` : 'Course purchase',
                valid_for_days: PLAN_DAYS,
                source: 'pabbly',
                source_order_id: orderId,
                amount_paid_paise: amountPaid,
            })
            .select('id')
            .maybeSingle();

        const isReplay =
            !inserted &&
            (insertError?.code === '23505' || /duplicate key/i.test(insertError?.message ?? ''));

        if (insertError && !isReplay) {
            // Genuine failure — 500 so Pabbly retries. Retrying is safe.
            console.error('[Pabbly] Failed to record grant', { orderId, email, insertError });
            return NextResponse.json(
                { success: false, error: 'Could not record grant', detail: insertError.message },
                { status: 500 },
            );
        }

        // 2. If they already have an account, apply it now rather than waiting
        //    for their next login.
        const { data: profile } = await admin
            .from('user_profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        const accountExists = !!profile;
        let appliedNow = false;

        if (accountExists && !isReplay) {
            const { data: granted, error: claimError } = await admin.rpc('claim_credit_grants', {
                p_user_id: (profile as { id: string }).id,
                p_email: email,
            });
            if (claimError) {
                // The grant row is safely recorded; a later login will claim it.
                console.error('[Pabbly] Grant recorded but immediate claim failed', {
                    orderId, email, claimError,
                });
            } else {
                appliedNow = Number(granted) > 0;
            }
        }

        const planEndsOn = new Date(Date.now() + PLAN_DAYS * 86_400_000)
            .toISOString().slice(0, 10);

        const keepsCredits = `The ${plan.name} plan runs for ${PLAN_DAYS} days. `
            + `Your credits do not expire — whatever you have not used stays in `
            + `your account after that.`;

        const message = isReplay
            ? 'This order was already processed. Nothing changed.'
            : accountExists
                ? `Your Decible account now has the ${plan.name} plan with `
                  + `${plan.credits.toLocaleString('en-IN')} credits. ${keepsCredits} `
                  + `Log in and start generating.`
                : `Sign up at decible.io with ${email} and your ${plan.name} plan with `
                  + `${plan.credits.toLocaleString('en-IN')} credits will be waiting. `
                  + keepsCredits;

        return NextResponse.json({
            success: true,
            status: isReplay ? 'already_processed' : 'granted',
            email,
            order_id: orderId,
            plan: plan.id,
            plan_name: plan.name,
            credits: plan.credits,
            valid_days: PLAN_DAYS,
            account_exists: accountExists,
            applied_now: appliedNow,
            // `expires_on` is kept under its old name so nothing already
            // mapped in Pabbly breaks, but it has always meant the PLAN end
            // date and now says so. Credits never expire.
            expires_on: planEndsOn,
            plan_ends_on: planEndsOn,
            credits_expire: false,
            message,
            ...(LIKELY_TYPO_DOMAINS.test(email) && {
                warning: 'This email domain looks mistyped. The grant is recorded, but '
                       + 'this buyer will never be able to claim it unless the address is corrected.',
            }),
        });

    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.error('[Pabbly] Grant webhook error:', detail);
        return NextResponse.json(
            { success: false, error: 'Grant failed', detail },
            { status: 500 },
        );
    }
}

// Lets the Pabbly engineer confirm the URL and secret before wiring the flow.
export async function GET(request: NextRequest) {
    const denied = checkAuth(request);
    if (denied) return denied;
    return NextResponse.json({
        success: true,
        endpoint: 'pabbly/grant',
        expects: { email: 'string', order_id: 'string', name: 'string?', plan: 'string?', amount_paid: 'number?' },
        note: 'POST to grant. Idempotent on order_id — retries are safe.',
    });
}
