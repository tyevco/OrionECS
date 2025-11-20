/**
 * OrionECS v2.0 - Composition-based Entity Component System
 * Main entry point
 */

// Export the new Engine and Builder
export { Engine, EngineBuilder } from './engine-v2';

// Export core building blocks
export {
    Entity,
    Query,
    System,
    Pool,
    ComponentArray,
    MessageBus,
    EventEmitter,
    PerformanceMonitor,
    EntityManager
} from './core';

// Export managers
export {
    ComponentManager,
    SystemManager,
    QueryManager,
    PrefabManager,
    SnapshotManager,
    MessageManager
} from './managers';

// Export all type definitions
export type {
    ComponentIdentifier,
    ComponentArgs,
    EventTypes,
    EventCallback,
    SystemOptions,
    SystemType,
    EngineEvents,
    EngineEventNames,
    EntityDef,
    QueryOptions,
    SerializedEntity,
    SerializedWorld,
    EntityPrefab,
    SystemProfile,
    MemoryStats,
    ComponentValidator,
    TagComponent,
    SystemMessage
} from './definitions';
