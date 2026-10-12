'use client'

import { useState, useCallback, useRef } from 'react'
import { chunkText, TextChunk, ChunkPlan } from '@/lib/text-chunker'
import { getMaxCharsForVoice, getVoiceEngine } from '@/lib/voices-data'
import { updateCreditsOptimistic } from '@/hooks/useUserProfile'
import { SCRIPT_TO_VOICE_MAX_PARTS } from '@/lib/constants'

/** Explain why a script is too long to join, with advice that fits the chosen voice. */
export function tooManyPartsMessage(parts: number, voiceId: string, voiceName?: string): string {
    const who = voiceName || 'this voice'
    const base = `With ${who} this script needs ${parts} parts, and the most we can join into one file `
        + `is ${SCRIPT_TO_VOICE_MAX_PARTS}.`
    // Gemini parts are short (400 characters); Fish and Smallest take 1,500-2,000.
    return getVoiceEngine(voiceId) === 'gemini'
        ? `${base} Pick a Fish Audio or Smallest voice, which take longer parts, or split the script in two.`
        : `${base} Split the script into two or more parts and generate each one separately.`
}

// ===========================================
// BATCH TTS GENERATION HOOK
// Client-side orchestrator: chunks text, generates sequentially,
// stitches into single audio file, tracks progress.
// ===========================================

export type BatchStatus = 'idle' | 'chunking' | 'generating' | 'stitching' | 'complete' | 'error' | 'cancelled'

// Transient failures (network blips, cold starts, brief rate limits) used to
// destroy an entire multi-chunk voiceover. Retry before surrendering the run.
const CHUNK_MAX_ATTEMPTS = 3
const CHUNK_RETRY_DELAYS_MS = [1500, 4000]
// All voice slots busy: the server already retried, so give slots time to free.
const CAPACITY_RETRY_DELAYS_MS = [6000, 12000]

// Failures that another attempt cannot fix: retrying only wastes the user's time.
const NO_RETRY_STATUS = new Set([400, 401, 402, 403, 404, 413, 422, 429])
const NO_RETRY_CODES = new Set([
    'out_of_funds', 'auth', 'rejected_input', 'insufficient_credits', 'text_too_long',
    'rate_limited', 'auth_required', 'profile_missing', 'bad_request',
])

/** A part that failed, with what the server said about it. */
class ChunkError extends Error {
    status?: number
    code?: string
    /** Present only when the server charged the part: the credits it returned. */
    refunded?: number
    constructor(message: string, status?: number, code?: string, refunded?: number) {
        super(message)
        this.status = status
        this.code = code
        this.refunded = refunded
    }
}

export interface ChunkResult {
    index: number
    audioUrl: string | null
    status: 'pending' | 'generating' | 'complete' | 'failed' | 'skipped'
    error?: string
    creditsUsed?: number
    /** For a failed part: credits the server confirmed it returned (0 if it was never charged or the refund failed). */
    refunded?: number
    /** For a failed part: true when the server charged it but could not refund it. */
    refundFailed?: boolean
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
    // Set when the run stopped early but usable audio was still produced.
    // The audio in finalAudioUrl covers the script UP TO this point.
    partial: { chunkNumber: number; totalChunks: number; message: string; refundFailed?: boolean } | null
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
        partial: null,
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
            partial: null,
        })
    }, [])

    const cancel = useCallback(() => {
        abortRef.current = true
        setProgress(prev => ({ ...prev, status: 'cancelled' }))
    }, [])

    /**
     * Get chunk plan without generating — for previewing cost/chunks
     */
    const getChunkPlan = useCallback((text: string, voiceId?: string): ChunkPlan => {
        // Chunk to the CEILING OF THE CHOSEN VOICE'S ENGINE. A flat limit was
        // the root cause of silent truncation: Gemini cannot reliably speak
        // the 1800-char chunks the old chunker produced.
        return chunkText(text, voiceId ? getMaxCharsForVoice(voiceId) : undefined)
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
            // The full sentence first: it says what went wrong and whether the
            // part was charged. The short label used to win and hid that.
            throw new ChunkError(
                errData.message || errData.error
                    || (response.status === 504 || response.status === 502
                        ? 'The voice engine took too long to answer'
                        : `Generation failed (${response.status})`),
                response.status,
                errData.code,
                typeof errData.refunded === 'number' ? errData.refunded : undefined,
            )
        }

        const data = await response.json()
        if (!data.success || !data.audioUrl) {
            throw new ChunkError(data.message || data.error || 'No audio was returned', response.status, data.code)
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
        setProgress(prev => ({ ...prev, status: 'chunking', error: null, finalAudioUrl: null, partial: null }))
        const plan = chunkText(fullText, getMaxCharsForVoice(voiceId))

        // Refuse before anything is charged: the stitch step cannot join more
        // parts than this, and every part would already have been paid for.
        if (plan.chunks.length > SCRIPT_TO_VOICE_MAX_PARTS) {
            setProgress(prev => ({
                ...prev,
                status: 'error',
                totalChunks: plan.chunks.length,
                completedChunks: 0,
                chunkResults: [],
                totalCreditsUsed: 0,
                error: `${tooManyPartsMessage(plan.chunks.length, voiceId, voiceName)} Nothing was charged.`,
            }))
            return null
        }

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
        let partialFailure: { chunkNumber: number; totalChunks: number; message: string; refundFailed?: boolean } | null = null
        // What to say about the failed part's credits, given what the server confirmed.
        const failedPartNote = () => partialFailure?.refundFailed
            ? 'The part that failed could not be refunded automatically; our team has been alerted and will restore those credits.'
            : 'Nothing was charged for the parts that failed.'
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
                // Retry transient failures before giving up on the run.
                // A single blip used to destroy an entire multi-chunk voiceover.
                let result: Awaited<ReturnType<typeof generateChunk>> | null = null
                let lastErr: unknown = null
                for (let attempt = 0; attempt < CHUNK_MAX_ATTEMPTS; attempt++) {
                    if (attempt > 0) {
                        const busy = lastErr instanceof ChunkError && lastErr.code === 'capacity'
                        const delays = busy ? CAPACITY_RETRY_DELAYS_MS : CHUNK_RETRY_DELAYS_MS
                        await new Promise(r => setTimeout(r, delays[attempt - 1]))
                        setProgress(prev => ({
                            ...prev,
                            error: `Part ${chunk.index + 1} failed, retrying (${attempt}/${CHUNK_MAX_ATTEMPTS - 1})...`,
                        }))
                    }
                    try {
                        result = await generateChunk({
                            text: chunk.text,
                            voiceId,
                            voiceName,
                            settings: voiceSettings,
                        })
                        lastErr = null
                        break
                    } catch (e) {
                        lastErr = e
                        // A refused request (out of credits, voice down, text too
                        // long, rate limited) will not succeed on retry.
                        if (e instanceof ChunkError
                            && (NO_RETRY_STATUS.has(e.status ?? 0) || NO_RETRY_CODES.has(e.code ?? ''))) break
                    }
                }
                if (!result) throw lastErr instanceof Error ? lastErr : new Error('Chunk generation failed')
                setProgress(prev => ({ ...prev, error: null }))

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
                const refunded = err instanceof ChunkError ? err.refunded : undefined
                results[chunk.index] = {
                    ...results[chunk.index],
                    status: 'failed',
                    error: errorMsg,
                    // Only a charged failure carries `refunded`; refusals before
                    // charging (out of credits, rate limit...) cost nothing.
                    refunded: refunded ?? 0,
                    refundFailed: refunded === 0,
                }

                // Mark remaining chunks as skipped
                for (let i = chunk.index + 1; i < results.length; i++) {
                    results[i] = { ...results[i], status: 'skipped' }
                }

                setProgress(prev => ({
                    ...prev,
                    chunkResults: [...results],
                    totalCreditsUsed,
                }))

                // DO NOT discard the work already paid for. Everything before
                // this chunk generated and was charged; stitch and deliver it,
                // clearly labelled as partial, instead of losing the lot.
                partialFailure = {
                    chunkNumber: chunk.index + 1,
                    totalChunks: plan.chunks.length,
                    message: errorMsg,
                    refundFailed: refunded === 0,
                }
                break
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
                error: partialFailure
                    ? `Generation failed on part 1 of ${partialFailure.totalChunks}: ${partialFailure.message}`
                    : 'No audio chunks generated',
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
                partial: partialFailure,
                error: partialFailure
                    ? `Stopped at part ${partialFailure.chunkNumber} of ${partialFailure.totalChunks}. `
                      + `The audio below covers your script up to that point. `
                      + failedPartNote()
                    : null,
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
                partial: partialFailure,
                error: partialFailure
                    ? `Stopped at part ${partialFailure.chunkNumber} of ${partialFailure.totalChunks}. `
                      + `The audio below covers your script up to that point. `
                      + failedPartNote()
                    : null,
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
