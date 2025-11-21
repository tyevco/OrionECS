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

    createSystem<C extends readonly any[] = any[]>(
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

    createQuery<C extends readonly any[] = any[]>(options: QueryOptions<any>): Query<C> {
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

    /**
     * Extend a base prefab with additional components and tags
     * @param baseName - Name of the base prefab to extend
     * @param overrides - Additional components, tags, or children to add
     * @returns Extended prefab definition
     */
    extend(baseName: string, overrides: Partial<EntityPrefab>): EntityPrefab {
        const base = this.prefabs.get(baseName);
        if (!base) {
            throw new Error(`Base prefab '${baseName}' not found`);
        }

        // Merge base and overrides
        const extended: EntityPrefab = {
            name: overrides.name || `${baseName}_extended`,
            components: [...base.components, ...(overrides.components || [])],
            tags: [...base.tags, ...(overrides.tags || [])],
            children: [...(base.children || []), ...(overrides.children || [])],
            parent: baseName,
        };

        // If base has a factory, create a new factory that extends it
        if (base.factory) {
            const originalFactory = base.factory;
            const additionalComponents = overrides.components || [];
            const additionalTags = overrides.tags || [];
            const additionalChildren = overrides.children || [];

            extended.factory = (...args: any[]) => {
                const baseResult = originalFactory(...args);
                return {
                    name: baseResult.name,
                    components: [...baseResult.components, ...additionalComponents],
                    tags: [...baseResult.tags, ...additionalTags],
                    children: [...(baseResult.children || []), ...additionalChildren],
                };
            };
        }

        return extended;
    }

    /**
     * Create a variant of a prefab with component value overrides
     * @param baseName - Name of the base prefab
     * @param overrides - Component values to override, tags to add, or children
     * @returns Variant prefab definition
     */
    createVariant(
        baseName: string,
        overrides: {
            components?: { [componentName: string]: any };
            tags?: string[];
            children?: EntityPrefab[];
        }
    ): EntityPrefab {
        const base = this.prefabs.get(baseName);
        if (!base) {
            throw new Error(`Base prefab '${baseName}' not found`);
        }

        const variant: EntityPrefab = {
            name: `${baseName}_variant`,
            components: base.components.map((comp) => {
                const componentName = comp.type.name;
                if (overrides.components && componentName in overrides.components) {
                    // Override component args with new values
                    const override = overrides.components[componentName];
                    return {
                        type: comp.type,
                        args: Array.isArray(override) ? override : [override],
                    };
                }
                return comp;
            }),
            tags: [...base.tags, ...(overrides.tags || [])],
            children: [...(base.children || []), ...(overrides.children || [])],
            parent: baseName,
        };

        // Preserve factory if present
        if (base.factory) {
            variant.factory = base.factory;
        }

        return variant;
    }

    /**
     * Resolve a prefab, applying factory function if present
     * @param name - Prefab name
     * @param args - Arguments to pass to factory function (if applicable)
     * @returns Resolved prefab instance
     */
    resolve(name: string, ...args: any[]): EntityPrefab | undefined {
        const prefab = this.prefabs.get(name);
        if (!prefab) {
            return undefined;
        }

        // If prefab has a factory, call it with the provided arguments
        if (prefab.factory) {
            const factoryResult = prefab.factory(...args);
            return {
                ...factoryResult,
                name: factoryResult.name,
                factory: prefab.factory, // Preserve factory for future use
                parent: prefab.parent,
            };
        }

        return prefab;
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
