// ===========================================
// RAZORPAY PAYMENT VERIFICATION API
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

interface VerifyPaymentRequest {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

function verifySignature(
    orderId: string,
    paymentId: string,
    signature: string
): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
        throw new Error('Razorpay secret not configured');
    }

    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

    return expectedSignature === signature;
}

export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate user
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // 2. Parse request body
        const body = await request.json() as VerifyPaymentRequest;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return NextResponse.json(
                { error: 'Missing payment verification data' },
                { status: 400 }
            );
        }

        // 3. Verify signature
        const isValid = verifySignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValid) {
            console.error(`[Payment] Invalid signature for order: ${razorpay_order_id}`);
            return NextResponse.json(
                { error: 'Invalid payment signature' },
                { status: 400 }
            );
        }

        // 4. Get order from database
        const admin = getAdminClient();
        const { data: order, error: orderError } = await admin
            .from('payment_orders')
            .select('*')
            .eq('razorpay_order_id', razorpay_order_id)
            .eq('user_id', user.id)
            .single();

        if (orderError || !order) {
            console.error(`[Payment] Order not found: ${razorpay_order_id}`);
            return NextResponse.json(
                { error: 'Order not found' },
                { status: 404 }
            );
        }

        const orderData = order as { id: string; status: string; credits: number; plan_id: string };

        if (orderData.status === 'completed') {
            return NextResponse.json({
                success: true,
                message: 'Payment already processed',
                credits: orderData.credits,
            });
        }

        // 5. Update order status
        await admin
            .from('payment_orders')
            .update({
                status: 'completed',
                razorpay_payment_id,
                razorpay_signature,
                completed_at: new Date().toISOString(),
            })
            .eq('id', orderData.id);

        // 6. Add credits to user using stored procedure
        // The add_credits function logs the transaction internally
        const { data: newBalance, error: creditError } = await admin.rpc('add_credits', {
            p_user_id: user.id,
            p_amount: orderData.credits,
            p_type: 'topup',
            p_description: `${orderData.plan_id} plan purchase`,
            p_reference_id: razorpay_payment_id,
        });

        if (creditError) {
            console.error(`[Payment] Failed to add credits:`, creditError);
            // Log this for manual resolution but don't fail the response
        }

        // 7. Update user subscription tier based on plan
        const tierMapping: Record<string, string> = {
            starter: 'starter',
            creator: 'creator',
            pro: 'pro',
            advanced: 'advanced',
        };

        const newTier = tierMapping[orderData.plan_id] || 'starter';
        await admin
            .from('user_profiles')
            .update({ subscription_tier: newTier })
            .eq('id', user.id);


        return NextResponse.json({
            success: true,
            message: 'Payment verified successfully',
            credits: orderData.credits,
            newBalance: newBalance as number,
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        return NextResponse.json(
            { error: 'Payment verification failed' },
            { status: 500 }
        );
    }
}
