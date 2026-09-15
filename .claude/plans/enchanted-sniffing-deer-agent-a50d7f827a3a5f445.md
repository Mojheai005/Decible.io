# NMM VO APP -- Implementation Plan for 3 Features/Fixes

**Date:** 2026-04-04  
**Scope:** Feature 1 (Script to Voice), Fix 2 (Yearly Billing), Fix 3 (Credit System)  
**Execution Model:** Research -> Codebase Analysis -> Implement -> Test per feature

---

## Table of Contents

1. [Phase 1: Fix 2 -- Yearly Payment Plan (Smallest Scope, Fastest Win)](#phase-1-fix-2----yearly-payment-plan)
2. [Phase 2: Fix 3 -- Credit System Real-time Updates + Refund Logic](#phase-2-fix-3----credit-system)
3. [Phase 3: Feature 1 -- Script to Voice (Batch TTS)](#phase-3-feature-1----script-to-voice)
4. [Dependency Graph](#dependency-graph)
5. [Risk Register](#risk-register)

---

## Recommended Execution Order

The features should be implemented in this order:
1. **Fix 2 (Yearly Billing)** -- Smallest blast radius, entirely self-contained, unblocks revenue.
2. **Fix 3 (Credit System)** -- Fixes foundational credit infrastructure needed by Feature 1.
3. **Feature 1 (Script to Voice)** -- Largest feature; depends on correct credit deduction from Fix 3.

---

## Phase 1: Fix 2 -- Yearly Payment Plan

### 1.1 Problem Statement

The billing toggle in `Subscription.tsx` renders monthly and yearly prices, but clicking "Upgrade" on yearly ALWAYS charges the monthly price. The `billingPeriod` state is never passed down the call chain, and the backend has no concept of billing period at all.

### 1.2 Research Topics

- **Razorpay recurring payments:** Razorpay supports Subscriptions API with `period: "yearly"` and `period: "monthly"`. However, the current app uses one-time Orders (not Razorpay Subscriptions). Decision: keep using one-time Orders but vary the amount and store the billing period. Razorpay Subscriptions could be a future enhancement.
- **Yearly pricing models in SaaS:** Standard pattern is `monthlyPrice * 12 * (1 - discount)`. The app uses 20% discount.
- **Database migration patterns for Supabase:** Use `ALTER TABLE ... ADD COLUMN` via SQL Editor. No ORM migrations are in use.

### 1.3 Root Cause Analysis (confirmed from code)

The bug chain is:

```
Subscription.tsx: billingPeriod state exists, UI toggle works
    -> line 34: handleUpgrade(planId) -- does NOT pass billingPeriod
    -> line 35: initiatePayment(planId, 'subscription') -- no billingPeriod param
usePayment.ts: line 61: initiatePayment(planId, orderType)
    -> line 77: body = { type: orderType, planId } -- no billingPeriod
/api/payments/create-order: line 35: CreateOrderRequest has no billingPeriod field
    -> line 103: amount = getEffectivePrice(plan, isFirstMonth) -- always monthly
/api/payments/verify: line 140: updates subscription_tier but NOT subscription_end_date
    -> no billing_period stored anywhere
```

### 1.4 Implementation Steps

#### Step 1: Add yearly pricing to `src/lib/pricing.ts`

Add `priceYearly` and `priceYearlyUSD` fields to the `SubscriptionPlan` interface and populate them for all plans.

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/src/lib/pricing.ts`

Changes:
- Add to `SubscriptionPlan` interface (after line 19):
  ```
  priceYearly: number;      // in paise (annual total, already discounted)
  priceYearlyUSD: number;    // in cents
  ```
- For each plan object, add the yearly prices:
  - `starter`: `priceYearly: 29900 * 12 * 0.8 = 287040`, `priceYearlyUSD: 400 * 12 * 0.8 = 3840`
  - `creator`: `priceYearly: 69900 * 12 * 0.8 = 671040`, `priceYearlyUSD: 900 * 12 * 0.8 = 8640`
  - `pro`: `priceYearly: 199900 * 12 * 0.8 = 1919040`, `priceYearlyUSD: 2500 * 12 * 0.8 = 24000`
  - `advanced`: `priceYearly: 299900 * 12 * 0.8 = 2879040`, `priceYearlyUSD: 3700 * 12 * 0.8 = 35520`
  - `free`: `priceYearly: 0`, `priceYearlyUSD: 0`
- Add helper function:
  ```typescript
  export function getPlanYearlyPrice(plan: SubscriptionPlan, currency: Currency): number {
      return currency === 'USD' ? plan.priceYearlyUSD : plan.priceYearly;
  }
  ```

#### Step 2: Update `usePayment.ts` to accept `billingPeriod`

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/src/hooks/usePayment.ts`

Changes:
- Line 36: Change `initiatePayment` signature to `(planId: string, orderType?: string, billingPeriod?: 'monthly' | 'yearly')`
- Line 61: Update useCallback to accept billingPeriod parameter
- Line 77: Add `billingPeriod` to the request body:
  ```typescript
  body: JSON.stringify({ type: orderType, planId, billingPeriod: billingPeriod || 'monthly' }),
  ```

#### Step 3: Update `Subscription.tsx` to pass `billingPeriod`

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/components/views/Subscription.tsx`

Changes:
- Line 34-36: Change `handleUpgrade` to pass billing period:
  ```typescript
  const handleUpgrade = async (planId: string) => {
      await initiatePayment(planId, 'subscription', billingPeriod);
  };
  ```

#### Step 4: Update `/api/payments/create-order/route.ts` backend

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/src/app/api/payments/create-order/route.ts`

Changes:
- Line 33: Add `billingPeriod` to `CreateOrderRequest` interface:
  ```typescript
  interface CreateOrderRequest {
      type: 'subscription' | 'topup' | 'upgrade';
      planId?: string;
      topupPackageId?: string;
      billingPeriod?: 'monthly' | 'yearly';
  }
  ```
- Line 69: Extract billingPeriod from body:
  ```typescript
  const { type, planId, topupPackageId, billingPeriod } = body;
  ```
- Lines 78-105: For subscription/upgrade type, calculate correct amount based on billing period:
  ```typescript
  if (billingPeriod === 'yearly') {
      amount = getPlanYearlyPrice(plan, 'INR');  // import new helper
      description = `${plan.displayName} Plan - Annual`;
  } else {
      const isFirstMonth = userProfile.subscription_tier === 'free' && plan.id === 'creator';
      amount = getEffectivePrice(plan, isFirstMonth);
      description = `${plan.displayName} Plan${isFirstMonth ? ' (First Month Special)' : ''}`;
  }
  ```
- Add `billingPeriod` to Razorpay order notes (line 159):
  ```typescript
  notes: {
      ...existing,
      billingPeriod: billingPeriod || 'monthly',
  }
  ```
- Add `billing_period` to the DB insert (line 169):
  ```typescript
  billing_period: billingPeriod || 'monthly',
  ```

#### Step 5: Update `/api/payments/verify/route.ts` backend

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/src/app/api/payments/verify/route.ts`

Changes:
- After line 92 (fetching order), extract billing_period from the order:
  ```typescript
  const orderData = order as {
      id: string; status: string; credits: number;
      plan_id: string; billing_period: string;
  };
  ```
- After line 139 (tier update), set `subscription_end_date` based on billing period:
  ```typescript
  const endDate = new Date();
  if (orderData.billing_period === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
      endDate.setMonth(endDate.getMonth() + 1);
  }
  
  await admin
      .from('user_profiles')
      .update({
          subscription_tier: newTier,
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: endDate.toISOString(),
          billing_period: orderData.billing_period || 'monthly',
      })
      .eq('id', user.id);
  ```
- For yearly subscriptions, multiply the credits by 12 (since yearly gives 12 months of credits upfront):
  ```typescript
  const creditsToAdd = orderData.billing_period === 'yearly'
      ? orderData.credits * 12
      : orderData.credits;
  ```

#### Step 6: Database migration (Supabase SQL)

Run in Supabase SQL Editor:
```sql
-- Add billing_period to payment_orders
ALTER TABLE payment_orders
ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly'
CHECK (billing_period IN ('monthly', 'yearly'));

-- Add billing_period to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly'
CHECK (billing_period IN ('monthly', 'yearly'));
```

#### Step 7: Update webhook handler for consistency

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/src/app/api/payments/webhook/route.ts`

- In `payment.captured` handler, read `billingPeriod` from `payment.notes` and apply the same subscription_end_date logic as in verify.

### 1.5 Verification Steps

1. Toggle to "Yearly" on subscription page -- verify UI shows 20% discount
2. Click upgrade on yearly -- verify Razorpay checkout shows the YEARLY amount (e.g., Creator yearly = round(699 * 12 * 0.8) = ₹6,710)
3. Complete payment -- verify `payment_orders` row has `billing_period = 'yearly'`
4. Verify `user_profiles` row has `billing_period = 'yearly'` and `subscription_end_date` is 1 year from now
5. Verify credits are 12x the monthly amount for yearly plans
6. Toggle back to "Monthly" -- verify monthly price and 1-month subscription_end_date

### 1.6 Files Modified

| File | Change |
|------|--------|
| `src/lib/pricing.ts` | Add `priceYearly`, `priceYearlyUSD` to interface + data + helper |
| `src/hooks/usePayment.ts` | Accept + pass `billingPeriod` parameter |
| `components/views/Subscription.tsx` | Pass `billingPeriod` to handleUpgrade |
| `src/app/api/payments/create-order/route.ts` | Accept billingPeriod, calculate yearly price, store it |
| `src/app/api/payments/verify/route.ts` | Set subscription_end_date, multiply credits for yearly |
| `src/app/api/payments/webhook/route.ts` | Mirror verify logic for billing period |
| `supabase-schema-production.sql` | Add billing_period columns (run as live migration) |

---

## Phase 2: Fix 3 -- Credit System

### 2.1 Problem Statement

Two issues:
- **A: Credits not updating in real-time** after generation until page refresh.
- **B: No refund logic** when generation fails after partial processing.

### 2.2 Research Topics

- **Supabase Realtime reconnection patterns:** The `realtimeSetUp` boolean is a module-level singleton that never resets. If the Supabase channel disconnects (network blip) or the user navigates away and back, the subscription is not re-established. Best practice: use the channel's `subscribe()` callback to detect status changes, and clean up / re-subscribe on `CLOSED` or `CHANNEL_ERROR`.
- **Optimistic update + cache invalidation patterns:** After TTS generation, the API returns `creditsRemaining`. The app uses `updateCreditsOptimistic()` which correctly patches sessionStorage and notifies subscribers. But navigating away unmounts the subscriber, and when remounting, the stale sessionStorage cache (5-min TTL) is served.
- **PostgreSQL `FOR UPDATE` row locking vs direct UPDATE:** The `use_credits()` stored procedure uses `FOR UPDATE` for atomic deduction with balance check. The TTS route (`/api/tts/route.ts` lines 37-87) does a manual SELECT + UPDATE without row locking -- race condition risk.

### 2.3 Root Cause Analysis

**Issue A (stale credits):**

1. `useUserProfile.ts` line 139: `let realtimeSetUp = false` is a module-level variable.
2. Line 141: `setupRealtime()` checks this flag. Once set to `true`, it never calls `supabase.channel()` again.
3. If the Supabase Realtime channel disconnects (network change, Vercel cold start), it is never re-established.
4. The `subscribers` array (line 88) is correctly managed per-component mount/unmount.
5. The sessionStorage cache (5-min TTL) at lines 59-76 serves stale data on navigation within 5 minutes.
6. After generation, `updateCreditsOptimistic()` patches the cache AND notifies subscribers (lines 118-136). This works IF the component is still mounted.
7. On navigation away and back, the new component instance reads from the stale cache before background refresh completes.

**Issue B (no refund):**

1. `/api/tts/route.ts` line 253: credits are deducted AFTER successful generation + storage. This means if generation fails, credits are NOT deducted (correct behavior).
2. HOWEVER: if generation succeeds but storage fails (line 242-249), the function returns 500 error WITHOUT deducting credits, BUT the Kie.ai API credits have been consumed. The user gets no audio AND no credit deduction. This is correct from the user's perspective but wasteful of Kie.ai API credits.
3. Edge case: if `useCredits()` (line 253) fails AFTER audio is stored, the user gets audio for free. The `creditResult.success` check at line 260 only logs, does not roll back the audio.
4. The `credit_transactions` table supports `type = 'refund'` (schema line 283) and the `add_credits()` stored procedure exists (schema line 553) but is never called for refund scenarios.
5. The TTS route uses direct SQL UPDATE (lines 57-66) instead of the `use_credits()` stored procedure that uses `FOR UPDATE` row locking (schema lines 496-550).

### 2.4 Implementation Steps

#### Step 1: Fix Realtime subscription lifecycle in `useUserProfile.ts`

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/src/hooks/useUserProfile.ts`

This is the most critical fix. Replace the module-level singleton pattern with a reference-counted approach.

Changes:
- Remove module-level `let realtimeSetUp = false` (line 139).
- Replace `setupRealtime()` with a reference-counted version that tracks active subscribers:

```typescript
let realtimeChannel: ReturnType<typeof createClient>['channel'] | null = null;
let realtimeRefCount = 0;

function subscribeRealtime() {
    realtimeRefCount++;
    if (realtimeRefCount > 1 && realtimeChannel) return; // Already active

    try {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;

            // Remove old channel if it exists
            if (realtimeChannel) {
                supabase.removeChannel(realtimeChannel as any);
            }

            realtimeChannel = supabase
                .channel('profile-credits')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'user_profiles',
                        filter: `id=eq.${user.id}`,
                    },
                    (payload: any) => {
                        // ... same handler as before ...
                    }
                )
                .subscribe((status) => {
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        // Reset so next subscribe attempt re-creates
                        realtimeChannel = null;
                    }
                });
        });
    } catch {
        realtimeChannel = null;
    }
}

function unsubscribeRealtime() {
    realtimeRefCount--;
    if (realtimeRefCount <= 0) {
        realtimeRefCount = 0;
        if (realtimeChannel) {
            try {
                const supabase = createClient();
                supabase.removeChannel(realtimeChannel as any);
            } catch { /* ignore */ }
            realtimeChannel = null;
        }
    }
}
```

- Update the `useEffect` in `useUserProfile` (lines 220-228) to call `subscribeRealtime()` on mount and `unsubscribeRealtime()` on unmount:
```typescript
useEffect(() => {
    if (!enabled) return;
    const handler = (result: ProfileResponse) => { setData(result) };
    subscribers.push(handler);
    subscribeRealtime();

    return () => {
        subscribers = subscribers.filter(fn => fn !== handler);
        unsubscribeRealtime();
    };
}, [enabled]);
```

#### Step 2: Invalidate sessionStorage cache after generation

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/src/hooks/useUserProfile.ts`

The `updateCreditsOptimistic()` function (line 118) already patches the cache. The issue is that on navigation, the new component reads the old cached value before the background refresh finishes.

Fix: Reduce the cache TTL check for "just after generation" by storing a "dirty" flag, or more simply, have `updateCreditsOptimistic` reset the cache timestamp to NOW so the 5-min TTL is effectively refreshed:

```typescript
export function updateCreditsOptimistic(newRemaining: number, creditsUsed?: number) {
    const cached = getCachedProfile();
    if (!cached) return;

    const updated: ProfileResponse = {
        ...cached,
        profile: {
            ...cached.profile,
            remainingCredits: newRemaining,
            usedCredits: creditsUsed != null
                ? (cached.profile.usedCredits + creditsUsed)
                : cached.profile.usedCredits,
        },
    };

    setCachedProfile(updated); // This already resets timestamp to Date.now()
    subscribers.forEach(fn => fn(updated));
}
```

This is actually already correct -- `setCachedProfile()` sets `timestamp: Date.now()`, so the 5-min TTL is reset. The real issue is the Realtime subscription not re-establishing. Step 1 fixes this.

Additionally, ensure `clearProfileCache()` is called when the user navigates TO the TextToSpeech view, forcing a fresh fetch:

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/components/views/TextToSpeech.tsx`

At the top of the component (after line 61), add:
```typescript
// Force fresh credit data when entering TTS view
useEffect(() => {
    clearProfileCache();
}, []);
```

This ensures that even if Realtime failed, navigating to TTS always gets fresh credits.

#### Step 3: Use `use_credits()` stored procedure instead of direct SQL

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/src/app/api/tts/route.ts`

Replace the `useCredits()` function (lines 37-87) with a call to the existing `use_credits` stored procedure:

```typescript
async function useCreditsAtomic(userId: string, amount: number, description: string, referenceId?: string) {
    const admin = getAdminClient();
    
    const { data, error } = await admin.rpc('use_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_description: description,
        p_reference_id: referenceId || null,
    });

    if (error) {
        console.error('Error in use_credits RPC:', error);
        return { success: false, error: error.message };
    }

    // use_credits returns TABLE(success, new_balance, error_message)
    const result = Array.isArray(data) ? data[0] : data;
    return {
        success: result?.success ?? false,
        newBalance: result?.new_balance,
        error: result?.error_message,
    };
}
```

Then replace line 253 call to use `useCreditsAtomic` instead of the old `useCredits`.

#### Step 4: Add refund logic for failed generations

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/src/app/api/tts/route.ts`

The current code deducts credits AFTER successful generation (line 253). This means credits are only deducted if everything succeeds. However, there is a scenario to handle:

**Approach: Pre-deduct credits, refund on failure.**

Restructure the TTS endpoint to:
1. Check credits (already done)
2. **Deduct credits BEFORE generation** (using `use_credits` RPC for atomicity)
3. Generate TTS
4. If generation fails, **refund credits** using `add_credits` RPC with `type='refund'`
5. If storage fails, still refund

```typescript
// Step: Deduct credits upfront
const creditResult = await useCreditsAtomic(userId, creditsNeeded, `TTS: ${charactersUsed} chars`, generationId);
if (!creditResult.success) {
    return NextResponse.json({
        error: creditResult.error || 'Failed to deduct credits',
        creditsNeeded,
        creditsRemaining: creditResult.newBalance,
    }, { status: 402 });
}

try {
    // Generate TTS
    const audioBuffer = await generateTTS({ ... });
    
    // Store audio
    const storedAudioUrl = await storeAudioInBucket(userId, generationId, audioBuffer);
    if (!storedAudioUrl) {
        // Refund credits -- storage failed
        await refundCredits(userId, creditsNeeded, 'Storage failed after generation', generationId);
        return NextResponse.json({ error: 'Failed to store audio' }, { status: 500 });
    }
    
    // Success -- credits already deducted
    // ... save to history, return response ...
    
} catch (error) {
    // Refund credits -- generation failed
    await refundCredits(userId, creditsNeeded, `Generation failed: ${error.message}`, generationId);
    throw error; // Re-throw to hit the outer catch
}
```

Add the refund helper:
```typescript
async function refundCredits(userId: string, amount: number, reason: string, referenceId: string) {
    const admin = getAdminClient();
    try {
        await admin.rpc('add_credits', {
            p_user_id: userId,
            p_amount: amount,
            p_type: 'refund',
            p_description: reason,
            p_reference_id: referenceId,
        });
        console.log(`[TTS] Refunded ${amount} credits for user ${userId}: ${reason}`);
    } catch (err) {
        console.error(`[TTS] CRITICAL: Failed to refund ${amount} credits for user ${userId}:`, err);
        // TODO: Alert monitoring -- manual intervention needed
    }
}
```

#### Step 5: Add manual refund API endpoint

**New file:** `/Users/mohitjethani/Downloads/NMM VO APP/src/app/api/credits/refund/route.ts`

This admin-only endpoint allows manual credit refunds:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
    // Authenticate admin (check for admin role or specific user IDs)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // TODO: Add admin check (e.g., check user.email against admin list)
    
    const body = await request.json();
    const { userId, amount, reason } = body;
    
    if (!userId || !amount || amount <= 0) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: newBalance, error } = await admin.rpc('add_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_type: 'refund',
        p_description: reason || 'Manual refund',
        p_reference_id: `manual_${Date.now()}`,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, newBalance });
}
```

#### Step 6: Ensure credits-updated event fires in all scenarios

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/src/app/api/tts/route.ts`

The TTS API response already includes `usage.creditsRemaining`. The frontend (`TextToSpeech.tsx` lines 241-252) dispatches the event. Verify this covers both success and failure paths.

Additionally, in `usePayment.ts` line 123, after payment verification, the `credits-updated` event is dispatched. This should also work with the fixed Realtime subscription from Step 1.

### 2.5 Verification Steps

1. **Realtime fix:** Generate audio, then navigate to Dashboard, then back to TTS. Credits should be correct without refresh.
2. **Realtime fix (disconnect):** Open browser DevTools > Network > toggle Offline for 5s then back Online. Credits should resync.
3. **Atomic deduction:** Trigger two rapid generations (curl or browser) -- verify no race condition (credits should not go negative).
4. **Refund on failure:** Temporarily break the Kie.ai API key to force generation failure -- verify credits are refunded. Check `credit_transactions` for a `type='refund'` row.
5. **Refund on storage failure:** Temporarily make the storage bucket read-only -- verify credits are refunded on storage failure.

### 2.6 Files Modified

| File | Change |
|------|--------|
| `src/hooks/useUserProfile.ts` | Reference-counted Realtime subscription, fix lifecycle |
| `src/app/api/tts/route.ts` | Use `use_credits` RPC, add pre-deduct + refund pattern |
| `components/views/TextToSpeech.tsx` | Clear profile cache on mount |
| `src/app/api/credits/refund/route.ts` | **NEW** -- Manual refund endpoint |

---

## Phase 3: Feature 1 -- Script to Voice (Batch TTS)

### 3.1 Problem Statement

Users with 30,000-40,000 character scripts must manually split, generate, and stitch audio. Need an automated pipeline that accepts large scripts, chunks them, generates TTS for each chunk, stitches the results, and delivers a single MP3.

### 3.2 Research Topics

- **Vercel function timeouts:** Vercel Hobby = 10s, Pro = 120s (current plan uses `maxDuration = 120`). A 30k char script with 20 chunks at ~30s each = 10 minutes. This CANNOT run in a single serverless function. Must use client-side orchestration or background processing.
- **Client-side orchestration pattern:** The client makes N sequential API calls (one per chunk), tracks progress, then sends all audio URLs to a stitching endpoint. This avoids serverless timeout issues entirely. Each chunk call is within the 120s limit.
- **Audio stitching options:**
  - **Server-side with ffmpeg:** Vercel serverless does not include ffmpeg by default. Would need `fluent-ffmpeg` + a static ffmpeg binary or a Vercel Edge Function. Complex deployment.
  - **Simple MP3 concatenation:** MP3 files with the same bitrate and sample rate CAN be concatenated by appending byte buffers. Since all chunks use the same Kie.ai model, the format is consistent. This is the simplest approach.
  - **Client-side stitching with Web Audio API:** Decode each MP3 to AudioBuffer, concatenate PCM samples, re-encode. More complex but avoids server round-trip.
  - **Recommended:** Server-side buffer concatenation. If that introduces artifacts (gaps/clicks), fall back to ffmpeg via a Docker-based API function.
- **Document parsing libraries:**
  - `.docx`: `mammoth` (npm) -- extracts text while preserving paragraph breaks. Small, well-tested.
  - `.pdf`: `pdf-parse` (npm) -- extracts text from PDF. Note: does NOT preserve paragraph structure well. Alternative: `pdfjs-dist` for more control.
  - Both need to be added as dependencies.
- **Chunking strategy:** Split by paragraph boundaries, accumulate until 1500-1800 words (~7500-9000 chars). If a single paragraph exceeds the limit, split at sentence boundaries within it.

### 3.3 Architecture Decision: Client-Side Orchestration

Given the Vercel 120s timeout constraint and 10+ minute total generation time, the architecture MUST be:

```
Client (Browser)                           Server (Vercel Functions)
    |                                          |
    |-- 1. POST /api/batch-tts/create -------->|  Validate, chunk text, return chunk list
    |<-- { jobId, chunks: [...] } -------------|
    |                                          |
    |-- 2. For each chunk (sequential):        |
    |   POST /api/tts (existing endpoint) ---->|  Generate single chunk (reuse existing)
    |<-- { audioUrl, usage } ------------------|
    |   Update progress bar                    |
    |                                          |
    |-- 3. POST /api/batch-tts/stitch -------->|  Concatenate audio buffers, store result
    |<-- { finalAudioUrl } --------------------|
    |                                          |
    |-- 4. Download final MP3                  |
```

This approach:
- Reuses the existing `/api/tts` endpoint for each chunk (no duplication)
- Each chunk call is well within the 120s timeout
- Progress is naturally tracked client-side (chunk N of M)
- If one chunk fails, the client can retry just that chunk
- The stitch endpoint only needs to concatenate already-generated audio

### 3.4 Implementation Steps

#### Step 1: Install document parsing dependencies

```bash
npm install mammoth pdf-parse
npm install -D @types/pdf-parse
```

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/package.json` -- updated dependencies

#### Step 2: Create text chunking utility

**New file:** `/Users/mohitjethani/Downloads/NMM VO APP/src/lib/text-chunker.ts`

```typescript
export interface TextChunk {
    index: number;
    text: string;
    wordCount: number;
    charCount: number;
    startOffset: number;  // char offset in original text
    endOffset: number;
}

export interface ChunkingResult {
    chunks: TextChunk[];
    totalChars: number;
    totalWords: number;
    totalChunks: number;
}

const MIN_WORDS_PER_CHUNK = 1500;
const MAX_WORDS_PER_CHUNK = 1800;
const MAX_CHARS_PER_CHUNK = 9000;  // Safety limit for Kie.ai

export function chunkText(text: string): ChunkingResult {
    // Split into paragraphs (double newline or single newline)
    const paragraphs = text.split(/\n\s*\n|\n/).filter(p => p.trim().length > 0);
    
    const chunks: TextChunk[] = [];
    let currentChunkParagraphs: string[] = [];
    let currentWordCount = 0;
    let charOffset = 0;
    let chunkStartOffset = 0;

    for (const paragraph of paragraphs) {
        const paraWords = paragraph.trim().split(/\s+/).length;
        
        // If single paragraph exceeds max, split at sentence boundaries
        if (paraWords > MAX_WORDS_PER_CHUNK) {
            // Flush current chunk first
            if (currentChunkParagraphs.length > 0) {
                const chunkText = currentChunkParagraphs.join('\n\n');
                chunks.push({
                    index: chunks.length,
                    text: chunkText,
                    wordCount: currentWordCount,
                    charCount: chunkText.length,
                    startOffset: chunkStartOffset,
                    endOffset: charOffset,
                });
                currentChunkParagraphs = [];
                currentWordCount = 0;
                chunkStartOffset = charOffset;
            }
            
            // Split large paragraph by sentences
            const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
            let sentenceBuffer: string[] = [];
            let sentenceWordCount = 0;
            
            for (const sentence of sentences) {
                const sWords = sentence.trim().split(/\s+/).length;
                if (sentenceWordCount + sWords > MAX_WORDS_PER_CHUNK && sentenceBuffer.length > 0) {
                    const chunkText = sentenceBuffer.join(' ');
                    chunks.push({
                        index: chunks.length,
                        text: chunkText,
                        wordCount: sentenceWordCount,
                        charCount: chunkText.length,
                        startOffset: chunkStartOffset,
                        endOffset: charOffset + chunkText.length,
                    });
                    chunkStartOffset = charOffset + chunkText.length;
                    sentenceBuffer = [];
                    sentenceWordCount = 0;
                }
                sentenceBuffer.push(sentence.trim());
                sentenceWordCount += sWords;
            }
            
            if (sentenceBuffer.length > 0) {
                currentChunkParagraphs = [sentenceBuffer.join(' ')];
                currentWordCount = sentenceWordCount;
            }
        } else if (currentWordCount + paraWords > MAX_WORDS_PER_CHUNK) {
            // Current chunk is full, finalize it
            const chunkText = currentChunkParagraphs.join('\n\n');
            chunks.push({
                index: chunks.length,
                text: chunkText,
                wordCount: currentWordCount,
                charCount: chunkText.length,
                startOffset: chunkStartOffset,
                endOffset: charOffset,
            });
            currentChunkParagraphs = [paragraph.trim()];
            currentWordCount = paraWords;
            chunkStartOffset = charOffset;
        } else {
            currentChunkParagraphs.push(paragraph.trim());
            currentWordCount += paraWords;
        }
        
        charOffset += paragraph.length + 2; // +2 for \n\n separator
    }

    // Flush remaining
    if (currentChunkParagraphs.length > 0) {
        const chunkText = currentChunkParagraphs.join('\n\n');
        chunks.push({
            index: chunks.length,
            text: chunkText,
            wordCount: currentWordCount,
            charCount: chunkText.length,
            startOffset: chunkStartOffset,
            endOffset: charOffset,
        });
    }

    const totalChars = chunks.reduce((sum, c) => sum + c.charCount, 0);
    const totalWords = chunks.reduce((sum, c) => sum + c.wordCount, 0);

    return { chunks, totalChars, totalWords, totalChunks: chunks.length };
}
```

#### Step 3: Create document parser utility

**New file:** `/Users/mohitjethani/Downloads/NMM VO APP/src/lib/document-parser.ts`

```typescript
export async function parseDocx(buffer: ArrayBuffer): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
}

export async function parsePdf(buffer: ArrayBuffer): Promise<string> {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(Buffer.from(buffer));
    return result.text;
}

export function detectFileType(filename: string): 'docx' | 'pdf' | 'txt' | null {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'docx') return 'docx';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'txt') return 'txt';
    return null;
}
```

#### Step 4: Create batch TTS create endpoint

**New file:** `/Users/mohitjethani/Downloads/NMM VO APP/src/app/api/batch-tts/create/route.ts`

This endpoint validates the request, checks credits, chunks the text, and returns the chunk plan without generating any audio yet.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { chunkText } from '@/lib/text-chunker';
import { CREDITS_CONFIG } from '@/lib/constants';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
    // 1. Authenticate
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Get profile + check tier (must be paid)
    const admin = getAdminClient();
    const { data: profile } = await admin
        .from('user_profiles')
        .select('credits_remaining, subscription_tier')
        .eq('id', user.id)
        .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    
    const tier = (profile as any).subscription_tier;
    if (tier === 'free') {
        return NextResponse.json({ error: 'Script to Voice requires a paid plan' }, { status: 403 });
    }

    // 3. Parse request (text or file)
    const contentType = request.headers.get('content-type') || '';
    let fullText: string;
    let voiceId: string;
    let voiceName: string;
    let voiceSettings: Record<string, unknown>;

    if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        voiceId = formData.get('voiceId') as string;
        voiceName = formData.get('voiceName') as string;
        voiceSettings = JSON.parse(formData.get('voiceSettings') as string || '{}');
        
        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        
        const buffer = await file.arrayBuffer();
        const filename = file.name.toLowerCase();
        
        if (filename.endsWith('.docx')) {
            const { parseDocx } = await import('@/lib/document-parser');
            fullText = await parseDocx(buffer);
        } else if (filename.endsWith('.pdf')) {
            const { parsePdf } = await import('@/lib/document-parser');
            fullText = await parsePdf(buffer);
        } else if (filename.endsWith('.txt')) {
            fullText = new TextDecoder().decode(buffer);
        } else {
            return NextResponse.json({ error: 'Unsupported file type. Use .docx, .pdf, or .txt' }, { status: 400 });
        }
    } else {
        const body = await request.json();
        fullText = body.text;
        voiceId = body.voiceId;
        voiceName = body.voiceName;
        voiceSettings = body.voiceSettings || {};
    }

    if (!fullText?.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    if (!voiceId) return NextResponse.json({ error: 'No voice selected' }, { status: 400 });

    // 4. Chunk the text
    const chunkResult = chunkText(fullText);

    // 5. Calculate total credits needed
    const totalCredits = chunkResult.totalChars * CREDITS_CONFIG.COST_PER_CHARACTER;

    // 6. Check if user has enough credits
    const remaining = (profile as any).credits_remaining;
    if (remaining < totalCredits) {
        return NextResponse.json({
            error: 'Insufficient credits',
            creditsNeeded: totalCredits,
            creditsRemaining: remaining,
            chunks: chunkResult.totalChunks,
        }, { status: 402 });
    }

    // 7. Generate batch job ID
    const jobId = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // 8. Return chunk plan (no generation yet)
    return NextResponse.json({
        success: true,
        jobId,
        totalChars: chunkResult.totalChars,
        totalWords: chunkResult.totalWords,
        totalChunks: chunkResult.totalChunks,
        totalCredits,
        creditsRemaining: remaining,
        voiceId,
        voiceName,
        voiceSettings,
        chunks: chunkResult.chunks.map(c => ({
            index: c.index,
            charCount: c.charCount,
            wordCount: c.wordCount,
            text: c.text,  // Send text so client can POST each chunk to /api/tts
        })),
    });
}
```

#### Step 5: Create audio stitch endpoint

**New file:** `/Users/mohitjethani/Downloads/NMM VO APP/src/app/api/batch-tts/stitch/route.ts`

This endpoint takes an array of audio URLs, downloads them, concatenates the MP3 buffers, stores the result, and returns the final URL.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 120;  // Stitching can take time for large files

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { jobId, audioUrls, totalCredits, totalChars } = body;

    if (!jobId || !audioUrls?.length) {
        return NextResponse.json({ error: 'Missing jobId or audioUrls' }, { status: 400 });
    }

    // Download all audio chunks in parallel
    const buffers: ArrayBuffer[] = [];
    for (const url of audioUrls) {
        const response = await fetch(url);
        if (!response.ok) {
            return NextResponse.json({ error: `Failed to fetch chunk audio: ${url}` }, { status: 500 });
        }
        buffers.push(await response.arrayBuffer());
    }

    // Concatenate MP3 buffers
    // MP3 frames are self-contained, so simple concatenation works
    // as long as sample rate and bitrate are consistent (they are from Kie.ai)
    const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const buffer of buffers) {
        combined.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
    }

    // Store the stitched audio
    const admin = getAdminClient();
    const filePath = `${user.id}/${jobId}.mp3`;

    const { error: uploadError } = await admin.storage
        .from('audio-generations')
        .upload(filePath, combined.buffer, {
            contentType: 'audio/mpeg',
            upsert: true,
        });

    if (uploadError) {
        return NextResponse.json({ error: 'Failed to store stitched audio' }, { status: 500 });
    }

    const { data: urlData } = admin.storage
        .from('audio-generations')
        .getPublicUrl(filePath);

    // Save to generation history as a batch generation
    await admin.from('generation_history').insert({
        user_id: user.id,
        text: `[Batch: ${audioUrls.length} chunks, ${totalChars} chars]`,
        voice_id: body.voiceId || 'unknown',
        voice_name: body.voiceName || 'Unknown',
        audio_url: urlData?.publicUrl,
        characters_used: totalChars,
        credits_used: totalCredits,
        settings: { batch: true, chunks: audioUrls.length },
        status: 'completed',
    });

    return NextResponse.json({
        success: true,
        audioUrl: urlData?.publicUrl,
        jobId,
        totalChunks: audioUrls.length,
        totalChars,
    });
}
```

#### Step 6: Create the `useBatchGenerate` hook

**New file:** `/Users/mohitjethani/Downloads/NMM VO APP/src/hooks/useBatchGenerate.ts`

This hook orchestrates the entire batch generation from the client side.

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';

export interface BatchProgress {
    phase: 'idle' | 'chunking' | 'generating' | 'stitching' | 'complete' | 'error';
    currentChunk: number;
    totalChunks: number;
    percentComplete: number;
    message: string;
    audioUrls: string[];  // URLs of completed chunks
    finalAudioUrl: string | null;
    error: string | null;
}

export function useBatchGenerate() {
    const [progress, setProgress] = useState<BatchProgress>({
        phase: 'idle', currentChunk: 0, totalChunks: 0,
        percentComplete: 0, message: '', audioUrls: [],
        finalAudioUrl: null, error: null,
    });
    const abortRef = useRef(false);

    const startBatch = useCallback(async (params: {
        text?: string;
        file?: File;
        voiceId: string;
        voiceName: string;
        voiceSettings: Record<string, unknown>;
    }) => {
        abortRef.current = false;
        setProgress({ phase: 'chunking', currentChunk: 0, totalChunks: 0,
            percentComplete: 0, message: 'Analyzing script...', audioUrls: [],
            finalAudioUrl: null, error: null });

        try {
            // 1. Create batch job (chunk text on server)
            let createResponse: Response;
            if (params.file) {
                const formData = new FormData();
                formData.append('file', params.file);
                formData.append('voiceId', params.voiceId);
                formData.append('voiceName', params.voiceName);
                formData.append('voiceSettings', JSON.stringify(params.voiceSettings));
                createResponse = await fetch('/api/batch-tts/create', {
                    method: 'POST', body: formData,
                });
            } else {
                createResponse = await fetch('/api/batch-tts/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: params.text,
                        voiceId: params.voiceId,
                        voiceName: params.voiceName,
                        voiceSettings: params.voiceSettings,
                    }),
                });
            }

            if (!createResponse.ok) {
                const err = await createResponse.json();
                throw new Error(err.error || 'Failed to create batch job');
            }

            const batchPlan = await createResponse.json();
            const { jobId, chunks, totalCredits, totalChars, voiceId, voiceName, voiceSettings } = batchPlan;

            // 2. Generate each chunk sequentially
            setProgress(p => ({
                ...p, phase: 'generating', totalChunks: chunks.length,
                message: `Generating chunk 1 of ${chunks.length}...`,
            }));

            const audioUrls: string[] = [];
            for (let i = 0; i < chunks.length; i++) {
                if (abortRef.current) throw new Error('Generation cancelled');

                setProgress(p => ({
                    ...p, currentChunk: i + 1,
                    percentComplete: Math.round(((i) / chunks.length) * 90), // 90% for generation
                    message: `Generating chunk ${i + 1} of ${chunks.length}...`,
                }));

                // Call existing /api/tts for each chunk
                const ttsResponse = await fetch('/api/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: chunks[i].text,
                        voice_id: voiceId,
                        voice_name: voiceName,
                        voice_settings: voiceSettings,
                    }),
                });

                if (!ttsResponse.ok) {
                    const err = await ttsResponse.json().catch(() => ({}));
                    throw new Error(err.error || `Chunk ${i + 1} failed`);
                }

                const result = await ttsResponse.json();
                if (!result.audioUrl) throw new Error(`No audio URL for chunk ${i + 1}`);
                audioUrls.push(result.audioUrl);

                setProgress(p => ({ ...p, audioUrls: [...audioUrls] }));
            }

            // 3. Stitch all chunks
            setProgress(p => ({
                ...p, phase: 'stitching', percentComplete: 92,
                message: 'Stitching audio chunks...',
            }));

            const stitchResponse = await fetch('/api/batch-tts/stitch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId, audioUrls, totalCredits, totalChars, voiceId, voiceName,
                }),
            });

            if (!stitchResponse.ok) {
                throw new Error('Failed to stitch audio');
            }

            const stitchResult = await stitchResponse.json();

            setProgress({
                phase: 'complete', currentChunk: chunks.length,
                totalChunks: chunks.length, percentComplete: 100,
                message: 'Script converted successfully!',
                audioUrls, finalAudioUrl: stitchResult.audioUrl, error: null,
            });

            // Trigger credit refresh
            window.dispatchEvent(new Event('credits-updated'));

            return stitchResult.audioUrl;

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Batch generation failed';
            setProgress(p => ({ ...p, phase: 'error', error: message, message }));
            return null;
        }
    }, []);

    const cancelBatch = useCallback(() => {
        abortRef.current = true;
    }, []);

    return { progress, startBatch, cancelBatch };
}
```

#### Step 7: Create the ScriptToVoice UI component

**New file:** `/Users/mohitjethani/Downloads/NMM VO APP/components/views/ScriptToVoice.tsx`

This is a new page/view with:
- Text area for paste or typed input
- File upload zone for .docx, .pdf, .txt
- Voice selector (reuse `VoiceDropdown` from existing)
- Voice settings panel (reuse from TextToSpeech)
- "Generate" button
- Progress bar with chunk status
- Download button when complete

The component should follow the same patterns as `TextToSpeech.tsx`:
- Use `useVoices()` for voice selection
- Use `useUserProfile()` for credit display
- Use the new `useBatchGenerate()` hook for orchestration
- Same layout style (main content + sidebar settings)

Approximate size: ~400-500 lines (much simpler than the 1000-line TextToSpeech since there is no inline playback/history for individual chunks).

Key UI elements:
- **Input section:** Tabbed interface (Text / Upload) at the top
- **Voice selector:** Same dropdown as TTS page
- **Credit estimate:** Shows "This script will use ~X credits" before generating
- **Progress section:** Animated progress bar with:
  - Current phase label (Analyzing / Generating Chunk N of M / Stitching / Complete)
  - Percentage bar
  - Estimated time remaining (based on average time per chunk so far)
- **Result section:** Audio player + download button for the final MP3

#### Step 8: Add routing for the new view

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/App.tsx`

Add to imports:
```typescript
import { ScriptToVoice } from './components/views/ScriptToVoice';
```

Add to the view rendering switch (wherever the view state is matched):
```typescript
case 'script-to-voice':
    return <ScriptToVoice onNavigate={setView} isMobile={isMobile} />;
```

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/components/Sidebar.tsx`

Add a new sidebar item for "Script to Voice" with an appropriate icon (e.g., `FileText` from lucide-react), positioned after "Text to Speech" in the nav.

#### Step 9: Update validation to support batch mode

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/src/lib/validation.ts`

Add a new validation function for batch text:
```typescript
export function validateBatchText(text: string, tier: string): {
    isValid: boolean;
    error?: string;
    sanitized: string;
} {
    const sanitized = sanitizeText(text);
    if (!sanitized) return { isValid: false, error: 'Text is required', sanitized: '' };
    if (sanitized.length < 100) return { isValid: false, error: 'Script is too short for batch generation. Minimum 100 characters.', sanitized };
    
    // Max text length varies by tier (example limits)
    const maxByTier: Record<string, number> = {
        starter: 50000,
        creator: 100000,
        pro: 200000,
        advanced: 500000,
    };
    const max = maxByTier[tier] || 50000;
    if (sanitized.length > max) {
        return { isValid: false, error: `Script exceeds maximum of ${max.toLocaleString()} characters for your plan.`, sanitized };
    }
    
    return { isValid: true, sanitized };
}
```

#### Step 10: Update TTS route to handle batch chunks

The existing `/api/tts/route.ts` will be called for each chunk. The per-generation character limit check needs to be adjusted for batch mode, since individual chunks may exceed the tier's `maxCharsPerGeneration` (e.g., free tier = 1000 chars, but batch chunks can be up to 9000 chars).

**File:** `/Users/mohitjethani/Downloads/NMM VO APP/src/app/api/tts/route.ts`

Add an optional `batchMode` flag to the request body that, if present, uses a higher character limit:
```typescript
const { text, voice_id, voice_name, voice_settings, batchMode } = body;

// For batch mode, allow up to 10000 chars per chunk (within Kie.ai limits)
// For regular mode, use the tier's maxCharsPerGeneration
const maxChars = batchMode ? 10000 : (planConfig?.maxCharsPerGeneration || 5000);
if (text.length > maxChars) {
    return NextResponse.json({ error: `Text exceeds ${maxChars} character limit` }, { status: 400 });
}
```

### 3.5 Verification Steps

1. **Plain text input:** Paste a 30,000 character script -> verify it chunks correctly (should be ~4-6 chunks at 1500-1800 words each)
2. **Docx upload:** Upload a .docx file -> verify text extraction and chunking
3. **PDF upload:** Upload a .pdf file -> verify text extraction and chunking
4. **Progress tracking:** Start generation -> verify progress bar updates for each chunk
5. **Audio quality:** Listen to the stitched audio -> verify no gaps or clicks between chunks
6. **Credit deduction:** Verify total credits deducted = total characters across all chunks
7. **Cancel mid-generation:** Click cancel during chunk 3 of 5 -> verify generation stops (credits for already-generated chunks are still charged)
8. **Error recovery:** Simulate Kie.ai failure on chunk 3 -> verify error message and credits are refunded for the failed chunk (from Fix 3)
9. **Free tier blocked:** Log in as free user -> verify "Script to Voice requires a paid plan" error
10. **Download:** After generation, click download -> verify single MP3 file downloads

### 3.6 Files Created/Modified

| File | Status | Change |
|------|--------|--------|
| `package.json` | Modified | Add `mammoth`, `pdf-parse` dependencies |
| `src/lib/text-chunker.ts` | **NEW** | Text chunking logic |
| `src/lib/document-parser.ts` | **NEW** | Docx/PDF parsing |
| `src/app/api/batch-tts/create/route.ts` | **NEW** | Batch job creation + chunking |
| `src/app/api/batch-tts/stitch/route.ts` | **NEW** | Audio concatenation + storage |
| `src/hooks/useBatchGenerate.ts` | **NEW** | Client-side orchestration hook |
| `components/views/ScriptToVoice.tsx` | **NEW** | UI component |
| `App.tsx` | Modified | Add ScriptToVoice route |
| `components/Sidebar.tsx` | Modified | Add nav item |
| `src/lib/validation.ts` | Modified | Add `validateBatchText()` |
| `src/app/api/tts/route.ts` | Modified | Support `batchMode` flag for higher char limit |

---

## Dependency Graph

```
Phase 1 (Yearly Billing)  ──────── independent, do first
Phase 2 (Credit System)   ──────── independent of Phase 1, but foundational for Phase 3
Phase 3 (Script to Voice) ──────── depends on Phase 2 (correct credit deduction + refund)
```

Phase 1 and Phase 2 can technically be done in parallel by different developers, but Phase 3 MUST wait for Phase 2's credit refund logic to be in place.

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| MP3 concatenation produces clicks/gaps between chunks | Medium | Test with various Kie.ai outputs. If artifacts occur, insert a 100ms silence buffer between chunks, or fall back to ffmpeg. |
| Kie.ai rate limits during batch generation | High | Add delay between chunk requests (e.g., 1s). Implement exponential backoff on 429 responses. |
| Vercel stitch endpoint timeout for 20+ chunks | Medium | Fetch audio in parallel (Promise.all) instead of sequential. 20 chunks at ~500KB each = ~10MB total, well within 120s. |
| Yearly billing credits: users get 12x monthly credits upfront | Low (business) | Confirm with product owner. Alternative: grant monthly credits on a yearly billing cycle (requires a cron job for monthly renewal). |
| pdf-parse library size in serverless bundle | Low | Use dynamic import (`await import('pdf-parse')`) so it is only loaded when needed. |
| Session storage cache race condition on rapid navigation | Low | Step 2 of Fix 3 already addresses this. The reference-counted Realtime subscription ensures fresh data. |
| Razorpay does not support yearly in standard Orders API | None | Razorpay Orders accept any amount. The `yearly` logic is entirely on our side. |

---

## Summary of All New/Modified Files

### New Files (7)
1. `src/lib/text-chunker.ts`
2. `src/lib/document-parser.ts`
3. `src/app/api/batch-tts/create/route.ts`
4. `src/app/api/batch-tts/stitch/route.ts`
5. `src/hooks/useBatchGenerate.ts`
6. `components/views/ScriptToVoice.tsx`
7. `src/app/api/credits/refund/route.ts`

### Modified Files (11)
1. `src/lib/pricing.ts`
2. `src/hooks/usePayment.ts`
3. `components/views/Subscription.tsx`
4. `src/app/api/payments/create-order/route.ts`
5. `src/app/api/payments/verify/route.ts`
6. `src/app/api/payments/webhook/route.ts`
7. `src/hooks/useUserProfile.ts`
8. `src/app/api/tts/route.ts`
9. `components/views/TextToSpeech.tsx`
10. `App.tsx`
11. `components/Sidebar.tsx`
12. `src/lib/validation.ts`
13. `package.json`
14. `supabase-schema-production.sql` (live migration)
