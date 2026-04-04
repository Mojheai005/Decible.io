// ===========================================
// TEXT CHUNKER — Split scripts at paragraph boundaries
// Target: 1500-1800 CHARACTERS per chunk
// Never splits mid-sentence
// ===========================================

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

const MIN_CHARS_PER_CHUNK = 800
const MAX_CHARS_PER_CHUNK = 1800
const MIN_CHARS_FOR_MERGE = 400

function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Split a single long paragraph into sentence-bounded segments.
 * Used when a paragraph exceeds MAX_CHARS_PER_CHUNK on its own.
 */
function splitLongParagraph(paragraph: string): string[] {
    const sentences = paragraph.match(/[^.!?]+[.!?]+[\s]*/g) || [paragraph]
    const result: string[] = []
    let current = ''

    for (const sentence of sentences) {
        const combined = current + sentence
        if (combined.length > MAX_CHARS_PER_CHUNK && current) {
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
 * Split text into chunks at paragraph boundaries.
 * Each chunk stays under 1800 characters.
 * Falls back to sentence splitting for very long paragraphs.
 */
export function chunkText(fullText: string): ChunkPlan {
    const normalized = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const rawParagraphs = normalized.split(/\n\s*\n/)
    const paragraphs = rawParagraphs
        .map(p => p.trim())
        .filter(p => p.length > 0)

    const totalWords = countWords(fullText)
    const totalChars = fullText.trim().length

    // If total text fits in one chunk, return as-is
    if (totalChars <= MAX_CHARS_PER_CHUNK) {
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
        if (para.length > MAX_CHARS_PER_CHUNK) {
            segments.push(...splitLongParagraph(para))
        } else {
            segments.push(para)
        }
    }

    // Accumulate segments into chunks based on CHARACTER limit
    const chunks: TextChunk[] = []
    let currentText = ''

    for (const segment of segments) {
        const combined = currentText ? `${currentText}\n\n${segment}` : segment

        if (combined.length > MAX_CHARS_PER_CHUNK && currentText) {
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
        if (last.charCount < MIN_CHARS_FOR_MERGE) {
            const prev = chunks[chunks.length - 2]
            const merged = `${prev.text}\n\n${last.text}`
            prev.text = merged
            prev.wordCount = countWords(merged)
            prev.charCount = merged.length
            chunks.pop()
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
