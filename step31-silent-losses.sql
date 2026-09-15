-- =============================================================================
-- STEP 31 — CHARGED BUT NEVER DELIVERED   (READ ONLY)
-- =============================================================================
-- If a serverless function is killed mid-flight (hard timeout), the refund
-- code never runs: credits are deducted and the user gets nothing, with no
-- refund and no error recorded. That loss is invisible in refund reporting.
--
-- Signature: a 'generation' deduction with no matching refund AND no completed
-- history row for the same reference id.
-- =============================================================================
WITH charges AS (
  SELECT ct.user_id, ct.reference_id, ct.amount, ct.created_at
  FROM public.credit_transactions ct
  WHERE ct.type = 'generation'
    AND ct.reference_id IS NOT NULL
    AND ct.created_at > NOW() - INTERVAL '14 days'
),
refunded AS (
  SELECT DISTINCT reference_id FROM public.credit_transactions
  WHERE type = 'refund' AND reference_id IS NOT NULL
    AND created_at > NOW() - INTERVAL '14 days'
),
delivered AS (
  SELECT DISTINCT (settings->>'generationId') AS ref
  FROM public.generation_history
  WHERE created_at > NOW() - INTERVAL '14 days' AND settings->>'generationId' IS NOT NULL
  UNION
  SELECT DISTINCT regexp_replace(audio_url, '^.*/([^/.]+)\.[a-z0-9]+$', '\1')
  FROM public.generation_history
  WHERE created_at > NOW() - INTERVAL '14 days' AND audio_url <> ''
),
orphans AS (
  SELECT c.* FROM charges c
  LEFT JOIN refunded r ON r.reference_id = c.reference_id
  LEFT JOIN delivered d ON d.ref = c.reference_id
  WHERE r.reference_id IS NULL AND d.ref IS NULL
)
SELECT created_at::date                       AS day,
       COUNT(*)                               AS charged_not_delivered,
       COUNT(DISTINCT user_id)                AS users,
       SUM(ABS(amount))                       AS credits_lost,
       ROUND(AVG(ABS(amount)))                AS avg_size
FROM orphans
GROUP BY 1
ORDER BY 1 DESC;
