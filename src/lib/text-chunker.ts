// ===========================================
// TEXT CHUNKER — Split scripts at paragraph boundaries
// Target: 1500-1800 words per chunk
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

const MIN_WORDS_PER_CHUNK = 1200
const MAX_WORDS_PER_CHUNK = 1800
const TARGET_WORDS_PER_CHUNK = 1500

function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Split a single long paragraph into sentence-bounded chunks.
 * Used when a paragraph exceeds MAX_WORDS_PER_CHUNK.
 */
function splitLongParagraph(paragraph: string): string[] {
    // Split at sentence boundaries: period, exclamation, question mark followed by space
    const sentences = paragraph.match(/[^.!?]+[.!?]+[\s]*/g) || [paragraph]
    const result: string[] = []
    let current = ''

    for (const sentence of sentences) {
        const combined = current + sentence
        if (countWords(combined) > MAX_WORDS_PER_CHUNK && current) {
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
 * Each chunk targets 1500-1800 words.
 * Falls back to sentence splitting for very long paragraphs.
 */
export function chunkText(fullText: string): ChunkPlan {
    // Normalize line endings and split by double newlines (paragraph boundaries)
    const normalized = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const rawParagraphs = normalized.split(/\n\s*\n/)
    const paragraphs = rawParagraphs
        .map(p => p.trim())
        .filter(p => p.length > 0)

    // If total text is small enough for one chunk, return as-is
    const totalWords = countWords(fullText)
    const totalChars = fullText.length

    if (totalWords <= MAX_WORDS_PER_CHUNK) {
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

    // Flatten paragraphs — split any that are too long
    const segments: string[] = []
    for (const para of paragraphs) {
        if (countWords(para) > MAX_WORDS_PER_CHUNK) {
            segments.push(...splitLongParagraph(para))
        } else {
            segments.push(para)
        }
    }

    // Accumulate segments into chunks
    const chunks: TextChunk[] = []
    let currentText = ''
    let currentWords = 0

    for (const segment of segments) {
        const segmentWords = countWords(segment)

        // If adding this segment would exceed max, finalize current chunk
        if (currentWords + segmentWords > MAX_WORDS_PER_CHUNK && currentText) {
            chunks.push({
                index: chunks.length,
                text: currentText.trim(),
                wordCount: currentWords,
                charCount: currentText.trim().length,
            })
            currentText = segment
            currentWords = segmentWords
        } else {
            // Add paragraph separator between segments within a chunk
            currentText = currentText ? `${currentText}\n\n${segment}` : segment
            currentWords += segmentWords
        }
    }

    // Push remaining text as final chunk
    if (currentText.trim()) {
        chunks.push({
            index: chunks.length,
            text: currentText.trim(),
            wordCount: countWords(currentText),
            charCount: currentText.trim().length,
        })
    }

    // Merge tiny last chunk into previous if it's too small
    if (chunks.length > 1) {
        const last = chunks[chunks.length - 1]
        if (last.wordCount < MIN_WORDS_PER_CHUNK / 3) {
            const prev = chunks[chunks.length - 2]
            prev.text = `${prev.text}\n\n${last.text}`
            prev.wordCount = countWords(prev.text)
            prev.charCount = prev.text.length
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
