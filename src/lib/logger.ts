// ===========================================
// LOGGING INFRASTRUCTURE
// ===========================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
    [key: string]: unknown
}

interface LogEntry {
    timestamp: string
    level: LogLevel
    message: string
    context?: LogContext
    error?: {
        name: string
        message: string
        stack?: string
    }
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
}

// Get minimum log level from environment
function getMinLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined
    if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
        return envLevel
    }
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

const MIN_LOG_LEVEL = getMinLogLevel()

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL]
}

function formatLogEntry(entry: LogEntry): string {
    if (process.env.NODE_ENV === 'production') {
        // JSON format for production (easier to parse in log aggregators)
        return JSON.stringify(entry)
    }

    // Human-readable format for development
    const { timestamp, level, message, context, error } = entry
    const levelColors: Record<LogLevel, string> = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m', // Red
    }
    const reset = '\x1b[0m'

    let output = `${levelColors[level]}[${level.toUpperCase()}]${reset} ${timestamp} - ${message}`

    if (context && Object.keys(context).length > 0) {
        output += ` ${JSON.stringify(context)}`
    }

    if (error) {
        output += `\n  Error: ${error.name}: ${error.message}`
        if (error.stack) {
            output += `\n  Stack: ${error.stack}`
        }
    }

    return output
}

function createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
): LogEntry {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
    }

    if (context) {
        entry.context = context
    }

    if (error) {
        entry.error = {
            name: error.name,
            message: error.message,
            stack: error.stack,
        }
    }

    return entry
}

function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!shouldLog(level)) return

    const entry = createLogEntry(level, message, context, error)
    const formatted = formatLogEntry(entry)

    switch (level) {
        case 'error':
            console.error(formatted)
            break
        case 'warn':
            console.warn(formatted)
            break
        default:
            console.log(formatted)
    }

    // In production, you would send to external service here
    // e.g., Datadog, LogRocket, Sentry, etc.
    // if (process.env.NODE_ENV === 'production') {
    //     sendToExternalService(entry)
    // }
}

// ===========================================
// PUBLIC API
// ===========================================

export const logger = {
    debug: (message: string, context?: LogContext) => log('debug', message, context),
    info: (message: string, context?: LogContext) => log('info', message, context),
    warn: (message: string, context?: LogContext) => log('warn', message, context),
    error: (message: string, error?: Error, context?: LogContext) => log('error', message, context, error),
}

// ===========================================
// SPECIALIZED LOGGERS
// ===========================================

export const apiLogger = {
    request: (method: string, path: string, context?: LogContext) => {
        logger.info(`API Request: ${method} ${path}`, { ...context, type: 'api_request' })
    },
    response: (method: string, path: string, status: number, durationMs: number, context?: LogContext) => {
        const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
        log(level, `API Response: ${method} ${path} ${status} (${durationMs}ms)`, {
            ...context,
            type: 'api_response',
            status,
            durationMs
        })
    },
    error: (method: string, path: string, error: Error, context?: LogContext) => {
        logger.error(`API Error: ${method} ${path}`, error, { ...context, type: 'api_error' })
    },
}

export const queueLogger = {
    jobAdded: (jobId: string, jobType: string, context?: LogContext) => {
        logger.info(`Job added: ${jobId} (${jobType})`, { ...context, type: 'queue_job_added', jobId, jobType })
    },
    jobStarted: (jobId: string, jobType: string, context?: LogContext) => {
        logger.info(`Job started: ${jobId} (${jobType})`, { ...context, type: 'queue_job_started', jobId, jobType })
    },
    jobCompleted: (jobId: string, jobType: string, durationMs: number, context?: LogContext) => {
        logger.info(`Job completed: ${jobId} (${jobType}) in ${durationMs}ms`, {
            ...context,
            type: 'queue_job_completed',
            jobId,
            jobType,
            durationMs
        })
    },
    jobFailed: (jobId: string, jobType: string, error: Error, context?: LogContext) => {
        logger.error(`Job failed: ${jobId} (${jobType})`, error, {
            ...context,
            type: 'queue_job_failed',
            jobId,
            jobType
        })
    },
}

export const authLogger = {
    loginSuccess: (userId: string, method: string) => {
        logger.info(`User logged in`, { type: 'auth_login', userId, method })
    },
    loginFailed: (email: string, reason: string) => {
        logger.warn(`Login failed`, { type: 'auth_login_failed', email, reason })
    },
    logout: (userId: string) => {
        logger.info(`User logged out`, { type: 'auth_logout', userId })
    },
    unauthorized: (path: string, reason: string) => {
        logger.warn(`Unauthorized access attempt`, { type: 'auth_unauthorized', path, reason })
    },
}

export const generationLogger = {
    started: (generationId: string, userId: string, textLength: number) => {
        logger.info(`Generation started`, {
            type: 'generation_started',
            generationId,
            userId,
            textLength
        })
    },
    completed: (generationId: string, userId: string, durationMs: number, creditsUsed: number) => {
        logger.info(`Generation completed`, {
            type: 'generation_completed',
            generationId,
            userId,
            durationMs,
            creditsUsed
        })
    },
    failed: (generationId: string, userId: string, error: Error) => {
        logger.error(`Generation failed`, error, {
            type: 'generation_failed',
            generationId,
            userId
        })
    },
}

export default logger
