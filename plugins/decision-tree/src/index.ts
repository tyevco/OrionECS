/**
 * @orion-ecs/decision-tree
 *
 * ECS-Native Decision Tree Plugin for OrionECS
 *
 * A decision tree evaluates predicates and mutates entity components.
 * It does NOT execute behaviors - that's what ECS systems are for.
 *
 * Key Concepts:
 * - Decision trees decide WHAT components an entity should have
 * - ECS systems implement HOW those components affect behavior
 * - Intent = Component presence (Chasing, Attacking, Fleeing)
 *
 * @example
 * ```typescript
 * import { EngineBuilder } from '@orion-ecs/core';
 * import { DecisionTreePlugin, decide } from '@orion-ecs/decision-tree';
 *
 * // Intent components (user-defined)
 * class Chasing { constructor(public targetId: symbol) {} }
 * class Attacking { constructor(public targetId: symbol) {} }
 * class Patrolling {}
 *
 * // Setup
 * const engine = new EngineBuilder()
 *   .use(new DecisionTreePlugin())
 *   .build();
 *
 * // Register predicates using the type-safe registry
 * const predicates = engine.decisions.predicates
 *   .register('hasTarget', (entity) => entity.hasComponent(AITarget))
 *   .register('target.inRange', (entity, args: { range: number }) => {
 *     const pos = entity.getComponent(Position);
 *     const target = entity.getComponent(AITarget);
 *     return distance(pos, target.position) < args.range;
 *   });
 *
 * // Define decision tree using fluent builder
 * const guardAI = decide('GuardAI')
 *   .selector()
 *     .sequence('Attack')
 *       .predicate('hasTarget')
 *       .predicate('target.inRange', { range: 50 })
 *       .remove(Chasing)
 *       .add(Attacking)
 *     .end()
 *     .sequence('Chase')
 *       .predicate('hasTarget')
 *       .add(Chasing)
 *     .end()
 *     .sequence('Patrol')
 *       .add(Patrolling)
 *     .end()
 *   .end()
 *   .build();
 *
 * engine.decisions.register(guardAI);
 *
 * // Behavior systems (separate from decision tree!)
 * engine.createSystem('ChaseSystem', { all: [Chasing, Position] }, {
 *   act: (entity, chasing, pos) => {
 *     // Chase behavior here
 *   }
 * });
 *
 * engine.createSystem('AttackSystem', { all: [Attacking] }, {
 *   act: (entity, attacking) => {
 *     // Attack behavior here
 *   }
 * });
 *
 * // Assign to entity
 * const guard = engine.createEntity('Guard');
 * engine.decisions.assign(guard, 'GuardAI');
 * ```
 *
 * @packageDocumentation
 */

// Plugin
export { DecisionTreePlugin } from './DecisionTreePlugin';
export type { DecisionTreeAPI } from './DecisionTreePlugin';

// Builder
export { DecisionTreeBuilder, decide, parseTreeJSON } from './builder';

// Components
export { DecisionTree } from './components';

// Types
export type {
  // Tree definition
  TreeDefinition,
  DecisionNode,
  SelectorNode,
  SequenceNode,
  PredicateNode,
  AddComponentNode,
  RemoveComponentNode,

  // Predicates
  PredicateFn,
  PredicateContext,
  BuiltInPredicates,

  // Options
  DecisionTreePluginOptions,

  // JSON
  TreeDefinitionJSON,
  DecisionNodeJSON,

  // Utilities
  ConstructorArgs,
} from './types';

// Type-Safe Registry (Accumulated Types like EngineBuilder.use())
export { PredicateRegistry } from './types';

// Re-export typed builder from types for advanced usage
export { DecisionTreeBuilder as TypedDecisionTreeBuilder } from './types';
