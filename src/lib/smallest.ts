// ===========================================
// SMALLEST.AI — LIGHTNING v3.1 PRO TTS CLIENT
// ===========================================
// Synchronous REST: the response body IS the audio, no task polling.
//
// Output: MP3 @ 24kHz. Their API returns MP3 natively, so nothing is
// transcoded and storage stays on the compressed path.
//
// VERIFIED 2026-09-07 by sending checkpointed scripts and TRANSCRIBING the
// result (scripts/voice-audit.py method), not by trusting the docs:
//     168 chars -> 2/2 checkpoints   100%
//     939 chars -> 7/7               100%
//   2,974 chars -> 20/20             100%
//   4,707 chars -> 30/30             100%
// Their docs say "max ~250 chars recommended"; that is guidance, not a limit.
// Nothing truncated at any size tested, unlike Gemini.
// ===========================================

export const SMALLEST_BASE_URL = 'https://api.smallest.ai/waves/v1'

// Pro pool: 249 curated voices, 31 languages. Entirely separate from the
// 234-voice standard pool — no overlap.
export const SMALLEST_TTS_MODEL = process.env.SMALLEST_TTS_MODEL || 'lightning_v3.1_pro'

export const SMALLEST_OUTPUT_FORMAT = {
    extension: 'mp3',
    mimeType: 'audio/mpeg',
} as const

// 24kHz is plenty for speech and roughly halves the bytes of 44.1kHz for no
// audible difference — the storage blow-up is still recent history.
const SAMPLE_RATE = 24000

export interface SmallestTTSParams {
    text: string
    voiceId: string
    speed?: number      // 0.5 - 2.0, default 1.0
    language?: string   // ISO code; defaults to English
}

export async function generateSmallestTTS(params: SmallestTTSParams): Promise<ArrayBuffer> {
    const apiKey = process.env.SMALLEST_API_KEY
    if (!apiKey) {
        throw new Error('Missing SMALLEST_API_KEY environment variable')
    }

    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
    const speed = clamp(params.speed ?? 1.0, 0.5, 2.0)

    console.log('[Smallest] Generating — voice:', params.voiceId, '| text length:', params.text.length)

    const response = await fetch(`${SMALLEST_BASE_URL}/tts`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: params.text,
            voice_id: params.voiceId,
            model: SMALLEST_TTS_MODEL,
            output_format: 'mp3',
            sample_rate: SAMPLE_RATE,
            speed,
            language: params.language || 'en',
        }),
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        console.error('[Smallest] TTS HTTP Error:', response.status, errorText)
        throw new Error(
            `Smallest.ai TTS failed (HTTP ${response.status}): ${errorText || response.statusText}`,
        )
    }

    const audioBuffer = await response.arrayBuffer()

    if (!audioBuffer || audioBuffer.byteLength < 500) {
        throw new Error('Smallest.ai returned empty or invalid audio')
    }

    return audioBuffer
}
