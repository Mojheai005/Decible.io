-- =============================================================================
-- STEP 27 — MOVE RAMDAS'S GRANT TO THE ADDRESS HE ACTUALLY SIGNED UP WITH
-- =============================================================================
-- He paid. Pabbly captured 'ramdas.diwaka@gmail.com' (order 6a9acc9d...),
-- which has NO Decible account and has never been claimed. His real account is
-- 'ramdas.diwakar@gmail.com' — note the trailing r — and it currently sits on
-- the free tier with 5,000 credits.
--
-- We MOVE the grant rather than issue a new one. Issuing a new one would give
-- one payment two grants, which is the rule we enforce everywhere else.
--
-- Guarded three ways: only if unclaimed, only if the misspelling exists, and
-- only if the correct address does not already hold a grant.
-- =============================================================================
BEGIN;

UPDATE public.pending_credit_grants g
   SET email = 'ramdas.diwakar@gmail.com',
       note  = COALESCE(g.note, '') || ' [email corrected from ramdas.diwaka@gmail.com]'
 WHERE g.email = 'ramdas.diwaka@gmail.com'
   AND NOT g.claimed
   AND NOT EXISTS (
       SELECT 1 FROM public.pending_credit_grants x
        WHERE x.email = 'ramdas.diwakar@gmail.com'
   );

-- He already has an account, so claim it now instead of waiting for his next
-- login. The trigger would do this anyway; this just makes it immediate.
SELECT u.email,
       public.claim_credit_grants(u.id, u.email) AS credits_granted
FROM auth.users u
WHERE LOWER(u.email) = 'ramdas.diwakar@gmail.com';

COMMIT;

-- Verify: expect pro / 505000, claimed today, expiring in 30 days.
SELECT p.email, p.subscription_tier, p.credits_remaining,
       g.claimed, g.claimed_at::date AS claimed_on, g.expires_at::date AS expires_on,
       g.source_order_id
FROM public.user_profiles p
LEFT JOIN public.pending_credit_grants g ON g.claimed_by = p.id
WHERE LOWER(p.email) = 'ramdas.diwakar@gmail.com';
