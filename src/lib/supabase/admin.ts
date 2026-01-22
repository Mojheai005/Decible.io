// ===========================================
// SUPABASE ADMIN CLIENT (SERVICE ROLE)
// ===========================================
// This client bypasses RLS - use with caution

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: SupabaseClient<any, 'public', any> | null = null

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
