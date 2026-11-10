// Reads a required setting; a missing one fails loudly instead of half-working.
export function env(name: string, fallback?: string): string {
    const value = process.env[name]?.trim()
    if (value) return value
    if (fallback !== undefined) return fallback
    throw new Error(`Missing environment variable ${name}`)
}
