# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Orion ECS is a comprehensive Entity Component System (ECS) framework written in TypeScript. The framework uses a **composition-based architecture (v2.0)** with focused managers for separation of concerns, providing advanced capabilities for building complex games and simulations.

### Core Architecture Patterns

- **Entity**: Advanced objects with unique symbol IDs, hierarchical relationships, tags, and serialization
- **Component**: Data-only structures with validation, dependencies, and pooling support
- **System**: Logic processors with priority, profiling, and advanced query capabilities
- **Engine**: Central facade that coordinates specialized managers for different responsibilities

### Composition-Based Architecture (v2.0)

The implementation uses focused managers for separation of concerns:
- **EngineBuilder** (`core/src/engine.ts`): Fluent builder for composing an Engine from managers
- **Engine** (`core/src/engine.ts`): Main facade providing a clean API over specialized managers
- **Core Components** (`core/src/core.ts`): Entity, Query, System, EventEmitter, PerformanceMonitor, EntityManager
- **Managers** (`core/src/managers.ts`): ComponentManager, SystemManager, QueryManager, PrefabManager, SnapshotManager, MessageManager

## Core Architecture

### Main Files

**core/src/engine.ts** - Engine facade and builder
- `EngineBuilder`: Fluent API for configuring and building an Engine instance
- `Engine`: Main class providing a clean API over the manager-based architecture

**core/src/core.ts** - Core ECS components
- `Entity`: Full-featured entities with hierarchy, tags, and serialization
- `System`: Advanced systems with profiling, priority, and lifecycle hooks
- `Query`: Advanced query system with ALL/ANY/NOT and tag support
- `ComponentArray`: Enhanced sparse arrays with change tracking
- `Pool`: Advanced object pooling with metrics
- `EventEmitter`: Enhanced event system with history
- `PerformanceMonitor`: Frame time tracking and statistics
- `EntityManager`: Entity lifecycle and pooling management

**core/src/managers.ts** - Specialized manager classes
- `ComponentManager`: Component registration, validation, and storage
- `SystemManager`: System execution, profiling, and fixed/variable update handling
- `QueryManager`: Query creation and entity matching
- `PrefabManager`: Entity template registration and retrieval
- `SnapshotManager`: World state snapshot creation and restoration
- `MessageManager`: Inter-system messaging and communication

### Complete Feature Set

**Performance & Memory Enhancements:**
- Component archetype system for cache locality and performance
- Advanced object pooling with metrics and reuse tracking
- Component change detection and versioning
- Memory usage analysis and profiling tools
- Performance monitoring utilities

**Developer Experience:**
- Entity hierarchies (parent/child relationships)
- Entity naming and tagging system
- Component validation and dependency checking
- Enhanced error messages with entity context
- Debug mode with comprehensive logging
- System execution profiling and timing

**Advanced Query System:**
- ALL queries (entities with all specified components)
- ANY queries (entities with any of specified components) 
- NOT queries (entities WITHOUT specified components)
- Tag-based queries for flexible entity categorization
- Query result caching and optimization

**System Management:**
- System priority ordering and execution groups
- Runtime system enable/disable functionality
- System tagging and categorization
- Inter-system messaging and event communication
- System lifecycle hooks (before/after execution)

**Entity Features:**
- Entity prefab/template system for rapid creation
- Bulk entity operations (create/destroy multiple entities)
- Entity serialization and world state snapshots
- Entity hierarchy with parent/child relationships
- Component pooling for frequently used components

**Global State Management:**
- Singleton components for engine-wide global state
- Type-safe singleton access with full event support
- Singleton serialization in world snapshots
- System callbacks for singleton changes
- Plugin support for singleton management

**Validation & Safety:**
- Component dependencies and conflict checking
- Runtime component validation with custom validators
- Type-safe component access with detailed error messages
- Comprehensive debug information and inspection tools

### System Architecture

The Engine supports:
- **Variable update systems**: Run every frame with delta time
- **Fixed update systems**: Run at fixed intervals (60 FPS default) with accumulator-based timing
- **System Priority**: Higher priority systems execute first
- **System Tags**: Categorize and group related systems
- **Runtime Control**: Enable/disable systems during execution
- **Profiling**: Automatic execution time and entity count tracking
- **Message Bus**: Inter-system communication without tight coupling

Entity lifecycle is managed through advanced object pooling to minimize garbage collection, with entities marked for deletion and cleaned up after each frame.

## Development Commands

### Build and Test
- `npm run build` - Build with tsup (outputs CommonJS and ESM to `dist/` with type declarations)
- `npm test` - Run comprehensive unit tests using Jest
- `npm run benchmark` - Run performance benchmarks using jest-bench

### Testing Details
- Tests use Jest with ts-jest preset
- Main engine tests: `core/src/engine.spec.ts`
- Benchmarks: `**/*.bench.ts` files in `/benchmarks/` directory
- Benchmark config uses specialized jest-bench environment for performance testing

### Version Management & Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management and changelog generation.

**When to Create a Changeset:**
- After implementing a new feature (minor or major change)
- After fixing a bug (patch change)
- After making breaking changes (major change)
- Before creating a PR for any user-facing changes

**Do NOT create changesets for:**
- Internal refactoring that doesn't affect the public API
- Documentation-only changes
- Test-only changes
- CI/CD configuration changes
- Changes to examples or tutorials (they're ignored)

**Creating a Changeset:**

```bash
# Interactive mode (recommended)
npx changeset

# Or manually create a file in .changeset/ directory
```

**Changeset Format:**
```markdown
---
"@orion-ecs/core": minor
"@orion-ecs/math": patch
---

Description of your changes

- Bullet point 1
- Bullet point 2
```

**Change Types:**
- `major`: Breaking changes (e.g., API changes, package renames)
- `minor`: New features (backwards compatible)
- `patch`: Bug fixes and small improvements

**Ignored Packages:**
The following packages are automatically ignored and don't need changesets:
- `@orionecs/examples` - Example applications
- `orionecs-tutorial-*` - All tutorial packages (glob pattern)

**Version Workflow:**
1. Create changesets as you make changes
2. Changesets accumulate in `.changeset/` directory
3. When ready to release, run `npx changeset version` to:
   - Bump package versions based on changesets
   - Generate/update CHANGELOG.md files
   - Delete consumed changeset files
4. Commit the version bumps and updated CHANGELOGs
5. Run `npx changeset publish` to publish to npm

**Commands:**
- `npx changeset` - Create a new changeset (interactive)
- `npx changeset add` - Same as above
- `npx changeset status` - View pending changesets and version bumps
- `npx changeset version` - Apply changesets and bump versions
- `npx changeset publish` - Publish updated packages to npm

**Configuration:**
Changeset configuration is in `.changeset/config.json`:
- Uses GitHub integration for rich changelogs with PR links
- Automatically updates internal dependencies
- Public access for all packages

**Example Changeset:**
```markdown
---
"@orion-ecs/core": minor
---

Add singleton component support for global state management

- Singleton components enforce single-instance constraint
- Type-safe access via engine.getSingleton()
- Full event support for singleton changes
- Includes serialization support
```

### Repository Structure
The repository uses a monorepo structure with npm workspaces:

- Root `/` - Workspace coordinator
  - `package.json` - Workspace configuration and shared scripts
  - `.husky/`, linter configs - Repository-level tooling
  - `benchmarks/` - Performance benchmarks
  - `examples/` - Example games and integrations

- `core/` - Core OrionECS engine package
  - `package.json` - Core package configuration
  - `tsconfig.json` - Core TypeScript configuration
  - `tsup.config.ts` - Core build configuration
  - `jest.config.js` - Core test configuration
  - `src/` - Core implementation
    - `engine.ts` - Engine facade and EngineBuilder
    - `core.ts` - Core ECS components (Entity, Query, System, etc.)
    - `managers.ts` - Specialized manager classes
    - `archetype.ts` - Archetype and ArchetypeManager for performance optimization
    - `definitions.ts` - TypeScript interfaces and type definitions
    - `index.ts` - Public API exports
    - `engine.spec.ts` - Comprehensive test suite
    - `archetype.spec.ts` - Archetype system tests

- `plugins/` - Official OrionECS plugins (each can be a separate package)
  - `physics/src/PhysicsPlugin.ts` - Rigid body dynamics
  - `spatial-partition/src/SpatialPartitionPlugin.ts` - Collision detection
  - `debug-visualizer/src/DebugVisualizerPlugin.ts` - Debug tools
  - `profiling/src/ProfilingPlugin.ts` - Performance metrics
  - `resource-manager/src/ResourceManagerPlugin.ts` - Asset management
  - Each plugin directory ready for its own `package.json`

- `examples/` - Sample applications
  - `games/` - Complete game examples (Asteroids, Platformer)
  - `integrations/` - Framework integrations (Pixi.js)

## Code Patterns

### Component Definition
Components should be simple data classes with optional validation:
```typescript
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Health {
  constructor(public current: number = 100, public max: number = 100) {}
}

// Tag components for categorization (from utils.ts)
import { createTagComponent } from 'orion-ecs';
const PlayerTag = createTagComponent('Player');
```

### System Creation
Systems are created with advanced queries and comprehensive options:
```typescript
engine.createSystem('MovementSystem', {
  all: [Position, Velocity],  // Must have both components
  none: [Frozen],            // Must not have Frozen component
  tags: ['active']           // Must have 'active' tag
}, {
  priority: 10,              // Higher priority = runs first
  before: () => { },         // Pre-execution hook
  act: (entity, position, velocity) => {
    position.x += velocity.x;
    position.y += velocity.y;
  },
  after: () => { }           // Post-execution hook
}, false); // false = variable update, true = fixed update
```

### Entity Management

**Basic Operations:**
- Create entities: `engine.createEntity('EntityName')`
- Components: `entity.addComponent(ComponentClass, ...args)`
- Cleanup: `entity.queueFree()` for deferred deletion

**Advanced Features:**
- Bulk creation: `engine.createEntities(10)` or `engine.createEntities(10, 'PrefabName')`
- Hierarchies: `parent.addChild(child)` or `child.setParent(parent)`
- Tags: `entity.addTag('player').addTag('active')`
- Prefabs: `engine.createFromPrefab('PlayerPrefab', 'Player1')`
- Component pooling: `engine.registerComponentPool(Particle, { initialSize: 100 })`

### Entity Hierarchy System

OrionECS provides comprehensive parent-child hierarchy support with query methods and observer events.

**Basic Hierarchy Operations:**
```typescript
// Create hierarchy
const parent = engine.createEntity('Parent');
const child = engine.createEntity('Child');

// Establish relationship (either method works)
parent.addChild(child);
// or: child.setParent(parent);

// Remove from hierarchy
child.setParent(null);
// or: parent.removeChild(child);
```

**Hierarchy Query Methods:**
```typescript
// Get all descendants (children, grandchildren, etc.)
const allDescendants = parent.getDescendants();
const topTwoLevels = parent.getDescendants(2);  // Limit depth

// Get all ancestors (parent, grandparent, etc.)
const ancestors = child.getAncestors();  // Nearest to furthest

// Find specific children
const enemy = parent.findChild(e => e.hasTag('enemy'));
const enemies = parent.findChildren(e => e.hasTag('enemy'), true);  // Recursive

// Hierarchy info
const root = child.getRoot();            // Get root of hierarchy
const depth = child.getDepth();          // 0 = root, 1 = child of root, etc.
const siblings = child.getSiblings();    // Get sibling entities

// Relationship checks
const isAncestor = parent.isAncestorOf(grandchild);
const isDescendant = grandchild.isDescendantOf(parent);
const hasChildren = parent.hasChildren();
const hasParent = child.hasParent();
const childCount = parent.getChildCount();
```

**Hierarchy Observer Events:**

Listen for hierarchy changes at the engine level:
```typescript
// Child added to a parent
engine.on('onChildAdded', (event) => {
  console.log(`${event.child.name} added to ${event.parent.name}`);
});

// Child removed from a parent
engine.on('onChildRemoved', (event) => {
  console.log(`${event.child.name} removed from ${event.parent.name}`);
});

// Entity's parent changed
engine.on('onParentChanged', (event) => {
  console.log(`${event.entity.name} parent: ${event.previousParent?.name} -> ${event.newParent?.name}`);
});
```

**System-Level Hierarchy Callbacks:**
```typescript
engine.createSystem('HierarchyWatcher', { all: [Transform] }, {
  watchHierarchy: true,  // Enable hierarchy callbacks

  onChildAdded: (event) => {
    // React to children being added
    console.log(`Child added: ${event.child.name}`);
  },

  onChildRemoved: (event) => {
    // React to children being removed
    console.log(`Child removed: ${event.child.name}`);
  },

  onParentChanged: (event) => {
    // React to parent changes
    const { entity, previousParent, newParent } = event;
    // Update world transforms, recalculate bounds, etc.
  },

  act: (entity, transform) => {
    // Normal system logic
  }
});
```

### Advanced Features Usage

**Component Validation:**
```typescript
engine.registerComponentValidator(Health, {
  validate: (component) => component.current >= 0 ? true : 'Health cannot be negative',
  dependencies: [Position],  // Requires Position component
  conflicts: [Ghost]         // Cannot coexist with Ghost component  
});
```

**Entity Prefabs:**
```typescript
const playerPrefab: EntityPrefab = {
  name: 'Player',
  components: [
    { type: Position, args: [0, 0] },
    { type: Health, args: [100, 100] }
  ],
  tags: ['player', 'controllable']
};
engine.registerPrefab('Player', playerPrefab);
```

**Inter-System Messaging:**
```typescript
// In one system
engine.messageBus.publish('enemy-killed', { score: 100 }, 'CombatSystem');

// In another system
engine.messageBus.subscribe('enemy-killed', (message) => {
  this.updateScore(message.data.score);
});
```

**Performance Monitoring:**
```typescript
const profiles = engine.getSystemProfiles();
const memoryStats = engine.getMemoryStats();
const debugInfo = engine.getDebugInfo();
```

**Singleton Components (Global State Management):**

Singleton components exist once per engine instance and are independent of entities. They're perfect for managing global state like game time, settings, or score managers.

```typescript
// Define singleton components
class GameTime {
  constructor(public elapsed: number = 0, public deltaTime: number = 0) {}
}

class GameSettings {
  constructor(public volume: number = 1.0, public difficulty: string = 'normal') {}
}

// Set singletons
engine.setSingleton(GameTime, 0, 0);
engine.setSingleton(GameSettings, 1.0, 'normal');

// Get and modify singletons
const time = engine.getSingleton(GameTime);
if (time) {
  time.elapsed += deltaTime;
  engine.markSingletonDirty(GameTime); // Emit change event
}

// Check if singleton exists
if (engine.hasSingleton(GameSettings)) {
  const settings = engine.getSingleton(GameSettings);
  console.log(`Volume: ${settings?.volume}`);
}

// Remove singleton
engine.removeSingleton(GameSettings);

// Systems can listen for singleton changes
engine.createSystem('SettingsWatcher', { all: [] }, {
  watchSingletons: [GameSettings],
  onSingletonSet: (event) => {
    console.log('Settings updated:', event.newValue);
  },
  onSingletonRemoved: (event) => {
    console.log('Settings removed');
  }
});

// Singletons are included in snapshots
engine.createSnapshot(); // Saves singleton state
engine.restoreSnapshot(); // Restores singleton state
```

**Key Features:**
- **Global State**: One instance per engine, not tied to entities
- **Type-Safe**: Full TypeScript support with generics
- **Event System**: Emit events when singletons are set, updated, or removed
- **Serialization**: Automatically included in world snapshots
- **System Integration**: Systems can listen for singleton changes
- **Plugin Support**: Plugins can manage singletons via PluginContext

**Common Use Cases:**
- `GameTime` - Track elapsed time and delta time
- `GameSettings` - Volume, difficulty, graphics settings
- `ScoreManager` - Current score, high score, combo multiplier
- `InputState` - Global input state (keyboard, mouse, gamepad)
- `PhysicsConfig` - Global physics parameters (gravity, timestep)
- `ResourceManager` - Asset loading and caching state

### Entity Archetype System

Orion ECS implements an advanced archetype system inspired by Unity DOTS and Bevy ECS for significant performance improvements through better cache locality.

**What are Archetypes?**

Archetypes group entities with the same component composition together in contiguous memory. When you iterate over entities with specific components, all data is stored together, dramatically improving cache performance.

**Key Benefits:**
- **Cache Locality**: Components for entities with same composition stored contiguously
- **Faster Iteration**: Systems iterate over dense arrays instead of sparse lookups
- **Automatic Management**: Entities automatically move between archetypes when components change
- **Query Optimization**: Queries match entire archetypes instead of testing individual entities

**Enable/Disable Archetypes:**

Archetypes are **enabled by default**. You can disable them if needed:

```typescript
// Archetypes enabled (default, recommended)
const engine = new EngineBuilder().build();

// Explicitly enable archetypes
const engineWithArchetypes = new EngineBuilder()
  .withArchetypes(true)
  .build();

// Disable archetypes (legacy mode)
const engineWithoutArchetypes = new EngineBuilder()
  .withArchetypes(false)
  .build();
```

**How Archetypes Work:**

When you add or remove components, entities automatically move to the appropriate archetype:

```typescript
const entity = engine.createEntity();
// Entity is in empty archetype: ""

entity.addComponent(Position, 0, 0);
// Entity moved to archetype: "Position"

entity.addComponent(Velocity, 1, 1);
// Entity moved to archetype: "Position,Velocity"

entity.removeComponent(Position);
// Entity moved to archetype: "Velocity"
```

**Performance Impact:**

Systems that iterate over many entities with the same components see significant performance improvements:

```typescript
// Create 10,000 entities with same composition
for (let i = 0; i < 10000; i++) {
  const entity = engine.createEntity();
  entity.addComponent(Position, i, i);
  entity.addComponent(Velocity, 1, 1);
}
// All 10,000 entities are in the same archetype "Position,Velocity"

// This system iteration is highly cache-friendly
engine.createSystem('MovementSystem', {
  all: [Position, Velocity]
}, {
  act: (entity, position, velocity) => {
    // Components are accessed sequentially in memory
    position.x += velocity.x;
    position.y += velocity.y;
  }
});
```

**Monitoring Archetypes:**

You can inspect archetype statistics for debugging and optimization:

```typescript
// Check if archetypes are enabled
const enabled = engine.areArchetypesEnabled();

// Get archetype statistics
const stats = engine.getArchetypeStats();
console.log(stats);
// {
//   archetypeCount: 5,
//   archetypeCreationCount: 5,
//   entityMovementCount: 10,
//   archetypes: [
//     { id: "Position,Velocity", entityCount: 5000, componentTypeCount: 2 },
//     { id: "Position", entityCount: 1000, componentTypeCount: 1 },
//     ...
//   ]
// }

// Get memory statistics
const memStats = engine.getArchetypeMemoryStats();
console.log(memStats);
// {
//   totalEntities: 6000,
//   totalArchetypes: 5,
//   estimatedBytes: 384000,
//   archetypeBreakdown: [...]
// }
```

**When to Use Archetypes:**

- ✅ **Recommended**: Games and simulations with many entities
- ✅ **Ideal**: Systems that iterate over large numbers of entities
- ✅ **Best**: Entities that share common component compositions
- ⚠️ **Consider disabling**: Prototyping with frequently changing component structures
- ⚠️ **Less beneficial**: Very few entities (< 100) or highly diverse component compositions

**Performance Benchmarks:**

See `benchmarks/archetype-benchmark.ts` for comprehensive performance comparisons showing 2-5x iteration speed improvements with archetypes enabled.

### Plugin System

Orion ECS features a powerful plugin architecture for extending functionality without modifying core code.

**Plugin Architecture Notes:**
- Plugins implement the `EnginePlugin` interface (`core/src/definitions.ts`)
- Use `PluginContext` for sandboxed access to engine features
- Register plugins via `EngineBuilder.use(plugin)` before building
- Plugins installed during engine construction (see `core/src/engine.ts` EngineBuilder)
- Custom APIs added via `context.extend()` become properties on engine instance

**Implementation Pattern:**
```typescript
// Basic plugin structure
class MyPlugin implements EnginePlugin {
  name = 'MyPlugin';
  version = '1.0.0';

  install(context: PluginContext): void {
    // Register components, create systems, extend API
    context.extend('myApi', { /* custom methods */ });
  }

  uninstall?(): void { /* cleanup */ }
}

// Usage
const engine = new EngineBuilder()
  .use(new MyPlugin())
  .build();
```

**Common Plugin Use Cases:**
- **Feature Extensions**: Physics, networking, audio systems
- **Utility Functions**: Bulk operations, search methods, cloning
- **Integrations**: Rendering engines (Pixi.js, Three.js), UI frameworks
- **Development Tools**: Debuggers, visualizers, profilers

**Reference Implementation:** See `plugins/physics/src/PhysicsPlugin.ts` for a complete, tested plugin example.

**For detailed plugin API and examples, see README.md Plugin System section.**

## When to Use Orion ECS

### Ideal For:
- Complex games and simulations requiring advanced ECS features
- Applications needing entity hierarchies and relationships
- Projects requiring comprehensive debugging and profiling tools
- Systems needing component validation and error handling
- Applications with inter-system communication requirements
- Development environments where debugging assistance is important
- Production systems requiring high performance with rich features

### Consider Alternatives For:
- Extremely simple applications with minimal ECS needs
- Ultra-resource-constrained environments (embedded systems)
- Applications where bundle size is more critical than features

## TypeScript Configuration

- Target: ES6 with CommonJS modules
- Strict mode enabled
- Declarations generated for library distribution
- Test files excluded from compilation
- Comprehensive type definitions for all features

## Performance Considerations

- Engine optimized for high performance with comprehensive features
- Built-in performance monitoring and profiling tools
- Component pooling available for frequently created/destroyed components
- Archetype system improves cache locality and performance
- Query caching reduces repeated entity lookups
- Advanced object pooling minimizes garbage collection pressure
- Debug mode can be disabled in production for maximum performance

## Getting Started

To use Orion ECS in your project:
1. Install with `npm install orion-ecs`
2. Import the EngineBuilder class: `import { EngineBuilder } from 'orion-ecs'`
3. Build your engine with desired configuration:
   ```typescript
   const engine = new EngineBuilder()
     .withDebugMode(true)
     .withFixedUpdateFPS(60)
     .withMaxFixedIterations(10)
     .build();
   ```
4. Create systems using the advanced query syntax
5. Use component validators for robust development
6. Leverage advanced features like tags, hierarchies, and prefabs
7. Enable debug mode during development for enhanced error messages

## GitHub Issue Management & Progress Tracking

**IMPORTANT:** This project uses GitHub Issues and Milestones for ALL tracking, planning, and analysis. DO NOT create markdown files in the repository for tracking purposes.

### Core Principles

1. **Use GitHub Issues for Everything**
   - Feature requests, bugs, enhancements, documentation tasks
   - Analysis results and findings
   - Progress tracking and status updates
   - Technical discussions and decisions

2. **Never Create Tracking Documents in Repo**
   - ❌ NO analysis documents (e.g., ANALYSIS.md, FINDINGS.md)
   - ❌ NO action item documents (e.g., TODO.md, TASKS.md)
   - ❌ NO tracking spreadsheets or status files
   - ✅ USE GitHub Issues and comments instead
   - ✅ USE GitHub Milestones for organization
   - ✅ USE GitHub Projects for kanban boards (if needed)

3. **Keep Repo Clean**
   - Only production code, tests, examples, and configuration
   - README.md and CLAUDE.md for documentation
   - No temporary tracking files

### Working with GitHub Issues

#### Using `gh` CLI Commands

**List Issues:**
```bash
# List all open issues
gh issue list

# List all issues (open and closed) with details
gh issue list --state all --json number,title,state,labels,milestone

# Filter by milestone
gh issue list --milestone "v0.3.0"

# Filter by label
gh issue list --label "documentation"
```

**Create Issues:**
```bash
# Create new issue
gh issue create --title "Issue Title" --label "enhancement,documentation" --body "Issue description"

# Create with milestone
gh issue create --title "API Documentation" --milestone "v0.3.0" --label "documentation" --body "$(cat issue-description.md)"

# Create from file
gh issue create --title "Feature Request" --body-file feature-description.md
```

**Update Issues:**
```bash
# Add comment with findings
gh issue comment 88 --body "**Analysis Finding:** This is HIGH PRIORITY..."

# Edit issue details
gh issue edit 88 --add-label "high-priority"
gh issue edit 88 --milestone "v0.3.0"

# Close issue
gh issue close 88 --reason "completed"
gh issue close 88 --reason "not planned" --comment "Closing as duplicate of #92"
```

**View Issues:**
```bash
# View issue in terminal
gh issue view 88

# Open in browser
gh issue view 88 --web
```

#### Fallback: Using WebFetch When `gh` CLI Fails

If the GitHub CLI (`gh`) is unavailable or fails, use the WebFetch tool to access GitHub issues directly:

**View Issue:**
```typescript
// Fetch specific issue
WebFetch('https://github.com/tyevco/OrionECS/issues/88', 'Extract the issue title, description, labels, milestone, and current status')

// List issues (view issues page)
WebFetch('https://github.com/tyevco/OrionECS/issues', 'List all open issues with their numbers, titles, and labels')

// View milestone
WebFetch('https://github.com/tyevco/OrionECS/milestone/1', 'List all issues in this milestone with their status')
```

**When to Use WebFetch:**
- ✅ `gh` CLI commands fail with errors
- ✅ GitHub API rate limiting occurs
- ✅ Need to view issue content without modifying
- ✅ Quick lookup of issue details
- ❌ Don't use for creating/updating issues (requires API access)

**Note:** WebFetch is read-only. For creating or modifying issues, you must use the `gh` CLI or ask the user to make changes manually.

#### Creating Tracking Issues

When you complete major analysis or planning work, create a **tracking issue** to document findings:

**Example:**
```bash
gh issue create --title "📊 Comprehensive Codebase Analysis - Findings & Recommendations" \
  --label "documentation" \
  --body "Full analysis results with metrics, findings, and recommendations..."
```

**Tracking Issue Should Include:**
- Executive summary of findings
- Key metrics and statistics
- Coverage analysis
- Priority recommendations
- Links to related issues
- Action items with issue numbers

**See Example:** Issue #110 in this repository

#### Adding Analysis Comments to Issues

When analyzing features or code, add detailed comments to relevant issues:

```bash
gh issue comment 88 --body "**Analysis Finding:** This is a HIGH PRIORITY issue.

**Current State:**
- Core engine has comprehensive inline comments
- Missing: TypeDoc-generated API reference

**Impact:** High - Developers need searchable API documentation

**Recommendation:**
1. Install TypeDoc
2. Add TSDoc comments to all public APIs
3. Set up GitHub Pages deployment

**Estimated Effort:** Medium (2-3 weeks)
**Dependencies:** None
**Blocking:** #90 (Tutorial Series needs API reference)"
```

**Comment Template:**
- **Analysis Finding:** Priority level
- **Current State:** What exists now
- **Impact:** Why this matters
- **Recommendation:** Specific action steps
- **Estimated Effort:** Time estimate
- **Dependencies:** Blocking or blocked by
- **Blocking:** What this blocks

### Working with Milestones

**List Milestones:**
```bash
gh api repos/:owner/:repo/milestones --jq '.[] | {number, title, open_issues, closed_issues}'
```

**Create Milestone:**
```bash
gh api repos/:owner/:repo/milestones -X POST \
  -f title="v0.6.0 - Production Hardening" \
  -f description="Production-critical features..." \
  -f state="open"
```

**Assign Issues to Milestone:**
```bash
gh issue edit 99 --milestone "v0.6.0 - Production Hardening"
```

### Current Milestone Organization

**v0.3.0 - Component Change Events & Reactive Programming**
- Focus: Documentation, testing, and reactive features
- Key issues: #88 (API docs), #89 (testing utilities), #90 (tutorials)

**v0.4.0 - Component Composition & Plugins**
- Focus: Game development patterns and plugin ecosystem
- Key issues: #91 (FSM), #92 (behavior trees), #93 (animation)

**v0.5.0 - Developer Tools & Performance**
- Focus: Developer experience and tooling
- Key issues: #94 (CLI), #96 (regression testing), #97 (error recovery)

**v0.6.0 - Production Hardening**
- Focus: Production-ready features
- Key issues: #99 (multi-world), #100 (schema evolution), #101 (save/load)

**v1.0.0+ - Browser-Based Game Editor**
- Focus: Future vision for browser-based development
- Key issues: #104-#109 (editor components)

### Issue Labels

**Use these labels for categorization:**
- `enhancement` - New features or improvements
- `documentation` - Documentation tasks
- `bug` - Bug reports and fixes
- `tests` - Testing-related tasks
- `performance` - Performance improvements
- `plugin` - Plugin development
- `core` - Core engine changes
- `build` - Build system and tooling
- `dependencies` - Dependency updates

### Best Practices

#### When Conducting Analysis

1. **Explore the codebase** using appropriate tools
2. **Document findings** in a tracking issue (#110 is example)
3. **Add detailed comments** to related issues with findings
4. **Update milestone progress** as needed
5. **Close duplicate issues** with references
6. **Close implemented features** with documentation links

#### When Planning Features

1. **Create issues** for each discrete feature/task
2. **Organize by milestone** for timeline clarity
3. **Add labels** for categorization
4. **Link related issues** in descriptions
5. **Break down large features** into subtasks using task lists
6. **Estimate effort** in issue comments

#### When Tracking Progress

1. **Use issue comments** for status updates
2. **Close issues** when complete with summary
3. **Reference issues** in commit messages
4. **Update milestones** as priorities change
5. **Create tracking issues** for major initiatives

#### Example Workflow

```bash
# 1. Analyze codebase
# (Use Task tool with Explore agent)

# 2. Create tracking issue for findings
gh issue create --title "📊 Analysis Results" --body "..."

# 3. Add comments to priority issues
gh issue comment 88 --body "**Analysis Finding:** ..."
gh issue comment 89 --body "**Analysis Finding:** ..."

# 4. Close duplicates
gh issue close 70 --reason "not planned" --comment "Duplicate of #92"

# 5. Close already-implemented features
gh issue close 73 --reason "completed" --comment "Already implemented in InteractionSystemPlugin"

# 6. Create new milestone if needed
gh api repos/:owner/:repo/milestones -X POST -f title="v0.6.0" -f description="..."

# 7. Organize issues into milestones
gh issue edit 99 --milestone "v0.6.0"
```

### Quick Reference

**Most Common Commands:**
```bash
# Create issue
gh issue create --title "Title" --label "label" --body "Description"

# Add comment
gh issue comment 88 --body "Comment text"

# Close issue
gh issue close 88 --reason "completed"

# List issues
gh issue list --state all

# View issue
gh issue view 88 --web
```

**When in Doubt:**
- Use GitHub Issues, not files
- Create tracking issues for major work
- Add comments for detailed findings
- Keep the repository clean
- Track everything in one place (GitHub)

**See Example:** Issue #110 demonstrates best practices for analysis tracking