import type { NextConfig } from 'next'

// Internal tool: never indexed, never framed, nothing cached.
const nextConfig: NextConfig = {
    poweredByHeader: false,
    // This app sits in the dashboard/ folder of the Decible repo. Pin its root so Next.js does not
    // treat the main app's folder (which has its own lockfile) as this project's root.
    turbopack: { root: __dirname },
    outputFileTracingRoot: __dirname,
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'no-referrer' },
                    { key: 'Cache-Control', value: 'no-store' },
                ],
            },
        ]
    },
}

export default nextConfig
