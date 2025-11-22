/**
 * Composition-based Engine architecture (v2.0)
 * Uses focused managers for separation of concerns
 */

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
    ComponentManager,
    MessageManager,
    PrefabManager,
    QueryManager,
    SnapshotManager,
    SystemManager,
} from './managers';

/**
 * Builder for composing an Engine from focused managers
 */
export class EngineBuilder {
    private componentManager = new ComponentManager();
    private systemManager?: SystemManager;
    private queryManager = new QueryManager();
    private prefabManager = new PrefabManager();
    private snapshotManager?: SnapshotManager;
    private messageManager = new MessageManager();
    private eventEmitter = new EventEmitter();
    private entityManager?: EntityManager;
    private performanceMonitor = new PerformanceMonitor();

    private fixedUpdateFPS: number = 60;
    private maxFixedIterations: number = 10;
    private debugMode: boolean = false;
    private maxSnapshots: number = 10;
    private plugins: EnginePlugin[] = [];
    private enableArchetypeSystem: boolean = true; // Enable archetypes by default

    /**
     * Enable or disable debug mode
     */
    withDebugMode(enabled: boolean): this {
        this.debugMode = enabled;
        return this;
    }

    /**
     * Set fixed update FPS (default: 60)
     */
    withFixedUpdateFPS(fps: number): this {
        this.fixedUpdateFPS = fps;
        return this;
    }

    /**
     * Set max fixed update iterations per frame (default: 10)
     */
    withMaxFixedIterations(iterations: number): this {
        this.maxFixedIterations = iterations;
        return this;
    }

    /**
     * Set max number of snapshots to keep (default: 10)
     */
    withMaxSnapshots(max: number): this {
        this.maxSnapshots = max;
        return this;
    }

    /**
     * Enable or disable the archetype system for improved performance (default: enabled)
     * When enabled, entities are grouped by component composition for better cache locality
     * This provides significant performance improvements for systems iterating over many entities
     */
    withArchetypes(enabled: boolean): this {
        this.enableArchetypeSystem = enabled;
        return this;
    }

    /**
     * Register a plugin to be installed when the engine is built
     */
    use(plugin: EnginePlugin): this {
        this.plugins.push(plugin);
        return this;
    }

    /**
     * Build the Engine with all configured managers
     */
    build(): Engine {
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

        const engine = new Engine(
            this.entityManager,
            this.componentManager,
            this.systemManager,
            this.queryManager,
            this.prefabManager,
            this.snapshotManager,
            this.messageManager,
            this.eventEmitter,
            this.performanceMonitor,
            this.debugMode
        );

        // Install all registered plugins
        for (const plugin of this.plugins) {
            engine.installPlugin(plugin);
        }

        return engine;
    }
}

/**
 * Main Engine class - facade over focused managers
 */
export class Engine {
    private running: boolean = false;
    private lastUpdateTime: number = 0;
    private installedPlugins: Map<string, InstalledPlugin> = new Map();
    private extensions: Map<string, any> = new Map();

    // Transaction state
    private inTransaction: boolean = false;
    private pendingQueryUpdates: Set<Entity> = new Set();

    constructor(
        private entityManager: EntityManager,
        private componentManager: ComponentManager,
        private systemManager: SystemManager,
        private queryManager: QueryManager,
        private prefabManager: PrefabManager,
        private snapshotManager: SnapshotManager,
        private messageManager: MessageManager,
        private eventEmitter: EventEmitter,
        private performanceMonitor: PerformanceMonitor,
        private debugMode: boolean
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
    }

    // ========== Entity Management ==========

    createEntity(name?: string): Entity {
        const entity = this.entityManager.createEntity(name);
        return entity;
    }

    getEntity(id: symbol): Entity | undefined {
        return this.entityManager.getEntity(id);
    }

    getAllEntities(): Entity[] {
        return this.entityManager.getAllEntities();
    }

    getEntitiesByTag(tag: string): Entity[] {
        return this.entityManager.getEntitiesByTag(tag);
    }

    getEntityByName(name: string): Entity | undefined {
        return this.entityManager.getEntityByName(name);
    }

    getEntityByNumericId(id: number): Entity | undefined {
        return this.entityManager.getEntityByNumericId(id);
    }

    findEntity(predicate: (entity: Entity) => boolean): Entity | undefined {
        return this.entityManager.findEntity(predicate);
    }

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
        const system = new System<ComponentTypes<All>>(name, query, options);

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

        // Update all queries with restored entities
        for (const entity of entityMap.values()) {
            this.queryManager.updateQueries(entity);
        }

        if (this.debugMode) {
            console.log(`[ECS Debug] Snapshot restored (${entityMap.size} entities)`);
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

        return {
            entities,
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
