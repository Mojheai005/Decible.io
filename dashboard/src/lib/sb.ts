// Minimal Supabase client for the server: database (PostgREST), auth admin and storage.
// Uses the service-role key, so this file must only ever be imported by server code
// (API routes and server components), never by a 'use client' file.
import { env } from './env'

export class SbError extends Error {
    constructor(public status: number, public body: string, message: string) {
        super(message)
    }
}

const base = () => env('SUPABASE_URL').replace(/\/+$/, '')

async function call(path: string, init: RequestInit = {}): Promise<{ res: Response; text: string }> {
    const key = env('SUPABASE_SERVICE_ROLE_KEY')
    const res = await fetch(base() + path, {
        ...init,
        headers: { apikey: key, Authorization: `Bearer ${key}`, ...((init.headers as Record<string, string>) || {}) },
        cache: 'no-store',
    })
    const text = init.method === 'HEAD' ? '' : await res.text()
    if (!res.ok) {
        throw new SbError(res.status, text, `${init.method || 'GET'} ${path.split('?')[0]} -> HTTP ${res.status}: ${text.slice(0, 300)}`)
    }
    return { res, text }
}

/** GET/POST/PATCH against /rest/v1. Returns parsed JSON (or null for an empty body). */
export async function rest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const { text } = await call('/rest/v1/' + path, init)
    return (text ? JSON.parse(text) : null) as T
}

/** Exact row count for a filtered table query, e.g. count('generation_history?user_id=eq.x'). */
export async function count(path: string): Promise<number> {
    const { res } = await call('/rest/v1/' + path + (path.includes('?') ? '&' : '?') + 'select=id&limit=1', {
        method: 'HEAD',
        headers: { Prefer: 'count=exact' },
    })
    const range = res.headers.get('content-range') || ''
    const total = Number(range.split('/')[1])
    return Number.isFinite(total) ? total : 0
}

export const json = (body: unknown, extra: Record<string, string> = {}): RequestInit => ({
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...extra },
})

/** Auth (login) record for a user id: sign-in method, email confirmation, last sign-in. */
export async function authUser(id: string): Promise<Record<string, any> | null> {
    try {
        const { text } = await call(`/auth/v1/admin/users/${encodeURIComponent(id)}`)
        return text ? JSON.parse(text) : null
    } catch (e) {
        if (e instanceof SbError && e.status === 404) return null
        throw e
    }
}

/** Raw storage call; the caller handles errors (e.g. a missing bucket). */
export async function storage(path: string, init: RequestInit = {}): Promise<{ res: Response; text: string }> {
    return call('/storage/v1/' + path, init)
}

/** Escapes a value for a PostgREST `ilike` filter so `_` and `%` match literally. */
export const likeEsc = (s: string) => s.replace(/\*/g, '').replace(/[\\%_]/g, m => '\\' + m)
export const enc = encodeURIComponent
/** Value list for an `in.(...)` filter; quoting keeps dots and @ intact. */
export const inList = (values: string[]) => `(${values.map(v => `"${v.replace(/"/g, '')}"`).join(',')})`
