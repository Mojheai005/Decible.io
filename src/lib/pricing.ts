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
    priceFirstMonth?: number; // promotional price in paise
    priceMonthlyUSD: number; // in cents
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
        priceMonthlyUSD: 0,
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
        priceMonthly: 39500, // ₹395
        priceMonthlyUSD: 500, // $5
        credits: 35000,
        topupRate: 1680, // ₹16.80 per 1000 credits

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
        priceMonthly: 139500, // ₹1395 after first month
        priceFirstMonth: 79500, // ₹795 first month
        priceMonthlyUSD: 1700, // $17
        priceFirstMonthUSD: 1000, // $10
        credits: 150000,
        topupRate: 1220, // ₹12.20 per 1000 credits

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
        priceMonthly: 219500, // ₹2195
        priceMonthlyUSD: 2700, // $27
        credits: 500000,
        topupRate: 965, // ₹9.65 per 1000 credits

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
        priceMonthly: 349500, // ₹3495
        priceMonthlyUSD: 4200, // $42
        credits: 1000000,
        topupRate: 650, // ₹6.50 per 1000 credits

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
            starter: 16800,   // ₹168
            creator: 12200,   // ₹122
            pro: 9650,        // ₹96.50
            advanced: 6500,   // ₹65
        },
    },
    {
        id: 'topup_25k',
        name: '25,000 Credits',
        credits: 25000,
        priceByTier: {
            starter: 42000,   // ₹420
            creator: 30500,   // ₹305
            pro: 24125,       // ₹241.25
            advanced: 16250,  // ₹162.50
        },
    },
    {
        id: 'topup_50k',
        name: '50,000 Credits',
        credits: 50000,
        isPopular: true,
        priceByTier: {
            starter: 84000,   // ₹840
            creator: 61000,   // ₹610
            pro: 48250,       // ₹482.50
            advanced: 32500,  // ₹325
        },
    },
    {
        id: 'topup_100k',
        name: '100,000 Credits',
        credits: 100000,
        priceByTier: {
            starter: 168000,  // ₹1,680
            creator: 122000,  // ₹1,220
            pro: 96500,       // ₹965
            advanced: 65000,  // ₹650
        },
    },
    {
        id: 'topup_250k',
        name: '250,000 Credits',
        credits: 250000,
        priceByTier: {
            starter: 420000,  // ₹4,200
            creator: 305000,  // ₹3,050
            pro: 241250,      // ₹2,412.50
            advanced: 162500, // ₹1,625
        },
    },
    {
        id: 'topup_500k',
        name: '500,000 Credits',
        credits: 500000,
        priceByTier: {
            starter: 840000,  // ₹8,400
            creator: 610000,  // ₹6,100
            pro: 482500,      // ₹4,825
            advanced: 325000, // ₹3,250
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

export function getEffectivePrice(plan: SubscriptionPlan, isFirstMonth: boolean): number {
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
