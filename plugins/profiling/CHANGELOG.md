# @orion-ecs/profiling

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
  - @orion-ecs/core@1.0.0
