# Migrating from Custom ECS to OrionECS

This guide helps developers with custom ECS implementations or those familiar with ECS patterns adopt OrionECS.

## Table of Contents

1. [ECS Fundamentals](#ecs-fundamentals)
2. [OrionECS Architecture](#orionecs-architecture)
3. [Common ECS Patterns](#common-ecs-patterns)
4. [Implementation Examples](#implementation-examples)
5. [Best Practices](#best-practices)

---

## ECS Fundamentals

### Core Concepts

**Entity**: A unique identifier with components attached

**Component**: Data-only structures (no behavior)

**System**: Logic that operates on entities with specific components

**World/Engine**: Container managing entities, components, and systems

---

## OrionECS Architecture

### Creating the Engine

```typescript
import { EngineBuilder } from '@orion-ecs/core';

const engine = new EngineBuilder()
  .withDebugMode(true)        // Enable detailed logging
  .withFixedUpdateFPS(60)     // Fixed update at 60 FPS
  .withMaxFixedIterations(10) // Max iterations per frame
  .withMaxSnapshots(10)       // Max world state snapshots
  .build();
```

### Defining Components

Components are plain TypeScript classes:

```typescript
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}

class Health {
  current: number = 100;
  max: number = 100;

  constructor(current: number = 100, max: number = 100) {
    this.current = current;
    this.max = max;
  }

  get percent(): number {
    return this.current / this.max;
  }
}
```

**Best Practices:**
- Keep components as pure data
- Use TypeScript for type safety
- Add utility methods for computed values
- Use constructors for defaults

### Creating Entities

```typescript
// Simple entity
const entity = engine.createEntity('PlayerEntity');

// Add components
entity.addComponent(Position, 100, 200);
entity.addComponent(Velocity, 0, 0);
entity.addComponent(Health, 100, 100);

// Add tags for categorization
entity.addTag('player');
entity.addTag('alive');

// Chain methods
const enemy = engine.createEntity('Enemy')
  .addComponent(Position, 300, 400)
  .addComponent(Health, 50, 50)
  .addTag('enemy')
  .addTag('ai');
```

### Defining Systems

Systems process entities with specific components:

```typescript
engine.createSystem(
  'MovementSystem',                     // System name
  { all: [Position, Velocity] },        // Query: entities with Position AND Velocity
  {
    priority: 500,                      // Higher = runs first
    before: () => {
      // Runs before processing entities
    },
    act: (entity, position, velocity) => {
      // Process each entity
      const dt = 1 / 60; // Fixed timestep
      position.x += velocity.dx * dt;
      position.y += velocity.dy * dt;
    },
    after: () => {
      // Runs after processing all entities
    }
  },
  true // true = fixed update, false = variable update
);
```

**System Priorities:**
```
1000+    : Input handling
500-999  : Game logic
100-499  : Physics and movement
0-99     : Late logic (AI reactions)
-1 to -99: Pre-rendering (culling, LOD)
-100-    : Rendering
```

### Queries

Complex entity filtering:

```typescript
// ALL: Must have ALL specified components
const query1 = engine.createQuery({
  all: [Position, Velocity]
});

// ANY: Must have AT LEAST ONE specified component
const query2 = engine.createQuery({
  any: [Player, Enemy]
});

// NONE: Must NOT have any specified components
const query3 = engine.createQuery({
  all: [Position],
  none: [Dead, Frozen]
});

// TAGS: Must have specific tags
const query4 = engine.createQuery({
  all: [Position],
  tags: ['player', 'active'],
  withoutTags: ['dead']
});

// Combined query
const query5 = engine.createQuery({
  all: [Position, Velocity],
  any: [Player, Enemy],
  none: [Dead],
  tags: ['active'],
  withoutTags: ['disabled']
});

// Execute query
const entities = query5.getEntities();
for (const entity of entities) {
  // Process entities
}
```

---

## Common ECS Patterns

### Pattern 1: Component Composition

**Problem:** Entities need different combinations of components

**Solution:** Compose entities from small, focused components

```typescript
// Components
class Position { constructor(public x = 0, public y = 0) {} }
class Velocity { constructor(public dx = 0, public dy = 0) {} }
class Health { constructor(public current = 100, public max = 100) {} }
class AI { constructor(public state = 'idle') {} }
class Sprite { constructor(public name = 'default') {} }

// Player: Position + Velocity + Health + Sprite
const player = engine.createEntity('Player')
  .addComponent(Position, 0, 0)
  .addComponent(Velocity, 0, 0)
  .addComponent(Health, 100, 100)
  .addComponent(Sprite, 'player');

// Enemy: Position + Velocity + Health + AI + Sprite
const enemy = engine.createEntity('Enemy')
  .addComponent(Position, 100, 100)
  .addComponent(Velocity, 50, 0)
  .addComponent(Health, 50, 50)
  .addComponent(AI, 'patrol')
  .addComponent(Sprite, 'enemy');

// Collectible: Position + Sprite
const coin = engine.createEntity('Coin')
  .addComponent(Position, 200, 200)
  .addComponent(Sprite, 'coin');
```

---

### Pattern 2: Entity Templates (Prefabs)

**Problem:** Need to create many similar entities

**Solution:** Use prefabs for entity templates

```typescript
// Register prefab
engine.registerPrefab('Bullet', {
  name: 'Bullet',
  components: [
    { type: Position, args: [0, 0] },
    { type: Velocity, args: [0, 0] },
    { type: Sprite, args: ['bullet'] }
  ],
  tags: ['projectile']
});

// Create from prefab
const bullet1 = engine.createFromPrefab('Bullet', 'Bullet1');
const bullet2 = engine.createFromPrefab('Bullet', 'Bullet2');

// Modify after creation
const pos = bullet1.getComponent(Position);
pos.x = 100;
pos.y = 100;
```

**Advanced Prefabs:**

```typescript
// Parameterized prefab
const weaponPrefab = engine.definePrefab('Weapon', (damage: number, range: number) => ({
  name: 'Weapon',
  components: [
    { type: Damage, args: [damage] },
    { type: Range, args: [range] }
  ],
  tags: ['weapon']
}));

// Use with parameters
const sword = engine.createFromPrefab('Weapon', 'Sword', 10, 2);
const bow = engine.createFromPrefab('Weapon', 'Bow', 5, 10);

// Prefab inheritance
const bossEnemy = engine.extendPrefab('Enemy', {
  components: [
    { type: BossAI, args: [] },
    { type: Shield, args: [100] }
  ],
  tags: ['boss']
}, 'BossEnemy');
```

---

### Pattern 3: Entity Hierarchies

**Problem:** Complex entities composed of multiple parts

**Solution:** Use parent-child relationships

```typescript
// Create vehicle
const tank = engine.createEntity('Tank');
tank.addComponent(Position, 0, 0);
tank.addComponent(Velocity, 0, 0);

// Create turret (child)
const turret = engine.createEntity('Turret');
turret.addComponent(Position, 0, 0); // Relative position
turret.addComponent(Rotation, 0);

// Create barrel (grandchild)
const barrel = engine.createEntity('Barrel');
barrel.addComponent(Position, 0, -20); // Offset from turret

// Build hierarchy
tank.addChild(turret);
turret.addChild(barrel);

// Destroying parent destroys all children
tank.queueFree(); // Also destroys turret and barrel
```

**Transform Propagation:**

```typescript
engine.createSystem('TransformPropagationSystem',
  { all: [Position] },
  {
    act: (entity, position) => {
      if (entity.parent) {
        const parentPos = entity.parent.getComponent(Position);
        const parentRot = entity.parent.getComponent(Rotation);

        // Calculate world position from local position
        if (parentPos && parentRot) {
          const cos = Math.cos(parentRot.angle);
          const sin = Math.sin(parentRot.angle);

          const localX = position.x;
          const localY = position.y;

          position.worldX = parentPos.worldX + (localX * cos - localY * sin);
          position.worldY = parentPos.worldY + (localX * sin + localY * cos);
        }
      } else {
        position.worldX = position.x;
        position.worldY = position.y;
      }
    }
  }
);
```

---

### Pattern 4: Inter-System Communication

**Problem:** Systems need to communicate without tight coupling

**Solution 1: Message Bus**

```typescript
// System 1: Publisher
engine.createSystem('CombatSystem',
  { all: [Health] },
  {
    act: (entity, health) => {
      if (health.current <= 0) {
        // Publish event
        engine.messageBus.publish('entity-died', {
          entity: entity.id,
          position: entity.getComponent(Position)
        }, 'CombatSystem');

        entity.queueFree();
      }
    }
  }
);

// System 2: Subscriber
engine.messageBus.subscribe('entity-died', (message) => {
  console.log('Entity died:', message.data.entity);

  // Spawn death particles
  createDeathEffect(message.data.position);

  // Award points
  awardPoints(100);
});
```

**Solution 2: Shared Components**

```typescript
class GameState {
  score: number = 0;
  level: number = 1;
  isPaused: boolean = false;
}

// Create singleton entity
const gameState = engine.createEntity('GameState');
gameState.addComponent(GameState);
gameState.addTag('singleton');

// Systems access shared state
engine.createSystem('ScoreSystem',
  { all: [] },
  {
    act: () => {
      const state = engine.getEntitiesByTag('singleton')[0]
        ?.getComponent(GameState);

      if (state) {
        state.score += calculateScore();
      }
    }
  }
);
```

---

### Pattern 5: Entity Pooling

**Problem:** Frequent entity creation/destruction causes GC pauses

**Solution:** Reuse entities via pooling

```typescript
class EntityPool {
  private pool: EntityDef[] = [];
  private engine: Engine;
  private prefabName: string;

  constructor(engine: Engine, prefabName: string, initialSize: number) {
    this.engine = engine;
    this.prefabName = prefabName;

    // Pre-create entities
    for (let i = 0; i < initialSize; i++) {
      const entity = engine.createFromPrefab(prefabName);
      entity.removeTag('active');
      this.pool.push(entity);
    }
  }

  acquire(): EntityDef {
    let entity = this.pool.pop();

    if (!entity) {
      entity = this.engine.createFromPrefab(this.prefabName);
    }

    entity.addTag('active');
    return entity;
  }

  release(entity: EntityDef): void {
    entity.removeTag('active');
    this.pool.push(entity);
  }
}

// Usage
const bulletPool = new EntityPool(engine, 'Bullet', 50);

// Acquire bullet
const bullet = bulletPool.acquire();
// Use bullet...

// Release when done
bulletPool.release(bullet);
```

---

## Implementation Examples

### Complete Game Example

```typescript
import { EngineBuilder } from '@orion-ecs/core';

// 1. Define components
class Position {
  constructor(public x = 0, public y = 0) {}
}

class Velocity {
  constructor(public dx = 0, public dy = 0) {}
}

class Health {
  constructor(public current = 100, public max = 100) {}
}

class Sprite {
  constructor(public name = 'default') {}
}

// 2. Create engine
const engine = new EngineBuilder()
  .withDebugMode(true)
  .withFixedUpdateFPS(60)
  .build();

// 3. Register prefabs
engine.registerPrefab('Player', {
  name: 'Player',
  components: [
    { type: Position, args: [400, 300] },
    { type: Velocity, args: [0, 0] },
    { type: Health, args: [100, 100] },
    { type: Sprite, args: ['player'] }
  ],
  tags: ['player', 'alive']
});

engine.registerPrefab('Enemy', {
  name: 'Enemy',
  components: [
    { type: Position, args: [0, 0] },
    { type: Velocity, args: [50, 0] },
    { type: Health, args: [50, 50] },
    { type: Sprite, args: ['enemy'] }
  ],
  tags: ['enemy', 'alive']
});

// 4. Create systems
engine.createSystem('MovementSystem',
  { all: [Position, Velocity], tags: ['alive'] },
  {
    priority: 500,
    act: (entity, position, velocity) => {
      const dt = 1 / 60;
      position.x += velocity.dx * dt;
      position.y += velocity.dy * dt;
    }
  },
  true // Fixed update
);

engine.createSystem('CollisionSystem',
  { all: [Position, Health], tags: ['alive'] },
  {
    priority: 400,
    act: (entity, position, health) => {
      // Check collisions with other entities
      const others = engine.createQuery({
        all: [Position],
        tags: ['alive']
      }).getEntities();

      for (const other of others) {
        if (other === entity) continue;

        const otherPos = other.getComponent(Position);
        const distance = Math.sqrt(
          (position.x - otherPos.x) ** 2 +
          (position.y - otherPos.y) ** 2
        );

        if (distance < 32) {
          // Handle collision
          health.current -= 10;

          if (health.current <= 0) {
            entity.removeTag('alive');
            entity.queueFree();
          }
        }
      }
    }
  },
  true
);

// 5. Create entities
const player = engine.createFromPrefab('Player', 'Player1');

for (let i = 0; i < 5; i++) {
  const enemy = engine.createFromPrefab('Enemy', `Enemy${i}`);
  const pos = enemy.getComponent(Position);
  pos.x = Math.random() * 800;
  pos.y = Math.random() * 600;
}

// 6. Start engine
engine.start();

// 7. Game loop
function gameLoop() {
  engine.update();
  requestAnimationFrame(gameLoop);
}

gameLoop();
```

---

## Best Practices

### 1. Component Design

**Do:**
- Keep components as pure data
- Use small, focused components
- Use TypeScript for type safety
- Add utility methods for computed values

**Don't:**
- Put game logic in components
- Create large "god" components
- Store references to other entities (use IDs)

### 2. System Design

**Do:**
- Use descriptive system names
- Organize by priority
- Keep systems focused on one task
- Use message bus for communication

**Don't:**
- Create systems with too many responsibilities
- Access components not in the query
- Modify entities during iteration (use queueFree)

### 3. Performance

**Do:**
- Use component pooling for frequently created components
- Use entity pooling for frequently created entities
- Use specific queries (fewer matches = faster)
- Use fixed updates for physics/game logic
- Disable debug mode in production

**Don't:**
- Create entities/components in hot loops
- Use overly broad queries
- Access components unnecessarily

### 4. Architecture

**Do:**
- Use prefabs for entity templates
- Use tags for categorization
- Use hierarchies for complex entities
- Use message bus for events

**Don't:**
- Hard-code entity creation
- Use magic numbers
- Tightly couple systems

### 5. Debugging and Logging

**Do:**
- Use the built-in logger for all output
- Create tagged loggers for subsystems
- Enable debug mode during development
- Disable debug mode in production

**Don't:**
- Use `console.log` directly (use `engine.logger` instead)
- Leave debug mode enabled in production
- Log sensitive information

```typescript
const engine = new EngineBuilder()
  .withDebugMode(true)  // Enable during development
  .build();

// Use the engine's logger
engine.logger.debug('Game loop started');     // Only shown in debug mode
engine.logger.info('Player spawned');         // Informational messages
engine.logger.warn('Resource limit reached'); // Warnings
engine.logger.error('Failed to load asset');  // Errors

// Create tagged loggers for subsystems
const aiLogger = engine.logger.withTag('AI');
aiLogger.debug('Enemy decision made');        // Output: [AI] Enemy decision made

const physicsLogger = engine.logger.withTag('Physics');
physicsLogger.debug('Step complete');         // Output: [Physics] Step complete

// Get debug info
const debugInfo = engine.getDebugInfo();
engine.logger.info('Entities:', debugInfo.entityCount);

// System profiling
const profiles = engine.getSystemProfiles();
for (const profile of profiles) {
  engine.logger.debug(`${profile.name}: ${profile.averageTime.toFixed(2)}ms avg`);
}
```

---

## Resources

- [OrionECS README](../../README.md)
- [Cookbook](../COOKBOOK.md)
- [Game Examples](../../examples/games/)
- [Integration Examples](../../examples/integrations/)

---

**Welcome to OrionECS! 🎮**
