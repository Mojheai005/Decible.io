// Password login with a signed cookie. One shared password; each person types their name,
// which is stamped on every grant and escalation they make.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { env } from './env'

export const COOKIE = 'dd_session'
export const SESSION_DAYS = 7

export interface Staff {
    name: string
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url')
const sign = (payload: string) => createHmac('sha256', env('SESSION_SECRET')).update(payload).digest('base64url')

export function passwordMatches(given: string): boolean {
    const a = createHash('sha256').update(given).digest()
    const b = createHash('sha256').update(env('DASHBOARD_PASSWORD')).digest()
    return timingSafeEqual(a, b)
}

export function createToken(name: string): string {
    const payload = b64(JSON.stringify({ n: name, e: Date.now() + SESSION_DAYS * 864e5 }))
    return `${payload}.${sign(payload)}`
}

export function readToken(token: string | undefined): Staff | null {
    if (!token) return null
    const [payload, sig] = token.split('.')
    if (!payload || !sig) return null
    const expected = Buffer.from(sign(payload))
    const given = Buffer.from(sig)
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
        if (typeof data.n !== 'string' || typeof data.e !== 'number' || data.e < Date.now()) return null
        return { name: data.n }
    } catch {
        return null
    }
}

export async function getStaff(): Promise<Staff | null> {
    const jar = await cookies()
    return readToken(jar.get(COOKIE)?.value)
}

/** For API routes: the signed-in person, or a 401 response to return as-is. */
export async function requireStaff(): Promise<Staff | NextResponse> {
    const staff = await getStaff()
    return staff ?? NextResponse.json({ error: 'Please log in again.' }, { status: 401 })
}

/** Cleans a typed name for use in notes: letters, digits, spaces and . - only, max 40 chars. */
export const cleanName = (s: string) => s.replace(/[^\p{L}\p{N} .\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40)
