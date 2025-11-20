/**
 * Core ECS building blocks
 * These are the fundamental classes used to build the ECS
 */

import type {
    ComponentIdentifier,
    EntityDef,
    QueryOptions,
    SystemType,
    SystemProfile,
    SerializedEntity,
    SystemMessage
} from "./definitions";

// Constants
const DEFAULT_POOL_MAX_SIZE = 1000;
const ESTIMATED_COMPONENT_SIZE_BYTES = 32;
const MAX_PERFORMANCE_SAMPLES = 60;
const MAX_MESSAGE_HISTORY = 1000;
const MAX_EVENT_HISTORY = 500;

/**
 * Object pool for reusing instances
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
            return this.available.pop()!;
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
            reuseRate: this._totalAcquired > 0 ? (this._totalAcquired - this._totalCreated) / this._totalAcquired : 0
        };
    }
}

/**
 * Sparse array for component storage with change tracking
 */
export class ComponentArray<T> {
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

/**
 * Query for finding entities with specific components and tags
 */
export class Query<C extends any[] = any[]> {
    private matchingEntities: Set<Entity> = new Set();
    private cachedArray: Entity[] = [];
    private cacheVersion: number = 0;
    private currentVersion: number = 0;

    constructor(public options: QueryOptions) {}

    private test(entity: Entity): boolean {
        const { all = [], any = [], none = [], tags = [], withoutTags = [] } = this.options;

        if (all.length > 0 && !all.every(type => entity.hasComponent(type))) return false;
        if (any.length > 0 && !any.some(type => entity.hasComponent(type))) return false;
        if (none.length > 0 && none.some(type => entity.hasComponent(type))) return false;
        if (tags.length > 0 && !tags.every(tag => entity.hasTag(tag))) return false;
        if (withoutTags.length > 0 && withoutTags.some(tag => entity.hasTag(tag))) return false;

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
        return this.matchingEntities.values();
    }

    getEntitiesArray(): Entity[] {
        if (this.cacheVersion === this.currentVersion) {
            return this.cachedArray;
        }
        this.cachedArray = Array.from(this.matchingEntities);
        this.cacheVersion = this.currentVersion;
        return this.cachedArray;
    }

    get size(): number {
        return this.matchingEntities.size;
    }
}

/**
 * Forward declaration for Entity
 */
export class Entity implements EntityDef {
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

    // Dependency injection of managers
    constructor(
        private componentManager: any, // ComponentManager
        private eventEmitter: any // EventEmitter or callback
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

    getComponentTypes(): Function[] {
        return Array.from(this._componentIndices.keys());
    }

    private static asEntity(entity: EntityDef): Entity {
        if (entity instanceof Entity) {
            return entity;
        }
        throw new Error('Invalid entity type - expected Entity instance');
    }

    addComponent<T>(type: ComponentIdentifier<T>, ...args: ConstructorParameters<typeof type>): this {
        if (!this._componentIndices.has(type)) {
            const validator = this.componentManager.getValidator(type);

            if (validator?.dependencies) {
                for (const dep of validator.dependencies) {
                    if (!this.hasComponent(dep)) {
                        throw new Error(`Component ${type.name} requires ${dep.name} on entity ${this._name || this._numericId}`);
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

            const componentArray = this.componentManager.getComponentArray(type);
            const component = new type(...args);

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
            this.eventEmitter.emit('onComponentAdded', this, type);
        }
        return this;
    }

    removeComponent<T>(type: ComponentIdentifier<T>): this {
        const index = this._componentIndices.get(type);
        if (index !== undefined) {
            const componentArray = this.componentManager.getComponentArray(type);
            componentArray.remove(index);
            this._componentIndices.delete(type);
            this._dirty = true;
            this._changeVersion++;
            this.eventEmitter.emit('onComponentRemoved', this, type);
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
        const componentArray = this.componentManager.getComponentArray(type);
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

    serialize(): SerializedEntity {
        const components: { [componentName: string]: any } = {};

        for (const [componentType, index] of this._componentIndices) {
            const componentArray = this.componentManager.getComponentArray(componentType as ComponentIdentifier);
            const component = componentArray.get(index);
            if (component) {
                components[componentType.name] = { ...component };
            }
        }

        return {
            id: this._numericId.toString(),
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

    static create(componentManager: any, eventEmitter: any): Entity {
        return new Entity(componentManager, eventEmitter);
    }
}

/**
 * System for processing entities with specific components
 */
export class System<C extends any[] = any[]> {
    private query: Query<C>;
    private _enabled: boolean = true;
    private _priority: number = 0;
    private _profile: SystemProfile;
    private _tags: Set<string> = new Set();

    constructor(
        public name: string,
        query: Query<C>,
        private options: SystemType<C>
    ) {
        this.query = query;
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
    set enabled(value: boolean) { this._enabled = value; }
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

/**
 * Event emitter for engine events
 */
export class EventEmitter {
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
        private componentManager: any,
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

        // Remove all components
        for (const componentType of entity.getComponentTypes()) {
            entity.removeComponent(componentType as ComponentIdentifier);
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
            this.entitiesByTag.get(tag)!.add(entity);
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
