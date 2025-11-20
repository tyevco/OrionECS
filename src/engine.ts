/**
 * Composition-based Engine architecture (v2.0)
 * Uses focused managers for separation of concerns
 */

import {
    ComponentManager,
    SystemManager,
    QueryManager,
    PrefabManager,
    SnapshotManager,
    MessageManager
} from './managers';

import {
    Entity,
    Query,
    System,
    EventEmitter,
    PerformanceMonitor,
    EntityManager
} from './core';

import type {
    ComponentIdentifier,
    ComponentValidator,
    QueryOptions,
    SystemType,
    SystemProfile,
    EntityPrefab,
    SerializedWorld,
    MemoryStats,
    EnginePlugin,
    PluginContext,
    InstalledPlugin
} from './definitions';

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
        // Create system manager with configured settings
        this.systemManager = new SystemManager(this.fixedUpdateFPS, this.maxFixedIterations);

        // Create snapshot manager with configured settings
        this.snapshotManager = new SnapshotManager(this.maxSnapshots);

        // Create entity manager with dependencies
        this.entityManager = new EntityManager(this.componentManager, this.eventEmitter);

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
            this.queryManager.updateQueries(entity);
        });
        this.eventEmitter.on('onComponentRemoved', (entity: Entity) => {
            this.queryManager.updateQueries(entity);
        });
        this.eventEmitter.on('onTagChanged', (entity: Entity) => {
            this.queryManager.updateQueries(entity);
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

    // ========== System Management ==========

    createSystem<C extends any[] = any[]>(
        name: string,
        queryOptions: QueryOptions,
        options: SystemType<C>,
        isFixedUpdate: boolean = false
    ): System<C> {
        const query = this.queryManager.createQuery<C>(queryOptions);
        const system = new System<C>(name, query, options);

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

    createQuery<C extends any[] = any[]>(options: QueryOptions): Query<C> {
        const query = this.queryManager.createQuery<C>(options);

        // Update new query with all existing entities
        for (const entity of this.entityManager.getAllEntities()) {
            query.match(entity);
        }

        return query;
    }

    // ========== Prefab Management ==========

    registerPrefab(name: string, prefab: EntityPrefab): void {
        this.prefabManager.register(name, prefab);
    }

    createFromPrefab(prefabName: string, entityName?: string): Entity | null {
        const prefab = this.prefabManager.get(prefabName);
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
            console.log(`[ECS Debug] Snapshot created (${this.snapshotManager.getSnapshotCount()} total)`);
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

            // Add components
            for (const [componentName, componentData] of Object.entries(serializedEntity.components)) {
                const componentType = this.componentManager.getComponentByName(componentName);
                if (componentType) {
                    // Reconstruct component from data
                    const component = Object.assign(new componentType(), componentData);
                    const componentArray = this.componentManager.getComponentArray(componentType);
                    const index = componentArray.add(component);
                    (entity as any)._componentIndices.set(componentType, index);
                    (entity as any)._dirty = true;
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
                this.messageManager.getHistory(messageType)
        };
    }

    // ========== Events ==========

    on(event: string, callback: Function): () => void {
        return this.eventEmitter.on(event, callback);
    }

    off(event: string, callback: Function): void {
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
        const dt = deltaTime !== undefined ? deltaTime : (now - this.lastUpdateTime);
        this.lastUpdateTime = now;

        this.performanceMonitor.addSample(dt);

        // Execute fixed update systems
        this.systemManager.executeFixedSystems(dt, this.debugMode);

        // Execute variable update systems
        this.systemManager.executeVariableSystems();

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
        const entities = this.entityManager.getAllEntities()
            .filter(entity => !entity.parent) // Only serialize root entities
            .map(entity => entity.serialize());

        return {
            entities,
            timestamp: Date.now()
        };
    }

    // ========== Statistics and Debugging ==========

    getMemoryStats(): MemoryStats {
        const componentArrays = this.componentManager.getAllComponentArrays();
        const componentStats: { [name: string]: number } = {};
        let totalMemory = 0;

        for (const [type, array] of componentArrays) {
            const size = array.size;
            const memory = array.memoryEstimate;
            componentStats[type.name] = size;
            totalMemory += memory;
        }

        const entities = this.entityManager.getAllEntities();
        const activeEntities = entities.filter(e => !e.isMarkedForDeletion);

        return {
            totalEntities: entities.length,
            activeEntities: activeEntities.length,
            componentArrays: componentStats,
            totalMemoryEstimate: totalMemory
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
                maxFrameTime: this.performanceMonitor.getMax()
            }
        };
    }

    getPerformanceStats() {
        return {
            averageFrameTime: this.performanceMonitor.getAverage(),
            minFrameTime: this.performanceMonitor.getMin(),
            maxFrameTime: this.performanceMonitor.getMax()
        };
    }

    // ========== Plugin System ==========

    /**
     * Create a plugin context for a plugin to use during installation
     */
    private createPluginContext(): PluginContext {
        const self = this;
        return {
            registerComponent<T>(type: ComponentIdentifier<T>): void {
                self.registerComponent(type);
            },
            registerComponentValidator<T>(type: ComponentIdentifier<T>, validator: ComponentValidator<T>): void {
                self.registerComponentValidator(type, validator);
            },
            createSystem<C extends any[] = any[]>(
                name: string,
                queryOptions: QueryOptions,
                options: SystemType<C>,
                isFixedUpdate: boolean = false
            ): any {
                return self.createSystem(name, queryOptions, options, isFixedUpdate);
            },
            createQuery<C extends any[] = any[]>(options: QueryOptions): any {
                return self.createQuery(options);
            },
            registerPrefab(name: string, prefab: EntityPrefab): void {
                self.registerPrefab(name, prefab);
            },
            on(event: string, callback: Function): () => void {
                return self.on(event, callback);
            },
            emit(event: string, ...args: any[]): void {
                self.emit(event, ...args);
            },
            messageBus: {
                subscribe(messageType: string, callback: (message: any) => void): () => void {
                    return self.messageBus.subscribe(messageType, callback);
                },
                publish(messageType: string, data: any, sender?: string): void {
                    self.messageBus.publish(messageType, data, sender);
                }
            },
            extend<T extends object>(extensionName: string, api: T): void {
                if (self.extensions.has(extensionName)) {
                    throw new Error(`Extension '${extensionName}' already exists`);
                }
                self.extensions.set(extensionName, api);
                // Dynamically add extension to engine instance
                (self as any)[extensionName] = api;
            },
            getEngine(): any {
                return self;
            }
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
            result.then(() => {
                this.installedPlugins.set(plugin.name, {
                    plugin,
                    installedAt: Date.now()
                });
                this.eventEmitter.emit('onPluginInstalled', plugin);
                if (this.debugMode) {
                    console.log(`[ECS Debug] Plugin '${plugin.name}' installed successfully`);
                }
            }).catch(error => {
                console.error(`[ECS] Failed to install plugin '${plugin.name}':`, error);
            });
        } else {
            this.installedPlugins.set(plugin.name, {
                plugin,
                installedAt: Date.now()
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
