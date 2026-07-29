// ===========================================
// FISH AUDIO TTS API CLIENT
// S2.1 Pro via api.fish.audio — synchronous streaming API
// (free tier model `s2.1-pro-free` until Aug 31; switch to
// `s2.1-pro` via FISH_TTS_MODEL env var when the promo ends)
// Output format: WAV — matches the Gemini pipeline
// ===========================================

export const FISH_BASE_URL = 'https://api.fish.audio'

// Overridable so the paid model can be enabled without a code change
export const FISH_TTS_MODEL = process.env.FISH_TTS_MODEL || 's2.1-pro-free'

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
            format: 'wav',
            sample_rate: 44100,
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

    if (!audioBuffer || audioBuffer.byteLength < 1000) {
        throw new Error('Fish Audio returned empty or invalid audio')
    }

    return audioBuffer
}
