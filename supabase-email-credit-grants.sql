-- =============================================================================
-- DECIBLE.IO — EMAIL-BASED CREDIT GRANTS  (AS DEPLOYED 2026-08-11)
-- =============================================================================
-- This file is a RECORD of what was actually applied to production, in order.
-- It is NOT a script to run top-to-bottom. Steps 5 and 6 have already executed
-- and re-running them is either a no-op or wrong. Read before touching.
--
-- WHAT IT DOES
--   Grants credits addressed by EMAIL rather than user id, so people who have
--   not signed up yet are covered. A grant is claimed automatically when the
--   person signs up or logs in, once, and expires 30 days after THEY claim it
--   (a rolling per-person window, not a fixed calendar date).
--
-- LIVE STATE AT DEPLOY
--   batch_key 'enroll_2026_08_11' — 213 emails x 500,000 credits
--   20 claimed on day one (10,000,000), 193 awaiting signup (96,500,000)
--   All day-one grants expire 2026-09-10.
--
-- PRODUCTION FACTS THAT SHAPED THIS DESIGN (verified, not assumed)
--   * There are NO triggers on auth.users. handle_new_user() from
--     supabase-schema-production.sql was never installed. Profiles are
--     created only by application code:
--         src/app/auth/callback/route.ts
--         src/app/api/user/profile/route.ts
--     => the user_profiles INSERT trigger is the PRIMARY signup hook here,
--        not the safety net it would be on the documented schema.
--   * 9,117 auth.users vs 8,986 user_profiles — 131 accounts have no profile
--     row. claim_credit_grants() returns 0 for them and leaves the grant
--     pending rather than losing it.
--   * credits columns are all `integer` (ceiling 2,147,483,647). 500,000 is
--     fine. Anything above ~2.1 billion needs a BIGINT migration first.
--   * The live database HAS DRIFTED from supabase-schema-production.sql.
--     Always read the live definition with pg_get_functiondef() before
--     replacing a function. Known drift:
--         add_credits           — live has DEFAULTs the schema file lacks
--         reset_monthly_credits — live is SECURITY DEFINER, schema file is not
-- =============================================================================


-- =============================================================================
-- STEP 2 — GRANT LEDGER                                          [APPLIED]
-- =============================================================================
CREATE TABLE public.pending_credit_grants (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          TEXT    NOT NULL,
    credits        INTEGER NOT NULL CHECK (credits > 0),
    batch_key      TEXT    NOT NULL DEFAULT 'default',
    note           TEXT,
    valid_for_days INTEGER NOT NULL DEFAULT 30 CHECK (valid_for_days > 0),

    -- expires_at is stamped at claim time as claimed_at + valid_for_days, so
    -- each person gets a full window starting when they actually receive it.
    claimed    BOOLEAN NOT NULL DEFAULT false,
    claimed_at TIMESTAMPTZ,
    claimed_by UUID,
    expires_at TIMESTAMPTZ,

    expired             BOOLEAN NOT NULL DEFAULT false,
    expired_at          TIMESTAMPTZ,
    credits_clawed_back INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT grants_email_is_lower CHECK (email = LOWER(email)),
    CONSTRAINT grants_claim_coherent CHECK (
        (NOT claimed AND claimed_at IS NULL AND claimed_by IS NULL AND expires_at IS NULL)
        OR
        (claimed AND claimed_at IS NOT NULL AND claimed_by IS NOT NULL AND expires_at IS NOT NULL)
    ),
    CONSTRAINT grants_expiry_coherent CHECK (
        NOT expired OR (claimed AND expired_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX grants_email_batch_uq
    ON public.pending_credit_grants (email, batch_key);
CREATE INDEX grants_unclaimed_idx
    ON public.pending_credit_grants (email) WHERE NOT claimed;
CREATE INDEX grants_due_idx
    ON public.pending_credit_grants (expires_at) WHERE claimed AND NOT expired;
CREATE INDEX grants_claimed_by_idx
    ON public.pending_credit_grants (claimed_by) WHERE claimed_by IS NOT NULL;

-- RLS on with zero policies: only service_role and SECURITY DEFINER functions
-- can reach this. Users cannot see the list or insert grants for themselves.
ALTER TABLE public.pending_credit_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pending_credit_grants FROM anon, authenticated;

COMMENT ON TABLE public.pending_credit_grants IS
    'Email-addressed credit grants. Claimed on signup/login, expire N days after claim.';


-- =============================================================================
-- STEP 3 — CLAIM + EXPIRY LOGIC                                  [APPLIED]
-- =============================================================================
CREATE OR REPLACE FUNCTION public.claim_credit_grants(
    p_user_id UUID,
    p_email   TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_email  TEXT    := LOWER(BTRIM(COALESCE(p_email, '')));
    v_before INTEGER;
    v_after  INTEGER;
    v_total  INTEGER := 0;
    g        RECORD;
BEGIN
    IF p_user_id IS NULL OR v_email = '' THEN
        RETURN 0;
    END IF;

    -- Cheap guard; most logins have nothing pending. Index-only on
    -- grants_unclaimed_idx.
    IF NOT EXISTS (
        SELECT 1 FROM public.pending_credit_grants
        WHERE email = v_email AND NOT claimed
    ) THEN
        RETURN 0;
    END IF;

    -- The profile must exist before we can credit it. This app creates
    -- profiles from application code, sometimes after the auth row, so if it
    -- is not here yet we leave the grant unclaimed for the user_profiles
    -- insert trigger or the next login. Nothing is lost, nothing double-grants.
    SELECT credits_remaining INTO v_before
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    v_before := COALESCE(v_before, 0);
    v_after  := v_before;

    -- Atomic claim: the UPDATE takes the row lock and flips `claimed` in one
    -- statement, so a concurrent login re-evaluates NOT claimed and finds
    -- nothing. The expiry clock starts NOW, per person.
    FOR g IN
        UPDATE public.pending_credit_grants gr
           SET claimed    = true,
               claimed_at = NOW(),
               claimed_by = p_user_id,
               expires_at = NOW() + make_interval(days => gr.valid_for_days)
         WHERE gr.email = v_email
           AND NOT gr.claimed
        RETURNING gr.id, gr.credits, gr.batch_key, gr.expires_at
    LOOP
        v_after := v_after + g.credits;
        v_total := v_total + g.credits;

        INSERT INTO public.credit_transactions
            (user_id, amount, balance_before, balance_after,
             type, description, reference_id, reference_type)
        VALUES
            (p_user_id, g.credits, v_after - g.credits, v_after, 'bonus',
             'Email grant (' || g.batch_key || '), expires '
                 || TO_CHAR(g.expires_at AT TIME ZONE 'UTC', 'DD Mon YYYY'),
             g.id::TEXT, 'grant');
    END LOOP;

    IF v_total > 0 THEN
        UPDATE public.user_profiles
           SET credits_remaining = v_after,
               updated_at        = TIMEZONE('utc', NOW())
         WHERE id = p_user_id;
    END IF;

    RETURN v_total;
END;
$$;


-- Clawback rule: granted credits are treated as SPENT FIRST, so only the
-- unused remainder is reclaimed. Credits the user paid for, or held before
-- the grant, are never touched.
--
--     spent_since_claim = generation spend since claimed_at
--     grant_consumed    = LEAST(granted, spent_since_claim)
--     claw_back         = granted - grant_consumed
--     new_balance       = GREATEST(0, balance - claw_back)
--
-- Verified against a rollback-wrapped live test 2026-08-11:
--     505,000 balance, 0 spent -> removed 500,000 -> 5,000 left. Correct.
--
-- KNOWN LIMITATION: spend is attributed per grant. Exact when a user holds
-- one grant. If overlapping batches are ever issued, a user holding two at
-- once may retain slightly more than intended — the error always favours the
-- user, never the business.
CREATE OR REPLACE FUNCTION public.expire_credit_grants()
RETURNS TABLE (grants_expired INTEGER, credits_removed BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    g          RECORD;
    v_spent    BIGINT;
    v_consumed INTEGER;
    v_clawback INTEGER;
    v_balance  INTEGER;
    v_new      INTEGER;
    v_removed  INTEGER;
    v_count    INTEGER := 0;
    v_total    BIGINT  := 0;
BEGIN
    FOR g IN
        SELECT id, claimed_by, claimed_at, credits, batch_key
        FROM public.pending_credit_grants
        WHERE claimed AND NOT expired AND expires_at <= NOW()
        ORDER BY claimed_at
        FOR UPDATE SKIP LOCKED
    LOOP
        SELECT credits_remaining INTO v_balance
        FROM public.user_profiles
        WHERE id = g.claimed_by
        FOR UPDATE;

        IF NOT FOUND THEN
            -- Profile deleted since claim. Close it out; nothing to take.
            UPDATE public.pending_credit_grants
               SET expired = true, expired_at = NOW(), credits_clawed_back = 0
             WHERE id = g.id;
            v_count := v_count + 1;
            CONTINUE;
        END IF;

        -- use_credits() logs generation spend as a NEGATIVE amount.
        SELECT COALESCE(SUM(-amount), 0) INTO v_spent
        FROM public.credit_transactions
        WHERE user_id = g.claimed_by
          AND type    = 'generation'
          AND created_at >= g.claimed_at;

        v_consumed := LEAST(g.credits, GREATEST(v_spent, 0))::INTEGER;
        v_clawback := g.credits - v_consumed;

        v_new     := GREATEST(0, v_balance - v_clawback);
        v_removed := v_balance - v_new;

        IF v_removed > 0 THEN
            UPDATE public.user_profiles
               SET credits_remaining = v_new,
                   updated_at        = TIMEZONE('utc', NOW())
             WHERE id = g.claimed_by;

            INSERT INTO public.credit_transactions
                (user_id, amount, balance_before, balance_after,
                 type, description, reference_id, reference_type)
            VALUES
                (g.claimed_by, -v_removed, v_balance, v_new, 'expiry',
                 'Expired unused grant credits (' || g.batch_key || ')',
                 g.id::TEXT, 'grant');
        END IF;

        UPDATE public.pending_credit_grants
           SET expired = true, expired_at = NOW(), credits_clawed_back = v_removed
         WHERE id = g.id;

        v_count := v_count + 1;
        v_total := v_total + v_removed;
    END LOOP;

    RETURN QUERY SELECT v_count, v_total;
END;
$$;


-- NOT OPTIONAL. Postgres grants EXECUTE to PUBLIC by default and PostgREST
-- exposes any executable public-schema function as a REST endpoint. Without
-- this, a logged-in user could POST to /rest/v1/rpc/claim_credit_grants with
-- their own id and someone else's email and steal that grant.
REVOKE ALL ON FUNCTION public.claim_credit_grants(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_credit_grants(UUID, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_credit_grants()          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_credit_grants()          FROM anon, authenticated;


-- =============================================================================
-- STEP 4 — TRIGGERS                                              [APPLIED]
-- =============================================================================
-- These MUST NOT raise. An unhandled exception would abort the surrounding
-- signup or login transaction and lock people out of the product.
CREATE OR REPLACE FUNCTION public.tg_claim_grants_from_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    BEGIN
        PERFORM public.claim_credit_grants(NEW.id, NEW.email);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'claim_credit_grants failed for auth user %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_claim_grants_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    BEGIN
        PERFORM public.claim_credit_grants(NEW.id, NEW.email);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'claim_credit_grants failed for profile %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

-- (1) PRIMARY PATH FOR NEW SIGNUPS on this database, because profiles are
--     created by application code rather than a DB trigger.
DROP TRIGGER IF EXISTS zz_claim_grants_on_profile_insert ON public.user_profiles;
CREATE TRIGGER zz_claim_grants_on_profile_insert
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_claim_grants_from_profile();

-- (2) PRIMARY PATH FOR EXISTING USERS. GoTrue stamps last_sign_in_at on every
--     sign-in (password and OAuth alike).
--     IS DISTINCT FROM is required, not <>. On a first-ever login the old
--     value is NULL, and `NULL <> ts` evaluates to NULL, so a plain <> would
--     never fire. This was hit for real by rashiteckwani@yahoo.in.
DROP TRIGGER IF EXISTS zz_claim_grants_on_login ON auth.users;
CREATE TRIGGER zz_claim_grants_on_login
    AFTER UPDATE OF last_sign_in_at ON auth.users
    FOR EACH ROW
    WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at)
    EXECUTE FUNCTION public.tg_claim_grants_from_auth_user();

-- (3) Currently a no-op — no profile exists when the auth row is inserted, so
--     this returns 0 every time. Kept so that if handle_new_user() is ever
--     installed as the schema file intends, the grant lands during signup.
--     The zz_ prefix matters then: same-event triggers fire alphabetically and
--     this must run AFTER on_auth_user_created creates the profile.
DROP TRIGGER IF EXISTS zz_claim_grants_on_signup ON auth.users;
CREATE TRIGGER zz_claim_grants_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_claim_grants_from_auth_user();


-- =============================================================================
-- STEP 5 — LOAD THE EMAIL LIST                          [APPLIED — see file]
-- =============================================================================
-- The 213 addresses live in step5-load-grants.sql (generated from
-- "Full enrollments uptill 11 August 1 PM - Sheet1.csv": 224 rows -> 8 N/A
-- placeholders dropped, 3 duplicates removed).
--
-- To issue a NEW batch later, copy that file and change batch_key. Never
-- reuse 'enroll_2026_08_11' — the unique index on (email, batch_key) would
-- silently skip every row.
--
-- OUTSTANDING: two addresses have typo'd domains and can never match a real
-- account, so their grants sit pending forever. Harmless. Fix once the real
-- spellings are confirmed:
/*
UPDATE public.pending_credit_grants
SET email = 'CORRECTED@gmail.com'
WHERE email = 'mhnkhandelwal@gmail.col' AND NOT claimed;

UPDATE public.pending_credit_grants
SET email = 'CORRECTED@gmail.com'
WHERE email = 'snehaljadho07@gmai.com' AND NOT claimed;
*/


-- =============================================================================
-- STEP 6 — BACKFILL EXISTING USERS                               [APPLIED]
-- =============================================================================
-- Credited the 20 enrollees who already had accounts. Safe to re-run: the
-- NOT g.claimed guard makes it a no-op for anyone already done. Re-run this
-- after correcting the typo'd addresses above.
/*
SELECT u.email,
       public.claim_credit_grants(u.id, u.email) AS credits_granted
FROM auth.users u
WHERE u.deleted_at IS NULL
  AND EXISTS (
        SELECT 1 FROM public.pending_credit_grants g
        WHERE g.email = LOWER(BTRIM(u.email)) AND NOT g.claimed
      )
ORDER BY u.email;
*/


-- =============================================================================
-- STEP 8 — EXPIRY SCHEDULE                                       [APPLIED]
-- =============================================================================
-- Hourly at :15, not daily: grants expire at a precise timestamp, so a daily
-- job could leave up to 24h of overrun. Costs nothing when nothing is due —
-- empty index scan on grants_due_idx.
/*
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;
SELECT cron.schedule(
    'expire-credit-grants', '15 * * * *',
    $$SELECT public.expire_credit_grants();$$
);
*/

-- Monitor:
--   SELECT d.status, d.start_time, d.return_message
--   FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
--   WHERE j.jobname = 'expire-credit-grants'
--   ORDER BY d.start_time DESC LIMIT 5;
-- NOTE: job_run_details keys on jobid, not jobname. Join through cron.job.


-- =============================================================================
-- STEP 9 — PROTECT GRANTS FROM THE MONTHLY RESET                 [APPLIED]
-- =============================================================================
-- reset_monthly_credits() did `SET credits_remaining = sp.credits_monthly` —
-- an overwrite, not a top-up. Any granted user would drop from 505,000 to
-- 5,000. It is NOT scheduled, but pg_cron is now installed, so it went from
-- impossible to one command away.
--
-- The patched version is live; see it with pg_get_functiondef(). Holders of an
-- UNEXPIRED grant keep GREATEST(balance, plan_allowance); everyone else is
-- unchanged. `AND NOT g.expired` matters: protection lifts automatically once
-- a grant expires, so users are not permanently exempt from monthly resets.
--
-- This function remains UNSCHEDULED. If you ever schedule it, test against a
-- granted account first.


-- =============================================================================
-- OPERATIONS
-- =============================================================================
-- Current state:
/*
SELECT batch_key,
       COUNT(*)                                        AS total,
       COUNT(*) FILTER (WHERE claimed)                 AS claimed,
       COUNT(*) FILTER (WHERE NOT claimed)             AS awaiting_signup,
       COUNT(*) FILTER (WHERE expired)                 AS expired,
       SUM(credits) FILTER (WHERE claimed)             AS credits_handed_out,
       SUM(credits) FILTER (WHERE NOT claimed)         AS credits_committed,
       SUM(credits_clawed_back)                        AS credits_reclaimed
FROM public.pending_credit_grants
GROUP BY batch_key ORDER BY batch_key;
*/

-- Full audit trail — every grant and expiry is a real ledger entry:
/*
SELECT ct.created_at, up.email, ct.type, ct.amount,
       ct.balance_before, ct.balance_after, ct.description
FROM public.credit_transactions ct
JOIN public.user_profiles up ON up.id = ct.user_id
WHERE ct.reference_type = 'grant'
ORDER BY ct.created_at DESC;
*/

-- KILL SWITCH — stop future auto-granting. Credits already given are kept.
/*
DROP TRIGGER IF EXISTS zz_claim_grants_on_login          ON auth.users;
DROP TRIGGER IF EXISTS zz_claim_grants_on_signup         ON auth.users;
DROP TRIGGER IF EXISTS zz_claim_grants_on_profile_insert ON public.user_profiles;
*/

-- Cancel unclaimed grants in a batch:
/*
DELETE FROM public.pending_credit_grants
WHERE NOT claimed AND batch_key = 'enroll_2026_08_11';
*/

-- Pause expiry without dropping the job:
/*
UPDATE cron.job SET active = false WHERE jobname = 'expire-credit-grants';
*/
