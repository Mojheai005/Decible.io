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
        state: 'pending' | 'processing' | 'success' | 'failed'
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
        console.error('Kie.ai Create Task Error:', response.status, errorText)
        throw new Error(`Kie.ai task creation failed: ${response.status}`)
    }

    const result: CreateTaskResponse = await response.json()

    if (result.code !== 200 || !result.data?.taskId) {
        throw new Error(`Kie.ai task creation failed: ${result.msg}`)
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

    const maxAttempts = 60 // 60 attempts * 2 seconds = 2 minutes max
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
            throw new Error(`Task polling failed: ${result.msg}`)
        }

        const { state, resultJson, failMsg } = result.data

        if (state === 'success' && resultJson) {
            // Parse the result to get audio URL
            const parsed: ResultJson = JSON.parse(resultJson)
            if (parsed.resultUrls && parsed.resultUrls.length > 0) {
                return parsed.resultUrls[0]
            }
            throw new Error('No audio URL in result')
        }

        if (state === 'failed') {
            throw new Error(`TTS generation failed: ${failMsg || 'Unknown error'}`)
        }

        // Still processing, wait and poll again
        await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error('TTS generation timed out after 2 minutes')
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
