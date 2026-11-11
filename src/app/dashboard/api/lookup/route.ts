import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/support-dashboard/session'
import { lookup } from '@/lib/support-dashboard/lookup'
import { isEmail } from '@/lib/support-dashboard/format'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const staff = await requireStaff()
    if (staff instanceof NextResponse) return staff
    const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase()
    if (!isEmail(email)) return NextResponse.json({ error: 'Type a full email address.' }, { status: 400 })
    try {
        return NextResponse.json(await lookup(email))
    } catch (e) {
        console.error('lookup failed', e)
        return NextResponse.json({ error: `Lookup failed: ${(e as Error).message}` }, { status: 502 })
    }
}
