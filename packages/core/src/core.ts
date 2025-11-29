/**
 * Core ECS Building Blocks
 *
 * This module contains the fundamental classes that form the foundation of OrionECS,
 * including entities, components, systems, queries, and performance utilities.
 *
 * @packageDocumentation
 * @module Core
 */

import type { ArchetypeManager } from './archetype';
import type {
    ComponentIdentifier,
    ComponentLifecycle,
    EntityDef,
    Logger,
    QueryOptions,
    QueryStats,
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
const MAX_HIERARCHY_DEPTH = 100;

/**
 * A fixed-size circular buffer that provides O(1) insertion and maintains bounded memory.
 *
 * Unlike arrays with shift() operations (which are O(n)), CircularBuffer provides constant-time
 * insertion by overwriting the oldest elements when full. This is ideal for maintaining
 * bounded history collections like event logs, message history, and performance samples.
 *
 * @typeParam T - The type of elements stored in the buffer
 *
 * @example
 * ```typescript
 * const buffer = new CircularBuffer<number>(3);
 * buffer.push(1);  // [1]
 * buffer.push(2);  // [1, 2]
 * buffer.push(3);  // [1, 2, 3]
 * buffer.push(4);  // [2, 3, 4] - 1 was evicted
 *
 * buffer.toArray(); // [2, 3, 4] - in insertion order
 * ```
 *
 * @internal
 */
export class CircularBuffer<T> {
    private buffer: (T | undefined)[];
    private head: number = 0; // Next write position
    private _size: number = 0;
    private capacity: number;

    constructor(capacity: number) {
        this.capacity = capacity;
        this.buffer = Array.from({ length: capacity });
    }

    /**
     * Add an item to the buffer. If full, overwrites the oldest item.
     * @param item - Item to add
     */
    push(item: T): void {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.capacity;
        if (this._size < this.capacity) {
            this._size++;
        }
    }

    /**
     * Get the number of items currently in the buffer.
     */
    get size(): number {
        return this._size;
    }

    /**
     * Get the maximum capacity of the buffer.
     */
    get maxSize(): number {
        return this.capacity;
    }

    /**
     * Convert buffer contents to an array in insertion order (oldest to newest).
     */
    toArray(): T[] {
        if (this._size === 0) {
            return [];
        }

        const result: T[] = [];
        // Start from the oldest element
        const start = this._size < this.capacity ? 0 : this.head;

        for (let i = 0; i < this._size; i++) {
            const index = (start + i) % this.capacity;
            const item = this.buffer[index];
            if (item !== undefined) {
                result.push(item);
            }
        }

        return result;
    }

    /**
     * Filter buffer contents and return as array.
     * @param predicate - Filter function
     */
    filter(predicate: (item: T) => boolean): T[] {
        return this.toArray().filter(predicate);
    }

    /**
     * Clear all items from the buffer.
     */
    clear(): void {
        this.buffer = Array.from({ length: this.capacity });
        this.head = 0;
        this._size = 0;
    }

    /**
     * Iterate over all items in insertion order (oldest to newest).
     */
    *[Symbol.iterator](): Iterator<T> {
        const arr = this.toArray();
        for (const item of arr) {
            yield item;
        }
    }
}

/**
 * Type guard to check if a component has lifecycle hooks.
 * @internal
 */
function hasOnCreate(
    component: unknown
): component is ComponentLifecycle & { onCreate: NonNullable<ComponentLifecycle['onCreate']> } {
    return (
        component !== null &&
        typeof component === 'object' &&
        'onCreate' in component &&
        typeof (component as ComponentLifecycle).onCreate === 'function'
    );
}

/**
 * Type guard to check if a component has an onDestroy lifecycle hook.
 * @internal
 */
function hasOnDestroy(
    component: unknown
): component is ComponentLifecycle & { onDestroy: NonNullable<ComponentLifecycle['onDestroy']> } {
    return (
        component !== null &&
        typeof component === 'object' &&
        'onDestroy' in component &&
        typeof (component as ComponentLifecycle).onDestroy === 'function'
    );
}

/**
 * Sentinel value used to indicate that a component is stored in archetypes
 * rather than in sparse component arrays. When a component index equals this value,
 * the component should be retrieved from the archetype system.
 * @internal
 */
export const ARCHETYPE_STORAGE_INDEX = -1;

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
 * Generates unique numeric IDs for entities within a single engine instance.
 *
 * This class provides per-engine ID generation to ensure isolation between
 * multiple engine instances. Each engine has its own EntityIdGenerator,
 * preventing ID collisions and ensuring test isolation.
 *
 * @example
 * ```typescript
 * const generator = new EntityIdGenerator();
 * const id1 = generator.next(); // 1
 * const id2 = generator.next(); // 2
 *
 * // Reset for a new engine instance
 * generator.reset();
 * const id3 = generator.next(); // 1 (starts fresh)
 * ```
 *
 * @public
 */
export class EntityIdGenerator {
    private _nextId: number = 1;

    /**
     * Generate the next unique entity ID.
     * @returns A unique numeric ID for an entity
     */
    next(): number {
        return this._nextId++;
    }

    /**
     * Get the current counter value without incrementing.
     * Useful for debugging and testing.
     * @returns The next ID that will be generated
     */
    peek(): number {
        return this._nextId;
    }

    /**
     * Reset the ID generator to its initial state.
     * This is primarily useful for testing scenarios.
     */
    reset(): void {
        this._nextId = 1;
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
export class Query<C extends readonly unknown[] = unknown[]> {
    private matchingEntities: Set<Entity> = new Set();
    private cachedArray: Entity[] = [];
    private cacheVersion: number = 0;
    private currentVersion: number = 0;

    // Archetype-based iteration support
    // Using ArchetypeManager type would cause circular import, so using structural typing
    private archetypeManager?: {
        getMatchingArchetypes(options: QueryOptions<ComponentIdentifier[]>): unknown[];
        getComponent(entity: Entity, type: ComponentIdentifier): unknown;
    };
    private matchingArchetypes?: unknown[];
    private archetypesCacheValid: boolean = false;

    // Performance tracking
    private _executionCount: number = 0;
    private _totalTimeMs: number = 0;
    private _lastMatchCount: number = 0;
    private _cacheHits: number = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(
        public options: QueryOptions<ComponentIdentifier[]>,
        archetypeManager?: {
            getMatchingArchetypes(options: QueryOptions<ComponentIdentifier[]>): unknown[];
            getComponent(entity: Entity, type: ComponentIdentifier): unknown;
        }
    ) {
        this.archetypeManager = archetypeManager;
    }

    /**
     * Set the archetype manager for this query (enables archetype-based iteration)
     */
    setArchetypeManager(manager: {
        getMatchingArchetypes(options: QueryOptions<ComponentIdentifier[]>): unknown[];
        getComponent(entity: Entity, type: ComponentIdentifier): unknown;
    }): void {
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
                // Invalidate archetype cache when entity membership changes
                this.archetypesCacheValid = false;
            }
        } else {
            if (hadEntity) {
                this.matchingEntities.delete(entity);
                this.currentVersion++;
                // Invalidate archetype cache when entity membership changes
                this.archetypesCacheValid = false;
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
                    // Archetype structural type for component array access
                    const typedArchetype = archetype as {
                        getComponentArrays(types: ComponentIdentifier[]): unknown[][];
                        getEntities(): Entity[];
                    };
                    // Get component arrays in the query's specified order (not archetype's sorted order)
                    const componentArrays = typedArchetype.getComponentArrays(all);
                    const entities = typedArchetype.getEntities();

                    // Check if we need to filter by tags (tags are not part of archetype matching)
                    const needsTagFiltering = tags.length > 0 || withoutTags.length > 0;

                    // Iterate through entities
                    for (let i = 0; i < entities.length; i++) {
                        const entity = entities[i]!;

                        if (needsTagFiltering) {
                            // Filter by tags
                            if (tags.length > 0 && !tags.every((tag: string) => entity.hasTag(tag)))
                                continue;
                            if (withoutTags.some((tag: string) => entity.hasTag(tag))) continue;
                        }

                        // Extract components in query order
                        // Type assertion is required because component types are only known at runtime
                        // based on the 'all' array in QueryOptions - TypeScript cannot verify at compile time
                        const components: unknown[] = componentArrays.map(
                            (arr: unknown[]) => arr[i]
                        );
                        callback(entity, ...(components as unknown as C));
                    }
                }
                return;
            }
        }

        // Fallback to traditional entity-based iteration
        for (const entity of this.matchingEntities) {
            // Type assertion is required because component types are only known at runtime
            // based on the 'all' array in QueryOptions - TypeScript cannot verify at compile time
            const componentArgs = all.map((componentType: ComponentIdentifier) =>
                entity.getComponent(componentType)
            ) as unknown as C;
            callback(entity, ...componentArgs);
        }
    }

    /**
     * Get performance statistics for this query
     */
    getStats(): QueryStats {
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

    /**
     * Invalidate all caches, forcing rebuild on next access.
     * Call this when archetype composition changes or after bulk operations.
     */
    invalidateCache(): void {
        // Force entity array cache rebuild
        this.currentVersion++;

        // Force archetype cache rebuild
        this.archetypesCacheValid = false;
        this.matchingArchetypes = undefined;
    }

    /**
     * Check if the entity array cache is valid.
     * Useful for debugging cache behavior.
     */
    isCacheValid(): boolean {
        return this.cacheVersion === this.currentVersion;
    }
}

/**
 * Fluent query builder for constructing complex queries
 */
export class QueryBuilder<C extends readonly unknown[] = unknown[]> {
    private options: QueryOptions<ComponentIdentifier[]> = {};

    constructor(
        private createQueryFn: (options: QueryOptions<ComponentIdentifier[]>) => Query<C>
    ) {}

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

    // Serialization cache to reduce GC pressure
    private _cachedSerialization: SerializedEntity | null = null;
    private _cachedSerializationVersion: number = -1;

    // Dependency injection of managers
    constructor(
        private componentManager: any, // ComponentManager
        private eventEmitter: any, // EventEmitter or callback
        idGenerator: EntityIdGenerator
    ) {
        this._id = Symbol();
        this._numericId = idGenerator.next();
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

    /**
     * Get the number of components on this entity.
     * Used internally for efficient iteration during cloning.
     */
    get componentCount(): number {
        return this._componentIndices.size;
    }

    /**
     * Set the storage index for a component type.
     * This is an internal method used by Engine.cloneEntity() and should not
     * be called directly in application code.
     *
     * @internal
     */
    setComponentIndex(type: ComponentIdentifier, index: number): void {
        this._componentIndices.set(type, index);
    }

    /**
     * Get the storage index for a component type.
     * Returns undefined if the entity doesn't have the component.
     * This is an internal method used by ChangeTrackingManager.
     *
     * @internal
     */
    getComponentStorageIndex(type: ComponentIdentifier): number | undefined {
        return this._componentIndices.get(type);
    }

    /**
     * Iterate over all component types and their storage indices.
     * This is an internal method used for serialization and change tracking.
     *
     * @internal
     */
    forEachComponentIndex(callback: (type: ComponentIdentifier, index: number) => void): void {
        for (const [type, index] of this._componentIndices) {
            callback(type, index);
        }
    }

    /**
     * Mark this entity as dirty and increment its change version.
     * This is an internal method used after bulk component operations
     * to ensure change tracking is properly updated.
     *
     * @internal
     */
    markDirty(): void {
        this._dirty = true;
        this._changeVersion++;
    }

    /**
     * Clear the dirty flag on this entity.
     * This is an internal method called after entity queries have been updated.
     *
     * @internal
     */
    clearDirty(): void {
        this._dirty = false;
    }

    /**
     * Get the archetype manager from this entity's component manager.
     * Returns undefined if archetypes are not enabled.
     * This is an internal method used by EntityManager.
     *
     * @internal
     */
    getArchetypeManager(): ArchetypeManager | undefined {
        return this.componentManager.getArchetypeManager();
    }

    private static asEntity(entity: EntityDef): Entity {
        if (entity instanceof Entity) {
            return entity;
        }
        throw new Error('[ECS] Invalid entity type - expected Entity instance');
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
                            `[ECS] Component ${type.name} requires ${dep.name} on entity ${this._name || this._numericId}`
                        );
                    }
                }
            }

            if (validator?.conflicts) {
                for (const conflict of validator.conflicts) {
                    if (this.hasComponent(conflict)) {
                        throw new Error(
                            `[ECS] Component ${type.name} conflicts with ${conflict.name} on entity ${this._name || this._numericId}`
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
                        `[ECS] ${errorMessage} for ${type.name} on entity ${this._name || this._numericId}`
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
                this._componentIndices.set(type, ARCHETYPE_STORAGE_INDEX);
            } else {
                // Legacy mode: use sparse arrays
                const componentArray = this.componentManager.getComponentArray(type);
                const index = componentArray.add(component);
                this._componentIndices.set(type, index);
            }

            this._dirty = true;
            this._changeVersion++;

            // Call onCreate lifecycle hook if it exists
            if (hasOnCreate(component)) {
                component.onCreate(this);
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
                if (hasOnDestroy(component)) {
                    component.onDestroy(this);
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
                    if (hasOnDestroy(component)) {
                        component.onDestroy(this);
                    }

                    this.componentManager.releaseComponent(type, component);
                }
                componentArray.remove(index);
                this._componentIndices.delete(type);
            }

            this._dirty = true;
            this._changeVersion++;
            // Emit with component data for listeners to access
            // Note: removedComponent may be null/undefined in archetype mode,
            // we emit it as-is to avoid pool depletion from acquiring unused components
            this.eventEmitter.emit('onComponentRemoved', this, type, removedComponent);
        }
        return this;
    }

    hasComponent<T>(type: ComponentIdentifier<T>): boolean {
        return this._componentIndices.has(type);
    }

    tryGetComponent<T>(type: ComponentIdentifier<T>): T | null {
        const index = this._componentIndices.get(type);
        if (index === undefined) {
            return null;
        }

        const archetypeManager = this.componentManager.getArchetypeManager();
        if (archetypeManager) {
            // Archetype mode: get component from archetype
            return archetypeManager.getComponent(this, type);
        } else {
            // Legacy mode: get component from sparse array
            const componentArray = this.componentManager.getComponentArray(type);
            return componentArray.get(index);
        }
    }

    getComponent<T>(type: ComponentIdentifier<T>): T {
        const component = this.tryGetComponent(type);
        if (component === null) {
            throw new Error(
                `[ECS] Component ${type.name} not found on entity ${this._name || this._numericId}`
            );
        }
        return component;
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

        const previousParent = this._parent;
        const newParent = parent ? Entity.asEntity(parent) : undefined;
        const timestamp = Date.now();

        // Validate hierarchy constraints when setting a new parent
        if (newParent) {
            // Check for circular reference: entity cannot be its own ancestor
            if (newParent === this) {
                throw new Error(
                    `[ECS] Cannot set parent: Entity '${this._name ?? this._numericId}' cannot be its own parent`
                );
            }

            // Check if the new parent is a descendant of this entity (would create a cycle)
            let ancestor: Entity | undefined = newParent;
            let depth = 0;
            while (ancestor) {
                if (ancestor === this) {
                    throw new Error(
                        `[ECS] Cannot set parent: Entity '${newParent._name ?? newParent._numericId}' ` +
                            `is a descendant of '${this._name ?? this._numericId}', which would create a circular reference`
                    );
                }
                ancestor = ancestor._parent;
                depth++;
                // Safety check for existing malformed hierarchies
                if (depth > MAX_HIERARCHY_DEPTH) {
                    throw new Error(
                        `[ECS] Cannot set parent: Hierarchy depth exceeds maximum of ${MAX_HIERARCHY_DEPTH}`
                    );
                }
            }

            // Check if new parent's depth + this entity's descendant depth exceeds maximum
            const parentDepth = newParent.getDepth();
            const descendantDepth = this.getMaxDescendantDepth();
            const totalDepth = parentDepth + 1 + descendantDepth;
            if (totalDepth > MAX_HIERARCHY_DEPTH) {
                throw new Error(
                    `[ECS] Cannot set parent: Resulting hierarchy depth (${totalDepth}) ` +
                        `would exceed maximum of ${MAX_HIERARCHY_DEPTH}`
                );
            }
        }

        // Remove from previous parent's children
        if (previousParent) {
            previousParent._children.delete(this);
        }

        // Update parent reference
        this._parent = newParent;

        // Add to new parent's children
        if (newParent) {
            newParent._children.add(this);
        }

        this._changeVersion++;

        // Emit enhanced hierarchy events
        // 1. Parent changed event (always emitted)
        this.eventEmitter.emit('onParentChanged', {
            entity: this,
            previousParent,
            newParent,
            timestamp,
        });

        // 2. Child removed event (if had previous parent)
        if (previousParent) {
            this.eventEmitter.emit('onChildRemoved', {
                parent: previousParent,
                child: this,
                timestamp,
            });
        }

        // 3. Child added event (if has new parent)
        if (newParent) {
            this.eventEmitter.emit('onChildAdded', {
                parent: newParent,
                child: this,
                timestamp,
            });
        }

        // 4. Legacy event for backward compatibility
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

    // ========== Hierarchy Query Methods ==========

    /**
     * Get all descendants of this entity (children, grandchildren, etc.).
     *
     * Performs a depth-first traversal of the entity hierarchy, collecting all
     * entities that are descendants of this entity.
     *
     * @param maxDepth - Optional maximum depth to traverse (undefined = unlimited).
     *   A maxDepth of 1 returns only direct children, 2 includes grandchildren, etc.
     * @returns Array of all descendant entities
     *
     * @example
     * ```typescript
     * const ship = engine.createEntity('Ship');
     * const turret = engine.createEntity('Turret');
     * const barrel = engine.createEntity('Barrel');
     *
     * ship.addChild(turret);
     * turret.addChild(barrel);
     *
     * ship.getDescendants();      // [turret, barrel]
     * ship.getDescendants(1);     // [turret] (direct children only)
     * turret.getDescendants();    // [barrel]
     * ```
     *
     * @public
     */
    getDescendants(maxDepth?: number): Entity[] {
        const result: Entity[] = [];
        const collectDescendants = (entity: Entity, currentDepth: number): void => {
            if (maxDepth !== undefined && currentDepth >= maxDepth) return;
            for (const child of entity._children) {
                result.push(child);
                collectDescendants(child, currentDepth + 1);
            }
        };
        collectDescendants(this, 0);
        return result;
    }

    /**
     * Get all ancestors of this entity (parent, grandparent, etc.).
     *
     * Traverses up the hierarchy from this entity to the root, collecting all
     * ancestor entities. The first element is the direct parent, last is the root.
     *
     * @returns Array of ancestor entities, ordered from nearest to furthest
     *
     * @example
     * ```typescript
     * const root = engine.createEntity('Root');
     * const parent = engine.createEntity('Parent');
     * const child = engine.createEntity('Child');
     *
     * root.addChild(parent);
     * parent.addChild(child);
     *
     * child.getAncestors();   // [parent, root]
     * parent.getAncestors();  // [root]
     * root.getAncestors();    // []
     * ```
     *
     * @public
     */
    getAncestors(): Entity[] {
        const result: Entity[] = [];
        let current = this._parent;
        while (current) {
            result.push(current);
            current = current._parent;
        }
        return result;
    }

    /**
     * Find the first child matching a predicate function.
     *
     * Searches through children (and optionally descendants) to find the first
     * entity that matches the given predicate.
     *
     * @param predicate - Function that returns true for the desired entity
     * @param recursive - If true, searches all descendants; if false, only direct children (default: true)
     * @returns The first matching entity, or undefined if none found
     *
     * @example
     * ```typescript
     * // Find first child with a specific tag
     * const weapon = ship.findChild(child => child.hasTag('weapon'));
     *
     * // Find first direct child with Health component
     * const healthyChild = parent.findChild(
     *   child => child.hasComponent(Health),
     *   false  // Only search direct children
     * );
     * ```
     *
     * @public
     */
    findChild(
        predicate: (child: Entity) => boolean,
        recursive: boolean = true
    ): Entity | undefined {
        for (const child of this._children) {
            if (predicate(child)) return child;
            if (recursive) {
                const found = child.findChild(predicate, true);
                if (found) return found;
            }
        }
        return undefined;
    }

    /**
     * Find all children matching a predicate function.
     *
     * Searches through children (and optionally descendants) to find all
     * entities that match the given predicate.
     *
     * @param predicate - Function that returns true for desired entities
     * @param recursive - If true, searches all descendants; if false, only direct children (default: true)
     * @returns Array of all matching entities
     *
     * @example
     * ```typescript
     * // Find all children with 'enemy' tag
     * const enemies = parent.findChildren(child => child.hasTag('enemy'));
     *
     * // Find all direct children with low health
     * const lowHealth = parent.findChildren(
     *   child => {
     *     if (!child.hasComponent(Health)) return false;
     *     const health = child.getComponent(Health);
     *     return health.current < health.max * 0.3;
     *   },
     *   false  // Only direct children
     * );
     * ```
     *
     * @public
     */
    findChildren(predicate: (child: Entity) => boolean, recursive: boolean = true): Entity[] {
        const result: Entity[] = [];
        for (const child of this._children) {
            if (predicate(child)) result.push(child);
            if (recursive) {
                result.push(...child.findChildren(predicate, true));
            }
        }
        return result;
    }

    /**
     * Get the root entity of this hierarchy.
     *
     * Traverses up the hierarchy to find the topmost ancestor (the entity
     * with no parent). If this entity has no parent, returns itself.
     *
     * @returns The root entity of the hierarchy
     *
     * @example
     * ```typescript
     * const root = engine.createEntity('Root');
     * const child = engine.createEntity('Child');
     * const grandchild = engine.createEntity('Grandchild');
     *
     * root.addChild(child);
     * child.addChild(grandchild);
     *
     * grandchild.getRoot();  // root
     * child.getRoot();       // root
     * root.getRoot();        // root (returns itself)
     * ```
     *
     * @public
     */
    getRoot(): Entity {
        if (!this._parent) {
            return this;
        }
        let root: Entity = this._parent;
        while (root._parent) {
            root = root._parent;
        }
        return root;
    }

    /**
     * Get the depth of this entity in the hierarchy.
     *
     * Counts the number of ancestors between this entity and the root.
     * Root entities have a depth of 0.
     *
     * @returns The depth level (0 = root, 1 = child of root, etc.)
     *
     * @example
     * ```typescript
     * const root = engine.createEntity('Root');
     * const child = engine.createEntity('Child');
     * const grandchild = engine.createEntity('Grandchild');
     *
     * root.addChild(child);
     * child.addChild(grandchild);
     *
     * root.getDepth();       // 0
     * child.getDepth();      // 1
     * grandchild.getDepth(); // 2
     * ```
     *
     * @public
     */
    getDepth(): number {
        let depth = 0;
        let current = this._parent;
        while (current) {
            depth++;
            current = current._parent;
        }
        return depth;
    }

    /**
     * Get the maximum depth of the descendant tree from this entity.
     *
     * Returns 0 if this entity has no children, 1 if it has children but no grandchildren,
     * and so on. This is used for hierarchy depth validation.
     *
     * @returns The maximum depth of descendants (0 if no children)
     * @internal
     */
    getMaxDescendantDepth(): number {
        if (this._children.size === 0) {
            return 0;
        }
        let maxDepth = 0;
        for (const child of this._children) {
            const childDepth = 1 + child.getMaxDescendantDepth();
            if (childDepth > maxDepth) {
                maxDepth = childDepth;
            }
        }
        return maxDepth;
    }

    /**
     * Check if this entity is an ancestor of another entity.
     *
     * Returns true if the given entity is a descendant of this entity
     * (i.e., this entity is somewhere in its parent chain).
     *
     * @param entity - The entity to check
     * @returns True if this entity is an ancestor of the given entity
     *
     * @example
     * ```typescript
     * const root = engine.createEntity('Root');
     * const child = engine.createEntity('Child');
     * const grandchild = engine.createEntity('Grandchild');
     *
     * root.addChild(child);
     * child.addChild(grandchild);
     *
     * root.isAncestorOf(grandchild);  // true
     * root.isAncestorOf(child);       // true
     * child.isAncestorOf(grandchild); // true
     * child.isAncestorOf(root);       // false
     * ```
     *
     * @public
     */
    isAncestorOf(entity: EntityDef): boolean {
        let current = Entity.asEntity(entity)._parent;
        while (current) {
            if (current === this) return true;
            current = current._parent;
        }
        return false;
    }

    /**
     * Check if this entity is a descendant of another entity.
     *
     * Returns true if the given entity is an ancestor of this entity
     * (i.e., this entity is somewhere in the given entity's descendant tree).
     *
     * @param entity - The entity to check
     * @returns True if this entity is a descendant of the given entity
     *
     * @example
     * ```typescript
     * const root = engine.createEntity('Root');
     * const child = engine.createEntity('Child');
     * const grandchild = engine.createEntity('Grandchild');
     *
     * root.addChild(child);
     * child.addChild(grandchild);
     *
     * grandchild.isDescendantOf(root);  // true
     * grandchild.isDescendantOf(child); // true
     * child.isDescendantOf(root);       // true
     * root.isDescendantOf(child);       // false
     * ```
     *
     * @public
     */
    isDescendantOf(entity: EntityDef): boolean {
        return Entity.asEntity(entity).isAncestorOf(this);
    }

    /**
     * Get all siblings of this entity (other children of the same parent).
     *
     * Returns an empty array if this entity has no parent.
     *
     * @param includeSelf - If true, includes this entity in the result (default: false)
     * @returns Array of sibling entities
     *
     * @example
     * ```typescript
     * const parent = engine.createEntity('Parent');
     * const child1 = engine.createEntity('Child1');
     * const child2 = engine.createEntity('Child2');
     * const child3 = engine.createEntity('Child3');
     *
     * parent.addChild(child1);
     * parent.addChild(child2);
     * parent.addChild(child3);
     *
     * child1.getSiblings();       // [child2, child3]
     * child1.getSiblings(true);   // [child1, child2, child3]
     * parent.getSiblings();       // [] (no parent)
     * ```
     *
     * @public
     */
    getSiblings(includeSelf: boolean = false): Entity[] {
        if (!this._parent) return [];
        const siblings: Entity[] = [];
        for (const sibling of this._parent._children) {
            if (includeSelf || sibling !== this) {
                siblings.push(sibling);
            }
        }
        return siblings;
    }

    /**
     * Get the number of direct children this entity has.
     *
     * @returns The count of direct children
     *
     * @example
     * ```typescript
     * const parent = engine.createEntity('Parent');
     * parent.addChild(engine.createEntity('Child1'));
     * parent.addChild(engine.createEntity('Child2'));
     *
     * parent.getChildCount();  // 2
     * ```
     *
     * @public
     */
    getChildCount(): number {
        return this._children.size;
    }

    /**
     * Check if this entity has any children.
     *
     * @returns True if this entity has at least one child
     *
     * @example
     * ```typescript
     * const parent = engine.createEntity('Parent');
     * parent.hasChildren();  // false
     *
     * parent.addChild(engine.createEntity('Child'));
     * parent.hasChildren();  // true
     * ```
     *
     * @public
     */
    hasChildren(): boolean {
        return this._children.size > 0;
    }

    /**
     * Check if this entity has a parent.
     *
     * @returns True if this entity has a parent
     *
     * @example
     * ```typescript
     * const parent = engine.createEntity('Parent');
     * const child = engine.createEntity('Child');
     *
     * child.hasParent();  // false
     * parent.addChild(child);
     * child.hasParent();  // true
     * ```
     *
     * @public
     */
    hasParent(): boolean {
        return this._parent !== undefined;
    }

    queueFree(): void {
        this._markedForDelete = true;
    }

    clone(engine: any): Entity {
        return engine.cloneEntity(this);
    }

    /**
     * Compute a combined version that includes this entity and all children.
     * Used for cache invalidation in serialize().
     */
    private getDeepChangeVersion(): number {
        let version = this._changeVersion;
        for (const child of this._children) {
            version += child.getDeepChangeVersion();
        }
        return version;
    }

    serialize(): SerializedEntity {
        // Check cache validity - use deep version to account for child changes
        const currentDeepVersion = this.getDeepChangeVersion();
        if (
            this._cachedSerialization !== null &&
            this._cachedSerializationVersion === currentDeepVersion
        ) {
            return this._cachedSerialization;
        }

        const components: { [componentName: string]: any } = {};

        // Check if archetypes are enabled
        const archetypeManager = this.componentManager.getArchetypeManager();

        for (const [componentType, index] of this._componentIndices) {
            let component: any = null;

            if (archetypeManager && index === ARCHETYPE_STORAGE_INDEX) {
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

        // Build serialized result and cache it
        this._cachedSerialization = {
            id: this._numericId.toString(),
            name: this._name,
            tags: Array.from(this._tags),
            components,
            children: Array.from(this._children).map((child) => child.serialize()),
        };
        this._cachedSerializationVersion = currentDeepVersion;

        return this._cachedSerialization;
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
        // Clear serialization cache
        this._cachedSerialization = null;
        this._cachedSerializationVersion = -1;
    }

    static create(
        componentManager: any,
        eventEmitter: any,
        idGenerator: EntityIdGenerator
    ): Entity {
        return new Entity(componentManager, eventEmitter, idGenerator);
    }
}

/**
 * SystemGroup for organizing systems into execution phases
 */
/**
 * Type constraint for heterogeneous system component tuples.
 * Used for internal storage of systems with different component requirements.
 */
export type AnySystemTuple = readonly unknown[];

export class SystemGroup {
    systems: System<AnySystemTuple>[] = [];

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
export class System<C extends readonly unknown[] = unknown[]> {
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
    private _profilingEnabled: boolean = true;
    /** Stores unsubscribe functions for event listeners to enable cleanup */
    private _eventUnsubscribers: Array<() => void> = [];
    private _isDestroyed: boolean = false;

    constructor(
        public name: string,
        query: Query<C>,
        private options: SystemType<C>,
        private eventEmitter?: any, // EventEmitter
        profilingEnabled: boolean = true
    ) {
        this.query = query;
        this._priority = options.priority || 0;
        this._enabled = options.enabled !== false;
        this._group = options.group;
        this._runAfter = options.runAfter || [];
        this._runBefore = options.runBefore || [];
        this._profilingEnabled = profilingEnabled;

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
     * Set up component change event listeners based on system options.
     * Stores unsubscribe functions to enable proper cleanup when the system is destroyed.
     */
    private setupComponentChangeListeners(): void {
        if (!this.eventEmitter) return;

        const watchComponents = this.options.watchComponents;
        const watchSingletons = this.options.watchSingletons;

        // Subscribe to component added events
        if (this.options.onComponentAdded) {
            const unsubscribe = this.eventEmitter.on(
                'onComponentAdded',
                (entity: any, componentType: any) => {
                    // Don't process events if system is destroyed
                    if (this._isDestroyed) return;

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
                }
            );
            this._eventUnsubscribers.push(unsubscribe);
        }

        // Subscribe to component removed events
        if (this.options.onComponentRemoved) {
            const unsubscribe = this.eventEmitter.on(
                'onComponentRemoved',
                (entity: any, componentType: any, component: any) => {
                    // Don't process events if system is destroyed
                    if (this._isDestroyed) return;

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
            this._eventUnsubscribers.push(unsubscribe);
        }

        // Subscribe to component changed events
        if (this.options.onComponentChanged) {
            const unsubscribe = this.eventEmitter.on('onComponentChanged', (event: any) => {
                // Don't process events if system is destroyed
                if (this._isDestroyed) return;

                // Filter by watchComponents if specified
                if (watchComponents && !watchComponents.includes(event.componentType)) {
                    return;
                }

                this.options.onComponentChanged?.(event);
            });
            this._eventUnsubscribers.push(unsubscribe);
        }

        // Subscribe to singleton set events
        if (this.options.onSingletonSet) {
            const unsubscribe = this.eventEmitter.on('onSingletonSet', (event: any) => {
                // Don't process events if system is destroyed
                if (this._isDestroyed) return;

                // Filter by watchSingletons if specified
                if (watchSingletons && !watchSingletons.includes(event.componentType)) {
                    return;
                }

                this.options.onSingletonSet?.(event);
            });
            this._eventUnsubscribers.push(unsubscribe);
        }

        // Subscribe to singleton removed events
        if (this.options.onSingletonRemoved) {
            const unsubscribe = this.eventEmitter.on('onSingletonRemoved', (event: any) => {
                // Don't process events if system is destroyed
                if (this._isDestroyed) return;

                // Filter by watchSingletons if specified
                if (watchSingletons && !watchSingletons.includes(event.componentType)) {
                    return;
                }

                this.options.onSingletonRemoved?.(event);
            });
            this._eventUnsubscribers.push(unsubscribe);
        }

        // ========== Hierarchy Event Listeners ==========

        // Subscribe to child added events
        if (this.options.onChildAdded || this.options.watchHierarchy) {
            const unsubscribe = this.eventEmitter.on('onChildAdded', (event: any) => {
                this.options.onChildAdded?.(event);
            });
            this._eventUnsubscribers.push(unsubscribe);
        }

        // Subscribe to child removed events
        if (this.options.onChildRemoved || this.options.watchHierarchy) {
            const unsubscribe = this.eventEmitter.on('onChildRemoved', (event: any) => {
                this.options.onChildRemoved?.(event);
            });
            this._eventUnsubscribers.push(unsubscribe);
        }

        // Subscribe to parent changed events
        if (this.options.onParentChanged || this.options.watchHierarchy) {
            const unsubscribe = this.eventEmitter.on('onParentChanged', (event: any) => {
                this.options.onParentChanged?.(event);
            });
            this._eventUnsubscribers.push(unsubscribe);
        }
    }

    /**
     * Clean up all event listeners and mark the system as destroyed.
     * Called when the system is removed from the engine.
     */
    destroy(): void {
        if (this._isDestroyed) return;

        this._isDestroyed = true;
        this._enabled = false;

        // Unsubscribe from all events
        for (const unsubscribe of this._eventUnsubscribers) {
            unsubscribe();
        }
        this._eventUnsubscribers = [];
    }

    /**
     * Check if the system has been destroyed.
     */
    get isDestroyed(): boolean {
        return this._isDestroyed;
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

        // Only capture start time if profiling is enabled
        const startTime = this._profilingEnabled ? performance.now() : 0;

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

        // Only update profile if profiling is enabled
        if (this._profilingEnabled) {
            const executionTime = performance.now() - startTime;
            this.updateProfile(executionTime, entities.length);
        }

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

    /**
     * Get components for an entity matching this system's query.
     *
     * Type assertion is required because component types are only known at runtime
     * based on the 'all' array in QueryOptions. TypeScript cannot verify at compile
     * time that the returned array matches the generic type C.
     */
    private getComponents(entity: Entity): C {
        const { all = [] } = this.query.options;
        const components: unknown[] = all.map((componentType: ComponentIdentifier) => {
            const component = entity.getComponent(componentType);
            if (component === null) {
                // This indicates a race condition where the entity matched the query
                // but the component was removed before we could retrieve it.
                // Provide helpful context for debugging.
                throw new Error(
                    `[ECS] System "${this.name}": Entity "${entity.name || entity.numericId}" ` +
                        `is missing required component "${componentType.name}". ` +
                        'This may indicate a component was removed during iteration.'
                );
            }
            return component;
        });

        return components as unknown as C;
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
 *
 * Uses CircularBuffer for O(1) message history insertion instead of O(n) shift operations.
 */
export class MessageBus {
    private subscribers: Map<string, Set<(message: SystemMessage) => void>> = new Map();
    private messageHistory: CircularBuffer<SystemMessage>;
    private logger?: Logger;

    constructor(maxHistorySize: number = MAX_MESSAGE_HISTORY, logger?: Logger) {
        this.messageHistory = new CircularBuffer<SystemMessage>(maxHistorySize);
        this.logger = logger;
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

    publish(messageType: string, data: unknown, sender?: string): void {
        const message: SystemMessage = {
            type: messageType,
            data,
            sender,
            timestamp: Date.now(),
        };

        // O(1) insertion using CircularBuffer instead of O(n) shift()
        this.messageHistory.push(message);

        const subscribers = this.subscribers.get(messageType);
        if (subscribers) {
            for (const callback of subscribers) {
                try {
                    callback(message);
                } catch (error) {
                    if (this.logger) {
                        this.logger.error(`Error in message subscriber for ${messageType}:`, error);
                    }
                }
            }
        }
    }

    getMessageHistory(messageType?: string): SystemMessage[] {
        if (messageType) {
            return this.messageHistory.filter((msg) => msg.type === messageType);
        }
        return this.messageHistory.toArray();
    }

    /**
     * Clear all subscribers and message history.
     * Called when the MessageBus is being disposed.
     */
    clear(): void {
        this.subscribers.clear();
        this.messageHistory.clear();
    }
}

/**
 * Event emitter for engine events
 *
 * Uses CircularBuffer for O(1) event history insertion instead of O(n) shift operations.
 */
export class EventEmitter {
    private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
    private eventHistory: CircularBuffer<{ event: string; args: unknown[]; timestamp: number }>;
    private logger?: Logger;

    constructor(maxHistorySize: number = MAX_EVENT_HISTORY, logger?: Logger) {
        this.eventHistory = new CircularBuffer(maxHistorySize);
        this.logger = logger;
    }

    on(event: string, callback: (...args: unknown[]) => void): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        const listenerSet = this.listeners.get(event);
        listenerSet?.add(callback);

        return () => this.off(event, callback);
    }

    off(event: string, callback: (...args: unknown[]) => void): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    emit(event: string, ...args: unknown[]): void {
        // O(1) insertion using CircularBuffer instead of O(n) shift()
        this.eventHistory.push({ event, args, timestamp: Date.now() });

        const callbacks = this.listeners.get(event);
        if (callbacks) {
            for (const callback of callbacks) {
                try {
                    callback(...args);
                } catch (error) {
                    if (this.logger) {
                        this.logger.error(`Error in event listener for ${event}:`, error);
                    }
                }
            }
        }
    }

    getEventHistory(): Array<{ event: string; args: unknown[]; timestamp: number }> {
        return this.eventHistory.toArray();
    }
}

/**
 * Utility class for managing event subscriptions with automatic cleanup.
 *
 * This class solves the common pattern of subscribing to events and needing
 * to unsubscribe later. It stores unsubscribe functions and provides a
 * single method to clean up all subscriptions.
 *
 * @example
 * ```typescript
 * const subscriptions = new EventSubscriptionManager();
 *
 * // Subscribe to events
 * subscriptions.subscribe(eventEmitter, 'onUpdate', () => { ... });
 * subscriptions.subscribe(eventEmitter, 'onDestroy', () => { ... });
 *
 * // Later, clean up all subscriptions at once
 * subscriptions.unsubscribeAll();
 * ```
 *
 * @public
 */
export class EventSubscriptionManager {
    private unsubscribers: Array<() => void> = [];

    /**
     * Subscribe to an event and track the subscription for later cleanup.
     *
     * @param emitter - The EventEmitter to subscribe to
     * @param event - The event name to listen for
     * @param callback - The callback function to execute when the event fires
     * @returns The unsubscribe function (also stored internally)
     */
    subscribe(
        emitter: EventEmitter,
        event: string,
        callback: (...args: unknown[]) => void
    ): () => void {
        const unsubscribe = emitter.on(event, callback);
        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Unsubscribe from all tracked events.
     * After calling this, the manager can be reused for new subscriptions.
     */
    unsubscribeAll(): void {
        for (const unsubscribe of this.unsubscribers) {
            unsubscribe();
        }
        this.unsubscribers = [];
    }

    /**
     * Get the number of active subscriptions.
     */
    get subscriptionCount(): number {
        return this.unsubscribers.length;
    }
}

/**
 * Performance monitor for tracking metrics
 *
 * Uses CircularBuffer for O(1) sample insertion instead of O(n) shift operations.
 */
export class PerformanceMonitor {
    private samples: CircularBuffer<number>;

    constructor(maxSamples: number = MAX_PERFORMANCE_SAMPLES) {
        this.samples = new CircularBuffer<number>(maxSamples);
    }

    addSample(value: number): void {
        // O(1) insertion using CircularBuffer instead of O(n) shift()
        this.samples.push(value);
    }

    getAverage(): number {
        const arr = this.samples.toArray();
        if (arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    getMin(): number {
        const arr = this.samples.toArray();
        return arr.length > 0 ? Math.min(...arr) : 0;
    }

    getMax(): number {
        const arr = this.samples.toArray();
        return arr.length > 0 ? Math.max(...arr) : 0;
    }

    reset(): void {
        this.samples.clear();
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
    /** Stores unsubscribe functions for event listeners to enable cleanup */
    private _eventUnsubscribers: Array<() => void> = [];
    /** Per-engine entity ID generator to ensure isolation between engine instances */
    private readonly idGenerator: EntityIdGenerator;

    constructor(
        componentManager: any,
        private eventEmitter: EventEmitter
    ) {
        this.idGenerator = new EntityIdGenerator();
        this.entityPool = new Pool(
            () => Entity.create(componentManager, eventEmitter, this.idGenerator),
            (entity) => entity.reset()
        );

        // Subscribe to entity changes to maintain tag index
        // Store unsubscribe functions for proper cleanup
        // Event callbacks receive unknown args, so we need to validate the entity type
        this._eventUnsubscribers.push(
            eventEmitter.on('onComponentAdded', (...args: unknown[]) => {
                const entity = args[0] as Entity;
                this.updateEntityTags(entity);
            })
        );
        this._eventUnsubscribers.push(
            eventEmitter.on('onComponentRemoved', (...args: unknown[]) => {
                const entity = args[0] as Entity;
                this.updateEntityTags(entity);
            })
        );
        this._eventUnsubscribers.push(
            eventEmitter.on('onTagChanged', (...args: unknown[]) => {
                const entity = args[0] as Entity;
                this.updateEntityTags(entity);
            })
        );
    }

    /**
     * Clean up all event listeners.
     * Called when the EntityManager is being disposed.
     */
    dispose(): void {
        for (const unsubscribe of this._eventUnsubscribers) {
            unsubscribe();
        }
        this._eventUnsubscribers = [];
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
        const archetypeManager = entity.getArchetypeManager();
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
        const archetypeManager = entity.getArchetypeManager();
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

    /**
     * Get the count of active entities.
     * More efficient than getAllEntities().length as it doesn't create an array.
     * @returns The number of active entities
     */
    getEntityCount(): number {
        return this.activeEntities.size;
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
