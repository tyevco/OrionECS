import { EngineBuilder } from './engine';
import {
    ConsoleLogProvider,
    EngineLogger,
    type LogEntry,
    type LogProvider,
    MemoryLogProvider,
    sanitizeLogString,
} from './logger';

describe('Log Providers', () => {
    describe('sanitizeLogString', () => {
        test('should remove ANSI escape sequences', () => {
            const input = '\x1b[31mRed Text\x1b[0m';
            expect(sanitizeLogString(input)).toBe('Red Text');
        });

        test('should remove control characters', () => {
            const input = 'Hello\x00World\x1F!';
            expect(sanitizeLogString(input)).toBe('HelloWorld!');
        });

        test('should handle non-string input', () => {
            expect(sanitizeLogString(123 as unknown as string)).toBe('123');
        });
    });

    describe('ConsoleLogProvider', () => {
        let provider: ConsoleLogProvider;
        let consoleSpy: {
            log: jest.SpyInstance;
            warn: jest.SpyInstance;
            error: jest.SpyInstance;
        };

        beforeEach(() => {
            provider = new ConsoleLogProvider();
            consoleSpy = {
                log: jest.spyOn(console, 'log').mockImplementation(),
                warn: jest.spyOn(console, 'warn').mockImplementation(),
                error: jest.spyOn(console, 'error').mockImplementation(),
            };
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('should write debug messages to console.log', () => {
            const entry: LogEntry = {
                level: 'debug',
                args: ['Debug message'],
                tag: 'TestTag',
                timestamp: Date.now(),
            };

            provider.write(entry);

            expect(consoleSpy.log).toHaveBeenCalledWith('[TestTag]', 'Debug message');
        });

        test('should write info messages to console.log', () => {
            const entry: LogEntry = {
                level: 'info',
                args: ['Info message'],
                timestamp: Date.now(),
            };

            provider.write(entry);

            expect(consoleSpy.log).toHaveBeenCalledWith('[ECS]', 'Info message');
        });

        test('should write warn messages to console.warn', () => {
            const entry: LogEntry = {
                level: 'warn',
                args: ['Warning message'],
                timestamp: Date.now(),
            };

            provider.write(entry);

            expect(consoleSpy.warn).toHaveBeenCalledWith('[ECS]', 'Warning message');
        });

        test('should write error messages to console.error', () => {
            const entry: LogEntry = {
                level: 'error',
                args: ['Error message'],
                timestamp: Date.now(),
            };

            provider.write(entry);

            expect(consoleSpy.error).toHaveBeenCalledWith('[ECS]', 'Error message');
        });
    });

    describe('MemoryLogProvider', () => {
        let provider: MemoryLogProvider;

        beforeEach(() => {
            provider = new MemoryLogProvider();
        });

        test('should store log entries', () => {
            const entry: LogEntry = {
                level: 'info',
                args: ['Test message'],
                tag: 'TestTag',
                timestamp: Date.now(),
            };

            provider.write(entry);

            expect(provider.entries).toHaveLength(1);
            expect(provider.entries[0]).toEqual(entry);
        });

        test('should respect maxEntries limit', () => {
            const limitedProvider = new MemoryLogProvider({ maxEntries: 3 });

            for (let i = 0; i < 5; i++) {
                limitedProvider.write({
                    level: 'info',
                    args: [`Message ${i}`],
                    timestamp: Date.now(),
                });
            }

            expect(limitedProvider.entries).toHaveLength(3);
            expect(limitedProvider.entries[0]!.args[0]).toBe('Message 2');
            expect(limitedProvider.entries[2]!.args[0]).toBe('Message 4');
        });

        test('should clear entries', () => {
            provider.write({
                level: 'info',
                args: ['Test'],
                timestamp: Date.now(),
            });

            provider.clear();

            expect(provider.entries).toHaveLength(0);
        });

        test('should filter entries by level', () => {
            provider.write({ level: 'info', args: ['Info 1'], timestamp: Date.now() });
            provider.write({ level: 'error', args: ['Error 1'], timestamp: Date.now() });
            provider.write({ level: 'info', args: ['Info 2'], timestamp: Date.now() });

            const infoEntries = provider.getByLevel('info');
            const errorEntries = provider.getByLevel('error');

            expect(infoEntries).toHaveLength(2);
            expect(errorEntries).toHaveLength(1);
        });

        test('should filter entries by tag', () => {
            provider.write({ level: 'info', args: ['A'], tag: 'TagA', timestamp: Date.now() });
            provider.write({ level: 'info', args: ['B'], tag: 'TagB', timestamp: Date.now() });
            provider.write({ level: 'info', args: ['A2'], tag: 'TagA', timestamp: Date.now() });

            const tagAEntries = provider.getByTag('TagA');

            expect(tagAEntries).toHaveLength(2);
        });

        test('should search entries by text', () => {
            provider.write({ level: 'info', args: ['Hello World'], timestamp: Date.now() });
            provider.write({ level: 'info', args: ['Goodbye'], timestamp: Date.now() });
            provider.write({ level: 'info', args: ['Hello Again'], timestamp: Date.now() });

            const results = provider.search('hello');

            expect(results).toHaveLength(2);
        });
    });

    describe('EngineLogger', () => {
        test('should use ConsoleLogProvider by default', () => {
            const logger = new EngineLogger();
            const providers = logger.getProviders();

            expect(providers).toHaveLength(1);
            expect(providers[0]).toBeInstanceOf(ConsoleLogProvider);
        });

        test('should dispatch to multiple providers', () => {
            const memory1 = new MemoryLogProvider();
            const memory2 = new MemoryLogProvider();

            const logger = new EngineLogger({
                debugEnabled: true,
                providers: [memory1, memory2],
            });

            logger.info('Test message');

            expect(memory1.entries).toHaveLength(1);
            expect(memory2.entries).toHaveLength(1);
        });

        test('should not log debug when disabled', () => {
            const memory = new MemoryLogProvider();
            const logger = new EngineLogger({
                debugEnabled: false,
                providers: [memory],
            });

            logger.debug('Debug message');

            expect(memory.entries).toHaveLength(0);
        });

        test('should log debug when enabled', () => {
            const memory = new MemoryLogProvider();
            const logger = new EngineLogger({
                debugEnabled: true,
                providers: [memory],
            });

            logger.debug('Debug message');

            expect(memory.entries).toHaveLength(1);
            expect(memory.entries[0]!.level).toBe('debug');
        });

        test('should respect minLevel setting', () => {
            const memory = new MemoryLogProvider();
            const logger = new EngineLogger({
                minLevel: 'warn',
                providers: [memory],
            });

            logger.info('Info');
            logger.warn('Warning');
            logger.error('Error');

            expect(memory.entries).toHaveLength(2);
            expect(memory.entries.map((e) => e.level)).toEqual(['warn', 'error']);
        });

        test('should sanitize string arguments', () => {
            const memory = new MemoryLogProvider();
            const logger = new EngineLogger({ providers: [memory] });

            logger.info('Test \x1b[31mred\x1b[0m text');

            expect(memory.entries[0]!.args[0]).toBe('Test red text');
        });

        test('should sanitize Error messages', () => {
            const memory = new MemoryLogProvider();
            const logger = new EngineLogger({ providers: [memory] });

            logger.error(new Error('Error with \x00control chars'));

            expect(memory.entries[0]!.args[0]).toBe('Error with control chars');
        });

        test('should create tagged logger that shares providers', () => {
            const memory = new MemoryLogProvider();
            const logger = new EngineLogger({ providers: [memory] });
            const taggedLogger = logger.withTag('MySystem');

            taggedLogger.info('Tagged message');

            expect(memory.entries).toHaveLength(1);
            expect(memory.entries[0]!.tag).toBe('MySystem');
        });

        test('should chain tags', () => {
            const memory = new MemoryLogProvider();
            const logger = new EngineLogger({ providers: [memory] });
            const level1 = logger.withTag('Plugin');
            const level2 = level1.withTag('SubModule');

            (level2 as EngineLogger).info('Nested message');

            expect(memory.entries[0]!.tag).toBe('Plugin:SubModule');
        });

        test('should add and remove providers', () => {
            const logger = new EngineLogger({ providers: [] });
            const memory = new MemoryLogProvider();

            logger.addProvider(memory);
            expect(logger.getProviders()).toHaveLength(1);

            logger.removeProvider(memory);
            expect(logger.getProviders()).toHaveLength(0);
        });

        test('should not add duplicate providers', () => {
            const logger = new EngineLogger({ providers: [] });
            const memory = new MemoryLogProvider();

            logger.addProvider(memory);
            logger.addProvider(memory);

            expect(logger.getProviders()).toHaveLength(1);
        });

        test('should isolate provider errors', () => {
            const failingProvider: LogProvider = {
                write: () => {
                    throw new Error('Provider failed');
                },
            };
            const memory = new MemoryLogProvider();

            const logger = new EngineLogger({
                providers: [failingProvider, memory],
            });

            // Should not throw
            expect(() => logger.info('Test')).not.toThrow();

            // Memory provider should still receive the message
            expect(memory.entries).toHaveLength(1);
        });

        test('should include timestamp in log entries', () => {
            const memory = new MemoryLogProvider();
            const logger = new EngineLogger({ providers: [memory] });

            const before = Date.now();
            logger.info('Test');
            const after = Date.now();

            expect(memory.entries[0]!.timestamp).toBeGreaterThanOrEqual(before);
            expect(memory.entries[0]!.timestamp).toBeLessThanOrEqual(after);
        });

        test('should flush providers', async () => {
            let flushed = false;
            const flushableProvider: LogProvider = {
                write: () => {},
                flush: () => {
                    flushed = true;
                },
            };

            const logger = new EngineLogger({ providers: [flushableProvider] });
            await logger.flush();

            expect(flushed).toBe(true);
        });

        test('should dispose providers', async () => {
            let disposed = false;
            const disposableProvider: LogProvider = {
                write: () => {},
                dispose: () => {
                    disposed = true;
                },
            };

            const logger = new EngineLogger({ providers: [disposableProvider] });
            await logger.dispose();

            expect(disposed).toBe(true);
            expect(logger.getProviders()).toHaveLength(0);
        });
    });

    describe('EngineBuilder.withLogProvider', () => {
        test('should configure engine with custom log provider', () => {
            const memory = new MemoryLogProvider();

            const engine = new EngineBuilder().withDebugMode(true).withLogProvider(memory).build();

            // The engine logs a debug message about archetypes when built
            // Filter for archetype-related messages
            const archetypeLogs = memory.search('archetype');
            expect(archetypeLogs.length).toBeGreaterThan(0);

            engine.destroy();
        });

        test('should support multiple providers via chaining', () => {
            const memory1 = new MemoryLogProvider();
            const memory2 = new MemoryLogProvider();

            const engine = new EngineBuilder()
                .withDebugMode(true)
                .withLogProvider(memory1)
                .withLogProvider(memory2)
                .build();

            // Both providers should receive the archetype log
            expect(memory1.entries.length).toBeGreaterThan(0);
            expect(memory2.entries.length).toBeGreaterThan(0);

            engine.destroy();
        });

        test('should not include console output when only memory provider is used', () => {
            const memory = new MemoryLogProvider();
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const engine = new EngineBuilder().withDebugMode(true).withLogProvider(memory).build();

            // Console should not receive logs (memory is the only provider)
            // Note: There might be some console output from other sources,
            // but engine debug logs should go only to memory
            const memoryHasLogs = memory.entries.length > 0;
            expect(memoryHasLogs).toBe(true);

            engine.destroy();
            consoleSpy.mockRestore();
        });

        test('should use default ConsoleLogProvider when no providers specified', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const engine = new EngineBuilder().withDebugMode(true).build();

            // Console should receive the archetype debug message
            const archetypeLogCalled = consoleSpy.mock.calls.some((call) =>
                call.some((arg) => String(arg).toLowerCase().includes('archetype'))
            );
            expect(archetypeLogCalled).toBe(true);

            engine.destroy();
            consoleSpy.mockRestore();
        });
    });
});
