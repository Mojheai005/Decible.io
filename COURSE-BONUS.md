# Course Buyer Bonus — 500,000 Free Credits

> **What this is:** every buyer of the course automatically receives **500,000 Decible credits** (≈ 500,000 characters of voice generation) on their Decible account — linked to the **email they bought the course with**. There are no coupon codes, no links to share, nothing that can leak. The gift exists only for that email.

---

## 1. How it works (the whole flow)

```
Course sale                      Decible backend                      Buyer
───────────                      ───────────────                      ─────
Buyer pays for course
        │
        ▼
Purchase email is added   ──►   course_entitlements table
to the allowlist                (email, 500000 credits,
(API call or manual)             granted = false)
                                        │
                                        │   Buyer signs up / logs in
                                        │   on decible.io with the
                                        │   SAME email  ◄──────────────  Buyer
                                        ▼
                                Automatic check on login:
                                is this email entitled and
                                not yet granted?
                                        │ yes (exactly once)
                                        ▼
                                +500,000 credits added
                                row marked granted = true   ──────►  Credits appear
                                                                     instantly; history
                                                                     shows "Course buyer
                                                                     bonus — welcome!"
```

**Key property — one email, one gift, ever:**
- The email is the table's **primary key** → the database cannot hold the same email twice.
- Re-adding an email that already exists is **ignored** (it never re-arms a used gift, even if the purchase webhook fires twice).
- The claim is **atomic**: the row flips `granted: false → true` in a single database operation. Two simultaneous logins cannot both win; the credits are granted exactly once, forever.
- The buyer must **verify the email** (Supabase sends a confirmation link) — knowing someone else's email is useless without access to the inbox.

---

## 2. One-time setup (do this first)

Run the SQL in [`course-buyers.sql`](./course-buyers.sql) once, in the
**Supabase Dashboard → SQL Editor** of the production project. It creates the
`course_entitlements` table with row-level security locked to the backend only
(users can never see or query the allowlist).

Until this SQL runs, the feature is dormant and harmless — the site works
normally and no bonus is granted.

---

## 3. Adding a buyer (after each course sale)

Every management action uses one secret header:

- Header name: `x-admin-secret`
- Header value: the `ADMIN_API_SECRET` — stored in **Vercel → decible-io →
  Settings → Environment Variables**. Never commit it to the repo, never put
  it in client-side code, never share it publicly. Treat it like a password.

### Add one buyer

```bash
curl -X POST https://www.decible.io/api/admin/course-buyers \
  -H "x-admin-secret: <ADMIN_API_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"email": "buyer@example.com", "note": "order #1234"}'
```

Response:

```json
{ "success": true, "added": ["buyer@example.com"], "alreadyPresent": [], "credits": 500000 }
```

### Add many buyers at once

```bash
curl -X POST https://www.decible.io/api/admin/course-buyers \
  -H "x-admin-secret: <ADMIN_API_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"emails": ["a@example.com", "b@example.com"], "note": "July batch"}'
```

### Custom gift size (optional)

The default is 500,000. To grant a different amount for specific buyers:

```bash
  -d '{"email": "vip@example.com", "credits": 1000000}'
```

(The amount is fixed at the moment the email is added; it does not affect
already-added emails.)

### List entitlements / check who has claimed

```bash
# everything (latest 200)
curl https://www.decible.io/api/admin/course-buyers \
  -H "x-admin-secret: <ADMIN_API_SECRET>"

# only unclaimed
curl "https://www.decible.io/api/admin/course-buyers?granted=false" \
  -H "x-admin-secret: <ADMIN_API_SECRET>"

# only claimed
curl "https://www.decible.io/api/admin/course-buyers?granted=true" \
  -H "x-admin-secret: <ADMIN_API_SECRET>"
```

Each row shows: `email`, `credits`, `granted` (claimed or not), `granted_at`,
`note`, `created_at`.

### Remove an entitlement (e.g. refund, wrong email)

```bash
curl -X DELETE https://www.decible.io/api/admin/course-buyers \
  -H "x-admin-secret: <ADMIN_API_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"email": "buyer@example.com"}'
```

> Removing an entitlement that was **already claimed** does not take the
> credits back from the user's balance — it only deletes the record. Clawing
> back credits after a refund is a manual decision (see §6).

---

## 3b. Adding buyers manually with SQL (no curl needed)

If you prefer working directly in the **Supabase Dashboard → SQL Editor**,
paste your buyer list like this:

```sql
INSERT INTO course_entitlements (email)
VALUES
  (lower('buyer1@gmail.com')),
  (lower('buyer2@yahoo.com')),
  (lower('buyer3@outlook.com'))
ON CONFLICT (email) DO NOTHING;
```

- `lower(...)` keeps matching reliable (claims are matched in lowercase).
- `ON CONFLICT ... DO NOTHING` makes re-pasting the same list completely safe —
  existing entries (claimed or not) are never modified, so nobody can ever be
  double-gifted.

Check status any time:

```sql
SELECT email, credits, granted, granted_at
FROM course_entitlements ORDER BY created_at DESC;
```

Remove a mistaken entry:

```sql
DELETE FROM course_entitlements WHERE email = lower('wrong@example.com');
```

## 4. Automating it (recommended)

Instead of running curl after every sale, point the course platform's
**purchase webhook** at the endpoint. Any platform that can send an HTTP POST
on purchase works (Razorpay Payment Pages, Graphy, Teachable, a Zapier /
Make.com step, or your own checkout backend):

- URL: `https://www.decible.io/api/admin/course-buyers`
- Method: `POST`
- Headers: `x-admin-secret: <ADMIN_API_SECRET>`, `Content-Type: application/json`
- Body: `{ "email": "<buyer email from the purchase event>", "note": "<order id>" }`

Duplicate webhook deliveries are safe — an email that already exists is simply
reported as `alreadyPresent` and nothing changes.

---

## 5. What the buyer experiences

1. They buy the course with `their@email.com`.
2. They go to **decible.io** and **sign up (or log in) with that exact same
   email** — Google sign-in with that address also works, since it verifies the
   same email.
3. The moment their dashboard loads, their balance includes the extra
   **500,000 credits**, and their credit history shows a `bonus` entry:
   *“Course buyer bonus — welcome!”*
4. That's it. Nothing to enter, nothing to redeem.

**Tell buyers this one rule:** *sign up with the same email you bought the
course with.* `name+tag@gmail.com` and `name@gmail.com` are different emails to
the system — the address must match exactly.

---

## 6. Edge cases & troubleshooting

| Situation | What happens / what to do |
|---|---|
| Buyer already has a Decible account with that email | Works — the bonus is granted on their **next login**, no new account needed. |
| Buyer signed up with a different email than the purchase | No bonus (by design). Fix: `DELETE` the wrong email, `POST` the correct one (assuming the gift wasn't claimed). |
| Same email tries to claim twice / logs in on two devices at once | Impossible to double-claim — atomic one-time flip (§1). |
| Webhook fires twice for one sale | Safe — second call is ignored (`alreadyPresent`). |
| Buyer bought the course twice with the same email | Still one gift — one email can ever hold one entitlement. |
| Refund after the gift was claimed | Credits stay on the account unless you claw them back manually: in Supabase SQL editor, `SELECT add_credits('<user_id>', -500000, 'adjustment', 'Course refund clawback', 'course_refund');` (the user id is in `course_entitlements.granted_user_id`). |
| Email added before the SQL setup ran | The add call fails with an error — run §2 first. |
| The gift is claimed but user says they see nothing | Ask them to refresh / re-login; check `GET ?granted=true` to confirm the claim, and the `credit_transactions` table for the `bonus` entry. |

---

## 7. Security model (why this can't spread like a coupon)

- **Nothing public exists.** There is no code, link, or token to share. The
  allowlist lives in a database table protected by row-level security with *no*
  read policies — only the backend service role can touch it.
- **The management API requires a secret** that lives only in Vercel's
  environment variables. Without the header, every request gets `401`.
- **The gift binds to inbox ownership,** not to knowledge of an email address.
  Claiming requires signing into Decible with that email — which requires
  clicking a verification link sent to it.
- **Even a leaked buyer list wouldn't multiply costs**: each listed email can
  produce at most one grant, to the person who controls that inbox — which is
  the buyer, who was entitled anyway.

---

## 8. Technical reference (for developers)

| Piece | Where |
|---|---|
| Table + setup SQL | [`course-buyers.sql`](./course-buyers.sql) → `course_entitlements` |
| Grant logic (atomic claim + rollback on failure) | [`src/lib/course-bonus.ts`](./src/lib/course-bonus.ts) |
| Trigger point (runs on every login/profile load) | [`src/app/api/user/profile/route.ts`](./src/app/api/user/profile/route.ts) (GET) |
| Admin API (add / list / remove) | [`src/app/api/admin/course-buyers/route.ts`](./src/app/api/admin/course-buyers/route.ts) |
| Secret | `ADMIN_API_SECRET` env var (Vercel + `.env.local`) |
| Credits ledger entry | `credit_transactions` row, `type = 'bonus'`, `reference_id = course_<email>` |

Failure behavior: if the credits RPC fails after a claim, the claim is rolled
back so the next login retries. If the table doesn't exist, everything fails
soft (logged, site unaffected).
