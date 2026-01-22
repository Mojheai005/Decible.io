import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Create admin client to bypass storage RLS
function getAdminClient() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing Supabase environment variables for storage upload');
    }

    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

export async function uploadAudio(audioBuffer: ArrayBuffer, userId: string): Promise<string> {
    // Use admin client to bypass RLS on storage
    const supabase = getAdminClient();
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;

    const { data, error } = await supabase
        .storage
        .from('generations')
        .upload(fileName, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: false
        });

    if (error) {
        console.error('Storage Upload Error:', error);
        throw new Error(`Failed to upload audio: ${error.message}`);
    }

    // Get Public URL
    const { data: { publicUrl } } = supabase
        .storage
        .from('generations')
        .getPublicUrl(fileName);

    return publicUrl;
}
