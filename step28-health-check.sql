-- =============================================================================
-- STEP 28 — WHY CAN'T PEOPLE GENERATE?   (READ ONLY)
-- =============================================================================
-- All three TTS providers tested healthy on 2026-09-16, so the failures are
-- almost certainly account-side. Prime suspect: the 30-day grants issued from
-- 11 Aug started expiring on 10 Sep, dropping people back to the free tier
-- (1,000 chars/generation, 10/day) — which feels exactly like "it stopped
-- working".
-- Run each block separately; the editor only shows the last result.
-- =============================================================================

-- 1. HAS THE EXPIRY WAVE STARTED, AND HOW BIG IS IT?
SELECT expired_at::date            AS day,
       COUNT(*)                    AS grants_expired,
       COUNT(DISTINCT claimed_by)  AS people,
       SUM(credits_clawed_back)    AS credits_reclaimed
FROM public.pending_credit_grants
WHERE expired
GROUP BY 1
ORDER BY 1;

-- 2. WHO IS ON FREE RIGHT NOW BUT HELD A GRANT? (the likely complainers)
SELECT COUNT(*) AS people_dropped_to_free,
       SUM(p.credits_remaining) AS credits_they_have_left
FROM public.user_profiles p
WHERE p.subscription_tier = 'free'
  AND EXISTS (SELECT 1 FROM public.pending_credit_grants g
              WHERE g.claimed_by = p.id AND g.expired);

-- 3. WHAT IS STILL COMING? (expiries due in the next 14 days)
SELECT expires_at::date AS due, COUNT(*) AS grants, COUNT(DISTINCT claimed_by) AS people
FROM public.pending_credit_grants
WHERE claimed AND NOT expired AND expires_at <= NOW() + INTERVAL '14 days'
GROUP BY 1 ORDER BY 1;

-- 4. IS ANYTHING ACTUALLY FAILING IN GENERATION?
--    Refunds mean a generation failed; PENDING_REFUND means even the refund failed.
SELECT date_trunc('day', created_at)::date AS day,
       COUNT(*) FILTER (WHERE type = 'generation') AS generations,
       COUNT(*) FILTER (WHERE type = 'refund')     AS refunds,
       ROUND(100.0 * COUNT(*) FILTER (WHERE type = 'refund')
             / NULLIF(COUNT(*) FILTER (WHERE type = 'generation'), 0), 1) AS refund_pct
FROM public.credit_transactions
WHERE created_at > NOW() - INTERVAL '14 days'
GROUP BY 1 ORDER BY 1 DESC;

-- 5. FAILED REFUNDS — real money stuck. Should be zero.
SELECT COUNT(*) AS pending_refund_markers
FROM public.generation_history
WHERE text LIKE 'PENDING_REFUND:%';

-- 6. ARE PEOPLE HITTING THE FREE-TIER DAILY CAP?
SELECT COUNT(*) AS free_users_at_daily_cap
FROM public.user_profiles
WHERE subscription_tier = 'free'
  AND last_generation_date = CURRENT_DATE
  AND generations_today >= 10;
