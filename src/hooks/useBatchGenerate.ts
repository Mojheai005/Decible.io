'use client'

import { useState, useCallback, useRef } from 'react'
import { chunkText, TextChunk, ChunkPlan } from '@/lib/text-chunker'
import { updateCreditsOptimistic } from '@/hooks/useUserProfile'

// ===========================================
// BATCH TTS GENERATION HOOK
// Client-side orchestrator: chunks text, generates sequentially,
// stitches into single audio file, tracks progress.
// ===========================================

export type BatchStatus = 'idle' | 'chunking' | 'generating' | 'stitching' | 'complete' | 'error' | 'cancelled'

export interface ChunkResult {
    index: number
    audioUrl: string | null
    status: 'pending' | 'generating' | 'complete' | 'failed' | 'skipped'
    error?: string
    creditsUsed?: number
}

export interface BatchProgress {
    status: BatchStatus
    totalChunks: number
    completedChunks: number
    currentChunk: number
    percentage: number
    chunkResults: ChunkResult[]
    totalCreditsUsed: number
    estimatedTimeRemaining: number | null
    finalAudioUrl: string | null
    error: string | null
}

interface GenerateChunkParams {
    text: string
    voiceId: string
    voiceName: string
    settings: {
        stability: number
        similarity_boost: number
        style: number
        speed: number
        use_speaker_boost: boolean
    }
}

export function useBatchGenerate() {
    const [progress, setProgress] = useState<BatchProgress>({
        status: 'idle',
        totalChunks: 0,
        completedChunks: 0,
        currentChunk: 0,
        percentage: 0,
        chunkResults: [],
        totalCreditsUsed: 0,
        estimatedTimeRemaining: null,
        finalAudioUrl: null,
        error: null,
    })

    const abortRef = useRef(false)
    const chunkTimesRef = useRef<number[]>([])

    const resetProgress = useCallback(() => {
        abortRef.current = false
        chunkTimesRef.current = []
        setProgress({
            status: 'idle',
            totalChunks: 0,
            completedChunks: 0,
            currentChunk: 0,
            percentage: 0,
            chunkResults: [],
            totalCreditsUsed: 0,
            estimatedTimeRemaining: null,
            finalAudioUrl: null,
            error: null,
        })
    }, [])

    const cancel = useCallback(() => {
        abortRef.current = true
        setProgress(prev => ({ ...prev, status: 'cancelled' }))
    }, [])

    /**
     * Get chunk plan without generating — for previewing cost/chunks
     */
    const getChunkPlan = useCallback((text: string): ChunkPlan => {
        return chunkText(text)
    }, [])

    /**
     * Generate a single chunk via /api/tts
     */
    const generateChunk = async (params: GenerateChunkParams): Promise<{
        audioUrl: string
        creditsUsed: number
        creditsRemaining: number
    }> => {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: params.text,
                voice_id: params.voiceId,
                voice_name: params.voiceName,
                voice_settings: params.settings,
            }),
        })

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.error || errData.message || `Generation failed: ${response.status}`)
        }

        const data = await response.json()
        if (!data.success || !data.audioUrl) {
            throw new Error(data.error || 'No audio URL returned')
        }

        return {
            audioUrl: data.audioUrl,
            creditsUsed: data.usage?.creditsUsed ?? 0,
            creditsRemaining: data.usage?.creditsRemaining ?? 0,
        }
    }

    /**
     * Stitch all audio chunks into one file
     */
    const stitchAudio = async (audioUrls: string[], voiceName: string): Promise<string> => {
        const response = await fetch('/api/script-to-voice/stitch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioUrls, voiceName }),
        })

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.error || 'Failed to stitch audio')
        }

        const data = await response.json()
        if (!data.success || !data.audioUrl) {
            throw new Error('No stitched audio URL returned')
        }

        return data.audioUrl
    }

    /**
     * Main batch generation flow:
     * 1. Chunk text
     * 2. Generate each chunk sequentially
     * 3. Stitch into single audio file
     */
    const generateBatch = useCallback(async (
        fullText: string,
        voiceId: string,
        voiceName: string,
        settings: {
            stability: number
            similarity: number
            style: number
            speed: number
            useSpeakerBoost: boolean
        }
    ): Promise<string | null> => {
        abortRef.current = false
        chunkTimesRef.current = []

        // Step 1: Chunk text
        setProgress(prev => ({ ...prev, status: 'chunking', error: null, finalAudioUrl: null }))
        const plan = chunkText(fullText)

        const initialResults: ChunkResult[] = plan.chunks.map(c => ({
            index: c.index,
            audioUrl: null,
            status: 'pending' as const,
        }))

        setProgress(prev => ({
            ...prev,
            status: 'generating',
            totalChunks: plan.chunks.length,
            completedChunks: 0,
            currentChunk: 0,
            percentage: 0,
            chunkResults: initialResults,
        }))

        const voiceSettings = {
            stability: settings.stability,
            similarity_boost: settings.similarity,
            style: settings.style,
            speed: settings.speed,
            use_speaker_boost: settings.useSpeakerBoost,
        }

        // Step 2: Generate each chunk sequentially
        let totalCreditsUsed = 0
        let latestCreditsRemaining = 0
        const results = [...initialResults]

        for (const chunk of plan.chunks) {
            if (abortRef.current) break

            const startTime = Date.now()

            // Mark current chunk as generating
            results[chunk.index] = { ...results[chunk.index], status: 'generating' }
            setProgress(prev => ({
                ...prev,
                currentChunk: chunk.index,
                chunkResults: [...results],
            }))

            try {
                const result = await generateChunk({
                    text: chunk.text,
                    voiceId,
                    voiceName,
                    settings: voiceSettings,
                })

                totalCreditsUsed += result.creditsUsed
                latestCreditsRemaining = result.creditsRemaining

                results[chunk.index] = {
                    ...results[chunk.index],
                    status: 'complete',
                    audioUrl: result.audioUrl,
                    creditsUsed: result.creditsUsed,
                }

                // Track chunk time for ETA calculation
                const elapsed = Date.now() - startTime
                chunkTimesRef.current.push(elapsed)
                const avgTime = chunkTimesRef.current.reduce((a, b) => a + b, 0) / chunkTimesRef.current.length
                const remaining = plan.chunks.length - (chunk.index + 1)
                const eta = Math.round((remaining * avgTime) / 1000)

                const completed = chunk.index + 1
                setProgress(prev => ({
                    ...prev,
                    completedChunks: completed,
                    percentage: Math.round((completed / plan.chunks.length) * 90), // 90% for generation, 10% for stitching
                    chunkResults: [...results],
                    totalCreditsUsed,
                    estimatedTimeRemaining: eta > 0 ? eta : null,
                }))

                // Update credits optimistically
                updateCreditsOptimistic(latestCreditsRemaining, result.creditsUsed)
                window.dispatchEvent(new CustomEvent('credits-updated', {
                    detail: { remainingCredits: latestCreditsRemaining, creditsUsed: result.creditsUsed },
                }))

            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Chunk generation failed'
                results[chunk.index] = {
                    ...results[chunk.index],
                    status: 'failed',
                    error: errorMsg,
                }

                // Mark remaining chunks as skipped
                for (let i = chunk.index + 1; i < results.length; i++) {
                    results[i] = { ...results[i], status: 'skipped' }
                }

                setProgress(prev => ({
                    ...prev,
                    status: 'error',
                    chunkResults: [...results],
                    totalCreditsUsed,
                    error: `Chunk ${chunk.index + 1} failed: ${errorMsg}`,
                }))

                return null
            }
        }

        if (abortRef.current) {
            setProgress(prev => ({ ...prev, status: 'cancelled', totalCreditsUsed }))
            return null
        }

        // Step 3: Stitch audio chunks
        setProgress(prev => ({ ...prev, status: 'stitching', percentage: 92 }))

        const audioUrls = results
            .filter(r => r.status === 'complete' && r.audioUrl)
            .map(r => r.audioUrl as string)

        if (audioUrls.length === 0) {
            setProgress(prev => ({
                ...prev,
                status: 'error',
                error: 'No audio chunks generated',
            }))
            return null
        }

        // If only one chunk, no need to stitch
        if (audioUrls.length === 1) {
            setProgress(prev => ({
                ...prev,
                status: 'complete',
                percentage: 100,
                finalAudioUrl: audioUrls[0],
                totalCreditsUsed,
                estimatedTimeRemaining: null,
            }))
            return audioUrls[0]
        }

        try {
            const finalUrl = await stitchAudio(audioUrls, voiceName)

            setProgress(prev => ({
                ...prev,
                status: 'complete',
                percentage: 100,
                finalAudioUrl: finalUrl,
                totalCreditsUsed,
                estimatedTimeRemaining: null,
            }))

            return finalUrl
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Stitch failed'
            setProgress(prev => ({
                ...prev,
                status: 'error',
                error: `Stitching failed: ${errorMsg}`,
                totalCreditsUsed,
            }))
            return null
        }
    }, [])

    return {
        progress,
        generateBatch,
        getChunkPlan,
        cancel,
        resetProgress,
    }
}
