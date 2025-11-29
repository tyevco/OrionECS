/**
 * Budget Plugin for OrionECS
 *
 * Provides comprehensive performance budgeting and monitoring capabilities.
 * This plugin integrates the BudgetManager with the ECS engine and provides
 * a fluent API for configuring and monitoring performance budgets.
 *
 * @packageDocumentation
 * @module BudgetPlugin
 */

import { randomBytes } from 'node:crypto';
import type { EnginePlugin, PluginContext } from '@orion-ecs/plugin-api';
import type { EngineRef } from './BudgetManager';
import { BudgetManager } from './BudgetManager';
import type {
    AdaptiveStrategyConfig,
    BudgetConfig,
    BudgetEvent,
    BudgetEventCallback,
    BudgetState,
    BudgetSystemMetrics,
    BudgetType,
    BudgetViolation,
    DashboardConfig,
    DashboardData,
    EnforcementMode,
    EntityCountBudgetConfig,
    FrameTimeBudgetConfig,
    MemoryBudgetConfig,
    QueryTimeBudgetConfig,
    TelemetryConfig,
    TelemetryPayload,
    TimeBudgetConfig,
} from './types';

// =============================================================================
// Budget API Interface
// =============================================================================

/**
 * Public API for the budget system exposed on the engine.
 *
 * @example
 * ```typescript
 * // Add time budget for a system
 * engine.budgets.addTimeBudget('MovementSystem', 2.0);
 *
 * // Add frame time budget for 60 FPS
 * engine.budgets.addFrameTimeBudget(16.67);
 *
 * // Listen for violations
 * engine.budgets.onViolation((event) => {
 *   console.error(`Budget violated: ${event.violation.budgetName}`);
 * });
 *
 * // Get metrics
 * const metrics = engine.budgets.getMetrics();
 * console.log(`Health score: ${metrics.healthScore}%`);
 * ```
 */
export interface IBudgetAPI {
    // =========================================================================
    // Budget Registration
    // =========================================================================

    /**
     * Add a time budget for a specific system.
     *
     * @param systemName - Name of the system to monitor
     * @param maxTimeMs - Maximum execution time in milliseconds
     * @param options - Additional configuration options
     * @returns The budget ID
     *
     * @example
     * ```typescript
     * // Simple budget
     * engine.budgets.addTimeBudget('MovementSystem', 2.0);
     *
     * // With options
     * engine.budgets.addTimeBudget('PhysicsSystem', 5.0, {
     *   enforcementMode: 'strict',
     *   warningThreshold: 0.75,
     *   useAverageWindow: true,
     *   averageWindowSize: 20
     * });
     * ```
     */
    addTimeBudget(
        systemName: string,
        maxTimeMs: number,
        options?: Partial<Omit<TimeBudgetConfig, 'type' | 'systemName' | 'maxTimeMs'>>
    ): string;

    /**
     * Add a memory budget.
     *
     * @param maxMemoryBytes - Maximum memory in bytes
     * @param componentName - Optional component name to monitor
     * @param options - Additional configuration options
     * @returns The budget ID
     *
     * @example
     * ```typescript
     * // Total memory budget (100 MB)
     * engine.budgets.addMemoryBudget(100 * 1024 * 1024);
     *
     * // Component-specific budget
     * engine.budgets.addMemoryBudget(10 * 1024 * 1024, 'Position');
     * ```
     */
    addMemoryBudget(
        maxMemoryBytes: number,
        componentName?: string,
        options?: Partial<Omit<MemoryBudgetConfig, 'type' | 'maxMemoryBytes' | 'componentName'>>
    ): string;

    /**
     * Add an entity count budget.
     *
     * @param maxEntities - Maximum number of entities allowed
     * @param options - Additional configuration options
     * @returns The budget ID
     *
     * @example
     * ```typescript
     * // Global entity limit
     * engine.budgets.addEntityCountBudget(10000);
     *
     * // Tag-filtered budget
     * engine.budgets.addEntityCountBudget(1000, {
     *   tagFilter: 'enemy',
     *   enforcementMode: 'adaptive'
     * });
     * ```
     */
    addEntityCountBudget(
        maxEntities: number,
        options?: Partial<Omit<EntityCountBudgetConfig, 'type' | 'maxEntities'>>
    ): string;

    /**
     * Add a frame time budget.
     *
     * @param targetFrameTimeMs - Target frame time in milliseconds (e.g., 16.67 for 60 FPS)
     * @param options - Additional configuration options
     * @returns The budget ID
     *
     * @example
     * ```typescript
     * // 60 FPS target
     * engine.budgets.addFrameTimeBudget(16.67);
     *
     * // 30 FPS target with custom deviation
     * engine.budgets.addFrameTimeBudget(33.33, {
     *   maxDeviationMs: 5,
     *   useAverageWindow: true
     * });
     * ```
     */
    addFrameTimeBudget(
        targetFrameTimeMs: number,
        options?: Partial<Omit<FrameTimeBudgetConfig, 'type' | 'targetFrameTimeMs'>>
    ): string;

    /**
     * Add a query time budget.
     *
     * @param maxTimeMs - Maximum query execution time in milliseconds
     * @param options - Additional configuration options
     * @returns The budget ID
     */
    addQueryTimeBudget(
        maxTimeMs: number,
        options?: Partial<Omit<QueryTimeBudgetConfig, 'type' | 'maxTimeMs'>>
    ): string;

    /**
     * Register a custom budget configuration.
     *
     * @param config - The complete budget configuration
     * @returns The budget ID
     */
    registerBudget(config: BudgetConfig): string;

    /**
     * Remove a budget by ID.
     *
     * @param budgetId - The budget ID to remove
     * @returns True if the budget was removed
     */
    removeBudget(budgetId: string): boolean;

    // =========================================================================
    // Budget Management
    // =========================================================================

    /**
     * Get a budget by ID.
     *
     * @param budgetId - The budget ID
     * @returns The budget state or undefined
     */
    getBudget(budgetId: string): BudgetState | undefined;

    /**
     * Get all budget states.
     *
     * @returns Array of all budget states
     */
    getAllBudgets(): BudgetState[];

    /**
     * Get budgets by type.
     *
     * @param type - The budget type to filter by
     * @returns Array of matching budget states
     */
    getBudgetsByType(type: BudgetType): BudgetState[];

    /**
     * Enable or disable a budget.
     *
     * @param budgetId - The budget ID
     * @param enabled - Whether to enable the budget
     */
    setBudgetEnabled(budgetId: string, enabled: boolean): void;

    /**
     * Update a budget's enforcement mode.
     *
     * @param budgetId - The budget ID
     * @param mode - The new enforcement mode
     */
    setEnforcementMode(budgetId: string, mode: EnforcementMode): void;

    /**
     * Enable all budgets.
     */
    enableAll(): void;

    /**
     * Disable all budgets.
     */
    disableAll(): void;

    // =========================================================================
    // Metrics and Reporting
    // =========================================================================

    /**
     * Get overall budget system metrics.
     *
     * @returns The current budget system metrics
     */
    getMetrics(): BudgetSystemMetrics;

    /**
     * Get all recent violations.
     *
     * @param limit - Maximum number of violations to return
     * @returns Array of recent violations
     */
    getRecentViolations(limit?: number): BudgetViolation[];

    /**
     * Reset all violation statistics.
     */
    resetStats(): void;

    /**
     * Print a summary of all budgets to the console.
     */
    printSummary(): void;

    // =========================================================================
    // Event Handling
    // =========================================================================

    /**
     * Subscribe to all budget events.
     *
     * @param callback - The callback to invoke for events
     * @returns Unsubscribe function
     */
    onEvent(callback: BudgetEventCallback): () => void;

    /**
     * Subscribe to budget violation events.
     *
     * @param callback - The callback to invoke for violations
     * @returns Unsubscribe function
     */
    onViolation(callback: (event: BudgetEvent & { type: 'budgetViolation' }) => void): () => void;

    /**
     * Subscribe to budget warning events.
     *
     * @param callback - The callback to invoke for warnings
     * @returns Unsubscribe function
     */
    onWarning(callback: (event: BudgetEvent & { type: 'budgetWarning' }) => void): () => void;

    // =========================================================================
    // Dashboard
    // =========================================================================

    /**
     * Get dashboard data for rendering.
     *
     * @returns Dashboard data
     */
    getDashboardData(): DashboardData;

    /**
     * Configure the dashboard.
     *
     * @param config - Dashboard configuration
     */
    configureDashboard(config: Partial<DashboardConfig>): void;

    // =========================================================================
    // Telemetry
    // =========================================================================

    /**
     * Configure telemetry settings.
     *
     * @param config - Telemetry configuration
     */
    configureTelemetry(config: Partial<TelemetryConfig>): void;

    /**
     * Get current telemetry payload.
     *
     * @returns The telemetry payload
     */
    getTelemetryPayload(): TelemetryPayload;

    /**
     * Flush telemetry data.
     *
     * @returns Promise that resolves when telemetry is sent
     */
    flushTelemetry(): Promise<void>;
}

// =============================================================================
// Plugin Configuration
// =============================================================================

/**
 * Configuration options for the BudgetPlugin.
 */
export interface BudgetPluginConfig {
    /** Whether to automatically check budgets on each update */
    autoCheck: boolean;
    /** Default enforcement mode for new budgets */
    defaultEnforcementMode: EnforcementMode;
    /** Default warning threshold for new budgets */
    defaultWarningThreshold: number;
    /** Adaptive strategy configuration */
    adaptiveStrategy?: AdaptiveStrategyConfig;
    /** Dashboard configuration */
    dashboard?: Partial<DashboardConfig>;
    /** Telemetry configuration */
    telemetry?: Partial<TelemetryConfig>;
}

const DEFAULT_CONFIG: BudgetPluginConfig = {
    autoCheck: true,
    defaultEnforcementMode: 'warning',
    defaultWarningThreshold: 0.8,
};

const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
    enabled: false,
    updateIntervalMs: 500,
    position: 'top-right',
    opacity: 0.9,
    mode: 'mini',
    displayTypes: ['time', 'frameTime', 'entityCount', 'memory'],
    showHistory: true,
    maxHistoryEntries: 20,
};

const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
    enabled: false,
    samplingRate: 0.1,
    batchSize: 100,
    flushIntervalMs: 60000,
    includeStackTraces: false,
};

// =============================================================================
// Budget Plugin Implementation
// =============================================================================

/**
 * Budget Plugin with type-safe engine extension.
 *
 * @example
 * ```typescript
 * import { EngineBuilder } from '@orion-ecs/core';
 * import { BudgetPlugin } from '@orion-ecs/budgets';
 *
 * const engine = new EngineBuilder()
 *   .withDebugMode(true)
 *   .use(new BudgetPlugin({
 *     autoCheck: true,
 *     defaultEnforcementMode: 'adaptive'
 *   }))
 *   .build();
 *
 * // Add budgets
 * engine.budgets.addTimeBudget('MovementSystem', 2.0);
 * engine.budgets.addFrameTimeBudget(16.67);
 * engine.budgets.addEntityCountBudget(10000);
 *
 * // Listen for violations
 * engine.budgets.onViolation((event) => {
 *   console.error(`Violation: ${event.violation.budgetName}`);
 * });
 *
 * // Game loop
 * function gameLoop() {
 *   engine.update();
 *   requestAnimationFrame(gameLoop);
 * }
 * ```
 */
export class BudgetPlugin implements EnginePlugin<{ budgets: IBudgetAPI }> {
    name = 'BudgetPlugin';
    version = '1.0.0';

    /** Type brand for compile-time type inference */
    declare readonly __extensions: { budgets: IBudgetAPI };

    private config: BudgetPluginConfig;
    private manager?: BudgetManager;
    private budgetAPI?: BudgetAPI;
    private unsubscribeUpdate?: () => void;
    private dashboardConfig: DashboardConfig;
    private telemetryConfig: TelemetryConfig;
    private sessionId: string;
    private telemetryBuffer: BudgetViolation[] = [];
    private lastTelemetryFlush: number = 0;

    /**
     * Create a new BudgetPlugin.
     *
     * @param config - Plugin configuration options
     */
    constructor(config: Partial<BudgetPluginConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.dashboardConfig = { ...DEFAULT_DASHBOARD_CONFIG, ...config.dashboard };
        this.telemetryConfig = { ...DEFAULT_TELEMETRY_CONFIG, ...config.telemetry };
        this.sessionId = this.generateSessionId();
    }

    install(context: PluginContext): void {
        const engine = context.getEngine() as EngineRef;

        // Create manager
        this.manager = new BudgetManager(engine, this.config.adaptiveStrategy);

        // Create API
        this.budgetAPI = new BudgetAPI(this.manager, this);

        // Hook into engine update to check budgets
        if (this.config.autoCheck) {
            this.unsubscribeUpdate = context.on('afterAct', () => {
                this.manager?.checkBudgets();
                this.handleTelemetry();
            });
        }

        // Subscribe to violations for telemetry
        if (this.telemetryConfig.enabled) {
            this.manager.onBudgetEvent((event) => {
                if (event.type === 'budgetViolation') {
                    this.telemetryBuffer.push(event.violation);
                }
            });
        }

        // Extend the engine with budget API
        context.extend('budgets', this.budgetAPI);

        console.log('[BudgetPlugin] Installed successfully');
    }

    uninstall(): void {
        if (this.unsubscribeUpdate) {
            this.unsubscribeUpdate();
        }

        // Flush any remaining telemetry
        if (this.telemetryConfig.enabled && this.telemetryBuffer.length > 0) {
            this.flushTelemetrySync();
        }

        console.log('[BudgetPlugin] Uninstalled successfully');
    }

    // =========================================================================
    // Internal Methods
    // =========================================================================

    getDashboardConfig(): DashboardConfig {
        return this.dashboardConfig;
    }

    setDashboardConfig(config: Partial<DashboardConfig>): void {
        this.dashboardConfig = { ...this.dashboardConfig, ...config };
    }

    getTelemetryConfig(): TelemetryConfig {
        return this.telemetryConfig;
    }

    setTelemetryConfig(config: Partial<TelemetryConfig>): void {
        this.telemetryConfig = { ...this.telemetryConfig, ...config };
    }

    getSessionId(): string {
        return this.sessionId;
    }

    private generateSessionId(): string {
        return `session_${Date.now()}_${randomBytes(8).toString('hex')}`;
    }

    private handleTelemetry(): void {
        if (!this.telemetryConfig.enabled) return;

        const now = Date.now();
        const shouldFlush =
            this.telemetryBuffer.length >= this.telemetryConfig.batchSize ||
            now - this.lastTelemetryFlush >= this.telemetryConfig.flushIntervalMs;

        if (shouldFlush && this.telemetryBuffer.length > 0) {
            this.flushTelemetryAsync();
        }
    }

    private flushTelemetrySync(): void {
        // Synchronous flush for plugin uninstall
        // In a real implementation, this might use a beacon or sync XHR
        if (this.telemetryConfig.endpoint) {
            console.log(`[BudgetPlugin] Flushing ${this.telemetryBuffer.length} telemetry events`);
        }
        this.telemetryBuffer = [];
        this.lastTelemetryFlush = Date.now();
    }

    private async flushTelemetryAsync(): Promise<void> {
        if (!this.telemetryConfig.endpoint || this.telemetryBuffer.length === 0) {
            return;
        }

        const payload = this.createTelemetryPayload();
        this.telemetryBuffer = [];
        this.lastTelemetryFlush = Date.now();

        try {
            // In a real implementation, send to endpoint
            console.log(
                `[BudgetPlugin] Sending telemetry: ${payload.violations.length} violations`
            );
        } catch (error) {
            console.error('[BudgetPlugin] Telemetry flush failed:', error);
        }
    }

    createTelemetryPayload(): TelemetryPayload {
        const metrics = this.manager?.getMetrics() ?? {
            totalBudgets: 0,
            violatedBudgets: 0,
            warningBudgets: 0,
            totalViolations: 0,
            violationsLastMinute: 0,
            healthScore: 100,
            overheadMs: 0,
            timestamp: Date.now(),
        };

        // Sample violations based on sampling rate
        const sampledViolations = this.telemetryBuffer.filter(
            () => Math.random() < this.telemetryConfig.samplingRate
        );

        return {
            sessionId: this.sessionId,
            timestamp: Date.now(),
            metrics,
            violations: sampledViolations,
            metadata: this.telemetryConfig.metadata,
        };
    }
}

// =============================================================================
// Budget API Implementation
// =============================================================================

/**
 * Internal implementation of the budget API.
 */
class BudgetAPI implements IBudgetAPI {
    constructor(
        private manager: BudgetManager,
        private plugin: BudgetPlugin
    ) {}

    // =========================================================================
    // Budget Registration
    // =========================================================================

    addTimeBudget(
        systemName: string,
        maxTimeMs: number,
        options?: Partial<Omit<TimeBudgetConfig, 'type' | 'systemName' | 'maxTimeMs'>>
    ): string {
        return this.manager.addTimeBudget(systemName, maxTimeMs, options);
    }

    addMemoryBudget(
        maxMemoryBytes: number,
        componentName?: string,
        options?: Partial<Omit<MemoryBudgetConfig, 'type' | 'maxMemoryBytes' | 'componentName'>>
    ): string {
        return this.manager.addMemoryBudget(maxMemoryBytes, componentName, options);
    }

    addEntityCountBudget(
        maxEntities: number,
        options?: Partial<Omit<EntityCountBudgetConfig, 'type' | 'maxEntities'>>
    ): string {
        return this.manager.addEntityCountBudget(maxEntities, options);
    }

    addFrameTimeBudget(
        targetFrameTimeMs: number,
        options?: Partial<Omit<FrameTimeBudgetConfig, 'type' | 'targetFrameTimeMs'>>
    ): string {
        return this.manager.addFrameTimeBudget(targetFrameTimeMs, options);
    }

    addQueryTimeBudget(
        maxTimeMs: number,
        options?: Partial<Omit<QueryTimeBudgetConfig, 'type' | 'maxTimeMs'>>
    ): string {
        return this.manager.addQueryTimeBudget(maxTimeMs, options);
    }

    registerBudget(config: BudgetConfig): string {
        return this.manager.registerBudget(config);
    }

    removeBudget(budgetId: string): boolean {
        return this.manager.removeBudget(budgetId);
    }

    // =========================================================================
    // Budget Management
    // =========================================================================

    getBudget(budgetId: string): BudgetState | undefined {
        return this.manager.getBudget(budgetId);
    }

    getAllBudgets(): BudgetState[] {
        return this.manager.getAllBudgets();
    }

    getBudgetsByType(type: BudgetType): BudgetState[] {
        return this.manager.getBudgetsByType(type);
    }

    setBudgetEnabled(budgetId: string, enabled: boolean): void {
        this.manager.setBudgetEnabled(budgetId, enabled);
    }

    setEnforcementMode(budgetId: string, mode: EnforcementMode): void {
        this.manager.setEnforcementMode(budgetId, mode);
    }

    enableAll(): void {
        for (const budget of this.manager.getAllBudgets()) {
            if (budget.config.id) {
                this.manager.setBudgetEnabled(budget.config.id, true);
            }
        }
    }

    disableAll(): void {
        for (const budget of this.manager.getAllBudgets()) {
            if (budget.config.id) {
                this.manager.setBudgetEnabled(budget.config.id, false);
            }
        }
    }

    // =========================================================================
    // Metrics and Reporting
    // =========================================================================

    getMetrics(): BudgetSystemMetrics {
        return this.manager.getMetrics();
    }

    getRecentViolations(limit?: number): BudgetViolation[] {
        return this.manager.getRecentViolations(limit);
    }

    resetStats(): void {
        this.manager.resetStats();
    }

    printSummary(): void {
        this.manager.printSummary();
    }

    // =========================================================================
    // Event Handling
    // =========================================================================

    onEvent(callback: BudgetEventCallback): () => void {
        return this.manager.onBudgetEvent(callback);
    }

    onViolation(callback: (event: BudgetEvent & { type: 'budgetViolation' }) => void): () => void {
        return this.manager.onBudgetEvent((event) => {
            if (event.type === 'budgetViolation') {
                callback(event);
            }
        });
    }

    onWarning(callback: (event: BudgetEvent & { type: 'budgetWarning' }) => void): () => void {
        return this.manager.onBudgetEvent((event) => {
            if (event.type === 'budgetWarning') {
                callback(event);
            }
        });
    }

    // =========================================================================
    // Dashboard
    // =========================================================================

    getDashboardData(): DashboardData {
        return {
            metrics: this.manager.getMetrics(),
            budgets: this.manager.getAllBudgets(),
            recentViolations: this.manager.getRecentViolations(
                this.plugin.getDashboardConfig().maxHistoryEntries
            ),
            timestamp: Date.now(),
        };
    }

    configureDashboard(config: Partial<DashboardConfig>): void {
        this.plugin.setDashboardConfig(config);
    }

    // =========================================================================
    // Telemetry
    // =========================================================================

    configureTelemetry(config: Partial<TelemetryConfig>): void {
        this.plugin.setTelemetryConfig(config);
    }

    getTelemetryPayload(): TelemetryPayload {
        return this.plugin.createTelemetryPayload();
    }

    async flushTelemetry(): Promise<void> {
        // Trigger immediate flush
        const payload = this.plugin.createTelemetryPayload();
        const config = this.plugin.getTelemetryConfig();

        if (config.endpoint && payload.violations.length > 0) {
            console.log(
                `[BudgetPlugin] Manual telemetry flush: ${payload.violations.length} violations`
            );
        }
    }
}
