/**
 * OrionECS v2.0 - Composition-based Entity Component System
 * Main entry point
 */

// Export core building blocks
export {
    ComponentArray,
    Entity,
    EntityManager,
    EventEmitter,
    MessageBus,
    PerformanceMonitor,
    Pool,
    Query,
    QueryBuilder,
    System,
    SystemGroup,
} from './core';
// Export all type definitions
export type {
    ComponentArgs,
    ComponentIdentifier,
    ComponentPoolOptions,
    ComponentValidator,
    EngineEventNames,
    EngineEvents,
    EnginePlugin,
    EntityDef,
    EntityPrefab,
    EventCallback,
    EventTypes,
    InstalledPlugin,
    MemoryStats,
    PluginContext,
    PoolStats,
    QueryOptions,
    QueryStats,
    SerializedEntity,
    SerializedWorld,
    SystemMessage,
    SystemOptions,
    SystemProfile,
    SystemType,
    TagComponent,
} from './definitions';
// Export the new Engine and Builder
export { Engine, EngineBuilder } from './engine';

// Export managers
export {
    ComponentManager,
    MessageManager,
    PrefabManager,
    QueryManager,
    SnapshotManager,
    SystemManager,
} from './managers';
// Export utility functions
export { createTagComponent } from './utils';
