// ===========================================
// KIE.AI TTS API CLIENT
// ElevenLabs TTS v2.5 via Kie.ai
// Uses async task creation + polling
// ===========================================

export const KIEAI_BASE_URL = 'https://api.kie.ai/api/v1'

// Voice settings interface matching ElevenLabs parameters
export interface KieAIVoiceSettings {
    stability?: number        // 0.0-1.0, default 0.5
    similarity_boost?: number // 0.0-1.0, default 0.75
    style?: number           // 0.0-1.0, default 0
    speed?: number           // 0.7-1.2, default 1.0
}

export interface KieAITTSParams {
    text: string
    voice: string  // Voice name like "Rachel", "Josh", etc.
    voice_settings?: KieAIVoiceSettings
    language_code?: string  // Optional language override
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

/**
 * Create a TTS task on Kie.ai
 */
async function createTask(params: KieAITTSParams): Promise<string> {
    const apiKey = process.env.KIEAI_API_KEY
    if (!apiKey) {
        throw new Error('Missing KIEAI_API_KEY environment variable')
    }

    const settings = params.voice_settings || {}

    const requestBody = {
        model: 'elevenlabs/text-to-speech-turbo-2-5',
        input: {
            text: params.text,
            voice: params.voice,
            stability: settings.stability ?? 0.5,
            similarity_boost: settings.similarity_boost ?? 0.75,
            style: settings.style ?? 0,
            speed: settings.speed ?? 1.0,
            ...(params.language_code && { language_code: params.language_code }),
        },
    }

    console.log('[Kie.ai] Creating task — voice:', requestBody.input.voice, '| text length:', requestBody.input.text.length)

    const response = await fetch(`${KIEAI_BASE_URL}/jobs/createTask`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
        const errorText = await response.text()
        console.error('[Kie.ai] Create Task HTTP Error:', response.status, errorText)
        throw new Error(`Kie.ai task creation failed (HTTP ${response.status}): ${errorText}`)
    }

    const result: CreateTaskResponse = await response.json()
    console.log('[Kie.ai] Create Task Response:', JSON.stringify(result))

    if (result.code !== 200 || !result.data?.taskId) {
        throw new Error(`Kie.ai task creation failed: ${result.msg || JSON.stringify(result)}`)
    }

    return result.data.taskId
}

/**
 * Poll for task completion
 */
async function pollTaskStatus(taskId: string): Promise<string> {
    const apiKey = process.env.KIEAI_API_KEY
    if (!apiKey) {
        throw new Error('Missing KIEAI_API_KEY environment variable')
    }

    const maxAttempts = 25 // 25 attempts * 2 seconds = 50 seconds max (fits within Vercel 60s limit)
    const pollInterval = 2000 // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const response = await fetch(
            `${KIEAI_BASE_URL}/jobs/recordInfo?taskId=${taskId}`,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
            }
        )

        if (!response.ok) {
            console.error('Kie.ai Poll Error:', response.status)
            throw new Error(`Failed to poll task status: ${response.status}`)
        }

        const result: TaskStatusResponse = await response.json()

        if (result.code !== 200) {
            console.error('[Kie.ai] Poll non-200 code:', JSON.stringify(result))
            throw new Error(`Task polling failed: ${result.msg}`)
        }

        const { state, resultJson, failMsg, failCode } = result.data
        console.log(`[Kie.ai] Poll attempt ${attempt + 1} — state: ${state}`)

        if (state === 'success' && resultJson) {
            // Parse the result to get audio URL
            const parsed: ResultJson = JSON.parse(resultJson)
            if (parsed.resultUrls && parsed.resultUrls.length > 0) {
                console.log('[Kie.ai] Success! Audio URL received')
                return parsed.resultUrls[0]
            }
            throw new Error('No audio URL in result')
        }

        if (state === 'fail') {
            console.error('[Kie.ai] Task failed:', failCode, failMsg)
            throw new Error(`TTS generation failed: ${failMsg || failCode || 'Unknown error'}`)
        }

        // Still processing, wait and poll again
        await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error('TTS generation timed out after 50 seconds')
}

/**
 * Generate TTS audio using Kie.ai ElevenLabs API
 * Creates task, polls for completion, returns audio buffer
 */
export async function generateTTS(params: KieAITTSParams): Promise<ArrayBuffer> {
    // 1. Create the task
    const taskId = await createTask(params)

    // 2. Poll for completion and get audio URL
    const audioUrl = await pollTaskStatus(taskId)

    // 3. Download the audio
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status}`)
    }

    const audioBuffer = await audioResponse.arrayBuffer()

    if (!audioBuffer || audioBuffer.byteLength === 0) {
        throw new Error('Empty audio response')
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
