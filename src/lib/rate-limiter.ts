// ===========================================
// RATE LIMITING INFRASTRUCTURE (Production-Ready)
// Uses Supabase for distributed rate limiting
// ===========================================

import { RATE_LIMITS, HTTP_STATUS, ERROR_MESSAGES } from './constants'
import { logger } from './logger'
import { getAdminClient } from './supabase/admin'

interface RateLimitResult {
    success: boolean
    limit: number
    remaining: number
    resetAt: number
    retryAfter?: number
}

// ===========================================
// SUPABASE-BASED RATE LIMITER (Production)
// ===========================================

export async function checkRateLimit(
    identifier: string,
    limit: number,
    windowMs: number
): Promise<RateLimitResult> {
    const now = Date.now()
    const windowSeconds = Math.ceil(windowMs / 1000)
    const key = identifier

    try {
        const admin = getAdminClient()

        // Use the stored procedure for atomic rate limit check
        const { data, error } = await admin.rpc('check_rate_limit', {
            p_key: key,
            p_limit: limit,
            p_window_seconds: windowSeconds,
        })

        if (error) {
            // If RPC fails, fall back to allowing the request (fail-open)
            logger.error('Rate limit check failed', error instanceof Error ? error : new Error(String(error)), { identifier })
            return {
                success: true,
                limit,
                remaining: limit - 1,
                resetAt: now + windowMs,
            }
        }

        const success = data === true
        const resetAt = now + windowMs

        // Get current count for accurate remaining
        const { data: countData } = await admin
            .from('rate_limits')
            .select('count')
            .eq('key', key)
            .single()

        const count = countData?.count || 1
        const remaining = Math.max(0, limit - count)

        if (!success) {
            logger.warn('Rate limit exceeded', {
                identifier,
                limit,
                count,
                resetAt,
            })
        }

        return {
            success,
            limit,
            remaining,
            resetAt,
            retryAfter: success ? undefined : Math.ceil(windowMs / 1000),
        }
    } catch (error) {
        // Fail-open: allow request if rate limiting fails
        logger.error('Rate limiter error', error instanceof Error ? error : new Error(String(error)), { identifier })
        return {
            success: true,
            limit,
            remaining: limit - 1,
            resetAt: now + windowMs,
        }
    }
}

// ===========================================
// MIDDLEWARE HELPERS
// ===========================================

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetAt.toString(),
    }

    if (result.retryAfter) {
        headers['Retry-After'] = result.retryAfter.toString()
    }

    return headers
}

export function createRateLimitResponse(result: RateLimitResult): Response {
    return new Response(
        JSON.stringify({
            error: ERROR_MESSAGES.RATE_LIMITED,
            retryAfter: result.retryAfter,
        }),
        {
            status: HTTP_STATUS.TOO_MANY_REQUESTS,
            headers: {
                'Content-Type': 'application/json',
                ...getRateLimitHeaders(result),
            },
        }
    )
}

// ===========================================
// RATE LIMIT CONFIGURATIONS BY TIER
// ===========================================

export const TIER_RATE_LIMITS = {
    free: {
        generationsPerMinute: 3,
        generationsPerHour: 30,
    },
    starter: {
        generationsPerMinute: 5,
        generationsPerHour: 100,
    },
    creator: {
        generationsPerMinute: 10,
        generationsPerHour: 200,
    },
    pro: {
        generationsPerMinute: 15,
        generationsPerHour: 400,
    },
    advanced: {
        generationsPerMinute: 20,
        generationsPerHour: 600,
    },
} as const

export const rateLimitConfigs = {
    generation: {
        limit: RATE_LIMITS.GENERATION_REQUESTS_PER_MINUTE,
        windowMs: RATE_LIMITS.MINUTE,
    },
    generationHourly: {
        limit: RATE_LIMITS.GENERATION_REQUESTS_PER_HOUR,
        windowMs: RATE_LIMITS.HOUR,
    },
    voices: {
        limit: RATE_LIMITS.VOICES_REQUESTS_PER_MINUTE,
        windowMs: RATE_LIMITS.MINUTE,
    },
    credits: {
        limit: RATE_LIMITS.CREDITS_REQUESTS_PER_MINUTE,
        windowMs: RATE_LIMITS.MINUTE,
    },
} as const

// ===========================================
// COMPOSITE RATE LIMITER
// ===========================================

export async function checkMultipleRateLimits(
    identifier: string,
    configs: Array<{ name: string; limit: number; windowMs: number }>
): Promise<{ success: boolean; failedLimit?: string; result?: RateLimitResult }> {
    for (const config of configs) {
        const key = `${identifier}:${config.name}`
        const result = await checkRateLimit(key, config.limit, config.windowMs)

        if (!result.success) {
            return {
                success: false,
                failedLimit: config.name,
                result,
            }
        }
    }

    return { success: true }
}

// ===========================================
// TIER-AWARE RATE LIMITING
// ===========================================

export async function checkUserRateLimit(
    userId: string,
    tier: keyof typeof TIER_RATE_LIMITS,
    endpoint: string
): Promise<RateLimitResult> {
    const limits = TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS.free

    if (endpoint === 'generation') {
        // Check both minute and hourly limits
        const minuteKey = `user:${userId}:generation:minute`
        const hourlyKey = `user:${userId}:generation:hour`

        const minuteResult = await checkRateLimit(
            minuteKey,
            limits.generationsPerMinute,
            60 * 1000
        )

        if (!minuteResult.success) {
            return minuteResult
        }

        const hourlyResult = await checkRateLimit(
            hourlyKey,
            limits.generationsPerHour,
            60 * 60 * 1000
        )

        return hourlyResult
    }

    // Default rate limiting
    const key = `user:${userId}:${endpoint}`
    return checkRateLimit(key, 60, 60 * 1000)
}

// ===========================================
// IP EXTRACTION HELPER
// ===========================================

export function getClientIP(request: Request): string {
    const headers = request.headers

    // Cloudflare
    const cfConnectingIP = headers.get('cf-connecting-ip')
    if (cfConnectingIP) return cfConnectingIP

    // Standard proxy headers
    const xForwardedFor = headers.get('x-forwarded-for')
    if (xForwardedFor) {
        const ips = xForwardedFor.split(',').map(ip => ip.trim())
        return ips[0]
    }

    const xRealIP = headers.get('x-real-ip')
    if (xRealIP) return xRealIP

    // Vercel
    const vercelForwardedFor = headers.get('x-vercel-forwarded-for')
    if (vercelForwardedFor) return vercelForwardedFor

    return 'unknown'
}

// ===========================================
// USER-BASED RATE LIMIT IDENTIFIER
// ===========================================

export function getRateLimitIdentifier(
    userId: string | null,
    request: Request,
    endpoint: string
): string {
    if (userId) {
        return `user:${userId}:${endpoint}`
    }

    const ip = getClientIP(request)
    return `ip:${ip}:${endpoint}`
}

// ===========================================
// CLEANUP EXPIRED RATE LIMITS
// Call this via cron job
// ===========================================

export async function cleanupExpiredRateLimits(): Promise<number> {
    try {
        const admin = getAdminClient()
        const { data, error } = await admin
            .from('rate_limits')
            .delete()
            .lt('expires_at', new Date().toISOString())
            .select('key')

        if (error) {
            logger.error('Failed to cleanup rate limits', error instanceof Error ? error : new Error(String(error)))
            return 0
        }

        return data?.length || 0
    } catch (error) {
        logger.error('Rate limit cleanup error', error instanceof Error ? error : new Error(String(error)))
        return 0
    }
}
