import { redirect } from 'next/navigation'
import { getStaff } from '@/lib/support-dashboard/session'
import Dashboard from './Dashboard'

export const dynamic = 'force-dynamic'

export default async function Home() {
    if (!(await getStaff())) redirect('/dashboard/login')
    return <Dashboard />
}
