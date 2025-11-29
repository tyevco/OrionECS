/**
 * Types and Interfaces for Entity Inspector Plugin
 *
 * Defines all data structures for:
 * - WebSocket message protocol
 * - Entity/Component/System serialization
 * - Inspector configuration
 * - Real-time update streaming
 */

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration options for the Entity Inspector Plugin.
 */
export interface EntityInspectorConfig {
    /** WebSocket server port (default: 8765) */
    port: number;
    /** WebSocket server host (default: 'localhost') */
    host: string;
    /** Update interval in milliseconds for auto-refresh (default: 100) */
    updateInterval: number;
    /** Maximum entities to return in a single response (default: 1000) */
    maxEntities: number;
    /** Enable performance profiling data (default: true) */
    enableProfiling: boolean;
    /** Enable memory statistics (default: true) */
    enableMemoryStats: boolean;
    /** Enable verbose logging (default: false) */
    debug: boolean;
}

/**
 * Default configuration values.
 */
export const DEFAULT_INSPECTOR_CONFIG: EntityInspectorConfig = {
    port: 8765,
    host: 'localhost',
    updateInterval: 100,
    maxEntities: 1000,
    enableProfiling: true,
    enableMemoryStats: true,
    debug: false,
};

// =============================================================================
// WebSocket Message Types
// =============================================================================

/**
 * Base message structure for WebSocket communication.
 */
export interface InspectorMessage {
    /** Message type identifier */
    type: string;
    /** Unique message ID for request/response correlation */
    id?: string;
    /** Timestamp when message was created */
    timestamp: number;
    /** Message payload */
    data?: unknown;
}

/**
 * Client-to-server message types.
 */
export type ClientMessage =
    | { type: 'subscribe'; id?: string; timestamp: number; data: { events: string[] } }
    | { type: 'unsubscribe'; id?: string; timestamp: number; data: { events: string[] } }
    | { type: 'get_entities'; id?: string; timestamp: number; data?: EntityQueryParams }
    | { type: 'get_entity'; id?: string; timestamp: number; data: { entityId: string } }
    | { type: 'get_systems'; id?: string; timestamp: number }
    | { type: 'get_queries'; id?: string; timestamp: number }
    | { type: 'get_singletons'; id?: string; timestamp: number }
    | { type: 'get_stats'; id?: string; timestamp: number }
    | { type: 'get_profiling'; id?: string; timestamp: number }
    | { type: 'update_component'; id?: string; timestamp: number; data: ComponentUpdateRequest }
    | { type: 'add_component'; id?: string; timestamp: number; data: ComponentAddRequest }
    | { type: 'remove_component'; id?: string; timestamp: number; data: ComponentRemoveRequest }
    | { type: 'add_tag'; id?: string; timestamp: number; data: TagRequest }
    | { type: 'remove_tag'; id?: string; timestamp: number; data: TagRequest }
    | { type: 'create_entity'; id?: string; timestamp: number; data?: EntityCreateRequest }
    | { type: 'delete_entity'; id?: string; timestamp: number; data: { entityId: string } }
    | { type: 'pause'; id?: string; timestamp: number }
    | { type: 'resume'; id?: string; timestamp: number }
    | { type: 'step'; id?: string; timestamp: number }
    | { type: 'ping'; id?: string; timestamp: number };

/**
 * Server-to-client message types.
 */
export type ServerMessage =
    | { type: 'connected'; id?: string; timestamp: number; data: ConnectionInfo }
    | { type: 'entities'; id?: string; timestamp: number; data: EntitiesResponse }
    | { type: 'entity'; id?: string; timestamp: number; data: SerializedInspectorEntity | null }
    | { type: 'systems'; id?: string; timestamp: number; data: SystemInfo[] }
    | { type: 'queries'; id?: string; timestamp: number; data: QueryInfo[] }
    | { type: 'singletons'; id?: string; timestamp: number; data: SingletonInfo[] }
    | { type: 'stats'; id?: string; timestamp: number; data: EngineStats }
    | { type: 'profiling'; id?: string; timestamp: number; data: ProfilingData }
    | { type: 'update_result'; id?: string; timestamp: number; data: UpdateResult }
    | { type: 'event'; id?: string; timestamp: number; data: InspectorEvent }
    | { type: 'error'; id?: string; timestamp: number; data: { message: string; code?: string } }
    | { type: 'pong'; id?: string; timestamp: number };

// =============================================================================
// Entity Serialization Types
// =============================================================================

/**
 * Query parameters for filtering entities.
 */
export interface EntityQueryParams {
    /** Filter by entity name (substring match) */
    name?: string;
    /** Filter by tags (entities must have all specified tags) */
    tags?: string[];
    /** Filter by component types (entities must have all specified components) */
    components?: string[];
    /** Filter by archetype ID */
    archetypeId?: string;
    /** Include child entities in results */
    includeChildren?: boolean;
    /** Maximum number of entities to return */
    limit?: number;
    /** Offset for pagination */
    offset?: number;
}

/**
 * Serialized entity data for inspector display.
 */
export interface SerializedInspectorEntity {
    /** Entity ID (stringified symbol description) */
    id: string;
    /** Entity name */
    name?: string;
    /** Tags on the entity */
    tags: string[];
    /** Serialized component data */
    components: SerializedComponent[];
    /** Parent entity ID */
    parentId?: string;
    /** Child entity IDs */
    childIds: string[];
    /** Whether entity is marked for deletion */
    isMarkedForDeletion: boolean;
    /** Whether entity has pending changes */
    isDirty: boolean;
    /** Archetype ID if using archetype system */
    archetypeId?: string;
}

/**
 * Serialized component data.
 */
export interface SerializedComponent {
    /** Component type name */
    type: string;
    /** Component property values */
    properties: ComponentProperty[];
    /** Whether component is read-only */
    readOnly?: boolean;
}

/**
 * Individual component property for editing.
 */
export interface ComponentProperty {
    /** Property name */
    name: string;
    /** Property value (JSON-serializable) */
    value: unknown;
    /** Property type hint for UI rendering */
    typeHint: PropertyTypeHint;
    /** Whether property is editable */
    editable: boolean;
    /** Optional min value for numeric types */
    min?: number;
    /** Optional max value for numeric types */
    max?: number;
    /** Optional step for numeric types */
    step?: number;
    /** Optional enum values for select type */
    enumValues?: string[];
}

/**
 * Type hints for property editor UI.
 */
export type PropertyTypeHint =
    | 'string'
    | 'number'
    | 'boolean'
    | 'object'
    | 'array'
    | 'color'
    | 'vector2'
    | 'vector3'
    | 'enum'
    | 'entity-ref'
    | 'unknown';

// =============================================================================
// System and Query Types
// =============================================================================

/**
 * System information for inspector display.
 */
export interface SystemInfo {
    /** System name */
    name: string;
    /** System priority (execution order) */
    priority: number;
    /** Whether this is a fixed update system */
    isFixedUpdate: boolean;
    /** System tags */
    tags: string[];
    /** Query options used by the system */
    queryOptions: {
        all?: string[];
        any?: string[];
        none?: string[];
        tags?: string[];
    };
    /** Performance profile data */
    profile?: {
        executionTime: number;
        entityCount: number;
        callCount: number;
        averageTime: number;
    };
}

/**
 * Query information for inspector display.
 */
export interface QueryInfo {
    /** Query identifier */
    id: string;
    /** Query options */
    options: {
        all?: string[];
        any?: string[];
        none?: string[];
        tags?: string[];
    };
    /** Number of matching entities */
    entityCount: number;
}

/**
 * Singleton component information.
 */
export interface SingletonInfo {
    /** Component type name */
    type: string;
    /** Serialized component data */
    component: SerializedComponent;
}

// =============================================================================
// Statistics and Profiling Types
// =============================================================================

/**
 * Overall engine statistics.
 */
export interface EngineStats {
    /** Total entities in the engine */
    totalEntities: number;
    /** Active (non-deleted) entities */
    activeEntities: number;
    /** Number of registered systems */
    systemCount: number;
    /** Number of registered queries */
    queryCount: number;
    /** Number of registered component types */
    componentTypeCount: number;
    /** Component type usage breakdown */
    componentCounts: Record<string, number>;
    /** Archetype statistics (if archetype system enabled) */
    archetypeStats?: {
        count: number;
        entityCounts: Record<string, number>;
    };
    /** Memory statistics */
    memory?: {
        totalMemoryEstimate: number;
        componentArrays: Record<string, number>;
    };
    /** Current frame number */
    frameNumber?: number;
    /** Whether engine is paused */
    isPaused: boolean;
}

/**
 * Performance profiling data.
 */
export interface ProfilingData {
    /** Timestamp when profiling data was collected */
    timestamp: number;
    /** Frame time in milliseconds */
    frameTime: number;
    /** System execution profiles */
    systems: Array<{
        name: string;
        executionTime: number;
        entityCount: number;
        callCount: number;
        averageTime: number;
    }>;
    /** Total system execution time */
    totalSystemTime: number;
    /** Frame rate (FPS) */
    fps: number;
    /** Frame time breakdown */
    breakdown: {
        systems: number;
        queries: number;
        other: number;
    };
}

// =============================================================================
// Update Request Types
// =============================================================================

/**
 * Request to update a component property.
 */
export interface ComponentUpdateRequest {
    /** Entity ID */
    entityId: string;
    /** Component type name */
    componentType: string;
    /** Property name */
    propertyName: string;
    /** New property value */
    value: unknown;
}

/**
 * Request to add a component to an entity.
 */
export interface ComponentAddRequest {
    /** Entity ID */
    entityId: string;
    /** Component type name */
    componentType: string;
    /** Initial property values */
    initialValues?: Record<string, unknown>;
}

/**
 * Request to remove a component from an entity.
 */
export interface ComponentRemoveRequest {
    /** Entity ID */
    entityId: string;
    /** Component type name */
    componentType: string;
}

/**
 * Request to add or remove a tag.
 */
export interface TagRequest {
    /** Entity ID */
    entityId: string;
    /** Tag name */
    tag: string;
}

/**
 * Request to create a new entity.
 */
export interface EntityCreateRequest {
    /** Entity name */
    name?: string;
    /** Initial tags */
    tags?: string[];
    /** Parent entity ID */
    parentId?: string;
}

/**
 * Result of an update operation.
 */
export interface UpdateResult {
    /** Whether the operation succeeded */
    success: boolean;
    /** Error message if failed */
    error?: string;
    /** Updated entity data (if applicable) */
    entity?: SerializedInspectorEntity;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Inspector event for real-time updates.
 */
export interface InspectorEvent {
    /** Event type */
    eventType:
        | 'entity_created'
        | 'entity_deleted'
        | 'component_added'
        | 'component_removed'
        | 'component_changed'
        | 'tag_added'
        | 'tag_removed'
        | 'singleton_set'
        | 'singleton_removed'
        | 'system_added'
        | 'system_removed'
        | 'frame_update';
    /** Entity ID (if applicable) */
    entityId?: string;
    /** Component type (if applicable) */
    componentType?: string;
    /** Tag name (if applicable) */
    tag?: string;
    /** Additional event data */
    data?: unknown;
}

// =============================================================================
// Connection Types
// =============================================================================

/**
 * Connection information sent when a client connects.
 */
export interface ConnectionInfo {
    /** Plugin version */
    version: string;
    /** Server configuration */
    config: Partial<EntityInspectorConfig>;
    /** Available component types */
    componentTypes: string[];
    /** Available system names */
    systems: string[];
    /** Current engine state */
    isPaused: boolean;
}

/**
 * Response for entity list queries.
 */
export interface EntitiesResponse {
    /** List of serialized entities */
    entities: SerializedInspectorEntity[];
    /** Total count (may be more than returned due to limit) */
    totalCount: number;
    /** Offset used for pagination */
    offset: number;
    /** Limit used for pagination */
    limit: number;
}

// =============================================================================
// Inspector API Interface
// =============================================================================

/**
 * Public API exposed by the Entity Inspector Plugin.
 */
export interface IEntityInspectorAPI {
    /** Start the WebSocket server */
    start(): Promise<void>;
    /** Stop the WebSocket server */
    stop(): Promise<void>;
    /** Check if server is running */
    readonly isRunning: boolean;
    /** Get the server URL */
    readonly serverUrl: string;
    /** Get connection count */
    readonly connectionCount: number;
    /** Pause the engine (inspection mode) */
    pause(): void;
    /** Resume the engine */
    resume(): void;
    /** Step one frame while paused */
    step(): void;
    /** Check if engine is paused */
    readonly isPaused: boolean;
    /** Get all entities (for programmatic access) */
    getEntities(params?: EntityQueryParams): SerializedInspectorEntity[];
    /** Get a single entity by ID */
    getEntity(entityId: string): SerializedInspectorEntity | null;
    /** Get system information */
    getSystems(): SystemInfo[];
    /** Get engine statistics */
    getStats(): EngineStats;
    /** Get profiling data */
    getProfiling(): ProfilingData;
    /** Broadcast an event to all connected clients */
    broadcast(event: InspectorEvent): void;
}
