// ===========================================
// CHECKOUT FAILURE REPORT
// ===========================================
// Razorpay Checkout tells the browser why a payment failed (card declined,
// UPI timeout, amount over the bank's limit...). That reason never reached
// us: the webhook that would carry it has never worked, so every failed or
// abandoned checkout looked identical in payment_orders.
//
// Production, 12 Oct 2026: of 233 orders above Rs 5,000 only 12 completed,
// and nobody could say why. This route stores the reason on the buyer's own
// order so it can be answered from the database.
//
// It only annotates an unfinished order that belongs to the caller. It
// never credits anything.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : null);

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

        const body = await request.json().catch(() => ({}));
        const orderId = clip(body.razorpay_order_id, 64);
        if (!orderId) return NextResponse.json({ error: 'razorpay_order_id is required' }, { status: 400 });

        const err = (body.error ?? {}) as Record<string, unknown>;
        const code = clip(err.code, 64);
        const reason = clip(err.reason, 120);
        const description = clip(err.description, 300);
        const source = clip(err.source, 60);
        const step = clip(err.step, 60);

        const admin = getAdminClient();
        const { data: updated } = await admin
            .from('payment_orders')
            .update({
                status: 'failed',
                error_code: code,
                error_description: [description, reason && `(${reason})`].filter(Boolean).join(' ') || null,
            })
            .eq('razorpay_order_id', orderId)
            .eq('user_id', user.id)
            .in('status', ['created', 'failed'])
            .select('id, plan_id, amount, billing_period')
            .maybeSingle();

        logger.warn('Checkout failed in the browser', {
            event: 'payment.checkout_failed', orderId, userId: user.id, recorded: !!updated,
            planId: (updated as { plan_id?: string } | null)?.plan_id,
            amount: (updated as { amount?: number } | null)?.amount,
            code, reason, source, step, description,
        });

        return NextResponse.json({ recorded: !!updated });
    } catch (error) {
        logger.error('Could not record checkout failure', error instanceof Error ? error : new Error(String(error)), {
            event: 'payment.checkout_failed_record_error',
        });
        return NextResponse.json({ recorded: false }, { status: 500 });
    }
}
