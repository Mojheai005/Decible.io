'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    getCachedVoices,
    setCachedVoices,
    isCacheStale,
    isCacheFresh,
} from '@/lib/voiceCache'
import { preloadVoicePreviews } from '@/lib/audioPreloader'

export interface Voice {
    id: string
    name: string
    category: string
    accent: string
    language: string
    gender: string
    age: string
    descriptive: string
    useCase: string
    previewUrl?: string
    description?: string
    tags: string[]
    usageCount?: number
    createdAt?: string
}

interface VoicesResponse {
    voices: Voice[]
    total: number
    categories: string[]
    languages: string[]
    accents: string[]
    availableCategories: string[]
}

interface UseVoicesResult {
    voices: Voice[]
    isLoading: boolean
    error: string | null
    refetch: () => Promise<void>
    categories: string[]
    languages: string[]
    accents: string[]
    availableCategories: string[]
    total: number
    isFromCache: boolean
    isRefreshing: boolean
}

export function useVoices(
    categoryFilter?: string,
    languageFilter?: string
): UseVoicesResult {
    const [data, setData] = useState<VoicesResponse>({
        voices: [],
        total: 0,
        categories: [],
        languages: [],
        accents: [],
        availableCategories: [],
    })
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isFromCache, setIsFromCache] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const initialLoadDone = useRef(false)

    // Load from cache immediately on mount
    useEffect(() => {
        if (initialLoadDone.current) return
        initialLoadDone.current = true

        const cachedData = getCachedVoices()
        if (cachedData && cachedData.voices.length > 0) {
            setData({
                voices: cachedData.voices,
                total: cachedData.total,
                categories: cachedData.categories,
                languages: cachedData.languages,
                accents: cachedData.accents,
                availableCategories: cachedData.categories,
            })
            setIsFromCache(true)
            setIsLoading(false)

            // If cache is stale, refresh in background
            if (isCacheStale(cachedData)) {
                setIsRefreshing(true)
            }
        }
    }, [])

    const fetchVoices = useCallback(async (isBackgroundRefresh = false) => {
        if (!isBackgroundRefresh) {
            setIsLoading(true)
        }
        setError(null)

        try {
            let url = '/api/voices?page_size=500'
            if (categoryFilter && categoryFilter !== 'all') {
                url += `&category=${encodeURIComponent(categoryFilter)}`
            }
            if (languageFilter && languageFilter !== 'all') {
                url += `&language=${encodeURIComponent(languageFilter)}`
            }

            const response = await fetch(url)

            if (!response.ok) {
                throw new Error(`Failed to fetch voices: ${response.status}`)
            }

            const result: VoicesResponse = await response.json()
            setData(result)
            setIsFromCache(false)

            // Preload first 10 voice previews for faster playback
            const previewUrls = result.voices
                .slice(0, 10)
                .map(v => v.previewUrl)
                .filter((url): url is string => !!url)
            preloadVoicePreviews(previewUrls, 5)

            // Update cache (only if no filters applied - cache the full set)
            if (!categoryFilter && !languageFilter) {
                setCachedVoices({
                    voices: result.voices,
                    total: result.total,
                    categories: result.categories,
                    languages: result.languages,
                    accents: result.accents,
                })
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch voices'
            // Only set error if we don't have cached data
            if (!data.voices.length) {
                setError(errorMessage)
            }
            console.error('Error fetching voices:', err)
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
        }
    }, [categoryFilter, languageFilter, data.voices.length])

    // Fetch on mount (or refresh if cache was stale)
    useEffect(() => {
        const cachedData = getCachedVoices()

        // If no cache or cache is stale, fetch fresh data
        if (!cachedData || isCacheStale(cachedData)) {
            fetchVoices(!!cachedData) // Background refresh if we have stale cache
        } else if (isCacheFresh(cachedData)) {
            // Fresh cache - no need to fetch
            setIsLoading(false)
        }
    }, [fetchVoices])

    // Refetch when filters change
    useEffect(() => {
        if (categoryFilter || languageFilter) {
            fetchVoices()
        }
    }, [categoryFilter, languageFilter, fetchVoices])

    return {
        voices: data.voices,
        isLoading,
        error,
        refetch: () => fetchVoices(false),
        categories: data.categories,
        languages: data.languages,
        accents: data.accents,
        availableCategories: data.availableCategories,
        total: data.total,
        isFromCache,
        isRefreshing,
    }
}
