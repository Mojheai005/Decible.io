-- =============================================================================
-- STEP 32 — REFUND THE 10 CHARGES THAT WERE NEVER DELIVERED
-- =============================================================================
-- 8 users, 10,494 credits, 12-14 Sep. Each was deducted for a generation that
-- never arrived and never refunded, because the function was killed before the
-- refund code could run. They paid and got nothing, and none of them can see
-- why.
--
-- Uses the same detection as step31, then refunds through add_credits() so it
-- lands in the ledger like any other refund. The NOT EXISTS on the description
-- makes this safe to re-run — it will not pay anyone twice.
-- =============================================================================
BEGIN;

WITH charges AS (
  SELECT ct.user_id, ct.reference_id, ct.amount
  FROM public.credit_transactions ct
  WHERE ct.type = 'generation' AND ct.reference_id IS NOT NULL
    AND ct.created_at > NOW() - INTERVAL '14 days'
),
refunded AS (
  SELECT DISTINCT reference_id FROM public.credit_transactions
  WHERE type = 'refund' AND reference_id IS NOT NULL
    AND created_at > NOW() - INTERVAL '14 days'
),
delivered AS (
  SELECT DISTINCT (settings->>'generationId') AS ref FROM public.generation_history
  WHERE created_at > NOW() - INTERVAL '14 days' AND settings->>'generationId' IS NOT NULL
  UNION
  SELECT DISTINCT regexp_replace(audio_url, '^.*/([^/.]+)\.[a-z0-9]+$', '\1')
  FROM public.generation_history
  WHERE created_at > NOW() - INTERVAL '14 days' AND audio_url <> ''
),
orphans AS (
  SELECT c.user_id, c.reference_id, ABS(c.amount) AS credits
  FROM charges c
  LEFT JOIN refunded r ON r.reference_id = c.reference_id
  LEFT JOIN delivered d ON d.ref = c.reference_id
  WHERE r.reference_id IS NULL AND d.ref IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.credit_transactions x
      WHERE x.user_id = c.user_id AND x.reference_id = c.reference_id
        AND x.type = 'refund'
    )
)
SELECT o.user_id,
       o.reference_id,
       o.credits,
       public.add_credits(
         o.user_id, o.credits, 'refund',
         'Refund: generation charged but never delivered (service interruption)',
         o.reference_id
       ) AS new_balance
FROM orphans o;

COMMIT;

-- Verify: expect 0 rows left.
WITH charges AS (
  SELECT ct.user_id, ct.reference_id FROM public.credit_transactions ct
  WHERE ct.type='generation' AND ct.reference_id IS NOT NULL
    AND ct.created_at > NOW() - INTERVAL '14 days'
),
refunded AS (
  SELECT DISTINCT reference_id FROM public.credit_transactions
  WHERE type='refund' AND reference_id IS NOT NULL
),
delivered AS (
  SELECT DISTINCT regexp_replace(audio_url,'^.*/([^/.]+)\.[a-z0-9]+$','\1')
  FROM public.generation_history WHERE audio_url <> ''
)
SELECT COUNT(*) AS still_unrefunded
FROM charges c
LEFT JOIN refunded r ON r.reference_id=c.reference_id
LEFT JOIN delivered d ON d=c.reference_id
WHERE r.reference_id IS NULL AND d IS NULL;
