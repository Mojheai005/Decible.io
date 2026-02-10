// ===========================================
// RAZORPAY CREATE ORDER API
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import {
    SUBSCRIPTION_PLANS,
    TOPUP_PACKAGES,
    getEffectivePrice,
    getTopupPrice,
} from '@/lib/pricing';

// Initialize Razorpay
function getRazorpayInstance() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        throw new Error('Razorpay credentials not configured');
    }

    return new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
    });
}

interface CreateOrderRequest {
    type: 'subscription' | 'topup' | 'upgrade';
    planId?: string;
    topupPackageId?: string;
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

        // 2. Get user profile
        const admin = getAdminClient();
        const { data: profile, error: profileError } = await admin
            .from('user_profiles')
            .select('subscription_tier')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            console.error('[Payment] Profile lookup failed:', profileError);
            return NextResponse.json(
                { error: 'User profile not found' },
                { status: 404 }
            );
        }

        const userProfile = profile as { subscription_tier?: string };

        // 3. Parse request body
        const body = await request.json() as CreateOrderRequest;
        const { type, planId, topupPackageId } = body;

        let amount: number;
        let credits: number;
        let description: string;
        let orderType: string = type;

        // 4. Calculate amount based on order type
        if (type === 'subscription' || type === 'upgrade') {
            if (!planId) {
                return NextResponse.json(
                    { error: 'Plan ID is required' },
                    { status: 400 }
                );
            }

            const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
            if (!plan) {
                return NextResponse.json(
                    { error: 'Invalid plan selected' },
                    { status: 400 }
                );
            }

            if (plan.id === 'free') {
                return NextResponse.json(
                    { error: 'Cannot purchase free plan' },
                    { status: 400 }
                );
            }

            // Use full price (first-month promo handled separately if needed)
            amount = getEffectivePrice(plan, false);
            credits = plan.credits;
            description = `${plan.displayName} Plan`;

        } else if (type === 'topup') {
            if (!topupPackageId) {
                return NextResponse.json(
                    { error: 'Top-up package ID is required' },
                    { status: 400 }
                );
            }

            // Free tier cannot top up
            if (userProfile.subscription_tier === 'free') {
                return NextResponse.json(
                    { error: 'Free tier cannot purchase top-ups. Please upgrade first.' },
                    { status: 403 }
                );
            }

            const pkg = TOPUP_PACKAGES.find(p => p.id === topupPackageId);
            if (!pkg) {
                return NextResponse.json(
                    { error: 'Invalid top-up package' },
                    { status: 400 }
                );
            }

            amount = getTopupPrice(topupPackageId, userProfile.subscription_tier || 'free');
            if (amount === 0) {
                return NextResponse.json(
                    { error: 'Top-up not available for your plan' },
                    { status: 400 }
                );
            }

            credits = pkg.credits;
            description = `Top-up: ${pkg.name}`;
        } else {
            return NextResponse.json(
                { error: 'Invalid order type' },
                { status: 400 }
            );
        }

        // 5. Create Razorpay order
        const razorpay = getRazorpayInstance();

        const order = await razorpay.orders.create({
            amount: amount,
            currency: 'INR',
            receipt: `rcpt_${user.id.slice(0, 8)}_${Date.now()}`,
            notes: {
                userId: user.id,
                userEmail: user.email || '',
                orderType: orderType,
                planId: planId || '',
                topupPackageId: topupPackageId || '',
                credits: credits.toString(),
            },
        });

        // 6. Store pending order in database
        // Use only core columns that exist in all schema versions
        const orderRecord: Record<string, unknown> = {
            id: order.id,
            user_id: user.id,
            plan_id: planId || orderType,  // NOT NULL in some schemas
            amount: amount,
            currency: 'INR',
            credits: credits,
            status: 'created',
            razorpay_order_id: order.id,
        };

        // Try inserting with extended columns first, fall back to core-only
        let { error: insertError } = await admin.from('payment_orders').insert({
            ...orderRecord,
            order_type: orderType,
            topup_package_id: topupPackageId || null,
            ip_address: (() => {
                const rawIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
                return rawIp ? rawIp.split(',')[0].trim() : null;
            })(),
            user_agent: request.headers.get('user-agent'),
        });

        // If extended insert failed (missing columns), try core-only insert
        if (insertError) {
            console.warn('[Payment] Extended insert failed, trying core columns:', insertError.message);
            ({ error: insertError } = await admin.from('payment_orders').insert(orderRecord));
        }

        if (insertError) {
            console.error('[Payment] Failed to insert order into DB:', insertError);
        }


        // 7. Return order details
        return NextResponse.json({
            success: true,
            orderId: order.id,
            amount: amount,
            currency: 'INR',
            description: description,
            credits: credits,
            keyId: process.env.RAZORPAY_KEY_ID,
            prefill: {
                email: user.email,
                name: (profile as { name?: string })?.name || '',
            },
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Payment] Order creation error:', message, error);
        return NextResponse.json(
            { error: message.includes('Razorpay') || message.includes('credentials')
                ? 'Payment gateway not configured. Please contact support.'
                : `Failed to create payment order: ${message}` },
            { status: 500 }
        );
    }
}

// GET: Get available plans and top-ups for user
export async function GET(request: NextRequest) {
    try {
        // Check if user is authenticated
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        let userTier = 'free';
        let isFirstMonth = true;

        if (user) {
            const admin = getAdminClient();
            const { data: profile } = await admin
                .from('user_profiles')
                .select('subscription_tier')
                .eq('id', user.id)
                .single();

            if (profile) {
                const p = profile as { subscription_tier?: string };
                userTier = p.subscription_tier || 'free';
                isFirstMonth = true; // Default to true for first-time users
            }
        }

        // Format plans for response
        const plans = SUBSCRIPTION_PLANS.map(plan => ({
            id: plan.id,
            name: plan.name,
            displayName: plan.displayName,
            description: plan.description,
            priceMonthly: plan.priceMonthly / 100,
            priceFirstMonth: plan.priceFirstMonth ? plan.priceFirstMonth / 100 : null,
            effectivePrice: getEffectivePrice(plan, isFirstMonth && plan.id === 'creator') / 100,
            credits: plan.credits,
            creditsFormatted: formatCredits(plan.credits),
            topupRate: plan.topupRate > 0 ? plan.topupRate / 100 : null,
            voiceSlots: plan.voiceSlots,
            maxCharsPerGeneration: plan.maxCharsPerGeneration,
            maxGenerationsPerDay: plan.maxGenerationsPerDay,
            features: plan.features,
            badge: plan.badge,
            badgeColor: plan.badgeColor,
            isPopular: plan.isPopular,
            isBestValue: plan.isBestValue,
            isCurrent: plan.id === userTier,
            canUpgrade: SUBSCRIPTION_PLANS.findIndex(p => p.id === plan.id) >
                        SUBSCRIPTION_PLANS.findIndex(p => p.id === userTier),
        }));

        // Format top-ups for response (only if not free tier)
        const topups = userTier !== 'free' ? TOPUP_PACKAGES.map(pkg => ({
            id: pkg.id,
            name: pkg.name,
            credits: pkg.credits,
            creditsFormatted: formatCredits(pkg.credits),
            price: getTopupPrice(pkg.id, userTier) / 100,
            isPopular: pkg.isPopular,
        })) : [];

        return NextResponse.json({
            plans,
            topups,
            userTier,
            canTopup: userTier !== 'free',
        });

    } catch (error) {
        console.error('Error fetching plans:', error);
        return NextResponse.json(
            { error: 'Failed to fetch plans' },
            { status: 500 }
        );
    }
}

function formatCredits(credits: number): string {
    if (credits >= 1000000) {
        return `${(credits / 1000000).toFixed(1)}M`;
    }
    if (credits >= 1000) {
        return `${Math.round(credits / 1000)}K`;
    }
    return credits.toString();
}
