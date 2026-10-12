// ===========================================
// RAZORPAY WEBHOOK HANDLER
// ===========================================
// Razorpay calls this server-to-server for every payment event. It is the
// safety net for buyers whose browser never returns from checkout (a phone
// switching to a UPI app and back is the common case): without it they are
// charged and nothing is applied.
//
// Production evidence, 12 Oct 2026: in 3,740 orders since February not one
// was ever marked 'failed' or 'paid', and every credit came from /verify. This
// handler had never processed an event. It needs, in this order:
//   1. Razorpay Dashboard -> Webhooks: URL https://www.decible.io/api/payments/webhook,
//      events payment.captured, payment.failed, order.paid, and a secret.
//   2. The same secret in Vercel as RAZORPAY_WEBHOOK_SECRET, then a redeploy.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { safeEqual } from '@/lib/secure-compare';
import {
    CLAIMABLE_STATUSES,
    PAID_ORDER_COLUMNS,
    PaidOrder,
    RELEASE_CLAIM,
    applyPlanPurchase,
    creditDescription,
    isPlanOrder,
} from '@/lib/payments';

// Razorpay retries a failed delivery for up to 24 hours. Within that window a
// redelivery may finish applying a plan; older orders are never touched.
const PLAN_HEAL_WINDOW_MS = 24 * 60 * 60 * 1000;

interface RazorpayWebhookEvent {
    entity: string;
    account_id: string;
    event: string;
    contains: string[];
    payload: {
        payment?: {
            entity: {
                id: string;
                amount: number;
                currency: string;
                status: string;
                order_id: string;
                method: string;
                captured: boolean;
                notes: Record<string, string>;
                error_code?: string;
                error_description?: string;
                error_reason?: string;
                error_source?: string;
                error_step?: string;
            };
        };
        order?: {
            entity: {
                id: string;
                amount: number;
                status: string;
                notes: Record<string, string>;
            };
        };
    };
    created_at: number;
}

function verifyWebhookSignature(body: string, signature: string): boolean | 'no-secret' {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return 'no-secret';
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return safeEqual(expected, signature);
}

export async function POST(request: NextRequest) {
    let eventName = 'unknown';
    try {
        // 1. Raw body and signature
        const rawBody = await request.text();
        const signature = request.headers.get('x-razorpay-signature');

        if (!signature) {
            return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
        }

        // 2. Verify signature
        const valid = verifyWebhookSignature(rawBody, signature);
        if (valid === 'no-secret') {
            // Loud on purpose: every buyer whose browser does not return from
            // checkout is charged and gets nothing while this is unset.
            logger.error('RAZORPAY_WEBHOOK_SECRET is not set; payment events are being rejected', undefined, {
                event: 'payment.webhook_not_configured',
            });
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
        }
        if (!valid) {
            logger.error('Razorpay webhook signature mismatch', undefined, {
                event: 'payment.webhook_bad_signature',
                hint: 'The secret in the Razorpay dashboard and RAZORPAY_WEBHOOK_SECRET differ',
            });
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        // 3. Parse event
        const event = JSON.parse(rawBody) as RazorpayWebhookEvent;
        eventName = event.event;
        const admin = getAdminClient();

        // 4. Handle event types
        switch (event.event) {
            case 'payment.captured': {
                const payment = event.payload.payment?.entity;
                if (!payment) break;
                const orderId = payment.order_id;

                // Atomically claim the right to credit this order. /verify
                // races us for the same payment, and Razorpay retries on
                // non-2xx. Flipping credits_added false -> true in one
                // conditional UPDATE means exactly one caller credits it.
                // user_id and credits come from our own row, never from notes.
                const { data: claimedOrder, error: claimError } = await admin
                    .from('payment_orders')
                    .update({
                        status: 'completed',
                        razorpay_payment_id: payment.id,
                        completed_at: new Date().toISOString(),
                        credits_added: true,
                        error_code: null,
                        error_description: null,
                    })
                    .eq('razorpay_order_id', orderId)
                    .eq('credits_added', false)
                    .in('status', CLAIMABLE_STATUSES)
                    .select(PAID_ORDER_COLUMNS)
                    .maybeSingle();

                if (claimError) {
                    logger.error('Webhook could not claim order', undefined, {
                        event: 'payment.webhook_claim_failed', orderId, paymentId: payment.id,
                        code: claimError.code, detail: claimError.message,
                    });
                    return NextResponse.json({ error: 'Claim failed' }, { status: 500 }); // Razorpay retries
                }

                if (!claimedOrder) {
                    // Already credited, by /verify or an earlier delivery of
                    // this webhook. If that delivery failed to apply the plan
                    // it answered 500, so this redelivery finishes the job.
                    const { data: existing } = await admin
                        .from('payment_orders')
                        .select(PAID_ORDER_COLUMNS)
                        .eq('razorpay_order_id', orderId)
                        .eq('status', 'completed')
                        .maybeSingle();
                    const prior = existing as PaidOrder | null;
                    if (prior && isPlanOrder(prior.order_type) && prior.completed_at
                        && Date.now() - new Date(prior.completed_at).getTime() < PLAN_HEAL_WINDOW_MS) {
                        if (!(await applyPlanPurchase(admin, prior))) {
                            return NextResponse.json({ error: 'Plan apply failed' }, { status: 500 }); // Razorpay retries
                        }
                    }
                    break;
                }

                const claimed = claimedOrder as PaidOrder;

                const { error: creditError } = await admin.rpc('add_credits', {
                    p_user_id: claimed.user_id,
                    p_amount: claimed.credits,
                    p_type: 'topup',
                    p_description: creditDescription(claimed, 'webhook'),
                    p_reference_id: payment.id,
                });

                if (creditError) {
                    // Release completely (status included) so a retry can credit it.
                    await admin.from('payment_orders').update(RELEASE_CLAIM).eq('razorpay_order_id', orderId);
                    logger.error('Webhook claimed the order but could not add credits', undefined, {
                        event: 'payment.credit_failed', orderId, paymentId: payment.id, userId: claimed.user_id,
                        credits: claimed.credits, code: creditError.code, detail: creditError.message,
                    });
                    return NextResponse.json({ error: 'Credit apply failed' }, { status: 500 }); // Razorpay retries
                }

                // Previously the webhook stopped here, so a plan bought this
                // way added credits but left the buyer on their old plan. If
                // applying it fails, answer 500: Razorpay redelivers, and the
                // already-credited branch above finishes applying the plan.
                if (!(await applyPlanPurchase(admin, claimed))) {
                    return NextResponse.json({ error: 'Plan apply failed' }, { status: 500 });
                }

                logger.info('Payment credited by webhook', {
                    event: 'payment.webhook_credited', orderId, paymentId: payment.id, userId: claimed.user_id,
                    orderType: claimed.order_type, planId: claimed.plan_id, credits: claimed.credits,
                });
                break;
            }

            case 'payment.failed': {
                const payment = event.payload.payment?.entity;
                if (!payment) break;

                // A buyer can retry inside the same order, so never overwrite
                // an order that has since been paid.
                await admin
                    .from('payment_orders')
                    .update({
                        status: 'failed',
                        error_code: payment.error_code ?? null,
                        error_description: [payment.error_description, payment.error_reason && `(${payment.error_reason})`]
                            .filter(Boolean).join(' ') || null,
                    })
                    .eq('razorpay_order_id', payment.order_id)
                    .in('status', ['created', 'failed']);

                logger.warn('Payment failed at Razorpay', {
                    event: 'payment.failed', orderId: payment.order_id, paymentId: payment.id,
                    method: payment.method, amount: payment.amount, code: payment.error_code,
                    reason: payment.error_reason, source: payment.error_source, step: payment.error_step,
                    description: payment.error_description,
                });
                break;
            }

            case 'order.paid': {
                const order = event.payload.order?.entity;
                if (!order) break;

                // Only move unfinished orders forward; never downgrade 'completed'.
                await admin
                    .from('payment_orders')
                    .update({ status: 'paid' })
                    .eq('razorpay_order_id', order.id)
                    .in('status', ['created', 'failed']);
                break;
            }

            default:
                break;
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        logger.error('Error processing Razorpay webhook', error instanceof Error ? error : new Error(String(error)), {
            event: 'payment.webhook_error', razorpayEvent: eventName,
        });
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
