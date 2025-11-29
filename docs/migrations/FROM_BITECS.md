# Migrating from BitECS to OrionECS

This guide helps BitECS developers transition to OrionECS. Both are TypeScript ECS libraries, but they have different philosophies and API designs.

## Table of Contents

1. [Key Differences](#key-differences)
2. [Concept Mapping](#concept-mapping)
3. [API Comparison](#api-comparison)
4. [Example Conversions](#example-conversions)
5. [What You Gain](#what-you-gain)
6. [What You Lose](#what-you-lose)

---

## Key Differences

### Philosophy

**BitECS:**
- **Performance-first**: Designed for maximum performance with SOA (Structure of Arrays)
- **Minimal API**: Bare-bones, low-level API
- **Manual management**: You manage most things yourself
- **Best for**: Performance-critical games with 100,000+ entities

**OrionECS:**
- **Developer-first**: Balances performance with developer experience
- **Rich API**: High-level features like tags, hierarchies, prefabs
- **Automatic management**: Handles cleanup, pooling, etc. automatically
- **Best for**: Most web games, rapid prototyping, maintainability

---

## Concept Mapping

| BitECS | OrionECS | Notes |
|--------|----------|-------|
| Entity (number) | `EntityDef` (object) | BitECS uses numeric IDs, OrionECS uses objects |
| Component (SOA) | Component (class) | BitECS uses typed arrays, OrionECS uses classes |
| `defineComponent()` | Component class | No schema definition needed |
| `defineQuery()` | `engine.createQuery()` | Similar concept |
| System function | `engine.createSystem()` | OrionECS wraps systems |
| `addComponent()` | `entity.addComponent()` | Method vs function |
| `removeComponent()` | `entity.removeComponent()` | Method vs function |
| `hasComponent()` | `entity.hasComponent()` | Method vs function |
| World | `Engine` | OrionECS uses Engine as main facade |
| `addEntity()` | `engine.createEntity()` | Creating entities |
| `removeEntity()` | `entity.queueFree()` | Deferred deletion |
| N/A | Tags | OrionECS has built-in tagging |
| N/A | Hierarchies | OrionECS has parent-child relationships |
| N/A | Prefabs | OrionECS has entity templates |

---

## API Comparison

### Creating Entities

**BitECS:**
```typescript
import { createWorld, addEntity } from 'bitecs';

const world = createWorld();
const eid = addEntity(world);
```

**OrionECS:**
```typescript
import { EngineBuilder } from '@orion-ecs/core';

const engine = new EngineBuilder().build();
const entity = engine.createEntity('EntityName');
```

---

### Defining Components

**BitECS:**
```typescript
import { Types, defineComponent } from 'bitecs';

// SOA (Structure of Arrays) - data stored in typed arrays
const Position = defineComponent({
  x: Types.f32,
  y: Types.f32
});

const Velocity = defineComponent({
  x: Types.f32,
  y: Types.f32
});
```

**OrionECS:**
```typescript
// AOS (Array of Structures) - data stored in objects
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}
```

---

### Adding Components

**BitECS:**
```typescript
import { addComponent } from 'bitecs';

addComponent(world, Position, eid);
Position.x[eid] = 10;
Position.y[eid] = 20;

// Or with helper
const setPosition = (eid, x, y) => {
  Position.x[eid] = x;
  Position.y[eid] = y;
};
setPosition(eid, 10, 20);
```

**OrionECS:**
```typescript
// Add with constructor args
entity.addComponent(Position, 10, 20);

// Or add and modify
entity.addComponent(Position);
const pos = entity.getComponent(Position);
pos.x = 10;
pos.y = 20;
```

---

### Querying Entities

**BitECS:**
```typescript
import { defineQuery } from 'bitecs';

// Define query
const movementQuery = defineQuery([Position, Velocity]);

// Execute query (returns array of entity IDs)
const entities = movementQuery(world);

for (let i = 0; i < entities.length; i++) {
  const eid = entities[i];
  Position.x[eid] += Velocity.x[eid];
  Position.y[eid] += Velocity.y[eid];
}
```

**OrionECS:**
```typescript
// Create query
const movementQuery = engine.createQuery({
  all: [Position, Velocity]
});

// Execute query (returns array of entities)
const entities = movementQuery.getEntities();

for (const entity of entities) {
  const pos = entity.getComponent(Position);
  const vel = entity.getComponent(Velocity);

  pos.x += vel.dx;
  pos.y += vel.dy;
}

// Or use in a system
engine.createSystem('MovementSystem',
  { all: [Position, Velocity] },
  {
    act: (entity, pos, vel) => {
      pos.x += vel.dx;
      pos.y += vel.dy;
    }
  }
);
```

---

### Systems

**BitECS:**
```typescript
// Systems are just functions
const movementSystem = (world) => {
  const entities = movementQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    Position.x[eid] += Velocity.x[eid];
    Position.y[eid] += Velocity.y[eid];
  }

  return world;
};

// You manage execution order manually
const pipeline = [
  movementSystem,
  collisionSystem,
  renderSystem
];

// Game loop
function gameLoop() {
  for (const system of pipeline) {
    system(world);
  }
  requestAnimationFrame(gameLoop);
}
```

**OrionECS:**
```typescript
// Systems are registered with engine
engine.createSystem('MovementSystem',
  { all: [Position, Velocity] },
  {
    priority: 500, // Higher = runs first
    act: (entity, pos, vel) => {
      pos.x += vel.dx;
      pos.y += vel.dy;
    }
  },
  true // Fixed update
);

engine.createSystem('CollisionSystem', query, options, true);
engine.createSystem('RenderSystem', query, options, false);

// Engine manages execution order
function gameLoop() {
  engine.update();
  requestAnimationFrame(gameLoop);
}
```

---

### Removing Components

**BitECS:**
```typescript
import { removeComponent } from 'bitecs';

removeComponent(world, Position, eid);
```

**OrionECS:**
```typescript
entity.removeComponent(Position);
```

---

### Removing Entities

**BitECS:**
```typescript
import { removeEntity } from 'bitecs';

removeEntity(world, eid);
```

**OrionECS:**
```typescript
// Deferred deletion (safe during iteration)
entity.queueFree();

// Entity removed at end of frame automatically
```

---

## Example Conversions

### Example 1: Basic Movement

**BitECS:**
```typescript
import { createWorld, addEntity, addComponent, defineComponent, defineQuery, Types } from 'bitecs';

const world = createWorld();

const Position = defineComponent({
  x: Types.f32,
  y: Types.f32
});

const Velocity = defineComponent({
  x: Types.f32,
  y: Types.f32
});

// Create entity
const eid = addEntity(world);
addComponent(world, Position, eid);
addComponent(world, Velocity, eid);

Position.x[eid] = 0;
Position.y[eid] = 0;
Velocity.x[eid] = 1;
Velocity.y[eid] = 1;

// Define query
const movementQuery = defineQuery([Position, Velocity]);

// System
const movementSystem = (world) => {
  const entities = movementQuery(world);

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    Position.x[eid] += Velocity.x[eid];
    Position.y[eid] += Velocity.y[eid];
  }

  return world;
};

// Game loop
function gameLoop() {
  movementSystem(world);
  requestAnimationFrame(gameLoop);
}
```

**OrionECS:**
```typescript
import { EngineBuilder } from '@orion-ecs/core';

const engine = new EngineBuilder().build();

class Position {
  constructor(public x = 0, public y = 0) {}
}

class Velocity {
  constructor(public dx = 0, public dy = 0) {}
}

// Create entity
const entity = engine.createEntity('MovingEntity');
entity.addComponent(Position, 0, 0);
entity.addComponent(Velocity, 1, 1);

// System
engine.createSystem('MovementSystem',
  { all: [Position, Velocity] },
  {
    act: (entity, pos, vel) => {
      pos.x += vel.dx;
      pos.y += vel.dy;
    }
  }
);

// Game loop
function gameLoop() {
  engine.update();
  requestAnimationFrame(gameLoop);
}
```

---

### Example 2: Query with Filters

**BitECS:**
```typescript
import { Not, Changed } from 'bitecs';

// Query with NOT filter
const aliveEnemiesQuery = defineQuery([Enemy, Position, Not(Dead)]);

// Changed query (entities where Position changed)
const changedPositionQuery = defineQuery([Changed(Position)]);

const system = (world) => {
  const enemies = aliveEnemiesQuery(world);
  const changed = changedPositionQuery(world);

  // Process...

  return world;
};
```

**OrionECS:**
```typescript
// Query with none filter
const aliveEnemiesQuery = engine.createQuery({
  all: [Position],
  tags: ['enemy'],
  withoutTags: ['dead']
});

// OrionECS doesn't have Changed queries (yet)
// Use message bus or manual tracking instead

engine.createSystem('System',
  {
    all: [Position],
    tags: ['enemy'],
    withoutTags: ['dead']
  },
  {
    act: (entity, pos) => {
      // Process...
    }
  }
);
```

---

### Example 3: Entity Creation from Template

**BitECS:**
```typescript
// Helper function to create entity from template
function createEnemy(world, x, y) {
  const eid = addEntity(world);

  addComponent(world, Position, eid);
  addComponent(world, Velocity, eid);
  addComponent(world, Enemy, eid);
  addComponent(world, Health, eid);

  Position.x[eid] = x;
  Position.y[eid] = y;
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;
  Health.current[eid] = 100;
  Health.max[eid] = 100;

  return eid;
}

// Usage
const enemy1 = createEnemy(world, 100, 200);
const enemy2 = createEnemy(world, 300, 400);
```

**OrionECS:**
```typescript
// Register prefab
engine.registerPrefab('Enemy', {
  name: 'Enemy',
  components: [
    { type: Position, args: [0, 0] },
    { type: Velocity, args: [0, 0] },
    { type: Health, args: [100, 100] }
  ],
  tags: ['enemy']
});

// Usage (cleaner)
const enemy1 = engine.createFromPrefab('Enemy', 'Enemy1');
enemy1.getComponent(Position).x = 100;
enemy1.getComponent(Position).y = 200;

const enemy2 = engine.createFromPrefab('Enemy', 'Enemy2');
enemy2.getComponent(Position).x = 300;
enemy2.getComponent(Position).y = 400;
```

---

## What You Gain

### 1. Developer Experience

**Object-Oriented Components:**
```typescript
// BitECS: Confusing array syntax
Position.x[eid] = 100;
Position.y[eid] = 200;

// OrionECS: Natural object syntax
position.x = 100;
position.y = 200;
```

**Type Safety:**
```typescript
// BitECS: No type checking for component access
const x = Position.x[eid]; // Could be undefined

// OrionECS: Full TypeScript type safety
const pos = entity.getComponent(Position); // Type: Position
const x = pos.x; // Type: number
```

### 2. Built-in Features

**Tags:**
```typescript
// BitECS: Must create tag components manually
const Player = defineComponent();
addComponent(world, Player, eid);

// OrionECS: String tags built-in
entity.addTag('player');
entity.addTag('active');
```

**Hierarchies:**
```typescript
// BitECS: Manual parent-child relationships
const Parent = defineComponent({ value: Types.eid });
Parent.value[childEid] = parentEid;

// OrionECS: Built-in hierarchies
parent.addChild(child);
// Destroying parent automatically destroys children
```

**Prefabs:**
```typescript
// BitECS: Manual templates
function createEnemy(world) { /* ... */ }

// OrionECS: Built-in prefab system
engine.registerPrefab('Enemy', config);
engine.createFromPrefab('Enemy');
```

### 3. Debugging and Logging

**Named Entities:**
```typescript
// BitECS: Entities are just numbers
const eid = addEntity(world); // eid = 42

// OrionECS: Named entities
const entity = engine.createEntity('Player');
engine.logger.debug('Created entity:', entity.name); // "Player"
```

**Debug Mode and Logging:**
```typescript
const engine = new EngineBuilder()
  .withDebugMode(true) // Enables debug logging
  .build();

// Use the built-in logger for consistent output
engine.logger.debug('Game initialized');      // Only shown in debug mode
engine.logger.info('Player joined');          // Informational messages
engine.logger.warn('Low memory');             // Warnings
engine.logger.error('Connection lost');       // Errors

// Create tagged loggers for subsystems
const aiLogger = engine.logger.withTag('AI');
aiLogger.debug('Enemy spotted player');       // Output: [AI] Enemy spotted player

const renderLogger = engine.logger.withTag('Render');
renderLogger.debug('Frame complete');         // Output: [Render] Frame complete

// Get debug info
const debugInfo = engine.getDebugInfo();
engine.logger.info('Entities:', debugInfo.entityCount);
```

### 4. Convenience Features

**Message Bus:**
```typescript
engine.messageBus.publish('enemy-killed', { score: 100 });
engine.messageBus.subscribe('enemy-killed', (msg) => {
  updateScore(msg.data.score);
});
```

**Component Validation:**
```typescript
engine.registerComponentValidator(RigidBody, {
  dependencies: [Position], // Requires Position
  validate: (rb) => rb.mass > 0 ? true : 'Mass must be positive'
});
```

**System Profiling:**
```typescript
const profiles = engine.getSystemProfiles();
console.log('MovementSystem avg time:', profiles[0].averageTime);
```

---

## What You Lose

### 1. Performance

**Memory Layout:**
- BitECS: SOA (Structure of Arrays) - better cache locality
- OrionECS: AOS (Array of Structures) - more cache misses

**Benchmarks (approximate):**
- BitECS: Can handle 100,000+ entities efficiently
- OrionECS: Optimized for 1,000-10,000 entities

### 2. Low-level Control

**BitECS gives you:**
- Direct typed array access
- Manual memory management
- Fine-grained optimization

**OrionECS abstracts:**
- Automatic memory management
- Higher-level API
- Less room for micro-optimizations

---

## Migration Strategy

### Step 1: Assess Your Needs

**Stick with BitECS if:**
- You need maximum performance
- You have 50,000+ entities
- You're comfortable with low-level APIs
- Performance > Developer experience

**Migrate to OrionECS if:**
- You want faster development
- You have <10,000 entities
- You want richer features (tags, hierarchies, prefabs)
- Developer experience > Raw performance

### Step 2: Convert Components

```typescript
// Before (BitECS)
const Position = defineComponent({
  x: Types.f32,
  y: Types.f32
});

// After (OrionECS)
class Position {
  constructor(public x = 0, public y = 0) {}
}
```

### Step 3: Convert Systems

```typescript
// Before (BitECS)
const movementSystem = (world) => {
  const entities = movementQuery(world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    Position.x[eid] += Velocity.x[eid];
  }
  return world;
};

// After (OrionECS)
engine.createSystem('MovementSystem',
  { all: [Position, Velocity] },
  {
    act: (entity, pos, vel) => {
      pos.x += vel.dx;
    }
  }
);
```

### Step 4: Update Game Loop

```typescript
// Before (BitECS)
function gameLoop() {
  movementSystem(world);
  collisionSystem(world);
  renderSystem(world);
  requestAnimationFrame(gameLoop);
}

// After (OrionECS)
function gameLoop() {
  engine.update(); // Runs all systems
  requestAnimationFrame(gameLoop);
}
```

---

## Resources

- [OrionECS README](../../README.md)
- [OrionECS Cookbook](../COOKBOOK.md)
- [Game Examples](../../examples/games/)
- [BitECS Documentation](https://github.com/NateTheGreatt/bitECS)

---

**Welcome to OrionECS! 🎮**
