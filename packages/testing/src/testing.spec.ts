/**
 * Tests for OrionECS Testing Utilities
 */

import type { ComponentIdentifier, Entity, EntityPrefab } from '@orion-ecs/core';
import { Engine } from '@orion-ecs/core';
import {
    assertEngineClean,
    createMockComponent,
    createTestEntities,
    createTestEntity,
    createTestEntityFromPrefab,
    getEntitySummary,
    setupTestMatchers,
    TestClock,
    TestEngineBuilder,
    TestSnapshot,
    TestSystemRunner,
    waitFrames,
    waitUntil,
} from './testing';

// Extend Jest matchers for custom matchers
declare global {
    namespace jest {
        interface Matchers<R> {
            toHaveComponent(componentClass: ComponentIdentifier): R;
            toHaveTag(tag: string): R;
            toMatch(entities: Entity[]): R;
            toBeInArchetype(archetypeId: string): R;
        }
    }
}

// Mock components for testing
class Position {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

class Velocity {
    constructor(
        public vx: number = 0,
        public vy: number = 0
    ) {}
}

class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
    ) {}
}

// Mock plugin for testing plugin accumulation
class MockPlugin {
    name = 'MockPlugin';
    version = '1.0.0';
    installed = false;

    install(context: any): void {
        this.installed = true;
        context.extend('mockApi', {
            getValue: () => 42,
        });
    }
}

class AnotherMockPlugin {
    name = 'AnotherMockPlugin';
    version = '1.0.0';
    installed = false;

    install(context: any): void {
        this.installed = true;
        context.extend('anotherApi', {
            getMessage: () => 'hello',
        });
    }
}

describe('Testing Utilities', () => {
    describe('TestEngineBuilder', () => {
        it('should create an engine with test-friendly defaults', () => {
            const engine = new TestEngineBuilder().build();

            expect(engine).toBeInstanceOf(Engine);
            // Debug mode should be enabled
            expect((engine as any).debugMode).toBe(true);
        });

        it('should support method chaining', () => {
            const engine = new TestEngineBuilder()
                .withFixedUpdateFPS(120)
                .withDebugMode(false)
                .build();

            expect(engine).toBeInstanceOf(Engine);
        });

        it('should properly accumulate plugins', () => {
            const plugin1 = new MockPlugin();
            const plugin2 = new AnotherMockPlugin();

            const engine = new TestEngineBuilder().use(plugin1).use(plugin2).build();

            expect(engine).toBeInstanceOf(Engine);
            // Both plugins should be installed
            expect(plugin1.installed).toBe(true);
            expect(plugin2.installed).toBe(true);
            // Plugin APIs should be available on the engine
            expect((engine as any).mockApi.getValue()).toBe(42);
            expect((engine as any).anotherApi.getMessage()).toBe('hello');
        });

        it('should maintain TestEngineBuilder type after use() calls', () => {
            const plugin = new MockPlugin();

            // The key test: after calling use(), we should still be able to
            // call TestEngineBuilder-inherited methods like withDebugMode
            const engine = new TestEngineBuilder()
                .use(plugin)
                .withDebugMode(false) // This should work because use() returns TestEngineBuilder
                .build();

            expect(engine).toBeInstanceOf(Engine);
            expect(plugin.installed).toBe(true);
        });
    });

    describe('TestClock', () => {
        it('should initialize with default 60 FPS', () => {
            const clock = new TestClock();

            expect(clock.fps).toBe(60);
            expect(clock.deltaTime).toBeCloseTo(16.67, 1);
            expect(clock.currentTime).toBe(0);
        });

        it('should initialize with custom FPS', () => {
            const clock = new TestClock(30);

            expect(clock.fps).toBe(30);
            expect(clock.deltaTime).toBeCloseTo(33.33, 1);
        });

        it('should step forward by one frame', () => {
            const clock = new TestClock(60);

            clock.step();

            expect(clock.currentTime).toBeCloseTo(16.67, 1);
        });

        it('should step forward by multiple frames', () => {
            const clock = new TestClock(60);

            clock.step(5);

            expect(clock.currentTime).toBeCloseTo(83.35, 1);
        });

        it('should step by specific time delta', () => {
            const clock = new TestClock();

            clock.stepByTime(100);

            expect(clock.currentTime).toBe(100);
        });

        it('should set time to specific value', () => {
            const clock = new TestClock();

            clock.setTime(1000);

            expect(clock.currentTime).toBe(1000);
        });

        it('should reset to zero', () => {
            const clock = new TestClock();

            clock.step(10);
            expect(clock.currentTime).toBeGreaterThan(0);

            clock.reset();
            expect(clock.currentTime).toBe(0);
        });

        it('should pause and resume', () => {
            const clock = new TestClock();

            clock.pause();
            expect(clock.isPaused).toBe(true);

            clock.step(5);
            expect(clock.currentTime).toBe(0); // Should not advance when paused

            clock.resume();
            expect(clock.isPaused).toBe(false);

            clock.step(5);
            expect(clock.currentTime).toBeGreaterThan(0);
        });

        it('should change FPS and update delta time', () => {
            const clock = new TestClock(60);

            clock.setFPS(30);

            expect(clock.fps).toBe(30);
            expect(clock.deltaTime).toBeCloseTo(33.33, 1);
        });

        it('should provide delta time in seconds', () => {
            const clock = new TestClock(60);

            expect(clock.deltaSeconds).toBeCloseTo(0.01667, 4);
        });
    });

    describe('Entity Factory Helpers', () => {
        let engine: Engine;

        beforeEach(() => {
            engine = new TestEngineBuilder().build();
        });

        describe('createTestEntity', () => {
            it('should create a basic entity', () => {
                const entity = createTestEntity(engine);

                expect(entity).toBeDefined();
                expect(entity.id).toBeDefined();
                // Entity should be valid and in the engine
                expect(engine.getAllEntities()).toContain(entity);
            });

            it('should create entity with custom name', () => {
                const entity = createTestEntity(engine, { name: 'TestEntity' });

                expect(entity.name).toBe('TestEntity');
            });

            it('should create entity with tags', () => {
                const entity = createTestEntity(engine, {
                    tags: ['player', 'controllable'],
                });

                expect(entity.hasTag('player')).toBe(true);
                expect(entity.hasTag('controllable')).toBe(true);
            });

            it('should create entity with components', () => {
                const entity = createTestEntity(engine, {
                    components: [
                        { type: Position, args: [10, 20] },
                        { type: Velocity, args: [1, 2] },
                    ],
                });

                expect(entity.hasComponent(Position)).toBe(true);
                expect(entity.hasComponent(Velocity)).toBe(true);

                const pos = entity.getComponent(Position);
                expect(pos.x).toBe(10);
                expect(pos.y).toBe(20);
            });

            it('should create entity with parent', () => {
                const parent = engine.createEntity('Parent');
                const child = createTestEntity(engine, {
                    name: 'Child',
                    parent: parent,
                });

                expect(child.parent).toBe(parent);
                expect(parent.children).toContain(child);
            });

            it('should create entity with all options combined', () => {
                const parent = engine.createEntity('Parent');
                const entity = createTestEntity(engine, {
                    name: 'FullEntity',
                    tags: ['test'],
                    components: [{ type: Position, args: [5, 5] }],
                    parent: parent,
                });

                expect(entity.name).toBe('FullEntity');
                expect(entity.hasTag('test')).toBe(true);
                expect(entity.hasComponent(Position)).toBe(true);
                expect(entity.parent).toBe(parent);
            });
        });

        describe('createTestEntities', () => {
            it('should create multiple entities', () => {
                const entities = createTestEntities(engine, 5);

                expect(entities).toHaveLength(5);
                entities.forEach((entity) => {
                    expect(entity).toBeDefined();
                });
            });

            it('should create entities with numbered names', () => {
                const entities = createTestEntities(engine, 3, {
                    name: 'Enemy',
                });

                expect(entities[0].name).toBe('Enemy_0');
                expect(entities[1].name).toBe('Enemy_1');
                expect(entities[2].name).toBe('Enemy_2');
            });

            it('should create entities with same configuration', () => {
                const entities = createTestEntities(engine, 3, {
                    tags: ['enemy'],
                    components: [{ type: Position }, { type: Health, args: [50, 50] }],
                });

                entities.forEach((entity) => {
                    expect(entity.hasTag('enemy')).toBe(true);
                    expect(entity.hasComponent(Position)).toBe(true);
                    expect(entity.hasComponent(Health)).toBe(true);
                });
            });
        });

        describe('createTestEntityFromPrefab', () => {
            it('should create entity from registered prefab', () => {
                const prefab: EntityPrefab = {
                    name: 'PlayerPrefab',
                    components: [
                        { type: Position, args: [0, 0] },
                        { type: Health, args: [100, 100] },
                    ],
                    tags: ['player'],
                };

                engine.registerPrefab('Player', prefab);
                const entity = createTestEntityFromPrefab(engine, 'Player', 'Player1');

                expect(entity).not.toBeNull();
                expect(entity!.name).toBe('Player1');
                expect(entity!.hasComponent(Position)).toBe(true);
                expect(entity!.hasComponent(Health)).toBe(true);
                expect(entity!.hasTag('player')).toBe(true);
            });
        });
    });

    describe('TestSystemRunner', () => {
        let engine: Engine;
        let runner: TestSystemRunner;

        beforeEach(() => {
            engine = new TestEngineBuilder().build();
            runner = new TestSystemRunner(engine);

            // Create a test system
            engine.createSystem(
                'MovementSystem',
                {
                    all: [Position, Velocity],
                },
                {
                    act: (_entity: any, ...components: any[]) => {
                        const position = components[0] as Position;
                        const velocity = components[1] as Velocity;
                        position.x += velocity.vx;
                        position.y += velocity.vy;
                    },
                }
            );
        });

        it('should run a specific system', () => {
            createTestEntity(engine, {
                components: [
                    { type: Position, args: [0, 0] },
                    { type: Velocity, args: [1, 1] },
                ],
            });

            const profile = runner.runSystem('MovementSystem', 16.67);

            expect(profile).toBeDefined();
            expect(profile?.name).toBe('MovementSystem');
        });

        it('should track system execution', () => {
            createTestEntity(engine, {
                components: [
                    { type: Position, args: [0, 0] },
                    { type: Velocity, args: [1, 1] },
                ],
            });

            runner.runSystem('MovementSystem');

            expect(runner.wasExecuted('MovementSystem')).toBe(true);
        });

        it('should return execution time', () => {
            createTestEntity(engine, {
                components: [
                    { type: Position, args: [0, 0] },
                    { type: Velocity, args: [1, 1] },
                ],
            });

            runner.runSystem('MovementSystem');

            const execTime = runner.getExecutionTime('MovementSystem');
            expect(execTime).not.toBeNull();
            expect(execTime).toBeGreaterThanOrEqual(0);
        });

        it('should return entity count', () => {
            createTestEntities(engine, 3, {
                components: [{ type: Position }, { type: Velocity }],
            });

            runner.runSystem('MovementSystem');

            const entityCount = runner.getEntityCount('MovementSystem');
            expect(entityCount).toBe(3);
        });

        it('should throw error for non-existent system', () => {
            expect(() => {
                runner.runSystem('NonExistentSystem');
            }).toThrow('NonExistentSystem');
        });

        it('should clear execution log', () => {
            createTestEntity(engine, {
                components: [{ type: Position }, { type: Velocity }],
            });

            runner.runSystem('MovementSystem');
            expect(runner.wasExecuted('MovementSystem')).toBe(true);

            runner.clearLog();
            expect(runner.wasExecuted('MovementSystem')).toBe(false);
        });

        it('should run all variable systems', () => {
            runner.runVariableSystems(16.67);

            expect(runner.wasExecuted('MovementSystem')).toBe(true);
        });

        it('should get all execution logs', () => {
            createTestEntity(engine, {
                components: [{ type: Position }, { type: Velocity }],
            });

            runner.runSystem('MovementSystem');

            const logs = runner.getAllLogs();
            expect(logs.size).toBeGreaterThan(0);
            expect(logs.has('MovementSystem')).toBe(true);
        });
    });

    describe('TestSnapshot', () => {
        let engine: Engine;
        let snapshot: TestSnapshot;

        beforeEach(() => {
            engine = new TestEngineBuilder().build();
            snapshot = new TestSnapshot(engine);
        });

        it('should create a snapshot', () => {
            createTestEntity(engine, {
                components: [{ type: Position, args: [10, 20] }],
            });

            const snapIndex = snapshot.create();

            expect(snapIndex).toBeGreaterThanOrEqual(0);
            expect(snapshot.getEntityCount()).toBe(1);
        });

        it('should restore a snapshot', () => {
            const entity = createTestEntity(engine, {
                name: 'TestEntity',
                components: [{ type: Position, args: [10, 20] }],
            });

            const snap1 = snapshot.create();
            expect(snapshot.getEntityCount()).toBe(1);

            // Modify the entity
            const pos = entity.getComponent(Position);
            pos.x = 100;

            // Create another entity
            createTestEntity(engine, {
                name: 'AnotherEntity',
                components: [{ type: Position }],
            });

            expect(snapshot.getEntityCount()).toBe(2);

            // Restore snapshot
            snapshot.restore(snap1);

            // Verify restoration
            expect(snapshot.getEntityCount()).toBe(1);
        });

        it('should track multiple snapshots', () => {
            const snap1 = snapshot.create();
            expect(snapshot.getEntityCount()).toBe(0);

            createTestEntity(engine, {
                components: [{ type: Position }],
            });

            const snap2 = snapshot.create();
            expect(snapshot.getEntityCount()).toBe(1);

            createTestEntity(engine, {
                components: [{ type: Position }],
            });

            expect(snapshot.getEntityCount()).toBe(2);

            // Restore to snap2 (1 entity)
            snapshot.restore(snap2);
            expect(snapshot.getEntityCount()).toBe(1);

            // Restore to snap1 (0 entities)
            snapshot.restore(snap1);
            expect(snapshot.getEntityCount()).toBe(0);
        });
    });

    describe('Utility Functions', () => {
        describe('createMockComponent', () => {
            it('should create a mock component class', () => {
                const MockComp = createMockComponent('MockComponent', {
                    value: 42,
                    name: 'test',
                });

                const instance = new MockComp();

                expect(instance.value).toBe(42);
                expect(instance.name).toBe('test');
                expect(MockComp.componentName).toBe('MockComponent');
            });

            it('should work with entities', () => {
                const engine = new TestEngineBuilder().build();
                const MockComp = createMockComponent('MockComponent', { x: 10 });

                const entity = engine.createEntity();
                entity.addComponent(MockComp);

                expect(entity.hasComponent(MockComp)).toBe(true);
            });
        });

        describe('getEntitySummary', () => {
            it('should return summary of entities', () => {
                const engine = new TestEngineBuilder().build();

                createTestEntity(engine, {
                    name: 'Player',
                    components: [{ type: Position }, { type: Velocity }],
                });

                const summary = getEntitySummary(engine);

                expect(summary).toContain('1 entities');
                expect(summary).toContain('Player');
                // Summary should contain entity information
                expect(summary.length).toBeGreaterThan(10);
            });

            it('should handle empty engine', () => {
                const engine = new TestEngineBuilder().build();
                const summary = getEntitySummary(engine);

                expect(summary).toContain('0 entities');
            });
        });

        describe('assertEngineClean', () => {
            it('should not throw for clean engine', () => {
                const engine = new TestEngineBuilder().build();

                expect(() => {
                    assertEngineClean(engine);
                }).not.toThrow();
            });

            it('should throw for engine with entities', () => {
                const engine = new TestEngineBuilder().build();
                createTestEntity(engine);

                expect(() => {
                    assertEngineClean(engine);
                }).toThrow('entities');
            });
        });
    });

    describe('Custom Matchers', () => {
        let engine: Engine;

        beforeEach(() => {
            engine = new TestEngineBuilder().build();
            setupTestMatchers();
        });

        it('should have toHaveComponent matcher', () => {
            const entity = createTestEntity(engine, {
                components: [{ type: Position }],
            });

            expect(entity).toHaveComponent(Position);
        });

        it('should have toHaveTag matcher', () => {
            const entity = createTestEntity(engine, {
                tags: ['player'],
            });

            expect(entity).toHaveTag('player');
        });
    });

    describe('TestClock - Additional Coverage', () => {
        it('should not advance when stepByTime is called while paused', () => {
            const clock = new TestClock();

            clock.pause();
            clock.stepByTime(100);

            expect(clock.currentTime).toBe(0); // Should not advance when paused
        });

        it('should return current time from step when not paused', () => {
            const clock = new TestClock(60);

            const result = clock.step(2);

            expect(result).toBeCloseTo(33.33, 1);
            expect(clock.currentTime).toBe(result);
        });

        it('should return current time from stepByTime when not paused', () => {
            const clock = new TestClock();

            const result = clock.stepByTime(50);

            expect(result).toBe(50);
            expect(clock.currentTime).toBe(50);
        });
    });

    describe('TestSystemRunner - Additional Coverage', () => {
        let engine: Engine;
        let runner: TestSystemRunner;

        beforeEach(() => {
            engine = new TestEngineBuilder().build();
            runner = new TestSystemRunner(engine);

            engine.createSystem(
                'MovementSystem',
                {
                    all: [Position, Velocity],
                },
                {
                    act: (_entity: any, ...components: any[]) => {
                        const position = components[0] as Position;
                        const velocity = components[1] as Velocity;
                        position.x += velocity.vx;
                        position.y += velocity.vy;
                    },
                }
            );
        });

        it('should run all systems with runAllSystems', () => {
            createTestEntity(engine, {
                components: [
                    { type: Position, args: [0, 0] },
                    { type: Velocity, args: [1, 1] },
                ],
            });

            runner.runAllSystems(16.67);

            expect(runner.wasExecuted('MovementSystem')).toBe(true);
        });

        it('should return full profile with getProfile', () => {
            createTestEntity(engine, {
                components: [
                    { type: Position, args: [0, 0] },
                    { type: Velocity, args: [1, 1] },
                ],
            });

            runner.runSystem('MovementSystem');

            const profile = runner.getProfile('MovementSystem');
            expect(profile).not.toBeNull();
            expect(profile?.name).toBe('MovementSystem');
            expect(profile?.entityCount).toBe(1);
            expect(typeof profile?.executionTime).toBe('number');
        });

        it('should return null for non-executed system profile', () => {
            const profile = runner.getProfile('NonExistent');
            expect(profile).toBeNull();
        });

        it('should return null for non-executed system execution time', () => {
            const execTime = runner.getExecutionTime('NonExistent');
            expect(execTime).toBeNull();
        });

        it('should return null for non-executed system entity count', () => {
            const count = runner.getEntityCount('NonExistent');
            expect(count).toBeNull();
        });
    });

    describe('TestSnapshot - Additional Coverage', () => {
        let engine: Engine;
        let snapshot: TestSnapshot;

        beforeEach(() => {
            engine = new TestEngineBuilder().build();
            snapshot = new TestSnapshot(engine);
        });

        it('should restore last snapshot when index is undefined', () => {
            createTestEntity(engine, {
                components: [{ type: Position }],
            });

            snapshot.create(); // snap 0 with 1 entity

            createTestEntity(engine, {
                components: [{ type: Position }],
            });
            expect(snapshot.getEntityCount()).toBe(2);

            // Restore without specifying index (should restore last)
            snapshot.restore();
            expect(snapshot.getEntityCount()).toBe(1);
        });

        it('should clear all snapshots', () => {
            createTestEntity(engine, {
                components: [{ type: Position }],
            });

            snapshot.create();
            snapshot.create();

            snapshot.clear();

            // Should have cleared snapshots
            expect(engine.getSnapshotCount()).toBe(0);
        });
    });

    describe('createTestEntityFromPrefab - Edge Cases', () => {
        let engine: Engine;

        beforeEach(() => {
            engine = new TestEngineBuilder().build();
        });

        it('should return null for non-existent prefab', () => {
            const entity = createTestEntityFromPrefab(engine, 'NonExistentPrefab');
            expect(entity).toBeNull();
        });

        it('should create entity without custom name', () => {
            const prefab: EntityPrefab = {
                name: 'TestPrefab',
                components: [{ type: Position, args: [] }],
                tags: [],
            };

            engine.registerPrefab('Test', prefab);
            const entity = createTestEntityFromPrefab(engine, 'Test');

            expect(entity).not.toBeNull();
        });
    });

    describe('Custom Matchers - Additional Coverage', () => {
        let engine: Engine;

        beforeEach(() => {
            engine = new TestEngineBuilder().build();
            setupTestMatchers();
        });

        it('should match query results with toMatch', () => {
            const entity1 = createTestEntity(engine, {
                name: 'Entity1',
                components: [{ type: Position }],
            });
            const entity2 = createTestEntity(engine, {
                name: 'Entity2',
                components: [{ type: Position }],
            });

            const query = engine.createQuery({ all: [Position] });
            const results = Array.from(query);

            expect(results).toMatch([entity1, entity2]);
        });

        it('should verify entity has expected components for archetype check', () => {
            const entity = createTestEntity(engine, {
                components: [{ type: Position }, { type: Velocity }],
            });

            // Verify entity has expected components
            expect(entity.hasComponent(Position)).toBe(true);
            expect(entity.hasComponent(Velocity)).toBe(true);
        });

        it('should fail toHaveComponent for missing component', () => {
            const entity = createTestEntity(engine, {
                components: [{ type: Position }],
            });

            expect(entity).not.toHaveComponent(Velocity);
        });

        it('should fail toHaveTag for missing tag', () => {
            const entity = createTestEntity(engine, {
                tags: ['player'],
            });

            expect(entity).not.toHaveTag('enemy');
        });
    });

    describe('Async Utilities', () => {
        it('should wait for specified frames with waitFrames', async () => {
            const engine = new TestEngineBuilder().build();
            const clock = new TestClock(60);

            let frameCount = 0;
            createTestEntity(engine, {
                components: [{ type: Position }],
            });

            engine.createSystem(
                'CounterSystem',
                { all: [Position] },
                {
                    act: () => {
                        frameCount++;
                    },
                }
            );

            await waitFrames(clock, engine, 5);

            expect(frameCount).toBe(5);
            expect(clock.currentTime).toBeCloseTo(83.35, 0);
        });

        it('should resolve waitUntil when condition is met', async () => {
            let flag = false;

            setTimeout(() => {
                flag = true;
            }, 50);

            await expect(
                waitUntil(() => flag, 200, 'Flag should be true')
            ).resolves.toBeUndefined();
        });

        it('should reject waitUntil on timeout', async () => {
            await expect(waitUntil(() => false, 100, 'Condition never met')).rejects.toThrow(
                'Timeout: Condition never met'
            );
        });
    });

    describe('createMockComponent - Additional Coverage', () => {
        it('should create component with empty default props', () => {
            const MockComp = createMockComponent('EmptyComponent');
            const instance = new MockComp();

            expect(MockComp.name).toBe('EmptyComponent');
            expect(instance).toBeDefined();
        });

        it('should preserve component name property', () => {
            const MockComp = createMockComponent('NamedComponent', { x: 1 });

            expect(MockComp.name).toBe('NamedComponent');
            expect(MockComp.componentName).toBe('NamedComponent');
        });
    });

    describe('getEntitySummary - Edge Cases', () => {
        it('should handle entities without components map', () => {
            const engine = new TestEngineBuilder().build();
            engine.createEntity('EmptyEntity');

            const summary = getEntitySummary(engine);

            expect(summary).toContain('1 entities');
            expect(summary).toContain('EmptyEntity');
        });

        it('should handle multiple entities with various components', () => {
            const engine = new TestEngineBuilder().build();

            createTestEntity(engine, {
                name: 'Player',
                components: [{ type: Position }, { type: Velocity }],
            });
            createTestEntity(engine, {
                name: 'Enemy',
                components: [{ type: Position }, { type: Health }],
            });

            const summary = getEntitySummary(engine);

            expect(summary).toContain('2 entities');
            expect(summary).toContain('Player');
            expect(summary).toContain('Enemy');
        });
    });

    describe('Integration Tests', () => {
        it('should support full testing workflow', () => {
            // Setup test engine
            const engine = new TestEngineBuilder().build();
            const clock = new TestClock(60);
            const runner = new TestSystemRunner(engine);

            // Create system
            engine.createSystem(
                'MovementSystem',
                {
                    all: [Position, Velocity],
                },
                {
                    act: (_entity: any, ...components: any[]) => {
                        const position = components[0] as Position;
                        const velocity = components[1] as Velocity;
                        position.x += velocity.vx;
                        position.y += velocity.vy;
                    },
                }
            );

            // Create test entities
            const entities = createTestEntities(engine, 5, {
                components: [
                    { type: Position, args: [0, 0] },
                    { type: Velocity, args: [1, 1] },
                ],
            });

            // Step clock and run system
            clock.step();
            runner.runSystem('MovementSystem', clock.deltaTime);

            // Verify execution
            expect(runner.wasExecuted('MovementSystem')).toBe(true);
            expect(runner.getEntityCount('MovementSystem')).toBe(5);

            // Verify entity state
            entities.forEach((entity) => {
                const pos = entity.getComponent(Position);
                expect(pos.x).toBe(1);
                expect(pos.y).toBe(1);
            });
        });

        it('should support snapshot-based testing', () => {
            const engine = new TestEngineBuilder().build();
            const snapshot = new TestSnapshot(engine);

            // Create initial state with 1 entity
            createTestEntity(engine, {
                components: [{ type: Position, args: [0, 0] }],
            });

            const snap1 = snapshot.create();
            expect(snapshot.getEntityCount()).toBe(1);

            // Add more entities
            createTestEntity(engine, {
                components: [{ type: Position, args: [10, 10] }],
            });
            createTestEntity(engine, {
                components: [{ type: Position, args: [20, 20] }],
            });

            expect(snapshot.getEntityCount()).toBe(3);

            // Restore original state (should have 1 entity)
            snapshot.restore(snap1);
            expect(snapshot.getEntityCount()).toBe(1);
        });

        it('should support deterministic time-based testing', () => {
            const engine = new TestEngineBuilder().build();
            const clock = new TestClock(60);

            let frameCount = 0;

            // Create a test entity for the system to process
            createTestEntity(engine, {
                components: [{ type: Position }],
            });

            engine.createSystem(
                'CounterSystem',
                {
                    all: [Position],
                },
                {
                    act: () => {
                        frameCount++;
                    },
                }
            );

            // Simulate 10 frames
            for (let i = 0; i < 10; i++) {
                clock.step();
                engine.update(clock.deltaTime);
            }

            expect(frameCount).toBe(10);
            expect(clock.currentTime).toBeCloseTo(166.7, 0);
        });
    });
});
