-- =============================================================================
-- STEP 18 — MAKE DOUBLE CREDITS STRUCTURALLY IMPOSSIBLE
-- =============================================================================
-- Until now "one grant per person" was enforced by REMEMBERING to include a
-- NOT EXISTS guard in every batch load. That is a convention, and conventions
-- get forgotten. This makes the database enforce it instead.
--
-- The existing unique index is on (email, batch_key) — which permits the same
-- email once PER BATCH. That is exactly the hole that would let a repeat buyer
-- collect 500,000 twice. This replaces it with a unique index on email alone.
--
-- After this, a duplicate email is rejected by Postgres no matter who writes
-- it, from any batch, script, or admin action.
-- =============================================================================

-- 1. Pre-check. MUST return zero rows. If it does not, STOP — there are
--    already duplicates and the index below will fail. Send me the output.
SELECT email, COUNT(*) AS grant_count,
       array_agg(batch_key ORDER BY batch_key) AS batches,
       SUM(credits) AS total_credits_granted
FROM public.pending_credit_grants
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY email;

-- 2. Enforce it. Run only after the check above returns nothing.
BEGIN;

CREATE UNIQUE INDEX grants_email_uq ON public.pending_credit_grants (email);

-- The old per-batch index is now redundant: uniqueness on email alone is
-- strictly stronger. Dropping it keeps writes cheap.
DROP INDEX IF EXISTS grants_email_batch_uq;

COMMIT;

COMMENT ON INDEX grants_email_uq IS
    'One grant per email address, ever. Enforces the no-double-credits rule at
     the database level rather than relying on per-batch query guards.';

-- 3. Confirm.
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'pending_credit_grants'
ORDER BY indexname;
