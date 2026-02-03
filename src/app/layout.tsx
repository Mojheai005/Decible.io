import type { Metadata } from 'next'
import { Roboto } from 'next/font/google'
import './globals.css'

const roboto = Roboto({
    weight: ['100', '300', '400', '500', '700', '900'],
    subsets: ['latin'],
    variable: '--font-roboto',
})

export const metadata: Metadata = {
    title: 'Decible | Text to Speech & AI Voice Generator',
    description: 'Professional AI voice generation platform. Create realistic speech, voices, and sound effects.',
    icons: { icon: '/favicon.svg' },
    openGraph: {
        title: 'Decible | Text to Speech & AI Voice Generator',
        description: 'Professional AI voice generation platform. Create realistic speech, voices, and sound effects.',
        type: 'website',
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
