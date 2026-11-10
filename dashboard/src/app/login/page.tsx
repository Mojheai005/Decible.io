import { redirect } from 'next/navigation'
import { getStaff } from '@/lib/session'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
    if (await getStaff()) redirect('/')
    return (
        <main className="wrap">
            <div className="login panel stack">
                <h1 className="brand">Decible Support</h1>
                <p className="muted">Internal dashboard. Ask the admin for the password.</p>
                <LoginForm />
            </div>
        </main>
    )
}
