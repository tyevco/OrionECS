/**
 * Focused manager classes for composition-based ECS architecture
 * Each manager handles a single responsibility
 */

import { ArchetypeManager } from './archetype';
import {
    type AnySystemTuple,
    ComponentArray,
    type Entity,
    type EventEmitter,
    MessageBus,
    Pool,
    Query,
    type System,
    SystemGroup,
} from './core';
import type {
    CircuitBreakerConfig,
    CircuitBreakerState,
    ComponentIdentifier,
    ComponentPoolOptions,
    ComponentValidator,
    EngineHealthEvent,
    EntityPrefab,
    ErrorRecoveryConfig,
    ErrorReport,
    ErrorSeverity,
    Logger,
    PoolStats,
    QueryOptions,
    RecoveryStrategy,
    SerializedWorld,
    SystemError,
    SystemErrorConfig,
    SystemHealth,
    SystemMessage,
    SystemProfile,
} from './definitions';

// Constants
const MAX_MESSAGE_HISTORY = 1000;
const MAX_SNAPSHOTS = 10;

/**
 * Manages component storage, validation, and registration
 *
 * Note: Internal maps use 'any' for heterogeneous type storage. Public methods
 * provide type-safe access via generics.
 */
export class ComponentManager {
    // Internal storage uses 'any' for heterogeneous component types.
    // Type safety is enforced via generic accessor methods at the API boundary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private componentArrays: Map<ComponentIdentifier, ComponentArray<any>> = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private validators: Map<ComponentIdentifier, ComponentValidator<any>> = new Map();
    private registry: Map<string, ComponentIdentifier> = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private componentPools: Map<ComponentIdentifier, Pool<any>> = new Map();
    private archetypeManager?: ArchetypeManager;
    private archetypesEnabled: boolean = false;
    // Singleton storage - type safety enforced via generic accessor methods
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private singletonComponents: Map<ComponentIdentifier, any> = new Map();
    // Optional logger for component operations
    private logger?: Logger;

    /**
     * Set the logger for this component manager.
     * @internal
     */
    setLogger(logger: Logger): void {
        this.logger = logger;
    }

    /**
     * Get or create the component array for a specific component type.
     *
     * Component arrays provide sparse storage for component instances, allowing
     * efficient lookup by entity storage index. If no array exists for the type,
     * one will be created automatically.
     *
     * Type safety is enforced via the generic parameter constraint - the type
     * parameter T is bound to the ComponentIdentifier<T>, ensuring the returned
     * ComponentArray<T> matches the requested component type.
     *
     * @typeParam T - The component type
     * @param type - The component class/constructor to get the array for
     * @returns The component array for the specified type
     *
     * @example
     * ```typescript
     * const positionArray = componentManager.getComponentArray<Position>(Position);
     * const component = positionArray.get(entity.getComponentStorageIndex(Position));
     * ```
     */
    getComponentArray<T>(type: ComponentIdentifier<T>): ComponentArray<T> {
        if (!this.componentArrays.has(type)) {
            this.componentArrays.set(type, new ComponentArray<T>());
        }
        // Auto-register component type by name for deserialization
        if (!this.registry.has(type.name)) {
            this.registry.set(type.name, type);
        }
        return this.componentArrays.get(type) as ComponentArray<T>;
    }

    /**
     * Register a validation function for a component type.
     *
     * Validators are called when components are added or modified to ensure
     * data integrity. They should throw an error if validation fails.
     *
     * @typeParam T - The component type
     * @param type - The component class/constructor
     * @param validator - Function that validates component instances
     *
     * @example
     * ```typescript
     * componentManager.registerValidator(Position, (pos) => {
     *   if (typeof pos.x !== 'number' || typeof pos.y !== 'number') {
     *     throw new Error('Position must have numeric x and y');
     *   }
     * });
     * ```
     */
    registerValidator<T>(type: ComponentIdentifier<T>, validator: ComponentValidator<T>): void {
        this.validators.set(type, validator);
    }

    /**
     * Get the registered validator for a component type.
     *
     * @typeParam T - The component type
     * @param type - The component class/constructor
     * @returns The validator function if registered, undefined otherwise
     */
    getValidator<T>(type: ComponentIdentifier<T>): ComponentValidator<T> | undefined {
        return this.validators.get(type) as ComponentValidator<T>;
    }

    /**
     * Manually register a component type in the registry.
     *
     * This enables component lookup by name during deserialization.
     * Components are also auto-registered when accessed via getComponentArray.
     *
     * @typeParam T - The component type
     * @param type - The component class/constructor to register
     *
     * @example
     * ```typescript
     * componentManager.registerComponent(Position);
     * componentManager.registerComponent(Velocity);
     * ```
     */
    registerComponent<T>(type: ComponentIdentifier<T>): void {
        this.registry.set(type.name, type);
    }

    /**
     * Look up a component type by its class name.
     *
     * Useful during deserialization when you have the component name
     * as a string and need to get the actual class constructor.
     *
     * @param name - The component class name
     * @returns The component class/constructor if found, undefined otherwise
     *
     * @example
     * ```typescript
     * const PositionClass = componentManager.getComponentByName('Position');
     * if (PositionClass) {
     *   entity.addComponent(PositionClass, 0, 0);
     * }
     * ```
     */
    getComponentByName(name: string): ComponentIdentifier | undefined {
        return this.registry.get(name);
    }

    /**
     * Get all component arrays managed by this manager.
     *
     * Returns the internal map of component type to component array.
     * Primarily used for serialization and debugging.
     *
     * @returns Map of all component arrays keyed by component type
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getAllComponentArrays(): Map<ComponentIdentifier, ComponentArray<any>> {
        return this.componentArrays;
    }

    /**
     * Register a component pool for object reuse.
     *
     * Component pooling reduces garbage collection pressure by recycling
     * component instances instead of creating new ones. Pooled components
     * are reset to default state when released.
     *
     * @typeParam T - The component type (must be an object)
     * @param type - The component class/constructor to pool
     * @param options - Pool configuration options
     * @param options.initialSize - Number of instances to pre-allocate (default: 10)
     * @param options.maxSize - Maximum pool size (default: 1000)
     *
     * @example
     * ```typescript
     * // Register a pool for frequently created/destroyed components
     * componentManager.registerComponentPool(Bullet, {
     *   initialSize: 100,
     *   maxSize: 500
     * });
     * ```
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
     * Get a component instance from the pool if available, otherwise create new.
     *
     * If a pool is registered for this component type, an instance will be
     * acquired from the pool and initialized with the provided arguments.
     * Otherwise, a new instance is created directly.
     *
     * @typeParam T - The component type (must be an object)
     * @param type - The component class/constructor
     * @param args - Constructor arguments to initialize the component
     * @returns A component instance (either from pool or newly created)
     *
     * @example
     * ```typescript
     * // Acquire a pooled bullet component
     * const bullet = componentManager.acquireComponent(Bullet, 100, 200, 45);
     * entity.addComponentInstance(bullet);
     * ```
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
     * Release a component back to the pool for reuse.
     *
     * The component will be reset to its default state and made available
     * for future acquire calls. If no pool is registered for this type,
     * the component will be left for garbage collection.
     *
     * @typeParam T - The component type (must be an object)
     * @param type - The component class/constructor
     * @param component - The component instance to release
     *
     * @example
     * ```typescript
     * // Release a bullet back to the pool when it's destroyed
     * const bullet = entity.getComponent(Bullet);
     * componentManager.releaseComponent(Bullet, bullet);
     * entity.removeComponent(Bullet);
     * ```
     */
    releaseComponent<T extends object>(type: ComponentIdentifier<T>, component: T): void {
        const pool = this.componentPools.get(type);
        if (pool) {
            pool.release(component);
        }
        // If no pool, component will be garbage collected
    }

    /**
     * Get pool statistics for a component type.
     *
     * Returns usage statistics for monitoring pool efficiency, including
     * current size, items in use, and allocation metrics.
     *
     * @typeParam T - The component type (must be an object)
     * @param type - The component class/constructor
     * @returns Pool statistics if a pool exists, undefined otherwise
     *
     * @example
     * ```typescript
     * const stats = componentManager.getComponentPoolStats(Bullet);
     * if (stats) {
     *   console.log(`Pool size: ${stats.size}, In use: ${stats.inUse}`);
     * }
     * ```
     */
    getComponentPoolStats<T extends object>(type: ComponentIdentifier<T>): PoolStats | undefined {
        const pool = this.componentPools.get(type);
        return pool ? pool.stats : undefined;
    }

    /**
     * Check if a component type has a pool registered.
     *
     * @typeParam T - The component type (must be an object)
     * @param type - The component class/constructor
     * @returns true if a pool exists for this type, false otherwise
     *
     * @example
     * ```typescript
     * if (componentManager.hasComponentPool(Bullet)) {
     *   // Use pooled allocation
     *   const bullet = componentManager.acquireComponent(Bullet);
     * }
     * ```
     */
    hasComponentPool<T extends object>(type: ComponentIdentifier<T>): boolean {
        return this.componentPools.has(type);
    }

    /**
     * Get the pool for a specific component type.
     *
     * Type safety is enforced via the generic parameter constraint - the type
     * parameter T is bound to the ComponentIdentifier<T>, ensuring the returned
     * Pool<T> matches the requested component type.
     *
     * @typeParam T - The component type (must extend object)
     * @param type - The component class/constructor
     * @returns The Pool for this component type, or undefined if not registered
     *
     * @example
     * ```typescript
     * const pool = componentManager.getPool(Position);
     * if (pool) {
     *   const pos = pool.acquire();
     *   // Use pos, then release when done
     *   pool.release(pos);
     * }
     * ```
     */
    getPool<T extends object>(type: ComponentIdentifier<T>): Pool<T> | undefined {
        return this.componentPools.get(type) as Pool<T> | undefined;
    }

    /**
     * Enable archetype-based storage for improved performance.
     *
     * When enabled, entities are grouped by their component composition (archetype)
     * for better cache locality during iteration. This can provide 2-5x performance
     * improvements for systems that iterate over many entities.
     *
     * @remarks
     * This should be called before creating entities. Once enabled, archetypes
     * cannot be disabled without recreating the engine.
     *
     * @example
     * ```typescript
     * componentManager.enableArchetypes();
     * // Now entities with the same component composition share storage
     * ```
     */
    enableArchetypes(): void {
        if (!this.archetypesEnabled) {
            this.archetypeManager = new ArchetypeManager(undefined, this.logger);
            this.archetypesEnabled = true;
        }
    }

    /**
     * Check if archetypes are enabled.
     *
     * @returns true if archetype-based storage is active
     */
    areArchetypesEnabled(): boolean {
        return this.archetypesEnabled;
    }

    /**
     * Get the archetype manager (if archetypes are enabled).
     *
     * The archetype manager handles entity grouping by component composition
     * and provides efficient iteration over matching entities.
     *
     * @returns The archetype manager instance, or undefined if not enabled
     */
    getArchetypeManager(): ArchetypeManager | undefined {
        return this.archetypeManager;
    }

    // ========== Singleton Component Management ==========

    /**
     * Set a singleton component (global state that exists once per engine).
     *
     * Singletons are engine-wide components that don't belong to any specific entity.
     * They're useful for global state like game time, configuration, or shared resources.
     *
     * @typeParam T - The component type
     * @param type - The component class/constructor
     * @param component - The component instance to set
     * @returns The previous singleton instance if one existed, undefined otherwise
     *
     * @example
     * ```typescript
     * class GameTime { constructor(public elapsed = 0, public delta = 0) {} }
     * componentManager.setSingleton(GameTime, new GameTime(0, 16));
     * ```
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
     * Get a singleton component.
     *
     * @typeParam T - The component type
     * @param type - The component class/constructor
     * @returns The singleton instance, or undefined if not set
     *
     * @example
     * ```typescript
     * const time = componentManager.getSingleton(GameTime);
     * if (time) {
     *   console.log(`Game time: ${time.elapsed}ms`);
     * }
     * ```
     */
    getSingleton<T>(type: ComponentIdentifier<T>): T | undefined {
        return this.singletonComponents.get(type);
    }

    /**
     * Check if a singleton component exists.
     *
     * @typeParam T - The component type
     * @param type - The component class/constructor
     * @returns true if the singleton is set, false otherwise
     */
    hasSingleton<T>(type: ComponentIdentifier<T>): boolean {
        return this.singletonComponents.has(type);
    }

    /**
     * Remove a singleton component.
     *
     * @typeParam T - The component type
     * @param type - The component class/constructor
     * @returns The removed singleton instance, or undefined if it didn't exist
     */
    removeSingleton<T>(type: ComponentIdentifier<T>): T | undefined {
        const component = this.singletonComponents.get(type);
        this.singletonComponents.delete(type);
        return component;
    }

    /**
     * Get all singleton components.
     *
     * Returns a copy of the singleton map for iteration or debugging.
     *
     * @returns A new Map containing all singleton components
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getAllSingletons(): Map<ComponentIdentifier, any> {
        return new Map(this.singletonComponents);
    }

    /**
     * Clear all singleton components.
     *
     * Removes all registered singletons from the manager.
     */
    clearAllSingletons(): void {
        this.singletonComponents.clear();
    }
}

/**
 * Manages system registration, execution, and profiling.
 *
 * The SystemManager handles the lifecycle of systems including registration,
 * priority-based ordering, dependency resolution, and execution. It supports
 * both variable timestep and fixed timestep systems for different use cases.
 *
 * @remarks
 * Internal arrays use AnySystemTuple for heterogeneous system storage,
 * providing better type safety than 'any' while allowing systems with different
 * component requirements.
 *
 * @example
 * ```typescript
 * const systemManager = new SystemManager(60, 10); // 60 FPS fixed, max 10 iterations
 *
 * // Create a group for physics systems
 * const physicsGroup = systemManager.createGroup('Physics', 100);
 *
 * // Register systems
 * systemManager.createSystem(movementSystem);
 * systemManager.createSystem(physicsSystem, true); // Fixed update
 * ```
 */
export class SystemManager {
    // System arrays store heterogeneous component type tuples using the AnySystemTuple constraint.
    private systems: System<AnySystemTuple>[] = [];
    private fixedUpdateSystems: System<AnySystemTuple>[] = [];
    private systemsSorted: boolean = true;
    private fixedSystemsSorted: boolean = true;
    private fixedUpdateAccumulator: number = 0;
    private fixedUpdateInterval: number;
    private maxFixedIterations: number;
    private groups: Map<string, SystemGroup> = new Map();
    // Cache for sorted groups to avoid allocations in hot path
    private sortedGroupsCache: SystemGroup[] | null = null;
    private groupsCacheValid: boolean = false;
    // Cache for sorted group systems to reduce GC pressure in hot path
    private groupVariableSystemsCache: Map<string, System<AnySystemTuple>[]> = new Map();
    private groupFixedSystemsCache: Map<string, System<AnySystemTuple>[]> = new Map();
    private groupSystemsCacheValid: boolean = false;
    // Error recovery manager for system error isolation
    private errorRecoveryManager?: ErrorRecoveryManager;
    // Whether error recovery is enabled
    private errorRecoveryEnabled: boolean = false;

    constructor(fixedUpdateFPS: number = 60, maxFixedIterations: number = 10) {
        this.fixedUpdateInterval = 1000 / fixedUpdateFPS;
        this.maxFixedIterations = maxFixedIterations;
    }

    /**
     * Set the error recovery manager for system error isolation.
     *
     * When set, system errors will be caught and handled according to the
     * configured recovery strategy instead of crashing the engine.
     *
     * @param manager - The error recovery manager instance
     */
    setErrorRecoveryManager(manager: ErrorRecoveryManager): void {
        this.errorRecoveryManager = manager;
        this.errorRecoveryEnabled = true;
    }

    /**
     * Enable or disable error recovery for system execution.
     *
     * @param enabled - Whether to enable error recovery
     */
    setErrorRecoveryEnabled(enabled: boolean): void {
        this.errorRecoveryEnabled = enabled;
    }

    /**
     * Check if error recovery is enabled.
     *
     * @returns true if error recovery is active
     */
    isErrorRecoveryEnabled(): boolean {
        return this.errorRecoveryEnabled && this.errorRecoveryManager !== undefined;
    }

    /**
     * Create a system group for organizing systems into execution phases.
     *
     * Groups allow you to organize related systems and control their execution
     * order via priority. All systems in a group execute together before or after
     * other groups based on the group's priority. Higher priority groups execute first.
     *
     * @param name - Unique identifier for the group
     * @param priority - Execution priority (higher = earlier execution)
     * @returns The created system group
     * @throws Error if a group with this name already exists
     *
     * @example
     * ```typescript
     * // Create groups for different game phases
     * const inputGroup = systemManager.createGroup('Input', 1000);
     * const physicsGroup = systemManager.createGroup('Physics', 100);
     * const renderGroup = systemManager.createGroup('Render', 10);
     *
     * // Systems in 'Input' group run first, then 'Physics', then 'Render'
     * ```
     */
    createGroup(name: string, priority: number): SystemGroup {
        if (this.groups.has(name)) {
            throw new Error(`[ECS] System group '${name}' already exists`);
        }
        const group = new SystemGroup(name, priority);
        this.groups.set(name, group);
        this.groupsCacheValid = false; // Invalidate sorted groups cache
        return group;
    }

    /**
     * Register a system for execution.
     *
     * Systems are automatically sorted by priority and dependency constraints.
     * If the system specifies a group, it will be added to that group.
     *
     * @typeParam C - Tuple type of component types the system queries
     * @param system - The system instance to register
     * @param isFixedUpdate - If true, system runs on fixed timestep (default: false)
     * @param errorConfig - Optional error handling configuration for this system
     * @returns The registered system
     * @throws Error if the system references a group that doesn't exist
     *
     * @example
     * ```typescript
     * // Create and register a movement system
     * const movementSystem = new System('Movement', { all: [Position, Velocity] }, {
     *   priority: 50,
     *   act: (entity, pos, vel) => {
     *     pos.x += vel.x;
     *     pos.y += vel.y;
     *   }
     * });
     * systemManager.createSystem(movementSystem);
     *
     * // Register a physics system for fixed timestep
     * systemManager.createSystem(physicsSystem, true);
     * ```
     */
    createSystem<C extends readonly unknown[] = unknown[]>(
        system: System<C>,
        isFixedUpdate: boolean = false,
        errorConfig?: SystemErrorConfig
    ): System<C> {
        // If system has a group, add it to that group
        if (system.group) {
            const group = this.groups.get(system.group);
            if (!group) {
                throw new Error(
                    `System group '${system.group}' not found. Create it first with createSystemGroup().`
                );
            }
            // Type assertion required due to TypeScript variance rules with function parameters.
            // The System's act callback is contravariant, preventing direct assignment.
            group.systems.push(system as System<AnySystemTuple>);
        }

        // Type assertions below are required due to TypeScript variance rules.
        // Systems with specific component tuples are safely stored in heterogeneous arrays.
        if (isFixedUpdate) {
            this.fixedUpdateSystems.push(system as System<AnySystemTuple>);
            this.fixedSystemsSorted = false;
        } else {
            this.systems.push(system as System<AnySystemTuple>);
            this.systemsSorted = false;
        }

        // Register with error recovery manager if enabled
        if (this.errorRecoveryManager) {
            this.errorRecoveryManager.registerSystem(system.name, errorConfig);
        }

        // Invalidate group systems cache when systems change
        this.groupSystemsCacheValid = false;
        return system;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private topologicalSort(systems: System<AnySystemTuple>[]): System<AnySystemTuple>[] {
        // Build system name to system map
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const systemMap = new Map<string, System<AnySystemTuple>>();
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: System<AnySystemTuple>[] = [];

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
            throw new Error(`[ECS] Circular dependency detected in systems: ${cycleNames}`);
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const noDeps: System<AnySystemTuple>[] = [];
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
                        return noDeps[noDepsIndex++]!;
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
        // Group systems cache will be validated on first access after sorting
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

    /**
     * Execute all variable timestep systems.
     *
     * Systems are executed in order: first by group priority, then by
     * individual system priority within groups. Ungrouped systems run last.
     *
     * @param deltaTime - Time elapsed since last frame in milliseconds (default: 16)
     *
     * @example
     * ```typescript
     * // In game loop
     * const deltaTime = performance.now() - lastFrameTime;
     * systemManager.executeVariableSystems(deltaTime);
     * ```
     */
    executeVariableSystems(deltaTime: number = 16): void {
        this.ensureSorted();

        // First, execute systems in groups (sorted by group priority)
        const sortedGroups = this.getSortedGroups();

        for (const group of sortedGroups) {
            if (!group.enabled) continue;

            // Execute systems in this group that are variable update systems (sorted by system priority)
            // Use cached sorted arrays to reduce GC pressure in hot path
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let groupSystems: System<AnySystemTuple>[];
            if (this.groupSystemsCacheValid && this.groupVariableSystemsCache.has(group.name)) {
                groupSystems = this.groupVariableSystemsCache.get(group.name)!;
            } else {
                groupSystems = group.systems
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .filter((s: System<AnySystemTuple>) => this.systems.includes(s))
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .sort(
                        (a: System<AnySystemTuple>, b: System<AnySystemTuple>) =>
                            b.priority - a.priority
                    );
                this.groupVariableSystemsCache.set(group.name, groupSystems);
            }

            for (const system of groupSystems) {
                this.executeSystemWithRecovery(system, deltaTime);
            }
        }

        // Mark group systems cache as valid after first full iteration
        if (!this.groupSystemsCacheValid) {
            this.groupSystemsCacheValid = true;
        }

        // Then, execute systems without a group
        for (const system of this.systems) {
            if (!system.group) {
                this.executeSystemWithRecovery(system, deltaTime);
            }
        }
    }

    /**
     * Execute a single system with error recovery if enabled.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private executeSystemWithRecovery(system: System<AnySystemTuple>, deltaTime: number): void {
        if (this.errorRecoveryEnabled && this.errorRecoveryManager) {
            // Check if the system is healthy enough to execute
            if (!this.errorRecoveryManager.isSystemHealthy(system.name)) {
                return;
            }

            this.errorRecoveryManager.executeWithRecovery(
                system.name,
                () => system.step(deltaTime),
                deltaTime
            );
        } else {
            // No error recovery - execute directly
            system.step(deltaTime);
        }
    }

    /**
     * Execute all fixed timestep systems.
     *
     * Fixed systems run at a consistent interval regardless of frame rate,
     * making them ideal for physics simulations. The accumulator pattern ensures
     * deterministic behavior. Includes "spiral of death" protection to prevent
     * runaway iterations when the game falls too far behind.
     *
     * @param deltaTime - Time elapsed since last frame in milliseconds
     * @param debugMode - If true, logs warnings about spiral of death (default: false)
     *
     * @example
     * ```typescript
     * // In game loop
     * const deltaTime = performance.now() - lastFrameTime;
     * systemManager.executeFixedSystems(deltaTime, engine.debugMode);
     * ```
     */
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
                // Use cached sorted arrays to reduce GC pressure in hot path
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let groupSystems: System<AnySystemTuple>[];
                if (this.groupSystemsCacheValid && this.groupFixedSystemsCache.has(group.name)) {
                    groupSystems = this.groupFixedSystemsCache.get(group.name)!;
                } else {
                    groupSystems = group.systems
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .filter((s: System<AnySystemTuple>) => this.fixedUpdateSystems.includes(s))
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .sort(
                            (a: System<AnySystemTuple>, b: System<AnySystemTuple>) =>
                                b.priority - a.priority
                        );
                    this.groupFixedSystemsCache.set(group.name, groupSystems);
                }

                for (const system of groupSystems) {
                    this.executeSystemWithRecovery(system, this.fixedUpdateInterval);
                }
            }

            // Then, execute systems without a group
            for (const system of this.fixedUpdateSystems) {
                if (!system.group) {
                    this.executeSystemWithRecovery(system, this.fixedUpdateInterval);
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

    /**
     * Enable a system group for execution.
     *
     * When a group is enabled, all systems in that group will be executed
     * during the update loop.
     *
     * @param name - The name of the group to enable
     * @throws Error if the group doesn't exist
     *
     * @example
     * ```typescript
     * // Re-enable physics after a pause
     * systemManager.enableGroup('Physics');
     * ```
     */
    enableGroup(name: string): void {
        const group = this.groups.get(name);
        if (!group) {
            throw new Error(`[ECS] System group '${name}' not found`);
        }
        group.enabled = true;
    }

    /**
     * Disable a system group from execution.
     *
     * When a group is disabled, none of its systems will execute during
     * the update loop. Useful for pausing game features.
     *
     * @param name - The name of the group to disable
     * @throws Error if the group doesn't exist
     *
     * @example
     * ```typescript
     * // Disable physics during pause menu
     * systemManager.disableGroup('Physics');
     * ```
     */
    disableGroup(name: string): void {
        const group = this.groups.get(name);
        if (!group) {
            throw new Error(`[ECS] System group '${name}' not found`);
        }
        group.enabled = false;
    }

    /**
     * Get a system group by name.
     *
     * @param name - The name of the group to retrieve
     * @returns The system group if found, undefined otherwise
     */
    getGroup(name: string): SystemGroup | undefined {
        return this.groups.get(name);
    }

    /**
     * Get all registered system groups.
     *
     * @returns Array of all system groups
     */
    getAllGroups(): SystemGroup[] {
        return Array.from(this.groups.values());
    }

    /**
     * Get all registered systems (both variable and fixed timestep).
     *
     * @returns Array containing all systems
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getAllSystems(): System<AnySystemTuple>[] {
        return [...this.systems, ...this.fixedUpdateSystems];
    }

    /**
     * Get performance profiles for all systems.
     *
     * Profiles contain timing information useful for debugging
     * and optimizing system performance.
     *
     * @returns Array of system profiles with timing data
     *
     * @example
     * ```typescript
     * const profiles = systemManager.getProfiles();
     * for (const profile of profiles) {
     *   console.log(`${profile.name}: ${profile.avgTime.toFixed(2)}ms avg`);
     * }
     * ```
     */
    getProfiles(): SystemProfile[] {
        return this.getAllSystems().map((system) => system.profile);
    }

    /**
     * Get a system by name.
     *
     * Searches both variable and fixed timestep systems.
     *
     * @param name - The name of the system to find
     * @returns The system if found, undefined otherwise
     *
     * @example
     * ```typescript
     * const movementSystem = systemManager.getSystem('Movement');
     * if (movementSystem) {
     *   console.log(`Movement system priority: ${movementSystem.priority}`);
     * }
     * ```
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSystem(name: string): System<AnySystemTuple> | undefined {
        return (
            this.systems.find((s) => s.name === name) ||
            this.fixedUpdateSystems.find((s) => s.name === name)
        );
    }

    /**
     * Remove a system from the manager and clean up its resources.
     *
     * This will call the system's destroy() method to unsubscribe from events
     * and remove it from any assigned group.
     *
     * @param name - The name of the system to remove
     * @returns true if the system was found and removed, false otherwise
     *
     * @example
     * ```typescript
     * // Remove a system when no longer needed
     * if (systemManager.removeSystem('DebugOverlay')) {
     *   console.log('Debug overlay removed');
     * }
     * ```
     */
    removeSystem(name: string): boolean {
        // Find and remove from variable update systems
        const variableIndex = this.systems.findIndex((s) => s.name === name);
        if (variableIndex !== -1) {
            const system = this.systems[variableIndex]!;

            // Remove from group if assigned
            if (system.group) {
                const group = this.groups.get(system.group);
                if (group) {
                    const groupIndex = group.systems.findIndex(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (s: System<AnySystemTuple>) => s.name === name
                    );
                    if (groupIndex !== -1) {
                        group.systems.splice(groupIndex, 1);
                    }
                }
            }

            // Unregister from error recovery manager
            this.errorRecoveryManager?.unregisterSystem(name);

            // Destroy system (cleanup event listeners)
            system.destroy();

            // Remove from array
            this.systems.splice(variableIndex, 1);
            this.systemsSorted = false;
            // Invalidate group systems cache when systems change
            this.groupSystemsCacheValid = false;
            return true;
        }

        // Find and remove from fixed update systems
        const fixedIndex = this.fixedUpdateSystems.findIndex((s) => s.name === name);
        if (fixedIndex !== -1) {
            const system = this.fixedUpdateSystems[fixedIndex]!;

            // Remove from group if assigned
            if (system.group) {
                const group = this.groups.get(system.group);
                if (group) {
                    const groupIndex = group.systems.findIndex(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (s: System<AnySystemTuple>) => s.name === name
                    );
                    if (groupIndex !== -1) {
                        group.systems.splice(groupIndex, 1);
                    }
                }
            }

            // Unregister from error recovery manager
            this.errorRecoveryManager?.unregisterSystem(name);

            // Destroy system (cleanup event listeners)
            system.destroy();

            // Remove from array
            this.fixedUpdateSystems.splice(fixedIndex, 1);
            this.fixedSystemsSorted = false;
            // Invalidate group systems cache when systems change
            this.groupSystemsCacheValid = false;
            return true;
        }

        return false;
    }

    /**
     * Remove all systems and clean up their resources.
     *
     * Destroys all systems (calling their destroy() method), clears all groups,
     * and invalidates system caches. Use when shutting down the engine or
     * completely resetting the game state.
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

        // Invalidate and clear group systems caches
        this.groupSystemsCacheValid = false;
        this.groupVariableSystemsCache.clear();
        this.groupFixedSystemsCache.clear();
    }
}

/**
 * Manages query creation and tracking.
 *
 * The QueryManager creates and maintains queries that efficiently find entities
 * matching specific component requirements. Queries are cached and automatically
 * updated when entity components change.
 *
 * @remarks
 * Internal arrays use 'any' for heterogeneous query storage due to TypeScript's
 * variance rules with readonly component type tuples.
 *
 * @example
 * ```typescript
 * const query = queryManager.createQuery({
 *   all: [Position, Velocity],
 *   any: [Player, Enemy],
 *   not: [Dead]
 * });
 *
 * // Later, iterate matching entities
 * for (const entity of query.entities) {
 *   // Process entity
 * }
 * ```
 */
export class QueryManager {
    // Using 'any' for internal storage due to TypeScript's variance rules with readonly types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private queries: Query<any>[] = [];
    private componentManager?: ComponentManager;

    /**
     * Set the component manager reference for archetype support.
     *
     * When a component manager with archetypes is set, queries will use
     * archetype-based matching for improved performance.
     *
     * @param componentManager - The component manager instance
     */
    setComponentManager(componentManager: ComponentManager): void {
        this.componentManager = componentManager;
    }

    /**
     * Create a new query for finding entities with specific components.
     *
     * Queries support three component filters:
     * - `all`: Entity must have ALL of these components
     * - `any`: Entity must have AT LEAST ONE of these components
     * - `not`: Entity must NOT have any of these components
     *
     * @typeParam C - Tuple type of component types from the 'all' filter
     * @param options - Query options specifying component requirements
     * @returns A new Query instance that tracks matching entities
     *
     * @example
     * ```typescript
     * // Find all entities with Position AND Velocity, but not Dead
     * const query = queryManager.createQuery({
     *   all: [Position, Velocity],
     *   not: [Dead]
     * });
     * ```
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createQuery<C extends readonly any[] = any[]>(options: QueryOptions<any>): Query<C> {
        const archetypeManager = this.componentManager?.getArchetypeManager();
        const query = new Query<C>(options, archetypeManager);
        this.queries.push(query);
        return query;
    }

    /**
     * Update all queries to re-evaluate a specific entity.
     *
     * Called automatically when an entity's components change to ensure
     * all queries reflect the current state.
     *
     * @param entity - The entity to re-evaluate against all queries
     */
    updateQueries(entity: Entity): void {
        for (const query of this.queries) {
            query.match(entity);
        }
    }

    /**
     * Signal that all queries should be updated.
     *
     * Used primarily for transaction commits to batch query updates.
     * The actual update logic is handled per-entity via updateQueries.
     */
    updateAllQueries(): void {
        // This method is intentionally empty as updateQueries is called per entity
        // It's here for semantic clarity in transaction commits
    }

    /**
     * Get all registered queries.
     *
     * @returns Array of all Query instances managed by this manager
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getAllQueries(): Query<any>[] {
        return this.queries;
    }
}

/**
 * Manages prefab registration and instantiation.
 *
 * Prefabs are reusable entity templates that define a set of components and tags.
 * They can be extended, customized with variants, and instantiated multiple times.
 *
 * @example
 * ```typescript
 * // Register a prefab
 * prefabManager.register('Enemy', {
 *   name: 'Enemy',
 *   components: [
 *     { type: Position, args: [0, 0] },
 *     { type: Health, args: [100] }
 *   ],
 *   tags: ['enemy', 'hostile']
 * });
 *
 * // Create a stronger variant
 * const boss = prefabManager.extend('Enemy', {
 *   components: [{ type: Health, args: [500] }],
 *   tags: ['boss']
 * });
 * ```
 */
export class PrefabManager {
    private prefabs: Map<string, EntityPrefab> = new Map();

    /**
     * Register a prefab for later instantiation.
     *
     * @param name - Unique identifier for the prefab
     * @param prefab - The prefab definition containing components and tags
     *
     * @example
     * ```typescript
     * prefabManager.register('Player', {
     *   name: 'Player',
     *   components: [
     *     { type: Position, args: [0, 0] },
     *     { type: Velocity, args: [0, 0] }
     *   ],
     *   tags: ['player']
     * });
     * ```
     */
    register(name: string, prefab: EntityPrefab): void {
        this.prefabs.set(name, prefab);
    }

    /**
     * Get a prefab by name.
     *
     * @param name - The prefab name to look up
     * @returns The prefab definition if found, undefined otherwise
     */
    get(name: string): EntityPrefab | undefined {
        return this.prefabs.get(name);
    }

    /**
     * Check if a prefab exists.
     *
     * @param name - The prefab name to check
     * @returns true if the prefab is registered
     */
    has(name: string): boolean {
        return this.prefabs.has(name);
    }

    /**
     * Get all registered prefabs.
     *
     * @returns A new Map containing all prefab definitions
     */
    getAllPrefabs(): Map<string, EntityPrefab> {
        return new Map(this.prefabs);
    }

    /**
     * Extend a base prefab with additional components and tags.
     *
     * Creates a new prefab definition that inherits from the base and adds
     * the specified overrides. The original prefab is not modified.
     *
     * @param baseName - Name of the base prefab to extend
     * @param overrides - Additional components, tags, or children to add
     * @returns Extended prefab definition
     * @throws Error if the base prefab doesn't exist
     *
     * @example
     * ```typescript
     * // Create a boss enemy by extending the base enemy
     * const bossPrefab = prefabManager.extend('Enemy', {
     *   name: 'Boss',
     *   components: [{ type: BossAI, args: [] }],
     *   tags: ['boss']
     * });
     * ```
     */
    extend(baseName: string, overrides: Partial<EntityPrefab>): EntityPrefab {
        const base = this.prefabs.get(baseName);
        if (!base) {
            throw new Error(`[ECS] Base prefab '${baseName}' not found`);
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

            extended.factory = (...args: unknown[]) => {
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
     * Create a variant of a prefab with component value overrides.
     *
     * Unlike extend(), which adds new components, createVariant() modifies
     * the arguments of existing components. This is useful for creating
     * variations like "fast enemy" or "armored enemy" with different stats.
     *
     * @param baseName - Name of the base prefab
     * @param overrides - Component values to override, tags to add, or children
     * @param overrides.components - Map of component name to new arguments
     * @param overrides.tags - Additional tags to add
     * @param overrides.children - Additional child prefabs to add
     * @returns Variant prefab definition
     * @throws Error if the base prefab doesn't exist
     *
     * @example
     * ```typescript
     * // Create a fast enemy variant with higher speed
     * const fastEnemy = prefabManager.createVariant('Enemy', {
     *   components: { Velocity: [5, 0] },
     *   tags: ['fast']
     * });
     * ```
     */
    createVariant(
        baseName: string,
        overrides: {
            components?: Record<string, unknown>;
            tags?: string[];
            children?: EntityPrefab[];
        }
    ): EntityPrefab {
        const base = this.prefabs.get(baseName);
        if (!base) {
            throw new Error(`[ECS] Base prefab '${baseName}' not found`);
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
     * Resolve a prefab, applying factory function if present.
     *
     * If the prefab has a factory function, it will be called with the provided
     * arguments to generate the prefab dynamically. This allows for prefabs
     * with runtime-computed values.
     *
     * @param name - Prefab name
     * @param args - Arguments to pass to factory function (if applicable)
     * @returns Resolved prefab instance, or undefined if not found
     *
     * @example
     * ```typescript
     * // Register a factory prefab
     * prefabManager.register('Bullet', {
     *   name: 'Bullet',
     *   components: [],
     *   tags: ['bullet'],
     *   factory: (x: number, y: number, angle: number) => ({
     *     name: 'Bullet',
     *     components: [
     *       { type: Position, args: [x, y] },
     *       { type: Velocity, args: [Math.cos(angle) * 10, Math.sin(angle) * 10] }
     *     ],
     *     tags: ['bullet']
     *   })
     * });
     *
     * // Resolve with arguments
     * const bulletPrefab = prefabManager.resolve('Bullet', 100, 200, Math.PI / 4);
     * ```
     */
    resolve(name: string, ...args: unknown[]): EntityPrefab | undefined {
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
 * Manages world snapshots and restoration.
 *
 * The SnapshotManager stores serialized world states that can be used for
 * save/load functionality, undo/redo, or debugging. It maintains a fixed-size
 * history with automatic cleanup of old snapshots.
 *
 * @example
 * ```typescript
 * const snapshotManager = new SnapshotManager(5); // Keep last 5 snapshots
 *
 * // Save current state
 * const worldState = engine.serialize();
 * snapshotManager.createSnapshot(worldState);
 *
 * // Restore last state
 * const lastSnapshot = snapshotManager.getSnapshot();
 * if (lastSnapshot) {
 *   engine.deserialize(lastSnapshot);
 * }
 * ```
 */
export class SnapshotManager {
    private snapshots: SerializedWorld[] = [];
    private maxSnapshots: number;

    /**
     * Create a new SnapshotManager.
     *
     * @param maxSnapshots - Maximum number of snapshots to keep (default: 10)
     */
    constructor(maxSnapshots: number = MAX_SNAPSHOTS) {
        this.maxSnapshots = maxSnapshots;
    }

    /**
     * Store a world snapshot.
     *
     * If the maximum number of snapshots is exceeded, the oldest snapshot
     * will be removed automatically.
     *
     * @param world - The serialized world state to store
     */
    createSnapshot(world: SerializedWorld): void {
        this.snapshots.push(world);
        while (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }
    }

    /**
     * Get a snapshot by index.
     *
     * @param index - Snapshot index (0 = oldest, -1 = most recent, default: -1)
     * @returns The snapshot if found, undefined otherwise
     *
     * @example
     * ```typescript
     * // Get most recent snapshot
     * const latest = snapshotManager.getSnapshot();
     *
     * // Get second-to-last snapshot
     * const previous = snapshotManager.getSnapshot(snapshotManager.getSnapshotCount() - 2);
     * ```
     */
    getSnapshot(index: number = -1): SerializedWorld | undefined {
        if (index === -1) {
            return this.snapshots[this.snapshots.length - 1];
        }
        return this.snapshots[index];
    }

    /**
     * Get the number of stored snapshots.
     *
     * @returns The current snapshot count
     */
    getSnapshotCount(): number {
        return this.snapshots.length;
    }

    /**
     * Clear all stored snapshots.
     */
    clearSnapshots(): void {
        this.snapshots = [];
    }
}

/**
 * Manages inter-system messaging.
 *
 * The MessageManager provides a pub/sub mechanism for systems to communicate
 * without direct dependencies. Messages are typed by string keys and can carry
 * arbitrary data payloads. The manager also maintains a message history for
 * debugging and late subscribers.
 *
 * @example
 * ```typescript
 * const messageManager = new MessageManager(100); // Keep 100 messages in history
 *
 * // Subscribe to damage events
 * const unsubscribe = messageManager.subscribe('damage', (msg) => {
 *   console.log(`${msg.sender} dealt ${msg.data.amount} damage`);
 * });
 *
 * // Publish a damage event
 * messageManager.publish('damage', { amount: 50, target: enemyId }, 'CombatSystem');
 *
 * // Later, unsubscribe
 * unsubscribe();
 * ```
 */
export class MessageManager {
    private bus: MessageBus;

    /**
     * Create a new MessageManager.
     *
     * @param maxHistory - Maximum number of messages to keep in history (default: 1000)
     * @param logger - Optional logger for message bus operations
     */
    constructor(maxHistory: number = MAX_MESSAGE_HISTORY, logger?: Logger) {
        this.bus = new MessageBus(maxHistory, logger);
    }

    /**
     * Subscribe to a message type.
     *
     * The callback will be called whenever a message of this type is published.
     *
     * @param messageType - The message type to subscribe to
     * @param callback - Function called when a matching message is published
     * @returns Unsubscribe function - call to stop receiving messages
     *
     * @example
     * ```typescript
     * const unsubscribe = messageManager.subscribe('playerDied', (msg) => {
     *   showGameOverScreen();
     * });
     * ```
     */
    subscribe(messageType: string, callback: (message: SystemMessage) => void): () => void {
        return this.bus.subscribe(messageType, callback);
    }

    /**
     * Publish a message to all subscribers.
     *
     * @param messageType - The message type identifier
     * @param data - The message payload (any data)
     * @param sender - Optional sender identifier for debugging
     *
     * @example
     * ```typescript
     * // Notify systems of a collision
     * messageManager.publish('collision', {
     *   entityA: player.id,
     *   entityB: enemy.id,
     *   point: { x: 100, y: 200 }
     * }, 'PhysicsSystem');
     * ```
     */
    publish(messageType: string, data: unknown, sender?: string): void {
        this.bus.publish(messageType, data, sender);
    }

    /**
     * Get message history for debugging or late subscribers.
     *
     * @param messageType - Optional filter by message type
     * @returns Array of messages (all messages if no type specified)
     */
    getHistory(messageType?: string): SystemMessage[] {
        return this.bus.getMessageHistory(messageType);
    }

    /**
     * Clear all subscriptions and message history.
     *
     * Called when the MessageManager is being disposed. After calling clear(),
     * no more messages will be delivered to existing subscribers.
     */
    clear(): void {
        this.bus.clear();
    }
}

/**
 * Options for configuring the ChangeTrackingManager.
 * @internal
 */
interface ChangeTrackingOptions {
    /** Enable automatic proxy-based change tracking for components */
    enableProxyTracking?: boolean;
    /** Enable batch mode (suspends events until flush) */
    batchMode?: boolean;
    /** Debounce time in milliseconds for change events (0 = no debounce) */
    debounceMs?: number;
}

/**
 * Manages component change tracking and events
 */
export class ChangeTrackingManager {
    private componentManager: ComponentManager;
    private eventEmitter: EventEmitter;
    private batchMode: boolean = false;
    private proxyTrackingEnabled: boolean = false;
    private reactiveComponents: WeakMap<object, object> = new WeakMap();
    private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private debounceMs: number = 0;
    // Track dirty components per entity (for archetype mode)
    private dirtyComponentsMap: Map<number, Set<ComponentIdentifier>> = new Map();

    constructor(
        componentManager: ComponentManager,
        eventEmitter: EventEmitter,
        options: ChangeTrackingOptions = {}
    ) {
        this.componentManager = componentManager;
        this.eventEmitter = eventEmitter;
        this.proxyTrackingEnabled = options.enableProxyTracking ?? false;
        this.batchMode = options.batchMode ?? false;
        this.debounceMs = options.debounceMs ?? 0;
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
    private emitComponentChanged(entity: Entity, componentType: ComponentIdentifier): void {
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
        entity: Entity,
        componentType: ComponentIdentifier<T>
    ): T {
        if (!this.proxyTrackingEnabled) {
            return component;
        }

        // Check if already proxied
        if (this.reactiveComponents.has(component)) {
            return this.reactiveComponents.get(component) as T;
        }

        const proxy = new Proxy(component, {
            set: (target: T, property: string | symbol, value: unknown): boolean => {
                const oldValue = (target as Record<string | symbol, unknown>)[property];
                (target as Record<string | symbol, unknown>)[property] = value;

                // Mark as dirty and emit change event
                if (oldValue !== value) {
                    this.markComponentDirty(entity, componentType);

                    // Call onChanged lifecycle hook if it exists
                    if (
                        'onChanged' in target &&
                        typeof (target as { onChanged?: () => void }).onChanged === 'function'
                    ) {
                        (target as { onChanged: () => void }).onChanged();
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

// ========== Error Recovery Constants ==========
const DEFAULT_ERROR_RECOVERY_CONFIG: ErrorRecoveryConfig = {
    defaultStrategy: 'skip',
    maxRetries: 3,
    retryBaseDelay: 100,
    retryMaxDelay: 5000,
    circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
        successThreshold: 3,
    },
    collectErrors: true,
    maxErrorHistory: 100,
};

/**
 * Internal state for tracking system health and circuit breaker status.
 */
interface SystemHealthState {
    systemName: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
    circuitBreakerState: CircuitBreakerState;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    totalErrors: number;
    lastError?: SystemError;
    lastSuccessTime?: number;
    lastErrorTime?: number;
    circuitOpenedAt?: number;
    retryCount: number;
    config: SystemErrorConfig;
}

/**
 * Manages error recovery, circuit breakers, and health monitoring for systems.
 *
 * The ErrorRecoveryManager provides:
 * - System error isolation (errors don't crash the engine)
 * - Multiple recovery strategies (skip, retry, disable, fallback)
 * - Circuit breaker pattern to prevent cascading failures
 * - Health monitoring and reporting
 * - Production error collection hooks
 *
 * @example
 * ```typescript
 * const engine = new EngineBuilder()
 *   .withErrorRecovery({
 *     defaultStrategy: 'skip',
 *     circuitBreaker: {
 *       failureThreshold: 3,
 *       resetTimeout: 10000,
 *     },
 *     onError: (error) => {
 *       // Send to error tracking service
 *       Sentry.captureException(error.error);
 *     }
 *   })
 *   .build();
 * ```
 *
 * @public
 */
export class ErrorRecoveryManager {
    private config: ErrorRecoveryConfig;
    private systemHealth: Map<string, SystemHealthState> = new Map();
    private errorHistory: SystemError[] = [];
    private sessionStartTime: number = Date.now();
    private errorIdCounter: number = 0;
    private engineHealthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    private eventEmitter?: EventEmitter;
    private debugMode: boolean = false;

    constructor(config: Partial<ErrorRecoveryConfig> = {}, eventEmitter?: EventEmitter) {
        this.config = {
            ...DEFAULT_ERROR_RECOVERY_CONFIG,
            ...config,
            circuitBreaker: {
                ...DEFAULT_ERROR_RECOVERY_CONFIG.circuitBreaker,
                ...config.circuitBreaker,
            },
        };
        this.eventEmitter = eventEmitter;
    }

    /**
     * Set debug mode for enhanced logging.
     */
    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }

    /**
     * Register a system for health tracking.
     */
    registerSystem(systemName: string, config: SystemErrorConfig = {}): void {
        if (!this.systemHealth.has(systemName)) {
            this.systemHealth.set(systemName, {
                systemName,
                status: 'healthy',
                circuitBreakerState: 'closed',
                consecutiveFailures: 0,
                consecutiveSuccesses: 0,
                totalErrors: 0,
                retryCount: 0,
                config: {
                    strategy: config.strategy ?? this.config.defaultStrategy,
                    critical: config.critical ?? false,
                    circuitBreaker: config.circuitBreaker,
                    fallback: config.fallback,
                    onError: config.onError,
                },
            });
        }
    }

    /**
     * Unregister a system from health tracking.
     */
    unregisterSystem(systemName: string): void {
        this.systemHealth.delete(systemName);
    }

    /**
     * Execute a system with error isolation and recovery.
     *
     * @param systemName - Name of the system
     * @param execute - Function that executes the system
     * @param deltaTime - Delta time for fallback execution
     * @returns true if execution succeeded, false if it failed
     */
    executeWithRecovery(systemName: string, execute: () => void, deltaTime: number): boolean {
        // Ensure system is registered
        if (!this.systemHealth.has(systemName)) {
            this.registerSystem(systemName);
        }

        // Check circuit breaker state
        if (!this.shouldExecute(systemName)) {
            if (this.debugMode) {
                console.log(`[ECS Debug] System "${systemName}" skipped: circuit breaker open`);
            }
            // Execute fallback if available
            this.executeFallback(systemName, deltaTime);
            return false;
        }

        try {
            execute();
            this.recordSuccess(systemName);
            return true;
        } catch (error) {
            return this.handleError(systemName, error, execute, deltaTime);
        }
    }

    /**
     * Check if a system should execute based on circuit breaker state.
     */
    private shouldExecute(systemName: string): boolean {
        const healthState = this.systemHealth.get(systemName);
        if (!healthState) return true;

        const cbState = healthState.circuitBreakerState;

        if (cbState === 'closed') {
            return true;
        }

        if (cbState === 'open') {
            const cbConfig = this.getCircuitBreakerConfig(systemName);
            const timeSinceOpen = Date.now() - (healthState.circuitOpenedAt || 0);

            if (timeSinceOpen >= cbConfig.resetTimeout) {
                // Transition to half-open
                this.setCircuitBreakerState(systemName, 'half-open');
                return true;
            }
            return false;
        }

        // half-open: allow execution to test if system has recovered
        return true;
    }

    /**
     * Handle an error from system execution.
     */
    private handleError(
        systemName: string,
        error: unknown,
        execute: () => void,
        deltaTime: number
    ): boolean {
        const healthState = this.systemHealth.get(systemName)!;
        const systemError = this.createSystemError(systemName, error, healthState);

        // Record the failure
        this.recordFailure(systemName, systemError);

        // Execute custom error handler
        healthState.config.onError?.(systemError);
        this.config.onError?.(systemError);

        // Apply recovery strategy
        const strategy = healthState.config.strategy ?? this.config.defaultStrategy;
        const recovered = this.applyRecoveryStrategy(
            systemName,
            strategy,
            execute,
            deltaTime,
            systemError
        );

        // Update error with recovery result
        systemError.recovered = recovered;

        // Collect error for reporting
        if (this.config.collectErrors) {
            this.errorHistory.push(systemError);
            // Trim history if needed
            while (this.errorHistory.length > this.config.maxErrorHistory) {
                this.errorHistory.shift();
            }
        }

        // Emit error event
        this.eventEmitter?.emit('onSystemError', systemError);

        // Notify recovery callback
        this.config.onRecovery?.(systemName, systemError, strategy);

        return recovered;
    }

    /**
     * Apply a recovery strategy.
     */
    private applyRecoveryStrategy(
        systemName: string,
        strategy: RecoveryStrategy,
        execute: () => void,
        deltaTime: number,
        error: SystemError
    ): boolean {
        switch (strategy) {
            case 'skip':
                if (this.debugMode) {
                    console.warn(
                        `[ECS] System "${systemName}" error skipped:`,
                        error.error.message
                    );
                }
                return true; // Considered "recovered" as we continue gracefully

            case 'retry':
                return this.retryExecution(systemName, execute);

            case 'disable':
                this.disableSystem(systemName);
                if (this.debugMode) {
                    console.warn(
                        `[ECS] System "${systemName}" disabled due to error:`,
                        error.error.message
                    );
                }
                return false;

            case 'fallback':
                this.executeFallback(systemName, deltaTime);
                return true;

            case 'ignore':
            default:
                // Just log and continue
                console.error(`[ECS] System "${systemName}" error:`, error.error);
                return true;
        }
    }

    /**
     * Retry system execution with exponential backoff.
     */
    private retryExecution(systemName: string, execute: () => void): boolean {
        const healthState = this.systemHealth.get(systemName)!;
        const maxRetries = this.config.maxRetries;

        while (healthState.retryCount < maxRetries) {
            healthState.retryCount++;

            // Calculate delay with exponential backoff (unused in sync execution, but kept for future async support)
            const _delay = Math.min(
                this.config.retryBaseDelay * Math.pow(2, healthState.retryCount - 1),
                this.config.retryMaxDelay
            );

            if (this.debugMode) {
                console.log(
                    `[ECS Debug] Retrying "${systemName}" (attempt ${healthState.retryCount}/${maxRetries})`
                );
            }

            // For synchronous execution, we don't actually delay
            // In a real async system, you would use setTimeout or similar
            try {
                execute();
                // Success - reset retry count
                healthState.retryCount = 0;
                this.recordSuccess(systemName);
                return true;
            } catch (retryError) {
                if (healthState.retryCount >= maxRetries) {
                    console.error(
                        `[ECS] System "${systemName}" failed after ${maxRetries} retries:`,
                        retryError
                    );
                    // Fall through to failure handling
                }
            }
        }

        // All retries exhausted
        healthState.retryCount = 0;
        return false;
    }

    /**
     * Execute a fallback function for a system.
     */
    private executeFallback(systemName: string, deltaTime: number): void {
        const healthState = this.systemHealth.get(systemName);
        if (healthState?.config.fallback) {
            try {
                healthState.config.fallback(deltaTime);
                if (this.debugMode) {
                    console.log(`[ECS Debug] Executed fallback for "${systemName}"`);
                }
            } catch (fallbackError) {
                console.error(`[ECS] Fallback for "${systemName}" also failed:`, fallbackError);
            }
        }
    }

    /**
     * Record a successful system execution.
     */
    private recordSuccess(systemName: string): void {
        const healthState = this.systemHealth.get(systemName);
        if (!healthState) return;

        healthState.consecutiveFailures = 0;
        healthState.consecutiveSuccesses++;
        healthState.lastSuccessTime = Date.now();

        // Handle circuit breaker state transitions
        if (healthState.circuitBreakerState === 'half-open') {
            const cbConfig = this.getCircuitBreakerConfig(systemName);
            if (healthState.consecutiveSuccesses >= cbConfig.successThreshold) {
                this.setCircuitBreakerState(systemName, 'closed');
                healthState.status = 'healthy';
            }
        } else if (healthState.status === 'degraded') {
            // Reset to healthy after sustained success
            healthState.status = 'healthy';
        }

        this.updateEngineHealth();
    }

    /**
     * Record a system failure.
     */
    private recordFailure(systemName: string, error: SystemError): void {
        const healthState = this.systemHealth.get(systemName);
        if (!healthState) return;

        healthState.consecutiveFailures++;
        healthState.consecutiveSuccesses = 0;
        healthState.totalErrors++;
        healthState.lastError = error;
        healthState.lastErrorTime = Date.now();

        // Update health status
        if (healthState.consecutiveFailures >= 3) {
            healthState.status = 'unhealthy';
        } else if (healthState.consecutiveFailures >= 1) {
            healthState.status = 'degraded';
        }

        // Check if circuit breaker should open
        const cbConfig = this.getCircuitBreakerConfig(systemName);
        if (healthState.consecutiveFailures >= cbConfig.failureThreshold) {
            if (healthState.circuitBreakerState !== 'open') {
                this.setCircuitBreakerState(systemName, 'open');
                healthState.circuitOpenedAt = Date.now();
            }
        }

        this.updateEngineHealth();
    }

    /**
     * Set circuit breaker state and emit event.
     */
    private setCircuitBreakerState(systemName: string, newState: CircuitBreakerState): void {
        const healthState = this.systemHealth.get(systemName);
        if (!healthState) return;

        const oldState = healthState.circuitBreakerState;
        if (oldState === newState) return;

        healthState.circuitBreakerState = newState;

        if (this.debugMode) {
            console.log(
                `[ECS Debug] Circuit breaker for "${systemName}": ${oldState} -> ${newState}`
            );
        }

        // Emit state change event
        this.config.onCircuitBreakerStateChange?.(systemName, oldState, newState);
        this.eventEmitter?.emit('onCircuitBreakerStateChange', {
            systemName,
            oldState,
            newState,
            timestamp: Date.now(),
        });
    }

    /**
     * Get circuit breaker config for a system.
     */
    private getCircuitBreakerConfig(systemName: string): CircuitBreakerConfig {
        const healthState = this.systemHealth.get(systemName);
        return {
            ...this.config.circuitBreaker,
            ...healthState?.config.circuitBreaker,
        };
    }

    /**
     * Create a SystemError object from an error.
     */
    private createSystemError(
        systemName: string,
        error: unknown,
        healthState: SystemHealthState
    ): SystemError {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        const severity = this.determineSeverity(healthState);

        return {
            id: `err_${++this.errorIdCounter}_${Date.now()}`,
            error: errorObj,
            systemName,
            timestamp: Date.now(),
            severity,
            recoveryStrategy: healthState.config.strategy ?? this.config.defaultStrategy,
            recovered: false,
            stack: errorObj.stack,
            context: {
                consecutiveFailures: healthState.consecutiveFailures + 1,
                circuitBreakerState: healthState.circuitBreakerState,
                isCritical: healthState.config.critical,
            },
        };
    }

    /**
     * Determine error severity based on system state.
     */
    private determineSeverity(healthState: SystemHealthState): ErrorSeverity {
        if (healthState.config.critical) {
            return 'critical';
        }
        if (healthState.consecutiveFailures >= 5) {
            return 'high';
        }
        if (healthState.consecutiveFailures >= 2) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Disable a system (marks it for skipping in execution).
     */
    private disableSystem(systemName: string): void {
        const healthState = this.systemHealth.get(systemName);
        if (healthState) {
            healthState.status = 'disabled';
        }
        this.eventEmitter?.emit('onSystemDisabledByError', { systemName, timestamp: Date.now() });
    }

    /**
     * Manually re-enable a system that was disabled by errors.
     */
    resetSystem(systemName: string): void {
        const healthState = this.systemHealth.get(systemName);
        if (healthState) {
            healthState.status = 'healthy';
            healthState.circuitBreakerState = 'closed';
            healthState.consecutiveFailures = 0;
            healthState.consecutiveSuccesses = 0;
            healthState.retryCount = 0;
            healthState.circuitOpenedAt = undefined;

            if (this.debugMode) {
                console.log(`[ECS Debug] System "${systemName}" reset to healthy state`);
            }

            this.updateEngineHealth();
        }
    }

    /**
     * Reset all systems to healthy state.
     */
    resetAllSystems(): void {
        for (const systemName of this.systemHealth.keys()) {
            this.resetSystem(systemName);
        }
    }

    /**
     * Update overall engine health based on system health.
     */
    private updateEngineHealth(): void {
        let unhealthyCount = 0;
        let degradedCount = 0;
        let criticalUnhealthy = false;

        for (const healthState of this.systemHealth.values()) {
            if (healthState.status === 'unhealthy' || healthState.status === 'disabled') {
                unhealthyCount++;
                if (healthState.config.critical) {
                    criticalUnhealthy = true;
                }
            } else if (healthState.status === 'degraded') {
                degradedCount++;
            }
        }

        const previousStatus = this.engineHealthStatus;
        let newStatus: 'healthy' | 'degraded' | 'unhealthy';

        if (criticalUnhealthy || unhealthyCount >= 3) {
            newStatus = 'unhealthy';
        } else if (unhealthyCount > 0 || degradedCount > 0) {
            newStatus = 'degraded';
        } else {
            newStatus = 'healthy';
        }

        if (previousStatus !== newStatus) {
            this.engineHealthStatus = newStatus;

            const unhealthySystems: string[] = [];
            const degradedSystems: string[] = [];

            for (const [name, state] of this.systemHealth) {
                if (state.status === 'unhealthy' || state.status === 'disabled') {
                    unhealthySystems.push(name);
                } else if (state.status === 'degraded') {
                    degradedSystems.push(name);
                }
            }

            const event: EngineHealthEvent = {
                previousStatus,
                newStatus,
                unhealthySystems,
                degradedSystems,
                timestamp: Date.now(),
            };

            this.eventEmitter?.emit('onEngineHealthChanged', event);
        }
    }

    /**
     * Get the health status of a specific system.
     */
    getSystemHealth(systemName: string): SystemHealth | undefined {
        const state = this.systemHealth.get(systemName);
        if (!state) return undefined;

        return {
            systemName: state.systemName,
            status: state.status,
            circuitBreakerState: state.circuitBreakerState,
            consecutiveFailures: state.consecutiveFailures,
            consecutiveSuccesses: state.consecutiveSuccesses,
            totalErrors: state.totalErrors,
            lastError: state.lastError,
            lastSuccessTime: state.lastSuccessTime,
            lastErrorTime: state.lastErrorTime,
            enabled: state.status !== 'disabled',
        };
    }

    /**
     * Get health status of all systems.
     */
    getAllSystemHealth(): SystemHealth[] {
        const result: SystemHealth[] = [];
        for (const state of this.systemHealth.values()) {
            const health = this.getSystemHealth(state.systemName);
            if (health) {
                result.push(health);
            }
        }
        return result;
    }

    /**
     * Get overall engine health status.
     */
    getEngineHealth(): 'healthy' | 'degraded' | 'unhealthy' {
        return this.engineHealthStatus;
    }

    /**
     * Get error history.
     */
    getErrorHistory(): SystemError[] {
        return [...this.errorHistory];
    }

    /**
     * Clear error history.
     */
    clearErrorHistory(): void {
        this.errorHistory = [];
    }

    /**
     * Generate a comprehensive error report for production error services.
     */
    generateErrorReport(entityCount?: number, systemCount?: number): ErrorReport {
        return {
            errors: [...this.errorHistory],
            systemHealth: this.getAllSystemHealth(),
            engineHealth: this.engineHealthStatus,
            sessionStartTime: this.sessionStartTime,
            reportTime: Date.now(),
            engineStats:
                entityCount !== undefined && systemCount !== undefined
                    ? {
                          entityCount,
                          systemCount,
                          uptime: Date.now() - this.sessionStartTime,
                      }
                    : undefined,
        };
    }

    /**
     * Check if a system is currently healthy (can execute).
     */
    isSystemHealthy(systemName: string): boolean {
        const state = this.systemHealth.get(systemName);
        if (!state) return true; // Unknown systems are assumed healthy

        return state.status === 'healthy' || state.status === 'degraded';
    }

    /**
     * Update configuration for a registered system.
     */
    updateSystemConfig(systemName: string, config: Partial<SystemErrorConfig>): void {
        const state = this.systemHealth.get(systemName);
        if (state) {
            state.config = { ...state.config, ...config };
        }
    }

    /**
     * Clean up resources.
     */
    dispose(): void {
        this.systemHealth.clear();
        this.errorHistory = [];
    }
}
