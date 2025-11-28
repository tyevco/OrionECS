/**
 * OrionECS v2.0 - Composition-based Entity Component System
 * Main entry point
 */

// Export archetype system
export {
    Archetype,
    ArchetypeManager,
    ComponentTypeRegistry,
    MemoryEstimationConfig,
} from './archetype';
export type {
    CommandExecutionResult,
    CommandType,
    EntityCommand,
} from './commands';
// Export command buffer system
export {
    CommandBuffer,
    EntityCommandBuilder,
    SpawnEntityBuilder,
} from './commands';
// Export core building blocks
export {
    ARCHETYPE_STORAGE_INDEX,
    CircularBuffer,
    ComponentArray,
    Entity,
    EntityIdGenerator,
    EntityManager,
    EventEmitter,
    EventSubscriptionManager,
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
    ChangeTrackingOptions,
    // Hierarchy event types
    ChildAddedEvent,
    ChildAddedListener,
    ChildRemovedEvent,
    ChildRemovedListener,
    ComponentAddedEvent,
    ComponentAddedListener,
    ComponentArgs,
    ComponentChangeEvent,
    ComponentChangeListener,
    ComponentIdentifier,
    ComponentLifecycle,
    ComponentPoolOptions,
    ComponentRemovedEvent,
    ComponentRemovedListener,
    ComponentValidator,
    EngineEventNames,
    EngineEvents,
    EnginePlugin,
    EntityDef,
    EntityPrefab,
    EventCallback,
    EventTypes,
    ExtractPluginExtensions,
    InstalledPlugin,
    Logger,
    LogLevel,
    MemoryStats,
    ParentChangedEvent,
    ParentChangedListener,
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
// Export logger utilities
export { EngineLogger, sanitizeLogString } from './logger';
// Export managers
export {
    ChangeTrackingManager,
    ComponentManager,
    MessageManager,
    PrefabManager,
    QueryManager,
    SnapshotManager,
    SystemManager,
} from './managers';
// Export utility functions
export { createTagComponent, deepCloneComponent } from './utils';
