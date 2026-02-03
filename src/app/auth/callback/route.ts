import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    // Use forwarded host or origin (Vercel deployment URLs vs alias)
    const forwardedHost = request.headers.get('x-forwarded-host')
    const baseUrl = forwardedHost ? `https://${forwardedHost}` : origin

    if (code) {
        const cookieStore = await cookies()

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll()
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) => {
                                cookieStore.set(name, value, options)
                            })
                        } catch (error) {
                            console.error('Cookie set error:', error)
                        }
                    },
                },
            }
        )

        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
            console.error('Auth callback exchangeCodeForSession error:', JSON.stringify({ message: error.message, status: error.status, name: error.name }))
            return NextResponse.redirect(`${baseUrl}/login?error=auth_failed&reason=${encodeURIComponent(error.message)}`)
        }

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
                    const { error: insertError } = await admin.from('user_profiles').insert({
                        id: user.id,
                        email: user.email,
                        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                        subscription_tier: 'free',
                        credits_remaining: 5000,
                        credits_used_this_month: 0,
                        credits_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    })
                    if (insertError) {
                        console.error('Failed to insert user_profiles:', JSON.stringify(insertError))
                    }
                }
            } catch (profileError) {
                console.error('Failed to create user profile on callback:', profileError)
            }
        }

        // Successful authentication — redirect to destination
        return NextResponse.redirect(`${baseUrl}${next}`)
    }

    // No code provided
    return NextResponse.redirect(`${baseUrl}/login?error=auth_failed`)
}
