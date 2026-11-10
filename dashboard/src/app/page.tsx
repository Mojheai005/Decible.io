import { redirect } from 'next/navigation'
import { getStaff } from '@/lib/session'
import Dashboard from './Dashboard'

export const dynamic = 'force-dynamic'

export default async function Home() {
    const staff = await getStaff()
    if (!staff) redirect('/login')
    return <Dashboard staff={staff.name} />
}
