// ===========================================
// SCRIPT TO VOICE LIMITS — checked before anything is charged
// ===========================================
// A run generates and charges every part, then joins them into one file. Two
// things can make that join impossible: too many parts, or a joined file
// bigger than Supabase Storage accepts. Both used to surface only at the very
// end, after every part had been paid for.

import { getVoiceEngine } from './voices-data'
import { JOINED_BYTES_PER_CHAR, MAX_JOINED_FILE_BYTES, MEASURED_SPEECH_CHARS_PER_SECOND, SCRIPT_TO_VOICE_MAX_PARTS } from './constants'

/** Expected size of the joined file. Slower speech makes longer audio. */
export function estimateJoinedBytes(voiceId: string, characters: number, speed = 1): number {
    const perChar = JOINED_BYTES_PER_CHAR[getVoiceEngine(voiceId)]
    return Math.round(characters * perChar / Math.max(0.5, speed))
}

/** Roughly how many minutes of audio a script makes at normal pace. */
function minutesOf(characters: number, speed: number): number {
    return Math.max(1, Math.round(characters / (MEASURED_SPEECH_CHARS_PER_SECOND * Math.max(0.5, speed)) / 60))
}

/**
 * Why this script cannot be made into one file with this voice, or null if it
 * can. The advice depends on the engine: Gemini parts are short (400
 * characters) and its WAV audio is about three times larger than MP3.
 */
export function scriptLimitMessage(opts: {
    parts: number
    characters: number
    voiceId: string
    voiceName?: string
    speed?: number
}): string | null {
    const { parts, characters, voiceId, voiceName, speed = 1 } = opts
    const who = voiceName || 'this voice'
    const gemini = getVoiceEngine(voiceId) === 'gemini'
    const advice = gemini
        ? 'Pick a Fish Audio or Smallest voice, which can make much longer files, or split the script in two.'
        : 'Split the script into two or more parts and generate each one separately.'

    if (parts > SCRIPT_TO_VOICE_MAX_PARTS) {
        return `With ${who} this script needs ${parts} parts, and the most we can join into one file `
            + `is ${SCRIPT_TO_VOICE_MAX_PARTS}. ${advice}`
    }

    const bytes = estimateJoinedBytes(voiceId, characters, speed)
    if (bytes > MAX_JOINED_FILE_BYTES) {
        const fits = Math.floor(characters * MAX_JOINED_FILE_BYTES / bytes)
        return `With ${who} this script makes about ${minutesOf(characters, speed)} minutes of audio, `
            + `more than we can save as one file (about ${minutesOf(fits, speed)} minutes, or `
            + `${fits.toLocaleString('en-IN')} characters, with this voice). ${advice}`
    }
    return null
}
