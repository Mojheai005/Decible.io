import { NextRequest, NextResponse } from 'next/server'
import { actorName, requireStaff } from '@/lib/session'
import { load, save, type Status } from '@/lib/escalations'

export const dynamic = 'force-dynamic'

const STATUSES: Status[] = ['open', 'investigating', 'resolved']

// PATCH { status?, note? } -> change the status and/or add a note signed with the person's name.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const staff = await requireStaff()
    if (staff instanceof NextResponse) return staff
    const { id } = await params
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }

    const item = await load(id)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const now = new Date().toISOString()
    const by = actorName(body.by, staff)
    const note = String(body.note ?? '').trim().slice(0, 5000)
    const status = STATUSES.find(s => s === body.status)
    if (!note && !status) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })

    if (status && status !== item.status) {
        item.notes.push({ at: now, by, text: `Status: ${item.status} → ${status}` })
        item.status = status
    }
    if (note) item.notes.push({ at: now, by, text: note })
    item.updatedAt = now
    await save(item)
    return NextResponse.json({ item })
}
