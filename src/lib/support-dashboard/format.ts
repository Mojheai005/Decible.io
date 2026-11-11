// Shared by server and browser code: dates in India time, numbers in Indian format.
const IST: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata' }

export function fmtDate(iso?: string | null, withTime = true): string {
    if (!iso) return '-'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleString('en-IN', {
        ...IST,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: 'numeric', minute: '2-digit', hour12: true } : {}),
    })
}

export const fmtNum = (n?: number | null) => (typeof n === 'number' ? n.toLocaleString('en-IN') : '-')

export const pct = (part: number, total: number) => (total > 0 ? `${Math.round((100 * part) / total)}%` : '-')

/** Start of today in India time, as an ISO timestamp. */
export function istMidnight(now = new Date()): string {
    const day = now.toLocaleDateString('en-CA', IST) // YYYY-MM-DD
    return `${day}T00:00:00+05:30`
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
