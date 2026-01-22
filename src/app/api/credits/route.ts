// ===========================================
// USER CREDITS API
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

// GET: Fetch user's credit balance and transaction history
export async function GET(request: NextRequest) {
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

        // 2. Get query params
        const searchParams = request.nextUrl.searchParams;
        const includeHistory = searchParams.get('history') === 'true';
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);

        // 3. Fetch user profile with credits
        const admin = getAdminClient();
        const { data: profile, error: profileError } = await admin
            .from('user_profiles')
            .select('credits_remaining, subscription_tier')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Error fetching profile:', profileError);
            return NextResponse.json(
                { error: 'Failed to fetch credit balance' },
                { status: 500 }
            );
        }

        // 4. Optionally fetch transaction history
        let transactions = null;
        let totalTransactions = 0;

        if (includeHistory) {
            const { data: txData, error: txError, count } = await admin
                .from('credit_transactions')
                .select('*', { count: 'exact' })
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (!txError) {
                transactions = txData;
                totalTransactions = count || 0;
            }
        }

        const profileData = profile as { credits_remaining?: number; subscription_tier?: string } | null;
        return NextResponse.json({
            credits: profileData?.credits_remaining || 0,
            tier: profileData?.subscription_tier || 'free',
            ...(includeHistory && {
                transactions,
                pagination: {
                    total: totalTransactions,
                    limit,
                    offset,
                    hasMore: offset + limit < totalTransactions,
                },
            }),
        });

    } catch (error) {
        console.error('Credits API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
