-- =============================================================================
-- STEP 40 — MAKE GENERATION FAILURES VISIBLE IN THE DATABASE
-- =============================================================================
-- WHY: since 16 Sep the TTS route has written every failed generation to
-- generation_history with an error_message column. The live table has no such
-- column (it was built from an older schema), the insert failed, and the code
-- ignored the error. Result: from 16 Sep to 12 Oct 2026, while two providers
-- were out of credit and more than 11,000 attempts failed, generation_history
-- recorded ZERO failures.
--
-- The new code stores failure details in settings.failure whether or not the
-- column exists, and fills error_message once it does. This file adds it.
--
-- HOW TO RUN: paste the whole file into the Supabase SQL editor and press Run.
-- Safe to run more than once. Changes no existing rows. Expect one result row:
-- "column | error_message".
-- =============================================================================

-- 1. The column the failure recorder writes to
ALTER TABLE public.generation_history
    ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 2. Ask PostgREST to reload its schema cache so the API sees the new column
--    immediately rather than after its next refresh.
NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- VERIFY — expect one row
-- -----------------------------------------------------------------------------
SELECT 'column' AS kind, column_name AS name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'generation_history' AND column_name = 'error_message';

-- -----------------------------------------------------------------------------
-- OPTIONAL, LATER: indexes so date-range reports stop timing out (ordering by
-- created_at over a few weeks hit the statement timeout on 12 Oct). The app
-- does not need them.
--
-- They are commented out because CREATE INDEX CONCURRENTLY refuses to run
-- inside a transaction, and the SQL editor runs a multi-statement file as one
-- transaction (the error would also undo step 1). To add them: open a NEW
-- query, paste ONE line below without the leading "--", run it; then do the
-- same for the other line. CONCURRENTLY builds without blocking the live app.
-- -----------------------------------------------------------------------------
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generation_history_created_at ON public.generation_history (created_at DESC);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions (created_at DESC);

-- -----------------------------------------------------------------------------
-- AFTER DEPLOYING THE NEW CODE: failures by category, last 24 hours
-- -----------------------------------------------------------------------------
-- SELECT settings->>'engine'                     AS engine,
--        settings->'failure'->>'category'        AS category,
--        COUNT(*)                                AS failures,
--        MAX(created_at)                         AS last_seen,
--        LEFT(MAX(error_message), 120)           AS example
-- FROM public.generation_history
-- WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'
-- GROUP BY 1, 2
-- ORDER BY failures DESC;
