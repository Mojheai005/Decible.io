'use client';

import React, { useState } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePayment } from '@/hooks/usePayment';
import { Loader2, Check, Crown, ArrowRight, Star, Users, Sparkles, Zap, Shield } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/lib/pricing';
import { useIsMobile } from '../../hooks/useIsMobile';

interface SubscriptionProps {
    onNavigate?: (view: string) => void;
}

export const Subscription: React.FC<SubscriptionProps> = ({ onNavigate }) => {
    const isMobile = useIsMobile();
    const { profile, isLoading } = useUserProfile();
    const { initiatePayment, isProcessing, processingPlanId, error } = usePayment();
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

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

    // Calculate videos per month based on credits (roughly 2500 credits = 1 video)
    const getVideosPerMonth = (credits: number) => {
        return Math.floor(credits / 2500);
    };

    return (
        <div className={`max-w-6xl mx-auto ${isMobile ? 'p-4 pb-32' : 'p-8'}`}>
            {/* Header */}
            <div className={`text-center ${isMobile ? 'mb-6' : 'mb-10'}`}>
                <h1 className={`font-bold text-gray-900 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>
                    Choose Your Plan
                </h1>
                <p className={`text-gray-500 mt-2 ${isMobile ? 'text-sm' : 'text-base'}`}>
                    Scale your content creation with the right plan for you
                </p>

                {/* Trust indicators */}
                <div className={`flex items-center justify-center gap-6 ${isMobile ? 'mt-4' : 'mt-6'}`}>
                    <div className="flex items-center gap-1.5 text-gray-500">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-medium">4.8 rating</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-500">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">4,200+ creators</span>
                    </div>
                </div>
            </div>

            {/* Current Plan Card */}
            <div className={`bg-gray-900 rounded-2xl text-white ${isMobile ? 'p-5 mb-6' : 'p-6 mb-8'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                            <Crown className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <div className="text-sm text-gray-400">Current Plan</div>
                            <div className="font-bold capitalize text-lg">{currentTier}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold">{profile?.remainingCredits?.toLocaleString()}</div>
                        <div className="text-sm text-gray-400">credits remaining</div>
                    </div>
                </div>
                {/* Usage bar */}
                <div className="mt-4 bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all"
                        style={{ width: `${Math.min(100, ((profile?.remainingCredits || 0) / (profile?.totalCredits || 1)) * 100)}%` }}
                    />
                </div>
            </div>

            {error && (
                <div className={`bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm ${isMobile ? 'p-3 mb-4' : 'p-4 mb-6'}`}>
                    {error}
                </div>
            )}

            {/* Billing Toggle - Fixed equal sizing */}
            <div className={`flex items-center justify-center ${isMobile ? 'mb-6' : 'mb-8'}`}>
                <div className="inline-flex bg-gray-100 rounded-xl p-1">
                    <button
                        onClick={() => setBillingPeriod('monthly')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all min-w-[100px] ${
                            billingPeriod === 'monthly'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setBillingPeriod('yearly')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all min-w-[100px] flex items-center justify-center gap-2 ${
                            billingPeriod === 'yearly'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Yearly
                        <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded font-bold">
                            -20%
                        </span>
                    </button>
                </div>
            </div>

            {/* Plans Grid — 1 col mobile, 2 col tablet, 4 col desktop (no 3+1 orphan) */}
            <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 xl:grid-cols-4'}`}>
                {SUBSCRIPTION_PLANS.filter(p => p.id !== 'free').map((plan) => {
                    const isCurrentPlan = plan.id === currentTier;
                    const canUpgrade = SUBSCRIPTION_PLANS.findIndex(p => p.id === plan.id) > currentPlanIndex;
                    const priceRupees = plan.priceMonthly / 100;
                    const yearlyPrice = Math.floor(priceRupees * 0.8);
                    const displayPrice = billingPeriod === 'yearly' ? yearlyPrice : priceRupees;
                    const isPopular = plan.id === 'creator';
                    const videosPerMonth = getVideosPerMonth(plan.credits);

                    return (
                        <div
                            key={plan.id}
                            className={`relative rounded-2xl border-2 transition-all ${
                                isPopular && !isCurrentPlan
                                    ? 'border-gray-900 bg-white shadow-xl'
                                    : isCurrentPlan
                                        ? 'border-green-500 bg-green-50'
                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                            } ${isMobile ? 'p-5' : 'p-6'}`}
                        >
                            {/* Popular Badge */}
                            {isPopular && !isCurrentPlan && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-900 text-white text-xs font-bold rounded-full flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    Popular
                                </div>
                            )}

                            {/* Current Plan Badge */}
                            {isCurrentPlan && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                                    Current Plan
                                </div>
                            )}

                            {/* Plan Name */}
                            <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                            <p className="text-gray-500 text-sm mt-1 min-h-[40px]">{plan.description}</p>

                            {/* Price */}
                            <div className="mt-4">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-bold text-gray-900">₹{displayPrice.toLocaleString()}</span>
                                    <span className="text-gray-500 text-sm">/mo</span>
                                </div>
                                {billingPeriod === 'yearly' && (
                                    <div className="text-xs text-green-600 font-medium mt-1">
                                        Save ₹{((priceRupees - yearlyPrice) * 12).toLocaleString()}/year
                                    </div>
                                )}
                            </div>

                            {/* First-month deal callout */}
                            {plan.priceFirstMonth && !isCurrentPlan && canUpgrade && (
                                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200/50 rounded-lg">
                                    <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span className="text-xs font-semibold text-amber-800">
                                        First month only ₹{(plan.priceFirstMonth / 100).toLocaleString()}
                                    </span>
                                </div>
                            )}

                            {/* Videos & value highlight */}
                            <div className="mt-4 p-3 bg-gray-50 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Videos/month</span>
                                    <span className="font-bold text-gray-900">~{videosPerMonth}+</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">vs Free plan</span>
                                    <span className="text-xs font-bold text-green-600">{Math.round(plan.credits / 5000)}x more credits</span>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="mt-4 space-y-2.5">
                                {plan.features.filter(f => f.included).slice(0, 5).map((feature, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        <span className="text-sm text-gray-700">{feature.text}</span>
                                    </div>
                                ))}
                            </div>

                            {/* CTA Button */}
                            <button
                                className={`w-full mt-6 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                                    isCurrentPlan
                                        ? 'bg-green-100 text-green-700 cursor-default'
                                        : canUpgrade
                                            ? isPopular
                                                ? 'bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]'
                                                : 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:scale-[0.98]'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                                disabled={isCurrentPlan || !canUpgrade || isProcessing}
                                onClick={() => canUpgrade && handleUpgrade(plan.id)}
                            >
                                {processingPlanId === plan.id ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : isCurrentPlan ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Current Plan
                                    </>
                                ) : canUpgrade ? (
                                    <>
                                        Upgrade
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                ) : (
                                    'Downgrade'
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* FAQ Section */}
            <div className={`${isMobile ? 'mt-8' : 'mt-12'}`}>
                <h2 className={`font-bold text-gray-900 text-center ${isMobile ? 'text-lg mb-4' : 'text-xl mb-6'}`}>
                    Frequently Asked Questions
                </h2>
                <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
                    {[
                        {
                            q: 'Can I use voices in monetized YouTube videos?',
                            a: 'Yes! All plans include full commercial rights for YouTube monetization.'
                        },
                        {
                            q: 'What happens if I run out of credits?',
                            a: 'You can upgrade your plan or purchase additional credits anytime.'
                        },
                        {
                            q: 'Can I cancel anytime?',
                            a: 'Yes, no contracts. Cancel anytime from your account settings.'
                        },
                        {
                            q: 'Do unused credits roll over?',
                            a: 'Credits reset each billing cycle. Upgrade for more monthly credits.'
                        },
                        {
                            q: 'How many voices can I use?',
                            a: 'Access our full library of 100+ voices on all paid plans.'
                        },
                        {
                            q: 'Is there a free trial?',
                            a: 'Start free with 10,000 credits. Upgrade anytime for more.'
                        }
                    ].map((faq, i) => (
                        <div key={i} className="bg-gray-50 rounded-xl p-4">
                            <h3 className="font-semibold text-gray-900 text-sm">{faq.q}</h3>
                            <p className="text-gray-500 text-sm mt-1.5">{faq.a}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Trust Footer */}
            <div className={`${isMobile ? 'mt-6' : 'mt-10'}`}>
                <div className={`flex items-center justify-center gap-6 text-gray-400 ${isMobile ? 'flex-col gap-3' : ''}`}>
                    <div className="flex items-center gap-1.5">
                        <Shield className="w-4 h-4" />
                        <span className="text-sm">Secure payment via Razorpay</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        <span className="text-sm">7-day money-back guarantee</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Star className="w-4 h-4" />
                        <span className="text-sm">Cancel anytime, no contracts</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
