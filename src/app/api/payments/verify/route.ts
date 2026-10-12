// ===========================================
// RAZORPAY PAYMENT VERIFICATION API
// ===========================================
// Called by the browser right after checkout succeeds. The Razorpay webhook
// races this route for the same payment; whichever claims the order first
// adds the credits, and BOTH make sure the purchased plan is applied.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
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

interface VerifyPaymentRequest {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

// Re-applying the plan for an order completed long ago could undo a later
// purchase, so the "already processed" path only heals recent orders.
const HEAL_WINDOW_MS = 60 * 60 * 1000;

function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
        throw new Error('Razorpay secret not configured');
    }
    const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    return safeEqual(expected, String(signature));
}

export async function POST(request: NextRequest) {
    let razorpayOrderId: string | undefined;
    let razorpayPaymentId: string | undefined;
    let userId: string | undefined;

    try {
        // 1. Authenticate user
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            logger.warn('Payment verification without a session', { event: 'payment.verify_unauthenticated' });
            return NextResponse.json(
                { error: 'Your session expired before the payment was confirmed. Please log in again; if you were charged, contact support with your payment ID.' },
                { status: 401 }
            );
        }
        userId = user.id;

        // 2. Parse request body
        const body = await request.json() as VerifyPaymentRequest;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
        razorpayOrderId = razorpay_order_id;
        razorpayPaymentId = razorpay_payment_id;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return NextResponse.json({ error: 'Missing payment verification data' }, { status: 400 });
        }

        // 3. Verify signature
        if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
            logger.error('Invalid payment signature', undefined, {
                event: 'payment.verify_bad_signature', orderId: razorpay_order_id, paymentId: razorpay_payment_id, userId,
            });
            return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
        }

        // 4. Get order from database
        const admin = getAdminClient();
        const { data: order, error: orderError } = await admin
            .from('payment_orders')
            .select(`${PAID_ORDER_COLUMNS}, status, credits_added`)
            .eq('razorpay_order_id', razorpay_order_id)
            .eq('user_id', user.id)
            .single();

        if (orderError || !order) {
            logger.error('Paid order not found', undefined, {
                event: 'payment.verify_order_missing', orderId: razorpay_order_id, paymentId: razorpay_payment_id,
                userId, code: orderError?.code,
            });
            return NextResponse.json(
                { error: `We could not find this order. If you were charged, contact support with payment ID ${razorpay_payment_id}.` },
                { status: 404 }
            );
        }

        const orderData = order as PaidOrder & { status: string; credits_added: boolean };

        // Already credited — by an earlier call or by the webhook. Make sure
        // the plan is applied as well: the webhook used to add credits only.
        // 'completed' counts as credited even without the flag: 1,441 orders
        // from before 3 Sep 2026 have credits_added = false (see lib/payments).
        if (orderData.credits_added || orderData.status === 'completed') {
            const recent = orderData.completed_at
                && Date.now() - new Date(orderData.completed_at).getTime() < HEAL_WINDOW_MS;
            if (recent) await applyPlanPurchase(admin, orderData);
            return NextResponse.json({
                success: true,
                message: 'Payment already processed',
                credits: orderData.credits,
            });
        }

        // 5. Atomically claim the right to credit this order (see the webhook).
        const completedAt = new Date().toISOString();
        const { data: claimedOrder, error: claimError } = await admin
            .from('payment_orders')
            .update({
                status: 'completed',
                razorpay_payment_id,
                razorpay_signature,
                completed_at: completedAt,
                credits_added: true,
                error_code: null,
                error_description: null,
            })
            .eq('id', orderData.id)
            .eq('credits_added', false)
            .in('status', CLAIMABLE_STATUSES)
            .select(PAID_ORDER_COLUMNS)
            .maybeSingle();

        if (claimError) {
            logger.error('Could not claim order for crediting', undefined, {
                event: 'payment.verify_claim_failed', orderId: orderData.id, userId, code: claimError.code, detail: claimError.message,
            });
            return NextResponse.json(
                { error: `Payment received but not yet applied. Please refresh in a minute, or contact support with payment ID ${razorpay_payment_id}.` },
                { status: 500 }
            );
        }

        if (!claimedOrder) {
            // The webhook got here first and added the credits. Apply the plan.
            const { data: fresh } = await admin
                .from('payment_orders')
                .select(PAID_ORDER_COLUMNS)
                .eq('id', orderData.id)
                .maybeSingle();
            if (fresh) await applyPlanPurchase(admin, fresh as PaidOrder);
            return NextResponse.json({ success: true, message: 'Payment already processed', credits: orderData.credits });
        }

        const claimed = claimedOrder as PaidOrder;

        // 6. Add credits. The amount comes from our own row, never from the client.
        const { data: newBalance, error: creditError } = await admin.rpc('add_credits', {
            p_user_id: user.id,
            p_amount: claimed.credits,
            p_type: 'topup',
            p_description: creditDescription(claimed, 'verify'),
            p_reference_id: razorpay_payment_id,
        });

        if (creditError) {
            // Release the claim completely, status included, so the webhook or
            // a retry of this call can credit it. Leaving it 'completed' made
            // every retry report "already processed" without adding credits.
            await admin.from('payment_orders').update(RELEASE_CLAIM).eq('id', claimed.id);
            logger.error('Payment claimed but credits could not be added', undefined, {
                event: 'payment.credit_failed', orderId: claimed.id, paymentId: razorpay_payment_id, userId,
                credits: claimed.credits, code: creditError.code, detail: creditError.message,
            });
            return NextResponse.json(
                { error: `Payment received but credits could not be added yet. Contact support with payment ID ${razorpay_payment_id}.` },
                { status: 500 }
            );
        }

        // 7. Plan purchases change the plan; top-ups do not.
        const planApplied = await applyPlanPurchase(admin, claimed);

        logger.info('Payment verified and credited', {
            event: 'payment.verified', orderId: claimed.id, paymentId: razorpay_payment_id, userId,
            orderType: claimed.order_type, planId: claimed.plan_id, credits: claimed.credits, planApplied,
        });

        return NextResponse.json({
            success: true,
            message: 'Payment verified successfully',
            credits: claimed.credits,
            newBalance: newBalance as number,
            // The credits are in; the plan change will be retried (by the
            // webhook, or by this call within the hour) if it did not apply.
            planPending: isPlanOrder(claimed.order_type) && !planApplied,
        });

    } catch (error) {
        logger.error('Payment verification error', error instanceof Error ? error : new Error(String(error)), {
            event: 'payment.verify_error', orderId: razorpayOrderId, paymentId: razorpayPaymentId, userId,
        });
        return NextResponse.json(
            { error: razorpayPaymentId
                ? `We could not confirm your payment. If you were charged, contact support with payment ID ${razorpayPaymentId}.`
                : 'Payment verification failed' },
            { status: 500 }
        );
    }
}
