/**
 * Budget Types and Interfaces for OrionECS
 *
 * This module defines all types for the performance budgeting system,
 * including budget configurations, violations, and enforcement strategies.
 *
 * @packageDocumentation
 * @module BudgetTypes
 */

// =============================================================================
// Budget Types
// =============================================================================

/**
 * Types of performance budgets supported by the system.
 */
export type BudgetType = 'time' | 'memory' | 'entityCount' | 'frameTime' | 'queryTime';

/**
 * Enforcement mode for budget violations.
 *
 * - `warning`: Log warnings but continue execution
 * - `strict`: Throw errors on budget violations
 * - `adaptive`: Dynamically adjust behavior based on violations
 */
export type EnforcementMode = 'warning' | 'strict' | 'adaptive';

/**
 * Severity level of a budget violation.
 */
export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

// =============================================================================
// Budget Configuration Interfaces
// =============================================================================

/**
 * Base budget configuration shared by all budget types.
 */
export interface BaseBudgetConfig {
    /** Unique identifier for this budget */
    id?: string;
    /** Display name for the budget */
    name: string;
    /** Type of budget */
    type: BudgetType;
    /** Enforcement mode for violations */
    enforcementMode: EnforcementMode;
    /** Whether this budget is currently enabled */
    enabled: boolean;
    /** Warning threshold as percentage of limit (0-1), triggers warning before violation */
    warningThreshold?: number;
    /** Tags for categorizing/filtering budgets */
    tags?: string[];
}

/**
 * Time budget configuration for system execution time limits.
 */
export interface TimeBudgetConfig extends BaseBudgetConfig {
    type: 'time';
    /** Maximum execution time in milliseconds */
    maxTimeMs: number;
    /** System name this budget applies to (or '*' for all systems) */
    systemName: string;
    /** Whether to use average time over window instead of single execution */
    useAverageWindow?: boolean;
    /** Number of samples to use for average calculation */
    averageWindowSize?: number;
}

/**
 * Memory budget configuration for component/entity memory limits.
 */
export interface MemoryBudgetConfig extends BaseBudgetConfig {
    type: 'memory';
    /** Maximum memory in bytes (estimated) */
    maxMemoryBytes: number;
    /** Component type name to monitor (or '*' for total memory) */
    componentName?: string;
}

/**
 * Entity count budget configuration.
 */
export interface EntityCountBudgetConfig extends BaseBudgetConfig {
    type: 'entityCount';
    /** Maximum number of entities allowed */
    maxEntities: number;
    /** Optional tag filter - only count entities with this tag */
    tagFilter?: string;
    /** Optional component filter - only count entities with this component */
    componentFilter?: string;
}

/**
 * Frame time budget for overall frame duration.
 */
export interface FrameTimeBudgetConfig extends BaseBudgetConfig {
    type: 'frameTime';
    /** Target frame time in milliseconds (e.g., 16.67 for 60 FPS) */
    targetFrameTimeMs: number;
    /** Maximum allowed deviation from target */
    maxDeviationMs?: number;
    /** Use average frame time over window */
    useAverageWindow?: boolean;
    /** Number of frames to average */
    averageWindowSize?: number;
}

/**
 * Query time budget for query execution limits.
 */
export interface QueryTimeBudgetConfig extends BaseBudgetConfig {
    type: 'queryTime';
    /** Maximum query execution time in milliseconds */
    maxTimeMs: number;
    /** Query identifier or pattern */
    queryPattern?: string;
}

/**
 * Union type of all budget configurations.
 */
export type BudgetConfig =
    | TimeBudgetConfig
    | MemoryBudgetConfig
    | EntityCountBudgetConfig
    | FrameTimeBudgetConfig
    | QueryTimeBudgetConfig;

// =============================================================================
// Budget Violation Types
// =============================================================================

/**
 * Represents a single budget violation event.
 */
export interface BudgetViolation {
    /** The budget that was violated */
    budgetId: string;
    /** Type of the violated budget */
    budgetType: BudgetType;
    /** Name of the budget */
    budgetName: string;
    /** Timestamp when the violation occurred */
    timestamp: number;
    /** The actual value that exceeded the limit */
    actualValue: number;
    /** The budget limit that was exceeded */
    limitValue: number;
    /** Percentage over the limit (e.g., 1.5 = 50% over) */
    overageRatio: number;
    /** Severity of the violation */
    severity: ViolationSeverity;
    /** Additional context about the violation */
    context?: Record<string, unknown>;
    /** Frame number when violation occurred */
    frameNumber?: number;
}

/**
 * Aggregated statistics for budget violations.
 */
export interface ViolationStats {
    /** Budget ID these stats belong to */
    budgetId: string;
    /** Total number of violations */
    totalViolations: number;
    /** Number of violations in the last time window */
    recentViolations: number;
    /** Time window for recent violations in ms */
    recentWindowMs: number;
    /** First violation timestamp */
    firstViolationTime?: number;
    /** Last violation timestamp */
    lastViolationTime?: number;
    /** Average overage ratio */
    averageOverageRatio: number;
    /** Maximum overage ratio observed */
    maxOverageRatio: number;
    /** Violation rate (violations per second) */
    violationRate: number;
    /** Trend: increasing, stable, or decreasing violations */
    trend: 'increasing' | 'stable' | 'decreasing';
}

// =============================================================================
// Budget State and Metrics
// =============================================================================

/**
 * Current state of a budget.
 */
export interface BudgetState {
    /** The budget configuration */
    config: BudgetConfig;
    /** Whether the budget is currently being violated */
    isViolated: boolean;
    /** Whether warning threshold is exceeded */
    isWarning: boolean;
    /** Current measured value */
    currentValue: number;
    /** Historical values for trending */
    recentValues: number[];
    /** Maximum window size for recent values */
    maxHistorySize: number;
    /** Violation statistics */
    violationStats: ViolationStats;
    /** Last time this budget was checked */
    lastCheckTime: number;
}

/**
 * Overall budget system metrics.
 */
export interface BudgetSystemMetrics {
    /** Total number of active budgets */
    totalBudgets: number;
    /** Number of budgets currently in violation */
    violatedBudgets: number;
    /** Number of budgets in warning state */
    warningBudgets: number;
    /** Total violations across all budgets */
    totalViolations: number;
    /** Violations in the last minute */
    violationsLastMinute: number;
    /** Overall health score (0-100) */
    healthScore: number;
    /** Budget check overhead in milliseconds */
    overheadMs: number;
    /** Timestamp of these metrics */
    timestamp: number;
}

// =============================================================================
// Adaptive Strategy Types
// =============================================================================

/**
 * Configuration for adaptive enforcement behavior.
 */
export interface AdaptiveStrategyConfig {
    /** Number of violations before escalating response */
    escalationThreshold: number;
    /** Time window for counting violations (ms) */
    escalationWindowMs: number;
    /** Cooldown period after de-escalation (ms) */
    cooldownMs: number;
    /** Actions to take at each escalation level */
    escalationActions: AdaptiveAction[];
}

/**
 * Adaptive action to take in response to violations.
 */
export interface AdaptiveAction {
    /** Escalation level (0 = first response) */
    level: number;
    /** Action type */
    action: AdaptiveActionType;
    /** Parameters for the action */
    params?: Record<string, unknown>;
}

/**
 * Types of adaptive actions.
 */
export type AdaptiveActionType =
    | 'logWarning'
    | 'logError'
    | 'skipSystem'
    | 'reduceEntityBatch'
    | 'throttleSystem'
    | 'disableSystem'
    | 'emitEvent'
    | 'callback';

/**
 * Current state of adaptive enforcement for a budget.
 */
export interface AdaptiveState {
    /** Current escalation level */
    currentLevel: number;
    /** Violations in current window */
    violationsInWindow: number;
    /** Window start time */
    windowStartTime: number;
    /** Whether currently in cooldown */
    inCooldown: boolean;
    /** Cooldown end time */
    cooldownEndTime?: number;
    /** Last action taken */
    lastAction?: AdaptiveActionType;
    /** Time of last action */
    lastActionTime?: number;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Event emitted when a budget violation occurs.
 */
export interface BudgetViolationEvent {
    type: 'budgetViolation';
    violation: BudgetViolation;
    state: BudgetState;
}

/**
 * Event emitted when a budget enters/exits warning state.
 */
export interface BudgetWarningEvent {
    type: 'budgetWarning';
    budgetId: string;
    isWarning: boolean;
    currentValue: number;
    warningThreshold: number;
    limitValue: number;
}

/**
 * Event emitted when adaptive action is taken.
 */
export interface AdaptiveActionEvent {
    type: 'adaptiveAction';
    budgetId: string;
    action: AdaptiveAction;
    state: AdaptiveState;
}

/**
 * Event emitted for budget system health updates.
 */
export interface BudgetHealthEvent {
    type: 'budgetHealth';
    metrics: BudgetSystemMetrics;
    previousHealthScore: number;
}

/**
 * Union type of all budget events.
 */
export type BudgetEvent =
    | BudgetViolationEvent
    | BudgetWarningEvent
    | AdaptiveActionEvent
    | BudgetHealthEvent;

// =============================================================================
// Callback Types
// =============================================================================

/**
 * Callback for budget violation events.
 */
export type BudgetViolationCallback = (event: BudgetViolationEvent) => void;

/**
 * Callback for budget warning events.
 */
export type BudgetWarningCallback = (event: BudgetWarningEvent) => void;

/**
 * Callback for adaptive action events.
 */
export type AdaptiveActionCallback = (event: AdaptiveActionEvent) => void;

/**
 * Callback for budget health events.
 */
export type BudgetHealthCallback = (event: BudgetHealthEvent) => void;

/**
 * Callback for any budget event.
 */
export type BudgetEventCallback = (event: BudgetEvent) => void;

// =============================================================================
// Configuration Builder Types
// =============================================================================

/**
 * Fluent builder for creating budget configurations.
 */
export interface BudgetConfigBuilder<T extends BudgetConfig> {
    /** Set the budget name */
    named(name: string): this;
    /** Set enforcement mode */
    withEnforcement(mode: EnforcementMode): this;
    /** Set warning threshold (0-1) */
    withWarningAt(threshold: number): this;
    /** Enable or disable the budget */
    enabled(isEnabled: boolean): this;
    /** Add tags */
    withTags(...tags: string[]): this;
    /** Build the configuration */
    build(): T;
}

// =============================================================================
// Dashboard Types
// =============================================================================

/**
 * Configuration for budget dashboard display.
 */
export interface DashboardConfig {
    /** Whether to show the dashboard */
    enabled: boolean;
    /** Update interval in milliseconds */
    updateIntervalMs: number;
    /** Position on screen */
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** Opacity (0-1) */
    opacity: number;
    /** Whether to show mini or full mode */
    mode: 'mini' | 'full';
    /** Which budget types to display */
    displayTypes: BudgetType[];
    /** Whether to show violation history */
    showHistory: boolean;
    /** Maximum history entries to display */
    maxHistoryEntries: number;
}

/**
 * Dashboard data for rendering.
 */
export interface DashboardData {
    /** Overall system metrics */
    metrics: BudgetSystemMetrics;
    /** Individual budget states */
    budgets: BudgetState[];
    /** Recent violations */
    recentViolations: BudgetViolation[];
    /** Timestamp of data */
    timestamp: number;
}

// =============================================================================
// Telemetry Types
// =============================================================================

/**
 * Configuration for production telemetry.
 */
export interface TelemetryConfig {
    /** Whether telemetry is enabled */
    enabled: boolean;
    /** Sampling rate (0-1) for detailed metrics */
    samplingRate: number;
    /** Endpoint for sending telemetry data */
    endpoint?: string;
    /** Batch size before sending */
    batchSize: number;
    /** Flush interval in milliseconds */
    flushIntervalMs: number;
    /** Include stack traces in violation reports */
    includeStackTraces: boolean;
    /** Custom metadata to include */
    metadata?: Record<string, unknown>;
}

/**
 * Telemetry data payload.
 */
export interface TelemetryPayload {
    /** Session identifier */
    sessionId: string;
    /** Application identifier */
    appId?: string;
    /** Timestamp of payload creation */
    timestamp: number;
    /** Budget system metrics */
    metrics: BudgetSystemMetrics;
    /** Sampled violations */
    violations: BudgetViolation[];
    /** Custom metadata */
    metadata?: Record<string, unknown>;
}
