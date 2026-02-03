import { NextResponse } from 'next/server';
import {
    VOICES_DATA,
    VOICE_CATEGORIES,
    getAllLanguages,
    getAllAccents,
    getAllUseCases,
    generateUsageCount,
} from '@/lib/voices-data';

// Transform voice data to match the existing frontend interface
function transformVoice(v: typeof VOICES_DATA[0]) {
    return {
        id: v.id,
        name: v.name,
        category: v.category,
        accent: v.accent,
        language: v.language,
        gender: v.gender,
        age: v.age,
        descriptive: v.description,
        useCase: v.category,
        useCases: v.useCases,
        previewUrl: null, // Will be generated on-demand via /api/voices/preview
        description: v.description,
        tags: v.tags,
        usageCount: generateUsageCount(v.name),
        createdAt: new Date().toISOString(),
    };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const language = searchParams.get('language');
        const useCase = searchParams.get('useCase');
        const search = searchParams.get('search');

        // Start with all voices
        let filteredVoices = [...VOICES_DATA];

        // Filter by category
        if (category && category !== 'all') {
            filteredVoices = filteredVoices.filter(v => v.category === category);
        }

        // Filter by language
        if (language && language !== 'all') {
            filteredVoices = filteredVoices.filter(v =>
                v.language.toLowerCase() === language.toLowerCase()
            );
        }

        // Filter by use case
        if (useCase && useCase !== 'all') {
            filteredVoices = filteredVoices.filter(v =>
                v.useCases.includes(useCase)
            );
        }

        // Search filter
        if (search) {
            const searchLower = search.toLowerCase();
            filteredVoices = filteredVoices.filter(v =>
                v.name.toLowerCase().includes(searchLower) ||
                v.description.toLowerCase().includes(searchLower) ||
                v.category.toLowerCase().includes(searchLower) ||
                v.accent.toLowerCase().includes(searchLower) ||
                v.tags.some(tag => tag.toLowerCase().includes(searchLower))
            );
        }

        // Transform to frontend format
        const voices = filteredVoices.map(transformVoice);

        // Get all metadata for filters
        const languages = getAllLanguages();
        const accents = getAllAccents();
        const useCases = getAllUseCases();

        return NextResponse.json({
            voices,
            total: voices.length,
            totalAll: VOICES_DATA.length,
            categories: [...VOICE_CATEGORIES],
            languages,
            accents,
            useCases,
        });

    } catch (error) {
        console.error('Voices API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
