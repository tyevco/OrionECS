# @orion-ecs/core

## 0.4.0

### Minor Changes

- [#192](https://github.com/tyevco/OrionECS/pull/192) [`f3bf00f`](https://github.com/tyevco/OrionECS/commit/f3bf00f132287784b6d890b362dfe8372515984f) Thanks [@tyevco](https://github.com/tyevco)! - Add Entity Commands / Deferred Operations system for safe entity manipulation during system execution

  This release introduces a comprehensive command buffer system that allows safe, deferred entity operations during system execution. Commands are queued and executed at the end of the update cycle, preventing issues with iterator invalidation and archetype transitions during iteration.

  **New Features:**

  - **`engine.commands.spawn()`** - Create entities with fluent component chaining

    ```typescript
    engine.commands
      .spawn()
      .named("Bullet")
      .with(Position, x, y)
      .with(Velocity, vx, vy)
      .withTag("projectile")
      .onCreate((entity) => {
        /* callback */
      });
    ```

  - **`engine.commands.entity(e)`** - Modify existing entities safely

    ```typescript
    engine.commands
      .entity(player)
      .addComponent(Buff, "speed", 1.5)
      .removeComponent(Debuff)
      .addTag("buffed");
    ```

  - **`engine.commands.despawn(entity)`** - Queue entity destruction

    ```typescript
    engine.commands.despawn(enemy);
    ```

  - **`engine.commands.spawnBatch(count, callback)`** - Efficient batch entity creation

    ```typescript
    engine.commands.spawnBatch(100, (builder, index) => {
      builder
        .named(`Particle_${index}`)
        .with(Position, Math.random() * 800, Math.random() * 600);
    });
    ```

  - **`engine.commands.execute()`** - Manual command execution with statistics
    ```typescript
    const result = engine.commands.execute();
    console.log(`Spawned ${result.entitiesSpawned} entities`);
    ```

  **Key Features:**

  - Automatic execution during `engine.update()` (configurable via `setAutoExecuteCommands()`)
  - FIFO command execution order
  - Rollback support on errors (enabled by default)
  - Full TypeScript type inference
  - Hierarchy support (parent/child relationships)
  - Tag management (add/remove tags)
  - Comprehensive execution statistics

  **Safety Guarantees:**

  - Prevents iterator invalidation during query traversal
  - Maintains consistent entity state throughout update cycles
  - No archetype transitions during system iteration

  **Integration with Systems:**

  ```typescript
  engine.createSystem(
    "DamageSystem",
    { all: [Health, DamageReceiver] },
    {
      act: (entity, health, receiver) => {
        health.current -= receiver.pendingDamage;
        if (health.current <= 0) {
          // Safe to despawn during iteration
          engine.commands.despawn(entity);
        }
      },
    }
  );
  ```

  This feature is essential for building complex game logic where systems need to create, modify, or destroy entities during execution.

- [#213](https://github.com/tyevco/OrionECS/pull/213) [`a08f297`](https://github.com/tyevco/OrionECS/commit/a08f297abecb32287a11f682870df0d90b143da9) Thanks [@tyevco](https://github.com/tyevco)! - Add comprehensive Entity Hierarchy Query Methods and Observer Events

  ## Hierarchy Query Methods (Phase 1)

  New methods on Entity class for traversing and querying the hierarchy:

  - `getDescendants(maxDepth?)` - Get all descendants with optional depth limit
  - `getAncestors()` - Get all ancestors ordered from nearest to furthest
  - `findChild(predicate, recursive?)` - Find first child matching predicate
  - `findChildren(predicate, recursive?)` - Find all children matching predicate
  - `getRoot()` - Get the root entity of the hierarchy
  - `getDepth()` - Get depth level (0 = root)
  - `isAncestorOf(entity)` - Check if this entity is an ancestor of another
  - `isDescendantOf(entity)` - Check if this entity is a descendant of another
  - `getSiblings(includeSelf?)` - Get all sibling entities
  - `getChildCount()` - Get number of direct children
  - `hasChildren()` - Check if entity has any children
  - `hasParent()` - Check if entity has a parent

  ## Hierarchy Observer Events (Phase 2)

  Enhanced hierarchy event system with granular events:

  - `onChildAdded` - Emitted when a child is added to a parent
  - `onChildRemoved` - Emitted when a child is removed from a parent
  - `onParentChanged` - Emitted when an entity's parent changes (with previous/new parent info)

  System integration via `SystemOptions`:

  - `watchHierarchy` - Enable hierarchy event callbacks for systems
  - `onChildAdded`, `onChildRemoved`, `onParentChanged` callbacks

  Backward compatible with existing `onEntityHierarchyChanged` event.

  ## Related Issue

  Implements GitHub Issue #66: Entity Relationships - Parent-Child Propagation & Observers

- [#202](https://github.com/tyevco/OrionECS/pull/202) [`5166280`](https://github.com/tyevco/OrionECS/commit/5166280830aafd2086e43d3902530475f1d61e68) Thanks [@tyevco](https://github.com/tyevco)! - Add type safety to plugins and conditional profiling support

  Core:

  - Add `withProfiling(enabled)` option to EngineBuilder for conditional system profiling
  - Add `isProfilingEnabled()` method to Engine for runtime checks
  - System profiling can now be disabled in production builds to eliminate overhead

  Plugin API:

  - Export `EntityDef` interface for type-safe entity handling in plugins
  - Export `SystemProfile` interface for building debugging/profiling plugins

  All Plugins:

  - Migrate to `@orion-ecs/plugin-api` with TypeScript type inference
  - Add type-safe API interfaces (e.g., `IPhysicsAPI`, `IDebugAPI`)
  - Replace `Entity` with `EntityDef` for proper type safety

### Patch Changes

- [#263](https://github.com/tyevco/OrionECS/pull/263) [`e4a40d8`](https://github.com/tyevco/OrionECS/commit/e4a40d8c192688f1c767a10e1089e939b3f95e39) Thanks [@tyevco](https://github.com/tyevco)! - Fix log injection vulnerability with centralized Logger

  - Add Logger interface to @orion-ecs/plugin-api for secure, structured logging
  - Create EngineLogger implementation with automatic sanitization of ANSI escape sequences and control characters
  - Update NetworkPlugin to use centralized logger via PluginContext
  - Plugins now import types from @orion-ecs/plugin-api for lighter dependencies

- Updated dependencies [[`e4a40d8`](https://github.com/tyevco/OrionECS/commit/e4a40d8c192688f1c767a10e1089e939b3f95e39), [`5166280`](https://github.com/tyevco/OrionECS/commit/5166280830aafd2086e43d3902530475f1d61e68)]:
  - @orion-ecs/plugin-api@0.4.0

## 0.3.0

### Major Changes

- **BREAKING CHANGE:** OrionECS v0.3.0 - Monorepo Restructure and Package Rename

  ## Breaking Changes

  - **Package Rename**: Core package renamed from `orion-ecs` to `@orion-ecs/core`
  - **Monorepo Structure**: Reorganized into packages/ directory with separate math and graphics packages
  - **Import Changes**: All imports must be updated to use `@orion-ecs/core`

  ## Migration Guide

  Update package.json:

  ```json
  {
    "dependencies": {
      "@orion-ecs/core": "^0.3.0"
    }
  }
  ```

  Update imports:

  ```typescript
  // Before
  import { EngineBuilder } from "orion-ecs";

  // After
  import { EngineBuilder } from "@orion-ecs/core";
  ```

### Minor Changes

- OrionECS v0.2.0 - Entity Archetypes and Examples Suite

  ## Entity Archetype System

  - Automatic entity grouping by component composition for improved cache locality
  - Query iteration performance significantly improved (2-5x faster)
  - Transparent archetype management with automatic entity migration
  - Follows Unity DOTS and Bevy ECS architectural patterns
  - Comprehensive test coverage and performance benchmarks

  ## Interactive Examples Suite

  All examples include both standalone and browser-ready versions:

  ### Game Examples

  - **Asteroids**: Classic arcade game with entity spawning and collision detection
  - **Platformer**: Side-scrolling platformer with physics and input handling
  - **RTS Demo**: Real-time strategy with large entity counts and spatial queries
  - **Multiplayer Demo**: Network synchronization concepts and patterns

  ### Integration Examples

  - **Pixi.js**: 2D rendering integration
  - **Three.js**: 3D rendering integration
  - **Node.js Server**: Headless server-side ECS
  - **React**: UI integration example

  ### Deployment

  - GitHub Pages integration with interactive landing page
  - Automated deployment workflow
  - Vite-based build system

  ## New Plugins (v0.2.0)

  - **Canvas2D Renderer**: Sprite rendering with layers and camera support
  - **Input Manager**: Keyboard, mouse, and touch event handling
  - **Interaction System**: Entity click, hover, and drag interactions

- Reactive programming with component change events

  ## Component Change Events (#52, #53)

  - Subscribe to component additions, removals, and modifications
  - Event filtering by component type and entity
  - Comprehensive documentation and examples
  - Use cases: UI synchronization, audio triggers, network replication

  ## API

  ```typescript
  // Subscribe to component changes
  engine.events.onComponentAdded(Position, (entity, component) => {
    console.log(`Position added to ${entity.name}`);
  });

  engine.events.onComponentChanged(Health, (entity, component, previous) => {
    if (component.current < previous.current) {
      // Health decreased - trigger damage effect
    }
  });
  ```

- New features and capabilities added in v0.3.0

  ## New Features

  ### Singleton Components (#64)

  - Global state management with singleton components
  - Automatic enforcement of single-instance constraint
  - Convenient API for accessing global state

  ### Tutorial Series

  - Tutorial 1: Your First ECS Project (#181)
  - Step-by-step introduction to OrionECS concepts
  - Interactive examples with detailed explanations

  ### Example Games Ported to v2.0

  - Space Shooter: Complete arcade shooter implementation
  - Tower Defense: Strategic tower placement and wave management
  - Both examples updated to use modern v2.0 architecture

### Patch Changes

- CI/CD pipeline and release automation

  ## Automated Release Pipeline

  - Changesets integration for version management
  - NPM Trusted Publishers with OIDC authentication
  - Automated publishing to npm registry
  - GitHub release creation with changelog

  ## Code Quality

  - CodeQL security scanning
  - Biome and oxlint for code quality
  - TypeScript strict mode enforcement
  - Pre-commit hooks with lint-staged

  ## Build Improvements

  - ES2023 TypeScript target
  - tsup bundler for optimal output
  - Proper package.json exports ordering
  - CommonJS and ESM dual publishing

- Comprehensive API documentation and developer resources

  ## API Documentation

  - TypeDoc-generated API reference for all packages
  - Deployed to GitHub Pages at https://tyevco.github.io/OrionECS/api/
  - Searchable documentation with type information
  - Code examples and usage notes

  ## Documentation Improvements

  - Enhanced README with architecture diagrams
  - Plugin documentation for all 8 official plugins
  - Community and contribution guidelines
  - GitHub issue templates and workflows

  ## Enhanced TypeDoc Comments

  - Complete type documentation for Vector2 utilities
  - Component change events documentation
  - Bounds class spatial query documentation
  - Testing utilities API reference
