# Decision Tree Plugin

ECS-native decision trees that evaluate predicates and mutate entity components. Decisions output intent components that drive behavior systems.

## Overview

The Decision Tree Plugin provides a declarative approach to AI decision-making where **decisions result in component mutations**. This ECS-native pattern:

- **Outputs Intent Components**: Decisions add/remove components like `Chasing`, `Attacking`, `Patrolling`
- **Separates Decision from Execution**: Decision trees decide WHAT to do; separate systems handle HOW
- **Type-Safe Predicates**: Custom predicates with compile-time argument validation
- **Fluent Builder API**: Readable, chainable tree construction
- **Debug Tracing**: Track decision paths for debugging

## Installation

```typescript
import { EngineBuilder } from '@orion-ecs/core';
import { DecisionTreePlugin } from '@orion-ecs/decision-tree';

const engine = new EngineBuilder()
  .use(new DecisionTreePlugin())
  .build();
```

## Quick Start

### Define Intent Components

Intent components represent what an entity wants to do:

```typescript
// Simple intents (tag-like)
class Patrolling {}
class Idle {}
class Searching {}

// Intents with data
class Chasing {
  constructor(public targetId: symbol) {}
}

class Attacking {
  constructor(public targetId: symbol, public damage: number = 10) {}
}

class Fleeing {
  constructor(public fromId?: symbol) {}
}

class MovingTo {
  constructor(public x: number, public y: number) {}
}
```

### Build a Decision Tree

```typescript
import { decide } from '@orion-ecs/decision-tree';

const guardAI = decide('GuardAI')
  .name('Guard Behavior Tree')
  .selector()                           // Try children until one succeeds
    .sequence('Attack')                  // Run children until one fails
      .predicate('hasTarget')            // Check if target exists
      .predicate('target.inRange', { range: 50 })
      .add(Attacking)                    // Add Attacking component
    .end()
    .sequence('Chase')
      .predicate('hasTarget')
      .add(Chasing)
    .end()
    .sequence('Patrol')
      .add(Patrolling)                   // Default behavior
    .end()
  .end()
  .build();

// Register the tree
engine.decisions.register(guardAI);
```

### Assign to Entities

```typescript
import { DecisionTree } from '@orion-ecs/decision-tree';

const guard = engine.createEntity('Guard');
guard.addComponent(Position, 100, 100);
guard.addComponent(Health, 100, 100);

// Assign the decision tree
engine.decisions.assign(guard, 'GuardAI');
// Or directly: guard.addComponent(DecisionTree, 'GuardAI');
```

### Create Behavior Systems

Systems execute the intents set by decision trees:

```typescript
// Execute chasing behavior
engine.createSystem('ChasingSystem', {
  all: [Chasing, Position]
}, {
  act: (entity, chasing, position) => {
    const target = engine.getEntity(chasing.targetId);
    if (target) {
      const targetPos = target.getComponent(Position);
      // Move toward target...
    }
  }
});

// Execute attacking behavior
engine.createSystem('AttackingSystem', {
  all: [Attacking]
}, {
  act: (entity, attacking) => {
    // Perform attack logic...
  }
});

// Execute patrolling behavior
engine.createSystem('PatrollingSystem', {
  all: [Patrolling, Position]
}, {
  act: (entity, patrolling, position) => {
    // Follow patrol route...
  }
});
```

## API Reference

### Components

#### DecisionTree

Links an entity to a decision tree definition.

```typescript
class DecisionTree {
  constructor(
    treeId: string,           // ID of registered tree definition
    enabled: boolean = true   // Whether tree is active
  )

  // Debug properties
  lastPath: string[];         // Path taken in last evaluation
  lastResult: boolean;        // Result of last evaluation
}
```

### Builder API

#### decide(id)

Create a new decision tree builder.

```typescript
import { decide } from '@orion-ecs/decision-tree';

const tree = decide('MyAI')
  .name('My AI Tree')
  .description('AI for enemy units')
  // ... build tree
  .build();
```

#### selector(name?)

Start a selector node (tries children until one succeeds, like OR).

```typescript
decide('AI')
  .selector('FindAction')
    .sequence('Attack')
      // ...
    .end()
    .sequence('Flee')
      // ...
    .end()
  .end()
  .build();
```

#### sequence(name?)

Start a sequence node (runs children until one fails, like AND).

```typescript
decide('AI')
  .sequence('AttackSequence')
    .predicate('hasTarget')
    .predicate('hasAmmo')
    .add(Attacking)
  .end()
  .build();
```

#### end()

Close the current selector or sequence.

#### predicate(name, args?)

Add a predicate check.

```typescript
.predicate('hasTarget')
.predicate('target.inRange', { range: 100 })
.predicate('health.below', { threshold: 50 })
```

#### not(name, args?)

Add a negated predicate.

```typescript
.not('hasTarget')  // True if target does NOT exist
```

#### has(component)

Shorthand for checking if entity has a component.

```typescript
.has(AITarget)  // Equivalent to .predicate('hasComponent', { component: AITarget })
```

#### hasNo(component)

Shorthand for checking if entity does NOT have a component.

```typescript
.hasNo(Shield)  // True if entity lacks Shield component
```

#### add(component, ...args)

Add a component to the entity.

```typescript
.add(Attacking)
.add(Chasing, targetSymbol)
.add(MovingTo, 100, 200)
```

#### remove(component)

Remove a component from the entity.

```typescript
.remove(Idle)
.remove(Patrolling)
```

### Extension Methods

The plugin extends the engine with `decisions` API:

#### register(tree)

Register a tree definition.

```typescript
engine.decisions.register(tree);
```

#### unregister(treeId)

Remove a tree definition.

```typescript
engine.decisions.unregister('GuardAI');
```

#### get(treeId)

Get a registered tree definition.

```typescript
const tree = engine.decisions.get('GuardAI');
```

#### list()

Get all registered tree IDs.

```typescript
const treeIds = engine.decisions.list();
```

#### assign(entity, treeId)

Assign a tree to an entity.

```typescript
engine.decisions.assign(guard, 'GuardAI');
```

#### unassign(entity)

Remove tree from an entity.

```typescript
engine.decisions.unassign(guard);
```

#### setEnabled(entity, enabled)

Enable/disable tree evaluation.

```typescript
engine.decisions.setEnabled(guard, false);  // Pause AI
engine.decisions.setEnabled(guard, true);   // Resume AI
```

#### hasTree(entity)

Check if entity has a decision tree.

```typescript
if (engine.decisions.hasTree(entity)) {
  // Entity has AI
}
```

#### getTreeId(entity)

Get the tree ID assigned to an entity.

```typescript
const treeId = engine.decisions.getTreeId(guard);
```

#### getLastPath(entity)

Get the decision path from last evaluation (debug).

```typescript
const path = engine.decisions.getLastPath(guard);
console.log('Decision path:', path.join(' -> '));
```

#### evaluate(entity)

Manually trigger evaluation (debug).

```typescript
const success = engine.decisions.evaluate(guard);
```

## Custom Predicates

### Registering Predicates

Use the predicate registry for type-safe predicates:

```typescript
// Access the registry
const predicates = engine.decisions.predicates;

// Register custom predicates
predicates
  .register('hasTarget', (entity) => {
    return entity.hasComponent(AITarget);
  })
  .register('target.inRange', (entity, args: { range: number }) => {
    const target = entity.getComponent(AITarget);
    return target ? target.distance <= args.range : false;
  })
  .register('health.below', (entity, args: { threshold: number }) => {
    const health = entity.getComponent(Health);
    return health ? health.current < args.threshold : false;
  })
  .register('cooldown.ready', (entity, args: { ability: string }, context) => {
    const cooldowns = entity.getComponent(Cooldowns);
    return cooldowns?.isReady(args.ability) ?? true;
  });
```

### Predicate Context

Predicates receive a context object:

```typescript
interface PredicateContext {
  getSingleton: <T>(type: ComponentIdentifier<T>) => T | undefined;
  getEntity: (id: symbol) => EntityDef | undefined;
  deltaTime: number;
}
```

### Built-in Predicates

```typescript
// Component checks
.predicate('hasComponent', { component: AITarget })
.predicate('notHasComponent', { component: Shield })

// Tag checks
.predicate('hasTag', { tag: 'enemy' })
.predicate('hasAllTags', { tags: ['enemy', 'active'] })
.predicate('hasAnyTag', { tags: ['boss', 'elite'] })

// Utility
.predicate('random', { chance: 0.3 })  // 30% chance
.predicate('always')                    // Always true
.predicate('never')                     // Always false
```

### Type-Safe Builder with Registry

For compile-time predicate validation, create a builder from the registry:

```typescript
// Register predicates first
const predicates = new PredicateRegistry()
  .register('hasTarget', (e) => e.hasComponent(AITarget))
  .register('target.inRange', (e, args: { range: number }) => {
    const t = e.getComponent(AITarget);
    return t ? t.distance <= args.range : false;
  });

// Create type-safe builder
const tree = predicates.builder('GuardAI')
  .selector()
    .sequence()
      .predicate('hasTarget')                        // ✅ Type-safe
      .predicate('target.inRange', { range: 50 })   // ✅ Args validated
      // .predicate('unknownPred')                   // ❌ Compile error
    .end()
  .end()
  .build();
```

## Configuration Options

```typescript
const plugin = new DecisionTreePlugin({
  // Priority of DecisionTreeSystem (default: 100)
  systemPriority: 100,

  // Use fixed update instead of variable update
  useFixedUpdate: false,

  // Enable debug tracing of decision paths
  enableTracing: true,
});
```

## Examples

### Complex Guard AI

```typescript
// Define components
class AITarget { constructor(public id: symbol, public distance: number) {} }
class Attacking { constructor(public targetId: symbol) {} }
class Chasing { constructor(public targetId: symbol) {} }
class Searching { constructor(public lastKnownX: number, public lastKnownY: number) {} }
class Patrolling {}
class Idle {}

// Register predicates
engine.decisions.predicates
  .register('hasTarget', (e) => e.hasComponent(AITarget))
  .register('targetClose', (e, args: { range: number }) => {
    const t = e.getComponent(AITarget);
    return t ? t.distance <= args.range : false;
  })
  .register('targetVisible', (e) => {
    // Line-of-sight check
    return true;
  })
  .register('lowHealth', (e, args: { threshold: number }) => {
    const h = e.getComponent(Health);
    return h ? h.current < args.threshold : false;
  });

// Build tree
const guardTree = decide('AdvancedGuard')
  .selector('Root')
    // Priority 1: Flee if health is critical
    .sequence('Flee')
      .predicate('lowHealth', { threshold: 20 })
      .remove(Attacking)
      .remove(Chasing)
      .add(Fleeing)
    .end()

    // Priority 2: Attack if target is close
    .sequence('Attack')
      .predicate('hasTarget')
      .predicate('targetClose', { range: 50 })
      .remove(Chasing)
      .remove(Patrolling)
      .add(Attacking)
    .end()

    // Priority 3: Chase if target is visible
    .sequence('Chase')
      .predicate('hasTarget')
      .predicate('targetVisible')
      .remove(Patrolling)
      .add(Chasing)
    .end()

    // Priority 4: Search last known position
    .sequence('Search')
      .has(Searching)
      .not('hasTarget')
      .remove(Patrolling)
      // Keep searching
    .end()

    // Default: Patrol
    .sequence('Patrol')
      .remove(Searching)
      .add(Patrolling)
    .end()
  .end()
  .build();

engine.decisions.register(guardTree);
```

### Conditional Ability Usage

```typescript
class Ability {
  constructor(public name: string, public cooldown: number) {}
}
class UsingAbility { constructor(public abilityName: string) {} }

engine.decisions.predicates
  .register('ability.ready', (e, args: { name: string }) => {
    const ability = e.getComponent(Ability);
    return ability?.name === args.name && ability?.cooldown <= 0;
  })
  .register('ability.bestChoice', (e, args: { name: string }) => {
    // Complex logic to determine if this is the best ability
    return true;
  });

const combatTree = decide('CombatAbilities')
  .selector()
    .sequence('UseFireball')
      .predicate('ability.ready', { name: 'fireball' })
      .predicate('ability.bestChoice', { name: 'fireball' })
      .add(UsingAbility, 'fireball')
    .end()
    .sequence('UseIceBolt')
      .predicate('ability.ready', { name: 'iceBolt' })
      .add(UsingAbility, 'iceBolt')
    .end()
    .sequence('BasicAttack')
      .add(UsingAbility, 'basicAttack')
    .end()
  .end()
  .build();
```

### JSON-Defined Trees

Load trees from JSON for data-driven AI:

```typescript
import { parseTreeJSON } from '@orion-ecs/decision-tree';

const jsonTree = {
  id: 'JsonGuard',
  name: 'JSON-Defined Guard',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: 'Attack',
        children: [
          { type: 'predicate', name: 'hasTarget' },
          { type: 'predicate', name: 'targetClose', args: { range: 50 } },
          { type: 'add', component: 'Attacking' }
        ]
      },
      {
        type: 'sequence',
        name: 'Patrol',
        children: [
          { type: 'add', component: 'Patrolling' }
        ]
      }
    ]
  }
};

// Map component names to classes
const componentMap = {
  'Attacking': Attacking,
  'Patrolling': Patrolling,
  'Chasing': Chasing,
};

const tree = parseTreeJSON(jsonTree, componentMap);
engine.decisions.register(tree);
```

## Debug Tracing

Enable tracing to see decision paths:

```typescript
const plugin = new DecisionTreePlugin({ enableTracing: true });

// After evaluation
const path = engine.decisions.getLastPath(entity);
console.log('Decision path:', path);
// Output: ["sel:Root", "seq:Attack", "hasTarget=true", "targetClose=true", "+Attacking"]
```

## System Priority

The DecisionTreeSystem runs at priority 100 by default. Behavior systems should run after it.

Recommended priority ranges:
- 100+: Decision/AI systems
- 50-100: Behavior execution systems
- 0-50: Rendering/visual systems

## Performance Considerations

- **Evaluation Frequency**: Trees are evaluated every frame by default
- **Short-Circuit Evaluation**: Selectors stop on first success, sequences stop on first failure
- **Predicate Caching**: Consider caching expensive predicate results in components
- **Component Mutations**: Adding/removing components has overhead; avoid excessive mutations

## Integration with Other Plugins

### With State Machine Plugin

Use decision trees within specific states:

```typescript
// Only evaluate decisions when in combat state
engine.createSystem('CombatDecisions', {
  all: [CombatState, DecisionTree]
}, {
  act: (entity) => {
    engine.decisions.evaluate(entity);
  }
});
```

### With Timeline Plugin

Trigger animations based on intent components:

```typescript
engine.createSystem('AttackAnimation', {
  all: [Attacking]
}, {
  act: (entity) => {
    if (!engine.timeline.isPlaying(entity)) {
      engine.timeline.play(entity, 'attackAnim');
    }
  }
});
```
