/**
 * Focused manager classes for composition-based ECS architecture
 * Each manager handles a single responsibility
 */

import { ArchetypeManager } from './archetype';
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
    private archetypeManager?: ArchetypeManager;
    private archetypesEnabled: boolean = false;
    private singletonComponents: Map<ComponentIdentifier, any> = new Map();

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

    /**
     * Enable archetype-based storage for improved performance
     * When enabled, entities are grouped by component composition for better cache locality
     */
    enableArchetypes(): void {
        if (!this.archetypesEnabled) {
            this.archetypeManager = new ArchetypeManager();
            this.archetypesEnabled = true;
        }
    }

    /**
     * Check if archetypes are enabled
     */
    areArchetypesEnabled(): boolean {
        return this.archetypesEnabled;
    }

    /**
     * Get the archetype manager (if archetypes are enabled)
     */
    getArchetypeManager(): ArchetypeManager | undefined {
        return this.archetypeManager;
    }

    // ========== Singleton Component Management ==========

    /**
     * Set a singleton component (global state that exists once per engine)
     * @param type - Component type
     * @param component - Component instance
     * @returns The previous singleton instance if it existed
     */
    setSingleton<T>(type: ComponentIdentifier<T>, component: T): T | undefined {
        const oldValue = this.singletonComponents.get(type);
        this.singletonComponents.set(type, component);

        // Auto-register component type by name
        if (!this.registry.has(type.name)) {
            this.registry.set(type.name, type);
        }

        return oldValue;
    }

    /**
     * Get a singleton component
     * @param type - Component type
     * @returns The singleton instance or undefined if not set
     */
    getSingleton<T>(type: ComponentIdentifier<T>): T | undefined {
        return this.singletonComponents.get(type);
    }

    /**
     * Check if a singleton component exists
     * @param type - Component type
     * @returns True if the singleton exists
     */
    hasSingleton<T>(type: ComponentIdentifier<T>): boolean {
        return this.singletonComponents.has(type);
    }

    /**
     * Remove a singleton component
     * @param type - Component type
     * @returns The removed singleton instance or undefined if it didn't exist
     */
    removeSingleton<T>(type: ComponentIdentifier<T>): T | undefined {
        const component = this.singletonComponents.get(type);
        this.singletonComponents.delete(type);
        return component;
    }

    /**
     * Get all singleton components
     * @returns Map of all singleton components
     */
    getAllSingletons(): Map<ComponentIdentifier, any> {
        return new Map(this.singletonComponents);
    }

    /**
     * Clear all singleton components
     */
    clearAllSingletons(): void {
        this.singletonComponents.clear();
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
    // Cache for sorted groups to avoid allocations in hot path
    private sortedGroupsCache: SystemGroup[] | null = null;
    private groupsCacheValid: boolean = false;

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
        this.groupsCacheValid = false; // Invalidate sorted groups cache
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

        // Post-process: sort systems WITHOUT dependencies by priority
        // Systems WITH dependencies must maintain their topological order.
        // Systems WITHOUT dependencies (no runAfter/runBefore) can be in any order
        // relative to each other without violating constraints, so we sort them by priority.
        //
        // Algorithm: Extract no-dependency systems, sort by priority, then place them back
        // in the same positions they occupied in the topological result. This preserves:
        // 1. Topological ordering for systems with dependencies
        // 2. Priority ordering for systems without dependencies
        // 3. Relative interleaving based on when each system was ready (in-degree became 0)
        if (result.length > 1) {
            // Extract systems with no explicit dependencies
            const noDeps: System<any>[] = [];
            for (const system of result) {
                if (system.runAfter.length === 0 && system.runBefore.length === 0) {
                    noDeps.push(system);
                }
            }

            // Only proceed if there are multiple no-dependency systems to sort
            if (noDeps.length > 1) {
                // Sort no-dependency systems by priority (descending)
                noDeps.sort((a, b) => b.priority - a.priority);

                // Replace each no-dependency system position with next from sorted list
                // This works because noDeps was extracted from result, so there's exactly
                // one entry in noDeps for each position in result that matches the condition
                let noDepsIndex = 0;
                return result.map((s) => {
                    if (s.runAfter.length === 0 && s.runBefore.length === 0) {
                        return noDeps[noDepsIndex++];
                    }
                    return s;
                });
            }
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

    /**
     * Get groups sorted by priority, using cached result when possible.
     * This avoids array allocations in the hot execution path.
     */
    private getSortedGroups(): SystemGroup[] {
        if (!this.groupsCacheValid || this.sortedGroupsCache === null) {
            this.sortedGroupsCache = Array.from(this.groups.values()).sort(
                (a: SystemGroup, b: SystemGroup) => b.priority - a.priority
            );
            this.groupsCacheValid = true;
        }
        return this.sortedGroupsCache;
    }

    executeVariableSystems(deltaTime: number = 16): void {
        this.ensureSorted();

        // First, execute systems in groups (sorted by group priority)
        const sortedGroups = this.getSortedGroups();

        for (const group of sortedGroups) {
            if (!group.enabled) continue;

            // Execute systems in this group that are variable update systems (sorted by system priority)
            // Note: filter() already creates a new array, so slice() is unnecessary
            const groupSystems = group.systems
                .filter((s: System<any>) => this.systems.includes(s))
                .sort((a: System<any>, b: System<any>) => b.priority - a.priority);

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
            const sortedGroups = this.getSortedGroups();

            for (const group of sortedGroups) {
                if (!group.enabled) continue;

                // Execute systems in this group that are fixed update systems (sorted by system priority)
                // Note: This still creates arrays per iteration, but groups are typically small
                // and the outer loop is the more critical hot path
                const groupSystems = group.systems
                    .filter((s: System<any>) => this.fixedUpdateSystems.includes(s))
                    .sort((a: System<any>, b: System<any>) => b.priority - a.priority);

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

    /**
     * Get a system by name
     * @param name - The name of the system to find
     * @returns The system if found, undefined otherwise
     */
    getSystem(name: string): System<any> | undefined {
        return (
            this.systems.find((s) => s.name === name) ||
            this.fixedUpdateSystems.find((s) => s.name === name)
        );
    }

    /**
     * Remove a system from the manager and clean up its resources.
     * This will call the system's destroy() method to unsubscribe from events.
     *
     * @param name - The name of the system to remove
     * @returns true if the system was found and removed, false otherwise
     */
    removeSystem(name: string): boolean {
        // Find and remove from variable update systems
        const variableIndex = this.systems.findIndex((s) => s.name === name);
        if (variableIndex !== -1) {
            const system = this.systems[variableIndex];

            // Remove from group if assigned
            if (system.group) {
                const group = this.groups.get(system.group);
                if (group) {
                    const groupIndex = group.systems.findIndex((s: System<any>) => s.name === name);
                    if (groupIndex !== -1) {
                        group.systems.splice(groupIndex, 1);
                    }
                }
            }

            // Destroy system (cleanup event listeners)
            system.destroy();

            // Remove from array
            this.systems.splice(variableIndex, 1);
            this.systemsSorted = false;
            return true;
        }

        // Find and remove from fixed update systems
        const fixedIndex = this.fixedUpdateSystems.findIndex((s) => s.name === name);
        if (fixedIndex !== -1) {
            const system = this.fixedUpdateSystems[fixedIndex];

            // Remove from group if assigned
            if (system.group) {
                const group = this.groups.get(system.group);
                if (group) {
                    const groupIndex = group.systems.findIndex((s: System<any>) => s.name === name);
                    if (groupIndex !== -1) {
                        group.systems.splice(groupIndex, 1);
                    }
                }
            }

            // Destroy system (cleanup event listeners)
            system.destroy();

            // Remove from array
            this.fixedUpdateSystems.splice(fixedIndex, 1);
            this.fixedSystemsSorted = false;
            return true;
        }

        return false;
    }

    /**
     * Remove all systems and clean up their resources.
     */
    removeAllSystems(): void {
        // Destroy all variable update systems
        for (const system of this.systems) {
            system.destroy();
        }
        this.systems = [];
        this.systemsSorted = true;

        // Destroy all fixed update systems
        for (const system of this.fixedUpdateSystems) {
            system.destroy();
        }
        this.fixedUpdateSystems = [];
        this.fixedSystemsSorted = true;

        // Clear systems from all groups
        for (const group of this.groups.values()) {
            group.systems = [];
        }
    }
}

/**
 * Manages query creation and tracking
 */
export class QueryManager {
    private queries: Query<any>[] = [];
    private componentManager?: any; // ComponentManager reference for archetype support

    /**
     * Set component manager reference (for archetype support)
     */
    setComponentManager(componentManager: any): void {
        this.componentManager = componentManager;
    }

    createQuery<C extends readonly any[] = any[]>(options: QueryOptions<any>): Query<C> {
        const archetypeManager = this.componentManager?.getArchetypeManager();
        const query = new Query<C>(options, archetypeManager);
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

    /**
     * Clear all subscriptions and message history.
     * Called when the MessageManager is being disposed.
     */
    clear(): void {
        this.bus.clear();
    }
}

/**
 * Manages component change tracking and events
 */
export class ChangeTrackingManager {
    private componentManager: ComponentManager;
    private eventEmitter: any; // EventEmitter
    private batchMode: boolean = false;
    private proxyTrackingEnabled: boolean = false;
    private reactiveComponents: WeakMap<any, any> = new WeakMap();
    private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private debounceMs: number = 0;
    // Track dirty components per entity (for archetype mode)
    private dirtyComponentsMap: Map<number, Set<ComponentIdentifier>> = new Map();

    constructor(componentManager: ComponentManager, eventEmitter: any, options: any = {}) {
        this.componentManager = componentManager;
        this.eventEmitter = eventEmitter;
        this.proxyTrackingEnabled = options.enableProxyTracking || false;
        this.batchMode = options.batchMode || false;
        this.debounceMs = options.debounceMs || 0;
    }

    /**
     * Enable or disable batch mode (suspends events)
     */
    setBatchMode(enabled: boolean): void {
        this.batchMode = enabled;
        // Also update all component arrays
        for (const componentArray of this.componentManager.getAllComponentArrays().values()) {
            componentArray.setBatchMode(enabled);
        }
    }

    /**
     * Check if batch mode is enabled
     */
    isBatchMode(): boolean {
        return this.batchMode;
    }

    /**
     * Enable proxy-based change tracking
     */
    enableProxyTracking(): void {
        this.proxyTrackingEnabled = true;
    }

    /**
     * Disable proxy-based change tracking
     */
    disableProxyTracking(): void {
        this.proxyTrackingEnabled = false;
    }

    /**
     * Check if proxy tracking is enabled
     */
    isProxyTrackingEnabled(): boolean {
        return this.proxyTrackingEnabled;
    }

    /**
     * Mark a component as dirty (changed)
     */
    markComponentDirty(entity: Entity, componentType: ComponentIdentifier): void {
        const index = entity.getComponentStorageIndex(componentType);
        if (index !== undefined) {
            const archetypeManager = this.componentManager.getArchetypeManager();

            if (archetypeManager) {
                // Archetype mode: use dirtyComponentsMap
                const entityId = entity.numericId;
                if (!this.dirtyComponentsMap.has(entityId)) {
                    this.dirtyComponentsMap.set(entityId, new Set());
                }
                this.dirtyComponentsMap.get(entityId)?.add(componentType);
            } else {
                // Legacy mode: use component array
                const componentArray = this.componentManager.getComponentArray(componentType);
                componentArray.markDirty(index);
            }

            // Emit change event if not in batch mode
            if (!this.batchMode) {
                this.emitComponentChanged(entity, componentType);
            }
        }
    }

    /**
     * Emit a component changed event
     */
    private emitComponentChanged(entity: any, componentType: ComponentIdentifier): void {
        const component = entity.getComponent(componentType);

        const event = {
            entity,
            componentType,
            newValue: component,
            timestamp: Date.now(),
        };

        // Debounce if configured
        if (this.debounceMs > 0) {
            const key = `${entity.numericId}-${componentType.name}`;
            const existingTimer = this.debounceTimers.get(key);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const timer = setTimeout(() => {
                this.eventEmitter.emit('onComponentChanged', event);
                this.debounceTimers.delete(key);
            }, this.debounceMs);

            this.debounceTimers.set(key, timer);
        } else {
            this.eventEmitter.emit('onComponentChanged', event);
        }
    }

    /**
     * Create a reactive (Proxy-wrapped) component that auto-tracks changes
     */
    createReactiveComponent<T extends object>(
        component: T,
        entity: any,
        componentType: ComponentIdentifier<T>
    ): T {
        if (!this.proxyTrackingEnabled) {
            return component;
        }

        // Check if already proxied
        if (this.reactiveComponents.has(component)) {
            return this.reactiveComponents.get(component);
        }

        const proxy = new Proxy(component, {
            set: (target: any, property: string | symbol, value: any): boolean => {
                const oldValue = target[property];
                target[property] = value;

                // Mark as dirty and emit change event
                if (oldValue !== value) {
                    this.markComponentDirty(entity, componentType);

                    // Call onChanged lifecycle hook if it exists
                    if (typeof target.onChanged === 'function') {
                        target.onChanged();
                    }
                }

                return true;
            },
        });

        this.reactiveComponents.set(component, proxy);
        // Map proxy to itself for idempotence - ensures that passing a proxy
        // back into createReactiveProxy returns the same proxy instead of
        // creating a nested proxy wrapper
        this.reactiveComponents.set(proxy, proxy);
        return proxy;
    }

    /**
     * Get all dirty components for an entity
     */
    getDirtyComponents(entity: Entity): ComponentIdentifier[] {
        const archetypeManager = this.componentManager.getArchetypeManager();

        if (archetypeManager) {
            // Archetype mode: use dirtyComponentsMap
            const entityId = entity.numericId;
            const dirtySet = this.dirtyComponentsMap.get(entityId);
            return dirtySet ? Array.from(dirtySet) : [];
        } else {
            // Legacy mode: use component arrays
            const dirtyComponents: ComponentIdentifier[] = [];

            entity.forEachComponentIndex((componentType, index) => {
                const componentArray = this.componentManager.getComponentArray(componentType);
                if (componentArray.isDirty(index)) {
                    dirtyComponents.push(componentType);
                }
            });

            return dirtyComponents;
        }
    }

    /**
     * Clear dirty flags for all components on an entity
     */
    clearDirtyComponents(entity: Entity): void {
        const archetypeManager = this.componentManager.getArchetypeManager();

        if (archetypeManager) {
            // Archetype mode: clear dirtyComponentsMap
            const entityId = entity.numericId;
            this.dirtyComponentsMap.delete(entityId);
        } else {
            // Legacy mode: clear component arrays
            entity.forEachComponentIndex((componentType, index) => {
                const componentArray = this.componentManager.getComponentArray(componentType);
                componentArray.clearDirty(index);
            });
        }
    }

    /**
     * Clear all dirty flags across all components
     */
    clearAllDirty(): void {
        const archetypeManager = this.componentManager.getArchetypeManager();

        if (archetypeManager) {
            // Archetype mode: clear dirtyComponentsMap
            this.dirtyComponentsMap.clear();
        } else {
            // Legacy mode: clear component arrays
            for (const componentArray of this.componentManager.getAllComponentArrays().values()) {
                componentArray.clearAllDirty();
            }
        }
    }

    /**
     * Execute a function in batch mode (events suspended)
     */
    batch<T>(fn: () => T): T {
        const wasBatchMode = this.batchMode;
        this.setBatchMode(true);

        try {
            return fn();
        } finally {
            this.setBatchMode(wasBatchMode);
        }
    }

    /**
     * Clean up all pending timers and resources.
     * Call this when disposing the ChangeTrackingManager.
     */
    dispose(): void {
        // Clear all pending debounce timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        // Clear dirty components tracking
        this.dirtyComponentsMap.clear();
    }
}
