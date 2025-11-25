/**
 * State Machine Types
 *
 * Type definitions for the ECS-native state machine plugin.
 *
 * @packageDocumentation
 */

import type { ComponentIdentifier, EntityDef } from '../../../packages/core/src/index';

// ============================================================================
// Comparison Operations
// ============================================================================

/**
 * Comparison operators for value-based conditions.
 */
export type ComparisonOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

// ============================================================================
// Condition Types (Discriminated Union)
// ============================================================================

/**
 * Condition that checks if an entity has a specific component.
 */
export interface HasComponentCondition<T> {
    readonly type: 'hasComponent';
    readonly component: ComponentIdentifier<T>;
}

/**
 * Condition that checks if an entity is missing a specific component.
 */
export interface MissingComponentCondition<T> {
    readonly type: 'missingComponent';
    readonly component: ComponentIdentifier<T>;
}

/**
 * Condition that compares a component property value.
 */
export interface ComponentValueCondition<T, K extends keyof T> {
    readonly type: 'componentValue';
    readonly component: ComponentIdentifier<T>;
    readonly property: K;
    readonly op: ComparisonOp;
    readonly value: T[K];
}

/**
 * Condition based on time spent in current state.
 */
export interface StateTimeCondition {
    readonly type: 'stateTime';
    readonly op: ComparisonOp;
    readonly seconds: number;
}

/**
 * Condition triggered by a message on the message bus.
 */
export interface MessageCondition {
    readonly type: 'message';
    readonly messageType: string;
}

/**
 * Condition using a registered predicate function.
 */
export interface PredicateCondition<K extends string, TArgs> {
    readonly type: 'predicate';
    readonly name: K;
    readonly args: TArgs;
}

/**
 * Composite condition requiring all sub-conditions to be true.
 */
export interface AndCondition {
    readonly type: 'and';
    readonly conditions: readonly Condition[];
}

/**
 * Composite condition requiring any sub-condition to be true.
 */
export interface OrCondition {
    readonly type: 'or';
    readonly conditions: readonly Condition[];
}

/**
 * Condition that inverts another condition.
 */
export interface NotCondition {
    readonly type: 'not';
    readonly condition: Condition;
}

/**
 * Union of all condition types.
 * Uses generic bounds that allow any valid condition created by the factory functions.
 * Note: These bounds are intentionally wide to support the ECS pattern where
 * component types are determined at runtime.
 */
export type Condition =
    // biome-ignore lint/suspicious/noExplicitAny: Component type is determined at runtime
    | HasComponentCondition<any>
    // biome-ignore lint/suspicious/noExplicitAny: Component type is determined at runtime
    | MissingComponentCondition<any>
    // biome-ignore lint/suspicious/noExplicitAny: Component and property types are determined at runtime
    | ComponentValueCondition<any, any>
    | StateTimeCondition
    | MessageCondition
    // biome-ignore lint/suspicious/noExplicitAny: Predicate args are determined at runtime
    | PredicateCondition<any, any>
    | AndCondition
    | OrCondition
    | NotCondition;

// ============================================================================
// Transition Types
// ============================================================================

/**
 * Rule defining a state transition.
 */
export interface TransitionRule<
    TFrom extends ComponentIdentifier = ComponentIdentifier,
    TTo extends ComponentIdentifier = ComponentIdentifier,
> {
    /** Source state(s) - can be specific state(s) or '*' for any */
    readonly from: TFrom | readonly TFrom[] | '*';
    /** Target state component */
    readonly to: TTo;
    /** Conditions that must be met for transition */
    readonly conditions: readonly Condition[];
    /** Higher priority transitions are evaluated first */
    readonly priority?: number;
    /** Constructor arguments for target state component */
    readonly args?: unknown[];
}

// ============================================================================
// State Definition Types
// ============================================================================

/**
 * Definition of a complete state machine.
 */
export interface StateDefinition {
    /** Unique name for this state machine definition */
    readonly name: string;
    /** Valid state components for this machine */
    readonly states: readonly ComponentIdentifier[];
    /** Transition rules */
    readonly transitions: readonly TransitionRule[];
    /** Initial state component */
    readonly initialState: ComponentIdentifier;
}

// ============================================================================
// Predicate Types
// ============================================================================

/**
 * Base predicate registry with built-in predicates.
 */
export interface BasePredicateRegistry {
    /** Check time in current state */
    'state.time': { op: ComparisonOp; seconds: number };
    /** Random chance (0-1 probability) */
    'random.chance': { probability: number };
}

/**
 * Function signature for predicate implementations.
 */
export type PredicateFn<TArgs = unknown> = (
    entity: EntityDef,
    args: TArgs,
    context: PredicateContext
) => boolean;

/**
 * Context passed to predicate functions.
 */
export interface PredicateContext {
    /** Get the engine instance */
    getEngine(): unknown;
    /** Get delta time for current frame */
    getDeltaTime(): number;
}

// ============================================================================
// State History Types
// ============================================================================

/**
 * Entry in state history for debugging.
 */
export interface StateHistoryEntry {
    /** State component type that was active */
    readonly stateType: ComponentIdentifier;
    /** Timestamp when state was entered */
    readonly enteredAt: number;
    /** Timestamp when state was exited (null if current) */
    readonly exitedAt: number | null;
    /** Duration in state (milliseconds) */
    readonly duration: number;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event emitted when entering a state.
 */
export interface StateEnterEvent {
    /** The entity that changed state */
    readonly entity: EntityDef;
    /** The state component type being entered */
    readonly stateType: ComponentIdentifier;
    /** The previous state component type (if any) */
    readonly previousStateType: ComponentIdentifier | null;
    /** Time spent in previous state (seconds) */
    readonly previousStateTime: number;
}

/**
 * Event emitted when exiting a state.
 */
export interface StateExitEvent {
    /** The entity that changed state */
    readonly entity: EntityDef;
    /** The state component type being exited */
    readonly stateType: ComponentIdentifier;
    /** Time spent in this state (seconds) */
    readonly stateTime: number;
}
