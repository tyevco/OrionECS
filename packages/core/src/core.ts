/**
 * Core ECS Building Blocks
 *
 * This module contains the fundamental classes that form the foundation of OrionECS,
 * including entities, components, systems, queries, and performance utilities.
 *
 * @packageDocumentation
 * @module Core
 */

import type {
    ComponentIdentifier,
    EntityDef,
    QueryOptions,
    SerializedEntity,
    SystemMessage,
    SystemProfile,
    SystemType,
} from './definitions';

// Constants
const DEFAULT_POOL_MAX_SIZE = 1000;
const ESTIMATED_COMPONENT_SIZE_BYTES = 32;
const MAX_PERFORMANCE_SAMPLES = 60;
const MAX_MESSAGE_HISTORY = 1000;
const MAX_EVENT_HISTORY = 500;

/**
 * Generic object pool for efficient memory reuse and reduced garbage collection.
 *
 * The Pool class manages a collection of reusable objects, reducing the overhead
 * of frequent object creation and destruction. Objects are acquired from the pool,
 * used, and then released back for reuse.
 *
 * @typeParam T - The type of objects stored in the pool
 *
 * @example
 * ```typescript
 * const particlePool = new Pool(
 *   () => new Particle(),           // Create function
 *   (p) => { p.x = 0; p.y = 0; },  // Reset function
 *   100                              // Max pool size
 * );
 *
 * const particle = particlePool.acquire();
 * // Use particle...
 * particlePool.release(particle);
 * ```
 *
 * @public
 */
export class Pool<T> {
    private available: T[] = [];
    private _totalCreated: number = 0;
    private _totalAcquired: number = 0;
    private _totalReleased: number = 0;
    private _maxSize: number;

    constructor(
        private createFunc: () => T,
        private resetFunc: (item: T) => void,
        maxSize: number = DEFAULT_POOL_MAX_SIZE
    ) {
        this._maxSize = maxSize;
    }

    public acquire(): T {
        this._totalAcquired++;
        if (this.available.length > 0) {
            const item = this.available.pop();
            if (item !== undefined) {
                return item;
            }
        }
        this._totalCreated++;
        return this.createFunc();
    }

    public release(item: T): void {
        this._totalReleased++;
        this.resetFunc(item);
        if (this.available.length < this._maxSize) {
            this.available.push(item);
        }
    }

    get stats() {
        return {
            available: this.available.length,
            totalCreated: this._totalCreated,
            totalAcquired: this._totalAcquired,
            totalReleased: this._totalReleased,
            reuseRate:
                this._totalAcquired > 0
                    ? (this._totalAcquired - this._totalCreated) / this._totalAcquired
                    : 0,
        };
    }
}

/**
 * Sparse array optimized for component storage with built-in change tracking.
 *
 * ComponentArray uses a sparse array structure to efficiently store components
 * indexed by entity ID, with automatic versioning to track modifications. Free
 * indices are reused to minimize memory fragmentation.
 *
 * @typeParam T - The component type to store
 *
 * @remarks
 * This class is used internally by the ComponentManager. Most users won't need
 * to interact with it directly.
 *
 * @internal
 */
export class ComponentArray<T> {
    private components: (T | null)[] = [];
    private freeIndices: number[] = [];
    private _version: number = 0;
    private _lastChanged: number = 0;
    private _dirtyIndices: Set<number> = new Set();
    private _batchMode: boolean = false;

    add(component: T): number {
        this._version++;
        this._lastChanged = performance.now();
        if (this.freeIndices.length > 0) {
            const index = this.freeIndices.pop();
            if (index !== undefined) {
                this.components[index] = component;
                this._dirtyIndices.add(index);
                return index;
            }
        }
        const index = this.components.push(component) - 1;
        this._dirtyIndices.add(index);
        return index;
    }

    remove(index: number): void {
        this._version++;
        this._lastChanged = performance.now();
        if (index >= 0 && index < this.components.length) {
            this.components[index] = null;
            this.freeIndices.push(index);
            this._dirtyIndices.delete(index);
        }
    }

    get(index: number): T | null {
        if (index < 0 || index >= this.components.length) {
            return null;
        }
        const component = this.components[index];
        return component !== undefined ? component : null;
    }

    set(index: number, component: T): void {
        this._version++;
        this._lastChanged = performance.now();
        if (index >= 0 && index < this.components.length) {
            this.components[index] = component;
            this._dirtyIndices.add(index);
        }
    }

    /**
     * Mark a component at the given index as dirty (changed)
     */
    markDirty(index: number): void {
        if (index >= 0 && index < this.components.length && this.components[index] !== null) {
            this._dirtyIndices.add(index);
            this._version++;
            this._lastChanged = performance.now();
        }
    }

    /**
     * Check if a component at the given index is dirty
     */
    isDirty(index: number): boolean {
        return this._dirtyIndices.has(index);
    }

    /**
     * Clear dirty flag for a component at the given index
     */
    clearDirty(index: number): void {
        this._dirtyIndices.delete(index);
    }

    /**
     * Get all dirty indices
     */
    getDirtyIndices(): number[] {
        return Array.from(this._dirtyIndices);
    }

    /**
     * Clear all dirty flags
     */
    clearAllDirty(): void {
        this._dirtyIndices.clear();
    }

    /**
     * Enable/disable batch mode (suspends change events)
     */
    setBatchMode(enabled: boolean): void {
        this._batchMode = enabled;
    }

    /**
     * Check if batch mode is enabled
     */
    get isBatchMode(): boolean {
        return this._batchMode;
    }

    get version(): number {
        return this._version;
    }
    get lastChanged(): number {
        return this._lastChanged;
    }
    get size(): number {
        return this.components.length - this.freeIndices.length;
    }
    get memoryEstimate(): number {
        return this.components.length * ESTIMATED_COMPONENT_SIZE_BYTES;
    }
}

/**
 * Efficient query system for finding entities with specific components and tags.
 *
 * Queries use a combination of ALL/ANY/NOT filters to match entities, with support
 * for tag-based filtering. Results are cached for performance and automatically
 * invalidated when entities change. When archetypes are enabled, queries can
 * iterate directly over archetype storage for significant performance gains.
 *
 * @typeParam C - Tuple type of component classes to query for
 *
 * @remarks
 * Queries should be created using `engine.createQuery()` or as part of system
 * definitions. The query automatically tracks entity changes and updates its
 * result set accordingly.
 *
 * @example ALL Query (entities must have all components)
 * ```typescript
 * const query = engine.createQuery({ all: [Position, Velocity] });
 *
 * for (const entity of query) {
 *   const pos = entity.getComponent(Position);
 *   const vel = entity.getComponent(Velocity);
 *   // Process entity...
 * }
 * ```
 *
 * @example ANY Query (entities must have at least one component)
 * ```typescript
 * const damageQuery = engine.createQuery({
 *   any: [MeleeDamage, RangedDamage, MagicDamage]
 * });
 * ```
 *
 * @example NOT Query (entities must NOT have components)
 * ```typescript
 * const livingEnemies = engine.createQuery({
 *   all: [Health, Enemy],
 *   none: [Dead]  // Exclude dead entities
 * });
 * ```
 *
 * @example Tag-based Query
 * ```typescript
 * const controllablePlayers = engine.createQuery({
 *   all: [InputComponent],
 *   tags: ['player', 'controllable'],
 *   withoutTags: ['frozen', 'stunned']
 * });
 * ```
 *
 * @public
 */
export class Query<C extends readonly any[] = any[]> {
    private matchingEntities: Set<Entity> = new Set();
    private cachedArray: Entity[] = [];
    private cacheVersion: number = 0;
    private currentVersion: number = 0;

    // Archetype-based iteration support
    private archetypeManager?: any; // ArchetypeManager
    private matchingArchetypes?: any[]; // Archetype[]
    private archetypesCacheValid: boolean = false;

    // Performance tracking
    private _executionCount: number = 0;
    private _totalTimeMs: number = 0;
    private _lastMatchCount: number = 0;
    private _cacheHits: number = 0;

    constructor(
        public options: QueryOptions<any>,
        archetypeManager?: any
    ) {
        this.archetypeManager = archetypeManager;
    }

    /**
     * Set the archetype manager for this query (enables archetype-based iteration)
     */
    setArchetypeManager(manager: any): void {
        this.archetypeManager = manager;
        this.archetypesCacheValid = false;
    }

    private test(entity: Entity): boolean {
        const { all = [], any = [], none = [], tags = [], withoutTags = [] } = this.options;

        if (all.length > 0 && !all.every((type: ComponentIdentifier) => entity.hasComponent(type)))
            return false;
        if (any.length > 0 && !any.some((type: ComponentIdentifier) => entity.hasComponent(type)))
            return false;
        if (none.some((type: ComponentIdentifier) => entity.hasComponent(type))) return false;
        if (tags.length > 0 && !tags.every((tag: string) => entity.hasTag(tag))) return false;
        if (withoutTags.some((tag: string) => entity.hasTag(tag))) return false;

        return true;
    }

    match(entity: Entity): boolean {
        const matches = this.test(entity);
        const hadEntity = this.matchingEntities.has(entity);

        if (matches) {
            if (!hadEntity) {
                this.matchingEntities.add(entity);
                this.currentVersion++;
            }
        } else {
            if (hadEntity) {
                this.matchingEntities.delete(entity);
                this.currentVersion++;
            }
        }

        return matches;
    }

    getEntities(): IterableIterator<Entity> {
        const startTime = performance.now();
        this._executionCount++;
        this._lastMatchCount = this.matchingEntities.size;

        const result = this.matchingEntities.values();

        const endTime = performance.now();
        this._totalTimeMs += endTime - startTime;

        return result;
    }

    getEntitiesArray(): Entity[] {
        const startTime = performance.now();
        this._executionCount++;
        this._lastMatchCount = this.matchingEntities.size;

        let result: Entity[];
        if (this.cacheVersion === this.currentVersion) {
            this._cacheHits++;
            result = this.cachedArray;
        } else {
            this.cachedArray = Array.from(this.matchingEntities);
            this.cacheVersion = this.currentVersion;
            result = this.cachedArray;
        }

        const endTime = performance.now();
        this._totalTimeMs += endTime - startTime;

        return result;
    }

    get size(): number {
        return this.matchingEntities.size;
    }

    /**
     * Make Query iterable - allows for...of loops
     */
    [Symbol.iterator](): IterableIterator<Entity> {
        return this.getEntities();
    }

    /**
     * Iterate over entities with direct component access
     * Reduces memory allocations by avoiding array creation
     * Uses archetype-based iteration for significantly better performance when available
     */
    forEach(callback: (entity: Entity, ...components: C) => void): void {
        const { all = [], tags = [], withoutTags = [] } = this.options;

        // Use archetype-based iteration if available (much faster!)
        if (this.archetypeManager) {
            if (!this.archetypesCacheValid) {
                this.matchingArchetypes = this.archetypeManager.getMatchingArchetypes(this.options);
                this.archetypesCacheValid = true;
            }

            if (this.matchingArchetypes) {
                // Iterate over archetypes (cache-friendly iteration)
                for (const archetype of this.matchingArchetypes) {
                    // Get component arrays in the query's specified order (not archetype's sorted order)
                    const componentArrays = archetype.getComponentArrays(all);
                    const entities = archetype.getEntities();

                    // Check if we need to filter by tags (tags are not part of archetype matching)
                    const needsTagFiltering = tags.length > 0 || withoutTags.length > 0;

                    // Iterate through entities
                    for (let i = 0; i < entities.length; i++) {
                        const entity = entities[i];

                        if (needsTagFiltering) {
                            // Filter by tags
                            if (tags.length > 0 && !tags.every((tag: string) => entity.hasTag(tag)))
                                continue;
                            if (withoutTags.some((tag: string) => entity.hasTag(tag))) continue;
                        }

                        // Extract components in query order
                        const components = componentArrays.map((arr: any[]) => arr[i]);
                        callback(entity, ...(components as unknown as C));
                    }
                }
                return;
            }
        }

        // Fallback to traditional entity-based iteration
        for (const entity of this.matchingEntities) {
            const componentArgs = all.map((componentType: ComponentIdentifier) =>
                entity.getComponent(componentType)
            ) as C;
            callback(entity, ...componentArgs);
        }
    }

    /**
     * Get performance statistics for this query
     */
    getStats(): any {
        return {
            query: this,
            executionCount: this._executionCount,
            totalTimeMs: this._totalTimeMs,
            averageTimeMs: this._executionCount > 0 ? this._totalTimeMs / this._executionCount : 0,
            lastMatchCount: this._lastMatchCount,
            cacheHitRate:
                this._executionCount > 0 ? (this._cacheHits / this._executionCount) * 100 : 0,
        };
    }
}

/**
 * Fluent query builder for constructing complex queries
 */
export class QueryBuilder<C extends readonly any[] = any[]> {
    private options: QueryOptions<any> = {};

    constructor(private createQueryFn: (options: QueryOptions<any>) => Query<C>) {}

    /**
     * Add components that entities must have
     */
    withAll(...types: ComponentIdentifier[]): this {
        this.options.all = types;
        return this;
    }

    /**
     * Add components where entities must have at least one
     */
    withAny(...types: ComponentIdentifier[]): this {
        this.options.any = types;
        return this;
    }

    /**
     * Add components that entities must NOT have
     */
    withNone(...types: ComponentIdentifier[]): this {
        this.options.none = types;
        return this;
    }

    /**
     * Add tags that entities must have
     */
    withTags(...tags: string[]): this {
        this.options.tags = tags;
        return this;
    }

    /**
     * Add tags that entities must NOT have
     */
    withoutTags(...tags: string[]): this {
        this.options.withoutTags = tags;
        return this;
    }

    /**
     * Build and return the Query instance
     */
    build(): Query<C> {
        return this.createQueryFn(this.options);
    }
}

/**
 * Represents a game object in the Entity Component System.
 *
 * An Entity is a unique identifier that serves as a container for components.
 * Entities support hierarchical relationships (parent/child), tagging, and
 * lifecycle management. They are pooled for performance and automatically
 * cleaned up when marked for deletion.
 *
 * @remarks
 * Entities should be created using `engine.createEntity()` rather than
 * direct instantiation. Each entity has both a unique symbol ID and an
 * incrementing numeric ID for different use cases.
 *
 * @example Basic Entity Creation
 * ```typescript
 * const player = engine.createEntity('Player');
 * player.addComponent(Position, 0, 0);
 * player.addComponent(Health, 100, 100);
 * player.addTag('controllable');
 * ```
 *
 * @example Entity Hierarchy
 * ```typescript
 * const ship = engine.createEntity('Ship');
 * const turret = engine.createEntity('Turret');
 *
 * ship.addChild(turret);  // Turret follows ship
 * console.log(turret.parent === ship);  // true
 *
 * ship.queueFree();  // Also destroys turret
 * ```
 *
 * @example Component Access
 * ```typescript
 * if (entity.hasComponent(Health)) {
 *   const health = entity.getComponent(Health);
 *   health.current -= damage;
 *
 *   if (health.current <= 0) {
 *     entity.queueFree();
 *   }
 * }
 * ```
 *
 * @public
 */
export class Entity implements EntityDef {
    private readonly _id: symbol;
    private readonly _numericId: number;
    private _name?: string;
    private _dirty: boolean = false;
    private _componentIndices: Map<ComponentIdentifier, number> = new Map();
    private _markedForDelete: boolean = false;
    private _parent?: Entity;
    private _children: Set<Entity> = new Set();
    private _tags: Set<string> = new Set();
    private _changeVersion: number = 0;
    private static _nextId: number = 1;

    // Dependency injection of managers
    constructor(
        private componentManager: any, // ComponentManager
        private eventEmitter: any // EventEmitter or callback
    ) {
        this._id = Symbol();
        this._numericId = Entity._nextId++;
    }

    get id(): symbol {
        return this._id;
    }
    get numericId(): number {
        return this._numericId;
    }
    get name(): string | undefined {
        return this._name;
    }
    set name(value: string | undefined) {
        this._name = value;
    }
    get parent(): EntityDef | undefined {
        return this._parent;
    }
    get children(): EntityDef[] {
        return Array.from(this._children);
    }
    get tags(): Set<string> {
        return new Set(this._tags);
    }
    get isDirty(): boolean {
        return this._dirty;
    }
    get isMarkedForDeletion(): boolean {
        return this._markedForDelete;
    }
    get changeVersion(): number {
        return this._changeVersion;
    }

    getComponentTypes(): ComponentIdentifier[] {
        return Array.from(this._componentIndices.keys());
    }

    private static asEntity(entity: EntityDef): Entity {
        if (entity instanceof Entity) {
            return entity;
        }
        throw new Error('Invalid entity type - expected Entity instance');
    }

    addComponent<T>(
        type: ComponentIdentifier<T>,
        ...args: ConstructorParameters<typeof type>
    ): this {
        if (!this._componentIndices.has(type)) {
            const validator = this.componentManager.getValidator(type);

            if (validator?.dependencies) {
                for (const dep of validator.dependencies) {
                    if (!this.hasComponent(dep)) {
                        throw new Error(
                            `Component ${type.name} requires ${dep.name} on entity ${this._name || this._numericId}`
                        );
                    }
                }
            }

            if (validator?.conflicts) {
                for (const conflict of validator.conflicts) {
                    if (this.hasComponent(conflict)) {
                        throw new Error(
                            `Component ${type.name} conflicts with ${conflict.name} on entity ${this._name || this._numericId}`
                        );
                    }
                }
            }

            // Use pool if available, otherwise create normally
            const component = this.componentManager.acquireComponent(type, ...args);

            if (validator) {
                const validationResult = validator.validate(component);
                if (validationResult !== true) {
                    const errorMessage =
                        typeof validationResult === 'string'
                            ? validationResult
                            : 'Component validation failed';
                    throw new Error(
                        `${errorMessage} for ${type.name} on entity ${this._name || this._numericId}`
                    );
                }
            }

            // Check if archetypes are enabled
            const archetypeManager = this.componentManager.getArchetypeManager();
            if (archetypeManager) {
                // Archetype mode: move entity to new archetype
                const newComponentTypes = [...this._componentIndices.keys(), type];
                const components = new Map<ComponentIdentifier, any>();

                // Gather existing components from archetype (only if entity has components)
                if (this._componentIndices.size > 0) {
                    for (const compType of this._componentIndices.keys()) {
                        const existingComp = archetypeManager.getComponent(this, compType);
                        if (existingComp !== null) {
                            components.set(compType, existingComp);
                        }
                    }
                }

                // Add new component
                components.set(type, component);

                // Move entity to new archetype
                archetypeManager.moveEntity(this, newComponentTypes, components);

                // Update component indices to reflect archetype storage
                this._componentIndices.set(type, -1); // -1 indicates archetype storage
            } else {
                // Legacy mode: use sparse arrays
                const componentArray = this.componentManager.getComponentArray(type);
                const index = componentArray.add(component);
                this._componentIndices.set(type, index);
            }

            this._dirty = true;
            this._changeVersion++;

            // Call onCreate lifecycle hook if it exists
            if (component && typeof (component as any).onCreate === 'function') {
                (component as any).onCreate(this);
            }

            this.eventEmitter.emit('onComponentAdded', this, type);
        }
        return this;
    }

    removeComponent<T>(type: ComponentIdentifier<T>): this {
        const index = this._componentIndices.get(type);
        if (index !== undefined) {
            const archetypeManager = this.componentManager.getArchetypeManager();
            let removedComponent: any = null;

            if (archetypeManager) {
                // Archetype mode: move entity to new archetype
                const component = archetypeManager.getComponent(this, type);
                removedComponent = component;

                // Call onDestroy lifecycle hook if it exists
                if (component && typeof (component as any).onDestroy === 'function') {
                    (component as any).onDestroy(this);
                }

                // Release component to pool
                if (component) {
                    this.componentManager.releaseComponent(type, component);
                }

                // Get new component types (excluding the removed one)
                const newComponentTypes = Array.from(this._componentIndices.keys()).filter(
                    (t) => t !== type
                );

                // Gather remaining components
                const components = new Map<ComponentIdentifier, any>();
                for (const compType of newComponentTypes) {
                    const comp = archetypeManager.getComponent(this, compType);
                    if (comp) {
                        components.set(compType, comp);
                    }
                }

                // Move entity to new archetype
                archetypeManager.moveEntity(this, newComponentTypes, components);

                // Remove from component indices
                this._componentIndices.delete(type);
            } else {
                // Legacy mode: use sparse arrays
                const componentArray = this.componentManager.getComponentArray(type);
                // Get component before removing to release it to pool
                const component = componentArray.get(index);
                removedComponent = component;
                if (component !== null) {
                    // Call onDestroy lifecycle hook if it exists
                    if (typeof (component as any).onDestroy === 'function') {
                        (component as any).onDestroy(this);
                    }

                    this.componentManager.releaseComponent(type, component);
                }
                componentArray.remove(index);
                this._componentIndices.delete(type);
            }

            this._dirty = true;
            this._changeVersion++;
            // Emit with component data for listeners to access
            const emittedComponent =
                removedComponent || this.componentManager.acquireComponent(type);
            this.eventEmitter.emit('onComponentRemoved', this, type, emittedComponent);
        }
        return this;
    }

    hasComponent<T>(type: ComponentIdentifier<T>): boolean {
        return this._componentIndices.has(type);
    }

    getComponent<T>(type: ComponentIdentifier<T>): T {
        const index = this._componentIndices.get(type);
        if (index === undefined) {
            throw new Error(
                `Component ${type.name} not found on entity ${this._name || this._numericId}`
            );
        }

        const archetypeManager = this.componentManager.getArchetypeManager();
        if (archetypeManager) {
            // Archetype mode: get component from archetype
            const component = archetypeManager.getComponent(this, type);
            if (component === null) {
                throw new Error(
                    `Component ${type.name} is null on entity ${this._name || this._numericId}`
                );
            }
            return component as T;
        } else {
            // Legacy mode: get component from sparse array
            const componentArray = this.componentManager.getComponentArray(type);
            const component = componentArray.get(index);
            if (component === null) {
                throw new Error(
                    `Component ${type.name} is null on entity ${this._name || this._numericId}`
                );
            }
            return component as T;
        }
    }

    addTag(tag: string): this {
        if (!this._tags.has(tag)) {
            this._tags.add(tag);
            this._changeVersion++;
            this._dirty = true;
            this.eventEmitter.emit('onTagChanged', this);
        }
        return this;
    }

    removeTag(tag: string): this {
        if (this._tags.has(tag)) {
            this._tags.delete(tag);
            this._changeVersion++;
            this._dirty = true;
            this.eventEmitter.emit('onTagChanged', this);
        }
        return this;
    }

    hasTag(tag: string): boolean {
        return this._tags.has(tag);
    }

    setParent(parent: EntityDef | null): this {
        if (this._parent === parent) return this;

        if (this._parent) {
            this._parent._children.delete(this);
        }

        this._parent = parent ? Entity.asEntity(parent) : undefined;

        if (this._parent) {
            this._parent._children.add(this);
        }

        this._changeVersion++;
        this.eventEmitter.emit('onEntityHierarchyChanged', this);
        return this;
    }

    addChild(child: EntityDef): this {
        Entity.asEntity(child).setParent(this);
        return this;
    }

    removeChild(child: EntityDef): this {
        const childEntity = Entity.asEntity(child);
        if (this._children.has(childEntity)) {
            childEntity.setParent(null);
        }
        return this;
    }

    queueFree(): void {
        this._markedForDelete = true;
    }

    clone(engine: any): Entity {
        return engine.cloneEntity(this);
    }

    serialize(): SerializedEntity {
        const components: { [componentName: string]: any } = {};

        // Check if archetypes are enabled
        const archetypeManager = this.componentManager.getArchetypeManager();

        for (const [componentType, index] of this._componentIndices) {
            let component: any = null;

            if (archetypeManager && index === -1) {
                // Archetype mode: get component from archetype
                component = archetypeManager.getComponent(
                    this,
                    componentType as ComponentIdentifier
                );
            } else {
                // Legacy mode: get component from sparse array
                const componentArray = this.componentManager.getComponentArray(
                    componentType as ComponentIdentifier
                );
                component = componentArray.get(index);
            }

            if (component) {
                components[componentType.name] = { ...component };
            }
        }

        return {
            id: this._numericId.toString(),
            name: this._name,
            tags: Array.from(this._tags),
            components,
            children: Array.from(this._children).map((child) => child.serialize()),
        };
    }

    reset(): void {
        this._componentIndices.clear();
        this._dirty = false;
        this._markedForDelete = false;
        this._name = undefined;
        this._parent = undefined;
        this._children.clear();
        this._tags.clear();
        this._changeVersion = 0;
    }

    static create(componentManager: any, eventEmitter: any): Entity {
        return new Entity(componentManager, eventEmitter);
    }
}

/**
 * SystemGroup for organizing systems into execution phases
 */
export class SystemGroup {
    systems: System<any>[] = [];

    constructor(
        public name: string,
        public priority: number,
        public enabled: boolean = true
    ) {}
}

/**
 * Represents a logic processor that operates on entities matching a query.
 *
 * Systems encapsulate game logic and operate on entities that match specific
 * component criteria. They support priority-based execution, lifecycle hooks,
 * performance profiling, and can be enabled/disabled at runtime.
 *
 * @typeParam C - Tuple type of component classes this system operates on
 *
 * @remarks
 * Systems should be created using `engine.createSystem()` rather than direct
 * instantiation. Each system maintains performance metrics and can be configured
 * with priority, tags, execution groups, and conditional running.
 *
 * @example Basic System
 * ```typescript
 * // Movement system that updates Position based on Velocity
 * engine.createSystem('Movement', {
 *   all: [Position, Velocity]
 * }, {
 *   act: (entity, position, velocity) => {
 *     position.x += velocity.x;
 *     position.y += velocity.y;
 *   }
 * });
 * ```
 *
 * @example System with Lifecycle Hooks
 * ```typescript
 * engine.createSystem('Physics', {
 *   all: [RigidBody, Position]
 * }, {
 *   priority: 100,  // Higher priority runs first
 *   before: () => {
 *     console.log('Physics system starting');
 *   },
 *   act: (entity, body, position) => {
 *     // Apply physics
 *     body.velocity.y += body.gravity;
 *     position.x += body.velocity.x;
 *     position.y += body.velocity.y;
 *   },
 *   after: () => {
 *     console.log('Physics system complete');
 *   }
 * });
 * ```
 *
 * @example Fixed Update System
 * ```typescript
 * // Physics runs at fixed 60 FPS regardless of frame rate
 * engine.createSystem('PhysicsStep', {
 *   all: [RigidBody]
 * }, {
 *   act: (entity, body) => {
 *     body.applyForces();
 *   }
 * }, true);  // true = fixed update system
 * ```
 *
 * @public
 */
export class System<C extends readonly any[] = any[]> {
    private query: Query<C>;
    private _enabled: boolean = true;
    private _priority: number = 0;
    private _profile: SystemProfile;
    private _tags: Set<string> = new Set();
    private _group?: string;
    private _runAfter: string[] = [];
    private _runBefore: string[] = [];
    private enableWhenPredicate?: () => boolean;
    private disableWhenPredicate?: () => boolean;
    private runIfPredicate?: () => boolean;
    private shouldRunOnce: boolean = false;
    private hasRunOnce: boolean = false;
    private timeSinceLastRun: number = 0;
    private runEveryInterval?: number;
    private hasRunEveryExecuted: boolean = false;

    constructor(
        public name: string,
        query: Query<C>,
        private options: SystemType<C>,
        private eventEmitter?: any // EventEmitter
    ) {
        this.query = query;
        this._priority = options.priority || 0;
        this._enabled = options.enabled !== false;
        this._group = options.group;
        this._runAfter = options.runAfter || [];
        this._runBefore = options.runBefore || [];

        if (options.tags) {
            options.tags.forEach((tag) => {
                this._tags.add(tag);
            });
        }

        this._profile = {
            name: this.name,
            executionTime: 0,
            entityCount: 0,
            callCount: 0,
            averageTime: 0,
        };

        // Set up component change event listeners if provided
        if (this.eventEmitter) {
            this.setupComponentChangeListeners();
        }
    }

    /**
     * Set up component change event listeners based on system options
     */
    private setupComponentChangeListeners(): void {
        if (!this.eventEmitter) return;

        const watchComponents = this.options.watchComponents;
        const watchSingletons = this.options.watchSingletons;

        // Subscribe to component added events
        if (this.options.onComponentAdded) {
            this.eventEmitter.on('onComponentAdded', (entity: any, componentType: any) => {
                // Filter by watchComponents if specified
                if (watchComponents && !watchComponents.includes(componentType)) {
                    return;
                }

                // Get the component
                const component = entity.getComponent(componentType);
                const event = {
                    entity,
                    componentType,
                    component,
                    timestamp: Date.now(),
                };

                this.options.onComponentAdded?.(event);
            });
        }

        // Subscribe to component removed events
        if (this.options.onComponentRemoved) {
            this.eventEmitter.on(
                'onComponentRemoved',
                (entity: any, componentType: any, component: any) => {
                    // Filter by watchComponents if specified
                    if (watchComponents && !watchComponents.includes(componentType)) {
                        return;
                    }

                    const event = {
                        entity,
                        componentType,
                        component,
                        timestamp: Date.now(),
                    };

                    this.options.onComponentRemoved?.(event);
                }
            );
        }

        // Subscribe to component changed events
        if (this.options.onComponentChanged) {
            this.eventEmitter.on('onComponentChanged', (event: any) => {
                // Filter by watchComponents if specified
                if (watchComponents && !watchComponents.includes(event.componentType)) {
                    return;
                }

                this.options.onComponentChanged?.(event);
            });
        }

        // Subscribe to singleton set events
        if (this.options.onSingletonSet) {
            this.eventEmitter.on('onSingletonSet', (event: any) => {
                // Filter by watchSingletons if specified
                if (watchSingletons && !watchSingletons.includes(event.componentType)) {
                    return;
                }

                this.options.onSingletonSet?.(event);
            });
        }

        // Subscribe to singleton removed events
        if (this.options.onSingletonRemoved) {
            this.eventEmitter.on('onSingletonRemoved', (event: any) => {
                // Filter by watchSingletons if specified
                if (watchSingletons && !watchSingletons.includes(event.componentType)) {
                    return;
                }

                this.options.onSingletonRemoved?.(event);
            });
        }
    }

    get enabled(): boolean {
        return this._enabled;
    }
    set enabled(value: boolean) {
        this._enabled = value;
    }
    get priority(): number {
        return this._priority;
    }
    set priority(value: number) {
        this._priority = value;
    }
    get tags(): Set<string> {
        return new Set(this._tags);
    }
    get profile(): SystemProfile {
        return { ...this._profile };
    }
    get group(): string | undefined {
        return this._group;
    }
    get runAfter(): string[] {
        return [...this._runAfter];
    }
    get runBefore(): string[] {
        return [...this._runBefore];
    }

    hasTag(tag: string): boolean {
        return this._tags.has(tag);
    }

    enableWhen(predicate: () => boolean): this {
        this.enableWhenPredicate = predicate;
        return this;
    }

    disableWhen(predicate: () => boolean): this {
        this.disableWhenPredicate = predicate;
        return this;
    }

    runIf(predicate: () => boolean): this {
        this.runIfPredicate = predicate;
        return this;
    }

    runOnce(): this {
        this.shouldRunOnce = true;
        return this;
    }

    runEvery(ms: number): this {
        this.runEveryInterval = ms;
        return this;
    }

    shouldExecute(deltaTime: number): boolean {
        // Check enableWhen / disableWhen predicates
        // If both are set, enableWhen must be true AND disableWhen must be false
        if (this.enableWhenPredicate && this.disableWhenPredicate) {
            this._enabled = this.enableWhenPredicate() && !this.disableWhenPredicate();
        } else if (this.enableWhenPredicate) {
            this._enabled = this.enableWhenPredicate();
        } else if (this.disableWhenPredicate) {
            this._enabled = !this.disableWhenPredicate();
        }

        // If system is disabled, don't run
        if (!this._enabled) {
            return false;
        }

        // Check runIf predicate
        if (this.runIfPredicate && !this.runIfPredicate()) {
            return false;
        }

        // Check runOnce
        if (this.shouldRunOnce && this.hasRunOnce) {
            return false;
        }

        // Check runEvery - allow first run, then check interval
        if (this.runEveryInterval !== undefined) {
            // First run is always allowed
            if (!this.hasRunEveryExecuted) {
                return true;
            }
            // Accumulate time FIRST
            this.timeSinceLastRun += deltaTime;
            // Then check if enough time has passed
            if (this.timeSinceLastRun >= this.runEveryInterval) {
                // Time to run - will be reset in step()
                return true;
            }
            return false;
        }

        return true;
    }

    step(deltaTime: number = 16): void {
        // Check if system should execute
        if (!this.shouldExecute(deltaTime)) {
            return;
        }

        const startTime = performance.now();

        if (this.options.before) {
            this.options.before();
        }

        const entities = this.query.getEntitiesArray();

        if (this.options.act) {
            for (const entity of entities) {
                const componentArgs = this.getComponents(entity);
                this.options.act(entity, ...componentArgs);
            }
        }

        if (this.options.after) {
            this.options.after();
        }

        const executionTime = performance.now() - startTime;
        this.updateProfile(executionTime, entities.length);

        // Mark as run for runOnce
        if (this.shouldRunOnce) {
            this.hasRunOnce = true;
        }

        // Reset time for runEvery
        if (this.runEveryInterval !== undefined) {
            this.timeSinceLastRun = 0;
            this.hasRunEveryExecuted = true;
        }
    }

    private getComponents(entity: Entity): C {
        const { all = [] } = this.query.options;
        return all.map((componentType: ComponentIdentifier) =>
            entity.getComponent(componentType)
        ) as C;
    }

    private updateProfile(executionTime: number, entityCount: number): void {
        this._profile.executionTime = executionTime;
        this._profile.entityCount = entityCount;
        this._profile.callCount++;
        this._profile.averageTime =
            (this._profile.averageTime * (this._profile.callCount - 1) + executionTime) /
            this._profile.callCount;
    }
}

/**
 * Message bus for inter-system communication
 */
export class MessageBus {
    private subscribers: Map<string, Set<(message: SystemMessage) => void>> = new Map();
    private messageHistory: SystemMessage[] = [];
    private maxHistorySize: number;

    constructor(maxHistorySize: number = MAX_MESSAGE_HISTORY) {
        this.maxHistorySize = maxHistorySize;
    }

    subscribe(messageType: string, callback: (message: SystemMessage) => void): () => void {
        if (!this.subscribers.has(messageType)) {
            this.subscribers.set(messageType, new Set());
        }
        const subscriberSet = this.subscribers.get(messageType);
        subscriberSet?.add(callback);

        return () => {
            this.subscribers.get(messageType)?.delete(callback);
        };
    }

    publish(messageType: string, data: any, sender?: string): void {
        const message: SystemMessage = {
            type: messageType,
            data,
            sender,
            timestamp: Date.now(),
        };

        this.messageHistory.push(message);
        while (this.messageHistory.length > this.maxHistorySize) {
            this.messageHistory.shift();
        }

        const subscribers = this.subscribers.get(messageType);
        if (subscribers) {
            for (const callback of subscribers) {
                try {
                    callback(message);
                } catch (error) {
                    console.error(`Error in message subscriber for ${messageType}:`, error);
                }
            }
        }
    }

    getMessageHistory(messageType?: string): SystemMessage[] {
        if (messageType) {
            return this.messageHistory.filter((msg) => msg.type === messageType);
        }
        return [...this.messageHistory];
    }
}

/**
 * Event emitter for engine events
 */
export class EventEmitter {
    private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
    private eventHistory: Array<{ event: string; args: any[]; timestamp: number }> = [];
    private maxHistorySize: number = MAX_EVENT_HISTORY;

    on(event: string, callback: (...args: any[]) => void): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        const listenerSet = this.listeners.get(event);
        listenerSet?.add(callback);

        return () => this.off(event, callback);
    }

    off(event: string, callback: (...args: any[]) => void): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    emit(event: string, ...args: any[]): void {
        this.eventHistory.push({ event, args, timestamp: Date.now() });
        while (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }

        const callbacks = this.listeners.get(event);
        if (callbacks) {
            for (const callback of callbacks) {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            }
        }
    }

    getEventHistory(): Array<{ event: string; args: any[]; timestamp: number }> {
        return [...this.eventHistory];
    }
}

/**
 * Performance monitor for tracking metrics
 */
export class PerformanceMonitor {
    private samples: number[] = [];
    private maxSamples: number = MAX_PERFORMANCE_SAMPLES;

    addSample(value: number): void {
        this.samples.push(value);
        while (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
    }

    getAverage(): number {
        if (this.samples.length === 0) return 0;
        return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    }

    getMin(): number {
        return this.samples.length > 0 ? Math.min(...this.samples) : 0;
    }

    getMax(): number {
        return this.samples.length > 0 ? Math.max(...this.samples) : 0;
    }

    reset(): void {
        this.samples = [];
    }
}

/**
 * Manages entity lifecycle, creation, and cleanup
 */
export class EntityManager {
    private activeEntities: Map<symbol, Entity> = new Map();
    private entitiesByTag: Map<string, Set<Entity>> = new Map();
    private entitiesByName: Map<string, Entity> = new Map();
    private entitiesByNumericId: Map<number, Entity> = new Map();
    private entityPool: Pool<Entity>;
    private entitiesToDelete: Set<Entity> = new Set();

    constructor(
        componentManager: any,
        private eventEmitter: EventEmitter
    ) {
        this.entityPool = new Pool(
            () => Entity.create(componentManager, eventEmitter),
            (entity) => entity.reset()
        );

        // Subscribe to entity changes to maintain tag index
        eventEmitter.on('onComponentAdded', (entity: Entity) => {
            this.updateEntityTags(entity);
        });
        eventEmitter.on('onComponentRemoved', (entity: Entity) => {
            this.updateEntityTags(entity);
        });
        eventEmitter.on('onTagChanged', (entity: Entity) => {
            this.updateEntityTags(entity);
        });
    }

    createEntity(name?: string): Entity {
        const entity = this.entityPool.acquire();
        entity.name = name;
        this.activeEntities.set(entity.id, entity);

        // Add to name index if name is provided
        if (name) {
            this.entitiesByName.set(name, entity);
        }

        // Add to numeric ID index
        this.entitiesByNumericId.set(entity.numericId, entity);

        // Add to empty archetype if archetypes are enabled
        const archetypeManager = (entity as any).componentManager.getArchetypeManager();
        if (archetypeManager) {
            archetypeManager.addEntityToArchetype(
                entity,
                archetypeManager.getOrCreateArchetype([]),
                new Map()
            );
        }

        this.updateEntityTags(entity);
        this.eventEmitter.emit('onEntityCreated', entity);
        return entity;
    }

    releaseEntity(entity: Entity): void {
        // Remove from active entities
        this.activeEntities.delete(entity.id);

        // Remove from name index
        if (entity.name) {
            this.entitiesByName.delete(entity.name);
        }

        // Remove from numeric ID index
        this.entitiesByNumericId.delete(entity.numericId);

        // Remove from tag indices
        for (const tag of entity.tags) {
            const tagged = this.entitiesByTag.get(tag);
            if (tagged) {
                tagged.delete(entity);
                if (tagged.size === 0) {
                    this.entitiesByTag.delete(tag);
                }
            }
        }

        // Remove all components first (this handles archetype transitions)
        for (const componentType of entity.getComponentTypes()) {
            entity.removeComponent(componentType as ComponentIdentifier);
        }

        // Remove from archetype if archetypes are enabled (cleanup any remaining archetype references)
        const archetypeManager = (entity as any).componentManager.getArchetypeManager();
        if (archetypeManager) {
            archetypeManager.removeEntity(entity);
        }

        // Clear hierarchy
        if (entity.parent) {
            entity.setParent(null);
        }
        for (const child of Array.from(entity.children)) {
            entity.removeChild(child);
        }

        this.eventEmitter.emit('onEntityReleased', entity);
        this.entityPool.release(entity);
    }

    cleanup(): void {
        // Find all entities marked for deletion
        for (const entity of this.activeEntities.values()) {
            if (entity.isMarkedForDeletion) {
                this.entitiesToDelete.add(entity);
                // Also mark children for deletion
                for (const child of entity.children) {
                    (child as Entity).queueFree();
                }
            }
        }

        // Delete all marked entities
        for (const entity of this.entitiesToDelete) {
            this.releaseEntity(entity);
        }
        this.entitiesToDelete.clear();
    }

    getEntity(id: symbol): Entity | undefined {
        return this.activeEntities.get(id);
    }

    getAllEntities(): Entity[] {
        return Array.from(this.activeEntities.values());
    }

    getEntitiesByTag(tag: string): Entity[] {
        const tagged = this.entitiesByTag.get(tag);
        return tagged ? Array.from(tagged) : [];
    }

    getEntityByName(name: string): Entity | undefined {
        return this.entitiesByName.get(name);
    }

    getEntityByNumericId(id: number): Entity | undefined {
        return this.entitiesByNumericId.get(id);
    }

    findEntity(predicate: (entity: Entity) => boolean): Entity | undefined {
        for (const entity of this.activeEntities.values()) {
            if (predicate(entity)) {
                return entity;
            }
        }
        return undefined;
    }

    findEntities(predicate: (entity: Entity) => boolean): Entity[] {
        const results: Entity[] = [];
        for (const entity of this.activeEntities.values()) {
            if (predicate(entity)) {
                results.push(entity);
            }
        }
        return results;
    }

    private updateEntityTags(entity: Entity): void {
        // Remove entity from all tag indices
        for (const [tag, entities] of this.entitiesByTag) {
            entities.delete(entity);
            if (entities.size === 0) {
                this.entitiesByTag.delete(tag);
            }
        }

        // Add entity to current tag indices
        for (const tag of entity.tags) {
            if (!this.entitiesByTag.has(tag)) {
                this.entitiesByTag.set(tag, new Set());
            }
            const tagSet = this.entitiesByTag.get(tag);
            tagSet?.add(entity);
        }
    }

    getPoolStats() {
        return this.entityPool.stats;
    }

    clear(): void {
        for (const entity of this.activeEntities.values()) {
            this.releaseEntity(entity);
        }
        this.activeEntities.clear();
        this.entitiesByTag.clear();
        this.entitiesByName.clear();
        this.entitiesByNumericId.clear();
        this.entitiesToDelete.clear();
    }
}
