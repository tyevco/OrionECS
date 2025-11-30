# orion-ecs-vscode

## 0.1.0

### Minor Changes

- [#312](https://github.com/tyevco/OrionECS/pull/312) [`567b114`](https://github.com/tyevco/OrionECS/commit/567b11475e21ffe737bbc6aad8494535207375ac) Thanks [@tyevco](https://github.com/tyevco)! - Add enhanced code navigation (Go to Definition, Find References)

  Go to Definition Support:

  - Jump to component class definitions from any usage
  - Navigate to system definitions from getSystem() calls
  - Find prefab definitions from createFromPrefab() calls
  - Context-aware detection (query arrays, entity methods, singletons)
  - Works across TypeScript and JavaScript files

  Find All References:

  - Find all component references with context categorization
  - Locate system references across workspace
  - Track prefab usage throughout codebase
  - Results displayed in peek view or references panel
  - Distinguishes between definitions, imports, and usage

  Enhanced Commands:

  - `orion-ecs.findComponentReferences`: Find component usage
  - `orion-ecs.findSystemReferences`: Find system usage
  - `orion-ecs.findPrefabReferences`: Find prefab usage
  - `orion-ecs.goToDefinition`: Jump to ECS element definition

  Includes comprehensive test coverage for navigation providers and context detection logic.

- [#312](https://github.com/tyevco/OrionECS/pull/312) [`567b114`](https://github.com/tyevco/OrionECS/commit/567b11475e21ffe737bbc6aad8494535207375ac) Thanks [@tyevco](https://github.com/tyevco)! - Add debugging tools (Entity Inspector, System Visualizer)

  Entity Inspector Panel:

  - WebView panel for deep entity inspection
  - Live component data visualization with JSON formatting
  - Tag list display and management
  - Parent/child hierarchy navigation
  - Real-time updates via debug bridge
  - Demo mode for testing without live engine

  System Visualizer Panel:

  - Comprehensive system performance analysis
  - Execution time tracking and profiling
  - Query match statistics (entities processed per update)
  - System priority visualization
  - Enable/disable system controls
  - Sortable by execution time or priority

  Debug Bridge:

  - WebSocket-based communication between extension and engine
  - Entity snapshot protocol for live inspection
  - System profiling data aggregation
  - Extensible command/response architecture

- [#312](https://github.com/tyevco/OrionECS/pull/312) [`567b114`](https://github.com/tyevco/OrionECS/commit/567b11475e21ffe737bbc6aad8494535207375ac) Thanks [@tyevco](https://github.com/tyevco)! - Add comprehensive VS Code extension for OrionECS development

  Core Features:

  - Component Tree View: Browse all components in your workspace with CodeLens integration
  - System Tree View: View and manage systems with enable/disable toggles
  - Entity Tree View: Inspect runtime entities with real-time updates
  - Auto-completion: IntelliSense for component names, system names, and prefabs
  - Hover Information: Rich tooltips for components and systems with metadata
  - Diagnostics: Real-time validation of component usage and system definitions

  Code Intelligence:

  - Syntax highlighting for ECS patterns
  - Component snippet generators
  - System callback template completion
  - Prefab definition scaffolding

  The extension integrates with OrionECS runtime via debug protocol for live entity inspection.

- [#312](https://github.com/tyevco/OrionECS/pull/312) [`567b114`](https://github.com/tyevco/OrionECS/commit/567b11475e21ffe737bbc6aad8494535207375ac) Thanks [@tyevco](https://github.com/tyevco)! - Add refactoring support for ECS components

  Rename Component:

  - ComponentRenameProvider for intelligent component renaming
  - Workspace-wide reference updates including:
    - Class definitions and imports
    - Entity methods (addComponent, getComponent, hasComponent, removeComponent)
    - System queries (all, any, none arrays)
    - Prefab type definitions
    - Singleton method calls
  - Preview changes before applying
  - Maintains code consistency across all files

  Extract Component:

  - ExtractComponentCodeActionProvider for property extraction
  - Generate new component classes from selected properties
  - Automatic boilerplate generation (constructor, TypeScript types)
  - Option to extract to same file or new file
  - Auto-import statements for new components

  Additional Refactoring Commands:

  - `orion-ecs.renameComponent`: Trigger rename operation at cursor
  - `orion-ecs.previewComponentReferences`: Preview all component references
  - `orion-ecs.moveComponentToFile`: Move component class to new file
  - `orion-ecs.extractComponent`: Extract properties to new component class

  Includes refactoring utilities for workspace-wide reference tracking and analysis.

- [#312](https://github.com/tyevco/OrionECS/pull/312) [`567b114`](https://github.com/tyevco/OrionECS/commit/567b11475e21ffe737bbc6aad8494535207375ac) Thanks [@tyevco](https://github.com/tyevco)! - Add visualization tools (Entity Hierarchy Tree, Archetype Visualizer)

  Entity Hierarchy Tree:

  - New EntityHierarchyTreeProvider for runtime hierarchy visualization
  - Parent-child relationship tree with expand/collapse navigation
  - Component count and tag information per entity
  - Interactive selection with Entity Inspector integration
  - Real-time updates via debug bridge
  - Visual indicators for entity state and composition

  Archetype Visualizer Panel:

  - WebView panel displaying all engine archetypes
  - Component composition breakdown per archetype
  - Entity count statistics per archetype
  - Performance metrics:
    - Cache hit rate tracking
    - Memory consumption per archetype
    - Query match efficiency
  - Sortable views (by entity count, memory, component count)
  - Color-coded memory usage indicators
  - Demo mode with simulated archetype data

  Enhanced Debug Protocol:

  - ArchetypeSnapshot type for archetype metadata
  - Memory profiling data structures
  - Performance statistics aggregation
  - Extended debug bridge commands for visualization

  New Commands:

  - `orion-ecs.showEntityHierarchy`: Open hierarchy tree view
  - `orion-ecs.showArchetypeVisualizer`: Open archetype panel
  - `orion-ecs.refreshHierarchy`: Refresh hierarchy data
