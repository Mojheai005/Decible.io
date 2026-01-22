// ===========================================
// RAZORPAY WEBHOOK HANDLER
// ===========================================
// Handles async payment events from Razorpay

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminClient } from '@/lib/supabase/admin';

// Razorpay webhook event types
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

function verifyWebhookSignature(
    body: string,
    signature: string
): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
        console.error('[Webhook] Webhook secret not configured');
        return false;
    }

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

    return expectedSignature === signature;
}

export async function POST(request: NextRequest) {
    try {
        // 1. Get raw body and signature
        const rawBody = await request.text();
        const signature = request.headers.get('x-razorpay-signature');

        if (!signature) {
            return NextResponse.json(
                { error: 'Missing signature' },
                { status: 400 }
            );
        }

        // 2. Verify webhook signature
        const isValid = verifyWebhookSignature(rawBody, signature);

        if (!isValid) {
            console.error('[Webhook] Invalid signature');
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 400 }
            );
        }

        // 3. Parse event
        const event = JSON.parse(rawBody) as RazorpayWebhookEvent;
        const admin = getAdminClient();


        // 4. Handle different event types
        switch (event.event) {
            case 'payment.captured': {
                const payment = event.payload.payment?.entity;
                if (!payment) break;

                const orderId = payment.order_id;
                const userId = payment.notes?.userId;
                const credits = parseInt(payment.notes?.credits || '0', 10);

                // Update order status
                await admin
                    .from('payment_orders')
                    .update({
                        status: 'completed',
                        razorpay_payment_id: payment.id,
                        completed_at: new Date().toISOString(),
                    })
                    .eq('razorpay_order_id', orderId);

                // Add credits if not already added
                if (userId && credits > 0) {
                    const { data: orderRecord } = await admin
                        .from('payment_orders')
                        .select('credits_added')
                        .eq('razorpay_order_id', orderId)
                        .single();

                    const orderData = orderRecord as { credits_added?: boolean } | null;
                    if (!orderData?.credits_added) {
                        await admin.rpc('add_credits', {
                            p_user_id: userId,
                            p_amount: credits,
                            p_description: 'Plan purchase (webhook)',
                            p_reference_id: payment.id,
                        });

                        await admin
                            .from('payment_orders')
                            .update({ credits_added: true })
                            .eq('razorpay_order_id', orderId);

                    }
                }
                break;
            }

            case 'payment.failed': {
                const payment = event.payload.payment?.entity;
                if (!payment) break;

                await admin
                    .from('payment_orders')
                    .update({
                        status: 'failed',
                        error_code: payment.error_code,
                        error_description: payment.error_description,
                    })
                    .eq('razorpay_order_id', payment.order_id);

                break;
            }

            case 'order.paid': {
                const order = event.payload.order?.entity;
                if (!order) break;

                await admin
                    .from('payment_orders')
                    .update({ status: 'paid' })
                    .eq('razorpay_order_id', order.id);

                break;
            }

            default:
                break;
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('[Webhook] Error processing webhook:', error);
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 500 }
        );
    }
}
