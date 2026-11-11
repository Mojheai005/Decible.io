// ===========================================
// SCRIPT TO VOICE: JOIN A RUN'S PARTS INTO ONE FILE
// ===========================================
// WAV (Gemini): parse the RIFF chunks, concatenate the PCM data sections,
//   and write one new header.
// MP3 (Fish, Smallest): frames are self-contained, but each part opens with
//   a frame stating its own length; see lib/mp3-join.
//
// The page used to be the only thing that joined a voiceover, as its very
// last step. If the page was closed, refreshed or lost its connection at that
// moment, every part had been made and paid for and no file was ever made.
// Now every part carries its run's id, the server joins a finished run by
// itself (autoJoinRun), and a run that stopped early can be joined from its
// saved parts at any time. A run's joined file is stored under an id derived
// from the run, so the page and the server joining the same run produce one
// file and one history entry, never two.
// ===========================================

import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TTS_OUTPUT_FORMAT } from './kieai'
import { SCRIPT_TO_VOICE_MAX_PARTS } from './constants'
import { joinMp3Parts } from './mp3-join'
import { logger } from './logger'

const BUCKET = 'audio-generations'
export const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Which run a generated part belongs to, sent by the Script to Voice page. */
export interface ScriptRunTag {
    id: string
    part: number
    total: number
}

/** A valid run tag from a request body, or null. */
export function parseScriptRun(value: unknown): ScriptRunTag | null {
    if (!value || typeof value !== 'object') return null
    const { id, part, total } = value as Record<string, unknown>
    if (typeof id !== 'string' || !RUN_ID_PATTERN.test(id)) return null
    if (!Number.isInteger(part) || !Number.isInteger(total)) return null
    const p = part as number, t = total as number
    if (t < 1 || t > SCRIPT_TO_VOICE_MAX_PARTS || p < 0 || p >= t) return null
    return { id: id.toLowerCase(), part: p, total: t }
}

/** The history id of a run's joined file: the same run and part count always give the same id. */
export function joinIdFor(runId: string, parts: number): string {
    const h = crypto.createHash('sha1').update(`${runId.toLowerCase()}:${parts}`).digest('hex')
    const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export class JoinFailure extends Error {
    constructor(message: string, readonly code: 'too_large' | 'storage' | 'fetch' | 'format' | 'empty', readonly status: number) {
        super(message)
    }
}

export interface JoinedVoiceover {
    id: string | null
    url: string
    parts: number
    totalSize: number
    alreadyJoined: boolean
}

interface WavInfo {
    audioFormat: number
    numChannels: number
    sampleRate: number
    bitsPerSample: number
    data: Buffer
}

function isWav(buffer: Buffer): boolean {
    return buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WAVE'
}

/** Read the fmt chunk and the raw audio data of a WAV file. */
function parseWav(buffer: Buffer, index: number): WavInfo {
    if (!isWav(buffer)) {
        throw new JoinFailure(`Part ${index + 1} is not a valid WAV file`, 'format', 500)
    }

    let fmt: Omit<WavInfo, 'data'> | null = null
    let data: Buffer | null = null
    let offset = 12

    while (offset + 8 <= buffer.length) {
        const chunkId = buffer.toString('ascii', offset, offset + 4)
        const chunkSize = buffer.readUInt32LE(offset + 4)
        const chunkStart = offset + 8

        if (chunkId === 'fmt ') {
            fmt = {
                audioFormat: buffer.readUInt16LE(chunkStart),
                numChannels: buffer.readUInt16LE(chunkStart + 2),
                sampleRate: buffer.readUInt32LE(chunkStart + 4),
                bitsPerSample: buffer.readUInt16LE(chunkStart + 14),
            }
        } else if (chunkId === 'data') {
            data = buffer.subarray(chunkStart, Math.min(chunkStart + chunkSize, buffer.length))
        }

        // Chunks are word-aligned: odd sizes are padded with one byte
        offset = chunkStart + chunkSize + (chunkSize % 2)
    }

    if (!fmt || !data) {
        throw new JoinFailure(`Part ${index + 1}: missing fmt or data section in WAV file`, 'format', 500)
    }

    return { ...fmt, data }
}

/** One PCM WAV from parts that all share a format. */
function concatenateWavs(wavs: WavInfo[]): Buffer {
    const first = wavs[0]
    for (let i = 1; i < wavs.length; i++) {
        const w = wavs[i]
        if (w.audioFormat !== first.audioFormat ||
            w.numChannels !== first.numChannels ||
            w.sampleRate !== first.sampleRate ||
            w.bitsPerSample !== first.bitsPerSample) {
            throw new JoinFailure(`Part ${i + 1} has a different audio format and cannot be joined`, 'format', 500)
        }
    }

    const totalDataSize = wavs.reduce((sum, w) => sum + w.data.length, 0)
    const byteRate = first.sampleRate * first.numChannels * (first.bitsPerSample / 8)
    const blockAlign = first.numChannels * (first.bitsPerSample / 8)

    const header = Buffer.alloc(44)
    header.write('RIFF', 0, 'ascii')
    header.writeUInt32LE(36 + totalDataSize, 4)
    header.write('WAVE', 8, 'ascii')
    header.write('fmt ', 12, 'ascii')
    header.writeUInt32LE(16, 16)                       // fmt chunk size (PCM)
    header.writeUInt16LE(first.audioFormat, 20)
    header.writeUInt16LE(first.numChannels, 22)
    header.writeUInt32LE(first.sampleRate, 24)
    header.writeUInt32LE(byteRate, 28)
    header.writeUInt16LE(blockAlign, 32)
    header.writeUInt16LE(first.bitsPerSample, 34)
    header.write('data', 36, 'ascii')
    header.writeUInt32LE(totalDataSize, 40)

    return Buffer.concat([header, ...wavs.map(w => w.data)])
}

/** The run's joined file if it was already made. */
async function findJoin(admin: SupabaseClient, userId: string, joinId: string): Promise<JoinedVoiceover | null> {
    const { data } = await admin
        .from('generation_history')
        .select('id, audio_url, settings')
        .eq('id', joinId)
        .eq('user_id', userId)
        .maybeSingle()
    if (!data) return null
    const row = data as { id: string; audio_url: string; settings?: { chunks?: number; totalSize?: number } }
    return { id: row.id, url: row.audio_url, parts: row.settings?.chunks ?? 0, totalSize: row.settings?.totalSize ?? 0, alreadyJoined: true }
}

/**
 * A run's saved parts in order, up to the first part that is missing (the
 * script up to where it stopped). If a part was made twice, the newest wins.
 */
export async function loadRunParts(admin: SupabaseClient, userId: string, runId: string): Promise<{ urls: string[]; total: number | null; voiceName: string | null }> {
    const { data, error } = await admin
        .from('generation_history')
        .select('audio_url, voice_name, settings, created_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .eq('settings->scriptRun->>id', runId.toLowerCase())
        .order('created_at', { ascending: true })
        .limit(200)
    if (error) throw new JoinFailure(`Could not read the saved parts: ${error.message}`, 'storage', 500)

    const byPart = new Map<number, string>()
    let total: number | null = null
    let voiceName: string | null = null
    for (const row of (data ?? []) as Array<{ audio_url: string; voice_name: string; settings?: { scriptRun?: ScriptRunTag } }>) {
        const tag = row.settings?.scriptRun
        if (!tag || !row.audio_url) continue
        byPart.set(Number(tag.part), row.audio_url)
        total = Number(tag.total)
        voiceName = row.voice_name
    }
    const urls: string[] = []
    for (let i = 0; byPart.has(i); i++) urls.push(byPart.get(i) as string)
    return { urls, total, voiceName }
}

/**
 * Join parts and store the result as one file with a history entry. With a
 * run id the result is idempotent: joining the same parts again returns the
 * file already made.
 */
export async function joinAndStore(admin: SupabaseClient, opts: {
    userId: string
    audioUrls: string[]
    voiceName?: string | null
    runId?: string | null
    totalParts?: number | null
}): Promise<JoinedVoiceover> {
    const { userId, audioUrls } = opts
    if (!audioUrls.length) throw new JoinFailure('There are no saved parts to join.', 'empty', 400)
    const runId = opts.runId ? opts.runId.toLowerCase() : null
    const joinId = runId ? joinIdFor(runId, audioUrls.length) : null

    if (joinId) {
        const existing = await findJoin(admin, userId, joinId)
        if (existing) return existing
    }

    const buffers = await Promise.all(audioUrls.map(async (url, index) => {
        const response = await fetch(url)
        if (!response.ok) throw new JoinFailure(`Could not read part ${index + 1} (HTTP ${response.status})`, 'fetch', 502)
        return Buffer.from(await response.arrayBuffer())
    }))

    // Format is sniffed from the first part: WAV = Gemini, otherwise MP3.
    let file: Buffer
    let extension: string
    let contentType: string
    if (isWav(buffers[0])) {
        file = concatenateWavs(buffers.map((buf, i) => parseWav(buf, i)))
        extension = TTS_OUTPUT_FORMAT.extension
        contentType = TTS_OUTPUT_FORMAT.mimeType
    } else {
        const joined = joinMp3Parts(buffers)
        file = joined.file
        extension = 'mp3'
        contentType = 'audio/mpeg'
        const unparsed = joined.stats.filter(s => s.coverage < 0.9).length
        if (unparsed) {
            logger.warn('Joined MP3 parts that did not parse as frames', { event: 's2v.mp3_unparsed', userId, parts: buffers.length, unparsed })
        }
    }

    // A run's file has a fixed name, so a second join overwrites rather than duplicates.
    const name = runId ? `stitch_${runId}_${audioUrls.length}` : `stitch_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const filePath = `${userId}/${name}.${extension}`
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(filePath, file, { contentType, upsert: true })
    if (uploadError) {
        const tooLarge = /maximum allowed size|too large|413/i.test(`${uploadError.message} ${(uploadError as { statusCode?: string }).statusCode ?? ''}`)
        logger.error('Could not store the joined voiceover', undefined, {
            event: 's2v.join_store_failed', userId, runId, parts: audioUrls.length, bytes: file.length, tooLarge, detail: uploadError.message,
        })
        throw tooLarge
            ? new JoinFailure(`The finished voiceover (${(file.length / 1e6).toFixed(0)} MB) is larger than we can save as one file. `
                + 'Every part is saved; split the script into two runs.', 'too_large', 413)
            : new JoinFailure('Failed to store stitched audio', 'storage', 500)
    }

    const url = admin.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl
    if (!url) throw new JoinFailure('Failed to get audio URL', 'storage', 500)

    const { error: historyError } = await admin.from('generation_history').insert({
        ...(joinId ? { id: joinId } : {}),
        user_id: userId,
        text: `Script to Voice: ${audioUrls.length} chunks stitched`,
        voice_id: 'batch',
        voice_name: opts.voiceName || 'Script Voice',
        audio_url: url,
        characters_used: 0, // credits were charged per part
        credits_used: 0,
        settings: {
            type: 'script-to-voice',
            chunks: audioUrls.length,
            totalSize: file.length,
            ...(runId ? { runId, totalParts: opts.totalParts ?? audioUrls.length } : {}),
        },
        status: 'completed',
    })
    // A duplicate id means the page and the server joined the same run at once: one entry is enough.
    if (historyError && !/23505|duplicate key/i.test(`${historyError.code} ${historyError.message}`)) {
        logger.warn('Joined voiceover saved but not added to history', { event: 's2v.join_history_failed', userId, runId, detail: historyError.message })
    }

    return { id: joinId, url, parts: audioUrls.length, totalSize: file.length, alreadyJoined: false }
}

/**
 * Called after the last part of a run is made. Waits for the page to join the
 * run as it normally does; if the page did not (closed, refreshed, offline),
 * the server joins it, so the voiceover still appears in the user's list.
 */
export async function autoJoinRun(admin: SupabaseClient, userId: string, runId: string, total: number, voiceName: string | null): Promise<void> {
    const delay = Number(process.env.S2V_AUTO_JOIN_DELAY_MS ?? 30_000)
    await new Promise(resolve => setTimeout(resolve, Number.isFinite(delay) ? Math.max(0, delay) : 30_000))
    try {
        const run = await loadRunParts(admin, userId, runId)
        if (run.urls.length !== total) return // a part is still missing: nothing to finish
        if (await findJoin(admin, userId, joinIdFor(runId, total))) return // the page joined it
        const joined = await joinAndStore(admin, { userId, audioUrls: run.urls, voiceName: voiceName || run.voiceName, runId, totalParts: total })
        logger.info('Joined a voiceover the page did not', { event: 's2v.auto_joined', userId, runId, parts: total, bytes: joined.totalSize })
    } catch (err) {
        logger.error('Automatic join failed', err instanceof Error ? err : undefined, { event: 's2v.auto_join_failed', userId, runId })
    }
}
