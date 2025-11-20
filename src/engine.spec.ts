import { EngineBuilder, Engine } from './engine';
import type { EntityPrefab, SystemMessage, EntityDef } from './definitions';

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

describe('Engine v2 - Composition Architecture', () => {
    let engine: Engine;

    beforeEach(() => {
        engine = new EngineBuilder()
            .withDebugMode(true)
            .withFixedUpdateFPS(60)
            .build();

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
            const entity1 = engine.createEntity('Duplicate');
            const entity2 = engine.createEntity('Duplicate');
            const found = engine.getEntityByName('Duplicate');
            // Last one with this name wins
            expect(found).toBe(entity2);
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
                }
            });

            const entity = engine.createEntity();

            expect(() => {
                entity.addComponent(Health, -10, 100);
            }).toThrow('Health cannot be negative');
        });

        test('should enforce component dependencies', () => {
            engine.registerComponentValidator(Health, {
                validate: () => true,
                dependencies: [Position]
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
                conflicts: [Damage]
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

            engine.createSystem('TestSystem', { all: [] }, {
                before: () => { executed = true; }
            });

            engine.update(16);
            expect(executed).toBe(true);
        });

        test('should execute systems in priority order', () => {
            const executionOrder: string[] = [];

            engine.createSystem('LowPriority', { all: [] }, {
                priority: 1,
                before: () => { executionOrder.push('low'); }
            });

            engine.createSystem('HighPriority', { all: [] }, {
                priority: 100,
                before: () => { executionOrder.push('high'); }
            });

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

            engine.createSystem('MovementSystem',
                { all: [Position, Velocity] },
                {
                    act: (entity: EntityDef, pos: Position, vel: Velocity) => {
                        pos.x += vel.x;
                        pos.y += vel.y;
                        actCount++;
                    }
                }
            );

            engine.update(16);

            expect(actCount).toBe(1); // Only entity1 has both components
            expect(entity1.getComponent(Position).x).toBe(1);
            expect(entity1.getComponent(Position).y).toBe(1);
        });

        test('should support fixed update systems', () => {
            let fixedCount = 0;

            engine.createSystem('FixedSystem', { all: [] }, {
                before: () => { fixedCount++; }
            }, true); // true = fixed update

            // Simulate 3 frames at 60 FPS (16.67ms each)
            engine.update(16.67);
            expect(fixedCount).toBe(1);

            engine.update(16.67);
            expect(fixedCount).toBe(2);

            engine.update(16.67);
            expect(fixedCount).toBe(3);
        });

        test('should get system profiles', () => {
            engine.createSystem('TestSystem', { all: [] }, {
                before: () => {}
            });

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
                tags: ['player']
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
                    { type: Health, args: [100, 100] }
                ],
                tags: ['player', 'controllable']
            };

            engine.registerPrefab('Player', playerPrefab);

            const player = engine.createFromPrefab('Player', 'Hero');
            expect(player).toBeDefined();
            expect(player!.name).toBe('Hero');
            expect(player!.hasComponent(Position)).toBe(true);
            expect(player!.hasComponent(Health)).toBe(true);
            expect(player!.hasTag('player')).toBe(true);
            expect(player!.hasTag('controllable')).toBe(true);
        });

        test('should handle missing prefab gracefully', () => {
            const entity = engine.createFromPrefab('NonExistent');
            expect(entity).toBeNull();
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

            expect(restoredChild!.parent).toBe(restoredParent);
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

            const callback = () => { callCount++; };
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

            engine.on('onStart', () => { startCalled = true; });
            engine.on('onStop', () => { stopCalled = true; });

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
                    { type: Health, args: [100, 100] }
                ],
                tags: ['player', 'alive']
            };

            engine.registerPrefab('Player', playerPrefab);

            // Create player
            const player = engine.createFromPrefab('Player', 'Hero');
            expect(player).toBeDefined();

            // Create movement system
            let systemExecuted = false;
            engine.createSystem('MovementSystem',
                { all: [Position, Velocity], tags: ['alive'] },
                {
                    act: (entity: EntityDef, pos: Position, vel: Velocity) => {
                        pos.x += vel.x;
                        pos.y += vel.y;
                        systemExecuted = true;
                    }
                }
            );

            // Set velocity
            player!.getComponent(Velocity).x = 5;
            player!.getComponent(Velocity).y = 3;

            // Update
            engine.update(16);

            // Verify
            expect(systemExecuted).toBe(true);
            expect(player!.getComponent(Position).x).toBe(5);
            expect(player!.getComponent(Position).y).toBe(3);
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
                }
            };

            const pluginEngine = new EngineBuilder()
                .use(testPlugin)
                .build();

            expect(installCalled).toBe(true);
            expect(pluginEngine.hasPlugin('TestPlugin')).toBe(true);
        });

        test('should pass PluginContext to plugin.install()', () => {
            let receivedContext: any = null;
            const testPlugin = {
                name: 'TestPlugin',
                install: (context: any) => {
                    receivedContext = context;
                }
            };

            new EngineBuilder()
                .use(testPlugin)
                .build();

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
                }
            };

            const pluginEngine = new EngineBuilder()
                .use(testPlugin)
                .build();

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
                            }
                        }
                    );
                }
            };

            const pluginEngine = new EngineBuilder()
                .use(testPlugin)
                .build();

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
                }
            };

            const pluginEngine = new EngineBuilder()
                .use(testPlugin)
                .build();

            expect((pluginEngine as any).customApi).toBeDefined();
            expect((pluginEngine as any).customApi.getValue()).toBe(42);
            expect(pluginEngine.getExtension('customApi')).toBeDefined();
        });

        test('should prevent duplicate plugin installations', () => {
            const testPlugin = {
                name: 'DuplicatePlugin',
                install: () => {}
            };

            const pluginEngine = new EngineBuilder()
                .withDebugMode(true)
                .build();

            pluginEngine.installPlugin(testPlugin);
            expect(pluginEngine.hasPlugin('DuplicatePlugin')).toBe(true);

            // Try to install again - should be ignored
            pluginEngine.installPlugin(testPlugin);
            const installedPlugins = pluginEngine.getInstalledPlugins();
            const duplicates = installedPlugins.filter(p => p.plugin.name === 'DuplicatePlugin');
            expect(duplicates).toHaveLength(1);
        });

        test('should track installed plugins', () => {
            const plugin1 = { name: 'Plugin1', install: () => {} };
            const plugin2 = { name: 'Plugin2', install: () => {} };

            const pluginEngine = new EngineBuilder()
                .use(plugin1)
                .use(plugin2)
                .build();

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
                }
            };

            const pluginEngine = new EngineBuilder()
                .use(testPlugin)
                .build();

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
                    await new Promise(resolve => setTimeout(resolve, 10));
                    asyncCompleted = true;
                }
            };

            const pluginEngine = new EngineBuilder()
                .use(asyncPlugin)
                .build();

            // Give async operation time to complete
            setTimeout(() => {
                expect(asyncCompleted).toBe(true);
                expect(pluginEngine.hasPlugin('AsyncPlugin')).toBe(true);
                done();
            }, 50);
        });

        test('should allow plugins to register prefabs', () => {
            class PluginPosition {
                constructor(public x: number = 0, public y: number = 0) {}
            }

            const testPlugin = {
                name: 'PrefabPlugin',
                install: (context: any) => {
                    context.registerComponent(PluginPosition);
                    context.registerPrefab('PluginEntity', {
                        name: 'PluginEntity',
                        components: [
                            { type: PluginPosition, args: [10, 20] }
                        ],
                        tags: ['plugin-created']
                    });
                }
            };

            const pluginEngine = new EngineBuilder()
                .use(testPlugin)
                .build();

            const entity = pluginEngine.createFromPrefab('PluginEntity', 'Test');

            expect(entity).toBeDefined();
            expect(entity!.hasComponent(PluginPosition)).toBe(true);
            expect(entity!.getComponent(PluginPosition).x).toBe(10);
            expect(entity!.hasTag('plugin-created')).toBe(true);
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
                }
            };

            const pluginEngine = new EngineBuilder()
                .use(testPlugin)
                .build();

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
                }
            };

            const pluginEngine = new EngineBuilder()
                .use(testPlugin)
                .build();

            pluginEngine.emit('custom-event');

            expect(eventReceived).toBe(true);
        });

        test('should allow chaining multiple plugins', () => {
            const plugin1 = { name: 'Plugin1', install: () => {} };
            const plugin2 = { name: 'Plugin2', install: () => {} };
            const plugin3 = { name: 'Plugin3', install: () => {} };

            const builder = new EngineBuilder()
                .use(plugin1)
                .use(plugin2)
                .use(plugin3);

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
                install: () => {}
            };

            const pluginEngine = new EngineBuilder()
                .use(testPlugin)
                .build();

            const pluginInfo = pluginEngine.getPlugin('InfoPlugin');

            expect(pluginInfo).toBeDefined();
            expect(pluginInfo!.plugin.name).toBe('InfoPlugin');
            expect(pluginInfo!.plugin.version).toBe('2.0.0');
            expect(pluginInfo!.installedAt).toBeGreaterThan(0);
        });

        test('should prevent duplicate extension names', () => {
            const plugin1 = {
                name: 'Plugin1',
                install: (context: any) => {
                    context.extend('sharedApi', { value: 1 });
                }
            };

            const plugin2 = {
                name: 'Plugin2',
                install: (context: any) => {
                    expect(() => {
                        context.extend('sharedApi', { value: 2 });
                    }).toThrow("Extension 'sharedApi' already exists");
                }
            };

            const pluginEngine = new EngineBuilder()
                .use(plugin1)
                .use(plugin2)
                .build();

            expect((pluginEngine as any).sharedApi.value).toBe(1);
        });
    });
});
