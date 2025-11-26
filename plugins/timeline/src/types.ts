/**
 * Timeline Plugin Types
 *
 * Type definitions for the ECS-native timeline system.
 *
 * @packageDocumentation
 */

import type { EntityDef } from '../../../packages/core/src/definitions';
import type { ComponentIdentifier } from '../../../packages/plugin-api/src/index';

// =============================================================================
// Comparison Operations
// =============================================================================

/**
 * Comparison operators for value-based conditions.
 */
export type ComparisonOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

// =============================================================================
// Easing Types
// =============================================================================

/**
 * Easing function signature.
 * Takes a progress value (0-1) and returns the eased value (0-1).
 */
export type EasingFn = (t: number) => number;

/**
 * Built-in easing function names for type-safe access.
 */
export type BuiltInEasingName =
    | 'linear'
    | 'easeInQuad'
    | 'easeOutQuad'
    | 'easeInOutQuad'
    | 'easeInCubic'
    | 'easeOutCubic'
    | 'easeInOutCubic'
    | 'easeInQuart'
    | 'easeOutQuart'
    | 'easeInOutQuart'
    | 'easeInQuint'
    | 'easeOutQuint'
    | 'easeInOutQuint'
    | 'easeInSine'
    | 'easeOutSine'
    | 'easeInOutSine'
    | 'easeInExpo'
    | 'easeOutExpo'
    | 'easeInOutExpo'
    | 'easeInCirc'
    | 'easeOutCirc'
    | 'easeInOutCirc'
    | 'easeInBack'
    | 'easeOutBack'
    | 'easeInOutBack'
    | 'easeInElastic'
    | 'easeOutElastic'
    | 'easeInOutElastic'
    | 'easeInBounce'
    | 'easeOutBounce'
    | 'easeInOutBounce';

/**
 * Built-in easing functions available by default.
 * Uses Record type with index signature for constraint compatibility.
 */
export type BuiltInEasing = {
    [K in BuiltInEasingName]: Record<string, unknown>;
} & {
    [key: string]: Record<string, unknown>;
};

/**
 * Base easing registry type for type accumulation.
 */
export type EasingRegistry = Record<string, Record<string, unknown>>;

// =============================================================================
// Property Target Types
// =============================================================================

/**
 * Type-safe property target using tuple format [Component, 'property'].
 * This ensures the property exists on the component type.
 */
export type PropertyTarget<TComponent = unknown, TProperty extends string = string> = readonly [
    ComponentIdentifier<TComponent>,
    TProperty,
];

/**
 * Helper type to extract numeric properties from a component.
 * Note: This is a best-effort type - TypeScript has limitations inferring
 * properties from class constructors in all contexts.
 */
export type NumericProperties<T> = {
    [K in keyof T]: T[K] extends number ? K : never;
}[keyof T] &
    string;

/**
 * Property target restricted to numeric properties only.
 */
export type NumericPropertyTarget<TComponent> = readonly [
    ComponentIdentifier<TComponent>,
    NumericProperties<TComponent>,
];

/**
 * Extract instance type from a component identifier.
 */
export type ComponentInstance<T> = T extends ComponentIdentifier<infer I> ? I : never;

// =============================================================================
// Timeline Action Types (Discriminated Union)
// =============================================================================

/**
 * Tween action - interpolates a component property over time.
 */
export interface TweenAction<TComponent = unknown> {
    readonly type: 'tween';
    /** Start time in milliseconds */
    readonly from: number;
    /** End time in milliseconds */
    readonly to: number;
    /** Target component and property */
    readonly target: PropertyTarget<TComponent>;
    /** Starting value (absolute) */
    readonly startValue?: number;
    /** Ending value (absolute) */
    readonly endValue?: number;
    /** Relative delta to add to current value */
    readonly delta?: number;
    /** Start from current value */
    readonly fromCurrent?: boolean;
    /** Easing function name */
    readonly easing?: string;
}

/**
 * Set action - instantly sets a component property at a specific time.
 */
export interface SetAction<TComponent = unknown> {
    readonly type: 'set';
    /** Time to execute in milliseconds */
    readonly at: number;
    /** Target component and property */
    readonly target: PropertyTarget<TComponent>;
    /** Value to set (absolute) */
    readonly value?: number;
    /** Relative delta to add to current value */
    readonly delta?: number;
}

/**
 * Add component action - adds a component to the entity at a specific time.
 */
export interface AddComponentAction<TComponent = unknown> {
    readonly type: 'add';
    /** Time to execute in milliseconds */
    readonly at: number;
    /** Component type to add */
    readonly component: ComponentIdentifier<TComponent>;
    /** Constructor arguments for the component */
    readonly args?: unknown[];
}

/**
 * Remove component action - removes a component from the entity at a specific time.
 */
export interface RemoveComponentAction<TComponent = unknown> {
    readonly type: 'remove';
    /** Time to execute in milliseconds */
    readonly at: number;
    /** Component type to remove */
    readonly component: ComponentIdentifier<TComponent>;
}

/**
 * Emit event action - emits an event at a specific time.
 */
export interface EmitAction {
    readonly type: 'emit';
    /** Time to execute in milliseconds */
    readonly at: number;
    /** Event name to emit */
    readonly event: string;
    /** Optional event data */
    readonly data?: unknown;
}

/**
 * Nested timeline action - plays another timeline at a specific time.
 */
export interface TimelineRefAction {
    readonly type: 'timeline';
    /** Time to start the nested timeline in milliseconds */
    readonly at: number;
    /** Name of the timeline to play */
    readonly name: string;
}

/**
 * Union of all timeline action types.
 */
export type TimelineAction =
    | TweenAction<unknown>
    | SetAction<unknown>
    | AddComponentAction<unknown>
    | RemoveComponentAction<unknown>
    | EmitAction
    | TimelineRefAction;

// =============================================================================
// Timeline Definition Types
// =============================================================================

/**
 * Definition of a timeline that can be registered and reused.
 */
export interface TimelineDefinition {
    /** Unique identifier for this timeline */
    readonly id: string;
    /** Human-readable name */
    readonly name?: string;
    /** Description of what this timeline does */
    readonly description?: string;
    /** Total duration in milliseconds (auto-calculated if not provided) */
    readonly duration?: number;
    /** Actions to execute during the timeline */
    readonly actions: readonly TimelineAction[];
}

// =============================================================================
// Runtime State Types
// =============================================================================

/**
 * State of a timeline action during execution.
 */
export interface ActionState {
    /** Index of the action in the definition */
    readonly actionIndex: number;
    /** Whether this action has started */
    started: boolean;
    /** Whether this action has completed */
    completed: boolean;
    /** For tweens: the captured start value */
    capturedStartValue?: number;
}

/**
 * Runtime state for a nested timeline.
 */
export interface NestedTimelineState {
    /** Name of the nested timeline */
    readonly timelineName: string;
    /** Start time offset in the parent timeline */
    readonly startOffset: number;
    /** Current elapsed time within this nested timeline */
    elapsed: number;
    /** Whether this nested timeline has completed */
    completed: boolean;
    /** Action states for the nested timeline */
    actionStates: ActionState[];
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Event emitted when a timeline starts playing.
 */
export interface TimelineStartEvent {
    /** The entity the timeline is attached to */
    readonly entity: EntityDef;
    /** The timeline definition ID */
    readonly timelineId: string;
}

/**
 * Event emitted when a timeline completes.
 */
export interface TimelineCompleteEvent {
    /** The entity the timeline was attached to */
    readonly entity: EntityDef;
    /** The timeline definition ID */
    readonly timelineId: string;
    /** Total time the timeline ran (may differ from duration if speed != 1) */
    readonly elapsedTime: number;
}

/**
 * Event emitted when a timeline is paused.
 */
export interface TimelinePauseEvent {
    /** The entity the timeline is attached to */
    readonly entity: EntityDef;
    /** The timeline definition ID */
    readonly timelineId: string;
    /** Time at which it was paused */
    readonly pausedAt: number;
}

/**
 * Event emitted when a timeline loops.
 */
export interface TimelineLoopEvent {
    /** The entity the timeline is attached to */
    readonly entity: EntityDef;
    /** The timeline definition ID */
    readonly timelineId: string;
    /** Number of times the timeline has looped */
    readonly loopCount: number;
}

// =============================================================================
// Plugin Options
// =============================================================================

/**
 * Configuration options for the Timeline Plugin.
 */
export interface TimelinePluginOptions {
    /** Priority of the TimelineSystem (default: 50, runs mid-frame) */
    systemPriority?: number;
    /** Use fixed update instead of variable update */
    useFixedUpdate?: boolean;
    /** Enable debug logging */
    debug?: boolean;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Extract constructor parameter types from a component class.
 */
export type ConstructorArgs<T> = T extends new (...args: infer A) => unknown ? A : never;

/**
 * Check if an args object has required keys.
 */
export type RequiresArgs<T> = keyof T extends never ? false : true;

/**
 * Helper to compare values.
 */
export function compare(a: unknown, op: ComparisonOp, b: unknown): boolean {
    switch (op) {
        case 'eq':
            return a === b;
        case 'neq':
            return a !== b;
        case 'gt':
            return (a as number) > (b as number);
        case 'gte':
            return (a as number) >= (b as number);
        case 'lt':
            return (a as number) < (b as number);
        case 'lte':
            return (a as number) <= (b as number);
        default:
            return false;
    }
}
