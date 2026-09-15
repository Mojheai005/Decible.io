-- =============================================================================
-- STEP 29 — WHY DID ~48% OF GENERATIONS FAIL ON 13-14 SEP?   (READ ONLY)
-- =============================================================================
-- Every refund stores its reason in credit_transactions.description as
-- 'Refund: <reason>'. That is the ground truth for what actually broke.
-- One result table.
-- =============================================================================
WITH refunds AS (
  SELECT created_at, user_id, amount, reference_id,
         regexp_replace(
           regexp_replace(COALESCE(description,''), '^Refund:\s*', ''),
           '\(?\d{3,}[^)]*\)?', '<n>', 'g')          AS reason
  FROM public.credit_transactions
  WHERE type = 'refund' AND created_at > NOW() - INTERVAL '10 days'
),
byreason AS (
  SELECT reason, COUNT(*) n, MIN(created_at)::date first_seen, MAX(created_at)::date last_seen
  FROM refunds GROUP BY 1
),
byvoice AS (
  SELECT h.voice_id, COUNT(*) n
  FROM public.generation_history h
  WHERE h.status = 'failed' AND h.created_at > NOW() - INTERVAL '10 days'
  GROUP BY 1
),
hourly AS (
  SELECT date_trunc('hour', created_at) AS h, COUNT(*) n
  FROM refunds WHERE created_at > NOW() - INTERVAL '4 days'
  GROUP BY 1 ORDER BY 2 DESC LIMIT 8
)
SELECT * FROM (
  SELECT 1 ord, 'A. REFUND REASON' AS section, reason AS detail,
         n::text || '  (' || first_seen::text || ' to ' || last_seen::text || ')' AS value
  FROM byreason
  UNION ALL
  SELECT 2, 'B. FAILED BY VOICE (top)', COALESCE(voice_id,'(none)'), n::text
  FROM byvoice ORDER BY 1
) a
UNION ALL SELECT * FROM (
  SELECT 3 ord, 'C. WORST HOURS' AS section, h::text AS detail, n::text || ' refunds' AS value
  FROM hourly
) b
UNION ALL
SELECT 4, 'D. TOTAL REFUNDED (10d)', 'credits returned',
       COALESCE(SUM(amount),0)::text FROM refunds
UNION ALL
SELECT 5, 'E. USERS AFFECTED (10d)', 'distinct people',
       COUNT(DISTINCT user_id)::text FROM refunds
ORDER BY 1, value DESC;
