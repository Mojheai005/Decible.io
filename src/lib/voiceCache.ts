// ===========================================
// VOICE CACHING SYSTEM
// Uses sessionStorage with compressed data to avoid quota issues
// ===========================================

import { Voice } from '@/hooks/useVoices'

const CACHE_KEY = 'nmm_voices_v2'
const CACHE_VERSION = '2.0'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// Minimal voice data for cache (reduces size by ~70%)
interface MinimalVoice {
    i: string  // id
    n: string  // name
    c: string  // category
    a: string  // accent
    l: string  // language
    g: string  // gender
    p?: string // previewUrl
}

interface CompressedCache {
    v: string      // version
    t: number      // timestamp
    d: MinimalVoice[] // voices data
    m: {           // metadata
        total: number
        cats: string[]
        langs: string[]
        accents: string[]
    }
}

// Public interface matches old VoiceCache for compatibility
interface VoiceCache {
    version: string
    timestamp: number
    voices: Voice[]
    total: number
    categories: string[]
    languages: string[]
    accents: string[]
}

// Convert full voice to minimal
function toMinimal(v: Voice): MinimalVoice {
    return {
        i: v.id,
        n: v.name,
        c: v.category || '',
        a: v.accent || '',
        l: v.language || '',
        g: v.gender || '',
        p: v.previewUrl,
    }
}

// Convert minimal back to full
function fromMinimal(m: MinimalVoice): Voice {
    return {
        id: m.i,
        name: m.n,
        category: m.c,
        accent: m.a,
        language: m.l,
        gender: m.g,
        age: '',
        descriptive: '',
        useCase: '',
        previewUrl: m.p,
        tags: [m.a, m.g].filter(Boolean),
    }
}

/**
 * Clear old localStorage cache on first load
 */
function clearOldCache(): void {
    try {
        localStorage.removeItem('decible_voices_cache')
        localStorage.removeItem('decible_voices_cache_v2')
    } catch {
        // Ignore
    }
}

/**
 * Get cached voices from sessionStorage
 */
export function getCachedVoices(): VoiceCache | null {
    if (typeof window === 'undefined') return null

    // Clear old cache once
    clearOldCache()

    try {
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (!cached) return null

        const data: CompressedCache = JSON.parse(cached)

        // Check version
        if (data.v !== CACHE_VERSION) {
            clearVoiceCache()
            return null
        }

        // Check TTL
        const age = Date.now() - data.t
        const isStale = age > CACHE_TTL_MS

        // Convert back to full format
        return {
            version: data.v,
            timestamp: isStale ? 0 : data.t, // Mark as stale if expired
            voices: data.d.map(fromMinimal),
            total: data.m.total,
            categories: data.m.cats,
            languages: data.m.langs,
            accents: data.m.accents,
        }
    } catch (error) {
        console.error('Error reading voice cache:', error)
        clearVoiceCache()
        return null
    }
}

/**
 * Check if cache is stale (expired but still usable)
 */
export function isCacheStale(cache: VoiceCache | null): boolean {
    if (!cache) return true
    return cache.timestamp === 0 || Date.now() - cache.timestamp > CACHE_TTL_MS
}

/**
 * Check if cache is valid and fresh
 */
export function isCacheFresh(cache: VoiceCache | null): boolean {
    if (!cache) return false
    return cache.timestamp > 0 && Date.now() - cache.timestamp <= CACHE_TTL_MS
}

/**
 * Save voices to sessionStorage cache (compressed)
 */
export function setCachedVoices(data: {
    voices: Voice[]
    total: number
    categories: string[]
    languages: string[]
    accents?: string[]
}): void {
    if (typeof window === 'undefined') return

    try {
        const compressed: CompressedCache = {
            v: CACHE_VERSION,
            t: Date.now(),
            d: data.voices.map(toMinimal),
            m: {
                total: data.total,
                cats: data.categories,
                langs: data.languages,
                accents: data.accents || [],
            },
        }

        sessionStorage.setItem(CACHE_KEY, JSON.stringify(compressed))
    } catch (error) {
        console.error('Error saving voice cache:', error)
        // Storage might be full - try to clear
        try {
            sessionStorage.removeItem(CACHE_KEY)
        } catch {
            // Ignore
        }
    }
}

/**
 * Clear the voice cache
 */
export function clearVoiceCache(): void {
    if (typeof window === 'undefined') return

    try {
        sessionStorage.removeItem(CACHE_KEY)
    } catch (error) {
        console.error('Error clearing voice cache:', error)
    }
}

/**
 * Get cache age in human readable format
 */
export function getCacheAge(): string {
    const cache = getCachedVoices()
    if (!cache || cache.timestamp === 0) return 'No cache'

    const ageMs = Date.now() - cache.timestamp
    const minutes = Math.floor(ageMs / 60000)
    const seconds = Math.floor((ageMs % 60000) / 1000)

    if (minutes > 0) {
        return `${minutes}m ${seconds}s ago`
    }
    return `${seconds}s ago`
}

/**
 * Preload voices into cache (call on app init)
 */
export async function preloadVoices(): Promise<void> {
    const cache = getCachedVoices()

    // If cache is fresh, no need to preload
    if (isCacheFresh(cache)) return

    try {
        const response = await fetch('/api/voices?page_size=500')
        if (response.ok) {
            const data = await response.json()
            setCachedVoices({
                voices: data.voices || [],
                total: data.total || 0,
                categories: data.categories || [],
                languages: data.languages || [],
                accents: data.accents || [],
            })
        }
    } catch (error) {
        console.error('Error preloading voices:', error)
    }
}
