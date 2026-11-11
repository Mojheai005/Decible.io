// Sets the password for the support dashboard at decible.io/dashboard.
//
// The repo is public, so the password is never stored in the code. This script saves a scrypt
// hash of it in the PRIVATE Supabase Storage bucket "support-escalations" (config/dashboard-auth.json).
// The dashboard reads it within a minute; everyone who was logged in is logged out.
// (If DASHBOARD_PASSWORD is ever set in Vercel, that value is used instead of this one.)
//
// Usage, from the repo folder (needs .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
//   node scripts/set-dashboard-password.mjs "the new password"
import { readFileSync } from 'node:fs'
import { randomBytes, scryptSync } from 'node:crypto'

const password = process.argv[2] || ''
if (password.length < 8) {
    console.error('Give the new password (at least 8 characters) as the first argument, in quotes.')
    process.exit(1)
}
const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))
const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('.env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const BUCKET = env.ESCALATION_BUCKET || 'support-escalations'
const N = 32768, r = 8, p = 1
const salt = randomBytes(16)
const hash = scryptSync(password, salt, 32, { N, r, p, maxmem: 256 * N * r })
const body = JSON.stringify({ scheme: 'scrypt', N, r, p, salt: salt.toString('base64'), hash: hash.toString('base64'), setAt: new Date().toISOString() })
const H = { apikey: key, Authorization: `Bearer ${key}` }

const put = () => fetch(`${url}/storage/v1/object/${BUCKET}/config/dashboard-auth.json`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json', 'x-upsert': 'true' }, body,
})
let res = await put()
if (!res.ok && /not found/i.test(await res.clone().text())) {
    const made = await fetch(`${url}/storage/v1/bucket`, {
        method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
    })
    if (!made.ok && !/exist/i.test(await made.text())) { console.error('Could not create the private bucket'); process.exit(1) }
    res = await put()
}
if (!res.ok) { console.error('Could not save:', res.status, (await res.text()).slice(0, 200)); process.exit(1) }

const check = await (await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers: H })).json()
console.log(`Saved. The dashboard password is updated (bucket "${BUCKET}" is ${check.public ? 'PUBLIC - fix this!' : 'private'}).`)
