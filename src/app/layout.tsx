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
    metadataBase: new URL('https://www.decible.io'),
    title: {
        default: 'Decible | Real Human AI Voices for YouTube & Content Creators',
        template: '%s | Decible',
    },
    description: 'Create emotional, human-sounding voiceovers for YouTube videos and automation. Control tone, pace, and emotion with AI voices that sound real. Trusted by 4,200+ creators.',
    keywords: [
        'AI voiceover', 'YouTube voice generator', 'text to speech',
        'human sounding AI voice', 'YouTube automation voice',
        'emotional AI voice', 'voiceover for YouTube',
        'AI narration', 'content creator voice tool',
        'realistic text to speech', 'YouTube TTS',
    ],
    authors: [{ name: 'Decible' }],
    creator: 'Decible',
    publisher: 'Decible',
    icons: {
        icon: [
            { url: '/favicon.svg', type: 'image/svg+xml' },
        ],
        apple: '/favicon.svg',
    },
    openGraph: {
        title: 'Decible | Real Human AI Voices for YouTube',
        description: 'Create emotional, human-sounding voiceovers for YouTube videos and automation. Control tone, pace, and emotion with AI voices that sound real.',
        url: 'https://www.decible.io',
        siteName: 'Decible',
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Decible | Real Human AI Voices for YouTube',
        description: 'Create emotional, human-sounding voiceovers for YouTube videos and automation. Trusted by 4,200+ creators.',
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    verification: {
        google: 'MzXquPhdvchBPGoi4jBNjPIRF-mhtfnuIuAAk3Tktbw',
    },
    alternates: {
        canonical: 'https://www.decible.io',
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
