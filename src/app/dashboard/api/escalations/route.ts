import { NextRequest, NextResponse } from 'next/server'
import { actorName, requireStaff } from '@/lib/support-dashboard/session'
import { list, newId, notify, save, type Escalation } from '@/lib/support-dashboard/escalations'
import { lookup } from '@/lib/support-dashboard/lookup'
import { fmtDate, fmtNum, isEmail } from '@/lib/support-dashboard/format'

export const dynamic = 'force-dynamic'

export async function GET() {
    const staff = await requireStaff()
    if (staff instanceof NextResponse) return staff
    try {
        return NextResponse.json({ items: await list() })
    } catch (e) {
        return NextResponse.json({ error: `Could not load escalations: ${(e as Error).message}` }, { status: 502 })
    }
}

// Saves the problem together with a snapshot of the account as it was at that moment,
// so whoever investigates sees what support saw.
export async function POST(req: NextRequest) {
    const staff = await requireStaff()
    if (staff instanceof NextResponse) return staff
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
    const email = String(body.email ?? '').trim().toLowerCase()
    const problem = String(body.problem ?? '').trim().slice(0, 5000)
    const contact = String(body.contact ?? '').trim().slice(0, 100)
    const priority = body.priority === 'urgent' ? 'urgent' : 'normal'
    if (!isEmail(email)) return NextResponse.json({ error: 'Type the user\'s full email address.' }, { status: 400 })
    if (problem.length < 5) return NextResponse.json({ error: 'Describe the problem.' }, { status: 400 })

    let snapshot: Escalation['snapshot'] = null
    try {
        const r = await lookup(email)
        snapshot = {
            summary: r.found
                ? `${r.account.tier} plan${r.account.planEnd ? ` until ${fmtDate(r.account.planEnd, false)}` : ''}, ${fmtNum(r.account.credits)} credits, ` +
                  `${r.generations.successRate} of generations worked (${fmtNum(r.generations.completed)} ok, ${fmtNum(r.generations.failed)} failed), ` +
                  `${r.generations.day.failed} failed in the last 24 h, signed in with ${r.auth?.providers?.join(' + ') || 'unknown'}`
                : 'No Decible account uses this email.',
            findings: r.findings,
        }
    } catch (e) {
        snapshot = { summary: `Could not read the account when this was filed: ${(e as Error).message}`, findings: [] }
    }

    const now = new Date()
    const item: Escalation = {
        id: newId(now), email, contact, problem, priority, status: 'open',
        createdAt: now.toISOString(), createdBy: actorName(body.by, staff), updatedAt: now.toISOString(), notes: [], snapshot,
    }
    try {
        await save(item)
    } catch (e) {
        return NextResponse.json({ error: `Could not save: ${(e as Error).message}` }, { status: 502 })
    }
    await notify(item)
    return NextResponse.json({ item })
}
