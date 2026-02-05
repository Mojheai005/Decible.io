// ===========================================
// VOICE DATA - Kie.ai ElevenLabs v2.5 Turbo
// Supports preset names AND ElevenLabs voice IDs
// Static previews via: https://static.aiquickdraw.com/elevenlabs/voice/<id>.mp3
// ===========================================

export interface VoiceData {
    id: string           // Unique identifier (voice name lowercase, no spaces)
    name: string         // Display name shown to user
    voiceName: string    // Value sent to Kie.ai API (preset name OR ElevenLabs voice ID)
    elevenLabsId?: string // ElevenLabs voice ID for preview URLs and extended voices
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

// Static preview URL base (from Kie.ai docs)
export const VOICE_PREVIEW_BASE_URL = 'https://static.aiquickdraw.com/elevenlabs/voice'

// Kie.ai supported preset voice names (can be used directly by name)
export const SUPPORTED_PRESET_NAMES = [
    'Rachel', 'Aria', 'Roger', 'Sarah', 'Laura',
    'Charlie', 'George', 'Callum', 'River', 'Liam',
    'Charlotte', 'Alice', 'Matilda', 'Will', 'Jessica',
    'Eric', 'Chris', 'Brian', 'Daniel', 'Lily', 'Bill',
] as const

// Complete voice library — 40+ voices
// - Preset voices: voiceName = human-readable name (e.g. "Rachel")
// - Extended voices: voiceName = ElevenLabs voice ID (e.g. "pNInz6obpgDQGcFmaJgB")
// Both are accepted by Kie.ai API input.voice field
export const VOICES_DATA: VoiceData[] = [
    // =========================================
    // COMMENTARY VOICES (Professional, Clear, Authoritative)
    // Great for: YouTube videos, podcasts, news, business content
    // =========================================
    {
        id: 'brian',
        name: 'Brian',
        voiceName: 'Brian',
        elevenLabsId: 'nPczCjzI2devNBz1zQrb',
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
        elevenLabsId: 'iP95p4xoKVk53GoZ742B',
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
        elevenLabsId: 'onwK4e9ZLuTAKqWW03F9',
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
        elevenLabsId: 'pqHfZKP75CvOlQylNhV4',
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
    {
        id: 'adam',
        name: 'Adam',
        voiceName: 'pNInz6obpgDQGcFmaJgB',
        elevenLabsId: 'pNInz6obpgDQGcFmaJgB',
        category: 'Commentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Deep, professional male voice with a confident tone',
        useCases: ['youtube', 'studio', 'documentary'],
        tags: ['deep', 'professional', 'confident', 'male', 'American'],
    },
    {
        id: 'josh',
        name: 'Josh',
        voiceName: 'TxGEqnHWrfWFTfGW9XjX',
        elevenLabsId: 'TxGEqnHWrfWFTfGW9XjX',
        category: 'Commentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Young Adult',
        description: 'Young, energetic male voice perfect for tech content',
        useCases: ['youtube', 'shorts', 'studio'],
        tags: ['young', 'energetic', 'tech', 'male', 'American'],
    },
    {
        id: 'ethan',
        name: 'Ethan',
        voiceName: 'g5CIjZEefAph4nQFvHAz',
        elevenLabsId: 'g5CIjZEefAph4nQFvHAz',
        category: 'Commentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Young Adult',
        description: 'Modern, relatable young male voice',
        useCases: ['youtube', 'shorts', 'studio'],
        tags: ['modern', 'relatable', 'young', 'male', 'American'],
    },
    {
        id: 'patrick',
        name: 'Patrick',
        voiceName: 'ODq5zmih8GrVes37Dizd',
        elevenLabsId: 'ODq5zmih8GrVes37Dizd',
        category: 'Commentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Engaging storyteller voice with podcast presence',
        useCases: ['youtube', 'studio', 'documentary'],
        tags: ['engaging', 'storyteller', 'male', 'American'],
    },
    {
        id: 'michael',
        name: 'Michael',
        voiceName: 'flq6f7yk4E4fJM5XTYuZ',
        elevenLabsId: 'flq6f7yk4E4fJM5XTYuZ',
        category: 'Commentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Warm, trustworthy male voice for professional content',
        useCases: ['youtube', 'studio', 'documentary'],
        tags: ['warm', 'trustworthy', 'professional', 'male', 'American'],
    },
    {
        id: 'paul',
        name: 'Paul',
        voiceName: '5Q0t7uMcjvnagumLfvZi',
        elevenLabsId: '5Q0t7uMcjvnagumLfvZi',
        category: 'Commentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Polished, articulate voice for news and business commentary',
        useCases: ['youtube', 'studio'],
        tags: ['polished', 'articulate', 'news', 'male', 'American'],
    },

    // =========================================
    // DOCUMENTARY VOICES (Thoughtful, Educational, Wise)
    // Great for: Documentaries, educational content, nature videos
    // =========================================
    {
        id: 'george',
        name: 'George',
        voiceName: 'George',
        elevenLabsId: 'JBFqnCBsd6RMkjVDRZzb',
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
        elevenLabsId: 'TX3LPaxmHKxFdv7VOQHJ',
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
    {
        id: 'clyde',
        name: 'Clyde',
        voiceName: '2EiwWnXFnvU5JabPnv8n',
        elevenLabsId: '2EiwWnXFnvU5JabPnv8n',
        category: 'Documentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Middle Aged',
        description: 'Deep, thoughtful voice perfect for documentaries',
        useCases: ['documentary', 'youtube'],
        tags: ['deep', 'thoughtful', 'documentary', 'male', 'American'],
    },
    {
        id: 'harry',
        name: 'Harry',
        voiceName: 'SOYHLrjzK2X1ezoPC6cr',
        elevenLabsId: 'SOYHLrjzK2X1ezoPC6cr',
        category: 'Documentary',
        gender: 'male',
        accent: 'British',
        language: 'English',
        age: 'Adult',
        description: 'Distinguished British documentary narrator',
        useCases: ['documentary', 'youtube'],
        tags: ['distinguished', 'British', 'narrator', 'male'],
    },
    {
        id: 'thomas',
        name: 'Thomas',
        voiceName: 'GBv7mTt0atIp3Br8iCZE',
        elevenLabsId: 'GBv7mTt0atIp3Br8iCZE',
        category: 'Documentary',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Calm, measured voice for educational content',
        useCases: ['documentary', 'youtube', 'sleep'],
        tags: ['calm', 'measured', 'educational', 'male', 'American'],
    },
    {
        id: 'joseph',
        name: 'Joseph',
        voiceName: 'Zlb1dXrM653N07WRdFW3',
        elevenLabsId: 'Zlb1dXrM653N07WRdFW3',
        category: 'Documentary',
        gender: 'male',
        accent: 'British',
        language: 'English',
        age: 'Middle Aged',
        description: 'Wise, gravitas-filled voice for historical documentaries',
        useCases: ['documentary', 'youtube'],
        tags: ['wise', 'gravitas', 'historical', 'male', 'British'],
    },
    {
        id: 'dave',
        name: 'Dave',
        voiceName: 'CYw3kZ02Hs0563khs1Fj',
        elevenLabsId: 'CYw3kZ02Hs0563khs1Fj',
        category: 'Documentary',
        gender: 'male',
        accent: 'British',
        language: 'English',
        age: 'Adult',
        description: 'Conversational British voice for explainer documentaries',
        useCases: ['documentary', 'youtube', 'studio'],
        tags: ['conversational', 'British', 'explainer', 'male'],
    },

    // =========================================
    // STORYTELLING VOICES (Expressive, Warm, Immersive)
    // Great for: Audiobooks, children stories, bedtime stories
    // =========================================
    {
        id: 'rachel',
        name: 'Rachel',
        voiceName: 'Rachel',
        elevenLabsId: '21m00Tcm4TlvDq8ikWAM',
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
        elevenLabsId: 'Xb7hH8MSUJpSbSDYk0k2',
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
        elevenLabsId: 'XrExE9yKIg1WjnnlVkGX',
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
        elevenLabsId: 'N2lVS1w4EtoT3dr4eOWO',
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
        elevenLabsId: 'pFZP5JQG7iQjIQuC4Bku',
        category: 'Storytelling',
        gender: 'female',
        accent: 'British',
        language: 'English',
        age: 'Young Adult',
        description: 'Sweet, melodic voice for bedtime and children stories',
        useCases: ['sleep', 'character', 'asmr'],
        tags: ['sweet', 'melodic', 'bedtime', 'female', 'British'],
    },
    {
        id: 'dorothy',
        name: 'Dorothy',
        voiceName: 'ThT5KcBeYPX3keUQqHPh',
        elevenLabsId: 'ThT5KcBeYPX3keUQqHPh',
        category: 'Storytelling',
        gender: 'female',
        accent: 'British',
        language: 'English',
        age: 'Middle Aged',
        description: 'Classic storytelling voice with a cozy, grandmotherly warmth',
        useCases: ['sleep', 'character', 'youtube'],
        tags: ['classic', 'warm', 'cozy', 'female', 'British'],
    },
    {
        id: 'glinda',
        name: 'Glinda',
        voiceName: 'z9fAnlkpzviPz146aGWa',
        elevenLabsId: 'z9fAnlkpzviPz146aGWa',
        category: 'Storytelling',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Magical, enchanting voice for fantasy storytelling',
        useCases: ['sleep', 'character'],
        tags: ['magical', 'enchanting', 'fantasy', 'female', 'American'],
    },
    {
        id: 'grace',
        name: 'Grace',
        voiceName: 'oWAxZDx7w5VEj9dCyTzz',
        elevenLabsId: 'oWAxZDx7w5VEj9dCyTzz',
        category: 'Storytelling',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Elegant, soothing voice for literary audiobooks',
        useCases: ['sleep', 'youtube', 'character'],
        tags: ['elegant', 'soothing', 'audiobook', 'female', 'American'],
    },
    {
        id: 'nicole',
        name: 'Nicole',
        voiceName: 'piTKgcLEGmPE4e6mEKli',
        elevenLabsId: 'piTKgcLEGmPE4e6mEKli',
        category: 'Storytelling',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Smooth, relaxing female voice for immersive narratives',
        useCases: ['sleep', 'youtube', 'asmr'],
        tags: ['smooth', 'relaxing', 'immersive', 'female', 'American'],
    },
    {
        id: 'jeremy',
        name: 'Jeremy',
        voiceName: 'bVMeCyTHy58xNoL34h3p',
        elevenLabsId: 'bVMeCyTHy58xNoL34h3p',
        category: 'Storytelling',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Engaging male narrator with a fireside storytelling quality',
        useCases: ['youtube', 'sleep', 'character'],
        tags: ['engaging', 'fireside', 'narrator', 'male', 'American'],
    },

    // =========================================
    // SHORT VIDEOS VOICES (Energetic, Trendy, Casual)
    // Great for: TikTok, YouTube Shorts, Reels, memes
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
        elevenLabsId: 'IKne3meq5aSn9XLyUdCD',
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
    {
        id: 'jessie',
        name: 'Jessie',
        voiceName: 't0jbNlBVZ17f02VDIeMI',
        elevenLabsId: 't0jbNlBVZ17f02VDIeMI',
        category: 'Short Videos',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Young Adult',
        description: 'Upbeat, bubbly voice for fun and playful content',
        useCases: ['shorts', 'youtube', 'character'],
        tags: ['upbeat', 'bubbly', 'playful', 'female', 'American'],
    },
    {
        id: 'mimi',
        name: 'Mimi',
        voiceName: 'zrHiDhphv9ZnVXBqCLjz',
        elevenLabsId: 'zrHiDhphv9ZnVXBqCLjz',
        category: 'Short Videos',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Young Adult',
        description: 'Cute, expressive voice perfect for memes and reels',
        useCases: ['shorts', 'character'],
        tags: ['cute', 'expressive', 'meme', 'female', 'American'],
    },
    {
        id: 'fin',
        name: 'Fin',
        voiceName: 'D38z5RcWu1voky8WS1ja',
        elevenLabsId: 'D38z5RcWu1voky8WS1ja',
        category: 'Short Videos',
        gender: 'male',
        accent: 'Irish',
        language: 'English',
        age: 'Young Adult',
        description: 'Witty Irish voice, great for humorous shorts',
        useCases: ['shorts', 'youtube', 'character'],
        tags: ['witty', 'Irish', 'humorous', 'male'],
    },
    {
        id: 'gigi',
        name: 'Gigi',
        voiceName: 'jBpfuIE2acCO8z3wKNLl',
        elevenLabsId: 'jBpfuIE2acCO8z3wKNLl',
        category: 'Short Videos',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Young Adult',
        description: 'Animated, youthful voice for social media content',
        useCases: ['shorts', 'character'],
        tags: ['animated', 'youthful', 'social media', 'female', 'American'],
    },
    {
        id: 'drew',
        name: 'Drew',
        voiceName: '29vD33N1CtxCmqQRPOHJ',
        elevenLabsId: '29vD33N1CtxCmqQRPOHJ',
        category: 'Short Videos',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Charismatic, smooth voice for vlogs and explainers',
        useCases: ['shorts', 'youtube', 'studio'],
        tags: ['charismatic', 'smooth', 'vlog', 'male', 'American'],
    },
    {
        id: 'emily',
        name: 'Emily',
        voiceName: 'LcfcDJNUP1GQjkzn1xUU',
        elevenLabsId: 'LcfcDJNUP1GQjkzn1xUU',
        category: 'Short Videos',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Young Adult',
        description: 'Fresh, vibrant voice for lifestyle and beauty content',
        useCases: ['shorts', 'youtube'],
        tags: ['fresh', 'vibrant', 'lifestyle', 'female', 'American'],
    },

    // =========================================
    // CRIME & SUSPENSE VOICES (Dark, Intense, Dramatic)
    // Great for: True crime, horror, thriller, mystery content
    // =========================================
    {
        id: 'sarah',
        name: 'Sarah',
        voiceName: 'Sarah',
        elevenLabsId: 'EXAVITQu4vr4xnSDxMaL',
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
        elevenLabsId: 'XB0fDUnXU5powFXDhCwa',
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
    {
        id: 'arnold',
        name: 'Arnold',
        voiceName: 'VR6AewLTigWG4xSOukaG',
        elevenLabsId: 'VR6AewLTigWG4xSOukaG',
        category: 'Crime & Suspense',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Strong, commanding male voice with dark authority',
        useCases: ['youtube', 'documentary', 'character'],
        tags: ['strong', 'commanding', 'dark', 'male', 'American'],
    },
    {
        id: 'sam',
        name: 'Sam',
        voiceName: 'yoZ06aMxZJJ28mfd3POQ',
        elevenLabsId: 'yoZ06aMxZJJ28mfd3POQ',
        category: 'Crime & Suspense',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Clear, articulate voice ideal for mystery narration',
        useCases: ['youtube', 'documentary'],
        tags: ['clear', 'articulate', 'mystery', 'male', 'American'],
    },
    {
        id: 'serena',
        name: 'Serena',
        voiceName: 'pMsXgVXv3BLzUgSXRplE',
        elevenLabsId: 'pMsXgVXv3BLzUgSXRplE',
        category: 'Crime & Suspense',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Sultry, atmospheric voice for dark narratives',
        useCases: ['youtube', 'documentary', 'character'],
        tags: ['sultry', 'atmospheric', 'dark', 'female', 'American'],
    },
    {
        id: 'freya',
        name: 'Freya',
        voiceName: 'jsCqWAovK2LkecY7zXl4',
        elevenLabsId: 'jsCqWAovK2LkecY7zXl4',
        category: 'Crime & Suspense',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Haunting, ethereal voice for horror and suspense',
        useCases: ['youtube', 'character'],
        tags: ['haunting', 'ethereal', 'horror', 'female', 'American'],
    },
    {
        id: 'antoni',
        name: 'Antoni',
        voiceName: 'ErXwobaYiN019PkySvjV',
        elevenLabsId: 'ErXwobaYiN019PkySvjV',
        category: 'Crime & Suspense',
        gender: 'male',
        accent: 'American',
        language: 'English',
        age: 'Adult',
        description: 'Smooth, intense voice for psychological thriller narration',
        useCases: ['youtube', 'documentary', 'character'],
        tags: ['smooth', 'intense', 'thriller', 'male', 'American'],
    },
    {
        id: 'domi',
        name: 'Domi',
        voiceName: 'AZnzlk1XvdvUeBnXmlld',
        elevenLabsId: 'AZnzlk1XvdvUeBnXmlld',
        category: 'Crime & Suspense',
        gender: 'female',
        accent: 'American',
        language: 'English',
        age: 'Young Adult',
        description: 'Edgy, assertive voice for gritty crime content',
        useCases: ['youtube', 'character'],
        tags: ['edgy', 'assertive', 'gritty', 'female', 'American'],
    },
    {
        id: 'giovanni',
        name: 'Giovanni',
        voiceName: 'zcAOhNBS3c14rBihAFp1',
        elevenLabsId: 'zcAOhNBS3c14rBihAFp1',
        category: 'Crime & Suspense',
        gender: 'male',
        accent: 'Italian',
        language: 'English',
        age: 'Adult',
        description: 'Deep, dramatic voice with Italian influence for noir content',
        useCases: ['youtube', 'documentary', 'character'],
        tags: ['deep', 'dramatic', 'noir', 'male', 'Italian'],
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

// Get the static preview URL for a voice
// Uses Kie.ai's static preview endpoint when elevenLabsId is available
export function getVoicePreviewUrl(voice: VoiceData): string | null {
    if (voice.elevenLabsId) {
        return `${VOICE_PREVIEW_BASE_URL}/${voice.elevenLabsId}.mp3`
    }
    return null
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
