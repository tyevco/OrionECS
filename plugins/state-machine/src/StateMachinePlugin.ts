/**
 * State Machine Plugin for OrionECS
 *
 * ECS-native finite state machine with type-safe transitions and predicates.
 *
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- ECS entities and components are intentionally dynamic */

import type {
    ComponentIdentifier,
    EnginePlugin,
    PluginContext,
} from '../../../packages/core/src/index';

import { StateMachine } from './components';
import { compare, createConditionFactories } from './conditions';
import type {
    BasePredicateRegistry,
    Condition,
    PredicateContext,
    PredicateFn,
    StateDefinition,
    StateEnterEvent,
    StateExitEvent,
    TransitionRule,
} from './types';

// ============================================================================
// State Machine API
// ============================================================================

/**
 * API exposed on the engine for state machine operations.
 */
export interface StateMachineAPI<
    TPredicates extends BasePredicateRegistry = BasePredicateRegistry,
> {
    /** Type-safe condition factory functions */
    readonly when: ReturnType<typeof createConditionFactories<TPredicates>>;

    /** Register a state machine definition */
    define(name: string, definition: Omit<StateDefinition, 'name'>): void;

    /** Get a registered definition */
    getDefinition(name: string): StateDefinition | undefined;

    /** Manually trigger a transition */
    transitionTo(entity: any, stateType: ComponentIdentifier, ...args: any[]): boolean;

    /** Queue a transition for next frame */
    queueTransition(entity: any, stateType: ComponentIdentifier, ...args: any[]): void;

    /** Get the current state type of an entity */
    getCurrentState(entity: any): ComponentIdentifier | null;

    /** Get time spent in current state */
    getStateTime(entity: any): number;

    /** Lock transitions for an entity */
    lock(entity: any): void;

    /** Unlock transitions for an entity */
    unlock(entity: any): void;

    /** Check if transitions are locked */
    isLocked(entity: any): boolean;

    /** Send a message that can trigger transitions */
    sendMessage(entity: any, messageType: string): void;

    /** Get all entities currently in a specific state */
    getEntitiesInState(stateType: ComponentIdentifier): any[];

    /** Register a custom predicate (for runtime registration) */
    registerPredicate<K extends string>(name: K, fn: PredicateFn<any>): void;
}

// ============================================================================
// Plugin Implementation
// ============================================================================

/**
 * ECS-native State Machine Plugin.
 *
 * States are represented as components on entities. The plugin manages
 * transitions between states based on declarative rules.
 *
 * @example
 * ```typescript
 * // Create plugin with custom predicates
 * const fsmPlugin = new StateMachinePlugin()
 *   .predicate('target.inRange', (entity, args: { range: number }) => {
 *     const target = entity.getComponent(AITarget);
 *     return target ? target.distance < args.range : false;
 *   })
 *   .predicate('health.low', (entity, args: { threshold: number }) => {
 *     const health = entity.getComponent(Health);
 *     return health ? health.current < args.threshold : false;
 *   });
 *
 * // Use with engine builder
 * const engine = new EngineBuilder()
 *   .use(fsmPlugin)
 *   .build();
 *
 * // Define state machine
 * engine.stateMachine.define('EnemyAI', {
 *   states: [IdleState, ChaseState, AttackState],
 *   transitions: [
 *     transition(IdleState, ChaseState, when.hasComponent(AITarget)),
 *     transition(ChaseState, AttackState, when.predicate('target.inRange', { range: 2 })),
 *   ],
 *   initialState: IdleState,
 * });
 * ```
 *
 * @typeParam TPredicates - Accumulated predicate registry type
 */
export class StateMachinePlugin<TPredicates extends BasePredicateRegistry = BasePredicateRegistry>
    implements EnginePlugin<{ stateMachine: StateMachineAPI<TPredicates> }>
{
    readonly name = 'StateMachinePlugin';
    readonly version = '0.1.0';

    /** Type brand for compile-time type inference */
    declare readonly __extensions: { stateMachine: StateMachineAPI<TPredicates> };

    /** Registered predicate functions */
    private predicateFns = new Map<string, PredicateFn>();

    /** State machine definitions */
    private definitions = new Map<string, StateDefinition>();

    /** Plugin context (set during install) */
    private context?: PluginContext;

    /** Delta time for current frame */
    private deltaTime: number = 0;

    /** Queued transitions to process */
    private queuedTransitions = new Map<symbol, { stateType: ComponentIdentifier; args: any[] }>();

    /** Entities subscribed to messages */
    private messageSubscriptions?: () => void;

    // ==========================================================================
    // Predicate Registration (Type Accumulation)
    // ==========================================================================

    /**
     * Register a custom predicate with type accumulation.
     *
     * Each call expands the available predicates in the type system, enabling
     * type-safe usage in `when.predicate()`.
     *
     * @example
     * ```typescript
     * const plugin = new StateMachinePlugin()
     *   .predicate('target.visible', (entity, args: { fov: number }) => {
     *     // Custom visibility check
     *     return true;
     *   })
     *   .predicate('ammo.available', (entity, args: {}) => {
     *     return entity.getComponent(Ammo)?.count > 0;
     *   });
     *
     * // Later: when.predicate('target.visible', { fov: 90 }) is type-safe
     * ```
     */
    predicate<K extends string, TArgs extends object>(
        name: K,
        fn: (entity: any, args: TArgs, context: PredicateContext) => boolean
    ): StateMachinePlugin<TPredicates & Record<K, TArgs>> {
        this.predicateFns.set(name, fn as PredicateFn);
        return this as unknown as StateMachinePlugin<TPredicates & Record<K, TArgs>>;
    }

    // ==========================================================================
    // Plugin Lifecycle
    // ==========================================================================

    install(context: PluginContext): void {
        this.context = context;

        // Register the StateMachine component
        context.registerComponent(StateMachine);

        // Register built-in predicates
        this.registerBuiltInPredicates();

        // Create the state transition system
        this.createTransitionSystem(context);

        // Subscribe to message bus for message-based transitions
        this.subscribeToMessages(context);

        // Extend engine with state machine API
        context.extend('stateMachine', this.createAPI());
    }

    uninstall(): void {
        if (this.messageSubscriptions) {
            this.messageSubscriptions();
        }
        this.definitions.clear();
        this.predicateFns.clear();
        this.queuedTransitions.clear();
    }

    // ==========================================================================
    // Private: Built-in Predicates
    // ==========================================================================

    private registerBuiltInPredicates(): void {
        // State time predicate
        this.predicateFns.set('state.time', (entity, args: { op: string; seconds: number }) => {
            const sm = entity.getComponent(StateMachine);
            if (!sm) return false;
            return compare(sm.stateTime, args.op as any, args.seconds);
        });

        // Random chance predicate
        this.predicateFns.set('random.chance', (_entity, args: { probability: number }) => {
            return Math.random() < args.probability;
        });
    }

    // ==========================================================================
    // Private: Transition System
    // ==========================================================================

    private createTransitionSystem(context: PluginContext): void {
        context.createSystem(
            'StateMachineTransitionSystem',
            { all: [StateMachine] },
            {
                priority: 900, // Run early, before behavior systems

                before: () => {
                    // Get delta time from engine
                    const engine = context.getEngine();
                    this.deltaTime = engine.getDeltaTime?.() ?? 1 / 60;

                    // Process queued transitions
                    this.processQueuedTransitions();
                },

                act: (entity: any, sm: StateMachine) => {
                    // Update state time
                    sm.stateTime += this.deltaTime;

                    // Skip if locked
                    if (sm.locked) return;

                    // Get definition
                    const definition = this.definitions.get(sm.definitionName);
                    if (!definition) return;

                    // Evaluate transitions
                    this.evaluateTransitions(entity, sm, definition);

                    // Clear pending messages after evaluation
                    sm.clearPendingMessages();
                },
            },
            false // Variable update, not fixed
        );
    }

    private processQueuedTransitions(): void {
        for (const [entityId, { stateType, args }] of this.queuedTransitions) {
            const engine = this.context?.getEngine();
            const entity = engine?.getEntity?.(entityId);
            if (entity) {
                this.executeTransition(entity, stateType, args);
            }
        }
        this.queuedTransitions.clear();
    }

    private evaluateTransitions(entity: any, sm: StateMachine, definition: StateDefinition): void {
        // Sort transitions by priority (higher first)
        const sortedTransitions = definition.transitions.toSorted(
            (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
        );

        for (const rule of sortedTransitions) {
            // Check if transition applies to current state
            if (!this.matchesFrom(rule, sm.currentStateType)) continue;

            // Skip transitions to the same state
            if (rule.to === sm.currentStateType) continue;

            // Evaluate conditions
            if (this.evaluateConditions(rule.conditions, entity, sm)) {
                this.executeTransition(entity, rule.to, rule.args ?? []);
                break; // Only one transition per frame
            }
        }
    }

    private matchesFrom(rule: TransitionRule, currentState: ComponentIdentifier): boolean {
        if (rule.from === '*') return true;
        if (Array.isArray(rule.from)) {
            return rule.from.includes(currentState);
        }
        return rule.from === currentState;
    }

    private evaluateConditions(
        conditions: readonly Condition[],
        entity: any,
        sm: StateMachine
    ): boolean {
        return conditions.every((condition) => this.evaluateCondition(condition, entity, sm));
    }

    private evaluateCondition(condition: Condition, entity: any, sm: StateMachine): boolean {
        switch (condition.type) {
            case 'hasComponent':
                return entity.hasComponent(condition.component);

            case 'missingComponent':
                return !entity.hasComponent(condition.component);

            case 'componentValue': {
                if (!entity.hasComponent(condition.component)) return false;
                const component = entity.getComponent(condition.component);
                const value = component[condition.property];
                return compare(value, condition.op, condition.value);
            }

            case 'stateTime':
                return compare(sm.stateTime, condition.op, condition.seconds);

            case 'message':
                return sm.hasMessage(condition.messageType);

            case 'predicate': {
                const fn = this.predicateFns.get(condition.name);
                if (!fn) {
                    console.warn(`[StateMachinePlugin] Unknown predicate: ${condition.name}`);
                    return false;
                }
                const predicateContext: PredicateContext = {
                    getEngine: () => this.context?.getEngine(),
                    getDeltaTime: () => this.deltaTime,
                };
                return fn(entity, condition.args, predicateContext);
            }

            case 'and':
                return condition.conditions.every((c) => this.evaluateCondition(c, entity, sm));

            case 'or':
                return condition.conditions.some((c) => this.evaluateCondition(c, entity, sm));

            case 'not':
                return !this.evaluateCondition(condition.condition, entity, sm);

            default:
                return false;
        }
    }

    private executeTransition(entity: any, toState: ComponentIdentifier, args: any[]): void {
        const sm = entity.getComponent(StateMachine);
        if (!sm) return;

        const fromState = sm.currentStateType;
        const stateTime = sm.stateTime;

        // Emit exit event
        const exitEvent: StateExitEvent = {
            entity,
            stateType: fromState,
            stateTime,
        };
        this.context?.emit('stateExit', exitEvent);
        this.context?.emit(`stateExit:${fromState.name}`, exitEvent);

        // Remove old state component
        if (entity.hasComponent(fromState)) {
            entity.removeComponent(fromState);
        }

        // Add new state component
        entity.addComponent(toState, ...args);

        // Update metadata
        sm.recordTransition(fromState, toState, stateTime);
        sm.currentStateType = toState;
        sm.stateTime = 0;
        sm.transitionCount++;

        // Emit enter event
        const enterEvent: StateEnterEvent = {
            entity,
            stateType: toState,
            previousStateType: fromState,
            previousStateTime: stateTime,
        };
        this.context?.emit('stateEnter', enterEvent);
        this.context?.emit(`stateEnter:${toState.name}`, enterEvent);
    }

    // ==========================================================================
    // Private: Message Subscription
    // ==========================================================================

    private subscribeToMessages(context: PluginContext): void {
        // Subscribe to all state machine messages
        this.messageSubscriptions = context.messageBus.subscribe(
            'stateMachine:message',
            (message: { type: string; data: any; sender?: string; timestamp: number }) => {
                const { entityId, messageType } = message.data;
                const engine = context.getEngine();
                const entity = engine?.getEntity?.(entityId);
                if (entity) {
                    const sm = entity.getComponent(StateMachine);
                    if (sm) {
                        sm.addMessage(messageType);
                    }
                }
            }
        );
    }

    // ==========================================================================
    // Private: API Creation
    // ==========================================================================

    private createAPI(): StateMachineAPI<TPredicates> {
        return {
            when: createConditionFactories<TPredicates>(),

            define: (name: string, definition: Omit<StateDefinition, 'name'>): void => {
                this.definitions.set(name, { ...definition, name });
            },

            getDefinition: (name: string): StateDefinition | undefined => {
                return this.definitions.get(name);
            },

            transitionTo: (
                entity: any,
                stateType: ComponentIdentifier,
                ...args: any[]
            ): boolean => {
                const sm = entity.getComponent(StateMachine);
                if (!sm || sm.locked) return false;
                this.executeTransition(entity, stateType, args);
                return true;
            },

            queueTransition: (
                entity: any,
                stateType: ComponentIdentifier,
                ...args: any[]
            ): void => {
                this.queuedTransitions.set(entity.id, { stateType, args });
            },

            getCurrentState: (entity: any): ComponentIdentifier | null => {
                if (!entity.hasComponent(StateMachine)) return null;
                const sm = entity.getComponent(StateMachine);
                return sm?.currentStateType ?? null;
            },

            getStateTime: (entity: any): number => {
                if (!entity.hasComponent(StateMachine)) return 0;
                const sm = entity.getComponent(StateMachine);
                return sm?.stateTime ?? 0;
            },

            lock: (entity: any): void => {
                if (!entity.hasComponent(StateMachine)) return;
                const sm = entity.getComponent(StateMachine);
                if (sm) sm.locked = true;
            },

            unlock: (entity: any): void => {
                if (!entity.hasComponent(StateMachine)) return;
                const sm = entity.getComponent(StateMachine);
                if (sm) sm.locked = false;
            },

            isLocked: (entity: any): boolean => {
                if (!entity.hasComponent(StateMachine)) return false;
                const sm = entity.getComponent(StateMachine);
                return sm?.locked ?? false;
            },

            sendMessage: (entity: any, messageType: string): void => {
                if (!entity.hasComponent(StateMachine)) return;
                const sm = entity.getComponent(StateMachine);
                if (sm) {
                    sm.addMessage(messageType);
                }
            },

            getEntitiesInState: (stateType: ComponentIdentifier): any[] => {
                const engine = this.context?.getEngine();
                if (!engine) return [];

                const query = engine.createQuery({ all: [stateType, StateMachine] });
                const entities: any[] = [];
                query.forEach((entity: any) => {
                    entities.push(entity);
                });
                return entities;
            },

            registerPredicate: <K extends string>(name: K, fn: PredicateFn<any>): void => {
                this.predicateFns.set(name, fn);
            },
        };
    }
}
