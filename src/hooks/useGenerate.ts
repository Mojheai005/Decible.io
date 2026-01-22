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
    settings?: GenerateSettings
}

interface GenerationResult {
    success: boolean
    audioUrl?: string
    taskId?: string
    usage?: {
        characters: number
    }
    error?: string
    // Legacy support for TextToSpeech.tsx check
    result?: {
        audioUrl: string
    }
}

interface UseGenerateResult {
    generate: (params: GenerateParams) => Promise<GenerationResult | null>
    isGenerating: boolean
    error: string | null
    result: GenerationResult | null
    audioUrl: string | null
}

export function useGenerate(): UseGenerateResult {
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<GenerationResult | null>(null)
    const [audioUrl, setAudioUrl] = useState<string | null>(null)

    const generate = useCallback(async (params: GenerateParams): Promise<GenerationResult | null> => {
        setIsGenerating(true)
        setError(null)
        setResult(null)
        setAudioUrl(null)

        try {
            // Updated to use the new DubVoice /api/tts endpoint
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: params.text,
                    voice_id: params.voiceId, // Map voiceId to voice_id
                    voice_settings: {
                        stability: params.settings?.stability ?? 0.5,
                        similarity_boost: params.settings?.similarity ?? 0.75,
                        style: params.settings?.style ?? 0,
                        speed: params.settings?.speed ?? 1.0,
                        use_speaker_boost: params.settings?.useSpeakerBoost ?? true,
                    }
                }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Generation failed: ${response.status}`)
            }

            const data: GenerationResult = await response.json()

            // Map flat audioUrl to the nested structure TextToSpeech expects to avoid breaking changes there
            // OR we fix usage in TextToSpeech. Let's do both for safety.
            const standardizedResult = {
                ...data,
                result: {
                    audioUrl: data.audioUrl || ''
                }
            }

            setResult(standardizedResult)

            if (data.audioUrl) {
                setAudioUrl(data.audioUrl)
            }

            return standardizedResult
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Generation failed'
            setError(errorMessage)
            console.error('Generation error:', err)
            return null
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
