# @orion-ecs/plugin-api

## 0.4.0

### Minor Changes

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
