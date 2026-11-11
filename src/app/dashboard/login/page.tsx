import { redirect } from 'next/navigation'
import { getStaff } from '@/lib/support-dashboard/session'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
    if (await getStaff()) redirect('/dashboard')
    return (
        <main className="wrap">
            <div className="login panel stack">
                <h1 className="brand">Decible Support</h1>
                <p className="muted">Internal dashboard for the Decible team. Enter the team password.</p>
                <LoginForm />
            </div>
        </main>
    )
}
