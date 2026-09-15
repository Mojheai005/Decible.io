-- =============================================================================
-- STEP 17 — CORRECT THE 5 TYPO'D ADDRESSES ALREADY IN THE DATABASE
-- =============================================================================
-- These were loaded verbatim in earlier batches and can never match a real
-- account, so those 5 people would silently never receive their credits.
-- All 5 are unambiguous misspellings of gmail.com.
--
-- SAFETY: each UPDATE is guarded three ways —
--   * AND NOT claimed          -> never touches a grant already collected
--   * AND NOT EXISTS(...)      -> never creates a duplicate. If the corrected
--                                 address already holds a grant, the update is
--                                 skipped, honouring "no double credits".
-- Verified 2026-08-25: none of the 5 collide with an existing address.
-- Safe to re-run; becomes a no-op once applied.
-- =============================================================================
BEGIN;

UPDATE public.pending_credit_grants g SET email = 'mhnkhandelwal@gmail.com'
WHERE g.email = 'mhnkhandelwal@gmail.col' AND NOT g.claimed
  AND NOT EXISTS (SELECT 1 FROM public.pending_credit_grants x
                  WHERE x.email = 'mhnkhandelwal@gmail.com');

UPDATE public.pending_credit_grants g SET email = 'snehaljadho07@gmail.com'
WHERE g.email = 'snehaljadho07@gmai.com' AND NOT g.claimed
  AND NOT EXISTS (SELECT 1 FROM public.pending_credit_grants x
                  WHERE x.email = 'snehaljadho07@gmail.com');

UPDATE public.pending_credit_grants g SET email = 'suraj.rawat59ktd@gmail.com'
WHERE g.email = 'suraj.rawat59ktd@gmai.com' AND NOT g.claimed
  AND NOT EXISTS (SELECT 1 FROM public.pending_credit_grants x
                  WHERE x.email = 'suraj.rawat59ktd@gmail.com');

UPDATE public.pending_credit_grants g SET email = 'manashbaruah848@gmail.com'
WHERE g.email = 'manashbaruah848@gmgmail.com' AND NOT g.claimed
  AND NOT EXISTS (SELECT 1 FROM public.pending_credit_grants x
                  WHERE x.email = 'manashbaruah848@gmail.com');

UPDATE public.pending_credit_grants g SET email = 'saisanket4191@gmail.com'
WHERE g.email = 'saisanket4191@gamail.com' AND NOT g.claimed
  AND NOT EXISTS (SELECT 1 FROM public.pending_credit_grants x
                  WHERE x.email = 'saisanket4191@gmail.com');

-- Any typo'd row that could NOT be corrected because the clean address
-- already holds a grant is a duplicate person. Remove it — one grant each.
DELETE FROM public.pending_credit_grants
WHERE NOT claimed
  AND email IN ('mhnkhandelwal@gmail.col','snehaljadho07@gmai.com',
                'suraj.rawat59ktd@gmai.com','manashbaruah848@gmgmail.com',
                'saisanket4191@gamail.com');

COMMIT;

-- Confirm: should return ZERO rows.
SELECT email, batch_key, claimed
FROM public.pending_credit_grants
WHERE email ~ '@(gmai|gamail|gmgmail|ggmail|gmial)\.com$'
   OR email ~ '\.(con|col|cm|co)$'
ORDER BY email;
