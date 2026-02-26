import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Security headers for all responses
const SECURITY_HEADERS = {
    'X-DNS-Prefetch-Control': 'on',
    'X-XSS-Protection': '1; mode=block',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

// Add security headers to response
function addSecurityHeaders(response: NextResponse): NextResponse {
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value)
    })
    return response
}

// Routes that require authentication
const PROTECTED_ROUTES = [
    '/generate',
    '/voices',
    '/history',
    '/credits',
    '/settings',
]

// API routes handle their own authentication internally
const PROTECTED_API_ROUTES: string[] = []

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Skip auth check for auth callback — it handles its own auth
    if (pathname.startsWith('/auth/callback')) {
        return addSecurityHeaders(NextResponse.next({ request }))
    }

    // Check if this route actually needs auth validation
    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route))
    const isProtectedApiRoute = PROTECTED_API_ROUTES.some(route => pathname.startsWith(route))
    const isAuthPage = pathname === '/login' || pathname === '/register'
    const needsAuthCheck = isProtectedRoute || isProtectedApiRoute || isAuthPage

    // For public routes (landing page, API routes that handle their own auth, etc.)
    // just add security headers and pass through — no network round-trip to Supabase.
    if (!needsAuthCheck) {
        return addSecurityHeaders(NextResponse.next({ request }))
    }

    let response = NextResponse.next({ request })

    // Create Supabase client with cookie handling
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    response = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Only call getUser() when we actually need to validate the session
    const { data: { user } } = await supabase.auth.getUser()

    if (isProtectedRoute || isProtectedApiRoute) {
        if (!user) {
            if (isProtectedApiRoute) {
                if (process.env.NODE_ENV !== 'production') {
                    return response
                }
                return NextResponse.json(
                    { error: 'Authentication required' },
                    { status: 401 }
                )
            }
            const redirectUrl = new URL('/login', request.url)
            redirectUrl.searchParams.set('redirect', pathname)
            return NextResponse.redirect(redirectUrl)
        }
    }

    // Redirect authenticated users away from auth pages back to SPA
    if (isAuthPage && user) {
        return NextResponse.redirect(new URL('/', request.url))
    }

    return addSecurityHeaders(response)
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
}
