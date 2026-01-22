import { createClient } from '@supabase/supabase-js'

// ===========================================
// SUPABASE CLIENT CONFIGURATION
// ===========================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client (for client-side operations)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server client with service role (for server-side operations)
export const createServerClient = () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}

// ===========================================
// DATABASE TYPES
// ===========================================

export interface UserProfile {
    id: string
    email: string
    name?: string
    avatar_url?: string
    credits_remaining: number
    subscription_tier: 'free' | 'starter' | 'pro' | 'enterprise'
    created_at: string
    updated_at: string
}

export interface SavedVoice {
    id: string
    user_id: string
    voice_id: string
    voice_name: string
    created_at: string
}

export interface GenerationHistory {
    id: string
    user_id: string
    text: string
    voice_id: string
    voice_name: string
    audio_url: string
    duration_seconds: number
    characters_used: number
    settings: {
        speed: number
        stability: number
        similarity: number
        style: number
        speaker_boost: boolean
    }
    created_at: string
}

export interface VoiceCache {
    id: string
    voices_data: any[]
    total_count: number
    categories: string[]
    languages: string[]
    accents: string[]
    created_at: string
    updated_at: string
}

// ===========================================
// DATABASE OPERATIONS
// ===========================================

// User Profile
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

    if (error) {
        console.error('Error fetching user profile:', error)
        return null
    }
    return data
}

export async function updateUserCredits(userId: string, creditsUsed: number): Promise<boolean> {
    const { error } = await supabase.rpc('deduct_credits', {
        user_id: userId,
        amount: creditsUsed,
    })

    if (error) {
        console.error('Error updating credits:', error)
        return false
    }
    return true
}

// Saved Voices
export async function getSavedVoices(userId: string): Promise<SavedVoice[]> {
    const { data, error } = await supabase
        .from('saved_voices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching saved voices:', error)
        return []
    }
    return data || []
}

export async function saveVoice(userId: string, voiceId: string, voiceName: string): Promise<SavedVoice | null> {
    const { data, error } = await supabase
        .from('saved_voices')
        .insert({
            user_id: userId,
            voice_id: voiceId,
            voice_name: voiceName,
        })
        .select()
        .single()

    if (error) {
        console.error('Error saving voice:', error)
        return null
    }
    return data
}

export async function removeSavedVoice(userId: string, voiceId: string): Promise<boolean> {
    const { error } = await supabase
        .from('saved_voices')
        .delete()
        .eq('user_id', userId)
        .eq('voice_id', voiceId)

    if (error) {
        console.error('Error removing saved voice:', error)
        return false
    }
    return true
}

// Generation History
export async function getGenerationHistory(userId: string, limit = 50): Promise<GenerationHistory[]> {
    const { data, error } = await supabase
        .from('generation_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('Error fetching generation history:', error)
        return []
    }
    return data || []
}

export async function addGenerationHistory(history: Omit<GenerationHistory, 'id' | 'created_at'>): Promise<GenerationHistory | null> {
    const { data, error } = await supabase
        .from('generation_history')
        .insert(history)
        .select()
        .single()

    if (error) {
        console.error('Error adding generation history:', error)
        return null
    }
    return data
}

export async function deleteGenerationHistory(userId: string, historyId: string): Promise<boolean> {
    const { error } = await supabase
        .from('generation_history')
        .delete()
        .eq('user_id', userId)
        .eq('id', historyId)

    if (error) {
        console.error('Error deleting generation history:', error)
        return false
    }
    return true
}

// Voice Cache (for server-side caching)
export async function getCachedVoices(): Promise<VoiceCache | null> {
    const { data, error } = await supabase
        .from('voice_cache')
        .select('*')
        .single()

    if (error) {
        console.error('Error fetching voice cache:', error)
        return null
    }
    return data
}

export async function updateVoiceCache(cacheData: Omit<VoiceCache, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    const { error } = await supabase
        .from('voice_cache')
        .upsert({
            id: 'main_cache',
            ...cacheData,
            updated_at: new Date().toISOString(),
        })

    if (error) {
        console.error('Error updating voice cache:', error)
        return false
    }
    return true
}

export default supabase
