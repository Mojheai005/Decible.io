import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { SUBSCRIPTION_PLANS } from '@/lib/pricing';
import { grantCourseBonusIfEligible } from '@/lib/course-bonus';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = getAdminClient();

        // Fetch profile and transactions in PARALLEL to cut latency in half
        const profilePromise = admin
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        const txPromise = admin
            .from('credit_transactions')
            .select('id, created_at, type, amount, description, balance_after')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        const [profileResult, txResult] = await Promise.all([
            profilePromise,
            txPromise.then(
                (r: { data: unknown }) => r,
                () => ({ data: null })
            ),
        ]);

        let userProfile = profileResult.data;

        if (profileResult.error || !profileResult.data) {
            // First login — create profile with free tier defaults
            const { data: newProfile, error: insertError } = await admin
                .from('user_profiles')
                .insert({
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                    subscription_tier: 'free',
                    credits_remaining: 5000,
                    credits_used_this_month: 0,
                    credits_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                })
                .select()
                .single();

            if (insertError || !newProfile) {
                console.error('Failed to create user profile:', insertError);
                return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
            }

            userProfile = newProfile;
        }

        // Course buyer bonus: if this email was entitled by a course purchase,
        // grant the credits exactly once and refresh the profile snapshot
        const bonusGranted = await grantCourseBonusIfEligible(user.id, user.email);
        if (bonusGranted > 0) {
            const { data: refreshed } = await admin
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            if (refreshed) userProfile = refreshed;
        }

        // Get the plan details from pricing config
        const currentPlan = SUBSCRIPTION_PLANS.find(
            p => p.id === (userProfile as Record<string, unknown>).subscription_tier
        );
        const totalCredits = currentPlan?.credits || 5000;

        // Map transactions
        let transactions: Array<{ id: string; date: string; type: string; amount: number; status: string; description?: string }> = [];
        const txData = txResult.data as Record<string, unknown>[] | null;
        if (txData && txData.length > 0) {
            transactions = txData.map((tx: Record<string, unknown>) => ({
                id: tx.id as string,
                date: tx.created_at as string,
                type: tx.type as string,
                amount: tx.amount as number,
                status: 'completed',
                description: (tx.description as string) || undefined,
            }));
        }

        // Return real profile + transactions + plans
        return NextResponse.json({
            profile: {
                id: (userProfile as Record<string, unknown>).id,
                email: (userProfile as Record<string, unknown>).email || user.email,
                name: (userProfile as Record<string, unknown>).name || user.user_metadata?.full_name || 'User',
                plan: (userProfile as Record<string, unknown>).subscription_tier || 'free',
                totalCredits,
                usedCredits: (userProfile as Record<string, unknown>).credits_used_this_month || 0,
                remainingCredits: (userProfile as Record<string, unknown>).credits_remaining || 0,
                resetDate: (userProfile as Record<string, unknown>).credits_reset_date,
            },
            transactions,
            courseBonusGranted: bonusGranted > 0 ? bonusGranted : undefined,
            plans: SUBSCRIPTION_PLANS.map(p => ({
                id: p.id,
                name: p.name,
                credits: p.credits,
                price: p.priceMonthly / 100,
            })),
        });

    } catch (error) {
        console.error('Profile API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action, amount } = body;

        if (action === 'use_credits' && amount) {
            if (!Number.isInteger(amount) || amount <= 0) {
                return NextResponse.json({ error: 'Invalid credit amount' }, { status: 400 });
            }

            const admin = getAdminClient();

            // Deduct via the row-locked stored procedure rather than a
            // read-modify-write. Two concurrent requests reading the same
            // balance and both writing `remaining - amount` would silently
            // grant free credits; use_credits() takes FOR UPDATE on the
            // profile row and writes the credit_transactions ledger entry.
            const { data, error: rpcError } = await admin.rpc('use_credits', {
                p_user_id: user.id,
                p_amount: amount,
                p_description: 'Credit usage',
                p_reference_id: null,
            });

            if (rpcError) {
                console.error('Credit deduction RPC error:', rpcError);
                return NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 });
            }

            const result = (Array.isArray(data) ? data[0] : data) as
                { success: boolean; new_balance: number; error_message: string | null } | null;

            if (!result?.success) {
                const message = result?.error_message || 'Credit deduction failed';
                const status = message.includes('Insufficient') ? 402 : 400;
                return NextResponse.json({ error: message }, { status });
            }

            return NextResponse.json({
                success: true,
                message: `Used ${amount} credits`,
                remainingCredits: result.new_balance,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Profile POST Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
