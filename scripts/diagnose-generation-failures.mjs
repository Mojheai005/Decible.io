/**
 * READ-ONLY diagnosis of "generation failed" complaints.
 *
 * It sends only GET requests. It writes nothing to the database, grants and
 * refunds nothing, and never generates audio. It prints counts, rates and the
 * engines' own error messages. It never prints emails, users' script text,
 * audio URLs or keys; user ids are cut to 8 characters.
 *
 *   node scripts/diagnose-generation-failures.mjs
 *   node scripts/diagnose-generation-failures.mjs --days=8 --since=2026-09-20
 *
 * Credentials come from the environment, or from .env.local in the repo root
 * (gitignored). Needed: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional, for the balance checks: KIEAI_API_KEY, FISH_AUDIO_API_KEY,
 * SMALLEST_API_KEY. A missing optional key just skips that check.
 *
 * Sections match step39-oct-failures-triage.sql so the two can be compared.
 */
import { readFileSync, existsSync } from 'node:fs'

// ---------------------------------------------------------------- settings
const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
}))
const DAYS = Number(args.days ?? 8)
const NOW = Date.now()
const WINDOW_START = new Date(NOW - DAYS * 86_400_000)
const TREND_START = new Date(args.since ?? new Date(NOW - 22 * 86_400_000).toISOString().slice(0, 10))
const DEMOTIONS_SINCE = new Date('2026-09-25T00:00:00Z')
const TIER_LIMITS = { free: [3, 30], starter: [5, 100], creator: [10, 200], pro: [15, 400], advanced: [20, 600] }

// ---------------------------------------------------------------- credentials
const fileEnv = {}
const envPath = new URL('../.env.local', import.meta.url)
if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        if (!line.includes('=') || line.trim().startsWith('#')) continue
        const i = line.indexOf('=')
        fileEnv[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
}
const quoted = []
const env = name => {
    const raw = process.env[name] ?? fileEnv[name]
    if (raw == null || raw === '') return null
    if (/^["']|["']$/.test(raw)) quoted.push(name)
    return raw.replace(/^["']|["']$/g, '')
}
const SB_URL = env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
if (!SB_URL || !SB_KEY) {
    console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or .env.local).')
    process.exit(1)
}

// ---------------------------------------------------------------- helpers
const out = (...a) => console.log(...a)
const head = t => out(`\n=== ${t} ${'='.repeat(Math.max(0, 74 - t.length))}`)
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-')
const IST_MS = 5.5 * 3_600_000
const istDay = iso => new Date(new Date(iso).getTime() + IST_MS).toISOString().slice(0, 10)
const istHour = iso => new Date(new Date(iso).getTime() + IST_MS).getUTCHours()
const shortId = id => (id ? String(id).slice(0, 8) : '-')
const engineOf = r => {
    const v = r.voice_id || ''
    if (v.startsWith('sm-')) return 'smallest'
    if (v.startsWith('fish-')) return 'fish'
    if (v === 'system' || v === 'batch') return v
    return r.engine || 'gemini'
}
const normalise = s => String(s ?? '(no error_message)')
    .replace(/gen_[0-9a-z_]+/gi, '<id>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b[0-9a-f]{24,}\b/gi, '<hex>')
    .replace(/\d{4,}/g, '<n>')
    .replace(/\s+/g, ' ')
    .slice(0, 150)
const countBy = (rows, key) => {
    const m = new Map()
    for (const r of rows) { const k = key(r); m.set(k, (m.get(k) || 0) + 1) }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
}

/** GET-only PostgREST read with paging. Returns { rows, error }. */
async function select(table, query, { maxPages = 300 } = {}) {
    const rows = []
    for (let page = 0; page < maxPages; page++) {
        const from = page * 1000
        const res = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
            method: 'GET',
            headers: {
                apikey: SB_KEY,
                Authorization: `Bearer ${SB_KEY}`,
                Accept: 'application/json',
                'Range-Unit': 'items',
                Range: `${from}-${from + 999}`,
            },
        })
        if (!res.ok) {
            const body = (await res.text()).slice(0, 220)
            return { rows, error: `HTTP ${res.status} ${body}` }
        }
        const batch = await res.json()
        rows.push(...batch)
        if (batch.length < 1000) break
    }
    return { rows, error: null }
}

/**
 * GET-only keyset paging over the primary key. generation_history and
 * credit_transactions have no index on created_at alone, so an
 * ORDER BY created_at over weeks of rows hits the statement timeout.
 * Walking the primary key in order and filtering keeps every request small.
 */
async function selectByKey(table, columns, filters, { key = 'id', pageSize = 1000, maxPages = 500 } = {}) {
    const rows = []
    let last = null
    let size = pageSize
    for (let page = 0; page < maxPages; page++) {
        const cursor = last == null ? '' : `&${key}=gt.${encodeURIComponent(last)}`
        const res = await fetch(`${SB_URL}/rest/v1/${table}?select=${columns}&${filters}${cursor}&order=${key}.asc&limit=${size}`, {
            method: 'GET',
            headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Accept: 'application/json' },
        })
        if (!res.ok) {
            const body = (await res.text()).slice(0, 220)
            if (/57014|statement timeout/.test(body) && size > 100) { size = Math.floor(size / 2); page--; continue }
            return { rows, error: `HTTP ${res.status} ${body}` }
        }
        const batch = await res.json()
        rows.push(...batch)
        if (batch.length < size) break
        last = batch[batch.length - 1][key]
    }
    return { rows, error: null }
}

async function getJson(url, headers) {
    try {
        const res = await fetch(url, { method: 'GET', headers })
        const text = await res.text()
        let json = null
        try { json = JSON.parse(text) } catch { /* not JSON */ }
        return { status: res.status, json, text: text.slice(0, 200) }
    } catch (e) {
        return { status: 'NETWORK', json: null, text: String(e.cause?.code || e.message).slice(0, 200) }
    }
}

// ---------------------------------------------------------------- 1. provider balances
head('PROVIDER ACCOUNTS (read-only balance calls, no audio generated)')
const kie = env('KIEAI_API_KEY')
const fish = env('FISH_AUDIO_API_KEY')
const smallest = env('SMALLEST_API_KEY')
if (kie) {
    const r = await getJson('https://api.kie.ai/api/v1/chat/credit', { Authorization: `Bearer ${kie}`, Accept: 'application/json' })
    out(`Kie.ai (Gemini voices)   HTTP ${r.status}  ${r.json ? `code=${r.json.code} credits=${r.json.data} msg=${r.json.msg}` : r.text}`)
} else out('Kie.ai: KIEAI_API_KEY not set, skipped')
if (fish) {
    const r = await getJson('https://api.fish.audio/wallet/self/api-credit', { Authorization: `Bearer ${fish}`, Accept: 'application/json' })
    if (r.json && r.json.credit != null) {
        const topUp = Number(r.json.cumulative_top_up)
        const slots = topUp >= 1000 ? 50 : topUp >= 100 ? 15 : 5
        out(`Fish Audio               HTTP ${r.status}  credit=$${r.json.credit}  lifetime top-up=$${r.json.cumulative_top_up}  -> about ${slots} requests at once`)
    } else out(`Fish Audio               HTTP ${r.status}  ${r.text}`)
} else out('Fish Audio: FISH_AUDIO_API_KEY not set, skipped')
if (smallest) {
    const r = await getJson('https://api.smallest.ai/payment/v1/credits/balance', { Authorization: `Bearer ${smallest}`, Accept: 'application/json' })
    if (r.json?.data?.creditBalance != null) {
        out(`Smallest.ai (default)    HTTP ${r.status}  balance=$${r.json.data.creditBalance}  plan=${r.json.data.planId}  enterprise=${r.json.data.isEnterprise}`)
    } else out(`Smallest.ai (default)    HTTP ${r.status}  ${r.text}  (this endpoint may not accept a Waves key; check the dashboard)`)
} else out('Smallest.ai: SMALLEST_API_KEY not set, skipped')
if (quoted.length) out(`\nWARNING: these values are wrapped in quotes in your env source: ${quoted.join(', ')}. If Vercel holds the quotes literally, that provider answers 401.`)


// ---------------------------------------------------------------- 2. load data
head('LOADING (GET only)')
let historyCols = 'id,created_at,status,voice_id,characters_used,user_id,audio_url,error_message,engine:settings->>engine,gen_id:settings->>generationId'
const histFilter = `created_at=gte.${TREND_START.toISOString()}`
let hist = await selectByKey('generation_history', historyCols, histFilter)
let hasErrorColumn = true
if (hist.error && /error_message/.test(hist.error)) {
    hasErrorColumn = false
    out(`generation_history.error_message is missing in this database: ${hist.error.slice(0, 160)}`)
    historyCols = historyCols.replace(',error_message', '')
    hist = await selectByKey('generation_history', historyCols, histFilter)
}
if (hist.error) { out('generation_history:', hist.error); process.exit(2) }
const tx = await selectByKey('credit_transactions', 'id,user_id,amount,type,description,reference_id,created_at',
    `created_at=gte.${new Date(TREND_START.getTime() - 86_400_000).toISOString()}&type=in.(generation,refund,expiry,adjustment)`)
const grants = await select('pending_credit_grants', 'select=id,claimed,claimed_at,claimed_by,expired,expired_at,expires_at,grant_tier,credits_clawed_back,created_at,source')
const profiles = await select('user_profiles', 'select=id,subscription_tier,subscription_status,credits_remaining,created_at')
const limits = await select('rate_limits', `select=key,count,window_start&window_start=gte.${WINDOW_START.toISOString()}`)
const markers = await selectByKey('generation_history', 'id,created_at,user_id,text', `voice_id=eq.system&created_at=gte.${WINDOW_START.toISOString()}`)
for (const [n, r] of Object.entries({ generation_history: hist, credit_transactions: tx, pending_credit_grants: grants, user_profiles: profiles, rate_limits: limits })) {
    out(`${n.padEnd(22)} ${r.error ? 'ERROR ' + r.error : r.rows.length + ' rows'}`)
}
if (!hasErrorColumn) {
    out('\nNOTE: failed generations are never written to generation_history here (the insert names a column')
    out('that does not exist, and the error is ignored). Failures below are counted from REFUNDS, which the')
    out('server writes for every failed attempt that was charged.')
}

// ---------------------------------------------------------------- events
// One event per attempt that reached the charge: a completed history row is a
// success, a refund carrying a gen_ reference is a failure.
const ENGINES = ['smallest', 'fish', 'gemini']
const COST_PER_1K = { smallest: 0.1020, fish: 0.0150 }      // src/lib/constants.ts ENGINE_COST_PER_1K_CHARS
const engineFromRefund = d => {
    const s = String(d || '').replace(/^Refund:\s*/i, '').toLowerCase()
    for (const e of ENGINES) if (s.startsWith(e)) return e
    if (s.startsWith('audio storage')) return 'storage'
    return 'other'
}
const isFunding = r => /credits exhausted|recharge|insufficient api credit|insufficient|payment required|http 402|out of credits|no credits|balance/i.test(r)
const successes = hist.rows
    .filter(r => r.status === 'completed')
    .map(r => ({ at: r.created_at, user: r.user_id, eng: engineOf(r), ok: true, chars: r.characters_used || 0 }))
    .filter(e => ENGINES.includes(e.eng))
const failures = tx.rows
    .filter(t => t.type === 'refund' && /^gen_/.test(t.reference_id || ''))
    .map(t => {
        const reason = String(t.description || '').replace(/^Refund:\s*/i, '')
        return { at: t.created_at, user: t.user_id, eng: engineFromRefund(t.description), ok: false, chars: Math.abs(t.amount), reason, funding: isFunding(reason) }
    })
// Rows arrive in primary-key order, not time order.
successes.sort((a, b) => a.at.localeCompare(b.at))
failures.sort((a, b) => a.at.localeCompare(b.at))
const events = [...successes, ...failures].filter(e => new Date(e.at) >= TREND_START).sort((a, b) => a.at.localeCompare(b.at))
const W = events.filter(e => new Date(e.at) >= WINDOW_START)
const tierOf = new Map(profiles.rows.map(p => [p.id, p.subscription_tier || 'free']))
const demoted = new Map()
for (const g of grants.rows) {
    if (g.expired && g.grant_tier && g.claimed_by && g.expired_at && new Date(g.expired_at) >= DEMOTIONS_SINCE) {
        const prev = demoted.get(g.claimed_by)
        if (!prev || new Date(g.expired_at) > new Date(prev)) demoted.set(g.claimed_by, g.expired_at)
    }
}
const ist = iso => new Date(new Date(iso).getTime() + IST_MS).toISOString().slice(0, 16).replace('T', ' ')
const rate = rows => pct(rows.filter(e => !e.ok).length, rows.length)

// ---------------------------------------------------------------- 0. engine pulse
head('0. ENGINE PULSE')
for (const e of ENGINES) {
    const ok = successes.filter(s => s.eng === e)
    const lastOk = ok.length ? ok[ok.length - 1].at : null
    const fund = failures.filter(f => f.eng === e && f.funding)
    const d24 = events.filter(x => x.eng === e && NOW - new Date(x.at) < 86_400_000)
    out(`${e.padEnd(9)} last success ${lastOk ? `${ist(lastOk)} IST (${((NOW - new Date(lastOk)) / 3_600_000).toFixed(1)} h ago)` : 'none since ' + TREND_START.toISOString().slice(0, 10)}`
        + ` | last funding refusal ${fund.length ? ist(fund[fund.length - 1].at) + ' IST' : '-'}`
        + ` | last 24h: ${d24.filter(x => x.ok).length} ok, ${d24.filter(x => !x.ok).length} failed`)
}

// ---------------------------------------------------------------- A. daily
head(`A. DAILY (IST) since ${TREND_START.toISOString().slice(0, 10)}: attempts that reached the charge`)
out('day          tries  failed  rate |  ok: sm  fish   gem | failed: sm  fish  gem  oth | users  ok-users')
for (const [d, rows] of [...Map.groupBy(events, e => istDay(e.at))].sort((a, b) => a[0].localeCompare(b[0]))) {
    const c = (ok, eng) => rows.filter(r => r.ok === ok && (eng === 'oth' ? !ENGINES.includes(r.eng) : r.eng === eng)).length
    const users = new Set(rows.map(r => r.user)).size
    const okUsers = new Set(rows.filter(r => r.ok).map(r => r.user)).size
    out(`${d}  ${String(rows.length).padStart(5)}  ${String(rows.filter(r => !r.ok).length).padStart(6)}  ${rate(rows).padStart(4)} | ${String(c(true, 'smallest')).padStart(6)} ${String(c(true, 'fish')).padStart(5)} ${String(c(true, 'gemini')).padStart(5)} | ${String(c(false, 'smallest')).padStart(10)} ${String(c(false, 'fish')).padStart(5)} ${String(c(false, 'gemini')).padStart(4)} ${String(c(false, 'oth')).padStart(4)} | ${String(users).padStart(5)}  ${String(okUsers).padStart(8)}`)
}

// ---------------------------------------------------------------- B. outage timeline
head('B. FUNDING OUTAGES: when each engine stopped and started working (IST)')
for (const e of ['smallest', 'fish']) {
    const seq = events.filter(x => x.eng === e && (x.ok || x.funding))
    const changes = []
    let state = null, since = null, count = 0
    for (const x of seq) {
        const s = x.ok ? 'working' : 'OUT OF CREDIT'
        if (s !== state) {
            if (state) changes.push({ state, since, until: x.at, count })
            state = s; since = x.at; count = 0
        }
        count++
    }
    if (state) changes.push({ state, since, until: null, count })
    out(`${e}:`)
    for (const c of changes.slice(-12)) {
        out(`  ${c.state.padEnd(13)} from ${ist(c.since)}${c.until ? ` to ${ist(c.until)}` : ' to now'}  (${c.count} ${c.state === 'working' ? 'successes' : 'refused attempts'})`)
    }
}

// ---------------------------------------------------------------- C. failure reasons
head(`C. FAILURE REASONS, last ${DAYS} days (from refund descriptions)`)
for (const e of [...ENGINES, 'storage', 'other']) {
    const f = W.filter(x => !x.ok && x.eng === e)
    if (!f.length) continue
    out(`${e}: ${f.length} failures`)
    for (const [reason, n] of countBy(f, x => normalise(x.reason)).slice(0, 8)) out(`  ${String(n).padStart(5)}  ${reason}`)
}
const pending = markers.rows.filter(m => String(m.text || '').startsWith('PENDING_REFUND'))
out(`PENDING_REFUND markers (automatic refund failed, pay by hand): ${pending.length}`)

// ---------------------------------------------------------------- D. charged, never delivered
head(`D. CHARGED, NEVER DELIVERED, NEVER REFUNDED, last ${DAYS} days`)
const charges = tx.rows.filter(t => t.type === 'generation')
const refundedRefs = new Set(tx.rows.filter(t => t.type === 'refund' && t.reference_id).map(t => t.reference_id))
const delivered = new Set()
for (const r of hist.rows) {
    if (r.gen_id) delivered.add(r.gen_id)
    const m = /\/([^/.]+)\.[a-z0-9]+$/i.exec(r.audio_url || '')
    if (m) delivered.add(m[1])
}
const orphans = charges.filter(t => t.reference_id && new Date(t.created_at) >= WINDOW_START
    && NOW - new Date(t.created_at) > 600_000
    && !refundedRefs.has(t.reference_id) && !delivered.has(t.reference_id))
out(`${orphans.length} charges | ${new Set(orphans.map(o => o.user_id)).size} users | ${orphans.reduce((s, o) => s + Math.abs(o.amount), 0)} credits`)

// ---------------------------------------------------------------- E. rate limits
head(`E. RATE-LIMIT WINDOWS OVER THE LIMIT, last ${DAYS} days (a 429 leaves no other trace)`)
const over = []
for (const l of limits.rows) {
    const m = /^user:([0-9a-f-]+):generation:(minute|hour)$/.exec(l.key || '')
    if (!m) continue
    const tier = tierOf.get(m[1]) || 'free'
    const [perMin, perHour] = TIER_LIMITS[tier] || TIER_LIMITS.free
    const lim = m[2] === 'minute' ? perMin : perHour
    if (l.count > lim) over.push({ user: m[1], kind: m[2], count: l.count, lim, tier, demoted: demoted.has(m[1]) })
}
out(`${over.length} windows over the limit | ${new Set(over.map(o => o.user)).size} users | by tier: ${countBy(over, o => o.tier).map(([t, n]) => `${t} ${n}`).join(', ') || '-'}`)
out(`per-minute: ${over.filter(o => o.kind === 'minute').length} | per-hour: ${over.filter(o => o.kind === 'hour').length} | users whose granted plan ended since 25 Sep: ${new Set(over.filter(o => o.demoted).map(o => o.user)).size}`)

// ---------------------------------------------------------------- F. plan expiries
head('F. GRANTED PLANS THAT ENDED SINCE 25 SEP (user moved to free, credits kept)')
const ended = grants.rows.filter(g => g.expired && g.grant_tier && g.claimed_by && g.expired_at && new Date(g.expired_at) >= DEMOTIONS_SINCE)
out(`${ended.length} plans ended for ${new Set(ended.map(g => g.claimed_by)).size} users`)
const demotedUsers = [...demoted.keys()]
const afterEvents = events.filter(e => demoted.has(e.user) && new Date(e.at) > new Date(demoted.get(e.user)))
out(`after their plan ended: ${new Set(afterEvents.map(e => e.user)).size} of them tried to generate | ${afterEvents.filter(e => e.ok).length} succeeded, ${afterEvents.filter(e => !e.ok).length} failed`)
out(`by day: ${countBy(ended, g => istDay(g.expired_at)).sort((a, b) => a[0].localeCompare(b[0])).map(([d, n]) => `${d.slice(5)}:${n}`).join(' ')}`)
const upcoming = grants.rows.filter(g => g.claimed && !g.expired && g.grant_tier && g.expires_at
    && new Date(g.expires_at) >= new Date(NOW) && new Date(g.expires_at) < new Date(NOW + 14 * 86_400_000))
out(`still to come in the next 14 days: ${upcoming.length} plans`)
void demotedUsers

// ---------------------------------------------------------------- G, H, I, J
head(`G. FAILURE RATE BY CURRENT TIER, last ${DAYS} days`)
for (const [k, rows] of [...Map.groupBy(W, e => `${tierOf.get(e.user) || '?'}${demoted.has(e.user) ? ' (plan ended)' : ''}`)].sort((a, b) => b[1].length - a[1].length)) {
    out(`  ${k.padEnd(26)} ${String(rows.filter(e => !e.ok).length).padStart(5)} failed / ${String(rows.length).padStart(5)} (${rate(rows)}) | ${new Set(rows.map(e => e.user)).size} users`)
}
head(`H. BY HOUR OF DAY (IST), last ${DAYS} days`)
for (let h = 0; h < 24; h++) {
    const rows = W.filter(e => istHour(e.at) === h)
    if (!rows.length) continue
    const f = rows.filter(e => !e.ok).length
    out(`  ${String(h).padStart(2, '0')}:00  ${String(f).padStart(5)} failed / ${String(rows.length).padStart(5)}  ${'#'.repeat(Math.min(50, Math.round(f / 20)))}`)
}
head(`I. BY REQUEST SIZE, last ${DAYS} days`)
const bucket = n => n < 400 ? 'under 400' : n < 1000 ? '400-1,000' : n < 1500 ? '1,000-1,500' : n < 2000 ? '1,500-2,000' : 'over 2,000'
for (const b of ['under 400', '400-1,000', '1,000-1,500', '1,500-2,000', 'over 2,000']) {
    const rows = W.filter(e => bucket(e.chars) === b)
    out(`  ${b.padEnd(12)} ${rows.filter(e => !e.ok).length} failed / ${rows.length}`)
}
head(`J. WHO IS AFFECTED, last ${DAYS} days`)
const usersW = new Set(W.map(e => e.user))
const failedUsers = new Set(W.filter(e => !e.ok).map(e => e.user))
const okUsers = new Set(W.filter(e => e.ok).map(e => e.user))
out(`${usersW.size} users tried to generate | ${failedUsers.size} hit at least one failure | ${[...failedUsers].filter(u => !okUsers.has(u)).length} never got a single success`)
const perUser = countBy(W.filter(e => !e.ok), e => e.user)
out(`failed attempts per affected user: median ${perUser.length ? perUser[Math.floor(perUser.length / 2)][1] : 0}, max ${perUser.length ? perUser[0][1] : 0}`)

// ---------------------------------------------------------------- K, L
head('K. IS THE 24 SEP DATABASE CHANGE LIVE? (both must be 0)')
const expiryRows = tx.rows.filter(t => t.type === 'expiry' && new Date(t.created_at) >= DEMOTIONS_SINCE)
out(`type=expiry ledger rows since 25 Sep: ${expiryRows.length} | grants expired since 25 Sep with credits clawed back: ${grants.rows.filter(g => g.expired && g.expired_at && new Date(g.expired_at) >= DEMOTIONS_SINCE && (g.credits_clawed_back || 0) > 0).length}`)
head('L. GROUPS REFUSED BEFORE ANYTHING IS RECORDED')
const free = profiles.rows.filter(p => (p.subscription_tier || 'free') === 'free')
out(`free users holding under 500 credits (every generation answers 402): ${free.filter(p => (p.credits_remaining || 0) < 500).length}`)
out(`free users holding over 5,000 credits (mostly ended course plans):    ${free.filter(p => (p.credits_remaining || 0) > 5000).length}`)
out(`grants never claimed: ${grants.rows.filter(g => !g.claimed).length} (${grants.rows.filter(g => !g.claimed && new Date(g.created_at) >= DEMOTIONS_SINCE).length} created since 25 Sep)`)
out(`profiles by tier: ${countBy(profiles.rows, p => p.subscription_tier || 'free').map(([t, n]) => `${t} ${n}`).join(', ')}`)

// ---------------------------------------------------------------- M. 429s
head(`M. PROVIDER HTTP 429s, last ${DAYS} days`)
for (const e of ENGINES) {
    const f = W.filter(x => x.eng === e && !x.ok)
    out(`${e.padEnd(9)} ${f.filter(x => /HTTP 429/i.test(x.reason)).length} of ${f.length} failures were HTTP 429`)
}

// ---------------------------------------------------------------- N. spend
head('N. WHAT EACH PAID ENGINE COSTS AT NORMAL VOLUME (successful characters x published rate)')
for (const e of ['smallest', 'fish']) {
    const perDay = [...Map.groupBy(successes.filter(s => s.eng === e && new Date(s.at) >= TREND_START), s => istDay(s.at))]
        .map(([d, rows]) => [d, rows.reduce((s, r) => s + r.chars, 0)]).sort((a, b) => a[0].localeCompare(b[0]))
    if (!perDay.length) { out(`${e}: no successful generations in range`); continue }
    const busy = perDay.map(p => p[1]).sort((a, b) => a - b)
    const median = busy[Math.floor(busy.length / 2)]
    out(`${e}: median ${median.toLocaleString('en-US')} chars/day on days it worked -> about $${(median / 1000 * COST_PER_1K[e]).toFixed(2)}/day, $${(median / 1000 * COST_PER_1K[e] * 30).toFixed(0)}/month`)
    out('  ' + perDay.map(([d, c]) => `${d.slice(5)}:${Math.round(c / 1000)}k`).join(' '))
}

// ---------------------------------------------------------------- compare windows
head('BEFORE vs DURING THE COMPLAINT WINDOW (failure rate of attempts that reached the charge)')
const split = new Date('2026-10-04T00:00:00+05:30')
for (const [label, rows] of [['20-28 Sep    ', events.filter(e => new Date(e.at) < new Date('2026-09-29T00:00:00+05:30'))], ['29 Sep - 3 Oct', events.filter(e => new Date(e.at) >= new Date('2026-09-29T00:00:00+05:30') && new Date(e.at) < split)], ['4 Oct onwards ', events.filter(e => new Date(e.at) >= split)]]) {
    out(`${label}: all ${rate(rows)} of ${rows.length} | ` + ENGINES.map(e => { const x = rows.filter(r => r.eng === e); return `${e} ${rate(x)} of ${x.length}` }).join(' | '))
}
out('\nDone. Nothing was written anywhere.')
