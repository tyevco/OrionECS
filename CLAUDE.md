# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Orion ECS is a comprehensive Entity Component System (ECS) framework written in TypeScript. The framework uses a **composition-based architecture (v2.0)** with focused managers for separation of concerns, providing advanced capabilities for building complex games and simulations.

### Core Architecture Patterns

- **Entity**: Advanced objects with unique symbol IDs, hierarchical relationships, tags, and serialization
- **Component**: Data-only structures with validation, dependencies, and pooling support
- **System**: Logic processors with priority, profiling, and advanced query capabilities
- **Engine**: Central facade that coordinates specialized managers for different responsibilities

### Composition-Based Architecture (v2.0)

The implementation uses focused managers for separation of concerns:
- **EngineBuilder** (`core/src/engine.ts`): Fluent builder for composing an Engine from managers
- **Engine** (`core/src/engine.ts`): Main facade providing a clean API over specialized managers
- **Core Components** (`core/src/core.ts`): Entity, Query, System, EventEmitter, PerformanceMonitor, EntityManager
- **Managers** (`core/src/managers.ts`): ComponentManager, SystemManager, QueryManager, PrefabManager, SnapshotManager, MessageManager

## Core Architecture

### Main Files

**core/src/engine.ts** - Engine facade and builder
- `EngineBuilder`: Fluent API for configuring and building an Engine instance
- `Engine`: Main class providing a clean API over the manager-based architecture

**core/src/core.ts** - Core ECS components
- `Entity`: Full-featured entities with hierarchy, tags, and serialization
- `System`: Advanced systems with profiling, priority, and lifecycle hooks
- `Query`: Advanced query system with ALL/ANY/NOT and tag support
- `ComponentArray`: Enhanced sparse arrays with change tracking
- `Pool`: Advanced object pooling with metrics
- `EventEmitter`: Enhanced event system with history
- `PerformanceMonitor`: Frame time tracking and statistics
- `EntityManager`: Entity lifecycle and pooling management

**core/src/managers.ts** - Specialized manager classes
- `ComponentManager`: Component registration, validation, and storage
- `SystemManager`: System execution, profiling, and fixed/variable update handling
- `QueryManager`: Query creation and entity matching
- `PrefabManager`: Entity template registration and retrieval
- `SnapshotManager`: World state snapshot creation and restoration
- `MessageManager`: Inter-system messaging and communication

### Complete Feature Set

**Performance & Memory Enhancements:**
- Component archetype system for cache locality and performance
- Advanced object pooling with metrics and reuse tracking
- Component change detection and versioning
- Memory usage analysis and profiling tools
- Performance monitoring utilities

**Developer Experience:**
- Entity hierarchies (parent/child relationships)
- Entity naming and tagging system
- Component validation and dependency checking
- Enhanced error messages with entity context
- Debug mode with comprehensive logging
- System execution profiling and timing

**Advanced Query System:**
- ALL queries (entities with all specified components)
- ANY queries (entities with any of specified components) 
- NOT queries (entities WITHOUT specified components)
- Tag-based queries for flexible entity categorization
- Query result caching and optimization

**System Management:**
- System priority ordering and execution groups
- Runtime system enable/disable functionality
- System tagging and categorization
- Inter-system messaging and event communication
- System lifecycle hooks (before/after execution)

**Entity Features:**
- Entity prefab/template system for rapid creation
- Bulk entity operations (create/destroy multiple entities)
- Entity serialization and world state snapshots
- Entity hierarchy with parent/child relationships
- Component pooling for frequently used components

**Validation & Safety:**
- Component dependencies and conflict checking
- Runtime component validation with custom validators
- Type-safe component access with detailed error messages
- Comprehensive debug information and inspection tools

### System Architecture

The Engine supports:
- **Variable update systems**: Run every frame with delta time
- **Fixed update systems**: Run at fixed intervals (60 FPS default) with accumulator-based timing
- **System Priority**: Higher priority systems execute first
- **System Tags**: Categorize and group related systems
- **Runtime Control**: Enable/disable systems during execution
- **Profiling**: Automatic execution time and entity count tracking
- **Message Bus**: Inter-system communication without tight coupling

Entity lifecycle is managed through advanced object pooling to minimize garbage collection, with entities marked for deletion and cleaned up after each frame.

## Development Commands

### Build and Test
- `npm run build` - Build with tsup (outputs CommonJS and ESM to `dist/` with type declarations)
- `npm test` - Run comprehensive unit tests using Jest
- `npm run benchmark` - Run performance benchmarks using jest-bench

### Testing Details
- Tests use Jest with ts-jest preset
- Main engine tests: `core/src/engine.spec.ts`
- Benchmarks: `**/*.bench.ts` files in `/benchmarks/` directory
- Benchmark config uses specialized jest-bench environment for performance testing

### Repository Structure
The repository uses a monorepo structure with npm workspaces:

- Root `/` - Workspace coordinator
  - `package.json` - Workspace configuration and shared scripts
  - `.husky/`, linter configs - Repository-level tooling
  - `benchmarks/` - Performance benchmarks
  - `examples/` - Example games and integrations

- `core/` - Core OrionECS engine package
  - `package.json` - Core package configuration
  - `tsconfig.json` - Core TypeScript configuration
  - `tsup.config.ts` - Core build configuration
  - `jest.config.js` - Core test configuration
  - `src/` - Core implementation
    - `engine.ts` - Engine facade and EngineBuilder
    - `core.ts` - Core ECS components (Entity, Query, System, etc.)
    - `managers.ts` - Specialized manager classes
    - `archetype.ts` - Archetype and ArchetypeManager for performance optimization
    - `definitions.ts` - TypeScript interfaces and type definitions
    - `index.ts` - Public API exports
    - `engine.spec.ts` - Comprehensive test suite
    - `archetype.spec.ts` - Archetype system tests

- `plugins/` - Official OrionECS plugins (each can be a separate package)
  - `physics/src/PhysicsPlugin.ts` - Rigid body dynamics
  - `spatial-partition/src/SpatialPartitionPlugin.ts` - Collision detection
  - `debug-visualizer/src/DebugVisualizerPlugin.ts` - Debug tools
  - `profiling/src/ProfilingPlugin.ts` - Performance metrics
  - `resource-manager/src/ResourceManagerPlugin.ts` - Asset management
  - Each plugin directory ready for its own `package.json`

- `examples/` - Sample applications
  - `games/` - Complete game examples (Asteroids, Platformer)
  - `integrations/` - Framework integrations (Pixi.js)

## Code Patterns

### Component Definition
Components should be simple data classes with optional validation:
```typescript
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Health {
  constructor(public current: number = 100, public max: number = 100) {}
}

// Tag components for categorization (from utils.ts)
import { createTagComponent } from 'orion-ecs';
const PlayerTag = createTagComponent('Player');
```

### System Creation
Systems are created with advanced queries and comprehensive options:
```typescript
engine.createSystem('MovementSystem', {
  all: [Position, Velocity],  // Must have both components
  none: [Frozen],            // Must not have Frozen component
  tags: ['active']           // Must have 'active' tag
}, {
  priority: 10,              // Higher priority = runs first
  before: () => { },         // Pre-execution hook
  act: (entity, position, velocity) => {
    position.x += velocity.x;
    position.y += velocity.y;
  },
  after: () => { }           // Post-execution hook
}, false); // false = variable update, true = fixed update
```

### Entity Management

**Basic Operations:**
- Create entities: `engine.createEntity('EntityName')`
- Components: `entity.addComponent(ComponentClass, ...args)`
- Cleanup: `entity.queueFree()` for deferred deletion

**Advanced Features:**
- Bulk creation: `engine.createEntities(10)` or `engine.createEntities(10, 'PrefabName')`
- Hierarchies: `parent.addChild(child)` or `child.setParent(parent)`
- Tags: `entity.addTag('player').addTag('active')`
- Prefabs: `engine.createFromPrefab('PlayerPrefab', 'Player1')`
- Component pooling: `engine.registerComponentPool(Particle, { initialSize: 100 })`

### Advanced Features Usage

**Component Validation:**
```typescript
engine.registerComponentValidator(Health, {
  validate: (component) => component.current >= 0 ? true : 'Health cannot be negative',
  dependencies: [Position],  // Requires Position component
  conflicts: [Ghost]         // Cannot coexist with Ghost component  
});
```

**Entity Prefabs:**
```typescript
const playerPrefab: EntityPrefab = {
  name: 'Player',
  components: [
    { type: Position, args: [0, 0] },
    { type: Health, args: [100, 100] }
  ],
  tags: ['player', 'controllable']
};
engine.registerPrefab('Player', playerPrefab);
```

**Inter-System Messaging:**
```typescript
// In one system
engine.messageBus.publish('enemy-killed', { score: 100 }, 'CombatSystem');

// In another system
engine.messageBus.subscribe('enemy-killed', (message) => {
  this.updateScore(message.data.score);
});
```

**Performance Monitoring:**
```typescript
const profiles = engine.getSystemProfiles();
const memoryStats = engine.getMemoryStats();
const debugInfo = engine.getDebugInfo();
```

### Entity Archetype System

Orion ECS implements an advanced archetype system inspired by Unity DOTS and Bevy ECS for significant performance improvements through better cache locality.

**What are Archetypes?**

Archetypes group entities with the same component composition together in contiguous memory. When you iterate over entities with specific components, all data is stored together, dramatically improving cache performance.

**Key Benefits:**
- **Cache Locality**: Components for entities with same composition stored contiguously
- **Faster Iteration**: Systems iterate over dense arrays instead of sparse lookups
- **Automatic Management**: Entities automatically move between archetypes when components change
- **Query Optimization**: Queries match entire archetypes instead of testing individual entities

**Enable/Disable Archetypes:**

Archetypes are **enabled by default**. You can disable them if needed:

```typescript
// Archetypes enabled (default, recommended)
const engine = new EngineBuilder().build();

// Explicitly enable archetypes
const engineWithArchetypes = new EngineBuilder()
  .withArchetypes(true)
  .build();

// Disable archetypes (legacy mode)
const engineWithoutArchetypes = new EngineBuilder()
  .withArchetypes(false)
  .build();
```

**How Archetypes Work:**

When you add or remove components, entities automatically move to the appropriate archetype:

```typescript
const entity = engine.createEntity();
// Entity is in empty archetype: ""

entity.addComponent(Position, 0, 0);
// Entity moved to archetype: "Position"

entity.addComponent(Velocity, 1, 1);
// Entity moved to archetype: "Position,Velocity"

entity.removeComponent(Position);
// Entity moved to archetype: "Velocity"
```

**Performance Impact:**

Systems that iterate over many entities with the same components see significant performance improvements:

```typescript
// Create 10,000 entities with same composition
for (let i = 0; i < 10000; i++) {
  const entity = engine.createEntity();
  entity.addComponent(Position, i, i);
  entity.addComponent(Velocity, 1, 1);
}
// All 10,000 entities are in the same archetype "Position,Velocity"

// This system iteration is highly cache-friendly
engine.createSystem('MovementSystem', {
  all: [Position, Velocity]
}, {
  act: (entity, position, velocity) => {
    // Components are accessed sequentially in memory
    position.x += velocity.x;
    position.y += velocity.y;
  }
});
```

**Monitoring Archetypes:**

You can inspect archetype statistics for debugging and optimization:

```typescript
// Check if archetypes are enabled
const enabled = engine.areArchetypesEnabled();

// Get archetype statistics
const stats = engine.getArchetypeStats();
console.log(stats);
// {
//   archetypeCount: 5,
//   archetypeCreationCount: 5,
//   entityMovementCount: 10,
//   archetypes: [
//     { id: "Position,Velocity", entityCount: 5000, componentTypeCount: 2 },
//     { id: "Position", entityCount: 1000, componentTypeCount: 1 },
//     ...
//   ]
// }

// Get memory statistics
const memStats = engine.getArchetypeMemoryStats();
console.log(memStats);
// {
//   totalEntities: 6000,
//   totalArchetypes: 5,
//   estimatedBytes: 384000,
//   archetypeBreakdown: [...]
// }
```

**When to Use Archetypes:**

- ✅ **Recommended**: Games and simulations with many entities
- ✅ **Ideal**: Systems that iterate over large numbers of entities
- ✅ **Best**: Entities that share common component compositions
- ⚠️ **Consider disabling**: Prototyping with frequently changing component structures
- ⚠️ **Less beneficial**: Very few entities (< 100) or highly diverse component compositions

**Performance Benchmarks:**

See `benchmarks/archetype-benchmark.ts` for comprehensive performance comparisons showing 2-5x iteration speed improvements with archetypes enabled.

### Plugin System

Orion ECS features a powerful plugin architecture for extending functionality without modifying core code.

**Plugin Architecture Notes:**
- Plugins implement the `EnginePlugin` interface (`core/src/definitions.ts`)
- Use `PluginContext` for sandboxed access to engine features
- Register plugins via `EngineBuilder.use(plugin)` before building
- Plugins installed during engine construction (see `core/src/engine.ts` EngineBuilder)
- Custom APIs added via `context.extend()` become properties on engine instance

**Implementation Pattern:**
```typescript
// Basic plugin structure
class MyPlugin implements EnginePlugin {
  name = 'MyPlugin';
  version = '1.0.0';

  install(context: PluginContext): void {
    // Register components, create systems, extend API
    context.extend('myApi', { /* custom methods */ });
  }

  uninstall?(): void { /* cleanup */ }
}

// Usage
const engine = new EngineBuilder()
  .use(new MyPlugin())
  .build();
```

**Common Plugin Use Cases:**
- **Feature Extensions**: Physics, networking, audio systems
- **Utility Functions**: Bulk operations, search methods, cloning
- **Integrations**: Rendering engines (Pixi.js, Three.js), UI frameworks
- **Development Tools**: Debuggers, visualizers, profilers

**Reference Implementation:** See `plugins/physics/src/PhysicsPlugin.ts` for a complete, tested plugin example.

**For detailed plugin API and examples, see README.md Plugin System section.**

## When to Use Orion ECS

### Ideal For:
- Complex games and simulations requiring advanced ECS features
- Applications needing entity hierarchies and relationships
- Projects requiring comprehensive debugging and profiling tools
- Systems needing component validation and error handling
- Applications with inter-system communication requirements
- Development environments where debugging assistance is important
- Production systems requiring high performance with rich features

### Consider Alternatives For:
- Extremely simple applications with minimal ECS needs
- Ultra-resource-constrained environments (embedded systems)
- Applications where bundle size is more critical than features

## TypeScript Configuration

- Target: ES6 with CommonJS modules
- Strict mode enabled
- Declarations generated for library distribution
- Test files excluded from compilation
- Comprehensive type definitions for all features

## Performance Considerations

- Engine optimized for high performance with comprehensive features
- Built-in performance monitoring and profiling tools
- Component pooling available for frequently created/destroyed components
- Archetype system improves cache locality and performance
- Query caching reduces repeated entity lookups
- Advanced object pooling minimizes garbage collection pressure
- Debug mode can be disabled in production for maximum performance

## Getting Started

To use Orion ECS in your project:
1. Install with `npm install orion-ecs`
2. Import the EngineBuilder class: `import { EngineBuilder } from 'orion-ecs'`
3. Build your engine with desired configuration:
   ```typescript
   const engine = new EngineBuilder()
     .withDebugMode(true)
     .withFixedUpdateFPS(60)
     .withMaxFixedIterations(10)
     .build();
   ```
4. Create systems using the advanced query syntax
5. Use component validators for robust development
6. Leverage advanced features like tags, hierarchies, and prefabs
7. Enable debug mode during development for enhanced error messages