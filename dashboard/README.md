# Decible Support Dashboard

A password-protected internal site for the support team, meant to live at **dashboard.decible.io**.
It lives in the `dashboard/` folder of the Decible repo but is a separate app with its own
`package.json`: it shares the Supabase database with decible.io, nothing else. The main app's
`tsconfig.json` excludes this folder, so the two never build each other.

**The repo is public: never put the password or keys in any file here.** They live only in Vercel's
environment variables (and in your own gitignored `.env.local`).

## What it does

1. **Look up account**: type an email and see the plan and its dates, credits, how they sign in (and
   whether their email is confirmed), every generation with the success rate and failure reasons,
   payments, grants, and accounts or course grants on look-alike emails (typos, second accounts).
   The top box explains in plain English what is wrong and what to tell the user.
2. **Grant 500k + Pro**: gives 500,000 credits and Pro for 30 days, the same way a course purchase
   does. Press *Check* first to see exactly what will happen. It refuses when:
   - the account is already on an active Pro or Advanced plan,
   - the person already received the course bonus (course purchase or an earlier manual grant),
   - more than one account matches the email.

   If there is no account yet, it saves a *waiting* grant that applies the moment they sign up with
   that exact email. If their course grant is stuck on a typo of their email (gmai.com, gamil.com...),
   it offers **Move it here** instead of a new grant. The database itself allows only one manual
   grant per email, and the dashboard makes at most `GRANT_DAILY_LIMIT` grants a day (default 40).
   Every grant records who made it and why.
3. **Escalate a problem**: file anything that needs a developer, with the user's email, contact and a
   description. A snapshot of the account at that moment is saved with it. Cases can be marked
   *I'm on it* / *Resolved* and get signed notes.

The strip at the top shows whether Smallest, Fish and Gemini voices are working, based on the last hour
of generations.

## Run it on your computer

```
npm install
copy .env.example .env.local    # then fill in the values
npm run build
npm start                       # http://localhost:3100
```

Set `ESCALATION_STORE=file` in `.env.local` to keep test escalations in a local `.escalations` folder.

## Put it live on dashboard.decible.io (Vercel)

It is a **second Vercel project** connected to the same GitHub repo, with **Root Directory = `dashboard`**.
The main decible.io project is not changed. In the Vercel website: Add New → Project → import the
Decible repo → set Root Directory to `dashboard` → add the environment variables below → Deploy →
Settings → Domains → add `dashboard.decible.io`.

Or from the `dashboard` folder, in a terminal:

```
npx vercel login
npx vercel link                 # create a NEW project, e.g. "decible-dashboard"
npx vercel env add SUPABASE_URL production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add DASHBOARD_PASSWORD production
npx vercel env add SESSION_SECRET production
npx vercel --prod
npx vercel domains add dashboard.decible.io
```

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: same values as the main Decible app.
- `DASHBOARD_PASSWORD`: a long password (20+ characters) that you share with the support team.
- `SESSION_SECRET`: a random string; make one with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
  Changing it logs everyone out.
- Optional: `GRANT_DAILY_LIMIT`, `ESCALATION_WEBHOOK_URL` (Slack, Discord or Google Chat webhook that is
  pinged on every new escalation).

**DNS:** if decible.io's DNS is managed in Vercel, the domain works right away. Otherwise add a
`CNAME` record at the domain registrar: name `dashboard`, value `cname.vercel-dns.com`.

## Security notes

- The service-role key is only used on the server; the browser never sees it.
- Login is one shared password plus the person's name. The session is a signed, HTTP-only cookie that
  lasts 7 days. Five wrong passwords lock an address out for 15 minutes.
- To remove someone's access: change `DASHBOARD_PASSWORD` and `SESSION_SECRET` in Vercel and redeploy.
- The site tells search engines not to index it and cannot be embedded in other sites.

## Where escalations are stored

Nobody can run SQL on the Supabase project right now, so escalations are JSON files in a **private**
Supabase Storage bucket, `support-escalations` (folder `cases/`). The bucket is created automatically
with the first escalation. Each file holds the problem, who filed it, the account snapshot and the notes.
