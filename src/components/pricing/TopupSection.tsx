'use client';

import { useState } from 'react';
import { Plus, Zap, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TopupPackage, getTopupPrice, formatPrice, formatCredits } from '@/lib/pricing';

interface TopupSectionProps {
    currentTier: string;
    packages: TopupPackage[];
    onSelectPackage?: (packageId: string) => void;
    loading?: boolean;
}

export function TopupSection({
    currentTier,
    packages,
    onSelectPackage,
    loading = false,
}: TopupSectionProps) {
    const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

    const handleSelect = (packageId: string) => {
        setSelectedPackage(packageId);
        onSelectPackage?.(packageId);
    };

    // Get per-credit rate for current tier
    const tierRates: Record<string, number> = {
        starter: 1680,
        creator: 1220,
        pro: 965,
        advanced: 650,
    };

    const currentRate = tierRates[currentTier] || 0;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-700 text-sm font-medium mb-4">
                    <Plus className="h-4 w-4" />
                    Add More Credits
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Top-Up Your Credits
                </h3>
                <p className="text-gray-600 max-w-lg mx-auto">
                    Running low on credits? Top up instantly at your exclusive{' '}
                    <span className="font-semibold text-gray-900 capitalize">{currentTier}</span>{' '}
                    tier rate of{' '}
                    <span className="font-semibold text-emerald-600">
                        {formatPrice(currentRate)}/1K credits
                    </span>
                </p>
            </div>

            {/* Package Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                {packages.map((pkg) => {
                    const price = getTopupPrice(pkg.id, currentTier);
                    const isSelected = selectedPackage === pkg.id;

                    return (
                        <button
                            key={pkg.id}
                            onClick={() => handleSelect(pkg.id)}
                            disabled={loading}
                            className={cn(
                                'relative p-4 rounded-xl border-2 transition-all duration-200 text-left',
                                isSelected
                                    ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                                    : 'border-gray-200 hover:border-gray-300 bg-white',
                                pkg.isPopular && !isSelected && 'border-violet-200 bg-violet-50/50',
                                loading && 'opacity-50 cursor-wait',
                            )}
                        >
                            {/* Popular Badge */}
                            {pkg.isPopular && (
                                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-violet-500 text-white text-xs font-semibold rounded-full">
                                    Popular
                                </div>
                            )}

                            {/* Selected Check */}
                            {isSelected && (
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Check className="h-4 w-4 text-white" />
                                </div>
                            )}

                            {/* Credits */}
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className={cn(
                                    'h-5 w-5',
                                    isSelected ? 'text-blue-500' : 'text-amber-500'
                                )} />
                                <span className="font-bold text-gray-900">
                                    {formatCredits(pkg.credits)}
                                </span>
                            </div>

                            {/* Price */}
                            <div className="text-lg font-bold text-gray-900">
                                {formatPrice(price)}
                            </div>

                            {/* Per credit rate */}
                            <div className="text-xs text-gray-500 mt-1">
                                {(price / pkg.credits * 100).toFixed(2)} per credit
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Selected Summary */}
            {selectedPackage && (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                        <span className="text-gray-600">Selected: </span>
                        <span className="font-semibold text-gray-900">
                            {packages.find(p => p.id === selectedPackage)?.name}
                        </span>
                    </div>
                    <button
                        onClick={() => onSelectPackage?.(selectedPackage)}
                        disabled={loading}
                        className={cn(
                            'px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors',
                            loading && 'opacity-50 cursor-wait'
                        )}
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Processing...
                            </span>
                        ) : (
                            `Buy for ${formatPrice(getTopupPrice(selectedPackage, currentTier))}`
                        )}
                    </button>
                </div>
            )}

            {/* Tier Benefits */}
            <div className="mt-8 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-4 text-center">
                    Your {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} Tier Benefits
                </h4>
                <div className="flex flex-wrap justify-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                        <Check className="h-4 w-4 text-emerald-500" />
                        <span>Top-up credits never expire</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                        <Check className="h-4 w-4 text-emerald-500" />
                        <span>Instant delivery</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                        <Check className="h-4 w-4 text-emerald-500" />
                        <span>Exclusive tier pricing</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                        <Check className="h-4 w-4 text-emerald-500" />
                        <span>Carry over between months</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
