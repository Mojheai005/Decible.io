// ===========================================
// TTS ENGINE ERRORS — one classifier for every way an engine can fail
// ===========================================
// The category decides four things, so they can never disagree again:
//   - whether the attempt is retried, and on which schedule
//   - what the user is told
//   - what is written to generation_history and the refund ledger
//   - whether the team is alerted
//
// It replaces three regexes that had drifted apart. The worst gap: Smallest.ai
// reports an empty account as HTTP 400 "Credits exhausted. Please recharge.",
// which none of them recognised as a funding problem. From 28 Sep to 12 Oct
// 2026 more than 10,000 attempts were refused that way and every one was
// logged and shown as an ordinary "Generation failed".
// ===========================================

export type EngineName = 'smallest' | 'fish' | 'gemini'

export type FailureCategory =
    | 'out_of_funds'    // provider account is empty: every voice on that engine is down
    | 'auth'            // key missing, wrong or revoked: every voice on that engine is down
    | 'capacity'        // provider concurrency or rate cap reached
    | 'transient'       // 5xx, network blips, a provider asking us to try again
    | 'timeout'         // the provider took longer than our deadline
    | 'rejected_input'  // the provider refused this text (validation or content filter)
    | 'truncated'       // the audio covers only part of the text
    | 'storage'         // the audio was made but could not be saved
    | 'unknown'

/** Error thrown by the engine clients, carrying what the provider actually returned. */
export class EngineError extends Error {
    readonly engine: EngineName
    /** HTTP status, or the provider's own code when it reports errors inside a 200 (Kie.ai). */
    readonly status?: number
    readonly phase: 'request' | 'create' | 'poll' | 'download'
    /** The provider gave a final answer (for example a task that failed), as opposed to a hiccup while asking. */
    readonly final: boolean

    constructor(
        engine: EngineName,
        message: string,
        opts: { status?: number; phase?: EngineError['phase']; final?: boolean } = {},
    ) {
        super(message)
        this.name = 'EngineError'
        this.engine = engine
        this.status = opts.status
        this.phase = opts.phase ?? 'request'
        this.final = opts.final ?? false
    }
}

export interface ClassifiedFailure {
    category: FailureCategory
    /** Worth another attempt inside the same request. */
    retryable: boolean
    /** A capacity error waits for a slot to free instead of the short transient backoff. */
    capacity: boolean
    /** Engine-wide or money-losing problem the team must hear about. */
    alert: boolean
    providerStatus?: number
    /** HTTP status we answer the browser with. */
    httpStatus: number
    /** Short label, shown as the reason in Script to Voice. */
    userError: string
    /** Full sentence shown to the user. Always says whether they were charged. */
    userMessage: string
}

// Money words only. Generic phrases such as "quota exceeded" are left to the
// capacity check: Gemini's per-minute throttle reads "RESOURCE_EXHAUSTED: Quota
// exceeded for quota metric ... per minute", and calling that an empty account
// would skip the retry and page the team for nothing.
const FUNDING = /credits? exhausted|recharge|insufficient (api )?credits?|insufficient (balance|funds)|out of credits|no credits|payment required|top ?up your|balance (is )?(too low|insufficient)/i
const AUTH = /unauthori[sz]ed|invalid (api )?key|invalid token|api key (is )?(invalid|missing|revoked)|forbidden|missing \w+_api_key|not configured/i
const CAPACITY = /concurrency|too many requests|rate.?limit|quota exceeded|resource.?exhausted|per minute/i
// An account-level cap (trial or workspace usage limit) behaves like an empty account.
const ACCOUNT_LIMIT = /usage limit|billing|plan limit|trial (has )?(ended|expired)/i
const REJECTED = /content[_ ]filter|blocked|invalid (text|input|voice|language|parameter)|unsupported/i
const TRANSIENT = /timed? ?out|timeout|econnreset|etimedout|econnrefused|socket hang up|network|fetch failed|temporar|internal (server )?error|try again later|service unavailable|bad gateway|gateway timeout|overloaded|maintenance|empty (or invalid )?audio/i

function category(err: unknown): { category: FailureCategory; status?: number } {
    const status = err instanceof EngineError ? err.status : undefined
    const message = err instanceof Error ? err.message : String(err)

    // Order matters: an empty account can arrive as 400, 402, 403 or 429
    // depending on the provider, so explicit money wording wins over the status.
    if (FUNDING.test(message)) return { category: 'out_of_funds', status }
    // Then throttling, before any status-based guess: a 429 is a busy engine.
    if (status === 429 || CAPACITY.test(message)) return { category: 'capacity', status }
    if (status === 402) return { category: 'out_of_funds', status }
    // Downloading finished audio from the provider's file host: a 403 or 404
    // there is an expired link, not a bad key.
    if (err instanceof EngineError && err.phase === 'download' && (status === 403 || status === 404)) {
        return { category: 'transient', status }
    }
    if (status === 403 && ACCOUNT_LIMIT.test(message)) return { category: 'out_of_funds', status }
    if (status === 401 || status === 403 || AUTH.test(message)) return { category: 'auth', status }
    if (/timed? ?out|timeout|aborted due to timeout/i.test(message) && !(status && status >= 500)) {
        return { category: 'timeout', status }
    }
    if (status === 400 || status === 413 || status === 422 || REJECTED.test(message)) {
        return { category: 'rejected_input', status }
    }
    if ((status && (status === 408 || status === 409 || status === 425 || status >= 500)) || TRANSIENT.test(message)) {
        return { category: 'transient', status }
    }
    // A poll or download hiccup without a recognisable message is still a
    // network-level failure of a task that may well have succeeded.
    if (err instanceof EngineError && (err.phase === 'poll' || err.phase === 'download')) {
        return { category: 'transient', status }
    }
    return { category: 'unknown', status }
}

const NOT_CHARGED = 'nothing was charged'

export function classifyEngineFailure(err: unknown): ClassifiedFailure {
    const { category: c, status } = category(err)
    switch (c) {
        case 'out_of_funds':
        case 'auth':
            return {
                category: c, retryable: false, capacity: false, alert: true, providerStatus: status,
                httpStatus: 503,
                userError: 'Voice unavailable',
                userMessage: `These voices are temporarily unavailable, so ${NOT_CHARGED}. `
                    + 'Please pick a voice from another family while we fix it.',
            }
        case 'capacity':
            return {
                category: c, retryable: true, capacity: true, alert: false, providerStatus: status,
                httpStatus: 503,
                userError: 'Voice engine busy',
                userMessage: `All voice slots are busy right now, so ${NOT_CHARGED}. Please try again in a few seconds.`,
            }
        case 'rejected_input':
            return {
                category: c, retryable: false, capacity: false, alert: false, providerStatus: status,
                httpStatus: 422,
                userError: 'Text not accepted',
                userMessage: `This voice's engine refused this text, so ${NOT_CHARGED}. `
                    + 'Try rewording it, or pick a voice from another family.',
            }
        case 'timeout':
        case 'transient':
            return {
                category: c, retryable: true, capacity: false, alert: false, providerStatus: status,
                httpStatus: 502,
                userError: 'Generation failed',
                userMessage: `The voice engine could not finish this generation, so ${NOT_CHARGED}. Please try again.`,
            }
        default:
            return {
                category: 'unknown', retryable: false, capacity: false, alert: false, providerStatus: status,
                httpStatus: 502,
                userError: 'Generation failed',
                userMessage: `The voice engine could not finish this generation, so ${NOT_CHARGED}. Please try again.`,
            }
    }
}

/** The same shape for failures that happen after the engine succeeded. */
export function failureFor(c: 'truncated' | 'storage'): ClassifiedFailure {
    if (c === 'truncated') {
        return {
            category: c, retryable: false, capacity: false, alert: false,
            httpStatus: 502,
            userError: 'Incomplete audio',
            userMessage: `The voice engine kept returning only part of your text, so ${NOT_CHARGED}. `
                + 'Please try a different voice. The Fish Audio voices are the most reliable for long text.',
        }
    }
    return {
        category: c, retryable: false, capacity: false, alert: true,
        httpStatus: 500,
        userError: 'Could not save audio',
        userMessage: `Your audio was made but could not be saved, so ${NOT_CHARGED}. Please try again.`,
    }
}

/** Trim a provider message for logs and the ledger, without ids that defeat grouping. */
export function shortReason(err: unknown, max = 300): string {
    const m = err instanceof Error ? err.message : String(err)
    return m.replace(/\s+/g, ' ').trim().slice(0, max)
}
