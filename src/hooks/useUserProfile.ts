'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface UserProfile {
    id: string
    email: string
    name: string
    plan: string
    totalCredits: number
    usedCredits: number
    remainingCredits: number
    resetDate: string
    createdAt: string
}

export interface Transaction {
    id: string
    date: string
    type: string
    amount: number
    status: string
    description?: string
}

export interface Plan {
    id: string
    name: string
    credits: number
    price: number
}

interface ProfileResponse {
    profile: UserProfile
    transactions: Transaction[]
    plans: Plan[]
}

interface UseUserProfileResult {
    profile: UserProfile | null
    transactions: Transaction[]
    plans: Plan[]
    isLoading: boolean
    error: string | null
    refetch: () => Promise<void>
    useCredits: (amount: number, type?: string) => Promise<boolean>
}

// --- SessionStorage cache for profile ---
const PROFILE_CACHE_KEY = 'decible_profile_cache'
const PROFILE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface CachedProfile {
    data: ProfileResponse
    timestamp: number
}

function getCachedProfile(): ProfileResponse | null {
    try {
        const raw = sessionStorage.getItem(PROFILE_CACHE_KEY)
        if (!raw) return null
        const cached: CachedProfile = JSON.parse(raw)
        if (Date.now() - cached.timestamp > PROFILE_CACHE_TTL) return null
        return cached.data
    } catch {
        return null
    }
}

function setCachedProfile(data: ProfileResponse) {
    try {
        const cached: CachedProfile = { data, timestamp: Date.now() }
        sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cached))
    } catch { /* ignore storage errors */ }
}

export function clearProfileCache() {
    try { sessionStorage.removeItem(PROFILE_CACHE_KEY) } catch { /* ignore */ }
    // Also clear in-flight so next fetch is fresh
    inFlightFetch = null
}

// --- Module-level deduplication ---
// When multiple components call useUserProfile, only ONE network request is made.
// All others share the same promise.
let inFlightFetch: Promise<ProfileResponse> | null = null
let subscribers: Array<(data: ProfileResponse) => void> = []

async function fetchProfileOnce(): Promise<ProfileResponse> {
    if (inFlightFetch) return inFlightFetch

    inFlightFetch = fetch('/api/user/profile').then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`)
        const result: ProfileResponse = await res.json()
        setCachedProfile(result)
        // Notify all subscribers
        subscribers.forEach(fn => fn(result))
        return result
    }).finally(() => {
        // Clear after 100ms to allow micro-batched calls to share
        setTimeout(() => { inFlightFetch = null }, 100)
    })

    return inFlightFetch
}

// Prefetch profile and store in cache — call this on sign-in BEFORE React re-renders
export function prefetchProfile() {
    fetchProfileOnce().catch(() => { /* ignore, components will retry */ })
}

export function useUserProfile(enabled = true): UseUserProfileResult {
    const [data, setData] = useState<ProfileResponse | null>(() => {
        // Initialize from cache synchronously to avoid flicker
        if (enabled) return getCachedProfile()
        return null
    })
    const [isLoading, setIsLoading] = useState(enabled && !data)
    const [error, setError] = useState<string | null>(null)
    const enabledRef = useRef(enabled)
    enabledRef.current = enabled

    const fetchProfile = useCallback(async (showLoading = true) => {
        if (!enabledRef.current) return
        if (showLoading) setIsLoading(true)
        setError(null)

        try {
            const result = await fetchProfileOnce()
            setData(result)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profile'
            setError(prev => prev ?? errorMessage)
            console.error('Error fetching profile:', err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Subscribe to shared fetch updates from other hook instances
    useEffect(() => {
        if (!enabled) return
        const handler = (result: ProfileResponse) => { setData(result) }
        subscribers.push(handler)
        return () => { subscribers = subscribers.filter(fn => fn !== handler) }
    }, [enabled])

    // Fetch when enabled changes to true
    useEffect(() => {
        if (!enabled) {
            setData(null)
            setIsLoading(false)
            return
        }

        // Load from cache first
        const cached = getCachedProfile()
        if (cached) {
            setData(cached)
            setIsLoading(false)
            // Still refresh in background
            fetchProfile(false)
        } else {
            fetchProfile(true)
        }
    }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

    // Listen for credit updates from other components
    useEffect(() => {
        if (!enabled) return
        const handleCreditsUpdated = () => {
            inFlightFetch = null // Force fresh fetch
            fetchProfile(false)
        }
        window.addEventListener('credits-updated', handleCreditsUpdated)
        return () => { window.removeEventListener('credits-updated', handleCreditsUpdated) }
    }, [enabled, fetchProfile])

    const useCredits = useCallback(async (amount: number, type?: string): Promise<boolean> => {
        try {
            const response = await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ creditsUsed: amount, type }),
            })

            if (!response.ok) {
                return false
            }

            inFlightFetch = null // Force fresh fetch after credit use
            await fetchProfile(false)
            return true
        } catch (err) {
            console.error('Error using credits:', err)
            return false
        }
    }, [fetchProfile])

    return {
        profile: data?.profile || null,
        transactions: data?.transactions || [],
        plans: data?.plans || [],
        isLoading,
        error,
        refetch: () => { inFlightFetch = null; return fetchProfile(false) },
        useCredits,
    }
}
