import { createClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // Ensure user profile exists in user_profiles table
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                try {
                    const admin = getAdminClient()
                    const { data: existing } = await admin
                        .from('user_profiles')
                        .select('id')
                        .eq('id', user.id)
                        .single()

                    if (!existing) {
                        // First login — create profile with free tier defaults
                        await admin.from('user_profiles').insert({
                            id: user.id,
                            email: user.email,
                            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                            subscription_tier: 'free',
                            credits_remaining: 5000,
                            credits_used_this_month: 0,
                            credits_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        })
                    }
                } catch (profileError) {
                    // Don't block login if profile creation fails — it will be created on next profile fetch
                    console.error('Failed to create user profile on callback:', profileError)
                }
            }

            // Successful authentication — redirect to destination
            const forwardedHost = request.headers.get('x-forwarded-host')
            const isLocalEnv = process.env.NODE_ENV === 'development'

            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${next}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`)
            } else {
                return NextResponse.redirect(`${origin}${next}`)
            }
        }
    }

    // Auth error - redirect to login with error
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
