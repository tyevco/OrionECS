/**
 * State Machine Plugin for OrionECS
 *
 * ECS-native finite state machine with type-safe transitions and predicates.
 *
 * @example
 * ```typescript
 * import { StateMachinePlugin, transition, when } from '@orion-ecs/state-machine';
 *
 * // Define state components (states = components)
 * class IdleState {}
 * class ChaseState { constructor(public targetId: symbol) {} }
 * class AttackState { constructor(public targetId: symbol) {} }
 *
 * // Create plugin with custom predicates
 * const fsmPlugin = new StateMachinePlugin()
 *   .predicate('target.inRange', (entity, args: { range: number }) => {
 *     const target = entity.getComponent(AITarget);
 *     return target ? target.distance < args.range : false;
 *   });
 *
 * // Build engine
 * const engine = new EngineBuilder()
 *   .use(fsmPlugin)
 *   .build();
 *
 * // Define state machine
 * const { when } = engine.stateMachine;
 *
 * engine.stateMachine.define('EnemyAI', {
 *   states: [IdleState, ChaseState, AttackState],
 *   transitions: [
 *     transition(IdleState, ChaseState, when.hasComponent(AITarget)),
 *     transition(ChaseState, AttackState, when.predicate('target.inRange', { range: 2 })),
 *     transition('*', IdleState, when.missingComponent(AITarget)),
 *   ],
 *   initialState: IdleState,
 * });
 *
 * // Create entity with state machine
 * const enemy = engine.createEntity('Enemy');
 * enemy.addComponent(IdleState);
 * enemy.addComponent(StateMachine, IdleState, 'EnemyAI');
 *
 * // Create behavior systems that query by state
 * engine.createSystem('IdleBehavior', { all: [IdleState, AI] }, {
 *   act: (entity, idle, ai) => {
 *     ai.lookAround();
 *   }
 * });
 *
 * engine.createSystem('ChaseBehavior', { all: [ChaseState, AI, Movement] }, {
 *   act: (entity, chase, ai, movement) => {
 *     movement.target = chase.targetId;
 *   }
 * });
 * ```
 *
 * @packageDocumentation
 */

// Components
export { StateMachine } from './components';
// Conditions
export {
    compare,
    createConditionFactories,
    transition,
    when,
} from './conditions';
// Core plugin
export { type StateMachineAPI, StateMachinePlugin } from './StateMachinePlugin';

// Types
export type {
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
    PredicateContext,
    PredicateFn,
    StateDefinition,
    StateEnterEvent,
    StateExitEvent,
    StateHistoryEntry,
    StateTimeCondition,
    TransitionRule,
} from './types';
