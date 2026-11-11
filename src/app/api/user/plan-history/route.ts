import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

// ===========================================
// LAST ENDED PLAN
// ===========================================
// The most recent plan this user HAD that has now ended: a course / support
// grant (e.g. 30 days of Pro) or a paid month. The Script to Voice lock screen
// uses it to say "your Pro plan ended on 3 Nov; you still have your credits",
// instead of a bare "upgrade" that reads as if the credits were taken away.
// ===========================================

const PLANS_WITH_SCRIPT_TO_VOICE = ['creator', 'pro', 'advanced'];

function addMonths(iso: string, months: number): Date {
    const end = new Date(iso);
    const day = end.getUTCDate();
    end.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + months);
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
    end.setUTCDate(Math.min(day, last));
    return end;
}

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

        const admin = getAdminClient();
        const now = Date.now();
        const [{ data: grants }, { data: orders }] = await Promise.all([
            admin.from('pending_credit_grants')
                .select('grant_tier, expires_at')
                .eq('claimed_by', user.id)
                .not('grant_tier', 'is', null)
                .lte('expires_at', new Date(now).toISOString())
                .order('expires_at', { ascending: false })
                .limit(1),
            admin.from('payment_orders')
                .select('plan_id, billing_period, completed_at')
                .eq('user_id', user.id)
                .eq('status', 'completed')
                .in('order_type', ['subscription', 'upgrade'])
                .not('plan_id', 'is', null)
                .order('completed_at', { ascending: false })
                .limit(5),
        ]);

        const ended: { tier: string; endedAt: string }[] = [];
        for (const g of (grants ?? []) as Array<{ grant_tier: string | null; expires_at: string | null }>) {
            if (g.grant_tier && g.expires_at) ended.push({ tier: g.grant_tier, endedAt: g.expires_at });
        }
        for (const o of (orders ?? []) as Array<{ plan_id: string | null; billing_period: string | null; completed_at: string | null }>) {
            if (!o.plan_id || !o.completed_at) continue;
            const end = addMonths(o.completed_at, o.billing_period === 'yearly' ? 12 : 1);
            if (end.getTime() <= now) ended.push({ tier: o.plan_id, endedAt: end.toISOString() });
        }
        ended.sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));
        const last = ended[0] ?? null;

        return NextResponse.json({
            lastPlan: last && {
                tier: last.tier,
                endedAt: last.endedAt,
                hadScriptToVoice: PLANS_WITH_SCRIPT_TO_VOICE.includes(last.tier),
            },
        });
    } catch (error) {
        console.error('plan-history error:', error);
        return NextResponse.json({ lastPlan: null });
    }
}
