# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Orion ECS is a comprehensive Entity Component System (ECS) framework written in TypeScript. The framework uses a **composition-based architecture (v2.0)** with focused managers for separation of concerns.

### Core Architecture Patterns

- **Entity**: Advanced objects with unique symbol IDs, hierarchical relationships, tags, and serialization
- **Component**: Data-only structures with validation, dependencies, and pooling support
- **System**: Logic processors with priority, profiling, and advanced query capabilities
- **Engine**: Central facade that coordinates specialized managers for different responsibilities

### Composition-Based Architecture (v2.0)

The implementation uses focused managers for separation of concerns:
- **EngineBuilder** (`packages/core/src/engine.ts`): Fluent builder for composing an Engine from managers
- **Engine** (`packages/core/src/engine.ts`): Main facade providing a clean API over specialized managers
- **Core Components** (`packages/core/src/core.ts`): Entity, Query, System, EventEmitter, PerformanceMonitor, EntityManager
- **Managers** (`packages/core/src/managers.ts`): ComponentManager, SystemManager, QueryManager, PrefabManager, SnapshotManager, MessageManager

## Core Architecture

### Main Files

| File | Purpose |
|------|---------|
| `packages/core/src/engine.ts` | Engine facade and EngineBuilder |
| `packages/core/src/core.ts` | Entity, System, Query, Pool, EventEmitter, EntityManager |
| `packages/core/src/managers.ts` | ComponentManager, SystemManager, QueryManager, PrefabManager, SnapshotManager, MessageManager |
| `packages/core/src/archetype.ts` | Archetype and ArchetypeManager for performance optimization |
| `packages/core/src/commands.ts` | CommandBuffer, SpawnEntityBuilder, EntityCommandBuilder |
| `packages/core/src/definitions.ts` | TypeScript interfaces and type definitions |
| `packages/core/src/logger.ts` | Secure logging utilities with sanitization |
| `packages/core/src/utils.ts` | Utility functions (createTagComponent, deepCloneComponent) |

### Key Features

- **Archetype System**: Cache-friendly entity storage (enabled by default)
- **Command Buffer**: Deferred entity operations during system execution
- **Singleton Components**: Engine-wide global state management
- **Entity Hierarchies**: Parent/child relationships with query methods
- **Query System**: ALL/ANY/NOT queries with tag support
- **Plugin System**: Extensible architecture via EnginePlugin interface
- **Change Tracking**: Component change detection with optional proxy-based reactivity

## Development Commands

```bash
npm run build      # Build with tsup (CommonJS + ESM)
npm test           # Run Jest tests
npm run benchmark  # Run performance benchmarks
npm run lint       # Run Biome linter
npm run format     # Format code with Biome
npm run typecheck  # TypeScript type checking
npm run check      # Run all checks (lint + format + typecheck)
```

**For detailed development workflow, code style, and testing guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).**

## Critical Rules

### Never Bypass Validation

**IMPORTANT: Bypassing validation checks is considered a failure.**

- **NEVER** use `--no-verify` to skip git hooks
- **NEVER** use `--force` flags to bypass safety checks
- **NEVER** disable linter rules with inline comments to hide errors
- **NEVER** skip tests or type checks to push code faster
- **ALWAYS** fix issues properly in the source code

If pre-commit hooks fail:
1. Review the specific errors reported
2. Fix each issue in the source code
3. Re-run the commit with all checks passing

### Respecting Intentional Linter Bypasses

**Respect existing inline linter bypass comments as intentional decisions.** If you see `// eslint-disable-next-line` or `// @ts-ignore` in committed code, do not flag or remove them.

**Acceptable Pattern - Constructor spread arguments:**
```typescript
// This is the standard pattern for component classes - do not flag
class Position {
  constructor(...args: any[]) {
    // Component initialization
  }
}
```

This pattern allows flexible component instantiation via `entity.addComponent(ComponentClass, ...args)`.

### Keep Documentation Up to Date

**IMPORTANT: Documentation must be updated alongside code changes.**

When making changes that affect the documented behavior, structure, or APIs:

1. **Update relevant documentation files:**
   - `README.md` - API changes, new features, usage examples
   - `CONTRIBUTING.md` - Development workflow, project structure changes
   - `RELEASE.md` - Package additions, publishing process changes
   - `CLAUDE.md` - Architecture changes, new patterns, repository structure
   - `docs/COOKBOOK.md` - New patterns, updated examples
   - Plugin/package `README.md` files - Package-specific documentation

2. **Documentation triggers:**
   - Adding/removing/renaming packages or plugins → Update project structure in CONTRIBUTING.md and CLAUDE.md
   - Adding new public APIs → Update README.md API reference
   - Changing build/test commands → Update CLAUDE.md and CONTRIBUTING.md
   - Adding new configuration options → Document in relevant files
   - Deprecating features → Add migration notes in docs/migrations/

3. **Verification checklist:**
   - Do code examples still work with the changes?
   - Are file paths and directory structures accurate?
   - Are package/plugin lists complete and current?
   - Do cross-references between documents remain valid?

4. **Common documentation locations to check:**
   | Change Type | Files to Update |
   |-------------|-----------------|
   | New package | CONTRIBUTING.md, CLAUDE.md, RELEASE.md |
   | New plugin | CONTRIBUTING.md, CLAUDE.md, RELEASE.md, plugin README |
   | API change | README.md, docs/COOKBOOK.md |
   | New feature | README.md, relevant tutorial |
   | Breaking change | docs/migrations/, CHANGELOG |

## Version Management

This project uses [Changesets](https://github.com/changesets/changesets) for version management.

**Create changesets for:** New features, bug fixes, API changes
**Skip changesets for:** Documentation, tests, internal refactoring

```bash
npx changeset        # Create a new changeset (interactive)
npx changeset status # View pending changesets
```

### Changeset Requirements

**IMPORTANT: All code changes that affect package functionality MUST include a changeset.**

When creating a changeset, you must:
1. Select the affected package(s)
2. Choose the appropriate semantic version bump
3. Write a clear, descriptive summary of the change

### Semantic Version Levels

| Level | When to Use | Examples |
|-------|-------------|----------|
| **patch** | Bug fixes, performance improvements, internal fixes that don't change API | Fix query caching bug, Optimize archetype iteration, Fix memory leak |
| **minor** | New features, new APIs, non-breaking enhancements | Add new query operator, Add component pooling, New system lifecycle hook |
| **major** | Breaking changes, removed APIs, incompatible changes | Remove deprecated method, Change method signature, Rename public class |

### Changeset Description Guidelines

Write descriptions that explain **what changed and why**, not implementation details:

**Good descriptions:**
- `Add support for optional component queries using the 'optional' modifier`
- `Fix entity removal not properly cleaning up parent-child relationships`
- `Improve system iteration performance by 30% through archetype caching`

**Bad descriptions:**
- `Update code` (too vague)
- `Fix bug` (no context)
- `Changed the loop in line 42 to use forEach` (implementation detail)

### Creating Changesets

```bash
# Interactive mode (recommended)
npx changeset

# The changeset file will be created in .changeset/ directory
# Commit the changeset file along with your code changes
```

### When to Skip Changesets

Do NOT create changesets for:
- Documentation-only changes (README, CLAUDE.md, docs/)
- Test-only changes (adding/updating tests without code changes)
- Internal refactoring that doesn't affect public API or behavior
- CI/CD configuration changes
- Example updates (unless they demonstrate new features)

**For detailed changeset workflow and release process, see [RELEASE.md](./RELEASE.md).**

## Repository Structure

```
OrionECS/
├── packages/              # Core packages (npm workspaces)
│   ├── core/              # Main ECS engine (@orion-ecs/core)
│   ├── graphics/          # Graphics utilities (@orion-ecs/graphics)
│   ├── math/              # Math utilities (@orion-ecs/math)
│   ├── plugin-api/        # Plugin API types (@orion-ecs/plugin-api)
│   ├── testing/           # Testing utilities (@orion-ecs/testing)
│   ├── eslint-plugin-ecs/ # ESLint rules for ECS patterns
│   ├── vscode-extension/  # VS Code extension
│   └── create/            # Project scaffolding CLI
├── plugins/               # Official plugins (14 plugins)
├── examples/              # Sample applications (games, integrations)
├── tutorials/             # Runnable tutorial code
├── benchmarks/            # Performance benchmarks
├── docs/                  # Tutorials, migrations, cookbook
└── scripts/               # Build and utility scripts
```

**For detailed package and plugin breakdown, see [CONTRIBUTING.md](./CONTRIBUTING.md#project-structure).**

## Code Patterns

**For comprehensive code examples and API usage, see [README.md](./README.md#quick-start).**

### Quick Reference

```typescript
// Create engine
const engine = new EngineBuilder()
  .withDebugMode(true)
  .withArchetypes(true)
  .build();

// Define components (simple data classes)
class Position { constructor(public x = 0, public y = 0) {} }
class Velocity { constructor(public x = 0, public y = 0) {} }

// Create systems
engine.createSystem('Movement', { all: [Position, Velocity] }, {
  priority: 10,
  act: (entity, pos, vel) => { pos.x += vel.x; pos.y += vel.y; }
});

// Create entities
const entity = engine.createEntity('Player');
entity.addComponent(Position, 0, 0).addComponent(Velocity, 1, 1).addTag('active');

// Command buffer for deferred operations
engine.commands.spawn().named('Bullet').with(Position, x, y);
engine.commands.despawn(entity);

// Singletons for global state
engine.setSingleton(GameTime, 0, 0);
const time = engine.getSingleton(GameTime);
```

## Performance

- **Archetype System**: 2-5x iteration speed improvement
- **Object Pooling**: Minimizes garbage collection
- **Query Caching**: Reduces repeated entity lookups
- **Debug Mode**: Disable in production for maximum performance

**For detailed benchmarks and optimization tips, see [PERFORMANCE.md](./PERFORMANCE.md).**

## GitHub Issue Management

**IMPORTANT:** Use GitHub Issues for ALL tracking. DO NOT create markdown files for tracking purposes.

### Essential Commands

```bash
# List/view issues
gh issue list
gh issue view 88

# Create issue
gh issue create --title "Title" --label "enhancement" --body "Description"

# Update issue
gh issue comment 88 --body "Comment text"
gh issue edit 88 --add-label "high-priority"
gh issue close 88 --reason "completed"

# Milestones
gh issue edit 88 --milestone "v0.3.0"
```

### Fallback: WebFetch

If `gh` CLI fails, use WebFetch to view issues (read-only):
```
WebFetch('https://github.com/tyevco/OrionECS/issues/88', 'Extract issue details')
```

### Issue Labels

| Label | Purpose |
|-------|---------|
| `enhancement` | New features |
| `bug` | Bug reports |
| `documentation` | Docs tasks |
| `core` | Core engine changes |
| `plugin` | Plugin development |
| `performance` | Performance improvements |

### Best Practices

1. **Use GitHub Issues, not files** - No ANALYSIS.md, TODO.md, etc.
2. **Create tracking issues** for major analysis work
3. **Add comments** to issues with detailed findings
4. **Reference issues** in commit messages
5. **Upload full reports as attachments** for detailed findings

## Additional Documentation

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Quick start, API reference, examples |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development workflow, code style, PR process |
| [RELEASE.md](./RELEASE.md) | Release process, changesets, publishing |
| [PERFORMANCE.md](./PERFORMANCE.md) | Benchmarks, optimization tips |
| [docs/COOKBOOK.md](./docs/COOKBOOK.md) | Recipes and patterns |
| [docs/tutorials/](./docs/tutorials/) | Step-by-step tutorials |
| [docs/PERFORMANCE-REGRESSION-TESTING.md](./docs/PERFORMANCE-REGRESSION-TESTING.md) | Performance regression testing system |
| [docs/migrations/](./docs/migrations/) | Migration guides from other ECS frameworks |
