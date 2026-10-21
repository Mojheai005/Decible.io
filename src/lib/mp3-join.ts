// ===========================================
// JOIN MP3 PARTS INTO ONE PLAYABLE FILE
// ===========================================
// Byte-appending MP3 parts is almost right: MP3 frames are self-contained.
// What breaks it is the first frame of each part. Smallest.ai (and any
// LAME-encoded file) starts with a silent "Info"/"Xing" frame that states how
// many frames the file holds. After byte-appending, the joined file still
// opens with part 1's header, so players and video editors read it as one
// part long: a 9:08 voiceover showed as 2:07 and stopped there (Oct 2026).
//
// This walks every part frame by frame, drops those length headers and any
// ID3 tags, and keeps every audio frame. Without a length header, players
// measure the file themselves and see its real duration.
// ===========================================

// kbps by bitrate index, for MPEG-1 and MPEG-2/2.5 Layer III
const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
// Hz by version bits (3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5)
const SAMPLE_RATES: Record<number, number[]> = {
    3: [44100, 48000, 32000],
    2: [22050, 24000, 16000],
    0: [11025, 12000, 8000],
}

/** If a Layer III frame starts at `pos`, its length in bytes; otherwise 0. */
function frameLength(b: Buffer, pos: number): number {
    if (pos + 4 > b.length || b[pos] !== 0xff || (b[pos + 1] & 0xe0) !== 0xe0) return 0
    const version = (b[pos + 1] >> 3) & 3
    const layer = (b[pos + 1] >> 1) & 3
    const bitrateIndex = b[pos + 2] >> 4
    const rateIndex = (b[pos + 2] >> 2) & 3
    const padding = (b[pos + 2] >> 1) & 1
    if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return 0
    const v1 = version === 3
    const kbps = (v1 ? BITRATES_V1 : BITRATES_V2)[bitrateIndex]
    const sampleRate = SAMPLE_RATES[version][rateIndex]
    const samplesPerFrame = v1 ? 1152 : 576
    return Math.floor((samplesPerFrame / 8) * kbps * 1000 / sampleRate) + padding
}

/** True for the Xing/Info/VBRI frame an encoder writes to state the file's length. */
function isLengthHeader(b: Buffer, pos: number): boolean {
    const v1 = ((b[pos + 1] >> 3) & 3) === 3
    const mono = (b[pos + 3] >> 6) === 3
    const sideInfo = v1 ? (mono ? 17 : 32) : (mono ? 9 : 17)
    const tag = b.toString('latin1', pos + 4 + sideInfo, pos + 8 + sideInfo)
    return tag === 'Xing' || tag === 'Info' || b.toString('latin1', pos + 36, pos + 40) === 'VBRI'
}

/** Size of an ID3v2 tag starting at `pos`, or 0. */
function id3Length(b: Buffer, pos: number): number {
    if (pos + 10 > b.length || b.toString('latin1', pos, pos + 3) !== 'ID3') return 0
    return 10 + (((b[pos + 6] & 0x7f) << 21) | ((b[pos + 7] & 0x7f) << 14) | ((b[pos + 8] & 0x7f) << 7) | (b[pos + 9] & 0x7f))
}

export interface Mp3PartStats {
    audioFrames: number
    lengthHeadersRemoved: number
    /** Share of the part's bytes that parsed as frames or tags (1 = all). */
    coverage: number
}

/** Audio frames of one part, without length headers or tags. */
export function mp3AudioFrames(part: Buffer): { frames: Buffer[]; stats: Mp3PartStats } {
    const frames: Buffer[] = []
    let pos = 0
    let recognised = 0
    let removed = 0
    while (pos + 4 <= part.length) {
        const tag = id3Length(part, pos)
        if (tag) { recognised += Math.min(tag, part.length - pos); pos += tag; continue }
        const len = frameLength(part, pos)
        if (len && pos + len <= part.length) {
            if (isLengthHeader(part, pos)) removed++
            else frames.push(part.subarray(pos, pos + len))
            recognised += len
            pos += len
            continue
        }
        pos++ // not a frame here: skip a byte and resynchronise
    }
    return {
        frames,
        stats: { audioFrames: frames.length, lengthHeadersRemoved: removed, coverage: part.length ? recognised / part.length : 1 },
    }
}

/**
 * Join MP3 parts into one file. A part that does not parse as MP3 frames
 * (under 90% recognised) is appended unchanged rather than risk losing audio.
 */
export function joinMp3Parts(parts: Buffer[]): { file: Buffer; stats: Mp3PartStats[] } {
    const out: Buffer[] = []
    const stats: Mp3PartStats[] = []
    for (const part of parts) {
        const { frames, stats: s } = mp3AudioFrames(part)
        stats.push(s)
        if (s.coverage >= 0.9 && frames.length > 0) {
            out.push(...frames)
        } else {
            const tag = id3Length(part, 0)
            out.push(out.length && tag ? part.subarray(tag) : part)
        }
    }
    return { file: Buffer.concat(out), stats }
}
