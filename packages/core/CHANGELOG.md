# @orion-ecs/core

## 0.5.0

### Minor Changes

- [#334](https://github.com/tyevco/OrionECS/pull/334) [`72ef221`](https://github.com/tyevco/OrionECS/commit/72ef221be5ee61b7a502952a6a3195ac3a03cfc6) Thanks [@tyevco](https://github.com/tyevco)! - Add tryGetComponent method for null-safe component access

  - Added `tryGetComponent` method to Entity that returns `T | null` instead of throwing
  - Refactored `getComponent` to use `tryGetComponent` internally for cleaner code
  - Enables safer component access patterns without needing hasComponent checks

- [#335](https://github.com/tyevco/OrionECS/pull/335) [`ef5f33a`](https://github.com/tyevco/OrionECS/commit/ef5f33adf6fd6a0fffa82cd5c4bbb7803b2c6b59) Thanks [@tyevco](https://github.com/tyevco)! - Add stricter component type utilities for improved type safety

  - Add `StrictComponentClass<T, Args>` type that captures both instance type and constructor arguments
  - Add `InferStrictComponentClass<C>` utility type to infer strict component types from constructors
  - Improve documentation for `ComponentIdentifier` explaining the type safety model and why `any[]` is used
  - Enhance `ComponentArgs<T>` documentation with usage examples

  These new types provide an opt-in stricter alternative for cases where compile-time validation of constructor arguments is needed at the definition site rather than just at call sites.

- [#332](https://github.com/tyevco/OrionECS/pull/332) [`50ea9fa`](https://github.com/tyevco/OrionECS/commit/50ea9fa9b831066f1dc2a47c63f5064b6942d60c) Thanks [@tyevco](https://github.com/tyevco)! - Add entityCount getter for efficient entity counting

  New `engine.entityCount` getter provides O(1) access to the number of active entities without creating an intermediate array. More efficient than `engine.getAllEntities().length` for performance-sensitive code.

- [#321](https://github.com/tyevco/OrionECS/pull/321) [`9c8c4f3`](https://github.com/tyevco/OrionECS/commit/9c8c4f3e8f09c453e64b974b793aa73804e35e13) Thanks [@tyevco](https://github.com/tyevco)! - Add error recovery and resilience system for fault-tolerant ECS execution

  **New Features:**

  - `ErrorRecoveryManager` for system error isolation and recovery
  - Multiple recovery strategies: `skip`, `retry`, `disable`, `fallback`, `ignore`
  - Circuit breaker pattern to prevent cascading failures
  - Health monitoring with `healthy`, `degraded`, `unhealthy`, `disabled` states
  - Error collection and reporting for production services (Sentry, Rollbar, etc.)
  - Per-system error configuration via `SystemOptions.errorConfig`

  **New EngineBuilder Method:**

  - `withErrorRecovery(config?)` - Enable error recovery with optional configuration

  **New Engine Methods:**

  - `isErrorRecoveryEnabled()` - Check if error recovery is enabled
  - `getSystemHealth(name)` - Get health status of a specific system
  - `getAllSystemHealth()` - Get health of all systems
  - `getEngineHealth()` - Get overall engine health status
  - `getErrorHistory()` - Get collected errors
  - `clearErrorHistory()` - Clear error history
  - `generateErrorReport()` - Generate comprehensive error report
  - `resetSystem(name)` - Reset system to healthy state
  - `resetAllSystems()` - Reset all systems

  **New Types:**

  - `RecoveryStrategy`, `ErrorSeverity`, `CircuitBreakerState`
  - `SystemError`, `SystemHealth`, `SystemErrorConfig`
  - `ErrorRecoveryConfig`, `CircuitBreakerConfig`
  - `EngineHealthEvent`, `ErrorReport`

  **Usage Example:**

  ```typescript
  const engine = new EngineBuilder()
    .withErrorRecovery({
      defaultStrategy: "skip",
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 10000,
      },
      onError: (error) => {
        Sentry.captureException(error.error);
      },
    })
    .build();
  ```

- [#354](https://github.com/tyevco/OrionECS/pull/354) [`10914c6`](https://github.com/tyevco/OrionECS/commit/10914c686591f945a718f220923bc204c414df20) Thanks [@tyevco](https://github.com/tyevco)! - Add multiple log providers support for flexible log destinations

  This update introduces a provider-based logging architecture that allows developers to direct log output to multiple destinations simultaneously.

  **New Types in @orion-ecs/plugin-api:**

  - `LogProvider` interface for creating custom log destinations
  - `LogEntry` type containing structured log information (level, args, tag, timestamp)

  Plugin authors can now implement custom log providers with only the lightweight plugin-api dependency.

  **New Features in @orion-ecs/core:**

  - `ConsoleLogProvider` - built-in provider for console output (default)
  - `MemoryLogProvider` - built-in provider for capturing logs in memory (great for testing)
  - `EngineBuilder.withLogProvider()` - method for registering log providers during engine configuration

  **Usage Examples:**

  ```typescript
  // Memory-only logging for tests (no console output)
  const memoryLog = new MemoryLogProvider();
  const engine = new EngineBuilder().withLogProvider(memoryLog).build();

  // Assert on captured logs
  expect(memoryLog.getByLevel("error")).toHaveLength(0);
  expect(memoryLog.search("entity created")).toHaveLength(1);

  // Multiple providers (console + memory)
  const engine = new EngineBuilder()
    .withLogProvider(new ConsoleLogProvider())
    .withLogProvider(memoryLog)
    .build();

  // Custom provider for remote logging
  const remoteProvider: LogProvider = {
    write(entry) {
      if (entry.level === "error") {
        sendToErrorTracking(entry);
      }
    },
  };
  ```

  **Backward Compatibility:**

  - Existing code continues to work without changes
  - If no providers are configured, `ConsoleLogProvider` is used by default
  - The `Logger` interface remains unchanged

- [#320](https://github.com/tyevco/OrionECS/pull/320) [`af89973`](https://github.com/tyevco/OrionECS/commit/af89973cd0264abec0faf2c1b7dc4de2f66e9fb4) Thanks [@tyevco](https://github.com/tyevco)! - Add automated performance regression testing system

  New Features:

  - Regression detection algorithm comparing benchmark results against stored baselines
  - Configurable performance budgets with thresholds for each benchmark
  - GitHub Actions workflow for automated testing on every PR
  - CLI tool for local regression checking (`npm run perf:check`)
  - Markdown report generation for PR comments
  - Benchmark categorization (critical/important/standard) with different failure behaviors

  Configuration:

  - `.performance/budgets.json`: Define minimum ops/sec, maximum mean time, and custom thresholds
  - `.performance/baseline.json`: Stored baseline metrics for comparison

  Commands:

  - `npm run perf:check`: Check for regressions against baseline
  - `npm run perf:check:verbose`: Detailed regression output
  - `npm run perf:update-baseline`: Update baseline after releases
  - `npm run perf:report`: Generate full JSON/Markdown report

  This enables catching performance degradations before they reach production and enforces
  performance budgets across CI/CD pipelines.

- [#349](https://github.com/tyevco/OrionECS/pull/349) [`09dded1`](https://github.com/tyevco/OrionECS/commit/09dded18893412ed39bcebae37599bfda4f0a497) Thanks [@tyevco](https://github.com/tyevco)! - Add strict TypeScript configuration and defineComponent utility

  **Core Package (minor):**

  - Enable `noUncheckedIndexedAccess`, `noImplicitAny`, and `strictNullChecks` in TypeScript config
  - Add `defineComponent` utility for defining components with typed properties and defaults
  - Add ESLint/oxlint configuration for type safety rules
  - Add comprehensive plugin system integration tests

  **All Packages (patch):**

  - Fix type errors caused by `noUncheckedIndexedAccess` with non-null assertions
  - Ensure array access is type-safe in iteration loops

  **Breaking Changes:**

  - `noUncheckedIndexedAccess` may require code updates for array access patterns

### Patch Changes

- [#343](https://github.com/tyevco/OrionECS/pull/343) [`2111b0e`](https://github.com/tyevco/OrionECS/commit/2111b0ed0a62856a4f157bf828b28acc71d6fc7a) Thanks [@tyevco](https://github.com/tyevco)! - Add comprehensive JSDoc documentation to all manager classes in managers.ts for improved IDE autocomplete and developer experience

- [#341](https://github.com/tyevco/OrionECS/pull/341) [`bd5500b`](https://github.com/tyevco/OrionECS/commit/bd5500b8456d75c5d9b1bf564f663e765e330cca) Thanks [@tyevco](https://github.com/tyevco)! - Improve type safety for Archetype.forEach callback by adding generic constraints to preserve component types

- [#333](https://github.com/tyevco/OrionECS/pull/333) [`9230211`](https://github.com/tyevco/OrionECS/commit/923021146401400a08411c9f2b9c94dea1fc6462) Thanks [@tyevco](https://github.com/tyevco)! - Add stale index validation during deferred entity removal in archetype iteration to prevent potential memory safety issues when modifications occur during iteration.

- [#336](https://github.com/tyevco/OrionECS/pull/336) [`c0deb63`](https://github.com/tyevco/OrionECS/commit/c0deb63c6aef0552d1d0186e026d3e5bc9773070) Thanks [@tyevco](https://github.com/tyevco)! - Fix EventCallback type to preserve type information using generic constraints

  The EventCallback type now uses `TArgs extends unknown[]` instead of `any[]` for arguments,
  allowing callers to specify exact argument types while maintaining backward compatibility.

- [#337](https://github.com/tyevco/OrionECS/pull/337) [`eac4071`](https://github.com/tyevco/OrionECS/commit/eac4071e31b7779b5910df5d62845e7c850b5b73) Thanks [@tyevco](https://github.com/tyevco)! - Fix mutable module-level state in MemoryEstimationConfig that was shared across engine instances

  - Convert `MemoryEstimationConfig` from mutable object to immutable interface
  - Add `DEFAULT_MEMORY_ESTIMATION_CONFIG` as frozen default configuration
  - Add `createMemoryEstimationConfig()` factory for custom configurations
  - Add `detectMemoryEnvironment()` for platform-specific auto-detection
  - Move memory config to ArchetypeManager instance level for proper isolation
  - Pass memory config from ArchetypeManager to Archetype instances

  This ensures multiple Engine instances can operate independently without sharing global state.

- [#338](https://github.com/tyevco/OrionECS/pull/338) [`85f25f4`](https://github.com/tyevco/OrionECS/commit/85f25f4278689f02fa66faf8cc09dea84414c641) Thanks [@tyevco](https://github.com/tyevco)! - Fix type safety in plugin context methods by returning proper types instead of `any`

  - `createSystem` now returns `System<ComponentTypes<All>>` instead of `any`
  - `createQuery` now returns `Query<ComponentTypes<All>>` instead of `any`
  - `getEngine` now returns `Engine` instead of `any`

  This improves TypeScript type inference for plugins using the plugin context API.

- [#344](https://github.com/tyevco/OrionECS/pull/344) [`808831b`](https://github.com/tyevco/OrionECS/commit/808831be9a19048317a2b882437783923cc30610) Thanks [@tyevco](https://github.com/tyevco)! - Internal refactoring of restoreSnapshot method for improved maintainability

- [#342](https://github.com/tyevco/OrionECS/pull/342) [`33d3dc6`](https://github.com/tyevco/OrionECS/commit/33d3dc6852f6b73e5f41cba1f5b44cada0094c47) Thanks [@tyevco](https://github.com/tyevco)! - Improve type safety for ComponentManager heterogeneous storage by updating `getComponentArray<T>` to use `ComponentIdentifier<T>` parameter and adding a new `getPool<T>` method for type-safe pool access

- [#346](https://github.com/tyevco/OrionECS/pull/346) [`136b912`](https://github.com/tyevco/OrionECS/commit/136b9122a3d616abd38c53ae2335f2384f62dbc2) Thanks [@tyevco](https://github.com/tyevco)! - Standardize error message format using EngineLogger consistently

  - Replace direct console.log/warn/error calls with EngineLogger methods
  - Pass logger to CommandBuffer, ArchetypeManager, MessageBus, and EventEmitter
  - Add setLogger() method to ComponentManager for archetype operations
  - Update EngineBuilder to create logger before managers for consistent logging
  - Fix logger isEnabled() method bug where debug messages were incorrectly filtered by minLevel
  - Messages now use consistent [ECS] prefix via the logger
  - Sub-components use tagged loggers (e.g., [Commands], [Archetype]) for easier filtering

- [#339](https://github.com/tyevco/OrionECS/pull/339) [`8b4ac6c`](https://github.com/tyevco/OrionECS/commit/8b4ac6c9a23269c239d28dd7ddf3ebddcdfd526e) Thanks [@tyevco](https://github.com/tyevco)! - Improve type safety in SystemManager by replacing `System<any>[]` with `System<AnySystemTuple>[]` for heterogeneous system storage. This provides better type inference while maintaining flexibility for systems with different component requirements.

- Updated dependencies [[`10914c6`](https://github.com/tyevco/OrionECS/commit/10914c686591f945a718f220923bc204c414df20)]:
  - @orion-ecs/plugin-api@0.5.0

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
