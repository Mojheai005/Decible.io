import { NextRequest, NextResponse } from 'next/server'
import { cleanName, COOKIE, createToken, passwordMatches, SESSION_DAYS } from '@/lib/session'

export const dynamic = 'force-dynamic'

// Slows down password guessing: 5 wrong tries from one address locks it out for 15 minutes
// (per server instance; the long password is the real protection).
const fails = new Map<string, { n: number; until: number }>()

export async function POST(req: NextRequest) {
    const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim()
    const f = fails.get(ip)
    if (f && f.until > Date.now() && f.n >= 5) {
        return NextResponse.json({ error: 'Too many wrong passwords. Try again in 15 minutes.' }, { status: 429 })
    }

    let body: { name?: unknown; password?: unknown }
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
    const name = cleanName(String(body.name ?? ''))
    const password = String(body.password ?? '')
    if (!name) return NextResponse.json({ error: 'Type your name, so grants and escalations show who made them.' }, { status: 400 })

    if (!password || !passwordMatches(password)) {
        const cur = f && f.until > Date.now() ? f : { n: 0, until: Date.now() + 15 * 60e3 }
        fails.set(ip, { n: cur.n + 1, until: cur.until })
        await new Promise(r => setTimeout(r, 800))
        return NextResponse.json({ error: 'Wrong password.' }, { status: 401 })
    }

    fails.delete(ip)
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE, createToken(name), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: SESSION_DAYS * 86400,
    })
    return res
}
