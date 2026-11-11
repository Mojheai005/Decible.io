import { NextRequest, NextResponse } from 'next/server'
import { checkPassword, COOKIE, COOKIE_PATH, createToken, SESSION_DAYS } from '@/lib/support-dashboard/session'

export const dynamic = 'force-dynamic'

// Slows down password guessing. Keyed by address, so it is generous: a whole office can share one
// address, and one person's typos must not lock the rest out. 10 wrong tries -> 10 minutes.
const MAX_FAILS = 10
const LOCK_MS = 10 * 60e3
const fails = new Map<string, { n: number; until: number }>()

export async function POST(req: NextRequest) {
    const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim()
    const f = fails.get(ip)
    if (f && f.until > Date.now() && f.n >= MAX_FAILS) {
        return NextResponse.json({ error: 'Too many wrong passwords. Try again in 10 minutes.' }, { status: 429 })
    }

    let body: { password?: unknown }
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
    const password = String(body.password ?? '')

    const result = await checkPassword(password)
    if (result === 'unset') {
        return NextResponse.json({ error: 'The dashboard password has not been set up yet.' }, { status: 503 })
    }
    if (result !== 'ok') {
        const cur = f && f.until > Date.now() ? f : { n: 0, until: Date.now() + LOCK_MS }
        fails.set(ip, { n: cur.n + 1, until: cur.until })
        await new Promise(r => setTimeout(r, 800))
        return NextResponse.json({ error: 'Wrong password.' }, { status: 401 })
    }

    fails.delete(ip)
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE, await createToken('Team'), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: COOKIE_PATH,
        maxAge: SESSION_DAYS * 86400,
    })
    return res
}
