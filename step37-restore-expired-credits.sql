-- =============================================================================
-- STEP 37 — GIVE BACK THE 41,961,302 CREDITS
-- =============================================================================
-- 88 people, 88 grants, expired between 10 and 23 September. Every one of them
-- had their unspent balance reclaimed under the old 30-day rule. The exact
-- amount taken from each was recorded at the time in
-- pending_credit_grants.credits_clawed_back, so this is a precise repayment,
-- not an estimate.
--
-- WHAT IS RESTORED: credits only.
-- WHAT IS NOT: the Pro subscription. You said the plan stays 30 days — it is
-- the CREDITS that are for life. These people correctly moved to the free plan
-- on day 31; they should simply have kept their balance when they did. So they
-- stay on free and get their credits back, which is exactly the end state the
-- new rules produce.
--
-- SAFE TO RUN TWICE. Each repayment writes a ledger row tagged
-- 'Lifetime credit restoration', and the loop skips any grant that already has
-- one. Running this file again repays nobody a second time — your standing
-- rule is that a user never gets double credits, and that is enforced here
-- structurally rather than by me remembering.
--
-- Run step 35b and step 36 FIRST. Without 36, the monthly reset deletes all of
-- this the next time it runs.
-- =============================================================================

BEGIN;

DO $$
DECLARE
    g         RECORD;
    v_before  INTEGER;
    v_after   INTEGER;
    v_people  INTEGER := 0;
    v_credits BIGINT  := 0;
BEGIN
    FOR g IN
        SELECT gr.id, gr.claimed_by, gr.credits_clawed_back, gr.batch_key, gr.email
        FROM public.pending_credit_grants gr
        WHERE gr.expired
          AND COALESCE(gr.credits_clawed_back, 0) > 0
          AND gr.claimed_by IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.credit_transactions t
              WHERE t.reference_id    = gr.id::TEXT
                AND t.reference_type  = 'grant'
                AND t.description LIKE 'Lifetime credit restoration%'
          )
        ORDER BY gr.expired_at
    LOOP
        SELECT credits_remaining INTO v_before
        FROM public.user_profiles
        WHERE id = g.claimed_by
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE NOTICE 'skipped % — no profile row', g.email;
            CONTINUE;
        END IF;

        v_before := COALESCE(v_before, 0);
        v_after  := v_before + g.credits_clawed_back;

        UPDATE public.user_profiles
           SET credits_remaining = v_after,
               updated_at        = TIMEZONE('utc', NOW())
         WHERE id = g.claimed_by;

        INSERT INTO public.credit_transactions
            (user_id, amount, balance_before, balance_after,
             type, description, reference_id, reference_type)
        VALUES
            (g.claimed_by, g.credits_clawed_back, v_before, v_after, 'bonus',
             'Lifetime credit restoration — returned credits that were expired '
               || 'under the old 30-day rule (' || g.batch_key || ')',
             g.id::TEXT, 'grant');

        v_people  := v_people + 1;
        v_credits := v_credits + g.credits_clawed_back;
    END LOOP;

    RAISE NOTICE 'restored % grants, % credits', v_people, v_credits;
END $$;

COMMIT;


-- ---------- proof, read-only ----------
SELECT 1 AS ord, 'RESTORED' AS section, 'people repaid' AS detail,
       count(DISTINCT user_id)::text AS value
FROM public.credit_transactions
WHERE description LIKE 'Lifetime credit restoration%'
UNION ALL
SELECT 1, 'RESTORED', 'credits returned',
       to_char(COALESCE(sum(amount), 0), 'FM999,999,999,999')
FROM public.credit_transactions
WHERE description LIKE 'Lifetime credit restoration%'
UNION ALL
SELECT 2, 'REMAINING', 'clawed-back grants still unrepaid (should be 0)',
       count(*)::text
FROM public.pending_credit_grants gr
WHERE gr.expired
  AND COALESCE(gr.credits_clawed_back, 0) > 0
  AND gr.claimed_by IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.credit_transactions t
      WHERE t.reference_id = gr.id::TEXT
        AND t.reference_type = 'grant'
        AND t.description LIKE 'Lifetime credit restoration%')
UNION ALL
SELECT 3, 'SPOT CHECK', 'balance now / was taken -> ' || gr.email,
       COALESCE(p.credits_remaining, 0)::text || ' (returned ' || gr.credits_clawed_back || ')'
FROM public.pending_credit_grants gr
JOIN public.user_profiles p ON p.id = gr.claimed_by
WHERE gr.expired AND COALESCE(gr.credits_clawed_back, 0) > 0
ORDER BY ord, section, detail
LIMIT 12;
