/**
 * Budget Plugin for OrionECS
 *
 * Provides comprehensive performance budgeting and monitoring capabilities
 * including time, memory, entity count, and frame time budgets with
 * configurable enforcement modes (warning, strict, adaptive).
 *
 * @packageDocumentation
 * @module @orion-ecs/budgets
 *
 * @example Basic Usage
 * ```typescript
 * import { EngineBuilder } from '@orion-ecs/core';
 * import { BudgetPlugin } from '@orion-ecs/budgets';
 *
 * const engine = new EngineBuilder()
 *   .withDebugMode(true)
 *   .use(new BudgetPlugin())
 *   .build();
 *
 * // Add budgets
 * engine.budgets.addTimeBudget('MovementSystem', 2.0);
 * engine.budgets.addFrameTimeBudget(16.67); // 60 FPS
 * engine.budgets.addEntityCountBudget(10000);
 *
 * // Listen for violations
 * engine.budgets.onViolation((event) => {
 *   console.error(`Budget violation: ${event.violation.budgetName}`);
 * });
 *
 * // Check metrics
 * const metrics = engine.budgets.getMetrics();
 * console.log(`Health score: ${metrics.healthScore}%`);
 *
 * // Print summary
 * engine.budgets.printSummary();
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * import { BudgetPlugin, AdaptiveStrategyConfig } from '@orion-ecs/budgets';
 *
 * const adaptiveStrategy: AdaptiveStrategyConfig = {
 *   escalationThreshold: 5,
 *   escalationWindowMs: 10000,
 *   cooldownMs: 30000,
 *   escalationActions: [
 *     { level: 0, action: 'logWarning' },
 *     { level: 1, action: 'logError' },
 *     { level: 2, action: 'throttleSystem' },
 *     { level: 3, action: 'disableSystem' }
 *   ]
 * };
 *
 * const engine = new EngineBuilder()
 *   .use(new BudgetPlugin({
 *     autoCheck: true,
 *     defaultEnforcementMode: 'adaptive',
 *     adaptiveStrategy
 *   }))
 *   .build();
 * ```
 *
 * @example Dashboard Usage
 * ```typescript
 * import { TextDashboard, HtmlDashboardRenderer } from '@orion-ecs/budgets';
 *
 * // Console dashboard
 * const textDashboard = new TextDashboard();
 * console.log(textDashboard.render(engine.budgets.getDashboardData()));
 *
 * // HTML dashboard
 * const htmlRenderer = new HtmlDashboardRenderer();
 * document.getElementById('dashboard').innerHTML =
 *   htmlRenderer.render(engine.budgets.getDashboardData());
 * ```
 */

// Dashboard exports
export {
    BUDGET_TYPE_ICONS,
    BudgetReportGenerator,
    HtmlDashboardRenderer,
    JsonDashboardRenderer,
    SEVERITY_COLORS,
    STATUS_COLORS,
    TextDashboard,
} from './BudgetDashboard';
export type { EngineRef } from './BudgetManager';

export { BudgetManager } from './BudgetManager';
export type { BudgetPluginConfig, IBudgetAPI } from './BudgetPlugin';
// Core exports
export { BudgetPlugin } from './BudgetPlugin';

// Type exports
export type {
    AdaptiveAction,
    AdaptiveActionCallback,
    AdaptiveActionEvent,
    AdaptiveActionType,
    AdaptiveState,
    // Adaptive strategy
    AdaptiveStrategyConfig,
    // Budget configurations
    BaseBudgetConfig,
    BudgetConfig,
    // Builder types
    BudgetConfigBuilder,
    // Events
    BudgetEvent,
    BudgetEventCallback,
    BudgetHealthCallback,
    BudgetHealthEvent,
    // State and metrics
    BudgetState,
    BudgetSystemMetrics,
    // Budget types
    BudgetType,
    BudgetViolation,
    // Callbacks
    BudgetViolationCallback,
    BudgetViolationEvent,
    BudgetWarningCallback,
    BudgetWarningEvent,
    // Dashboard and telemetry
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
    ViolationSeverity,
    ViolationStats,
} from './types';
