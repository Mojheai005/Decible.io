-- =============================================================================
-- STEP 23 — CLAIM AND EXPIRE, NOW SUBSCRIPTION-AWARE
-- =============================================================================
-- Replaces both functions. Existing credits-only grants (grant_tier IS NULL)
-- behave EXACTLY as before — the tier logic only runs when a tier was granted.
--
-- On claim  : credits are added AND the buyer is put on the granted plan.
-- On expiry : unspent granted credits are reclaimed AND, once no granted plan
--             remains active, the buyer drops back to free.
--
-- Stacking is handled: two overlapping grants extend the subscription rather
-- than one silently overwriting the other's end date.
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.claim_credit_grants(
    p_user_id UUID,
    p_email   TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_email     TEXT    := LOWER(BTRIM(COALESCE(p_email, '')));
    v_before    INTEGER;
    v_after     INTEGER;
    v_total     INTEGER := 0;
    v_cur_tier  TEXT;
    v_cur_end   TIMESTAMPTZ;
    v_new_tier  TEXT;
    v_sub_end   TIMESTAMPTZ;
    g           RECORD;
BEGIN
    IF p_user_id IS NULL OR v_email = '' THEN
        RETURN 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.pending_credit_grants
        WHERE email = v_email AND NOT claimed
    ) THEN
        RETURN 0;
    END IF;

    SELECT credits_remaining, subscription_tier, subscription_end_date
      INTO v_before, v_cur_tier, v_cur_end
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 0;   -- profile not created yet; grant stays pending
    END IF;

    v_before := COALESCE(v_before, 0);
    v_after  := v_before;

    FOR g IN
        UPDATE public.pending_credit_grants gr
           SET claimed    = true,
               claimed_at = NOW(),
               claimed_by = p_user_id,
               expires_at = NOW() + make_interval(days => gr.valid_for_days)
         WHERE gr.email = v_email
           AND NOT gr.claimed
        RETURNING gr.id, gr.credits, gr.batch_key, gr.expires_at, gr.grant_tier
    LOOP
        v_after := v_after + g.credits;
        v_total := v_total + g.credits;

        INSERT INTO public.credit_transactions
            (user_id, amount, balance_before, balance_after,
             type, description, reference_id, reference_type)
        VALUES
            (p_user_id, g.credits, v_after - g.credits, v_after, 'bonus',
             'Email grant (' || g.batch_key || ')'
                || COALESCE(' + ' || g.grant_tier || ' plan', '')
                || ', expires ' || TO_CHAR(g.expires_at AT TIME ZONE 'UTC', 'DD Mon YYYY'),
             g.id::TEXT, 'grant');

        -- Keep the HIGHEST plan granted; never demote someone mid-claim.
        IF g.grant_tier IS NOT NULL THEN
            IF v_new_tier IS NULL
               OR (SELECT sort_order FROM public.subscription_plans WHERE id = g.grant_tier)
                > (SELECT sort_order FROM public.subscription_plans WHERE id = v_new_tier)
            THEN
                v_new_tier := g.grant_tier;
            END IF;
        END IF;
    END LOOP;

    IF v_total = 0 THEN
        RETURN 0;
    END IF;

    -- Subscription window = the furthest-out unexpired granted plan. Derived
    -- rather than incremented, so overlapping grants stack correctly and a
    -- re-run can never double-extend.
    SELECT MAX(expires_at) INTO v_sub_end
    FROM public.pending_credit_grants
    WHERE claimed_by = p_user_id
      AND grant_tier IS NOT NULL
      AND NOT expired;

    IF v_new_tier IS NOT NULL THEN
        -- Never downgrade someone who is already on a higher paid plan.
        IF v_cur_tier IS NOT NULL
           AND (SELECT sort_order FROM public.subscription_plans WHERE id = v_cur_tier)
             > (SELECT sort_order FROM public.subscription_plans WHERE id = v_new_tier)
        THEN
            v_new_tier := v_cur_tier;
        END IF;

        UPDATE public.user_profiles
           SET credits_remaining     = v_after,
               subscription_tier     = v_new_tier,
               subscription_status   = 'active',
               subscription_start_date = COALESCE(subscription_start_date, NOW()),
               subscription_end_date = GREATEST(COALESCE(v_cur_end, NOW()), v_sub_end),
               updated_at            = TIMEZONE('utc', NOW())
         WHERE id = p_user_id;
    ELSE
        -- Credits-only grant — original behaviour, plan untouched.
        UPDATE public.user_profiles
           SET credits_remaining = v_after,
               updated_at        = TIMEZONE('utc', NOW())
         WHERE id = p_user_id;
    END IF;

    RETURN v_total;
END;
$$;


CREATE OR REPLACE FUNCTION public.expire_credit_grants()
RETURNS TABLE (grants_expired INTEGER, credits_removed BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    g            RECORD;
    v_spent      BIGINT;
    v_consumed   INTEGER;
    v_clawback   INTEGER;
    v_balance    INTEGER;
    v_new        INTEGER;
    v_removed    INTEGER;
    v_count      INTEGER := 0;
    v_total      BIGINT  := 0;
    v_still_live BOOLEAN;
    v_paid_until TIMESTAMPTZ;
BEGIN
    FOR g IN
        SELECT id, claimed_by, claimed_at, credits, batch_key, grant_tier
        FROM public.pending_credit_grants
        WHERE claimed AND NOT expired AND expires_at <= NOW()
        ORDER BY claimed_at
        FOR UPDATE SKIP LOCKED
    LOOP
        SELECT credits_remaining, subscription_end_date
          INTO v_balance, v_paid_until
        FROM public.user_profiles
        WHERE id = g.claimed_by
        FOR UPDATE;

        IF NOT FOUND THEN
            UPDATE public.pending_credit_grants
               SET expired = true, expired_at = NOW(), credits_clawed_back = 0
             WHERE id = g.id;
            v_count := v_count + 1;
            CONTINUE;
        END IF;

        SELECT COALESCE(SUM(-amount), 0) INTO v_spent
        FROM public.credit_transactions
        WHERE user_id = g.claimed_by
          AND type    = 'generation'
          AND created_at >= g.claimed_at;

        -- Granted credits count as spent first; purchased and pre-existing
        -- credits are never reclaimed.
        v_consumed := LEAST(g.credits, GREATEST(v_spent, 0))::INTEGER;
        v_clawback := g.credits - v_consumed;
        v_new      := GREATEST(0, v_balance - v_clawback);
        v_removed  := v_balance - v_new;

        IF v_removed > 0 THEN
            UPDATE public.user_profiles
               SET credits_remaining = v_new,
                   updated_at        = TIMEZONE('utc', NOW())
             WHERE id = g.claimed_by;

            INSERT INTO public.credit_transactions
                (user_id, amount, balance_before, balance_after,
                 type, description, reference_id, reference_type)
            VALUES
                (g.claimed_by, -v_removed, v_balance, v_new, 'expiry',
                 'Expired unused grant credits (' || g.batch_key || ')',
                 g.id::TEXT, 'grant');
        END IF;

        UPDATE public.pending_credit_grants
           SET expired = true, expired_at = NOW(), credits_clawed_back = v_removed
         WHERE id = g.id;

        -- Drop back to free ONLY when no other granted plan is still running
        -- AND nothing else (a real Razorpay purchase) is paying for the plan.
        IF g.grant_tier IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.pending_credit_grants
                WHERE claimed_by = g.claimed_by
                  AND grant_tier IS NOT NULL
                  AND NOT expired
                  AND id <> g.id
            ) INTO v_still_live;

            IF NOT v_still_live AND (v_paid_until IS NULL OR v_paid_until <= NOW()) THEN
                UPDATE public.user_profiles
                   SET subscription_tier   = 'free',
                       subscription_status = 'active',
                       subscription_end_date = NULL,
                       updated_at          = TIMEZONE('utc', NOW())
                 WHERE id = g.claimed_by;

                INSERT INTO public.credit_transactions
                    (user_id, amount, balance_before, balance_after, type,
                     description, reference_id, reference_type)
                VALUES
                    (g.claimed_by, 0, v_new, v_new, 'adjustment',
                     'Granted ' || g.grant_tier || ' plan ended — back to free',
                     g.id::TEXT, 'grant');
            END IF;
        END IF;

        v_count := v_count + 1;
        v_total := v_total + v_removed;
    END LOOP;

    RETURN QUERY SELECT v_count, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_credit_grants(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_credit_grants(UUID, TEXT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_credit_grants()          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_credit_grants()          FROM anon, authenticated;

COMMIT;

-- Confirm both are SECURITY DEFINER and unreachable from the API.
SELECT p.proname, p.prosecdef AS security_definer,
       COALESCE(array_to_string(p.proacl, ' | '), 'owner only') AS access
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('claim_credit_grants','expire_credit_grants');
