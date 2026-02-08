import type { Metadata, Viewport } from 'next'
import { Roboto } from 'next/font/google'
import './globals.css'

const roboto = Roboto({
    weight: ['100', '300', '400', '500', '700', '900'],
    subsets: ['latin'],
    variable: '--font-roboto',
})

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
    themeColor: '#ffffff',
}

export const metadata: Metadata = {
    title: 'Decible | Text to Speech & AI Voice Generator',
    description: 'Professional AI voice generation platform. Create realistic speech, voices, and sound effects.',
    icons: { icon: '/favicon.svg' },
    openGraph: {
        title: 'Decible | Text to Speech & AI Voice Generator',
        description: 'Professional AI voice generation platform. Create realistic speech, voices, and sound effects.',
        type: 'website',
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'Decible',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className={roboto.variable}>
            <body className="bg-white text-black antialiased font-sans">
                {children}
            </body>
        </html>
    )
}
