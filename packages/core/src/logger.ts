/**
 * Logger Implementation for OrionECS
 *
 * Provides secure, structured logging with automatic sanitization
 * to prevent log injection attacks. Supports multiple log providers
 * for flexible output destinations.
 *
 * @packageDocumentation
 * @module Logger
 */

import type { LogEntry, Logger, LogLevel, LogProvider } from './definitions';

// Re-export types from plugin-api for convenience
export type { LogEntry, LogProvider } from './definitions';

// =============================================================================
// Sanitization Utilities
// =============================================================================

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

// =============================================================================
// Built-in Log Providers
// =============================================================================

/**
 * Console log provider that outputs to the browser/Node.js console.
 *
 * This is the default provider used when no providers are explicitly configured.
 *
 * @example
 * ```typescript
 * const engine = new EngineBuilder()
 *   .withLogProvider(new ConsoleLogProvider())
 *   .build();
 * ```
 *
 * @public
 */
export class ConsoleLogProvider implements LogProvider {
    /**
     * Write a log entry to the console.
     *
     * Uses console.log for debug/info, console.warn for warn, and console.error for error.
     */
    write(entry: LogEntry): void {
        const prefix = entry.tag ? `[${entry.tag}]` : '[ECS]';

        switch (entry.level) {
            case 'debug':
            case 'info':
                console.log(prefix, ...entry.args);
                break;
            case 'warn':
                console.warn(prefix, ...entry.args);
                break;
            case 'error':
                console.error(prefix, ...entry.args);
                break;
        }
    }
}

/**
 * Memory log provider that stores log entries in an array.
 *
 * Useful for testing, debugging, and capturing logs for later analysis.
 * Supports optional maximum entry limits to prevent unbounded memory growth.
 *
 * @example Testing log output
 * ```typescript
 * const memoryProvider = new MemoryLogProvider();
 * const engine = new EngineBuilder()
 *   .withLogProvider(memoryProvider)
 *   .build();
 *
 * // ... run game logic ...
 *
 * expect(memoryProvider.entries).toContainEqual(
 *   expect.objectContaining({ level: 'info', tag: 'MySystem' })
 * );
 * ```
 *
 * @example In-game debug console
 * ```typescript
 * const memoryProvider = new MemoryLogProvider({ maxEntries: 100 });
 * // Display memoryProvider.entries in your debug UI
 * ```
 *
 * @public
 */
export class MemoryLogProvider implements LogProvider {
    /** Stored log entries */
    readonly entries: LogEntry[] = [];

    /** Maximum number of entries to store (0 = unlimited) */
    private readonly maxEntries: number;

    /**
     * Create a new memory log provider.
     *
     * @param options - Configuration options
     * @param options.maxEntries - Maximum entries to store (default: 0 = unlimited)
     */
    constructor(options: { maxEntries?: number } = {}) {
        this.maxEntries = options.maxEntries ?? 0;
    }

    /**
     * Write a log entry to memory.
     */
    write(entry: LogEntry): void {
        this.entries.push(entry);

        // Trim if we exceed maxEntries
        if (this.maxEntries > 0 && this.entries.length > this.maxEntries) {
            this.entries.shift();
        }
    }

    /**
     * Clear all stored log entries.
     */
    clear(): void {
        this.entries.length = 0;
    }

    /**
     * Get entries filtered by level.
     *
     * @param level - The log level to filter by
     * @returns Entries matching the specified level
     */
    getByLevel(level: LogLevel): LogEntry[] {
        return this.entries.filter((entry) => entry.level === level);
    }

    /**
     * Get entries filtered by tag.
     *
     * @param tag - The tag to filter by
     * @returns Entries matching the specified tag
     */
    getByTag(tag: string): LogEntry[] {
        return this.entries.filter((entry) => entry.tag === tag);
    }

    /**
     * Search entries by text content.
     *
     * @param text - Text to search for in log arguments
     * @returns Entries containing the specified text
     */
    search(text: string): LogEntry[] {
        const lowerText = text.toLowerCase();
        return this.entries.filter((entry) =>
            entry.args.some((arg) => String(arg).toLowerCase().includes(lowerText))
        );
    }
}

// =============================================================================
// Logger Configuration
// =============================================================================

/**
 * Configuration options for the EngineLogger.
 */
export interface EngineLoggerOptions {
    /** Enable debug-level logging */
    debugEnabled?: boolean;
    /** Minimum log level to output */
    minLevel?: LogLevel;
    /** Log providers to use (defaults to ConsoleLogProvider if empty) */
    providers?: LogProvider[];
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

// =============================================================================
// Engine Logger
// =============================================================================

/**
 * Engine logger implementation with automatic sanitization and multiple providers.
 *
 * This class implements the Logger interface and provides secure logging
 * with ANSI escape sequence and control character filtering. Log messages
 * are dispatched to all registered providers.
 *
 * @example Basic usage
 * ```typescript
 * const logger = new EngineLogger({ debugEnabled: true });
 * logger.info('Engine started');
 * logger.debug('Processing entity:', entityId);
 * ```
 *
 * @example Multiple providers
 * ```typescript
 * const memoryProvider = new MemoryLogProvider();
 * const logger = new EngineLogger({
 *   providers: [new ConsoleLogProvider(), memoryProvider]
 * });
 * ```
 *
 * @public
 */
export class EngineLogger implements Logger {
    private tag: string;
    private debugEnabled: boolean;
    private minLevel: LogLevel;
    private providers: LogProvider[];

    constructor(options: EngineLoggerOptions = {}, tag: string = '') {
        this.tag = tag;
        this.debugEnabled = options.debugEnabled ?? false;
        this.minLevel = options.minLevel ?? 'info';
        // Default to ConsoleLogProvider only if providers option is not explicitly set
        // If providers is explicitly set (even as empty array), respect that choice
        if (options.providers !== undefined) {
            this.providers = [...options.providers];
        } else {
            this.providers = [new ConsoleLogProvider()];
        }
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
        // LogLevel is a union type so the keys are guaranteed to exist
        const levelPriority = LOG_LEVEL_PRIORITY[level] as number;
        const minLevelPriority = LOG_LEVEL_PRIORITY[this.minLevel] as number;
        return levelPriority >= minLevelPriority;
    }

    /**
     * Dispatch a log entry to all providers.
     */
    private dispatch(level: LogLevel, args: unknown[]): void {
        if (!this.isEnabled(level)) return;

        const entry: LogEntry = {
            level,
            args: sanitizeArgs(args),
            tag: this.tag || undefined,
            timestamp: Date.now(),
        };

        // Dispatch to all providers with error isolation
        for (const provider of this.providers) {
            try {
                provider.write(entry);
            } catch {
                // Silently ignore provider errors to prevent cascading failures
                // A failing provider shouldn't crash the engine or prevent other providers
            }
        }
    }

    /**
     * Log a debug message (only when debug mode is enabled).
     */
    debug(...args: unknown[]): void {
        this.dispatch('debug', args);
    }

    /**
     * Log an informational message.
     */
    info(...args: unknown[]): void {
        this.dispatch('info', args);
    }

    /**
     * Log a warning message.
     */
    warn(...args: unknown[]): void {
        this.dispatch('warn', args);
    }

    /**
     * Log an error message.
     */
    error(...args: unknown[]): void {
        this.dispatch('error', args);
    }

    /**
     * Create a new logger instance with a tag prefix.
     *
     * The new logger shares the same providers as the parent logger.
     */
    withTag(tag: string): Logger {
        const newTag = this.tag ? `${this.tag}:${tag}` : tag;
        const logger = new EngineLogger(
            {
                debugEnabled: this.debugEnabled,
                minLevel: this.minLevel,
                providers: this.providers,
            },
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

    // =========================================================================
    // Provider Management
    // =========================================================================

    /**
     * Add a log provider.
     *
     * @param provider - The provider to add
     */
    addProvider(provider: LogProvider): void {
        if (!this.providers.includes(provider)) {
            this.providers.push(provider);
        }
    }

    /**
     * Remove a log provider.
     *
     * @param provider - The provider to remove
     * @returns true if the provider was found and removed
     */
    removeProvider(provider: LogProvider): boolean {
        const index = this.providers.indexOf(provider);
        if (index !== -1) {
            this.providers.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Get all registered providers.
     *
     * @returns Array of registered providers
     */
    getProviders(): ReadonlyArray<LogProvider> {
        return this.providers;
    }

    /**
     * Clear all providers and optionally add new ones.
     *
     * @param newProviders - Optional new providers to set
     */
    setProviders(newProviders: LogProvider[]): void {
        this.providers = [...newProviders];
    }

    /**
     * Flush all providers that support flushing.
     *
     * Useful for ensuring all logs are written before shutdown.
     */
    async flush(): Promise<void> {
        const flushPromises: Promise<void>[] = [];

        for (const provider of this.providers) {
            if (provider.flush) {
                const result = provider.flush();
                if (result instanceof Promise) {
                    flushPromises.push(result);
                }
            }
        }

        if (flushPromises.length > 0) {
            await Promise.all(flushPromises);
        }
    }

    /**
     * Dispose all providers and clear the provider list.
     *
     * Called during engine cleanup.
     */
    async dispose(): Promise<void> {
        const disposePromises: Promise<void>[] = [];

        for (const provider of this.providers) {
            if (provider.dispose) {
                const result = provider.dispose();
                if (result instanceof Promise) {
                    disposePromises.push(result);
                }
            }
        }

        if (disposePromises.length > 0) {
            await Promise.all(disposePromises);
        }

        this.providers = [];
    }
}
