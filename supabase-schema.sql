-- ============================================================
-- DECIBLE.IO - COMPLETE SUPABASE SCHEMA
-- Clean, minimal, production-ready
-- ============================================================

-- ============================================================
-- STEP 1: DROP ALL EXISTING TABLES (Clean Slate)
-- ============================================================

DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.generation_history CASCADE;
DROP TABLE IF EXISTS public.saved_voices CASCADE;
DROP TABLE IF EXISTS public.payment_orders CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.cloned_voices CASCADE;

-- ============================================================
-- STEP 2: CREATE TABLES
-- ============================================================

-- 1. USER PROFILES
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    subscription_tier TEXT NOT NULL DEFAULT 'free',
    credits_remaining INTEGER NOT NULL DEFAULT 5000,
    credits_used_this_month INTEGER NOT NULL DEFAULT 0,
    credits_reset_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SAVED VOICES
CREATE TABLE public.saved_voices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    voice_id TEXT NOT NULL,
    voice_name TEXT NOT NULL,
    voice_category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, voice_id)
);

-- 3. GENERATION HISTORY
CREATE TABLE public.generation_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT,
    voice_id TEXT NOT NULL,
    voice_name TEXT,
    audio_url TEXT NOT NULL,
    characters_used INTEGER NOT NULL DEFAULT 0,
    credits_used INTEGER NOT NULL DEFAULT 0,
    settings JSONB DEFAULT '{}',
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CREDIT TRANSACTIONS
CREATE TABLE public.credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'generation',
    description TEXT,
    reference_id TEXT,
    reference_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PAYMENT ORDERS
CREATE TABLE public.payment_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    razorpay_order_id TEXT NOT NULL UNIQUE,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    order_type TEXT NOT NULL,
    plan_id TEXT,
    topup_package_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'INR',
    credits INTEGER NOT NULL,
    status TEXT DEFAULT 'created',
    error_code TEXT,
    error_description TEXT,
    credits_added BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RATE LIMITS
CREATE TABLE public.rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    last_reset TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STEP 3: CREATE INDEXES
-- ============================================================

CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_saved_voices_user ON public.saved_voices(user_id);
CREATE INDEX idx_generation_history_user ON public.generation_history(user_id, created_at DESC);
CREATE INDEX idx_credit_transactions_user ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_payment_orders_user ON public.payment_orders(user_id);
CREATE INDEX idx_payment_orders_razorpay ON public.payment_orders(razorpay_order_id);
CREATE INDEX idx_rate_limits_expires ON public.rate_limits(expires_at);

-- ============================================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 5: CREATE RLS POLICIES
-- ============================================================

-- USER PROFILES
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Service can insert profiles" ON public.user_profiles
    FOR INSERT WITH CHECK (true);

-- SAVED VOICES
CREATE POLICY "Users can view own saved voices" ON public.saved_voices
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved voices" ON public.saved_voices
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved voices" ON public.saved_voices
    FOR DELETE USING (auth.uid() = user_id);

-- GENERATION HISTORY
CREATE POLICY "Users can view own history" ON public.generation_history
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert history" ON public.generation_history
    FOR INSERT WITH CHECK (true);

-- CREDIT TRANSACTIONS
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert transactions" ON public.credit_transactions
    FOR INSERT WITH CHECK (true);

-- PAYMENT ORDERS
CREATE POLICY "Users can view own orders" ON public.payment_orders
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage orders" ON public.payment_orders
    FOR ALL WITH CHECK (true);

-- RATE LIMITS (service role only)
CREATE POLICY "Service can manage rate limits" ON public.rate_limits
    FOR ALL WITH CHECK (true);

-- ============================================================
-- STEP 6: CREATE STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-generations', 'audio-generations', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Service can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read audio" ON storage.objects;

CREATE POLICY "Service can upload audio" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'audio-generations');
CREATE POLICY "Anyone can read audio" ON storage.objects
    FOR SELECT USING (bucket_id = 'audio-generations');

-- ============================================================
-- STEP 7: AUTO-UPDATE TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.user_profiles;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- DONE! Tables created:
-- 1. user_profiles      - User info, subscription, credits
-- 2. saved_voices       - My Voices feature
-- 3. generation_history - TTS generation records
-- 4. credit_transactions- Credit audit log
-- 5. payment_orders     - Razorpay payments
-- 6. rate_limits        - API rate limiting
-- Storage: audio-generations bucket (public)
-- ============================================================
