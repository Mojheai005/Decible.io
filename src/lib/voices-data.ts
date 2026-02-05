// ===========================================
// VOICE DATA - Kie.ai ElevenLabs v2.5 Turbo
// Only voices supported by Kie.ai API
// ===========================================

export interface VoiceData {
    id: string           // Unique identifier (voice name lowercase, no spaces)
    name: string         // Display name
    voiceName: string    // Actual voice name to send to API
    category: string     // Our custom category
    gender: 'male' | 'female' | 'neutral'
    accent: string
    language: string
    age: string
    description: string
    useCases: string[]
    previewText?: string
    tags: string[]
}

// Our 5 categories
export const VOICE_CATEGORIES = [
    'Commentary',
    'Documentary',
    'Storytelling',
    'Short Videos',
    'Crime & Suspense',
] as const

export type VoiceCategory = typeof VOICE_CATEGORIES[number]

// Kie.ai supported voice names (ElevenLabs v2.5 Turbo preset voices)
export const SUPPORTED_VOICE_NAMES = [
    'Rachel', 'Aria', 'Roger', 'Sarah', 'Laura',
    'Charlie', 'George', 'Callum', 'River', 'Liam',
    'Charlotte', 'Alice', 'Matilda', 'Will', 'Jessica',
    'Eric', 'Chris', 'Brian', 'Daniel', 'Lily', 'Bill',
] as const

// Complete voice library — ALL voices are verified Kie.ai supported names
export const VOICES_DATA: VoiceData[] = [
    // =========================================
    // COMMENTARY VOICES
    // =========================================
    {
        id: 'brian',
        name: 'Brian',
        voiceName: 'Brian',
        category: 'Commentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Natural conversational tone, great for podcasts and YouTube',
        useCases: ['youtube', 'studio'],
        tags: ['natural', 'conversational', 'podcast', 'male', 'American'],
    },
    {
        id: 'chris',
        name: 'Chris',
        voiceName: 'Chris',
        category: 'Commentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Friendly, approachable male voice for commentary',
        useCases: ['youtube', 'studio', 'shorts'],
        tags: ['friendly', 'approachable', 'casual', 'male', 'American'],
    },
    {
        id: 'daniel',
        name: 'Daniel',
        voiceName: 'Daniel',
        category: 'Commentary',
        gender: 'male',
        accent: 'British',
        language: 'English',
        age: 'Adult',
        description: 'Sophisticated British male voice for professional content',
        useCases: ['youtube', 'documentary', 'studio'],
        tags: ['sophisticated', 'British', 'refined', 'male'],
    },
    {
        id: 'bill',
        name: 'Bill',
        voiceName: 'Bill',
        category: 'Commentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Middle Aged',
        description: 'Experienced, authoritative voice for commentary',
        useCases: ['youtube', 'documentary', 'studio'],
        tags: ['experienced', 'authoritative', 'mature', 'male', 'American'],
    },
    {
        id: 'roger',
        name: 'Roger',
        voiceName: 'Roger',
        category: 'Commentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Middle Aged',
        description: 'Deep, confident male voice with a broadcast quality',
        useCases: ['youtube', 'studio', 'documentary'],
        tags: ['deep', 'confident', 'broadcast', 'male', 'American'],
    },

    // =========================================
    // DOCUMENTARY VOICES
    // =========================================
    {
        id: 'george',
        name: 'George',
        voiceName: 'George',
        category: 'Documentary',
        gender: 'male',
        accent: 'British',
        language: 'English',
        age: 'Adult',
        description: 'Classic British narrator, perfect for documentaries',
        useCases: ['documentary', 'youtube'],
        tags: ['British', 'classic', 'narrator', 'male'],
    },
    {
        id: 'liam',
        name: 'Liam',
        voiceName: 'Liam',
        category: 'Documentary',
        gender: 'male',
        accent: 'Irish',
        language: 'English',
        age: 'Adult',
        description: 'Warm Irish accent, thoughtful and engaging',
        useCases: ['documentary', 'youtube', 'studio'],
        tags: ['Irish', 'warm', 'thoughtful', 'male'],
    },
    {
        id: 'will',
        name: 'Will',
        voiceName: 'Will',
        category: 'Documentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Calm, measured voice for educational and documentary content',
        useCases: ['documentary', 'youtube', 'sleep'],
        tags: ['calm', 'measured', 'educational', 'male', 'American'],
    },
    {
        id: 'eric',
        name: 'Eric',
        voiceName: 'Eric',
        category: 'Documentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Rich, resonant voice for nature and history documentaries',
        useCases: ['documentary', 'youtube'],
        tags: ['rich', 'resonant', 'nature', 'male', 'American'],
    },

    // =========================================
    // STORYTELLING VOICES
    // =========================================
    {
        id: 'rachel',
        name: 'Rachel',
        voiceName: 'Rachel',
        category: 'Storytelling',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Warm, expressive female voice for storytelling',
        useCases: ['youtube', 'sleep', 'character'],
        tags: ['warm', 'expressive', 'storytelling', 'female', 'American'],
    },
    {
        id: 'alice',
        name: 'Alice',
        voiceName: 'Alice',
        category: 'Storytelling',
        gender: 'female',
        accent: 'British',
        language: 'English',
        age: 'Adult',
        description: 'Gentle, whimsical voice for fairy tales and stories',
        useCases: ['sleep', 'character', 'youtube'],
        tags: ['gentle', 'whimsical', 'fairy tale', 'female', 'British'],
    },
    {
        id: 'matilda',
        name: 'Matilda',
        voiceName: 'Matilda',
        category: 'Storytelling',
        gender: 'female',
        accent: 'Australian',
        language: 'English',
        age: 'Adult',
        description: 'Warm Australian accent, natural and engaging storyteller',
        useCases: ['youtube', 'sleep', 'character'],
        tags: ['warm', 'Australian', 'natural', 'female'],
    },
    {
        id: 'callum',
        name: 'Callum',
        voiceName: 'Callum',
        category: 'Storytelling',
        gender: 'male',
        accent: 'Scottish',
        language: 'English',
        age: 'Adult',
        description: 'Scottish accent, captivating voice for adventure stories',
        useCases: ['character', 'youtube', 'documentary'],
        tags: ['Scottish', 'captivating', 'adventure', 'male'],
    },
    {
        id: 'lily',
        name: 'Lily',
        voiceName: 'Lily',
        category: 'Storytelling',
        gender: 'female',
        accent: 'British',
        language: 'English',
        age: 'Young Adult',
        description: 'Sweet, melodic voice for bedtime and children stories',
        useCases: ['sleep', 'character', 'asmr'],
        tags: ['sweet', 'melodic', 'bedtime', 'female', 'British'],
    },

    // =========================================
    // SHORT VIDEOS VOICES
    // =========================================
    {
        id: 'aria',
        name: 'Aria',
        voiceName: 'Aria',
        category: 'Short Videos',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Young Adult',
        description: 'Trendy, energetic voice perfect for reels and shorts',
        useCases: ['shorts', 'youtube', 'character'],
        tags: ['trendy', 'energetic', 'reels', 'female', 'American'],
    },
    {
        id: 'charlie',
        name: 'Charlie',
        voiceName: 'Charlie',
        category: 'Short Videos',
        gender: 'male',
        accent: 'Australian',
        language: 'English',
        age: 'Young Adult',
        description: 'Laid-back Australian voice, great for casual short-form content',
        useCases: ['shorts', 'youtube'],
        tags: ['laid-back', 'Australian', 'casual', 'male'],
    },
    {
        id: 'jessica',
        name: 'Jessica',
        voiceName: 'Jessica',
        category: 'Short Videos',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Young Adult',
        description: 'Bright, relatable female voice for TikTok and YouTube Shorts',
        useCases: ['shorts', 'youtube', 'studio'],
        tags: ['bright', 'relatable', 'social media', 'female', 'American'],
    },
    {
        id: 'river',
        name: 'River',
        voiceName: 'River',
        category: 'Short Videos',
        gender: 'neutral',
        accent: 'American',
        language: 'English',
        age: 'Young Adult',
        description: 'Gender-neutral, modern voice for inclusive content',
        useCases: ['shorts', 'youtube', 'character'],
        tags: ['neutral', 'modern', 'inclusive', 'American'],
    },

    // =========================================
    // CRIME & SUSPENSE VOICES
    // =========================================
    {
        id: 'sarah',
        name: 'Sarah',
        voiceName: 'Sarah',
        category: 'Crime & Suspense',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Compelling, intense voice for true crime narration',
        useCases: ['youtube', 'documentary'],
        tags: ['compelling', 'intense', 'true crime', 'female', 'American'],
    },
    {
        id: 'charlotte',
        name: 'Charlotte',
        voiceName: 'Charlotte',
        category: 'Crime & Suspense',
        gender: 'female',
        accent: 'British',
        language: 'English',
        age: 'Adult',
        description: 'Mysterious British voice, perfect for suspense and thriller narration',
        useCases: ['youtube', 'documentary', 'character'],
        tags: ['mysterious', 'British', 'suspense', 'female'],
    },
    {
        id: 'laura',
        name: 'Laura',
        voiceName: 'Laura',
        category: 'Crime & Suspense',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Serious, dramatic voice for crime documentaries',
        useCases: ['youtube', 'documentary'],
        tags: ['serious', 'dramatic', 'crime', 'female', 'American'],
    },
]

// Helper functions
export function getVoiceById(id: string): VoiceData | undefined {
    return VOICES_DATA.find(v => v.id === id)
}

export function getVoiceByName(name: string): VoiceData | undefined {
    return VOICES_DATA.find(v => v.voiceName.toLowerCase() === name.toLowerCase())
}

export function getVoicesByCategory(category: VoiceCategory): VoiceData[] {
    return VOICES_DATA.filter(v => v.category === category)
}

export function getVoicesByLanguage(language: string): VoiceData[] {
    return VOICES_DATA.filter(v => v.language.toLowerCase() === language.toLowerCase())
}

export function getVoicesByUseCase(useCase: string): VoiceData[] {
    return VOICES_DATA.filter(v => v.useCases.includes(useCase))
}

export function searchVoices(query: string): VoiceData[] {
    const q = query.toLowerCase()
    return VOICES_DATA.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.accent.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.tags.some(t => t.toLowerCase().includes(q))
    )
}

// Get all unique values for filters
export function getAllLanguages(): string[] {
    return [...new Set(VOICES_DATA.map(v => v.language))].sort()
}

export function getAllAccents(): string[] {
    return [...new Set(VOICES_DATA.map(v => v.accent))].sort()
}

export function getAllUseCases(): string[] {
    const useCases = new Set<string>()
    VOICES_DATA.forEach(v => v.useCases.forEach(uc => useCases.add(uc)))
    return [...useCases].sort()
}

// Generate a deterministic usage count based on voice name (for display purposes)
export function generateUsageCount(voiceName: string): number {
    let hash = 0
    for (let i = 0; i < voiceName.length; i++) {
        const char = voiceName.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    return Math.abs(hash % 900000) + 100000
}
