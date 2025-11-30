/**
 * Tests for Error Recovery & Resilience (Issue #97)
 *
 * These tests verify the error recovery functionality including:
 * - System error isolation
 * - Recovery strategies (skip, retry, disable, fallback)
 * - Circuit breaker pattern
 * - Health monitoring
 * - Error reporting
 */

import type { SystemError } from './definitions';
import { EngineBuilder } from './engine';
import { ErrorRecoveryManager } from './managers';

// Simple components for testing
class Position {
    constructor(
        public x = 0,
        public y = 0
    ) {}
}

describe('ErrorRecoveryManager', () => {
    let errorRecoveryManager: ErrorRecoveryManager;

    beforeEach(() => {
        errorRecoveryManager = new ErrorRecoveryManager();
    });

    afterEach(() => {
        errorRecoveryManager.dispose();
    });

    describe('basic functionality', () => {
        it('should register and track systems', () => {
            errorRecoveryManager.registerSystem('TestSystem');

            const health = errorRecoveryManager.getSystemHealth('TestSystem');
            expect(health).toBeDefined();
            expect(health?.systemName).toBe('TestSystem');
            expect(health?.status).toBe('healthy');
            expect(health?.consecutiveFailures).toBe(0);
        });

        it('should unregister systems', () => {
            errorRecoveryManager.registerSystem('TestSystem');
            errorRecoveryManager.unregisterSystem('TestSystem');

            const health = errorRecoveryManager.getSystemHealth('TestSystem');
            expect(health).toBeUndefined();
        });

        it('should execute successful functions without issues', () => {
            let executed = false;
            const result = errorRecoveryManager.executeWithRecovery(
                'TestSystem',
                () => {
                    executed = true;
                },
                16
            );

            expect(result).toBe(true);
            expect(executed).toBe(true);
            expect(errorRecoveryManager.getSystemHealth('TestSystem')?.status).toBe('healthy');
        });
    });

    describe('error isolation', () => {
        it('should catch and isolate system errors', () => {
            const result = errorRecoveryManager.executeWithRecovery(
                'FailingSystem',
                () => {
                    throw new Error('System crashed!');
                },
                16
            );

            // With default 'skip' strategy, execution "recovers" by skipping
            expect(result).toBe(true);
            expect(errorRecoveryManager.getSystemHealth('FailingSystem')?.status).toBe('degraded');
            expect(errorRecoveryManager.getSystemHealth('FailingSystem')?.consecutiveFailures).toBe(
                1
            );
        });

        it('should track consecutive failures', () => {
            for (let i = 0; i < 5; i++) {
                errorRecoveryManager.executeWithRecovery(
                    'FailingSystem',
                    () => {
                        throw new Error('System crashed!');
                    },
                    16
                );
            }

            const health = errorRecoveryManager.getSystemHealth('FailingSystem');
            expect(health?.consecutiveFailures).toBe(5);
            expect(health?.status).toBe('unhealthy');
        });

        it('should reset consecutive failures on success', () => {
            // Fail a few times
            for (let i = 0; i < 3; i++) {
                errorRecoveryManager.executeWithRecovery(
                    'FlakeySystem',
                    () => {
                        throw new Error('Temporary failure');
                    },
                    16
                );
            }

            // Then succeed
            errorRecoveryManager.executeWithRecovery(
                'FlakeySystem',
                () => {
                    // Success!
                },
                16
            );

            const health = errorRecoveryManager.getSystemHealth('FlakeySystem');
            expect(health?.consecutiveFailures).toBe(0);
        });
    });

    describe('recovery strategies', () => {
        it('should skip errors with skip strategy', () => {
            errorRecoveryManager.registerSystem('SkipSystem', { strategy: 'skip' });

            const result = errorRecoveryManager.executeWithRecovery(
                'SkipSystem',
                () => {
                    throw new Error('Skip me!');
                },
                16
            );

            expect(result).toBe(true); // Skipping is considered "recovered"
        });

        it('should disable system with disable strategy', () => {
            errorRecoveryManager.registerSystem('DisableSystem', { strategy: 'disable' });

            const result = errorRecoveryManager.executeWithRecovery(
                'DisableSystem',
                () => {
                    throw new Error('Disable me!');
                },
                16
            );

            expect(result).toBe(false);
            expect(errorRecoveryManager.getSystemHealth('DisableSystem')?.status).toBe('disabled');
        });

        it('should retry with retry strategy', () => {
            let attempts = 0;
            errorRecoveryManager.registerSystem('RetrySystem', { strategy: 'retry' });

            const result = errorRecoveryManager.executeWithRecovery(
                'RetrySystem',
                () => {
                    attempts++;
                    if (attempts < 2) {
                        throw new Error('Retry needed!');
                    }
                },
                16
            );

            expect(result).toBe(true);
            expect(attempts).toBe(2);
        });

        it('should fail after max retries', () => {
            errorRecoveryManager = new ErrorRecoveryManager({ maxRetries: 2 });
            errorRecoveryManager.registerSystem('AlwaysFails', { strategy: 'retry' });

            let attempts = 0;
            const result = errorRecoveryManager.executeWithRecovery(
                'AlwaysFails',
                () => {
                    attempts++;
                    throw new Error('Always fails!');
                },
                16
            );

            expect(result).toBe(false);
            expect(attempts).toBeGreaterThanOrEqual(2);
        });

        it('should execute fallback with fallback strategy', () => {
            let fallbackExecuted = false;
            errorRecoveryManager.registerSystem('FallbackSystem', {
                strategy: 'fallback',
                fallback: () => {
                    fallbackExecuted = true;
                },
            });

            const result = errorRecoveryManager.executeWithRecovery(
                'FallbackSystem',
                () => {
                    throw new Error('Use fallback!');
                },
                16
            );

            expect(result).toBe(true);
            expect(fallbackExecuted).toBe(true);
        });
    });

    describe('circuit breaker', () => {
        it('should open circuit after threshold failures', () => {
            errorRecoveryManager = new ErrorRecoveryManager({
                circuitBreaker: {
                    failureThreshold: 3,
                    resetTimeout: 1000,
                    successThreshold: 2,
                },
            });

            // Trigger 3 failures
            for (let i = 0; i < 3; i++) {
                errorRecoveryManager.executeWithRecovery(
                    'CircuitSystem',
                    () => {
                        throw new Error('Failure');
                    },
                    16
                );
            }

            const health = errorRecoveryManager.getSystemHealth('CircuitSystem');
            expect(health?.circuitBreakerState).toBe('open');
        });

        it('should skip execution when circuit is open', () => {
            errorRecoveryManager = new ErrorRecoveryManager({
                circuitBreaker: {
                    failureThreshold: 2,
                    resetTimeout: 10000, // Long timeout
                    successThreshold: 1,
                },
            });

            // Open the circuit
            for (let i = 0; i < 2; i++) {
                errorRecoveryManager.executeWithRecovery(
                    'CircuitSystem',
                    () => {
                        throw new Error('Failure');
                    },
                    16
                );
            }

            // Now try to execute - should be skipped
            let executed = false;
            errorRecoveryManager.executeWithRecovery(
                'CircuitSystem',
                () => {
                    executed = true;
                },
                16
            );

            expect(executed).toBe(false);
        });

        it('should transition to half-open after timeout', async () => {
            errorRecoveryManager = new ErrorRecoveryManager({
                circuitBreaker: {
                    failureThreshold: 1,
                    resetTimeout: 50, // Short timeout for testing
                    successThreshold: 1,
                },
            });

            // Open the circuit
            errorRecoveryManager.executeWithRecovery(
                'CircuitSystem',
                () => {
                    throw new Error('Failure');
                },
                16
            );

            expect(errorRecoveryManager.getSystemHealth('CircuitSystem')?.circuitBreakerState).toBe(
                'open'
            );

            // Wait for reset timeout
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Next execution should trigger half-open
            let executed = false;
            errorRecoveryManager.executeWithRecovery(
                'CircuitSystem',
                () => {
                    executed = true;
                },
                16
            );

            expect(executed).toBe(true);
            const health = errorRecoveryManager.getSystemHealth('CircuitSystem');
            // After success in half-open, should be closed
            expect(health?.circuitBreakerState).toBe('closed');
        });
    });

    describe('error collection and reporting', () => {
        it('should collect errors', () => {
            errorRecoveryManager.executeWithRecovery(
                'ErrorSystem',
                () => {
                    throw new Error('Test error');
                },
                16
            );

            const errors = errorRecoveryManager.getErrorHistory();
            expect(errors.length).toBe(1);
            expect(errors[0]!.error.message).toBe('Test error');
            expect(errors[0]!.systemName).toBe('ErrorSystem');
        });

        it('should limit error history size', () => {
            errorRecoveryManager = new ErrorRecoveryManager({ maxErrorHistory: 5 });

            for (let i = 0; i < 10; i++) {
                errorRecoveryManager.executeWithRecovery(
                    'ErrorSystem',
                    () => {
                        throw new Error(`Error ${i}`);
                    },
                    16
                );
            }

            const errors = errorRecoveryManager.getErrorHistory();
            expect(errors.length).toBe(5);
        });

        it('should clear error history', () => {
            errorRecoveryManager.executeWithRecovery(
                'ErrorSystem',
                () => {
                    throw new Error('Test error');
                },
                16
            );

            expect(errorRecoveryManager.getErrorHistory().length).toBe(1);
            errorRecoveryManager.clearErrorHistory();
            expect(errorRecoveryManager.getErrorHistory().length).toBe(0);
        });

        it('should generate error report', () => {
            errorRecoveryManager.executeWithRecovery(
                'ErrorSystem',
                () => {
                    throw new Error('Test error');
                },
                16
            );

            const report = errorRecoveryManager.generateErrorReport(10, 5);
            expect(report).toBeDefined();
            expect(report.errors.length).toBe(1);
            expect(report.systemHealth.length).toBe(1);
            expect(report.engineStats).toBeDefined();
            expect(report.engineStats?.entityCount).toBe(10);
            expect(report.engineStats?.systemCount).toBe(5);
        });

        it('should call onError callback', () => {
            let capturedError: SystemError | undefined;
            errorRecoveryManager = new ErrorRecoveryManager({
                onError: (error) => {
                    capturedError = error;
                },
            });

            errorRecoveryManager.executeWithRecovery(
                'ErrorSystem',
                () => {
                    throw new Error('Callback test');
                },
                16
            );

            expect(capturedError).toBeDefined();
            expect(capturedError?.error.message).toBe('Callback test');
        });
    });

    describe('health monitoring', () => {
        it('should track overall engine health', () => {
            expect(errorRecoveryManager.getEngineHealth()).toBe('healthy');

            // One failure = degraded
            errorRecoveryManager.executeWithRecovery(
                'System1',
                () => {
                    throw new Error('Failure');
                },
                16
            );

            expect(errorRecoveryManager.getEngineHealth()).toBe('degraded');
        });

        it('should return unhealthy when multiple systems fail', () => {
            // Make 3 systems fail multiple times
            for (let i = 1; i <= 3; i++) {
                for (let j = 0; j < 3; j++) {
                    errorRecoveryManager.executeWithRecovery(
                        `System${i}`,
                        () => {
                            throw new Error('Failure');
                        },
                        16
                    );
                }
            }

            expect(errorRecoveryManager.getEngineHealth()).toBe('unhealthy');
        });

        it('should reset system to healthy', () => {
            // Make system unhealthy
            for (let i = 0; i < 3; i++) {
                errorRecoveryManager.executeWithRecovery(
                    'ResetTest',
                    () => {
                        throw new Error('Failure');
                    },
                    16
                );
            }

            expect(errorRecoveryManager.getSystemHealth('ResetTest')?.status).toBe('unhealthy');

            // Reset it
            errorRecoveryManager.resetSystem('ResetTest');

            const health = errorRecoveryManager.getSystemHealth('ResetTest');
            expect(health?.status).toBe('healthy');
            expect(health?.consecutiveFailures).toBe(0);
            expect(health?.circuitBreakerState).toBe('closed');
        });
    });

    describe('critical systems', () => {
        it('should mark critical system errors as critical severity', () => {
            errorRecoveryManager.registerSystem('CriticalSystem', { critical: true });

            errorRecoveryManager.executeWithRecovery(
                'CriticalSystem',
                () => {
                    throw new Error('Critical failure!');
                },
                16
            );

            const errors = errorRecoveryManager.getErrorHistory();
            expect(errors[0]!.severity).toBe('critical');
        });

        it('should make engine unhealthy when critical system fails', () => {
            errorRecoveryManager.registerSystem('CriticalSystem', { critical: true });

            // Make it unhealthy
            for (let i = 0; i < 3; i++) {
                errorRecoveryManager.executeWithRecovery(
                    'CriticalSystem',
                    () => {
                        throw new Error('Critical failure!');
                    },
                    16
                );
            }

            expect(errorRecoveryManager.getEngineHealth()).toBe('unhealthy');
        });
    });
});

describe('Engine Error Recovery Integration', () => {
    it('should create engine with error recovery disabled by default', () => {
        const engine = new EngineBuilder().build();

        expect(engine.isErrorRecoveryEnabled()).toBe(false);

        engine.destroy();
    });

    it('should create engine with error recovery enabled', () => {
        const engine = new EngineBuilder().withErrorRecovery().build();

        expect(engine.isErrorRecoveryEnabled()).toBe(true);

        engine.destroy();
    });

    it('should isolate system errors during update', () => {
        const engine = new EngineBuilder()
            .withErrorRecovery()
            .withDebugMode(false) // Suppress console warnings
            .build();

        let failCount = 0;
        let successCount = 0;

        // Create a system that fails
        engine.createSystem(
            'FailingSystem',
            { all: [Position] },
            {
                act: () => {
                    failCount++;
                    throw new Error('System failure!');
                },
            }
        );

        // Create a system that should still run
        engine.createSystem(
            'SuccessSystem',
            { all: [Position] },
            {
                act: () => {
                    successCount++;
                },
            }
        );

        // Create an entity
        const entity = engine.createEntity('TestEntity');
        entity.addComponent(Position, 0, 0);

        // Update should not throw
        expect(() => {
            engine.update(16);
        }).not.toThrow();

        expect(failCount).toBe(1);
        expect(successCount).toBe(1); // Other system still ran

        engine.destroy();
    });

    it('should provide health status', () => {
        const engine = new EngineBuilder().withErrorRecovery().build();

        engine.createSystem(
            'TestSystem',
            { all: [Position] },
            {
                act: () => {
                    // Success
                },
            }
        );

        const entity = engine.createEntity('TestEntity');
        entity.addComponent(Position, 0, 0);

        engine.update(16);

        expect(engine.getEngineHealth()).toBe('healthy');
        expect(engine.getSystemHealth('TestSystem')?.status).toBe('healthy');

        engine.destroy();
    });

    it('should generate error report', () => {
        const engine = new EngineBuilder().withErrorRecovery().withDebugMode(false).build();

        engine.createSystem(
            'FailingSystem',
            { all: [Position] },
            {
                act: () => {
                    throw new Error('Test error');
                },
            }
        );

        const entity = engine.createEntity('TestEntity');
        entity.addComponent(Position, 0, 0);

        engine.update(16);

        const report = engine.generateErrorReport();
        expect(report).toBeDefined();
        expect(report?.errors.length).toBe(1);

        engine.destroy();
    });

    it('should call custom error handler', () => {
        let capturedError: SystemError | undefined;

        const engine = new EngineBuilder()
            .withErrorRecovery({
                onError: (error) => {
                    capturedError = error;
                },
            })
            .build();

        engine.createSystem(
            'FailingSystem',
            { all: [Position] },
            {
                act: () => {
                    throw new Error('Custom handler test');
                },
            }
        );

        const entity = engine.createEntity('TestEntity');
        entity.addComponent(Position, 0, 0);

        engine.update(16);

        expect(capturedError).toBeDefined();
        expect(capturedError?.systemName).toBe('FailingSystem');
        expect(capturedError?.error.message).toBe('Custom handler test');

        engine.destroy();
    });

    it('should reset system after manual reset', () => {
        const engine = new EngineBuilder()
            .withErrorRecovery({
                defaultStrategy: 'disable',
            })
            .withDebugMode(false)
            .build();

        let shouldFail = true;

        engine.createSystem(
            'RecoverableSystem',
            { all: [Position] },
            {
                act: () => {
                    if (shouldFail) {
                        throw new Error('Recoverable failure');
                    }
                },
            }
        );

        const entity = engine.createEntity('TestEntity');
        entity.addComponent(Position, 0, 0);

        // First update - system fails and gets disabled
        engine.update(16);
        expect(engine.getSystemHealth('RecoverableSystem')?.status).toBe('disabled');

        // Fix the issue
        shouldFail = false;

        // Reset the system
        engine.resetSystem('RecoverableSystem');
        expect(engine.getSystemHealth('RecoverableSystem')?.status).toBe('healthy');

        engine.destroy();
    });

    it('should work with per-system error config', () => {
        const engine = new EngineBuilder().withErrorRecovery().withDebugMode(false).build();

        let fallbackExecuted = false;

        engine.createSystem(
            'FallbackSystem',
            { all: [Position] },
            {
                act: () => {
                    throw new Error('Use fallback');
                },
                errorConfig: {
                    strategy: 'fallback',
                    fallback: () => {
                        fallbackExecuted = true;
                    },
                },
            }
        );

        const entity = engine.createEntity('TestEntity');
        entity.addComponent(Position, 0, 0);

        engine.update(16);

        expect(fallbackExecuted).toBe(true);

        engine.destroy();
    });
});
