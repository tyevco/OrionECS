/**
 * @orion-ecs/entity-inspector
 *
 * Web-based entity inspector plugin for OrionECS.
 * Provides real-time debugging and visualization of entities,
 * components, systems, and performance metrics.
 *
 * @packageDocumentation
 * @module EntityInspector
 */

export { EntityInspectorAPI, EntityInspectorPlugin } from './EntityInspectorPlugin';
export type {
    // Message Types
    ClientMessage,
    ComponentAddRequest,
    ComponentProperty,
    ComponentRemoveRequest,
    // Update Types
    ComponentUpdateRequest,
    ConnectionInfo,
    // Statistics
    EngineStats,
    EntitiesResponse,
    EntityCreateRequest,
    // Configuration
    EntityInspectorConfig,
    EntityQueryParams,
    // API Interface
    IEntityInspectorAPI,
    // Event Types
    InspectorEvent,
    InspectorMessage,
    ProfilingData,
    PropertyTypeHint,
    QueryInfo,
    SerializedComponent,
    // Entity Types
    SerializedInspectorEntity,
    ServerMessage,
    SingletonInfo,
    // System Types
    SystemInfo,
    TagRequest,
    UpdateResult,
} from './types';
export { DEFAULT_INSPECTOR_CONFIG } from './types';
