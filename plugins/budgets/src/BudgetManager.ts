/**
 * Budget Manager for OrionECS
 *
 * Core class that manages all performance budgets, tracks violations,
 * and enforces budget constraints at runtime.
 *
 * @packageDocumentation
 * @module BudgetManager
 */

import type { SystemProfile } from '@orion-ecs/plugin-api';
import type {
    AdaptiveAction,
    AdaptiveState,
    AdaptiveStrategyConfig,
    BudgetConfig,
    BudgetEvent,
    BudgetEventCallback,
    BudgetState,
    BudgetSystemMetrics,
    BudgetType,
    BudgetViolation,
    EnforcementMode,
    EntityCountBudgetConfig,
    FrameTimeBudgetConfig,
    MemoryBudgetConfig,
    QueryTimeBudgetConfig,
    TimeBudgetConfig,
    ViolationSeverity,
    ViolationStats,
} from './types';

// =============================================================================
// Local Type Definitions (to avoid dependency on full core package)
// =============================================================================

/**
 * Memory statistics from the engine.
 */
interface MemoryStats {
    totalEntities: number;
    activeEntities: number;
    componentArrays?: { [componentName: string]: number };
    totalMemoryEstimate?: number;
}

/**
 * Query execution statistics.
 */
interface QueryStats {
    query: unknown;
    executionCount: number;
    totalTimeMs: number;
    averageTimeMs: number;
    lastMatchCount: number;
    cacheHitRate?: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_HISTORY_SIZE = 60;
const DEFAULT_RECENT_WINDOW_MS = 60000; // 1 minute
const DEFAULT_WARNING_THRESHOLD = 0.8; // 80% of limit
const HEALTH_CHECK_INTERVAL_MS = 1000; // 1 second

// Default adaptive strategy
const DEFAULT_ADAPTIVE_STRATEGY: AdaptiveStrategyConfig = {
    escalationThreshold: 3,
    escalationWindowMs: 5000,
    cooldownMs: 10000,
    escalationActions: [
        { level: 0, action: 'logWarning' },
        { level: 1, action: 'logError' },
        { level: 2, action: 'throttleSystem', params: { factor: 0.5 } },
        { level: 3, action: 'disableSystem' },
    ],
};

// =============================================================================
// Engine Reference Interface
// =============================================================================

/**
 * Minimal engine interface for BudgetManager.
 */
export interface EngineRef {
    getSystemProfiles?(): SystemProfile[];
    getMemoryStats?(): MemoryStats;
    getQueryStats?(query?: unknown): QueryStats | QueryStats[];
    getPerformanceStats?(): {
        averageFrameTime: number;
        minFrameTime: number;
        maxFrameTime: number;
    };
    getEntityCount?(): number;
    getEntitiesWithTag?(tag: string): unknown[];
    disableSystem?(name: string): void;
    enableSystem?(name: string): void;
}

// =============================================================================
// BudgetManager Class
// =============================================================================

/**
 * Central manager for all performance budgets.
 *
 * Handles budget registration, monitoring, violation detection,
 * and enforcement across all budget types.
 *
 * @example
 * ```typescript
 * const manager = new BudgetManager(engine);
 *
 * // Add a time budget for a system
 * manager.addTimeBudget('MovementSystem', 2.0);
 *
 * // Add a frame time budget for 60 FPS
 * manager.addFrameTimeBudget(16.67);
 *
 * // Add an entity count budget
 * manager.addEntityCountBudget(10000);
 *
 * // Check budgets during update
 * manager.checkBudgets();
 * ```
 */
export class BudgetManager {
    private engine: EngineRef;
    private budgets: Map<string, BudgetState> = new Map();
    private adaptiveStates: Map<string, AdaptiveState> = new Map();
    private adaptiveStrategy: AdaptiveStrategyConfig;
    private eventListeners: BudgetEventCallback[] = [];
    private frameNumber: number = 0;
    private lastHealthCheckTime: number = 0;
    private lastMetrics: BudgetSystemMetrics | null = null;
    private checkOverheadMs: number = 0;
    private budgetIdCounter: number = 0;

    /**
     * Creates a new BudgetManager instance.
     *
     * @param engine - Reference to the ECS engine
     * @param adaptiveStrategy - Custom adaptive strategy configuration
     */
    constructor(engine: EngineRef, adaptiveStrategy?: AdaptiveStrategyConfig) {
        this.engine = engine;
        this.adaptiveStrategy = adaptiveStrategy ?? DEFAULT_ADAPTIVE_STRATEGY;
    }

    // =========================================================================
    // Budget Registration Methods
    // =========================================================================

    /**
     * Add a time budget for a specific system.
     *
     * @param systemName - Name of the system to monitor
     * @param maxTimeMs - Maximum execution time in milliseconds
     * @param options - Additional configuration options
     * @returns The budget ID
     */
    addTimeBudget(
        systemName: string,
        maxTimeMs: number,
        options: Partial<Omit<TimeBudgetConfig, 'type' | 'systemName' | 'maxTimeMs'>> = {}
    ): string {
        const config: TimeBudgetConfig = {
            id: this.generateBudgetId('time'),
            name: options.name ?? `${systemName} Time Budget`,
            type: 'time',
            systemName,
            maxTimeMs,
            enforcementMode: options.enforcementMode ?? 'warning',
            enabled: options.enabled ?? true,
            warningThreshold: options.warningThreshold ?? DEFAULT_WARNING_THRESHOLD,
            useAverageWindow: options.useAverageWindow ?? false,
            averageWindowSize: options.averageWindowSize ?? 10,
            tags: options.tags ?? [],
        };

        return this.registerBudget(config);
    }

    /**
     * Add a memory budget.
     *
     * @param maxMemoryBytes - Maximum memory in bytes
     * @param componentName - Optional component name to monitor (or total if omitted)
     * @param options - Additional configuration options
     * @returns The budget ID
     */
    addMemoryBudget(
        maxMemoryBytes: number,
        componentName?: string,
        options: Partial<Omit<MemoryBudgetConfig, 'type' | 'maxMemoryBytes' | 'componentName'>> = {}
    ): string {
        const config: MemoryBudgetConfig = {
            id: this.generateBudgetId('memory'),
            name:
                options.name ??
                (componentName ? `${componentName} Memory Budget` : 'Total Memory Budget'),
            type: 'memory',
            maxMemoryBytes,
            componentName,
            enforcementMode: options.enforcementMode ?? 'warning',
            enabled: options.enabled ?? true,
            warningThreshold: options.warningThreshold ?? DEFAULT_WARNING_THRESHOLD,
            tags: options.tags ?? [],
        };

        return this.registerBudget(config);
    }

    /**
     * Add an entity count budget.
     *
     * @param maxEntities - Maximum number of entities allowed
     * @param options - Additional configuration options
     * @returns The budget ID
     */
    addEntityCountBudget(
        maxEntities: number,
        options: Partial<Omit<EntityCountBudgetConfig, 'type' | 'maxEntities'>> = {}
    ): string {
        const config: EntityCountBudgetConfig = {
            id: this.generateBudgetId('entityCount'),
            name: options.name ?? 'Entity Count Budget',
            type: 'entityCount',
            maxEntities,
            enforcementMode: options.enforcementMode ?? 'warning',
            enabled: options.enabled ?? true,
            warningThreshold: options.warningThreshold ?? DEFAULT_WARNING_THRESHOLD,
            tagFilter: options.tagFilter,
            componentFilter: options.componentFilter,
            tags: options.tags ?? [],
        };

        return this.registerBudget(config);
    }

    /**
     * Add a frame time budget.
     *
     * @param targetFrameTimeMs - Target frame time in milliseconds (e.g., 16.67 for 60 FPS)
     * @param options - Additional configuration options
     * @returns The budget ID
     */
    addFrameTimeBudget(
        targetFrameTimeMs: number,
        options: Partial<Omit<FrameTimeBudgetConfig, 'type' | 'targetFrameTimeMs'>> = {}
    ): string {
        const fps = Math.round(1000 / targetFrameTimeMs);
        const config: FrameTimeBudgetConfig = {
            id: this.generateBudgetId('frameTime'),
            name: options.name ?? `${fps} FPS Frame Budget`,
            type: 'frameTime',
            targetFrameTimeMs,
            maxDeviationMs: options.maxDeviationMs ?? targetFrameTimeMs * 0.5,
            enforcementMode: options.enforcementMode ?? 'warning',
            enabled: options.enabled ?? true,
            warningThreshold: options.warningThreshold ?? DEFAULT_WARNING_THRESHOLD,
            useAverageWindow: options.useAverageWindow ?? true,
            averageWindowSize: options.averageWindowSize ?? 10,
            tags: options.tags ?? [],
        };

        return this.registerBudget(config);
    }

    /**
     * Add a query time budget.
     *
     * @param maxTimeMs - Maximum query execution time in milliseconds
     * @param options - Additional configuration options
     * @returns The budget ID
     */
    addQueryTimeBudget(
        maxTimeMs: number,
        options: Partial<Omit<QueryTimeBudgetConfig, 'type' | 'maxTimeMs'>> = {}
    ): string {
        const config: QueryTimeBudgetConfig = {
            id: this.generateBudgetId('queryTime'),
            name: options.name ?? 'Query Time Budget',
            type: 'queryTime',
            maxTimeMs,
            queryPattern: options.queryPattern,
            enforcementMode: options.enforcementMode ?? 'warning',
            enabled: options.enabled ?? true,
            warningThreshold: options.warningThreshold ?? DEFAULT_WARNING_THRESHOLD,
            tags: options.tags ?? [],
        };

        return this.registerBudget(config);
    }

    /**
     * Register a custom budget configuration.
     *
     * @param config - The budget configuration
     * @returns The budget ID
     */
    registerBudget(config: BudgetConfig): string {
        const id = config.id ?? this.generateBudgetId(config.type);
        const budgetConfig = { ...config, id };

        const state: BudgetState = {
            config: budgetConfig,
            isViolated: false,
            isWarning: false,
            currentValue: 0,
            recentValues: [],
            maxHistorySize: DEFAULT_HISTORY_SIZE,
            violationStats: this.createEmptyViolationStats(id),
            lastCheckTime: 0,
        };

        this.budgets.set(id, state);

        if (config.enforcementMode === 'adaptive') {
            this.adaptiveStates.set(id, this.createEmptyAdaptiveState());
        }

        return id;
    }

    /**
     * Remove a budget by ID.
     *
     * @param budgetId - The budget ID to remove
     * @returns True if the budget was removed
     */
    removeBudget(budgetId: string): boolean {
        this.adaptiveStates.delete(budgetId);
        return this.budgets.delete(budgetId);
    }

    /**
     * Get a budget by ID.
     *
     * @param budgetId - The budget ID
     * @returns The budget state or undefined
     */
    getBudget(budgetId: string): BudgetState | undefined {
        return this.budgets.get(budgetId);
    }

    /**
     * Get all budget states.
     *
     * @returns Array of all budget states
     */
    getAllBudgets(): BudgetState[] {
        return Array.from(this.budgets.values());
    }

    /**
     * Get budgets by type.
     *
     * @param type - The budget type to filter by
     * @returns Array of matching budget states
     */
    getBudgetsByType(type: BudgetType): BudgetState[] {
        return Array.from(this.budgets.values()).filter((state) => state.config.type === type);
    }

    /**
     * Enable or disable a budget.
     *
     * @param budgetId - The budget ID
     * @param enabled - Whether to enable the budget
     */
    setBudgetEnabled(budgetId: string, enabled: boolean): void {
        const state = this.budgets.get(budgetId);
        if (state) {
            state.config.enabled = enabled;
        }
    }

    /**
     * Update a budget's enforcement mode.
     *
     * @param budgetId - The budget ID
     * @param mode - The new enforcement mode
     */
    setEnforcementMode(budgetId: string, mode: EnforcementMode): void {
        const state = this.budgets.get(budgetId);
        if (state) {
            state.config.enforcementMode = mode;

            if (mode === 'adaptive' && !this.adaptiveStates.has(budgetId)) {
                this.adaptiveStates.set(budgetId, this.createEmptyAdaptiveState());
            }
        }
    }

    // =========================================================================
    // Budget Checking Methods
    // =========================================================================

    /**
     * Check all enabled budgets and record violations.
     * Call this method during the engine update loop.
     */
    checkBudgets(): void {
        const startTime = performance.now();
        this.frameNumber++;

        for (const [budgetId, state] of this.budgets) {
            if (!state.config.enabled) continue;

            const currentValue = this.measureBudgetValue(state.config);
            this.updateBudgetState(budgetId, state, currentValue);
        }

        // Periodic health check
        const now = performance.now();
        if (now - this.lastHealthCheckTime >= HEALTH_CHECK_INTERVAL_MS) {
            this.emitHealthEvent();
            this.lastHealthCheckTime = now;
        }

        this.checkOverheadMs = performance.now() - startTime;
    }

    /**
     * Check a specific budget by ID.
     *
     * @param budgetId - The budget ID to check
     * @returns The budget violation if any
     */
    checkBudget(budgetId: string): BudgetViolation | null {
        const state = this.budgets.get(budgetId);
        if (!state || !state.config.enabled) return null;

        const currentValue = this.measureBudgetValue(state.config);
        return this.updateBudgetState(budgetId, state, currentValue);
    }

    // =========================================================================
    // Metrics and Reporting
    // =========================================================================

    /**
     * Get overall budget system metrics.
     *
     * @returns The current budget system metrics
     */
    getMetrics(): BudgetSystemMetrics {
        const now = Date.now();
        const budgetStates = Array.from(this.budgets.values());

        let violatedBudgets = 0;
        let warningBudgets = 0;
        let totalViolations = 0;
        let violationsLastMinute = 0;

        for (const state of budgetStates) {
            if (state.isViolated) violatedBudgets++;
            if (state.isWarning && !state.isViolated) warningBudgets++;
            totalViolations += state.violationStats.totalViolations;
            violationsLastMinute += state.violationStats.recentViolations;
        }

        const totalBudgets = budgetStates.length;
        const healthScore = this.calculateHealthScore(
            totalBudgets,
            violatedBudgets,
            warningBudgets
        );

        this.lastMetrics = {
            totalBudgets,
            violatedBudgets,
            warningBudgets,
            totalViolations,
            violationsLastMinute,
            healthScore,
            overheadMs: this.checkOverheadMs,
            timestamp: now,
        };

        return this.lastMetrics;
    }

    /**
     * Get violation statistics for a specific budget.
     *
     * @param budgetId - The budget ID
     * @returns The violation statistics or undefined
     */
    getViolationStats(budgetId: string): ViolationStats | undefined {
        return this.budgets.get(budgetId)?.violationStats;
    }

    /**
     * Get all recent violations across all budgets.
     *
     * @param limit - Maximum number of violations to return
     * @returns Array of recent violations sorted by timestamp
     */
    getRecentViolations(limit: number = 50): BudgetViolation[] {
        const violations: BudgetViolation[] = [];

        for (const state of this.budgets.values()) {
            if (state.violationStats.lastViolationTime && state.config.id) {
                // Create a violation object from the stats
                violations.push({
                    budgetId: state.config.id,
                    budgetType: state.config.type,
                    budgetName: state.config.name,
                    timestamp: state.violationStats.lastViolationTime,
                    actualValue: state.currentValue,
                    limitValue: this.getLimitValue(state.config),
                    overageRatio: state.violationStats.maxOverageRatio,
                    severity: this.calculateSeverity(state.violationStats.maxOverageRatio),
                    frameNumber: this.frameNumber,
                });
            }
        }

        return violations.toSorted((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    }

    /**
     * Reset all violation statistics.
     */
    resetStats(): void {
        for (const [budgetId, state] of this.budgets) {
            state.violationStats = this.createEmptyViolationStats(budgetId);
            state.isViolated = false;
            state.isWarning = false;
            state.recentValues = [];
        }

        for (const adaptiveState of this.adaptiveStates.values()) {
            Object.assign(adaptiveState, this.createEmptyAdaptiveState());
        }
    }

    // =========================================================================
    // Event System
    // =========================================================================

    /**
     * Subscribe to budget events.
     *
     * @param callback - The callback to invoke for events
     * @returns Unsubscribe function
     */
    onBudgetEvent(callback: BudgetEventCallback): () => void {
        this.eventListeners.push(callback);
        return () => {
            const index = this.eventListeners.indexOf(callback);
            if (index !== -1) {
                this.eventListeners.splice(index, 1);
            }
        };
    }

    /**
     * Print a summary of all budgets to the console.
     */
    printSummary(): void {
        const metrics = this.getMetrics();

        console.log('');
        console.log('═'.repeat(70));
        console.log('  BUDGET SYSTEM SUMMARY');
        console.log('═'.repeat(70));
        console.log(`  Health Score: ${metrics.healthScore.toFixed(0)}%`);
        console.log(`  Total Budgets: ${metrics.totalBudgets}`);
        console.log(`  Violated: ${metrics.violatedBudgets} | Warning: ${metrics.warningBudgets}`);
        console.log(`  Total Violations: ${metrics.totalViolations}`);
        console.log(`  Violations (last minute): ${metrics.violationsLastMinute}`);
        console.log(`  Overhead: ${metrics.overheadMs.toFixed(3)}ms`);
        console.log('');

        if (this.budgets.size > 0) {
            console.log('  Individual Budgets:');
            console.log('  ' + '─'.repeat(66));

            for (const state of this.budgets.values()) {
                const status = state.isViolated ? '❌' : state.isWarning ? '⚠️ ' : '✅';
                const limit = this.getLimitValue(state.config);
                const percentage = ((state.currentValue / limit) * 100).toFixed(1);

                console.log(
                    `  ${status} ${state.config.name}: ${state.currentValue.toFixed(2)} / ${limit.toFixed(2)} (${percentage}%)`
                );
            }
            console.log('');
        }

        console.log('═'.repeat(70));
        console.log('');
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    private generateBudgetId(type: BudgetType): string {
        return `budget_${type}_${++this.budgetIdCounter}_${Date.now()}`;
    }

    private createEmptyViolationStats(budgetId: string): ViolationStats {
        return {
            budgetId,
            totalViolations: 0,
            recentViolations: 0,
            recentWindowMs: DEFAULT_RECENT_WINDOW_MS,
            averageOverageRatio: 0,
            maxOverageRatio: 0,
            violationRate: 0,
            trend: 'stable',
        };
    }

    private createEmptyAdaptiveState(): AdaptiveState {
        return {
            currentLevel: 0,
            violationsInWindow: 0,
            windowStartTime: Date.now(),
            inCooldown: false,
        };
    }

    private measureBudgetValue(config: BudgetConfig): number {
        switch (config.type) {
            case 'time':
                return this.measureTimeBudget(config);
            case 'memory':
                return this.measureMemoryBudget(config);
            case 'entityCount':
                return this.measureEntityCountBudget(config);
            case 'frameTime':
                return this.measureFrameTimeBudget(config);
            case 'queryTime':
                return this.measureQueryTimeBudget(config);
            default:
                return 0;
        }
    }

    private measureTimeBudget(config: TimeBudgetConfig): number {
        const profiles = this.engine.getSystemProfiles?.() ?? [];

        if (config.systemName === '*') {
            return profiles.reduce((sum, p) => sum + p.executionTime, 0);
        }

        const profile = profiles.find((p) => p.name === config.systemName);
        if (!profile) return 0;

        if (config.useAverageWindow) {
            return profile.averageTime;
        }

        return profile.executionTime;
    }

    private measureMemoryBudget(config: MemoryBudgetConfig): number {
        const memoryStats = this.engine.getMemoryStats?.();
        if (!memoryStats) return 0;

        if (config.componentName) {
            return memoryStats.componentArrays?.[config.componentName] ?? 0;
        }

        return memoryStats.totalMemoryEstimate ?? 0;
    }

    private measureEntityCountBudget(config: EntityCountBudgetConfig): number {
        if (config.tagFilter && this.engine.getEntitiesWithTag) {
            const entities = this.engine.getEntitiesWithTag(config.tagFilter);
            return entities?.length ?? 0;
        }

        return this.engine.getEntityCount?.() ?? 0;
    }

    private measureFrameTimeBudget(config: FrameTimeBudgetConfig): number {
        const stats = this.engine.getPerformanceStats?.();
        if (!stats) return 0;

        if (config.useAverageWindow) {
            return stats.averageFrameTime;
        }

        return stats.maxFrameTime;
    }

    private measureQueryTimeBudget(_config: QueryTimeBudgetConfig): number {
        const queryStats = this.engine.getQueryStats?.();
        if (!queryStats) return 0;

        if (Array.isArray(queryStats)) {
            // Return max query time if multiple queries
            return queryStats.reduce((max, q) => Math.max(max, q.averageTimeMs), 0);
        }

        return queryStats.averageTimeMs;
    }

    private getLimitValue(config: BudgetConfig): number {
        switch (config.type) {
            case 'time':
                return config.maxTimeMs;
            case 'memory':
                return config.maxMemoryBytes;
            case 'entityCount':
                return config.maxEntities;
            case 'frameTime':
                return config.targetFrameTimeMs + (config.maxDeviationMs ?? 0);
            case 'queryTime':
                return config.maxTimeMs;
            default:
                return 0;
        }
    }

    private updateBudgetState(
        budgetId: string,
        state: BudgetState,
        currentValue: number
    ): BudgetViolation | null {
        const now = Date.now();
        state.currentValue = currentValue;
        state.lastCheckTime = now;

        // Update history
        state.recentValues.push(currentValue);
        if (state.recentValues.length > state.maxHistorySize) {
            state.recentValues.shift();
        }

        const limit = this.getLimitValue(state.config);
        const warningThreshold = state.config.warningThreshold ?? DEFAULT_WARNING_THRESHOLD;
        const warningValue = limit * warningThreshold;

        const wasWarning = state.isWarning;
        const _wasViolated = state.isViolated;

        state.isWarning = currentValue >= warningValue && currentValue < limit;
        state.isViolated = currentValue >= limit;

        // Emit warning event on state change
        if (state.isWarning !== wasWarning) {
            this.emitEvent({
                type: 'budgetWarning',
                budgetId,
                isWarning: state.isWarning,
                currentValue,
                warningThreshold,
                limitValue: limit,
            });
        }

        // Handle violation
        if (state.isViolated) {
            const violation = this.recordViolation(budgetId, state, currentValue, limit);
            this.handleEnforcement(budgetId, state, violation);
            return violation;
        }

        // Update trend if no longer violated
        this.updateTrend(state.violationStats);

        return null;
    }

    private recordViolation(
        budgetId: string,
        state: BudgetState,
        currentValue: number,
        limit: number
    ): BudgetViolation {
        const now = Date.now();
        const overageRatio = currentValue / limit;
        const stats = state.violationStats;

        // Update violation stats
        stats.totalViolations++;
        stats.lastViolationTime = now;

        if (!stats.firstViolationTime) {
            stats.firstViolationTime = now;
        }

        // Update recent violations (within window)
        stats.recentViolations++;

        // Update overage stats
        const totalOverage = stats.averageOverageRatio * (stats.totalViolations - 1) + overageRatio;
        stats.averageOverageRatio = totalOverage / stats.totalViolations;
        stats.maxOverageRatio = Math.max(stats.maxOverageRatio, overageRatio);

        // Update violation rate
        const elapsed = (now - (stats.firstViolationTime ?? now)) / 1000;
        stats.violationRate = elapsed > 0 ? stats.totalViolations / elapsed : 0;

        // Update trend
        this.updateTrend(stats);

        const violation: BudgetViolation = {
            budgetId,
            budgetType: state.config.type,
            budgetName: state.config.name,
            timestamp: now,
            actualValue: currentValue,
            limitValue: limit,
            overageRatio,
            severity: this.calculateSeverity(overageRatio),
            frameNumber: this.frameNumber,
        };

        // Emit violation event
        this.emitEvent({
            type: 'budgetViolation',
            violation,
            state,
        });

        return violation;
    }

    private handleEnforcement(
        budgetId: string,
        state: BudgetState,
        violation: BudgetViolation
    ): void {
        const mode = state.config.enforcementMode;

        switch (mode) {
            case 'warning':
                console.warn(
                    `[Budget] ${state.config.name} exceeded: ${violation.actualValue.toFixed(2)} > ${violation.limitValue.toFixed(2)} (${(violation.overageRatio * 100).toFixed(1)}%)`
                );
                break;

            case 'strict':
                throw new Error(
                    `Budget violation: ${state.config.name} exceeded limit. ` +
                        `Value: ${violation.actualValue.toFixed(2)}, Limit: ${violation.limitValue.toFixed(2)}`
                );

            case 'adaptive':
                this.handleAdaptiveEnforcement(budgetId, state, violation);
                break;
        }
    }

    private handleAdaptiveEnforcement(
        budgetId: string,
        state: BudgetState,
        _violation: BudgetViolation
    ): void {
        const adaptiveState = this.adaptiveStates.get(budgetId);
        if (!adaptiveState) return;

        const now = Date.now();
        const strategy = this.adaptiveStrategy;

        // Check if we're in cooldown
        if (adaptiveState.inCooldown) {
            if (now >= (adaptiveState.cooldownEndTime ?? 0)) {
                adaptiveState.inCooldown = false;
                adaptiveState.currentLevel = Math.max(0, adaptiveState.currentLevel - 1);
            } else {
                return; // Still in cooldown, don't escalate
            }
        }

        // Check if window has expired
        if (now - adaptiveState.windowStartTime >= strategy.escalationWindowMs) {
            adaptiveState.windowStartTime = now;
            adaptiveState.violationsInWindow = 0;
        }

        adaptiveState.violationsInWindow++;

        // Check if we should escalate
        if (adaptiveState.violationsInWindow >= strategy.escalationThreshold) {
            const maxLevel = strategy.escalationActions.length - 1;
            adaptiveState.currentLevel = Math.min(adaptiveState.currentLevel + 1, maxLevel);
            adaptiveState.violationsInWindow = 0;
            adaptiveState.windowStartTime = now;
        }

        // Execute action for current level
        const action = strategy.escalationActions.find(
            (a) => a.level === adaptiveState.currentLevel
        );
        if (action) {
            this.executeAdaptiveAction(budgetId, state, action, adaptiveState);
        }
    }

    private executeAdaptiveAction(
        budgetId: string,
        state: BudgetState,
        action: AdaptiveAction,
        adaptiveState: AdaptiveState
    ): void {
        adaptiveState.lastAction = action.action;
        adaptiveState.lastActionTime = Date.now();

        switch (action.action) {
            case 'logWarning':
                console.warn(`[Budget] Adaptive warning: ${state.config.name} exceeded budget`);
                break;

            case 'logError':
                console.error(
                    `[Budget] Adaptive error: ${state.config.name} repeatedly exceeding budget`
                );
                break;

            case 'throttleSystem':
                console.warn(`[Budget] Throttling system: ${state.config.name}`);
                // Note: Actual throttling would need engine support
                break;

            case 'disableSystem':
                if (state.config.type === 'time') {
                    const systemName = (state.config as TimeBudgetConfig).systemName;
                    console.error(`[Budget] Disabling system: ${systemName}`);
                    this.engine.disableSystem?.(systemName);

                    // Start cooldown
                    adaptiveState.inCooldown = true;
                    adaptiveState.cooldownEndTime = Date.now() + this.adaptiveStrategy.cooldownMs;
                }
                break;

            case 'emitEvent':
                // Event is always emitted below
                break;

            case 'callback':
                // Custom callback from params
                const callback = action.params?.callback as (() => void) | undefined;
                callback?.();
                break;
        }

        // Emit adaptive action event
        this.emitEvent({
            type: 'adaptiveAction',
            budgetId,
            action,
            state: adaptiveState,
        });
    }

    private calculateSeverity(overageRatio: number): ViolationSeverity {
        if (overageRatio >= 2.0) return 'critical';
        if (overageRatio >= 1.5) return 'high';
        if (overageRatio >= 1.2) return 'medium';
        return 'low';
    }

    private calculateHealthScore(
        totalBudgets: number,
        violatedBudgets: number,
        warningBudgets: number
    ): number {
        if (totalBudgets === 0) return 100;

        const violationPenalty = (violatedBudgets / totalBudgets) * 60;
        const warningPenalty = (warningBudgets / totalBudgets) * 20;

        return Math.max(0, 100 - violationPenalty - warningPenalty);
    }

    private updateTrend(stats: ViolationStats): void {
        // Simple trend calculation based on recent violation rate
        const now = Date.now();
        const elapsed = now - (stats.firstViolationTime ?? now);

        if (elapsed < 30000) {
            // Not enough data
            stats.trend = 'stable';
            return;
        }

        // Compare first half to second half violation rate
        // This is a simplified approach - a real implementation might use more sophisticated analysis
        if (stats.violationRate > 1) {
            stats.trend = 'increasing';
        } else if (stats.violationRate < 0.1 && stats.totalViolations > 0) {
            stats.trend = 'decreasing';
        } else {
            stats.trend = 'stable';
        }
    }

    private emitEvent(event: BudgetEvent): void {
        for (const listener of this.eventListeners) {
            try {
                listener(event);
            } catch (error) {
                console.error('[Budget] Event listener error:', error);
            }
        }
    }

    private emitHealthEvent(): void {
        const metrics = this.getMetrics();
        const previousHealthScore = this.lastMetrics?.healthScore ?? 100;

        this.emitEvent({
            type: 'budgetHealth',
            metrics,
            previousHealthScore,
        });
    }
}
