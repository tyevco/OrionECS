# @orion-ecs/timeline

## 0.4.1

### Patch Changes

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
