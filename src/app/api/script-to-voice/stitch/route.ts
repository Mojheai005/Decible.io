// ===========================================
// AUDIO STITCHER — Concatenate MP3 chunks into one file
// MP3 frames are self-contained: same-bitrate files can
// be concatenated by byte appending.
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 120;

interface StitchRequest {
    audioUrls: string[];
    voiceName: string;
}

/**
 * Strip ID3v2 header from MP3 buffer (if present).
 * ID3v2 tags at the start of intermediate chunks cause playback glitches.
 * First chunk keeps its tag, subsequent chunks are stripped.
 */
function stripID3v2Header(buffer: Buffer): Buffer {
    // ID3v2 starts with "ID3"
    if (buffer.length >= 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
        // Size is encoded as 4 syncsafe bytes at offset 6
        const size =
            ((buffer[6] & 0x7f) << 21) |
            ((buffer[7] & 0x7f) << 14) |
            ((buffer[8] & 0x7f) << 7) |
            (buffer[9] & 0x7f);
        const headerSize = 10 + size;
        if (headerSize < buffer.length) {
            return buffer.subarray(headerSize);
        }
    }
    return buffer;
}

export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate user
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // 2. Parse request
        const body = await request.json() as StitchRequest;
        const { audioUrls, voiceName } = body;

        if (!audioUrls || audioUrls.length === 0) {
            return NextResponse.json({ error: 'No audio URLs provided' }, { status: 400 });
        }

        if (audioUrls.length > 50) {
            return NextResponse.json({ error: 'Too many chunks (max 50)' }, { status: 400 });
        }

        // 3. Fetch all audio buffers in parallel
        const bufferPromises = audioUrls.map(async (url, index) => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch chunk ${index + 1}: ${response.status}`);
            }
            return Buffer.from(await response.arrayBuffer());
        });

        const buffers = await Promise.all(bufferPromises);

        // 4. Concatenate MP3 buffers — strip ID3 headers from chunks after the first
        const parts: Buffer[] = buffers.map((buf, i) =>
            i === 0 ? buf : stripID3v2Header(buf)
        );
        const concatenated = Buffer.concat(parts);

        // 5. Upload stitched audio to Supabase Storage
        const admin = getAdminClient();
        const stitchId = `stitch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const filePath = `${user.id}/${stitchId}.mp3`;

        const { error: uploadError } = await admin.storage
            .from('audio-generations')
            .upload(filePath, concatenated, {
                contentType: 'audio/mpeg',
                upsert: true,
            });

        if (uploadError) {
            console.error('Failed to upload stitched audio:', uploadError);
            return NextResponse.json({ error: 'Failed to store stitched audio' }, { status: 500 });
        }

        const { data: urlData } = admin.storage
            .from('audio-generations')
            .getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
            return NextResponse.json({ error: 'Failed to get audio URL' }, { status: 500 });
        }

        // 6. Save to generation history
        const totalSize = concatenated.length;
        await admin.from('generation_history').insert({
            user_id: user.id,
            text: `Script to Voice: ${audioUrls.length} chunks stitched`,
            voice_id: 'batch',
            voice_name: voiceName || 'Script Voice',
            audio_url: urlData.publicUrl,
            characters_used: 0, // Credits already charged per-chunk
            credits_used: 0,
            settings: { type: 'script-to-voice', chunks: audioUrls.length, totalSize },
            status: 'completed',
        });

        return NextResponse.json({
            success: true,
            audioUrl: urlData.publicUrl,
            totalChunks: audioUrls.length,
            totalSize,
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Stitch failed';
        console.error('Stitch error:', msg, error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
