-- =============================================================================
-- STEP 38 — kasasrujana100@ AND ramdas.diwakar@ : CHECK, THEN GRANT
-- =============================================================================
-- Both came back "NO GRANT EVER" with a live Decible account on free/5,000.
--
-- WHY THIS DOES NOT JUST INSERT TWO ROWS:
-- ramdas.diwakar@gmail.com is the customer whose payment recorded
-- ramdas.diwaka@gmail.com — one character short. If a grant is still sitting
-- on a near-miss address, inserting a fresh one here hands the same person a
-- second 500,000. Your standing rule is that a user never gets double credits,
-- so this looks for lookalikes FIRST and refuses to grant where one exists.
--
-- The lookalike test is deliberately blunt and portable: any existing grant
-- whose address begins with the same first 8 characters of the local part.
--   ramdas.diwakar@  -> matches anything starting 'ramdas.d'
--   kasasrujana100@  -> matches anything starting 'kasasruj'
-- No extension needed, and wide enough to catch a dropped or swapped letter.
--
-- SECTION 1 is read-only and shows every lookalike found.
-- SECTION 2 grants ONLY where no lookalike exists, then claims immediately
--           (both already have accounts, so they should not have to log out).
-- If a lookalike turns up, nothing is granted for that address and we decide
-- together whether to move the existing grant rather than create a new one.
--
-- Safe to run twice: the unique index on email blocks a second grant, and the
-- insert is guarded anyway.
-- =============================================================================

-- ---------- SECTION 1: lookalikes (read-only) ----------
WITH targets(email) AS (
    VALUES ('kasasrujana100@gmail.com'), ('ramdas.diwakar@gmail.com')
)
SELECT t.email                                   AS checking,
       g.email                                   AS lookalike_found,
       g.credits,
       g.batch_key,
       g.claimed,
       g.expired,
       COALESCE(g.credits_clawed_back, 0)        AS clawed_back,
       CASE WHEN g.email = t.email THEN 'EXACT — already granted'
            ELSE 'NEAR MISS — do not double-grant, move this one instead' END AS verdict
FROM targets t
JOIN public.pending_credit_grants g
  ON g.email LIKE LEFT(split_part(t.email, '@', 1), 8) || '%'
ORDER BY t.email, g.email;


-- ---------- SECTION 2: grant where clean, then claim ----------
BEGIN;

WITH targets(email) AS (
    VALUES ('kasasrujana100@gmail.com'), ('ramdas.diwakar@gmail.com')
)
INSERT INTO public.pending_credit_grants
    (email, credits, grant_tier, batch_key, note, valid_for_days)
SELECT LOWER(BTRIM(t.email)),
       500000,
       'pro',
       'manual_2026_09_24',
       'Manual grant 24 Sep - Pro plan 30 days, credits for life',
       30
FROM targets t
WHERE NOT EXISTS (
    -- blocks BOTH an exact duplicate and any lookalike
    SELECT 1 FROM public.pending_credit_grants g
    WHERE g.email LIKE LEFT(split_part(t.email, '@', 1), 8) || '%'
)
ON CONFLICT DO NOTHING;

-- Claim straight away for anyone who already has an account, so they do not
-- have to log out and back in to see the credits.
DO $$
DECLARE
    r        RECORD;
    v_given  INTEGER;
BEGIN
    FOR r IN
        SELECT p.id, LOWER(p.email) AS email
        FROM public.user_profiles p
        WHERE LOWER(p.email) IN ('kasasrujana100@gmail.com', 'ramdas.diwakar@gmail.com')
    LOOP
        v_given := public.claim_credit_grants(r.id, r.email);
        RAISE NOTICE '% -> claimed % credits', r.email, v_given;
    END LOOP;
END $$;

COMMIT;


-- ---------- proof ----------
SELECT t.email,
       COALESCE(g.batch_key, 'NO GRANT')              AS grant_batch,
       COALESCE(g.credits::text, '-')                 AS granted,
       COALESCE(g.claimed::text, '-')                 AS claimed,
       COALESCE(to_char(g.expires_at, 'DD Mon YYYY'), '-') AS plan_ends,
       COALESCE(p.credits_remaining::text, 'no account') AS balance_now,
       COALESCE(p.subscription_tier, '-')             AS tier
FROM (VALUES ('kasasrujana100@gmail.com'), ('ramdas.diwakar@gmail.com')) AS t(email)
LEFT JOIN public.pending_credit_grants g ON g.email = t.email
LEFT JOIN public.user_profiles        p ON LOWER(p.email) = t.email
ORDER BY t.email;
