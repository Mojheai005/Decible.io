'use client';

import { Check, X, Zap, Crown, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SubscriptionPlan, formatPrice } from '@/lib/pricing';

interface PricingCardProps {
    plan: SubscriptionPlan;
    isCurrentPlan?: boolean;
    canUpgrade?: boolean;
    isFirstMonth?: boolean;
    onSelect?: (planId: string) => void;
    loading?: boolean;
}

export function PricingCard({
    plan,
    isCurrentPlan = false,
    canUpgrade = false,
    isFirstMonth = false,
    onSelect,
    loading = false,
}: PricingCardProps) {
    const effectivePrice = isFirstMonth && plan.priceFirstMonth
        ? plan.priceFirstMonth
        : plan.priceMonthly;

    const hasPromo = isFirstMonth && plan.priceFirstMonth && plan.priceFirstMonth < plan.priceMonthly;

    const getPlanIcon = () => {
        switch (plan.id) {
            case 'free':
                return <Zap className="h-6 w-6" />;
            case 'starter':
                return <Star className="h-6 w-6" />;
            case 'creator':
                return <Sparkles className="h-6 w-6" />;
            case 'pro':
                return <Crown className="h-6 w-6" />;
            case 'advanced':
                return <Crown className="h-6 w-6 text-amber-400" />;
            default:
                return <Zap className="h-6 w-6" />;
        }
    };

    return (
        <div
            className={cn(
                'relative flex flex-col rounded-2xl border-2 bg-white p-6 shadow-sm transition-all duration-300',
                plan.isPopular && 'border-violet-500 shadow-lg shadow-violet-100 scale-105',
                plan.isBestValue && 'border-emerald-500 shadow-lg shadow-emerald-100',
                isCurrentPlan && 'border-blue-500 bg-blue-50/50',
                !plan.isPopular && !plan.isBestValue && !isCurrentPlan && 'border-gray-200 hover:border-gray-300',
            )}
        >
            {/* Badge */}
            {plan.badge && (
                <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: plan.badgeColor || '#8B5CF6' }}
                >
                    {plan.badge}
                </div>
            )}

            {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-sm font-semibold text-white bg-blue-500">
                    Current Plan
                </div>
            )}

            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                        'p-2 rounded-xl',
                        plan.id === 'free' && 'bg-gray-100 text-gray-600',
                        plan.id === 'starter' && 'bg-blue-100 text-blue-600',
                        plan.id === 'creator' && 'bg-violet-100 text-violet-600',
                        plan.id === 'pro' && 'bg-emerald-100 text-emerald-600',
                        plan.id === 'advanced' && 'bg-amber-100 text-amber-600',
                    )}>
                        {getPlanIcon()}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">{plan.displayName}</h3>
                        <p className="text-sm text-gray-500">{plan.description}</p>
                    </div>
                </div>
            </div>

            {/* Price */}
            <div className="mb-6">
                {plan.priceMonthly === 0 ? (
                    <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-gray-900">Free</span>
                        <span className="ml-2 text-gray-500">forever</span>
                    </div>
                ) : (
                    <div>
                        {hasPromo && (
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg text-gray-400 line-through">
                                    {formatPrice(plan.priceMonthly)}
                                </span>
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                    First Month Special
                                </span>
                            </div>
                        )}
                        <div className="flex items-baseline">
                            <span className="text-4xl font-bold text-gray-900">
                                {formatPrice(effectivePrice)}
                            </span>
                            <span className="ml-2 text-gray-500">/month</span>
                        </div>
                        {hasPromo && (
                            <p className="text-sm text-gray-500 mt-1">
                                Then {formatPrice(plan.priceMonthly)}/month
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Credits Highlight */}
            <div className={cn(
                'mb-6 p-4 rounded-xl',
                plan.id === 'free' && 'bg-gray-50',
                plan.id === 'starter' && 'bg-blue-50',
                plan.id === 'creator' && 'bg-violet-50',
                plan.id === 'pro' && 'bg-emerald-50',
                plan.id === 'advanced' && 'bg-amber-50',
            )}>
                <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                        {plan.credits >= 1000000
                            ? `${(plan.credits / 1000000).toFixed(0)}M`
                            : `${(plan.credits / 1000).toFixed(0)}K`}
                    </div>
                    <div className="text-sm text-gray-600">credits per month</div>
                </div>

                {plan.topupRate > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                        <span className="text-sm text-gray-600">
                            Top-up: <span className="font-semibold">{formatPrice(plan.topupRate)}</span> per 1K credits
                        </span>
                    </div>
                )}
            </div>

            {/* Key Limits */}
            <div className="mb-6 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="font-semibold text-gray-900">{plan.voiceSlots}</div>
                    <div className="text-gray-500">Voice Slots</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="font-semibold text-gray-900">
                        {plan.maxCharsPerGeneration >= 1000
                            ? `${(plan.maxCharsPerGeneration / 1000).toFixed(0)}K`
                            : plan.maxCharsPerGeneration}
                    </div>
                    <div className="text-gray-500">Chars/Gen</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="font-semibold text-gray-900">
                        {plan.maxGenerationsPerDay >= 1000 ? 'Unlimited' : plan.maxGenerationsPerDay}
                    </div>
                    <div className="text-gray-500">Gens/Day</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="font-semibold text-gray-900">{plan.maxGenerationsPerHour}</div>
                    <div className="text-gray-500">Gens/Hour</div>
                </div>
            </div>

            {/* Features */}
            <div className="flex-1 mb-6">
                <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-3">
                            {feature.included ? (
                                <Check className={cn(
                                    'h-5 w-5 flex-shrink-0 mt-0.5',
                                    feature.highlight ? 'text-emerald-500' : 'text-gray-400'
                                )} />
                            ) : (
                                <X className="h-5 w-5 flex-shrink-0 mt-0.5 text-gray-300" />
                            )}
                            <span className={cn(
                                'text-sm',
                                feature.included ? 'text-gray-700' : 'text-gray-400',
                                feature.highlight && 'font-semibold text-gray-900'
                            )}>
                                {feature.text}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* CTA Button */}
            <button
                onClick={() => onSelect?.(plan.id)}
                disabled={isCurrentPlan || loading || (plan.id === 'free' && !canUpgrade)}
                className={cn(
                    'w-full py-3 px-6 rounded-xl font-semibold text-center transition-all duration-200',
                    plan.isPopular && !isCurrentPlan && 'bg-violet-600 text-white hover:bg-violet-700',
                    plan.isBestValue && !isCurrentPlan && 'bg-emerald-600 text-white hover:bg-emerald-700',
                    !plan.isPopular && !plan.isBestValue && !isCurrentPlan && plan.id !== 'free' &&
                        'bg-gray-900 text-white hover:bg-gray-800',
                    plan.id === 'free' && 'bg-gray-100 text-gray-600',
                    isCurrentPlan && 'bg-blue-100 text-blue-700 cursor-default',
                    loading && 'opacity-50 cursor-wait',
                )}
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                    </span>
                ) : isCurrentPlan ? (
                    'Current Plan'
                ) : plan.id === 'free' ? (
                    'Free Plan'
                ) : canUpgrade ? (
                    'Upgrade Now'
                ) : (
                    'Get Started'
                )}
            </button>
        </div>
    );
}
