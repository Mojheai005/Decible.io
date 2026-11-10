import { NextRequest, NextResponse } from 'next/server'
import { actorName, requireStaff } from '@/lib/session'
import { executeGrant, moveGrant, planGrant } from '@/lib/grant'
import { isEmail } from '@/lib/format'

export const dynamic = 'force-dynamic'

// POST { mode: 'check', email }                          -> what a grant would do (changes nothing)
// POST { mode: 'grant', email, reason, confirmed }       -> grant 500,000 credits + 30 days Pro
// POST { mode: 'move', email, from }                     -> move a waiting grant from a mistyped email
export async function POST(req: NextRequest) {
    const staff = await requireStaff()
    if (staff instanceof NextResponse) return staff
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!isEmail(email)) return NextResponse.json({ error: 'Type a full email address.' }, { status: 400 })

    try {
        if (body.mode === 'check') return NextResponse.json(await planGrant(email))
        if (body.mode === 'grant') {
            const reason = String(body.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
            const result = await executeGrant(email, actorName(body.by, staff), reason, body.confirmed === true)
            console.log('grant', { by: actorName(body.by, staff), email, ok: result.ok, message: result.message })
            return NextResponse.json(result, { status: result.ok ? 200 : 409 })
        }
        if (body.mode === 'move') {
            const from = String(body.from ?? '').trim().toLowerCase()
            if (!isEmail(from)) return NextResponse.json({ error: 'Bad email to move from.' }, { status: 400 })
            const result = await moveGrant(from, email, actorName(body.by, staff))
            console.log('move grant', { by: actorName(body.by, staff), from, to: email, ok: result.ok, message: result.message })
            return NextResponse.json(result, { status: result.ok ? 200 : 409 })
        }
        return NextResponse.json({ error: 'Unknown mode' }, { status: 400 })
    } catch (e) {
        console.error('grant failed', e)
        return NextResponse.json({ ok: false, error: `Something went wrong: ${(e as Error).message}. Look the email up before trying again.` }, { status: 502 })
    }
}
