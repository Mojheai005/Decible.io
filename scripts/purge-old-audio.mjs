/**
 * Purge generated audio older than N days from Supabase Storage.
 *
 * WHY: audio was being stored as uncompressed WAV (~705 kbps) and nothing ever
 * deleted it, which put 75 GB into a 1 GB bucket. cleanup_old_history() removes
 * generation_history ROWS after 90 days but never touched the FILES, so a lot
 * of what is in the bucket is orphaned with no database row pointing at it.
 * That is why this walks the bucket by file age rather than joining to history.
 *
 *   node scripts/purge-old-audio.mjs --days=30 --dry-run
 *   node scripts/purge-old-audio.mjs --days=30
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const BUCKET = 'audio-generations'
const PAGE = 1000

const args = Object.fromEntries(
    process.argv.slice(2).map(a => {
        const [k, v] = a.replace(/^--/, '').split('=')
        return [k, v ?? true]
    }),
)
const DAYS = Number(args.days ?? 30)
const DRY = !!args['dry-run']

const env = Object.fromEntries(
    readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
        .split('\n')
        .filter(l => l.includes('=') && !l.trim().startsWith('#'))
        .map(l => {
            const i = l.indexOf('=')
            return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]
        }),
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
})

const cutoff = new Date(Date.now() - DAYS * 86_400_000)
const mb = b => (b / 1024 / 1024).toFixed(1)

async function listAll(prefix) {
    const out = []
    for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await supabase.storage.from(BUCKET)
            .list(prefix, { limit: PAGE, offset })
        if (error) throw new Error(`list ${prefix || '/'}: ${error.message}`)
        if (!data?.length) break
        out.push(...data)
        if (data.length < PAGE) break
    }
    return out
}

console.log(`bucket   ${BUCKET}`)
console.log(`cutoff   older than ${DAYS} days (before ${cutoff.toISOString().slice(0, 10)})`)
console.log(`mode     ${DRY ? 'DRY RUN — nothing will be deleted' : 'DELETING'}\n`)

const folders = (await listAll('')).filter(e => e.id === null)   // id null = folder
console.log(`scanning ${folders.length} user folders...\n`)

let scanned = 0, oldBytes = 0, keptBytes = 0
const doomed = []

for (const folder of folders) {
    const files = await listAll(folder.name)
    for (const f of files) {
        if (f.id === null) continue
        const size = Number(f.metadata?.size ?? 0)
        scanned++
        if (new Date(f.created_at) < cutoff) {
            doomed.push(`${folder.name}/${f.name}`)
            oldBytes += size
        } else {
            keptBytes += size
        }
    }
}

console.log(`files scanned      ${scanned.toLocaleString()}`)
console.log(`to delete          ${doomed.length.toLocaleString()}  (${mb(oldBytes)} MB)`)
console.log(`to keep            ${(scanned - doomed.length).toLocaleString()}  (${mb(keptBytes)} MB)\n`)

if (DRY) { console.log('dry run — done. Re-run without --dry-run to delete.'); process.exit(0) }
if (!doomed.length) { console.log('nothing to delete.'); process.exit(0) }

let removed = 0
for (let i = 0; i < doomed.length; i += 100) {
    const batch = doomed.slice(i, i + 100)
    const { error } = await supabase.storage.from(BUCKET).remove(batch)
    if (error) { console.error(`  batch at ${i} failed: ${error.message}`); continue }
    removed += batch.length
    process.stdout.write(`\r  deleted ${removed.toLocaleString()} / ${doomed.length.toLocaleString()}`)
}
console.log(`\n\nfreed ~${mb(oldBytes)} MB. Bucket should now hold ~${mb(keptBytes)} MB.`)
