'use client'

import { useState, useEffect, useCallback } from 'react'

interface MyVoice {
    voiceId: string
    voiceName: string
    addedAt: string
}

interface MyVoicesResponse {
    voices: MyVoice[]
    slotsUsed: number
    slotsTotal: number
    slotsRemaining: number
    tier?: string
}

interface UseMyVoicesResult {
    myVoices: MyVoice[]
    slotsUsed: number
    slotsTotal: number
    slotsRemaining: number
    tier: string
    isLoading: boolean
    error: string | null
    addVoice: (voiceId: string, voiceName: string) => Promise<boolean>
    removeVoice: (voiceId: string) => Promise<boolean>
    isVoiceInMyVoices: (voiceId: string) => boolean
    refetch: () => Promise<void>
}

export function useMyVoices(): UseMyVoicesResult {
    const [data, setData] = useState<MyVoicesResponse>({
        voices: [],
        slotsUsed: 0,
        slotsTotal: 5,
        slotsRemaining: 5,
        tier: 'free',
    })
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchMyVoices = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/user/voices')

            if (!response.ok) {
                throw new Error(`Failed to fetch My Voices: ${response.status}`)
            }

            const result: MyVoicesResponse = await response.json()
            setData(result)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch My Voices'
            setError(errorMessage)
            console.error('Error fetching My Voices:', err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchMyVoices()
    }, [fetchMyVoices])

    const addVoice = useCallback(async (voiceId: string, voiceName: string): Promise<boolean> => {
        try {
            const response = await fetch('/api/user/voices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voiceId, voiceName }),
            })

            const result = await response.json()

            if (!response.ok) {
                setError(result.message || result.error || 'Failed to add voice')
                return false
            }

            // Refresh the list
            await fetchMyVoices()
            return true
        } catch (err) {
            setError('Failed to add voice')
            return false
        }
    }, [fetchMyVoices])

    const removeVoice = useCallback(async (voiceId: string): Promise<boolean> => {
        try {
            const response = await fetch(`/api/user/voices?voiceId=${voiceId}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                const result = await response.json()
                setError(result.error || 'Failed to remove voice')
                return false
            }

            // Refresh the list
            await fetchMyVoices()
            return true
        } catch (err) {
            setError('Failed to remove voice')
            return false
        }
    }, [fetchMyVoices])

    const isVoiceInMyVoices = useCallback((voiceId: string): boolean => {
        return data.voices.some(v => v.voiceId === voiceId)
    }, [data.voices])

    return {
        myVoices: data.voices,
        slotsUsed: data.slotsUsed,
        slotsTotal: data.slotsTotal,
        slotsRemaining: data.slotsRemaining,
        tier: data.tier || 'free',
        isLoading,
        error,
        addVoice,
        removeVoice,
        isVoiceInMyVoices,
        refetch: fetchMyVoices,
    }
}
