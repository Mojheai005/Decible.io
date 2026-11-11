import { NextResponse } from 'next/server'
import { COOKIE, COOKIE_PATH } from '@/lib/support-dashboard/session'

export const dynamic = 'force-dynamic'

export async function POST() {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE, '', { httpOnly: true, path: COOKIE_PATH, maxAge: 0 })
    return res
}
