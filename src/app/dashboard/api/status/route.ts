import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/support-dashboard/session'
import { providerStatus } from '@/lib/support-dashboard/status'

export const dynamic = 'force-dynamic'

export async function GET() {
    const staff = await requireStaff()
    if (staff instanceof NextResponse) return staff
    try {
        return NextResponse.json(await providerStatus())
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 502 })
    }
}
