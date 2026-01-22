import { NextResponse } from 'next/server';

const DUBVOICE_BASE_URL = 'https://www.dubvoice.ai/api/v1';

// Generate consistent usage count based on voice ID (deterministic)
const generateUsageCount = (voiceId: string): number => {
    let hash = 0;
    for (let i = 0; i < voiceId.length; i++) {
        const char = voiceId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash % 900000) + 100000;
};

// Enhanced Categories with more keywords for better matching
const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'Commentary': [
        'news', 'commentary', 'explain', 'deep', 'serious', 'authoritative', 'studio',
        'podcast', 'narrator', 'conversation', 'professional', 'corporate', 'business',
        'formal', 'presenter', 'anchor', 'broadcast', 'radio', 'host', 'announcer',
        'matt', 'adam', 'josh', 'chris', 'brian', 'eric', 'james', 'michael'
    ],
    'Documentary': [
        'history', 'nature', 'facts', 'slow', 'narration', 'knowledge', 'calm',
        'educational', 'science', 'geographic', 'wise', 'thoughtful', 'informative',
        'documentary', 'educational', 'lecture', 'teacher', 'professor', 'narrator',
        'david', 'richard', 'george', 'william', 'robert'
    ],
    'Storytelling': [
        'story', 'book', 'audiobook', 'character', 'emotion', 'fantasy', 'child',
        'drama', 'novel', 'reading', 'warm', 'friendly', 'gentle', 'soothing',
        'bedtime', 'fairy', 'tale', 'narrative', 'expressive', 'animated',
        'rachel', 'sarah', 'emily', 'jessica', 'amy', 'nicole', 'bella', 'grace'
    ],
    'Short Videos': [
        'tiktok', 'social', 'shorts', 'reels', 'energetic', 'fast', 'promo', 'ad',
        'marketing', 'hype', 'viral', 'advertisement', 'youtube', 'yt', 'vlog',
        'upbeat', 'exciting', 'dynamic', 'young', 'trendy', 'influencer', 'content',
        'creator', 'engaging', 'fun', 'lively', 'enthusiastic'
    ],
    'Crime & Suspense': [
        'thriller', 'dark', 'suspense', 'whisper', 'tense', 'scary', 'fear',
        'mystery', 'horror', 'crime', 'detective', 'noir', 'dramatic', 'intense',
        'gravelly', 'deep', 'brooding', 'sinister', 'ominous', 'haunting'
    ]
};

// Use Case Keywords for better matching
const USE_CASE_KEYWORDS: Record<string, string[]> = {
    'youtube': ['youtube', 'vlog', 'tutorial', 'review', 'commentary', 'educational', 'explainer'],
    'shorts': ['tiktok', 'shorts', 'reels', 'viral', 'energetic', 'upbeat', 'fast'],
    'character': ['character', 'animation', 'game', 'cartoon', 'voice acting', 'expressive'],
    'studio': ['studio', 'professional', 'broadcast', 'commercial', 'high quality'],
    'sleep': ['calm', 'soothing', 'relaxing', 'gentle', 'bedtime', 'meditation', 'asmr'],
    'documentary': ['documentary', 'nature', 'history', 'educational', 'informative'],
    'asmr': ['whisper', 'soft', 'gentle', 'relaxing', 'soothing', 'calm', 'intimate']
};

// Language mapping
const LANGUAGE_MAP: Record<string, string> = {
    'en': 'English',
    'en-us': 'English',
    'en-gb': 'English',
    'hi': 'Hindi',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'pl': 'Polish',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ru': 'Russian',
    'ar': 'Arabic',
    'tr': 'Turkish',
    'nl': 'Dutch',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
};

const getLanguageName = (code: string) => {
    if (!code) return 'English';
    return LANGUAGE_MAP[code.toLowerCase()] || code || 'English';
};

const determineCategory = (voice: any): string => {
    const text = `${voice.name} ${voice.category || ''} ${voice.description || ''} ${voice.labels?.description || ''} ${voice.gender || ''}`.toLowerCase();

    // Score each category
    const scores: Record<string, number> = {};
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        scores[cat] = keywords.filter(k => text.includes(k)).length;
    }

    // Find category with highest score
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0) {
        for (const [cat, score] of Object.entries(scores)) {
            if (score === maxScore) return cat;
        }
    }

    // Fallback based on voice characteristics
    if (voice.gender === 'male') {
        if (text.includes('young') || text.includes('energetic')) return 'Short Videos';
        return 'Commentary';
    }
    if (voice.gender === 'female') {
        if (text.includes('soft') || text.includes('gentle')) return 'Storytelling';
        return 'Storytelling';
    }

    return 'Commentary';
};

const determineUseCases = (voice: any): string[] => {
    const text = `${voice.name} ${voice.description || ''} ${voice.labels?.description || ''} ${voice.category || ''}`.toLowerCase();
    const useCases: string[] = [];

    for (const [useCase, keywords] of Object.entries(USE_CASE_KEYWORDS)) {
        if (keywords.some(k => text.includes(k))) {
            useCases.push(useCase);
        }
    }

    // Default use cases based on category if none found
    if (useCases.length === 0) {
        const category = determineCategory(voice);
        if (category === 'Commentary') useCases.push('youtube', 'studio');
        if (category === 'Documentary') useCases.push('documentary', 'youtube');
        if (category === 'Storytelling') useCases.push('sleep', 'character');
        if (category === 'Short Videos') useCases.push('shorts', 'youtube');
        if (category === 'Crime & Suspense') useCases.push('character', 'documentary');
    }

    return useCases;
};

// Fetch all voices with pagination - tries multiple pagination strategies
async function fetchAllVoices(apiKey: string): Promise<any[]> {
    const allVoices: any[] = [];
    let page = 1;
    const pageSize = 100;
    let consecutiveEmptyPages = 0;

    // Try fetching with page numbers until we get empty results
    while (consecutiveEmptyPages < 2) {

        // Try different pagination parameter styles (different APIs use different params)
        const params = new URLSearchParams({
            page: page.toString(),
            page_size: pageSize.toString(),
            per_page: pageSize.toString(),
            limit: pageSize.toString(),
            offset: ((page - 1) * pageSize).toString(),
        });

        const response = await fetch(`${DUBVOICE_BASE_URL}/voices?${params}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            if (page === 1) {
                throw new Error(`Failed to fetch voices: ${response.status}`);
            }
            break;
        }

        const data = await response.json();

        // Handle different response structures
        let voices: any[] = [];
        if (Array.isArray(data)) {
            voices = data;
        } else if (data.voices) {
            voices = data.voices;
        } else if (data.data) {
            voices = data.data;
        } else if (data.items) {
            voices = data.items;
        } else if (data.results) {
            voices = data.results;
        }

        // Deduplicate by voice_id
        const newVoices = voices.filter(v =>
            !allVoices.some(existing => existing.voice_id === v.voice_id)
        );

        if (newVoices.length === 0) {
            consecutiveEmptyPages++;
        } else {
            consecutiveEmptyPages = 0;
            allVoices.push(...newVoices);
        }

        // Check explicit pagination indicators
        const hasMore = data.has_more === true ||
                       data.hasMore === true ||
                       data.next_page !== null ||
                       data.nextPage !== null ||
                       (data.total && allVoices.length < data.total) ||
                       (data.total_count && allVoices.length < data.total_count);

        if (!hasMore && voices.length < pageSize) {
            break;
        }

        page++;

        // Safety limit
        if (page > 100) {
            break;
        }
    }

    return allVoices;
}

export async function GET(request: Request) {
    try {
        const apiKey = process.env.DUBVOICE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing DubVoice API Key' }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const fetchAll = searchParams.get('fetch_all') === 'true';

        // Fetch all voices with pagination
        const rawVoices = await fetchAllVoices(apiKey);
        console.log(`Total voices fetched: ${rawVoices.length}`);

        // Transform voices
        const voices = rawVoices.map((v: any) => {
            const calculatedCategory = determineCategory(v);
            const langName = getLanguageName(v.language);
            const useCases = determineUseCases(v);

            return {
                id: v.voice_id,
                name: v.name,
                category: calculatedCategory,
                accent: v.accent || v.labels?.accent || 'Neutral',
                language: langName,
                gender: v.gender || v.labels?.gender || 'Unknown',
                age: v.labels?.age || 'Adult',
                descriptive: v.labels?.description || v.description || '',
                useCase: calculatedCategory,
                useCases: useCases,
                previewUrl: v.preview_url || v.previewUrl || v.sample_url || v.sampleUrl || v.audio_url || v.audioUrl || null,
                description: v.description || v.labels?.description || '',
                tags: [
                    calculatedCategory,
                    langName,
                    v.gender,
                    v.accent,
                    ...useCases
                ].filter(Boolean),
                usageCount: generateUsageCount(v.voice_id || v.name),
                createdAt: new Date().toISOString(),
                // Store original API data for reference
                original: {
                    category: v.category,
                    labels: v.labels,
                }
            };
        });

        // Filter by category if specified
        let filteredVoices = voices;
        if (category && category !== 'all') {
            filteredVoices = filteredVoices.filter((v: any) => v.category === category);
        }

        // Get unique languages and accents
        const languages = [...new Set(voices.map((v: any) => v.language))].sort();
        const accents = [...new Set(voices.map((v: any) => v.accent))].filter(Boolean).sort();

        return NextResponse.json({
            voices: filteredVoices,
            total: filteredVoices.length,
            totalAll: voices.length,
            categories: Object.keys(CATEGORY_KEYWORDS),
            languages,
            accents,
            useCases: Object.keys(USE_CASE_KEYWORDS),
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
