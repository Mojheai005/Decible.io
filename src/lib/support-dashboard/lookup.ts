// Everything about one email: account, sign-in, plan, credits, generations, payments, grants,
// look-alike accounts and grants (typos), plus a plain-English list of what is wrong.
import { authUser, count, enc, inList, likeEsc, rest } from './sb'
import { fmtDate, fmtNum, pct } from './format'
import { engineOf, reasonOf } from './engines'
import { providerStatus } from './status'

export type Level = 'bad' | 'warn' | 'info' | 'ok'
export interface Finding { level: Level; text: string }

export interface Profile {
    id: string; email: string; name: string | null
    subscription_tier: string; subscription_status: string | null
    subscription_start_date: string | null; subscription_end_date: string | null; billing_period: string | null
    credits_remaining: number; credits_used_total: number | null; generations_total: number | null
    created_at: string; last_generation_at: string | null
}
export interface Grant {
    id: string; email: string; credits: number; grant_tier: string | null; claimed: boolean
    claimed_at: string | null; expires_at: string | null; expired: boolean | null
    source: string | null; note: string | null; created_at: string; batch_key: string | null
    source_order_id: string | null; amount_paid_paise: number | null
}
interface GenRow {
    created_at: string; status: string; voice_id: string | null; voice_name: string | null
    characters_used: number | null; audio_url: string | null; error_message: string | null
}
interface LedgerRow { created_at: string; type: string; amount: number; balance_after: number | null; description: string | null }
interface OrderRow {
    id: string; created_at: string; order_type: string | null; plan_id: string | null; billing_period: string | null
    amount: number; credits: number | null; status: string; razorpay_payment_id: string | null
    error_description: string | null; completed_at: string | null; credits_added: boolean | null
}
export interface Lookalikes {
    accounts: { email: string; name: string | null; subscription_tier: string; credits_remaining: number; created_at: string }[]
    waitingGrants: { email: string; note: string | null; created_at: string; hasAccount: boolean; why: string }[]
}

const PROFILE_COLS = 'id,email,name,subscription_tier,subscription_status,subscription_start_date,subscription_end_date,billing_period,credits_remaining,credits_used_total,generations_total,created_at,last_generation_at'
const GRANT_COLS = 'id,email,credits,grant_tier,claimed,claimed_at,expires_at,expired,source,note,created_at,batch_key,source_order_id,amount_paid_paise'
const PAID = ['starter', 'creator', 'pro', 'advanced']
const S2V_TIERS = ['creator', 'pro', 'advanced']

export function planActive(p: Pick<Profile, 'subscription_tier' | 'subscription_end_date'>): boolean {
    if (p.subscription_tier === 'free') return false
    return !p.subscription_end_date || Date.parse(p.subscription_end_date) > Date.now()
}

export async function findProfiles(email: string): Promise<Profile[]> {
    return rest<Profile[]>(`user_profiles?select=${PROFILE_COLS}&email=ilike.${enc(likeEsc(email))}`)
}
export async function findGrants(email: string): Promise<Grant[]> {
    return rest<Grant[]>(`pending_credit_grants?select=${GRANT_COLS}&email=ilike.${enc(likeEsc(email))}&order=created_at`)
}

/** Accounts and waiting course grants on emails that look like a typo of this one. */
export async function findLookalikes(email: string, name?: string | null): Promise<Lookalikes> {
    const [local] = email.split('@')
    const patterns: { pat: string; why: string }[] = []
    if (local.length >= 4) patterns.push({ pat: `${likeEsc(local)}@*`, why: 'same name, different domain' })
    if (local.length >= 7) patterns.push({ pat: `${likeEsc(local.slice(0, Math.max(6, local.length - 3)))}*`, why: 'similar spelling' })
    const digits = (local.match(/\d{3,}/g) || []).sort((a, b) => b.length - a.length)[0]
    const letters = local.replace(/[^a-z]/g, '').slice(0, 4)
    if (digits && letters.length >= 3) patterns.push({ pat: `${likeEsc(letters)}*${digits}*`, why: 'same letters and numbers' })

    const accounts = new Map<string, Lookalikes['accounts'][number]>()
    const grants = new Map<string, Omit<Lookalikes['waitingGrants'][number], 'hasAccount'>>()
    await Promise.all(patterns.map(async ({ pat, why }) => {
        const [ps, gs] = await Promise.all([
            rest<Lookalikes['accounts']>(`user_profiles?select=email,name,subscription_tier,credits_remaining,created_at&email=ilike.${enc(pat)}&limit=8`),
            rest<Grant[]>(`pending_credit_grants?select=email,note,created_at&claimed=eq.false&email=ilike.${enc(pat)}&limit=8`),
        ])
        for (const p of ps) if (p.email.toLowerCase() !== email) accounts.set(p.email.toLowerCase(), p)
        for (const g of gs) if (g.email !== email && !grants.has(g.email)) grants.set(g.email, { email: g.email, note: g.note, created_at: g.created_at, why })
    }))
    // Course purchases are noted as "Course purchase — Full Name": match the account's name too.
    const words = (name || '').toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z]/g, '')).filter(w => w.length >= 3)
    if (words.length >= 2) {
        const gs = await rest<Grant[]>(`pending_credit_grants?select=email,note,created_at&claimed=eq.false&note=ilike.${enc(`*${words[0]}*${words[words.length - 1]}*`)}&limit=8`)
        for (const g of gs) if (g.email !== email && !grants.has(g.email)) grants.set(g.email, { email: g.email, note: g.note, created_at: g.created_at, why: 'buyer name matches' })
    }
    const waiting = [...grants.values()]
    const withAccount = new Set<string>()
    if (waiting.length) {
        const owners = await rest<{ email: string }[]>(`user_profiles?select=email&email=in.${enc(inList(waiting.map(g => g.email)))}`)
        for (const o of owners) withAccount.add(o.email.toLowerCase())
    }
    return {
        accounts: [...accounts.values()].slice(0, 12),
        waitingGrants: waiting.map(g => ({ ...g, hasAccount: withAccount.has(g.email) })).slice(0, 12),
    }
}

export async function lookup(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase()
    const [profiles, grants] = await Promise.all([findProfiles(email), findGrants(email)])
    const p = profiles[0]
    const lookalikes = await findLookalikes(email, p?.name)

    if (!p) {
        const findings: Finding[] = [{ level: 'bad', text: 'No Decible account uses this exact email.' }]
        if (grants.some(g => !g.claimed)) findings.push({ level: 'info', text: 'A grant is waiting on this email. It applies by itself the moment they sign up with exactly this email ("Continue with Google" is easiest).' })
        if (lookalikes.accounts.length) findings.push({ level: 'warn', text: `Accounts with a similar email exist, so they probably signed up with one of these: ${lookalikes.accounts.map(a => a.email).join(', ')}` })
        const stranded = lookalikes.waitingGrants.filter(g => !g.hasAccount)
        if (stranded.length) findings.push({ level: 'warn', text: `A course grant is waiting on a similar email with no account: ${stranded.map(g => g.email).join(', ')}` })
        return { email, found: false as const, grants, lookalikes, findings }
    }

    const now = Date.now()
    const since = (ms: number) => enc(new Date(now - ms).toISOString())
    const U = `generation_history?user_id=eq.${p.id}&voice_id=neq.batch`
    const [auth, okAll, failAll, ok7, fail7, ok24, fail24, joins, recent, ledger, orders, sameName] = await Promise.all([
        authUser(p.id),
        count(`${U}&status=eq.completed`),
        count(`${U}&status=eq.failed`),
        count(`${U}&status=eq.completed&created_at=gte.${since(7 * 864e5)}`),
        count(`${U}&status=eq.failed&created_at=gte.${since(7 * 864e5)}`),
        count(`${U}&status=eq.completed&created_at=gte.${since(864e5)}`),
        count(`${U}&status=eq.failed&created_at=gte.${since(864e5)}`),
        count(`generation_history?user_id=eq.${p.id}&voice_id=eq.batch&status=eq.completed`),
        rest<GenRow[]>(`generation_history?select=created_at,status,voice_id,voice_name,characters_used,audio_url,error_message&user_id=eq.${p.id}&order=created_at.desc&limit=300`),
        rest<LedgerRow[]>(`credit_transactions?select=created_at,type,amount,balance_after,description&user_id=eq.${p.id}&type=neq.generation&order=created_at.desc&limit=300`),
        rest<OrderRow[]>(`payment_orders?select=id,created_at,order_type,plan_id,billing_period,amount,credits,status,razorpay_payment_id,error_description,completed_at,credits_added&user_id=eq.${p.id}&order=created_at.desc&limit=50`),
        p.name && p.name.trim().length >= 3
            ? rest<Lookalikes['accounts']>(`user_profiles?select=email,name,subscription_tier,credits_remaining,created_at&name=ilike.${enc(likeEsc(p.name.trim()))}&id=neq.${p.id}&limit=10`)
            : Promise.resolve([]),
    ])

    // Generations: engine split and failure reasons over the last 300 attempts.
    const engines: Record<string, { ok: number; failed: number }> = {}
    const reasons: Record<string, { label: string; count: number; last: string; example: string }> = {}
    for (const g of recent) {
        const e = engineOf(g.voice_id)
        engines[e] ??= { ok: 0, failed: 0 }
        if (g.status === 'completed') engines[e].ok++
        else {
            engines[e].failed++
            const r = reasonOf(g.error_message)
            const key = `${e}: ${r.label}`
            reasons[key] ??= { label: key, count: 0, last: g.created_at, example: (g.error_message || '').slice(0, 200) }
            reasons[key].count++
        }
    }

    const credits = { granted: 0, bought: 0, refunded: 0, adjusted: 0 }
    for (const t of ledger) {
        if (t.type === 'bonus') credits.granted += t.amount
        else if (t.type === 'topup' || t.type === 'purchase') credits.bought += t.amount
        else if (t.type === 'refund') credits.refunded += t.amount
        else credits.adjusted += t.amount
    }

    const authInfo = auth && {
        providers: (auth.app_metadata?.providers as string[] | undefined) || [auth.app_metadata?.provider].filter(Boolean),
        confirmed: Boolean(auth.email_confirmed_at),
        confirmationSentAt: auth.confirmation_sent_at || null,
        lastSignIn: auth.last_sign_in_at || null,
        createdAt: auth.created_at || null,
    }

    // ---- What is wrong, in plain English ----
    const f: Finding[] = []
    if (authInfo && !authInfo.confirmed) {
        f.push({ level: 'bad', text: `Signed up with email and password but never confirmed the email, so they cannot log in. Ask them to use "Continue with Google" with this Gmail, or to click the confirmation email${authInfo.confirmationSentAt ? ` sent ${fmtDate(authInfo.confirmationSentAt)}` : ''} (check Spam).` })
    }
    if (profiles.length > 1) f.push({ level: 'warn', text: `${profiles.length} accounts match this email in different letter case; showing the first.` })

    const end = p.subscription_end_date
    const daysLeft = end ? Math.ceil((Date.parse(end) - now) / 864e5) : null
    const courseGrant = grants.find(g => g.claimed && g.grant_tier === 'pro')
    if (p.subscription_tier !== 'free' && planActive(p)) {
        f.push({ level: 'ok', text: `On ${p.subscription_tier}${end ? ` until ${fmtDate(end, false)} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)` : ' with no end date'}.` })
    } else if (p.subscription_tier !== 'free') {
        f.push({ level: 'warn', text: `Shows the ${p.subscription_tier} plan, but it ended on ${fmtDate(end, false)} and was never moved to Free. Their "Current plan" button stays disabled, so they cannot buy ${p.subscription_tier} again until the account is moved to Free.` })
    } else if (courseGrant) {
        f.push({ level: 'info', text: `Free plan. Their course Pro (from ${fmtDate(courseGrant.claimed_at, false)}) ended on ${fmtDate(courseGrant.expires_at, false)}; they kept their credits.` })
    } else {
        f.push({ level: 'info', text: 'Free plan.' })
    }
    if (!S2V_TIERS.includes(p.subscription_tier) || !planActive(p)) {
        f.push({ level: 'info', text: 'Script to Voice is locked for them: it needs an active Creator, Pro or Advanced plan. Text to Speech still works with their credits.' })
    }
    if (p.credits_remaining < 500) f.push({ level: 'warn', text: `Only ${fmtNum(p.credits_remaining)} credits left (1 credit = 1 character).` })

    const unclaimed = grants.filter(g => !g.claimed)
    if (unclaimed.length) f.push({ level: 'warn', text: 'A grant is waiting on this email but was never applied to the account. The Grant tab will apply it.' })
    if (grants.some(g => g.claimed)) {
        for (const g of grants.filter(g => g.claimed)) f.push({ level: 'ok', text: `Received ${fmtNum(g.credits)} credits${g.grant_tier ? ` + ${g.grant_tier}` : ''} on ${fmtDate(g.claimed_at, false)} (${g.source === 'pabbly' ? 'course purchase' : g.batch_key === 'dashboard' ? 'dashboard grant' : 'manual grant'}).` })
    } else if (!unclaimed.length) {
        const stranded = lookalikes.waitingGrants.filter(g => !g.hasAccount)
        f.push(stranded.length
            ? { level: 'warn', text: `No grant on this email, but a course grant is waiting on a similar email that has no account: ${stranded.map(g => `${g.email} (${g.note || 'grant'})`).join('; ')}. It is probably theirs: use Grant → "Move it here".` }
            : { level: 'info', text: 'No course or manual grant on this email.' })
    }

    const last24 = recent.filter(g => Date.parse(g.created_at) > now - 864e5)
    const failed24 = last24.filter(g => g.status !== 'completed')
    if (failed24.length) {
        const byReason = new Map<string, number>()
        for (const g of failed24) { const k = `${engineOf(g.voice_id)}: ${reasonOf(g.error_message).label}`; byReason.set(k, (byReason.get(k) || 0) + 1) }
        const ourSide = failed24.filter(g => ['out_of_funds', 'auth'].includes(reasonOf(g.error_message).code))
        let advice = ''
        if (ourSide.length) {
            // Say whether that provider is working again right now, so support gives the right advice.
            const names = [...new Set(ourSide.map(g => engineOf(g.voice_id)))]
            const live = await providerStatus().catch(() => null)
            const stillDown = names.filter(n => { const s = live?.engines.find(e => e.engine === n); return !s || s.state === 'down' || s.state === 'degraded' })
            advice = ` These failures were on our side (our ${names.join('/')} account was empty or its key failed), not their fault. ` +
                (stillDown.length
                    ? `${stillDown.join('/')} still looks down right now: ask them to pick a voice from another provider for now.`
                    : `${names.join('/')} is working again now: they can simply try again.`)
        }
        f.push({ level: ourSide.length ? 'bad' : 'warn', text: `${failed24.length} failed attempt${failed24.length === 1 ? '' : 's'} in the last 24 hours (${[...byReason].map(([k, v]) => `${k} ×${v}`).join(', ')}). Every failed attempt is refunded automatically.${advice}` })
    }
    if (ok7 + fail7 >= 5 && ok7 / (ok7 + fail7) < 0.8) f.push({ level: 'warn', text: `Low success rate this week: ${pct(ok7, ok7 + fail7)} of ${ok7 + fail7} attempts worked.` })

    const paidOrders = orders.filter(o => o.status === 'completed')
    for (const o of orders.filter(o => o.status === 'failed' && /delay|cancel/i.test(o.error_description || ''))) {
        const later = paidOrders.some(x => Date.parse(x.created_at) > Date.parse(o.created_at) && x.plan_id === o.plan_id)
        if (!later) f.push({ level: 'bad', text: `Possible late UPI payment: the ₹${fmtNum(o.amount / 100)} ${o.plan_id || 'top-up'} order on ${fmtDate(o.created_at)} (${o.id}) was marked failed with "delay in response from the UPI app" and they never paid another. If Razorpay shows that money captured, they paid but got nothing.` })
    }
    const abandoned = orders.filter(o => o.status === 'created')
    if (abandoned.length) f.push({ level: 'info', text: `${abandoned.length} checkout${abandoned.length === 1 ? '' : 's'} started but not finished (latest ${fmtDate(abandoned[0].created_at)}).` })
    if (paidOrders.length) f.push({ level: 'ok', text: `Paid ${paidOrders.length} time${paidOrders.length === 1 ? '' : 's'}: ${paidOrders.slice(0, 3).map(o => `₹${fmtNum(o.amount / 100)} ${o.plan_id || 'top-up'} on ${fmtDate(o.created_at, false)}`).join(', ')}.` })
    if (paidOrders.some(o => !o.credits_added)) f.push({ level: 'bad', text: 'A completed payment has credits_added = false: they paid and the credits may not have been added.' })

    const others = sameName.filter(a => a.email.toLowerCase() !== email)
    const similar = lookalikes.accounts
    if (similar.length) f.push({ level: 'info', text: `Other accounts with a similar email: ${similar.map(a => `${a.email} (${a.subscription_tier}, ${fmtNum(a.credits_remaining)} credits)`).join('; ')}. If they "can't see" credits, they may be logged in to the wrong one.` })

    return {
        email,
        found: true as const,
        account: {
            id: p.id, email: p.email, name: p.name, tier: p.subscription_tier, status: p.subscription_status,
            billingPeriod: p.billing_period, planStart: p.subscription_start_date, planEnd: end, daysLeft,
            planActive: planActive(p), credits: p.credits_remaining, creditsUsedTotal: p.credits_used_total,
            createdAt: p.created_at, lastGenerationAt: p.last_generation_at, isPaidTier: PAID.includes(p.subscription_tier),
        },
        auth: authInfo,
        generations: {
            completed: okAll, failed: failAll, successRate: pct(okAll, okAll + failAll),
            week: { completed: ok7, failed: fail7 }, day: { completed: ok24, failed: fail24 }, scriptToVoiceFiles: joins,
            engines, reasons: Object.values(reasons).sort((a, b) => b.count - a.count),
            recent: recent.slice(0, 100).map(g => ({
                at: g.created_at, status: g.status, engine: engineOf(g.voice_id), voice: g.voice_name,
                chars: g.characters_used, audioUrl: g.status === 'completed' ? g.audio_url : null,
                error: g.status === 'completed' ? null : g.error_message,
            })),
        },
        credits: { balance: p.credits_remaining, ...credits, ledger: ledger.slice(0, 100) },
        payments: orders,
        grants,
        lookalikes,
        sameName: others,
        findings: f,
    }
}

export type LookupResult = Awaited<ReturnType<typeof lookup>>
