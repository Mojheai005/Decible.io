// Escalated problems ("deep problems someone else should look into").
// Stored as one JSON file per case in a PRIVATE Supabase Storage bucket, because nobody can run SQL
// on the project to add a table. Set ESCALATION_STORE=file to keep them in a local folder instead
// (for running the dashboard on your own computer).
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { env } from './env'
import { SbError, storage } from './sb'

export type Status = 'open' | 'investigating' | 'resolved'
export interface Note { at: string; by: string; text: string }
export interface Escalation {
    id: string
    email: string
    contact: string
    problem: string
    priority: 'normal' | 'urgent'
    status: Status
    createdAt: string
    createdBy: string
    updatedAt: string
    notes: Note[]
    snapshot: { summary: string; findings: { level: string; text: string }[] } | null
}

const useFile = () => env('ESCALATION_STORE', 'supabase') === 'file'
const bucket = () => env('ESCALATION_BUCKET', 'support-escalations')
const dir = () => path.join(process.cwd(), '.escalations')
const key = (id: string) => `cases/${id}.json`
const validId = (id: string) => /^\d{8}T\d{6}Z-[a-f0-9]{8}$/.test(id)

export function newId(now = new Date()): string {
    return `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${randomBytes(4).toString('hex')}`
}

async function ensureBucket() {
    try {
        await storage('bucket', {
            method: 'POST',
            body: JSON.stringify({ id: bucket(), name: bucket(), public: false }),
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (e) {
        if (!(e instanceof SbError && /exist|duplicate/i.test(e.body))) throw e
    }
}
const missingBucket = (e: unknown) => e instanceof SbError && /bucket not found|not found/i.test(e.body)

export async function save(item: Escalation): Promise<void> {
    if (!validId(item.id)) throw new Error('bad id')
    if (useFile()) {
        await fs.mkdir(dir(), { recursive: true })
        await fs.writeFile(path.join(dir(), `${item.id}.json`), JSON.stringify(item, null, 2))
        return
    }
    const put = () => storage(`object/${bucket()}/${key(item.id)}`, {
        method: 'POST',
        body: JSON.stringify(item),
        headers: { 'Content-Type': 'application/json', 'x-upsert': 'true' },
    })
    try {
        await put()
    } catch (e) {
        if (!missingBucket(e)) throw e
        await ensureBucket()
        await put()
    }
}

export async function load(id: string): Promise<Escalation | null> {
    if (!validId(id)) return null
    if (useFile()) {
        try { return JSON.parse(await fs.readFile(path.join(dir(), `${id}.json`), 'utf8')) } catch { return null }
    }
    try {
        const { text } = await storage(`object/${bucket()}/${key(id)}`)
        return JSON.parse(text)
    } catch (e) {
        if (e instanceof SbError && (e.status === 400 || e.status === 404)) return null
        throw e
    }
}

/** Newest first. */
export async function list(limit = 200): Promise<Escalation[]> {
    let ids: string[]
    if (useFile()) {
        try { ids = (await fs.readdir(dir())).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5)) } catch { ids = [] }
    } else {
        try {
            const { text } = await storage(`object/list/${bucket()}`, {
                method: 'POST',
                body: JSON.stringify({ prefix: 'cases/', limit: 1000, offset: 0, sortBy: { column: 'name', order: 'desc' } }),
                headers: { 'Content-Type': 'application/json' },
            })
            ids = (JSON.parse(text) as { name: string }[]).map(o => o.name.replace(/^cases\//, '').replace(/\.json$/, ''))
        } catch (e) {
            if (missingBucket(e)) return []
            throw e
        }
    }
    ids = ids.filter(validId).sort().reverse().slice(0, limit)
    const out: Escalation[] = []
    for (let i = 0; i < ids.length; i += 20) {
        const batch = await Promise.all(ids.slice(i, i + 20).map(load))
        for (const item of batch) if (item) out.push(item)
    }
    return out
}

/** Optional ping to Slack / Discord / Google Chat. Never blocks or fails the request. */
export async function notify(item: Escalation): Promise<void> {
    const url = process.env.ESCALATION_WEBHOOK_URL?.trim()
    if (!url) return
    const text = `${item.priority === 'urgent' ? '🔴 URGENT ' : ''}Decible escalation from ${item.createdBy}: ${item.email}\n${item.problem.slice(0, 500)}`
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, content: text }),
            signal: AbortSignal.timeout(5000),
        })
    } catch {
        // A failed ping must not lose the escalation itself.
    }
}
