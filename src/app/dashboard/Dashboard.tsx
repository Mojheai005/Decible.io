'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Finding, Grant, Lookalikes, LookupResult } from '@/lib/support-dashboard/lookup'
import type { GrantOutcome, GrantPlan } from '@/lib/support-dashboard/grant'
import type { Escalation, Status } from '@/lib/support-dashboard/escalations'
import type { EngineStatus } from '@/lib/support-dashboard/status'
import { fmtDate, fmtNum } from '@/lib/support-dashboard/format'

type Tab = 'lookup' | 'grant' | 'escalations'
interface Req { email: string; n: number }
type ApiResult<T> = { ok: boolean; data: T & { error?: string } }

// Everyone shares one password, so each person's name lives in their own browser and is sent with
// grants, escalations and notes for the record. Optional: blank means "Team".
const NAME_KEY = 'dd_name'
const savedName = () => { try { return localStorage.getItem(NAME_KEY) || '' } catch { return '' } }

async function api<T>(url: string, body?: unknown, method?: string): Promise<ApiResult<T>> {
    if (body && typeof body === 'object' && !Array.isArray(body)) body = { by: savedName(), ...body }
    const res = await fetch(url, body === undefined
        ? { method: method || 'GET' }
        : { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.status === 401) {
        window.location.href = '/dashboard/login'
        return { ok: false, data: { error: 'Logged out' } as T & { error?: string } }
    }
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    return { ok: res.ok, data }
}

export default function Dashboard() {
    const [tab, setTab] = useState<Tab>('lookup')
    const [name, setName] = useState('')
    useEffect(() => { setName(savedName()) }, [])
    const changeName = (v: string) => {
        setName(v)
        try { localStorage.setItem(NAME_KEY, v.trim()) } catch { /* private window: name just isn't remembered */ }
    }
    const [lookupReq, setLookupReq] = useState<Req | null>(null)
    const [grantReq, setGrantReq] = useState<Req | null>(null)
    const [escReq, setEscReq] = useState<Req | null>(null)

    const go = useCallback((t: Tab, email?: string) => {
        setTab(t)
        if (!email) return
        const req = { email, n: Date.now() }
        if (t === 'lookup') setLookupReq(req)
        if (t === 'grant') setGrantReq(req)
        if (t === 'escalations') setEscReq(req)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])

    // Direct links: /?email=someone@gmail.com opens straight into a lookup.
    useEffect(() => {
        const email = new URLSearchParams(window.location.search).get('email')
        if (email) go('lookup', email)
    }, [go])

    async function logout() {
        await fetch('/dashboard/api/logout', { method: 'POST' })
        window.location.href = '/dashboard/login'
    }

    return (
        <main className="wrap">
            <div className="topbar">
                <div className="brand">Decible Support</div>
                <div className="who">
                    <label className="row small" title="Saved in this browser and written on the grants and escalations you make">
                        Your name
                        <input value={name} onChange={e => changeName(e.target.value)} placeholder="optional, for records" maxLength={40} style={{ width: 170, padding: '5px 8px' }} />
                    </label>
                    <button className="btn small" onClick={logout}>Log out</button>
                </div>
            </div>
            <StatusStrip />
            <nav className="tabs">
                <button className={`tab ${tab === 'lookup' ? 'on' : ''}`} onClick={() => setTab('lookup')}>1 · Look up account</button>
                <button className={`tab ${tab === 'grant' ? 'on' : ''}`} onClick={() => setTab('grant')}>2 · Grant 500k + Pro</button>
                <button className={`tab ${tab === 'escalations' ? 'on' : ''}`} onClick={() => setTab('escalations')}>3 · Escalate a problem</button>
            </nav>
            <section hidden={tab !== 'lookup'}><LookupTab request={lookupReq} go={go} /></section>
            <section hidden={tab !== 'grant'}><GrantTab request={grantReq} go={go} /></section>
            <section hidden={tab !== 'escalations'}><EscalationsTab request={escReq} go={go} /></section>
        </main>
    )
}

/* ------------------------------------------------------------------ status */

function StatusStrip() {
    const [s, setS] = useState<{ engines: EngineStatus[]; lastGenerationAt: string | null } | null>(null)
    const [err, setErr] = useState('')
    useEffect(() => {
        let alive = true
        const load = async () => {
            const { ok, data } = await api<{ engines: EngineStatus[]; lastGenerationAt: string | null }>('/dashboard/api/status')
            if (!alive) return
            if (ok) { setS(data); setErr('') } else setErr(data.error || 'Status unavailable')
        }
        load()
        const t = setInterval(load, 60000)
        return () => { alive = false; clearInterval(t) }
    }, [])
    const label = { ok: 'working', degraded: 'some failing', down: 'DOWN', quiet: 'no traffic' }
    if (err) return <div className="status"><span className="chip err">Provider status: {err}</span></div>
    if (!s) return <div className="status"><span className="chip muted">Checking voice providers…</span></div>
    return (
        <div className="status" title="Based on the last hour of generations">
            {s.engines.map(e => (
                <span key={e.engine} className="chip" title={e.note}>
                    <span className={`dot ${e.state}`} />
                    <b>{e.engine}</b> {label[e.state]}
                    {(e.state === 'down' || e.state === 'degraded') && <span className="muted small">· {e.note}, {e.users} users</span>}
                </span>
            ))}
            <span className="chip muted small">Last voice made {fmtDate(s.lastGenerationAt)}</span>
        </div>
    )
}

/* ------------------------------------------------------------------ shared bits */

function Findings({ items }: { items: Finding[] }) {
    if (!items.length) return null
    return <ul className="findings">{items.map((f, i) => <li key={i} className={`lv-${f.level}`}>{f.text}</li>)}</ul>
}

function EmailForm({ value, onChange, onSubmit, busy, button }: { value: string; onChange: (v: string) => void; onSubmit: () => void; busy: boolean; button: string }) {
    return (
        <form className="row" onSubmit={e => { e.preventDefault(); onSubmit() }}>
            <input className="grow" type="email" inputMode="email" placeholder="user@gmail.com" value={value} onChange={e => onChange(e.target.value)} required />
            <button className="btn primary" disabled={busy}>{busy ? 'Working…' : button}</button>
        </form>
    )
}

const tierBadge = (tier: string, active: boolean) => (
    <span className={`badge ${tier === 'free' ? '' : active ? 'ok' : 'warn'}`}>{tier}{tier !== 'free' && !active ? ' (ended)' : ''}</span>
)

/* ------------------------------------------------------------------ 1. lookup */

function LookupTab({ request, go }: { request: Req | null; go: (t: Tab, email?: string) => void }) {
    const [email, setEmail] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [r, setR] = useState<LookupResult | null>(null)

    const run = useCallback(async (e: string) => {
        const value = e.trim().toLowerCase()
        if (!value) return
        setEmail(value); setBusy(true); setError('')
        const { ok, data } = await api<LookupResult>(`/dashboard/api/lookup?email=${encodeURIComponent(value)}`)
        setBusy(false)
        if (ok) setR(data); else { setR(null); setError(data.error || 'Lookup failed') }
    }, [])

    useEffect(() => { if (request) run(request.email) }, [request, run])

    return (
        <div>
            <div className="panel stack">
                <h2>Check an account</h2>
                <p className="muted small">Credits, plan dates, sign-in, every generation with its success rate and failure reasons, payments, grants and look-alike emails.</p>
                <EmailForm value={email} onChange={setEmail} onSubmit={() => run(email)} busy={busy} button="Look up" />
                {error && <div className="msg bad">{error}</div>}
            </div>
            {r && <LookupView r={r} go={go} />}
        </div>
    )
}

function LookupView({ r, go }: { r: LookupResult; go: (t: Tab, email?: string) => void }) {
    return (
        <>
            <div className="panel stack">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                    <h2>{r.found ? `${r.account.name || 'No name'} · ${r.account.email}` : r.email}</h2>
                    <div className="row">
                        <button className="btn small" onClick={() => go('grant', r.email)}>Grant 500k + Pro…</button>
                        <button className="btn small" onClick={() => go('escalations', r.email)}>Escalate…</button>
                    </div>
                </div>
                <h3>What&apos;s going on</h3>
                <Findings items={r.findings} />
            </div>

            {r.found && (
                <>
                    <div className="grid" style={{ marginBottom: 14 }}>
                        <div className="card stack">
                            <h3>Plan</h3>
                            <div className="big">{tierBadge(r.account.tier, r.account.planActive)}</div>
                            <dl className="kv">
                                <dt>Started</dt><dd>{fmtDate(r.account.planStart, false)}</dd>
                                <dt>Ends</dt><dd>{r.account.planEnd ? fmtDate(r.account.planEnd) : r.account.tier === 'free' ? '-' : 'no end date'}</dd>
                                <dt>Days left</dt><dd>{r.account.daysLeft === null ? '-' : r.account.daysLeft > 0 ? r.account.daysLeft : 'ended'}</dd>
                                <dt>Billing</dt><dd>{r.account.billingPeriod || '-'}</dd>
                            </dl>
                        </div>
                        <div className="card stack">
                            <h3>Credits</h3>
                            <div className="big">{fmtNum(r.credits.balance)}</div>
                            <dl className="kv">
                                <dt>Granted</dt><dd>{fmtNum(r.credits.granted)}</dd>
                                <dt>Bought</dt><dd>{fmtNum(r.credits.bought)}</dd>
                                <dt>Refunded</dt><dd>{fmtNum(r.credits.refunded)}</dd>
                                <dt>Used in total</dt><dd>{fmtNum(r.account.creditsUsedTotal)}</dd>
                            </dl>
                        </div>
                        <div className="card stack">
                            <h3>Generations</h3>
                            <div className="big">{r.generations.successRate} <span className="muted small">worked</span></div>
                            <dl className="kv">
                                <dt>All time</dt><dd>{fmtNum(r.generations.completed)} ok · {fmtNum(r.generations.failed)} failed</dd>
                                <dt>Last 7 days</dt><dd>{fmtNum(r.generations.week.completed)} ok · {fmtNum(r.generations.week.failed)} failed</dd>
                                <dt>Last 24 h</dt><dd>{fmtNum(r.generations.day.completed)} ok · {fmtNum(r.generations.day.failed)} failed</dd>
                                <dt>Script to Voice files</dt><dd>{fmtNum(r.generations.scriptToVoiceFiles)}</dd>
                                <dt>Last voice</dt><dd>{fmtDate(r.account.lastGenerationAt)}</dd>
                            </dl>
                        </div>
                        <div className="card stack">
                            <h3>Account</h3>
                            <dl className="kv">
                                <dt>Joined</dt><dd>{fmtDate(r.account.createdAt)}</dd>
                                <dt>Signs in with</dt><dd>{r.auth?.providers?.join(' + ') || '-'}</dd>
                                <dt>Email confirmed</dt><dd>{r.auth ? (r.auth.confirmed ? 'yes' : <b className="err">NO, cannot log in</b>) : '-'}</dd>
                                <dt>Last sign-in</dt><dd>{fmtDate(r.auth?.lastSignIn)}</dd>
                                <dt>User id</dt><dd className="mono">{r.account.id}</dd>
                            </dl>
                        </div>
                    </div>

                    <div className="panel stack">
                        <h2>Generations by provider <span className="muted small">(last 300 attempts)</span></h2>
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Provider</th><th className="num">Worked</th><th className="num">Failed</th></tr></thead>
                                <tbody>{Object.entries(r.generations.engines).map(([e, v]) => <tr key={e}><td>{e}</td><td className="num">{fmtNum(v.ok)}</td><td className="num">{fmtNum(v.failed)}</td></tr>)}</tbody>
                            </table>
                        </div>
                        {r.generations.reasons.length > 0 && (
                            <div className="table-wrap">
                                <table>
                                    <thead><tr><th>Why it failed</th><th className="num">Times</th><th>Latest</th><th>Example error</th></tr></thead>
                                    <tbody>{r.generations.reasons.map(x => <tr key={x.label}><td>{x.label}</td><td className="num">{x.count}</td><td>{fmtDate(x.last)}</td><td className="mono">{x.example}</td></tr>)}</tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <RecentGenerations rows={r.generations.recent} />
                    <Payments rows={r.payments} />
                    <Ledger rows={r.credits.ledger} />
                </>
            )}

            <GrantsTable grants={r.grants} />
            <LookalikesView l={r.lookalikes} sameName={r.found ? r.sameName : []} go={go} />
        </>
    )
}

function RecentGenerations({ rows }: { rows: Extract<LookupResult, { found: true }>['generations']['recent'] }) {
    const [all, setAll] = useState(false)
    const shown = all ? rows : rows.slice(0, 25)
    return (
        <div className="panel stack">
            <h2>Recent generations <span className="muted small">(newest first)</span></h2>
            {rows.length === 0 ? <p className="muted">None yet.</p> : (
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>When</th><th>Provider · voice</th><th className="num">Chars</th><th>Result</th></tr></thead>
                        <tbody>{shown.map((g, i) => (
                            <tr key={i}>
                                <td>{fmtDate(g.at)}</td>
                                <td>{g.engine}{g.voice ? ` · ${g.voice}` : ''}</td>
                                <td className="num">{fmtNum(g.chars)}</td>
                                <td>{g.status === 'completed'
                                    ? (g.audioUrl ? <a href={g.audioUrl} target="_blank" rel="noreferrer">✓ audio</a> : '✓')
                                    : <span className="err mono">✗ {g.error || g.status}</span>}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
            {rows.length > 25 && <button className="btn small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${rows.length}`}</button>}
        </div>
    )
}

function Payments({ rows }: { rows: Extract<LookupResult, { found: true }>['payments'] }) {
    return (
        <div className="panel stack">
            <h2>Payments</h2>
            {rows.length === 0 ? <p className="muted">No checkouts.</p> : (
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>When</th><th>What</th><th className="num">Amount</th><th>Status</th><th>Order / payment</th></tr></thead>
                        <tbody>{rows.map(o => (
                            <tr key={o.id}>
                                <td>{fmtDate(o.created_at)}</td>
                                <td>{o.plan_id ? `${o.plan_id} (${o.billing_period || 'monthly'})` : 'top-up'}{o.credits ? ` · ${fmtNum(o.credits)} credits` : ''}</td>
                                <td className="num">₹{fmtNum(o.amount / 100)}</td>
                                <td><span className={`badge ${o.status === 'completed' ? 'ok' : o.status === 'failed' ? 'bad' : ''}`}>{o.status === 'created' ? 'not paid' : o.status}</span>{o.error_description && <div className="small err">{o.error_description}</div>}</td>
                                <td className="mono">{o.id}{o.razorpay_payment_id ? <><br />{o.razorpay_payment_id}</> : null}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

function Ledger({ rows }: { rows: Extract<LookupResult, { found: true }>['credits']['ledger'] }) {
    return (
        <details className="panel">
            <summary>Credit history (grants, purchases, refunds, adjustments: {rows.length})</summary>
            <div className="table-wrap" style={{ marginTop: 10 }}>
                <table>
                    <thead><tr><th>When</th><th>Type</th><th className="num">Amount</th><th className="num">Balance after</th><th>Description</th></tr></thead>
                    <tbody>{rows.map((t, i) => (
                        <tr key={i}><td>{fmtDate(t.created_at)}</td><td>{t.type}</td><td className="num">{fmtNum(t.amount)}</td><td className="num">{fmtNum(t.balance_after)}</td><td className="small">{(t.description || '').slice(0, 160)}</td></tr>
                    ))}</tbody>
                </table>
            </div>
        </details>
    )
}

function GrantsTable({ grants }: { grants: Grant[] }) {
    return (
        <div className="panel stack">
            <h2>Grants on this email</h2>
            {grants.length === 0 ? <p className="muted">None.</p> : (
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Created</th><th>What</th><th>State</th><th>Plan ends</th><th>Source / note</th></tr></thead>
                        <tbody>{grants.map(g => (
                            <tr key={g.id}>
                                <td>{fmtDate(g.created_at)}</td>
                                <td>{fmtNum(g.credits)}{g.grant_tier ? ` + ${g.grant_tier}` : ''}</td>
                                <td>{g.claimed ? <span className="badge ok">applied {fmtDate(g.claimed_at, false)}</span> : <span className="badge warn">waiting</span>}</td>
                                <td>{fmtDate(g.expires_at, false)}</td>
                                <td className="small">{g.source}{g.amount_paid_paise ? ` · paid ₹${fmtNum(g.amount_paid_paise / 100)}` : ''}<br />{g.note}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

function LookalikesView({ l, sameName, go }: { l: Lookalikes; sameName: Lookalikes['accounts']; go: (t: Tab, email?: string) => void }) {
    if (!l.accounts.length && !l.waitingGrants.length && !sameName.length) return null
    return (
        <div className="panel stack">
            <h2>Look-alikes <span className="muted small">(typos, second accounts)</span></h2>
            {l.waitingGrants.length > 0 && (
                <>
                    <h3>Waiting course grants on similar emails</h3>
                    <ul>{l.waitingGrants.map(g => (
                        <li key={g.email}><b>{g.email}</b> · {g.note || 'grant'} · {fmtDate(g.created_at, false)} · <span className="muted">{g.why}</span> · {g.hasAccount ? 'has its own account' : <b>no account (stranded)</b>}</li>
                    ))}</ul>
                </>
            )}
            {l.accounts.length > 0 && (
                <>
                    <h3>Accounts with a similar email</h3>
                    <ul>{l.accounts.map(a => (
                        <li key={a.email}><button className="btn small" onClick={() => go('lookup', a.email)}>{a.email}</button> {a.name || ''} · {a.subscription_tier} · {fmtNum(a.credits_remaining)} credits · joined {fmtDate(a.created_at, false)}</li>
                    ))}</ul>
                </>
            )}
            {sameName.length > 0 && (
                <>
                    <h3>Other accounts with exactly the same name <span className="muted small">(may be different people)</span></h3>
                    <ul>{sameName.map(a => (
                        <li key={a.email}><button className="btn small" onClick={() => go('lookup', a.email)}>{a.email}</button> {a.subscription_tier} · {fmtNum(a.credits_remaining)} credits · joined {fmtDate(a.created_at, false)}</li>
                    ))}</ul>
                </>
            )}
        </div>
    )
}

/* ------------------------------------------------------------------ 2. grant */

function GrantTab({ request, go }: { request: Req | null; go: (t: Tab, email?: string) => void }) {
    const [email, setEmail] = useState('')
    const [reason, setReason] = useState('')
    const [plan, setPlan] = useState<GrantPlan | null>(null)
    const [confirmed, setConfirmed] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [outcome, setOutcome] = useState<GrantOutcome | null>(null)

    const check = useCallback(async (e: string, keepOutcome = false) => {
        const value = e.trim().toLowerCase()
        if (!value) return
        setEmail(value); setBusy(true); setError(''); setConfirmed(false)
        if (!keepOutcome) setOutcome(null)
        const { ok, data } = await api<GrantPlan>('/dashboard/api/grant', { mode: 'check', email: value })
        setBusy(false)
        if (ok) setPlan(data); else { setPlan(null); setError(data.error || 'Check failed') }
    }, [])

    useEffect(() => { if (request) check(request.email) }, [request, check])

    async function grant() {
        if (!plan) return
        if (!window.confirm(`Grant 500,000 credits + 30 days of Pro to ${plan.email}?`)) return
        setBusy(true); setError('')
        const { data } = await api<GrantOutcome>('/dashboard/api/grant', { mode: 'grant', email: plan.email, reason, confirmed })
        setBusy(false)
        if (data.error) setError(data.error)
        else setOutcome(data)
        await check(plan.email, true)
    }

    async function move(from: string) {
        if (!plan) return
        if (!window.confirm(`Move the waiting course grant from ${from} to ${plan.email}? Only do this if ${from} is clearly a typo of this person's email.`)) return
        setBusy(true); setError('')
        const { data } = await api<GrantOutcome>('/dashboard/api/grant', { mode: 'move', email: plan.email, from })
        setBusy(false)
        if (data.error) setError(data.error)
        else setOutcome(data)
        await check(plan.email, true)
    }

    const actionText: Record<GrantPlan['action'], string> = {
        grant: 'Ready to grant', apply_waiting: 'Ready: will apply the waiting grant', waiting_grant: 'Ready: no account yet, will save a waiting grant', blocked: 'Not allowed',
    }
    const stranded = plan?.lookalikes.waitingGrants.filter(g => !g.hasAccount) ?? []

    return (
        <div>
            <div className="panel stack">
                <h2>Grant 500,000 credits + Pro for 30 days</h2>
                <p className="muted small">Check first: it shows exactly what will happen and warns about typos and repeat grants. The bonus is given once per person; the database refuses a second manual grant on the same email.</p>
                <EmailForm value={email} onChange={v => { setEmail(v); setPlan(null); setOutcome(null) }} onSubmit={() => check(email)} busy={busy} button="Check" />
                {error && <div className="msg bad">{error}</div>}
                {outcome && <div className={`msg ${outcome.ok ? 'ok' : 'bad'}`}>{outcome.message}</div>}
            </div>

            {plan && (
                <div className="panel stack">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                        <h2><span className={`badge ${plan.action === 'blocked' ? 'bad' : 'ok'}`}>{actionText[plan.action]}</span> {plan.email}</h2>
                        <button className="btn small" onClick={() => go('lookup', plan.email)}>Full lookup</button>
                    </div>
                    {plan.account && (
                        <dl className="kv">
                            <dt>Account</dt><dd>{plan.account.name || 'No name'} · {plan.account.email}</dd>
                            <dt>Plan now</dt><dd>{plan.account.tier}{plan.account.planEnd ? ` until ${fmtDate(plan.account.planEnd, false)}` : ''}</dd>
                            <dt>Credits now</dt><dd>{fmtNum(plan.account.credits)}</dd>
                        </dl>
                    )}
                    <div className={`msg ${plan.action === 'blocked' ? 'bad' : 'ok'}`}>{plan.message}</div>

                    {plan.warnings.map((w, i) => <div key={i} className="msg warn">{w}</div>)}

                    {stranded.length > 0 && plan.account && (
                        <div className="stack">
                            <h3>Course grants stranded on similar emails</h3>
                            {stranded.map(g => (
                                <div key={g.email} className="row">
                                    <span><b>{g.email}</b> · {g.note || 'grant'} · {fmtDate(g.created_at, false)} · <span className="muted">{g.why}</span></span>
                                    <button className="btn small" disabled={busy} onClick={() => move(g.email)}>Move it here</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {plan.action !== 'blocked' && (
                        <div className="stack">
                            <label className="field">Reason (saved on the grant)
                                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. NMM course buyer, credits never arrived" maxLength={200} />
                            </label>
                            {plan.warnings.length > 0 && (
                                <label className="check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I read the warnings above and still want a new grant on this email.</label>
                            )}
                            <div><button className="btn primary" disabled={busy || (plan.warnings.length > 0 && !confirmed)} onClick={grant}>Grant 500,000 credits + 30 days Pro</button></div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

/* ------------------------------------------------------------------ 3. escalations */

function EscalationsTab({ request, go }: { request: Req | null; go: (t: Tab, email?: string) => void }) {
    const [email, setEmail] = useState('')
    const [contact, setContact] = useState('')
    const [problem, setProblem] = useState('')
    const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const [items, setItems] = useState<Escalation[] | null>(null)
    const [loadError, setLoadError] = useState('')
    const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('active')
    const problemRef = useRef<HTMLTextAreaElement>(null)

    const load = useCallback(async () => {
        const { ok, data } = await api<{ items: Escalation[] }>('/dashboard/api/escalations')
        if (ok) { setItems(data.items); setLoadError('') } else setLoadError(data.error || 'Could not load')
    }, [])
    useEffect(() => { load() }, [load])
    useEffect(() => {
        if (!request) return
        setEmail(request.email)
        setTimeout(() => problemRef.current?.focus(), 50)
    }, [request])

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setBusy(true); setMsg(null)
        const { ok, data } = await api<{ item: Escalation }>('/dashboard/api/escalations', { email, contact, problem, priority })
        setBusy(false)
        if (!ok) { setMsg({ ok: false, text: data.error || 'Could not save' }); return }
        setMsg({ ok: true, text: `Escalated ${data.item.email}. It is in the list below with a snapshot of the account.` })
        setProblem(''); setContact(''); setPriority('normal')
        setItems(prev => [data.item, ...(prev || [])])
    }

    async function update(id: string, change: { status?: Status; note?: string }) {
        const { ok, data } = await api<{ item: Escalation }>(`/dashboard/api/escalations/${id}`, change, 'PATCH')
        if (ok) setItems(prev => (prev || []).map(x => x.id === id ? data.item : x))
        else window.alert(data.error || 'Could not update')
    }

    const shown = (items || []).filter(x => filter === 'all' || (filter === 'resolved' ? x.status === 'resolved' : x.status !== 'resolved'))
    const counts = { active: (items || []).filter(x => x.status !== 'resolved').length, resolved: (items || []).filter(x => x.status === 'resolved').length }

    return (
        <div>
            <form className="panel stack" onSubmit={submit}>
                <h2>Escalate a problem for someone to investigate</h2>
                <p className="muted small">For anything the lookup and grant can&apos;t fix. The account&apos;s current state is saved with it automatically.</p>
                <div className="row">
                    <input className="grow" type="email" placeholder="User's email" value={email} onChange={e => setEmail(e.target.value)} required />
                    <input placeholder="Phone / contact (optional)" value={contact} onChange={e => setContact(e.target.value)} maxLength={100} />
                    <select value={priority} onChange={e => setPriority(e.target.value as 'normal' | 'urgent')}>
                        <option value="normal">Normal</option>
                        <option value="urgent">Urgent</option>
                    </select>
                </div>
                <textarea ref={problemRef} placeholder="What is the problem? Paste the user's message, what you already checked, payment IDs, screenshots links…" value={problem} onChange={e => setProblem(e.target.value)} required />
                {msg && <div className={`msg ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</div>}
                <div><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Escalate'}</button></div>
            </form>

            <div className="panel stack">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div className="row">
                        <button className={`btn small ${filter === 'active' ? 'primary' : ''}`} onClick={() => setFilter('active')}>Open ({counts.active})</button>
                        <button className={`btn small ${filter === 'resolved' ? 'primary' : ''}`} onClick={() => setFilter('resolved')}>Resolved ({counts.resolved})</button>
                        <button className={`btn small ${filter === 'all' ? 'primary' : ''}`} onClick={() => setFilter('all')}>All</button>
                    </div>
                    <button className="btn small" onClick={load}>Refresh</button>
                </div>
                {loadError && <div className="msg bad">{loadError}</div>}
                {items === null && !loadError && <p className="muted">Loading…</p>}
                {items !== null && shown.length === 0 && <p className="muted">Nothing here.</p>}
                {shown.map(x => <CaseCard key={x.id} item={x} go={go} update={update} />)}
            </div>
        </div>
    )
}

function CaseCard({ item, go, update }: { item: Escalation; go: (t: Tab, email?: string) => void; update: (id: string, c: { status?: Status; note?: string }) => Promise<void> }) {
    const [note, setNote] = useState('')
    const [busy, setBusy] = useState(false)
    const act = async (c: { status?: Status; note?: string }) => { setBusy(true); await update(item.id, c); setBusy(false); setNote('') }
    return (
        <div className={`case ${item.priority === 'urgent' ? 'urgent' : ''}`}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="row">
                    {item.priority === 'urgent' && <span className="badge bad">urgent</span>}
                    <span className={`badge ${item.status === 'resolved' ? 'ok' : item.status === 'investigating' ? 'warn' : ''}`}>{item.status}</span>
                    <button className="btn small" onClick={() => go('lookup', item.email)}>{item.email}</button>
                    {item.contact && <span className="muted">{item.contact}</span>}
                </div>
                <span className="muted small">by {item.createdBy} · {fmtDate(item.createdAt)}</span>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', margin: '10px 0' }}>{item.problem}</p>
            {item.snapshot && (
                <details>
                    <summary className="small">Account when escalated</summary>
                    <p className="small">{item.snapshot.summary}</p>
                    <Findings items={item.snapshot.findings as Finding[]} />
                </details>
            )}
            {item.notes.length > 0 && (
                <div className="notes">{item.notes.map((n, i) => (
                    <div key={i} className="small"><b>{n.by}</b> <span className="muted">{fmtDate(n.at)}</span><div style={{ whiteSpace: 'pre-wrap' }}>{n.text}</div></div>
                ))}</div>
            )}
            <div className="stack" style={{ marginTop: 8 }}>
                <textarea style={{ minHeight: 60 }} placeholder="Add a note: what you found, what you did, what the user was told…" value={note} onChange={e => setNote(e.target.value)} />
                <div className="row">
                    <button className="btn small" disabled={busy || !note.trim()} onClick={() => act({ note })}>Add note</button>
                    {item.status !== 'investigating' && item.status !== 'resolved' && <button className="btn small" disabled={busy} onClick={() => act({ status: 'investigating', note: note || undefined })}>I&apos;m on it</button>}
                    {item.status !== 'resolved'
                        ? <button className="btn small primary" disabled={busy} onClick={() => act({ status: 'resolved', note: note || undefined })}>Mark resolved</button>
                        : <button className="btn small" disabled={busy} onClick={() => act({ status: 'open', note: note || undefined })}>Reopen</button>}
                </div>
            </div>
        </div>
    )
}
