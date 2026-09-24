-- =============================================================================
-- STEP 36 — STOP THE MONTHLY RESET FROM DELETING ROLLED-OVER CREDITS
-- =============================================================================
-- WHY THIS IS NOT OPTIONAL, AND WHY IT COMES BEFORE THE REFUND:
--
-- Step 35b stopped credits being taken at expiry. But the monthly reset would
-- have taken them right back. Its current rule is:
--
--     WHEN a live grant exists  -> GREATEST(balance, monthly_allowance)
--     ELSE                      -> monthly_allowance        <-- destroys
--
-- The protection only applies WHILE the grant is unexpired. The moment a grant
-- expires, the EXISTS stops matching and the user falls into the ELSE, so their
-- balance is SET to their tier's allowance — 5,000 for a free user.
--
-- That means, as things stand today:
--   * the 88 people we are about to repay would be reset to 5,000 anyway
--   * the 499 people now protected from the claw-back would still lose
--     everything on their first monthly reset after day 31
--
-- Restoring credits before fixing this would have quietly failed, and we would
-- have been back here in a few weeks wondering why.
--
-- THE FIX: never reduce a balance. GREATEST, unconditionally.
--
--     free user with 3,000 left      -> topped up to 5,000     (as before)
--     free user with 380,000 rolled  -> keeps 380,000          (was: 5,000)
--     Pro user with 100,000 left     -> reset to 500,000       (as before)
--     Pro user with 600,000 bought   -> keeps 600,000          (was: 500,000)
--
-- The allowance becomes a floor instead of a ceiling. Nothing else changes:
-- the monthly usage counter still zeroes and the next reset date still moves.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.reset_monthly_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  UPDATE public.user_profiles up
  SET credits_remaining =
          -- Credits are permanent. The monthly allowance is a FLOOR the user
          -- is topped up to, never a ceiling they are cut down to. The old
          -- version only applied this while a grant was unexpired, so expiry
          -- handed the balance straight to the ELSE branch and deleted it.
          GREATEST(COALESCE(up.credits_remaining, 0), sp.credits_monthly),
      credits_used_this_month = 0,
      credits_reset_date = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
      is_first_month = false,
      updated_at = TIMEZONE('utc', NOW())
  FROM public.subscription_plans sp
  WHERE up.subscription_tier = sp.id
    AND up.credits_reset_date <= NOW()
    AND up.subscription_status = 'active';
END;
$function$;

REVOKE ALL ON FUNCTION public.reset_monthly_credits() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_monthly_credits() FROM anon, authenticated;

COMMIT;


-- ---------- proof, read-only ----------
-- 1) the function no longer contains a bare assignment to the allowance
-- 2) how many people are due a reset soon, i.e. how close we were to losing this
SELECT 1 AS ord, 'FUNCTION' AS section,
       CASE WHEN pg_get_functiondef(p.oid) LIKE '%ELSE sp.credits_monthly%'
            THEN 'STILL DESTRUCTIVE — the ELSE branch survived'
            ELSE 'safe — allowance is now a floor, never a cut' END AS detail,
       CASE WHEN pg_get_functiondef(p.oid) LIKE '%GREATEST%' THEN 'GREATEST present' ELSE 'GREATEST MISSING' END AS value
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'reset_monthly_credits'

UNION ALL
SELECT 2, 'WHO WAS ABOUT TO BE RESET',
       CASE
         WHEN credits_reset_date <= NOW()                      THEN 'a. overdue right now'
         WHEN credits_reset_date <= NOW() + INTERVAL '7 days'  THEN 'b. within 7 days'
         WHEN credits_reset_date <= NOW() + INTERVAL '30 days' THEN 'c. within 30 days'
         ELSE                                                       'd. later'
       END,
       count(*)::text
FROM public.user_profiles
WHERE subscription_status = 'active'
GROUP BY 2, 3,
       CASE
         WHEN credits_reset_date <= NOW()                      THEN 'a. overdue right now'
         WHEN credits_reset_date <= NOW() + INTERVAL '7 days'  THEN 'b. within 7 days'
         WHEN credits_reset_date <= NOW() + INTERVAL '30 days' THEN 'c. within 30 days'
         ELSE                                                       'd. later'
       END

UNION ALL
SELECT 3, 'AT STAKE', 'credits above the 5,000 floor held by free users',
       to_char(COALESCE(SUM(GREATEST(credits_remaining - 5000, 0)), 0), 'FM999,999,999,999')
FROM public.user_profiles
WHERE subscription_tier = 'free'
ORDER BY ord, section, detail;
