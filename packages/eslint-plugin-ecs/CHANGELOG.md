# @orion-ecs/eslint-plugin-ecs

## 0.1.0

### Minor Changes

- [#312](https://github.com/tyevco/OrionECS/pull/312) [`567b114`](https://github.com/tyevco/OrionECS/commit/567b11475e21ffe737bbc6aad8494535207375ac) Thanks [@tyevco](https://github.com/tyevco)! - Add component-types ESLint rule for call-site validation

  Validates that types used as components are data-only classes without logic:

  - Detects methods, getters/setters, and arrow function properties
  - Uses TypeScript type checker for accurate type resolution
  - Works with external library types and type aliases
  - Validates at all ECS API call sites (addComponent, getComponent, etc.)

  Configurable Options:

  - `allowedMethods`: Whitelist specific methods (default: clone, reset, toString, toJSON, valueOf)
  - `excludePatterns`: Exclude specific type names from checking
  - `checkExternalTypes`: Validate types from node_modules (default: false)

  Coverage:

  - Entity methods (addComponent, getComponent, hasComponent, removeComponent)
  - System query definitions (all, any, none)
  - Singleton operations (setSingleton, getSingleton)
  - Prefab type definitions
  - Fluent query builder (withAll, withAny, withNone)

  Catches violations like using complex classes with business logic as components, enforcing the data-only component pattern.

- [#312](https://github.com/tyevco/OrionECS/pull/312) [`567b114`](https://github.com/tyevco/OrionECS/commit/567b11475e21ffe737bbc6aad8494535207375ac) Thanks [@tyevco](https://github.com/tyevco)! - Add core validation rules for ECS patterns

  Component Order Rule:

  - Validates component dependency ordering in prefabs and systems
  - Ensures dependencies are added before dependents
  - Detects circular dependencies between components
  - Supports registerComponentValidator dependencies
  - Works with prefab definitions and system queries

  Component Validator Rule:

  - Validates registerComponentValidator usage
  - Ensures validator functions have correct signatures
  - Detects missing or incorrect dependency specifications
  - Validates component class references in validators
  - Prevents common validation pattern mistakes

  Query Validator Rule:

  - Validates system query definitions (all, any, none)
  - Ensures query arrays contain valid component references
  - Detects duplicate components in queries
  - Warns about conflicting query constraints
  - Validates query structure and syntax

  Usage-Based Detection:

  - Automatically detects components from ECS API usage
  - Tracks addComponent, getComponent, hasComponent calls
  - No manual component registration required
  - Cross-file component detection via imports

- [#312](https://github.com/tyevco/OrionECS/pull/312) [`567b114`](https://github.com/tyevco/OrionECS/commit/567b11475e21ffe737bbc6aad8494535207375ac) Thanks [@tyevco](https://github.com/tyevco)! - Add no-static-state rule to prevent static state in ECS classes

  Detects and prevents static state in:

  - **Component classes**: Static properties/methods break entity isolation, interfere with serialization, and cause pooling issues
  - **System classes**: Static state creates hidden global state that violates ECS patterns
  - **Plugin classes**: Static state interferes with multi-engine scenarios and testing

  Detection Methods:

  - Pattern-based: Matches classes ending in 'Component', 'System', 'Plugin'
  - Interface-based: Detects classes implementing `EnginePlugin`
  - Usage-based: Tracks classes registered via `engine.use()` or `EngineBuilder.use()`

  Configurable Options:

  - `componentPattern`: Regex to identify component classes (default: 'Component$')
  - `systemPattern`: Regex to identify system classes (default: 'System$')
  - `pluginPattern`: Regex to identify plugin classes (default: 'Plugin$')
  - `detectFromUsage`: Detect from ECS API calls (default: true)
  - `checkComponents`: Enable component checking (default: true)
  - `checkSystems`: Enable system checking (default: true)
  - `checkPlugins`: Enable plugin checking (default: true)
  - `checkModuleLevelState`: Warn about module-level let/var (default: false)
  - `allowedStaticProperties`: Whitelist static properties like 'schema' or 'version'
  - `allowedModuleLevelPatterns`: Regex patterns for allowed module variables

  Encourages proper ECS patterns using singleton components or engine services instead of static state.

- [#312](https://github.com/tyevco/OrionECS/pull/312) [`567b114`](https://github.com/tyevco/OrionECS/commit/567b11475e21ffe737bbc6aad8494535207375ac) Thanks [@tyevco](https://github.com/tyevco)! - Add 15 new ESLint rules for ECS best practices (Phases 1-3)

  Phase 1 - Critical Safety Rules:

  - `no-query-in-act-callback`: Prevent expensive query creation inside system callbacks
  - `use-command-buffer-in-system`: Require command buffer for entity operations in systems
  - `subscription-cleanup-required`: Ensure plugin subscriptions are cleaned up in uninstall()

  Phase 2 - Correctness Rules:

  - `require-hasComponent-before-getComponent`: Require safety checks before component access
  - `singleton-mark-dirty`: Ensure singletons call markComponentDirty() after modifications
  - `no-async-in-system-callbacks`: Prevent async/await in system callbacks (breaks iteration)

  Phase 3 - Best Practice Rules:

  - `plugin-structure-validation`: Validate plugin class has name, version, and install()
  - `system-priority-explicit`: Require explicit system priority values
  - `component-lifecycle-complete`: Check onCreate/onDestroy callback pairing
  - `no-magic-tag-strings`: Discourage inline tag strings, prefer constants
  - `prefer-queueFree`: Prefer safe deferred deletion over immediate despawn
  - `system-naming-convention`: Enforce consistent system naming patterns
  - `plugin-logging-format`: Enforce structured logging in plugins
  - `no-nested-transactions`: Prevent nested command buffer execution errors

  Includes 227 comprehensive tests covering error cases, edge cases, and fix suggestions. Configured in both `recommended` and `strict` presets.

- [#312](https://github.com/tyevco/OrionECS/pull/312) [`567b114`](https://github.com/tyevco/OrionECS/commit/567b11475e21ffe737bbc6aad8494535207375ac) Thanks [@tyevco](https://github.com/tyevco)! - Add 13 advanced ESLint rules for ECS patterns (Phases 4-8)

  Phase 4 - Performance & Optimization Rules:

  - `prefer-batch-operations`: Encourage `commands.spawnBatch()` for bulk entity creation
  - `prefer-prefab-for-templates`: Suggest prefabs for repeated entity patterns
  - `prefer-component-pooling`: Recommend pooling for frequently created components
  - `query-specificity`: Ensure queries are specific and results are actually used

  Phase 5 - Entity & Hierarchy Rules:

  - `entity-unique-names`: Ensure entity names are unique for better debugging
  - `hierarchy-cycle-prevention`: Detect and prevent cycles in parent-child hierarchies

  Phase 6 - Advanced Plugin Rules:

  - `plugin-dependency-validation`: Validate plugin dependencies exist before use
  - `plugin-unbounded-collection`: Warn about unbounded collection growth in plugins
  - `plugin-context-cleanup`: Ensure proper context/engine cleanup in plugin uninstall()

  Phase 7 - Reactive Programming Rules:

  - `mark-component-dirty`: Ensure `markComponentDirty()` is called after component modifications
  - `use-watchComponents-filter`: Encourage filtered component watching for performance

  Phase 8 - Type Safety & Physics Rules:

  - `component-default-params`: Suggest default parameter values in component constructors
  - `fixed-update-for-physics`: Require physics systems use `fixedUpdate` for determinism

  All rules include:

  - Comprehensive test coverage (217 new tests, 444 total passing)
  - Fix suggestions where applicable
  - Configurable severity levels
  - Detailed documentation with examples

  Brings total ESLint plugin rule count to 28 comprehensive rules for ECS development.

- [#312](https://github.com/tyevco/OrionECS/pull/312) [`567b114`](https://github.com/tyevco/OrionECS/commit/567b11475e21ffe737bbc6aad8494535207375ac) Thanks [@tyevco](https://github.com/tyevco)! - Add prefer-engine-logger rule to encourage secure logging

  Discourages `console.*` statements in favor of the engine's built-in logger which provides:

  - Automatic sanitization to prevent log injection attacks
  - Tagged logging for better organization and filtering
  - Configurable log levels (debug, info, warn, error)
  - Consistent formatting across the application
  - Integration with engine lifecycle and debugging tools

  Rule Options:

  - `methods`: Array of console methods to flag (default: all logging methods)
  - `allowInTests`: Allow console.\* in test files (default: true)
  - `allowConsoleError`: Allow console.error for critical unrecoverable errors (default: true)

  Provides contextual error messages:

  - System callbacks: "Use engine.logger or system-specific logger"
  - Plugin code: "Use this.logger from PluginContext"
  - General code: "Use engine.logger for consistent logging"

  Includes auto-fix suggestions to replace console.log with appropriate logger calls based on context.

- [#312](https://github.com/tyevco/OrionECS/pull/312) [`567b114`](https://github.com/tyevco/OrionECS/commit/567b11475e21ffe737bbc6aad8494535207375ac) Thanks [@tyevco](https://github.com/tyevco)! - Add TypeScript type-aware linting for cross-file component resolution

  TypeScript Integration:

  - Enable type-checking in ESLint rules via `project` option
  - Resolve component types across files and packages
  - Support for type aliases and renamed imports
  - External package type resolution via TypeScript compiler API

  Type Resolution Utilities:

  - `resolveTypeInfo()`: Resolve types including imports and type aliases
  - `resolveComponentType()`: Get component class from type references
  - `isValidComponentClass()`: Validate component class structure
  - Cross-file type tracking for dependency analysis

  Enhanced Rules:

  - Component-order rule now resolves imported component types
  - Component-validator rule validates cross-file validators
  - Support for components from external @orion-ecs packages
  - Proper handling of re-exported types

  This enables comprehensive validation of component dependencies and usage patterns even when components are defined in different files or external packages.
