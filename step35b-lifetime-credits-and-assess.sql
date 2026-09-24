-- =============================================================================
-- STEP 35b — MAKE CREDITS PERMANENT, THEN MEASURE THE DAMAGE
-- =============================================================================
-- The cron table is not writable from the Supabase SQL editor, so we are not
-- pausing the job. We are doing something better: making the job harmless.
--
-- expire_credit_grants() is replaced so that it ENDS THE SUBSCRIPTION and
-- NEVER TOUCHES THE BALANCE. The hourly job can keep running exactly as it is
-- — from the moment this commits, a grant reaching day 31 drops the person to
-- the free plan and leaves every credit they have not spent.
--
-- This is the end state you asked for, so there is nothing to undo later.
--
-- What is deliberately NOT changed:
--   * grants still expire on schedule — the PLAN is still 30 days
--   * a real Razorpay subscription still protects the tier
--   * the return signature is unchanged, so the cron job keeps working
--     (credits_removed will simply always be 0 from now on)
--
-- Part 2 is read-only and tells us what to repair next. Paste its output.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.expire_credit_grants()
RETURNS TABLE (grants_expired INTEGER, credits_removed BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    g            RECORD;
    v_balance    INTEGER;
    v_count      INTEGER := 0;
    v_still_live BOOLEAN;
    v_paid_until TIMESTAMPTZ;
BEGIN
    FOR g IN
        SELECT id, claimed_by, claimed_at, credits, batch_key, grant_tier
        FROM public.pending_credit_grants
        WHERE claimed AND NOT expired AND expires_at <= NOW()
        ORDER BY claimed_at
        FOR UPDATE SKIP LOCKED
    LOOP
        SELECT credits_remaining, subscription_end_date
          INTO v_balance, v_paid_until
        FROM public.user_profiles
        WHERE id = g.claimed_by
        FOR UPDATE;

        IF NOT FOUND THEN
            UPDATE public.pending_credit_grants
               SET expired = true, expired_at = NOW(), credits_clawed_back = 0
             WHERE id = g.id;
            v_count := v_count + 1;
            CONTINUE;
        END IF;

        v_balance := COALESCE(v_balance, 0);

        -- ==========================================================
        -- CREDITS ARE NOW PERMANENT.
        -- The previous version computed how much of the grant was
        -- unspent and subtracted it here. That is the behaviour the
        -- customers were complaining about, and it is gone. Credits
        -- a buyer has not used roll over to the free plan with them
        -- and stay theirs.
        -- ==========================================================
        UPDATE public.pending_credit_grants
           SET expired = true, expired_at = NOW(), credits_clawed_back = 0
         WHERE id = g.id;

        -- The PLAN still ends. Drop to free only when no other granted plan
        -- is still running AND no real purchase is paying for the tier.
        IF g.grant_tier IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.pending_credit_grants
                WHERE claimed_by = g.claimed_by
                  AND grant_tier IS NOT NULL
                  AND NOT expired
                  AND id <> g.id
            ) INTO v_still_live;

            IF NOT v_still_live AND (v_paid_until IS NULL OR v_paid_until <= NOW()) THEN
                UPDATE public.user_profiles
                   SET subscription_tier     = 'free',
                       subscription_status   = 'active',
                       subscription_end_date = NULL,
                       updated_at            = TIMEZONE('utc', NOW())
                 WHERE id = g.claimed_by;

                INSERT INTO public.credit_transactions
                    (user_id, amount, balance_before, balance_after, type,
                     description, reference_id, reference_type)
                VALUES
                    (g.claimed_by, 0, v_balance, v_balance, 'adjustment',
                     'Granted ' || g.grant_tier || ' plan ended — moved to free. '
                       || 'Credits kept: ' || v_balance,
                     g.id::TEXT, 'grant');
            END IF;
        END IF;

        v_count := v_count + 1;
    END LOOP;

    -- Always 0 now. Kept in the signature so the cron job and any caller
    -- that reads the result keep working untouched.
    RETURN QUERY SELECT v_count, 0::BIGINT;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_credit_grants() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_credit_grants() FROM anon, authenticated;

COMMIT;


-- ---------- PART 2: read-only assessment ----------
WITH clawed AS (
    SELECT claimed_by, credits_clawed_back, expired_at
    FROM public.pending_credit_grants
    WHERE expired AND COALESCE(credits_clawed_back, 0) > 0
),
at_risk AS (
    SELECT claimed_by, expires_at,
           CASE
             WHEN expires_at <= NOW()                      THEN 'a. overdue — next cron tick'
             WHEN expires_at <= NOW() + INTERVAL '3 days'  THEN 'b. within 3 days'
             WHEN expires_at <= NOW() + INTERVAL '7 days'  THEN 'c. within 7 days'
             WHEN expires_at <= NOW() + INTERVAL '30 days' THEN 'd. within 30 days'
             ELSE                                               'e. more than 30 days away'
           END AS bucket
    FROM public.pending_credit_grants
    WHERE claimed AND NOT expired
),
two AS (
    SELECT e.email, g.id AS grant_id, g.credits, g.claimed, g.expired,
           g.credits_clawed_back, g.expires_at,
           p.id AS profile_id, p.credits_remaining, p.subscription_tier
    FROM (VALUES ('kasasrujana100@gmail.com'), ('ramdas.diwakar@gmail.com')) AS e(email)
    LEFT JOIN public.pending_credit_grants g ON g.email = e.email
    LEFT JOIN public.user_profiles        p ON LOWER(p.email) = e.email
)
SELECT 1 AS ord, 'A. ALREADY LOST' AS section, 'people affected' AS detail,
       count(DISTINCT claimed_by)::text AS value FROM clawed
UNION ALL
SELECT 1, 'A. ALREADY LOST', 'credits taken back (fully restorable)',
       to_char(COALESCE(sum(credits_clawed_back), 0), 'FM999,999,999,999') FROM clawed
UNION ALL
SELECT 1, 'A. ALREADY LOST', 'grants involved', count(*)::text FROM clawed
UNION ALL
SELECT 1, 'A. ALREADY LOST', 'window',
       COALESCE(to_char(min(expired_at), 'DD Mon') || ' to ' || to_char(max(expired_at), 'DD Mon'), 'none')
FROM clawed
UNION ALL
SELECT 2, 'B. STILL LIVE (now safe)', bucket, count(*)::text
FROM at_risk GROUP BY bucket
UNION ALL
SELECT 2, 'B. STILL LIVE (now safe)', 'zz. distinct people',
       count(DISTINCT claimed_by)::text FROM at_risk
UNION ALL
SELECT 3, 'C. NEVER CLAIMED', 'grants waiting for a signup', count(*)::text
FROM public.pending_credit_grants WHERE NOT claimed
UNION ALL
SELECT 3, 'C. NEVER CLAIMED', 'total grants ever issued', count(*)::text
FROM public.pending_credit_grants
UNION ALL
SELECT 4, 'D. YOUR TWO EMAILS',
       email || ' -> ' ||
       CASE
         WHEN grant_id IS NULL THEN 'NO GRANT EVER'
         WHEN expired AND COALESCE(credits_clawed_back,0) > 0
              THEN 'claimed, EXPIRED, lost ' || credits_clawed_back
         WHEN expired THEN 'claimed, expired, nothing left to take'
         WHEN claimed THEN 'claimed, live until ' || to_char(expires_at, 'DD Mon YYYY')
         ELSE 'granted, NOT yet claimed'
       END,
       CASE WHEN profile_id IS NULL THEN 'no Decible account'
            ELSE 'balance ' || COALESCE(credits_remaining,0) || ', tier ' || COALESCE(subscription_tier,'?')
       END
FROM two
UNION ALL
SELECT 5, 'E. COULD SILENTLY UNDO EVERYTHING', p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'reset_monthly_credits'
ORDER BY ord, section, detail;
