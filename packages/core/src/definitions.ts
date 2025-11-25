/**
 * Type Definitions for OrionECS
 *
 * This module contains all TypeScript type definitions, interfaces, and type utilities
 * used throughout the OrionECS framework.
 *
 * @packageDocumentation
 * @module Definitions
 */

// Import plugin types from @orion-ecs/plugin-api for local use
import type { SystemMessage as PluginApiSystemMessage } from '@orion-ecs/plugin-api';

// Re-export plugin types from @orion-ecs/plugin-api for backward compatibility
// Plugin authors can import directly from @orion-ecs/plugin-api for a lighter dependency
export type {
    EnginePlugin,
    ExtractPluginExtensions,
    InstalledPlugin,
    SystemMessage,
} from '@orion-ecs/plugin-api';

// Alias for local use within this file
type SystemMessage = PluginApiSystemMessage;

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

/**
 * Optional lifecycle hooks that components can implement.
 *
 * @public
 */
export interface ComponentLifecycle {
    /** Called immediately after component is added to an entity */
    onCreate?(entity: EntityDef): void;
    /** Called before component is removed from an entity */
    onDestroy?(entity: EntityDef): void;
    /** Called when component data changes (when using reactive components) */
    onChanged?(): void;
}

/**
 * Event emitted when a component's data is modified.
 *
 * This event is triggered when a component is marked as dirty, either manually
 * via `markComponentDirty()` or automatically via Proxy-based change detection.
 *
 * @typeParam T - The component type
 * @public
 */
export interface ComponentChangeEvent<T = any> {
    /** The entity that owns the modified component */
    entity: EntityDef;
    /** The type/class of the component that changed */
    componentType: ComponentIdentifier<T>;
    /** The previous value of the component (may be undefined for manual dirty marking) */
    oldValue?: T;
    /** The current value of the component */
    newValue: T;
    /** Unix timestamp (milliseconds) when the change occurred */
    timestamp: number;
}

/**
 * Event emitted when a component is added to an entity.
 *
 * This event is triggered immediately after a component is successfully added to an entity,
 * including validation and archetype movement (if applicable).
 *
 * @typeParam T - The component type
 * @public
 */
export interface ComponentAddedEvent<T = any> {
    /** The entity that received the component */
    entity: EntityDef;
    /** The type/class of the component that was added */
    componentType: ComponentIdentifier<T>;
    /** The component instance that was added */
    component: T;
    /** Unix timestamp (milliseconds) when the component was added */
    timestamp: number;
}

/**
 * Event emitted when a component is removed from an entity.
 *
 * This event is triggered before the component is destroyed, allowing listeners
 * to access the component data one last time before cleanup.
 *
 * @typeParam T - The component type
 * @public
 */
export interface ComponentRemovedEvent<T = any> {
    /** The entity that the component was removed from */
    entity: EntityDef;
    /** The type/class of the component that was removed */
    componentType: ComponentIdentifier<T>;
    /** The component instance that was removed */
    component: T;
    /** Unix timestamp (milliseconds) when the component was removed */
    timestamp: number;
}

/**
 * Configuration options for the component change tracking system.
 *
 * These options control how component changes are detected and reported,
 * enabling reactive programming patterns and performance optimizations.
 *
 * @public
 */
export interface ChangeTrackingOptions {
    /**
     * Enable automatic Proxy-based change detection.
     *
     * When enabled, components wrapped with `createReactiveComponent()` will
     * automatically emit change events when their properties are modified.
     *
     * @defaultValue false
     */
    enableProxyTracking?: boolean;

    /**
     * Start the engine in batch mode (change events suspended).
     *
     * Useful for bulk initialization where you want to defer change events
     * until after setup is complete. Can be toggled at runtime via `setBatchMode()`.
     *
     * @defaultValue false
     */
    batchMode?: boolean;

    /**
     * Debounce change events by this many milliseconds.
     *
     * When set to a non-zero value, rapid successive changes to the same component
     * will be coalesced into a single event emission after the specified delay.
     * Set to 0 to disable debouncing.
     *
     * @defaultValue 0
     */
    debounceMs?: number;
}

/**
 * Callback function invoked when a component is modified.
 *
 * @typeParam T - The component type
 * @param event - The component change event details
 * @public
 */
export type ComponentChangeListener<T = any> = (event: ComponentChangeEvent<T>) => void;

/**
 * Callback function invoked when a component is added to an entity.
 *
 * @typeParam T - The component type
 * @param event - The component added event details
 * @public
 */
export type ComponentAddedListener<T = any> = (event: ComponentAddedEvent<T>) => void;

/**
 * Callback function invoked when a component is removed from an entity.
 *
 * @typeParam T - The component type
 * @param event - The component removed event details
 * @public
 */
export type ComponentRemovedListener<T = any> = (event: ComponentRemovedEvent<T>) => void;

/**
 * Event emitted when a singleton component is set or updated.
 *
 * Singleton components represent global state that exists once per engine instance,
 * independent of any specific entity. Examples include game time, global settings,
 * or score managers.
 *
 * @typeParam T - The component type
 * @public
 */
export interface SingletonSetEvent<T = any> {
    /** The type/class of the singleton component */
    componentType: ComponentIdentifier<T>;
    /** The previous value of the singleton (undefined if newly set) */
    oldValue?: T;
    /** The current value of the singleton */
    newValue: T;
    /** Unix timestamp (milliseconds) when the singleton was set */
    timestamp: number;
}

/**
 * Event emitted when a singleton component is removed.
 *
 * @typeParam T - The component type
 * @public
 */
export interface SingletonRemovedEvent<T = any> {
    /** The type/class of the singleton component that was removed */
    componentType: ComponentIdentifier<T>;
    /** The component instance that was removed */
    component: T;
    /** Unix timestamp (milliseconds) when the singleton was removed */
    timestamp: number;
}

/**
 * Callback function invoked when a singleton component is set or updated.
 *
 * @typeParam T - The component type
 * @param event - The singleton set event details
 * @public
 */
export type SingletonSetListener<T = any> = (event: SingletonSetEvent<T>) => void;

/**
 * Callback function invoked when a singleton component is removed.
 *
 * @typeParam T - The component type
 * @param event - The singleton removed event details
 * @public
 */
export type SingletonRemovedListener<T = any> = (event: SingletonRemovedEvent<T>) => void;

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

    /**
     * Callback invoked when a component is added to any entity.
     *
     * Can be filtered to specific component types using the `watchComponents` option.
     */
    onComponentAdded?: ComponentAddedListener;

    /**
     * Callback invoked when a component is removed from any entity.
     *
     * Can be filtered to specific component types using the `watchComponents` option.
     */
    onComponentRemoved?: ComponentRemovedListener;

    /**
     * Callback invoked when a component's data is modified.
     *
     * Can be filtered to specific component types using the `watchComponents` option.
     * Only triggered when components are marked dirty via `markComponentDirty()` or
     * when using reactive components with Proxy-based tracking.
     */
    onComponentChanged?: ComponentChangeListener;

    /**
     * Filter component change events to only these component types.
     *
     * When specified, `onComponentAdded`, `onComponentRemoved`, and `onComponentChanged`
     * callbacks will only be invoked for components matching these types.
     * If omitted, all component changes will trigger the callbacks.
     */
    watchComponents?: ComponentIdentifier[];

    /**
     * Callback invoked when a singleton component is set or updated.
     *
     * Can be filtered to specific component types using the `watchSingletons` option.
     */
    onSingletonSet?: SingletonSetListener;

    /**
     * Callback invoked when a singleton component is removed.
     *
     * Can be filtered to specific component types using the `watchSingletons` option.
     */
    onSingletonRemoved?: SingletonRemovedListener;

    /**
     * Filter singleton change events to only these component types.
     *
     * When specified, `onSingletonSet` and `onSingletonRemoved` callbacks will only be
     * invoked for singleton components matching these types.
     * If omitted, all singleton changes will trigger the callbacks.
     */
    watchSingletons?: ComponentIdentifier[];
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
    | 'onEntityHierarchyChanged'
    | 'onSingletonSet'
    | 'onSingletonRemoved';

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
    singletons?: { [componentName: string]: any };
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

// Note: SystemMessage is imported from @orion-ecs/plugin-api above

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

    // Singleton component management
    setSingleton<T>(type: ComponentIdentifier<T>, ...args: any[]): T;
    getSingleton<T>(type: ComponentIdentifier<T>): T | undefined;
    hasSingleton<T>(type: ComponentIdentifier<T>): boolean;
    removeSingleton<T>(type: ComponentIdentifier<T>): T | undefined;

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

// Note: EnginePlugin, ExtractPluginExtensions, and InstalledPlugin are
// imported from @orion-ecs/plugin-api and re-exported above.
// This allows plugin authors to use the lighter @orion-ecs/plugin-api package
// while maintaining backward compatibility for existing @orion-ecs/core users.

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
