// Which provider made a voice, and what a failure's error code means in plain English.
export const engineOf = (voiceId: string | null) =>
    voiceId === 'batch' ? 'Script to Voice join' : voiceId?.startsWith('sm-') ? 'Smallest' : voiceId?.startsWith('fish-') ? 'Fish' : 'Gemini'

const REASONS: Record<string, string> = {
    out_of_funds: 'Voice provider out of credit (our side)',
    auth: 'Voice provider key problem (our side)',
    timeout: 'Took too long and was stopped',
    transient: 'Voice provider glitch',
    capacity: 'Voice provider busy',
    storage: 'Audio could not be saved',
    rejected_input: 'Provider rejected the text or voice',
}

export function reasonOf(message: string | null): { code: string; label: string } {
    const code = /^([a-z_]+):/.exec(message || '')?.[1] || 'other'
    return { code, label: REASONS[code] || 'Other error' }
}
