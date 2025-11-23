/**
 * OrionECS v2.0 - Composition-based Entity Component System
 * Main entry point
 */

// Export archetype system
export { Archetype, ArchetypeManager } from './archetype';
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
    ChangeTrackingOptions,
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
    ChangeTrackingManager,
    ComponentManager,
    MessageManager,
    PrefabManager,
    QueryManager,
    SnapshotManager,
    SystemManager,
} from './managers';
export type { CustomMatchers, TestEntityOptions } from './testing';

// Export testing utilities
export {
    assertEngineClean,
    createMockComponent,
    createTestEntities,
    createTestEntity,
    createTestEntityFromPrefab,
    getEntitySummary,
    setupTestMatchers,
    TestClock,
    TestEngineBuilder,
    TestSnapshot,
    TestSystemRunner,
    waitFrames,
    waitUntil,
} from './testing';
// Export utility functions
export { createTagComponent } from './utils';
