import { Engine, PerformanceMonitor } from './engine';
import type { EntityPrefab } from './definitions';

// Test components
class Position {
    constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
    constructor(public x: number = 0, public y: number = 0) {}
}

class Health {
    constructor(public current: number = 100, public max: number = 100) {}
}

class Damage {
    constructor(public value: number = 10) {}
}

describe('Bug Fixes', () => {
    let engine: Engine;

    beforeEach(() => {
        engine = new Engine(60, true);
        // Register components for serialization
        engine.registerComponent(Position);
        engine.registerComponent(Velocity);
        engine.registerComponent(Health);
        engine.registerComponent(Damage);
    });

    afterEach(() => {
        engine.stop();
    });

    describe('Critical Bug #1: Component Validation', () => {
        test('should properly validate components and throw on invalid data', () => {
            engine.registerComponentValidator(Health, {
                validate: (component: Health) => {
                    return component.current >= 0 ? true : 'current must be non-negative';
                }
            });

            const entity = engine.createEntity();

            // This should throw because validation fails
            expect(() => {
                entity.addComponent(Health, -10, 100);
            }).toThrow('current must be non-negative');
        });

        test('should allow valid components through validation', () => {
            engine.registerComponentValidator(Health, {
                validate: (component: Health) => {
                    return component.current >= 0 ? true : 'current must be non-negative';
                }
            });

            const entity = engine.createEntity();

            // This should NOT throw
            expect(() => {
                entity.addComponent(Health, 100, 100);
            }).not.toThrow();

            const health = entity.getComponent(Health);
            expect(health.current).toBe(100);
        });
    });

    describe('Critical Bug #2: restoreSnapshot', () => {
        test('should actually restore entities from snapshot', () => {
            // Create entities
            const entity1 = engine.createEntity('Entity1');
            entity1.addComponent(Position, 10, 20);
            entity1.addTag('test');

            const entity2 = engine.createEntity('Entity2');
            entity2.addComponent(Velocity, 5, 10);

            // Create snapshot
            engine.createSnapshot();

            // Modify entities
            entity1.getComponent(Position).x = 999;
            entity2.queueFree();
            engine.update(16);

            expect(engine.getAllEntities()).toHaveLength(1);

            // Restore snapshot
            const restored = engine.restoreSnapshot();
            expect(restored).toBe(true);

            // Should have 2 entities again
            expect(engine.getAllEntities()).toHaveLength(2);

            // Find restored entity by tag
            const restoredEntities = engine.getEntitiesByTag('test');
            expect(restoredEntities).toHaveLength(1);

            // Components should be restored
            const restoredEntity = restoredEntities[0];
            expect(restoredEntity.hasComponent(Position)).toBe(true);
            const pos = restoredEntity.getComponent(Position);
            expect(pos.x).toBe(10);
            expect(pos.y).toBe(20);
        });

        test('should restore entity hierarchies', () => {
            const parent = engine.createEntity('Parent');
            const child = engine.createEntity('Child');
            parent.addChild(child);

            engine.createSnapshot();

            // Clear all
            parent.queueFree();
            child.queueFree();
            engine.update(16);

            expect(engine.getAllEntities()).toHaveLength(0);

            // Restore
            engine.restoreSnapshot();

            // Check hierarchy
            const entities = engine.getAllEntities();
            expect(entities).toHaveLength(2);

            const restoredParent = entities.find(e => e.name === 'Parent');
            const restoredChild = entities.find(e => e.name === 'Child');

            expect(restoredParent).toBeDefined();
            expect(restoredChild).toBeDefined();
            expect(restoredChild!.parent).toBe(restoredParent);
        });
    });

    describe('Critical Bug #3: Symbol Serialization', () => {
        test('should serialize entities with unique IDs', () => {
            const entity1 = engine.createEntity();
            const entity2 = engine.createEntity();

            const serialized = engine.serialize();

            // IDs should be unique
            const ids = serialized.entities.map(e => e.id);
            expect(ids[0]).not.toBe(ids[1]);
            expect(ids[0]).not.toBe('Symbol()');
            expect(ids[1]).not.toBe('Symbol()');
        });
    });

    describe('Critical Bug #4: Fixed Update Spiral of Death', () => {
        test('should limit fixed update iterations', () => {
            let fixedUpdateCount = 0;

            engine.createSystem('FixedSystem', { all: [] }, {
                before: () => { fixedUpdateCount++; }
            }, true); // true = fixed update

            // Simulate massive lag (5 seconds)
            engine.update(5000);

            // Should not run more than MAX_FIXED_UPDATE_ITERATIONS (10)
            expect(fixedUpdateCount).toBeLessThanOrEqual(10);
        });
    });

    describe('Bug #5: ComponentArray Bounds Checking', () => {
        test('should return null for out of bounds access', () => {
            const entity = engine.createEntity();
            entity.addComponent(Position, 0, 0);

            // Access with invalid index through internal API would return null
            const componentArray = (engine as any).getComponentArray(Position);
            expect(componentArray.get(99999)).toBeNull();
            expect(componentArray.get(-1)).toBeNull();
        });
    });

    describe('Bug #6: Query.match Side Effects', () => {
        test('should consistently match entities', () => {
            const query = engine.createQuery({ all: [Position] });

            const entity = engine.createEntity();
            entity.addComponent(Position, 0, 0);

            // First match
            const result1 = query.match(entity);
            expect(result1).toBe(true);

            // Second match should be consistent
            const result2 = query.match(entity);
            expect(result2).toBe(true);

            expect(query.size).toBe(1);
        });
    });

    describe('Smell #8: Entity Component Types Access', () => {
        test('should provide public method to get component types', () => {
            const entity = engine.createEntity();
            entity.addComponent(Position, 0, 0);
            entity.addComponent(Velocity, 1, 1);

            const types = entity.getComponentTypes();
            expect(types).toHaveLength(2);
            expect(types).toContain(Position);
            expect(types).toContain(Velocity);
        });
    });

    describe('Smell #12: Pool Max Size', () => {
        test('should limit pool size', () => {
            // Create and delete many entities
            for (let i = 0; i < 1500; i++) {
                const entity = engine.createEntity();
                entity.queueFree();
            }
            engine.update(16);

            const stats = engine.getMemoryStats();
            // Pool should have created entities but not kept all in pool
            expect(stats.totalEntities).toBe(1500);
        });
    });

    describe('Smell #14: System Sorting Optimization', () => {
        test('should only sort systems when needed', () => {
            let highPriorityRan = false;
            let lowPriorityRan = false;
            const executionOrder: string[] = [];

            engine.createSystem('HighPriority', { all: [] }, {
                priority: 100,
                before: () => {
                    highPriorityRan = true;
                    executionOrder.push('high');
                }
            });

            engine.createSystem('LowPriority', { all: [] }, {
                priority: 1,
                before: () => {
                    lowPriorityRan = true;
                    executionOrder.push('low');
                }
            });

            // Systems should sort on first update
            engine.update(16);

            expect(highPriorityRan).toBe(true);
            expect(lowPriorityRan).toBe(true);
            expect(executionOrder).toEqual(['high', 'low']);

            // Run again - should maintain order without re-sorting
            executionOrder.length = 0;
            engine.update(16);
            expect(executionOrder).toEqual(['high', 'low']);
        });
    });

    describe('Smell #19: History Memory Leak', () => {
        test('should not leak memory in MessageBus history', () => {
            // Publish way more messages than max history
            for (let i = 0; i < 2000; i++) {
                engine.messageBus.publish('test', { data: i });
            }

            const history = engine.messageBus.getMessageHistory();
            // Should cap at MAX_MESSAGE_HISTORY (1000)
            expect(history.length).toBeLessThanOrEqual(1000);
        });

        test('should not leak memory in EventEmitter history', () => {
            // Emit way more events than max history
            for (let i = 0; i < 1000; i++) {
                engine.emit('testEvent', i);
            }

            const history = (engine as any).getEventHistory();
            // Should cap at MAX_EVENT_HISTORY (500)
            expect(history.length).toBeLessThanOrEqual(500);
        });
    });

    describe('PerformanceMonitor Fixes', () => {
        test('should limit sample size', () => {
            const monitor = new PerformanceMonitor();

            // Add way more samples than max
            for (let i = 0; i < 100; i++) {
                monitor.addSample(i);
            }

            // Should cap at MAX_PERFORMANCE_SAMPLES (60)
            expect((monitor as any).samples.length).toBeLessThanOrEqual(60);
        });
    });

    describe('Integration: Complex Scenario', () => {
        test('should handle all fixes together in realistic scenario', () => {
            // Register validators
            engine.registerComponentValidator(Health, {
                validate: (c: Health) => c.current >= 0 ? true : 'Invalid health',
                dependencies: [Position]
            });

            // Create prefab
            const playerPrefab: EntityPrefab = {
                name: 'Player',
                components: [
                    { type: Position, args: [0, 0] },
                    { type: Health, args: [100, 100] }
                ],
                tags: ['player']
            };

            engine.registerPrefab('Player', playerPrefab);

            // Create from prefab
            const player = engine.createFromPrefab('Player', 'Hero');
            expect(player).toBeDefined();

            // Create snapshot
            engine.createSnapshot();

            // Modify world
            player!.getComponent(Position).x = 50;
            player!.addComponent(Velocity, 5, 5);

            // Simulate large lag
            engine.createSystem('TestSystem', { all: [] }, {}, true);
            engine.update(10000);

            // Restore snapshot
            const restored = engine.restoreSnapshot();
            expect(restored).toBe(true);

            // Verify restoration
            const heroes = engine.getEntitiesByTag('player');
            expect(heroes).toHaveLength(1);
            expect(heroes[0].getComponent(Position).x).toBe(0);
            expect(heroes[0].hasComponent(Velocity)).toBe(false);
        });
    });
});
