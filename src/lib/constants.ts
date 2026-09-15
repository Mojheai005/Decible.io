// ===========================================
// APPLICATION CONSTANTS
// ===========================================

// Kie.ai TTS API Configuration (ElevenLabs v2.5)
export const API_CONFIG = {
    KIEAI_BASE_URL: 'https://api.kie.ai',
    REQUEST_TIMEOUT_MS: 60000, // 60 seconds - direct response, no polling needed
} as const

// Rate Limiting
export const RATE_LIMITS = {
    GENERATION_REQUESTS_PER_MINUTE: 10,
    GENERATION_REQUESTS_PER_HOUR: 100,
    VOICES_REQUESTS_PER_MINUTE: 30,
    CREDITS_REQUESTS_PER_MINUTE: 60,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
} as const

// ===========================================
// VOICE GENERATION SETTINGS
// Based on DubVoice API parameters
// ===========================================

export const VOICE_SETTINGS = {
    // Speed - Controls playback rate
    SPEED: {
        MIN: 0.7,      // Minimum speed (per DubVoice API)
        MAX: 1.2,      // Maximum speed (per DubVoice API)
        DEFAULT: 1.0,  // Normal speed
        STEP: 0.01,
    },

    // Stability - Higher = more consistent, Lower = more expressive/varied
    // API accepts 0-1, UI shows 0-100
    STABILITY: {
        MIN: 0,
        MAX: 100,
        DEFAULT: 50,   // Balanced
        STEP: 1,
        // Convert UI value (0-100) to API value (0-1)
        toApiValue: (uiValue: number) => uiValue / 100,
        // Convert API value (0-1) to UI value (0-100)
        toUiValue: (apiValue: number) => apiValue * 100,
    },

    // Similarity Boost - Higher = more similar to original voice
    // API accepts 0-1, UI shows 0-100
    SIMILARITY: {
        MIN: 0,
        MAX: 100,
        DEFAULT: 75,   // High similarity recommended
        STEP: 1,
        toApiValue: (uiValue: number) => uiValue / 100,
        toUiValue: (apiValue: number) => apiValue * 100,
    },

    // Style Exaggeration - Higher = more expressive/emotional
    // Only available on v2 models
    // API accepts 0-1, UI shows 0-100
    STYLE: {
        MIN: 0,
        MAX: 100,
        DEFAULT: 0,    // None by default (more natural)
        STEP: 1,
        toApiValue: (uiValue: number) => uiValue / 100,
        toUiValue: (apiValue: number) => apiValue * 100,
    },

    // Speaker Boost - Enhances clarity and reduces background artifacts
    SPEAKER_BOOST: {
        DEFAULT: true,
    },
} as const

// Legacy export for backwards compatibility
export const GENERATION_LIMITS = {
    MIN_TEXT_LENGTH: 1,
    MAX_TEXT_LENGTH: 5000,
    MIN_STABILITY: VOICE_SETTINGS.STABILITY.MIN / 100,
    MAX_STABILITY: VOICE_SETTINGS.STABILITY.MAX / 100,
    MIN_SIMILARITY: VOICE_SETTINGS.SIMILARITY.MIN / 100,
    MAX_SIMILARITY: VOICE_SETTINGS.SIMILARITY.MAX / 100,
    MIN_STYLE: VOICE_SETTINGS.STYLE.MIN / 100,
    MAX_STYLE: VOICE_SETTINGS.STYLE.MAX / 100,
    MIN_SPEED: VOICE_SETTINGS.SPEED.MIN,
    MAX_SPEED: VOICE_SETTINGS.SPEED.MAX,
    DEFAULT_SPEED: VOICE_SETTINGS.SPEED.DEFAULT,
} as const

// ===========================================
// TTS ENGINE LIMITS
// ===========================================
// Measured against the live APIs on 2026-08-30 by scripts/voice-audit.py,
// which sends a checkpointed script and TRANSCRIBES the result to see how
// much was actually spoken (not a duration heuristic).
//
// GEMINI (Kie.ai, google/gemini-3-1-flash-tts) — UNRELIABLE ABOVE ~1.2k CHARS
//   1,159 chars -> spoken in full, 16.8 chars/sec (healthy)
//   1,449 chars -> model ran away: 566s of audio for ~90s of text, 284s wall
//   1,884 / 2,899 chars -> never returned inside the poll window
//   4,888 chars -> 17 of 26 voices truncated; coverage ranged 21.9%-100%
//                  (orus/puck/aoede 21.9%, alnilam/sadachbia 25%, ...)
//   Truncation is PER VOICE and cannot be predicted from voice metadata,
//   which is why it looked random in production.
//
// FISH (api.fish.audio, s2.1-pro) — RELIABLE
//   4,888 chars -> 8 of 8 voices spoke 32/32 checkpoints, 100% coverage.
//
// CEILINGS ARE SET BY WALL TIME, NOT QUALITY. Both Fish and Smallest can
// speak far more text than these limits allow; what they cannot do is finish
// before a serverless function is killed. A killed function deducts credits
// and never reaches the refund, so the user pays and receives nothing —
// measured on 12 Sep. Sizes below finish inside 60s even when a provider runs
// ~2.5x slower than its measured rate, so they hold on Vercel Hobby as well as
// Pro. Raise them only with fresh timing measurements taken under load.
export const ENGINE_LIMITS = {
    gemini: {
        // 1,000 was set against TRUNCATION and never against the clock, which
        // was an oversight: Gemini's own healthy benchmark is 16.8 chars/sec,
        // so the 1,159-char run that "passed" actually took ~69s — already past
        // a 60s function limit. At 1,000 chars it lands at ~60s, i.e. exactly on
        // the kill line, and a killed function never reaches the refund, so the
        // user is charged and gets nothing.
        //
        // Worse, Gemini does not merely run slow, it runs away: 1,449 chars
        // once produced 566s of audio in 284s of wall time. No ceiling makes it
        // safe at length. 400 chars projects to ~24s measured and ~60s even at
        // the 2.5x slowdown the other engines are sized for.
        //
        // This is a containment limit for an engine that should be demoted, not
        // a considered capacity. Gemini is 30 of 359 voices.
        maxCharsPerRequest: 400,
        pollTimeoutMs: 180_000,
    },
    fish: {
        // Quality ceiling is 4,888 (transcription-verified), but the binding
        // constraint is WALL TIME, not truncation. Measured 2026-09-16:
        // 15.4 ms/char, so 4,000 chars = ~62s — past a 60s function limit
        // before any provider slowdown. Two charges on 12 Sep averaging 3,940
        // chars were deducted and never delivered: the function died mid-flight
        // so the refund never ran and the users silently lost the credits.
        // 1,500 completes in ~23s and still finishes inside 60s even if the
        // provider runs 2.5x slower than measured.
        maxCharsPerRequest: 1500,
        pollTimeoutMs: 300_000,
    },
    smallest: {
        // Smallest.ai Lightning v3.1 Pro. Docs say "~250 chars recommended";
        // transcription testing on 2026-09-07 showed 100% coverage at every
        // size up to 4,707 chars, so quality is not the constraint — wall time
        // is. Measured 9.7 ms/char on 2026-09-16, but the SAME work measured
        // 2.2x slower on 2026-09-07 under load (4,707 chars took 99.6s).
        // 2,500 still projects to ~61s at that slow rate — over the line — so
        // 2,000: ~19s measured, ~49s at 2.5x slower, comfortably inside 60s.
        maxCharsPerRequest: 2000,
        pollTimeoutMs: 300_000,
    },
} as const

export type TTSEngine = keyof typeof ENGINE_LIMITS

// Used when the engine is unknown — the conservative (Gemini) ceiling.
export const DEFAULT_MAX_CHARS_PER_REQUEST = ENGINE_LIMITS.gemini.maxCharsPerRequest

// Gemini truncation is NON-DETERMINISTIC. Measured 2026-08-30: the same voice,
// same text, same length returned 100%, 71.4%, 100%, 100% (Charon) and
// 100%, 100%, 100%, 57.1% (Orus) across four consecutive runs. Roughly 1 in 4
// requests drops text even at a safe size, so no character ceiling can make it
// reliable — the output must be checked and RETRIED. Three attempts takes a
// ~20% per-request failure rate to well under 1%.
export const TTS_MAX_ATTEMPTS = 3

// Measured throughput per engine, ms of wall time per character of script.
// Fish and Smallest measured 2026-09-16; Gemini derived from its healthy
// 16.8 chars/sec run. Used to answer "is there time left for another attempt?"
// before retrying, so a retry never pushes the function past its limit.
export const ENGINE_MS_PER_CHAR = {
    gemini: 60,
    fish: 15.4,
    smallest: 9.7,
} as const

// Wall-clock budget for one TTS request. Vercel Hobby kills a function at 60s
// regardless of `maxDuration`, and a killed function never reaches the refund —
// that is exactly how 10 users were charged and given nothing. 55s leaves room
// to upload the audio and answer. Retrying is only allowed while the estimated
// next attempt still fits inside what remains.
export const FUNCTION_BUDGET_MS = 55_000

// Backoff for CAPACITY errors — a provider concurrency cap, not a blip.
//
// VERIFIED 2026-09-16 against the live Fish API: 8 simultaneous requests
// returned 5 x HTTP 200 and 3 x HTTP 429 "exceeded your current concurrency
// limit", each rejection arriving in under 300ms. Fish allows 5 in flight.
//
// A slot frees only when one of those 5 finishes, which at the 1,500-char
// ceiling takes ~23s — so the expected wait is ~23/5 ≈ 4.6s. The original
// 800ms/1600ms backoff retried while all five slots were still busy and was
// therefore guaranteed to fail. These delays are sized to the real turnover.
export const CAPACITY_RETRY_DELAYS_MS = [4_000, 9_000] as const

// Backoff for ordinary transient faults (5xx, socket hang up, timeout), where
// nothing needs to free up and retrying quickly is right.
export const TRANSIENT_RETRY_DELAYS_MS = [800, 1_600] as const

// Jitter spreads simultaneous retries so five users who are all throttled at
// the same instant do not queue up and collide again on the same schedule.
export const RETRY_JITTER_RATIO = 0.3

// Truncation detector threshold, in characters of script per second of audio.
//
// Measured healthy Gemini output: 7.3, 15.4 and 16.8 chars/sec (pace Natural).
// A badly truncated run measured 44.3. Sitting the line at 20 catches anything
// below roughly 85% coverage while leaving headroom above the fastest healthy
// run observed.
//
// This is scaled by the user's speed setting at call time — "Rapid Fire" pace
// legitimately raises the rate and must not be flagged.
//
// HONEST LIMIT: duration cannot separate MILD truncation (>85% spoken) from
// naturally fast speech, so a small shortfall can still pass. Severe cases —
// the 21%-57% ones that prompted this work — are caught reliably. Erring
// toward false positives is deliberate: a false positive costs one retry,
// a false negative charges a user for a script they did not receive.
export const MAX_PLAUSIBLE_CHARS_PER_SECOND = 20

// ===========================================
// WHAT EACH ENGINE ACTUALLY COSTS
// ===========================================
// Published rates, converted to one comparable unit on 2026-09-16.
//
//   Fish s2.1-pro   $15.00 per million UTF-8 bytes   (docs.fish.audio)
//   Smallest v3.1   $0.09 per minute of audio        (smallest.ai/pricing)
//   Gemini/Kie.ai   prepaid credit, rate not published
//
// Smallest bills by TIME, so its per-character cost depends on speaking rate.
// Measured from 40 of our own preview files with ffprobe: 92 characters of
// script produces a median 6.24s of speech = 14.7 chars/sec. One minute is
// therefore ~882 characters.
//
// PER 1,000 CHARACTERS:
//     Fish      $0.0150
//     Smallest  $0.1020      <- 6.8x Fish for the same script
//
// This matters because Smallest is 249 of 359 voices AND supplies the default
// selection, so it is the path of least resistance for every user.
//
// AGAINST THE PRO PLAN (500,000 chars/month, Rs 3,998 ~ $45):
//     all on Fish       $7.50 cost   -> ~$38 margin
//     all on Smallest  $51.02 cost   -> NEGATIVE
//
// The 402 course-grant holders pay nothing at all, so every character they
// generate is pure cost: ~$20.5k/month if they all used their full allowance
// on Smallest, ~$2k/month at 10% utilisation.
//
// Also worth knowing: Fish concurrency is tiered by TOTAL PREPAID AMOUNT, not
// by subscription — 5 concurrent under $100, 15 at $100, 50 at $1,000, and the
// tier unlocks on prepayment rather than on spend. Prepaying $100 triples
// throughput and the money is still yours to spend on generation.
export const ENGINE_COST_PER_1K_CHARS = {
    fish: 0.0150,
    smallest: 0.1020,
} as const

// Measured, not assumed: 40 preview files via ffprobe, 2026-09-16.
export const MEASURED_SPEECH_CHARS_PER_SECOND = 14.7

// Credits
export const CREDITS_CONFIG = {
    FREE_TIER_CREDITS: 5000,
    COST_PER_CHARACTER: 1,
    MIN_BALANCE_FOR_GENERATION: 1,
} as const

// Cache TTLs (in seconds)
export const CACHE_TTL = {
    VOICES_LIST: 3600,
    USER_CREDITS: 60,
    USER_PROFILE: 300,
} as const

// Subscription Tiers
export const SUBSCRIPTION_TIERS = {
    FREE: 'free',
    STARTER: 'starter',
    PRO: 'pro',
    ENTERPRISE: 'enterprise',
} as const

export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[keyof typeof SUBSCRIPTION_TIERS]

// Generation Status
export const GENERATION_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
} as const

export type GenerationStatus = typeof GENERATION_STATUS[keyof typeof GENERATION_STATUS]

// HTTP Status Codes
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
} as const

// Error Messages
export const ERROR_MESSAGES = {
    UNAUTHORIZED: 'Authentication required',
    INSUFFICIENT_CREDITS: 'Insufficient credits',
    RATE_LIMITED: 'Too many requests. Please try again later.',
    INVALID_INPUT: 'Invalid input provided',
    GENERATION_FAILED: 'Voice generation failed',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
} as const

// Audio Configuration
export const AUDIO_CONFIG = {
    SUPPORTED_FORMATS: ['mp3', 'wav', 'ogg'] as const,
    DEFAULT_FORMAT: 'mp3',
    MAX_DURATION_SECONDS: 600,
    STORAGE_BUCKET: 'audio-generations',
} as const

// UI Configuration
export const UI_CONFIG = {
    TOAST_DURATION_MS: 5000,
    DEBOUNCE_DELAY_MS: 300,
    ANIMATION_DURATION_MS: 200,
    ITEMS_PER_PAGE: 20,
} as const

// Voice Models
export const VOICE_MODELS = {
    ELEVEN_MULTILINGUAL_V2: 'eleven_multilingual_v2',
    ELEVEN_TURBO_V2: 'eleven_turbo_v2',
    ELEVEN_MONOLINGUAL_V1: 'eleven_monolingual_v1',
} as const

export const DEFAULT_VOICE_MODEL = VOICE_MODELS.ELEVEN_MULTILINGUAL_V2

// Gradient classes for voice avatars
export const AVATAR_GRADIENTS = [
    'bg-gradient-to-br from-rose-400 to-orange-300',
    'bg-gradient-to-br from-emerald-400 to-cyan-300',
    'bg-gradient-to-br from-violet-400 to-purple-300',
    'bg-gradient-to-br from-pink-400 to-rose-300',
    'bg-gradient-to-br from-blue-400 to-cyan-300',
    'bg-gradient-to-br from-amber-400 to-yellow-300',
    'bg-gradient-to-br from-teal-400 to-green-300',
] as const

export function getAvatarGradient(index: number): string {
    return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]
}

export function getAvatarGradientByName(name: string): string {
    const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0)
    return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}

// ===========================================
// VOICE CATEGORIES & USE CASES
// ===========================================

export const VOICE_CATEGORIES = [
    'Commentary',
    'Documentary',
    'Storytelling',
    'Short Videos',
    'Crime & Suspense',
] as const

export const VOICE_USE_CASES = [
    { id: 'youtube', label: 'Best voices for Youtube', icon: '📺' },
    { id: 'shorts', label: 'Popular Shorts/Reels Voices', icon: '📱' },
    { id: 'character', label: 'Engaging character voices', icon: '🎭' },
    { id: 'studio', label: 'Studio quality commentary voices', icon: '🎙️' },
    { id: 'sleep', label: 'Bring your sleep stories to life', icon: '🌙' },
    { id: 'documentary', label: 'Epic voices for documentaries', icon: '🎬' },
    { id: 'asmr', label: 'Relaxing voices for ASMR', icon: '🎧' },
] as const

export type VoiceCategory = typeof VOICE_CATEGORIES[number]
export type VoiceUseCase = typeof VOICE_USE_CASES[number]['id']
