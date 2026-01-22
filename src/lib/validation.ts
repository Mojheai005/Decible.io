// ===========================================
// INPUT VALIDATION & SANITIZATION
// ===========================================

import { GENERATION_LIMITS } from './constants'

/**
 * Sanitize text input to prevent XSS
 * Removes HTML tags and dangerous characters
 */
export function sanitizeText(input: string): string {
    if (!input) return ''

    return input
        // Remove HTML tags
        .replace(/<[^>]*>/g, '')
        // Remove script-like patterns
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Validate text for TTS generation
 */
export function validateTTSText(text: string): {
    isValid: boolean
    error?: string
    sanitized: string
} {
    const sanitized = sanitizeText(text)

    if (!sanitized) {
        return { isValid: false, error: 'Text is required', sanitized: '' }
    }

    if (sanitized.length < GENERATION_LIMITS.MIN_TEXT_LENGTH) {
        return {
            isValid: false,
            error: `Text must be at least ${GENERATION_LIMITS.MIN_TEXT_LENGTH} character`,
            sanitized,
        }
    }

    if (sanitized.length > GENERATION_LIMITS.MAX_TEXT_LENGTH) {
        return {
            isValid: false,
            error: `Text exceeds maximum length of ${GENERATION_LIMITS.MAX_TEXT_LENGTH} characters`,
            sanitized,
        }
    }

    return { isValid: true, sanitized }
}

/**
 * Validate voice ID format
 */
export function validateVoiceId(voiceId: string): boolean {
    if (!voiceId || typeof voiceId !== 'string') return false
    // Allow alphanumeric, hyphens, and underscores
    return /^[a-zA-Z0-9_-]+$/.test(voiceId)
}

/**
 * Validate voice settings
 */
export function validateVoiceSettings(settings: {
    stability?: number
    similarity?: number
    style?: number
    speed?: number
}): {
    isValid: boolean
    error?: string
    normalized: typeof settings
} {
    const normalized = { ...settings }

    // Normalize stability
    if (settings.stability !== undefined) {
        if (typeof settings.stability !== 'number' || isNaN(settings.stability)) {
            return { isValid: false, error: 'Invalid stability value', normalized }
        }
        normalized.stability = Math.max(
            GENERATION_LIMITS.MIN_STABILITY,
            Math.min(GENERATION_LIMITS.MAX_STABILITY, settings.stability)
        )
    }

    // Normalize similarity
    if (settings.similarity !== undefined) {
        if (typeof settings.similarity !== 'number' || isNaN(settings.similarity)) {
            return { isValid: false, error: 'Invalid similarity value', normalized }
        }
        normalized.similarity = Math.max(
            GENERATION_LIMITS.MIN_SIMILARITY,
            Math.min(GENERATION_LIMITS.MAX_SIMILARITY, settings.similarity)
        )
    }

    // Normalize style
    if (settings.style !== undefined) {
        if (typeof settings.style !== 'number' || isNaN(settings.style)) {
            return { isValid: false, error: 'Invalid style value', normalized }
        }
        normalized.style = Math.max(
            GENERATION_LIMITS.MIN_STYLE,
            Math.min(GENERATION_LIMITS.MAX_STYLE, settings.style)
        )
    }

    // Normalize speed
    if (settings.speed !== undefined) {
        if (typeof settings.speed !== 'number' || isNaN(settings.speed)) {
            return { isValid: false, error: 'Invalid speed value', normalized }
        }
        normalized.speed = Math.max(
            GENERATION_LIMITS.MIN_SPEED,
            Math.min(GENERATION_LIMITS.MAX_SPEED, settings.speed)
        )
    }

    return { isValid: true, normalized }
}

/**
 * Escape string for use in HTML
 */
export function escapeHtml(str: string): string {
    const htmlEntities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }
    return str.replace(/[&<>"']/g, (char) => htmlEntities[char] || char)
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text
    return text.substring(0, maxLength - 3) + '...'
}
