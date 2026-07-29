// ===========================================
// PRICING CONFIGURATION
// ===========================================
// All amounts in paise (100 paise = 1 INR)

export interface PlanFeature {
    text: string;
    included: boolean;
    highlight?: boolean;
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    displayName: string;
    description: string;
    priceMonthly: number; // in paise
    priceYearly: number; // in paise (full year price, 10x monthly = 2 months free)
    priceFirstMonth?: number; // promotional price in paise
    priceMonthlyUSD: number; // in cents
    priceYearlyUSD: number; // in cents (full year price)
    priceFirstMonthUSD?: number; // promotional price in cents
    credits: number;
    topupRate: number; // paise per 1000 credits
    maxCharsPerGeneration: number;
    maxGenerationsPerDay: number;
    maxGenerationsPerHour: number;
    features: PlanFeature[];
    badge?: string;
    badgeColor?: string;
    isPopular?: boolean;
    isBestValue?: boolean;
}

export interface TopupPackage {
    id: string;
    name: string;
    credits: number;
    priceByTier: {
        starter: number;
        creator: number;
        pro: number;
        advanced: number;
    };
    isPopular?: boolean;
}

// ===========================================
// SUBSCRIPTION PLANS
// ===========================================
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
    {
        id: 'free',
        name: 'Free',
        displayName: 'Free Forever',
        description: 'Perfect for trying out our voice generation',
        priceMonthly: 0,
        priceYearly: 0,
        priceMonthlyUSD: 0,
        priceYearlyUSD: 0,
        credits: 5000,
        topupRate: 0, // No topup for free

        maxCharsPerGeneration: 1000,
        maxGenerationsPerDay: 10,
        maxGenerationsPerHour: 3,
        features: [
            { text: '5,000 credits/month', included: true },
            { text: '5 saved voice slots', included: true },
            { text: 'Standard quality audio', included: true },
            { text: '1,000 chars/generation', included: true },
            { text: '10 generations/day', included: true },
            { text: 'Basic voice library', included: true },
            { text: 'Community support', included: true },
            { text: 'Priority support', included: false },
            { text: 'API access', included: false },
            { text: 'Custom voices', included: false },
        ],
    },
    {
        id: 'starter',
        name: 'Starter',
        displayName: 'Starter',
        description: 'Great for content creators getting started',
        priceMonthly: 59800, // ₹598
        priceYearly: 598000, // ₹5,980/year (10x monthly, save 2 months)
        priceMonthlyUSD: 800, // $8
        priceYearlyUSD: 8000, // $80/year
        credits: 35000,
        topupRate: 3360, // ₹33.60 per 1000 credits

        maxCharsPerGeneration: 3000,
        maxGenerationsPerDay: 50,
        maxGenerationsPerHour: 10,
        features: [
            { text: '35,000 credits/month', included: true, highlight: true },
            { text: '10 saved voice slots', included: true },
            { text: 'High quality audio', included: true },
            { text: '3,000 chars/generation', included: true },
            { text: '50 generations/day', included: true },
            { text: 'Full voice library', included: true },
            { text: 'Priority email support', included: true },
            { text: 'Voice preview', included: true },
            { text: 'Generation history', included: true },
            { text: 'API access', included: false },
        ],
    },
    {
        id: 'creator',
        name: 'Creator',
        displayName: 'Creator',
        description: 'Ideal for professional content creators',
        priceMonthly: 139800, // ₹1,398
        priceYearly: 1398000, // ₹13,980/year (10x monthly, save 2 months)
        priceMonthlyUSD: 1800, // $18
        priceYearlyUSD: 18000, // $180/year
        credits: 150000,
        topupRate: 2440, // ₹24.40 per 1000 credits

        maxCharsPerGeneration: 5000,
        maxGenerationsPerDay: 150,
        maxGenerationsPerHour: 30,
        isPopular: true,
        badge: 'Most Popular',
        badgeColor: '#8B5CF6',
        features: [
            { text: '150,000 credits/month', included: true, highlight: true },
            { text: '20 saved voice slots', included: true },
            { text: 'High quality audio', included: true },
            { text: '5,000 chars/generation', included: true },
            { text: '150 generations/day', included: true },
            { text: 'API access', included: true, highlight: true },
            { text: 'Priority support', included: true },
            { text: 'Bulk generation', included: true },
            { text: 'Analytics dashboard', included: true },
            { text: 'Voice cloning (coming soon)', included: true },
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        displayName: 'Professional',
        description: 'For businesses and power users',
        priceMonthly: 399800, // ₹3,998
        priceYearly: 3998000, // ₹39,980/year (10x monthly, save 2 months)
        priceMonthlyUSD: 5000, // $50
        priceYearlyUSD: 50000, // $500/year
        credits: 500000,
        topupRate: 1930, // ₹19.30 per 1000 credits

        maxCharsPerGeneration: 10000,
        maxGenerationsPerDay: 500,
        maxGenerationsPerHour: 60,
        isBestValue: true,
        badge: 'Best Value',
        badgeColor: '#10B981',
        features: [
            { text: '500,000 credits/month', included: true, highlight: true },
            { text: '30 saved voice slots', included: true },
            { text: 'Ultra quality audio', included: true, highlight: true },
            { text: '10,000 chars/generation', included: true },
            { text: '500 generations/day', included: true },
            { text: 'Full API access', included: true },
            { text: 'Custom voice creation', included: true, highlight: true },
            { text: 'Webhook integrations', included: true },
            { text: 'Advanced analytics', included: true },
            { text: 'Commercial license', included: true },
        ],
    },
    {
        id: 'advanced',
        name: 'Advanced',
        displayName: 'Enterprise',
        description: 'For agencies and large teams',
        priceMonthly: 599800, // ₹5,998
        priceYearly: 5998000, // ₹59,980/year (10x monthly, save 2 months)
        priceMonthlyUSD: 7400, // $74
        priceYearlyUSD: 74000, // $740/year
        credits: 1000000,
        topupRate: 1300, // ₹13 per 1000 credits

        maxCharsPerGeneration: 15000,
        maxGenerationsPerDay: 1000,
        maxGenerationsPerHour: 100,
        features: [
            { text: '1,000,000 credits/month', included: true, highlight: true },
            { text: '50 saved voice slots', included: true },
            { text: 'Ultra quality audio', included: true },
            { text: '15,000 chars/generation', included: true },
            { text: 'Unlimited generations', included: true, highlight: true },
            { text: 'Dedicated account manager', included: true, highlight: true },
            { text: 'White label option', included: true },
            { text: 'Team collaboration', included: true },
            { text: 'SLA guarantee', included: true },
            { text: 'Custom integrations', included: true },
        ],
    },
];

// ===========================================
// TOP-UP PACKAGES
// ===========================================
export const TOPUP_PACKAGES: TopupPackage[] = [
    {
        id: 'topup_10k',
        name: '10,000 Credits',
        credits: 10000,
        priceByTier: {
            starter: 33600,     // ₹336
            creator: 24400,     // ₹244
            pro: 19300,     // ₹193
            advanced: 13000,     // ₹130
        },
    },
    {
        id: 'topup_25k',
        name: '25,000 Credits',
        credits: 25000,
        priceByTier: {
            starter: 84000,     // ₹840
            creator: 61000,     // ₹610
            pro: 48250,     // ₹482.50
            advanced: 32500,     // ₹325
        },
    },
    {
        id: 'topup_50k',
        name: '50,000 Credits',
        credits: 50000,
        isPopular: true,
        priceByTier: {
            starter: 168000,    // ₹1,680
            creator: 122000,    // ₹1,220
            pro: 96500,     // ₹965
            advanced: 65000,     // ₹650
        },
    },
    {
        id: 'topup_100k',
        name: '100,000 Credits',
        credits: 100000,
        priceByTier: {
            starter: 336000,    // ₹3,360
            creator: 244000,    // ₹2,440
            pro: 193000,    // ₹1,930
            advanced: 130000,    // ₹1,300
        },
    },
    {
        id: 'topup_250k',
        name: '250,000 Credits',
        credits: 250000,
        priceByTier: {
            starter: 840000,    // ₹8,400
            creator: 610000,    // ₹6,100
            pro: 482500,    // ₹4,825
            advanced: 325000,    // ₹3,250
        },
    },
    {
        id: 'topup_500k',
        name: '500,000 Credits',
        credits: 500000,
        priceByTier: {
            starter: 1680000,   // ₹16,800
            creator: 1220000,   // ₹12,200
            pro: 965000,    // ₹9,650
            advanced: 650000,    // ₹6,500
        },
    },
];

// ===========================================
// HELPER FUNCTIONS
// ===========================================

export type Currency = 'INR' | 'USD';

export function formatPrice(paise: number, currency: Currency = 'INR'): string {
    const amount = paise / 100;
    if (currency === 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(amount);
    }
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatPriceWithDecimals(paise: number, currency: Currency = 'INR'): string {
    const amount = paise / 100;
    if (currency === 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    }
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function getCurrencySymbol(currency: Currency): string {
    return currency === 'USD' ? '$' : '₹';
}

export function getPlanPrice(plan: SubscriptionPlan, currency: Currency): number {
    return currency === 'USD' ? plan.priceMonthlyUSD : plan.priceMonthly;
}

export function getPlanYearlyPrice(plan: SubscriptionPlan, currency: Currency): number {
    return currency === 'USD' ? plan.priceYearlyUSD : plan.priceYearly;
}

export function getPlanFirstMonthPrice(plan: SubscriptionPlan, currency: Currency): number | undefined {
    if (currency === 'USD') return plan.priceFirstMonthUSD;
    return plan.priceFirstMonth;
}

export function formatCredits(credits: number): string {
    if (credits >= 1000000) {
        return `${(credits / 1000000).toFixed(1)}M`;
    }
    if (credits >= 1000) {
        return `${(credits / 1000).toFixed(0)}K`;
    }
    return credits.toString();
}

export function getPlanById(planId: string): SubscriptionPlan | undefined {
    return SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
}

export function getTopupPrice(packageId: string, tier: string): number {
    const pkg = TOPUP_PACKAGES.find(p => p.id === packageId);
    if (!pkg) return 0;

    const tierKey = tier as keyof typeof pkg.priceByTier;
    return pkg.priceByTier[tierKey] || 0;
}

export function calculateTopupPrice(credits: number, tier: string): number {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === tier);
    if (!plan || plan.topupRate === 0) return 0;

    // Rate is per 1000 credits
    return Math.ceil((credits / 1000) * plan.topupRate);
}

export function canTopup(tier: string): boolean {
    return tier !== 'free';
}

export function getUpgradePath(currentTier: string): SubscriptionPlan[] {
    const currentIndex = SUBSCRIPTION_PLANS.findIndex(p => p.id === currentTier);
    if (currentIndex === -1) return SUBSCRIPTION_PLANS.slice(1);
    return SUBSCRIPTION_PLANS.slice(currentIndex + 1);
}

export function getSavingsVsFree(plan: SubscriptionPlan): string {
    if (plan.id === 'free') return '';

    const freeCredits = 5000;
    const planCredits = plan.credits;
    const multiplier = Math.round(planCredits / freeCredits);

    return `${multiplier}x more credits`;
}

export function getEffectivePrice(plan: SubscriptionPlan, isFirstMonth: boolean, billingPeriod: 'monthly' | 'yearly' = 'monthly'): number {
    if (billingPeriod === 'yearly') {
        return plan.priceYearly;
    }
    if (isFirstMonth && plan.priceFirstMonth) {
        return plan.priceFirstMonth;
    }
    return plan.priceMonthly;
}

// ===========================================
// TIER PERMISSIONS
// ===========================================
export interface TierPermissions {
    canAccessApi: boolean;
    canCreateCustomVoices: boolean;
    canUseWhiteLabel: boolean;
    canBulkGenerate: boolean;
    canAccessAnalytics: boolean;
    canTopup: boolean;
    audioQuality: 'standard' | 'high' | 'ultra';
}

export function getTierPermissions(tier: string): TierPermissions {
    const permissions: Record<string, TierPermissions> = {
        free: {
            canAccessApi: false,
            canCreateCustomVoices: false,
            canUseWhiteLabel: false,
            canBulkGenerate: false,
            canAccessAnalytics: false,
            canTopup: false,
            audioQuality: 'standard',
        },
        starter: {
            canAccessApi: false,
            canCreateCustomVoices: false,
            canUseWhiteLabel: false,
            canBulkGenerate: false,
            canAccessAnalytics: false,
            canTopup: true,
            audioQuality: 'high',
        },
        creator: {
            canAccessApi: true,
            canCreateCustomVoices: false,
            canUseWhiteLabel: false,
            canBulkGenerate: true,
            canAccessAnalytics: true,
            canTopup: true,
            audioQuality: 'high',
        },
        pro: {
            canAccessApi: true,
            canCreateCustomVoices: true,
            canUseWhiteLabel: false,
            canBulkGenerate: true,
            canAccessAnalytics: true,
            canTopup: true,
            audioQuality: 'ultra',
        },
        advanced: {
            canAccessApi: true,
            canCreateCustomVoices: true,
            canUseWhiteLabel: true,
            canBulkGenerate: true,
            canAccessAnalytics: true,
            canTopup: true,
            audioQuality: 'ultra',
        },
    };

    return permissions[tier] || permissions.free;
}
