// Login for the support dashboard at decible.io/dashboard.
//
// One shared team password; anyone with the URL and the password can log in, on as many devices at
// once as needed. The repo is public, so the password is never in the code. It is checked against:
//   1. DASHBOARD_PASSWORD, if that is set in Vercel, otherwise
//   2. a scrypt hash kept in the PRIVATE Storage bucket (config/dashboard-auth.json), written by
//      scripts/set-dashboard-password.mjs.
// The login cookie is signed with a key derived from the service-role key and the password, so
// changing the password logs everyone out. People can type their name in the dashboard (kept in
// their browser) so grants and escalations show who made them.
import { createHash, createHmac, scrypt, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { env } from './env'
import { SbError, storage } from './sb'

export const COOKIE = 'dd_session'
export const COOKIE_PATH = '/dashboard'
export const SESSION_DAYS = 7
export const AUTH_FILE = 'config/dashboard-auth.json'

export interface Staff {
    name: string
}

interface StoredAuth { scheme: 'scrypt'; N: number; r: number; p: number; salt: string; hash: string }
interface Secret { check: (given: string) => Promise<boolean>; fingerprint: string }

const sha256 = (s: string) => createHash('sha256').update(s).digest()
const scryptKey = (password: string, salt: Buffer, length: number, N: number, r: number, p: number) =>
    new Promise<Buffer>((resolve, reject) =>
        scrypt(password, salt, length, { N, r, p, maxmem: 256 * N * r }, (err, key) => (err ? reject(err) : resolve(key))))

let cached: { at: number; secret: Secret | null } | null = null

/** Where the password comes from. Cached for a minute so a password change applies quickly. */
async function loadSecret(): Promise<Secret | null> {
    if (cached && Date.now() - cached.at < 60_000) return cached.secret
    let secret: Secret | null = null
    const fromEnv = process.env.DASHBOARD_PASSWORD?.trim()
    if (fromEnv) {
        const want = sha256(fromEnv)
        secret = { check: async given => timingSafeEqual(sha256(given), want), fingerprint: `env:${want.toString('hex')}` }
    } else {
        try {
            const { text } = await storage(`object/${env('ESCALATION_BUCKET', 'support-escalations')}/${AUTH_FILE}`)
            const a = JSON.parse(text) as StoredAuth
            if (a.scheme === 'scrypt' && a.salt && a.hash) {
                const want = Buffer.from(a.hash, 'base64')
                const salt = Buffer.from(a.salt, 'base64')
                secret = {
                    check: async given => {
                        const got = await scryptKey(given, salt, want.length, a.N, a.r, a.p)
                        return timingSafeEqual(got, want)
                    },
                    fingerprint: `stored:${a.hash}`,
                }
            }
        } catch (e) {
            if (!(e instanceof SbError && (e.status === 400 || e.status === 404))) throw e
        }
    }
    cached = { at: Date.now(), secret }
    return secret
}

async function signingKey(): Promise<string | null> {
    const secret = await loadSecret()
    if (!secret) return null
    const base = process.env.DASHBOARD_SESSION_SECRET?.trim() || env('SUPABASE_SERVICE_ROLE_KEY')
    return createHmac('sha256', base).update(`decible-dashboard-session|${secret.fingerprint}`).digest('base64url')
}

const sign = (key: string, payload: string) => createHmac('sha256', key).update(payload).digest('base64url')

/** 'ok', 'wrong', or 'unset' when no password has been set up yet. */
export async function checkPassword(given: string): Promise<'ok' | 'wrong' | 'unset'> {
    const secret = await loadSecret()
    if (!secret) return 'unset'
    return given && (await secret.check(given)) ? 'ok' : 'wrong'
}

export async function createToken(name: string): Promise<string> {
    const key = await signingKey()
    if (!key) throw new Error('Dashboard password not set up')
    const payload = Buffer.from(JSON.stringify({ n: name, e: Date.now() + SESSION_DAYS * 864e5 })).toString('base64url')
    return `${payload}.${sign(key, payload)}`
}

export async function readToken(token: string | undefined): Promise<Staff | null> {
    if (!token) return null
    const [payload, sig] = token.split('.')
    if (!payload || !sig) return null
    const key = await signingKey()
    if (!key) return null
    const expected = Buffer.from(sign(key, payload))
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

/** The name to record on an action: what the person typed in the dashboard, else "Team". */
export const actorName = (typed: unknown, staff: Staff) => cleanName(String(typed ?? '')) || staff.name || 'Team'
