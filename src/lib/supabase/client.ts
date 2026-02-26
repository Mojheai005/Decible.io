import { createBrowserClient } from '@supabase/ssr'

// Fallback values for build time (these won't be used at runtime)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Singleton — reuse the same client so Supabase keeps the session in memory.
// Creating a new client every call forces it to re-parse cookies each time.
let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
    if (!browserClient) {
        browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    }
    return browserClient
}
