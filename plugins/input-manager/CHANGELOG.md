# @orion-ecs/input-manager

## 1.0.0

### Patch Changes

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

- Updated dependencies [[`f3bf00f`](https://github.com/tyevco/OrionECS/commit/f3bf00f132287784b6d890b362dfe8372515984f), [`a08f297`](https://github.com/tyevco/OrionECS/commit/a08f297abecb32287a11f682870df0d90b143da9), [`e4a40d8`](https://github.com/tyevco/OrionECS/commit/e4a40d8c192688f1c767a10e1089e939b3f95e39), [`5166280`](https://github.com/tyevco/OrionECS/commit/5166280830aafd2086e43d3902530475f1d61e68)]:
  - @orion-ecs/core@0.4.0

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

### Patch Changes

- Comprehensive testing utilities and plugin test suites

  ## Testing Package (#89)

  - New `@orion-ecs/testing` package for user testing
  - `TestEngineBuilder` with fluent testing API
  - Assertion helpers for entity and component validation
  - Mock utilities for system testing
  - Snapshot testing support

  ## Plugin Test Coverage

  - Comprehensive test suites for all 8 official plugins
  - 100% code coverage for plugin functionality
  - Integration tests demonstrating plugin usage
  - Type safety improvements across all plugins

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @orion-ecs/core@1.0.0
  - @orion-ecs/math@1.0.0
