import crypto from 'crypto'

/**
 * Constant-time string comparison for secrets and signatures.
 * Returns false (never throws) when lengths differ or either side is missing.
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') return false
    const x = Buffer.from(a)
    const y = Buffer.from(b)
    return x.length === y.length && crypto.timingSafeEqual(x, y)
}
