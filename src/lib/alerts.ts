// ===========================================
// OPS ALERTS — tell a person when something engine-wide breaks
// ===========================================
// From 28 Sep to 12 Oct 2026 two voice providers were out of credit and the
// only trace was log lines nobody read, which Vercel discards within a day.
//
// Set ALERT_WEBHOOK_URL in Vercel to a Slack, Google Chat or Discord incoming
// webhook to receive these. Without it they are still logged as
// event "ops.alert". Each alert key is sent at most once an hour across all
// server instances, using the existing check_rate_limit database function.
//
// Call it after the user has been answered (next/server `after`), never on
// the request's critical path: during an outage it runs for every failure.
// ===========================================
import { logger } from './logger'
import { checkRateLimit } from './rate-limiter'

const ONE_HOUR_MS = 60 * 60 * 1000
// Per-instance memory, so an outage does not cost two database round trips per
// failed request just to learn the alert was already sent.
const LOCAL_QUIET_MS = 10 * 60 * 1000
const lastSeen = new Map<string, number>()

export async function alertOps(key: string, text: string, context: Record<string, unknown> = {}): Promise<void> {
    const now = Date.now()
    const seen = lastSeen.get(key)
    if (seen !== undefined && now - seen < LOCAL_QUIET_MS) return
    lastSeen.set(key, now)

    logger.error(`ALERT: ${text}`, undefined, { event: 'ops.alert', alertKey: key, ...context })

    const url = process.env.ALERT_WEBHOOK_URL
    if (!url) return

    try {
        const gate = await checkRateLimit(`alert:${key}`, 1, ONE_HOUR_MS)
        if (!gate.success) return // already sent within the hour by some instance

        const message = `Decible: ${text}`
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // `text` for Slack and Google Chat, `content` for Discord
            body: JSON.stringify({ text: message, content: message }),
            signal: AbortSignal.timeout(3000),
        })
        if (!res.ok) {
            logger.warn('Ops alert webhook refused the message', { event: 'ops.alert_rejected', alertKey: key, status: res.status })
        }
    } catch (err) {
        logger.warn('Could not deliver ops alert', {
            event: 'ops.alert_failed', alertKey: key, detail: err instanceof Error ? err.message : String(err),
        })
    }
}
