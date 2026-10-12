// ===========================================
// TEXT CHUNKER — Split scripts into engine-sized parts
//
// Splits at paragraph boundaries first, then at sentence and line
// boundaries, then between words, and only as a last resort inside a word.
//
// The ceiling is ENGINE-SPECIFIC and must be passed in (see ENGINE_LIMITS in
// constants.ts): a chunk the engine cannot speak in one go gets truncated
// while the user is charged in full.
//
// NEVER DROPS TEXT. The previous version found sentences with
//   paragraph.match(/[^.!?]+[.!?]+[\s]*/g)
// which returns only the matches, so anything after the last . ! or ? in a
// long paragraph vanished: a closing "Thanks for watching", a heading, the
// last line of a script pasted with single line breaks. Pieces are now
// slices of the original text, so they always add back up to the whole, and
// a final check falls back to plain word splitting if they ever do not.
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

// Where a piece may end:
//   - after . ! ? (optionally followed by closing quotes or brackets) and whitespace
//   - after the Devanagari danda । ॥, CJK 。！？ or Arabic ؟, whitespace optional
//   - at a line break, so headings, bullet points and unpunctuated lines are
//     boundaries too
const BOUNDARY = /[.!?]+["'”’»)\]]*\s+|[।॥。！？؟]+["'”’»)\]]*\s*|\n+/g

function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
}

const withoutWhitespace = (s: string) => s.replace(/\s+/g, '')

/** Cut text into raw slices at sentence and line boundaries. The slices concatenate back to `text` exactly. */
function slicesAtBoundaries(text: string): string[] {
    const slices: string[] = []
    let start = 0
    BOUNDARY.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = BOUNDARY.exec(text)) !== null) {
        const end = m.index + m[0].length
        slices.push(text.slice(start, end))
        start = end
    }
    if (start < text.length) slices.push(text.slice(start))
    return slices
}

/** Split one word that is longer than the ceiling (a URL, or text with no spaces) by characters. */
function splitInsideWord(word: string, maxChars: number): string[] {
    const out: string[] = []
    let current = ''
    for (const ch of word) { // iterates code points, so emoji and surrogate pairs stay whole
        if (current && (current + ch).length > maxChars) {
            out.push(current)
            current = ch
        } else {
            current += ch
        }
    }
    if (current) out.push(current)
    return out
}

/** Split text that has no usable boundary on word boundaries, never exceeding the ceiling. */
function splitOnWords(text: string, maxChars: number): string[] {
    const out: string[] = []
    let buf = ''
    for (const word of text.trim().split(/\s+/).filter(Boolean)) {
        if (word.length > maxChars) {
            if (buf) { out.push(buf); buf = '' }
            out.push(...splitInsideWord(word, maxChars))
            continue
        }
        const next = buf ? `${buf} ${word}` : word
        if (next.length > maxChars && buf) {
            out.push(buf)
            buf = word
        } else {
            buf = next
        }
    }
    if (buf) out.push(buf)
    return out
}

/** Split a paragraph longer than the ceiling into segments that each fit. */
function splitLongParagraph(paragraph: string, maxChars: number): string[] {
    const segments: string[] = []
    let current = ''

    const flush = () => {
        const t = current.trim()
        if (t) segments.push(t)
        current = ''
    }

    for (const slice of slicesAtBoundaries(paragraph)) {
        if (slice.trim().length > maxChars) {
            // One sentence or line longer than the ceiling on its own.
            flush()
            segments.push(...splitOnWords(slice, maxChars))
            continue
        }
        if ((current + slice).trim().length > maxChars && current.trim()) {
            flush()
        }
        current += slice
    }
    flush()
    return segments
}

function toChunk(text: string, index: number): TextChunk {
    return { index, text, wordCount: countWords(text), charCount: text.length }
}

/**
 * Split text into chunks of at most `maxChars`, preferring paragraph, then
 * sentence and line, then word boundaries.
 *
 * @param maxChars per-engine ceiling — see ENGINE_LIMITS in constants.ts
 */
export function chunkText(
    fullText: string,
    maxChars: number = DEFAULT_MAX_CHARS_PER_REQUEST,
): ChunkPlan {
    const mergeThreshold = Math.floor(maxChars * MERGE_THRESHOLD_RATIO)
    const normalized = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const totalWords = countWords(normalized)
    const totalChars = normalized.trim().length

    // If the whole text fits in one chunk, return it as-is
    if (totalChars <= maxChars) {
        return {
            chunks: [toChunk(normalized.trim(), 0)],
            totalWords,
            totalChars,
            totalCredits: totalChars,
        }
    }

    // 1. Paragraphs, with any paragraph over the ceiling split further
    const segments: string[] = []
    for (const para of normalized.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)) {
        if (para.length <= maxChars) segments.push(para)
        else segments.push(...splitLongParagraph(para, maxChars))
    }

    // 2. Pack segments into chunks up to the ceiling, keeping paragraph breaks
    let texts: string[] = []
    let current = ''
    for (const segment of segments) {
        const combined = current ? `${current}\n\n${segment}` : segment
        if (combined.length > maxChars && current) {
            texts.push(current)
            current = segment
        } else {
            current = combined
        }
    }
    if (current) texts.push(current)

    // 3. Fold a tiny last chunk into the previous one when it fits
    if (texts.length > 1 && texts[texts.length - 1].length < mergeThreshold) {
        const merged = `${texts[texts.length - 2]}\n\n${texts[texts.length - 1]}`
        if (merged.length <= maxChars) texts.splice(texts.length - 2, 2, merged)
    }

    // 4. Safety net: the chunks must contain every character of the script,
    //    in order. If they ever do not, fall back to plain word splitting,
    //    which cannot lose text.
    if (withoutWhitespace(texts.join('')) !== withoutWhitespace(normalized)
        || texts.some(t => t.length > maxChars)) {
        console.error('[chunkText] boundary split lost or oversized text; using word split instead', {
            chars: totalChars,
            maxChars,
        })
        texts = splitOnWords(normalized, maxChars)
    }

    const chunks = texts.map((t, i) => toChunk(t, i))
    return {
        chunks,
        totalWords,
        totalChars,
        totalCredits: chunks.reduce((sum, c) => sum + c.charCount, 0),
    }
}
