// ===========================================
// DUBVOICE API CLIENT
// Centralized client with optional key rotation
// ===========================================

import { API_CONFIG } from './constants'

const DUBVOICE_BASE_URL = API_CONFIG.DUBVOICE_BASE_URL

// Support multiple API keys for rotation (comma-separated in env)
const getApiKeys = (): string[] => {
    const keys = process.env.DUBVOICE_API_KEYS?.split(',').map(k => k.trim()).filter(Boolean)
    if (keys && keys.length > 0) return keys
    const singleKey = process.env.DUBVOICE_API_KEY
    return singleKey ? [singleKey] : []
}

let currentKeyIndex = 0

export function getNextApiKey(): string {
    const keys = getApiKeys()
    if (keys.length === 0) {
        throw new Error('No DubVoice API key configured')
    }
    const key = keys[currentKeyIndex]
    currentKeyIndex = (currentKeyIndex + 1) % keys.length
    return key
}

export function getCurrentApiKey(): string {
    const keys = getApiKeys()
    if (keys.length === 0) {
        throw new Error('No DubVoice API key configured')
    }
    return keys[currentKeyIndex % keys.length]
}

// Types
export interface DubVoiceVoice {
    voice_id: string
    name: string
    category?: string
    description?: string
    gender?: string
    accent?: string
    language?: string
    preview_url?: string
}

export interface DubVoiceTTSParams {
    text: string
    voice_id: string
    model_id?: string
    voice_settings?: {
        stability?: number
        similarity_boost?: number
        speed?: number
        style?: number
        use_speaker_boost?: boolean
    }
}

export interface DubVoiceTTSResponse {
    task_id: string
    status: 'pending' | 'completed' | 'failed'
    result?: string
    characters?: number
    error?: string
}

export interface DubVoiceProfile {
    email: string
    credits: number
    total_used: number
}

// API Methods
export async function fetchVoices(page = 1, pageSize = 100): Promise<{
    voices: DubVoiceVoice[]
    total: number
    has_more: boolean
}> {
    const apiKey = getNextApiKey()

    const response = await fetch(
        `${DUBVOICE_BASE_URL}/voices?page=${page}&page_size=${pageSize}`,
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        }
    )

    if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`)
    }

    return response.json()
}

export async function submitTTS(params: DubVoiceTTSParams): Promise<{ task_id: string }> {
    const apiKey = getNextApiKey()

    const response = await fetch(`${DUBVOICE_BASE_URL}/tts`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: params.text,
            voice_id: params.voice_id,
            model_id: params.model_id || 'eleven_multilingual_v2',
            voice_settings: {
                stability: params.voice_settings?.stability ?? 0.5,
                similarity_boost: params.voice_settings?.similarity_boost ?? 0.75,
                speed: params.voice_settings?.speed ?? 1.0,
                style: params.voice_settings?.style ?? 0,
                use_speaker_boost: params.voice_settings?.use_speaker_boost ?? true,
            },
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`TTS submission failed: ${error}`)
    }

    return response.json()
}

export async function pollTTSStatus(taskId: string): Promise<DubVoiceTTSResponse> {
    const apiKey = getCurrentApiKey() // Use same key for polling

    const response = await fetch(`${DUBVOICE_BASE_URL}/tts/${taskId}`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    })

    if (!response.ok) {
        throw new Error(`Failed to poll TTS status: ${response.status}`)
    }

    return response.json()
}

export async function generateTTSWithPolling(
    params: DubVoiceTTSParams,
    onProgress?: (status: string) => void
): Promise<DubVoiceTTSResponse> {
    // Submit the TTS request
    const { task_id } = await submitTTS(params)
    onProgress?.('processing')

    // Poll for completion
    const maxAttempts = API_CONFIG.MAX_POLL_ATTEMPTS
    const pollInterval = API_CONFIG.POLL_INTERVAL_MS

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        const status = await pollTTSStatus(task_id)

        if (status.status === 'completed') {
            return status
        }

        if (status.status === 'failed') {
            throw new Error(status.error || 'TTS generation failed')
        }

        onProgress?.(`processing (${attempt + 1}/${maxAttempts})`)
    }

    throw new Error('TTS generation timed out')
}

export async function fetchProfile(): Promise<DubVoiceProfile> {
    const apiKey = getNextApiKey()

    const response = await fetch(`${DUBVOICE_BASE_URL}/me`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        cache: 'no-store',
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`)
    }

    return response.json()
}

export async function fetchHistory(limit = 20): Promise<{
    tasks: Array<{
        task_id: string
        text?: string
        created_at: string
        characters?: number
        result?: string
        status: string
    }>
}> {
    const apiKey = getNextApiKey()

    const response = await fetch(`${DUBVOICE_BASE_URL}/tts?limit=${limit}`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        cache: 'no-store',
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.status}`)
    }

    return response.json()
}
