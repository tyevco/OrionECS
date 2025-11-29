# Migrating from ECSY to OrionECS

This guide helps ECSY developers transition to OrionECS. Both are component-based ECS libraries, but OrionECS provides more features and better TypeScript support.

## Table of Contents

1. [Overview](#overview)
2. [Concept Mapping](#concept-mapping)
3. [API Comparison](#api-comparison)
4. [Example Conversions](#example-conversions)
5. [Key Improvements](#key-improvements)

---

## Overview

**ECSY** is a JavaScript ECS library focused on simplicity and web standards.

**OrionECS** is a TypeScript ECS library with advanced features like tags, hierarchies, prefabs, and better debugging.

**Note:** ECSY development has slowed significantly. OrionECS is actively maintained.

---

## Concept Mapping

| ECSY | OrionECS | Notes |
|------|----------|-------|
| `World` | `Engine` | Main ECS instance |
| `Entity` | `EntityDef` | Entity instances |
| `Component` (class) | Component (class) | Similar approach |
| `System` (class) | System (function) | Different style |
| `Queries` | Queries | Similar concept |
| `TagComponent` | String tags | Simpler approach |
| `Not()` | `none` in query | Exclusion queries |
| N/A | Hierarchies | OrionECS adds parent-child |
| N/A | Prefabs | OrionECS adds templates |
| N/A | Message bus | OrionECS adds events |

---

## API Comparison

### Creating the World/Engine

**ECSY:**
```javascript
import { World } from 'ecsy';

const world = new World();
```

**OrionECS:**
```typescript
import { EngineBuilder } from '@orion-ecs/core';

const engine = new EngineBuilder()
  .withDebugMode(true)
  .withFixedUpdateFPS(60)
  .build();
```

---

### Defining Components

**ECSY:**
```javascript
import { Component, Types } from 'ecsy';

class Position extends Component {
  static schema = {
    x: { type: Types.Number, default: 0 },
    y: { type: Types.Number, default: 0 }
  };
}

class Velocity extends Component {
  static schema = {
    x: { type: Types.Number, default: 0 },
    y: { type: Types.Number, default: 0 }
  };
}

// Register components
world.registerComponent(Position);
world.registerComponent(Velocity);
```

**OrionECS:**
```typescript
// No schema needed - just classes
class Position {
  constructor(public x = 0, public y = 0) {}
}

class Velocity {
  constructor(public dx = 0, public dy = 0) {}
}

// No registration needed (automatic)
```

---

### Creating Entities

**ECSY:**
```javascript
const entity = world.createEntity();

entity
  .addComponent(Position, { x: 10, y: 20 })
  .addComponent(Velocity, { x: 1, y: 1 });
```

**OrionECS:**
```typescript
const entity = engine.createEntity('EntityName');

entity
  .addComponent(Position, 10, 20)
  .addComponent(Velocity, 1, 1);

// Or add and modify
entity.addComponent(Position);
const pos = entity.getComponent(Position);
pos.x = 10;
pos.y = 20;
```

---

### Defining Systems

**ECSY:**
```javascript
import { System } from 'ecsy';

class MovementSystem extends System {
  static queries = {
    moving: {
      components: [Position, Velocity]
    }
  };

  execute(delta, time) {
    this.queries.moving.results.forEach(entity => {
      const position = entity.getMutableComponent(Position);
      const velocity = entity.getComponent(Velocity);

      position.x += velocity.x * delta;
      position.y += velocity.y * delta;
    });
  }
}

// Register system
world.registerSystem(MovementSystem);
```

**OrionECS:**
```typescript
engine.createSystem('MovementSystem',
  { all: [Position, Velocity] },
  {
    priority: 500,
    act: (entity, position, velocity) => {
      const dt = 1 / 60; // Fixed timestep
      position.x += velocity.dx * dt;
      position.y += velocity.dy * dt;
    }
  },
  true // Fixed update
);

// No class needed - just inline function
```

---

### Queries

**ECSY:**
```javascript
class MySystem extends System {
  static queries = {
    players: {
      components: [Player, Position]
    },
    enemies: {
      components: [Enemy, Position],
      listen: {
        added: true,
        removed: true
      }
    },
    notDead: {
      components: [Position, Not(Dead)]
    }
  };

  execute() {
    this.queries.players.results.forEach(entity => {
      // Process players
    });

    this.queries.enemies.added.forEach(entity => {
      console.log('Enemy added');
    });
  }
}
```

**OrionECS:**
```typescript
// Query for players
engine.createSystem('PlayerSystem',
  {
    all: [Position],
    tags: ['player']
  },
  {
    act: (entity, position) => {
      // Process players
    }
  }
);

// Query excluding dead entities
engine.createSystem('AliveSystem',
  {
    all: [Position],
    none: [Dead],
    withoutTags: ['dead']
  },
  {
    act: (entity, position) => {
      // Process alive entities
    }
  }
);

// Listen to entity creation
engine.on('onEntityCreated', (entity) => {
  if (entity.hasTag('enemy')) {
    console.log('Enemy added');
  }
});
```

---

### Tag Components

**ECSY:**
```javascript
import { TagComponent } from 'ecsy';

class Player extends TagComponent {}
class Enemy extends TagComponent {}

// Usage
entity.addComponent(Player);
```

**OrionECS:**
```typescript
// No component class needed
entity.addTag('player');
entity.addTag('enemy');

// Query with tags
engine.createSystem('System',
  { tags: ['player'] },
  { act: (entity) => { /* ... */ } }
);
```

---

### Removing Components/Entities

**ECSY:**
```javascript
// Remove component
entity.removeComponent(Position);

// Remove entity
entity.remove(); // Immediate removal
```

**OrionECS:**
```typescript
// Remove component
entity.removeComponent(Position);

// Remove entity (deferred until end of frame)
entity.queueFree();
```

---

## Example Conversions

### Example 1: Complete Movement System

**ECSY:**
```javascript
import { World, System, Component, Types } from 'ecsy';

// Components
class Position extends Component {
  static schema = {
    x: { type: Types.Number, default: 0 },
    y: { type: Types.Number, default: 0 }
  };
}

class Velocity extends Component {
  static schema = {
    x: { type: Types.Number, default: 0 },
    y: { type: Types.Number, default: 0 }
  };
}

// System
class MovementSystem extends System {
  static queries = {
    moving: { components: [Position, Velocity] }
  };

  execute(delta) {
    this.queries.moving.results.forEach(entity => {
      const position = entity.getMutableComponent(Position);
      const velocity = entity.getComponent(Velocity);

      position.x += velocity.x * delta;
      position.y += velocity.y * delta;
    });
  }
}

// Setup
const world = new World();
world
  .registerComponent(Position)
  .registerComponent(Velocity)
  .registerSystem(MovementSystem);

// Create entity
const entity = world.createEntity()
  .addComponent(Position, { x: 0, y: 0 })
  .addComponent(Velocity, { x: 1, y: 1 });

// Game loop
function gameLoop(time) {
  const delta = time - lastTime;
  lastTime = time;

  world.execute(delta / 1000, time);
  requestAnimationFrame(gameLoop);
}
```

**OrionECS:**
```typescript
import { EngineBuilder } from '@orion-ecs/core';

// Components (no schema)
class Position {
  constructor(public x = 0, public y = 0) {}
}

class Velocity {
  constructor(public dx = 0, public dy = 0) {}
}

// Setup
const engine = new EngineBuilder().build();

// System (inline)
engine.createSystem('MovementSystem',
  { all: [Position, Velocity] },
  {
    act: (entity, position, velocity) => {
      const dt = 1 / 60;
      position.x += velocity.dx * dt;
      position.y += velocity.dy * dt;
    }
  },
  true // Fixed timestep
);

// Create entity
const entity = engine.createEntity('MovingEntity')
  .addComponent(Position, 0, 0)
  .addComponent(Velocity, 1, 1);

// Game loop
function gameLoop() {
  engine.update(); // Handles deltaTime internally
  requestAnimationFrame(gameLoop);
}
```

---

### Example 2: Entity Lifecycle Events

**ECSY:**
```javascript
class SpawnSystem extends System {
  static queries = {
    enemies: {
      components: [Enemy],
      listen: {
        added: true,
        removed: true
      }
    }
  };

  execute() {
    this.queries.enemies.added.forEach(entity => {
      console.log('Enemy spawned');
    });

    this.queries.enemies.removed.forEach(entity => {
      console.log('Enemy destroyed');
    });
  }
}
```

**OrionECS:**
```typescript
// Subscribe to entity events
engine.on('onEntityCreated', (entity) => {
  if (entity.hasTag('enemy')) {
    console.log('Enemy spawned');
  }
});

engine.on('onEntityReleased', (entity) => {
  if (entity.hasTag('enemy')) {
    console.log('Enemy destroyed');
  }
});

// Or use message bus
engine.messageBus.subscribe('enemy-spawned', (msg) => {
  console.log('Enemy spawned at', msg.data.position);
});

// Publish from spawning code
engine.messageBus.publish('enemy-spawned', { position });
```

---

### Example 3: Component Pools

**ECSY:**
```javascript
// ECSY has automatic component pooling
class Bullet extends Component {
  static schema = {
    speed: { type: Types.Number }
  };
}

world.registerComponent(Bullet);
// Pooling is automatic
```

**OrionECS:**
```typescript
// Register component pool for frequently created components
engine.registerComponentPool(Bullet, {
  initialSize: 50,
  maxSize: 200
});

// Components are automatically pooled
entity.addComponent(Bullet, 100); // Reuses pooled instance
```

---

## Key Improvements

### 1. Better TypeScript Support

**ECSY:**
```javascript
// Loose typing
const pos = entity.getComponent(Position);
pos.x = "invalid"; // No error
```

**OrionECS:**
```typescript
// Full type safety
const pos = entity.getComponent(Position); // Type: Position
pos.x = "invalid"; // TypeScript error!
pos.x = 10; // OK
```

---

### 2. Simpler API

**No Schema Definition:**
```typescript
// ECSY: Schema required
class Position extends Component {
  static schema = {
    x: { type: Types.Number, default: 0 },
    y: { type: Types.Number, default: 0 }
  };
}

// OrionECS: Just a class
class Position {
  constructor(public x = 0, public y = 0) {}
}
```

**No System Classes:**
```typescript
// ECSY: System class required
class MovementSystem extends System {
  static queries = { /* ... */ };
  execute(delta) { /* ... */ }
}

// OrionECS: Inline function
engine.createSystem('MovementSystem', query, {
  act: (entity, components...) => { /* ... */ }
});
```

---

### 3. Additional Features

**Tags:**
```typescript
entity.addTag('player');
entity.addTag('active');

const query = engine.createQuery({
  tags: ['player', 'active']
});
```

**Hierarchies:**
```typescript
const parent = engine.createEntity('Parent');
const child = engine.createEntity('Child');

parent.addChild(child);
// Destroying parent destroys children
```

**Prefabs:**
```typescript
engine.registerPrefab('Enemy', {
  name: 'Enemy',
  components: [
    { type: Position, args: [0, 0] },
    { type: Health, args: [100, 100] }
  ],
  tags: ['enemy']
});

const enemy = engine.createFromPrefab('Enemy');
```

**Message Bus:**
```typescript
engine.messageBus.publish('player-hit', { damage: 10 });
engine.messageBus.subscribe('player-hit', (msg) => {
  console.log('Damage:', msg.data.damage);
});
```

**Debugging and Logging:**
```typescript
// Debug mode enables detailed logging
const engine = new EngineBuilder()
  .withDebugMode(true)
  .build();

// Use the built-in logger for consistent output
engine.logger.debug('Game initialized');      // Only shown in debug mode
engine.logger.info('Player connected');       // Informational messages
engine.logger.warn('Low memory');             // Warnings
engine.logger.error('Connection lost');       // Errors

// Create tagged loggers for subsystems
const aiLogger = engine.logger.withTag('AI');
aiLogger.debug('Decision made');              // Output: [AI] Decision made

// Get debug info
const debugInfo = engine.getDebugInfo();
console.log('Entities:', debugInfo.entityCount);

// System profiling
const profiles = engine.getSystemProfiles();
console.log('Avg time:', profiles[0].averageTime);
```

---

## Migration Checklist

- [ ] Remove component schemas (use plain classes)
- [ ] Convert `System` classes to inline functions
- [ ] Replace `TagComponent` with string tags
- [ ] Update component registration (none needed in OrionECS)
- [ ] Convert queries to OrionECS syntax
- [ ] Update entity creation to use named entities
- [ ] Replace `entity.remove()` with `entity.queueFree()`
- [ ] Update game loop to use `engine.update()`
- [ ] Add prefabs for repeated entity patterns
- [ ] Consider using hierarchies for complex entities
- [ ] Add message bus for inter-system communication
- [ ] Enable debug mode during development

---

## Resources

- [OrionECS README](../../README.md)
- [OrionECS Cookbook](../COOKBOOK.md)
- [Game Examples](../../examples/games/)
- [ECSY Documentation](https://ecsy.io/docs/)

---

**Welcome to OrionECS! 🎮**
