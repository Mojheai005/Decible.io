// ===========================================
// SUPABASE ADMIN CLIENT (SERVICE ROLE)
// ===========================================
// This client bypasses RLS - use with caution

import { createClient } from '@supabase/supabase-js'

let adminClient: ReturnType<typeof createClient> | null = null

/**
 * Get the Supabase admin client with service role key
 * This bypasses Row Level Security - use only for server-side operations
 */
export function getAdminClient() {
    if (!adminClient) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!url || !serviceKey) {
            throw new Error('Missing Supabase admin credentials')
        }

        adminClient = createClient(url, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        })
    }

    return adminClient
}
