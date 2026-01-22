# NMM VO APP - Production Deployment Guide

Complete step-by-step guide to deploy the NMM Voice Over App to production.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Razorpay Setup](#razorpay-setup)
4. [Environment Variables](#environment-variables)
5. [Vercel Deployment](#vercel-deployment)
6. [Post-Deployment Checklist](#post-deployment-checklist)
7. [Monitoring & Analytics](#monitoring--analytics)

---

## Prerequisites

Before starting, ensure you have:

- [ ] GitHub account with this repo
- [ ] Supabase account (free tier works)
- [ ] Razorpay account (sign up at razorpay.com)
- [ ] Vercel account (free tier works)
- [ ] DubVoice API keys (multiple recommended for load distribution)
- [ ] Domain name (optional but recommended)

---

## Supabase Setup

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Enter project details:
   - **Name:** `nmm-vo-app` (or your preferred name)
   - **Database Password:** Generate a strong password and save it
   - **Region:** Choose closest to your users (e.g., `Mumbai` for India)
4. Click **"Create new project"** and wait for setup (~2 minutes)

### Step 2: Get Your API Keys

1. In your Supabase dashboard, go to **Settings > API**
2. Copy these values (you'll need them later):

```
Project URL: https://xxxxxxxxxxxx.supabase.co
Anon/Public Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (⚠️ Keep secret!)
```

### Step 3: Run the Database Schema

1. Go to **SQL Editor** in Supabase dashboard
2. Click **"New Query"**
3. Copy the ENTIRE contents of `supabase-schema-production.sql`
4. Paste into the SQL editor
5. Click **"Run"** (this may take 30-60 seconds)
6. Verify: You should see tables created in **Table Editor**

**Expected Tables:**
- `subscription_plans` (5 rows with your pricing)
- `topup_packages` (6 rows)
- `user_profiles`
- `saved_voices`
- `generation_history`
- `credit_transactions`
- `payment_orders`
- `payments`
- `voice_cache`
- `rate_limits`
- `analytics_events`
- `referrals`

### Step 4: Configure Authentication

1. Go to **Authentication > Providers**
2. Enable **Email** provider (enabled by default)
3. (Optional) Enable **Google** OAuth:
   - Get OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/)
   - Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
   - Enter Client ID and Secret in Supabase

4. Go to **Authentication > URL Configuration**
   - Set **Site URL:** `https://your-domain.com` (your production domain)
   - Add **Redirect URLs:**
     - `https://your-domain.com/auth/callback`
     - `http://localhost:3000/auth/callback` (for local dev)

### Step 5: Create Storage Buckets

1. Go to **Storage** in Supabase dashboard
2. Create bucket: `generations`
   - Make it **Public** (for audio file access)
3. Create bucket: `avatars`
   - Make it **Public**

4. Add storage policies (SQL Editor):

```sql
-- Allow authenticated users to upload to generations
CREATE POLICY "Users can upload audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'generations' AND auth.role() = 'authenticated');

-- Allow public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id IN ('generations', 'avatars'));
```

### Step 6: Set Up Scheduled Functions (Optional)

For automatic cleanup and monthly resets, set up Edge Functions or use pg_cron:

1. Go to **SQL Editor** and run:

```sql
-- Enable pg_cron extension (if available on your plan)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 3 AM UTC
SELECT cron.schedule('cleanup-rate-limits', '0 3 * * *', $$SELECT cleanup_rate_limits()$$);
SELECT cron.schedule('reset-daily-usage', '0 0 * * *', $$SELECT reset_daily_usage()$$);

-- Schedule monthly credit reset on 1st at 1 AM UTC
SELECT cron.schedule('reset-monthly-credits', '0 1 1 * *', $$SELECT reset_monthly_credits()$$);
```

---

## Razorpay Setup

### Step 1: Create Razorpay Account

1. Go to [razorpay.com](https://razorpay.com) and sign up
2. Complete KYC verification (required for live mode)
3. Wait for account activation (usually 1-2 business days)

### Step 2: Get API Keys

1. Go to **Settings > API Keys**
2. Generate **Test Mode** keys first (for development)
3. After testing, generate **Live Mode** keys

```
Key ID: rzp_test_xxxxxxxxxxxx (test) or rzp_live_xxxxxxxxxxxx (live)
Key Secret: xxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 3: Set Up Webhooks

1. Go to **Settings > Webhooks**
2. Click **"Add New Webhook"**
3. Configure:
   - **Webhook URL:** `https://your-domain.com/api/payments/webhook`
   - **Secret:** Generate a secret and save it
   - **Active Events:**
     - `payment.captured`
     - `payment.failed`
     - `order.paid`
4. Save and copy the **Webhook Secret**

### Step 4: Configure Checkout

Your checkout is already configured in the code. The Razorpay checkout modal will appear when users click payment buttons.

---

## Environment Variables

Create a `.env.local` file for local development and add these to Vercel for production:

### Required Variables

```bash
# ===========================================
# SUPABASE
# ===========================================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ===========================================
# DUBVOICE API (Multiple keys for load distribution)
# ===========================================
DUBVOICE_API_KEY=sk_your_primary_key
DUBVOICE_API_KEY_1=sk_your_key_1
DUBVOICE_API_KEY_2=sk_your_key_2
DUBVOICE_API_KEY_3=sk_your_key_3

# ===========================================
# RAZORPAY
# ===========================================
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# ===========================================
# APP CONFIG
# ===========================================
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

### Variable Reference

| Variable | Where to Get | Notes |
|----------|--------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Settings > API | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Settings > API | Safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API | ⚠️ Keep secret! |
| `DUBVOICE_API_KEY` | DubVoice Dashboard | Primary key |
| `DUBVOICE_API_KEY_1-3` | DubVoice Dashboard | Additional keys |
| `RAZORPAY_KEY_ID` | Razorpay > Settings > API | Use live for production |
| `RAZORPAY_KEY_SECRET` | Razorpay > Settings > API | ⚠️ Keep secret! |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay > Webhooks | ⚠️ Keep secret! |

---

## Vercel Deployment

### Step 1: Connect Repository

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel will detect Next.js automatically

### Step 2: Configure Project

1. **Framework Preset:** Next.js (auto-detected)
2. **Root Directory:** `./` (default)
3. **Build Command:** `npm run build` (default)
4. **Output Directory:** `.next` (default)

### Step 3: Add Environment Variables

1. In project settings, go to **Settings > Environment Variables**
2. Add each variable from the Environment Variables section above
3. Set each to apply to **Production**, **Preview**, and **Development**

⚠️ **Important:** For `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`:
- These should ONLY be added to Vercel, never committed to code
- Mark them as "Sensitive" if the option is available

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for build to complete (~2-3 minutes)
3. Your app will be live at `your-project.vercel.app`

### Step 5: Custom Domain (Recommended)

1. Go to **Settings > Domains**
2. Add your domain: `your-domain.com`
3. Follow DNS configuration instructions:
   - Add CNAME record pointing to `cname.vercel-dns.com`
   - Or add A record for apex domains
4. Enable HTTPS (automatic with Vercel)

### Step 6: Update Supabase URLs

After getting your production domain:

1. Go to Supabase > **Authentication > URL Configuration**
2. Update **Site URL** to `https://your-domain.com`
3. Add redirect URL: `https://your-domain.com/auth/callback`

---

## Post-Deployment Checklist

### Critical Checks

- [ ] **Authentication works:** Sign up and login flow
- [ ] **Database connected:** User profiles created on signup
- [ ] **Payments work:** Test with Razorpay test mode first
- [ ] **Voice generation works:** Generate audio successfully
- [ ] **Credits deducted:** Credits decrease after generation
- [ ] **Webhook receiving:** Check Razorpay webhook logs

### Security Checks

- [ ] All secret keys are in Vercel, not in code
- [ ] HTTPS enabled on all domains
- [ ] Security headers working (check with securityheaders.com)
- [ ] Rate limiting working
- [ ] RLS policies active in Supabase

### Functionality Tests

1. **Signup Flow:**
   - Create new account
   - Verify email (if enabled)
   - Check user profile created with 5000 credits

2. **Payment Flow:**
   - Select a plan
   - Complete Razorpay checkout
   - Verify credits added
   - Check subscription tier updated

3. **Generation Flow:**
   - Select a voice
   - Generate audio
   - Verify audio plays
   - Check credits deducted
   - Check history saved

4. **Top-up Flow:**
   - (Only for paid users)
   - Purchase credits
   - Verify credits added

---

## Monitoring & Analytics

### Vercel Analytics

1. Go to your project in Vercel
2. Enable **Analytics** tab
3. Monitor:
   - Page views
   - Performance metrics
   - Error rates

### Supabase Dashboard

1. **Database > Reports:**
   - Query performance
   - Database size
   - Connection usage

2. **Authentication:**
   - Active users
   - Sign-up rate
   - Auth errors

### Razorpay Dashboard

1. **Payments:**
   - Transaction history
   - Success/failure rates
   - Revenue tracking

2. **Webhooks:**
   - Delivery status
   - Failed webhooks (retry if needed)

### Custom Analytics (Built-in)

The schema includes an `analytics_events` table. Log important events:

```typescript
// Example: Log in your API routes
await admin.from('analytics_events').insert({
    user_id: userId,
    event_type: 'generation',
    event_name: 'voice_generated',
    event_data: { voice_id, characters, credits_used }
});
```

Query analytics in Supabase:

```sql
-- Daily generations
SELECT DATE(created_at) as date, COUNT(*) as generations
FROM analytics_events
WHERE event_name = 'voice_generated'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Revenue by plan
SELECT plan_id, SUM(amount)/100 as revenue_inr
FROM payments
WHERE status = 'captured'
GROUP BY plan_id;
```

---

## Pricing Summary

| Plan | Monthly Price | Credits | Top-up Rate | Voice Slots |
|------|---------------|---------|-------------|-------------|
| Free | ₹0 | 5,000 | N/A | 5 |
| Starter | ₹395 | 35,000 | ₹16.80/1K | 10 |
| Creator | ₹795* / ₹1,395 | 150,000 | ₹12.20/1K | 20 |
| Pro | ₹2,195 | 500,000 | ₹9.65/1K | 30 |
| Advanced | ₹3,495 | 1,000,000 | ₹6.50/1K | 50 |

*First month promotional pricing for Creator plan

---

## Troubleshooting

### Common Issues

**1. "Authentication required" errors:**
- Check Supabase URL and keys are correct
- Verify redirect URLs in Supabase match your domain

**2. Payments not processing:**
- Check Razorpay keys (test vs live mode)
- Verify webhook URL is accessible
- Check webhook secret matches

**3. Credits not deducting:**
- Check `use_credits` function exists in database
- Verify user has sufficient credits

**4. Generation failing:**
- Check DubVoice API keys are valid
- Check rate limits not exceeded

### Getting Help

- Check Vercel deployment logs
- Check Supabase Postgres logs
- Check Razorpay webhook logs
- Review browser console for client errors

---

## Support

For issues with:
- **Supabase:** [supabase.com/docs](https://supabase.com/docs)
- **Razorpay:** [razorpay.com/docs](https://razorpay.com/docs)
- **Vercel:** [vercel.com/docs](https://vercel.com/docs)
- **DubVoice:** Contact DubVoice support

---

**Deployment Complete!** 🎉

Your NMM Voice Over App is now live and ready for users.
