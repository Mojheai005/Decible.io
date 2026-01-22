-- ===========================================
-- NMM VO APP - Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ===========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- USER PROFILES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    credits_remaining INTEGER DEFAULT 10000,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'enterprise')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- ===========================================
-- SAVED VOICES TABLE (My Voices)
-- ===========================================
CREATE TABLE IF NOT EXISTS saved_voices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    voice_id TEXT NOT NULL,
    voice_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

    -- Prevent duplicate voices per user
    UNIQUE(user_id, voice_id)
);

-- Index for user lookups
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
    duration_seconds FLOAT,
    characters_used INTEGER NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index for user lookups with timestamp
CREATE INDEX IF NOT EXISTS idx_generation_history_user_id ON generation_history(user_id, created_at DESC);

-- ===========================================
-- VOICE CACHE TABLE (Server-side caching)
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
-- STORED PROCEDURES
-- ===========================================

-- Deduct credits from user
CREATE OR REPLACE FUNCTION deduct_credits(user_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE user_profiles
    SET credits_remaining = GREATEST(0, credits_remaining - amount),
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Get slot limit for a tier
CREATE OR REPLACE FUNCTION get_slot_limit(tier TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE tier
        WHEN 'free' THEN 5
        WHEN 'starter' THEN 10
        WHEN 'pro' THEN 20
        WHEN 'enterprise' THEN 50
        ELSE 5
    END;
END;
$$ LANGUAGE plpgsql;

-- Check if user can add a voice
CREATE OR REPLACE FUNCTION can_add_voice(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    slot_limit INTEGER;
    user_tier TEXT;
BEGIN
    -- Get user tier
    SELECT subscription_tier INTO user_tier FROM user_profiles WHERE id = p_user_id;

    -- Get slot limit for tier
    slot_limit := get_slot_limit(user_tier);

    -- Count current saved voices
    SELECT COUNT(*) INTO current_count FROM saved_voices WHERE user_id = p_user_id;

    RETURN current_count < slot_limit;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Policies for saved_voices
CREATE POLICY "Users can view own saved voices" ON saved_voices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved voices" ON saved_voices
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved voices" ON saved_voices
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for generation_history
CREATE POLICY "Users can view own history" ON generation_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON generation_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON generation_history
    FOR DELETE USING (auth.uid() = user_id);

-- Voice cache is public read (no user-specific data)
ALTER TABLE voice_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read voice cache" ON voice_cache FOR SELECT USING (true);

-- ===========================================
-- DEMO USER (for development without auth)
-- ===========================================
-- Uncomment and run manually if you want a demo user:
/*
INSERT INTO user_profiles (id, email, name, credits_remaining, subscription_tier)
VALUES (
    'demo-user',
    'demo@example.com',
    'Demo User',
    10000,
    'free'
) ON CONFLICT (email) DO NOTHING;
*/

-- ===========================================
-- GRANT PERMISSIONS
-- ===========================================
-- If using service role, grant all permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
