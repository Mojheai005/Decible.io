-- =============================================================================
-- STEP 22 — TEACH THE GRANT SYSTEM ABOUT SUBSCRIPTIONS
-- =============================================================================
-- WHY: granting raw credits leaves the buyer on the FREE tier, which caps them
-- at 1,000 chars/generation and 10 generations/day = 10,000 credits/day. Over
-- 30 days that is 300,000 spendable against 500,000 granted, so at least 40% of
-- every grant issued so far is physically unreachable. Granting the PRO tier
-- alongside the credits lifts the ceiling to 5,000,000/day and makes the offer
-- real ("a free month of Pro, worth Rs 3,998").
--
-- This step is ADDITIVE ONLY — new columns and indexes. No existing row changes
-- meaning, nothing is granted, no behaviour changes until Step 23 replaces the
-- functions. Safe to run on a live database.
-- =============================================================================
BEGIN;

ALTER TABLE public.pending_credit_grants
    -- Which plan to put the buyer on when they claim.
    -- NULL = credits only (every grant issued before today keeps working
    -- exactly as it does now).
    ADD COLUMN IF NOT EXISTS grant_tier TEXT
        REFERENCES public.subscription_plans(id),

    -- Where the grant came from, so automated purchases are distinguishable
    -- from the hand-loaded CSV batches.
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual_batch',

    -- The purchase this grant pays for. This is the IDEMPOTENCY KEY.
    -- Pabbly Connect auto-retries failed steps up to 5 times (10 min - 9 hr
    -- apart) and any operator can press "Re-execute Now", so the endpoint WILL
    -- be called more than once for the same order. The unique index below makes
    -- a replay physically incapable of granting twice.
    ADD COLUMN IF NOT EXISTS source_order_id TEXT,

    -- Kept for reconciliation against the payment platform.
    ADD COLUMN IF NOT EXISTS amount_paid_paise INTEGER;

-- One grant per purchase, ever. This is what makes Pabbly retries safe.
CREATE UNIQUE INDEX IF NOT EXISTS grants_source_order_uq
    ON public.pending_credit_grants (source_order_id)
    WHERE source_order_id IS NOT NULL;

-- One MANUAL grant per person, ever — preserves the CSV-batch protection.
-- Scoped to rows with no order id so that a customer who genuinely PAYS still
-- receives what they paid for, even if they were also on a free CSV list.
-- ("They don't pay double, we don't give double" — but they may pay twice.)
DROP INDEX IF EXISTS grants_email_uq;
CREATE UNIQUE INDEX IF NOT EXISTS grants_manual_email_uq
    ON public.pending_credit_grants (email)
    WHERE source_order_id IS NULL;

CREATE INDEX IF NOT EXISTS grants_source_idx
    ON public.pending_credit_grants (source, created_at DESC);

COMMENT ON COLUMN public.pending_credit_grants.source_order_id IS
    'Payment/order id from the source platform. Unique — this is what makes a
     replayed Pabbly webhook a no-op instead of a second 500,000 credits.';

COMMIT;

-- Confirm: expect grant_tier, source, source_order_id, amount_paid_paise
-- and the two unique indexes.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pending_credit_grants'
  AND column_name IN ('grant_tier','source','source_order_id','amount_paid_paise')
ORDER BY column_name;

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'pending_credit_grants'
ORDER BY indexname;
