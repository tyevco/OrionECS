/**
 * Focused manager classes for composition-based ECS architecture
 * Each manager handles a single responsibility
 */

import {
    ComponentArray,
    type Entity,
    MessageBus,
    Pool,
    Query,
    type System,
    SystemGroup,
} from './core';
import type {
    ComponentIdentifier,
    ComponentPoolOptions,
    ComponentValidator,
    EntityPrefab,
    PoolStats,
    PrefabDefinition,
    QueryOptions,
    SerializedWorld,
    SystemMessage,
    SystemProfile,
} from './definitions';

// Constants
const MAX_MESSAGE_HISTORY = 1000;
const MAX_SNAPSHOTS = 10;

/**
 * Manages component storage, validation, and registration
 */
export class ComponentManager {
    private componentArrays: Map<ComponentIdentifier, ComponentArray<any>> = new Map();
    private validators: Map<ComponentIdentifier, ComponentValidator> = new Map();
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

    getAllComponentArrays(): Map<ComponentIdentifier, ComponentArray<any>> {
        return this.componentArrays;
    }

    /**
     * Register a component pool for object reuse
     */
    registerComponentPool<T extends object>(
        type: ComponentIdentifier<T>,
        options: ComponentPoolOptions = {}
    ): void {
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
    private groups: Map<string, SystemGroup> = new Map();

    constructor(fixedUpdateFPS: number = 60, maxFixedIterations: number = 10) {
        this.fixedUpdateInterval = 1000 / fixedUpdateFPS;
        this.maxFixedIterations = maxFixedIterations;
    }

    createGroup(name: string, priority: number): SystemGroup {
        if (this.groups.has(name)) {
            throw new Error(`System group '${name}' already exists`);
        }
        const group = new SystemGroup(name, priority);
        this.groups.set(name, group);
        return group;
    }

    createSystem<C extends any[] = any[]>(
        system: System<C>,
        isFixedUpdate: boolean = false
    ): System<C> {
        // If system has a group, add it to that group
        if (system.group) {
            const group = this.groups.get(system.group);
            if (!group) {
                throw new Error(
                    `System group '${system.group}' not found. Create it first with createSystemGroup().`
                );
            }
            group.systems.push(system);
        }

        if (isFixedUpdate) {
            this.fixedUpdateSystems.push(system);
            this.fixedSystemsSorted = false;
        } else {
            this.systems.push(system);
            this.systemsSorted = false;
        }
        return system;
    }

    private topologicalSort(systems: System<any>[]): System<any>[] {
        // Build system name to system map
        const systemMap = new Map<string, System<any>>();
        for (const system of systems) {
            systemMap.set(system.name, system);
        }

        // Build adjacency list and in-degree map
        const adjList = new Map<string, Set<string>>();
        const inDegree = new Map<string, number>();

        for (const system of systems) {
            if (!adjList.has(system.name)) {
                adjList.set(system.name, new Set());
            }
            if (!inDegree.has(system.name)) {
                inDegree.set(system.name, 0);
            }
        }

        // Build dependencies
        for (const system of systems) {
            // runAfter: this system should run AFTER these systems
            // So these systems should come before this system in the graph
            for (const dep of system.runAfter) {
                if (systemMap.has(dep)) {
                    adjList.get(dep)?.add(system.name);
                    inDegree.set(system.name, (inDegree.get(system.name) || 0) + 1);
                }
            }

            // runBefore: this system should run BEFORE these systems
            // So this system should come before these systems in the graph
            for (const dep of system.runBefore) {
                if (systemMap.has(dep)) {
                    adjList.get(system.name)?.add(dep);
                    inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
                }
            }
        }

        // Kahn's algorithm for topological sort
        const queue: string[] = [];
        const result: System<any>[] = [];

        // Find all nodes with in-degree 0
        for (const [name, degree] of inDegree) {
            if (degree === 0) {
                queue.push(name);
            }
        }

        while (queue.length > 0) {
            const current = queue.shift();
            if (current === undefined) continue;

            const system = systemMap.get(current);
            if (!system) continue;
            result.push(system);

            // Reduce in-degree for neighbors
            const neighbors = adjList.get(current);
            if (neighbors) {
                for (const neighbor of neighbors) {
                    const newDegree = (inDegree.get(neighbor) || 0) - 1;
                    inDegree.set(neighbor, newDegree);
                    if (newDegree === 0) {
                        queue.push(neighbor);
                    }
                }
            }
        }

        // Check for circular dependencies
        if (result.length !== systems.length) {
            // Find systems involved in the cycle
            const remaining = systems.filter((s) => !result.includes(s));
            const cycleNames = remaining.map((s) => s.name).join(', ');
            throw new Error(`Circular dependency detected in systems: ${cycleNames}`);
        }

        // If no dependencies, sort by priority
        const noDepsLength = result.length;
        if (noDepsLength > 1) {
            // Sort systems with no dependencies by priority
            const withDeps: System<any>[] = [];
            const noDeps: System<any>[] = [];

            for (const system of result) {
                if (system.runAfter.length === 0 && system.runBefore.length === 0) {
                    noDeps.push(system);
                } else {
                    withDeps.push(system);
                }
            }

            // Sort no-dependency systems by priority
            noDeps.sort((a, b) => b.priority - a.priority);

            // Rebuild result maintaining topological order for systems with deps
            // and priority order for systems without deps
            return result.map((s) => {
                if (s.runAfter.length === 0 && s.runBefore.length === 0) {
                    const noDep = noDeps.shift();
                    return noDep !== undefined ? noDep : s;
                }
                return s;
            });
        }

        return result;
    }

    private ensureSorted(): void {
        if (!this.systemsSorted) {
            // First check if any systems have dependencies
            const hasDependencies = this.systems.some(
                (s) => s.runAfter.length > 0 || s.runBefore.length > 0
            );
            if (hasDependencies) {
                this.systems = this.topologicalSort(this.systems);
            } else {
                this.systems.sort((a, b) => b.priority - a.priority);
            }
            this.systemsSorted = true;
        }
        if (!this.fixedSystemsSorted) {
            const hasDependencies = this.fixedUpdateSystems.some(
                (s) => s.runAfter.length > 0 || s.runBefore.length > 0
            );
            if (hasDependencies) {
                this.fixedUpdateSystems = this.topologicalSort(this.fixedUpdateSystems);
            } else {
                this.fixedUpdateSystems.sort((a, b) => b.priority - a.priority);
            }
            this.fixedSystemsSorted = true;
        }
    }

    executeVariableSystems(deltaTime: number = 16): void {
        this.ensureSorted();

        // First, execute systems in groups (sorted by group priority)
        // eslint-disable-next-line unicorn/no-array-method-this-argument -- Node 18 compatibility: toSorted() not available
        const sortedGroups = Array.from(this.groups.values())
            .slice()
            .sort((a, b) => b.priority - a.priority);

        for (const group of sortedGroups) {
            if (!group.enabled) continue;

            // Execute systems in this group that are variable update systems (sorted by system priority)
            // eslint-disable-next-line unicorn/no-array-method-this-argument -- Node 18 compatibility: toSorted() not available
            const groupSystems = group.systems
                .filter((s) => this.systems.includes(s))
                .slice()
                .sort((a, b) => b.priority - a.priority);

            for (const system of groupSystems) {
                system.step(deltaTime);
            }
        }

        // Then, execute systems without a group
        for (const system of this.systems) {
            if (!system.group) {
                system.step(deltaTime);
            }
        }
    }

    executeFixedSystems(deltaTime: number, debugMode: boolean = false): void {
        this.ensureSorted();

        this.fixedUpdateAccumulator += deltaTime;
        let iterations = 0;

        while (
            this.fixedUpdateAccumulator >= this.fixedUpdateInterval &&
            iterations < this.maxFixedIterations
        ) {
            // First, execute systems in groups (sorted by group priority)
            // eslint-disable-next-line unicorn/no-array-method-this-argument -- Node 18 compatibility: toSorted() not available
            const sortedGroups = Array.from(this.groups.values())
                .slice()
                .sort((a, b) => b.priority - a.priority);

            for (const group of sortedGroups) {
                if (!group.enabled) continue;

                // Execute systems in this group that are fixed update systems (sorted by system priority)
                // eslint-disable-next-line unicorn/no-array-method-this-argument -- Node 18 compatibility: toSorted() not available
                const groupSystems = group.systems
                    .filter((s) => this.fixedUpdateSystems.includes(s))
                    .slice()
                    .sort((a, b) => b.priority - a.priority);

                for (const system of groupSystems) {
                    system.step(this.fixedUpdateInterval);
                }
            }

            // Then, execute systems without a group
            for (const system of this.fixedUpdateSystems) {
                if (!system.group) {
                    system.step(this.fixedUpdateInterval);
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

    enableGroup(name: string): void {
        const group = this.groups.get(name);
        if (!group) {
            throw new Error(`System group '${name}' not found`);
        }
        group.enabled = true;
    }

    disableGroup(name: string): void {
        const group = this.groups.get(name);
        if (!group) {
            throw new Error(`System group '${name}' not found`);
        }
        group.enabled = false;
    }

    getGroup(name: string): SystemGroup | undefined {
        return this.groups.get(name);
    }

    getAllGroups(): SystemGroup[] {
        return Array.from(this.groups.values());
    }

    getAllSystems(): System<any>[] {
        return [...this.systems, ...this.fixedUpdateSystems];
    }

    getProfiles(): SystemProfile[] {
        return this.getAllSystems().map((system) => system.profile);
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

    /**
     * Update all queries with all entities
     * Used primarily for transaction commits to batch query updates
     */
    updateAllQueries(): void {
        // This method is intentionally empty as updateQueries is called per entity
        // It's here for semantic clarity in transaction commits
    }

    getAllQueries(): Query<any>[] {
        return this.queries;
    }
}

/**
 * Manages prefab registration and instantiation
 */
export class PrefabManager {
    private prefabs: Map<string, PrefabDefinition> = new Map();

    /**
     * Register a prefab (static or parameterized)
     */
    register(name: string, prefab: PrefabDefinition): void {
        this.prefabs.set(name, prefab);
    }

    /**
     * Get a prefab by name, optionally passing parameters for function-based prefabs
     */
    get(name: string, params?: any): EntityPrefab | undefined {
        const prefabDef = this.prefabs.get(name);
        if (!prefabDef) return undefined;

        // If it's a function, call it with params
        if (typeof prefabDef === 'function') {
            return prefabDef(params);
        }

        return prefabDef;
    }

    has(name: string): boolean {
        return this.prefabs.has(name);
    }

    getAllPrefabs(): Map<string, PrefabDefinition> {
        return new Map(this.prefabs);
    }

    /**
     * Create a new prefab that extends a base prefab
     */
    extendPrefab(baseName: string, extensions: Partial<EntityPrefab>): EntityPrefab {
        const base = this.get(baseName);
        if (!base) {
            throw new Error(`Base prefab '${baseName}' not found`);
        }

        return {
            name: extensions.name || base.name,
            components: [...base.components, ...(extensions.components || [])],
            tags: [...(base.tags || []), ...(extensions.tags || [])],
            children: extensions.children || base.children,
            parent: baseName,
        };
    }

    /**
     * Create a variant of a prefab with overridden component values
     */
    variantOfPrefab(baseName: string, overrides: Record<string, any>): EntityPrefab {
        const base = this.get(baseName);
        if (!base) {
            throw new Error(`Base prefab '${baseName}' not found`);
        }

        // Clone base prefab and apply component overrides
        const variant: EntityPrefab = {
            name: base.name,
            components: base.components.map((comp) => {
                const override = overrides[comp.type.name];
                if (override) {
                    // If override is an array, use it directly as args
                    if (Array.isArray(override)) {
                        return {
                            type: comp.type,
                            args: override,
                        };
                    }

                    // If override is an object, create instance and apply overrides
                    if (typeof override === 'object') {
                        // Create temporary instance with original args
                        const tempInstance = new comp.type(...comp.args);

                        // Apply overrides to the instance
                        Object.assign(tempInstance, override);

                        // Extract values as args array
                        // Reconstruct args from the modified instance
                        const newArgs = comp.args.map((arg, idx) => {
                            // Try to get the property value from the instance
                            const keys = Object.keys(tempInstance);
                            if (keys[idx] !== undefined) {
                                return (tempInstance as any)[keys[idx]];
                            }
                            return arg;
                        });

                        return {
                            type: comp.type,
                            args: newArgs,
                        };
                    }

                    // For primitive overrides, replace first arg
                    return {
                        type: comp.type,
                        args: [override, ...comp.args.slice(1)],
                    };
                }
                // No override, return copy of original
                return {
                    type: comp.type,
                    args: [...comp.args],
                };
            }),
            tags: [...(base.tags || [])],
            children: base.children,
            parent: baseName,
        };

        return variant;
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
