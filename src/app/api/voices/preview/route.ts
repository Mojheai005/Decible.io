import { NextResponse } from 'next/server';
import { generateTTS } from '@/lib/kieai';
import { getVoiceById } from '@/lib/voices-data';

// Cache for generated previews (in-memory for dev, use Redis/KV in production)
const previewCache = new Map<string, string>();

// Short sample texts for previews
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

        // Check cache first
        const cachedUrl = previewCache.get(voiceId);
        if (cachedUrl) {
            return NextResponse.json({ previewUrl: cachedUrl, cached: true });
        }

        // Get voice data to get the actual voice name for API
        const voiceData = getVoiceById(voiceId);
        const voiceName = voiceData?.voiceName || voiceId;

        // Pick a random preview text
        const text = PREVIEW_TEXTS[Math.floor(Math.random() * PREVIEW_TEXTS.length)];

        // Generate preview using Kie.ai TTS (direct response, no polling!)
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

        // Cache the preview URL (in production, you might want to store this in Supabase)
        previewCache.set(voiceId, dataUrl);

        // Limit cache size
        if (previewCache.size > 100) {
            const firstKey = previewCache.keys().next().value;
            if (firstKey) previewCache.delete(firstKey);
        }

        return NextResponse.json({
            previewUrl: dataUrl,
            cached: false
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
