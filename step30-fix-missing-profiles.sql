-- =============================================================================
-- STEP 30 — REPAIR THE 153 ACCOUNTS WITH NO PROFILE
-- =============================================================================
-- These users exist in auth.users but have no user_profiles row, so every call
-- to /api/tts returns "User profile not found" and they cannot generate
-- anything at all. Any grant addressed to them also sits unclaimed, because
-- claim_credit_grants() has no profile to credit.
--
-- WHY IT KEEPS HAPPENING: this database has NO trigger on auth.users. The
-- handle_new_user() trigger in supabase-schema-production.sql was never
-- installed, so profiles are only ever created by application code —
-- /auth/callback and the /api/user/profile fallback. Supabase's email
-- confirmation link returns its tokens in the URL *fragment*, which a
-- server-side route can never read, so /auth/callback finds no `code` and
-- bails. Anyone who confirms their email and does not then open the app is
-- left without a profile, permanently. The count grew 131 -> 153 in nine days.
--
-- Run PART 1 first and read it. PART 2 repairs. PART 3 stops the recurrence.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART 1 — LOOK FIRST (read only). Confirms none are deleted or banned.
-- ---------------------------------------------------------------------------
SELECT COUNT(*)                                                        AS total_missing,
       COUNT(*) FILTER (WHERE u.email_confirmed_at IS NOT NULL)        AS email_confirmed,
       COUNT(*) FILTER (WHERE u.last_sign_in_at IS NOT NULL)           AS have_signed_in,
       COUNT(*) FILTER (WHERE u.deleted_at IS NOT NULL)                AS deleted_skip,
       COUNT(*) FILTER (WHERE u.banned_until > NOW())                  AS banned_skip,
       COUNT(*) FILTER (WHERE g.id IS NOT NULL)                        AS holding_a_grant,
       MIN(u.created_at)::date                                         AS oldest,
       MAX(u.created_at)::date                                         AS newest
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
LEFT JOIN public.pending_credit_grants g
       ON g.email = LOWER(BTRIM(u.email)) AND NOT g.claimed
WHERE p.id IS NULL;

-- ---------------------------------------------------------------------------
-- PART 2 — CREATE THE MISSING PROFILES
-- Built exactly the way the app builds one: free tier, 5,000 credits, 30-day
-- reset, display name taken from signup metadata rather than a generic
-- fallback. Skips deleted and banned accounts.
--
-- Creating a profile fires zz_claim_grants_on_profile_insert, so anyone here
-- who is owed a grant receives it automatically — no separate backfill needed.
-- Safe to re-run.
-- ---------------------------------------------------------------------------
INSERT INTO public.user_profiles (
    id, email, name,
    subscription_tier, subscription_status,
    credits_remaining, credits_used_this_month, credits_reset_date
)
SELECT DISTINCT ON (u.id)
    u.id,
    LOWER(u.email),
    COALESCE(
        NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), ''),
        NULLIF(BTRIM(u.raw_user_meta_data->>'name'), ''),
        NULLIF(SPLIT_PART(u.email, '@', 1), ''),
        'User'
    ),
    'free', 'active', 5000, 0, NOW() + INTERVAL '30 days'
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND u.email IS NOT NULL
  AND u.deleted_at IS NULL
  AND (u.banned_until IS NULL OR u.banned_until < NOW())
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- PART 3 — STOP IT HAPPENING AGAIN
-- Create the profile at the database level, the moment the auth user is
-- created, so it no longer depends on the user opening the app.
--
-- The function MUST NOT raise: an exception here would abort signup itself and
-- lock people out. Any failure is swallowed to a WARNING and the existing
-- application fallbacks still cover it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_profile_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    BEGIN
        INSERT INTO public.user_profiles (
            id, email, name,
            subscription_tier, subscription_status,
            credits_remaining, credits_used_this_month, credits_reset_date
        )
        VALUES (
            NEW.id,
            LOWER(NEW.email),
            COALESCE(
                NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''),
                NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), ''),
                NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
                'User'
            ),
            'free', 'active', 5000, 0, NOW() + INTERVAL '30 days'
        )
        ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'ensure_profile_for_new_user failed for %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$;

-- Named to sort BEFORE zz_claim_grants_on_signup: Postgres fires same-event
-- triggers alphabetically, and the profile must exist before the grant claim
-- runs, or the claim finds nothing to credit.
DROP TRIGGER IF EXISTS aa_ensure_profile_on_signup ON auth.users;
CREATE TRIGGER aa_ensure_profile_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_profile_for_new_user();

-- ---------------------------------------------------------------------------
-- VERIFY — expect remaining_without_profile = 0
-- ---------------------------------------------------------------------------
SELECT (SELECT COUNT(*) FROM auth.users u
        LEFT JOIN public.user_profiles p ON p.id = u.id
        WHERE p.id IS NULL AND u.deleted_at IS NULL)              AS remaining_without_profile,
       (SELECT COUNT(*) FROM public.user_profiles)                AS total_profiles,
       (SELECT COUNT(*) FROM public.pending_credit_grants
         WHERE claimed AND claimed_at > NOW() - INTERVAL '5 minutes') AS grants_just_claimed,
       (SELECT COUNT(*) FROM pg_trigger
         WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal) AS triggers_on_auth_users;
