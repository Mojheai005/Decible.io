-- ===========================================
-- NMM VO APP - PRODUCTION DATABASE SCHEMA
-- ===========================================
-- Run this COMPLETE script in Supabase SQL Editor
-- This creates all tables, functions, triggers, and policies
-- ===========================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ===========================================
-- 1. SUBSCRIPTION PLANS TABLE
-- ===========================================
-- Stores all available subscription plans with pricing
DROP TABLE IF EXISTS subscription_plans CASCADE;
CREATE TABLE subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    -- Pricing (in paise - 100 paise = 1 INR)
    price_monthly INTEGER NOT NULL,
    price_first_month INTEGER, -- For promotional pricing (creator plan)
    -- Credits
    credits_monthly INTEGER NOT NULL,
    topup_rate INTEGER NOT NULL, -- paise per 1000 credits
    -- Limits & Features
    voice_slots INTEGER NOT NULL DEFAULT 5,
    max_chars_per_generation INTEGER DEFAULT 5000,
    max_generations_per_day INTEGER DEFAULT 100,
    max_generations_per_hour INTEGER DEFAULT 20,
    -- Feature Flags
    has_api_access BOOLEAN DEFAULT false,
    has_priority_support BOOLEAN DEFAULT false,
    has_custom_voices BOOLEAN DEFAULT false,
    has_white_label BOOLEAN DEFAULT false,
    has_dedicated_support BOOLEAN DEFAULT false,
    has_analytics BOOLEAN DEFAULT false,
    has_bulk_generation BOOLEAN DEFAULT false,
    audio_quality TEXT DEFAULT 'standard', -- standard, high, ultra
    -- Metadata
    features JSONB DEFAULT '[]',
    badge_text TEXT, -- "Popular", "Best Value", etc.
    badge_color TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Insert subscription plans with YOUR exact pricing
INSERT INTO subscription_plans (
    id, name, display_name, description,
    price_monthly, price_first_month, credits_monthly, topup_rate,
    voice_slots, max_chars_per_generation, max_generations_per_day, max_generations_per_hour,
    has_api_access, has_priority_support, has_custom_voices, has_white_label,
    has_dedicated_support, has_analytics, has_bulk_generation, audio_quality,
    features, badge_text, badge_color, sort_order
) VALUES
-- Free Plan
(
    'free', 'Free', 'Free Forever', 'Perfect for trying out our voice generation',
    0, NULL, 5000, 0,
    5, 1000, 10, 3,
    false, false, false, false, false, false, false, 'standard',
    '["5,000 credits/month", "5 saved voice slots", "Standard quality audio", "1,000 chars/generation", "10 generations/day", "Community support", "Basic voice library"]'::jsonb,
    NULL, NULL, 1
),
-- Starter Plan - ₹395/month
(
    'starter', 'Starter', 'Starter', 'Great for content creators getting started',
    39500, NULL, 35000, 1680,
    10, 3000, 50, 10,
    false, true, false, false, false, false, false, 'high',
    '["35,000 credits/month", "10 saved voice slots", "High quality audio", "3,000 chars/generation", "50 generations/day", "Priority email support", "Full voice library", "Voice preview", "Generation history"]'::jsonb,
    NULL, NULL, 2
),
-- Creator Plan - ₹795 first month, ₹1395 after
(
    'creator', 'Creator', 'Creator', 'Ideal for professional content creators',
    139500, 79500, 150000, 1220,
    20, 5000, 150, 30,
    true, true, false, false, false, true, true, 'high',
    '["150,000 credits/month", "20 saved voice slots", "High quality audio", "5,000 chars/generation", "150 generations/day", "API access", "Priority support", "Full voice library", "Bulk generation", "Analytics dashboard", "Voice cloning (coming soon)"]'::jsonb,
    'Popular', '#8B5CF6', 3
),
-- Pro Plan - ₹2195/month
(
    'pro', 'Pro', 'Professional', 'For businesses and power users',
    219500, NULL, 500000, 965,
    30, 10000, 500, 60,
    true, true, true, false, false, true, true, 'ultra',
    '["500,000 credits/month", "30 saved voice slots", "Ultra quality audio", "10,000 chars/generation", "500 generations/day", "Full API access", "Priority support", "Custom voice creation", "Bulk generation", "Advanced analytics", "Webhook integrations", "Commercial license"]'::jsonb,
    'Best Value', '#10B981', 4
),
-- Advanced Plan - ₹3495/month
(
    'advanced', 'Advanced', 'Enterprise', 'For agencies and large teams',
    349500, NULL, 1000000, 650,
    50, 15000, 1000, 100,
    true, true, true, true, true, true, true, 'ultra',
    '["1,000,000 credits/month", "50 saved voice slots", "Ultra quality audio", "15,000 chars/generation", "Unlimited generations", "Full API access", "Dedicated account manager", "Custom voice creation", "White label option", "Team collaboration", "SLA guarantee", "Custom integrations"]'::jsonb,
    NULL, NULL, 5
);

-- ===========================================
-- 2. TOP-UP CREDIT PACKAGES
-- ===========================================
DROP TABLE IF EXISTS topup_packages CASCADE;
CREATE TABLE topup_packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    credits INTEGER NOT NULL,
    -- Pricing per tier (in paise)
    price_free INTEGER, -- Not available for free
    price_starter INTEGER,
    price_creator INTEGER,
    price_pro INTEGER,
    price_advanced INTEGER,
    -- Metadata
    is_popular BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Insert top-up packages based on tier pricing
INSERT INTO topup_packages (id, name, credits, price_starter, price_creator, price_pro, price_advanced, is_popular, sort_order) VALUES
('topup_10k', '10,000 Credits', 10000, 16800, 12200, 9650, 6500, false, 1),
('topup_25k', '25,000 Credits', 25000, 42000, 30500, 24125, 16250, false, 2),
('topup_50k', '50,000 Credits', 50000, 84000, 61000, 48250, 32500, true, 3),
('topup_100k', '100,000 Credits', 100000, 168000, 122000, 96500, 65000, false, 4),
('topup_250k', '250,000 Credits', 250000, 420000, 305000, 241250, 162500, false, 5),
('topup_500k', '500,000 Credits', 500000, 840000, 610000, 482500, 325000, false, 6);

-- ===========================================
-- 3. USER PROFILES TABLE
-- ===========================================
DROP TABLE IF EXISTS user_profiles CASCADE;
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    phone TEXT,

    -- Subscription Details
    subscription_tier TEXT DEFAULT 'free' REFERENCES subscription_plans(id),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing', 'paused')),
    subscription_start_date TIMESTAMP WITH TIME ZONE,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    subscription_cancel_at TIMESTAMP WITH TIME ZONE,
    is_first_month BOOLEAN DEFAULT true, -- For creator plan promo pricing

    -- Credits
    credits_remaining INTEGER DEFAULT 5000,
    credits_used_total INTEGER DEFAULT 0,
    credits_used_this_month INTEGER DEFAULT 0,
    credits_reset_date TIMESTAMP WITH TIME ZONE DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month'),

    -- Usage Tracking
    generations_today INTEGER DEFAULT 0,
    generations_this_hour INTEGER DEFAULT 0,
    generations_total INTEGER DEFAULT 0,
    last_generation_at TIMESTAMP WITH TIME ZONE,
    last_generation_date DATE,

    -- Payment
    razorpay_customer_id TEXT,
    razorpay_subscription_id TEXT,

    -- Preferences
    default_voice_id TEXT,
    default_voice_settings JSONB DEFAULT '{"stability": 50, "similarity": 75, "speed": 1.0}'::jsonb,
    notification_preferences JSONB DEFAULT '{"email": true, "credits_low": true, "new_features": true}'::jsonb,

    -- Metadata
    referral_code TEXT UNIQUE,
    referred_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    last_login_at TIMESTAMP WITH TIME ZONE,

    -- Analytics
    signup_source TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT
);

CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_subscription ON user_profiles(subscription_tier, subscription_status);
CREATE INDEX idx_user_profiles_credits ON user_profiles(credits_remaining) WHERE credits_remaining < 1000;
CREATE INDEX idx_user_profiles_referral ON user_profiles(referral_code) WHERE referral_code IS NOT NULL;

-- ===========================================
-- 4. SAVED VOICES TABLE
-- ===========================================
DROP TABLE IF EXISTS saved_voices CASCADE;
CREATE TABLE saved_voices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    voice_id TEXT NOT NULL,
    voice_name TEXT NOT NULL,
    voice_category TEXT,
    voice_gender TEXT,
    voice_accent TEXT,
    voice_language TEXT,
    custom_settings JSONB DEFAULT '{}'::jsonb,
    is_favorite BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, voice_id)
);

CREATE INDEX idx_saved_voices_user ON saved_voices(user_id);
CREATE INDEX idx_saved_voices_favorite ON saved_voices(user_id, is_favorite) WHERE is_favorite = true;

-- ===========================================
-- 5. GENERATION HISTORY TABLE
-- ===========================================
DROP TABLE IF EXISTS generation_history CASCADE;
CREATE TABLE generation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- Content
    text TEXT NOT NULL,
    text_preview TEXT, -- First 100 chars for display
    text_length INTEGER NOT NULL,

    -- Voice Info
    voice_id TEXT NOT NULL,
    voice_name TEXT NOT NULL,
    voice_category TEXT,

    -- Output
    audio_url TEXT,
    audio_storage_path TEXT,
    audio_duration_seconds FLOAT,
    audio_format TEXT DEFAULT 'mp3',
    audio_size_bytes INTEGER,

    -- Credits & Billing
    characters_used INTEGER NOT NULL,
    credits_used INTEGER NOT NULL,

    -- Settings Used
    settings JSONB DEFAULT '{}'::jsonb,
    model_used TEXT DEFAULT 'eleven_multilingual_v2',

    -- Status
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    processing_time_ms INTEGER,

    -- Metadata
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_generation_history_user ON generation_history(user_id, created_at DESC);
CREATE INDEX idx_generation_history_status ON generation_history(status) WHERE status != 'completed';
CREATE INDEX idx_generation_history_voice ON generation_history(voice_id);

-- ===========================================
-- 6. CREDIT TRANSACTIONS TABLE
-- ===========================================
DROP TABLE IF EXISTS credit_transactions CASCADE;
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- Transaction Details
    amount INTEGER NOT NULL, -- positive = add, negative = deduct
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,

    -- Type & Description
    type TEXT NOT NULL CHECK (type IN (
        'subscription_renewal', 'subscription_upgrade', 'subscription_downgrade',
        'topup', 'generation', 'refund', 'bonus', 'referral', 'adjustment', 'expiry'
    )),
    description TEXT,

    -- References
    reference_id TEXT, -- generation_id, payment_id, etc.
    reference_type TEXT, -- 'generation', 'payment', 'subscription'

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(type, created_at DESC);
CREATE INDEX idx_credit_transactions_reference ON credit_transactions(reference_id) WHERE reference_id IS NOT NULL;

-- ===========================================
-- 7. PAYMENT ORDERS TABLE
-- ===========================================
DROP TABLE IF EXISTS payment_orders CASCADE;
CREATE TABLE payment_orders (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- Order Details
    order_type TEXT NOT NULL CHECK (order_type IN ('subscription', 'topup', 'upgrade')),
    plan_id TEXT REFERENCES subscription_plans(id),
    topup_package_id TEXT REFERENCES topup_packages(id),

    -- Amount
    amount INTEGER NOT NULL, -- in paise
    currency TEXT DEFAULT 'INR',
    credits INTEGER NOT NULL,

    -- Razorpay
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    razorpay_subscription_id TEXT,

    -- Status
    status TEXT DEFAULT 'created' CHECK (status IN ('created', 'authorized', 'paid', 'completed', 'failed', 'refunded')),
    credits_added BOOLEAN DEFAULT false,

    -- Error Tracking
    error_code TEXT,
    error_description TEXT,
    failure_reason TEXT,

    -- Timestamps
    authorized_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_payment_orders_user ON payment_orders(user_id, created_at DESC);
CREATE INDEX idx_payment_orders_status ON payment_orders(status, created_at DESC);
CREATE INDEX idx_payment_orders_razorpay ON payment_orders(razorpay_order_id);

-- ===========================================
-- 8. PAYMENTS/INVOICES TABLE
-- ===========================================
DROP TABLE IF EXISTS payments CASCADE;
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    order_id TEXT REFERENCES payment_orders(id),

    -- Razorpay Details
    razorpay_payment_id TEXT UNIQUE,
    razorpay_order_id TEXT,
    razorpay_signature TEXT,
    razorpay_invoice_id TEXT,

    -- Amount
    amount INTEGER NOT NULL, -- in paise
    amount_refunded INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'INR',

    -- Status
    status TEXT DEFAULT 'captured' CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded')),

    -- Payment Method
    payment_method TEXT, -- card, upi, netbanking, wallet
    payment_method_details JSONB DEFAULT '{}'::jsonb,

    -- Type
    payment_type TEXT NOT NULL CHECK (payment_type IN ('subscription', 'topup', 'upgrade')),
    plan_id TEXT REFERENCES subscription_plans(id),
    credits_purchased INTEGER,

    -- Invoice
    invoice_number TEXT UNIQUE,
    invoice_url TEXT,

    -- Timestamps
    captured_at TIMESTAMP WITH TIME ZONE,
    refunded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX idx_payments_razorpay ON payments(razorpay_payment_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_number) WHERE invoice_number IS NOT NULL;

-- ===========================================
-- 9. VOICE CACHE TABLE
-- ===========================================
DROP TABLE IF EXISTS voice_cache CASCADE;
CREATE TABLE voice_cache (
    id TEXT PRIMARY KEY DEFAULT 'main_cache',
    voices_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_count INTEGER DEFAULT 0,
    categories JSONB DEFAULT '[]'::jsonb,
    languages JSONB DEFAULT '[]'::jsonb,
    accents JSONB DEFAULT '[]'::jsonb,
    genders JSONB DEFAULT '[]'::jsonb,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ===========================================
-- 10. RATE LIMITS TABLE
-- ===========================================
DROP TABLE IF EXISTS rate_limits CASCADE;
CREATE TABLE rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_rate_limits_expires ON rate_limits(expires_at);

-- ===========================================
-- 11. ANALYTICS EVENTS TABLE (for optimization)
-- ===========================================
DROP TABLE IF EXISTS analytics_events CASCADE;
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

    -- Event Details
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,

    -- Context
    page_url TEXT,
    referrer TEXT,

    -- Device Info
    device_type TEXT,
    browser TEXT,
    os TEXT,

    -- Location
    country TEXT,
    city TEXT,

    -- Session
    session_id TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_analytics_events_user ON analytics_events(user_id, created_at DESC);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type, event_name, created_at DESC);
CREATE INDEX idx_analytics_events_date ON analytics_events(created_at DESC);

-- ===========================================
-- 12. REFERRALS TABLE
-- ===========================================
DROP TABLE IF EXISTS referrals CASCADE;
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

    -- Rewards
    referrer_credits_earned INTEGER DEFAULT 0,
    referred_credits_earned INTEGER DEFAULT 0,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

    UNIQUE(referrer_id, referred_id)
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);

-- ===========================================
-- STORED PROCEDURES
-- ===========================================

-- 1. Use credits (atomic operation with balance check)
CREATE OR REPLACE FUNCTION use_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_description TEXT DEFAULT 'TTS Generation',
    p_reference_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Lock the user row for update
    SELECT credits_remaining INTO v_current_balance
    FROM user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
        RETURN QUERY SELECT false, 0, 'User not found'::TEXT;
        RETURN;
    END IF;

    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT false, v_current_balance, 'Insufficient credits'::TEXT;
        RETURN;
    END IF;

    v_new_balance := v_current_balance - p_amount;

    -- Deduct credits and update usage
    UPDATE user_profiles
    SET credits_remaining = v_new_balance,
        credits_used_total = credits_used_total + p_amount,
        credits_used_this_month = credits_used_this_month + p_amount,
        generations_total = generations_total + 1,
        generations_today = CASE
            WHEN last_generation_date = CURRENT_DATE THEN generations_today + 1
            ELSE 1
        END,
        last_generation_at = TIMEZONE('utc', NOW()),
        last_generation_date = CURRENT_DATE,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_user_id;

    -- Log transaction
    INSERT INTO credit_transactions (user_id, amount, balance_before, balance_after, type, description, reference_id, reference_type)
    VALUES (p_user_id, -p_amount, v_current_balance, v_new_balance, 'generation', p_description, p_reference_id, 'generation');

    RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 2. Add credits (for subscriptions/topups/bonuses)
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_type TEXT,
    p_description TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    SELECT credits_remaining INTO v_current_balance
    FROM user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    v_new_balance := COALESCE(v_current_balance, 0) + p_amount;

    UPDATE user_profiles
    SET credits_remaining = v_new_balance,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_user_id;

    INSERT INTO credit_transactions (user_id, amount, balance_before, balance_after, type, description, reference_id)
    VALUES (p_user_id, p_amount, COALESCE(v_current_balance, 0), v_new_balance, p_type, p_description, p_reference_id);

    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- 3. Get voice slot limit for user
CREATE OR REPLACE FUNCTION get_user_slot_limit(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_slots INTEGER;
BEGIN
    SELECT sp.voice_slots INTO v_slots
    FROM user_profiles up
    JOIN subscription_plans sp ON up.subscription_tier = sp.id
    WHERE up.id = p_user_id;

    RETURN COALESCE(v_slots, 5);
END;
$$ LANGUAGE plpgsql;

-- 4. Check if user can add voice
CREATE OR REPLACE FUNCTION can_add_voice(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_count INTEGER;
    v_limit INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_current_count FROM saved_voices WHERE user_id = p_user_id;
    v_limit := get_user_slot_limit(p_user_id);
    RETURN v_current_count < v_limit;
END;
$$ LANGUAGE plpgsql;

-- 5. Rate limit check
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO rate_limits (key, count, window_start, expires_at)
    VALUES (
        p_key,
        1,
        TIMEZONE('utc', NOW()),
        TIMEZONE('utc', NOW()) + (p_window_seconds || ' seconds')::INTERVAL
    )
    ON CONFLICT (key) DO UPDATE SET
        count = CASE
            WHEN rate_limits.window_start < TIMEZONE('utc', NOW()) - (p_window_seconds || ' seconds')::INTERVAL
            THEN 1
            ELSE rate_limits.count + 1
        END,
        window_start = CASE
            WHEN rate_limits.window_start < TIMEZONE('utc', NOW()) - (p_window_seconds || ' seconds')::INTERVAL
            THEN TIMEZONE('utc', NOW())
            ELSE rate_limits.window_start
        END,
        expires_at = TIMEZONE('utc', NOW()) + (p_window_seconds || ' seconds')::INTERVAL
    RETURNING count INTO v_count;

    RETURN v_count <= p_limit;
END;
$$ LANGUAGE plpgsql;

-- 6. Get user plan limits
CREATE OR REPLACE FUNCTION get_user_limits(p_user_id UUID)
RETURNS TABLE (
    tier TEXT,
    voice_slots INTEGER,
    max_chars INTEGER,
    max_daily INTEGER,
    max_hourly INTEGER,
    has_api BOOLEAN,
    audio_quality TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.id,
        sp.voice_slots,
        sp.max_chars_per_generation,
        sp.max_generations_per_day,
        sp.max_generations_per_hour,
        sp.has_api_access,
        sp.audio_quality
    FROM user_profiles up
    JOIN subscription_plans sp ON up.subscription_tier = sp.id
    WHERE up.id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Reset daily usage (call via cron at midnight)
CREATE OR REPLACE FUNCTION reset_daily_usage()
RETURNS void AS $$
BEGIN
    UPDATE user_profiles
    SET generations_today = 0,
        generations_this_hour = 0,
        updated_at = TIMEZONE('utc', NOW())
    WHERE last_generation_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- 8. Reset monthly credits (call via cron on 1st of month)
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void AS $$
BEGIN
    UPDATE user_profiles up
    SET credits_remaining = sp.credits_monthly,
        credits_used_this_month = 0,
        credits_reset_date = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
        is_first_month = false,
        updated_at = TIMEZONE('utc', NOW())
    FROM subscription_plans sp
    WHERE up.subscription_tier = sp.id
    AND up.credits_reset_date <= NOW()
    AND up.subscription_status = 'active';
END;
$$ LANGUAGE plpgsql;

-- 9. Generate referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        v_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
        SELECT EXISTS(SELECT 1 FROM user_profiles WHERE referral_code = v_code) INTO v_exists;
        EXIT WHEN NOT v_exists;
    END LOOP;
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- 10. Upgrade subscription
CREATE OR REPLACE FUNCTION upgrade_subscription(
    p_user_id UUID,
    p_new_tier TEXT,
    p_payment_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_tier TEXT;
    v_new_credits INTEGER;
BEGIN
    SELECT subscription_tier INTO v_old_tier FROM user_profiles WHERE id = p_user_id;
    SELECT credits_monthly INTO v_new_credits FROM subscription_plans WHERE id = p_new_tier;

    UPDATE user_profiles
    SET subscription_tier = p_new_tier,
        subscription_status = 'active',
        subscription_start_date = TIMEZONE('utc', NOW()),
        credits_remaining = credits_remaining + v_new_credits,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_user_id;

    -- Log credit addition
    INSERT INTO credit_transactions (user_id, amount, balance_before, balance_after, type, description, reference_id)
    SELECT p_user_id, v_new_credits, credits_remaining - v_new_credits, credits_remaining, 'subscription_upgrade',
           'Upgraded from ' || v_old_tier || ' to ' || p_new_tier, p_payment_id
    FROM user_profiles WHERE id = p_user_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, email, name, avatar_url, referral_code)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
        NEW.raw_user_meta_data->>'avatar_url',
        generate_referral_code()
    );

    -- Log initial credits
    INSERT INTO credit_transactions (user_id, amount, balance_before, balance_after, type, description)
    VALUES (NEW.id, 5000, 0, 5000, 'bonus', 'Welcome bonus - Free tier');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_timestamp
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payments_timestamp
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_voice_cache_timestamp
    BEFORE UPDATE ON voice_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- User profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Saved voices policies
DROP POLICY IF EXISTS "Users can manage own voices" ON saved_voices;
CREATE POLICY "Users can manage own voices" ON saved_voices
    FOR ALL USING (auth.uid() = user_id);

-- Generation history policies
DROP POLICY IF EXISTS "Users can view own history" ON generation_history;
CREATE POLICY "Users can view own history" ON generation_history
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own history" ON generation_history;
CREATE POLICY "Users can insert own history" ON generation_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own history" ON generation_history;
CREATE POLICY "Users can delete own history" ON generation_history
    FOR DELETE USING (auth.uid() = user_id);

-- Credit transactions policies
DROP POLICY IF EXISTS "Users can view own transactions" ON credit_transactions;
CREATE POLICY "Users can view own transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Payments policies
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (auth.uid() = user_id);

-- Payment orders policies
DROP POLICY IF EXISTS "Users can view own orders" ON payment_orders;
CREATE POLICY "Users can view own orders" ON payment_orders
    FOR SELECT USING (auth.uid() = user_id);

-- Analytics policies
DROP POLICY IF EXISTS "Users can insert own events" ON analytics_events;
CREATE POLICY "Users can insert own events" ON analytics_events
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Referrals policies
DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;
CREATE POLICY "Users can view own referrals" ON referrals
    FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Public tables
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read plans" ON subscription_plans;
CREATE POLICY "Anyone can read plans" ON subscription_plans FOR SELECT USING (true);

ALTER TABLE topup_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read topups" ON topup_packages;
CREATE POLICY "Anyone can read topups" ON topup_packages FOR SELECT USING (true);

ALTER TABLE voice_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read voice cache" ON voice_cache;
CREATE POLICY "Anyone can read voice cache" ON voice_cache FOR SELECT USING (true);

-- ===========================================
-- CLEANUP FUNCTIONS (run via scheduled jobs)
-- ===========================================

-- Delete expired rate limits
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM rate_limits WHERE expires_at < NOW();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Delete old generation history (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_history()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM generation_history WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Delete old analytics (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM analytics_events WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- VIEWS FOR ANALYTICS
-- ===========================================

-- Daily revenue summary
CREATE OR REPLACE VIEW daily_revenue AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_transactions,
    SUM(amount) / 100.0 as total_revenue_inr,
    SUM(CASE WHEN payment_type = 'subscription' THEN amount ELSE 0 END) / 100.0 as subscription_revenue,
    SUM(CASE WHEN payment_type = 'topup' THEN amount ELSE 0 END) / 100.0 as topup_revenue,
    COUNT(DISTINCT user_id) as unique_customers
FROM payments
WHERE status = 'captured'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- User tier distribution
CREATE OR REPLACE VIEW tier_distribution AS
SELECT
    subscription_tier,
    COUNT(*) as user_count,
    SUM(credits_remaining) as total_credits,
    AVG(credits_remaining) as avg_credits,
    SUM(generations_total) as total_generations
FROM user_profiles
GROUP BY subscription_tier
ORDER BY user_count DESC;

-- ===========================================
-- GRANT PERMISSIONS
-- ===========================================

-- Grant access to authenticated users for RPC functions
GRANT EXECUTE ON FUNCTION use_credits TO authenticated;
GRANT EXECUTE ON FUNCTION add_credits TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_slot_limit TO authenticated;
GRANT EXECUTE ON FUNCTION can_add_voice TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_limits TO authenticated;

-- ===========================================
-- STORAGE BUCKETS
-- ===========================================

-- Create storage buckets for audio files and avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('generations', 'generations', true, 52428800, ARRAY['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3']),
    ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies for generations bucket
DROP POLICY IF EXISTS "Users can upload own audio" ON storage.objects;
CREATE POLICY "Users can upload own audio" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'generations'
        AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Users can update own audio" ON storage.objects;
CREATE POLICY "Users can update own audio" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'generations'
        AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Users can delete own audio" ON storage.objects;
CREATE POLICY "Users can delete own audio" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'generations'
        AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Public read access for generations" ON storage.objects;
CREATE POLICY "Public read access for generations" ON storage.objects
    FOR SELECT USING (bucket_id = 'generations');

-- Storage policies for avatars bucket
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars'
        AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars'
        AND auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
CREATE POLICY "Public read access for avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

-- ===========================================
-- DONE! - COMPLETE SCHEMA
-- ===========================================
-- This script includes:
-- ✅ All tables (12 tables)
-- ✅ All stored procedures (10 functions)
-- ✅ All triggers (4 triggers)
-- ✅ All RLS policies
-- ✅ All indexes
-- ✅ Storage buckets & policies
-- ✅ Analytics views
-- ✅ Cleanup functions
--
-- Just copy-paste this entire file into Supabase SQL Editor and run!
