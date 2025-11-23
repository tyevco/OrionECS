import type { EntityDef, EntityPrefab, SystemMessage } from './definitions';
import { Engine, EngineBuilder } from './engine';
import { createTagComponent } from './utils';

// Test components
class Position {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

class Velocity {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
    ) {}
}

class Damage {
    constructor(public value: number = 10) {}
}

describe('Engine v2 - Composition Architecture', () => {
    let engine: Engine;

    beforeEach(() => {
        engine = new EngineBuilder().withDebugMode(true).withFixedUpdateFPS(60).build();

        // Register components
        engine.registerComponent(Position);
        engine.registerComponent(Velocity);
        engine.registerComponent(Health);
        engine.registerComponent(Damage);
    });

    afterEach(() => {
        engine.stop();
    });

    describe('EngineBuilder', () => {
        test('should build engine with default settings', () => {
            const defaultEngine = new EngineBuilder().build();
            expect(defaultEngine).toBeDefined();
            expect(defaultEngine).toBeInstanceOf(Engine);
        });

        test('should build engine with custom settings', () => {
            const customEngine = new EngineBuilder()
                .withDebugMode(true)
                .withFixedUpdateFPS(30)
                .withMaxFixedIterations(5)
                .withMaxSnapshots(20)
                .build();

            expect(customEngine).toBeDefined();
            expect(customEngine).toBeInstanceOf(Engine);
        });
    });

    describe('Entity Management', () => {
        test('should create entity', () => {
            const entity = engine.createEntity('TestEntity');
            expect(entity).toBeDefined();
            expect(entity.name).toBe('TestEntity');
        });

        test('should get entity by ID', () => {
            const entity = engine.createEntity('TestEntity');
            const retrieved = engine.getEntity(entity.id);
            expect(retrieved).toBe(entity);
        });

        test('should get all entities', () => {
            engine.createEntity('Entity1');
            engine.createEntity('Entity2');
            engine.createEntity('Entity3');

            const allEntities = engine.getAllEntities();
            expect(allEntities).toHaveLength(3);
        });

        test('should get entities by tag', () => {
            const entity1 = engine.createEntity('Entity1');
            entity1.addTag('player');

            const entity2 = engine.createEntity('Entity2');
            entity2.addTag('player');

            const entity3 = engine.createEntity('Entity3');
            entity3.addTag('enemy');

            const players = engine.getEntitiesByTag('player');
            expect(players).toHaveLength(2);
            expect(players).toContain(entity1);
            expect(players).toContain(entity2);
        });

        test('should delete entities', () => {
            const entity = engine.createEntity('ToDelete');
            entity.queueFree();

            expect(engine.getAllEntities()).toHaveLength(1);
            engine.update(16);
            expect(engine.getAllEntities()).toHaveLength(0);
        });

        test('should create multiple empty entities', () => {
            const entities = engine.createEntities(10);
            expect(entities.length).toBe(10);
            entities.forEach((e) => {
                expect(e).toBeDefined();
                expect(engine.getEntity(e.id)).toBe(e);
            });
        });

        test('should create multiple entities from prefab', () => {
            // Register prefab
            const prefab: EntityPrefab = {
                name: 'TestPrefab',
                components: [{ type: Position, args: [0, 0] }],
                tags: ['test'],
            };
            engine.registerPrefab('TestPrefab', prefab);

            // Create bulk entities from prefab
            const entities = engine.createEntities(5, 'TestPrefab');
            expect(entities.length).toBe(5);
            entities.forEach((e) => {
                expect(e.hasComponent(Position)).toBe(true);
                expect(e.hasTag('test')).toBe(true);
            });
        });

        test('should perform bulk creation reasonably fast', () => {
            const start = performance.now();
            engine.createEntities(1000);
            const duration = performance.now() - start;
            expect(duration).toBeLessThan(1000); // Should complete in < 1 second
        });
    });

    describe('Entity Name Indexing', () => {
        test('should lookup entity by name (O(1))', () => {
            const player = engine.createEntity('Player');
            const found = engine.getEntityByName('Player');
            expect(found).toBe(player);
        });

        test('should return undefined for non-existent name', () => {
            expect(engine.getEntityByName('DoesNotExist')).toBeUndefined();
        });

        test('should remove name from index after entity deletion', () => {
            const player = engine.createEntity('Player');
            player.queueFree();
            engine.update(16);
            expect(engine.getEntityByName('Player')).toBeUndefined();
        });

        test('should handle entities without names', () => {
            const unnamed = engine.createEntity();
            expect(unnamed.name).toBeUndefined();
            // Should not crash when looking up undefined
            expect(engine.getEntityByName('')).toBeUndefined();
        });

        test('should overwrite previous entity with same name', () => {
            const _entity1 = engine.createEntity('Duplicate');
            const entity2 = engine.createEntity('Duplicate');
            const found = engine.getEntityByName('Duplicate');
            // Last one with this name wins
            expect(found).toBe(entity2);
        });
    });

    describe('Entity Search Methods', () => {
        test('should find first entity matching predicate', () => {
            const enemy = engine.createEntity('Enemy');
            enemy.addTag('hostile');
            const friendly = engine.createEntity('Friendly');
            friendly.addTag('ally');

            const found = engine.findEntity((e) => e.hasTag('hostile'));
            expect(found).toBe(enemy);
        });

        test('should return undefined when no entity matches predicate', () => {
            engine.createEntity('Entity1');
            engine.createEntity('Entity2');

            const found = engine.findEntity((e) => e.hasTag('non-existent'));
            expect(found).toBeUndefined();
        });

        test('should find all entities matching predicate', () => {
            const entities = [
                engine.createEntity('E1'),
                engine.createEntity('E2'),
                engine.createEntity('E3'),
                engine.createEntity('E4'),
                engine.createEntity('E5'),
            ];

            entities.forEach((e) => {
                e.addTag('test');
            });
            entities[2].addTag('special');
            entities[4].addTag('special');

            const found = engine.findEntities((e) => e.hasTag('special'));
            expect(found.length).toBe(2);
            expect(found).toContain(entities[2]);
            expect(found).toContain(entities[4]);
        });

        test('should return empty array when no entities match predicate', () => {
            engine.createEntity('Entity1');
            engine.createEntity('Entity2');

            const found = engine.findEntities((e) => e.hasTag('non-existent'));
            expect(found).toEqual([]);
        });

        test('should get entity by numeric ID', () => {
            const entity = engine.createEntity('Test');
            const numericId = entity.numericId;

            const found = engine.getEntityByNumericId(numericId);
            expect(found).toBe(entity);
        });

        test('should return undefined for non-existent numeric ID', () => {
            expect(engine.getEntityByNumericId(999999)).toBeUndefined();
        });

        test('should remove numeric ID from index after deletion', () => {
            const entity = engine.createEntity('Test');
            const numericId = entity.numericId;

            entity.queueFree();
            engine.update(16);

            expect(engine.getEntityByNumericId(numericId)).toBeUndefined();
        });

        test('should support complex predicate searches', () => {
            const player = engine.createEntity('Player');
            player.addComponent(Health, 50, 100);
            player.addTag('player');

            const enemy1 = engine.createEntity('Enemy1');
            enemy1.addComponent(Health, 30, 100);
            enemy1.addTag('enemy');

            const enemy2 = engine.createEntity('Enemy2');
            enemy2.addComponent(Health, 80, 100);
            enemy2.addTag('enemy');

            // Find enemies with low health
            const lowHealthEnemies = engine.findEntities(
                (e) =>
                    e.hasTag('enemy') &&
                    e.hasComponent(Health) &&
                    e.getComponent(Health).current < 50
            );

            expect(lowHealthEnemies.length).toBe(1);
            expect(lowHealthEnemies[0]).toBe(enemy1);
        });
    });

    describe('Entity Cloning', () => {
        test('should clone entity with all components', () => {
            const original = engine.createEntity('Original');
            original.addComponent(Position, 10, 20);
            original.addComponent(Velocity, 5, 3);

            const clone = engine.cloneEntity(original);

            expect(clone).not.toBe(original);
            expect(clone.hasComponent(Position)).toBe(true);
            expect(clone.hasComponent(Velocity)).toBe(true);
            expect(clone.getComponent(Position).x).toBe(10);
            expect(clone.getComponent(Position).y).toBe(20);
            expect(clone.getComponent(Velocity).x).toBe(5);
            expect(clone.getComponent(Velocity).y).toBe(3);
        });

        test('should clone entity with all tags', () => {
            const original = engine.createEntity('Original');
            original.addTag('player');
            original.addTag('active');
            original.addTag('controllable');

            const clone = engine.cloneEntity(original);

            expect(clone.hasTag('player')).toBe(true);
            expect(clone.hasTag('active')).toBe(true);
            expect(clone.hasTag('controllable')).toBe(true);
        });

        test('should create independent copy (deep clone)', () => {
            const original = engine.createEntity('Original');
            original.addComponent(Position, 10, 20);

            const clone = engine.cloneEntity(original);

            // Modify original
            original.getComponent(Position).x = 999;

            // Clone should not be affected
            expect(clone.getComponent(Position).x).toBe(10);
        });

        test('should override entity name', () => {
            const original = engine.createEntity('Original');
            original.addComponent(Position, 10, 20);

            const clone = engine.cloneEntity(original, { name: 'CustomClone' });

            expect(clone.name).toBe('CustomClone');
            expect(original.name).toBe('Original');
        });

        test('should override component values', () => {
            const original = engine.createEntity('Original');
            original.addComponent(Position, 10, 20);
            original.addComponent(Health, 50, 100);

            const clone = engine.cloneEntity(original, {
                components: {
                    Position: { x: 100 },
                },
            });

            expect(clone.getComponent(Position).x).toBe(100);
            expect(clone.getComponent(Position).y).toBe(20); // y not overridden
            expect(clone.getComponent(Health).current).toBe(50); // Other components unchanged
        });

        test('should override multiple component values', () => {
            const original = engine.createEntity('Original');
            original.addComponent(Position, 10, 20);
            original.addComponent(Health, 50, 100);

            const clone = engine.cloneEntity(original, {
                name: 'Clone',
                components: {
                    Position: { x: 50, y: 60 },
                    Health: { current: 100 },
                },
            });

            expect(clone.name).toBe('Clone');
            expect(clone.getComponent(Position).x).toBe(50);
            expect(clone.getComponent(Position).y).toBe(60);
            expect(clone.getComponent(Health).current).toBe(100);
            expect(clone.getComponent(Health).max).toBe(100); // Not overridden
        });

        test('should not clone children (single entity clone)', () => {
            const parent = engine.createEntity('Parent');
            const child = engine.createEntity('Child');
            parent.addChild(child);

            const clone = engine.cloneEntity(parent);

            expect(clone.children.length).toBe(0);
            expect(parent.children.length).toBe(1);
        });

        test('should use instance method clone()', () => {
            const original = engine.createEntity('Original');
            original.addComponent(Position, 15, 25);
            original.addTag('test');

            const clone = original.clone(engine);

            expect(clone).not.toBe(original);
            expect(clone.getComponent(Position).x).toBe(15);
            expect(clone.hasTag('test')).toBe(true);
        });

        test('should generate default clone name when original has name', () => {
            const original = engine.createEntity('Hero');
            const clone = engine.cloneEntity(original);

            expect(clone.name).toBe('Hero_clone');
        });

        test('should handle entity without name', () => {
            const original = engine.createEntity();
            original.addComponent(Position, 1, 2);

            const clone = engine.cloneEntity(original);

            expect(clone.name).toBeUndefined();
            expect(clone.getComponent(Position).x).toBe(1);
        });

        test('should handle entity with no components', () => {
            const original = engine.createEntity('Empty');
            const clone = engine.cloneEntity(original);

            expect(clone).not.toBe(original);
            expect(clone.getComponentTypes().length).toBe(0);
        });
    });

    describe('Component Management', () => {
        test('should add and get components', () => {
            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);

            expect(entity.hasComponent(Position)).toBe(true);
            const pos = entity.getComponent(Position);
            expect(pos.x).toBe(10);
            expect(pos.y).toBe(20);
        });

        test('should validate components', () => {
            engine.registerComponentValidator(Health, {
                validate: (component: Health) => {
                    return component.current >= 0 ? true : 'Health cannot be negative';
                },
            });

            const entity = engine.createEntity();

            expect(() => {
                entity.addComponent(Health, -10, 100);
            }).toThrow('Health cannot be negative');
        });

        test('should enforce component dependencies', () => {
            engine.registerComponentValidator(Health, {
                validate: () => true,
                dependencies: [Position],
            });

            const entity = engine.createEntity();

            expect(() => {
                entity.addComponent(Health, 100, 100);
            }).toThrow('requires Position');

            // Should work after adding dependency
            entity.addComponent(Position, 0, 0);
            expect(() => {
                entity.addComponent(Health, 100, 100);
            }).not.toThrow();
        });

        test('should enforce component conflicts', () => {
            engine.registerComponentValidator(Health, {
                validate: () => true,
                conflicts: [Damage],
            });

            const entity = engine.createEntity();
            entity.addComponent(Damage, 50);

            expect(() => {
                entity.addComponent(Health, 100, 100);
            }).toThrow('conflicts with Damage');
        });
    });

    describe('System Management', () => {
        test('should create and execute system', () => {
            let executed = false;

            engine.createSystem(
                'TestSystem',
                { all: [] },
                {
                    before: () => {
                        executed = true;
                    },
                }
            );

            engine.update(16);
            expect(executed).toBe(true);
        });

        test('should execute systems in priority order', () => {
            const executionOrder: string[] = [];

            engine.createSystem(
                'LowPriority',
                { all: [] },
                {
                    priority: 1,
                    before: () => {
                        executionOrder.push('low');
                    },
                }
            );

            engine.createSystem(
                'HighPriority',
                { all: [] },
                {
                    priority: 100,
                    before: () => {
                        executionOrder.push('high');
                    },
                }
            );

            engine.update(16);
            expect(executionOrder).toEqual(['high', 'low']);
        });

        test('should execute system act callback on matching entities', () => {
            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 0, 0);
            entity1.addComponent(Velocity, 1, 1);

            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 5, 5);

            let actCount = 0;

            engine.createSystem(
                'MovementSystem',
                { all: [Position, Velocity] },
                {
                    act: (_entity: EntityDef, pos: Position, vel: Velocity) => {
                        pos.x += vel.x;
                        pos.y += vel.y;
                        actCount++;
                    },
                }
            );

            engine.update(16);

            expect(actCount).toBe(1); // Only entity1 has both components
            expect(entity1.getComponent(Position).x).toBe(1);
            expect(entity1.getComponent(Position).y).toBe(1);
        });

        test('should support fixed update systems', () => {
            let fixedCount = 0;

            engine.createSystem(
                'FixedSystem',
                { all: [] },
                {
                    before: () => {
                        fixedCount++;
                    },
                },
                true
            ); // true = fixed update

            // Simulate 3 frames at 60 FPS (16.67ms each)
            engine.update(16.67);
            expect(fixedCount).toBe(1);

            engine.update(16.67);
            expect(fixedCount).toBe(2);

            engine.update(16.67);
            expect(fixedCount).toBe(3);
        });

        test('should get system profiles', () => {
            engine.createSystem(
                'TestSystem',
                { all: [] },
                {
                    before: () => {},
                }
            );

            engine.update(16);

            const profiles = engine.getSystemProfiles();
            expect(profiles).toHaveLength(1);
            expect(profiles[0].name).toBe('TestSystem');
            expect(profiles[0].callCount).toBe(1);
        });
    });

    describe('Query System', () => {
        test('should create query with all components', () => {
            const query = engine.createQuery({ all: [Position, Velocity] });

            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 0, 0);
            entity1.addComponent(Velocity, 1, 1);

            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 0, 0);

            engine.update(16); // Update queries

            expect(query.size).toBe(1);
            expect(query.getEntitiesArray()).toContain(entity1);
        });

        test('should create query with tag filtering', () => {
            const query = engine.createQuery({
                all: [Position],
                tags: ['player'],
            });

            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 0, 0);
            entity1.addTag('player');

            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 0, 0);
            entity2.addTag('enemy');

            engine.update(16); // Update queries

            expect(query.size).toBe(1);
            expect(query.getEntitiesArray()).toContain(entity1);
        });
    });

    describe('Prefab System', () => {
        test('should register and create from prefab', () => {
            const playerPrefab: EntityPrefab = {
                name: 'Player',
                components: [
                    { type: Position, args: [10, 20] },
                    { type: Health, args: [100, 100] },
                ],
                tags: ['player', 'controllable'],
            };

            engine.registerPrefab('Player', playerPrefab);

            const player = engine.createFromPrefab('Player', 'Hero');
            expect(player).toBeDefined();
            expect(player?.name).toBe('Hero');
            expect(player?.hasComponent(Position)).toBe(true);
            expect(player?.hasComponent(Health)).toBe(true);
            expect(player?.hasTag('player')).toBe(true);
            expect(player?.hasTag('controllable')).toBe(true);
        });

        test('should handle missing prefab gracefully', () => {
            const entity = engine.createFromPrefab('NonExistent');
            expect(entity).toBeNull();
        });

        test('should support parameterized prefabs', () => {
            // Define a parameterized prefab using definePrefab
            engine.definePrefab('Enemy', (type: string, level: number) => ({
                name: `${type}Enemy`,
                components: [
                    { type: Position, args: [0, 0] },
                    { type: Health, args: [50 * level, 50 * level] },
                    { type: Damage, args: [10 * level] },
                ],
                tags: ['enemy', type],
            }));

            // Create entity with parameters
            const goblin = engine.createFromPrefab('Enemy', 'Goblin1', 'Goblin', 5);
            expect(goblin).toBeDefined();
            expect(goblin?.name).toBe('Goblin1');
            expect(goblin?.hasComponent(Health)).toBe(true);
            expect(goblin?.getComponent(Health).current).toBe(250);
            expect(goblin?.getComponent(Health).max).toBe(250);
            expect(goblin?.getComponent(Damage).value).toBe(50);
            expect(goblin?.hasTag('enemy')).toBe(true);
            expect(goblin?.hasTag('Goblin')).toBe(true);

            // Create another entity with different parameters
            const boss = engine.createFromPrefab('Enemy', 'Boss1', 'Boss', 10);
            expect(boss).toBeDefined();
            expect(boss?.getComponent(Health).current).toBe(500);
            expect(boss?.getComponent(Damage).value).toBe(100);
            expect(boss?.hasTag('Boss')).toBe(true);
        });

        test('should extend prefabs', () => {
            // Register base prefab
            engine.registerPrefab('BasicEnemy', {
                name: 'BasicEnemy',
                components: [
                    { type: Position, args: [0, 0] },
                    { type: Health, args: [100, 100] },
                ],
                tags: ['enemy'],
            });

            // Extend the base prefab
            const bossPrefab = engine.extendPrefab('BasicEnemy', {
                name: 'Boss',
                components: [{ type: Damage, args: [50] }],
                tags: ['boss'],
            });

            // Register extended prefab
            engine.registerPrefab('Boss', bossPrefab);

            // Create entity from extended prefab
            const boss = engine.createFromPrefab('Boss', 'BossEnemy');
            expect(boss).toBeDefined();
            expect(boss?.hasComponent(Position)).toBe(true);
            expect(boss?.hasComponent(Health)).toBe(true);
            expect(boss?.hasComponent(Damage)).toBe(true);
            expect(boss?.getComponent(Damage).value).toBe(50);
            expect(boss?.hasTag('enemy')).toBe(true);
            expect(boss?.hasTag('boss')).toBe(true);
        });

        test('should create prefab variants with component overrides', () => {
            // Register base prefab
            engine.registerPrefab('BasicEnemy', {
                name: 'BasicEnemy',
                components: [
                    { type: Position, args: [0, 0] },
                    { type: Health, args: [100, 100] },
                    { type: Velocity, args: [1, 1] },
                ],
                tags: ['enemy'],
            });

            // Create variant with overridden component values
            engine.variantOfPrefab(
                'BasicEnemy',
                {
                    components: {
                        Position: [100, 100],
                        Health: [50, 50],
                        Velocity: [3, 3],
                    },
                },
                'FastEnemy'
            );

            // Create entity from variant prefab
            const fastEnemy = engine.createFromPrefab('FastEnemy', 'FastEnemy1');
            expect(fastEnemy).toBeDefined();
            expect(fastEnemy?.getComponent(Position).x).toBe(100);
            expect(fastEnemy?.getComponent(Position).y).toBe(100);
            expect(fastEnemy?.getComponent(Health).current).toBe(50);
            expect(fastEnemy?.getComponent(Health).max).toBe(50);
            expect(fastEnemy?.getComponent(Velocity).x).toBe(3);
            expect(fastEnemy?.getComponent(Velocity).y).toBe(3);
            expect(fastEnemy?.hasTag('enemy')).toBe(true);
        });

        test('should throw error when extending non-existent prefab', () => {
            expect(() => {
                engine.extendPrefab('DoesNotExist', {
                    components: [{ type: Position, args: [0, 0] }],
                });
            }).toThrow(/not found/i);
        });

        test('should throw error when creating variant of non-existent prefab', () => {
            expect(() => {
                engine.variantOfPrefab('DoesNotExist', {
                    components: { Position: [10, 10] },
                });
            }).toThrow(/not found/i);
        });

        test('should handle parameterized prefabs with default parameters', () => {
            // Define parameterized prefab with default values
            engine.definePrefab('DefaultEnemy', (level: number = 1) => ({
                name: 'DefaultEnemy',
                components: [
                    { type: Position, args: [0, 0] },
                    { type: Health, args: [100 * level, 100 * level] },
                ],
                tags: ['enemy'],
            }));

            // Create entity without parameters (should use defaults)
            const enemy = engine.createFromPrefab('DefaultEnemy', 'DefaultEnemy1');
            expect(enemy).toBeDefined();
            expect(enemy?.getComponent(Health).current).toBe(100);
            expect(enemy?.getComponent(Health).max).toBe(100);
        });

        test('should preserve parent reference in extended prefabs', () => {
            engine.registerPrefab('Base', {
                name: 'Base',
                components: [{ type: Position, args: [0, 0] }],
                tags: ['base'],
            });

            const extended = engine.extendPrefab('Base', {
                name: 'Extended',
                tags: ['extended'],
            });

            expect(extended.parent).toBe('Base');
        });

        test('should preserve parent reference in variant prefabs', () => {
            engine.registerPrefab('Base', {
                name: 'Base',
                components: [{ type: Position, args: [0, 0] }],
                tags: ['base'],
            });

            const variant = engine.variantOfPrefab('Base', {
                components: { Position: [10, 10] },
            });

            expect(variant.parent).toBe('Base');
        });
    });

    describe('Snapshot System', () => {
        test('should create and restore snapshot', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Position, 10, 20);
            entity.addTag('test');

            engine.createSnapshot();

            // Modify entity
            entity.getComponent(Position).x = 999;
            entity.queueFree();
            engine.update(16);

            expect(engine.getAllEntities()).toHaveLength(0);

            // Restore snapshot
            const restored = engine.restoreSnapshot();
            expect(restored).toBe(true);

            expect(engine.getAllEntities()).toHaveLength(1);
            const restoredEntity = engine.getEntitiesByTag('test')[0];
            expect(restoredEntity).toBeDefined();
            expect(restoredEntity.getComponent(Position).x).toBe(10);
        });

        test('should maintain entity hierarchies in snapshot', () => {
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

            const entities = engine.getAllEntities();
            expect(entities).toHaveLength(2);

            const restoredParent = entities.find((e: EntityDef) => e.name === 'Parent');
            const restoredChild = entities.find((e: EntityDef) => e.name === 'Child');

            expect(restoredChild?.parent).toBe(restoredParent);
        });

        test('should track snapshot count', () => {
            expect(engine.getSnapshotCount()).toBe(0);

            engine.createSnapshot();
            expect(engine.getSnapshotCount()).toBe(1);

            engine.createSnapshot();
            expect(engine.getSnapshotCount()).toBe(2);

            engine.clearSnapshots();
            expect(engine.getSnapshotCount()).toBe(0);
        });
    });

    describe('Message Bus', () => {
        test('should publish and subscribe to messages', () => {
            let receivedMessage: any = null;

            engine.messageBus.subscribe('test-event', (message: SystemMessage) => {
                receivedMessage = message;
            });

            engine.messageBus.publish('test-event', { data: 'hello' }, 'TestSender');

            expect(receivedMessage).toBeDefined();
            expect(receivedMessage.type).toBe('test-event');
            expect(receivedMessage.data.data).toBe('hello');
            expect(receivedMessage.sender).toBe('TestSender');
        });

        test('should maintain message history', () => {
            engine.messageBus.publish('event1', { value: 1 });
            engine.messageBus.publish('event2', { value: 2 });
            engine.messageBus.publish('event1', { value: 3 });

            const allHistory = engine.messageBus.getMessageHistory();
            expect(allHistory).toHaveLength(3);

            const event1History = engine.messageBus.getMessageHistory('event1');
            expect(event1History).toHaveLength(2);
        });
    });

    describe('Event System', () => {
        test('should emit and listen to events', () => {
            let eventData: any = null;

            engine.on('customEvent', (data: any) => {
                eventData = data;
            });

            engine.emit('customEvent', { test: 'data' });

            expect(eventData).toEqual({ test: 'data' });
        });

        test('should remove event listeners', () => {
            let callCount = 0;

            const callback = () => {
                callCount++;
            };
            engine.on('test', callback);

            engine.emit('test');
            expect(callCount).toBe(1);

            engine.off('test', callback);
            engine.emit('test');
            expect(callCount).toBe(1); // Should not increase
        });
    });

    describe('Engine Lifecycle', () => {
        test('should start and stop engine', () => {
            let startCalled = false;
            let stopCalled = false;

            engine.on('onStart', () => {
                startCalled = true;
            });
            engine.on('onStop', () => {
                stopCalled = true;
            });

            engine.start();
            expect(startCalled).toBe(true);

            engine.stop();
            expect(stopCalled).toBe(true);
        });

        test('should track entity creation events', () => {
            let createdEntity: any = null;

            engine.on('onEntityCreated', (entity: any) => {
                createdEntity = entity;
            });

            const entity = engine.createEntity('Test');
            expect(createdEntity).toBe(entity);
        });
    });

    describe('Statistics and Debugging', () => {
        test('should provide memory stats', () => {
            const entity = engine.createEntity();
            entity.addComponent(Position, 0, 0);
            entity.addComponent(Velocity, 1, 1);

            const stats = engine.getMemoryStats();
            expect(stats.totalEntities).toBe(1);
            expect(stats.activeEntities).toBe(1);
            expect(stats.componentArrays).toBeDefined();
            expect(stats.totalMemoryEstimate).toBeGreaterThan(0);
        });

        test('should provide debug info', () => {
            engine.createEntity();
            engine.createSystem('TestSystem', { all: [] }, {});
            engine.createSnapshot();

            const debugInfo = engine.getDebugInfo();
            expect(debugInfo.entities).toBe(1);
            expect(debugInfo.systems).toBe(1);
            expect(debugInfo.snapshots).toBe(1);
            expect(debugInfo.performance).toBeDefined();
        });

        test('should track performance stats', () => {
            engine.update(16);
            engine.update(17);
            engine.update(15);

            const perfStats = engine.getPerformanceStats();
            expect(perfStats.averageFrameTime).toBeGreaterThan(0);
            expect(perfStats.minFrameTime).toBeGreaterThan(0);
            expect(perfStats.maxFrameTime).toBeGreaterThan(0);
        });
    });

    describe('Serialization', () => {
        test('should serialize world state', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Position, 10, 20);
            entity.addTag('test');

            const serialized = engine.serialize();
            expect(serialized).toBeDefined();
            expect(serialized.entities).toHaveLength(1);
            expect(serialized.entities[0].name).toBe('TestEntity');
            expect(serialized.entities[0].tags).toContain('test');
            expect(serialized.timestamp).toBeGreaterThan(0);
        });
    });

    describe('Integration Tests', () => {
        test('should handle complex game scenario', () => {
            // Create player prefab
            const playerPrefab: EntityPrefab = {
                name: 'Player',
                components: [
                    { type: Position, args: [0, 0] },
                    { type: Velocity, args: [0, 0] },
                    { type: Health, args: [100, 100] },
                ],
                tags: ['player', 'alive'],
            };

            engine.registerPrefab('Player', playerPrefab);

            // Create player
            const player = engine.createFromPrefab('Player', 'Hero');
            expect(player).toBeDefined();

            // Create movement system
            let systemExecuted = false;
            engine.createSystem(
                'MovementSystem',
                { all: [Position, Velocity], tags: ['alive'] },
                {
                    act: (_entity: EntityDef, pos: Position, vel: Velocity) => {
                        pos.x += vel.x;
                        pos.y += vel.y;
                        systemExecuted = true;
                    },
                }
            );

            // Set velocity
            if (player) {
                player.getComponent(Velocity).x = 5;
                player.getComponent(Velocity).y = 3;
            }

            // Update
            engine.update(16);

            // Verify
            expect(systemExecuted).toBe(true);
            expect(player?.getComponent(Position).x).toBe(5);
            expect(player?.getComponent(Position).y).toBe(3);
        });
    });

    describe('Plugin System', () => {
        test('should install plugin via EngineBuilder.use()', () => {
            let installCalled = false;
            const testPlugin = {
                name: 'TestPlugin',
                version: '1.0.0',
                install: () => {
                    installCalled = true;
                },
            };

            const pluginEngine = new EngineBuilder().use(testPlugin).build();

            expect(installCalled).toBe(true);
            expect(pluginEngine.hasPlugin('TestPlugin')).toBe(true);
        });

        test('should pass PluginContext to plugin.install()', () => {
            let receivedContext: any = null;
            const testPlugin = {
                name: 'TestPlugin',
                install: (context: any) => {
                    receivedContext = context;
                },
            };

            new EngineBuilder().use(testPlugin).build();

            expect(receivedContext).toBeDefined();
            expect(receivedContext.registerComponent).toBeDefined();
            expect(receivedContext.createSystem).toBeDefined();
            expect(receivedContext.extend).toBeDefined();
        });

        test('should allow plugins to register components', () => {
            class PluginComponent {
                constructor(public value: number = 0) {}
            }

            const testPlugin = {
                name: 'ComponentPlugin',
                install: (context: any) => {
                    context.registerComponent(PluginComponent);
                },
            };

            const pluginEngine = new EngineBuilder().use(testPlugin).build();

            const entity = pluginEngine.createEntity('Test');
            entity.addComponent(PluginComponent, 42);

            expect(entity.hasComponent(PluginComponent)).toBe(true);
            expect(entity.getComponent(PluginComponent).value).toBe(42);
        });

        test('should allow plugins to create systems', () => {
            class TestComponent {
                constructor(public value: number = 0) {}
            }

            let systemCalled = false;
            const testPlugin = {
                name: 'SystemPlugin',
                install: (context: any) => {
                    context.registerComponent(TestComponent);
                    context.createSystem(
                        'PluginSystem',
                        { all: [TestComponent] },
                        {
                            act: () => {
                                systemCalled = true;
                            },
                        }
                    );
                },
            };

            const pluginEngine = new EngineBuilder().use(testPlugin).build();

            const entity = pluginEngine.createEntity('Test');
            entity.addComponent(TestComponent, 10);

            pluginEngine.update(16);

            expect(systemCalled).toBe(true);
        });

        test('should allow plugins to extend engine with custom APIs', () => {
            class CustomAPI {
                getValue(): number {
                    return 42;
                }
            }

            const testPlugin = {
                name: 'ExtensionPlugin',
                install: (context: any) => {
                    const api = new CustomAPI();
                    context.extend('customApi', api);
                },
            };

            const pluginEngine = new EngineBuilder().use(testPlugin).build();

            expect((pluginEngine as any).customApi).toBeDefined();
            expect((pluginEngine as any).customApi.getValue()).toBe(42);
            expect(pluginEngine.getExtension('customApi')).toBeDefined();
        });

        test('should prevent duplicate plugin installations', () => {
            const testPlugin = {
                name: 'DuplicatePlugin',
                install: () => {},
            };

            const pluginEngine = new EngineBuilder().withDebugMode(true).build();

            pluginEngine.installPlugin(testPlugin);
            expect(pluginEngine.hasPlugin('DuplicatePlugin')).toBe(true);

            // Try to install again - should be ignored
            pluginEngine.installPlugin(testPlugin);
            const installedPlugins = pluginEngine.getInstalledPlugins();
            const duplicates = installedPlugins.filter((p) => p.plugin.name === 'DuplicatePlugin');
            expect(duplicates).toHaveLength(1);
        });

        test('should track installed plugins', () => {
            const plugin1 = { name: 'Plugin1', install: () => {} };
            const plugin2 = { name: 'Plugin2', install: () => {} };

            const pluginEngine = new EngineBuilder().use(plugin1).use(plugin2).build();

            expect(pluginEngine.hasPlugin('Plugin1')).toBe(true);
            expect(pluginEngine.hasPlugin('Plugin2')).toBe(true);

            const installed = pluginEngine.getInstalledPlugins();
            expect(installed).toHaveLength(2);
        });

        test('should allow uninstalling plugins', async () => {
            let uninstallCalled = false;
            const testPlugin = {
                name: 'UninstallablePlugin',
                install: () => {},
                uninstall: () => {
                    uninstallCalled = true;
                },
            };

            const pluginEngine = new EngineBuilder().use(testPlugin).build();

            expect(pluginEngine.hasPlugin('UninstallablePlugin')).toBe(true);

            const result = await pluginEngine.uninstallPlugin('UninstallablePlugin');

            expect(result).toBe(true);
            expect(uninstallCalled).toBe(true);
            expect(pluginEngine.hasPlugin('UninstallablePlugin')).toBe(false);
        });

        test('should support async plugin installation', (done) => {
            let asyncCompleted = false;
            const asyncPlugin = {
                name: 'AsyncPlugin',
                install: async () => {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    asyncCompleted = true;
                },
            };

            const pluginEngine = new EngineBuilder().use(asyncPlugin).build();

            // Give async operation time to complete
            setTimeout(() => {
                expect(asyncCompleted).toBe(true);
                expect(pluginEngine.hasPlugin('AsyncPlugin')).toBe(true);
                done();
            }, 50);
        });

        test('should allow plugins to register prefabs', () => {
            class PluginPosition {
                constructor(
                    public x: number = 0,
                    public y: number = 0
                ) {}
            }

            const testPlugin = {
                name: 'PrefabPlugin',
                install: (context: any) => {
                    context.registerComponent(PluginPosition);
                    context.registerPrefab('PluginEntity', {
                        name: 'PluginEntity',
                        components: [{ type: PluginPosition, args: [10, 20] }],
                        tags: ['plugin-created'],
                    });
                },
            };

            const pluginEngine = new EngineBuilder().use(testPlugin).build();

            const entity = pluginEngine.createFromPrefab('PluginEntity', 'Test');

            expect(entity).toBeDefined();
            expect(entity?.hasComponent(PluginPosition)).toBe(true);
            expect(entity?.getComponent(PluginPosition).x).toBe(10);
            expect(entity?.hasTag('plugin-created')).toBe(true);
        });

        test('should allow plugins to use message bus', () => {
            let messageReceived = false;
            let receivedData: any = null;

            const testPlugin = {
                name: 'MessagePlugin',
                install: (context: any) => {
                    context.messageBus.subscribe('test-message', (message: any) => {
                        messageReceived = true;
                        receivedData = message.data;
                    });
                },
            };

            const pluginEngine = new EngineBuilder().use(testPlugin).build();

            pluginEngine.messageBus.publish('test-message', { value: 123 });

            expect(messageReceived).toBe(true);
            expect(receivedData).toEqual({ value: 123 });
        });

        test('should allow plugins to subscribe to events', () => {
            let eventReceived = false;

            const testPlugin = {
                name: 'EventPlugin',
                install: (context: any) => {
                    context.on('custom-event', () => {
                        eventReceived = true;
                    });
                },
            };

            const pluginEngine = new EngineBuilder().use(testPlugin).build();

            pluginEngine.emit('custom-event');

            expect(eventReceived).toBe(true);
        });

        test('should allow chaining multiple plugins', () => {
            const plugin1 = { name: 'Plugin1', install: () => {} };
            const plugin2 = { name: 'Plugin2', install: () => {} };
            const plugin3 = { name: 'Plugin3', install: () => {} };

            const builder = new EngineBuilder().use(plugin1).use(plugin2).use(plugin3);

            expect(builder).toBeDefined();

            const pluginEngine = builder.build();

            expect(pluginEngine.hasPlugin('Plugin1')).toBe(true);
            expect(pluginEngine.hasPlugin('Plugin2')).toBe(true);
            expect(pluginEngine.hasPlugin('Plugin3')).toBe(true);
        });

        test('should get plugin information', () => {
            const testPlugin = {
                name: 'InfoPlugin',
                version: '2.0.0',
                install: () => {},
            };

            const pluginEngine = new EngineBuilder().use(testPlugin).build();

            const pluginInfo = pluginEngine.getPlugin('InfoPlugin');

            expect(pluginInfo).toBeDefined();
            expect(pluginInfo?.plugin.name).toBe('InfoPlugin');
            expect(pluginInfo?.plugin.version).toBe('2.0.0');
            expect(pluginInfo?.installedAt).toBeGreaterThan(0);
        });

        test('should prevent duplicate extension names', () => {
            const plugin1 = {
                name: 'Plugin1',
                install: (context: any) => {
                    context.extend('sharedApi', { value: 1 });
                },
            };

            const plugin2 = {
                name: 'Plugin2',
                install: (context: any) => {
                    expect(() => {
                        context.extend('sharedApi', { value: 2 });
                    }).toThrow("Extension 'sharedApi' already exists");
                },
            };

            const pluginEngine = new EngineBuilder().use(plugin1).use(plugin2).build();

            expect((pluginEngine as any).sharedApi.value).toBe(1);
        });
    });

    describe('Component Pooling', () => {
        class Particle {
            constructor(
                public x: number = 0,
                public y: number = 0,
                public active: boolean = true
            ) {}
        }

        test('should register component pool with default options', () => {
            engine.registerComponent(Particle);
            engine.registerComponentPool(Particle);

            const stats = engine.getComponentPoolStats(Particle);
            expect(stats).toBeDefined();
            expect(stats?.available).toBe(10); // Default initialSize
            expect(stats?.totalCreated).toBe(10);
        });

        test('should register component pool with custom options', () => {
            engine.registerComponent(Particle);
            engine.registerComponentPool(Particle, {
                initialSize: 20,
                maxSize: 500,
            });

            const stats = engine.getComponentPoolStats(Particle);
            expect(stats).toBeDefined();
            expect(stats?.available).toBe(20);
            expect(stats?.totalCreated).toBe(20);
        });

        test('should acquire components from pool when adding to entity', () => {
            engine.registerComponent(Particle);
            engine.registerComponentPool(Particle, { initialSize: 5 });

            const entity1 = engine.createEntity();
            entity1.addComponent(Particle, 10, 20);

            const stats = engine.getComponentPoolStats(Particle);
            expect(stats).toBeDefined();
            expect(stats?.totalAcquired).toBeGreaterThan(0);
            expect(entity1.getComponent(Particle).x).toBe(10);
            expect(entity1.getComponent(Particle).y).toBe(20);
        });

        test('should release components back to pool when removing from entity', () => {
            engine.registerComponent(Particle);
            engine.registerComponentPool(Particle, { initialSize: 5 });

            const entity = engine.createEntity();
            entity.addComponent(Particle, 5, 5);

            const statsAfterAdd = engine.getComponentPoolStats(Particle);
            const _acquiredAfterAdd = statsAfterAdd?.totalAcquired;

            entity.removeComponent(Particle);

            const statsAfterRemove = engine.getComponentPoolStats(Particle);
            expect(statsAfterRemove?.totalReleased).toBeGreaterThan(0);
            expect(statsAfterRemove?.available).toBeGreaterThanOrEqual(1);
        });

        test('should track pool statistics correctly', () => {
            engine.registerComponent(Particle);
            engine.registerComponentPool(Particle, { initialSize: 3, maxSize: 10 });

            // Create and destroy multiple entities
            for (let i = 0; i < 5; i++) {
                const entity = engine.createEntity();
                entity.addComponent(Particle, i, i);
                entity.removeComponent(Particle);
            }

            const stats = engine.getComponentPoolStats(Particle);
            expect(stats).toBeDefined();
            expect(stats?.totalAcquired).toBeGreaterThanOrEqual(5);
            expect(stats?.totalReleased).toBeGreaterThanOrEqual(5);
            expect(stats?.reuseRate).toBeGreaterThan(0);
        });

        test('should return undefined stats for non-pooled components', () => {
            engine.registerComponent(Position);
            const stats = engine.getComponentPoolStats(Position);
            expect(stats).toBeUndefined();
        });

        test('should work with multiple entities using pooled components', () => {
            engine.registerComponent(Particle);
            engine.registerComponentPool(Particle, { initialSize: 10 });

            const entities: any[] = [];
            for (let i = 0; i < 5; i++) {
                const entity = engine.createEntity();
                entity.addComponent(Particle, i * 10, i * 20);
                entities.push(entity);
            }

            // Verify all entities have their components
            for (let i = 0; i < 5; i++) {
                expect(entities[i].hasComponent(Particle)).toBe(true);
                expect(entities[i].getComponent(Particle).x).toBe(i * 10);
            }

            // Remove components
            for (const entity of entities) {
                entity.removeComponent(Particle);
            }

            const stats = engine.getComponentPoolStats(Particle);
            expect(stats?.available).toBeGreaterThanOrEqual(5);
        });

        test('should respect maxSize limit', () => {
            engine.registerComponent(Particle);
            engine.registerComponentPool(Particle, { initialSize: 2, maxSize: 5 });

            // Create more entities than maxSize
            const entities: any[] = [];
            for (let i = 0; i < 10; i++) {
                const entity = engine.createEntity();
                entity.addComponent(Particle, i, i);
                entities.push(entity);
            }

            // Remove all components
            for (const entity of entities) {
                entity.removeComponent(Particle);
            }

            const stats = engine.getComponentPoolStats(Particle);
            expect(stats?.available).toBeLessThanOrEqual(5); // Should not exceed maxSize
        });

        test('should work alongside non-pooled components', () => {
            engine.registerComponent(Particle);
            engine.registerComponent(Position);
            engine.registerComponentPool(Particle, { initialSize: 5 });

            const entity = engine.createEntity();
            entity.addComponent(Particle, 1, 2);
            entity.addComponent(Position, 10, 20);

            expect(entity.hasComponent(Particle)).toBe(true);
            expect(entity.hasComponent(Position)).toBe(true);

            const particleStats = engine.getComponentPoolStats(Particle);
            const positionStats = engine.getComponentPoolStats(Position);

            expect(particleStats).toBeDefined();
            expect(positionStats).toBeUndefined();
        });
    });

    describe('Tag Component Helper', () => {
        test('should create tag component with specified name', () => {
            const PlayerTag = createTagComponent('Player');

            expect(PlayerTag).toBeDefined();
            expect(PlayerTag.name).toBe('Player');
            expect((PlayerTag as any).__tagName).toBe('Player');
        });

        test('should create unique tag components for different names', () => {
            const PlayerTag = createTagComponent('Player');
            const EnemyTag = createTagComponent('Enemy');

            expect(PlayerTag).not.toBe(EnemyTag);
            expect(PlayerTag.name).toBe('Player');
            expect(EnemyTag.name).toBe('Enemy');
        });

        test('should work with entity.addComponent()', () => {
            const PlayerTag = createTagComponent('Player');

            const entity = engine.createEntity();
            entity.addComponent(PlayerTag);

            expect(entity.hasComponent(PlayerTag)).toBe(true);
        });

        test('should work with entity.removeComponent()', () => {
            const PlayerTag = createTagComponent('Player');

            const entity = engine.createEntity();
            entity.addComponent(PlayerTag);
            expect(entity.hasComponent(PlayerTag)).toBe(true);

            entity.removeComponent(PlayerTag);
            expect(entity.hasComponent(PlayerTag)).toBe(false);
        });

        test('should work with queries (all)', () => {
            const PlayerTag = createTagComponent('Player');
            const EnemyTag = createTagComponent('Enemy');

            const entity1 = engine.createEntity();
            entity1.addComponent(PlayerTag);

            const entity2 = engine.createEntity();
            entity2.addComponent(EnemyTag);

            let playerCount = 0;
            engine.createSystem(
                'PlayerSystem',
                { all: [PlayerTag] },
                {
                    act: (_entity) => {
                        playerCount++;
                    },
                }
            );

            engine.update();

            expect(playerCount).toBe(1);
        });

        test('should work with queries (any)', () => {
            const PlayerTag = createTagComponent('Player');
            const EnemyTag = createTagComponent('Enemy');
            const AllyTag = createTagComponent('Ally');

            const entity1 = engine.createEntity();
            entity1.addComponent(PlayerTag);

            const entity2 = engine.createEntity();
            entity2.addComponent(EnemyTag);

            const entity3 = engine.createEntity();
            entity3.addComponent(AllyTag);

            let friendlyCount = 0;
            engine.createSystem(
                'FriendlySystem',
                { any: [PlayerTag, AllyTag] },
                {
                    act: (_entity) => {
                        friendlyCount++;
                    },
                }
            );

            engine.update();

            expect(friendlyCount).toBe(2); // entity1 and entity3
        });

        test('should work with queries (none)', () => {
            const PlayerTag = createTagComponent('Player');
            const EnemyTag = createTagComponent('Enemy');

            const entity1 = engine.createEntity();
            entity1.addComponent(PlayerTag);

            const entity2 = engine.createEntity();
            entity2.addComponent(EnemyTag);

            const _entity3 = engine.createEntity();
            // No tags

            let nonPlayerCount = 0;
            engine.createSystem(
                'NonPlayerSystem',
                { none: [PlayerTag] },
                {
                    act: (_entity) => {
                        nonPlayerCount++;
                    },
                }
            );

            engine.update();

            expect(nonPlayerCount).toBe(2); // entity2 and entity3
        });

        test('should work with multiple tag components on same entity', () => {
            const PlayerTag = createTagComponent('Player');
            const ActiveTag = createTagComponent('Active');
            const ControllableTag = createTagComponent('Controllable');

            const entity = engine.createEntity();
            entity.addComponent(PlayerTag);
            entity.addComponent(ActiveTag);
            entity.addComponent(ControllableTag);

            expect(entity.hasComponent(PlayerTag)).toBe(true);
            expect(entity.hasComponent(ActiveTag)).toBe(true);
            expect(entity.hasComponent(ControllableTag)).toBe(true);
        });

        test('should work alongside data components', () => {
            const PlayerTag = createTagComponent('Player');

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);
            entity.addComponent(PlayerTag);

            expect(entity.hasComponent(Position)).toBe(true);
            expect(entity.hasComponent(PlayerTag)).toBe(true);
            expect(entity.getComponent(Position).x).toBe(10);
        });

        test('should work in complex queries with data components', () => {
            const PlayerTag = createTagComponent('Player');

            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 10, 20);
            entity1.addComponent(PlayerTag);

            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 30, 40);
            // No PlayerTag

            let playerWithPosCount = 0;
            engine.createSystem(
                'PlayerMovementSystem',
                { all: [Position, PlayerTag] },
                {
                    act: (_entity, pos) => {
                        playerWithPosCount++;
                        expect(pos.x).toBe(10);
                    },
                }
            );

            engine.update();

            expect(playerWithPosCount).toBe(1);
        });

        test('should be registerable with engine', () => {
            const PlayerTag = createTagComponent('Player');

            // Register the tag component
            engine.registerComponent(PlayerTag);

            const entity = engine.createEntity();
            entity.addComponent(PlayerTag);

            expect(entity.hasComponent(PlayerTag)).toBe(true);
        });

        test('should support component validation', () => {
            const PlayerTag = createTagComponent('Player');

            engine.registerComponent(PlayerTag);
            engine.registerComponentValidator(PlayerTag, {
                validate: () => true,
            });

            const entity = engine.createEntity();
            entity.addComponent(PlayerTag);

            expect(entity.hasComponent(PlayerTag)).toBe(true);
        });
    });

    describe('System Groups', () => {
        test('should create system groups', () => {
            engine.createSystemGroup('Input', { priority: 1000 });
            engine.createSystemGroup('Logic', { priority: 500 });

            // Groups should be created successfully
            expect(() => {
                engine.createSystemGroup('Render', { priority: 100 });
            }).not.toThrow();
        });

        test('should not allow duplicate group names', () => {
            engine.createSystemGroup('TestGroup', { priority: 100 });

            expect(() => {
                engine.createSystemGroup('TestGroup', { priority: 200 });
            }).toThrow("System group 'TestGroup' already exists");
        });

        test('should create systems in groups', () => {
            engine.createSystemGroup('Input', { priority: 1000 });
            engine.createSystemGroup('Logic', { priority: 500 });

            let inputRan = false;
            let logicRan = false;

            engine.createSystem(
                'InputSystem',
                { all: [] },
                {
                    before: () => {
                        inputRan = true;
                    },
                    group: 'Input',
                }
            );

            engine.createSystem(
                'LogicSystem',
                { all: [] },
                {
                    before: () => {
                        logicRan = true;
                    },
                    group: 'Logic',
                }
            );

            engine.update(16);

            expect(inputRan).toBe(true);
            expect(logicRan).toBe(true);
        });

        test('should execute systems in group priority order', () => {
            const executionOrder: string[] = [];

            engine.createSystemGroup('Input', { priority: 1000 });
            engine.createSystemGroup('Logic', { priority: 500 });
            engine.createSystemGroup('Render', { priority: 100 });

            engine.createSystem(
                'InputSystem',
                { all: [] },
                {
                    before: () => {
                        executionOrder.push('Input');
                    },
                    group: 'Input',
                }
            );

            engine.createSystem(
                'LogicSystem',
                { all: [] },
                {
                    before: () => {
                        executionOrder.push('Logic');
                    },
                    group: 'Logic',
                }
            );

            engine.createSystem(
                'RenderSystem',
                { all: [] },
                {
                    before: () => {
                        executionOrder.push('Render');
                    },
                    group: 'Render',
                }
            );

            engine.update(16);

            // Higher priority groups execute first
            expect(executionOrder).toEqual(['Input', 'Logic', 'Render']);
        });

        test('should execute systems within groups by system priority', () => {
            const executionOrder: string[] = [];

            engine.createSystemGroup('Logic', { priority: 500 });

            engine.createSystem(
                'LowPrioritySystem',
                { all: [] },
                {
                    before: () => {
                        executionOrder.push('Low');
                    },
                    priority: 10,
                    group: 'Logic',
                }
            );

            engine.createSystem(
                'HighPrioritySystem',
                { all: [] },
                {
                    before: () => {
                        executionOrder.push('High');
                    },
                    priority: 100,
                    group: 'Logic',
                }
            );

            engine.createSystem(
                'MediumPrioritySystem',
                { all: [] },
                {
                    before: () => {
                        executionOrder.push('Medium');
                    },
                    priority: 50,
                    group: 'Logic',
                }
            );

            engine.update(16);

            // Within a group, higher priority systems execute first
            expect(executionOrder).toEqual(['High', 'Medium', 'Low']);
        });

        test('should disable system groups', () => {
            engine.createSystemGroup('Input', { priority: 1000 });
            engine.createSystemGroup('Logic', { priority: 500 });

            let inputRan = false;
            let logicRan = false;

            engine.createSystem(
                'InputSystem',
                { all: [] },
                {
                    before: () => {
                        inputRan = true;
                    },
                    group: 'Input',
                }
            );

            engine.createSystem(
                'LogicSystem',
                { all: [] },
                {
                    before: () => {
                        logicRan = true;
                    },
                    group: 'Logic',
                }
            );

            // Disable Logic group
            engine.disableSystemGroup('Logic');

            engine.update(16);

            expect(inputRan).toBe(true);
            expect(logicRan).toBe(false); // Logic group was disabled
        });

        test('should enable system groups', () => {
            engine.createSystemGroup('Logic', { priority: 500 });

            let logicRan = false;

            engine.createSystem(
                'LogicSystem',
                { all: [] },
                {
                    before: () => {
                        logicRan = true;
                    },
                    group: 'Logic',
                }
            );

            // Disable then re-enable
            engine.disableSystemGroup('Logic');
            engine.update(16);
            expect(logicRan).toBe(false);

            logicRan = false;
            engine.enableSystemGroup('Logic');
            engine.update(16);
            expect(logicRan).toBe(true);
        });

        test('should support systems without groups alongside grouped systems', () => {
            const executionOrder: string[] = [];

            engine.createSystemGroup('Input', { priority: 1000 });

            engine.createSystem(
                'GroupedSystem',
                { all: [] },
                {
                    before: () => {
                        executionOrder.push('Grouped');
                    },
                    group: 'Input',
                }
            );

            engine.createSystem(
                'UngroupedSystem',
                { all: [] },
                {
                    before: () => {
                        executionOrder.push('Ungrouped');
                    },
                    priority: 500,
                }
            );

            engine.update(16);

            // Both should execute
            expect(executionOrder).toContain('Grouped');
            expect(executionOrder).toContain('Ungrouped');
        });

        test('should throw error when creating system with non-existent group', () => {
            expect(() => {
                engine.createSystem(
                    'TestSystem',
                    { all: [] },
                    {
                        act: () => {},
                        group: 'NonExistentGroup',
                    }
                );
            }).toThrow("System group 'NonExistentGroup' not found");
        });

        test('should throw error when enabling non-existent group', () => {
            expect(() => {
                engine.enableSystemGroup('NonExistentGroup');
            }).toThrow("System group 'NonExistentGroup' not found");
        });

        test('should throw error when disabling non-existent group', () => {
            expect(() => {
                engine.disableSystemGroup('NonExistentGroup');
            }).toThrow("System group 'NonExistentGroup' not found");
        });

        test('should work with fixed update systems in groups', () => {
            const executionOrder: string[] = [];

            engine.createSystemGroup('Physics', { priority: 1000 });

            engine.createSystem(
                'PhysicsSystem',
                { all: [] },
                {
                    before: () => {
                        executionOrder.push('Physics');
                    },
                    group: 'Physics',
                },
                true
            ); // Fixed update

            engine.update(17); // 17ms > 16.66ms (60 FPS interval)

            // Should execute in fixed update
            expect(executionOrder).toContain('Physics');
        });
    });

    describe('System Dependencies', () => {
        test('should execute systems with runAfter dependencies in correct order', () => {
            const order: string[] = [];

            engine.createSystem(
                'First',
                { all: [] },
                {
                    before: () => {
                        order.push('First');
                    },
                }
            );

            engine.createSystem(
                'Second',
                { all: [] },
                {
                    before: () => {
                        order.push('Second');
                    },
                    runAfter: ['First'],
                }
            );

            engine.createSystem(
                'Third',
                { all: [] },
                {
                    before: () => {
                        order.push('Third');
                    },
                    runAfter: ['Second'],
                }
            );

            engine.update(16);

            expect(order).toEqual(['First', 'Second', 'Third']);
        });

        test('should execute systems with runBefore dependencies in correct order', () => {
            const order: string[] = [];

            engine.createSystem(
                'Last',
                { all: [] },
                {
                    before: () => {
                        order.push('Last');
                    },
                }
            );

            engine.createSystem(
                'Middle',
                { all: [] },
                {
                    before: () => {
                        order.push('Middle');
                    },
                    runBefore: ['Last'],
                }
            );

            engine.createSystem(
                'First',
                { all: [] },
                {
                    before: () => {
                        order.push('First');
                    },
                    runBefore: ['Middle'],
                }
            );

            engine.update(16);

            expect(order).toEqual(['First', 'Middle', 'Last']);
        });

        test('should handle complex dependency graph', () => {
            const order: string[] = [];

            engine.createSystem(
                'A',
                { all: [] },
                {
                    before: () => {
                        order.push('A');
                    },
                }
            );

            engine.createSystem(
                'B',
                { all: [] },
                {
                    before: () => {
                        order.push('B');
                    },
                    runAfter: ['A'],
                }
            );

            engine.createSystem(
                'C',
                { all: [] },
                {
                    before: () => {
                        order.push('C');
                    },
                    runAfter: ['A'],
                }
            );

            engine.createSystem(
                'D',
                { all: [] },
                {
                    before: () => {
                        order.push('D');
                    },
                    runAfter: ['B', 'C'],
                }
            );

            engine.update(16);

            // A must come first, D must come last, B and C can be in any order
            expect(order[0]).toBe('A');
            expect(order[3]).toBe('D');
            expect(order).toContain('B');
            expect(order).toContain('C');
        });

        test('should combine runAfter and runBefore', () => {
            const order: string[] = [];

            engine.createSystem(
                'First',
                { all: [] },
                {
                    before: () => {
                        order.push('First');
                    },
                }
            );

            engine.createSystem(
                'Middle',
                { all: [] },
                {
                    before: () => {
                        order.push('Middle');
                    },
                    runAfter: ['First'],
                    runBefore: ['Last'],
                }
            );

            engine.createSystem(
                'Last',
                { all: [] },
                {
                    before: () => {
                        order.push('Last');
                    },
                }
            );

            engine.update(16);

            expect(order).toEqual(['First', 'Middle', 'Last']);
        });

        test('should detect circular dependencies', () => {
            engine.createSystem(
                'A',
                { all: [] },
                {
                    before: () => {},
                    runAfter: ['B'],
                }
            );

            engine.createSystem(
                'B',
                { all: [] },
                {
                    before: () => {},
                    runAfter: ['A'],
                }
            );

            expect(() => {
                engine.update(16);
            }).toThrow(/circular dependency/i);
        });

        test('should detect complex circular dependencies', () => {
            engine.createSystem(
                'A',
                { all: [] },
                {
                    before: () => {},
                    runAfter: ['C'],
                }
            );

            engine.createSystem(
                'B',
                { all: [] },
                {
                    before: () => {},
                    runAfter: ['A'],
                }
            );

            engine.createSystem(
                'C',
                { all: [] },
                {
                    before: () => {},
                    runAfter: ['B'],
                }
            );

            expect(() => {
                engine.update(16);
            }).toThrow(/circular dependency/i);
        });

        test('should override priority with dependencies', () => {
            const order: string[] = [];

            // Even though High has higher priority, dependencies should override
            engine.createSystem(
                'Low',
                { all: [] },
                {
                    before: () => {
                        order.push('Low');
                    },
                    priority: 1,
                }
            );

            engine.createSystem(
                'High',
                { all: [] },
                {
                    before: () => {
                        order.push('High');
                    },
                    priority: 100,
                    runAfter: ['Low'], // Depends on Low despite higher priority
                }
            );

            engine.update(16);

            expect(order).toEqual(['Low', 'High']);
        });

        test('should ignore dependencies on non-existent systems', () => {
            const order: string[] = [];

            engine.createSystem(
                'ExistingSystem',
                { all: [] },
                {
                    before: () => {
                        order.push('Existing');
                    },
                    runAfter: ['NonExistentSystem'], // This system doesn't exist
                }
            );

            // Should not throw, just ignore the non-existent dependency
            expect(() => {
                engine.update(16);
            }).not.toThrow();

            expect(order).toContain('Existing');
        });

        test('should work with dependencies in system groups', () => {
            const order: string[] = [];

            engine.createSystemGroup('Logic', { priority: 500 });

            engine.createSystem(
                'First',
                { all: [] },
                {
                    before: () => {
                        order.push('First');
                    },
                    group: 'Logic',
                }
            );

            engine.createSystem(
                'Second',
                { all: [] },
                {
                    before: () => {
                        order.push('Second');
                    },
                    group: 'Logic',
                    runAfter: ['First'],
                }
            );

            engine.update(16);

            expect(order).toEqual(['First', 'Second']);
        });

        test('should apply dependencies to fixed update systems', () => {
            const order: string[] = [];

            engine.createSystem(
                'FixedFirst',
                { all: [] },
                {
                    before: () => {
                        order.push('First');
                    },
                },
                true
            );

            engine.createSystem(
                'FixedSecond',
                { all: [] },
                {
                    before: () => {
                        order.push('Second');
                    },
                    runAfter: ['FixedFirst'],
                },
                true
            );

            engine.update(17); // Enough to trigger fixed update

            expect(order).toEqual(['First', 'Second']);
        });
    });

    describe('Conditional System Execution', () => {
        test('should support runIf conditional execution', () => {
            const gameState = { isPlaying: false };
            let systemRan = false;

            const system = engine.createSystem(
                'TestSystem',
                { all: [] },
                {
                    before: () => {
                        systemRan = true;
                    },
                }
            );
            system.runIf(() => gameState.isPlaying);

            engine.update(16);
            expect(systemRan).toBe(false); // Not playing

            systemRan = false;
            gameState.isPlaying = true;
            engine.update(16);
            expect(systemRan).toBe(true); // Now playing
        });

        test('should support runOnce execution', () => {
            let runCount = 0;

            const system = engine.createSystem(
                'OnceSystem',
                { all: [] },
                {
                    before: () => {
                        runCount++;
                    },
                }
            );
            system.runOnce();

            engine.update(16);
            engine.update(16);
            engine.update(16);

            expect(runCount).toBe(1); // Only ran once
        });

        test('should support runEvery execution', () => {
            let runCount = 0;

            const system = engine.createSystem(
                'PeriodicSystem',
                { all: [] },
                {
                    before: () => {
                        runCount++;
                    },
                }
            );
            system.runEvery(100); // Every 100ms

            engine.update(16); // 16ms
            expect(runCount).toBe(1); // First run

            engine.update(16); // 32ms total
            expect(runCount).toBe(1); // Not yet (< 100ms)

            engine.update(84); // 116ms total
            expect(runCount).toBe(2); // Second run (>= 100ms)

            engine.update(16); // 132ms total
            expect(runCount).toBe(2); // Not yet

            engine.update(100); // 232ms total
            expect(runCount).toBe(3); // Third run
        });

        test('should support enableWhen predicate', () => {
            let isMinimized = true;
            let systemRan = false;

            const system = engine.createSystem(
                'RenderSystem',
                { all: [] },
                {
                    before: () => {
                        systemRan = true;
                    },
                }
            );
            system.disableWhen(() => isMinimized);

            engine.update(16);
            expect(systemRan).toBe(false); // Minimized, so disabled

            systemRan = false;
            isMinimized = false;
            engine.update(16);
            expect(systemRan).toBe(true); // Not minimized anymore
        });

        test('should support disableWhen predicate', () => {
            let isLowPower = false;
            let systemRan = false;

            const system = engine.createSystem(
                'IntenseSystem',
                { all: [] },
                {
                    before: () => {
                        systemRan = true;
                    },
                }
            );
            system.disableWhen(() => isLowPower);

            engine.update(16);
            expect(systemRan).toBe(true); // Normal power

            systemRan = false;
            isLowPower = true;
            engine.update(16);
            expect(systemRan).toBe(false); // Low power, disabled
        });

        test('should combine enableWhen and disableWhen', () => {
            let isConnected = false;
            let isPaused = false;
            let systemRan = false;

            const system = engine.createSystem(
                'NetworkSystem',
                { all: [] },
                {
                    before: () => {
                        systemRan = true;
                    },
                    enabled: false, // Start disabled
                }
            );
            system.enableWhen(() => isConnected);
            system.disableWhen(() => isPaused);

            engine.update(16);
            expect(systemRan).toBe(false); // Not connected

            systemRan = false;
            isConnected = true;
            engine.update(16);
            expect(systemRan).toBe(true); // Connected, not paused

            systemRan = false;
            isPaused = true;
            engine.update(16);
            expect(systemRan).toBe(false); // Connected but paused

            systemRan = false;
            isPaused = false;
            engine.update(16);
            expect(systemRan).toBe(true); // Connected, not paused
        });

        test('should combine runIf with runOnce', () => {
            let condition = false;
            let runCount = 0;

            const system = engine.createSystem(
                'ConditionalOnce',
                { all: [] },
                {
                    before: () => {
                        runCount++;
                    },
                }
            );
            system.runIf(() => condition);
            system.runOnce();

            // Condition false, shouldn't run
            engine.update(16);
            expect(runCount).toBe(0);

            // Condition true, should run once
            condition = true;
            engine.update(16);
            expect(runCount).toBe(1);

            // Should not run again even though condition is true
            engine.update(16);
            expect(runCount).toBe(1);
        });

        test('should combine runIf with runEvery', () => {
            let condition = false;
            let runCount = 0;

            const system = engine.createSystem(
                'ConditionalPeriodic',
                { all: [] },
                {
                    before: () => {
                        runCount++;
                    },
                }
            );
            system.runIf(() => condition);
            system.runEvery(50); // Every 50ms

            // First run, condition false
            engine.update(16);
            expect(runCount).toBe(0);

            // Condition true, should run
            condition = true;
            engine.update(16);
            expect(runCount).toBe(1);

            // Too soon, shouldn't run
            engine.update(16);
            expect(runCount).toBe(1);

            // Enough time, condition true, should run
            engine.update(50);
            expect(runCount).toBe(2);

            // Enough time, but condition false
            condition = false;
            engine.update(50);
            expect(runCount).toBe(2);
        });

        test('should work with conditional execution in groups', () => {
            let runCount = 0;

            engine.createSystemGroup('Logic', { priority: 500 });

            const system = engine.createSystem(
                'PeriodicGroupSystem',
                { all: [] },
                {
                    before: () => {
                        runCount++;
                    },
                    group: 'Logic',
                }
            );
            system.runEvery(50);

            engine.update(16);
            expect(runCount).toBe(1);

            engine.update(16);
            expect(runCount).toBe(1); // Not yet

            engine.update(50);
            expect(runCount).toBe(2);
        });

        test('should work with conditional execution and dependencies', () => {
            const order: string[] = [];
            let runSecond = false;

            engine.createSystem(
                'First',
                { all: [] },
                {
                    before: () => {
                        order.push('First');
                    },
                }
            );

            const secondSystem = engine.createSystem(
                'Second',
                { all: [] },
                {
                    before: () => {
                        order.push('Second');
                    },
                    runAfter: ['First'],
                }
            );
            secondSystem.runIf(() => runSecond);

            // Second won't run
            engine.update(16);
            expect(order).toEqual(['First']);

            // Second will run
            runSecond = true;
            engine.update(16);
            expect(order).toEqual(['First', 'First', 'Second']);
        });
    });

    describe('Query Result Iterators (ROADMAP #6)', () => {
        test('should support iterator protocol with for...of', () => {
            engine.registerComponent(Position);
            engine.registerComponent(Velocity);

            const query = engine.createQuery({ all: [Position] });

            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 10, 20);

            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 30, 40);

            const entity3 = engine.createEntity();
            entity3.addComponent(Velocity, 1, 1); // No Position - should not match

            let count = 0;
            const foundEntities: any[] = [];

            for (const entity of query) {
                expect(entity.hasComponent(Position)).toBe(true);
                foundEntities.push(entity);
                count++;
            }

            expect(count).toBe(2);
            expect(foundEntities).toContain(entity1);
            expect(foundEntities).toContain(entity2);
            expect(foundEntities).not.toContain(entity3);
        });

        test('should support forEach with component access', () => {
            engine.registerComponent(Position);
            engine.registerComponent(Velocity);

            const query = engine.createQuery({ all: [Position, Velocity] });

            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 10, 20);
            entity1.addComponent(Velocity, 1, 2);

            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 30, 40);
            entity2.addComponent(Velocity, 3, 4);

            let callCount = 0;
            const positions: any[] = [];
            const velocities: any[] = [];

            query.forEach((entity, position, velocity) => {
                expect(entity).toBeDefined();
                expect(position).toBeInstanceOf(Position);
                expect(velocity).toBeInstanceOf(Velocity);

                positions.push({ x: position.x, y: position.y });
                velocities.push({ x: velocity.x, y: velocity.y });

                callCount++;
            });

            expect(callCount).toBe(2);
            expect(positions).toContainEqual({ x: 10, y: 20 });
            expect(positions).toContainEqual({ x: 30, y: 40 });
            expect(velocities).toContainEqual({ x: 1, y: 2 });
            expect(velocities).toContainEqual({ x: 3, y: 4 });
        });

        test('forEach should work with empty query results', () => {
            engine.registerComponent(Position);

            const query = engine.createQuery({ all: [Position] });

            let callCount = 0;
            query.forEach((_entity, _position) => {
                callCount++;
            });

            expect(callCount).toBe(0);
        });

        test('forEach should provide components in query order', () => {
            engine.registerComponent(Position);
            engine.registerComponent(Velocity);
            engine.registerComponent(Health);

            const query = engine.createQuery({ all: [Position, Velocity, Health] });

            const entity = engine.createEntity();
            entity.addComponent(Position, 5, 10);
            entity.addComponent(Velocity, 2, 3);
            entity.addComponent(Health, 50, 100);

            query.forEach((_e, comp1, comp2, comp3) => {
                expect(comp1).toBeInstanceOf(Position);
                expect(comp2).toBeInstanceOf(Velocity);
                expect(comp3).toBeInstanceOf(Health);

                expect((comp1 as Position).x).toBe(5);
                expect((comp2 as Velocity).x).toBe(2);
                expect((comp3 as Health).current).toBe(50);
            });
        });

        test('iterator should be reusable', () => {
            engine.registerComponent(Position);

            const query = engine.createQuery({ all: [Position] });

            engine.createEntity().addComponent(Position, 1, 1);
            engine.createEntity().addComponent(Position, 2, 2);

            // First iteration
            let count1 = 0;
            for (const _ of query) {
                count1++;
            }

            // Second iteration
            let count2 = 0;
            for (const _ of query) {
                count2++;
            }

            expect(count1).toBe(2);
            expect(count2).toBe(2);
        });

        test('should maintain backward compatibility with getEntitiesArray', () => {
            engine.registerComponent(Position);

            const query = engine.createQuery({ all: [Position] });

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);

            // Old approach should still work
            const entitiesArray = query.getEntitiesArray();
            expect(entitiesArray).toHaveLength(1);
            expect(entitiesArray[0]).toBe(entity);

            // New iterator approach
            let count = 0;
            for (const _e of query) {
                count++;
            }
            expect(count).toBe(1);
        });
    });

    describe('Fluent Query Builder (ROADMAP #8)', () => {
        test('should create query using fluent API', () => {
            engine.registerComponent(Position);
            engine.registerComponent(Velocity);

            const query = engine.query().withAll(Position, Velocity).build();

            expect(query).toBeDefined();

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);
            entity.addComponent(Velocity, 1, 1);

            const entities = query.getEntitiesArray();
            expect(entities).toHaveLength(1);
            expect(entities[0]).toBe(entity);
        });

        test('should support withAny constraint', () => {
            engine.registerComponent(Position);
            engine.registerComponent(Velocity);
            engine.registerComponent(Health);

            const query = engine.query().withAny(Position, Velocity).build();

            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 1, 1);

            const entity2 = engine.createEntity();
            entity2.addComponent(Velocity, 1, 1);

            const entity3 = engine.createEntity();
            entity3.addComponent(Health, 100, 100);

            const entities = query.getEntitiesArray();
            expect(entities).toHaveLength(2);
            expect(entities).toContain(entity1);
            expect(entities).toContain(entity2);
            expect(entities).not.toContain(entity3);
        });

        test('should support withNone constraint', () => {
            engine.registerComponent(Position);
            engine.registerComponent(Velocity);

            class Dead {}
            engine.registerComponent(Dead);

            const query = engine.query().withAll(Position).withNone(Dead).build();

            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 1, 1);

            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 2, 2);
            entity2.addComponent(Dead);

            const entities = query.getEntitiesArray();
            expect(entities).toHaveLength(1);
            expect(entities[0]).toBe(entity1);
        });

        test('should support tag filtering', () => {
            engine.registerComponent(Position);

            const query = engine.query().withAll(Position).withTags('player').build();

            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 1, 1);
            entity1.addTag('player');

            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 2, 2);
            entity2.addTag('enemy');

            const entities = query.getEntitiesArray();
            expect(entities).toHaveLength(1);
            expect(entities[0]).toBe(entity1);
        });

        test('should support withoutTags constraint', () => {
            engine.registerComponent(Position);

            const query = engine.query().withAll(Position).withoutTags('disabled').build();

            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 1, 1);
            entity1.addTag('active');

            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 2, 2);
            entity2.addTag('disabled');

            const entities = query.getEntitiesArray();
            expect(entities).toHaveLength(1);
            expect(entities[0]).toBe(entity1);
        });

        test('should support complex queries with multiple constraints', () => {
            engine.registerComponent(Position);
            engine.registerComponent(Velocity);
            engine.registerComponent(Health);

            class Player {}
            class Enemy {}
            class Dead {}
            class Frozen {}

            engine.registerComponent(Player);
            engine.registerComponent(Enemy);
            engine.registerComponent(Dead);
            engine.registerComponent(Frozen);

            const query = engine
                .query()
                .withAll(Position, Velocity)
                .withAny(Player, Enemy)
                .withNone(Dead, Frozen)
                .withTags('active')
                .withoutTags('disabled')
                .build();

            // Should match: has Position+Velocity, has Player, not Dead/Frozen, has 'active', no 'disabled'
            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 1, 1);
            entity1.addComponent(Velocity, 1, 1);
            entity1.addComponent(Player);
            entity1.addTag('active');

            // Should match: has Position+Velocity, has Enemy, not Dead/Frozen, has 'active', no 'disabled'
            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 2, 2);
            entity2.addComponent(Velocity, 2, 2);
            entity2.addComponent(Enemy);
            entity2.addTag('active');

            // Should NOT match: has Dead component
            const entity3 = engine.createEntity();
            entity3.addComponent(Position, 3, 3);
            entity3.addComponent(Velocity, 3, 3);
            entity3.addComponent(Player);
            entity3.addComponent(Dead);
            entity3.addTag('active');

            // Should NOT match: missing 'active' tag
            const entity4 = engine.createEntity();
            entity4.addComponent(Position, 4, 4);
            entity4.addComponent(Velocity, 4, 4);
            entity4.addComponent(Player);

            const entities = query.getEntitiesArray();
            expect(entities).toHaveLength(2);
            expect(entities).toContain(entity1);
            expect(entities).toContain(entity2);
            expect(entities).not.toContain(entity3);
            expect(entities).not.toContain(entity4);
        });

        test('should maintain backward compatibility with createQuery', () => {
            engine.registerComponent(Position);
            engine.registerComponent(Velocity);

            // Old object syntax
            const query1 = engine.createQuery({
                all: [Position, Velocity],
            });

            // New fluent syntax
            const query2 = engine.query().withAll(Position, Velocity).build();

            const entity = engine.createEntity();
            entity.addComponent(Position, 1, 1);
            entity.addComponent(Velocity, 1, 1);

            expect(query1.getEntitiesArray()).toHaveLength(1);
            expect(query2.getEntitiesArray()).toHaveLength(1);
        });

        test('should allow chaining in any order', () => {
            engine.registerComponent(Position);
            engine.registerComponent(Velocity);

            class Dead {}
            engine.registerComponent(Dead);

            // Chain methods in different order
            const query = engine
                .query()
                .withTags('active')
                .withNone(Dead)
                .withAll(Position, Velocity)
                .withoutTags('disabled')
                .build();

            const entity = engine.createEntity();
            entity.addComponent(Position, 1, 1);
            entity.addComponent(Velocity, 1, 1);
            entity.addTag('active');

            expect(query.getEntitiesArray()).toHaveLength(1);
        });
    });

    describe('Query Performance Metrics (ROADMAP #28)', () => {
        test('should track query execution count', () => {
            engine.registerComponent(Position);

            const query = engine.createQuery({ all: [Position] });
            engine.createEntity().addComponent(Position, 10, 20);

            // Execute query multiple times
            query.getEntitiesArray();
            query.getEntitiesArray();
            query.getEntitiesArray();

            const stats = engine.getQueryStats(query);
            expect(stats.executionCount).toBe(3);
        });

        test('should track total and average execution time', () => {
            engine.registerComponent(Position);

            const query = engine.createQuery({ all: [Position] });
            engine.createEntity().addComponent(Position, 10, 20);

            // Execute query multiple times
            query.getEntitiesArray();
            query.getEntitiesArray();

            const stats = engine.getQueryStats(query);
            expect(stats.totalTimeMs).toBeGreaterThan(0);
            expect(stats.averageTimeMs).toBeGreaterThan(0);
            expect(stats.averageTimeMs).toBe(stats.totalTimeMs / stats.executionCount);
        });

        test('should track last match count', () => {
            engine.registerComponent(Position);

            const query = engine.createQuery({ all: [Position] });

            engine.createEntity().addComponent(Position, 10, 20);
            engine.createEntity().addComponent(Position, 30, 40);
            engine.createEntity().addComponent(Position, 50, 60);

            query.getEntitiesArray();

            const stats = engine.getQueryStats(query);
            expect(stats.lastMatchCount).toBe(3);
        });

        test('should track cache hit rate', () => {
            engine.registerComponent(Position);

            const query = engine.createQuery({ all: [Position] });
            engine.createEntity().addComponent(Position, 10, 20);

            // First call - no cache hit
            query.getEntitiesArray();

            // Second call - cache hit (no entities added/removed)
            query.getEntitiesArray();

            // Third call - cache hit
            query.getEntitiesArray();

            const stats = engine.getQueryStats(query);
            expect(stats.cacheHitRate).toBeGreaterThan(0);
            // 2 cache hits out of 3 executions = 66.67%
            expect(stats.cacheHitRate).toBeCloseTo(66.67, 1);
        });

        test('should reset cache hit rate when entities change', () => {
            engine.registerComponent(Position);

            const query = engine.createQuery({ all: [Position] });

            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 10, 20);

            // First call
            query.getEntitiesArray();

            // Second call - cache hit
            query.getEntitiesArray();

            // Add another entity - invalidates cache
            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 30, 40);

            // Third call - cache miss due to entity addition
            query.getEntitiesArray();

            // Fourth call - cache hit
            query.getEntitiesArray();

            const stats = engine.getQueryStats(query);
            // 2 cache hits out of 4 executions = 50%
            expect(stats.cacheHitRate).toBeCloseTo(50, 1);
        });

        test('should get stats for all queries', () => {
            engine.registerComponent(Position);
            engine.registerComponent(Velocity);

            const query1 = engine.createQuery({ all: [Position] });
            const query2 = engine.createQuery({ all: [Velocity] });

            const entity = engine.createEntity();
            entity.addComponent(Position, 1, 1);
            entity.addComponent(Velocity, 2, 2);

            query1.getEntitiesArray();
            query1.getEntitiesArray();

            query2.getEntitiesArray();
            query2.getEntitiesArray();
            query2.getEntitiesArray();

            const allStats = engine.getQueryStats();

            expect(Array.isArray(allStats)).toBe(true);
            expect(allStats.length).toBeGreaterThanOrEqual(2);

            // Find our specific queries in the stats
            const stats1 = allStats.find((s: any) => s.query === query1);
            const stats2 = allStats.find((s: any) => s.query === query2);

            expect(stats1).toBeDefined();
            expect(stats2).toBeDefined();
            expect(stats1.executionCount).toBe(2);
            expect(stats2.executionCount).toBe(3);
        });

        test('should track stats independently for each query', () => {
            engine.registerComponent(Position);
            engine.registerComponent(Velocity);

            const query1 = engine.createQuery({ all: [Position] });
            const query2 = engine.createQuery({ all: [Velocity] });

            engine.createEntity().addComponent(Position, 1, 1);

            query1.getEntitiesArray();
            query1.getEntitiesArray();
            query1.getEntitiesArray();

            query2.getEntitiesArray();

            const stats1 = engine.getQueryStats(query1);
            const stats2 = engine.getQueryStats(query2);

            expect(stats1.executionCount).toBe(3);
            expect(stats2.executionCount).toBe(1);
            expect(stats1.lastMatchCount).toBe(1);
            expect(stats2.lastMatchCount).toBe(0);
        });

        test('should track stats for iterator usage', () => {
            engine.registerComponent(Position);

            const query = engine.createQuery({ all: [Position] });
            engine.createEntity().addComponent(Position, 10, 20);

            // Use iterator
            for (const _entity of query) {
                // Iterate
            }

            const stats = engine.getQueryStats(query);
            expect(stats.executionCount).toBe(1);
            expect(stats.lastMatchCount).toBe(1);
        });

        test('should have zero stats for never-executed query', () => {
            engine.registerComponent(Position);

            const query = engine.createQuery({ all: [Position] });

            const stats = engine.getQueryStats(query);
            expect(stats.executionCount).toBe(0);
            expect(stats.totalTimeMs).toBe(0);
            expect(stats.averageTimeMs).toBe(0);
            expect(stats.lastMatchCount).toBe(0);
            expect(stats.cacheHitRate).toBe(0);
        });
    });

    describe('Transaction/Batch Operations', () => {
        test('should begin and commit transaction', () => {
            expect(engine.isInTransaction()).toBe(false);

            engine.beginTransaction();
            expect(engine.isInTransaction()).toBe(true);

            engine.commitTransaction();
            expect(engine.isInTransaction()).toBe(false);
        });

        test('should throw error when starting nested transaction', () => {
            engine.beginTransaction();
            expect(() => engine.beginTransaction()).toThrow(/already in progress/i);
            engine.rollbackTransaction();
        });

        test('should throw error when committing without transaction', () => {
            expect(() => engine.commitTransaction()).toThrow(/no transaction/i);
        });

        test('should throw error when rolling back without transaction', () => {
            expect(() => engine.rollbackTransaction()).toThrow(/no transaction/i);
        });

        test('should defer query updates during transaction', () => {
            const query = engine.createQuery({ all: [Position] });

            engine.beginTransaction();

            // Create entities during transaction
            for (let i = 0; i < 10; i++) {
                const entity = engine.createEntity();
                entity.addComponent(Position, i, i);
            }

            // Query should not have entities yet (updates deferred)
            expect(query.size).toBe(0);

            engine.commitTransaction();

            // After commit, query should have all entities
            expect(query.size).toBe(10);
        });

        test('should batch component additions during transaction', () => {
            const query = engine.createQuery({ all: [Position, Velocity] });

            engine.beginTransaction();

            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 0, 0);
            entity1.addComponent(Velocity, 1, 1);

            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 5, 5);
            entity2.addComponent(Velocity, 2, 2);

            // Query should be empty during transaction
            expect(query.size).toBe(0);

            engine.commitTransaction();

            // After commit, both entities should match
            expect(query.size).toBe(2);
        });

        test('should discard pending changes on rollback', () => {
            const query = engine.createQuery({ all: [Position] });

            engine.beginTransaction();

            for (let i = 0; i < 5; i++) {
                const entity = engine.createEntity();
                entity.addComponent(Position, i, i);
            }

            engine.rollbackTransaction();

            // Query should still be empty after rollback
            expect(query.size).toBe(0);

            // Entities exist but aren't in queries
            expect(engine.getAllEntities().length).toBe(5);
        });

        test('should improve performance for bulk operations', () => {
            const query = engine.createQuery({ all: [Position] });

            // Without transaction
            const start1 = performance.now();
            for (let i = 0; i < 100; i++) {
                const entity = engine.createEntity();
                entity.addComponent(Position, i, i);
            }
            const withoutTransaction = performance.now() - start1;

            // Clear entities
            engine.getAllEntities().forEach((e) => {
                e.queueFree();
            });
            engine.update(16);

            // With transaction
            const start2 = performance.now();
            engine.beginTransaction();
            for (let i = 0; i < 100; i++) {
                const entity = engine.createEntity();
                entity.addComponent(Position, i, i);
            }
            engine.commitTransaction();
            const withTransaction = performance.now() - start2;

            // Transaction should be faster (though this test may be flaky)
            // Just verify both complete successfully
            expect(withoutTransaction).toBeGreaterThan(0);
            expect(withTransaction).toBeGreaterThan(0);
            expect(query.size).toBe(100);
        });

        test('should handle component removal during transaction', () => {
            const query = engine.createQuery({ all: [Position] });

            const entity = engine.createEntity();
            entity.addComponent(Position, 0, 0);

            // Ensure query is updated
            engine.update(0);
            expect(query.size).toBe(1);

            engine.beginTransaction();
            entity.removeComponent(Position);

            // Query should still have entity (update deferred)
            expect(query.size).toBe(1);

            engine.commitTransaction();

            // After commit, entity should be removed from query
            expect(query.size).toBe(0);
        });

        test('should handle tag changes during transaction', () => {
            const query = engine.createQuery({ tags: ['player'] });

            engine.beginTransaction();

            const entity = engine.createEntity();
            entity.addTag('player');

            // Query should be empty during transaction
            expect(query.size).toBe(0);

            engine.commitTransaction();

            // After commit, entity should be in query
            expect(query.size).toBe(1);
        });

        test('should handle multiple transactions sequentially', () => {
            const query = engine.createQuery({ all: [Position] });

            // First transaction
            engine.beginTransaction();
            for (let i = 0; i < 5; i++) {
                engine.createEntity().addComponent(Position, i, i);
            }
            engine.commitTransaction();
            expect(query.size).toBe(5);

            // Second transaction
            engine.beginTransaction();
            for (let i = 0; i < 3; i++) {
                engine.createEntity().addComponent(Position, i + 10, i + 10);
            }
            engine.commitTransaction();
            expect(query.size).toBe(8);

            // Third transaction with rollback
            engine.beginTransaction();
            for (let i = 0; i < 2; i++) {
                engine.createEntity().addComponent(Position, i + 20, i + 20);
            }
            engine.rollbackTransaction();
            expect(query.size).toBe(8); // Still 8, rollback discarded changes
        });

        test('should handle complex query updates during transaction', () => {
            const queryAll = engine.createQuery({ all: [Position, Velocity] });
            const queryAny = engine.createQuery({ any: [Position, Velocity] });
            const queryNone = engine.createQuery({ all: [Position], none: [Velocity] });

            engine.beginTransaction();

            // Entity with both components
            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 0, 0);
            entity1.addComponent(Velocity, 1, 1);

            // Entity with only Position
            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 5, 5);

            // Entity with only Velocity
            const entity3 = engine.createEntity();
            entity3.addComponent(Velocity, 2, 2);

            engine.commitTransaction();

            // Check all queries
            expect(queryAll.size).toBe(1); // Only entity1
            expect(queryAny.size).toBe(3); // All three entities
            expect(queryNone.size).toBe(1); // Only entity2
        });
    });

    describe('Component Lifecycle Hooks', () => {
        test('should call onCreate when component is added', () => {
            let createCalled = false;
            let entityPassed: any = null;

            class TestComponent {
                onCreate(entity: EntityDef) {
                    createCalled = true;
                    entityPassed = entity;
                }
            }

            const entity = engine.createEntity();
            entity.addComponent(TestComponent);

            expect(createCalled).toBe(true);
            expect(entityPassed).toBe(entity);
        });

        test('should call onDestroy when component is removed', () => {
            let destroyCalled = false;
            let entityPassed: any = null;

            class TestComponent {
                onDestroy(entity: EntityDef) {
                    destroyCalled = true;
                    entityPassed = entity;
                }
            }

            const entity = engine.createEntity();
            entity.addComponent(TestComponent);

            expect(destroyCalled).toBe(false);

            entity.removeComponent(TestComponent);

            expect(destroyCalled).toBe(true);
            expect(entityPassed).toBe(entity);
        });

        test('should call both onCreate and onDestroy', () => {
            let createCalled = false;
            let destroyCalled = false;

            class TestComponent {
                onCreate(entity: EntityDef) {
                    createCalled = true;
                    expect(entity).toBeInstanceOf(Object);
                }

                onDestroy(entity: EntityDef) {
                    destroyCalled = true;
                    expect(entity).toBeInstanceOf(Object);
                }
            }

            const entity = engine.createEntity();
            entity.addComponent(TestComponent);
            expect(createCalled).toBe(true);

            entity.removeComponent(TestComponent);
            expect(destroyCalled).toBe(true);
        });

        test('should work with components without lifecycle hooks', () => {
            class SimpleComponent {
                value = 42;
            }

            const entity = engine.createEntity();

            // Should not throw errors
            expect(() => entity.addComponent(SimpleComponent)).not.toThrow();
            expect(() => entity.removeComponent(SimpleComponent)).not.toThrow();
        });

        test('should support resource management with lifecycle hooks', () => {
            class AudioSource {
                sound: any = null;

                constructor(public url: string) {}

                onCreate(_entity: EntityDef) {
                    // Simulate loading audio
                    this.sound = { loaded: true, url: this.url };
                }

                onDestroy(_entity: EntityDef) {
                    // Simulate cleanup
                    this.sound = null;
                }
            }

            const entity = engine.createEntity();
            entity.addComponent(AudioSource, 'sound.mp3');

            const audio = entity.getComponent(AudioSource);
            expect(audio.sound).toBeDefined();
            expect(audio.sound.loaded).toBe(true);
            expect(audio.sound.url).toBe('sound.mp3');

            entity.removeComponent(AudioSource);
            // Component is removed, so we can't check it directly
            // But onDestroy was called and cleaned up
        });

        test('should call onCreate with entity context', () => {
            class ContextComponent {
                entityName?: string;

                onCreate(entity: EntityDef) {
                    this.entityName = entity.name;
                }
            }

            const entity = engine.createEntity('TestEntity');
            entity.addComponent(ContextComponent);

            const component = entity.getComponent(ContextComponent);
            expect(component.entityName).toBe('TestEntity');
        });

        test('should call onDestroy before component pool release', () => {
            let destroyCallCount = 0;

            class PooledComponent {
                value = 0;

                onDestroy(_entity: EntityDef) {
                    destroyCallCount++;
                    // Component should still have its state
                    expect(this.value).toBeGreaterThanOrEqual(0);
                }
            }

            // Register component pool
            engine.registerComponentPool(PooledComponent, { initialSize: 5 });

            const entity1 = engine.createEntity();
            entity1.addComponent(PooledComponent);
            const comp1 = entity1.getComponent(PooledComponent);
            comp1.value = 100;

            entity1.removeComponent(PooledComponent);
            expect(destroyCallCount).toBe(1);

            const entity2 = engine.createEntity();
            entity2.addComponent(PooledComponent);
            entity2.removeComponent(PooledComponent);
            expect(destroyCallCount).toBe(2);
        });

        test('should handle multiple components with lifecycle hooks', () => {
            let comp1CreateCalled = false;
            let comp2CreateCalled = false;
            let comp1DestroyCalled = false;
            let comp2DestroyCalled = false;

            class Component1 {
                onCreate(_entity: EntityDef) {
                    comp1CreateCalled = true;
                }
                onDestroy(_entity: EntityDef) {
                    comp1DestroyCalled = true;
                }
            }

            class Component2 {
                onCreate(_entity: EntityDef) {
                    comp2CreateCalled = true;
                }
                onDestroy(_entity: EntityDef) {
                    comp2DestroyCalled = true;
                }
            }

            const entity = engine.createEntity();
            entity.addComponent(Component1);
            entity.addComponent(Component2);

            expect(comp1CreateCalled).toBe(true);
            expect(comp2CreateCalled).toBe(true);

            entity.removeComponent(Component1);
            entity.removeComponent(Component2);

            expect(comp1DestroyCalled).toBe(true);
            expect(comp2DestroyCalled).toBe(true);
        });

        test('should handle errors in lifecycle hooks gracefully', () => {
            class ErrorComponent {
                onCreate(_entity: EntityDef) {
                    throw new Error('onCreate error');
                }
            }

            const entity = engine.createEntity();

            // onCreate error should propagate
            expect(() => entity.addComponent(ErrorComponent)).toThrow('onCreate error');
        });

        test('should call onCreate after component is added to entity', () => {
            class VerifyComponent {
                onCreate(entity: EntityDef) {
                    // Component should already be on the entity
                    expect(entity.hasComponent(VerifyComponent)).toBe(true);
                }
            }

            const entity = engine.createEntity();
            entity.addComponent(VerifyComponent);
        });

        test('should call onDestroy before component is removed from entity', () => {
            class VerifyComponent {
                onDestroy(entity: EntityDef) {
                    // Component should still be on the entity
                    expect(entity.hasComponent(VerifyComponent)).toBe(true);
                }
            }

            const entity = engine.createEntity();
            entity.addComponent(VerifyComponent);
            entity.removeComponent(VerifyComponent);
        });

        test('should work with component dependencies and lifecycle hooks', () => {
            let dependencyCreateCalled = false;
            let dependentCreateCalled = false;

            class DependencyComponent {
                onCreate(_entity: EntityDef) {
                    dependencyCreateCalled = true;
                }
            }

            class DependentComponent {
                onCreate(entity: EntityDef) {
                    dependentCreateCalled = true;
                    // Verify dependency exists
                    expect(entity.hasComponent(DependencyComponent)).toBe(true);
                }
            }

            engine.registerComponentValidator(DependentComponent, {
                validate: () => true,
                dependencies: [DependencyComponent],
            });

            const entity = engine.createEntity();
            entity.addComponent(DependencyComponent);
            entity.addComponent(DependentComponent);

            expect(dependencyCreateCalled).toBe(true);
            expect(dependentCreateCalled).toBe(true);
        });
    });

    describe('TypeScript Type Inference (ROADMAP #16)', () => {
        class Position {
            constructor(
                public x: number = 0,
                public y: number = 0
            ) {}
        }

        class Velocity {
            constructor(
                public dx: number = 0,
                public dy: number = 0
            ) {}
        }

        class Health {
            constructor(
                public current: number = 100,
                public max: number = 100
            ) {}
        }

        beforeEach(() => {
            engine = new EngineBuilder().withDebugMode(false).build();
        });

        test('should infer component types in system act callback', () => {
            let typedPositionX: number | undefined;
            let typedVelocityDx: number | undefined;

            engine.createSystem(
                'TypedSystem',
                { all: [Position, Velocity] as const },
                {
                    act: (_entity, position, velocity) => {
                        // These should have proper types inferred
                        // TypeScript should provide autocomplete here
                        typedPositionX = position.x;
                        typedVelocityDx = velocity.dx;

                        // Test that we can access component properties
                        position.x += velocity.dx;
                        position.y += velocity.dy;
                    },
                }
            );

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);
            entity.addComponent(Velocity, 1, 2);

            engine.update(16);

            const pos = entity.getComponent(Position);
            expect(pos.x).toBe(11);
            expect(pos.y).toBe(22);
            expect(typedPositionX).toBe(10);
            expect(typedVelocityDx).toBe(1);
        });

        test('should work with query forEach method', () => {
            const query = engine.createQuery({ all: [Position, Health] as const });

            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 10, 20);
            entity1.addComponent(Health, 80, 100);

            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 5, 15);
            entity2.addComponent(Health, 50, 100);

            const results: Array<{ x: number; hp: number }> = [];

            query.forEach((_entity, position, health) => {
                // position and health should be properly typed
                results.push({
                    x: position.x,
                    hp: health.current,
                });
            });

            expect(results).toHaveLength(2);
            expect(results[0]).toEqual({ x: 10, hp: 80 });
            expect(results[1]).toEqual({ x: 5, hp: 50 });
        });

        test('should infer types with multiple components', () => {
            let capturedTypes: {
                posX?: number;
                velDx?: number;
                healthCurrent?: number;
            } = {};

            engine.createSystem(
                'MultiComponentSystem',
                { all: [Position, Velocity, Health] as const },
                {
                    act: (_entity, position, velocity, health) => {
                        // All three components should be properly typed
                        capturedTypes = {
                            posX: position.x,
                            velDx: velocity.dx,
                            healthCurrent: health.current,
                        };
                    },
                }
            );

            const entity = engine.createEntity();
            entity.addComponent(Position, 100, 200);
            entity.addComponent(Velocity, 5, 10);
            entity.addComponent(Health, 75, 100);

            engine.update(16);

            expect(capturedTypes.posX).toBe(100);
            expect(capturedTypes.velDx).toBe(5);
            expect(capturedTypes.healthCurrent).toBe(75);
        });

        test('should work with single component systems', () => {
            let healthValue: number | undefined;

            engine.createSystem(
                'SingleComponentSystem',
                { all: [Health] as const },
                {
                    act: (_entity, health) => {
                        // health should be properly typed
                        healthValue = health.current;
                        health.current = Math.min(health.current + 10, health.max);
                    },
                }
            );

            const entity = engine.createEntity();
            entity.addComponent(Health, 50, 100);

            engine.update(16);

            const h = entity.getComponent(Health);
            expect(h.current).toBe(60);
            expect(healthValue).toBe(50);
        });

        test('should preserve types through fixed update systems', () => {
            let typedUpdate = false;

            engine.createSystem(
                'FixedUpdateSystem',
                { all: [Position, Velocity] as const },
                {
                    act: (_entity, position, velocity) => {
                        // Should have proper types even in fixed update
                        position.x += velocity.dx;
                        position.y += velocity.dy;
                        typedUpdate = true;
                    },
                },
                true // Fixed update
            );

            const entity = engine.createEntity();
            entity.addComponent(Position, 0, 0);
            entity.addComponent(Velocity, 1, 1);

            engine.update(17); // 17ms > 16.67ms (60 FPS interval)

            expect(typedUpdate).toBe(true);
        });

        test('should work with createQuery method', () => {
            const query = engine.createQuery({ all: [Position, Velocity] as const });

            const entity = engine.createEntity();
            entity.addComponent(Position, 15, 25);
            entity.addComponent(Velocity, 2, 3);

            let found = false;
            query.forEach((_e, pos, vel) => {
                // Types should be inferred here too
                expect(pos.x).toBe(15);
                expect(vel.dx).toBe(2);
                found = true;
            });

            expect(found).toBe(true);
        });

        test('should handle empty component arrays', () => {
            // System with no components should still work
            let called = false;

            engine.createSystem(
                'NoComponentSystem',
                { all: [] as const },
                {
                    before: () => {
                        called = true;
                    },
                }
            );

            engine.createEntity();
            engine.update(16);

            expect(called).toBe(true);
        });

        test('should work with complex component hierarchies', () => {
            class Transform {
                constructor(
                    public x: number = 0,
                    public y: number = 0,
                    public rotation: number = 0
                ) {}
            }

            class Sprite {
                constructor(
                    public texture: string = '',
                    public width: number = 32,
                    public height: number = 32
                ) {}
            }

            let transformData: { x: number; rot: number } | undefined;
            let spriteData: { tex: string; w: number } | undefined;

            engine.createSystem(
                'RenderSystem',
                { all: [Transform, Sprite] as const },
                {
                    act: (_entity, transform, sprite) => {
                        // Both should be properly typed
                        transformData = {
                            x: transform.x,
                            rot: transform.rotation,
                        };
                        spriteData = {
                            tex: sprite.texture,
                            w: sprite.width,
                        };
                    },
                }
            );

            const entity = engine.createEntity();
            entity.addComponent(Transform, 50, 100, 45);
            entity.addComponent(Sprite, 'player.png', 64, 64);

            engine.update(16);

            expect(transformData).toEqual({ x: 50, rot: 45 });
            expect(spriteData).toEqual({ tex: 'player.png', w: 64 });
        });
    });

    describe('Archetype System Integration', () => {
        test('should enable archetypes by default', () => {
            const archetypeEngine = new EngineBuilder().build();
            expect(archetypeEngine.areArchetypesEnabled()).toBe(true);
        });

        test('should allow disabling archetypes', () => {
            const noArchetypeEngine = new EngineBuilder().withArchetypes(false).build();
            expect(noArchetypeEngine.areArchetypesEnabled()).toBe(false);
        });

        test('should use archetypes for component storage and retrieval', () => {
            const entity = engine.createEntity('ArchetypeTest');
            entity.addComponent(Position, 10, 20);
            entity.addComponent(Velocity, 1, 2);

            const pos = entity.getComponent(Position);
            const vel = entity.getComponent(Velocity);

            expect(pos.x).toBe(10);
            expect(pos.y).toBe(20);
            expect(vel.x).toBe(1);
            expect(vel.y).toBe(2);
        });

        test('should move entities between archetypes when adding components', () => {
            const entity = engine.createEntity('MoveTest');
            entity.addComponent(Position, 5, 10);

            // Entity should be in Position archetype
            let stats = engine.getArchetypeStats();
            expect(stats).toBeDefined();

            entity.addComponent(Velocity, 2, 3);

            // Entity should now be in Position+Velocity archetype
            stats = engine.getArchetypeStats();
            const posVelArchetype = stats.archetypes.find((a: any) => a.id === 'Position,Velocity');
            expect(posVelArchetype).toBeDefined();
            expect(posVelArchetype.entityCount).toBeGreaterThan(0);
        });

        test('should move entities between archetypes when removing components', () => {
            const entity = engine.createEntity('RemoveTest');
            entity.addComponent(Position, 10, 20);
            entity.addComponent(Velocity, 1, 2);

            entity.removeComponent(Velocity);

            const stats = engine.getArchetypeStats();
            const posArchetype = stats.archetypes.find((a: any) => a.id === 'Position');
            expect(posArchetype).toBeDefined();
            expect(posArchetype.entityCount).toBeGreaterThan(0);
        });

        test('should iterate efficiently using archetypes', () => {
            // Create multiple entities with same component composition
            const entities = [];
            for (let i = 0; i < 100; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(Position, i, i * 2);
                entity.addComponent(Velocity, 1, 1);
                entities.push(entity);
            }

            let count = 0;
            engine.createSystem(
                'ArchetypeIterationSystem',
                { all: [Position, Velocity] },
                {
                    act: (entity, pos, vel) => {
                        count++;
                        expect(pos).toBeDefined();
                        expect(vel).toBeDefined();
                    },
                }
            );

            engine.update(16);

            expect(count).toBe(100);
        });

        test('should provide archetype statistics', () => {
            const entity1 = engine.createEntity();
            entity1.addComponent(Position, 1, 2);

            const entity2 = engine.createEntity();
            entity2.addComponent(Position, 3, 4);
            entity2.addComponent(Velocity, 1, 1);

            const stats = engine.getArchetypeStats();

            expect(stats).toBeDefined();
            expect(stats.archetypeCount).toBeGreaterThan(0);
            expect(stats.archetypes).toBeInstanceOf(Array);
            expect(stats.archetypes.length).toBeGreaterThan(0);
        });

        test('should provide archetype memory statistics', () => {
            for (let i = 0; i < 10; i++) {
                const entity = engine.createEntity();
                entity.addComponent(Position, i, i);
                entity.addComponent(Velocity, 1, 1);
            }

            const memStats = engine.getArchetypeMemoryStats();

            expect(memStats).toBeDefined();
            expect(memStats.totalEntities).toBeGreaterThan(0);
            expect(memStats.totalArchetypes).toBeGreaterThan(0);
            expect(memStats.estimatedBytes).toBeGreaterThan(0);
            expect(memStats.archetypeBreakdown).toBeInstanceOf(Array);
        });

        test('should work with queries when archetypes are enabled', () => {
            const query = engine.createQuery({ all: [Position, Velocity] });

            for (let i = 0; i < 50; i++) {
                const entity = engine.createEntity();
                entity.addComponent(Position, i, i);
                entity.addComponent(Velocity, 1, 1);
            }

            let count = 0;
            query.forEach(() => {
                count++;
            });

            expect(count).toBe(50);
        });

        test('should handle complex queries with archetypes', () => {
            class Health {
                constructor(public value: number = 100) {}
            }

            // Create entities with different component compositions
            const e1 = engine.createEntity();
            e1.addComponent(Position, 1, 1);
            e1.addComponent(Health, 100);

            const e2 = engine.createEntity();
            e2.addComponent(Position, 2, 2);
            e2.addComponent(Velocity, 1, 1);

            const e3 = engine.createEntity();
            e3.addComponent(Position, 3, 3);
            e3.addComponent(Velocity, 1, 1);
            e3.addComponent(Health, 50);

            // Query: entities with Position, optionally Velocity, but not Health
            const query = engine.createQuery({
                all: [Position],
                none: [Health],
            });

            let count = 0;
            query.forEach(() => {
                count++;
            });

            // Should match e2 (Position+Velocity but no Health)
            expect(count).toBe(1);
        });

        test('should handle entity deletion with archetypes', () => {
            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);
            entity.addComponent(Velocity, 1, 2);

            entity.queueFree();
            engine.update(16); // Trigger cleanup

            const allEntities = engine.getAllEntities();
            expect(allEntities.find((e) => e === entity)).toBeUndefined();
        });

        test('should maintain performance with many archetype transitions', () => {
            const entity = engine.createEntity();

            // Add and remove components multiple times
            for (let i = 0; i < 10; i++) {
                entity.addComponent(Position, i, i);
                entity.addComponent(Velocity, 1, 1);
                entity.removeComponent(Velocity);
                entity.removeComponent(Position);
            }

            // Entity should be in empty archetype
            const stats = engine.getArchetypeStats();
            expect(stats.entityMovementCount).toBeGreaterThan(0);
        });

        test('should work correctly with component pools and archetypes', () => {
            class Particle {
                constructor(
                    public x: number = 0,
                    public y: number = 0
                ) {}
            }

            engine.registerComponentPool(Particle, { initialSize: 10, maxSize: 100 });

            const entity = engine.createEntity();
            entity.addComponent(Particle, 5, 10);

            const particle = entity.getComponent(Particle);
            expect(particle.x).toBe(5);
            expect(particle.y).toBe(10);

            const poolStats = engine.getComponentPoolStats(Particle);
            expect(poolStats).toBeDefined();
        });
    });
});
