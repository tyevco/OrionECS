
export type ComponentIdentifier<T = any> = (new (...args: any[]) => T);
export type ComponentArgs<T> = T extends new (...args: infer A) => any ? A : never;

export type EventTypes<T = any> = string | Symbol | keyof T;
export type EventCallback<T = void> = ((...args: any[]) => T);

// Enhanced system options with profiling and lifecycle hooks
export interface SystemOptions<C extends any[] = any[]> {
    act?: (entity: EntityDef, ...components: { [K in keyof C]: C[K] }) => void;
    before?: () => void;
    after?: () => void;
    priority?: number;
    enabled?: boolean;
    tags?: string[];
}

export type SystemType<T extends any[] = any[]> = SystemOptions<T> & Partial<EngineEvents>;

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

export type EngineEventNames = keyof EngineEvents | 'onEntityCreated' | 'onEntityReleased' | 'onComponentAdded' | 'onComponentRemoved' | 'onEntityHierarchyChanged';

// Enhanced entity interface
export interface EntityDef {
    id: symbol;
    name?: string;
    parent?: EntityDef;
    children: EntityDef[];
    tags: Set<string>;
    queueFree(): void;
    addComponent<T>(type: new (...args: any[]) => T, ...args: ConstructorParameters<typeof type>): this;
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
export interface QueryOptions {
    all?: ComponentIdentifier[];
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
export interface EntityPrefab {
    name: string;
    components: { type: ComponentIdentifier; args: any[] }[];
    tags: string[];
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

// Archetype system
export interface Archetype {
    id: string;
    signature: Set<ComponentIdentifier>;
    entities: Set<symbol>;
    componentArrays: Map<ComponentIdentifier, any[]>;
}

// Tag component marker
export interface TagComponent {
    __isTag: true;
}

// Scene management
export interface Scene {
    name: string;
    entities: Set<symbol>;
    systems: Set<string>;
    active: boolean;
}

// Inter-system messaging
export interface SystemMessage {
    type: string;
    data: any;
    sender?: string;
    timestamp: number;
}
