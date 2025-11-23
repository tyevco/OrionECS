/**
 * Type Definitions for OrionECS
 *
 * This module contains all TypeScript type definitions, interfaces, and type utilities
 * used throughout the OrionECS framework.
 *
 * @packageDocumentation
 * @module Definitions
 */

/**
 * Type representing a component class constructor.
 *
 * @typeParam T - The instance type of the component
 * @public
 */
export type ComponentIdentifier<T = any> = new (...args: any[]) => T;

/**
 * Extract constructor parameter types from a component identifier.
 *
 * @typeParam T - The component identifier type
 * @public
 */
export type ComponentArgs<T> = T extends new (...args: infer A) => any ? A : never;

/**
 * Extract the instance type from a ComponentIdentifier.
 *
 * @typeParam T - The component identifier type
 * @public
 */
export type ComponentInstance<T> = T extends ComponentIdentifier<infer I> ? I : never;

/**
 * Map an array of ComponentIdentifiers to their instance types.
 *
 * @typeParam T - Array of component identifier types
 * @public
 */
export type ComponentTypes<T extends readonly ComponentIdentifier[]> = {
    [K in keyof T]: T[K] extends ComponentIdentifier<infer I> ? I : never;
};

/** @public */
export type EventTypes<T = any> = string | symbol | keyof T;

/** @public */
export type EventCallback<T = void> = (...args: any[]) => T;

// Component lifecycle hooks
export interface ComponentLifecycle {
    onCreate?(entity: EntityDef): void;
    onDestroy?(entity: EntityDef): void;
    onChanged?(): void;
}

// Component change events
export interface ComponentChangeEvent<T = any> {
    entity: EntityDef;
    componentType: ComponentIdentifier<T>;
    oldValue?: T;
    newValue: T;
    timestamp: number;
}

export interface ComponentAddedEvent<T = any> {
    entity: EntityDef;
    componentType: ComponentIdentifier<T>;
    component: T;
    timestamp: number;
}

export interface ComponentRemovedEvent<T = any> {
    entity: EntityDef;
    componentType: ComponentIdentifier<T>;
    component: T;
    timestamp: number;
}

// Change tracking options
export interface ChangeTrackingOptions {
    enableProxyTracking?: boolean; // Enable automatic Proxy-based change detection
    batchMode?: boolean; // Disable events during batch operations
    debounceMs?: number; // Debounce change events (0 = disabled)
}

// Component change listener
export type ComponentChangeListener<T = any> = (event: ComponentChangeEvent<T>) => void;
export type ComponentAddedListener<T = any> = (event: ComponentAddedEvent<T>) => void;
export type ComponentRemovedListener<T = any> = (event: ComponentRemovedEvent<T>) => void;

// Enhanced system options with profiling and lifecycle hooks
export interface SystemOptions<C extends readonly any[] = any[]> {
    act?: (entity: EntityDef, ...components: C) => void;
    before?: () => void;
    after?: () => void;
    priority?: number;
    enabled?: boolean;
    tags?: string[];
    group?: string;
    runAfter?: string[];
    runBefore?: string[];
    // Component change event listeners
    onComponentAdded?: ComponentAddedListener;
    onComponentRemoved?: ComponentRemovedListener;
    onComponentChanged?: ComponentChangeListener;
    watchComponents?: ComponentIdentifier[]; // Only listen to changes for these components
}

export type SystemType<T extends readonly any[] = any[]> = SystemOptions<T> & Partial<EngineEvents>;

// Enhanced engine events
export interface EngineEvents {
    onStop: EventCallback;
    onStart: EventCallback;
    beforeAct: EventCallback;
    afterAct: EventCallback;
    onSystemEnabled: EventCallback;
    onSystemDisabled: EventCallback;
    onSceneChanged: EventCallback;
}

export type EngineEventNames =
    | keyof EngineEvents
    | 'onEntityCreated'
    | 'onEntityReleased'
    | 'onComponentAdded'
    | 'onComponentRemoved'
    | 'onEntityHierarchyChanged';

// Enhanced entity interface
export interface EntityDef {
    id: symbol;
    name?: string;
    parent?: EntityDef;
    children: EntityDef[];
    tags: Set<string>;
    queueFree(): void;
    addComponent<T>(
        type: new (...args: any[]) => T,
        ...args: ConstructorParameters<typeof type>
    ): this;
    removeComponent<T>(type: new (...args: any[]) => T): this;
    hasComponent<T>(type: new (...args: any[]) => T): boolean;
    getComponent<T>(type: new (...args: any[]) => T): T;
    addTag(tag: string): this;
    removeTag(tag: string): this;
    hasTag(tag: string): boolean;
    setParent(parent: EntityDef | null): this;
    addChild(child: EntityDef): this;
    removeChild(child: EntityDef): this;
    get isDirty(): boolean;
    get isMarkedForDeletion(): boolean;
    serialize(): SerializedEntity;
}

/**
 * Configuration options for entity queries.
 *
 * QueryOptions define the filters for matching entities based on their components
 * and tags. Supports ALL (must have all), ANY (must have at least one), and NOT
 * (must not have) semantics, plus tag filtering.
 *
 * @typeParam All - Tuple type of component identifiers for the ALL filter
 *
 * @example
 * ```typescript
 * // Query for entities with Position AND Velocity
 * const movingQuery: QueryOptions = {
 *   all: [Position, Velocity]
 * };
 *
 * // Query for entities with any damage type, but not dead
 * const damageQuery: QueryOptions = {
 *   any: [MeleeDamage, RangedDamage, MagicDamage],
 *   none: [Dead],
 *   tags: ['hostile']
 * };
 * ```
 *
 * @public
 */
export interface QueryOptions<All extends readonly ComponentIdentifier[] = ComponentIdentifier[]> {
    all?: All;
    any?: ComponentIdentifier[];
    none?: ComponentIdentifier[];
    tags?: string[];
    withoutTags?: string[];
}

// Serialization interfaces
export interface SerializedEntity {
    id: string;
    name?: string;
    tags: string[];
    components: { [componentName: string]: any };
    children?: SerializedEntity[];
}

export interface SerializedWorld {
    entities: SerializedEntity[];
    timestamp: number;
}

/**
 * Factory function for creating parameterized entity prefabs.
 *
 * @param args - Arguments to customize the prefab
 * @returns Partial entity prefab definition
 *
 * @public
 */
export type EntityPrefabFactory = (...args: any[]) => Omit<EntityPrefab, 'factory' | 'parent'>;

/**
 * Template definition for creating entities with predefined components and configuration.
 *
 * Prefabs allow you to define reusable entity templates that can be instantiated
 * multiple times with consistent configuration. They support component setup,
 * tagging, hierarchies, and inheritance from other prefabs.
 *
 * @example Basic Prefab
 * ```typescript
 * const enemyPrefab: EntityPrefab = {
 *   name: 'Enemy',
 *   components: [
 *     { type: Position, args: [0, 0] },
 *     { type: Health, args: [50, 50] },
 *     { type: AIController, args: [] }
 *   ],
 *   tags: ['enemy', 'hostile']
 * };
 *
 * engine.registerPrefab('Enemy', enemyPrefab);
 * const goblin = engine.createFromPrefab('Enemy');
 * ```
 *
 * @example Prefab with Hierarchy
 * ```typescript
 * const turretPrefab: EntityPrefab = {
 *   name: 'Turret',
 *   components: [
 *     { type: Position, args: [0, 0] },
 *     { type: Sprite, args: ['turret.png'] }
 *   ],
 *   tags: ['weapon'],
 *   children: [{
 *     name: 'TurretBarrel',
 *     components: [
 *       { type: Position, args: [0, -10] },
 *       { type: Sprite, args: ['barrel.png'] }
 *     ],
 *     tags: []
 *   }]
 * };
 * ```
 *
 * @public
 */
export interface EntityPrefab {
    name: string;
    components: { type: ComponentIdentifier; args: any[] }[];
    tags: string[];
    children?: EntityPrefab[];
    factory?: EntityPrefabFactory; // Optional factory for parameterized prefabs
    parent?: string; // Optional parent prefab name for inheritance
}

export interface EntityPrefabOverride {
    components?: { [componentName: string]: any };
    tags?: string[];
    children?: EntityPrefab[];
}

// Performance monitoring
export interface SystemProfile {
    name: string;
    executionTime: number;
    entityCount: number;
    callCount: number;
    averageTime: number;
}

export interface QueryStats {
    query: any; // Query instance
    executionCount: number;
    totalTimeMs: number;
    averageTimeMs: number;
    lastMatchCount: number;
    cacheHitRate?: number;
}

export interface MemoryStats {
    totalEntities: number;
    activeEntities: number;
    componentArrays: { [componentName: string]: number };
    totalMemoryEstimate: number;
}

// Component validation
export interface ComponentValidator<T = any> {
    validate(component: T): boolean | string;
    dependencies?: ComponentIdentifier[];
    conflicts?: ComponentIdentifier[];
}

// Tag component marker
export interface TagComponent {
    __isTag: true;
}

// Inter-system messaging
export interface SystemMessage {
    type: string;
    data: any;
    sender?: string;
    timestamp: number;
}

/**
 * Context object providing sandboxed access to engine features for plugins.
 *
 * The PluginContext is passed to plugins during installation and provides a
 * safe, controlled interface for plugins to interact with the engine without
 * requiring direct access to the Engine instance.
 *
 * @remarks
 * Plugins should use the PluginContext exclusively for engine interaction
 * rather than storing references to the Engine instance.
 *
 * @example
 * ```typescript
 * class MyPlugin implements EnginePlugin {
 *   name = 'MyPlugin';
 *
 *   install(context: PluginContext): void {
 *     // Register custom component
 *     context.registerComponent(MyComponent);
 *
 *     // Create a system
 *     context.createSystem('MySystem', {
 *       all: [MyComponent]
 *     }, {
 *       act: (entity, component) => {
 *         // System logic
 *       }
 *     });
 *
 *     // Extend engine API
 *     context.extend('myFeature', {
 *       doSomething: () => { }
 *     });
 *   }
 * }
 * ```
 *
 * @public
 */
export interface PluginContext {
    // Component registration
    registerComponent<T>(type: ComponentIdentifier<T>): void;
    registerComponentValidator<T>(
        type: ComponentIdentifier<T>,
        validator: ComponentValidator<T>
    ): void;

    // System creation
    createSystem<All extends readonly ComponentIdentifier[]>(
        name: string,
        queryOptions: QueryOptions<All>,
        options: SystemType<ComponentTypes<All>>,
        isFixedUpdate?: boolean
    ): any; // System<ComponentTypes<All>>

    // Query creation
    createQuery<All extends readonly ComponentIdentifier[]>(options: QueryOptions<All>): any; // Query<ComponentTypes<All>>

    // Prefab registration and management
    registerPrefab(name: string, prefab: EntityPrefab): void;
    definePrefab(name: string, factory: EntityPrefabFactory): EntityPrefab;
    extendPrefab(
        baseName: string,
        overrides: Partial<EntityPrefab>,
        newName?: string
    ): EntityPrefab;
    variantOfPrefab(
        baseName: string,
        overrides: {
            components?: { [componentName: string]: any };
            tags?: string[];
            children?: EntityPrefab[];
        },
        newName?: string
    ): EntityPrefab;

    // Event system
    on(event: string, callback: (...args: any[]) => void): () => void;
    emit(event: string, ...args: any[]): void;

    // Message bus
    messageBus: {
        subscribe(messageType: string, callback: (message: SystemMessage) => void): () => void;
        publish(messageType: string, data: any, sender?: string): void;
    };

    // Allow plugins to extend the engine with custom APIs
    extend<T extends object>(extensionName: string, api: T): void;

    // Get engine instance for advanced use cases
    getEngine(): any; // Engine
}

/**
 * Interface for creating plugins that extend the OrionECS engine.
 *
 * Plugins provide a clean way to add functionality to the engine without modifying
 * core code. They can register components, create systems, extend the engine API,
 * and integrate with external libraries.
 *
 * @remarks
 * Plugins are registered during engine construction using `EngineBuilder.use()`.
 * The install() method is called once during engine build, and the optional
 * uninstall() method is called if the plugin needs cleanup.
 *
 * @example Basic Plugin
 * ```typescript
 * class LoggingPlugin implements EnginePlugin {
 *   name = 'LoggingPlugin';
 *   version = '1.0.0';
 *
 *   install(context: PluginContext): void {
 *     context.on('onEntityCreated', (entity) => {
 *       console.log(`Entity created: ${entity.name}`);
 *     });
 *
 *     context.on('onSystemEnabled', (system) => {
 *       console.log(`System enabled: ${system.name}`);
 *     });
 *   }
 *
 *   uninstall(): void {
 *     console.log('LoggingPlugin uninstalled');
 *   }
 * }
 *
 * const engine = new EngineBuilder()
 *   .use(new LoggingPlugin())
 *   .build();
 * ```
 *
 * @example Physics Plugin
 * ```typescript
 * class PhysicsPlugin implements EnginePlugin {
 *   name = 'PhysicsPlugin';
 *   version = '2.0.0';
 *
 *   install(context: PluginContext): void {
 *     // Register physics components
 *     context.registerComponent(RigidBody);
 *     context.registerComponent(Collider);
 *
 *     // Create physics system
 *     context.createSystem('PhysicsStep', {
 *       all: [RigidBody, Position]
 *     }, {
 *       priority: 100,
 *       act: (entity, body, position) => {
 *         // Apply physics simulation
 *         body.velocity.y += body.gravity;
 *         position.x += body.velocity.x;
 *         position.y += body.velocity.y;
 *       }
 *     }, true);  // Fixed update
 *
 *     // Extend engine with physics utilities
 *     context.extend('physics', {
 *       applyForce: (entity, force) => { },
 *       raycast: (from, to) => { }
 *     });
 *   }
 * }
 * ```
 *
 * @public
 */
export interface EnginePlugin {
    /**
     * Unique name identifying this plugin
     */
    name: string;

    /**
     * Optional semantic version string (e.g., "1.0.0")
     */
    version?: string;

    /**
     * Called during engine construction to install the plugin.
     *
     * This method receives a PluginContext for safe engine interaction.
     * Can be async if the plugin needs to load external resources.
     *
     * @param context - Sandboxed context for engine interaction
     */
    install(context: PluginContext): void | Promise<void>;

    /**
     * Optional cleanup method called when the plugin is uninstalled.
     *
     * Use this to remove event listeners, clean up resources, or
     * perform other teardown operations.
     */
    uninstall?(): void | Promise<void>;
}

export interface InstalledPlugin {
    plugin: EnginePlugin;
    installedAt: number;
}

// Component pooling
export interface PoolStats {
    available: number;
    totalCreated: number;
    totalAcquired: number;
    totalReleased: number;
    reuseRate: number;
}

export interface ComponentPoolOptions {
    initialSize?: number;
    maxSize?: number;
}
