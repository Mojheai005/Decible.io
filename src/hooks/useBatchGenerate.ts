'use client'

import { useState, useCallback, useRef } from 'react'
import { chunkText, TextChunk, ChunkPlan } from '@/lib/text-chunker'
import { getMaxCharsForVoice } from '@/lib/voices-data'
import { updateCreditsOptimistic } from '@/hooks/useUserProfile'
import { scriptLimitMessage } from '@/lib/script-to-voice'

// ===========================================
// BATCH TTS GENERATION HOOK
// Client-side orchestrator: chunks text, generates sequentially,
// stitches into single audio file, tracks progress.
//
// A run is kept after it ends. Every part is charged as it is made, so a
// failed join is retried with the saved parts (joinAgain) and a run that
// stopped early continues from the first missing part (continueRun). The
// old "Try Again" started over and charged every part a second time.
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

/** The join failed. Code 'too_large' means joining again cannot help. */
class JoinError extends Error {
    code?: string
    constructor(message: string, code?: string) {
        super(message)
        this.code = code
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

type PartialInfo = { chunkNumber: number; totalChunks: number; message: string; refundFailed?: boolean }

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
    partial: PartialInfo | null
    /** Every part made so far is saved but joining them failed: joinAgain() retries with no new charges. */
    joinRetryable: boolean
    /** The run stopped before the end: continueRun() makes only the parts still missing, from this index. */
    resumeFrom: number | null
}

const IDLE: BatchProgress = {
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
    joinRetryable: false,
    resumeFrom: null,
}

interface VoiceSettings {
    stability: number
    similarity_boost: number
    style: number
    speed: number
    use_speaker_boost: boolean
}

interface GenerateChunkParams {
    text: string
    voiceId: string
    voiceName: string
    settings: VoiceSettings
    /** Which run and part this is, so the server can join the run if the page cannot. */
    scriptRun: { id: string; part: number; total: number }
}

/** One script's run, kept so it can be joined again or continued. */
interface Run {
    /** Sent with every part; the server joins a finished run by this id even if the page is gone. */
    id: string
    chunks: TextChunk[]
    voiceId: string
    voiceName: string
    settings: VoiceSettings
    results: ChunkResult[]
    creditsUsed: number
    lastFailure: PartialInfo | null
    lastAborted: boolean
}

/** A UUID for a new run. */
function newRunId(): string {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
    if (c?.randomUUID) return c.randomUUID()
    const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** What to tell the user about audio that covers only part of the script. */
function partialNote(p: PartialInfo, aborted: boolean): string {
    const charged = aborted
        ? ''
        : p.refundFailed
            ? ' The part that failed could not be refunded automatically; our team has been alerted and will restore those credits.'
            : ' Nothing was charged for the parts that failed.'
    return `Stopped at part ${p.chunkNumber} of ${p.totalChunks}. The audio below covers your script up to that point.${charged}`
        + ' Press Continue to make the rest: you only pay for the parts still missing.'
}

export function useBatchGenerate() {
    const [progress, setProgress] = useState<BatchProgress>(IDLE)

    const abortRef = useRef(false)
    const chunkTimesRef = useRef<number[]>([])
    const runRef = useRef<Run | null>(null)

    const resetProgress = useCallback(() => {
        abortRef.current = false
        chunkTimesRef.current = []
        runRef.current = null
        setProgress(IDLE)
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
                script_run: params.scriptRun,
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
    const stitchAudio = async (audioUrls: string[], voiceName: string, runId: string): Promise<string> => {
        const response = await fetch('/api/script-to-voice/stitch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioUrls, voiceName, runId }),
        })

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new JoinError(errData.error || 'Failed to stitch audio', errData.code)
        }

        const data = await response.json()
        if (!data.success || !data.audioUrl) {
            throw new JoinError('No stitched audio URL returned')
        }

        return data.audioUrl
    }

    /** Generate every part of the run that is not made yet, from `from` on. */
    const runParts = async (run: Run, from: number): Promise<void> => {
        abortRef.current = false
        chunkTimesRef.current = []
        const total = run.chunks.length
        const made = () => run.results.filter(r => r.status === 'complete').length

        // Parts not made yet start again from pending (a continued run).
        run.results = run.results.map(r => r.status === 'complete' ? r : { index: r.index, audioUrl: null, status: 'pending' as const })
        run.lastFailure = null
        run.lastAborted = false
        setProgress(prev => ({
            ...prev,
            status: 'generating',
            totalChunks: total,
            completedChunks: made(),
            currentChunk: from,
            percentage: Math.round((made() / total) * 90),
            chunkResults: [...run.results],
            totalCreditsUsed: run.creditsUsed,
            estimatedTimeRemaining: null,
            finalAudioUrl: null,
            error: null,
            partial: null,
            joinRetryable: false,
            resumeFrom: null,
        }))

        for (const chunk of run.chunks) {
            if (chunk.index < from || run.results[chunk.index].status === 'complete') continue
            if (abortRef.current) break

            const startTime = Date.now()

            // Mark current chunk as generating
            run.results[chunk.index] = { ...run.results[chunk.index], status: 'generating' }
            setProgress(prev => ({
                ...prev,
                currentChunk: chunk.index,
                chunkResults: [...run.results],
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
                            voiceId: run.voiceId,
                            voiceName: run.voiceName,
                            settings: run.settings,
                            scriptRun: { id: run.id, part: chunk.index, total: run.chunks.length },
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

                run.creditsUsed += result.creditsUsed
                run.results[chunk.index] = {
                    ...run.results[chunk.index],
                    status: 'complete',
                    audioUrl: result.audioUrl,
                    creditsUsed: result.creditsUsed,
                }

                // Track chunk time for ETA calculation
                chunkTimesRef.current.push(Date.now() - startTime)
                const avgTime = chunkTimesRef.current.reduce((a, b) => a + b, 0) / chunkTimesRef.current.length
                const completed = made()
                const eta = Math.round(((total - completed) * avgTime) / 1000)

                setProgress(prev => ({
                    ...prev,
                    completedChunks: completed,
                    percentage: Math.round((completed / total) * 90), // 90% for generation, 10% for stitching
                    chunkResults: [...run.results],
                    totalCreditsUsed: run.creditsUsed,
                    estimatedTimeRemaining: eta > 0 ? eta : null,
                }))

                // Update credits optimistically
                updateCreditsOptimistic(result.creditsRemaining, result.creditsUsed)
                window.dispatchEvent(new CustomEvent('credits-updated', {
                    detail: { remainingCredits: result.creditsRemaining, creditsUsed: result.creditsUsed },
                }))

            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Chunk generation failed'
                const refunded = err instanceof ChunkError ? err.refunded : undefined
                run.results[chunk.index] = {
                    ...run.results[chunk.index],
                    status: 'failed',
                    error: errorMsg,
                    // Only a charged failure carries `refunded`; refusals before
                    // charging (out of credits, rate limit...) cost nothing.
                    refunded: refunded ?? 0,
                    refundFailed: refunded === 0,
                }

                // Parts after this one are not made in this run
                for (let i = chunk.index + 1; i < run.results.length; i++) {
                    if (run.results[i].status !== 'complete') run.results[i] = { ...run.results[i], status: 'skipped' }
                }

                setProgress(prev => ({
                    ...prev,
                    chunkResults: [...run.results],
                    totalCreditsUsed: run.creditsUsed,
                }))

                run.lastFailure = {
                    chunkNumber: chunk.index + 1,
                    totalChunks: total,
                    message: errorMsg,
                    refundFailed: refunded === 0,
                }
                break
            }
        }
        run.lastAborted = abortRef.current && !run.lastFailure
    }

    /**
     * Deliver what the run has: join the parts made so far (all of them, or
     * the script up to the part that failed). Nothing paid for is thrown away.
     */
    const finish = async (run: Run): Promise<string | null> => {
        const total = run.chunks.length
        const firstMissing = run.results.findIndex(r => r.status !== 'complete')
        const resumeFrom = firstMissing === -1 ? null : firstMissing
        const audioUrls = run.results
            .filter(r => r.status === 'complete' && r.audioUrl)
            .map(r => r.audioUrl as string)
        const failure = run.lastFailure

        if (audioUrls.length === 0) {
            setProgress(prev => ({
                ...prev,
                status: run.lastAborted ? 'cancelled' : 'error',
                totalCreditsUsed: run.creditsUsed,
                joinRetryable: false,
                resumeFrom,
                error: run.lastAborted
                    ? null
                    : failure
                        ? `Generation failed on part ${failure.chunkNumber} of ${failure.totalChunks}: ${failure.message}`
                        : 'No audio chunks generated',
            }))
            return null
        }

        const partial: PartialInfo | null = resumeFrom === null
            ? null
            : failure ?? {
                chunkNumber: resumeFrom + 1,
                totalChunks: total,
                message: run.lastAborted ? 'You stopped the run.' : 'The remaining parts were not made.',
            }

        const deliver = (url: string) => {
            setProgress(prev => ({
                ...prev,
                status: 'complete',
                percentage: 100,
                finalAudioUrl: url,
                totalCreditsUsed: run.creditsUsed,
                estimatedTimeRemaining: null,
                partial,
                joinRetryable: false,
                resumeFrom,
                error: partial ? partialNote(partial, run.lastAborted) : null,
            }))
            return url
        }

        // If only one chunk, no need to stitch
        if (audioUrls.length === 1) return deliver(audioUrls[0])

        setProgress(prev => ({ ...prev, status: 'stitching', percentage: 92, error: null }))
        try {
            return deliver(await stitchAudio(audioUrls, run.voiceName, run.id))
        } catch (err) {
            const tooLarge = err instanceof JoinError && err.code === 'too_large'
            const message = err instanceof Error ? err.message : 'Stitch failed'
            setProgress(prev => ({
                ...prev,
                status: 'error',
                totalCreditsUsed: run.creditsUsed,
                joinRetryable: !tooLarge,
                resumeFrom,
                error: tooLarge
                    ? message
                    : `Joining the parts into one file failed (${message}). Every part is saved: `
                      + 'press Join again to retry. You will not be charged again.',
            }))
            return null
        }
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
        setProgress({ ...IDLE, status: 'chunking' })
        const plan = chunkText(fullText, getMaxCharsForVoice(voiceId))
        const characters = plan.chunks.reduce((sum, c) => sum + c.charCount, 0)

        // Refuse before anything is charged: a script the join step cannot
        // turn into one file used to be generated and paid for first.
        const tooLong = scriptLimitMessage({ parts: plan.chunks.length, characters, voiceId, voiceName, speed: settings.speed })
        if (tooLong) {
            runRef.current = null
            setProgress({ ...IDLE, status: 'error', totalChunks: plan.chunks.length, error: `${tooLong} Nothing was charged.` })
            return null
        }

        const run: Run = {
            id: newRunId(),
            chunks: plan.chunks,
            voiceId,
            voiceName,
            settings: {
                stability: settings.stability,
                similarity_boost: settings.similarity,
                style: settings.style,
                speed: settings.speed,
                use_speaker_boost: settings.useSpeakerBoost,
            },
            results: plan.chunks.map(c => ({ index: c.index, audioUrl: null, status: 'pending' as const })),
            creditsUsed: 0,
            lastFailure: null,
            lastAborted: false,
        }
        runRef.current = run

        // Step 2 and 3
        await runParts(run, 0)
        return finish(run)
    }, [])

    /** Make only the parts of the last run that are still missing, then join everything. */
    const continueRun = useCallback(async (): Promise<string | null> => {
        const run = runRef.current
        if (!run) return null
        const from = run.results.findIndex(r => r.status !== 'complete')
        if (from !== -1) await runParts(run, from)
        return finish(run)
    }, [])

    /** Join the saved parts of the last run again. Generates and charges nothing. */
    const joinAgain = useCallback(async (): Promise<string | null> => {
        const run = runRef.current
        if (!run) return null
        return finish(run)
    }, [])

    return {
        progress,
        generateBatch,
        getChunkPlan,
        cancel,
        resetProgress,
        continueRun,
        joinAgain,
    }
}
