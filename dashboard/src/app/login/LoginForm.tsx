'use client'
import { useState } from 'react'

export default function LoginForm() {
    const [name, setName] = useState('')
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
            body: JSON.stringify({ name, password }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) window.location.href = '/'
        else { setError(data.error || 'Could not log in.'); setBusy(false) }
    }

    return (
        <form onSubmit={submit} className="stack">
            <label className="field">Your name
                <input value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Shown on grants and escalations you make" required />
            </label>
            <label className="field">Password
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            </label>
            {error && <div className="msg bad">{error}</div>}
            <button className="btn primary" disabled={busy}>{busy ? 'Checking…' : 'Log in'}</button>
        </form>
    )
}
