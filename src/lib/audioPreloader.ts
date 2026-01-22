// ===========================================
// AUDIO PRELOADER
// Preloads voice preview audio files for faster playback
// ===========================================

// Cache of preloaded audio elements
const audioCache = new Map<string, HTMLAudioElement>();
const preloadQueue: string[] = [];
let isPreloading = false;
const MAX_CACHED = 20; // Limit cache size

/**
 * Preload a single audio URL
 */
export function preloadAudio(url: string): Promise<void> {
    if (!url || typeof window === 'undefined') return Promise.resolve();

    // Already cached
    if (audioCache.has(url)) return Promise.resolve();

    return new Promise((resolve) => {
        const audio = new Audio();

        // Set to preload metadata only (faster, less data)
        audio.preload = 'metadata';

        audio.oncanplaythrough = () => {
            // Evict oldest if at max
            if (audioCache.size >= MAX_CACHED) {
                const firstKey = audioCache.keys().next().value;
                if (firstKey) {
                    audioCache.delete(firstKey);
                }
            }
            audioCache.set(url, audio);
            resolve();
        };

        audio.onerror = () => {
            // Fail silently - preloading is optional
            resolve();
        };

        // Start loading
        audio.src = url;
    });
}

/**
 * Get a preloaded audio element or create new one
 */
export function getPreloadedAudio(url: string): HTMLAudioElement {
    const cached = audioCache.get(url);
    if (cached) {
        // Clone the cached audio for fresh playback
        const clone = cached.cloneNode() as HTMLAudioElement;
        clone.currentTime = 0;
        return clone;
    }
    // Create new if not cached
    const audio = new Audio(url);
    audio.preload = 'auto';
    return audio;
}

/**
 * Preload multiple audio URLs (call with first N voice preview URLs)
 */
export function preloadVoicePreviews(urls: string[], batchSize = 5): void {
    if (typeof window === 'undefined') return;

    // Filter valid URLs not already cached
    const toPreload = urls.filter(url => url && !audioCache.has(url)).slice(0, batchSize);

    if (toPreload.length === 0) return;

    // Add to queue
    preloadQueue.push(...toPreload);

    // Start processing if not already
    if (!isPreloading) {
        processQueue();
    }
}

/**
 * Process preload queue sequentially to avoid network congestion
 */
async function processQueue(): Promise<void> {
    if (isPreloading || preloadQueue.length === 0) return;

    isPreloading = true;

    while (preloadQueue.length > 0) {
        const url = preloadQueue.shift();
        if (url) {
            await preloadAudio(url);
            // Small delay between loads to be nice to the network
            await new Promise(r => setTimeout(r, 100));
        }
    }

    isPreloading = false;
}

/**
 * Check if an audio URL is already preloaded
 */
export function isPreloaded(url: string): boolean {
    return audioCache.has(url);
}

/**
 * Clear the audio cache
 */
export function clearAudioCache(): void {
    audioCache.forEach(audio => {
        audio.src = '';
    });
    audioCache.clear();
    preloadQueue.length = 0;
}

/**
 * Get cache stats for debugging
 */
export function getAudioCacheStats(): { cached: number; queued: number } {
    return {
        cached: audioCache.size,
        queued: preloadQueue.length,
    };
}
