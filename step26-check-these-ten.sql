-- =============================================================================
-- STEP 26 — WHAT DO THESE TEN ACTUALLY HAVE?   (READ ONLY, changes nothing)
-- =============================================================================
-- Nine of these appeared in the 7 Sep backfill already receiving 500,000 each,
-- so before granting anything we check what is really there. Granting again
-- would be blocked by the unique index anyway, but the useful question is
-- WHY they think they have nothing.
--
-- Two addresses are ambiguous and both spellings are checked:
--   * goutham...  was truncated in the screenshot -> prefix match
--   * ramdas.diwakar vs ramdas.diwaka (Pabbly has the shorter one)
-- =============================================================================
WITH wanted(email) AS (
  VALUES
    ('hussainifathema11@gmail.com'),
    ('vivekkuntal0369@gmail.com'),
    ('surabhidk@gmail.com'),
    ('ramdas.diwakar@gmail.com'),
    ('ramdas.diwaka@gmail.com'),
    ('sushanthvs96@gmail.com'),
    ('roshanjaiswal0011@gmail.com'),
    ('owais1807@outlook.com'),
    ('raina.vivek121@gmail.com'),
    ('sakshibondre09@gmail.com')
),
resolved AS (
  SELECT LOWER(BTRIM(email)) AS email FROM wanted
  UNION
  -- the truncated one, matched by prefix
  SELECT g.email FROM public.pending_credit_grants g
   WHERE g.email LIKE 'gouthamkrishnareddypaisa@%'
  UNION
  SELECT LOWER(u.email) FROM auth.users u
   WHERE LOWER(u.email) LIKE 'gouthamkrishnareddypaisa@%'
)
SELECT r.email,
       CASE WHEN g.id IS NULL THEN 'NO GRANT' ELSE g.batch_key END        AS grant_from,
       g.source,
       g.grant_tier,
       g.claimed,
       g.claimed_at::date                                                 AS claimed_on,
       g.expires_at::date                                                 AS expires_on,
       CASE WHEN au.id IS NULL THEN 'no account'
            WHEN p.id  IS NULL THEN 'account, NO PROFILE'
            ELSE 'account ok' END                                         AS account_state,
       p.subscription_tier                                                AS plan_now,
       p.credits_remaining                                                AS credits_now
FROM resolved r
LEFT JOIN public.pending_credit_grants g ON g.email = r.email
LEFT JOIN auth.users au                  ON LOWER(au.email) = r.email
LEFT JOIN public.user_profiles p         ON p.id = au.id
ORDER BY (g.id IS NULL) DESC, r.email;
