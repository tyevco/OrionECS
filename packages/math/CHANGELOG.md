# @orion-ecs/math

## 0.3.1

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

- Monorepo restructure and package organization

  ## Package Reorganization (#89)

  - Split utilities into `@orion-ecs/math` and `@orion-ecs/graphics` packages
  - Improved modularity and tree-shaking
  - Separate versioning for math and graphics utilities

  ## Math Package

  - Vector2 with comprehensive mathematical operations
  - Bounds class with spatial queries and transformations
  - Geometric utilities and intersection testing

  ## Graphics Package

  - Color class with multiple color space support
  - Mesh and Vertex primitives
  - Rendering utilities for 2D graphics

  ## Monorepo Structure

  - Organized packages/ directory structure
  - Proper workspace configuration with npm workspaces
  - Turbo build system for optimal performance

### Patch Changes

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
