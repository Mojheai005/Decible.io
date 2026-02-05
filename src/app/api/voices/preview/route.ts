import { NextResponse } from 'next/server';
import { getVoiceById, getVoicePreviewUrl } from '@/lib/voices-data';
import { generateTTS } from '@/lib/kieai';

// Cache for generated previews (fallback when static URL not available)
const previewCache = new Map<string, string>();

// Short sample texts for TTS-generated previews
const PREVIEW_TEXTS = [
    "Welcome to your voice preview. This is how I sound when speaking naturally.",
    "Hello there! I'm excited to be your voice today. Let me show you what I can do.",
    "Hi, thanks for checking out my voice. I hope you enjoy what you hear.",
];

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const voiceId = searchParams.get('voice_id');

        if (!voiceId) {
            return NextResponse.json({ error: 'voice_id is required' }, { status: 400 });
        }

        // Get voice data
        const voiceData = getVoiceById(voiceId);

        // Try static preview URL first (instant, free, no API call needed)
        if (voiceData) {
            const staticUrl = getVoicePreviewUrl(voiceData);
            if (staticUrl) {
                return NextResponse.json({
                    previewUrl: staticUrl,
                    cached: true,
                    source: 'static',
                });
            }
        }

        // Fallback: Check our in-memory cache
        const cachedUrl = previewCache.get(voiceId);
        if (cachedUrl) {
            return NextResponse.json({ previewUrl: cachedUrl, cached: true, source: 'cache' });
        }

        // Last resort: Generate via TTS API (costs credits, slower)
        const voiceName = voiceData?.voiceName || voiceId;
        const text = PREVIEW_TEXTS[Math.floor(Math.random() * PREVIEW_TEXTS.length)];

        const audioBuffer = await generateTTS({
            text,
            voice: voiceName,
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                speed: 1.0,
                style: 0,
            },
        });

        // Convert ArrayBuffer to base64 data URL for immediate playback
        const base64 = Buffer.from(audioBuffer).toString('base64');
        const dataUrl = `data:audio/mpeg;base64,${base64}`;

        // Cache the preview
        previewCache.set(voiceId, dataUrl);

        // Limit cache size
        if (previewCache.size > 100) {
            const firstKey = previewCache.keys().next().value;
            if (firstKey) previewCache.delete(firstKey);
        }

        return NextResponse.json({
            previewUrl: dataUrl,
            cached: false,
            source: 'generated',
        });

    } catch (error) {
        console.error('Preview API Error:', error);

        if (error instanceof Error) {
            if (error.message.includes('Rate limit')) {
                return NextResponse.json(
                    { error: 'Rate limit exceeded', details: 'Please wait a moment and try again' },
                    { status: 429 }
                );
            }
        }

        return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 });
    }
}
