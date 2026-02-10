import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Decible - Real Human Voices for YouTube',
        short_name: 'Decible',
        description: 'Create emotional, human-sounding voiceovers for YouTube videos and automation. Control tone, emotion, and style with AI voices that sound real.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#111827',
        icons: [
            {
                src: '/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
            },
            {
                src: '/favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
            },
        ],
    }
}
