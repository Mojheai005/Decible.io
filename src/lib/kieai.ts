// ===========================================
// KIE.AI TTS API CLIENT
// Gemini 3.1 Flash TTS via Kie.ai
// Uses async task creation + polling
// Output format: WAV (audio/wav)
// ===========================================

import { VOICES_DATA, GEMINI_VOICES } from './voices-data'
import { ENGINE_LIMITS } from './constants'
import { EngineError } from './tts-errors'

// Per-call deadlines, so one hung connection cannot hold the function until
// it is killed after the credits were taken and before the refund runs.
const CREATE_TIMEOUT_MS = 30_000
const POLL_CALL_TIMEOUT_MS = 20_000
const DOWNLOAD_TIMEOUT_MS = 60_000
// A single failed status check used to fail the whole generation, although
// the task itself usually completes. Give up only after this many in a row.
const MAX_CONSECUTIVE_POLL_ERRORS = 3

/** Time left before `deadline`, capped at `cap`, never below one second. */
const timeLeft = (deadline: number, cap: number) => Math.max(1000, Math.min(cap, deadline - Date.now()))

export const KIEAI_BASE_URL = 'https://api.kie.ai/api/v1'

export const KIEAI_TTS_MODEL = 'google/gemini-3-1-flash-tts'

// Generated audio format for the current model
export const TTS_OUTPUT_FORMAT = {
    extension: 'wav',
    mimeType: 'audio/wav',
} as const

// Voice settings interface — kept for backward compatibility with the
// ElevenLabs-era API surface. Only `speed` has an effect on the Gemini
// model (mapped to its `pace` control); the rest are accepted and ignored.
export interface KieAIVoiceSettings {
    stability?: number        // 0.0-1.0 (ignored by Gemini TTS)
    similarity_boost?: number // 0.0-1.0 (ignored by Gemini TTS)
    style?: number           // 0.0-1.0 (ignored by Gemini TTS)
    speed?: number           // 0.7-1.2, default 1.0 → mapped to pace
}

export interface KieAITTSParams {
    text: string
    voice: string  // Catalog voice name/ID (e.g. "Rachel") or a Gemini voice name (e.g. "Puck")
    voice_settings?: KieAIVoiceSettings
    language_code?: string  // No-op: Gemini TTS auto-detects language
    /** Overall deadline for create + poll + download, so the caller can still refund and answer. */
    timeoutMs?: number
}

interface CreateTaskResponse {
    code: number
    msg: string
    data: {
        taskId: string
        recordId: string
    }
}

interface TaskStatusResponse {
    code: number
    msg: string
    data: {
        taskId: string
        model: string
        state: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail'
        resultJson?: string
        failCode?: string | null
        failMsg?: string | null
        costTime?: number
        completeTime?: number
        createTime?: number
    }
}

interface ResultJson {
    resultUrls: string[]
}

// ===========================================
// VOICE MAPPING — legacy ElevenLabs catalog → Gemini voices
// The library UI still shows the original 85+ catalog voices; each one is
// deterministically mapped to the closest-gender Gemini voice so existing
// saved voices and history keep working.
// ===========================================

// Pools are derived from the catalog so genders always match GEMINI_VOICES
export const GEMINI_MALE_VOICES: string[] = GEMINI_VOICES.filter(v => v.gender === 'male').map(v => v.voiceName)
export const GEMINI_FEMALE_VOICES: string[] = GEMINI_VOICES.filter(v => v.gender === 'female').map(v => v.voiceName)

const ALL_GEMINI_VOICES = new Set<string>(GEMINI_VOICES.map(v => v.voiceName))

// Deterministic string hash so a given catalog voice always maps to the
// same Gemini voice across requests and deploys
function hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}

/**
 * Resolve any catalog voice identifier (voiceName, id, display name, or
 * ElevenLabs ID) to a valid Gemini voice name. Gemini names pass through.
 */
export function mapToGeminiVoice(voice: string): string {
    if (ALL_GEMINI_VOICES.has(voice)) {
        return voice
    }

    const lower = voice.toLowerCase()
    const catalogVoice = VOICES_DATA.find(v =>
        v.voiceName === voice ||
        v.id === lower ||
        v.name.toLowerCase() === lower ||
        v.elevenLabsId === voice
    )

    // Catalog entry already targets a Gemini voice (e.g. looked up by id 'puck') — use it directly
    if (catalogVoice && ALL_GEMINI_VOICES.has(catalogVoice.voiceName)) {
        return catalogVoice.voiceName
    }

    const pool: readonly string[] = catalogVoice?.gender === 'female'
        ? GEMINI_FEMALE_VOICES
        : GEMINI_MALE_VOICES // male + neutral + unknown default to the male pool

    return pool[hashString(catalogVoice?.id || voice) % pool.length]
}

// Map the legacy speed slider (0.7-1.2) to Gemini's pace presets
function speedToPace(speed: number): 'Natural' | 'Rapid Fire' | 'The Drift' {
    if (speed >= 1.1) return 'Rapid Fire'
    if (speed <= 0.85) return 'The Drift'
    return 'Natural'
}

/**
 * Create a TTS task on Kie.ai
 */
async function createTask(params: KieAITTSParams, deadline: number): Promise<string> {
    const apiKey = process.env.KIEAI_API_KEY
    if (!apiKey) {
        throw new EngineError('gemini', 'Missing KIEAI_API_KEY environment variable', { phase: 'create' })
    }

    const settings = params.voice_settings || {}
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const speed = clamp(settings.speed ?? 1.0, 0.7, 1.2)
    const geminiVoice = mapToGeminiVoice(params.voice)

    const requestBody = {
        model: KIEAI_TTS_MODEL,
        input: {
            speakers: [
                {
                    speaker_id: 'Speaker 1',
                    voice_name: geminiVoice,
                    pace: speedToPace(speed),
                },
            ],
            dialogue_turns: [
                {
                    speaker_id: 'Speaker 1',
                    text: params.text,
                },
            ],
        },
    }

    console.log('[Kie.ai] Creating task — voice:', params.voice, '→', geminiVoice, '| text length:', params.text.length)

    const response = await fetch(`${KIEAI_BASE_URL}/jobs/createTask`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeLeft(deadline, CREATE_TIMEOUT_MS)),
    })

    if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new EngineError('gemini', `Kie.ai task creation failed (HTTP ${response.status}): ${errorText.slice(0, 400)}`, {
            status: response.status, phase: 'create',
        })
    }

    const result: CreateTaskResponse = await response.json()

    // Kie.ai reports most errors inside an HTTP 200, with its own code
    // (402 insufficient credits, 429, 455 maintenance, 500...). Carry that
    // code as the status so the classifier can tell them apart.
    if (result.code !== 200 || !result.data?.taskId) {
        throw new EngineError('gemini', `Kie.ai task creation failed (code ${result.code}): ${result.msg || JSON.stringify(result).slice(0, 300)}`, {
            status: Number(result.code) || undefined, phase: 'create',
        })
    }

    return result.data.taskId
}

/**
 * Poll for task completion
 */
async function pollTaskStatus(taskId: string, overallDeadline: number): Promise<string> {
    const apiKey = process.env.KIEAI_API_KEY
    if (!apiKey) {
        throw new EngineError('gemini', 'Missing KIEAI_API_KEY environment variable', { phase: 'poll' })
    }

    // 90s was too short: a 1,449-char request was measured taking 284s to
    // return, so the app gave up on work the API had actually completed —
    // the user saw a failure and the credits round-tripped through a refund.
    // Stays inside the route's maxDuration of 300s.
    const pollInterval = 2000
    const started = Date.now()
    const deadline = Math.min(started + ENGINE_LIMITS.gemini.pollTimeoutMs, overallDeadline)
    let consecutiveErrors = 0
    let lastError: EngineError | null = null

    while (Date.now() < deadline) {
        try {
            const response = await fetch(
                `${KIEAI_BASE_URL}/jobs/recordInfo?taskId=${taskId}`,
                {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                    signal: AbortSignal.timeout(timeLeft(deadline, POLL_CALL_TIMEOUT_MS)),
                }
            )

            if (!response.ok) {
                throw new EngineError('gemini', `Kie.ai poll failed (HTTP ${response.status})`, {
                    status: response.status, phase: 'poll',
                })
            }

            const result: TaskStatusResponse = await response.json()

            if (result.code !== 200) {
                throw new EngineError('gemini', `Kie.ai poll failed (code ${result.code}): ${result.msg}`, {
                    status: Number(result.code) || undefined, phase: 'poll',
                })
            }

            consecutiveErrors = 0
            const { state, resultJson, failMsg, failCode } = result.data

            if (state === 'success' && resultJson) {
                let parsed: ResultJson
                try {
                    parsed = JSON.parse(resultJson)
                } catch {
                    throw new EngineError('gemini', 'Kie.ai returned an unreadable result', { phase: 'poll', final: true })
                }
                if (parsed.resultUrls && parsed.resultUrls.length > 0) {
                    return parsed.resultUrls[0]
                }
                throw new EngineError('gemini', 'Kie.ai returned no audio URL', { phase: 'poll', final: true })
            }

            if (state === 'fail') {
                // The task itself failed: a final answer, not a hiccup.
                throw new EngineError('gemini', `TTS generation failed: ${failMsg || failCode || 'Unknown error'}`, {
                    status: Number(failCode) || undefined, phase: 'poll', final: true,
                })
            }
        } catch (err) {
            if (err instanceof EngineError && err.final) throw err
            // Network hiccup, timeout or an error answer on ONE status check.
            consecutiveErrors++
            lastError = err instanceof EngineError
                ? err
                : new EngineError('gemini', `Kie.ai poll failed: ${err instanceof Error ? err.message : String(err)}`, { phase: 'poll' })
            if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) throw lastError
        }

        // Still processing (or recovering from a hiccup): wait and poll again
        await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new EngineError('gemini', `TTS generation timed out after ${Math.round((Date.now() - started) / 1000)} seconds`, {
        phase: 'poll',
    })
}

/**
 * Generate TTS audio using Kie.ai Gemini 3.1 Flash TTS
 * Creates task, polls for completion, returns audio buffer (WAV)
 */
export async function generateTTS(params: KieAITTSParams): Promise<ArrayBuffer> {
    const deadline = Date.now()
        + (params.timeoutMs ?? CREATE_TIMEOUT_MS + ENGINE_LIMITS.gemini.pollTimeoutMs + DOWNLOAD_TIMEOUT_MS)

    // 1. Create the task
    const taskId = await createTask(params, deadline)

    // 2. Poll for completion and get audio URL
    const audioUrl = await pollTaskStatus(taskId, deadline)

    // 3. Download the audio
    const audioResponse = await fetch(audioUrl, { signal: AbortSignal.timeout(timeLeft(deadline, DOWNLOAD_TIMEOUT_MS)) })
    if (!audioResponse.ok) {
        throw new EngineError('gemini', `Kie.ai audio download failed (HTTP ${audioResponse.status})`, {
            status: audioResponse.status, phase: 'download',
        })
    }

    const audioBuffer = await audioResponse.arrayBuffer()

    if (!audioBuffer || audioBuffer.byteLength === 0) {
        throw new EngineError('gemini', 'Kie.ai returned empty audio', { phase: 'download' })
    }

    return audioBuffer
}

/**
 * Generate a short preview for a voice
 */
export async function generateVoicePreview(voiceName: string): Promise<ArrayBuffer> {
    const previewTexts = [
        "Welcome to your voice preview. This is how I sound when speaking naturally.",
        "Hello there! I'm excited to be your voice today. Let me show you what I can do.",
        "Hi, thanks for checking out my voice. I hope you enjoy what you hear.",
    ]

    const text = previewTexts[Math.floor(Math.random() * previewTexts.length)]

    return generateTTS({
        text,
        voice: voiceName,
        voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 1.0,
            style: 0,
        },
    })
}

// Export for backward compatibility
export function getApiKey(): string {
    const key = process.env.KIEAI_API_KEY
    if (!key) {
        throw new Error('Missing KIEAI_API_KEY environment variable')
    }
    return key
}
