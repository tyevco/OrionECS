/**
 * Profiling Plugin for Orion ECS
 *
 * Provides comprehensive profiling and performance analysis tools.
 * This plugin demonstrates:
 * - Frame-by-frame performance recording
 * - Chrome DevTools trace export
 * - Memory leak detection
 * - Performance budget monitoring
 * - System execution profiling
 */

import type { EnginePlugin, PluginContext, SystemProfile } from '@orion-ecs/plugin-api';

/**
 * Frame profile data
 */
interface FrameProfile {
    frameNumber: number;
    timestamp: number;
    duration: number;
    systems: Array<{
        name: string;
        duration: number;
        entityCount: number;
    }>;
}

/**
 * Memory snapshot for leak detection
 */
interface MemorySnapshot {
    timestamp: number;
    entities: number;
    components: Map<string, number>;
}

/**
 * Performance budget
 */
interface PerformanceBudget {
    system: string;
    maxTimeMs: number;
    violations: number;
}

/**
 * Profiling session data
 */
interface ProfilingSession {
    startTime: number;
    endTime?: number;
    frames: FrameProfile[];
    memorySnapshots: MemorySnapshot[];
}

// =============================================================================
// Profiler API Interface
// =============================================================================

/**
 * Profiler API interface for type-safe engine extension.
 */
export interface IProfilerAPI {
    /** Start recording performance data */
    startRecording(): void;
    /** Stop recording and return the session data */
    stopRecording(): ProfilingSession | null;
    /** Record a frame (called during engine update) */
    recordFrame(): void;
    /** Export profiling data to Chrome DevTools trace format */
    exportChromeTrace(session?: ProfilingSession): string;
    /** Detect potential memory leaks */
    detectMemoryLeaks(): Array<{
        type: string;
        count: number;
        trend: 'increasing' | 'stable' | 'decreasing';
        severity: 'low' | 'medium' | 'high';
    }>;
    /** Set a performance budget for a system */
    setBudget(systemName: string, maxTimeMs: number): void;
    /** Remove a performance budget */
    removeBudget(systemName: string): void;
    /** Get all performance budgets */
    getBudgets(): PerformanceBudget[];
    /** Set callback for budget exceeded events */
    onBudgetExceededCallback(callback: (system: string, time: number) => void): void;
    /** Get profiling statistics */
    getStats(): {
        isRecording: boolean;
        frameCount: number;
        averageFrameTime: number;
        budgetViolations: number;
        memorySnapshots: number;
    };
    /** Print profiling summary */
    printSummary(): void;
}

// =============================================================================
// Profiler API Implementation
// =============================================================================

/**
 * Profiler API implementation class.
 */
export class ProfilerAPI implements IProfilerAPI {
    private engine: any;
    private recording: boolean = false;
    private currentSession: ProfilingSession | null = null;
    private frameCount: number = 0;
    private budgets: Map<string, PerformanceBudget> = new Map();
    private memorySnapshots: MemorySnapshot[] = [];
    private snapshotInterval: number = 1000; // ms
    private lastSnapshotTime: number = 0;
    private onBudgetExceeded?: (system: string, time: number) => void;

    constructor(engine: any) {
        this.engine = engine;
    }

    /**
     * Start recording performance data
     */
    startRecording(): void {
        if (this.recording) {
            console.warn('[Profiler] Already recording');
            return;
        }

        this.currentSession = {
            startTime: Date.now(),
            frames: [],
            memorySnapshots: [],
        };

        this.recording = true;
        this.frameCount = 0;
        console.log('[Profiler] Started recording');
    }

    /**
     * Stop recording and return the session data
     */
    stopRecording(): ProfilingSession | null {
        if (!this.recording) {
            console.warn('[Profiler] Not currently recording');
            return null;
        }

        this.recording = false;

        if (this.currentSession) {
            this.currentSession.endTime = Date.now();
        }

        const session = this.currentSession;
        this.currentSession = null;

        console.log(`[Profiler] Stopped recording (${session?.frames.length || 0} frames)`);
        return session;
    }

    /**
     * Record a frame (called during engine update)
     */
    recordFrame(): void {
        if (!this.recording || !this.currentSession) return;

        const profiles = this.engine.getSystemProfiles?.() || [];

        const frameProfile: FrameProfile = {
            frameNumber: this.frameCount++,
            timestamp: Date.now(),
            duration: 0,
            systems: profiles.map((profile: SystemProfile) => ({
                name: profile.name,
                duration: profile.executionTime,
                entityCount: profile.entityCount,
            })),
        };

        // Calculate total frame duration
        frameProfile.duration = frameProfile.systems.reduce((sum, sys) => sum + sys.duration, 0);

        this.currentSession.frames.push(frameProfile);

        // Check performance budgets
        this.checkBudgets(frameProfile);

        // Take memory snapshot periodically
        const now = Date.now();
        if (now - this.lastSnapshotTime >= this.snapshotInterval) {
            this.takeMemorySnapshot();
            this.lastSnapshotTime = now;
        }
    }

    /**
     * Export profiling data to Chrome DevTools trace format
     */
    exportChromeTrace(session?: ProfilingSession): string {
        const data = session || this.currentSession;

        if (!data) {
            console.warn('[Profiler] No session data to export');
            return '{}';
        }

        const traceEvents: any[] = [];
        const pid = 1;
        const tid = 1;

        // Convert frames to trace events
        data.frames.forEach((frame) => {
            let timestamp = frame.timestamp * 1000; // Convert to microseconds

            frame.systems.forEach((system) => {
                traceEvents.push({
                    name: system.name,
                    cat: 'system',
                    ph: 'X', // Complete event
                    ts: timestamp,
                    dur: system.duration * 1000, // Convert to microseconds
                    pid,
                    tid,
                    args: {
                        entityCount: system.entityCount,
                        frameNumber: frame.frameNumber,
                    },
                });

                timestamp += system.duration * 1000;
            });
        });

        const trace = {
            traceEvents,
            displayTimeUnit: 'ms',
            systemTraceEvents: 'OrionECS Profiler',
            otherData: {
                version: '1.0.0',
                frameCount: data.frames.length,
                duration: data.endTime ? data.endTime - data.startTime : 0,
            },
        };

        return JSON.stringify(trace, null, 2);
    }

    /**
     * Detect potential memory leaks
     */
    detectMemoryLeaks(): Array<{
        type: string;
        count: number;
        trend: 'increasing' | 'stable' | 'decreasing';
        severity: 'low' | 'medium' | 'high';
    }> {
        const leaks: Array<{
            type: string;
            count: number;
            trend: 'increasing' | 'stable' | 'decreasing';
            severity: 'low' | 'medium' | 'high';
        }> = [];

        if (this.memorySnapshots.length < 3) {
            console.warn(
                '[Profiler] Not enough memory snapshots for leak detection (need at least 3)'
            );
            return leaks;
        }

        // Analyze each component type
        const componentTypes = new Set<string>();
        this.memorySnapshots.forEach((snapshot) => {
            snapshot.components.forEach((count, type) => {
                componentTypes.add(type);
            });
        });

        componentTypes.forEach((type) => {
            const counts = this.memorySnapshots.map(
                (snapshot) => snapshot.components.get(type) || 0
            );

            // Calculate trend
            const recent = counts.slice(-3);
            const isIncreasing = recent[2] > recent[1] && recent[1] > recent[0];
            const isDecreasing = recent[2] < recent[1] && recent[1] < recent[0];

            const trend = isIncreasing ? 'increasing' : isDecreasing ? 'decreasing' : 'stable';

            // Calculate severity (guard against division by zero)
            const growthRate =
                recent[0] === 0 ? (recent[2] > 0 ? 1 : 0) : (recent[2] - recent[0]) / recent[0];
            let severity: 'low' | 'medium' | 'high' = 'low';

            if (growthRate > 0.5) severity = 'high';
            else if (growthRate > 0.2) severity = 'medium';

            if (trend === 'increasing' && severity !== 'low') {
                leaks.push({
                    type,
                    count: recent[2],
                    trend,
                    severity,
                });
            }
        });

        return leaks;
    }

    /**
     * Set a performance budget for a system
     */
    setBudget(systemName: string, maxTimeMs: number): void {
        this.budgets.set(systemName, {
            system: systemName,
            maxTimeMs,
            violations: 0,
        });

        console.log(`[Profiler] Set budget for ${systemName}: ${maxTimeMs}ms`);
    }

    /**
     * Remove a performance budget
     */
    removeBudget(systemName: string): void {
        this.budgets.delete(systemName);
        console.log(`[Profiler] Removed budget for ${systemName}`);
    }

    /**
     * Get all performance budgets
     */
    getBudgets(): PerformanceBudget[] {
        return Array.from(this.budgets.values());
    }

    /**
     * Set callback for budget exceeded events
     */
    onBudgetExceededCallback(callback: (system: string, time: number) => void): void {
        this.onBudgetExceeded = callback;
    }

    /**
     * Get profiling statistics
     */
    getStats(): {
        isRecording: boolean;
        frameCount: number;
        averageFrameTime: number;
        budgetViolations: number;
        memorySnapshots: number;
    } {
        let averageFrameTime = 0;
        let budgetViolations = 0;

        if (this.currentSession && this.currentSession.frames.length > 0) {
            const totalTime = this.currentSession.frames.reduce(
                (sum, frame) => sum + frame.duration,
                0
            );
            averageFrameTime = totalTime / this.currentSession.frames.length;
        }

        this.budgets.forEach((budget) => {
            budgetViolations += budget.violations;
        });

        return {
            isRecording: this.recording,
            frameCount: this.frameCount,
            averageFrameTime,
            budgetViolations,
            memorySnapshots: this.memorySnapshots.length,
        };
    }

    /**
     * Print profiling summary
     */
    printSummary(): void {
        const stats = this.getStats();

        console.log('');
        console.log('═'.repeat(60));
        console.log('  PROFILER SUMMARY');
        console.log('═'.repeat(60));
        console.log(`  Recording: ${stats.isRecording ? 'Yes' : 'No'}`);
        console.log(`  Frames Recorded: ${stats.frameCount}`);
        console.log(`  Average Frame Time: ${stats.averageFrameTime.toFixed(2)}ms`);
        console.log(`  Budget Violations: ${stats.budgetViolations}`);
        console.log(`  Memory Snapshots: ${stats.memorySnapshots}`);
        console.log('');

        if (this.budgets.size > 0) {
            console.log('  Performance Budgets:');
            this.budgets.forEach((budget) => {
                console.log(
                    `    ${budget.system}: ${budget.maxTimeMs}ms (violations: ${budget.violations})`
                );
            });
            console.log('');
        }

        console.log('═'.repeat(60));
        console.log('');
    }

    // Private helper methods

    private checkBudgets(frame: FrameProfile): void {
        frame.systems.forEach((system) => {
            const budget = this.budgets.get(system.name);
            if (budget && system.duration > budget.maxTimeMs) {
                budget.violations++;

                console.warn(
                    `[Profiler] Budget exceeded: ${system.name} took ${system.duration.toFixed(2)}ms (budget: ${budget.maxTimeMs}ms)`
                );

                if (this.onBudgetExceeded) {
                    this.onBudgetExceeded(system.name, system.duration);
                }
            }
        });
    }

    private takeMemorySnapshot(): void {
        const memoryStats = this.engine.getMemoryStats?.() || {};

        const snapshot: MemorySnapshot = {
            timestamp: Date.now(),
            entities: memoryStats.activeEntities || 0,
            components: new Map(),
        };

        const componentArrays = memoryStats.componentArrays || {};
        for (const [type, count] of Object.entries(componentArrays)) {
            snapshot.components.set(type, count as number);
        }

        this.memorySnapshots.push(snapshot);

        if (this.currentSession) {
            this.currentSession.memorySnapshots.push(snapshot);
        }
    }
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Profiling Plugin with type-safe engine extension.
 */
export class ProfilingPlugin implements EnginePlugin<{ profiler: IProfilerAPI }> {
    name = 'ProfilingPlugin';
    version = '1.0.0';

    /** Type brand for compile-time type inference */
    declare readonly __extensions: { profiler: IProfilerAPI };

    private profilerAPI?: ProfilerAPI;
    private unsubscribeUpdate?: () => void;

    install(context: PluginContext): void {
        const engine = context.getEngine();

        // Create profiler API
        this.profilerAPI = new ProfilerAPI(engine);

        // Hook into engine update to record frames
        this.unsubscribeUpdate = context.on('beforeAct', () => {
            this.profilerAPI?.recordFrame();
        });

        // Extend the engine with profiler API
        context.extend('profiler', this.profilerAPI);

        console.log('[ProfilingPlugin] Installed successfully');
    }

    uninstall(): void {
        // Stop recording if active
        if (this.profilerAPI) {
            this.profilerAPI.stopRecording();
        }

        // Clean up event subscriptions
        if (this.unsubscribeUpdate) {
            this.unsubscribeUpdate();
        }

        console.log('[ProfilingPlugin] Uninstalled successfully');
    }
}

/**
 * Usage example:
 *
 * import { EngineBuilder } from '../../../packages/core/src/index';
 * import { ProfilingPlugin } from './examples/ProfilingPlugin';
 *
 * const engine = new EngineBuilder()
 *   .withDebugMode(true)
 *   .use(new ProfilingPlugin())
 *   .build();
 *
 * // Start recording
 * engine.profiler.startRecording();
 *
 * // Run your game for a while
 * for (let i = 0; i < 100; i++) {
 *   engine.update();
 * }
 *
 * // Stop recording and get session
 * const session = engine.profiler.stopRecording();
 *
 * // Export to Chrome DevTools trace format
 * const trace = engine.profiler.exportChromeTrace(session);
 * // Save this to a file and load in chrome://tracing
 * require('fs').writeFileSync('trace.json', trace);
 *
 * // Set performance budgets
 * engine.profiler.setBudget('MovementSystem', 2.0); // 2ms max
 * engine.profiler.setBudget('RenderSystem', 16.0); // 16ms max
 *
 * // Listen for budget violations
 * engine.profiler.onBudgetExceededCallback((system, time) => {
 *   console.error(`Performance issue: ${system} took ${time}ms`);
 * });
 *
 * // Detect memory leaks
 * const leaks = engine.profiler.detectMemoryLeaks();
 * if (leaks.length > 0) {
 *   console.warn('Potential memory leaks detected:');
 *   leaks.forEach(leak => {
 *     console.warn(`  ${leak.type}: ${leak.count} instances (${leak.trend}, ${leak.severity} severity)`);
 *   });
 * }
 *
 * // Print summary
 * engine.profiler.printSummary();
 *
 * // Use cases:
 * // - Performance optimization and bottleneck identification
 * // - Memory leak detection in long-running applications
 * // - Performance regression testing
 * // - Production monitoring with budgets
 */
