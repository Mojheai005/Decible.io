import { NextResponse } from 'next/server';
import { getVoiceById, getVoicePreviewUrl } from '@/lib/voices-data';

// Returns the stored preview sample for a catalog voice.
//
// This route used to fall back to generating a sample with Kie.ai for any
// voice_id it did not recognise. It needs no login and has no rate limit, so
// anyone could spend Kie.ai credit through it, one paid generation per
// request. The app never relies on that fallback: every catalog voice has a
// stored sample. It is gone.
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const voiceId = searchParams.get('voice_id');

    if (!voiceId) {
        return NextResponse.json({ error: 'voice_id is required' }, { status: 400 });
    }

    const voiceData = getVoiceById(voiceId);
    const staticUrl = voiceData ? getVoicePreviewUrl(voiceData) : null;

    if (!staticUrl) {
        return NextResponse.json({ error: 'No preview available for this voice' }, { status: 404 });
    }

    return NextResponse.json({
        previewUrl: staticUrl,
        cached: true,
        source: 'static',
    });
}
