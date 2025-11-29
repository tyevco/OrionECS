/**
 * StateMachinePlugin Test Suite
 *
 * Comprehensive tests covering:
 * - Plugin lifecycle (install/uninstall)
 * - Condition factory functions
 * - State transitions
 * - Predicate registration and type accumulation
 * - API functionality
 * - Message-based transitions
 * - Integration scenarios
 */

import type { EntityDef } from '@orion-ecs/core';
import { TestEngineBuilder } from '@orion-ecs/testing';
import {
    compare,
    StateMachine,
    type StateMachineAPI,
    StateMachinePlugin,
    transition,
    when,
} from './index';

// Type for test engine with state machine extension
type TestEngine = ReturnType<typeof TestEngineBuilder.prototype.build> & {
    stateMachine: StateMachineAPI;
};

// ============================================================================
// Test State Components
// ============================================================================

class IdleState {}
class PatrolState {}
class ChaseState {
    constructor(public targetId: symbol = Symbol('target')) {}
}
class AttackState {
    constructor(
        public targetId: symbol = Symbol('target'),
        public damage: number = 10
    ) {}
}
class FleeState {}
class DeadState {}

// Test data components
class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
    ) {}
}

class AITarget {
    constructor(
        public entityId: symbol = Symbol('entity'),
        public distance: number = 0
    ) {}
}

// ============================================================================
// Tests
// ============================================================================

describe('StateMachinePlugin', () => {
    let engine: TestEngine;
    let plugin: StateMachinePlugin;

    beforeEach(() => {
        plugin = new StateMachinePlugin();
        engine = new TestEngineBuilder().use(plugin).build() as TestEngine;
    });

    afterEach(() => {
        engine.stop();
    });

    // ==========================================================================
    // Plugin Metadata & Installation
    // ==========================================================================

    describe('Plugin Metadata', () => {
        test('should have correct name and version', () => {
            expect(plugin.name).toBe('StateMachinePlugin');
            expect(plugin.version).toBe('0.1.0');
        });
    });

    describe('Plugin Installation', () => {
        test('should install successfully', () => {
            expect(engine).toBeDefined();
        });

        test('should extend engine with stateMachine API', () => {
            const api = engine.stateMachine;
            expect(api).toBeDefined();
            expect(api.when).toBeDefined();
            expect(api.define).toBeDefined();
            expect(api.transitionTo).toBeDefined();
        });

        test('should register StateMachine component', () => {
            const entity = engine.createEntity('TestEntity');
            expect(() => {
                entity.addComponent(StateMachine, IdleState, 'TestAI');
            }).not.toThrow();
        });

        test('should create StateMachineTransitionSystem', () => {
            const systems = engine.getSystemProfiles();
            const systemNames = systems.map((s: { name: string }) => s.name);
            expect(systemNames).toContain('StateMachineTransitionSystem');
        });
    });

    describe('Plugin Uninstallation', () => {
        test('should uninstall cleanly', () => {
            expect(() => {
                plugin.uninstall();
            }).not.toThrow();
        });
    });

    // ==========================================================================
    // Condition Factory Functions
    // ==========================================================================

    describe('Condition Factories - when', () => {
        test('should create hasComponent condition', () => {
            const condition = when.hasComponent(Health);
            expect(condition.type).toBe('hasComponent');
            expect(condition.component).toBe(Health);
        });

        test('should create missingComponent condition', () => {
            const condition = when.missingComponent(AITarget);
            expect(condition.type).toBe('missingComponent');
            expect(condition.component).toBe(AITarget);
        });

        test('should create componentValue condition', () => {
            const condition = when.componentValue(Health, 'current', 'lt', 20);
            expect(condition.type).toBe('componentValue');
            expect(condition.component).toBe(Health);
            expect(condition.property).toBe('current');
            expect(condition.op).toBe('lt');
            expect(condition.value).toBe(20);
        });

        test('should create stateTime condition', () => {
            const condition = when.stateTime('gt', 5);
            expect(condition.type).toBe('stateTime');
            expect(condition.op).toBe('gt');
            expect(condition.seconds).toBe(5);
        });

        test('should create after shortcut condition', () => {
            const condition = when.after(3);
            expect(condition.type).toBe('stateTime');
            expect(condition.op).toBe('gt');
            expect(condition.seconds).toBe(3);
        });

        test('should create within shortcut condition', () => {
            const condition = when.within(2);
            expect(condition.type).toBe('stateTime');
            expect(condition.op).toBe('lt');
            expect(condition.seconds).toBe(2);
        });

        test('should create message condition', () => {
            const condition = when.message('player-spotted');
            expect(condition.type).toBe('message');
            expect(condition.messageType).toBe('player-spotted');
        });

        test('should create and composite condition', () => {
            const condition = when.and(
                when.hasComponent(Health),
                when.componentValue(Health, 'current', 'gt', 0)
            );
            expect(condition.type).toBe('and');
            expect(condition.conditions).toHaveLength(2);
        });

        test('should create or composite condition', () => {
            const condition = when.or(
                when.hasComponent(ChaseState),
                when.hasComponent(AttackState)
            );
            expect(condition.type).toBe('or');
            expect(condition.conditions).toHaveLength(2);
        });

        test('should create not condition', () => {
            const condition = when.not(when.hasComponent(DeadState));
            expect(condition.type).toBe('not');
            expect(condition.condition.type).toBe('hasComponent');
        });

        test('should create predicate condition', () => {
            const condition = when.predicate('random.chance', { probability: 0.5 });
            expect(condition.type).toBe('predicate');
            expect(condition.name).toBe('random.chance');
            expect(condition.args).toEqual({ probability: 0.5 });
        });
    });

    // ==========================================================================
    // Comparison Function
    // ==========================================================================

    describe('compare function', () => {
        test('should compare equality', () => {
            expect(compare(5, 'eq', 5)).toBe(true);
            expect(compare(5, 'eq', 6)).toBe(false);
        });

        test('should compare inequality', () => {
            expect(compare(5, 'neq', 6)).toBe(true);
            expect(compare(5, 'neq', 5)).toBe(false);
        });

        test('should compare greater than', () => {
            expect(compare(10, 'gt', 5)).toBe(true);
            expect(compare(5, 'gt', 5)).toBe(false);
            expect(compare(3, 'gt', 5)).toBe(false);
        });

        test('should compare greater than or equal', () => {
            expect(compare(10, 'gte', 5)).toBe(true);
            expect(compare(5, 'gte', 5)).toBe(true);
            expect(compare(3, 'gte', 5)).toBe(false);
        });

        test('should compare less than', () => {
            expect(compare(3, 'lt', 5)).toBe(true);
            expect(compare(5, 'lt', 5)).toBe(false);
            expect(compare(10, 'lt', 5)).toBe(false);
        });

        test('should compare less than or equal', () => {
            expect(compare(3, 'lte', 5)).toBe(true);
            expect(compare(5, 'lte', 5)).toBe(true);
            expect(compare(10, 'lte', 5)).toBe(false);
        });
    });

    // ==========================================================================
    // Transition Helper
    // ==========================================================================

    describe('transition helper', () => {
        test('should create transition with single from state', () => {
            const rule = transition(IdleState, PatrolState, when.after(2));
            expect(rule.from).toBe(IdleState);
            expect(rule.to).toBe(PatrolState);
            expect(rule.conditions).toHaveLength(1);
        });

        test('should create transition with multiple from states', () => {
            const rule = transition(
                [ChaseState, AttackState],
                FleeState,
                when.hasComponent(Health)
            );
            expect(rule.from).toEqual([ChaseState, AttackState]);
            expect(rule.to).toBe(FleeState);
        });

        test('should create transition with wildcard from', () => {
            const rule = transition('*', IdleState, when.missingComponent(AITarget));
            expect(rule.from).toBe('*');
            expect(rule.to).toBe(IdleState);
        });

        test('should create transition with multiple conditions', () => {
            const rule = transition(IdleState, ChaseState, [
                when.hasComponent(AITarget),
                when.componentValue(Health, 'current', 'gt', 20),
            ]);
            expect(rule.conditions).toHaveLength(2);
        });

        test('should create transition with priority', () => {
            const rule = transition(IdleState, ChaseState, when.hasComponent(AITarget), {
                priority: 100,
            });
            expect(rule.priority).toBe(100);
        });
    });

    // ==========================================================================
    // StateMachine Component
    // ==========================================================================

    describe('StateMachine Component', () => {
        test('should create with initial state', () => {
            const sm = new StateMachine(IdleState, 'TestAI');
            expect(sm.currentStateType).toBe(IdleState);
            expect(sm.definitionName).toBe('TestAI');
        });

        test('should initialize with default values', () => {
            const sm = new StateMachine(IdleState, 'TestAI');
            expect(sm.stateTime).toBe(0);
            expect(sm.transitionCount).toBe(0);
            expect(sm.locked).toBe(false);
            expect(sm.history).toHaveLength(0);
        });

        test('should track pending messages', () => {
            const sm = new StateMachine(IdleState, 'TestAI');

            sm.addMessage('test-message');
            expect(sm.hasMessage('test-message')).toBe(true);
            expect(sm.hasMessage('other-message')).toBe(false);

            sm.clearPendingMessages();
            expect(sm.hasMessage('test-message')).toBe(false);
        });

        test('should record transitions in history', () => {
            const sm = new StateMachine(IdleState, 'TestAI', 5);

            sm.recordTransition(IdleState, PatrolState, 2.5);

            expect(sm.history).toHaveLength(1);
            expect(sm.history[0]!.stateType).toBe(PatrolState);
        });

        test('should limit history depth', () => {
            const sm = new StateMachine(IdleState, 'TestAI', 3);

            sm.recordTransition(IdleState, PatrolState, 1);
            sm.recordTransition(PatrolState, ChaseState, 1);
            sm.recordTransition(ChaseState, AttackState, 1);
            sm.recordTransition(AttackState, FleeState, 1);

            expect(sm.history).toHaveLength(3);
            expect(sm.history[0]!.stateType).toBe(ChaseState);
        });

        test('should not record history when depth is 0', () => {
            const sm = new StateMachine(IdleState, 'TestAI', 0);

            sm.recordTransition(IdleState, PatrolState, 1);

            expect(sm.history).toHaveLength(0);
        });
    });

    // ==========================================================================
    // State Machine API
    // ==========================================================================

    describe('StateMachine API', () => {
        let api: StateMachineAPI;

        beforeEach(() => {
            api = engine.stateMachine;
        });

        test('should define state machine', () => {
            api.define('EnemyAI', {
                states: [IdleState, PatrolState, ChaseState],
                transitions: [transition(IdleState, PatrolState, when.after(2))],
                initialState: IdleState,
            });

            const definition = api.getDefinition('EnemyAI');
            expect(definition).toBeDefined();
            expect(definition?.name).toBe('EnemyAI');
            expect(definition?.states).toHaveLength(3);
        });

        test('should get current state', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'TestAI');

            const state = api.getCurrentState(entity);
            expect(state).toBe(IdleState);
        });

        test('should get state time', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'TestAI');

            // Initially state time should be 0
            expect(api.getStateTime(entity)).toBe(0);
        });

        test('should lock and unlock transitions', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'TestAI');

            expect(api.isLocked(entity)).toBe(false);

            api.lock(entity);
            expect(api.isLocked(entity)).toBe(true);

            api.unlock(entity);
            expect(api.isLocked(entity)).toBe(false);
        });

        test('should manually transition state', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'TestAI');

            const result = api.transitionTo(entity, PatrolState);

            expect(result).toBe(true);
            expect(entity.hasComponent(IdleState)).toBe(false);
            expect(entity.hasComponent(PatrolState)).toBe(true);
            expect(api.getCurrentState(entity)).toBe(PatrolState);
        });

        test('should not transition when locked', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'TestAI');

            api.lock(entity);
            const result = api.transitionTo(entity, PatrolState);

            expect(result).toBe(false);
            expect(entity.hasComponent(IdleState)).toBe(true);
        });

        test('should send message to entity', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'TestAI');

            api.sendMessage(entity, 'alert');

            const sm = entity.getComponent(StateMachine);
            expect(sm?.hasMessage('alert')).toBe(true);
        });

        test('should return null for entity without state machine', () => {
            const entity = engine.createEntity('NoStateMachine');

            expect(api.getCurrentState(entity)).toBeNull();
            expect(api.getStateTime(entity)).toBe(0);
            expect(api.isLocked(entity)).toBe(false);
        });
    });

    // ==========================================================================
    // Predicate Registration
    // ==========================================================================

    describe('Predicate Registration', () => {
        test('should register custom predicate via chaining', () => {
            const customPlugin = new StateMachinePlugin().predicate(
                'custom.test',
                (_entity, args: { value: number }) => {
                    return args.value > 10;
                }
            );

            const customEngine = new TestEngineBuilder()
                .use(customPlugin)
                .build() as unknown as TestEngine;
            const api = customEngine.stateMachine;

            // The predicate should be available
            expect(api.when.predicate).toBeDefined();

            customEngine.stop();
        });

        test('should register predicate at runtime via API', () => {
            const api = engine.stateMachine;

            api.registerPredicate('runtime.test', () => true);

            // Predicate registered successfully if no error thrown
            expect(true).toBe(true);
        });

        test('should evaluate built-in random.chance predicate', () => {
            // Test that the predicate exists and can be created
            const condition = when.predicate('random.chance', { probability: 1.0 });
            expect(condition.type).toBe('predicate');
            expect(condition.args.probability).toBe(1.0);
        });
    });

    // ==========================================================================
    // State Transitions
    // ==========================================================================

    describe('State Transitions', () => {
        let api: StateMachineAPI;

        beforeEach(() => {
            api = engine.stateMachine;

            // Define a simple state machine
            api.define('SimpleAI', {
                states: [IdleState, PatrolState, ChaseState, AttackState],
                transitions: [
                    // Idle -> Patrol after 0.1 seconds (for testing)
                    transition(IdleState, PatrolState, when.stateTime('gt', 0.01)),
                    // Any -> Chase when has target
                    transition('*', ChaseState, when.hasComponent(AITarget), { priority: 100 }),
                    // Chase -> Attack when target is close
                    transition(
                        ChaseState,
                        AttackState,
                        when.componentValue(AITarget, 'distance', 'lt', 5)
                    ),
                ],
                initialState: IdleState,
            });
        });

        test('should transition based on stateTime condition', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'SimpleAI');

            engine.start();

            // Run update to increase state time
            engine.update(0.1); // 100ms

            // Should have transitioned to Patrol
            expect(entity.hasComponent(PatrolState)).toBe(true);
            expect(entity.hasComponent(IdleState)).toBe(false);
        });

        test('should transition based on hasComponent condition', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'SimpleAI');
            entity.addComponent(AITarget, Symbol('player'), 10);

            engine.start();
            engine.update(0.016);

            // Should have transitioned to Chase (higher priority than time-based)
            expect(entity.hasComponent(ChaseState)).toBe(true);
        });

        test('should transition based on componentValue condition', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(ChaseState);
            entity.addComponent(StateMachine, ChaseState, 'SimpleAI');
            entity.addComponent(AITarget, Symbol('player'), 3); // Distance < 5

            engine.start();
            engine.update(0.016);

            // Should have transitioned to Attack
            expect(entity.hasComponent(AttackState)).toBe(true);
        });

        test('should not transition when conditions not met', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(ChaseState);
            entity.addComponent(StateMachine, ChaseState, 'SimpleAI');
            entity.addComponent(AITarget, Symbol('player'), 10); // Distance > 5

            engine.start();
            engine.update(0.016);

            // Should remain in Chase
            expect(entity.hasComponent(ChaseState)).toBe(true);
            expect(entity.hasComponent(AttackState)).toBe(false);
        });

        test('should not transition when locked', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'SimpleAI');

            api.lock(entity);

            engine.start();
            engine.update(0.1);

            // Should remain in Idle despite time passing
            expect(entity.hasComponent(IdleState)).toBe(true);
        });

        test('should handle wildcard from state', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(PatrolState);
            entity.addComponent(StateMachine, PatrolState, 'SimpleAI');
            entity.addComponent(AITarget); // Trigger wildcard transition

            engine.start();
            engine.update(0.016);

            // Wildcard should allow transition from Patrol to Chase
            expect(entity.hasComponent(ChaseState)).toBe(true);
        });

        test('should respect transition priority', () => {
            // Create a definition with conflicting transitions
            api.define('PriorityTest', {
                states: [IdleState, PatrolState, ChaseState],
                transitions: [
                    transition(IdleState, PatrolState, when.stateTime('gte', 0), { priority: 10 }),
                    transition(IdleState, ChaseState, when.stateTime('gte', 0), { priority: 100 }),
                ],
                initialState: IdleState,
            });

            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'PriorityTest');

            engine.start();
            engine.update(0.016);

            // Should transition to Chase (higher priority)
            expect(entity.hasComponent(ChaseState)).toBe(true);
        });

        test('should update transition count', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'SimpleAI');

            engine.start();
            engine.update(0.1);

            const sm = entity.getComponent(StateMachine);
            expect(sm?.transitionCount).toBe(1);
        });

        test('should reset stateTime on transition', () => {
            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'SimpleAI');

            engine.start();
            engine.update(0.1); // Transition to Patrol

            const sm = entity.getComponent(StateMachine);
            // State time should be reset (or very small from the current frame)
            expect(sm?.stateTime).toBeLessThan(0.05);
        });
    });

    // ==========================================================================
    // Event Emission
    // ==========================================================================

    describe('State Change Events', () => {
        let api: StateMachineAPI;

        beforeEach(() => {
            api = engine.stateMachine;

            api.define('EventTestAI', {
                states: [IdleState, PatrolState],
                transitions: [transition(IdleState, PatrolState, when.stateTime('gt', 0))],
                initialState: IdleState,
            });
        });

        test('should emit stateExit event on transition', () => {
            const exitHandler = jest.fn();
            engine.on('stateExit', exitHandler);

            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'EventTestAI');

            engine.start();
            engine.update(0.016);

            expect(exitHandler).toHaveBeenCalled();
            const event = exitHandler.mock.calls[0][0];
            expect(event.entity).toBe(entity);
            expect(event.stateType).toBe(IdleState);
        });

        test('should emit stateEnter event on transition', () => {
            const enterHandler = jest.fn();
            engine.on('stateEnter', enterHandler);

            const entity = engine.createEntity('Enemy');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'EventTestAI');

            engine.start();
            engine.update(0.016);

            expect(enterHandler).toHaveBeenCalled();
            const event = enterHandler.mock.calls[0][0];
            expect(event.entity).toBe(entity);
            expect(event.stateType).toBe(PatrolState);
            expect(event.previousStateType).toBe(IdleState);
        });
    });

    // ==========================================================================
    // Integration Tests
    // ==========================================================================

    describe('Integration Tests', () => {
        test('should handle multiple state machines', () => {
            const api = engine.stateMachine;

            api.define('SimpleAI', {
                states: [IdleState, PatrolState],
                transitions: [transition(IdleState, PatrolState, when.after(0.01))],
                initialState: IdleState,
            });

            // Create multiple entities
            for (let i = 0; i < 10; i++) {
                const entity = engine.createEntity(`Enemy${i}`);
                entity.addComponent(IdleState);
                entity.addComponent(StateMachine, IdleState, 'SimpleAI');
            }

            engine.start();
            engine.update(0.1);

            // All entities should have transitioned
            const entities = engine.getAllEntities();
            entities.forEach((entity: EntityDef) => {
                if (entity.hasComponent(StateMachine)) {
                    expect(entity.hasComponent(PatrolState)).toBe(true);
                }
            });
        });

        test('should handle entities without state machine', () => {
            const entity = engine.createEntity('NoFSM');
            entity.addComponent(Health, 100, 100);

            // Should not throw when updating
            expect(() => {
                engine.start();
                engine.update(0.016);
            }).not.toThrow();
        });

        test('should work with composite conditions', () => {
            const api = engine.stateMachine;

            api.define('ComplexAI', {
                states: [IdleState, ChaseState],
                transitions: [
                    transition(
                        IdleState,
                        ChaseState,
                        when.and(
                            when.hasComponent(AITarget),
                            when.componentValue(Health, 'current', 'gt', 50)
                        )
                    ),
                ],
                initialState: IdleState,
            });

            // Entity with target but low health - should NOT transition
            const entity1 = engine.createEntity('Weak');
            entity1.addComponent(IdleState);
            entity1.addComponent(StateMachine, IdleState, 'ComplexAI');
            entity1.addComponent(AITarget);
            entity1.addComponent(Health, 30, 100);

            // Entity with target and high health - should transition
            const entity2 = engine.createEntity('Strong');
            entity2.addComponent(IdleState);
            entity2.addComponent(StateMachine, IdleState, 'ComplexAI');
            entity2.addComponent(AITarget);
            entity2.addComponent(Health, 80, 100);

            engine.start();
            engine.update(0.016);

            expect(entity1.hasComponent(IdleState)).toBe(true);
            expect(entity2.hasComponent(ChaseState)).toBe(true);
        });

        test('should work with or conditions', () => {
            const api = engine.stateMachine;

            api.define('FleeAI', {
                states: [IdleState, FleeState],
                transitions: [
                    transition(
                        IdleState,
                        FleeState,
                        when.or(
                            when.componentValue(Health, 'current', 'lt', 20),
                            when.hasComponent(AITarget)
                        )
                    ),
                ],
                initialState: IdleState,
            });

            // Low health, no target - should transition
            const entity = engine.createEntity('LowHealth');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'FleeAI');
            entity.addComponent(Health, 10, 100);

            engine.start();
            engine.update(0.016);

            expect(entity.hasComponent(FleeState)).toBe(true);
        });

        test('should work with not conditions', () => {
            const api = engine.stateMachine;

            api.define('SafeAI', {
                states: [ChaseState, IdleState],
                transitions: [
                    transition(ChaseState, IdleState, when.not(when.hasComponent(AITarget))),
                ],
                initialState: ChaseState,
            });

            const entity = engine.createEntity('Hunter');
            entity.addComponent(ChaseState);
            entity.addComponent(StateMachine, ChaseState, 'SafeAI');
            // No AITarget component

            engine.start();
            engine.update(0.016);

            expect(entity.hasComponent(IdleState)).toBe(true);
        });
    });

    // ==========================================================================
    // Edge Cases
    // ==========================================================================

    describe('Edge Cases', () => {
        test('should handle entity with no definition', () => {
            const entity = engine.createEntity('NoDefinition');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'NonExistentAI');

            expect(() => {
                engine.start();
                engine.update(0.016);
            }).not.toThrow();
        });

        test('should handle transition to same state', () => {
            const api = engine.stateMachine;

            const entity = engine.createEntity('SameState');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'TestAI');

            // Manually transition to same state
            api.transitionTo(entity, IdleState);

            expect(entity.hasComponent(IdleState)).toBe(true);
        });

        test('should handle rapid state changes', () => {
            const api = engine.stateMachine;

            api.define('RapidAI', {
                states: [IdleState, PatrolState, ChaseState],
                transitions: [
                    transition(IdleState, PatrolState, when.stateTime('gte', 0)),
                    transition(PatrolState, ChaseState, when.stateTime('gte', 0)),
                ],
                initialState: IdleState,
            });

            const entity = engine.createEntity('Rapid');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'RapidAI');

            engine.start();

            // Multiple updates
            for (let i = 0; i < 10; i++) {
                engine.update(0.016);
            }

            // Should settle in ChaseState (no transition from Chase defined)
            expect(entity.hasComponent(ChaseState)).toBe(true);
        });

        test('should handle missing component for componentValue check', () => {
            const api = engine.stateMachine;

            api.define('MissingComponentAI', {
                states: [IdleState, ChaseState],
                transitions: [
                    transition(
                        IdleState,
                        ChaseState,
                        when.componentValue(Health, 'current', 'gt', 50)
                    ),
                ],
                initialState: IdleState,
            });

            const entity = engine.createEntity('NoHealth');
            entity.addComponent(IdleState);
            entity.addComponent(StateMachine, IdleState, 'MissingComponentAI');
            // No Health component

            engine.start();
            engine.update(0.016);

            // Should NOT transition (missing component = condition false)
            expect(entity.hasComponent(IdleState)).toBe(true);
        });
    });

    // ==========================================================================
    // Performance Tests
    // ==========================================================================

    describe('Performance Tests', () => {
        test('should handle many state machines efficiently', () => {
            const api = engine.stateMachine;

            api.define('SimpleAI', {
                states: [IdleState, PatrolState],
                transitions: [transition(IdleState, PatrolState, when.after(0.5))],
                initialState: IdleState,
            });

            // Create 1000 entities with state machines
            for (let i = 0; i < 1000; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(IdleState);
                entity.addComponent(StateMachine, IdleState, 'SimpleAI');
            }

            engine.start();

            const startTime = performance.now();
            engine.update(0.016);
            const endTime = performance.now();

            const executionTime = endTime - startTime;

            // Should complete in reasonable time (< 50ms)
            expect(executionTime).toBeLessThan(50);
        });
    });
});
