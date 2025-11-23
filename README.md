# Orion ECS

[![npm version](https://img.shields.io/npm/v/orion-ecs.svg)](https://www.npmjs.com/package/orion-ecs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Documentation](https://img.shields.io/badge/docs-API%20Reference-brightgreen)](https://tyevco.github.io/OrionECS/api/)

Orion ECS is a comprehensive and high-performance Entity Component System (ECS) framework written in TypeScript. It provides advanced features for building complex games, simulations, and interactive applications with component-based architecture.

## Features

### Core ECS Functionality
- **Efficient Entity Management** - Object pooling and optimized component storage
- **Advanced Query System** - ALL, ANY, NOT queries with tag support
- **Flexible System Architecture** - Priority-based execution with lifecycle hooks
- **Type-Safe Components** - Full TypeScript support with runtime validation

### Performance & Memory
- **Component Archetype System** - Optimized cache locality for better performance
- **Advanced Object Pooling** - Automatic memory management with metrics
- **Change Detection** - Component versioning for selective updates
- **Memory Profiling** - Built-in memory usage analysis tools

### Developer Experience
- **Entity Hierarchies** - Parent/child relationships with automatic cleanup
- **Entity Tags** - Flexible categorization and querying system
- **Component Validation** - Dependencies, conflicts, and custom validators
- **Debug Mode** - Comprehensive logging and error reporting
- **Performance Monitoring** - System execution profiling and timing

### Advanced Features
- **Plugin System** - Extensible architecture for adding features without modifying core
- **Prefab System** - Template-based entity creation
- **Bulk Operations** - Efficient batch entity management
- **Serialization** - Save/restore world state with snapshots
- **Inter-System Messaging** - Event-driven communication
- **Runtime System Control** - Enable/disable systems dynamically

## Installation

You can install Orion ECS using npm:

```bash
npm install orion-ecs
```

## Documentation

- **[📚 API Reference](https://tyevco.github.io/OrionECS/api/)** - Complete TypeDoc-generated API documentation
- **[📖 Cookbook](./docs/COOKBOOK.md)** - Recipes and patterns for common use cases
- **[🔄 Migration Guides](./docs/migrations/)** - Guides for migrating from other ECS frameworks
- **[🚀 Performance Guide](./PERFORMANCE.md)** - Performance optimization tips and benchmarks

## Quick Start

Here's a basic example of how to use Orion ECS:

```typescript
import { EngineBuilder } from 'orion-ecs';

// Create a new engine with 60 FPS fixed updates and debug mode
const game = new EngineBuilder()
  .withFixedUpdateFPS(60)
  .withDebugMode(true)
  .build();

// Define components
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Health {
  constructor(public current: number = 100, public max: number = 100) {}
}

// Create a movement system with advanced query
game.createSystem('MovementSystem', {
  all: [Position, Velocity],    // Must have both components
  tags: ['active']              // Must have 'active' tag
}, {
  priority: 10,                 // Higher priority runs first
  before: () => console.log('Starting movement update'),
  act: (entity, position, velocity) => {
    position.x += velocity.x;
    position.y += velocity.y;
  },
  after: () => console.log('Movement update complete')
});

// Create entities with names and tags
const player = game.createEntity('Player');
player.addComponent(Position, 0, 0)
      .addComponent(Velocity, 1, 1)
      .addComponent(Health, 100, 100)
      .addTag('player')
      .addTag('active');

// Create enemies using prefabs
const enemyPrefab = {
  name: 'Enemy',
  components: [
    { type: Position, args: [100, 100] },
    { type: Health, args: [50, 50] }
  ],
  tags: ['enemy', 'active']
};

game.registerPrefab('Enemy', enemyPrefab);
const enemy = game.createFromPrefab('Enemy', 'Enemy1');

// Start the engine and update loop
game.start();
// In your game loop:
// game.update(deltaTime);
```

## Advanced Usage

### Component Validation

```typescript
// Set up component validation with dependencies
game.registerComponentValidator(Health, {
  validate: (component) => 
    component.current >= 0 ? true : 'Health cannot be negative',
  dependencies: [Position],  // Requires Position component
  conflicts: [Ghost]         // Cannot coexist with Ghost component
});
```

### Entity Hierarchies

```typescript
const parent = game.createEntity('Parent');
const child = game.createEntity('Child');

parent.addChild(child);
// or
child.setParent(parent);

// Automatic cleanup - destroying parent destroys all children
parent.queueFree();
```

### Complex Queries

```typescript
// Entities with Position AND Velocity, but NOT Frozen, with 'active' tag
game.createSystem('ComplexSystem', {
  all: [Position, Velocity],
  none: [Frozen],
  tags: ['active'],
  withoutTags: ['disabled']
}, {
  act: (entity, position, velocity) => {
    // System logic here
  }
});
```

### Inter-System Communication

```typescript
// In one system
game.messageBus.publish('enemy-killed', { score: 100 }, 'CombatSystem');

// In another system
game.messageBus.subscribe('enemy-killed', (message) => {
  console.log(`Score: ${message.data.score} from ${message.sender}`);
});
```

### Performance Monitoring

```typescript
// Get system performance profiles
const profiles = game.getSystemProfiles();
profiles.forEach(profile => {
  console.log(`${profile.name}: ${profile.averageTime}ms avg`);
});

// Get memory statistics
const memStats = game.getMemoryStats();
console.log(`Active entities: ${memStats.activeEntities}`);
console.log(`Memory estimate: ${memStats.totalMemoryEstimate} bytes`);

// Get comprehensive debug info
const debugInfo = game.getDebugInfo();
console.log('Engine Debug Info:', debugInfo);
```

### World State Management

```typescript
// Create snapshots
game.createSnapshot();

// Serialize world state
const worldData = game.serialize();
console.log(`Saved ${worldData.entities.length} entities`);

// Restore from snapshot
game.restoreSnapshot(); // Restore latest
game.restoreSnapshot(0); // Restore specific snapshot
```

### Plugin System

Orion ECS features a powerful plugin architecture that allows you to extend the engine with custom functionality without modifying the core code.

```typescript
import { EngineBuilder, EnginePlugin, PluginContext } from 'orion-ecs';

// Create a plugin
class PhysicsPlugin implements EnginePlugin {
  name = 'PhysicsPlugin';
  version = '1.0.0';

  install(context: PluginContext): void {
    // Register components
    context.registerComponent(RigidBody);
    context.registerComponent(Collider);

    // Create systems
    context.createSystem('PhysicsSystem',
      { all: [Position, RigidBody] },
      {
        act: (entity, position, rigidBody) => {
          // Physics logic here
          position.x += rigidBody.velocity.x;
          position.y += rigidBody.velocity.y;
        }
      },
      true // Fixed update
    );

    // Extend engine with custom API
    const physicsAPI = {
      setGravity: (x: number, y: number) => {
        // Custom physics API
      }
    };
    context.extend('physics', physicsAPI);
  }

  uninstall(): void {
    console.log('Physics plugin uninstalled');
  }
}

// Use plugins with EngineBuilder
const game = new EngineBuilder()
  .use(new PhysicsPlugin())
  .withDebugMode(true)
  .build();

// Access plugin-provided API
game.physics.setGravity(0, 9.8);

// Plugin management
console.log(game.hasPlugin('PhysicsPlugin')); // true
const plugins = game.getInstalledPlugins();
await game.uninstallPlugin('PhysicsPlugin');
```

See `examples/PhysicsPlugin.ts` for a complete working example.

## API Reference

### EngineBuilder

- `withDebugMode(enabled: boolean)`: Enable or disable debug mode
- `withFixedUpdateFPS(fps: number)`: Set fixed update FPS (default: 60)
- `withMaxFixedIterations(iterations: number)`: Set max fixed update iterations per frame (default: 10)
- `withMaxSnapshots(max: number)`: Set max number of snapshots to keep (default: 10)
- `use(plugin: EnginePlugin)`: Register a plugin to be installed when the engine is built
- `build()`: Build and return the configured Engine instance

### Engine

#### Core Methods
- `createEntity(name?: string)`: Creates and returns a new named entity
- `createSystem(name: string, query: QueryOptions, options: SystemOptions, isFixedUpdate?: boolean)`: Creates a new system
- `start()`: Starts the engine
- `stop()`: Stops the engine
- `update(deltaTime?: number)`: Updates the engine for one frame

#### Advanced Methods
- `registerPrefab(name: string, prefab: EntityPrefab)`: Registers an entity template
- `createFromPrefab(prefabName: string, entityName?: string)`: Creates entity from prefab
- `registerComponentValidator(type: ComponentClass, validator: ComponentValidator)`: Adds validation
- `createSnapshot()`: Creates a world state snapshot
- `serialize()`: Serializes the entire world state

#### Plugin Management
- `installPlugin(plugin: EnginePlugin)`: Installs a plugin into the engine
- `uninstallPlugin(pluginName: string)`: Uninstalls a plugin (async)
- `hasPlugin(pluginName: string)`: Checks if a plugin is installed
- `getPlugin(pluginName: string)`: Gets information about an installed plugin
- `getInstalledPlugins()`: Gets all installed plugins
- `getExtension<T>(extensionName: string)`: Gets a custom extension added by a plugin

#### Query and Profiling
- `getAllEntities()`: Gets all active entities
- `getEntitiesByTag(tag: string)`: Gets entities with specific tag
- `getSystemProfiles()`: Gets performance data for all systems
- `getMemoryStats()`: Gets memory usage statistics
- `getDebugInfo()`: Gets comprehensive debug information

### Entity

#### Core Methods
- `addComponent<T>(type: ComponentClass<T>, ...args)`: Adds a component
- `removeComponent<T>(type: ComponentClass<T>)`: Removes a component
- `hasComponent<T>(type: ComponentClass<T>)`: Checks for component
- `getComponent<T>(type: ComponentClass<T>)`: Gets component instance

#### Hierarchy and Tags
- `addTag(tag: string)`: Adds a tag
- `removeTag(tag: string)`: Removes a tag  
- `hasTag(tag: string)`: Checks for tag
- `setParent(parent: Entity | null)`: Sets parent entity
- `addChild(child: Entity)`: Adds child entity
- `removeChild(child: Entity)`: Removes child entity

#### Lifecycle
- `queueFree()`: Marks entity for deletion
- `serialize()`: Serializes entity data

### System Options

Systems support comprehensive configuration:

```typescript
interface SystemOptions {
  priority?: number;        // Execution priority (higher = first)
  enabled?: boolean;        // Initial enabled state
  tags?: string[];          // System tags for organization
  before?: () => void;      // Pre-execution hook
  act?: (entity, ...components) => void;  // Main logic
  after?: () => void;       // Post-execution hook
}
```

### Query Options

Advanced entity querying:

```typescript
interface QueryOptions {
  all?: ComponentClass[];      // Must have ALL components
  any?: ComponentClass[];      // Must have ANY component
  none?: ComponentClass[];     // Must have NONE of components
  tags?: string[];            // Must have ALL tags
  withoutTags?: string[];     // Must have NONE of tags
}
```

## Performance Considerations

- **Component Pooling**: Use `registerComponentPool()` for frequently created/destroyed components
- **System Priority**: Higher priority systems (larger numbers) execute first
- **Query Optimization**: More specific queries (with more constraints) are more efficient
- **Entity Cleanup**: Use `queueFree()` for deferred deletion to avoid mid-frame issues
- **Debug Mode**: Disable in production for better performance

## Testing

To run the tests:

```bash
npm test
```

To run benchmarks:

```bash
npm run benchmark
```

## Building

To build the library:

```bash
npm run build
```

This generates both CommonJS and ESM builds with TypeScript definitions.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.