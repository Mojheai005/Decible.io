'use client';

import { useState } from 'react';
import { PricingCard } from './PricingCard';
import { TopupSection } from './TopupSection';
import { SUBSCRIPTION_PLANS, TOPUP_PACKAGES } from '@/lib/pricing';

interface PricingGridProps {
    currentTier?: string;
    isFirstMonth?: boolean;
    onSelectPlan?: (planId: string) => void;
    onSelectTopup?: (packageId: string) => void;
    loading?: boolean;
    showTopups?: boolean;
}

export function PricingGrid({
    currentTier = 'free',
    isFirstMonth = true,
    onSelectPlan,
    onSelectTopup,
    loading = false,
    showTopups = true,
}: PricingGridProps) {
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

    const handleSelectPlan = (planId: string) => {
        setSelectedPlan(planId);
        onSelectPlan?.(planId);
    };

    const currentPlanIndex = SUBSCRIPTION_PLANS.findIndex(p => p.id === currentTier);

    return (
        <div className="space-y-16">
            {/* Plans Header */}
            <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Choose Your Plan
                </h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                    Start free and upgrade as you grow. All plans include access to our
                    premium voice library and instant generation.
                </p>
            </div>

            {/* Pricing Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 lg:gap-4">
                {SUBSCRIPTION_PLANS.map((plan, index) => (
                    <PricingCard
                        key={plan.id}
                        plan={plan}
                        isCurrentPlan={plan.id === currentTier}
                        canUpgrade={index > currentPlanIndex}
                        isFirstMonth={isFirstMonth}
                        onSelect={handleSelectPlan}
                        loading={loading && selectedPlan === plan.id}
                    />
                ))}
            </div>

            {/* Top-up Section */}
            {showTopups && currentTier !== 'free' && (
                <TopupSection
                    currentTier={currentTier}
                    packages={TOPUP_PACKAGES}
                    onSelectPackage={onSelectTopup}
                    loading={loading}
                />
            )}

            {/* Free tier message about top-ups */}
            {showTopups && currentTier === 'free' && (
                <div className="text-center py-8 px-4 bg-gray-50 rounded-2xl">
                    <p className="text-gray-600 mb-2">
                        Need more credits? Upgrade to a paid plan to unlock credit top-ups!
                    </p>
                    <p className="text-sm text-gray-500">
                        Paid plans get access to discounted bulk credits based on their tier.
                    </p>
                </div>
            )}

            {/* FAQ or Additional Info */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
                    Frequently Asked Questions
                </h3>
                <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-2">What are credits?</h4>
                        <p className="text-gray-600 text-sm">
                            Credits are used for voice generation. 1 credit = 1 character of text.
                            A typical YouTube script (500 words) uses about 2,500 credits.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Can I change plans?</h4>
                        <p className="text-gray-600 text-sm">
                            Yes! You can upgrade anytime. When you upgrade, you&apos;ll immediately
                            get the new plan&apos;s credits added to your balance.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Do credits expire?</h4>
                        <p className="text-gray-600 text-sm">
                            Monthly credits reset each billing cycle. Top-up credits never expire
                            and carry over indefinitely.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-2">What&apos;s API access?</h4>
                        <p className="text-gray-600 text-sm">
                            Creator and above plans get API access for automating voice generation
                            in your own applications and workflows.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
