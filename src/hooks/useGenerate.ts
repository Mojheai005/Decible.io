'use client'

import { useState, useCallback } from 'react'

export interface GenerateSettings {
    stability?: number
    similarity?: number
    style?: number
    speed?: number
    useSpeakerBoost?: boolean
}

interface GenerateParams {
    text: string
    voiceId: string
    voiceName?: string
    settings?: GenerateSettings
}

export interface GenerationResult {
    success: boolean
    audioUrl?: string
    taskId?: string
    usage?: {
        characters: number
        creditsUsed?: number
        creditsRemaining?: number
    }
    // Set when success is false. `message` is the full sentence to show the
    // user; it always says whether they were charged.
    status?: number
    code?: string
    error?: string
    message?: string
    retryAfter?: number
    generationId?: string
    // Legacy support for TextToSpeech.tsx check
    result?: {
        audioUrl: string
    }
}

interface UseGenerateResult {
    /** Always resolves: check `success`, and show `message` when it is false. */
    generate: (params: GenerateParams) => Promise<GenerationResult>
    isGenerating: boolean
    error: string | null
    result: GenerationResult | null
    audioUrl: string | null
}

// What to say when the server gave no usable explanation (a platform error
// page, a dropped connection). These used to all read "Generation failed".
function fallbackMessage(status: number | undefined): string {
    if (status === undefined) {
        return 'The connection dropped before your audio arrived. Check your connection and try again.'
    }
    if (status === 504 || status === 502) {
        return 'The voice engine took too long to answer. Please try again in a moment.'
    }
    if (status === 401) return 'Your session has expired. Please log in again, then retry.'
    if (status === 402) return 'You do not have enough credits for this. Buy more credits or upgrade your plan.'
    if (status === 429) return 'Too many requests right now. Please wait a minute and try again.'
    return 'Generation failed. Please try again.'
}

export function useGenerate(): UseGenerateResult {
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<GenerationResult | null>(null)
    const [audioUrl, setAudioUrl] = useState<string | null>(null)

    const generate = useCallback(async (params: GenerateParams): Promise<GenerationResult> => {
        setIsGenerating(true)
        setError(null)
        setResult(null)
        setAudioUrl(null)

        let status: number | undefined
        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: params.text,
                    voice_id: params.voiceId,
                    voice_name: params.voiceName || 'Unknown Voice',
                    voice_settings: {
                        stability: params.settings?.stability ?? 0.5,
                        similarity_boost: params.settings?.similarity ?? 0.75,
                        style: params.settings?.style ?? 0,
                        speed: params.settings?.speed ?? 1.0,
                        use_speaker_boost: params.settings?.useSpeakerBoost ?? true,
                    }
                }),
            })
            status = response.status

            const data = await response.json().catch(() => ({})) as Partial<GenerationResult>

            if (!response.ok || !data.audioUrl) {
                // Keep the server's explanation. This hook used to throw away
                // every server message, so each failure read "Generation failed".
                const failure: GenerationResult = {
                    success: false,
                    status,
                    code: data.code,
                    error: data.error || `Generation failed (${status})`,
                    message: data.message || fallbackMessage(status),
                    retryAfter: data.retryAfter,
                    generationId: data.generationId,
                }
                setError(failure.message ?? null)
                setResult(failure)
                return failure
            }

            const standardizedResult: GenerationResult = {
                ...data,
                success: true,
                result: { audioUrl: data.audioUrl },
            }
            setResult(standardizedResult)
            setAudioUrl(data.audioUrl)
            return standardizedResult
        } catch (err) {
            const failure: GenerationResult = {
                success: false,
                status,
                code: 'network_error',
                error: err instanceof Error ? err.message : 'Network error',
                message: fallbackMessage(status),
            }
            console.error('Generation error:', err)
            setError(failure.message ?? null)
            setResult(failure)
            return failure
        } finally {
            setIsGenerating(false)
        }
    }, [])

    return {
        generate,
        isGenerating,
        error,
        result,
        audioUrl,
    }
}

/**
 * Alternative hook for streaming TTS (returns audio buffer directly)
 */
export function useGenerateTTS() {
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

    const generate = useCallback(async (params: GenerateParams): Promise<Blob | null> => {
        setIsGenerating(true)
        setError(null)
        setAudioBlob(null)

        try {
            const response = await fetch('/api/generate/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: params.text,
                    voice_id: params.voiceId,
                    settings: {
                        stability: params.settings?.stability,
                        similarity_boost: params.settings?.similarity,
                        style: params.settings?.style,
                        speed: params.settings?.speed,
                        use_speaker_boost: params.settings?.useSpeakerBoost,
                    },
                }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `TTS failed: ${response.status}`)
            }

            const blob = await response.blob()
            setAudioBlob(blob)
            return blob
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'TTS generation failed'
            setError(errorMessage)
            console.error('TTS error:', err)
            return null
        } finally {
            setIsGenerating(false)
        }
    }, [])

    return {
        generate,
        isGenerating,
        error,
        audioBlob,
        audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : null,
    }
}
