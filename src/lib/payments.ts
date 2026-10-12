// ===========================================
// PAYMENTS — shared by /api/payments/verify and the Razorpay webhook
// ===========================================
// Either route can be the one that credits an order: whichever flips
// payment_orders.credits_added first wins. Applying the purchased plan
// therefore lives here, called by both, and is safe to run more than once.
//
// Before this existed only /verify changed the plan, and it did so for every
// order: a top-up (plan_id NULL) fell through to `tierMapping[null] || 'starter'`
// and moved the buyer onto Starter, whatever plan they were on.
//
// INVARIANT: an order with status 'completed' has had its credits added.
// 1,441 orders completed before 3 Sep 2026 have credits_added = false because
// that flag did not exist yet, so the status, not the flag, is what stops a
// replayed confirmation from crediting them again. Every claim therefore
// requires an unfinished status, and a failed credit puts the order back to
// 'created' instead of leaving it 'completed'.
// ===========================================
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

export const PAID_PLAN_IDS = ['starter', 'creator', 'pro', 'advanced'] as const

/** Statuses an order can be claimed from. Never 'completed'. */
export const CLAIMABLE_STATUSES = ['created', 'failed', 'paid']

/** A plan purchase changes the plan; a top-up only adds credits. */
export function isPlanOrder(orderType: string | null | undefined): boolean {
    return orderType === 'subscription' || orderType === 'upgrade'
}

export interface PaidOrder {
    id: string
    user_id: string
    order_type: string
    plan_id: string | null
    billing_period: string | null
    credits: number
    completed_at: string | null
}

export const PAID_ORDER_COLUMNS = 'id, user_id, order_type, plan_id, billing_period, credits, completed_at'

/** Values that undo a claim whose credits could not be added, so it can be claimed again. */
export const RELEASE_CLAIM = { credits_added: false, status: 'created', completed_at: null }

/** Ledger text for the credits an order adds. Plan wording matches existing rows. */
export function creditDescription(order: PaidOrder, via: 'verify' | 'webhook'): string {
    const suffix = via === 'webhook' ? ' (webhook)' : ''
    if (isPlanOrder(order.order_type) && order.plan_id) return `${order.plan_id} plan purchase${suffix}`
    return `Top-up purchase: ${order.credits.toLocaleString('en-IN')} credits${suffix}`
}

/** Same day next month (or next year), clamped to the month's last day: 31 Jan -> 28/29 Feb. */
export function planEndDate(start: Date, yearly: boolean): Date {
    const months = yearly ? 12 : 1
    const end = new Date(start)
    const day = end.getUTCDate()
    end.setUTCDate(1)
    end.setUTCMonth(end.getUTCMonth() + months)
    const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
    end.setUTCDate(Math.min(day, lastDay))
    return end
}

/**
 * Put the buyer on the plan they paid for. Top-ups are left alone.
 *
 * Returns true when the plan is in place or there was nothing to do, and
 * false when the update failed (callers should retry).
 *
 * Dates come from the order's completed_at, so calling this twice for the
 * same order writes the same values. An older order never overrides a plan
 * the buyer purchased after it: a late webhook delivery for order A must not
 * undo order B, bought while A looked like it had failed.
 */
export async function applyPlanPurchase(admin: SupabaseClient, order: PaidOrder): Promise<boolean> {
    if (!isPlanOrder(order.order_type)) return true

    const planId = order.plan_id
    if (!planId || !(PAID_PLAN_IDS as readonly string[]).includes(planId)) {
        logger.error('Paid plan order has no valid plan', undefined, {
            event: 'payment.plan_missing', orderId: order.id, userId: order.user_id, planId,
        })
        return true // retrying cannot fix a bad row; it is logged for support
    }

    const start = order.completed_at ? new Date(order.completed_at) : new Date()

    const { data: newer, error: newerError } = await admin
        .from('payment_orders')
        .select('id')
        .eq('user_id', order.user_id)
        .in('order_type', ['subscription', 'upgrade'])
        .eq('status', 'completed')
        .gt('completed_at', start.toISOString())
        .neq('id', order.id)
        .limit(1)
    if (newerError) {
        logger.error('Could not check for a newer plan purchase', undefined, {
            event: 'payment.plan_apply_failed', orderId: order.id, userId: order.user_id, code: newerError.code, detail: newerError.message,
        })
        return false
    }
    if (newer && newer.length > 0) {
        logger.info('Skipped applying an older plan purchase', {
            event: 'payment.plan_superseded', orderId: order.id, newerOrderId: newer[0].id, userId: order.user_id, planId,
        })
        return true
    }

    const yearly = order.billing_period === 'yearly'
    const end = planEndDate(start, yearly)

    const { error } = await admin
        .from('user_profiles')
        .update({
            subscription_tier: planId,
            billing_period: yearly ? 'yearly' : 'monthly',
            subscription_start_date: start.toISOString(),
            subscription_end_date: end.toISOString(),
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
        })
        .eq('id', order.user_id)

    if (error) {
        logger.error('Could not apply the purchased plan', undefined, {
            event: 'payment.plan_apply_failed', orderId: order.id, userId: order.user_id, planId,
            code: error.code, detail: error.message,
        })
        return false
    }

    logger.info('Purchased plan applied', {
        event: 'payment.plan_applied', orderId: order.id, userId: order.user_id, planId,
        billingPeriod: yearly ? 'yearly' : 'monthly', until: end.toISOString(),
    })
    return true
}
