# ECS-Native Decision Tree Design

## Philosophy: Decisions, Not Behaviors

A "Behavior Tree" is a misnomer in ECS. The tree doesn't execute behaviors—it makes **decisions** about which components an entity should have. Actual behaviors are implemented by regular ECS systems.

```
┌─────────────────────────────────────────────────────────────────┐
│                    DECISION TREE                                 │
│                                                                  │
│   Input:  Entity's current components                            │
│   Output: Component additions/removals                           │
│                                                                  │
│   "If entity has AITarget AND target is in range,                │
│    then ADD Attacking component, REMOVE Chasing component"       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ECS SYSTEMS                                   │
│                                                                  │
│   ChaseSystem:   { all: [Chasing, Position] }                    │
│   AttackSystem:  { all: [Attacking] }                            │
│   PatrolSystem:  { all: [Patrolling, PatrolRoute] }              │
│   FleeSystem:    { all: [Fleeing, Position] }                    │
│                                                                  │
│   Systems query for intent components and execute behavior       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Principles

### 1. Intent = Component Presence

Instead of storing intent in a field:
```typescript
// ❌ Not ECS-native
class AIIntent {
  action: 'chase' | 'attack' | 'patrol' | 'flee';
}

// System has to check field
act: (entity, intent) => {
  if (intent.action === 'chase') { ... }  // Wasteful branching
}
```

Use component presence:
```typescript
// ✅ ECS-native
class Chasing { constructor(public targetId: symbol) {} }
class Attacking { constructor(public targetId: symbol) {} }
class Patrolling {}
class Fleeing {}

// System query IS the filter
engine.createSystem('ChaseSystem', {
  all: [Chasing, Position, Movement]  // Only matching entities
}, {
  act: (entity, chasing, pos, movement) => {
    // No conditionals needed - we know entity is chasing
  }
});
```

### 2. Decision Tree = Predicate Evaluation + Component Mutation

A decision tree is just:
- **Predicates**: Functions that check entity state → boolean
- **Mutations**: Add or remove components based on predicate results
- **Structure**: Selector/Sequence nodes to compose logic

### 3. One System Evaluates All Trees

The plugin provides a single `DecisionTreeSystem` that:
1. Queries entities with `DecisionTree` component
2. Evaluates the tree's predicates against entity state
3. Adds/removes components based on the decision path

### 4. Behaviors Live in Separate Systems

The decision tree plugin has **zero** behavior logic. All behaviors are regular ECS systems that query for intent components.

---

## Plugin Architecture

### Components (Minimal)

```typescript
/**
 * Links an entity to a decision tree definition.
 * This is the ONLY component the plugin requires.
 */
class DecisionTree {
  constructor(
    public treeId: string,
    public enabled: boolean = true,
    public lastPath: string[] = []  // Debug: which path was taken
  ) {}
}
```

### Tree Definition (Pure Data)

Trees can be defined as JSON or built with a fluent API:

```typescript
interface TreeDefinition {
  id: string;
  name?: string;
  root: DecisionNode;
}

type DecisionNode =
  | SelectorNode      // Try children until one succeeds
  | SequenceNode      // Run children until one fails
  | PredicateNode     // Evaluate a condition
  | AddComponentNode  // Add a component to entity
  | RemoveComponentNode; // Remove a component from entity
```

### The System

```typescript
engine.createSystem('DecisionTreeSystem', {
  all: [DecisionTree]
}, {
  priority: 100,  // Run before behavior systems
  act: (entity, dt) => {
    if (!dt.enabled) return;

    const tree = registry.get(dt.treeId);
    dt.lastPath = [];
    evaluate(entity, tree.root, dt.lastPath);
  }
});
```

---

## Tree Definition Formats

### JSON Format

```json
{
  "id": "GuardAI",
  "name": "Guard Decision Tree",
  "root": {
    "type": "selector",
    "children": [
      {
        "type": "sequence",
        "name": "FleeWhenLow",
        "children": [
          { "type": "predicate", "name": "health.isLow", "args": { "threshold": 0.2 } },
          { "type": "remove", "component": "Chasing" },
          { "type": "remove", "component": "Attacking" },
          { "type": "add", "component": "Fleeing" }
        ]
      },
      {
        "type": "sequence",
        "name": "AttackInRange",
        "children": [
          { "type": "predicate", "name": "hasComponent", "args": { "component": "AITarget" } },
          { "type": "predicate", "name": "target.inRange", "args": { "range": 50 } },
          { "type": "remove", "component": "Chasing" },
          { "type": "add", "component": "Attacking", "args": ["$AITarget.entityId"] }
        ]
      },
      {
        "type": "sequence",
        "name": "ChaseTarget",
        "children": [
          { "type": "predicate", "name": "hasComponent", "args": { "component": "AITarget" } },
          { "type": "remove", "component": "Attacking" },
          { "type": "add", "component": "Chasing", "args": ["$AITarget.entityId"] }
        ]
      },
      {
        "type": "sequence",
        "name": "DefaultPatrol",
        "children": [
          { "type": "remove", "component": "Chasing" },
          { "type": "remove", "component": "Attacking" },
          { "type": "add", "component": "Patrolling" }
        ]
      }
    ]
  }
}
```

### Fluent Builder

```typescript
const guardAI = decide('GuardAI')
  .selector()
    .sequence('FleeWhenLow')
      .predicate('health.isLow', { threshold: 0.2 })
      .remove(Chasing)
      .remove(Attacking)
      .add(Fleeing)
    .end()

    .sequence('AttackInRange')
      .predicate('hasComponent', { component: AITarget })
      .predicate('target.inRange', { range: 50 })
      .remove(Chasing)
      .add(Attacking, '$AITarget.entityId')
    .end()

    .sequence('ChaseTarget')
      .predicate('hasComponent', { component: AITarget })
      .remove(Attacking)
      .add(Chasing, '$AITarget.entityId')
    .end()

    .sequence('DefaultPatrol')
      .remove(Chasing)
      .remove(Attacking)
      .add(Patrolling)
    .end()
  .end()
  .build();
```

### Shorthand Builder

```typescript
const guardAI = decide('GuardAI')
  .selector()
    .when('health.isLow', { threshold: 0.2 })
      .become(Fleeing)  // Removes other intents, adds this one

    .when('hasTarget').and('target.inRange', { range: 50 })
      .become(Attacking, '$AITarget.entityId')

    .when('hasTarget')
      .become(Chasing, '$AITarget.entityId')

    .otherwise()
      .become(Patrolling)
  .end()
  .build();
```

---

## Intent Components

Intent components are regular ECS components that represent what an entity is trying to do:

```typescript
// Simple intents (tag-like)
class Patrolling {}
class Idle {}
class Stunned {}

// Intents with data
class Chasing {
  constructor(public targetId: symbol) {}
}

class Attacking {
  constructor(
    public targetId: symbol,
    public damage: number = 10
  ) {}
}

class Fleeing {
  constructor(public fromId?: symbol) {}
}

class MovingTo {
  constructor(public position: { x: number; y: number }) {}
}

class Returning {
  constructor(public homePosition: { x: number; y: number }) {}
}
```

### Mutual Exclusion

Some intents are mutually exclusive. The decision tree handles this by removing conflicting components:

```typescript
.sequence('Attack')
  .predicate('canAttack')
  .remove(Chasing)      // Can't chase while attacking
  .remove(Patrolling)   // Can't patrol while attacking
  .remove(Fleeing)      // Can't flee while attacking
  .add(Attacking, '$target')
.end()
```

Or use the `become()` helper which auto-removes other intents:

```typescript
.when('canAttack')
  .become(Attacking, '$target')  // Auto-removes Chasing, Patrolling, Fleeing
```

---

## Predicate Registration

Predicates are pure functions registered with the plugin:

```typescript
const dt = engine.decisions;

// Component checks
dt.predicate('hasComponent', (entity, { component }) =>
  entity.hasComponent(component)
);

dt.predicate('notHasComponent', (entity, { component }) =>
  !entity.hasComponent(component)
);

// Health checks
dt.predicate('health.isLow', (entity, { threshold = 0.3 }) => {
  const health = entity.getComponent(Health);
  return health ? health.current / health.max < threshold : false;
});

dt.predicate('health.isFull', (entity) => {
  const health = entity.getComponent(Health);
  return health ? health.current >= health.max : false;
});

// Target checks
dt.predicate('hasTarget', (entity) =>
  entity.hasComponent(AITarget)
);

dt.predicate('target.inRange', (entity, { range }) => {
  const pos = entity.getComponent(Position);
  const target = entity.getComponent(AITarget);
  if (!pos || !target?.position) return false;
  return distance(pos, target.position) < range;
});

dt.predicate('target.isVisible', (entity) => {
  const pos = entity.getComponent(Position);
  const target = entity.getComponent(AITarget);
  if (!pos || !target?.position) return false;
  return hasLineOfSight(pos, target.position);
});

// Game state checks (singletons)
dt.predicate('game.isPlaying', (entity, args, context) => {
  const state = context.getSingleton(GameState);
  return state?.mode === 'playing';
});

// Random chance
dt.predicate('random', (entity, { chance = 0.5 }) =>
  Math.random() < chance
);

// Tags
dt.predicate('hasTag', (entity, { tag }) =>
  entity.hasTag(tag)
);

dt.predicate('hasAllTags', (entity, { tags }) =>
  tags.every(tag => entity.hasTag(tag))
);
```

---

## Behavior Systems

Behavior systems are completely separate from the decision tree. They query for intent components:

```typescript
// Chase behavior
engine.createSystem('ChaseSystem', {
  all: [Chasing, Position, Movement]
}, {
  priority: 50,
  act: (entity, chasing, pos, movement) => {
    const target = engine.getEntity(chasing.targetId);
    const targetPos = target?.getComponent(Position);
    if (!targetPos) {
      entity.removeComponent(Chasing);
      return;
    }

    const dir = pathfind(pos, targetPos);
    movement.direction = dir;
    movement.speed = RUN_SPEED;
  }
});

// Attack behavior
engine.createSystem('AttackSystem', {
  all: [Attacking, Position]
}, {
  priority: 50,
  act: (entity, attacking, pos) => {
    const target = engine.getEntity(attacking.targetId);
    const targetPos = target?.getComponent(Position);

    if (!targetPos || distance(pos, targetPos) > ATTACK_RANGE) {
      entity.removeComponent(Attacking);
      return;
    }

    // Emit attack event
    engine.messageBus.publish('combat:attack', {
      attacker: entity.id,
      target: attacking.targetId,
      damage: attacking.damage
    });
  }
});

// Patrol behavior
engine.createSystem('PatrolSystem', {
  all: [Patrolling, PatrolRoute, Position, Movement]
}, {
  priority: 50,
  act: (entity, _patrolling, route, pos, movement) => {
    const waypoint = route.waypoints[route.currentIndex];

    if (distance(pos, waypoint) < WAYPOINT_THRESHOLD) {
      route.currentIndex = (route.currentIndex + 1) % route.waypoints.length;
    }

    movement.direction = directionTo(pos, waypoint);
    movement.speed = WALK_SPEED;
  }
});

// Flee behavior
engine.createSystem('FleeSystem', {
  all: [Fleeing, Position, Movement]
}, {
  priority: 50,
  act: (entity, fleeing, pos, movement) => {
    let fleeDir: Direction;

    if (fleeing.fromId) {
      const threat = engine.getEntity(fleeing.fromId);
      const threatPos = threat?.getComponent(Position);
      if (threatPos) {
        // Run away from threat
        fleeDir = oppositeDirection(directionTo(pos, threatPos));
      }
    } else {
      // Random flee direction
      fleeDir = randomDirection();
    }

    movement.direction = fleeDir;
    movement.speed = RUN_SPEED;
  }
});
```

---

## Complete Example: Guard AI

```typescript
import { EngineBuilder } from '@orion-ecs/core';
import { DecisionTreePlugin, decide } from '@orion-ecs/decision-tree';

// ===========================================
// Components
// ===========================================

class Position { constructor(public x = 0, public y = 0) {} }
class Movement { constructor(public direction = 'none', public speed = 0) {} }
class Health { constructor(public current = 100, public max = 100) {} }
class AITarget { constructor(public entityId: symbol | null = null, public position: {x: number, y: number} | null = null) {} }
class PatrolRoute { constructor(public waypoints: {x: number, y: number}[] = [], public currentIndex = 0) {} }

// Intent components
class Chasing { constructor(public targetId: symbol) {} }
class Attacking { constructor(public targetId: symbol) {} }
class Fleeing { constructor(public fromId?: symbol) {} }
class Patrolling {}
class Idle {}

// ===========================================
// Engine Setup
// ===========================================

const engine = new EngineBuilder()
  .use(new DecisionTreePlugin())
  .build();

// ===========================================
// Register Predicates
// ===========================================

const dt = engine.decisions;

dt.predicate('health.isLow', (entity, { threshold = 0.3 }) => {
  const health = entity.getComponent(Health);
  return health ? health.current / health.max < threshold : false;
});

dt.predicate('hasTarget', (entity) =>
  entity.hasComponent(AITarget) && entity.getComponent(AITarget)!.entityId !== null
);

dt.predicate('target.inRange', (entity, { range }) => {
  const pos = entity.getComponent(Position);
  const target = entity.getComponent(AITarget);
  if (!pos || !target?.position) return false;
  const dx = pos.x - target.position.x;
  const dy = pos.y - target.position.y;
  return Math.sqrt(dx*dx + dy*dy) < range;
});

dt.predicate('hasPatrolRoute', (entity) =>
  entity.hasComponent(PatrolRoute)
);

// ===========================================
// Define Decision Tree
// ===========================================

const guardAI = decide('GuardAI')
  .selector()
    // Priority 1: Flee when health is critical
    .sequence('Flee')
      .predicate('health.isLow', { threshold: 0.2 })
      .remove(Chasing)
      .remove(Attacking)
      .remove(Patrolling)
      .add(Fleeing)
    .end()

    // Priority 2: Attack if target in range
    .sequence('Attack')
      .predicate('hasTarget')
      .predicate('target.inRange', { range: 50 })
      .remove(Chasing)
      .remove(Patrolling)
      .add(Attacking, '$AITarget.entityId')
    .end()

    // Priority 3: Chase if has target
    .sequence('Chase')
      .predicate('hasTarget')
      .remove(Attacking)
      .remove(Patrolling)
      .add(Chasing, '$AITarget.entityId')
    .end()

    // Priority 4: Patrol if has route
    .sequence('Patrol')
      .predicate('hasPatrolRoute')
      .remove(Chasing)
      .remove(Attacking)
      .add(Patrolling)
    .end()

    // Default: Idle
    .sequence('Idle')
      .remove(Chasing)
      .remove(Attacking)
      .remove(Patrolling)
      .remove(Fleeing)
      .add(Idle)
    .end()
  .end()
  .build();

dt.register(guardAI);

// ===========================================
// Behavior Systems
// ===========================================

engine.createSystem('ChaseSystem', { all: [Chasing, Position, Movement] }, {
  act: (entity, chasing, pos, movement) => {
    // Chase logic here
  }
});

engine.createSystem('AttackSystem', { all: [Attacking] }, {
  act: (entity, attacking) => {
    // Attack logic here
  }
});

engine.createSystem('PatrolSystem', { all: [Patrolling, PatrolRoute, Position, Movement] }, {
  act: (entity, _p, route, pos, movement) => {
    // Patrol logic here
  }
});

engine.createSystem('FleeSystem', { all: [Fleeing, Position, Movement] }, {
  act: (entity, fleeing, pos, movement) => {
    // Flee logic here
  }
});

engine.createSystem('IdleSystem', { all: [Idle, Movement] }, {
  act: (entity, _idle, movement) => {
    movement.speed = 0;
  }
});

// ===========================================
// Create Entity
// ===========================================

const guard = engine.createEntity('Guard');
guard.addComponent(Position, 100, 100);
guard.addComponent(Movement);
guard.addComponent(Health, 100, 100);
guard.addComponent(PatrolRoute, [
  { x: 100, y: 100 },
  { x: 200, y: 100 },
  { x: 200, y: 200 },
]);

// Assign decision tree
dt.assign(guard, 'GuardAI');

// ===========================================
// Query AI State (ECS Power!)
// ===========================================

// Find all guards currently chasing
const chasingGuards = engine.createQuery({ all: [Chasing, Position] });

// Find all fleeing entities
const fleeingEntities = engine.createQuery({ all: [Fleeing] });

// Find idle entities that could be assigned tasks
const availableUnits = engine.createQuery({
  all: [Idle, Position],
  none: [Chasing, Attacking, Fleeing]
});
```

---

## Why "Decision Tree" Not "Behavior Tree"?

| Term | What It Does |
|------|-------------|
| **Decision Tree** | Evaluates conditions, outputs component mutations |
| **Behavior Tree** | Implies it executes behaviors (it doesn't!) |

The tree makes **decisions**. Systems execute **behaviors**.

This naming clarifies the architecture and prevents the confusion of trying to put behavior logic in tree nodes.

---

## Summary

| Component | Responsibility |
|-----------|---------------|
| **DecisionTreePlugin** | Registers trees, predicates; provides evaluation system |
| **DecisionTree** (component) | Links entity to a tree definition |
| **Tree Definition** | Pure data: predicates + component mutations |
| **DecisionTreeSystem** | Evaluates trees, adds/removes components |
| **Intent Components** | `Chasing`, `Attacking`, `Fleeing`, etc. |
| **Behavior Systems** | Query intent components, execute actual behaviors |

The plugin is minimal (~150 lines). All complexity lives in regular ECS systems where it belongs.
