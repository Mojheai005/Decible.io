// ===========================================
// FISH AUDIO TTS API CLIENT
// S2.1 Pro via api.fish.audio — synchronous streaming API
//
// Output format: MP3 @ 128 kbps.
// Measured 2026-09-03 on a 53-second generation:
//     WAV 44.1kHz   4,570 KB   (705 kbps)
//     MP3 128 kbps    847 KB   5.4x smaller
//     MP3 64 kbps     417 KB   11x smaller
// Storing WAV put 75 GB into Supabase and blew through both the storage and
// egress quotas. 128 kbps is transparent for speech and cuts storage AND
// egress by ~81%; 64 kbps saves more but is audibly thinner on headphones,
// and the audio IS the product here.
// ===========================================

export const FISH_BASE_URL = 'https://api.fish.audio'

// Overridable so the paid model can be enabled without a code change
// `s2.1-pro-free` was a promo alias and must not be relied on — default to
// the real paid model and let the env var override if Fish renames it.
export const FISH_TTS_MODEL = process.env.FISH_TTS_MODEL || 's2.1-pro'

// Fish returns MP3; Kie/Gemini returns WAV. The storage layer needs the right
// extension and content type per engine or the browser refuses to play it.
export const FISH_OUTPUT_FORMAT = {
    extension: 'mp3',
    mimeType: 'audio/mpeg',
} as const

const FISH_MP3_BITRATE = 128

export interface FishTTSParams {
    text: string
    referenceId: string   // Fish voice model id
    speed?: number        // 0.5 - 2.0, default 1.0
}

/**
 * Generate TTS audio using Fish Audio S2.1 Pro.
 * Synchronous: the response body IS the audio (no task polling).
 * Returns a WAV ArrayBuffer, same contract as kieai's generateTTS.
 */
export async function generateFishTTS(params: FishTTSParams): Promise<ArrayBuffer> {
    const apiKey = process.env.FISH_AUDIO_API_KEY
    if (!apiKey) {
        throw new Error('Missing FISH_AUDIO_API_KEY environment variable')
    }

    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
    const speed = clamp(params.speed ?? 1.0, 0.5, 2.0)

    console.log('[Fish] Generating — voice:', params.referenceId, '| text length:', params.text.length)

    const response = await fetch(`${FISH_BASE_URL}/v1/tts`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'model': FISH_TTS_MODEL,
        },
        body: JSON.stringify({
            text: params.text,
            reference_id: params.referenceId,
            format: 'mp3',
            mp3_bitrate: FISH_MP3_BITRATE,
            latency: 'normal',
            prosody: { speed, volume: 0 },
        }),
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        console.error('[Fish] TTS HTTP Error:', response.status, errorText)
        throw new Error(`Fish Audio TTS failed (HTTP ${response.status}): ${errorText || response.statusText}`)
    }

    const audioBuffer = await response.arrayBuffer()

    // MP3 is far denser than WAV, so the old 1000-byte floor would have let a
    // near-empty clip through. A real generation is comfortably above this.
    if (!audioBuffer || audioBuffer.byteLength < 500) {
        throw new Error('Fish Audio returned empty or invalid audio')
    }

    return audioBuffer
}
