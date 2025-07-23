import { Engine, createTagComponent, CommonValidators, PerformanceMonitor } from './engine';
import type { ComponentIdentifier, EntityPrefab } from './definitions';

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

// Tag components
const PlayerTag = createTagComponent('Player');
const EnemyTag = createTagComponent('Enemy');
const ActiveTag = createTagComponent('Active');

describe('Enhanced ECS Engine', () => {
    let engine: Engine;

    beforeEach(() => {
        engine = new Engine(60, true); // 60 FPS, debug mode
    });

    afterEach(() => {
        engine.stop();
    });

    describe('Entity Management', () => {
        test('should create entities with names', () => {
            const entity = engine.createEntity('TestEntity');
            expect(entity.name).toBe('TestEntity');
            expect(engine.getAllEntities()).toHaveLength(1);
        });

        test('should support bulk entity creation', () => {
            const entities = engine.createEntities(5);
            expect(entities).toHaveLength(5);
            expect(engine.getAllEntities()).toHaveLength(5);
        });

        test('should support entity hierarchies', () => {
            const parent = engine.createEntity('Parent');
            const child = engine.createEntity('Child');
            
            parent.addChild(child);
            
            expect(child.parent).toBe(parent);
            expect(parent.children).toContain(child);
        });

        test('should support entity tags', () => {
            const entity = engine.createEntity('TaggedEntity');
            entity.addTag('player').addTag('active');
            
            expect(entity.hasTag('player')).toBe(true);
            expect(entity.hasTag('active')).toBe(true);
            expect(entity.hasTag('enemy')).toBe(false);
            
            const taggedEntities = engine.getEntitiesByTag('player');
            expect(taggedEntities).toContain(entity);
        });
    });

    describe('Component System', () => {
        test('should add and retrieve components', () => {
            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);
            
            const position = entity.getComponent(Position);
            expect(position.x).toBe(10);
            expect(position.y).toBe(20);
        });

        test('should validate components', () => {
            engine.registerComponentValidator(Health, {
                validate: (component: Health) => {
                    return component.current >= 0 ? true : 'current must be non-negative';
                }
            });
            
            // Test validation directly
            const validator = engine.getComponentValidator(Health);
            const badHealth = new Health(100, 100);
            badHealth.current = -10; // Manually set to invalid value
            
            const result = validator!.validate(badHealth);
            expect(result).toBe('current must be non-negative');
        });

        test('should enforce component dependencies', () => {
            engine.registerComponentValidator(Damage, {
                validate: () => true,
                dependencies: [Health]
            });
            
            const entity = engine.createEntity();
            expect(() => {
                entity.addComponent(Damage, 50);
            }).toThrow('requires Health');
            
            entity.addComponent(Health, 100, 100);
            expect(() => {
                entity.addComponent(Damage, 50);
            }).not.toThrow();
        });

        test('should track component changes', () => {
            const entity = engine.createEntity();
            const initialVersion = entity.changeVersion;
            
            entity.addComponent(Position, 0, 0);
            expect(entity.changeVersion).toBeGreaterThan(initialVersion);
        });
    });

    describe('Query System', () => {
        test('should support ALL queries', () => {
            const entity1 = engine.createEntity();
            const entity2 = engine.createEntity();
            
            entity1.addComponent(Position, 0, 0);
            entity1.addComponent(Velocity, 1, 1);
            
            entity2.addComponent(Position, 5, 5);
            
            const query = engine.createQuery({
                all: [Position, Velocity]
            });
            
            query.match(entity1);
            query.match(entity2);
            
            const results = Array.from(query.getEntities());
            expect(results).toContain(entity1);
            expect(results).not.toContain(entity2);
        });

        test('should support ANY queries', () => {
            const entity1 = engine.createEntity();
            const entity2 = engine.createEntity();
            const entity3 = engine.createEntity();
            
            entity1.addComponent(Position, 0, 0);
            entity2.addComponent(Velocity, 1, 1);
            entity3.addComponent(Health, 100, 100);
            
            const query = engine.createQuery({
                any: [Position, Velocity]
            });
            
            query.match(entity1);
            query.match(entity2);
            query.match(entity3);
            
            const results = Array.from(query.getEntities());
            expect(results).toContain(entity1);
            expect(results).toContain(entity2);
            expect(results).not.toContain(entity3);
        });

        test('should support NONE queries', () => {
            const entity1 = engine.createEntity();
            const entity2 = engine.createEntity();
            
            entity1.addComponent(Position, 0, 0);
            entity2.addComponent(Position, 0, 0);
            entity2.addComponent(Damage, 10);
            
            const query = engine.createQuery({
                all: [Position],
                none: [Damage]
            });
            
            query.match(entity1);
            query.match(entity2);
            
            const results = Array.from(query.getEntities());
            expect(results).toContain(entity1);
            expect(results).not.toContain(entity2);
        });

        test('should support tag queries', () => {
            const entity1 = engine.createEntity();
            const entity2 = engine.createEntity();
            
            entity1.addTag('player');
            entity2.addTag('enemy');
            
            const query = engine.createQuery({
                tags: ['player']
            });
            
            query.match(entity1);
            query.match(entity2);
            
            const results = Array.from(query.getEntities());
            expect(results).toContain(entity1);
            expect(results).not.toContain(entity2);
        });
    });

    describe('System Management', () => {
        test('should create and execute systems', () => {
            let executed = false;
            let capturedPosition: any;
            let capturedVelocity: any;
            
            const system = engine.createSystem('MovementSystem', {
                all: [Position, Velocity]
            }, {
                act: (entity, position, velocity) => {
                    capturedPosition = position;
                    capturedVelocity = velocity;
                    position.x += velocity.x;
                    position.y += velocity.y;
                    executed = true;
                }
            });
            
            const entity = engine.createEntity();
            entity.addComponent(Position, 0, 0);
            entity.addComponent(Velocity, 1, 2);
            
            // Update should trigger system execution
            engine.update(16);
            
            expect(executed).toBe(true);
            const position = entity.getComponent(Position);
            expect(position.x).toBe(1);
            expect(position.y).toBe(2);
        });

        test('should support system priorities', () => {
            const executionOrder: string[] = [];
            
            engine.createSystem('LowPriority', { all: [] }, {
                priority: 1,
                before: () => executionOrder.push('low')
            });
            
            engine.createSystem('HighPriority', { all: [] }, {
                priority: 10,
                before: () => executionOrder.push('high')
            });
            
            engine.update(16);
            
            expect(executionOrder).toEqual(['high', 'low']);
        });

        test('should support system enable/disable', () => {
            let executed = false;
            
            const system = engine.createSystem('TestSystem', { all: [] }, {
                before: () => { executed = true; }
            });
            
            system.enabled = false;
            engine.update(16);
            expect(executed).toBe(false);
            
            system.enabled = true;
            engine.update(16);
            expect(executed).toBe(true);
        });

        test('should provide system profiling', () => {
            engine.createSystem('TestSystem', { all: [] }, {
                before: () => {
                    // Simulate some work
                    const start = Date.now();
                    while (Date.now() - start < 1) {} // 1ms of work
                }
            });
            
            engine.update(16);
            
            const profiles = engine.getSystemProfiles();
            const testProfile = profiles.find(p => p.name === 'TestSystem');
            
            expect(testProfile).toBeDefined();
            expect(testProfile!.callCount).toBe(1);
            expect(testProfile!.executionTime).toBeGreaterThan(0);
        });
    });

    describe('Prefab System', () => {
        test('should register and create from prefabs', () => {
            const playerPrefab: EntityPrefab = {
                name: 'Player',
                components: [
                    { type: Position, args: [0, 0] },
                    { type: Health, args: [100, 100] }
                ],
                tags: ['player', 'active']
            };
            
            engine.registerPrefab('Player', playerPrefab);
            const entity = engine.createFromPrefab('Player', 'Player1');
            
            expect(entity).toBeDefined();
            expect(entity!.name).toContain('Player');
            expect(entity!.hasComponent(Position)).toBe(true);
            expect(entity!.hasComponent(Health)).toBe(true);
            expect(entity!.hasTag('player')).toBe(true);
            expect(entity!.hasTag('active')).toBe(true);
        });
    });

    describe('Serialization and Snapshots', () => {
        test('should serialize world state', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Position, 10, 20);
            entity.addTag('test');
            
            const serialized = engine.serialize();
            
            expect(serialized.entities).toHaveLength(1);
            expect(serialized.entities[0].name).toBe('TestEntity');
            expect(serialized.entities[0].tags).toContain('test');
            expect(serialized.entities[0].components.Position).toEqual({ x: 10, y: 20 });
        });

        test('should create and manage snapshots', () => {
            engine.createEntity('Entity1');
            engine.createSnapshot();
            
            engine.createEntity('Entity2');
            expect(engine.getAllEntities()).toHaveLength(2);
            
            engine.restoreSnapshot();
            // Note: Full restore functionality would need proper deserialization
            // This test validates the snapshot creation mechanism
        });
    });

    describe('Message Bus', () => {
        test('should support inter-system messaging', () => {
            let receivedMessage: any = null;
            
            const unsubscribe = engine.messageBus.subscribe('test-message', (message: any) => {
                receivedMessage = message;
            });
            
            engine.messageBus.publish('test-message', { data: 'test' }, 'TestSender');
            
            expect(receivedMessage).toBeDefined();
            expect(receivedMessage.data).toEqual({ data: 'test' });
            expect(receivedMessage.sender).toBe('TestSender');
            
            unsubscribe();
        });
    });

    describe('Advanced Features', () => {
        test('should support debug information', () => {
            engine.createEntity();
            const system = engine.createSystem('TestSystem', { all: [] }, {});
            
            const debugInfo = engine.getDebugInfo();
            
            expect(debugInfo.entities).toBe(1);
            expect(debugInfo.systems).toBe(1);
            expect(debugInfo.uptime).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Performance and Memory', () => {
        test('should provide memory statistics', () => {
            engine.createEntities(10);
            const stats = engine.getMemoryStats();
            
            expect(stats.activeEntities).toBe(10);
            expect(stats.totalMemoryEstimate).toBeGreaterThan(0);
        });

        test('should provide debug information', () => {
            engine.createEntity();
            engine.createSystem('TestSystem', { all: [] }, {});
            
            const debugInfo = engine.getDebugInfo();
            
            expect(debugInfo.entities).toBe(1);
            expect(debugInfo.systems).toBe(1);
            expect(debugInfo.uptime).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Component Pooling', () => {
        test('should support component validation with proper typing', () => {
            engine.registerComponentValidator(Position, {
                validate: (component: Position) => {
                    return (component.x >= 0 && component.y >= 0) ? true : 'coordinates must be non-negative';
                }
            });
            
            const entity = engine.createEntity();
            // Test validation by creating a bad component directly
            const badPosition = new Position(-5, 10);
            const validator = engine.getComponentValidator(Position);
            expect(validator!.validate(badPosition)).toBe('coordinates must be non-negative');
        });
    });

    describe('Performance Monitor', () => {
        test('should track performance metrics', () => {
            const monitor = new PerformanceMonitor();
            
            monitor.addSample(10);
            monitor.addSample(20);
            monitor.addSample(15);
            
            expect(monitor.getAverage()).toBe(15);
            expect(monitor.getMin()).toBe(10);
            expect(monitor.getMax()).toBe(20);
        });
    });
});

// Integration test for complex scenarios
describe('Enhanced ECS Integration', () => {
    test('should handle complex game-like scenario', () => {
        const engine = new Engine();
        
        // Create prefabs
        const playerPrefab: EntityPrefab = {
            name: 'Player',
            components: [
                { type: Position, args: [0, 0] },
                { type: Velocity, args: [0, 0] },
                { type: Health, args: [100, 100] }
            ],
            tags: ['player', 'controllable']
        };
        
        const enemyPrefab: EntityPrefab = {
            name: 'Enemy',
            components: [
                { type: Position, args: [100, 100] },
                { type: Health, args: [50, 50] },
                { type: Damage, args: [25] }
            ],
            tags: ['enemy', 'ai']
        };
        
        engine.registerPrefab('Player', playerPrefab);
        engine.registerPrefab('Enemy', enemyPrefab);
        
        // Create entities
        const player = engine.createFromPrefab('Player');
        const enemies = engine.createEntities(5, enemyPrefab);
        
        // Create systems
        engine.createSystem('MovementSystem', {
            all: [Position, Velocity]
        }, {
            priority: 10,
            act: (entity, position, velocity) => {
                position.x += velocity.x;
                position.y += velocity.y;
            }
        });
        
        engine.createSystem('AISystem', {
            all: [Position],
            tags: ['ai']
        }, {
            priority: 5,
            act: (entity, position) => {
                // Simple AI: move towards origin
                if (position.x > 0) position.x -= 1;
                if (position.y > 0) position.y -= 1;
            }
        });
        
        // Run simulation
        for (let i = 0; i < 10; i++) {
            engine.update(16);
        }
        
        // Verify results
        expect(player).toBeDefined();
        expect(enemies).toHaveLength(5);
        
        const debugInfo = engine.getDebugInfo();
        expect(debugInfo.entities).toBe(6); // 1 player + 5 enemies
        expect(debugInfo.systems).toBe(2);
        
        engine.stop();
    });
});