-- =============================================================================
-- STEP 24 — PUT EVERY EXISTING GRANT HOLDER ON PRO
-- =============================================================================
-- 811 people were granted 500,000 credits while left on the FREE tier, which
-- caps them at 10,000 credits/day. Over a 30-day window that is 300,000
-- spendable against 500,000 granted — most of what they were promised is
-- unreachable. This makes good on it.
--
--   Part A — the 674 who have NOT claimed yet: mark their pending grant as a
--            Pro grant, so Pro is applied automatically when they log in.
--   Part B — the 137 who HAVE claimed: put them on Pro now, keeping whatever
--            credits they currently hold, with the plan ending when their
--            existing grant was already due to expire.
--
-- Nobody's credit balance is changed by this step. It only lifts the ceiling
-- so the credits they already have become spendable.
-- Safe to re-run.
-- =============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- A. Pending grants become Pro grants
-- ---------------------------------------------------------------------------
UPDATE public.pending_credit_grants
   SET grant_tier = 'pro'
 WHERE grant_tier IS NULL
   AND NOT expired;

-- ---------------------------------------------------------------------------
-- B. Already-claimed holders get the plan retroactively
-- ---------------------------------------------------------------------------
WITH holders AS (
    SELECT g.claimed_by AS user_id,
           MAX(g.expires_at) AS plan_until
    FROM public.pending_credit_grants g
    WHERE g.claimed
      AND NOT g.expired
      AND g.claimed_by IS NOT NULL
    GROUP BY g.claimed_by
)
UPDATE public.user_profiles up
   SET subscription_tier       = 'pro',
       subscription_status     = 'active',
       subscription_start_date = COALESCE(up.subscription_start_date, NOW()),
       subscription_end_date   = GREATEST(COALESCE(up.subscription_end_date, h.plan_until),
                                          h.plan_until),
       updated_at              = TIMEZONE('utc', NOW())
FROM holders h
WHERE up.id = h.user_id
  -- Never demote anyone already on a higher plan (e.g. a real Advanced buyer).
  AND COALESCE((SELECT sort_order FROM public.subscription_plans WHERE id = up.subscription_tier), 0)
    < (SELECT sort_order FROM public.subscription_plans WHERE id = 'pro');

-- Audit trail: record the upgrade against each account so a support query can
-- explain why someone is on Pro without a Razorpay payment.
INSERT INTO public.credit_transactions
    (user_id, amount, balance_before, balance_after, type, description, reference_type)
SELECT up.id, 0, up.credits_remaining, up.credits_remaining, 'adjustment',
       'Upgraded to Pro plan — course grant (credits unchanged, daily ceiling lifted)',
       'grant'
FROM public.user_profiles up
WHERE up.subscription_tier = 'pro'
  AND EXISTS (
      SELECT 1 FROM public.pending_credit_grants g
      WHERE g.claimed_by = up.id AND g.claimed AND NOT g.expired
  )
  AND NOT EXISTS (
      SELECT 1 FROM public.credit_transactions ct
      WHERE ct.user_id = up.id
        AND ct.description LIKE 'Upgraded to Pro plan — course grant%'
  );

COMMIT;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
SELECT 'pending grants now marked pro' AS check,
       COUNT(*)::text AS result
FROM public.pending_credit_grants WHERE grant_tier = 'pro' AND NOT claimed
UNION ALL
SELECT 'claimed holders now on pro',
       COUNT(DISTINCT up.id)::text
FROM public.user_profiles up
JOIN public.pending_credit_grants g ON g.claimed_by = up.id AND g.claimed AND NOT g.expired
WHERE up.subscription_tier = 'pro'
UNION ALL
SELECT 'claimed holders still NOT on pro (investigate if > 0)',
       COUNT(DISTINCT up.id)::text
FROM public.user_profiles up
JOIN public.pending_credit_grants g ON g.claimed_by = up.id AND g.claimed AND NOT g.expired
WHERE up.subscription_tier <> 'pro'
UNION ALL
SELECT 'their new daily ceiling (chars x generations)',
       (SELECT (max_chars_per_generation * max_generations_per_day)::text
        FROM public.subscription_plans WHERE id = 'pro');
