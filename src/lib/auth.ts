// ===========================================
// AUTHENTICATION UTILITIES
// ===========================================

import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { NextResponse } from 'next/server'
import { authLogger } from './logger'
import { HTTP_STATUS, ERROR_MESSAGES } from './constants'

export interface AuthUser {
    id: string
    email?: string
    role?: string
}

export interface AuthResult {
    user: AuthUser | null
    error: string | null
}

/**
 * Get authenticated user from server-side request
 * Returns null if not authenticated
 */
export async function getAuthUser(): Promise<AuthUser | null> {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error || !user) {
            return null
        }

        return {
            id: user.id,
            email: user.email,
            role: user.role,
        }
    } catch (error) {
        authLogger.unauthorized('unknown', 'Failed to get user session')
        return null
    }
}

/**
 * Require authentication for API routes
 * Returns user if authenticated, or sends 401 response
 */
export async function requireAuth(): Promise<{
    user: AuthUser | null
    response: NextResponse | null
}> {
    const user = await getAuthUser()

    if (!user) {
        authLogger.unauthorized('api_route', 'No valid session')
        return {
            user: null,
            response: NextResponse.json(
                { error: ERROR_MESSAGES.UNAUTHORIZED },
                { status: HTTP_STATUS.UNAUTHORIZED }
            ),
        }
    }

    return { user, response: null }
}

/**
 * Get authenticated user with admin client fallback for development
 * USE WITH CAUTION - bypasses RLS
 */
export async function getAuthUserWithDevFallback(): Promise<{
    user: AuthUser | null
    supabase: any
    isMockUser: boolean
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        return {
            user: { id: user.id, email: user.email },
            supabase,
            isMockUser: false,
        }
    }

    // Development fallback
    if (process.env.NODE_ENV !== 'production') {
        const mockUserId = '00000000-0000-0000-0000-000000000000'

        // Create admin client to bypass RLS
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const { createClient: createAdminClient } = await import('@supabase/supabase-js')
            const adminClient = createAdminClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            )

            authLogger.unauthorized('dev_fallback', 'Using mock user for development')

            return {
                user: { id: mockUserId, email: 'dev@mock.local' },
                supabase: adminClient,
                isMockUser: true,
            }
        }
    }

    return { user: null, supabase, isMockUser: false }
}

/**
 * Check if user has required subscription tier
 */
export async function checkSubscriptionTier(
    userId: string,
    requiredTier: string[]
): Promise<boolean> {
    try {
        const supabase = await createClient()
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('subscription_tier')
            .eq('id', userId)
            .single()

        if (!profile) return false

        return requiredTier.includes(profile.subscription_tier)
    } catch {
        return false
    }
}

/**
 * Check if user has sufficient credits
 */
export async function checkCredits(
    userId: string,
    requiredCredits: number
): Promise<{ hasCredits: boolean; balance: number }> {
    try {
        const supabase = await createClient()
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('credits_remaining')
            .eq('id', userId)
            .single()

        if (!profile) {
            return { hasCredits: false, balance: 0 }
        }

        return {
            hasCredits: profile.credits_remaining >= requiredCredits,
            balance: profile.credits_remaining,
        }
    } catch {
        return { hasCredits: false, balance: 0 }
    }
}

/**
 * Sign out user (client-side)
 */
export async function signOut(): Promise<void> {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
}

/**
 * Get user profile with credits
 */
export async function getUserProfile(userId: string) {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single()

        if (error) throw error
        return data
    } catch {
        return null
    }
}
