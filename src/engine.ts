import type {
    ComponentIdentifier,
    EngineEventNames,
    EngineEvents,
    EntityDef,
    EventCallback,
    SystemType,
    QueryOptions,
    SerializedEntity,
    SerializedWorld,
    EntityPrefab,
    SystemProfile,
    MemoryStats,
    ComponentValidator,
    TagComponent,
    SystemMessage
} from "./definitions";

// Constants for configuration
const MAX_MESSAGE_HISTORY = 1000;
const MAX_EVENT_HISTORY = 500;
const MAX_SNAPSHOTS = 10;
const ESTIMATED_COMPONENT_SIZE_BYTES = 32; // Rough heuristic
const MAX_PERFORMANCE_SAMPLES = 60;
const MAX_FIXED_UPDATE_ITERATIONS = 10; // Prevent spiral of death
const DEFAULT_POOL_MAX_SIZE = 1000;

// Enhanced Pool with metrics and max size
class Pool<T> {
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
            return this.available.pop()!;
        }
        this._totalCreated++;
        return this.createFunc();
    }

    public release(item: T): void {
        this._totalReleased++;
        this.resetFunc(item);
        // Only pool if under max size limit
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
            reuseRate: this._totalAcquired > 0 ? (this._totalAcquired - this._totalCreated) / this._totalAcquired : 0
        };
    }
}

// Enhanced ComponentArray with change tracking
class ComponentArray<T> {
    private components: (T | null)[] = [];
    private freeIndices: number[] = [];
    private _version: number = 0;
    private _lastChanged: number = 0;

    add(component: T): number {
        this._version++;
        this._lastChanged = performance.now();
        if (this.freeIndices.length > 0) {
            const index = this.freeIndices.pop()!;
            this.components[index] = component;
            return index;
        }
        return this.components.push(component) - 1;
    }

    remove(index: number): void {
        this._version++;
        this._lastChanged = performance.now();
        if (index >= 0 && index < this.components.length) {
            this.components[index] = null;
            this.freeIndices.push(index);
        }
    }

    get(index: number): T | null {
        // Add bounds checking
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
        }
    }

    get version(): number { return this._version; }
    get lastChanged(): number { return this._lastChanged; }
    get size(): number { return this.components.length - this.freeIndices.length; }
    get memoryEstimate(): number { return this.components.length * ESTIMATED_COMPONENT_SIZE_BYTES; }
}

// Enhanced Query system with NOT, OR, and tag support
class Query<C extends any[] = any[]> {
    private matchingEntities: Set<Entity> = new Set();

    constructor(public options: QueryOptions) {}

    // Test if entity matches query without side effects
    private test(entity: Entity): boolean {
        const { all = [], any = [], none = [], tags = [], withoutTags = [] } = this.options;

        // Check ALL components
        if (all.length > 0 && !all.every(type => entity.hasComponent(type))) {
            return false;
        }

        // Check ANY components
        if (any.length > 0 && !any.some(type => entity.hasComponent(type))) {
            return false;
        }

        // Check NONE components
        if (none.length > 0 && none.some(type => entity.hasComponent(type))) {
            return false;
        }

        // Check tags
        if (tags.length > 0 && !tags.every(tag => entity.hasTag(tag))) {
            return false;
        }

        // Check withoutTags
        if (withoutTags.length > 0 && withoutTags.some(tag => entity.hasTag(tag))) {
            return false;
        }

        return true;
    }

    // Update query with entity (registers or unregisters based on match)
    match(entity: Entity): boolean {
        const matches = this.test(entity);

        if (matches) {
            this.matchingEntities.add(entity);
        } else {
            this.matchingEntities.delete(entity);
        }

        return matches;
    }

    getEntities(): IterableIterator<Entity> {
        return this.matchingEntities.values();
    }

    getEntitiesArray(): Entity[] {
        return Array.from(this.matchingEntities);
    }

    get size(): number {
        return this.matchingEntities.size;
    }
}

// System Message Bus for inter-system communication
class MessageBus {
    private subscribers: Map<string, Set<(message: SystemMessage) => void>> = new Map();
    private messageHistory: SystemMessage[] = [];
    private maxHistorySize: number = MAX_MESSAGE_HISTORY;

    subscribe(messageType: string, callback: (message: SystemMessage) => void): () => void {
        if (!this.subscribers.has(messageType)) {
            this.subscribers.set(messageType, new Set());
        }
        this.subscribers.get(messageType)!.add(callback);

        return () => {
            this.subscribers.get(messageType)?.delete(callback);
        };
    }

    publish(messageType: string, data: any, sender?: string): void {
        const message: SystemMessage = {
            type: messageType,
            data,
            sender,
            timestamp: Date.now()
        };

        this.messageHistory.push(message);
        // Fix: Remove all excess items, not just one
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
            return this.messageHistory.filter(msg => msg.type === messageType);
        }
        return [...this.messageHistory];
    }
}

// Enhanced EventEmitter
class EventEmitter {
    private listeners: Map<string, Set<Function>> = new Map();
    private eventHistory: Array<{ event: string; args: any[]; timestamp: number }> = [];
    private maxHistorySize: number = MAX_EVENT_HISTORY;

    on(event: string, callback: Function): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        return () => this.off(event, callback);
    }

    off(event: string, callback: Function): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }

    emit(event: string, ...args: any[]): void {
        this.eventHistory.push({ event, args, timestamp: Date.now() });
        // Fix: Remove all excess items, not just one
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

// Enhanced Entity with hierarchy, tags, and serialization
class Entity implements EntityDef {
    private readonly _id: symbol;
    private readonly _numericId: number;
    private _name?: string;
    private _dirty: boolean = false;
    private _componentIndices: Map<Function, number> = new Map();
    private _markedForDelete: boolean = false;
    private _parent?: Entity;
    private _children: Set<Entity> = new Set();
    private _tags: Set<string> = new Set();
    private _changeVersion: number = 0;
    private static _nextId: number = 1;

    private constructor(
        private entityManager: EntityManager,
        private engine: Engine
    ) {
        this._id = Symbol();
        this._numericId = Entity._nextId++;
    }

    get id(): symbol { return this._id; }
    get numericId(): number { return this._numericId; }
    get name(): string | undefined { return this._name; }
    set name(value: string | undefined) { this._name = value; }
    get parent(): EntityDef | undefined { return this._parent; }
    get children(): EntityDef[] { return Array.from(this._children); }
    get tags(): Set<string> { return new Set(this._tags); }
    get isDirty(): boolean { return this._dirty; }
    get isMarkedForDeletion(): boolean { return this._markedForDelete; }
    get changeVersion(): number { return this._changeVersion; }

    // Public method to get component types (fixes encapsulation issue)
    getComponentTypes(): Function[] {
        return Array.from(this._componentIndices.keys());
    }

    addComponent<T>(type: ComponentIdentifier<T>, ...args: ConstructorParameters<typeof type>): this {
        if (!this._componentIndices.has(type)) {
            const validator = this.engine.getComponentValidator(type);
            if (validator?.dependencies) {
                for (const dep of validator.dependencies) {
                    if (!this.hasComponent(dep)) {
                        throw new Error(`Component ${type.name} requires ${dep.name} but it's not present on entity ${this._name || this._numericId}`);
                    }
                }
            }

            if (validator?.conflicts) {
                for (const conflict of validator.conflicts) {
                    if (this.hasComponent(conflict)) {
                        throw new Error(`Component ${type.name} conflicts with ${conflict.name} on entity ${this._name || this._numericId}`);
                    }
                }
            }

            const componentArray = this.engine.getComponentArray(type);
            const component = new type(...args);

            // CRITICAL FIX: Proper validation logic
            if (validator) {
                const validationResult = validator.validate(component);
                if (validationResult !== true) {
                    const errorMessage = typeof validationResult === 'string' ? validationResult : 'Component validation failed';
                    throw new Error(`${errorMessage} for ${type.name} on entity ${this._name || this._numericId}`);
                }
            }

            const index = componentArray.add(component);
            this._componentIndices.set(type, index);
            this._dirty = true;
            this._changeVersion++;
            this.engine.triggerEvent('onComponentAdded', this, type);
        }
        return this;
    }

    removeComponent<T>(type: ComponentIdentifier<T>): this {
        const index = this._componentIndices.get(type);
        if (index !== undefined) {
            const componentArray = this.engine.getComponentArray(type);
            componentArray.remove(index);
            this._componentIndices.delete(type);
            this._dirty = true;
            this._changeVersion++;
            this.engine.triggerEvent('onComponentRemoved', this, type);
        }
        return this;
    }

    hasComponent<T>(type: ComponentIdentifier<T>): boolean {
        return this._componentIndices.has(type);
    }

    getComponent<T>(type: ComponentIdentifier<T>): T {
        const index = this._componentIndices.get(type);
        if (index === undefined) {
            throw new Error(`Component ${type.name} not found on entity ${this._name || this._numericId}`);
        }
        const componentArray = this.engine.getComponentArray(type);
        const component = componentArray.get(index);
        if (component === null) {
            throw new Error(`Component ${type.name} is null on entity ${this._name || this._numericId}`);
        }
        return component as T;
    }

    addTag(tag: string): this {
        if (!this._tags.has(tag)) {
            this._tags.add(tag);
            this._changeVersion++;
            this._dirty = true;
        }
        return this;
    }

    removeTag(tag: string): this {
        if (this._tags.has(tag)) {
            this._tags.delete(tag);
            this._changeVersion++;
            this._dirty = true;
        }
        return this;
    }

    hasTag(tag: string): boolean {
        return this._tags.has(tag);
    }

    setParent(parent: EntityDef | null): this {
        if (this._parent === parent) return this;
        
        if (this._parent) {
            (this._parent as Entity)._children.delete(this);
        }
        
        this._parent = parent as Entity;
        
        if (this._parent) {
            (this._parent as Entity)._children.add(this);
        }
        
        this._changeVersion++;
        this.engine.triggerEvent('onEntityHierarchyChanged', this);
        return this;
    }

    addChild(child: EntityDef): this {
        (child as Entity).setParent(this);
        return this;
    }

    removeChild(child: EntityDef): this {
        if (this._children.has(child as Entity)) {
            (child as Entity).setParent(null);
        }
        return this;
    }

    queueFree(): void {
        this._markedForDelete = true;
    }

    serialize(): SerializedEntity {
        const components: { [componentName: string]: any } = {};

        for (const [componentType, index] of this._componentIndices) {
            const componentArray = this.engine.getComponentArray(componentType as ComponentIdentifier);
            const component = componentArray.get(index);
            if (component) {
                components[componentType.name] = { ...component };
            }
        }

        return {
            id: this._numericId.toString(), // Use numeric ID for unique serialization
            name: this._name,
            tags: Array.from(this._tags),
            components,
            children: Array.from(this._children).map(child => child.serialize())
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

    static create(entityManager: EntityManager, engine: Engine): Entity {
        return new Entity(entityManager, engine);
    }
}

// Enhanced EntityManager
class EntityManager {
    private activeEntities: Map<symbol, Entity> = new Map();
    private entityPool = new Pool<Entity>(
        () => Entity.create(this, this.engine),
        (entity) => entity.reset()
    );

    constructor(private engine: Engine) {}

    createEntity(name?: string): Entity {
        const entity = this.entityPool.acquire();
        entity.name = name;
        this.activeEntities.set(entity.id, entity);
        this.engine.triggerEvent('onEntityCreated', entity);
        return entity;
    }

    createEntities(count: number, template?: EntityPrefab): Entity[] {
        const entities: Entity[] = [];
        for (let i = 0; i < count; i++) {
            const entity = this.createEntity(template?.name ? `${template.name}_${i}` : undefined);
            if (template) {
                this.applyPrefab(entity, template);
            }
            entities.push(entity);
        }
        return entities;
    }

    private applyPrefab(entity: Entity, prefab: EntityPrefab): void {
        for (const { type, args } of prefab.components) {
            entity.addComponent(type, ...args);
        }
        
        for (const tag of prefab.tags) {
            entity.addTag(tag);
        }
        
        if (prefab.children) {
            for (const childPrefab of prefab.children) {
                const child = this.createEntity(childPrefab.name);
                this.applyPrefab(child, childPrefab);
                entity.addChild(child);
            }
        }
    }

    releaseEntity(entity: Entity): void {
        if (entity.parent) {
            entity.parent.removeChild(entity);
        }
        
        for (const child of [...entity.children]) {
            this.releaseEntity(child as Entity);
        }
        
        this.activeEntities.delete(entity.id);
        this.entityPool.release(entity);
        this.engine.triggerEvent('onEntityReleased', entity);
    }

    getEntity(id: symbol): Entity | undefined {
        return this.activeEntities.get(id);
    }

    getAllEntities(): Entity[] {
        return Array.from(this.activeEntities.values());
    }

    getEntitiesByTag(tag: string): Entity[] {
        return this.getAllEntities().filter(entity => entity.hasTag(tag));
    }

    cleanup(): void {
        const toDelete: Entity[] = [];
        this.activeEntities.forEach(entity => {
            if (entity.isMarkedForDeletion) {
                toDelete.push(entity);
            }
        });
        
        for (const entity of toDelete) {
            this.releaseEntity(entity);
        }
    }

    get stats(): MemoryStats {
        const componentArrays: { [componentName: string]: number } = {};
        const entities = Array.from(this.activeEntities.values());

        for (const entity of entities) {
            // Use public method instead of accessing private members
            for (const componentType of entity.getComponentTypes()) {
                const name = componentType.name;
                componentArrays[name] = (componentArrays[name] || 0) + 1;
            }
        }

        return {
            totalEntities: this.entityPool.stats.totalCreated,
            activeEntities: this.activeEntities.size,
            componentArrays,
            totalMemoryEstimate: this.activeEntities.size * 100 + Object.values(componentArrays).reduce((a, b) => a + b, 0) * ESTIMATED_COMPONENT_SIZE_BYTES
        };
    }
}

// Enhanced System
class System<C extends any[] = any[]> {
    private query: Query<C>;
    private _enabled: boolean = true;
    private _priority: number = 0;
    private _profile: SystemProfile;
    private _tags: Set<string> = new Set();

    constructor(
        private engine: Engine,
        public name: string,
        private options: SystemType<C>,
        queryOptions: QueryOptions
    ) {
        this.query = engine.createQuery<C>(queryOptions);
        this._priority = options.priority || 0;
        this._enabled = options.enabled !== false;
        
        if (options.tags) {
            options.tags.forEach(tag => this._tags.add(tag));
        }
        
        this._profile = {
            name: this.name,
            executionTime: 0,
            entityCount: 0,
            callCount: 0,
            averageTime: 0
        };
    }

    get enabled(): boolean { return this._enabled; }
    set enabled(value: boolean) {
        if (this._enabled !== value) {
            this._enabled = value;
            if (value) {
                this.engine.triggerEvent('onSystemEnabled', this);
            } else {
                this.engine.triggerEvent('onSystemDisabled', this);
            }
        }
    }

    get priority(): number { return this._priority; }
    set priority(value: number) { this._priority = value; }

    get tags(): Set<string> { return new Set(this._tags); }
    get profile(): SystemProfile { return { ...this._profile }; }

    hasTag(tag: string): boolean {
        return this._tags.has(tag);
    }

    step(): void {
        if (!this._enabled) return;
        
        const startTime = performance.now();
        
        if (this.options.before) {
            this.options.before();
        }
        
        const entities = Array.from(this.query.getEntities());
        
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
    }

    private getComponents(entity: Entity): C {
        const { all = [] } = this.query.options;
        return all.map((componentType: ComponentIdentifier) => entity.getComponent(componentType)) as C;
    }

    private updateProfile(executionTime: number, entityCount: number): void {
        this._profile.executionTime = executionTime;
        this._profile.entityCount = entityCount;
        this._profile.callCount++;
        this._profile.averageTime = (this._profile.averageTime * (this._profile.callCount - 1) + executionTime) / this._profile.callCount;
    }
}

// Main Enhanced Engine class (now the default Engine)
export class Engine extends EventEmitter {
    private _queries: Query<any>[] = [];
    private _systems: System<any>[] = [];
    private _fixedUpdateSystems: System<any>[] = [];
    private _systemsSorted: boolean = true;
    private _fixedSystemsSorted: boolean = true;
    private _steps: number = 0;
    private _active: boolean = false;
    private _entityManager: EntityManager = new EntityManager(this);
    private _fixedUpdateAccumulator: number = 0;
    private _fixedUpdateInterval: number = 1000 / 60;
    private _componentArrays: Map<Function, ComponentArray<any>> = new Map();
    private _componentValidators: Map<Function, ComponentValidator> = new Map();
    private _messageBus: MessageBus = new MessageBus();
    private _prefabs: Map<string, EntityPrefab> = new Map();
    private _snapshots: SerializedWorld[] = [];
    private _maxSnapshots: number = MAX_SNAPSHOTS;
    private _debugMode: boolean = false;
    private _startTime: number = 0;
    private _componentRegistry: Map<string, ComponentIdentifier> = new Map();

    constructor(fixedUpdateFPS: number = 60, debugMode: boolean = false) {
        super();
        this._debugMode = debugMode;
        this._fixedUpdateInterval = 1000 / fixedUpdateFPS;
        this.setupEventHandlers();
        
        if (debugMode) {
            this.enableDebugLogging();
        }
    }

    private setupEventHandlers(): void {
        this.on('onEntityCreated', (entity: Entity) => { this.updateQueries(entity); });
        this.on('onEntityReleased', (entity: Entity) => { this.updateQueries(entity); });
        this.on('onComponentAdded', (entity: Entity) => { this.updateQueries(entity); });
        this.on('onComponentRemoved', (entity: Entity) => { this.updateQueries(entity); });
    }

    private enableDebugLogging(): void {
        this.on('onEntityCreated', (entity: Entity) => {
            console.log(`[ECS Debug] Entity created: ${entity.name || entity.id.toString()}`);
        });
    }

    // Core methods
    createEntity(name?: string): Entity {
        return this._entityManager.createEntity(name);
    }

    createEntities(count: number, template?: EntityPrefab): Entity[] {
        return this._entityManager.createEntities(count, template);
    }

    // New enhanced system creation method
    createSystem<C extends any[] = any[]>(
        name: string,
        queryOptions: QueryOptions,
        options: SystemType<C>,
        isFixedUpdate: boolean = false
    ): System<C> {
        const system = new System<C>(this, name, options, queryOptions);

        if (isFixedUpdate) {
            this._fixedUpdateSystems.push(system as System<any>);
            this._fixedSystemsSorted = false;
        } else {
            this._systems.push(system as System<any>);
            this._systemsSorted = false;
        }

        return system;
    }

    // Backwards compatible system creation (for old tests)
    createSystemLegacy<C extends any[] = any[]>(
        components: ComponentIdentifier[],
        options: SystemType<C>,
        isFixedUpdate: boolean = false
    ): System<C> {
        return this.createSystem(
            'LegacySystem',
            { all: components },
            options,
            isFixedUpdate
        );
    }

    private ensureSystemsSorted(): void {
        if (!this._systemsSorted) {
            this._systems.sort((a, b) => b.priority - a.priority);
            this._systemsSorted = true;
        }
        if (!this._fixedSystemsSorted) {
            this._fixedUpdateSystems.sort((a, b) => b.priority - a.priority);
            this._fixedSystemsSorted = true;
        }
    }

    createQuery<C extends any[] = any[]>(options: QueryOptions): Query<C> {
        const query = new Query<C>(options);
        this._queries.push(query);
        return query;
    }

    private updateQueries(entity: Entity): void {
        for (const query of this._queries) {
            query.match(entity);
        }
    }

    getComponentArray<T>(type: ComponentIdentifier): ComponentArray<T> {
        if (!this._componentArrays.has(type)) {
            this._componentArrays.set(type, new ComponentArray<T>());
        }
        // Register component type by name for deserialization
        if (!this._componentRegistry.has(type.name)) {
            this._componentRegistry.set(type.name, type);
        }
        return this._componentArrays.get(type) as ComponentArray<T>;
    }

    registerComponentValidator<T>(type: ComponentIdentifier<T>, validator: ComponentValidator<T>): void {
        this._componentValidators.set(type, validator);
    }

    getComponentValidator<T>(type: ComponentIdentifier<T>): ComponentValidator<T> | undefined {
        return this._componentValidators.get(type) as ComponentValidator<T>;
    }

    // Register component types for deserialization
    registerComponent<T>(type: ComponentIdentifier<T>): void {
        this._componentRegistry.set(type.name, type);
    }

    registerPrefab(name: string, prefab: EntityPrefab): void {
        this._prefabs.set(name, prefab);
    }

    createFromPrefab(prefabName: string, entityName?: string): Entity | null {
        const prefab = this._prefabs.get(prefabName);
        if (!prefab) return null;
        
        const entities = this.createEntities(1, { ...prefab, name: entityName || prefab.name });
        return entities[0];
    }

    update(deltaTime: number): void {
        this.beforeStep();

        // Ensure systems are sorted by priority before execution
        this.ensureSystemsSorted();

        // Fixed update with spiral of death protection
        this._fixedUpdateAccumulator += deltaTime;
        let iterations = 0;
        while (this._fixedUpdateAccumulator >= this._fixedUpdateInterval && iterations < MAX_FIXED_UPDATE_ITERATIONS) {
            for (const system of this._fixedUpdateSystems) {
                if (system.enabled) {
                    system.step();
                }
            }
            this._fixedUpdateAccumulator -= this._fixedUpdateInterval;
            iterations++;
        }

        // Reset accumulator if we hit max iterations (spiral of death)
        if (iterations >= MAX_FIXED_UPDATE_ITERATIONS) {
            this._fixedUpdateAccumulator = 0;
            if (this._debugMode) {
                console.warn('[ECS Debug] Fixed update spiral of death detected, accumulator reset');
            }
        }

        // Variable update systems
        for (const system of this._systems) {
            if (system.enabled) {
                system.step();
            }
        }

        this.afterStep();
        this._steps++;
    }

    run(): void {
        this._active = true;
        this._startTime = Date.now();
        this.triggerEvent('onStart');

        let lastTime = Date.now();
        const loop = () => {
            if (!this._active) {
                this.triggerEvent('onStop');
                return;
            }

            const currentTime = Date.now();
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            this.update(deltaTime);
            
            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(loop);
            } else {
                setTimeout(loop, 1);
            }
        };

        if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(loop);
        } else {
            setTimeout(loop, 0);
        }
    }

    stop(): void {
        this._active = false;
    }

    private beforeStep(): void {
        this.emit('beforeAct');
    }

    private afterStep(): void {
        this._entityManager.cleanup();
        this.emit('afterAct');
    }

    // Utility getters
    getAllEntities(): Entity[] { return this._entityManager.getAllEntities(); }
    getEntitiesByTag(tag: string): Entity[] { return this._entityManager.getEntitiesByTag(tag); }
    getAllSystems(): System[] { return [...this._systems, ...this._fixedUpdateSystems]; }
    getSystemProfiles(): SystemProfile[] { return this.getAllSystems().map(system => system.profile); }
    getMemoryStats(): MemoryStats { return this._entityManager.stats; }
    get messageBus(): MessageBus { return this._messageBus; }
    get active(): boolean { return this._active; }
    get steps(): number { return this._steps; }

    serialize(): SerializedWorld {
        return {
            entities: this.getAllEntities().map(entity => entity.serialize()),
            timestamp: Date.now()
        };
    }

    createSnapshot(): void {
        const snapshot = this.serialize();
        this._snapshots.push(snapshot);
        
        if (this._snapshots.length > this._maxSnapshots) {
            this._snapshots.shift();
        }
    }

    restoreSnapshot(index: number = -1): boolean {
        const snapshot = index === -1 ? this._snapshots[this._snapshots.length - 1] : this._snapshots[index];
        if (!snapshot) return false;

        // Clear all existing entities
        for (const entity of this.getAllEntities()) {
            entity.queueFree();
        }
        this._entityManager.cleanup();

        // Recreate entities from snapshot
        const entityMap = new Map<string, Entity>();

        // First pass: create entities without hierarchy
        for (const serializedEntity of snapshot.entities) {
            const entity = this.createEntity(serializedEntity.name);
            entityMap.set(serializedEntity.id, entity);

            // Add tags
            for (const tag of serializedEntity.tags) {
                entity.addTag(tag);
            }

            // Add components
            for (const [componentName, componentData] of Object.entries(serializedEntity.components)) {
                const ComponentClass = this._componentRegistry.get(componentName);
                if (ComponentClass) {
                    // Create component with default constructor
                    entity.addComponent(ComponentClass);
                    // Copy properties from serialized data
                    const component = entity.getComponent(ComponentClass);
                    Object.assign(component, componentData);
                } else if (this._debugMode) {
                    console.warn(`[ECS Debug] Component type ${componentName} not registered, skipping`);
                }
            }
        }

        // Second pass: restore hierarchy
        for (let i = 0; i < snapshot.entities.length; i++) {
            const serializedEntity = snapshot.entities[i];
            const entity = entityMap.get(serializedEntity.id);

            if (entity && serializedEntity.children) {
                for (const childSerialized of serializedEntity.children) {
                    const childEntity = entityMap.get(childSerialized.id);
                    if (childEntity) {
                        entity.addChild(childEntity);
                    }
                }
            }
        }

        return true;
    }

    triggerEvent(eventName: EngineEventNames, ...args: any[]): void {
        this.emit(eventName, ...args);
    }

    getDebugInfo() {
        return {
            uptime: Date.now() - this._startTime,
            steps: this._steps,
            systems: this.getAllSystems().length,
            entities: this.getAllEntities().length,
            queries: this._queries.length,
            prefabs: this._prefabs.size,
            snapshots: this._snapshots.length,
            eventHistory: this.getEventHistory().slice(-50)
        };
    }
}

// Utility functions
export function createTagComponent(name: string): ComponentIdentifier<TagComponent> {
    return class extends Object implements TagComponent {
        __isTag = true as const;
        static componentName = name;
    } as any;
}

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

export const CommonValidators = {
    nonNegative: <T extends { [key: string]: number }>(field: string): ComponentValidator<T> => ({
        validate: (component: T) => {
            const value = component[field];
            return typeof value === 'number' && value >= 0 ? true : `${field} must be non-negative`;
        }
    }),

    required: <T>(fields: (keyof T)[]): ComponentValidator<T> => ({
        validate: (component: T) => {
            for (const field of fields) {
                if (component[field] === undefined || component[field] === null) {
                    return `${String(field)} is required`;
                }
            }
            return true;
        }
    }),

    range: <T extends { [key: string]: number }>(field: string, min: number, max: number): ComponentValidator<T> => ({
        validate: (component: T) => {
            const value = component[field];
            return typeof value === 'number' && value >= min && value <= max ? 
                true : `${field} must be between ${min} and ${max}`;
        }
    })
};

// Also export as EnhancedEngine for backwards compatibility
export { Engine as EnhancedEngine };