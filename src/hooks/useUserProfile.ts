'use client'

import { useState, useEffect, useCallback } from 'react'

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

export function useUserProfile(): UseUserProfileResult {
    const [data, setData] = useState<ProfileResponse | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchProfile = useCallback(async (showLoading = true) => {
        if (showLoading) setIsLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/user/profile')

            if (!response.ok) {
                throw new Error(`Failed to fetch profile: ${response.status}`)
            }

            const result: ProfileResponse = await response.json()
            setData(result)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profile'
            setError(errorMessage)
            console.error('Error fetching profile:', err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchProfile(true)

        // Listen for credit updates from other components (e.g., after TTS generation)
        // Use silent refetch (no loading spinner) so sidebar doesn't flash
        const handleCreditsUpdated = () => { fetchProfile(false) }
        window.addEventListener('credits-updated', handleCreditsUpdated)
        return () => { window.removeEventListener('credits-updated', handleCreditsUpdated) }
    }, [fetchProfile])

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

            // Refresh profile after using credits
            await fetchProfile()
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
        refetch: fetchProfile,
        useCredits,
    }
}
