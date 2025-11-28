# @orion-ecs/eslint-plugin-ecs

ESLint plugin for enforcing ECS (Entity Component System) best practices in OrionECS projects.

## Installation

```bash
npm install @orion-ecs/eslint-plugin-ecs --save-dev
```

## Rules

### `ecs/data-only-components`

Enforces that ECS components contain only data (no methods except constructor).

**Why?** In ECS architecture, components should be pure data containers. Logic belongs in Systems, not components.

```typescript
// Bad - component has methods
class Position {
  constructor(public x: number, public y: number) {}

  // This method should be in a System!
  distanceTo(other: Position): number {
    return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
  }
}

// Good - data only
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}
```

**Options:**
- `componentPattern`: Regex to identify component classes (default: common component names)
- `allowedMethods`: Methods that are allowed (default: `['clone', 'reset', 'toString', 'toJSON']`)
- `checkAllClasses`: If true, checks all classes regardless of name
- `detectFromUsage`: If true, detect components by tracking `addComponent`, `createSystem`, etc. calls

### `ecs/no-component-logic`

Disallows complex logic in ECS component constructors.

**Why?** Component constructors should only perform simple value assignment. Complex initialization should be handled by factory systems or initialization systems.

```typescript
// Bad - complex logic in constructor
class Inventory {
  public items: Item[] = [];

  constructor(itemIds: number[]) {
    // Don't do this in a component!
    for (const id of itemIds) {
      if (id > 0) {
        this.items.push(loadItem(id));
      }
    }
  }
}

// Good - simple initialization
class Inventory {
  constructor(public items: Item[] = []) {}
}
```

**Options:**
- `componentPattern`: Regex to identify component classes
- `allowedFunctions`: Function calls allowed in constructors (default includes `Date.now`, `Math.*`, etc.)

### `ecs/prefer-composition`

Discourages inheritance between ECS components.

**Why?** ECS uses composition over inheritance. Instead of creating a class hierarchy, compose entities from multiple focused components.

```typescript
// Bad - component inheritance
class MovingEntity extends Position {
  constructor(x: number, y: number, public vx: number, public vy: number) {
    super(x, y);
  }
}

// Good - composition with separate components
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public x: number = 0, public y: number = 0) {}
}

// Compose on entity:
entity.addComponent(Position, 0, 0);
entity.addComponent(Velocity, 1, 1);
```

**Options:**
- `componentPattern`: Regex to identify component classes
- `allowedBaseClasses`: Base classes that are allowed (for framework base classes)

### `ecs/no-entity-mutation-outside-system`

Warns when entity mutations occur outside of ECS systems.

**Why?** Mutating entities (adding/removing components, destroying entities) should happen within Systems for predictable behavior and proper command buffer usage.

```typescript
// Bad - mutation outside a system
function setupGame() {
  const player = engine.createEntity();
  player.addComponent(Position, 0, 0); // Warning!
}

// Good - mutation inside a system
engine.createSystem('SpawnSystem', { all: [SpawnRequest] }, {
  act: (entity, spawn) => {
    const newEntity = engine.createEntity();
    newEntity.addComponent(Position, spawn.x, spawn.y);
  }
});
```

**Options:**
- `systemPattern`: Regex to identify system contexts (default includes `System`, `act`, etc.)
- `entityMethods`: Methods to check for (default: `addComponent`, `removeComponent`, etc.)

## Configuration

### Recommended Config

```javascript
// eslint.config.js
import ecsPlugin from '@orion-ecs/eslint-plugin-ecs';

export default [
  {
    plugins: { ecs: ecsPlugin },
    rules: {
      'ecs/data-only-components': 'warn',
      'ecs/no-component-logic': 'warn',
      'ecs/prefer-composition': 'warn',
      'ecs/no-entity-mutation-outside-system': 'off',
    },
  },
];
```

### Strict Config

```javascript
// For stricter enforcement
rules: {
  'ecs/data-only-components': 'error',
  'ecs/no-component-logic': 'error',
  'ecs/prefer-composition': 'error',
  'ecs/no-entity-mutation-outside-system': 'warn',
}
```

## Customizing Component Detection

By default, rules detect components by common naming patterns. You can customize this:

```javascript
rules: {
  'ecs/data-only-components': ['warn', {
    // Match your project's naming convention
    componentPattern: '(Component|Comp|Data)$',

    // Allow specific utility methods
    allowedMethods: ['clone', 'reset', 'serialize', 'deserialize'],
  }],
}
```

## Usage-Based Component Detection

Instead of relying on naming patterns, you can enable **usage-based detection** to identify components by tracking how they're used in ECS APIs:

```javascript
rules: {
  'ecs/data-only-components': ['warn', {
    detectFromUsage: true,
    componentPattern: '^$',  // Disable pattern matching, rely only on usage
  }],
}
```

With `detectFromUsage: true`, the rules detect components by tracking calls to:
- `entity.addComponent(ClassName, ...)`
- `entity.getComponent(ClassName)`
- `entity.hasComponent(ClassName)`
- `engine.registerComponent(ClassName)`
- `engine.createSystem('name', { all: [A, B], none: [C] }, ...)`
- `engine.query().withAll(A, B).build()`
- `engine.setSingleton(ClassName, ...)`

**Benefits:**
- No naming conventions required
- More accurate - only checks classes actually used as components
- Works with any class name

**Example:**
```typescript
// This class will be detected as a component and flagged for having a method
class PlayerData {
  constructor(public score: number) {}
  incrementScore() { this.score++; }  // Warning!
}

entity.addComponent(PlayerData, 0);  // Detection happens here
```

## Integration with OrionECS

This plugin is designed specifically for [OrionECS](https://github.com/tyevco/OrionECS) projects but can be used with any ECS framework that follows similar patterns.

## Future: Oxlint Plugin

Oxlint now supports [JavaScript plugins](https://oxc.rs/blog/2025-10-09-oxlint-js-plugins.html) which could provide ~15x faster linting compared to ESLint. A future version of these ECS rules could be implemented as an Oxlint plugin for better integration with the existing OrionECS toolchain.

**Potential Oxlint implementation:**

```javascript
// oxlint-plugin-ecs.js
const dataOnlyComponents = {
  create(context) {
    const componentPattern = /(Component|Position|Velocity|Health|Transform)$/;
    const allowedMethods = new Set(['clone', 'reset', 'toString', 'toJSON', 'constructor']);

    return {
      MethodDefinition(node) {
        const classNode = node.parent?.parent;
        if (classNode?.type !== 'ClassDeclaration') return;
        if (!classNode.id || !componentPattern.test(classNode.id.name)) return;

        const methodName = node.key?.name;
        if (methodName && !allowedMethods.has(methodName)) {
          context.report({
            node,
            message: `ECS: Move method "${methodName}" to a System`,
          });
        }
      },
    };
  },
};

export default {
  meta: { name: 'ecs' },
  rules: { 'data-only-components': dataOnlyComponents },
};
```

**Configuration** (`.oxlintrc.json`):
```json
{
  "jsPlugins": ["./oxlint-plugin-ecs.js"],
  "rules": {
    "ecs/data-only-components": "warn"
  }
}
```

**Benefits of Oxlint approach:**
- ~15x faster than ESLint (benchmarked at 236ms vs 4,116ms)
- Native integration with existing `npm run lint` workflow
- Uses `createOnce` API to reduce garbage collection overhead
- Single toolchain (no separate ESLint dependency needed)

**Current limitations** (as of Oxlint v1.25):
- No rule options support yet (configuration must be hardcoded)
- No suggestions API
- Limited scope analysis

Track Oxlint plugin progress: https://github.com/oxc-project/oxc/issues/481
