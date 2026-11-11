# Support dashboard: decible.io/dashboard

A password-protected page for the Decible team, built into the main site. Anyone on the team opens
**decible.io/dashboard** and enters the team password; nothing else is asked, and any number of people
can be logged in at once. Each person can type their name in the box at the top (remembered in their
browser); it is written on the grants and escalations they make. Left blank, they show as "Team".

## What it does

1. **Look up account**: type an email and see the plan and its dates, credits, how they sign in (and
   whether their email is confirmed), every generation with the success rate and failure reasons,
   payments, grants, and accounts or course grants on look-alike emails (typos, second accounts).
   The top box explains in plain English what is wrong and what to tell the user.
2. **Grant 500k + Pro**: 500,000 credits and Pro for 30 days, the same way a course purchase does.
   *Check* first shows exactly what will happen. It refuses accounts already on an active Pro or
   Advanced plan, people who already got the course bonus, and emails matching several accounts.
   With no account yet, it saves a grant that applies when they sign up with that exact email. If
   their course grant is stuck on a typo of their email, it offers **Move it here**. The database
   allows one manual grant per email; the dashboard makes at most `GRANT_DAILY_LIMIT` (default 40) a day.
3. **Escalate a problem**: the user's email, contact and the problem, saved with a snapshot of the
   account. Cases get signed notes and can be marked *I'm on it* / *Resolved*.

The strip at the top shows whether Smallest, Fish and Gemini voices are working (last hour of generations).

## The password

The repo is public, so the password is never in the code. It is checked against, in order:

1. `DASHBOARD_PASSWORD`, if that environment variable is set in Vercel, otherwise
2. a scrypt hash in the **private** Supabase Storage bucket `support-escalations`
   (`config/dashboard-auth.json`). To change it, from the repo folder:

   ```
   node scripts/set-dashboard-password.mjs "the new password"
   ```

Changing the password logs everyone out within a minute. Sessions last 7 days. Ten wrong passwords from
one address lock that address out for 10 minutes.

## Where things live

- Pages and API: `src/app/dashboard/` (API under `/dashboard/api/...`, login cookie limited to `/dashboard`).
- Server code: `src/lib/support-dashboard/` (uses `SUPABASE_SERVICE_ROLE_KEY`; server only).
- Styles: `src/app/dashboard/dashboard.css`, all scoped to the `.dd` wrapper, so the rest of the site is untouched.
- Escalations: one JSON file per case in the private bucket `support-escalations` (`cases/`); the bucket
  is created automatically. Set `ESCALATION_STORE=file` to keep them in a local `.escalations` folder
  when running on your own computer.
- Optional settings: `GRANT_DAILY_LIMIT`, `ESCALATION_WEBHOOK_URL` (Slack / Discord / Google Chat
  webhook pinged on new escalations), `DASHBOARD_SESSION_SECRET`.
- `robots.txt` disallows `/dashboard`, and the pages carry `noindex`.
