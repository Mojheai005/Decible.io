# NMM VO APP - Production Deployment Plan

## Overview
Target: 1,000-2,000 users, 100 concurrent generations/hour
Platform: Vercel + Supabase + Razorpay

---

## PHASE 1: DATABASE SETUP (Day 1)
**Priority: CRITICAL - Nothing works without this**

### Step 1.1: Run Database Schema
1. Go to Supabase Dashboard > SQL Editor
2. Copy entire contents of `supabase-schema-v2.sql`
3. Run the SQL
4. Verify tables created: `subscription_plans`, `user_profiles`, `saved_voices`, `generation_history`, `credit_transactions`, `payments`, `rate_limits`, `voice_cache`

### Step 1.2: Create Storage Buckets
In Supabase Dashboard > Storage:
```sql
-- Run in SQL Editor
INSERT INTO storage.buckets (id, name, public) VALUES ('generations', 'generations', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies
CREATE POLICY "Users can upload own audio" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'generations' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Public read generations" ON storage.objects
    FOR SELECT USING (bucket_id = 'generations');
CREATE POLICY "Public read avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');
```

### Step 1.3: Enable Auth Providers
In Supabase Dashboard > Authentication > Providers:
- [x] Email (already enabled)
- [ ] Google OAuth (recommended)
- [ ] GitHub OAuth (optional)

---

## PHASE 2: CODE FIXES (Day 1-2)
**Priority: CRITICAL - App will break on Vercel without these**

### Fix 2.1: Remove In-Memory User Voices Store
File: `src/app/api/user/voices/route.ts`

Replace in-memory Map with Supabase calls (see implementation below).

### Fix 2.2: Remove In-Memory Rate Limiter
File: `src/lib/rate-limiter.ts`

Replace with Supabase-based rate limiting (uses `rate_limits` table).

### Fix 2.3: Remove In-Memory Preview Cache
File: `src/app/api/voices/preview/route.ts`

Replace with Redis cache (Upstash already configured).

### Fix 2.4: Fix TypeScript Build
File: `next.config.ts`
```typescript
// Change this:
typescript: { ignoreBuildErrors: true }
// To:
typescript: { ignoreBuildErrors: false }
```
Then fix all TypeScript errors.

### Fix 2.5: Remove Dev Auth Bypass
File: `src/middleware.ts`
Remove the NODE_ENV development fallback.

---

## PHASE 3: CREDIT SYSTEM (Day 2)
**Priority: HIGH - Required for monetization**

### Step 3.1: Pre-Generation Credit Check
Before TTS generation:
1. Get user's credits_remaining from database
2. Calculate credits needed (characters used)
3. If insufficient, return error
4. Deduct credits using `use_credits()` stored procedure
5. Log to `credit_transactions` table

### Step 3.2: Credit Display
- Show credits in header
- Show credits cost before generation
- Show low credits warning

---

## PHASE 4: PAYMENT INTEGRATION (Day 2-3)
**Priority: HIGH - Required for revenue**

### Step 4.1: Razorpay Setup
1. Create Razorpay account (razorpay.com)
2. Get API keys (Test + Live)
3. Add to environment variables:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET`

### Step 4.2: Create Plans in Razorpay
Create subscription plans matching your tiers:
- Starter: ₹395/month
- Creator: ₹795 first month, ₹1,395 after
- Pro: ₹2,195/month
- Advanced: ₹3,495/month

### Step 4.3: API Endpoints Needed
- `POST /api/payments/create-order` - Create Razorpay order
- `POST /api/payments/verify` - Verify payment signature
- `POST /api/payments/webhook` - Handle Razorpay webhooks
- `POST /api/payments/topup` - Credit top-up purchases

---

## PHASE 5: RATE LIMITING (Day 3)
**Priority: HIGH - Prevents abuse**

### DubVoice API Rate Limits
- TTS: 20 requests/minute per key
- Other: 60 requests/minute per key

### Your Rate Limits (per user)
| Plan | Generations/min | Generations/hour |
|------|-----------------|------------------|
| Free | 3 | 30 |
| Starter | 5 | 100 |
| Creator | 10 | 200 |
| Pro | 15 | 400 |
| Advanced | 20 | 600 |

### Implementation
Use `check_rate_limit()` stored procedure in database.

---

## PHASE 6: API KEY SCALING
**Priority: MEDIUM - Needed for 100 concurrent users**

### Current Setup
You have key rotation ready via `DUBVOICE_API_KEYS` env var.

### Action Required
1. Contact DubVoice for additional API keys
2. Request 5 keys minimum (100 req/min capacity)
3. Add to env: `DUBVOICE_API_KEYS=key1,key2,key3,key4,key5`

### Capacity Math
- 5 keys × 20 req/min = 100 TTS requests/minute
- Polling uses same key (doesn't count against limit)
- Voices API uses different keys (60/min each)

---

## PHASE 7: VERCEL DEPLOYMENT (Day 3-4)
**Priority: HIGH**

### Step 7.1: Environment Variables
In Vercel Dashboard > Settings > Environment Variables:

```env
# Supabase (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# DubVoice (REQUIRED)
DUBVOICE_API_KEYS=key1,key2,key3,key4,key5

# Razorpay (REQUIRED)
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx

# Redis/Upstash (REQUIRED)
REDIS_URL=rediss://xxx@xxx.upstash.io:6379

# App Config
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

### Step 7.2: Vercel Settings
- Framework: Next.js (auto-detected)
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`
- Node.js Version: 18.x or 20.x

### Step 7.3: Domain Setup
1. Add custom domain in Vercel
2. Configure DNS (CNAME to cname.vercel-dns.com)
3. SSL auto-configured

---

## PHASE 8: SECURITY HARDENING (Day 4)
**Priority: HIGH**

### Step 8.1: Rotate Exposed Keys
Your .env.local was visible - rotate these immediately:
- [ ] Supabase anon key (regenerate in dashboard)
- [ ] Supabase service role key
- [ ] DubVoice API key
- [ ] Redis URL/password

### Step 8.2: Add Security Headers
Create `src/middleware.ts` security headers:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

### Step 8.3: CORS Configuration
Restrict API access to your domain only.

---

## PHASE 9: MONITORING (Day 4-5)
**Priority: MEDIUM**

### Step 9.1: Error Tracking
1. Create Sentry account (sentry.io)
2. Install: `npm install @sentry/nextjs`
3. Configure with your DSN

### Step 9.2: Analytics
1. Vercel Analytics (built-in)
2. OR PostHog/Mixpanel for detailed tracking

### Step 9.3: Uptime Monitoring
1. Setup UptimeRobot or Better Uptime
2. Monitor: homepage, /api/voices, /api/tts

---

## PHASE 10: LAUNCH CHECKLIST

### Pre-Launch (T-1 day)
- [ ] All env vars set in Vercel
- [ ] Database schema deployed
- [ ] Storage buckets created
- [ ] Auth providers configured
- [ ] Razorpay webhooks configured
- [ ] Domain configured
- [ ] SSL working
- [ ] Keys rotated

### Launch Day Testing
- [ ] Sign up flow works
- [ ] Google OAuth works (if enabled)
- [ ] Voice library loads
- [ ] TTS generation works
- [ ] Credits deduct correctly
- [ ] My Voices saves/persists
- [ ] History saves/persists
- [ ] Payment flow works (test mode)
- [ ] Subscription upgrades work

### Post-Launch Monitoring
- [ ] Check Vercel function logs
- [ ] Check Supabase logs
- [ ] Monitor error rates
- [ ] Monitor API usage
- [ ] Check rate limit hits

---

## COST ESTIMATES (Monthly)

### Infrastructure
| Service | Plan | Cost |
|---------|------|------|
| Vercel | Pro | $20/month |
| Supabase | Pro | $25/month |
| Upstash Redis | Pay-as-you-go | ~$5/month |
| Sentry | Team | $26/month |
| **Total** | | **~$76/month** |

### DubVoice API
Depends on your usage and their pricing.
With 2000 users × 5000 chars avg = 10M chars/month

---

## SCALING CONSIDERATIONS

### For 5,000+ Users
- Upgrade Supabase to Pro
- Add more API keys (10+)
- Consider CDN for audio files
- Add Redis caching for voices

### For 10,000+ Users
- Implement proper queue system
- Add multiple Redis instances
- Consider dedicated DB
- Add load balancing

---

## EMERGENCY CONTACTS

- Vercel Support: support.vercel.com
- Supabase Support: support.supabase.com
- DubVoice: (your contact)
- Razorpay: dashboard support

---

## FILES TO MODIFY

1. `src/app/api/user/voices/route.ts` - Use Supabase
2. `src/app/api/tts/route.ts` - Add credit check
3. `src/lib/rate-limiter.ts` - Use Supabase
4. `src/middleware.ts` - Fix auth + security
5. `next.config.ts` - Fix TypeScript setting
6. NEW: `src/app/api/payments/*` - Razorpay routes
7. NEW: `src/lib/supabase-server.ts` - Server client
8. NEW: `src/components/PaymentModal.tsx` - Payment UI
