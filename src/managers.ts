/**
 * Focused manager classes for composition-based ECS architecture
 * Each manager handles a single responsibility
 */

import type {
    ComponentIdentifier,
    ComponentValidator,
    SystemType,
    QueryOptions,
    SystemProfile,
    EntityPrefab,
    SerializedWorld,
    SerializedEntity,
    SystemMessage,
    ComponentPoolOptions,
    PoolStats
} from "./definitions";

import { Entity, Query, System, ComponentArray, Pool, MessageBus } from "./core";

// Constants
const MAX_MESSAGE_HISTORY = 1000;
const MAX_SNAPSHOTS = 10;

/**
 * Manages component storage, validation, and registration
 */
export class ComponentManager {
    private componentArrays: Map<Function, ComponentArray<any>> = new Map();
    private validators: Map<Function, ComponentValidator> = new Map();
    private registry: Map<string, ComponentIdentifier> = new Map();
    private componentPools: Map<ComponentIdentifier, Pool<any>> = new Map();

    getComponentArray<T>(type: ComponentIdentifier): ComponentArray<T> {
        if (!this.componentArrays.has(type)) {
            this.componentArrays.set(type, new ComponentArray<T>());
        }
        // Auto-register component type by name for deserialization
        if (!this.registry.has(type.name)) {
            this.registry.set(type.name, type);
        }
        return this.componentArrays.get(type) as ComponentArray<T>;
    }

    registerValidator<T>(type: ComponentIdentifier<T>, validator: ComponentValidator<T>): void {
        this.validators.set(type, validator);
    }

    getValidator<T>(type: ComponentIdentifier<T>): ComponentValidator<T> | undefined {
        return this.validators.get(type) as ComponentValidator<T>;
    }

    registerComponent<T>(type: ComponentIdentifier<T>): void {
        this.registry.set(type.name, type);
    }

    getComponentByName(name: string): ComponentIdentifier | undefined {
        return this.registry.get(name);
    }

    getAllComponentArrays(): Map<Function, ComponentArray<any>> {
        return this.componentArrays;
    }

    /**
     * Register a component pool for object reuse
     */
    registerComponentPool<T extends object>(type: ComponentIdentifier<T>, options: ComponentPoolOptions = {}): void {
        const { initialSize = 10, maxSize = 1000 } = options;

        // Create pool with factory and reset function
        const pool = new Pool<T>(
            () => new type(),
            (component: T) => {
                // Reset component to default state
                // For simple objects, we can just recreate or reset properties
                const defaultInstance = new type();
                Object.assign(component, defaultInstance);
            },
            maxSize
        );

        // Pre-populate pool with initial instances
        const preallocated: T[] = [];
        for (let i = 0; i < initialSize; i++) {
            preallocated.push(pool.acquire());
        }
        // Release them back to the pool
        for (const instance of preallocated) {
            pool.release(instance);
        }

        this.componentPools.set(type, pool);
    }

    /**
     * Get a component instance from the pool if available, otherwise create new
     */
    acquireComponent<T extends object>(type: ComponentIdentifier<T>, ...args: any[]): T {
        const pool = this.componentPools.get(type);
        if (pool) {
            const component = pool.acquire();
            // Apply constructor arguments if provided
            if (args.length > 0) {
                const tempInstance = new type(...args);
                Object.assign(component, tempInstance);
            }
            return component;
        }
        // No pool registered, create normally
        return new type(...args);
    }

    /**
     * Release a component back to the pool
     */
    releaseComponent<T extends object>(type: ComponentIdentifier<T>, component: T): void {
        const pool = this.componentPools.get(type);
        if (pool) {
            pool.release(component);
        }
        // If no pool, component will be garbage collected
    }

    /**
     * Get pool statistics for a component type
     */
    getComponentPoolStats<T extends object>(type: ComponentIdentifier<T>): PoolStats | undefined {
        const pool = this.componentPools.get(type);
        return pool ? pool.stats : undefined;
    }

    /**
     * Check if a component type has a pool registered
     */
    hasComponentPool<T extends object>(type: ComponentIdentifier<T>): boolean {
        return this.componentPools.has(type);
    }
}

/**
 * Manages system registration, execution, and profiling
 */
export class SystemManager {
    private systems: System<any>[] = [];
    private fixedUpdateSystems: System<any>[] = [];
    private systemsSorted: boolean = true;
    private fixedSystemsSorted: boolean = true;
    private fixedUpdateAccumulator: number = 0;
    private fixedUpdateInterval: number;
    private maxFixedIterations: number;

    constructor(
        fixedUpdateFPS: number = 60,
        maxFixedIterations: number = 10
    ) {
        this.fixedUpdateInterval = 1000 / fixedUpdateFPS;
        this.maxFixedIterations = maxFixedIterations;
    }

    createSystem<C extends any[] = any[]>(
        system: System<C>,
        isFixedUpdate: boolean = false
    ): System<C> {
        if (isFixedUpdate) {
            this.fixedUpdateSystems.push(system);
            this.fixedSystemsSorted = false;
        } else {
            this.systems.push(system);
            this.systemsSorted = false;
        }
        return system;
    }

    private ensureSorted(): void {
        if (!this.systemsSorted) {
            this.systems.sort((a, b) => b.priority - a.priority);
            this.systemsSorted = true;
        }
        if (!this.fixedSystemsSorted) {
            this.fixedUpdateSystems.sort((a, b) => b.priority - a.priority);
            this.fixedSystemsSorted = true;
        }
    }

    executeVariableSystems(): void {
        this.ensureSorted();
        for (const system of this.systems) {
            if (system.enabled) {
                system.step();
            }
        }
    }

    executeFixedSystems(deltaTime: number, debugMode: boolean = false): void {
        this.ensureSorted();

        this.fixedUpdateAccumulator += deltaTime;
        let iterations = 0;

        while (this.fixedUpdateAccumulator >= this.fixedUpdateInterval &&
               iterations < this.maxFixedIterations) {
            for (const system of this.fixedUpdateSystems) {
                if (system.enabled) {
                    system.step();
                }
            }
            this.fixedUpdateAccumulator -= this.fixedUpdateInterval;
            iterations++;
        }

        // Spiral of death protection
        if (iterations >= this.maxFixedIterations) {
            this.fixedUpdateAccumulator = 0;
            if (debugMode) {
                console.warn('[ECS] Fixed update spiral of death detected, accumulator reset');
            }
        }
    }

    getAllSystems(): System<any>[] {
        return [...this.systems, ...this.fixedUpdateSystems];
    }

    getProfiles(): SystemProfile[] {
        return this.getAllSystems().map(system => system.profile);
    }
}

/**
 * Manages query creation and tracking
 */
export class QueryManager {
    private queries: Query<any>[] = [];

    createQuery<C extends any[] = any[]>(options: QueryOptions): Query<C> {
        const query = new Query<C>(options);
        this.queries.push(query);
        return query;
    }

    updateQueries(entity: Entity): void {
        for (const query of this.queries) {
            query.match(entity);
        }
    }

    getAllQueries(): Query<any>[] {
        return this.queries;
    }
}

/**
 * Manages prefab registration and instantiation
 */
export class PrefabManager {
    private prefabs: Map<string, EntityPrefab> = new Map();

    register(name: string, prefab: EntityPrefab): void {
        this.prefabs.set(name, prefab);
    }

    get(name: string): EntityPrefab | undefined {
        return this.prefabs.get(name);
    }

    has(name: string): boolean {
        return this.prefabs.has(name);
    }

    getAllPrefabs(): Map<string, EntityPrefab> {
        return new Map(this.prefabs);
    }
}

/**
 * Manages world snapshots and restoration
 */
export class SnapshotManager {
    private snapshots: SerializedWorld[] = [];
    private maxSnapshots: number;

    constructor(maxSnapshots: number = MAX_SNAPSHOTS) {
        this.maxSnapshots = maxSnapshots;
    }

    createSnapshot(world: SerializedWorld): void {
        this.snapshots.push(world);
        while (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }
    }

    getSnapshot(index: number = -1): SerializedWorld | undefined {
        if (index === -1) {
            return this.snapshots[this.snapshots.length - 1];
        }
        return this.snapshots[index];
    }

    getSnapshotCount(): number {
        return this.snapshots.length;
    }

    clearSnapshots(): void {
        this.snapshots = [];
    }
}

/**
 * Manages inter-system messaging
 */
export class MessageManager {
    private bus: MessageBus;

    constructor(maxHistory: number = MAX_MESSAGE_HISTORY) {
        this.bus = new MessageBus(maxHistory);
    }

    subscribe(messageType: string, callback: (message: SystemMessage) => void): () => void {
        return this.bus.subscribe(messageType, callback);
    }

    publish(messageType: string, data: any, sender?: string): void {
        this.bus.publish(messageType, data, sender);
    }

    getHistory(messageType?: string): SystemMessage[] {
        return this.bus.getMessageHistory(messageType);
    }
}
