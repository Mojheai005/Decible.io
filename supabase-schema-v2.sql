-- ===========================================
-- NMM VO APP - Production Database Schema v2
-- Run this in your Supabase SQL Editor
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- SUBSCRIPTION PLANS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_monthly INTEGER NOT NULL, -- in paise (INR * 100)
    credits_monthly INTEGER NOT NULL,
    topup_rate INTEGER NOT NULL, -- paise per 1000 credits
    voice_slots INTEGER NOT NULL,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Insert your pricing plans
INSERT INTO subscription_plans (id, name, price_monthly, credits_monthly, topup_rate, voice_slots, features) VALUES
    ('free', 'Free', 0, 5000, 0, 5, '["Basic voices", "Standard quality"]'),
    ('starter', 'Starter', 39500, 35000, 1680, 10, '["All voices", "High quality", "Priority support"]'),
    ('creator', 'Creator', 79500, 150000, 1220, 20, '["All voices", "High quality", "Priority support", "API access"]'),
    ('pro', 'Pro', 219500, 500000, 965, 30, '["All voices", "Ultra quality", "Priority support", "API access", "Custom voices"]'),
    ('advanced', 'Advanced', 349500, 1000000, 650, 50, '["All voices", "Ultra quality", "Dedicated support", "API access", "Custom voices", "White label"]')
ON CONFLICT (id) DO UPDATE SET
    price_monthly = EXCLUDED.price_monthly,
    credits_monthly = EXCLUDED.credits_monthly,
    topup_rate = EXCLUDED.topup_rate,
    voice_slots = EXCLUDED.voice_slots;

-- ===========================================
-- USER PROFILES TABLE (Enhanced)
-- ===========================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    -- Subscription
    subscription_tier TEXT DEFAULT 'free' REFERENCES subscription_plans(id),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing')),
    subscription_start_date TIMESTAMP WITH TIME ZONE,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    -- Credits
    credits_remaining INTEGER DEFAULT 5000,
    credits_used_this_month INTEGER DEFAULT 0,
    credits_reset_date TIMESTAMP WITH TIME ZONE DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month'),
    -- Payment
    razorpay_customer_id TEXT,
    razorpay_subscription_id TEXT,
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription ON user_profiles(subscription_tier, subscription_status);

-- ===========================================
-- SAVED VOICES TABLE (My Voices)
-- ===========================================
CREATE TABLE IF NOT EXISTS saved_voices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    voice_id TEXT NOT NULL,
    voice_name TEXT NOT NULL,
    voice_category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, voice_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_voices_user_id ON saved_voices(user_id);

-- ===========================================
-- GENERATION HISTORY TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS generation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    voice_id TEXT NOT NULL,
    voice_name TEXT NOT NULL,
    audio_url TEXT,
    audio_storage_path TEXT, -- Supabase storage path
    duration_seconds FLOAT,
    characters_used INTEGER NOT NULL,
    credits_used INTEGER NOT NULL,
    settings JSONB DEFAULT '{}',
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_generation_history_user ON generation_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_history_status ON generation_history(status) WHERE status != 'completed';

-- ===========================================
-- CREDIT TRANSACTIONS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- positive = add, negative = deduct
    balance_after INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('subscription_renewal', 'topup', 'generation', 'refund', 'bonus', 'adjustment')),
    description TEXT,
    reference_id TEXT, -- generation_id, payment_id, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);

-- ===========================================
-- PAYMENTS TABLE (Razorpay)
-- ===========================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_signature TEXT,
    amount INTEGER NOT NULL, -- in paise
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'created' CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded')),
    type TEXT NOT NULL CHECK (type IN ('subscription', 'topup')),
    plan_id TEXT REFERENCES subscription_plans(id),
    credits_purchased INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay ON payments(razorpay_payment_id);

-- ===========================================
-- PAYMENT ORDERS TABLE (For pending orders)
-- ===========================================
CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    amount INTEGER NOT NULL, -- in paise
    currency TEXT DEFAULT 'INR',
    credits INTEGER NOT NULL,
    status TEXT DEFAULT 'created' CHECK (status IN ('created', 'paid', 'completed', 'failed')),
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    error_code TEXT,
    error_description TEXT,
    credits_added BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_razorpay ON payment_orders(razorpay_order_id);

-- ===========================================
-- VOICE CACHE TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS voice_cache (
    id TEXT PRIMARY KEY DEFAULT 'main_cache',
    voices_data JSONB NOT NULL DEFAULT '[]',
    total_count INTEGER DEFAULT 0,
    categories JSONB DEFAULT '[]',
    languages JSONB DEFAULT '[]',
    accents JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ===========================================
-- RATE LIMITS TABLE (for serverless)
-- ===========================================
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

-- ===========================================
-- STORED PROCEDURES
-- ===========================================

-- Use credits (atomic operation)
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

    -- Deduct credits
    UPDATE user_profiles
    SET credits_remaining = v_new_balance,
        credits_used_this_month = credits_used_this_month + p_amount,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_user_id;

    -- Log transaction
    INSERT INTO credit_transactions (user_id, amount, balance_after, type, description, reference_id)
    VALUES (p_user_id, -p_amount, v_new_balance, 'generation', p_description, p_reference_id);

    RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Add credits (for subscriptions/topups)
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_type TEXT,
    p_description TEXT DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
    UPDATE user_profiles
    SET credits_remaining = credits_remaining + p_amount,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_user_id
    RETURNING credits_remaining INTO v_new_balance;

    INSERT INTO credit_transactions (user_id, amount, balance_after, type, description, reference_id)
    VALUES (p_user_id, p_amount, v_new_balance, p_type, p_description, p_reference_id);

    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- Get voice slot limit for user
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

-- Check if user can add voice
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

-- Rate limit check (returns true if allowed)
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_window_start TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get or create rate limit entry
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

-- Reset monthly credits (run via cron)
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void AS $$
BEGIN
    UPDATE user_profiles
    SET credits_remaining = (
        SELECT sp.credits_monthly
        FROM subscription_plans sp
        WHERE sp.id = user_profiles.subscription_tier
    ),
    credits_used_this_month = 0,
    credits_reset_date = DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
    WHERE credits_reset_date <= NOW()
    AND subscription_status = 'active';
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Saved voices policies
CREATE POLICY "Users can manage own voices" ON saved_voices
    FOR ALL USING (auth.uid() = user_id);

-- Generation history policies
CREATE POLICY "Users can view own history" ON generation_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON generation_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON generation_history
    FOR DELETE USING (auth.uid() = user_id);

-- Credit transactions policies
CREATE POLICY "Users can view own transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Payments policies
CREATE POLICY "Users can view own payments" ON payments
    FOR SELECT USING (auth.uid() = user_id);

-- Voice cache is public read
ALTER TABLE voice_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read voice cache" ON voice_cache FOR SELECT USING (true);

-- Subscription plans are public read
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read plans" ON subscription_plans FOR SELECT USING (true);

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, email, name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
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

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- STORAGE BUCKETS
-- ===========================================
-- Run these in Supabase Dashboard > Storage

-- INSERT INTO storage.buckets (id, name, public) VALUES ('generations', 'generations', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies (run in SQL editor):
-- CREATE POLICY "Users can upload own audio" ON storage.objects
--     FOR INSERT WITH CHECK (bucket_id = 'generations' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Public read access" ON storage.objects
--     FOR SELECT USING (bucket_id IN ('generations', 'avatars'));

-- ===========================================
-- CLEANUP OLD DATA (run via cron job)
-- ===========================================
-- Delete expired rate limits
-- DELETE FROM rate_limits WHERE expires_at < NOW();

-- Delete old generation history (keep 90 days)
-- DELETE FROM generation_history WHERE created_at < NOW() - INTERVAL '90 days';
