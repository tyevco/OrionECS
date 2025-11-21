# OrionECS Cookbook

A comprehensive guide to common patterns, best practices, and solutions for building applications with OrionECS.

## Table of Contents

1. [Entity Lifecycle Patterns](#entity-lifecycle-patterns)
2. [Component Composition](#component-composition)
3. [System Organization](#system-organization)
4. [Performance Optimization](#performance-optimization)
5. [Common Game Mechanics](#common-game-mechanics)
6. [Testing Strategies](#testing-strategies)
7. [Debugging Techniques](#debugging-techniques)
8. [Advanced Patterns](#advanced-patterns)

---

## Entity Lifecycle Patterns

### Creating Entity Templates with Prefabs

**Problem:** You need to create many similar entities with the same component configuration.

**Solution:** Use prefabs to define entity templates:

```typescript
// Define a prefab
const enemyPrefab = {
  name: 'Enemy',
  components: [
    { type: Position, args: [0, 0] },
    { type: Health, args: [50, 50] },
    { type: AI, args: ['patrol'] }
  ],
  tags: ['enemy', 'ai']
};

engine.registerPrefab('Enemy', enemyPrefab);

// Create entities from prefab
const enemy1 = engine.createFromPrefab('Enemy', 'Enemy1');
const enemy2 = engine.createFromPrefab('Enemy', 'Enemy2');

// Modify after creation
const pos = enemy1.getComponent(Position);
pos.x = 100;
pos.y = 50;
```

**When to Use:**
- Creating multiple entities with similar configurations
- Level loading
- Spawning enemies, projectiles, particles
- Character templates

**Advanced: Parameterized Prefabs**

```typescript
// Using the new prefab system with factories
const weaponPrefab = engine.definePrefab('Weapon', (damage: number, range: number) => ({
  name: 'Weapon',
  components: [
    { type: Damage, args: [damage] },
    { type: Range, args: [range] }
  ],
  tags: ['weapon']
}));

// Create with parameters
const sword = engine.createFromPrefab('Weapon', 'Sword', 10, 2);
const bow = engine.createFromPrefab('Weapon', 'Bow', 5, 10);
```

**Advanced: Prefab Inheritance**

```typescript
// Base enemy prefab
engine.registerPrefab('BaseEnemy', {
  name: 'BaseEnemy',
  components: [
    { type: Position, args: [0, 0] },
    { type: Health, args: [50, 50] }
  ],
  tags: ['enemy']
});

// Extend with additional components
const bossEnemy = engine.extendPrefab('BaseEnemy', {
  components: [
    { type: BossAI, args: [] },
    { type: Shield, args: [100] }
  ],
  tags: ['boss']
}, 'BossEnemy');
```

---

### Entity Pooling for Performance

**Problem:** Frequently creating and destroying entities causes garbage collection pauses.

**Solution:** Reuse entities with object pooling:

```typescript
class BulletPool {
  private pool: EntityDef[] = [];
  private engine: Engine;

  constructor(engine: Engine, initialSize: number = 50) {
    this.engine = engine;

    // Pre-create bullets
    for (let i = 0; i < initialSize; i++) {
      const bullet = this.createBullet();
      bullet.removeTag('active');
      this.pool.push(bullet);
    }
  }

  private createBullet(): EntityDef {
    const bullet = this.engine.createEntity('PooledBullet');
    bullet.addComponent(Position, 0, 0);
    bullet.addComponent(Velocity, 0, 0);
    bullet.addComponent(Bullet);
    return bullet;
  }

  acquire(x: number, y: number, dx: number, dy: number): EntityDef {
    let bullet = this.pool.pop();

    if (!bullet) {
      bullet = this.createBullet();
      console.log('Pool exhausted, creating new bullet');
    }

    // Reset bullet state
    const pos = bullet.getComponent(Position);
    const vel = bullet.getComponent(Velocity);
    const bulletComp = bullet.getComponent(Bullet);

    pos.x = x;
    pos.y = y;
    vel.dx = dx;
    vel.dy = dy;
    bulletComp.lifetime = 2.0;

    bullet.addTag('active');
    return bullet;
  }

  release(bullet: EntityDef): void {
    bullet.removeTag('active');
    this.pool.push(bullet);
  }
}

// Usage
const bulletPool = new BulletPool(engine, 100);

// Acquire bullet
const bullet = bulletPool.acquire(x, y, dx, dy);

// Release when done (in collision or timeout system)
bulletPool.release(bullet);
```

**Alternative: Component-Level Pooling**

```typescript
// Register component pool
engine.registerComponentPool(Particle, {
  initialSize: 100,
  maxSize: 500
});

// Components are automatically pooled
const entity = engine.createEntity();
entity.addComponent(Particle); // Reuses pooled instance
```

---

### Parent-Child Hierarchies

**Problem:** Need to create complex entities composed of multiple parts (e.g., character with weapon, vehicle with turret).

**Solution:** Use entity hierarchies:

```typescript
// Create parent entity
const tank = engine.createEntity('Tank');
tank.addComponent(Position, 100, 100);
tank.addComponent(Velocity, 0, 0);
tank.addComponent(Rotation, 0);

// Create child entities
const turret = engine.createEntity('Turret');
turret.addComponent(Position, 0, 0); // Relative position
turret.addComponent(Rotation, 0);

const barrel = engine.createEntity('Barrel');
barrel.addComponent(Position, 0, -20); // Offset from turret

// Build hierarchy
tank.addChild(turret);
turret.addChild(barrel);

// Destroying parent destroys all children
tank.queueFree(); // Also destroys turret and barrel
```

**Propagating Transforms:**

```typescript
// System to update child positions based on parent
engine.createSystem('HierarchyTransformSystem',
  { all: [Position] },
  {
    priority: 600,
    act: (entity, position) => {
      if (entity.parent) {
        const parentPos = entity.parent.getComponent(Position);
        const parentRot = entity.parent.getComponent(Rotation);

        if (parentPos && parentRot) {
          // Calculate world position from local position
          const cos = Math.cos(parentRot.angle);
          const sin = Math.sin(parentRot.angle);

          const localX = position.x;
          const localY = position.y;

          position.worldX = parentPos.worldX + (localX * cos - localY * sin);
          position.worldY = parentPos.worldY + (localX * sin + localY * cos);
        }
      } else {
        // Root entity
        position.worldX = position.x;
        position.worldY = position.y;
      }
    }
  },
  true
);
```

---

## Component Composition

### When to Split Components

**Problem:** Unsure whether to use one large component or multiple small components.

**Guideline:** Follow the Single Responsibility Principle. Split components when:

1. **Different systems need different data**
2. **Some entities need only part of the data**
3. **Component becomes too large (>10 fields)**

**Example: Before (Bad)**

```typescript
// Too many responsibilities
class Character {
  // Position data
  x: number;
  y: number;

  // Health data
  health: number;
  maxHealth: number;

  // Rendering data
  sprite: string;
  color: string;

  // AI data
  aiState: string;
  target: Entity;

  // Inventory data
  items: Item[];
  gold: number;
}
```

**Example: After (Good)**

```typescript
// Focused, reusable components
class Position {
  constructor(public x = 0, public y = 0) {}
}

class Health {
  constructor(public current = 100, public max = 100) {}
}

class Sprite {
  constructor(public name: string, public color = '#FFFFFF') {}
}

class AI {
  constructor(
    public state: string = 'idle',
    public target: Entity | null = null
  ) {}
}

class Inventory {
  items: Item[] = [];
  gold: number = 0;
}

// Entities compose the components they need
const player = engine.createEntity('Player');
player.addComponent(Position, 0, 0);
player.addComponent(Health, 100, 100);
player.addComponent(Sprite, 'player');
player.addComponent(Inventory);

const enemy = engine.createEntity('Enemy');
enemy.addComponent(Position, 50, 50);
enemy.addComponent(Health, 50, 50);
enemy.addComponent(Sprite, 'enemy');
enemy.addComponent(AI, 'patrol');
```

---

### Data-Oriented Component Design

**Problem:** Components should be pure data, but you need behavior.

**Solution:** Keep components as data, put behavior in systems:

**Example: Wrong Approach**

```typescript
// Mixing data and behavior (object-oriented style)
class Player {
  x: number;
  y: number;
  health: number;

  // ❌ Behavior in component
  move(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
  }

  takeDamage(amount: number) {
    this.health -= amount;
  }
}
```

**Example: Correct Approach**

```typescript
// Component: Pure data
class Player {
  thrustPower: number = 200;
  rotationSpeed: number = 4;
  shootCooldown: number = 0;
}

class Position {
  constructor(public x = 0, public y = 0) {}
}

class Health {
  constructor(public current = 100, public max = 100) {}
}

// System: Behavior
engine.createSystem('MovementSystem',
  { all: [Position, Velocity] },
  {
    act: (entity, position, velocity) => {
      position.x += velocity.dx;
      position.y += velocity.dy;
    }
  }
);

engine.createSystem('CombatSystem',
  { all: [Health] },
  {
    act: (entity, health) => {
      // Check for damage events
      const damageEvent = getDamageEvent(entity);
      if (damageEvent) {
        health.current -= damageEvent.amount;
      }
    }
  }
);
```

**Exception: Utility Methods**

Simple utility methods are acceptable if they don't contain game logic:

```typescript
class Position {
  constructor(public x = 0, public y = 0) {}

  // ✅ OK: Simple utility
  distanceTo(other: Position): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ✅ OK: Data transformation
  clone(): Position {
    return new Position(this.x, this.y);
  }
}
```

---

### Component Dependencies

**Problem:** Some components require other components to function.

**Solution:** Use component validators to enforce dependencies:

```typescript
// RigidBody requires Position
engine.registerComponentValidator(RigidBody, {
  dependencies: [Position],
  validate: (component) => {
    if (component.mass <= 0) {
      return 'Mass must be positive';
    }
    return true;
  }
});

// Attempting to add RigidBody without Position throws error
const entity = engine.createEntity();
// entity.addComponent(RigidBody); // ❌ Error: Missing Position dependency

// Correct usage
entity.addComponent(Position, 0, 0);
entity.addComponent(RigidBody, 1); // ✅ OK
```

**Component Conflicts:**

```typescript
// Flying and Swimming are mutually exclusive
engine.registerComponentValidator(Flying, {
  conflicts: [Swimming]
});

const bird = engine.createEntity();
bird.addComponent(Flying);
// bird.addComponent(Swimming); // ❌ Error: Conflicts with Flying
```

---

## System Organization

### System Execution Order

**Problem:** Systems need to run in a specific order for correct behavior.

**Solution:** Use priorities (higher = runs first):

```typescript
// Recommended priority ranges:
// 1000+: Input and event handling
// 500-999: Game logic
// 100-499: Physics and movement
// 0-99: Late logic (AI reactions)
// -1 to -99: Pre-rendering (culling, LOD)
// -100 and below: Rendering

engine.createSystem('InputSystem', query, { priority: 1000 }, false);
engine.createSystem('PlayerControlSystem', query, { priority: 900 }, false);
engine.createSystem('AISystem', query, { priority: 500 }, true);
engine.createSystem('PhysicsSystem', query, { priority: 400 }, true);
engine.createSystem('CollisionSystem', query, { priority: 300 }, true);
engine.createSystem('AnimationSystem', query, { priority: 200 }, true);
engine.createSystem('CullingSystem', query, { priority: -50 }, false);
engine.createSystem('RenderSystem', query, { priority: -100 }, false);
```

**Execution Flow Example:**

```
Frame Update:
  1. InputSystem (1000)      - Read keyboard/mouse
  2. PlayerControl (900)     - Apply input to player
  3. AISystem (500)          - AI decision making
  4. PhysicsSystem (400)     - Apply forces, update velocities
  5. CollisionSystem (300)   - Detect and resolve collisions
  6. AnimationSystem (200)   - Update animation states
  7. CullingSystem (-50)     - Determine what's on screen
  8. RenderSystem (-100)     - Draw to screen
```

---

### System Communication

**Problem:** Systems need to communicate without tight coupling.

**Solution 1: Message Bus**

```typescript
// Publisher system
engine.createSystem('CombatSystem',
  { all: [Health] },
  {
    act: (entity, health) => {
      if (health.current <= 0) {
        // Publish death event
        engine.messageBus.publish('entity-died', {
          entity: entity.id,
          position: entity.getComponent(Position)
        }, 'CombatSystem');
      }
    }
  }
);

// Subscriber system
engine.messageBus.subscribe('entity-died', (message) => {
  console.log('Entity died:', message.data.entity);

  // Spawn death particles
  createDeathEffect(message.data.position);

  // Award points
  if (message.data.entity.hasTag('enemy')) {
    awardPoints(100);
  }
});
```

**Solution 2: Shared Components**

```typescript
// GameState component acts as communication channel
class GameState {
  score: number = 0;
  level: number = 1;
  isPaused: boolean = false;
}

// Create singleton entity for game state
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
        // Update score
        state.score += calculateFrameScore();
      }
    }
  }
);
```

**Solution 3: Tags and Queries**

```typescript
// System 1: Mark entities for processing
engine.createSystem('DamageSystem',
  { all: [Health] },
  {
    act: (entity, health) => {
      if (health.current <= 0) {
        entity.addTag('dead');
      }
    }
  }
);

// System 2: Process marked entities
engine.createSystem('DeathSystem',
  { tags: ['dead'] },
  {
    act: (entity) => {
      // Handle death
      createCorpse(entity);
      entity.queueFree();
    }
  }
);
```

---

### Conditional System Execution

**Problem:** System should only run under certain conditions.

**Solution:** Use system enable/disable or conditional logic:

**Approach 1: Enable/Disable**

```typescript
const renderSystem = engine.createSystem('RenderSystem', query, options);

// Disable when paused
engine.on('game-paused', () => {
  renderSystem.setEnabled(false);
});

engine.on('game-resumed', () => {
  renderSystem.setEnabled(true);
});
```

**Approach 2: Early Return**

```typescript
engine.createSystem('GameLogicSystem',
  { all: [GameObject] },
  {
    before: () => {
      const gameState = getGameState();

      // Early return if paused
      if (gameState.isPaused) {
        return; // Skip act() calls
      }
    },
    act: (entity, gameObject) => {
      // Game logic here
    }
  }
);
```

**Approach 3: Conditional Tags**

```typescript
// Only process entities tagged as 'active'
engine.createSystem('ActiveOnlySystem',
  {
    all: [Component],
    tags: ['active'],
    withoutTags: ['paused', 'disabled']
  },
  {
    act: (entity, component) => {
      // Only runs for active, non-paused, non-disabled entities
    }
  }
);
```

---

## Performance Optimization

### Query Optimization

**Problem:** Queries are slow with many entities.

**Solution:** Make queries as specific as possible:

**Bad: Too Broad**

```typescript
// Matches almost all entities
const query = engine.createQuery({
  any: [Position] // Most entities have Position
});
// Result: 10,000+ entities matched
```

**Good: Specific**

```typescript
// Only matches specific subset
const query = engine.createQuery({
  all: [Position, Velocity, AI],
  tags: ['enemy', 'active'],
  withoutTags: ['dead', 'frozen']
});
// Result: 50 entities matched
```

**Query Reuse:**

```typescript
// ❌ Bad: Creating query every frame
engine.createSystem('BadSystem',
  { all: [] },
  {
    act: () => {
      // Recreates query each call - expensive!
      const enemies = engine.createQuery({ tags: ['enemy'] }).getEntities();
      // ...
    }
  }
);

// ✅ Good: Create query once
const enemyQuery = engine.createQuery({ tags: ['enemy'] });

engine.createSystem('GoodSystem',
  { all: [] },
  {
    act: () => {
      // Reuses existing query
      const enemies = enemyQuery.getEntities();
      // ...
    }
  }
);
```

---

### Component Pooling

**Problem:** Creating/destroying components causes garbage collection.

**Solution:** Use component pools for frequently created components:

```typescript
// Register pools for high-frequency components
engine.registerComponentPool(Particle, {
  initialSize: 100,
  maxSize: 1000
});

engine.registerComponentPool(Bullet, {
  initialSize: 50,
  maxSize: 500
});

// Components are automatically reused
const entity = engine.createEntity();
entity.addComponent(Particle); // Gets pooled instance
entity.removeComponent(Particle); // Returns to pool
```

**When to Use Pooling:**
- ✅ Particles (created/destroyed frequently)
- ✅ Bullets/projectiles
- ✅ Temporary effects
- ❌ Player components (created once)
- ❌ Level geometry (rarely changes)

---

### Spatial Partitioning

**Problem:** Need to find nearby entities efficiently (e.g., for collision detection).

**Solution:** Use spatial partitioning (grid or quadtree):

```typescript
class SpatialGrid {
  private cells: Map<string, EntityDef[]> = new Map();
  private cellSize: number;

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  insert(entity: EntityDef, position: Position): void {
    const key = this.getCellKey(position.x, position.y);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key)!.push(entity);
  }

  queryRadius(x: number, y: number, radius: number): EntityDef[] {
    const results: EntityDef[] = [];
    const cells = Math.ceil(radius / this.cellSize) + 1;

    const centerCellX = Math.floor(x / this.cellSize);
    const centerCellY = Math.floor(y / this.cellSize);

    // Check surrounding cells
    for (let dx = -cells; dx <= cells; dx++) {
      for (let dy = -cells; dy <= cells; dy++) {
        const key = `${centerCellX + dx},${centerCellY + dy}`;
        const cellEntities = this.cells.get(key) || [];

        for (const entity of cellEntities) {
          const pos = entity.getComponent(Position);
          const distance = Math.sqrt(
            (pos.x - x) ** 2 + (pos.y - y) ** 2
          );

          if (distance <= radius) {
            results.push(entity);
          }
        }
      }
    }

    return results;
  }

  clear(): void {
    this.cells.clear();
  }
}

// Use in collision system
const grid = new SpatialGrid(100);

engine.createSystem('SpatialCollisionSystem',
  { all: [Position, Collider] },
  {
    before: () => {
      grid.clear();
    },
    act: (entity, position, collider) => {
      // Insert into grid
      grid.insert(entity, position);
    },
    after: () => {
      // Check collisions using spatial queries
      const entities = engine.createQuery({ all: [Position, Collider] })
        .getEntities();

      for (const entity of entities) {
        const position = entity.getComponent(Position);
        const collider = entity.getComponent(Collider);

        // Only check nearby entities
        const nearby = grid.queryRadius(
          position.x,
          position.y,
          collider.radius * 2
        );

        for (const other of nearby) {
          if (other !== entity) {
            checkCollision(entity, other);
          }
        }
      }
    }
  }
);
```

---

## Common Game Mechanics

### Health and Damage System

**Components:**

```typescript
class Health {
  constructor(
    public current: number = 100,
    public max: number = 100
  ) {}

  get percent(): number {
    return this.current / this.max;
  }

  isDead(): boolean {
    return this.current <= 0;
  }
}

class DamageReceiver {
  damageMultiplier: number = 1.0;
  isInvulnerable: boolean = false;
  invulnerabilityTimer: number = 0;
}

class DamageDealer {
  constructor(
    public damage: number = 10,
    public damageType: string = 'physical'
  ) {}
}
```

**Systems:**

```typescript
// Collision-based damage
engine.createSystem('DamageSystem',
  { all: [Health, DamageReceiver] },
  {
    act: (entity, health, receiver) => {
      // Update invulnerability
      if (receiver.isInvulnerable) {
        receiver.invulnerabilityTimer -= 1 / 60;
        if (receiver.invulnerabilityTimer <= 0) {
          receiver.isInvulnerable = false;
        }
        return;
      }

      // Check for damage events (from collision system)
      const damageEvent = getDamageEvent(entity);
      if (damageEvent) {
        const damage = damageEvent.damage * receiver.damageMultiplier;
        health.current = Math.max(0, health.current - damage);

        // Trigger invulnerability
        receiver.isInvulnerable = true;
        receiver.invulnerabilityTimer = 1.0; // 1 second

        // Publish damage event
        engine.messageBus.publish('entity-damaged', {
          entity,
          damage,
          remaining: health.current
        }, 'DamageSystem');

        if (health.isDead()) {
          entity.addTag('dead');
          engine.messageBus.publish('entity-died', { entity }, 'DamageSystem');
        }
      }
    }
  }
);

// Death handling
engine.createSystem('DeathSystem',
  { tags: ['dead'] },
  {
    act: (entity) => {
      // Create death effect
      createDeathParticles(entity);

      // Drop loot
      if (entity.hasComponent(Loot)) {
        spawnLoot(entity);
      }

      // Queue for deletion
      entity.queueFree();
    }
  }
);
```

---

### Inventory System

**Using Parent-Child Entities:**

```typescript
class Inventory {
  maxSlots: number = 10;
  gold: number = 0;
}

class Item {
  constructor(
    public name: string,
    public value: number,
    public stackSize: number = 1
  ) {}
}

// Create player with inventory
const player = engine.createEntity('Player');
player.addComponent(Inventory);

// Add items as child entities
function addItem(owner: EntityDef, itemName: string, value: number): EntityDef {
  const inventory = owner.getComponent(Inventory);

  if (owner.children.length >= inventory.maxSlots) {
    console.log('Inventory full!');
    return null;
  }

  const item = engine.createEntity(itemName);
  item.addComponent(Item, itemName, value);
  owner.addChild(item);

  return item;
}

// Query player's items
function getItems(owner: EntityDef): Item[] {
  return owner.children
    .filter(child => child.hasComponent(Item))
    .map(child => child.getComponent(Item));
}

// Remove item
function removeItem(item: EntityDef): void {
  item.queueFree(); // Automatically removed from parent
}

// Usage
addItem(player, 'Health Potion', 50);
addItem(player, 'Sword', 100);

const items = getItems(player);
console.log(`Player has ${items.length} items`);
```

---

### AI Behavior Trees

**Using Components and Tags for States:**

```typescript
class AIState {
  constructor(
    public current: string = 'idle',
    public target: EntityDef | null = null
  ) {}
}

class AIMemory {
  lastSeenPlayerPosition: Position | null = null;
  lastSeenPlayerTime: number = 0;
  alertLevel: number = 0;
}

// AI System
engine.createSystem('AISystem',
  { all: [Position, AIState, AIMemory] },
  {
    act: (entity, position, aiState, memory) => {
      const dt = 1 / 60;

      switch (aiState.current) {
        case 'idle':
          aiIdle(entity, position, aiState, memory);
          break;

        case 'patrol':
          aiPatrol(entity, position, aiState, memory);
          break;

        case 'chase':
          aiChase(entity, position, aiState, memory, dt);
          break;

        case 'attack':
          aiAttack(entity, position, aiState, memory);
          break;

        case 'flee':
          aiFlee(entity, position, aiState, memory, dt);
          break;
      }
    }
  },
  true
);

function aiIdle(entity: EntityDef, position: Position, state: AIState, memory: AIMemory): void {
  // Look for player
  const player = findNearbyPlayer(position, 200);

  if (player) {
    state.current = 'chase';
    state.target = player;
    memory.lastSeenPlayerPosition = player.getComponent(Position);
    memory.lastSeenPlayerTime = Date.now();
  } else if (Math.random() < 0.01) {
    // Randomly start patrolling
    state.current = 'patrol';
  }
}

function aiPatrol(entity: EntityDef, position: Position, state: AIState, memory: AIMemory): void {
  // Move in pattern
  const velocity = entity.getComponent(Velocity);
  if (velocity) {
    velocity.dx = Math.sin(Date.now() * 0.001) * 50;
    velocity.dy = Math.cos(Date.now() * 0.001) * 50;
  }

  // Check for player
  const player = findNearbyPlayer(position, 200);
  if (player) {
    state.current = 'chase';
    state.target = player;
  }
}

function aiChase(entity: EntityDef, position: Position, state: AIState, memory: AIMemory, dt: number): void {
  if (!state.target) {
    state.current = 'idle';
    return;
  }

  const targetPos = state.target.getComponent(Position);
  const distance = Math.sqrt(
    (targetPos.x - position.x) ** 2 +
    (targetPos.y - position.y) ** 2
  );

  if (distance < 50) {
    state.current = 'attack';
  } else if (distance > 500) {
    // Lost target
    state.current = 'idle';
    state.target = null;
  } else {
    // Move toward target
    const velocity = entity.getComponent(Velocity);
    if (velocity) {
      const angle = Math.atan2(targetPos.y - position.y, targetPos.x - position.x);
      velocity.dx = Math.cos(angle) * 100;
      velocity.dy = Math.sin(angle) * 100;
    }
  }
}

function aiAttack(entity: EntityDef, position: Position, state: AIState, memory: AIMemory): void {
  if (!state.target) {
    state.current = 'idle';
    return;
  }

  // Attack target
  dealDamage(state.target, 10);

  // Check health
  const health = entity.getComponent(Health);
  if (health && health.percent < 0.3) {
    state.current = 'flee';
  } else {
    state.current = 'chase';
  }
}

function aiFlee(entity: EntityDef, position: Position, state: AIState, memory: AIMemory, dt: number): void {
  // Run away from target
  if (state.target) {
    const targetPos = state.target.getComponent(Position);
    const velocity = entity.getComponent(Velocity);

    if (velocity) {
      const angle = Math.atan2(position.y - targetPos.y, position.x - targetPos.x);
      velocity.dx = Math.cos(angle) * 150;
      velocity.dy = Math.sin(angle) * 150;
    }
  }

  // Find health pickup
  // If found, go to it
  // Otherwise keep fleeing
}
```

---

## Testing Strategies

### Unit Testing Systems

**Test systems in isolation:**

```typescript
import { EngineBuilder } from 'orion-ecs';

describe('MovementSystem', () => {
  let engine;

  beforeEach(() => {
    engine = new EngineBuilder()
      .withDebugMode(false)
      .build();

    // Create movement system
    engine.createSystem('MovementSystem',
      { all: [Position, Velocity] },
      {
        act: (entity, position, velocity) => {
          position.x += velocity.dx;
          position.y += velocity.dy;
        }
      },
      true
    );
  });

  test('moves entity based on velocity', () => {
    const entity = engine.createEntity('TestEntity');
    entity.addComponent(Position, 0, 0);
    entity.addComponent(Velocity, 10, 5);

    engine.update(16); // One frame

    const position = entity.getComponent(Position);
    expect(position.x).toBe(10);
    expect(position.y).toBe(5);
  });

  test('handles multiple entities', () => {
    const e1 = engine.createEntity('E1');
    e1.addComponent(Position, 0, 0);
    e1.addComponent(Velocity, 1, 0);

    const e2 = engine.createEntity('E2');
    e2.addComponent(Position, 0, 0);
    e2.addComponent(Velocity, 0, 1);

    engine.update(16);

    expect(e1.getComponent(Position).x).toBe(1);
    expect(e2.getComponent(Position).y).toBe(1);
  });
});
```

---

### Integration Testing

**Test system interactions:**

```typescript
describe('Combat System Integration', () => {
  let engine;

  beforeEach(() => {
    engine = new EngineBuilder().build();

    // Set up combat systems
    setupCombatSystems(engine);
  });

  test('collision causes damage', () => {
    const player = engine.createEntity('Player');
    player.addComponent(Position, 0, 0);
    player.addComponent(Health, 100, 100);
    player.addComponent(Collider, 10);

    const enemy = engine.createEntity('Enemy');
    enemy.addComponent(Position, 5, 5); // Close enough to collide
    enemy.addComponent(DamageDealer, 10);
    enemy.addComponent(Collider, 10);

    engine.update(16);

    const health = player.getComponent(Health);
    expect(health.current).toBeLessThan(100);
  });

  test('death removes entity', () => {
    const entity = engine.createEntity('Entity');
    entity.addComponent(Health, 10, 100);

    // Deal lethal damage
    const health = entity.getComponent(Health);
    health.current = 0;

    engine.update(16);
    engine.update(16); // Process deletion

    expect(entity.isMarkedForDeletion).toBe(true);
  });
});
```

---

### Performance Testing

**Benchmark critical systems:**

```typescript
describe('Performance Benchmarks', () => {
  test('handles 10,000 entities', () => {
    const engine = new EngineBuilder().build();

    engine.createSystem('MovementSystem',
      { all: [Position, Velocity] },
      {
        act: (entity, position, velocity) => {
          position.x += velocity.dx;
          position.y += velocity.dy;
        }
      }
    );

    // Create many entities
    for (let i = 0; i < 10000; i++) {
      const entity = engine.createEntity(`Entity${i}`);
      entity.addComponent(Position, 0, 0);
      entity.addComponent(Velocity, 1, 1);
    }

    // Measure update time
    const start = performance.now();
    engine.update(16);
    const end = performance.now();

    const updateTime = end - start;
    console.log(`Update time: ${updateTime}ms`);

    // Should complete in reasonable time
    expect(updateTime).toBeLessThan(16); // 60fps budget
  });
});
```

---

## Debugging Techniques

### Using Debug Mode

```typescript
const engine = new EngineBuilder()
  .withDebugMode(true) // Enable detailed logging
  .build();

// Get comprehensive debug info
const debugInfo = engine.getDebugInfo();
console.log('Entities:', debugInfo.entityCount);
console.log('Systems:', debugInfo.systemCount);
console.log('Components:', debugInfo.componentTypes);
```

### Profiling Systems

```typescript
// Get system performance profiles
const profiles = engine.getSystemProfiles();

profiles.forEach(profile => {
  console.log(`${profile.name}:`);
  console.log(`  Avg time: ${profile.averageTime.toFixed(2)}ms`);
  console.log(`  Total calls: ${profile.callCount}`);
  console.log(`  Entity count: ${profile.entityCount}`);
});

// Find slow systems
const slowSystems = profiles.filter(p => p.averageTime > 5);
if (slowSystems.length > 0) {
  console.warn('Slow systems detected:', slowSystems);
}
```

### Memory Analysis

```typescript
const memStats = engine.getMemoryStats();
console.log('Active entities:', memStats.activeEntities);
console.log('Total entities:', memStats.totalEntities);
console.log('Memory estimate:', memStats.totalMemoryEstimate, 'bytes');

// Component distribution
console.log('Components:');
for (const [name, count] of Object.entries(memStats.componentArrays)) {
  console.log(`  ${name}: ${count}`);
}
```

---

## Advanced Patterns

### Entity State Machines

```typescript
class StateMachine {
  private states: Map<string, State> = new Map();
  private currentState: string;

  constructor(initialState: string) {
    this.currentState = initialState;
  }

  addState(name: string, state: State): void {
    this.states.set(name, state);
  }

  transition(newState: string, entity: EntityDef): void {
    const current = this.states.get(this.currentState);
    const next = this.states.get(newState);

    if (current) current.onExit(entity);
    if (next) next.onEnter(entity);

    this.currentState = newState;
  }

  update(entity: EntityDef, dt: number): void {
    const state = this.states.get(this.currentState);
    if (state) {
      state.onUpdate(entity, dt);
    }
  }
}

interface State {
  onEnter(entity: EntityDef): void;
  onUpdate(entity: EntityDef, dt: number): void;
  onExit(entity: EntityDef): void;
}

// Example states
const idleState: State = {
  onEnter: (entity) => {
    const velocity = entity.getComponent(Velocity);
    velocity.dx = 0;
    velocity.dy = 0;
  },
  onUpdate: (entity, dt) => {
    // Check for transition conditions
  },
  onExit: (entity) => {}
};

const runState: State = {
  onEnter: (entity) => {
    console.log('Started running');
  },
  onUpdate: (entity, dt) => {
    const velocity = entity.getComponent(Velocity);
    velocity.dx = 100; // Run speed
  },
  onExit: (entity) => {}
};

// Usage
const entity = engine.createEntity('Player');
const sm = new StateMachine('idle');
sm.addState('idle', idleState);
sm.addState('run', runState);
entity.addComponent(StateMachine, sm);

engine.createSystem('StateMachineSystem',
  { all: [StateMachine] },
  {
    act: (entity, sm) => {
      sm.update(entity, 1/60);
    }
  }
);
```

---

## Summary

This cookbook provides patterns and best practices for:

- **Entity Management**: Prefabs, pooling, hierarchies
- **Component Design**: Composition, data-oriented design, dependencies
- **System Organization**: Execution order, communication, conditional execution
- **Performance**: Query optimization, spatial partitioning, pooling
- **Game Mechanics**: Health, inventory, AI, state machines
- **Testing**: Unit, integration, and performance testing
- **Debugging**: Profiling, memory analysis, debug mode

For more examples, see:
- [Game Examples](../examples/games/)
- [Integration Examples](../examples/integrations/)
- [Main README](../README.md)

---

**Happy coding! 🎮**
