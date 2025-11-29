# Migration Guide: Strict TypeScript Configuration

This guide helps you migrate your OrionECS project to use the new strict TypeScript settings introduced for improved type safety.

## Overview

OrionECS now ships with stricter TypeScript compiler options enabled by default:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

These settings catch more potential bugs at compile time but may require updates to your existing code.

## Breaking Changes

### 1. Array Access Requires Null Checks

With `noUncheckedIndexedAccess`, array element access returns `T | undefined` instead of `T`.

**Before:**
```typescript
const entities = engine.query({ all: [Position] }).getEntities();
const first = entities[0]; // Type: Entity (assumed to exist)
console.log(first.name);   // Could crash if array is empty
```

**After - Option A: Non-null assertion (when you know it exists):**
```typescript
const entities = engine.query({ all: [Position] }).getEntities();
const first = entities[0]!; // Type: Entity (explicit assertion)
console.log(first.name);    // Safe if you verified length
```

**After - Option B: Explicit check (recommended):**
```typescript
const entities = engine.query({ all: [Position] }).getEntities();
const first = entities[0];
if (first) {
    console.log(first.name); // TypeScript knows it exists
}
```

**After - Option C: Array destructuring:**
```typescript
const entities = engine.query({ all: [Position] }).getEntities();
const [first] = entities;
if (first) {
    console.log(first.name);
}
```

### 2. Component Initialization Best Practices

The new `ComponentBuilder` and `defineComponent` utilities provide type-safe alternatives to constructor spread patterns.

**Before (with `any[]`):**
```typescript
class Health {
    current: number;
    max: number;

    constructor(...args: any[]) {
        this.current = args[0] ?? 100;
        this.max = args[1] ?? 100;
    }
}
```

**After - Option A: Using `defineComponent`:**
```typescript
import { defineComponent } from '@orion-ecs/core';

const Health = defineComponent('Health', {
    current: 100,
    max: 100,
    regenRate: 1
});

// Full type inference when adding
entity.addComponent(Health, { current: 50 });
```

**After - Option B: Using `ComponentBuilder`:**
```typescript
import { ComponentBuilder } from '@orion-ecs/core';

class Health {
    current = 100;
    max = 100;
    regenRate = 1;
}

// Builder with full type safety
const health = ComponentBuilder.for(Health)
    .set('current', 50)
    .set('max', 100)
    .build();
```

**After - Option C: Using `createComponentFactory`:**
```typescript
import { createComponentFactory } from '@orion-ecs/core';

class Health {
    current = 100;
    max = 100;
}

const createHealth = createComponentFactory(Health, { max: 150 });
const health = createHealth({ current: 50 });
// Result: { current: 50, max: 150 }
```

### 3. Explicit Type Annotations Required

With `noImplicitAny`, you must explicitly type variables that TypeScript cannot infer.

**Before:**
```typescript
function processEntities(callback) {  // callback is implicitly 'any'
    // ...
}
```

**After:**
```typescript
function processEntities(callback: (entity: Entity) => void): void {
    // ...
}
```

### 4. Stricter Null Handling

`strictNullChecks` requires explicit handling of `null` and `undefined`.

**Before:**
```typescript
function getHealth(entity: Entity) {
    const health = entity.getComponent(Health);
    return health.current; // Could crash if component doesn't exist
}
```

**After:**
```typescript
function getHealth(entity: Entity): number | null {
    const health = entity.getComponent(Health);
    if (!health) {
        return null;
    }
    return health.current;
}

// Or using nullish coalescing:
function getHealth(entity: Entity): number {
    return entity.getComponent(Health)?.current ?? 0;
}
```

## ESLint Rules

The following ESLint rules are now configured to enforce these patterns:

| Rule | Level | Description |
|------|-------|-------------|
| `@typescript-eslint/no-explicit-any` | error | Prevents use of `any` type |
| `@typescript-eslint/prefer-nullish-coalescing` | warn | Prefer `??` over `\|\|` for null checks |
| `@typescript-eslint/strict-boolean-expressions` | warn | Require explicit boolean comparisons |

### Running the Linter

```bash
# Check for issues
npm run lint

# Or use the ECS-specific linter with type-aware rules
npm run lint:ecs
```

## Common Migration Patterns

### Pattern 1: Loop Iteration

**Before:**
```typescript
for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    entity.addTag('processed'); // Error: entity might be undefined
}
```

**After:**
```typescript
for (let i = 0; i < entities.length; i++) {
    const entity = entities[i]!; // Safe: we know i < length
    entity.addTag('processed');
}

// Or use for-of:
for (const entity of entities) {
    entity.addTag('processed');
}
```

### Pattern 2: Map/Object Access

**Before:**
```typescript
const componentMap: Map<string, Component> = new Map();
const comp = componentMap.get('position');
comp.value = 10; // Error: comp might be undefined
```

**After:**
```typescript
const comp = componentMap.get('position');
if (comp) {
    comp.value = 10;
}

// Or with early return:
const comp = componentMap.get('position');
if (!comp) return;
comp.value = 10;
```

### Pattern 3: Optional Chaining for Component Access

**Before:**
```typescript
const position = entity.getComponent(Position);
const x = position ? position.x : 0;
```

**After:**
```typescript
const x = entity.getComponent(Position)?.x ?? 0;
```

### Pattern 4: Type Guards for Component Types

```typescript
// Create a type guard
function hasComponent<T>(
    entity: Entity,
    type: ComponentIdentifier<T>
): entity is Entity & { getComponent(t: typeof type): T } {
    return entity.hasComponent(type);
}

// Use the guard
if (hasComponent(entity, Position)) {
    const pos = entity.getComponent(Position); // Type: Position (not undefined)
}
```

## Gradual Migration

If you need to migrate gradually, you can temporarily relax some settings in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    // Disable these temporarily while migrating:
    "noUncheckedIndexedAccess": false,
    "noImplicitAny": false
  }
}
```

Then enable them one at a time, fixing errors as they appear.

## IDE Support

Modern IDEs like VS Code will show inline errors for all these issues. Enable these settings for the best experience:

```json
// .vscode/settings.json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

## Getting Help

If you encounter issues during migration:

1. Check the error message - TypeScript errors are usually descriptive
2. Look for similar patterns in the OrionECS source code
3. Open an issue at https://github.com/tyevco/OrionECS/issues

## New Utility Functions

The following utilities were added to help with type-safe component handling:

| Utility | Description |
|---------|-------------|
| `ComponentBuilder` | Fluent builder for component instantiation |
| `createComponentFactory` | Create reusable component factories |
| `defineComponent` | Define components with typed properties |

See the [README](../../README.md) for usage examples.
