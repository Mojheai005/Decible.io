// Grants the course bonus (500,000 credits + Pro for 30 days) the same way a course purchase does:
// a row in pending_credit_grants, then claim_credit_grants() applies it (credits, plan, end date,
// ledger entry). Every rule is checked here on the server, every time.
import { count, enc, json, rest, SbError } from './sb'
import { env } from './env'
import { fmtDate, fmtNum, istMidnight } from './format'
import { findGrants, findLookalikes, findProfiles, planActive, type Lookalikes, type Profile } from './lookup'

export const GRANT_CREDITS = 500000
export const GRANT_DAYS = 30
const BATCH = 'dashboard'

export type GrantAction = 'grant' | 'apply_waiting' | 'waiting_grant' | 'blocked'
export interface GrantPlan {
    email: string
    action: GrantAction
    message: string
    account: { email: string; name: string | null; tier: string; planEnd: string | null; credits: number } | null
    lookalikes: Lookalikes
    warnings: string[]
}

const accountOf = (p?: Profile) => p ? { email: p.email, name: p.name, tier: p.subscription_tier, planEnd: p.subscription_end_date, credits: p.credits_remaining } : null

async function grantsMadeToday(): Promise<number> {
    return count(`pending_credit_grants?batch_key=eq.${BATCH}&created_at=gte.${enc(istMidnight())}`)
        .then(async n => n + await count(`pending_credit_grants?note=like.${enc('*moved * by dashboard*')}&claimed_at=gte.${enc(istMidnight())}`))
}

async function dailyLimitHit(): Promise<string | null> {
    const limit = Number(env('GRANT_DAILY_LIMIT', '40')) || 40
    const made = await grantsMadeToday()
    return made >= limit ? `The dashboard has already made ${made} grants today (limit ${limit}). Ask the admin to raise GRANT_DAILY_LIMIT if this is expected.` : null
}

/** Works out what a grant would do for this email, without changing anything. */
export async function planGrant(rawEmail: string): Promise<GrantPlan> {
    const email = rawEmail.trim().toLowerCase()
    const [profiles, grants] = await Promise.all([findProfiles(email), findGrants(email)])
    const p = profiles[0]
    const lookalikes = await findLookalikes(email, p?.name)
    const base = { email, account: accountOf(p), lookalikes, warnings: [] as string[] }
    const blocked = (message: string): GrantPlan => ({ ...base, action: 'blocked', message })

    if (profiles.length > 1) return blocked(`${profiles.length} accounts match this email. Escalate it instead.`)

    const stranded = lookalikes.waitingGrants.filter(g => !g.hasAccount)
    if (stranded.length) base.warnings.push(`A course grant is already waiting on a similar email with no account (${stranded.map(g => g.email).join(', ')}). If that is this person's typo, use "Move it here" instead of a new grant, so the course purchase is not given twice.`)
    if (lookalikes.accounts.length) base.warnings.push(`Similar accounts exist (${lookalikes.accounts.slice(0, 4).map(a => `${a.email}: ${a.subscription_tier}`).join(', ')}). Make sure this is the email they actually log in with.`)

    const unclaimed = grants.filter(g => !g.claimed)
    const claimed = grants.filter(g => g.claimed)

    if (p) {
        if (['pro', 'advanced'].includes(p.subscription_tier) && planActive(p)) {
            return blocked(`Already on ${p.subscription_tier} until ${fmtDate(p.subscription_end_date, false)} with ${fmtNum(p.credits_remaining)} credits. Nothing to do.`)
        }
        if (unclaimed.length) {
            return { ...base, action: 'apply_waiting', message: `A grant (${unclaimed.map(g => g.note || g.source).join('; ')}) is already waiting on this email but was never applied. Granting will apply it now.` }
        }
        const prior = claimed.find(g => g.grant_tier === 'pro' || g.credits >= GRANT_CREDITS)
        if (prior) {
            return blocked(`Already received ${fmtNum(prior.credits)} credits${prior.grant_tier ? ` + ${prior.grant_tier}` : ''} on ${fmtDate(prior.claimed_at, false)} (${prior.source === 'pabbly' ? 'course purchase' : 'manual grant'}). The bonus is given once per person. If they need more, escalate it.`)
        }
        return { ...base, action: 'grant', message: `Will add ${fmtNum(GRANT_CREDITS)} credits (${fmtNum(p.credits_remaining)} → ${fmtNum(p.credits_remaining + GRANT_CREDITS)}) and put them on Pro for ${GRANT_DAYS} days, until about ${fmtDate(new Date(Date.now() + GRANT_DAYS * 864e5).toISOString(), false)}.` }
    }

    if (grants.length) return blocked(`No account yet, but a grant is already waiting on this email (${grants[0].note || grants[0].source}). It applies by itself when they sign up with exactly this email.`)
    if (lookalikes.accounts.length) base.warnings.unshift('There is no account with this exact email, but similar ones exist: they may have signed up with a different email. Check before granting.')
    return { ...base, action: 'waiting_grant', message: `No account uses this email yet. Will save a waiting grant: ${fmtNum(GRANT_CREDITS)} credits + ${GRANT_DAYS} days of Pro, applied the moment they sign up with exactly this email (the ${GRANT_DAYS} days start then).` }
}

export interface GrantOutcome { ok: boolean; message: string; before?: GrantPlan['account']; after?: GrantPlan['account'] }

async function claim(p: { id: string; email: string }): Promise<number> {
    return rest<number>('rpc/claim_credit_grants', { method: 'POST', ...json({ p_user_id: p.id, p_email: p.email }) })
}
async function reload(id: string) {
    const [p] = await rest<Profile[]>(`user_profiles?select=id,email,name,subscription_tier,subscription_end_date,credits_remaining&id=eq.${id}`)
    return accountOf(p)
}

/** Re-checks everything, then grants. `reason` and the staff name are saved on the grant. */
export async function executeGrant(rawEmail: string, staff: string, reason: string, confirmedWarnings: boolean): Promise<GrantOutcome> {
    const plan = await planGrant(rawEmail)
    if (plan.action === 'blocked') return { ok: false, message: plan.message }
    if (plan.warnings.length && !confirmedWarnings) return { ok: false, message: 'Please read the warnings and tick the box to confirm.' }
    const limit = await dailyLimitHit()
    if (limit) return { ok: false, message: limit }

    const [p] = await findProfiles(plan.email)
    if (plan.action !== 'apply_waiting') {
        const today = fmtDate(new Date().toISOString(), false)
        try {
            await rest('pending_credit_grants', {
                method: 'POST',
                ...json({
                    email: plan.email, credits: GRANT_CREDITS, grant_tier: 'pro', valid_for_days: GRANT_DAYS,
                    batch_key: BATCH, source: 'manual_batch',
                    note: `Dashboard grant ${today} by ${staff}: ${reason || 'support request'}`.slice(0, 300),
                }, { Prefer: 'return=minimal' }),
            })
        } catch (e) {
            if (e instanceof SbError && e.status === 409) return { ok: false, message: 'This email already has a manual grant (the database allows one per person). Look it up to see it.' }
            throw e
        }
    }
    if (!p) return { ok: true, message: `Saved a waiting grant for ${plan.email}. It applies automatically when they sign up with exactly this email.` }

    const added = await claim(p)
    const after = await reload(p.id)
    return {
        ok: added > 0,
        message: added > 0
            ? `Done: ${plan.email} now has ${fmtNum(after?.credits)} credits and is on ${after?.tier} until ${fmtDate(after?.planEnd, false)}.`
            : 'The grant was saved but the account did not change. Look the email up again, and escalate if it still shows no grant.',
        before: accountOf(p),
        after,
    }
}

/** Moves a waiting course grant from a mistyped email (no account) to the account they really use. */
export async function moveGrant(rawFrom: string, rawTo: string, staff: string): Promise<GrantOutcome> {
    const from = rawFrom.trim().toLowerCase(), to = rawTo.trim().toLowerCase()
    if (from === to) return { ok: false, message: 'Pick a different email to move from.' }
    const [fromProfiles, toProfiles, toGrants, fromGrants] = await Promise.all([findProfiles(from), findProfiles(to), findGrants(to), findGrants(from)])
    if (fromProfiles.length) return { ok: false, message: `${from} has its own Decible account, so its grant is not stranded. Not moving it.` }
    if (toProfiles.length !== 1) return { ok: false, message: `${to} needs exactly one Decible account to move a grant to (found ${toProfiles.length}).` }
    const p = toProfiles[0]
    if (['pro', 'advanced'].includes(p.subscription_tier) && planActive(p)) return { ok: false, message: `${to} is already on ${p.subscription_tier} until ${fmtDate(p.subscription_end_date, false)}.` }
    if (toGrants.length) return { ok: false, message: `${to} already has a grant, so moving another would give the bonus twice.` }
    const waiting = fromGrants.filter(g => !g.claimed)
    if (waiting.length !== 1) return { ok: false, message: `${from} has ${waiting.length} waiting grants; expected exactly one. Escalate it.` }
    const limit = await dailyLimitHit()
    if (limit) return { ok: false, message: limit }

    const g = waiting[0]
    const today = fmtDate(new Date().toISOString(), false)
    const moved = await rest<unknown[]>(`pending_credit_grants?id=eq.${g.id}&claimed=eq.false`, {
        method: 'PATCH',
        ...json({ email: p.email.toLowerCase(), note: `${g.note || ''} | moved ${today} by dashboard (${staff}) from ${from}`.slice(0, 500) }, { Prefer: 'return=representation' }),
    })
    if (!moved?.length) return { ok: false, message: 'That grant changed in the meantime. Look both emails up again.' }
    const added = await claim(p)
    const after = await reload(p.id)
    return {
        ok: added > 0,
        message: added > 0
            ? `Moved the grant from ${from} to ${p.email}: now ${fmtNum(after?.credits)} credits, on ${after?.tier} until ${fmtDate(after?.planEnd, false)}.`
            : 'The grant was moved but the account did not change. Escalate it.',
        before: accountOf(p),
        after,
    }
}
