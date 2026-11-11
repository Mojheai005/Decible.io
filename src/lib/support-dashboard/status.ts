// Live health of the voice providers, read from the last hour of generations in the database.
// Needs no provider keys: if an engine's attempts are failing with "out of credit", it shows here.
import { enc, rest } from './sb'
import { engineOf, reasonOf } from './engines'

export interface EngineStatus { engine: string; ok: number; failed: number; state: 'ok' | 'degraded' | 'down' | 'quiet'; note: string; users: number }

export async function providerStatus() {
    const since = new Date(Date.now() - 3600e3).toISOString()
    const rows = await rest<{ created_at: string; status: string; voice_id: string | null; error_message: string | null; user_id: string }[]>(
        `generation_history?select=created_at,status,voice_id,error_message,user_id&created_at=gte.${enc(since)}&voice_id=neq.batch&order=created_at.desc&limit=5000`,
    )
    const by = new Map<string, { ok: number; failed: number; reasons: Map<string, number>; users: Set<string> }>()
    for (const e of ['Smallest', 'Fish', 'Gemini']) by.set(e, { ok: 0, failed: 0, reasons: new Map(), users: new Set() })
    for (const r of rows) {
        const e = engineOf(r.voice_id)
        const s = by.get(e) ?? { ok: 0, failed: 0, reasons: new Map(), users: new Set<string>() }
        if (r.status === 'completed') s.ok++
        else {
            s.failed++
            s.users.add(r.user_id)
            const label = reasonOf(r.error_message).label
            s.reasons.set(label, (s.reasons.get(label) || 0) + 1)
        }
        by.set(e, s)
    }
    const engines: EngineStatus[] = [...by].map(([engine, s]) => {
        const total = s.ok + s.failed
        const top = [...s.reasons].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
        const state: EngineStatus['state'] = total === 0 ? 'quiet' : s.ok === 0 && s.failed >= 3 ? 'down' : s.failed / total > 0.2 ? 'degraded' : 'ok'
        const note = state === 'quiet' ? 'no attempts in the last hour'
            : state === 'ok' ? `${s.ok} made in the last hour${s.failed ? `, ${s.failed} failed` : ''}`
            : `${s.failed} of ${total} failed in the last hour (${top})`
        return { engine, ok: s.ok, failed: s.failed, state, note, users: s.users.size }
    })
    return { checkedAt: new Date().toISOString(), lastGenerationAt: rows[0]?.created_at ?? null, engines }
}
