-- =============================================================================
-- STEP 28b — ONE QUERY, ONE RESULT TABLE. Run it all at once.
-- =============================================================================
WITH expiry_by_day AS (
  SELECT expired_at::date AS d, COUNT(*) n, COUNT(DISTINCT claimed_by) p,
         COALESCE(SUM(credits_clawed_back),0) c
  FROM public.pending_credit_grants WHERE expired GROUP BY 1
),
upcoming AS (
  SELECT expires_at::date AS d, COUNT(*) n
  FROM public.pending_credit_grants
  WHERE claimed AND NOT expired AND expires_at <= NOW() + INTERVAL '14 days'
  GROUP BY 1
),
gen AS (
  SELECT created_at::date AS d,
         COUNT(*) FILTER (WHERE type='generation') g,
         COUNT(*) FILTER (WHERE type='refund')     r
  FROM public.credit_transactions
  WHERE created_at > NOW() - INTERVAL '10 days' GROUP BY 1
)
SELECT * FROM (
  SELECT 1 AS ord, 'A. EXPIRED — grants reclaimed' AS section,
         d::text AS detail,
         n::text || ' grants / ' || p::text || ' people / ' || c::text || ' credits taken back' AS value
  FROM expiry_by_day
  UNION ALL
  SELECT 2, 'B. ON FREE NOW, HELD A GRANT', 'people',
         COUNT(*)::text
  FROM public.user_profiles p WHERE p.subscription_tier='free'
    AND EXISTS (SELECT 1 FROM public.pending_credit_grants g WHERE g.claimed_by=p.id AND g.expired)
  UNION ALL
  SELECT 3, 'C. STILL ON PRO (grant live)', 'people',
         COUNT(DISTINCT claimed_by)::text
  FROM public.pending_credit_grants WHERE claimed AND NOT expired
  UNION ALL
  SELECT 4, 'D. EXPIRING NEXT 14 DAYS', d::text, n::text || ' grants'
  FROM upcoming
  UNION ALL
  SELECT 5, 'E. GENERATIONS vs REFUNDS', d::text,
         g::text || ' generations, ' || r::text || ' refunds ('
         || COALESCE(ROUND(100.0*r/NULLIF(g,0),1)::text,'0') || '%)'
  FROM gen
  UNION ALL
  SELECT 6, 'F. FAILED REFUNDS (should be 0)', 'stuck credits', COUNT(*)::text
  FROM public.generation_history WHERE text LIKE 'PENDING_REFUND:%'
  UNION ALL
  SELECT 7, 'G. ACCOUNTS WITH NO PROFILE', 'cannot generate at all',
         (SELECT COUNT(*)::text FROM auth.users u
          LEFT JOIN public.user_profiles p ON p.id=u.id
          WHERE p.id IS NULL AND u.deleted_at IS NULL)
  UNION ALL
  SELECT 8, 'H. UNCLAIMED GRANTS', 'paid, never received', COUNT(*)::text
  FROM public.pending_credit_grants WHERE NOT claimed
) x
ORDER BY ord, detail;
