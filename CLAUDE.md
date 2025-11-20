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
- **EngineBuilder** (`src/engine.ts`): Fluent builder for composing an Engine from managers
- **Engine** (`src/engine.ts`): Main facade providing a clean API over specialized managers
- **Core Components** (`src/core.ts`): Entity, Query, System, EventEmitter, PerformanceMonitor, EntityManager
- **Managers** (`src/managers.ts`): ComponentManager, SystemManager, QueryManager, PrefabManager, SnapshotManager, MessageManager

## Core Architecture

### Main Files

**src/engine.ts** - Engine facade and builder
- `EngineBuilder`: Fluent API for configuring and building an Engine instance
- `Engine`: Main class providing a clean API over the manager-based architecture

**src/core.ts** - Core ECS components
- `Entity`: Full-featured entities with hierarchy, tags, and serialization
- `System`: Advanced systems with profiling, priority, and lifecycle hooks
- `Query`: Advanced query system with ALL/ANY/NOT and tag support
- `ComponentArray`: Enhanced sparse arrays with change tracking
- `Pool`: Advanced object pooling with metrics
- `EventEmitter`: Enhanced event system with history
- `PerformanceMonitor`: Frame time tracking and statistics
- `EntityManager`: Entity lifecycle and pooling management

**src/managers.ts** - Specialized manager classes
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
- Main engine tests: `src/engine.spec.ts`
- Benchmarks: `**/*.bench.ts` files in `/benchmarks/` directory
- Benchmark config uses specialized jest-bench environment for performance testing

### Implementation Files
- `src/engine.ts` - Engine facade and EngineBuilder for composition-based architecture
- `src/core.ts` - Core ECS components (Entity, Query, System, EventEmitter, etc.)
- `src/managers.ts` - Focused manager classes for separation of concerns
- `src/definitions.ts` - TypeScript interfaces and type definitions
- `src/index.ts` - Public API exports

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

// Tag components for categorization
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
- Bulk creation: `engine.createEntities(10, prefabTemplate)`
- Hierarchies: `parent.addChild(child)` or `child.setParent(parent)`
- Tags: `entity.addTag('player').addTag('active')`
- Prefabs: `engine.createFromPrefab('PlayerPrefab', 'Player1')`

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

### Plugin System

Orion ECS features a powerful plugin architecture that allows contributors to add new features without modifying the core project. Plugins can register components, create systems, add custom APIs, and more.

**Creating a Plugin:**
```typescript
import type { EnginePlugin, PluginContext } from 'orion-ecs';

class MyPlugin implements EnginePlugin {
  name = 'MyPlugin';
  version = '1.0.0';

  install(context: PluginContext): void {
    // Register components
    context.registerComponent(MyComponent);

    // Create systems
    context.createSystem('MySystem',
      { all: [MyComponent] },
      { act: (entity, component) => { /* ... */ } }
    );

    // Extend engine with custom API
    context.extend('myApi', new MyAPI());

    // Subscribe to events
    context.on('onEntityCreated', (entity) => {
      console.log('Entity created:', entity);
    });

    // Use message bus
    context.messageBus.subscribe('custom-event', (msg) => {
      console.log('Received:', msg.data);
    });
  }

  uninstall(): void {
    // Optional cleanup
    console.log('Plugin uninstalled');
  }
}
```

**Using Plugins:**
```typescript
import { EngineBuilder } from 'orion-ecs';
import { PhysicsPlugin } from './plugins/PhysicsPlugin';
import { NetworkingPlugin } from './plugins/NetworkingPlugin';

const engine = new EngineBuilder()
  .use(new PhysicsPlugin())
  .use(new NetworkingPlugin())
  .withDebugMode(true)
  .build();

// Access plugin-provided APIs
engine.physics.setGravity(0, 9.8);
engine.networking.connect('ws://server.com');
```

**Plugin Context API:**
The `PluginContext` provides plugins with safe access to:
- `registerComponent(type)` - Register component classes
- `registerComponentValidator(type, validator)` - Add component validation
- `createSystem(name, query, options, isFixed?)` - Create new systems
- `createQuery(options)` - Create entity queries
- `registerPrefab(name, prefab)` - Register entity templates
- `on(event, callback)` - Subscribe to engine events
- `emit(event, ...args)` - Emit custom events
- `messageBus` - Inter-system messaging
- `extend(name, api)` - Add custom APIs to engine instance
- `getEngine()` - Access full engine for advanced use cases

**Plugin Management:**
```typescript
// Check if plugin is installed
if (engine.hasPlugin('PhysicsPlugin')) {
  console.log('Physics plugin is active');
}

// Get plugin information
const pluginInfo = engine.getPlugin('PhysicsPlugin');
console.log(`Installed at: ${new Date(pluginInfo.installedAt)}`);

// List all plugins
const plugins = engine.getInstalledPlugins();
plugins.forEach(p => {
  console.log(`${p.plugin.name} v${p.plugin.version || 'unknown'}`);
});

// Uninstall a plugin
await engine.uninstallPlugin('PhysicsPlugin');
```

**Example Plugins:**
- **Physics** - Box2D/Matter.js integration with RigidBody, Collider components
- **Networking** - Multiplayer synchronization and client prediction
- **Audio** - Spatial audio with AudioSource components
- **AI** - Behavior trees and pathfinding systems
- **Rendering** - Pixi.js, Three.js, or custom renderer integration

See `examples/PhysicsPlugin.ts` for a complete working example.

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