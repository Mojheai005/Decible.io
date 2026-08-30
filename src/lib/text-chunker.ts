// ===========================================
// TEXT CHUNKER — Split scripts at paragraph boundaries
// Never splits mid-sentence.
//
// The chunk ceiling is ENGINE-SPECIFIC and must be passed in. It used to be a
// flat 1800 for every voice, which sat well above what Gemini can actually
// speak (~1.2k) — so every long script was fed chunks the engine silently
// truncated while the user was charged in full. See ENGINE_LIMITS in
// constants.ts for the measured evidence.
// ===========================================
import { DEFAULT_MAX_CHARS_PER_REQUEST } from './constants'

export interface TextChunk {
    index: number
    text: string
    wordCount: number
    charCount: number
}

export interface ChunkPlan {
    chunks: TextChunk[]
    totalWords: number
    totalChars: number
    totalCredits: number
}

// Chunks smaller than this are merged into the previous one, scaled to the
// engine ceiling so a 1000-char limit does not leave 400-char stragglers.
const MERGE_THRESHOLD_RATIO = 0.22

function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Split a single long paragraph into sentence-bounded segments.
 * Used when a paragraph exceeds the engine ceiling on its own.
 */
function splitLongParagraph(paragraph: string, maxChars: number): string[] {
    const sentences = paragraph.match(/[^.!?]+[.!?]+[\s]*/g) || [paragraph]
    const result: string[] = []
    let current = ''

    for (const sentence of sentences) {
        const combined = current + sentence
        if (combined.length > maxChars && current) {
            result.push(current.trim())
            current = sentence
        } else {
            current = combined
        }
    }

    if (current.trim()) {
        result.push(current.trim())
    }

    return result
}

/**
 * Split text into chunks at paragraph boundaries, each under `maxChars`.
 * Falls back to sentence splitting for very long paragraphs, and to hard
 * character splitting for a single sentence longer than the ceiling
 * (previously such a sentence was emitted oversized and silently truncated
 * by the engine).
 *
 * @param maxChars per-engine ceiling — see ENGINE_LIMITS in constants.ts
 */
export function chunkText(
    fullText: string,
    maxChars: number = DEFAULT_MAX_CHARS_PER_REQUEST,
): ChunkPlan {
    const mergeThreshold = Math.floor(maxChars * MERGE_THRESHOLD_RATIO)
    const normalized = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const rawParagraphs = normalized.split(/\n\s*\n/)
    const paragraphs = rawParagraphs
        .map(p => p.trim())
        .filter(p => p.length > 0)

    const totalWords = countWords(fullText)
    const totalChars = fullText.trim().length

    // If total text fits in one chunk, return as-is
    if (totalChars <= maxChars) {
        return {
            chunks: [{
                index: 0,
                text: fullText.trim(),
                wordCount: totalWords,
                charCount: totalChars,
            }],
            totalWords,
            totalChars,
            totalCredits: totalChars,
        }
    }

    // Flatten paragraphs — split any that are too long on their own
    const segments: string[] = []
    for (const para of paragraphs) {
        if (para.length > maxChars) {
            segments.push(...splitLongParagraph(para, maxChars))
        } else {
            segments.push(para)
        }
    }

    // A single sentence can still exceed the ceiling. Split it on word
    // boundaries rather than shipping an oversized chunk the engine will
    // silently truncate.
    const bounded: string[] = []
    for (const seg of segments) {
        if (seg.length <= maxChars) {
            bounded.push(seg)
            continue
        }
        const words = seg.split(/\s+/)
        let buf = ''
        for (const word of words) {
            const next = buf ? `${buf} ${word}` : word
            if (next.length > maxChars && buf) {
                bounded.push(buf)
                buf = word
            } else {
                buf = next
            }
        }
        if (buf.trim()) bounded.push(buf.trim())
    }

    // Accumulate segments into chunks based on CHARACTER limit
    const chunks: TextChunk[] = []
    let currentText = ''

    for (const segment of bounded) {
        const combined = currentText ? `${currentText}\n\n${segment}` : segment

        if (combined.length > maxChars && currentText) {
            // Current chunk is full — finalize it
            const trimmed = currentText.trim()
            chunks.push({
                index: chunks.length,
                text: trimmed,
                wordCount: countWords(trimmed),
                charCount: trimmed.length,
            })
            currentText = segment
        } else {
            currentText = combined
        }
    }

    // Push remaining text as final chunk
    if (currentText.trim()) {
        const trimmed = currentText.trim()
        chunks.push({
            index: chunks.length,
            text: trimmed,
            wordCount: countWords(trimmed),
            charCount: trimmed.length,
        })
    }

    // Merge tiny last chunk into previous if it's too small
    if (chunks.length > 1) {
        const last = chunks[chunks.length - 1]
        if (last.charCount < mergeThreshold) {
            const prev = chunks[chunks.length - 2]
            const merged = `${prev.text}\n\n${last.text}`
            if (merged.length <= maxChars) {
                prev.text = merged
                prev.wordCount = countWords(merged)
                prev.charCount = merged.length
                chunks.pop()
            }
        }
    }

    // Re-index
    chunks.forEach((chunk, i) => { chunk.index = i })

    const totalCredits = chunks.reduce((sum, c) => sum + c.charCount, 0)

    return {
        chunks,
        totalWords,
        totalChars,
        totalCredits,
    }
}
