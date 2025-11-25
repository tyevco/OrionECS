/**
 * Condition Factory Functions
 *
 * Type-safe factory functions for creating state transition conditions.
 *
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Type generics require any for flexibility */

import type { ComponentIdentifier } from '../../../packages/core/src/index';
import type {
    AndCondition,
    BasePredicateRegistry,
    ComparisonOp,
    ComponentValueCondition,
    Condition,
    HasComponentCondition,
    MessageCondition,
    MissingComponentCondition,
    NotCondition,
    OrCondition,
    PredicateCondition,
    StateTimeCondition,
    TransitionRule,
} from './types';

// ============================================================================
// Condition Factory Functions
// ============================================================================

/**
 * Factory functions for creating type-safe conditions.
 *
 * @example
 * ```typescript
 * const conditions = [
 *   when.hasComponent(AITarget),
 *   when.componentValue(Health, 'current', 'lt', 20),
 *   when.after(2),  // Shorthand for stateTime > 2
 * ];
 * ```
 */
export function createConditionFactories<
    TPredicates extends BasePredicateRegistry = BasePredicateRegistry,
>() {
    return {
        /**
         * Condition: Entity has the specified component.
         */
        hasComponent: <T>(component: ComponentIdentifier<T>): HasComponentCondition<T> => ({
            type: 'hasComponent',
            component,
        }),

        /**
         * Condition: Entity is missing the specified component.
         */
        missingComponent: <T>(component: ComponentIdentifier<T>): MissingComponentCondition<T> => ({
            type: 'missingComponent',
            component,
        }),

        /**
         * Condition: Component property matches a value.
         *
         * @example
         * ```typescript
         * when.componentValue(Health, 'current', 'lt', 20)
         * when.componentValue(AITarget, 'distance', 'lte', 5)
         * ```
         */
        componentValue: <T, K extends keyof T>(
            component: ComponentIdentifier<T>,
            property: K,
            op: ComparisonOp,
            value: T[K]
        ): ComponentValueCondition<T, K> => ({
            type: 'componentValue',
            component,
            property,
            op,
            value,
        }),

        /**
         * Condition: Time in current state matches criteria.
         */
        stateTime: (op: ComparisonOp, seconds: number): StateTimeCondition => ({
            type: 'stateTime',
            op,
            seconds,
        }),

        /**
         * Condition: Message received on message bus.
         */
        message: (messageType: string): MessageCondition => ({
            type: 'message',
            messageType,
        }),

        /**
         * Condition: Custom predicate function.
         * Only predicates registered with the plugin are valid.
         */
        predicate: <K extends keyof TPredicates & string>(
            name: K,
            args: TPredicates[K]
        ): PredicateCondition<K, TPredicates[K]> => ({
            type: 'predicate',
            name,
            args,
        }),

        /**
         * Composite: All conditions must be true.
         */
        and: (...conditions: Condition[]): AndCondition => ({
            type: 'and',
            conditions,
        }),

        /**
         * Composite: Any condition must be true.
         */
        or: (...conditions: Condition[]): OrCondition => ({
            type: 'or',
            conditions,
        }),

        /**
         * Composite: Condition must be false.
         */
        not: (condition: Condition): NotCondition => ({
            type: 'not',
            condition,
        }),

        // ========================================================================
        // Convenience Shortcuts
        // ========================================================================

        /**
         * Shorthand: State time greater than X seconds.
         *
         * @example
         * ```typescript
         * when.after(2)  // equivalent to when.stateTime('gt', 2)
         * ```
         */
        after: (seconds: number): StateTimeCondition => ({
            type: 'stateTime',
            op: 'gt',
            seconds,
        }),

        /**
         * Shorthand: State time less than X seconds.
         *
         * @example
         * ```typescript
         * when.within(1)  // equivalent to when.stateTime('lt', 1)
         * ```
         */
        within: (seconds: number): StateTimeCondition => ({
            type: 'stateTime',
            op: 'lt',
            seconds,
        }),

        /**
         * Shorthand: State time at least X seconds.
         */
        afterOrAt: (seconds: number): StateTimeCondition => ({
            type: 'stateTime',
            op: 'gte',
            seconds,
        }),

        /**
         * Shorthand: State time at most X seconds.
         */
        withinOrAt: (seconds: number): StateTimeCondition => ({
            type: 'stateTime',
            op: 'lte',
            seconds,
        }),
    } as const;
}

/**
 * Default condition factories using base predicate registry.
 */
export const when = createConditionFactories<BasePredicateRegistry>();

// ============================================================================
// Transition Helper
// ============================================================================

/**
 * Helper function to create a type-safe transition rule.
 *
 * @example
 * ```typescript
 * const rule = transition(
 *   IdleState,
 *   ChaseState,
 *   [when.hasComponent(AITarget)],
 *   { priority: 10 }
 * );
 * ```
 */
export function transition<TFrom extends ComponentIdentifier, TTo extends ComponentIdentifier>(
    from: TFrom | readonly TFrom[] | '*',
    to: TTo,
    conditions: Condition | readonly Condition[],
    options?: {
        priority?: number;
        args?: ConstructorParameters<TTo>;
    }
): TransitionRule<TFrom, TTo> {
    return {
        from,
        to,
        conditions: Array.isArray(conditions) ? conditions : [conditions],
        priority: options?.priority,
        args: options?.args,
    };
}

// ============================================================================
// Condition Evaluation
// ============================================================================

/**
 * Compare two values using a comparison operator.
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
