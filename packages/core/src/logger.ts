/**
 * Logger Implementation for OrionECS
 *
 * Provides secure, structured logging with automatic sanitization
 * to prevent log injection attacks.
 *
 * @packageDocumentation
 * @module Logger
 */

import type { Logger, LogLevel } from './definitions';

/**
 * Sanitize a string to prevent log injection attacks.
 *
 * Removes:
 * - ANSI escape sequences (terminal manipulation prevention)
 * - Control characters (0x00-0x1F and 0x7F)
 *
 * @param str - The string to sanitize
 * @returns The sanitized string
 */
export function sanitizeLogString(str: string): string {
    if (typeof str !== 'string') return String(str);
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        // Skip ANSI escape sequences (ESC [ ... letter)
        if (code === 0x1b && str[i + 1] === '[') {
            let j = i + 2;
            while (j < str.length && ((str[j]! >= '0' && str[j]! <= '9') || str[j] === ';')) {
                j++;
            }
            if (j < str.length && str[j]! >= 'A' && str[j]! <= 'z') {
                i = j;
                continue;
            }
        }
        // Skip control characters (0x00-0x1f and 0x7f)
        if (code < 0x20 || code === 0x7f) {
            continue;
        }
        result += str[i];
    }
    return result;
}

/**
 * Sanitize log arguments, converting objects to strings as needed.
 *
 * @param args - The arguments to sanitize
 * @returns Sanitized arguments
 */
function sanitizeArgs(args: unknown[]): unknown[] {
    return args.map((arg) => {
        if (typeof arg === 'string') {
            return sanitizeLogString(arg);
        }
        if (arg instanceof Error) {
            return sanitizeLogString(arg.message);
        }
        return arg;
    });
}

/**
 * Configuration options for the EngineLogger.
 */
export interface EngineLoggerOptions {
    /** Enable debug-level logging */
    debugEnabled?: boolean;
    /** Minimum log level to output */
    minLevel?: LogLevel;
}

/**
 * Log level priority map for filtering.
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * Engine logger implementation with automatic sanitization.
 *
 * This class implements the Logger interface and provides secure logging
 * with ANSI escape sequence and control character filtering.
 */
export class EngineLogger implements Logger {
    private tag: string;
    private debugEnabled: boolean;
    private minLevel: LogLevel;

    constructor(options: EngineLoggerOptions = {}, tag: string = '') {
        this.tag = tag;
        this.debugEnabled = options.debugEnabled ?? false;
        this.minLevel = options.minLevel ?? 'info';
    }

    /**
     * Format the log prefix with tag if present.
     */
    private formatPrefix(): string {
        return this.tag ? `[${this.tag}]` : '[ECS]';
    }

    /**
     * Check if a log level should be output.
     */
    isEnabled(level: LogLevel): boolean {
        // Debug messages are only shown when debugEnabled is true
        if (level === 'debug') {
            return this.debugEnabled;
        }
        // Other levels are checked against minLevel
        return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
    }

    /**
     * Log a debug message (only when debug mode is enabled).
     */
    debug(...args: unknown[]): void {
        if (!this.isEnabled('debug')) return;
        console.log(this.formatPrefix(), ...sanitizeArgs(args));
    }

    /**
     * Log an informational message.
     */
    info(...args: unknown[]): void {
        if (!this.isEnabled('info')) return;
        console.log(this.formatPrefix(), ...sanitizeArgs(args));
    }

    /**
     * Log a warning message.
     */
    warn(...args: unknown[]): void {
        if (!this.isEnabled('warn')) return;
        console.warn(this.formatPrefix(), ...sanitizeArgs(args));
    }

    /**
     * Log an error message.
     */
    error(...args: unknown[]): void {
        if (!this.isEnabled('error')) return;
        console.error(this.formatPrefix(), ...sanitizeArgs(args));
    }

    /**
     * Create a new logger instance with a tag prefix.
     */
    withTag(tag: string): Logger {
        const newTag = this.tag ? `${this.tag}:${tag}` : tag;
        const logger = new EngineLogger(
            { debugEnabled: this.debugEnabled, minLevel: this.minLevel },
            newTag
        );
        return logger;
    }

    /**
     * Update the debug enabled state.
     */
    setDebugEnabled(enabled: boolean): void {
        this.debugEnabled = enabled;
    }

    /**
     * Update the minimum log level.
     */
    setMinLevel(level: LogLevel): void {
        this.minLevel = level;
    }
}
