// ===========================================
// AUDIO STITCHER — Concatenate audio chunks into one file
// WAV (Gemini TTS output): parse RIFF chunks, concatenate the
//   PCM data sections, and write a single new header.
// MP3 (Fish, Smallest): frames are self-contained, but each part opens
//   with a frame stating its own length; see lib/mp3-join.
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { TTS_OUTPUT_FORMAT } from '@/lib/kieai';
import { SCRIPT_TO_VOICE_MAX_PARTS } from '@/lib/constants';
import { joinMp3Parts } from '@/lib/mp3-join';
import { logger } from '@/lib/logger';

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

        if (audioUrls.length > SCRIPT_TO_VOICE_MAX_PARTS) {
            return NextResponse.json(
                { error: `Too many parts to join (the most is ${SCRIPT_TO_VOICE_MAX_PARTS})` },
                { status: 400 },
            );
        }

        // Only the caller's own saved parts. This route used to download any
        // address the browser sent it.
        const admin = getAdminClient();
        const ownFolder = admin.storage.from('audio-generations').getPublicUrl(`${user.id}/`).data.publicUrl;
        // Compare the normalised address, so "/../" cannot step outside the folder.
        const isOwnPart = (url: unknown) => {
            if (typeof url !== 'string') return false;
            try { return new URL(url).href.startsWith(ownFolder) && !/%2e%2e|\.\./i.test(url); } catch { return false; }
        };
        if (!audioUrls.every(isOwnPart)) {
            return NextResponse.json({ error: 'These audio parts do not belong to your account.' }, { status: 400 });
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

        // 4. Concatenate. Format is sniffed from the first chunk:
        //    MP3 = Fish Audio (the default engine), WAV = Kie/Gemini.
        let concatenated: Buffer;
        let extension: string;
        let contentType: string;

        if (isWav(buffers[0])) {
            const wavs = buffers.map((buf, i) => parseWav(buf, i));
            concatenated = concatenateWavs(wavs);
            extension = TTS_OUTPUT_FORMAT.extension;
            contentType = TTS_OUTPUT_FORMAT.mimeType;
        } else {
            const joined = joinMp3Parts(buffers);
            concatenated = joined.file;
            extension = 'mp3';
            contentType = 'audio/mpeg';
            const unparsed = joined.stats.filter(s => s.coverage < 0.9).length;
            if (unparsed) {
                logger.warn('Joined MP3 parts that did not parse as frames', { event: 's2v.mp3_unparsed', userId: user.id, parts: buffers.length, unparsed });
            }
        }

        // 5. Upload stitched audio to Supabase Storage
        const stitchId = `stitch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const filePath = `${user.id}/${stitchId}.${extension}`;

        const { error: uploadError } = await admin.storage
            .from('audio-generations')
            .upload(filePath, concatenated, {
                contentType,
                upsert: true,
            });

        if (uploadError) {
            const tooLarge = /maximum allowed size|too large|413/i.test(`${uploadError.message} ${(uploadError as { statusCode?: string }).statusCode ?? ''}`);
            logger.error('Could not store the joined voiceover', undefined, {
                event: 's2v.join_store_failed', userId: user.id, parts: audioUrls.length,
                bytes: concatenated.length, tooLarge, detail: uploadError.message,
            });
            return NextResponse.json(
                tooLarge
                    ? {
                        error: `The finished voiceover (${(concatenated.length / 1e6).toFixed(0)} MB) is larger than we can save as one file. `
                            + 'Every part is saved; split the script into two runs.',
                        code: 'too_large',
                    }
                    : { error: 'Failed to store stitched audio', code: 'storage' },
                { status: tooLarge ? 413 : 500 },
            );
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
        logger.error('Joining voiceover parts failed', error instanceof Error ? error : undefined, { event: 's2v.join_failed', detail: msg });
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
