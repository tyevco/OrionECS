export type ComponentIdentifier<T = any> = new (...args: any[]) => T;
export type ComponentArgs<T> = T extends new (...args: infer A) => any ? A : never;

// Extract instance type from ComponentIdentifier
export type ComponentInstance<T> = T extends ComponentIdentifier<infer I> ? I : never;

// Map array of ComponentIdentifiers to their instance types
export type ComponentTypes<T extends readonly ComponentIdentifier[]> = {
    [K in keyof T]: T[K] extends ComponentIdentifier<infer I> ? I : never;
};

export type EventTypes<T = any> = string | symbol | keyof T;
export type EventCallback<T = void> = (...args: any[]) => T;

// Component lifecycle hooks
export interface ComponentLifecycle {
    onCreate?(entity: EntityDef): void;
    onDestroy?(entity: EntityDef): void;
    onChanged?(): void;
}

// Enhanced system options with profiling and lifecycle hooks
export interface SystemOptions<C extends readonly any[] = any[]> {
    act?: (entity: EntityDef, ...components: C) => void;
    before?: () => void;
    after?: () => void;
    priority?: number;
    enabled?: boolean;
    tags?: string[];
    group?: string;
    runAfter?: string[];
    runBefore?: string[];
}

export type SystemType<T extends readonly any[] = any[]> = SystemOptions<T> & Partial<EngineEvents>;

// Enhanced engine events
export interface EngineEvents {
    onStop: EventCallback;
    onStart: EventCallback;
    beforeAct: EventCallback;
    afterAct: EventCallback;
    onSystemEnabled: EventCallback;
    onSystemDisabled: EventCallback;
    onSceneChanged: EventCallback;
}

export type EngineEventNames =
    | keyof EngineEvents
    | 'onEntityCreated'
    | 'onEntityReleased'
    | 'onComponentAdded'
    | 'onComponentRemoved'
    | 'onEntityHierarchyChanged';

// Enhanced entity interface
export interface EntityDef {
    id: symbol;
    name?: string;
    parent?: EntityDef;
    children: EntityDef[];
    tags: Set<string>;
    queueFree(): void;
    addComponent<T>(
        type: new (...args: any[]) => T,
        ...args: ConstructorParameters<typeof type>
    ): this;
    removeComponent<T>(type: new (...args: any[]) => T): this;
    hasComponent<T>(type: new (...args: any[]) => T): boolean;
    getComponent<T>(type: new (...args: any[]) => T): T;
    addTag(tag: string): this;
    removeTag(tag: string): this;
    hasTag(tag: string): boolean;
    setParent(parent: EntityDef | null): this;
    addChild(child: EntityDef): this;
    removeChild(child: EntityDef): this;
    get isDirty(): boolean;
    get isMarkedForDeletion(): boolean;
    serialize(): SerializedEntity;
}

// Query system enhancements
export interface QueryOptions<All extends readonly ComponentIdentifier[] = ComponentIdentifier[]> {
    all?: All;
    any?: ComponentIdentifier[];
    none?: ComponentIdentifier[];
    tags?: string[];
    withoutTags?: string[];
}

// Serialization interfaces
export interface SerializedEntity {
    id: string;
    name?: string;
    tags: string[];
    components: { [componentName: string]: any };
    children?: SerializedEntity[];
}

export interface SerializedWorld {
    entities: SerializedEntity[];
    timestamp: number;
}

// Prefab system
export type EntityPrefabFactory = (...args: any[]) => Omit<EntityPrefab, 'factory' | 'parent'>;

export interface EntityPrefab {
    name: string;
    components: { type: ComponentIdentifier; args: any[] }[];
    tags: string[];
    children?: EntityPrefab[];
    factory?: EntityPrefabFactory; // Optional factory for parameterized prefabs
    parent?: string; // Optional parent prefab name for inheritance
}

export interface EntityPrefabOverride {
    components?: { [componentName: string]: any };
    tags?: string[];
    children?: EntityPrefab[];
}

// Performance monitoring
export interface SystemProfile {
    name: string;
    executionTime: number;
    entityCount: number;
    callCount: number;
    averageTime: number;
}

export interface QueryStats {
    query: any; // Query instance
    executionCount: number;
    totalTimeMs: number;
    averageTimeMs: number;
    lastMatchCount: number;
    cacheHitRate?: number;
}

export interface MemoryStats {
    totalEntities: number;
    activeEntities: number;
    componentArrays: { [componentName: string]: number };
    totalMemoryEstimate: number;
}

// Component validation
export interface ComponentValidator<T = any> {
    validate(component: T): boolean | string;
    dependencies?: ComponentIdentifier[];
    conflicts?: ComponentIdentifier[];
}

// Tag component marker
export interface TagComponent {
    __isTag: true;
}

// Inter-system messaging
export interface SystemMessage {
    type: string;
    data: any;
    sender?: string;
    timestamp: number;
}

// Plugin system
export interface PluginContext {
    // Component registration
    registerComponent<T>(type: ComponentIdentifier<T>): void;
    registerComponentValidator<T>(
        type: ComponentIdentifier<T>,
        validator: ComponentValidator<T>
    ): void;

    // System creation
    createSystem<All extends readonly ComponentIdentifier[]>(
        name: string,
        queryOptions: QueryOptions<All>,
        options: SystemType<ComponentTypes<All>>,
        isFixedUpdate?: boolean
    ): any; // System<ComponentTypes<All>>

    // Query creation
    createQuery<All extends readonly ComponentIdentifier[]>(options: QueryOptions<All>): any; // Query<ComponentTypes<All>>

    // Prefab registration and management
    registerPrefab(name: string, prefab: EntityPrefab): void;
    definePrefab(name: string, factory: EntityPrefabFactory): EntityPrefab;
    extendPrefab(
        baseName: string,
        overrides: Partial<EntityPrefab>,
        newName?: string
    ): EntityPrefab;
    variantOfPrefab(
        baseName: string,
        overrides: {
            components?: { [componentName: string]: any };
            tags?: string[];
            children?: EntityPrefab[];
        },
        newName?: string
    ): EntityPrefab;

    // Event system
    on(event: string, callback: (...args: any[]) => void): () => void;
    emit(event: string, ...args: any[]): void;

    // Message bus
    messageBus: {
        subscribe(messageType: string, callback: (message: SystemMessage) => void): () => void;
        publish(messageType: string, data: any, sender?: string): void;
    };

    // Allow plugins to extend the engine with custom APIs
    extend<T extends object>(extensionName: string, api: T): void;

    // Get engine instance for advanced use cases
    getEngine(): any; // Engine
}

export interface EnginePlugin {
    // Plugin metadata
    name: string;
    version?: string;

    // Installation lifecycle
    install(context: PluginContext): void | Promise<void>;

    // Optional cleanup on uninstall
    uninstall?(): void | Promise<void>;
}

export interface InstalledPlugin {
    plugin: EnginePlugin;
    installedAt: number;
}

// Component pooling
export interface PoolStats {
    available: number;
    totalCreated: number;
    totalAcquired: number;
    totalReleased: number;
    reuseRate: number;
}

export interface ComponentPoolOptions {
    initialSize?: number;
    maxSize?: number;
}
