import { NextResponse } from 'next/server';
import { getNextApiKey, getCurrentApiKey } from '@/lib/dubvoice';
import { API_CONFIG } from '@/lib/constants';

const DUBVOICE_BASE_URL = API_CONFIG.DUBVOICE_BASE_URL;

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

        const apiKey = getNextApiKey();

        // Pick a random preview text
        const text = PREVIEW_TEXTS[Math.floor(Math.random() * PREVIEW_TEXTS.length)];

        // Generate preview using TTS
        console.log(`Generating preview for voice: ${voiceId}`);

        const initResponse = await fetch(`${DUBVOICE_BASE_URL}/tts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text,
                voice_id: voiceId,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    speed: 1.0,
                    style: 0,
                    use_speaker_boost: true
                }
            })
        });

        if (!initResponse.ok) {
            const errorText = await initResponse.text();
            console.error('Preview generation failed:', errorText);
            return NextResponse.json({ error: 'Preview generation failed', details: errorText }, { status: initResponse.status });
        }

        const initData = await initResponse.json();
        const taskId = initData.task_id;

        if (!taskId) {
            return NextResponse.json({ error: 'No task_id returned' }, { status: 500 });
        }

        // Poll for completion
        const pollKey = getCurrentApiKey();
        const maxAttempts = 30; // 30 seconds max
        const delayMs = 1000;

        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, delayMs));

            const statusResponse = await fetch(`${DUBVOICE_BASE_URL}/tts/${taskId}`, {
                headers: { 'Authorization': `Bearer ${pollKey}` },
                cache: 'no-store'
            });

            if (statusResponse.ok) {
                const statusData = await statusResponse.json();

                if (statusData.status === 'completed' && statusData.result) {
                    // Cache the preview URL
                    previewCache.set(voiceId, statusData.result);

                    return NextResponse.json({
                        previewUrl: statusData.result,
                        cached: false
                    });
                } else if (statusData.status === 'failed') {
                    return NextResponse.json({ error: 'Preview generation failed', details: statusData.error }, { status: 500 });
                }
            }
        }

        return NextResponse.json({ error: 'Preview generation timed out' }, { status: 408 });

    } catch (error) {
        console.error('Preview API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
