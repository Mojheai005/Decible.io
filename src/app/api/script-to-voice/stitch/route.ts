// ===========================================
// AUDIO STITCHER — Concatenate audio chunks into one file
// WAV (Gemini TTS output): parse RIFF chunks, concatenate the
//   PCM data sections, and write a single new header.
// MP3 (legacy fallback): frames are self-contained, so same-bitrate
//   files can be concatenated by byte appending (ID3 tags stripped).
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { TTS_OUTPUT_FORMAT } from '@/lib/kieai';

export const maxDuration = 120;

interface StitchRequest {
    audioUrls: string[];
    voiceName: string;
}

interface WavInfo {
    audioFormat: number;
    numChannels: number;
    sampleRate: number;
    bitsPerSample: number;
    data: Buffer;
}

function isWav(buffer: Buffer): boolean {
    return buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WAVE';
}

/**
 * Parse a WAV file: read the fmt chunk and extract the raw audio data chunk.
 */
function parseWav(buffer: Buffer, index: number): WavInfo {
    if (!isWav(buffer)) {
        throw new Error(`Chunk ${index + 1} is not a valid WAV file`);
    }

    let fmt: Omit<WavInfo, 'data'> | null = null;
    let data: Buffer | null = null;
    let offset = 12;

    while (offset + 8 <= buffer.length) {
        const chunkId = buffer.toString('ascii', offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);
        const chunkStart = offset + 8;

        if (chunkId === 'fmt ') {
            fmt = {
                audioFormat: buffer.readUInt16LE(chunkStart),
                numChannels: buffer.readUInt16LE(chunkStart + 2),
                sampleRate: buffer.readUInt32LE(chunkStart + 4),
                bitsPerSample: buffer.readUInt16LE(chunkStart + 14),
            };
        } else if (chunkId === 'data') {
            data = buffer.subarray(chunkStart, Math.min(chunkStart + chunkSize, buffer.length));
        }

        // Chunks are word-aligned: odd sizes are padded with one byte
        offset = chunkStart + chunkSize + (chunkSize % 2);
    }

    if (!fmt || !data) {
        throw new Error(`Chunk ${index + 1}: missing fmt or data section in WAV file`);
    }

    return { ...fmt, data };
}

/**
 * Concatenate parsed WAV chunks into a single PCM WAV file.
 * All chunks must share the same format/sample rate/channels.
 */
function concatenateWavs(wavs: WavInfo[]): Buffer {
    const first = wavs[0];
    for (let i = 1; i < wavs.length; i++) {
        const w = wavs[i];
        if (w.audioFormat !== first.audioFormat ||
            w.numChannels !== first.numChannels ||
            w.sampleRate !== first.sampleRate ||
            w.bitsPerSample !== first.bitsPerSample) {
            throw new Error(`Chunk ${i + 1} has a different audio format and cannot be stitched`);
        }
    }

    const totalDataSize = wavs.reduce((sum, w) => sum + w.data.length, 0);
    const byteRate = first.sampleRate * first.numChannels * (first.bitsPerSample / 8);
    const blockAlign = first.numChannels * (first.bitsPerSample / 8);

    const header = Buffer.alloc(44);
    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(36 + totalDataSize, 4);
    header.write('WAVE', 8, 'ascii');
    header.write('fmt ', 12, 'ascii');
    header.writeUInt32LE(16, 16);                       // fmt chunk size (PCM)
    header.writeUInt16LE(first.audioFormat, 20);
    header.writeUInt16LE(first.numChannels, 22);
    header.writeUInt32LE(first.sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(first.bitsPerSample, 34);
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(totalDataSize, 40);

    return Buffer.concat([header, ...wavs.map(w => w.data)]);
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

        // 4. Concatenate — WAV (current Gemini TTS output) or legacy MP3
        let concatenated: Buffer;
        let extension: string;
        let contentType: string;

        if (isWav(buffers[0])) {
            const wavs = buffers.map((buf, i) => parseWav(buf, i));
            concatenated = concatenateWavs(wavs);
            extension = TTS_OUTPUT_FORMAT.extension;
            contentType = TTS_OUTPUT_FORMAT.mimeType;
        } else {
            const parts: Buffer[] = buffers.map((buf, i) =>
                i === 0 ? buf : stripID3v2Header(buf)
            );
            concatenated = Buffer.concat(parts);
            extension = 'mp3';
            contentType = 'audio/mpeg';
        }

        // 5. Upload stitched audio to Supabase Storage
        const admin = getAdminClient();
        const stitchId = `stitch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const filePath = `${user.id}/${stitchId}.${extension}`;

        const { error: uploadError } = await admin.storage
            .from('audio-generations')
            .upload(filePath, concatenated, {
                contentType,
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
