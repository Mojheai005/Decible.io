-- ============================================================================
-- COURSE BUYER BONUS — one-time setup
-- Run this ONCE in the Supabase SQL Editor (production project).
--
-- How it works:
--   1. When someone buys the course, their email is added to this table
--      (via POST /api/admin/course-buyers — see README section in PR/commit).
--   2. When a user with that email logs into Decible, the app automatically
--      grants the credits (default 500,000), exactly once, and marks the row.
--   3. No codes, nothing shareable — the bonus is bound to the buyer's email,
--      and Supabase requires email verification to sign in with it.
-- ============================================================================

CREATE TABLE IF NOT EXISTS course_entitlements (
    email TEXT PRIMARY KEY,                    -- buyer email, stored lowercase
    credits INTEGER NOT NULL DEFAULT 500000,   -- bonus size (per-buyer overridable)
    granted BOOLEAN NOT NULL DEFAULT false,    -- set true the moment it is claimed
    granted_at TIMESTAMPTZ,
    granted_user_id UUID,                      -- which Decible account claimed it
    note TEXT,                                 -- optional (e.g. order id, course name)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on, and deliberately NO policies: only the service-role key (the app
-- backend) can read or write this table. Users can never see or query it.
ALTER TABLE course_entitlements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_course_entitlements_granted
    ON course_entitlements(granted) WHERE granted = false;

-- ============================================================================
-- OPTIONAL (recommended): keep the DB pricing catalog in sync with the app's
-- doubled prices. The app charges from code, not from these rows, but if you
-- ever build admin dashboards on the DB, run this too:
-- ============================================================================
-- UPDATE subscription_plans SET price_monthly = price_monthly * 2,
--        price_yearly = price_yearly * 2,
--        topup_rate = topup_rate * 2
--  WHERE id != 'free';
-- UPDATE topup_packages SET price_starter = price_starter * 2,
--        price_creator = price_creator * 2,
--        price_pro = price_pro * 2,
--        price_advanced = price_advanced * 2;
