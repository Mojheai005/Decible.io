-- =============================================================================
-- STEP 33 — WHAT SHAPE ARE THE 1,359 FAILURES?   (READ ONLY)
-- =============================================================================
-- The refund amount equals the character count of the request that failed, so
-- even without the provider's message the shape separates the two stories:
--
--   spread evenly across sizes, clustered in busy hours -> provider throttling
--   concentrated at the large end                       -> size / wall-time
-- =============================================================================
WITH f AS (
  SELECT created_at, user_id, ABS(amount) AS chars
  FROM public.credit_transactions
  WHERE type = 'refund' AND created_at > NOW() - INTERVAL '12 days'
),
by_size AS (
  SELECT bucket, COUNT(*) AS n
  FROM (
    SELECT CASE WHEN chars <  500 THEN 'a. under 500'
                WHEN chars < 1000 THEN 'b. 500-1,000'
                WHEN chars < 2000 THEN 'c. 1,000-2,000'
                WHEN chars < 3000 THEN 'd. 2,000-3,000'
                WHEN chars < 4000 THEN 'e. 3,000-4,000'
                ELSE                   'f. over 4,000' END AS bucket
    FROM f
  ) t
  GROUP BY bucket
),
by_hour AS (
  SELECT hr, COUNT(*) AS n
  FROM (SELECT lpad(EXTRACT(hour FROM created_at)::int::text, 2, '0') || ':00' AS hr FROM f) t
  GROUP BY hr
),
per_user AS (SELECT user_id, COUNT(*) c FROM f GROUP BY user_id),
per_min  AS (SELECT date_trunc('minute', created_at) m, COUNT(*) n FROM f GROUP BY 1)
SELECT * FROM (
  SELECT 1 AS ord, 'A. FAILURE SIZE' AS section, bucket AS detail, n::text || ' failures' AS value
  FROM by_size
  UNION ALL
  SELECT 2, 'B. BY HOUR (UTC)', hr, n::text || ' failures' FROM by_hour
  UNION ALL
  SELECT 3, 'C. CONCENTRATION', 'users affected',
         (SELECT COUNT(*)::text FROM per_user) || ' users, worst had '
         || (SELECT MAX(c)::text FROM per_user) || ' failures'
  UNION ALL
  SELECT 4, 'D. BURSTINESS', 'busiest minute',
         (SELECT MAX(n)::text FROM per_min) || ' failures in one minute'
  UNION ALL
  SELECT 5, 'E. TOTALS', 'all failures',
         (SELECT COUNT(*)::text FROM f) || ' failures, median size '
         || (SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY chars)::text FROM f)
         || ' chars, largest ' || (SELECT MAX(chars)::text FROM f)
) x
ORDER BY ord, detail;
