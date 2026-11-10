'use client'
import { useState } from 'react'

// Anyone on the team logs in with the shared password; nothing else is asked.
export default function LoginForm() {
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setBusy(true)
        setError('')
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) window.location.href = '/'
        else { setError(data.error || 'Could not log in.'); setBusy(false) }
    }

    return (
        <form onSubmit={submit} className="stack">
            <label className="field">Password
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
            </label>
            {error && <div className="msg bad">{error}</div>}
            <button className="btn primary" disabled={busy}>{busy ? 'Checking…' : 'Log in'}</button>
        </form>
    )
}
