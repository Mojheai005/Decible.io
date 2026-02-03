'use client';

import React from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePayment } from '@/hooks/usePayment';
import { Loader2, Check, Zap, Crown } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/lib/pricing';

interface SubscriptionProps {
    onNavigate?: (view: string) => void;
}

export const Subscription: React.FC<SubscriptionProps> = ({ onNavigate }) => {
    const { profile, isLoading } = useUserProfile();
    const { initiatePayment, isProcessing, processingPlanId, error } = usePayment();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    const currentTier = profile?.plan || 'free';
    const currentPlanIndex = SUBSCRIPTION_PLANS.findIndex(p => p.id === currentTier);

    const handleUpgrade = async (planId: string) => {
        await initiatePayment(planId, 'subscription');
    };

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Subscription</h2>
                <p className="text-gray-500 mt-1">Manage your plan and billing</p>
            </div>

            {/* Current Plan Card */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                    <Crown className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-bold capitalize">{currentTier} Plan</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-medium">Credits/Month</p>
                        <p className="text-xl font-bold mt-1">{profile?.totalCredits?.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-medium">Remaining</p>
                        <p className="text-xl font-bold mt-1">{profile?.remainingCredits?.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs uppercase font-medium">Voice Slots</p>
                        <p className="text-xl font-bold mt-1">{profile?.voiceSlots || 5}</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Plans Grid */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Available Plans</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SUBSCRIPTION_PLANS.filter(p => p.id !== 'free').map((plan, index) => {
                        const isCurrentPlan = plan.id === currentTier;
                        const canUpgrade = SUBSCRIPTION_PLANS.findIndex(p => p.id === plan.id) > currentPlanIndex;
                        const priceRupees = plan.priceMonthly / 100;

                        return (
                            <div
                                key={plan.id}
                                className={`relative p-6 rounded-2xl border-2 transition-all ${
                                    isCurrentPlan
                                        ? 'border-gray-900 bg-gray-50'
                                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                                }`}
                            >
                                {plan.badge && (
                                    <div className="absolute -top-3 left-4 px-3 py-1 bg-gray-900 text-white text-xs font-bold rounded-full">
                                        {plan.badge}
                                    </div>
                                )}

                                <h4 className="text-lg font-bold text-gray-900">{plan.name}</h4>
                                <p className="text-gray-500 text-sm mt-1">{plan.description}</p>

                                <div className="mt-4">
                                    <span className="text-3xl font-bold text-gray-900">₹{priceRupees.toLocaleString()}</span>
                                    <span className="text-gray-500 text-sm">/month</span>
                                </div>

                                <div className="mt-5 space-y-2.5">
                                    {plan.features.filter(f => f.included).slice(0, 6).map((feature, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-green-500 shrink-0" />
                                            <span className="text-sm text-gray-700">{feature.text}</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    className={`w-full mt-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                                        isCurrentPlan
                                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                            : canUpgrade
                                                ? 'bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    }`}
                                    disabled={isCurrentPlan || !canUpgrade || isProcessing}
                                    onClick={() => canUpgrade && handleUpgrade(plan.id)}
                                >
                                    {processingPlanId === plan.id ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Processing...
                                        </span>
                                    ) : isCurrentPlan ? (
                                        'Current Plan'
                                    ) : canUpgrade ? (
                                        <span className="flex items-center justify-center gap-1.5">
                                            <Zap className="w-4 h-4" />
                                            Upgrade
                                        </span>
                                    ) : (
                                        'Downgrade'
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Free Plan Note */}
            {currentTier === 'free' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                    <p className="font-medium">You are on the Free plan</p>
                    <p className="mt-1 text-blue-600">Upgrade to unlock more credits, voice slots, and longer text generation.</p>
                </div>
            )}
        </div>
    );
};
