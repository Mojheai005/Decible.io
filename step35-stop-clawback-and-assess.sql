-- =============================================================================
-- STEP 35 — PAUSE THE EXPIRY JOB, THEN MEASURE THE DAMAGE
-- =============================================================================
-- WHY THIS FIRST, AND WHY IT IS TWO THINGS IN ONE FILE:
--
-- `expire_credit_grants()` currently reclaims unspent granted credits. The
-- pg_cron job runs EVERY HOUR at :15, so for as long as we are talking, more
-- people keep losing credits they were told they had.
--
-- Part 1 pauses that job. It takes effect immediately, changes no data, and is
-- reversible with one line (it is re-enabled at the end of the real fix). It
-- buys us the time to do the rest carefully instead of racing the clock.
--
-- Part 2 is READ-ONLY. It answers the four things the fix depends on:
--   A. how many people already lost credits, and exactly how many
--   B. how many are about to, and when
--   C. the live definition of reset_monthly_credits() -- this one matters more
--      than it looks. If the monthly reset SETS a free user's balance to 5,000
--      rather than topping it up, it will delete every restored credit within
--      a month and we will be back here. It must be read before, not after.
--   D. the two addresses you gave me
--
-- Nothing here is destructive. Run it and paste the output.
-- =============================================================================

-- ---------- PART 1: stop the bleeding ----------
DO $$
BEGIN
    IF to_regclass('cron.job') IS NOT NULL THEN
        UPDATE cron.job
           SET active = false
         WHERE jobname = 'expire-credit-grants';
        RAISE NOTICE 'expiry cron paused (rows affected: %)', (
            SELECT count(*) FROM cron.job
            WHERE jobname = 'expire-credit-grants' AND NOT active
        );
    ELSE
        RAISE NOTICE 'pg_cron not installed here - nothing to pause';
    END IF;
END $$;


-- ---------- PART 2: read-only assessment ----------
WITH clawed AS (
    SELECT claimed_by, credits_clawed_back, batch_key, expired_at
    FROM public.pending_credit_grants
    WHERE expired AND COALESCE(credits_clawed_back, 0) > 0
),
at_risk AS (
    SELECT id, claimed_by, credits, expires_at
    FROM public.pending_credit_grants
    WHERE claimed AND NOT expired
),
two AS (
    SELECT e.email,
           g.id                AS grant_id,
           g.credits,
           g.claimed,
           g.expired,
           g.credits_clawed_back,
           g.expires_at,
           g.batch_key,
           p.id                AS profile_id,
           p.credits_remaining,
           p.subscription_tier
    FROM (VALUES ('kasasrujana100@gmail.com'), ('ramdas.diwakar@gmail.com')) AS e(email)
    LEFT JOIN public.pending_credit_grants g ON g.email = e.email
    LEFT JOIN public.user_profiles        p ON LOWER(p.email) = e.email
)
SELECT 1 AS ord, 'A. ALREADY LOST' AS section,
       'people affected' AS detail,
       count(DISTINCT claimed_by)::text AS value
FROM clawed
UNION ALL
SELECT 1, 'A. ALREADY LOST', 'credits taken back (restorable in full)',
       to_char(COALESCE(sum(credits_clawed_back), 0), 'FM999,999,999,999')
FROM clawed
UNION ALL
SELECT 1, 'A. ALREADY LOST', 'grants involved', count(*)::text FROM clawed
UNION ALL
SELECT 1, 'A. ALREADY LOST', 'earliest / latest expiry',
       COALESCE(to_char(min(expired_at), 'DD Mon') || ' - ' || to_char(max(expired_at), 'DD Mon'), 'none')
FROM clawed

UNION ALL
SELECT 2, 'B. ABOUT TO LOSE', 'grants still running', count(*)::text FROM at_risk
UNION ALL
SELECT 2, 'B. ABOUT TO LOSE', 'people holding them', count(DISTINCT claimed_by)::text FROM at_risk
UNION ALL
SELECT 2, 'B. ABOUT TO LOSE',
       CASE
         WHEN expires_at <= NOW() THEN 'OVERDUE - would expire on the next cron tick'
         WHEN expires_at <= NOW() + INTERVAL '3 days'  THEN 'expires within 3 days'
         WHEN expires_at <= NOW() + INTERVAL '7 days'  THEN 'expires within 7 days'
         WHEN expires_at <= NOW() + INTERVAL '30 days' THEN 'expires within 30 days'
         ELSE 'expires later than 30 days'
       END,
       count(*)::text
FROM at_risk
GROUP BY 1, 2,
       CASE
         WHEN expires_at <= NOW() THEN 'OVERDUE - would expire on the next cron tick'
         WHEN expires_at <= NOW() + INTERVAL '3 days'  THEN 'expires within 3 days'
         WHEN expires_at <= NOW() + INTERVAL '7 days'  THEN 'expires within 7 days'
         WHEN expires_at <= NOW() + INTERVAL '30 days' THEN 'expires within 30 days'
         ELSE 'expires later than 30 days'
       END

UNION ALL
SELECT 3, 'C. NEVER CLAIMED', 'grants still waiting for a signup', count(*)::text
FROM public.pending_credit_grants WHERE NOT claimed

UNION ALL
SELECT 4, 'D. YOUR TWO EMAILS',
       email || ' -> ' ||
       CASE
         WHEN grant_id IS NULL THEN 'NO GRANT EVER'
         WHEN expired AND COALESCE(credits_clawed_back,0) > 0
              THEN 'claimed, EXPIRED, lost ' || credits_clawed_back || ' credits'
         WHEN expired THEN 'claimed, expired, nothing was left to take'
         WHEN claimed THEN 'claimed, still live until ' || to_char(expires_at, 'DD Mon YYYY')
         ELSE 'granted but NOT yet claimed'
       END,
       CASE
         WHEN profile_id IS NULL THEN 'no account on Decible'
         ELSE 'balance ' || COALESCE(credits_remaining, 0) || ', tier ' || COALESCE(subscription_tier, '?')
       END
FROM two

UNION ALL
SELECT 5, 'E. THE FUNCTION THAT COULD UNDO ALL OF THIS', p.proname,
       pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('reset_monthly_credits')

ORDER BY ord, section, detail;
