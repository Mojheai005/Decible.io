-- =============================================================================
-- STEP 39 — WHY ARE GENERATIONS FAILING?                            (READ ONLY)
-- =============================================================================
-- One statement, one result table. Paste the whole file into the Supabase SQL
-- editor and run it. Nothing here writes.
--
-- WHERE FAILURES COME FROM: refunds, not generation_history.
-- The 16 Sep change writes failed generations to generation_history with an
-- error_message column, but that column does not exist in the live database
-- and the insert's error is ignored, so no failure has ever been recorded
-- there. The server DOES write a refund ('Refund: <engine> error: <message>')
-- for every failed attempt it charged, so this query counts failures from
-- credit_transactions and successes from completed generation_history rows.
--
-- Sections, in the order they matter:
--   0. ENGINE PULSE      last success and last out-of-credit refusal per engine
--   A. DAILY             attempts, failures and rate per IST day since 20 Sep
--   B. FUNDING OUTAGES   when Smallest and Fish stopped and started working
--   C. FAILURE REASONS   what the engines actually said (last 8 days)
--   D. SILENT LOSSES     charged, never delivered, never refunded (refund with
--                        the step32 logic if any appear)
--   E. RATE-LIMIT HITS   users over their per-minute / per-hour limit in their
--                        latest window; a 429 leaves no other trace
--   F. PLAN EXPIRIES     granted plans that ended since 25 Sep, and what those
--                        users experienced afterwards
--   G. BY TIER           failure rate by the user's current tier
--   H. BY HOUR (IST)     clustering in busy hours = provider limits
--   I. BY SIZE           clustering at the large end = timeouts
--   J. AFFECTED USERS    how many people were hit, and the 25 hit hardest
--   K. 24 SEP APPLIED?   both counts must be 0
--   L. SILENT GROUPS     refused before anything is written
--   M. PROVIDER 429s     concurrency refusals per engine
--   N. PAID USAGE        characters per day on Smallest and Fish, with cost
--   O. BEFORE / DURING   failure rate per period and engine
--
-- WHAT THE DATABASE CANNOT SHOW:
--   Refusals BEFORE the charge write nothing: 401 (session expired), 402 (out
--   of credits), 404 (no profile row), 413 (text too long), 429 (rate limit).
--   Those exist only in Vercel's runtime logs, which are kept for hours.
--   Provider balances are not in the database either; run
--   `node scripts/diagnose-generation-failures.mjs` for those.
-- =============================================================================
WITH params AS (
    SELECT NOW() - INTERVAL '8 days'          AS since,
           '2026-09-20'::timestamptz          AS day_since,
           '2026-09-25'::timestamptz          AS demotions_since
),
succ AS (
    SELECT g.created_at, g.user_id, COALESCE(g.characters_used, 0) AS chars,
           true AS ok, NULL::text AS reason,
           CASE WHEN g.voice_id LIKE 'sm-%'   THEN 'smallest'
                WHEN g.voice_id LIKE 'fish-%' THEN 'fish'
                ELSE 'gemini' END AS engine
    FROM public.generation_history g
    WHERE g.created_at >= (SELECT day_since FROM params)
      AND g.status = 'completed'
      AND g.voice_id NOT IN ('system', 'batch')
),
fail AS (
    SELECT t.created_at, t.user_id, ABS(t.amount) AS chars,
           false AS ok,
           regexp_replace(COALESCE(t.description, ''), '^Refund:\s*', '') AS reason,
           CASE WHEN t.description ILIKE 'Refund: smallest%'      THEN 'smallest'
                WHEN t.description ILIKE 'Refund: fish%'          THEN 'fish'
                WHEN t.description ILIKE 'Refund: gemini%'        THEN 'gemini'
                WHEN t.description ILIKE 'Refund: audio storage%' THEN 'storage'
                ELSE 'other' END AS engine
    FROM public.credit_transactions t
    WHERE t.type = 'refund'
      AND t.reference_id LIKE 'gen\_%'
      AND t.created_at >= (SELECT day_since FROM params)
),
ev AS (
    SELECT x.*,
           (x.created_at AT TIME ZONE 'Asia/Kolkata')::date                AS ist_day,
           EXTRACT(hour FROM x.created_at AT TIME ZONE 'Asia/Kolkata')::int AS ist_hour,
           (NOT x.ok AND x.reason ~* 'credits exhausted|recharge|insufficient|payment required|http 402|out of credits|no credits|balance') AS funding
    FROM (SELECT * FROM succ UNION ALL SELECT * FROM fail) x
),
-- B. state runs per engine: each run is a stretch of only successes or only
--    out-of-credit refusals
fund_seq AS (
    SELECT engine, created_at,
           CASE WHEN ok THEN 'working' ELSE 'OUT OF CREDIT' END AS state
    FROM ev
    WHERE engine IN ('smallest', 'fish') AND (ok OR funding)
),
fund_marked AS (
    SELECT engine, created_at, state,
           CASE WHEN state IS DISTINCT FROM LAG(state) OVER (PARTITION BY engine ORDER BY created_at)
                THEN 1 ELSE 0 END AS chg
    FROM fund_seq
),
fund_runs AS (
    SELECT engine, created_at, state,
           SUM(chg) OVER (PARTITION BY engine ORDER BY created_at ROWS UNBOUNDED PRECEDING) AS run_id
    FROM fund_marked
),
-- D. charged but never delivered (same detection as step31/step32)
charges AS (
    SELECT ct.user_id, ct.reference_id, ct.amount, ct.created_at
    FROM public.credit_transactions ct
    WHERE ct.type = 'generation'
      AND ct.reference_id IS NOT NULL
      AND ct.created_at >= (SELECT since FROM params)
      AND ct.created_at <  NOW() - INTERVAL '10 minutes'
),
refunded AS (
    SELECT DISTINCT reference_id
    FROM public.credit_transactions
    WHERE type = 'refund' AND reference_id IS NOT NULL
      AND created_at >= (SELECT since FROM params) - INTERVAL '1 day'
),
delivered AS (
    SELECT DISTINCT (settings->>'generationId') AS ref
    FROM public.generation_history
    WHERE created_at >= (SELECT since FROM params) AND settings->>'generationId' IS NOT NULL
    UNION
    SELECT DISTINCT regexp_replace(audio_url, '^.*/([^/.]+)\.[a-z0-9]+$', '\1')
    FROM public.generation_history
    WHERE created_at >= (SELECT since FROM params) AND audio_url <> ''
),
orphans AS (
    SELECT c.*
    FROM charges c
    LEFT JOIN refunded  r ON r.reference_id = c.reference_id
    LEFT JOIN delivered d ON d.ref          = c.reference_id
    WHERE r.reference_id IS NULL AND d.ref IS NULL
),
-- E. rate-limit windows vs the tier limits in src/lib/rate-limiter.ts
lim AS (
    SELECT rl.key, rl.count AS hits, rl.window_start,
           up.email, up.subscription_tier, up.credits_remaining,
           CASE WHEN rl.key LIKE '%:minute'
                THEN CASE up.subscription_tier
                        WHEN 'free' THEN 3  WHEN 'starter' THEN 5   WHEN 'creator' THEN 10
                        WHEN 'pro'  THEN 15 WHEN 'advanced' THEN 20 ELSE 3 END
                ELSE CASE up.subscription_tier
                        WHEN 'free' THEN 30  WHEN 'starter' THEN 100 WHEN 'creator' THEN 200
                        WHEN 'pro'  THEN 400 WHEN 'advanced' THEN 600 ELSE 30 END
           END AS lim
    FROM public.rate_limits rl
    JOIN public.user_profiles up ON up.id::text = split_part(rl.key, ':', 2)
    WHERE rl.key LIKE 'user:%:generation:%'
      AND rl.window_start >= (SELECT since FROM params)
),
-- F. granted plans that ended (user dropped to free, credits kept)
dem AS (
    SELECT g.claimed_by AS user_id, g.expired_at,
           (g.expired_at AT TIME ZONE 'Asia/Kolkata')::date AS d
    FROM public.pending_credit_grants g
    WHERE g.expired
      AND g.grant_tier IS NOT NULL
      AND g.claimed_by IS NOT NULL
      AND g.expired_at >= (SELECT demotions_since FROM params)
),
demoted_users AS (
    SELECT user_id, MAX(expired_at) AS last_exp FROM dem GROUP BY user_id
),
per_user AS (
    SELECT user_id,
           COUNT(*) FILTER (WHERE ok)     AS oks,
           COUNT(*) FILTER (WHERE NOT ok) AS fails
    FROM ev
    WHERE created_at >= (SELECT since FROM params)
    GROUP BY user_id
)

-- ---------------------------------------------------------------------------
-- 0. ENGINE PULSE
-- ---------------------------------------------------------------------------
SELECT 0 AS ord, '0. ENGINE PULSE' AS section,
       e.engine AS detail,
       'last success ' || COALESCE(to_char((MAX(e.created_at) FILTER (WHERE e.ok)) AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI') || ' IST', 'none since 20 Sep')
       || ' | last out-of-credit refusal ' || COALESCE(to_char((MAX(e.created_at) FILTER (WHERE e.funding)) AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI') || ' IST', '-')
       || ' | last 24h: ' || COUNT(*) FILTER (WHERE e.ok AND e.created_at > NOW() - INTERVAL '24 hours') || ' ok, '
       || COUNT(*) FILTER (WHERE NOT e.ok AND e.created_at > NOW() - INTERVAL '24 hours') || ' failed' AS value,
       e.engine AS sk
FROM ev e
WHERE e.engine IN ('smallest', 'fish', 'gemini')
GROUP BY e.engine

UNION ALL
-- ---------------------------------------------------------------------------
-- A. DAILY (IST days)
-- ---------------------------------------------------------------------------
SELECT 1, 'A. DAILY (IST)', e.ist_day::text,
       COUNT(*) || ' tries | ' || COUNT(*) FILTER (WHERE NOT e.ok) || ' failed ('
       || ROUND(100.0 * COUNT(*) FILTER (WHERE NOT e.ok) / NULLIF(COUNT(*), 0)) || '%)'
       || ' | ok sm ' || COUNT(*) FILTER (WHERE e.ok AND e.engine = 'smallest')
       || ' / fish ' || COUNT(*) FILTER (WHERE e.ok AND e.engine = 'fish')
       || ' / gem ' || COUNT(*) FILTER (WHERE e.ok AND e.engine = 'gemini')
       || ' | failed sm ' || COUNT(*) FILTER (WHERE NOT e.ok AND e.engine = 'smallest')
       || ' / fish ' || COUNT(*) FILTER (WHERE NOT e.ok AND e.engine = 'fish')
       || ' / gem ' || COUNT(*) FILTER (WHERE NOT e.ok AND e.engine = 'gemini')
       || ' | users ' || COUNT(DISTINCT e.user_id)
       || ', with a success ' || COUNT(DISTINCT e.user_id) FILTER (WHERE e.ok),
       e.ist_day::text
FROM ev e
GROUP BY e.ist_day

UNION ALL
-- ---------------------------------------------------------------------------
-- B. FUNDING OUTAGES — runs of successes vs out-of-credit refusals
-- ---------------------------------------------------------------------------
SELECT 2, 'B. FUNDING OUTAGES (IST)', r.engine || ' ' || r.state,
       'from ' || to_char(MIN(r.created_at) AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI')
       || ' to ' || to_char(MAX(r.created_at) AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI')
       || ' (' || COUNT(*) || CASE WHEN r.state = 'working' THEN ' successes)' ELSE ' refused attempts)' END,
       r.engine || to_char(MIN(r.created_at), 'YYYYMMDDHH24MISS')
FROM fund_runs r
GROUP BY r.engine, r.state, r.run_id

UNION ALL
-- ---------------------------------------------------------------------------
-- C. FAILURE REASONS (last 8 days)
-- ---------------------------------------------------------------------------
SELECT 3, 'C. FAILURE REASONS (8d)',
       e.engine || ' — ' || LEFT(regexp_replace(regexp_replace(e.reason, 'gen_[0-9a-z_]+', '<id>', 'g'), '\d{5,}', '<n>', 'g'), 150),
       COUNT(*) || ' failures | ' || COUNT(DISTINCT e.user_id) || ' users',
       lpad(COUNT(*)::text, 9, '0')
FROM ev e
WHERE NOT e.ok AND e.created_at >= (SELECT since FROM params)
GROUP BY e.engine, LEFT(regexp_replace(regexp_replace(e.reason, 'gen_[0-9a-z_]+', '<id>', 'g'), '\d{5,}', '<n>', 'g'), 150)

UNION ALL
SELECT 3, 'C. FAILURE REASONS (8d)',
       'PENDING_REFUND markers — automatic refund FAILED, pay by hand via add_credits',
       COUNT(*) || ' markers | ' || COUNT(DISTINCT user_id) || ' users',
       '999999999'
FROM public.generation_history
WHERE voice_id = 'system' AND text LIKE 'PENDING_REFUND%'
  AND created_at >= (SELECT since FROM params)

UNION ALL
-- ---------------------------------------------------------------------------
-- D. CHARGED, NEVER DELIVERED, NEVER REFUNDED (last 8 days)
-- ---------------------------------------------------------------------------
SELECT 4, 'D. CHARGED, NEVER DELIVERED (8d)', 'total',
       COUNT(*) || ' charges | ' || COUNT(DISTINCT user_id) || ' users | '
       || COALESCE(SUM(ABS(amount)), 0) || ' credits — refund with the step32 logic if not 0',
       'z'
FROM orphans

UNION ALL
-- ---------------------------------------------------------------------------
-- E. RATE-LIMIT HITS (latest window per user, last 8 days)
-- ---------------------------------------------------------------------------
SELECT 5, 'E. RATE-LIMIT HITS (8d)',
       'users over a limit in their latest window',
       COUNT(DISTINCT email)::text
       || ' (free tier: ' || COUNT(DISTINCT email) FILTER (WHERE subscription_tier = 'free') || ')',
       '999999999'
FROM lim WHERE hits > lim

UNION ALL
SELECT 5, 'E. RATE-LIMIT HITS (8d)',
       email || ' | ' || subscription_tier || ' | ' || credits_remaining || ' credits | '
       || CASE WHEN key LIKE '%:minute' THEN 'per-minute' ELSE 'per-hour' END,
       hits || ' requests vs limit ' || lim || ' at '
       || to_char(window_start AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH24:MI') || ' IST',
       lpad(hits::text, 9, '0')
FROM lim WHERE hits > lim

UNION ALL
-- ---------------------------------------------------------------------------
-- F. GRANTED PLANS THAT ENDED SINCE 25 SEP (user -> free, credits kept)
-- ---------------------------------------------------------------------------
SELECT 6, 'F. PLAN EXPIRIES -> FREE', d::text, COUNT(*) || ' plans ended', d::text
FROM dem
GROUP BY d

UNION ALL
SELECT 6, 'F. PLAN EXPIRIES -> FREE', 'after their plan ended',
       COUNT(DISTINCT e.user_id) || ' of those users tried to generate | '
       || COUNT(*) FILTER (WHERE e.ok) || ' ok, ' || COUNT(*) FILTER (WHERE NOT e.ok) || ' failed',
       '9999-99-97'
FROM ev e
JOIN demoted_users du ON du.user_id = e.user_id AND e.created_at > du.last_exp

UNION ALL
SELECT 6, 'F. PLAN EXPIRIES -> FREE', 'coming in the next 14 days',
       COUNT(*) || ' plans | ' || COUNT(DISTINCT claimed_by) || ' users',
       '9999-99-99'
FROM public.pending_credit_grants
WHERE claimed AND NOT expired AND grant_tier IS NOT NULL
  AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '14 days'

UNION ALL
-- ---------------------------------------------------------------------------
-- G. FAILURE RATE BY CURRENT TIER (last 8 days)
-- ---------------------------------------------------------------------------
SELECT 7, 'G. BY CURRENT TIER (8d)',
       up.subscription_tier || CASE WHEN du.user_id IS NOT NULL THEN ' (plan ended since 25 Sep)' ELSE '' END,
       COUNT(*) FILTER (WHERE NOT e.ok) || ' failed / ' || COUNT(*) || ' ('
       || ROUND(100.0 * COUNT(*) FILTER (WHERE NOT e.ok) / NULLIF(COUNT(*), 0)) || '%) | '
       || COUNT(DISTINCT e.user_id) || ' users',
       lpad(COUNT(*)::text, 9, '0')
FROM ev e
JOIN public.user_profiles up ON up.id = e.user_id
LEFT JOIN demoted_users du ON du.user_id = e.user_id
WHERE e.created_at >= (SELECT since FROM params)
GROUP BY up.subscription_tier, du.user_id IS NOT NULL

UNION ALL
-- ---------------------------------------------------------------------------
-- H. BY HOUR OF DAY, IST (last 8 days)
-- ---------------------------------------------------------------------------
SELECT 8, 'H. BY HOUR, IST (8d)', lpad(e.ist_hour::text, 2, '0') || ':00',
       COUNT(*) FILTER (WHERE NOT e.ok) || ' failed / ' || COUNT(*) || ' total',
       lpad((23 - e.ist_hour)::text, 2, '0')
FROM ev e
WHERE e.created_at >= (SELECT since FROM params)
GROUP BY e.ist_hour

UNION ALL
-- ---------------------------------------------------------------------------
-- I. BY REQUEST SIZE (last 8 days)
-- ---------------------------------------------------------------------------
SELECT 9, 'I. BY SIZE (8d)', s.bucket,
       COUNT(*) FILTER (WHERE NOT s.ok) || ' failed / ' || COUNT(*) || ' total',
       s.sk
FROM (
    SELECT ok,
           CASE WHEN chars <  400  THEN 'under 400 chars'
                WHEN chars < 1000  THEN '400 - 1,000'
                WHEN chars < 1500  THEN '1,000 - 1,500'
                WHEN chars < 2000  THEN '1,500 - 2,000'
                ELSE                    'over 2,000' END AS bucket,
           CASE WHEN chars <  400  THEN 'e'
                WHEN chars < 1000  THEN 'd'
                WHEN chars < 1500  THEN 'c'
                WHEN chars < 2000  THEN 'b'
                ELSE                    'a' END AS sk
    FROM ev
    WHERE created_at >= (SELECT since FROM params)
) s
GROUP BY s.bucket, s.sk

UNION ALL
-- ---------------------------------------------------------------------------
-- J. WHO IS AFFECTED (last 8 days) — totals, then the 25 hit hardest
-- ---------------------------------------------------------------------------
SELECT 10, 'J. AFFECTED USERS (8d)', 'people',
       COUNT(*) || ' tried | ' || COUNT(*) FILTER (WHERE fails > 0) || ' hit a failure | '
       || COUNT(*) FILTER (WHERE oks = 0) || ' never got a single success',
       '999999999'
FROM per_user

UNION ALL
(
    SELECT 10, 'J. AFFECTED USERS (8d)',
           up.email || ' | ' || up.subscription_tier || ' | ' || up.credits_remaining || ' credits',
           COUNT(*) FILTER (WHERE NOT e.ok) || ' failed / ' || COUNT(*) || ' | last reason: '
           || LEFT(COALESCE((array_agg(e.reason ORDER BY e.created_at DESC) FILTER (WHERE NOT e.ok))[1], '-'), 90),
           lpad((COUNT(*) FILTER (WHERE NOT e.ok))::text, 9, '0')
    FROM ev e
    JOIN public.user_profiles up ON up.id = e.user_id
    WHERE e.created_at >= (SELECT since FROM params)
    GROUP BY up.email, up.subscription_tier, up.credits_remaining
    HAVING COUNT(*) FILTER (WHERE NOT e.ok) > 0
    ORDER BY COUNT(*) FILTER (WHERE NOT e.ok) DESC
    LIMIT 25
)

UNION ALL
-- ---------------------------------------------------------------------------
-- K. DID THE 24 SEP DATABASE CHANGE ACTUALLY APPLY? (both must be 0)
-- ---------------------------------------------------------------------------
SELECT 11, 'K. 24 SEP CHANGE APPLIED?', 'live expire_credit_grants() body',
       CASE WHEN pg_get_functiondef(p.oid) LIKE '%CREDITS ARE NOW PERMANENT%'
            THEN 'new — ends the plan, keeps the credits'
            ELSE 'OLD — still claws back unspent credits on day 31; run step35b now' END,
       'd'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'expire_credit_grants'

UNION ALL
SELECT 11, 'K. 24 SEP CHANGE APPLIED?', 'live reset_monthly_credits() body',
       CASE WHEN pg_get_functiondef(p.oid) LIKE '%GREATEST%'
            THEN 'new — allowance is a floor, never a cut'
            ELSE 'OLD — would cut balances to the allowance; run step36 now' END,
       'c'
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'reset_monthly_credits'

UNION ALL
SELECT 11, 'K. 24 SEP CHANGE APPLIED?', 'type=expiry ledger rows since 25 Sep (must be 0)',
       COUNT(*) || ' rows | ' || COALESCE(SUM(ABS(amount)), 0) || ' credits',
       'b'
FROM public.credit_transactions
WHERE type = 'expiry' AND created_at >= (SELECT demotions_since FROM params)

UNION ALL
SELECT 11, 'K. 24 SEP CHANGE APPLIED?', 'grants expired since 25 Sep with credits clawed back (must be 0)',
       COUNT(*) || ' grants | ' || COALESCE(SUM(credits_clawed_back), 0) || ' credits',
       'a'
FROM public.pending_credit_grants
WHERE expired AND expired_at >= (SELECT demotions_since FROM params)
  AND COALESCE(credits_clawed_back, 0) > 0

UNION ALL
-- ---------------------------------------------------------------------------
-- L. SILENT GROUPS — refused before anything is written
-- ---------------------------------------------------------------------------
SELECT 12, 'L. SILENT GROUPS', 'free-tier users holding under 500 credits (every generation answers 402)',
       COUNT(*)::text, 'c'
FROM public.user_profiles
WHERE subscription_tier = 'free' AND credits_remaining < 500

UNION ALL
SELECT 12, 'L. SILENT GROUPS', 'auth users with NO profile row (every generation answers 404)',
       COUNT(*)::text, 'b'
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE p.id IS NULL AND u.deleted_at IS NULL

UNION ALL
SELECT 12, 'L. SILENT GROUPS', 'grants never claimed (buyer signs in with another email, or never signed up)',
       COUNT(*) || ' grants | '
       || COUNT(*) FILTER (WHERE created_at >= (SELECT demotions_since FROM params)) || ' of them created since 25 Sep',
       'a'
FROM public.pending_credit_grants
WHERE NOT claimed

UNION ALL
-- ---------------------------------------------------------------------------
-- M. PROVIDER 429s (last 8 days) — concurrency refusals
-- ---------------------------------------------------------------------------
SELECT 13, 'M. PROVIDER 429s (8d)', e.engine,
       COUNT(*) FILTER (WHERE e.reason ILIKE '%HTTP 429%') || ' of ' || COUNT(*) || ' failures were HTTP 429',
       e.engine
FROM ev e
WHERE NOT e.ok
  AND e.created_at >= (SELECT since FROM params)
  AND e.engine IN ('smallest', 'fish', 'gemini')
GROUP BY e.engine

UNION ALL
-- ---------------------------------------------------------------------------
-- N. PAID ENGINE USAGE — successful characters per day, at the published rate
--    (src/lib/constants.ts: Smallest $0.102 / 1k chars, Fish $0.015 / 1k)
-- ---------------------------------------------------------------------------
SELECT 14, 'N. PAID ENGINE USAGE', e.engine || ' ' || e.ist_day::text,
       to_char(SUM(e.chars), 'FM999,999,999') || ' chars, about $'
       || to_char(SUM(e.chars) / 1000.0 * CASE e.engine WHEN 'smallest' THEN 0.102 ELSE 0.015 END, 'FM999,990.00'),
       e.engine || e.ist_day::text
FROM ev e
WHERE e.ok AND e.engine IN ('smallest', 'fish')
GROUP BY e.engine, e.ist_day

UNION ALL
-- ---------------------------------------------------------------------------
-- O. BEFORE vs DURING
-- ---------------------------------------------------------------------------
SELECT 15, 'O. BEFORE vs DURING', p.label,
       'all ' || ROUND(100.0 * COUNT(*) FILTER (WHERE NOT e.ok) / NULLIF(COUNT(*), 0)) || '% of ' || COUNT(*)
       || ' | smallest ' || COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE NOT e.ok AND e.engine = 'smallest') / NULLIF(COUNT(*) FILTER (WHERE e.engine = 'smallest'), 0))::text || '%', '-')
       || ' | fish ' || COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE NOT e.ok AND e.engine = 'fish') / NULLIF(COUNT(*) FILTER (WHERE e.engine = 'fish'), 0))::text || '%', '-')
       || ' | gemini ' || COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE NOT e.ok AND e.engine = 'gemini') / NULLIF(COUNT(*) FILTER (WHERE e.engine = 'gemini'), 0))::text || '%', '-'),
       p.label
FROM (VALUES ('a. 20-28 Sep',     '2026-09-20 00:00+05:30'::timestamptz, '2026-09-29 00:00+05:30'::timestamptz),
             ('b. 29 Sep - 3 Oct', '2026-09-29 00:00+05:30'::timestamptz, '2026-10-04 00:00+05:30'::timestamptz),
             ('c. 4 Oct onwards',  '2026-10-04 00:00+05:30'::timestamptz, 'infinity'::timestamptz)) AS p(label, f, t)
JOIN ev e ON e.created_at >= p.f AND e.created_at < p.t
GROUP BY p.label

ORDER BY ord, sk DESC;

-- =============================================================================
-- OPTIONAL — run each on its own (cron tables are not always readable):
--   SELECT jobname, schedule, active FROM cron.job;
--     -> 'expire-credit-grants' should be active; there is normally NO reset job.
--   SELECT d.status, d.start_time, LEFT(d.return_message, 80)
--   FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
--   WHERE j.jobname = 'expire-credit-grants' ORDER BY d.start_time DESC LIMIT 5;
-- =============================================================================
