/**
 * OrionECS Engine Module
 *
 * Composition-based Engine architecture (v2.0) using focused managers for separation of concerns.
 *
 * @packageDocumentation
 * @module Engine
 */

import { CommandBuffer, type CommandExecutionResult } from './commands';
import {
    type Entity,
    EntityManager,
    EventEmitter,
    PerformanceMonitor,
    type Query,
    QueryBuilder,
    System,
} from './core';
import type {
    ComponentIdentifier,
    ComponentPoolOptions,
    ComponentTypes,
    ComponentValidator,
    EnginePlugin,
    EntityPrefab,
    ExtractPluginExtensions,
    InstalledPlugin,
    MemoryStats,
    PluginContext,
    PoolStats,
    QueryOptions,
    SerializedWorld,
    SystemProfile,
    SystemType,
} from './definitions';
import {
    ChangeTrackingManager,
    ComponentManager,
    MessageManager,
    PrefabManager,
    QueryManager,
    SnapshotManager,
    SystemManager,
} from './managers';

/**
 * Fluent builder for composing and configuring an ECS Engine instance.
 *
 * The EngineBuilder provides a chainable API for configuring all aspects of the engine
 * before construction, including debug mode, fixed update settings, archetype system,
 * and plugin registration.
 *
 * @typeParam TExtensions - Accumulated type extensions from registered plugins.
 *   This type grows as plugins are added via use(), and determines the final
 *   Engine type returned by build().
 *
 * @example Basic usage
 * ```typescript
 * const engine = new EngineBuilder()
 *   .withDebugMode(true)
 *   .withFixedUpdateFPS(60)
 *   .withArchetypes(true)
 *   .build();
 * ```
 *
 * @example With typed plugins (full intellisense support)
 * ```typescript
 * const engine = new EngineBuilder()
 *   .use(new PhysicsPlugin())     // Adds { physics: PhysicsAPI }
 *   .use(new SpatialPlugin())     // Adds { spatial: SpatialAPI }
 *   .build();
 *
 * // Full autocomplete and type checking!
 * engine.physics.setGravity(0, 9.8);
 * engine.spatial.query(bounds);
 * ```
 *
 * @public
 */
export class EngineBuilder<TExtensions extends object = object> {
    private componentManager = new ComponentManager();
    private systemManager?: SystemManager;
    private queryManager = new QueryManager();
    private prefabManager = new PrefabManager();
    private snapshotManager?: SnapshotManager;
    private messageManager = new MessageManager();
    private eventEmitter = new EventEmitter();
    private entityManager?: EntityManager;
    private performanceMonitor = new PerformanceMonitor();
    private changeTrackingManager?: ChangeTrackingManager;

    private fixedUpdateFPS: number = 60;
    private maxFixedIterations: number = 10;
    private debugMode: boolean = false;
    private maxSnapshots: number = 10;
    private plugins: EnginePlugin[] = [];
    private enableArchetypeSystem: boolean = true; // Enable archetypes by default
    private profilingEnabled: boolean = true; // Enable profiling by default for backward compatibility
    private changeTrackingOptions: any = {
        enableProxyTracking: false,
        batchMode: false,
        debounceMs: 0,
    };

    /**
     * Enable or disable debug mode for enhanced logging and error messages.
     *
     * When enabled, the engine will log detailed information about entity operations,
     * component changes, system execution, and performance metrics. This is useful
     * during development but should be disabled in production.
     *
     * @param enabled - Whether to enable debug mode (default: false)
     * @returns This builder instance for method chaining
     *
     * @example
     * ```typescript
     * const engine = new EngineBuilder()
     *   .withDebugMode(true)  // Enable verbose logging
     *   .build();
     * ```
     */
    withDebugMode(enabled: boolean): this {
        this.debugMode = enabled;
        return this;
    }

    /**
     * Configure the frames per second for fixed update systems.
     *
     * Fixed update systems run at a constant rate independent of the rendering framerate,
     * making them ideal for physics simulations and other time-critical logic.
     *
     * @param fps - Target frames per second for fixed updates (default: 60)
     * @returns This builder instance for method chaining
     *
     * @example
     * ```typescript
     * const engine = new EngineBuilder()
     *   .withFixedUpdateFPS(120)  // Run physics at 120 FPS
     *   .build();
     * ```
     */
    withFixedUpdateFPS(fps: number): this {
        this.fixedUpdateFPS = fps;
        return this;
    }

    /**
     * Set the maximum number of fixed update iterations allowed per frame.
     *
     * This prevents the "spiral of death" where the simulation falls too far behind
     * and tries to catch up by running many fixed updates in a single frame.
     *
     * @param iterations - Maximum fixed update iterations per frame (default: 10)
     * @returns This builder instance for method chaining
     *
     * @example
     * ```typescript
     * const engine = new EngineBuilder()
     *   .withMaxFixedIterations(5)  // Limit to 5 iterations
     *   .build();
     * ```
     */
    withMaxFixedIterations(iterations: number): this {
        this.maxFixedIterations = iterations;
        return this;
    }

    /**
     * Configure the maximum number of world state snapshots to retain.
     *
     * Snapshots allow you to save and restore the complete state of the ECS world,
     * useful for save/load systems, time rewind features, and debugging.
     *
     * @param max - Maximum number of snapshots to keep in memory (default: 10)
     * @returns This builder instance for method chaining
     *
     * @example
     * ```typescript
     * const engine = new EngineBuilder()
     *   .withMaxSnapshots(20)  // Keep 20 save states
     *   .build();
     * ```
     */
    withMaxSnapshots(max: number): this {
        this.maxSnapshots = max;
        return this;
    }

    /**
     * Enable or disable the archetype system for improved performance.
     *
     * When enabled, entities with the same component composition are grouped together
     * in contiguous memory (archetypes), dramatically improving cache locality and
     * iteration performance. This provides 2-5x performance improvements for systems
     * iterating over many entities.
     *
     * Archetypes are enabled by default and recommended for production use. Disable
     * only when prototyping with frequently changing component structures.
     *
     * @param enabled - Whether to enable the archetype system (default: true)
     * @returns This builder instance for method chaining
     *
     * @example
     * ```typescript
     * const engine = new EngineBuilder()
     *   .withArchetypes(true)  // Enable for performance
     *   .build();
     * ```
     *
     * @see {@link https://github.com/tyevco/OrionECS#archetype-system | Archetype System Documentation}
     */
    withArchetypes(enabled: boolean): this {
        this.enableArchetypeSystem = enabled;
        return this;
    }

    /**
     * Enable or disable system profiling for performance monitoring.
     *
     * When enabled (default), the engine tracks execution time, entity count, and call count
     * for each system. This data is available via `engine.getSystemProfiles()` and is useful
     * for debugging and optimization.
     *
     * Disable profiling in production builds to eliminate the overhead of `performance.now()`
     * calls during system execution. The overhead is small but can add up with many systems.
     *
     * @param enabled - Whether to enable system profiling (default: true)
     * @returns This builder instance for method chaining
     *
     * @example
     * ```typescript
     * // Development build with profiling
     * const devEngine = new EngineBuilder()
     *   .withProfiling(true)
     *   .withDebugMode(true)
     *   .build();
     *
     * // Production build without profiling overhead
     * const prodEngine = new EngineBuilder()
     *   .withProfiling(false)
     *   .build();
     * ```
     *
     * @example Accessing profiling data
     * ```typescript
     * const profiles = engine.getSystemProfiles();
     * for (const profile of profiles) {
     *   console.log(`${profile.name}: ${profile.averageTime.toFixed(2)}ms avg`);
     * }
     * ```
     */
    withProfiling(enabled: boolean): this {
        this.profilingEnabled = enabled;
        return this;
    }

    /**
     * Configure component change tracking options
     *
     * Enables reactive programming patterns by tracking component changes and emitting events.
     * Supports manual dirty flagging, automatic Proxy-based detection, and performance optimizations.
     *
     * @param options - Change tracking configuration
     * @param options.enableProxyTracking - Enable automatic Proxy-based change detection (default: false)
     * @param options.batchMode - Start in batch mode (events suspended) (default: false)
     * @param options.debounceMs - Debounce change events in milliseconds (default: 0)
     * @returns This builder instance for method chaining
     *
     * @example
     * ```typescript
     * const engine = new EngineBuilder()
     *   .withChangeTracking({
     *     enableProxyTracking: true,
     *     debounceMs: 50
     *   })
     *   .build();
     * ```
     */
    withChangeTracking(options: {
        enableProxyTracking?: boolean;
        batchMode?: boolean;
        debounceMs?: number;
    }): this {
        this.changeTrackingOptions = { ...this.changeTrackingOptions, ...options };
        return this;
    }

    /**
     * Register a plugin to extend the engine with additional functionality.
     *
     * Plugins are installed during the build() phase and can register components,
     * create systems, and extend the engine API with custom methods.
     *
     * When a plugin defines type extensions (via the TExtensions generic parameter),
     * those types are accumulated and will be available on the Engine returned by build().
     *
     * @typeParam TPlugin - The plugin type, used to extract its extension types
     * @param plugin - The plugin instance to register
     * @returns A new builder type with accumulated extension types for method chaining
     *
     * @example Single plugin
     * ```typescript
     * import { PhysicsPlugin } from 'orion-ecs/plugins/physics';
     *
     * const engine = new EngineBuilder()
     *   .use(new PhysicsPlugin({ gravity: -9.8 }))
     *   .build();
     *
     * engine.physics.setGravity(0, 9.8);  // ✅ Full intellisense
     * ```
     *
     * @example Multiple plugins with type accumulation
     * ```typescript
     * const engine = new EngineBuilder()
     *   .use(new PhysicsPlugin())    // Adds { physics: PhysicsAPI }
     *   .use(new SpatialPlugin())    // Adds { spatial: SpatialAPI }
     *   .use(new DebugPlugin())      // Adds { debug: DebugAPI }
     *   .build();
     *
     * // All plugin APIs available with full type checking
     * engine.physics.applyForce(entity, force);
     * engine.spatial.query(bounds);
     * engine.debug.showColliders();
     * ```
     */
    use<TPlugin extends EnginePlugin<any>>(
        plugin: TPlugin
    ): EngineBuilder<TExtensions & ExtractPluginExtensions<TPlugin>> {
        this.plugins.push(plugin);
        // Cast is safe: we're returning the same instance with updated type info
        return this as unknown as EngineBuilder<TExtensions & ExtractPluginExtensions<TPlugin>>;
    }

    /**
     * Build and return a fully configured Engine instance.
     *
     * This method initializes all internal managers, installs registered plugins,
     * and returns a ready-to-use Engine. After calling build(), this builder
     * instance should not be used again.
     *
     * The returned Engine type includes all extension types from registered plugins,
     * providing full intellisense and type checking for plugin APIs.
     *
     * @returns A fully configured Engine instance with all plugin extension types
     *
     * @example Basic usage
     * ```typescript
     * const engine = new EngineBuilder()
     *   .withDebugMode(true)
     *   .withFixedUpdateFPS(60)
     *   .build();
     *
     * // Engine is ready to use
     * const player = engine.createEntity('Player');
     * ```
     *
     * @example With typed plugins
     * ```typescript
     * const engine = new EngineBuilder()
     *   .use(new PhysicsPlugin())
     *   .use(new SpatialPlugin())
     *   .build();
     *
     * // TypeScript knows about plugin extensions
     * engine.physics.setGravity(0, 9.8);  // ✅ Type-safe
     * engine.spatial.query(bounds);        // ✅ Type-safe
     * ```
     */
    build(): Engine & TExtensions {
        // Enable archetype system if requested
        if (this.enableArchetypeSystem) {
            this.componentManager.enableArchetypes();
            if (this.debugMode) {
                console.log('[ECS Debug] Archetype system enabled for improved performance');
            }
        }

        // Create system manager with configured settings
        this.systemManager = new SystemManager(this.fixedUpdateFPS, this.maxFixedIterations);

        // Create snapshot manager with configured settings
        this.snapshotManager = new SnapshotManager(this.maxSnapshots);

        // Create entity manager with dependencies
        this.entityManager = new EntityManager(this.componentManager, this.eventEmitter);

        // Wire up query manager with component manager for archetype support
        this.queryManager.setComponentManager(this.componentManager);

        // Create change tracking manager
        this.changeTrackingManager = new ChangeTrackingManager(
            this.componentManager,
            this.eventEmitter,
            this.changeTrackingOptions
        );

        const engine = new Engine(
            this.entityManager,
            this.componentManager,
            this.systemManager,
            this.queryManager,
            this.prefabManager,
            this.snapshotManager,
            this.messageManager,
            this.changeTrackingManager,
            this.eventEmitter,
            this.performanceMonitor,
            this.debugMode,
            this.profilingEnabled
        );

        // Install all registered plugins
        for (const plugin of this.plugins) {
            engine.installPlugin(plugin);
        }

        // Cast is safe: plugins add their extensions to the engine at runtime
        // and we've accumulated their types via the TExtensions generic parameter
        return engine as Engine & TExtensions;
    }
}

/**
 * The main Engine class providing a comprehensive API for the Entity Component System.
 *
 * The Engine serves as a facade over specialized managers, providing a clean and unified
 * interface for all ECS operations including entity management, component operations,
 * system execution, queries, prefabs, snapshots, and inter-system messaging.
 *
 * @remarks
 * Create an Engine instance using {@link EngineBuilder}:
 *
 * ```typescript
 * const engine = new EngineBuilder()
 *   .withDebugMode(true)
 *   .withArchetypes(true)
 *   .build();
 * ```
 *
 * The Engine coordinates several specialized managers:
 * - **EntityManager**: Entity lifecycle and pooling
 * - **ComponentManager**: Component registration and storage
 * - **SystemManager**: System execution and scheduling
 * - **QueryManager**: Entity queries and filtering
 * - **PrefabManager**: Entity templates
 * - **SnapshotManager**: World state serialization
 * - **MessageManager**: Inter-system communication
 *
 * @example Basic Usage
 * ```typescript
 * // Create entities
 * const player = engine.createEntity('Player');
 * player.addComponent(Position, 0, 0);
 * player.addComponent(Velocity, 1, 1);
 *
 * // Create systems
 * engine.createSystem('Movement', { all: [Position, Velocity] }, {
 *   act: (entity, position, velocity) => {
 *     position.x += velocity.x;
 *     position.y += velocity.y;
 *   }
 * });
 *
 * // Update loop
 * function gameLoop(deltaTime: number) {
 *   engine.update(deltaTime);
 *   requestAnimationFrame(gameLoop);
 * }
 * ```
 *
 * @public
 */
export class Engine {
    private running: boolean = false;
    private lastUpdateTime: number = 0;
    private installedPlugins: Map<string, InstalledPlugin> = new Map();
    private extensions: Map<string, any> = new Map();

    // Transaction state
    private inTransaction: boolean = false;
    private pendingQueryUpdates: Set<Entity> = new Set();

    // Command buffer for deferred entity operations
    private commandBuffer: CommandBuffer;

    // Control whether commands are automatically executed during update
    private autoExecuteCommands: boolean = true;

    constructor(
        private entityManager: EntityManager,
        private componentManager: ComponentManager,
        private systemManager: SystemManager,
        private queryManager: QueryManager,
        private prefabManager: PrefabManager,
        private snapshotManager: SnapshotManager,
        private messageManager: MessageManager,
        private changeTrackingManager: ChangeTrackingManager,
        private eventEmitter: EventEmitter,
        private performanceMonitor: PerformanceMonitor,
        private debugMode: boolean,
        private profilingEnabled: boolean = true
    ) {
        // Subscribe to entity changes to update queries
        this.eventEmitter.on('onComponentAdded', (entity: Entity) => {
            if (this.inTransaction) {
                this.pendingQueryUpdates.add(entity);
            } else {
                this.queryManager.updateQueries(entity);
            }
        });
        this.eventEmitter.on('onComponentRemoved', (entity: Entity) => {
            if (this.inTransaction) {
                this.pendingQueryUpdates.add(entity);
            } else {
                this.queryManager.updateQueries(entity);
            }
        });
        this.eventEmitter.on('onTagChanged', (entity: Entity) => {
            if (this.inTransaction) {
                this.pendingQueryUpdates.add(entity);
            } else {
                this.queryManager.updateQueries(entity);
            }
        });

        // Initialize command buffer for deferred entity operations
        this.commandBuffer = new CommandBuffer(this, debugMode);
    }

    // ========== Entity Commands / Deferred Operations ==========

    /**
     * Access the command buffer for deferred entity operations.
     *
     * The command buffer provides a safe way to perform entity operations during system
     * execution without causing iterator invalidation or archetype transition issues.
     * Commands are queued and executed at the end of the update cycle.
     *
     * @returns The command buffer instance
     *
     * @example Spawning entities safely during system execution
     * ```typescript
     * engine.createSystem('BulletSpawner', { all: [Weapon, Position] }, {
     *   act: (entity, weapon, position) => {
     *     if (weapon.shouldFire) {
     *       engine.commands.spawn()
     *         .named('Bullet')
     *         .with(Position, position.x, position.y)
     *         .with(Velocity, weapon.direction.x * 500, weapon.direction.y * 500)
     *         .with(Damage, weapon.damage);
     *     }
     *   }
     * });
     * ```
     *
     * @example Modifying entities during iteration
     * ```typescript
     * engine.createSystem('DamageSystem', { all: [Health, DamageReceiver] }, {
     *   act: (entity, health, receiver) => {
     *     health.current -= receiver.pendingDamage;
     *     if (health.current <= 0) {
     *       engine.commands.despawn(entity);
     *     }
     *   }
     * });
     * ```
     *
     * @public
     */
    get commands(): CommandBuffer {
        return this.commandBuffer;
    }

    /**
     * Set whether commands should be automatically executed at the end of each update.
     *
     * When enabled (default), all pending commands are executed automatically after
     * systems run and before entity cleanup. Disable this if you need manual control
     * over when commands are processed.
     *
     * @param enabled - Whether to auto-execute commands (default: true)
     *
     * @example
     * ```typescript
     * // Disable automatic execution for manual control
     * engine.setAutoExecuteCommands(false);
     *
     * // Queue some commands during update
     * engine.update(deltaTime);
     *
     * // Manually execute when ready
     * const result = engine.commands.execute();
     * ```
     *
     * @public
     */
    setAutoExecuteCommands(enabled: boolean): void {
        this.autoExecuteCommands = enabled;
        if (this.debugMode) {
            console.log(`[ECS Debug] Auto-execute commands: ${enabled}`);
        }
    }

    /**
     * Check if auto-execute commands is enabled.
     *
     * @returns Whether commands are automatically executed during update
     *
     * @public
     */
    isAutoExecuteCommandsEnabled(): boolean {
        return this.autoExecuteCommands;
    }

    /**
     * Execute all pending commands immediately.
     *
     * This is a convenience method that delegates to `engine.commands.execute()`.
     * Useful for executing commands outside of the normal update cycle.
     *
     * @param options - Execution options
     * @returns Command execution result with statistics
     *
     * @public
     */
    executeCommands(options: { rollbackOnError?: boolean } = {}): CommandExecutionResult {
        return this.commandBuffer.execute(options);
    }

    // ========== Entity Management ==========

    /**
     * Create a new entity with an optional name.
     *
     * Entities are retrieved from an object pool for performance. Each entity receives
     * a unique symbol ID and an incrementing numeric ID.
     *
     * @param name - Optional human-readable name for the entity
     * @returns The newly created entity
     *
     * @example
     * ```typescript
     * const enemy = engine.createEntity('Goblin');
     * enemy.addComponent(Position, 100, 50);
     * enemy.addTag('hostile');
     * ```
     */
    createEntity(name?: string): Entity {
        const entity = this.entityManager.createEntity(name);
        return entity;
    }

    /**
     * Retrieve an entity by its unique symbol ID.
     *
     * @param id - The entity's symbol ID
     * @returns The entity if found, undefined otherwise
     */
    getEntity(id: symbol): Entity | undefined {
        return this.entityManager.getEntity(id);
    }

    /**
     * Get all active entities in the world.
     *
     * @returns Array of all entities (excluding those marked for deletion)
     *
     * @remarks
     * Use queries instead of iterating all entities for better performance.
     */
    getAllEntities(): Entity[] {
        return this.entityManager.getAllEntities();
    }

    /**
     * Find all entities with a specific tag.
     *
     * @param tag - The tag to search for
     * @returns Array of entities with the specified tag
     *
     * @example
     * ```typescript
     * const enemies = engine.getEntitiesByTag('hostile');
     * for (const enemy of enemies) {
     *   enemy.queueFree();
     * }
     * ```
     */
    getEntitiesByTag(tag: string): Entity[] {
        return this.entityManager.getEntitiesByTag(tag);
    }

    /**
     * Find an entity by its name.
     *
     * @param name - The entity name to search for
     * @returns The entity if found, undefined otherwise
     *
     * @remarks
     * Entity names are not required to be unique. If multiple entities share
     * the same name, this returns the first match.
     */
    getEntityByName(name: string): Entity | undefined {
        return this.entityManager.getEntityByName(name);
    }

    /**
     * Find an entity by its numeric ID.
     *
     * @param id - The entity's numeric ID
     * @returns The entity if found, undefined otherwise
     */
    getEntityByNumericId(id: number): Entity | undefined {
        return this.entityManager.getEntityByNumericId(id);
    }

    /**
     * Find the first entity matching a predicate function.
     *
     * @param predicate - Function that returns true for the desired entity
     * @returns The first matching entity, or undefined if none found
     *
     * @example
     * ```typescript
     * const boss = engine.findEntity(e =>
     *   e.hasComponent(Health) &&
     *   e.getComponent(Health).max > 1000
     * );
     * ```
     */
    findEntity(predicate: (entity: Entity) => boolean): Entity | undefined {
        return this.entityManager.findEntity(predicate);
    }

    /**
     * Find all entities matching a predicate function.
     *
     * @param predicate - Function that returns true for desired entities
     * @returns Array of all matching entities
     *
     * @example
     * ```typescript
     * const lowHealthEntities = engine.findEntities(e => {
     *   if (!e.hasComponent(Health)) return false;
     *   const health = e.getComponent(Health);
     *   return health.current < health.max * 0.3;
     * });
     * ```
     */
    findEntities(predicate: (entity: Entity) => boolean): Entity[] {
        return this.entityManager.findEntities(predicate);
    }

    cloneEntity(
        entity: Entity,
        overrides?: { name?: string; components?: Record<string, any> }
    ): Entity {
        // Create new entity with overridden name or default
        const cloneName = overrides?.name ?? (entity.name ? `${entity.name}_clone` : undefined);
        const clone = this.createEntity(cloneName);

        // Deep copy all components
        for (const componentType of entity.getComponentTypes()) {
            const originalComponent = entity.getComponent(componentType as any);

            // Deep copy the component data using JSON serialization
            const componentData = JSON.parse(JSON.stringify(originalComponent));

            // Apply component overrides if provided
            if (overrides?.components?.[componentType.name]) {
                Object.assign(componentData, overrides.components[componentType.name]);
            }

            // Create new component instance with copied data
            const newComponent = Object.assign(new (componentType as any)(), componentData);

            // Check if archetypes are enabled
            const archetypeManager = this.componentManager.getArchetypeManager();
            if (archetypeManager) {
                // Use addComponent API for archetype compatibility
                // We need to bypass the constructor and just set the properties
                const tempComponent = new (componentType as any)();
                Object.assign(tempComponent, componentData);

                // Manually add to archetype system
                const newComponentTypes = [
                    ...(clone as any)._componentIndices.keys(),
                    componentType,
                ];
                const components = new Map<ComponentIdentifier, any>();

                // Gather existing components
                if ((clone as any)._componentIndices.size > 0) {
                    for (const compType of (clone as any)._componentIndices.keys()) {
                        const existingComp = archetypeManager.getComponent(clone, compType);
                        if (existingComp !== null) {
                            components.set(compType, existingComp);
                        }
                    }
                }

                components.set(componentType, tempComponent);
                archetypeManager.moveEntity(clone, newComponentTypes, components);
                (clone as any)._componentIndices.set(componentType, -1);
            } else {
                // Legacy mode: use sparse arrays
                const componentArray = this.componentManager.getComponentArray(
                    componentType as ComponentIdentifier
                );
                const index = componentArray.add(newComponent);
                (clone as any)._componentIndices.set(componentType, index);
            }

            (clone as any)._dirty = true;
            (clone as any)._changeVersion++;
        }

        // Copy all tags
        for (const tag of entity.tags) {
            clone.addTag(tag);
        }

        // Update queries for the new cloned entity
        this.queryManager.updateQueries(clone);

        if (this.debugMode) {
            console.log(
                `[ECS Debug] Cloned entity ${entity.name || entity.numericId} to ${clone.name || clone.numericId}`
            );
        }

        return clone;
    }

    /**
     * Create multiple entities at once
     * @param count - Number of entities to create
     * @param prefabName - Optional prefab name to create entities from
     * @returns Array of created entities
     */
    createEntities(count: number, prefabName?: string): Entity[] {
        const entities: Entity[] = [];

        // Create entities from prefab or empty
        for (let i = 0; i < count; i++) {
            let entity: Entity | null;

            if (prefabName) {
                entity = this.createFromPrefab(prefabName);
            } else {
                entity = this.createEntity();
            }

            if (entity) {
                entities.push(entity);
            }
        }

        if (this.debugMode) {
            console.log(
                `[ECS Debug] Created ${entities.length} entities${prefabName ? ` from prefab '${prefabName}'` : ''}`
            );
        }

        return entities;
    }

    // ========== Component Management ==========

    registerComponent<T>(type: ComponentIdentifier<T>): void {
        this.componentManager.registerComponent(type);
    }

    registerComponentValidator<T>(
        type: ComponentIdentifier<T>,
        validator: ComponentValidator<T>
    ): void {
        this.componentManager.registerValidator(type, validator);
    }

    getComponentByName(name: string): ComponentIdentifier | undefined {
        return this.componentManager.getComponentByName(name);
    }

    /**
     * Register a component pool for efficient component reuse
     */
    registerComponentPool<T extends object>(
        type: ComponentIdentifier<T>,
        options: ComponentPoolOptions = {}
    ): void {
        this.componentManager.registerComponentPool(type, options);
        if (this.debugMode) {
            console.log(`[ECS Debug] Component pool registered for ${type.name}`);
        }
    }

    /**
     * Get pool statistics for a component type
     */
    getComponentPoolStats<T extends object>(type: ComponentIdentifier<T>): PoolStats | undefined {
        return this.componentManager.getComponentPoolStats(type);
    }

    // ========== Singleton Component Management ==========

    /**
     * Set a singleton component for global state management.
     *
     * Singleton components exist once per engine instance and are independent of entities.
     * Perfect for managing global state like game time, settings, or score managers.
     *
     * @typeParam T - The component type
     * @param type - The component class/type
     * @param args - Constructor arguments for creating the component
     * @returns The component instance that was set
     *
     * @example
     * ```typescript
     * class GameTime {
     *   constructor(public elapsed: number = 0, public deltaTime: number = 0) {}
     * }
     *
     * // Set the singleton
     * engine.setSingleton(GameTime, 0, 0.016);
     *
     * // Later, update it
     * const time = engine.getSingleton(GameTime);
     * if (time) {
     *   time.elapsed += deltaTime;
     *   time.deltaTime = deltaTime;
     *   engine.markSingletonDirty(GameTime); // Emit change event
     * }
     * ```
     *
     * @public
     */
    setSingleton<T>(type: ComponentIdentifier<T>, ...args: any[]): T {
        const oldValue = this.componentManager.getSingleton(type);

        // Create new component instance
        const component = new type(...args);

        // Set the singleton
        this.componentManager.setSingleton(type, component);

        // Emit event
        this.eventEmitter.emit('onSingletonSet', {
            componentType: type,
            oldValue,
            newValue: component,
            timestamp: Date.now(),
        });

        if (this.debugMode) {
            console.log(`[ECS Debug] Singleton component ${type.name} set`);
        }

        return component;
    }

    /**
     * Get a singleton component.
     *
     * @typeParam T - The component type
     * @param type - The component class/type
     * @returns The singleton component instance, or undefined if not set
     *
     * @example
     * ```typescript
     * const gameTime = engine.getSingleton(GameTime);
     * if (gameTime) {
     *   console.log(`Game has been running for ${gameTime.elapsed}s`);
     * }
     * ```
     *
     * @public
     */
    getSingleton<T>(type: ComponentIdentifier<T>): T | undefined {
        return this.componentManager.getSingleton(type);
    }

    /**
     * Check if a singleton component is set.
     *
     * @typeParam T - The component type
     * @param type - The component class/type
     * @returns True if the singleton exists, false otherwise
     *
     * @example
     * ```typescript
     * if (!engine.hasSingleton(GameTime)) {
     *   engine.setSingleton(GameTime, 0, 0);
     * }
     * ```
     *
     * @public
     */
    hasSingleton<T>(type: ComponentIdentifier<T>): boolean {
        return this.componentManager.hasSingleton(type);
    }

    /**
     * Remove a singleton component.
     *
     * @typeParam T - The component type
     * @param type - The component class/type
     * @returns The removed singleton instance, or undefined if it didn't exist
     *
     * @example
     * ```typescript
     * const oldSettings = engine.removeSingleton(GameSettings);
     * console.log('Settings removed:', oldSettings);
     * ```
     *
     * @public
     */
    removeSingleton<T>(type: ComponentIdentifier<T>): T | undefined {
        const component = this.componentManager.removeSingleton(type);

        if (component) {
            // Emit event
            this.eventEmitter.emit('onSingletonRemoved', {
                componentType: type,
                component,
                timestamp: Date.now(),
            });

            if (this.debugMode) {
                console.log(`[ECS Debug] Singleton component ${type.name} removed`);
            }
        }

        return component;
    }

    /**
     * Get all singleton components.
     *
     * @returns Map of all singleton components
     *
     * @example
     * ```typescript
     * const singletons = engine.getAllSingletons();
     * for (const [type, component] of singletons) {
     *   console.log(`Singleton: ${type.name}`, component);
     * }
     * ```
     *
     * @public
     */
    getAllSingletons(): Map<ComponentIdentifier, any> {
        return this.componentManager.getAllSingletons();
    }

    /**
     * Mark a singleton component as dirty (changed) to emit change events.
     *
     * Similar to `markComponentDirty()` but for singleton components. Use this when
     * you modify a singleton component's properties directly and want to notify listeners.
     *
     * @typeParam T - The component type
     * @param type - The component class/type
     *
     * @example
     * ```typescript
     * const time = engine.getSingleton(GameTime);
     * if (time) {
     *   time.elapsed += deltaTime;
     *   engine.markSingletonDirty(GameTime); // Notify listeners
     * }
     * ```
     *
     * @public
     */
    markSingletonDirty<T>(type: ComponentIdentifier<T>): void {
        const component = this.componentManager.getSingleton(type);
        if (component) {
            // Emit change event
            this.eventEmitter.emit('onSingletonSet', {
                componentType: type,
                oldValue: component,
                newValue: component,
                timestamp: Date.now(),
            });
        }
    }

    // ========== System Management ==========

    createSystemGroup(name: string, options: { priority: number }): any {
        return this.systemManager.createGroup(name, options.priority);
    }

    enableSystemGroup(name: string): void {
        this.systemManager.enableGroup(name);
    }

    disableSystemGroup(name: string): void {
        this.systemManager.disableGroup(name);
    }

    createSystem<All extends readonly ComponentIdentifier[]>(
        name: string,
        queryOptions: QueryOptions<All>,
        options: SystemType<ComponentTypes<All>>,
        isFixedUpdate: boolean = false
    ): System<ComponentTypes<All>> {
        const query = this.queryManager.createQuery<ComponentTypes<All>>(queryOptions);
        const system = new System<ComponentTypes<All>>(
            name,
            query,
            options,
            this.eventEmitter,
            this.profilingEnabled
        );

        // Update new query with all existing entities
        for (const entity of this.entityManager.getAllEntities()) {
            query.match(entity);
        }

        return this.systemManager.createSystem(system, isFixedUpdate);
    }

    getSystemProfiles(): SystemProfile[] {
        return this.systemManager.getProfiles();
    }

    getAllSystems(): System<any>[] {
        return this.systemManager.getAllSystems();
    }

    /**
     * Get a system by name.
     *
     * @param name - The name of the system to find
     * @returns The system if found, undefined otherwise
     *
     * @example
     * ```typescript
     * const movementSystem = engine.getSystem('Movement');
     * if (movementSystem) {
     *   movementSystem.enabled = false;
     * }
     * ```
     *
     * @public
     */
    getSystem(name: string): System<any> | undefined {
        return this.systemManager.getSystem(name);
    }

    /**
     * Remove a system from the engine and clean up its resources.
     *
     * This will:
     * 1. Remove the system from execution
     * 2. Call the system's destroy() method to unsubscribe from all events
     * 3. Remove the system from any assigned groups
     *
     * @param name - The name of the system to remove
     * @returns true if the system was found and removed, false otherwise
     *
     * @example
     * ```typescript
     * // Remove a system that's no longer needed
     * const removed = engine.removeSystem('DebugOverlay');
     * if (removed) {
     *   console.log('Debug overlay system removed');
     * }
     * ```
     *
     * @public
     */
    removeSystem(name: string): boolean {
        const removed = this.systemManager.removeSystem(name);
        if (removed) {
            this.eventEmitter.emit('onSystemRemoved', name);
        }
        return removed;
    }

    /**
     * Remove all systems from the engine and clean up their resources.
     *
     * This is useful for complete engine reset or shutdown scenarios.
     *
     * @example
     * ```typescript
     * // Clean shutdown
     * engine.stop();
     * engine.removeAllSystems();
     * ```
     *
     * @public
     */
    removeAllSystems(): void {
        this.systemManager.removeAllSystems();
    }

    // ========== Query Management ==========

    createQuery<All extends readonly ComponentIdentifier[]>(
        options: QueryOptions<All>
    ): Query<ComponentTypes<All>> {
        const query = this.queryManager.createQuery<ComponentTypes<All>>(options);

        // Update new query with all existing entities
        for (const entity of this.entityManager.getAllEntities()) {
            query.match(entity);
        }

        return query;
    }

    /**
     * Create a fluent query builder
     * @returns QueryBuilder instance for constructing queries with a fluent API
     */
    query<C extends readonly any[] = any[]>(): QueryBuilder<C> {
        return new QueryBuilder<C>((options: QueryOptions<any>) => {
            return this.queryManager.createQuery<C>(options);
        });
    }

    /**
     * Get performance statistics for queries
     * @param query Optional specific query to get stats for. If not provided, returns stats for all queries.
     * @returns QueryStats or QueryStats[] depending on whether a specific query is provided
     */
    getQueryStats(query?: Query<any>): any {
        if (query) {
            return query.getStats();
        }

        // Return stats for all queries
        const allQueries = this.queryManager.getAllQueries();
        return allQueries.map((q) => q.getStats());
    }

    // ========== Transaction Management ==========

    /**
     * Begin a transaction. All structural changes (add/remove components, create/destroy entities)
     * will be batched and query updates will be deferred until commit.
     * @throws Error if a transaction is already in progress
     */
    beginTransaction(): void {
        if (this.inTransaction) {
            throw new Error('Transaction already in progress');
        }
        this.inTransaction = true;
        this.pendingQueryUpdates.clear();

        if (this.debugMode) {
            console.log('[ECS Debug] Transaction started');
        }
    }

    /**
     * Commit the current transaction. All pending changes will be applied
     * and queries will be updated once with all changed entities.
     * @throws Error if no transaction is in progress
     */
    commitTransaction(): void {
        if (!this.inTransaction) {
            throw new Error('No transaction in progress');
        }

        // Update all queries for entities that changed during the transaction
        for (const entity of this.pendingQueryUpdates) {
            this.queryManager.updateQueries(entity);
        }

        // Reset transaction state
        this.inTransaction = false;
        this.pendingQueryUpdates.clear();

        if (this.debugMode) {
            console.log('[ECS Debug] Transaction committed');
        }
    }

    /**
     * Rollback the current transaction. All pending changes will be discarded.
     * Note: Entities created during the transaction will still exist but won't be
     * added to queries. Components added/removed will remain but query updates are discarded.
     * @throws Error if no transaction is in progress
     */
    rollbackTransaction(): void {
        if (!this.inTransaction) {
            throw new Error('No transaction in progress');
        }

        // Simply discard all pending changes
        this.inTransaction = false;
        this.pendingQueryUpdates.clear();

        if (this.debugMode) {
            console.log('[ECS Debug] Transaction rolled back');
        }
    }

    /**
     * Check if a transaction is currently in progress
     * @returns true if a transaction is in progress, false otherwise
     */
    isInTransaction(): boolean {
        return this.inTransaction;
    }

    // ========== Prefab Management ==========

    registerPrefab(name: string, prefab: EntityPrefab): void {
        this.prefabManager.register(name, prefab);
    }

    /**
     * Define a parameterized prefab using a factory function
     * @param name - Prefab name
     * @param factory - Factory function that returns prefab definition
     * @returns The registered prefab
     */
    definePrefab(
        name: string,
        factory: (...args: any[]) => Omit<EntityPrefab, 'factory' | 'parent'>
    ): EntityPrefab {
        const prefab: EntityPrefab = {
            name,
            components: [],
            tags: [],
            factory,
        };
        this.prefabManager.register(name, prefab);
        return prefab;
    }

    /**
     * Extend a base prefab with additional components and tags
     * @param baseName - Name of the base prefab to extend
     * @param overrides - Additional components, tags, or children to add
     * @param newName - Optional name for the extended prefab (defaults to baseName_extended)
     * @returns The extended prefab
     */
    extendPrefab(
        baseName: string,
        overrides: Partial<EntityPrefab>,
        newName?: string
    ): EntityPrefab {
        const extended = this.prefabManager.extend(baseName, { ...overrides, name: newName });
        if (newName) {
            this.prefabManager.register(newName, extended);
        }
        return extended;
    }

    /**
     * Create a variant of a prefab with component value overrides
     * @param baseName - Name of the base prefab
     * @param overrides - Component values to override, tags to add, or children
     * @param newName - Optional name for the variant (defaults to baseName_variant)
     * @returns The variant prefab
     */
    variantOfPrefab(
        baseName: string,
        overrides: {
            components?: { [componentName: string]: any };
            tags?: string[];
            children?: EntityPrefab[];
        },
        newName?: string
    ): EntityPrefab {
        const variant = this.prefabManager.createVariant(baseName, overrides);
        if (newName) {
            variant.name = newName;
        }
        if (newName) {
            this.prefabManager.register(newName, variant);
        }
        return variant;
    }

    createFromPrefab(
        prefabName: string,
        entityName?: string,
        ...factoryArgs: any[]
    ): Entity | null {
        // Resolve prefab (applies factory if present)
        const prefab = this.prefabManager.resolve(prefabName, ...factoryArgs);
        if (!prefab) {
            if (this.debugMode) {
                console.warn(`[ECS Debug] Prefab ${prefabName} not found`);
            }
            return null;
        }

        const entity = this.createEntity(entityName || prefab.name);

        // Add components
        for (const component of prefab.components) {
            entity.addComponent(component.type, ...component.args);
        }

        // Add tags
        for (const tag of prefab.tags) {
            entity.addTag(tag);
        }

        // Create children recursively
        if (prefab.children) {
            for (const childPrefab of prefab.children) {
                // Register temporary child prefab
                const childPrefabName = `${prefabName}_child_${Math.random()}`;
                this.prefabManager.register(childPrefabName, childPrefab);
                const child = this.createFromPrefab(childPrefabName);
                if (child) {
                    entity.addChild(child);
                }
            }
        }

        return entity;
    }

    // ========== Snapshot Management ==========

    createSnapshot(): void {
        const world = this.serialize();
        this.snapshotManager.createSnapshot(world);
        if (this.debugMode) {
            console.log(
                `[ECS Debug] Snapshot created (${this.snapshotManager.getSnapshotCount()} total)`
            );
        }
    }

    restoreSnapshot(index: number = -1): boolean {
        const snapshot = this.snapshotManager.getSnapshot(index);
        if (!snapshot) {
            if (this.debugMode) {
                console.warn(`[ECS Debug] Snapshot at index ${index} not found`);
            }
            return false;
        }

        // Clear all existing entities
        for (const entity of this.getAllEntities()) {
            entity.queueFree();
        }
        this.entityManager.cleanup();

        // Recreate entities from snapshot
        const entityMap = new Map<string, Entity>();

        // Helper function to recursively process entities
        const processEntity = (serializedEntity: any): Entity => {
            const entity = this.createEntity(serializedEntity.name);

            // Add components - convert component data back to component instances
            for (const [componentName, componentData] of Object.entries(
                serializedEntity.components
            )) {
                const componentType = this.componentManager.getComponentByName(componentName);
                if (componentType) {
                    // For each component, we need to create it with the right data
                    // Extract constructor args from component data if they exist
                    // Otherwise create empty and assign properties
                    const dataObj = componentData as Record<string, any>;
                    const keys = Object.keys(dataObj);
                    const values = keys.map((key) => dataObj[key]);

                    try {
                        // Try to call addComponent with the values as constructor args
                        entity.addComponent(componentType, ...values);
                    } catch {
                        // If that fails, add empty component and assign properties
                        entity.addComponent(componentType);
                        const component = entity.getComponent(componentType as any) as any;
                        Object.assign(component, componentData);
                    }
                }
            }

            // Add tags
            for (const tag of serializedEntity.tags) {
                entity.addTag(tag);
            }

            entityMap.set(serializedEntity.id, entity);

            // Process children recursively
            if (serializedEntity.children && serializedEntity.children.length > 0) {
                for (const childSerialized of serializedEntity.children) {
                    const child = processEntity(childSerialized);
                    entity.addChild(child);
                }
            }

            return entity;
        };

        // Process all root entities (and their children recursively)
        for (const serializedEntity of snapshot.entities) {
            processEntity(serializedEntity);
        }

        // Restore singleton components
        if (snapshot.singletons) {
            // Clear existing singletons
            this.componentManager.clearAllSingletons();

            // Restore each singleton
            for (const [componentName, componentData] of Object.entries(snapshot.singletons)) {
                const componentType = this.componentManager.getComponentByName(componentName);
                if (componentType) {
                    const dataObj = componentData as Record<string, any>;
                    const keys = Object.keys(dataObj);
                    const values = keys.map((key) => dataObj[key]);

                    try {
                        // Try to call constructor with values as args
                        const component = new componentType(...values);
                        this.componentManager.setSingleton(componentType, component);
                    } catch {
                        // If that fails, create empty and assign properties
                        const component = new componentType();
                        Object.assign(component, componentData);
                        this.componentManager.setSingleton(componentType, component);
                    }
                }
            }
        }

        // Update all queries with restored entities
        for (const entity of entityMap.values()) {
            this.queryManager.updateQueries(entity);
        }

        if (this.debugMode) {
            const singletonCount = snapshot.singletons
                ? Object.keys(snapshot.singletons).length
                : 0;
            console.log(
                `[ECS Debug] Snapshot restored (${entityMap.size} entities, ${singletonCount} singletons)`
            );
        }

        return true;
    }

    getSnapshotCount(): number {
        return this.snapshotManager.getSnapshotCount();
    }

    clearSnapshots(): void {
        this.snapshotManager.clearSnapshots();
    }

    // ========== Messaging ==========

    get messageBus() {
        return {
            subscribe: (messageType: string, callback: (message: any) => void) =>
                this.messageManager.subscribe(messageType, callback),
            publish: (messageType: string, data: any, sender?: string) =>
                this.messageManager.publish(messageType, data, sender),
            getMessageHistory: (messageType?: string) =>
                this.messageManager.getHistory(messageType),
        };
    }

    // ========== Change Tracking ==========

    /**
     * Mark a component on an entity as dirty (changed).
     *
     * This manually flags a component as modified, which will emit a `onComponentChanged` event
     * if not in batch mode. Useful for notifying systems when component data changes externally.
     *
     * @param entity - The entity whose component was modified
     * @param componentType - The type of component that changed
     *
     * @example
     * ```typescript
     * const entity = engine.createEntity();
     * entity.addComponent(Position, 0, 0);
     *
     * const position = entity.getComponent(Position);
     * position.x = 100; // Modify directly
     * engine.markComponentDirty(entity, Position); // Notify listeners
     * ```
     *
     * @public
     */
    markComponentDirty(entity: Entity, componentType: ComponentIdentifier): void {
        this.changeTrackingManager.markComponentDirty(entity, componentType);
    }

    /**
     * Get all components that have been marked as dirty on an entity.
     *
     * Returns an array of component types that have been modified since the last
     * call to `clearDirtyComponents()` or `clearAllDirtyComponents()`.
     *
     * @param entity - The entity to check for dirty components
     * @returns Array of component types that are marked as dirty
     *
     * @example
     * ```typescript
     * engine.markComponentDirty(entity, Position);
     * engine.markComponentDirty(entity, Velocity);
     *
     * const dirty = engine.getDirtyComponents(entity);
     * // dirty = [Position, Velocity]
     * ```
     *
     * @public
     */
    getDirtyComponents(entity: Entity): ComponentIdentifier[] {
        return this.changeTrackingManager.getDirtyComponents(entity);
    }

    /**
     * Clear all dirty flags for components on a specific entity.
     *
     * Removes the dirty state from all components on the entity, indicating
     * that changes have been processed. Typically called after handling component changes.
     *
     * @param entity - The entity whose dirty flags should be cleared
     *
     * @example
     * ```typescript
     * // After processing changes
     * const dirty = engine.getDirtyComponents(entity);
     * for (const componentType of dirty) {
     *   // Process the change...
     * }
     * engine.clearDirtyComponents(entity);
     * ```
     *
     * @public
     */
    clearDirtyComponents(entity: Entity): void {
        this.changeTrackingManager.clearDirtyComponents(entity);
    }

    /**
     * Clear all dirty flags across all entities and components.
     *
     * Resets the dirty state for the entire world. Useful after bulk processing
     * or at the end of a frame to prepare for the next update cycle.
     *
     * @example
     * ```typescript
     * // At end of frame
     * engine.update(deltaTime);
     * engine.clearAllDirtyComponents();
     * ```
     *
     * @public
     */
    clearAllDirtyComponents(): void {
        this.changeTrackingManager.clearAllDirty();
    }

    /**
     * Enable or disable batch mode for component change events.
     *
     * When batch mode is enabled, component change events are suspended, preventing
     * excessive event emissions during bulk operations. Useful for initialization
     * or large-scale entity manipulation.
     *
     * @param enabled - Whether to enable (true) or disable (false) batch mode
     *
     * @example
     * ```typescript
     * // Disable events during initialization
     * engine.setBatchMode(true);
     * for (let i = 0; i < 1000; i++) {
     *   const entity = engine.createEntity();
     *   entity.addComponent(Position, i, i);
     * }
     * engine.setBatchMode(false); // Re-enable events
     * ```
     *
     * @public
     */
    setBatchMode(enabled: boolean): void {
        this.changeTrackingManager.setBatchMode(enabled);
        if (this.debugMode) {
            console.log(`[ECS Debug] Batch mode ${enabled ? 'enabled' : 'disabled'}`);
        }
    }

    /**
     * Check if batch mode is currently enabled.
     *
     * @returns `true` if batch mode is enabled, `false` otherwise
     *
     * @public
     */
    isBatchMode(): boolean {
        return this.changeTrackingManager.isBatchMode();
    }

    /**
     * Execute a function in batch mode (events suspended during execution).
     *
     * Automatically enables batch mode before executing the function and restores
     * the previous batch mode state afterward. Provides a clean way to perform
     * bulk operations without event overhead.
     *
     * @typeParam T - The return type of the function
     * @param fn - The function to execute in batch mode
     * @returns The return value of the function
     *
     * @example
     * ```typescript
     * const result = engine.batch(() => {
     *   // These changes won't emit events
     *   for (let i = 0; i < 1000; i++) {
     *     const entity = engine.createEntity();
     *     entity.addComponent(Position, i, i);
     *   }
     *   return entities.length;
     * });
     * // Batch mode automatically restored, events resume
     * ```
     *
     * @public
     */
    batch<T>(fn: () => T): T {
        return this.changeTrackingManager.batch(fn);
    }

    /**
     * Enable Proxy-based automatic change tracking.
     *
     * When enabled, components wrapped with `createReactiveComponent()` will
     * automatically detect property changes and emit `onComponentChanged` events.
     * Provides a reactive programming pattern for component updates.
     *
     * @example
     * ```typescript
     * engine.enableProxyTracking();
     *
     * const entity = engine.createEntity();
     * entity.addComponent(Position, 0, 0);
     *
     * const position = entity.getComponent(Position);
     * const reactive = engine.createReactiveComponent(position, entity, Position);
     *
     * reactive.x = 100; // Automatically emits onComponentChanged event
     * ```
     *
     * @public
     */
    enableProxyTracking(): void {
        this.changeTrackingManager.enableProxyTracking();
        if (this.debugMode) {
            console.log('[ECS Debug] Proxy-based change tracking enabled');
        }
    }

    /**
     * Disable Proxy-based automatic change tracking.
     *
     * After calling this, `createReactiveComponent()` will return the original
     * component without wrapping it in a Proxy. Existing reactive components
     * will continue to function.
     *
     * @public
     */
    disableProxyTracking(): void {
        this.changeTrackingManager.disableProxyTracking();
        if (this.debugMode) {
            console.log('[ECS Debug] Proxy-based change tracking disabled');
        }
    }

    /**
     * Check if Proxy-based change tracking is currently enabled.
     *
     * @returns `true` if Proxy tracking is enabled, `false` otherwise
     *
     * @public
     */
    isProxyTrackingEnabled(): boolean {
        return this.changeTrackingManager.isProxyTrackingEnabled();
    }

    /**
     * Create a reactive (Proxy-wrapped) component that automatically tracks changes.
     *
     * Wraps a component in a Proxy that intercepts property assignments and automatically
     * marks the component as dirty, emitting change events. Only works if Proxy tracking
     * is enabled via `enableProxyTracking()`.
     *
     * @typeParam T - The component type (must be an object)
     * @param component - The component instance to make reactive
     * @param entity - The entity that owns the component
     * @param componentType - The component type identifier
     * @returns The reactive component (or original if Proxy tracking is disabled)
     *
     * @example
     * ```typescript
     * engine.enableProxyTracking();
     *
     * const entity = engine.createEntity();
     * entity.addComponent(Position, 0, 0);
     *
     * const position = entity.getComponent(Position);
     * const reactive = engine.createReactiveComponent(position, entity, Position);
     *
     * // Automatically emits onComponentChanged event
     * reactive.x = 100;
     * reactive.y = 200;
     * ```
     *
     * @public
     */
    createReactiveComponent<T extends object>(
        component: T,
        entity: Entity,
        componentType: ComponentIdentifier<T>
    ): T {
        return this.changeTrackingManager.createReactiveComponent(component, entity, componentType);
    }

    // ========== Events ==========

    on(event: string, callback: (...args: any[]) => void): () => void {
        return this.eventEmitter.on(event, callback);
    }

    off(event: string, callback: (...args: any[]) => void): void {
        this.eventEmitter.off(event, callback);
    }

    emit(event: string, ...args: any[]): void {
        this.eventEmitter.emit(event, ...args);
    }

    // ========== Engine Lifecycle ==========

    start(): void {
        if (this.running) return;
        this.running = true;
        this.lastUpdateTime = performance.now();
        this.eventEmitter.emit('onStart');
        if (this.debugMode) {
            console.log('[ECS Debug] Engine started');
        }
    }

    stop(): void {
        if (!this.running) return;
        this.running = false;
        this.eventEmitter.emit('onStop');
        if (this.debugMode) {
            console.log('[ECS Debug] Engine stopped');
        }
    }

    update(deltaTime?: number): void {
        const now = performance.now();
        const dt = deltaTime !== undefined ? deltaTime : now - this.lastUpdateTime;
        this.lastUpdateTime = now;

        this.performanceMonitor.addSample(dt);

        // Execute fixed update systems
        this.systemManager.executeFixedSystems(dt, this.debugMode);

        // Execute variable update systems
        this.systemManager.executeVariableSystems(dt);

        // Execute deferred commands (if auto-execute is enabled)
        if (this.autoExecuteCommands && this.commandBuffer.hasPendingCommands) {
            this.commandBuffer.execute();
        }

        // Update queries for all dirty entities
        for (const entity of this.entityManager.getAllEntities()) {
            if (entity.isDirty) {
                this.queryManager.updateQueries(entity);
                (entity as any)._dirty = false;
            }
        }

        // Clean up deleted entities
        this.entityManager.cleanup();
    }

    // ========== Serialization ==========

    serialize(): SerializedWorld {
        const entities = this.entityManager
            .getAllEntities()
            .filter((entity) => !entity.parent) // Only serialize root entities
            .map((entity) => entity.serialize());

        // Serialize singleton components
        const singletons: { [componentName: string]: any } = {};
        const allSingletons = this.componentManager.getAllSingletons();

        for (const [componentType, component] of allSingletons) {
            singletons[componentType.name] = { ...component };
        }

        return {
            entities,
            singletons,
            timestamp: Date.now(),
        };
    }

    // ========== Statistics and Debugging ==========

    getMemoryStats(): MemoryStats {
        const componentArrays = this.componentManager.getAllComponentArrays();
        const componentStats: { [name: string]: number } = {};
        let totalMemory = 0;

        // Check if archetypes are enabled
        const archetypeManager = this.componentManager.getArchetypeManager();

        if (archetypeManager) {
            // With archetypes: get memory from archetype system
            const archetypeMemory = archetypeManager.getMemoryStats();
            totalMemory = archetypeMemory.estimatedBytes;

            // Count components in archetypes
            for (const archetypeInfo of archetypeMemory.archetypeBreakdown) {
                // Archetype ID is like "Position,Velocity" - count entities for each component
                const componentNames = archetypeInfo.id.split(',').filter((s) => s.length > 0);
                for (const name of componentNames) {
                    componentStats[name] = (componentStats[name] || 0) + archetypeInfo.entityCount;
                }
            }
        } else {
            // Without archetypes: get memory from sparse arrays
            for (const [type, array] of componentArrays) {
                const size = array.size;
                const memory = array.memoryEstimate;
                componentStats[type.name] = size;
                totalMemory += memory;
            }
        }

        const entities = this.entityManager.getAllEntities();
        const activeEntities = entities.filter((e) => !e.isMarkedForDeletion);

        return {
            totalEntities: entities.length,
            activeEntities: activeEntities.length,
            componentArrays: componentStats,
            totalMemoryEstimate: totalMemory,
        };
    }

    getDebugInfo(): any {
        return {
            entities: this.entityManager.getAllEntities().length,
            systems: this.systemManager.getAllSystems().length,
            queries: this.queryManager.getAllQueries().length,
            prefabs: Array.from(this.prefabManager.getAllPrefabs().keys()),
            snapshots: this.snapshotManager.getSnapshotCount(),
            poolStats: this.entityManager.getPoolStats(),
            performance: {
                averageFrameTime: this.performanceMonitor.getAverage(),
                minFrameTime: this.performanceMonitor.getMin(),
                maxFrameTime: this.performanceMonitor.getMax(),
            },
        };
    }

    getPerformanceStats() {
        return {
            averageFrameTime: this.performanceMonitor.getAverage(),
            minFrameTime: this.performanceMonitor.getMin(),
            maxFrameTime: this.performanceMonitor.getMax(),
        };
    }

    /**
     * Get archetype system statistics (if archetypes are enabled)
     * @returns Archetype statistics or undefined if archetypes are disabled
     */
    getArchetypeStats(): any {
        const archetypeManager = this.componentManager.getArchetypeManager();
        if (!archetypeManager) {
            return undefined;
        }
        return archetypeManager.getStats();
    }

    /**
     * Get archetype memory statistics (if archetypes are enabled)
     * @returns Memory statistics or undefined if archetypes are disabled
     */
    getArchetypeMemoryStats(): any {
        const archetypeManager = this.componentManager.getArchetypeManager();
        if (!archetypeManager) {
            return undefined;
        }
        return archetypeManager.getMemoryStats();
    }

    /**
     * Check if archetype system is enabled
     * @returns true if archetypes are enabled, false otherwise
     */
    areArchetypesEnabled(): boolean {
        return this.componentManager.areArchetypesEnabled();
    }

    /**
     * Check if system profiling is enabled.
     *
     * When profiling is enabled, the engine tracks execution time, entity count,
     * and call count for each system. This data is available via `getSystemProfiles()`.
     *
     * @returns true if profiling is enabled, false otherwise
     *
     * @example
     * ```typescript
     * if (engine.isProfilingEnabled()) {
     *   const profiles = engine.getSystemProfiles();
     *   // Display profiling data
     * }
     * ```
     */
    isProfilingEnabled(): boolean {
        return this.profilingEnabled;
    }

    // ========== Plugin System ==========

    /**
     * Create a plugin context for a plugin to use during installation
     */
    private createPluginContext(): PluginContext {
        return {
            registerComponent: <T>(type: ComponentIdentifier<T>): void => {
                this.registerComponent(type);
            },
            registerComponentValidator: <T>(
                type: ComponentIdentifier<T>,
                validator: ComponentValidator<T>
            ): void => {
                this.registerComponentValidator(type, validator);
            },
            setSingleton: <T>(type: ComponentIdentifier<T>, ...args: any[]): T => {
                return this.setSingleton(type, ...args);
            },
            getSingleton: <T>(type: ComponentIdentifier<T>): T | undefined => {
                return this.getSingleton(type);
            },
            hasSingleton: <T>(type: ComponentIdentifier<T>): boolean => {
                return this.hasSingleton(type);
            },
            removeSingleton: <T>(type: ComponentIdentifier<T>): T | undefined => {
                return this.removeSingleton(type);
            },
            createSystem: <All extends readonly ComponentIdentifier[]>(
                name: string,
                queryOptions: QueryOptions<All>,
                options: SystemType<ComponentTypes<All>>,
                isFixedUpdate: boolean = false
            ): any => {
                return this.createSystem(name, queryOptions, options, isFixedUpdate);
            },
            createQuery: <All extends readonly ComponentIdentifier[]>(
                options: QueryOptions<All>
            ): any => {
                return this.createQuery(options);
            },
            registerPrefab: (name: string, prefab: EntityPrefab): void => {
                this.registerPrefab(name, prefab);
            },
            definePrefab: (
                name: string,
                factory: (...args: any[]) => Omit<EntityPrefab, 'factory' | 'parent'>
            ): EntityPrefab => {
                return this.definePrefab(name, factory);
            },
            extendPrefab: (
                baseName: string,
                overrides: Partial<EntityPrefab>,
                newName?: string
            ): EntityPrefab => {
                return this.extendPrefab(baseName, overrides, newName);
            },
            variantOfPrefab: (
                baseName: string,
                overrides: {
                    components?: { [componentName: string]: any };
                    tags?: string[];
                    children?: EntityPrefab[];
                },
                newName?: string
            ): EntityPrefab => {
                return this.variantOfPrefab(baseName, overrides, newName);
            },
            on: (event: string, callback: (...args: any[]) => void): (() => void) => {
                return this.on(event, callback);
            },
            emit: (event: string, ...args: any[]): void => {
                this.emit(event, ...args);
            },
            messageBus: {
                subscribe: (
                    messageType: string,
                    callback: (message: any) => void
                ): (() => void) => {
                    return this.messageBus.subscribe(messageType, callback);
                },
                publish: (messageType: string, data: any, sender?: string): void => {
                    this.messageBus.publish(messageType, data, sender);
                },
            },
            extend: <T extends object>(extensionName: string, api: T): void => {
                if (this.extensions.has(extensionName)) {
                    throw new Error(`Extension '${extensionName}' already exists`);
                }
                this.extensions.set(extensionName, api);
                // Dynamically add extension to engine instance
                (this as any)[extensionName] = api;
            },
            getEngine: (): any => {
                return this;
            },
        };
    }

    /**
     * Install a plugin into the engine
     */
    installPlugin(plugin: EnginePlugin): void {
        if (this.installedPlugins.has(plugin.name)) {
            if (this.debugMode) {
                console.warn(`[ECS Debug] Plugin '${plugin.name}' is already installed`);
            }
            return;
        }

        const context = this.createPluginContext();
        const result = plugin.install(context);

        // Handle async installation
        if (result instanceof Promise) {
            result
                .then(() => {
                    this.installedPlugins.set(plugin.name, {
                        plugin,
                        installedAt: Date.now(),
                    });
                    this.eventEmitter.emit('onPluginInstalled', plugin);
                    if (this.debugMode) {
                        console.log(`[ECS Debug] Plugin '${plugin.name}' installed successfully`);
                    }
                })
                .catch((error) => {
                    console.error(`[ECS] Failed to install plugin '${plugin.name}':`, error);
                });
        } else {
            this.installedPlugins.set(plugin.name, {
                plugin,
                installedAt: Date.now(),
            });
            this.eventEmitter.emit('onPluginInstalled', plugin);
            if (this.debugMode) {
                console.log(`[ECS Debug] Plugin '${plugin.name}' installed successfully`);
            }
        }
    }

    /**
     * Uninstall a plugin from the engine
     */
    async uninstallPlugin(pluginName: string): Promise<boolean> {
        const installedPlugin = this.installedPlugins.get(pluginName);
        if (!installedPlugin) {
            if (this.debugMode) {
                console.warn(`[ECS Debug] Plugin '${pluginName}' is not installed`);
            }
            return false;
        }

        const { plugin } = installedPlugin;

        // Call uninstall hook if it exists
        if (plugin.uninstall) {
            try {
                const result = plugin.uninstall();
                if (result instanceof Promise) {
                    await result;
                }
            } catch (error) {
                console.error(`[ECS] Error uninstalling plugin '${pluginName}':`, error);
                return false;
            }
        }

        this.installedPlugins.delete(pluginName);
        this.eventEmitter.emit('onPluginUninstalled', plugin);
        if (this.debugMode) {
            console.log(`[ECS Debug] Plugin '${pluginName}' uninstalled successfully`);
        }

        return true;
    }

    /**
     * Get information about an installed plugin
     */
    getPlugin(pluginName: string): InstalledPlugin | undefined {
        return this.installedPlugins.get(pluginName);
    }

    /**
     * Get all installed plugins
     */
    getInstalledPlugins(): InstalledPlugin[] {
        return Array.from(this.installedPlugins.values());
    }

    /**
     * Check if a plugin is installed
     */
    hasPlugin(pluginName: string): boolean {
        return this.installedPlugins.has(pluginName);
    }

    /**
     * Get a custom extension added by a plugin
     */
    getExtension<T = any>(extensionName: string): T | undefined {
        return this.extensions.get(extensionName);
    }
}
