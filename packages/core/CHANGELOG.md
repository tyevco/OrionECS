# @orion-ecs/core

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
