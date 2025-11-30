/**
 * Plugin System Integration Tests
 *
 * These tests verify cross-plugin interactions and type extension behavior.
 */
import {
    Engine,
    EngineBuilder,
    EnginePlugin,
    ExtractPluginExtensions,
    PluginContext,
    Query,
} from './index';

describe('Plugin System Integration Tests', () => {
    describe('Cross-Plugin Interactions', () => {
        // Shared components for testing
        class Position {
            constructor(
                public x = 0,
                public y = 0
            ) {}
        }

        class Velocity {
            constructor(
                public dx = 0,
                public dy = 0
            ) {}
        }

        class Health {
            constructor(
                public current = 100,
                public max = 100
            ) {}
        }

        it('should allow plugins to create entities that other plugins can query', () => {
            // Plugin A creates entities
            const entityCreatorPlugin: EnginePlugin = {
                name: 'EntityCreator',
                install(context) {
                    context.registerComponent(Position);
                    context.registerComponent(Velocity);

                    // Create some entities during installation using getEngine()
                    const engine = context.getEngine() as Engine;
                    const e1 = engine.createEntity('Entity1');
                    e1.addComponent(Position, 10, 20);
                    e1.addComponent(Velocity, 1, 2);

                    const e2 = engine.createEntity('Entity2');
                    e2.addComponent(Position, 30, 40);
                    e2.addComponent(Velocity, 3, 4);
                },
            };

            // Plugin B queries entities created by Plugin A
            let queriedEntities: number = 0;
            const entityQueryPlugin: EnginePlugin = {
                name: 'EntityQuery',
                install(context) {
                    // Query for entities with Position and Velocity
                    const query = context.createQuery({ all: [Position, Velocity] }) as Query<
                        [Position, Velocity]
                    >;
                    queriedEntities = query.size;
                },
            };

            const engine = new EngineBuilder()
                .use(entityCreatorPlugin)
                .use(entityQueryPlugin)
                .build();

            expect(queriedEntities).toBe(2);
            expect(engine.entityCount).toBe(2);
        });

        it('should allow plugins to register systems that process components from other plugins', () => {
            let processedPositions: Array<{ x: number; y: number }> = [];

            // Plugin A registers Position component
            const positionPlugin: EnginePlugin = {
                name: 'PositionPlugin',
                install(context) {
                    context.registerComponent(Position);
                },
            };

            // Plugin B creates a system that uses Position from Plugin A
            const movementPlugin: EnginePlugin = {
                name: 'MovementPlugin',
                install(context) {
                    context.createSystem(
                        'MovementSystem',
                        { all: [Position] },
                        {
                            priority: 10,
                            act: (_entity, position: Position) => {
                                processedPositions.push({ x: position.x, y: position.y });
                            },
                        }
                    );
                },
            };

            const engine = new EngineBuilder().use(positionPlugin).use(movementPlugin).build();

            // Create entities after plugins are installed
            engine.createEntity('E1').addComponent(Position, 100, 200);
            engine.createEntity('E2').addComponent(Position, 300, 400);

            engine.update(0.016);

            expect(processedPositions).toHaveLength(2);
            expect(processedPositions).toContainEqual({ x: 100, y: 200 });
            expect(processedPositions).toContainEqual({ x: 300, y: 400 });
        });

        it('should allow plugins to communicate via message bus', () => {
            const receivedMessages: Array<{ type: string; data: unknown }> = [];

            // Plugin A publishes messages
            const publisherPlugin: EnginePlugin = {
                name: 'Publisher',
                install(context) {
                    // Extend engine with a publish helper
                    context.extend('publisher', {
                        notify: (data: unknown) => {
                            context.messageBus.publish('notification', data);
                        },
                    });
                },
            };

            // Plugin B subscribes to messages
            const subscriberPlugin: EnginePlugin = {
                name: 'Subscriber',
                install(context) {
                    context.messageBus.subscribe('notification', (message) => {
                        receivedMessages.push({ type: 'notification', data: message.data });
                    });
                },
            };

            const engine = new EngineBuilder()
                .use(subscriberPlugin) // Order matters - subscribe before publish
                .use(publisherPlugin)
                .build();

            // Use the publisher extension
            (engine as unknown as { publisher: { notify: (d: unknown) => void } }).publisher.notify(
                {
                    event: 'test',
                }
            );

            expect(receivedMessages).toHaveLength(1);
            expect(receivedMessages[0]!.data).toEqual({ event: 'test' });
        });

        it('should allow plugins to share event subscriptions', () => {
            const events: string[] = [];

            // Plugin A emits events
            const eventEmitterPlugin: EnginePlugin = {
                name: 'EventEmitter',
                install(context) {
                    context.extend('emitter', {
                        emitCustom: () => context.emit('customEvent'),
                    });
                },
            };

            // Plugin B listens to events
            const eventListenerPlugin: EnginePlugin = {
                name: 'EventListener',
                install(context) {
                    context.on('customEvent', () => {
                        events.push('customEvent received');
                    });
                },
            };

            const engine = new EngineBuilder()
                .use(eventListenerPlugin)
                .use(eventEmitterPlugin)
                .build();

            (engine as unknown as { emitter: { emitCustom: () => void } }).emitter.emitCustom();

            expect(events).toContain('customEvent received');
        });

        it('should allow plugins to extend each other through engine extensions', () => {
            interface PluginAExtension {
                pluginAApi: {
                    getValue: () => number;
                };
            }

            interface PluginBExtension {
                pluginBApi: {
                    usePluginA: () => number;
                };
            }

            // Plugin A provides a base API
            class PluginA implements EnginePlugin<PluginAExtension> {
                name = 'PluginA';
                declare readonly __extensions: PluginAExtension;

                install(context: PluginContext): void {
                    context.extend('pluginAApi', {
                        getValue: () => 42,
                    });
                }
            }

            // Plugin B uses Plugin A's API
            class PluginB implements EnginePlugin<PluginBExtension> {
                name = 'PluginB';
                declare readonly __extensions: PluginBExtension;

                install(context: PluginContext): void {
                    context.extend('pluginBApi', {
                        usePluginA: () => {
                            // Access Plugin A's extension through the engine
                            const pluginAApi = (context.getEngine() as unknown as PluginAExtension)
                                .pluginAApi;
                            return pluginAApi.getValue() * 2;
                        },
                    });
                }
            }

            const engine = new EngineBuilder().use(new PluginA()).use(new PluginB()).build();

            expect(engine.pluginAApi.getValue()).toBe(42);
            expect(engine.pluginBApi.usePluginA()).toBe(84);
        });

        it('should handle plugin dependencies with prefabs', () => {
            // Plugin A defines base components
            const basePlugin: EnginePlugin = {
                name: 'BasePlugin',
                install(context) {
                    context.registerComponent(Position);
                    context.registerComponent(Health);
                },
            };

            // Plugin B creates prefabs using Plugin A's components
            const prefabPlugin: EnginePlugin = {
                name: 'PrefabPlugin',
                install(context) {
                    context.registerPrefab('Enemy', {
                        name: 'Enemy',
                        components: [
                            { type: Position, args: [0, 0] },
                            { type: Health, args: [50, 50] },
                        ],
                        tags: ['enemy', 'hostile'],
                    });

                    context.registerPrefab('Player', {
                        name: 'Player',
                        components: [
                            { type: Position, args: [100, 100] },
                            { type: Health, args: [100, 100] },
                        ],
                        tags: ['player'],
                    });
                },
            };

            const engine = new EngineBuilder().use(basePlugin).use(prefabPlugin).build();

            const enemy = engine.createFromPrefab('Enemy', 'E1');
            const player = engine.createFromPrefab('Player', 'P1');

            expect(enemy).toBeDefined();
            expect(enemy!.hasComponent(Position)).toBe(true);
            expect(enemy!.getComponent(Health).current).toBe(50);
            expect(enemy!.hasTag('hostile')).toBe(true);

            expect(player).toBeDefined();
            expect(player!.hasComponent(Position)).toBe(true);
            expect(player!.getComponent(Health).current).toBe(100);
            expect(player!.hasTag('player')).toBe(true);
        });
    });

    describe('Type Extension Validation', () => {
        it('should correctly merge multiple plugin type extensions', () => {
            interface APIExtension {
                api: { method: () => string };
            }

            interface UtilsExtension {
                utils: { helper: () => number };
            }

            // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Compile-time type test
            type _CombinedExtension = APIExtension & UtilsExtension;

            class APIPlugin implements EnginePlugin<APIExtension> {
                name = 'APIPlugin';
                declare readonly __extensions: APIExtension;

                install(context: PluginContext): void {
                    context.extend('api', { method: () => 'api result' });
                }
            }

            class UtilsPlugin implements EnginePlugin<UtilsExtension> {
                name = 'UtilsPlugin';
                declare readonly __extensions: UtilsExtension;

                install(context: PluginContext): void {
                    context.extend('utils', { helper: () => 123 });
                }
            }

            const engine = new EngineBuilder().use(new APIPlugin()).use(new UtilsPlugin()).build();

            // Both extensions should be available with correct types
            expect(engine.api.method()).toBe('api result');
            expect(engine.utils.helper()).toBe(123);
        });

        it('should preserve engine type while adding extensions', () => {
            interface CustomExtension {
                custom: { value: number };
            }

            class CustomPlugin implements EnginePlugin<CustomExtension> {
                name = 'CustomPlugin';
                declare readonly __extensions: CustomExtension;

                install(context: PluginContext): void {
                    context.extend('custom', { value: 42 });
                }
            }

            const engine = new EngineBuilder().use(new CustomPlugin()).build();

            // Engine base methods should still work
            expect(typeof engine.createEntity).toBe('function');
            expect(typeof engine.update).toBe('function');
            expect(typeof engine.createQuery).toBe('function');

            // Extension should be available
            expect(engine.custom.value).toBe(42);
        });

        it('should type ExtractPluginExtensions correctly', () => {
            interface TestExtension {
                test: { run: () => boolean };
            }

            class TestPlugin implements EnginePlugin<TestExtension> {
                name = 'TestPlugin';
                declare readonly __extensions: TestExtension;

                install(context: PluginContext): void {
                    context.extend('test', { run: () => true });
                }
            }

            // Compile-time type check - using underscore prefix for unused type
            type _Extracted = ExtractPluginExtensions<TestPlugin>;

            // This would be a compile error if types were wrong:
            const engine = new EngineBuilder().use(new TestPlugin()).build();
            const result: boolean = engine.test.run();

            expect(result).toBe(true);
        });
    });

    describe('Plugin Lifecycle Integration', () => {
        it('should install and uninstall plugins without affecting other plugins', async () => {
            class ComponentA {
                value = 1;
            }
            class ComponentB {
                value = 2;
            }

            let pluginAInstalled = false;
            let pluginBInstalled = false;

            const pluginA: EnginePlugin = {
                name: 'PluginA',
                install(context) {
                    context.registerComponent(ComponentA);
                    pluginAInstalled = true;
                },
                uninstall() {
                    pluginAInstalled = false;
                },
            };

            const pluginB: EnginePlugin = {
                name: 'PluginB',
                install(context) {
                    context.registerComponent(ComponentB);
                    pluginBInstalled = true;
                },
            };

            const engine = new EngineBuilder().use(pluginA).use(pluginB).build();

            expect(pluginAInstalled).toBe(true);
            expect(pluginBInstalled).toBe(true);

            // Create entities using both plugins' components
            const entity = engine.createEntity('Test');
            entity.addComponent(ComponentA);
            entity.addComponent(ComponentB);

            expect(entity.hasComponent(ComponentA)).toBe(true);
            expect(entity.hasComponent(ComponentB)).toBe(true);

            // Uninstall plugin A
            await engine.uninstallPlugin('PluginA');

            expect(pluginAInstalled).toBe(false);
            expect(pluginBInstalled).toBe(true);
            expect(engine.hasPlugin('PluginA')).toBe(false);
            expect(engine.hasPlugin('PluginB')).toBe(true);

            // Existing entity with ComponentA should still work (components are not removed)
            expect(entity.hasComponent(ComponentA)).toBe(true);
        });

        it('should handle async plugin initialization order', async () => {
            const initOrder: string[] = [];

            const slowPlugin: EnginePlugin = {
                name: 'SlowPlugin',
                async install() {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    initOrder.push('SlowPlugin');
                },
            };

            const fastPlugin: EnginePlugin = {
                name: 'FastPlugin',
                install() {
                    initOrder.push('FastPlugin');
                },
            };

            const engine = new EngineBuilder().use(slowPlugin).use(fastPlugin).build();

            // Wait for async initialization
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Both plugins should be installed
            expect(engine.hasPlugin('SlowPlugin')).toBe(true);
            expect(engine.hasPlugin('FastPlugin')).toBe(true);

            // Fast plugin runs synchronously, slow plugin completes later
            // (exact order depends on implementation)
            expect(initOrder).toContain('SlowPlugin');
            expect(initOrder).toContain('FastPlugin');
        });
    });

    describe('Plugin Error Handling', () => {
        it('should handle plugin installation errors gracefully', () => {
            const errorPlugin: EnginePlugin = {
                name: 'ErrorPlugin',
                install() {
                    throw new Error('Installation failed');
                },
            };

            const safePlugin: EnginePlugin = {
                name: 'SafePlugin',
                install() {
                    // No-op
                },
            };

            // Error during build should not crash
            expect(() => {
                new EngineBuilder().use(safePlugin).use(errorPlugin).build();
            }).toThrow('Installation failed');
        });

        it('should allow plugins to validate their dependencies', () => {
            class RequiredComponent {
                value = 0;
            }

            let dependencyMet = false;

            // Plugin that requires a specific component to be registered
            const dependentPlugin: EnginePlugin = {
                name: 'DependentPlugin',
                install(context) {
                    // Check if required component exists
                    try {
                        const query = context.createQuery({ all: [RequiredComponent] });
                        dependencyMet = query !== undefined;
                    } catch {
                        dependencyMet = false;
                    }
                },
            };

            // Plugin that provides the required component
            const providerPlugin: EnginePlugin = {
                name: 'ProviderPlugin',
                install(context) {
                    context.registerComponent(RequiredComponent);
                },
            };

            // Install provider first, then dependent
            // Using _engine to indicate intentionally unused variable
            const _engine = new EngineBuilder().use(providerPlugin).use(dependentPlugin).build();

            expect(dependencyMet).toBe(true);
        });
    });

    describe('Real-World Plugin Scenarios', () => {
        it('should support a complete game plugin ecosystem', () => {
            // Physics component
            class RigidBody {
                constructor(
                    public mass = 1,
                    public velocity = { x: 0, y: 0 }
                ) {}
            }

            // Render component
            class Sprite {
                constructor(public texture = 'default') {}
            }

            // Core physics plugin
            interface PhysicsExtension {
                physics: {
                    setGravity: (g: number) => void;
                    getGravity: () => number;
                };
            }

            class PhysicsPlugin implements EnginePlugin<PhysicsExtension> {
                name = 'PhysicsPlugin';
                declare readonly __extensions: PhysicsExtension;

                private gravity = 9.8;

                install(context: PluginContext): void {
                    context.registerComponent(RigidBody);

                    context.createSystem(
                        'PhysicsSystem',
                        { all: [RigidBody] },
                        {
                            priority: 100,
                            act: (_entity, rb: RigidBody) => {
                                rb.velocity.y += this.gravity * 0.016; // Apply gravity
                            },
                        }
                    );

                    context.extend('physics', {
                        setGravity: (g: number) => {
                            this.gravity = g;
                        },
                        getGravity: () => this.gravity,
                    });
                }
            }

            // Rendering plugin
            const renderPlugin: EnginePlugin = {
                name: 'RenderPlugin',
                install(context) {
                    context.registerComponent(Sprite);

                    context.createSystem(
                        'RenderSystem',
                        { all: [Sprite] },
                        {
                            priority: -100, // Run after physics
                            act: () => {
                                // Render logic would go here
                            },
                        }
                    );
                },
            };

            // Game-specific plugin that uses both
            let entitiesProcessed = 0;
            const gamePlugin: EnginePlugin = {
                name: 'GamePlugin',
                install(context) {
                    context.registerPrefab('Player', {
                        name: 'Player',
                        components: [
                            { type: RigidBody, args: [10, { x: 0, y: 0 }] },
                            { type: Sprite, args: ['player.png'] },
                        ],
                        tags: ['player'],
                    });

                    context.createSystem(
                        'GameSystem',
                        { all: [RigidBody, Sprite] },
                        {
                            priority: 0,
                            act: () => {
                                entitiesProcessed++;
                            },
                        }
                    );
                },
            };

            const engine = new EngineBuilder()
                .use(new PhysicsPlugin())
                .use(renderPlugin)
                .use(gamePlugin)
                .build();

            // Create a player from prefab
            const player = engine.createFromPrefab('Player', 'MainPlayer');

            expect(player).toBeDefined();
            expect(player!.hasComponent(RigidBody)).toBe(true);
            expect(player!.hasComponent(Sprite)).toBe(true);

            // Run the game loop
            engine.update(0.016);

            // All systems should have processed the player
            expect(entitiesProcessed).toBe(1);

            // Physics API should work
            engine.physics.setGravity(20);
            expect(engine.physics.getGravity()).toBe(20);
        });
    });
});
