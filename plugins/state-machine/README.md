# State Machine Plugin

ECS-native finite state machine with type-safe transitions, declarative rules, and custom predicates.

## Overview

The State Machine Plugin provides a declarative approach to AI and behavior management where **states are represented as components** on entities. This ECS-native pattern enables:

- **States as Components**: Each state (Idle, Chase, Attack) is a component on the entity
- **Declarative Transitions**: Define transition rules with conditions using a fluent API
- **Type-Safe Predicates**: Custom predicates accumulate types for compile-time safety
- **Priority-Based Evaluation**: Higher priority transitions are evaluated first
- **Message-Based Triggers**: Transitions can be triggered by messages
- **State History**: Track previous states for debugging and AI analysis

## Installation

```typescript
import { EngineBuilder } from 'orion-ecs';
import { StateMachinePlugin } from '@orion-ecs/state-machine';

const engine = new EngineBuilder()
  .use(new StateMachinePlugin())
  .build();
```

## Quick Start

### Define State Components

States are simple component classes:

```typescript
// State components (no data needed for basic states)
class IdleState {}
class PatrolState {}
class ChaseState {
  constructor(public targetId: symbol) {}
}
class AttackState {
  constructor(public targetId: symbol, public damage: number = 10) {}
}

// Data components used in conditions
class Health {
  constructor(public current: number = 100, public max: number = 100) {}
}

class AITarget {
  constructor(public entityId: symbol, public distance: number = 0) {}
}
```

### Define a State Machine

```typescript
import { StateMachinePlugin, transition, when } from '@orion-ecs/state-machine';

// Create engine with plugin
const engine = new EngineBuilder()
  .use(new StateMachinePlugin())
  .build();

// Define the state machine
engine.stateMachine.define('EnemyAI', {
  states: [IdleState, PatrolState, ChaseState, AttackState],
  transitions: [
    // Idle -> Patrol after 2 seconds
    transition(IdleState, PatrolState, when.after(2)),

    // Any state -> Chase when target acquired (high priority)
    transition('*', ChaseState, when.hasComponent(AITarget), { priority: 100 }),

    // Chase -> Attack when target is close
    transition(ChaseState, AttackState,
      when.componentValue(AITarget, 'distance', 'lt', 5)
    ),

    // Any state -> Idle when no target
    transition('*', IdleState, when.missingComponent(AITarget), { priority: 50 }),
  ],
  initialState: IdleState,
});
```

### Attach to Entities

```typescript
import { StateMachine } from '@orion-ecs/state-machine';

// Create an enemy entity
const enemy = engine.createEntity('Enemy');
enemy.addComponent(IdleState);                        // Initial state component
enemy.addComponent(StateMachine, IdleState, 'EnemyAI'); // State machine metadata
enemy.addComponent(Health, 100, 100);

// Start the engine - transitions will be evaluated automatically
engine.start();
```

## API Reference

### Components

#### StateMachine

Tracks state machine metadata for an entity.

```typescript
class StateMachine {
  constructor(
    currentStateType: ComponentIdentifier,  // Current state component type
    definitionName: string,                  // Name of state machine definition
    historyDepth: number = 10                // Number of history entries to keep
  )

  // Properties
  stateTime: number;        // Time in current state (seconds)
  transitionCount: number;  // Total transitions made
  locked: boolean;          // Whether transitions are locked
  history: StateHistoryEntry[];  // State history (most recent last)
}
```

### Condition Factories

The `when` object provides factory functions for creating conditions:

#### Component Conditions

```typescript
// Entity must have the component
when.hasComponent(ComponentType)

// Entity must NOT have the component
when.missingComponent(ComponentType)

// Component property comparison
when.componentValue(ComponentType, 'property', 'op', value)
// Operators: 'eq', 'neq', 'gt', 'gte', 'lt', 'lte'
```

#### Time Conditions

```typescript
// Time in current state
when.stateTime('op', seconds)

// Shortcuts
when.after(seconds)      // stateTime > seconds
when.within(seconds)     // stateTime < seconds
when.afterOrAt(seconds)  // stateTime >= seconds
when.withinOrAt(seconds) // stateTime <= seconds
```

#### Message Conditions

```typescript
// Triggered by message
when.message('message-type')
```

#### Custom Predicates

```typescript
// Use a registered predicate
when.predicate('predicate.name', { arg1: value1 })
```

#### Composite Conditions

```typescript
// All conditions must be true
when.and(condition1, condition2, ...)

// Any condition must be true
when.or(condition1, condition2, ...)

// Invert a condition
when.not(condition)
```

### Transition Helper

```typescript
import { transition } from '@orion-ecs/state-machine';

// Basic transition
transition(FromState, ToState, condition)

// With priority (higher = evaluated first)
transition(FromState, ToState, condition, { priority: 100 })

// Multiple conditions (all must be true)
transition(FromState, ToState, [condition1, condition2])

// Multiple from states
transition([State1, State2], ToState, condition)

// Wildcard (any state)
transition('*', ToState, condition)

// With constructor args for target state
transition(IdleState, ChaseState, when.hasComponent(AITarget), {
  args: [targetSymbol]  // Passed to ChaseState constructor
})
```

### Extension Methods

The plugin extends the engine with `stateMachine` API:

#### define(name, definition)

Register a state machine definition.

```typescript
engine.stateMachine.define('EnemyAI', {
  states: [IdleState, PatrolState, ChaseState],
  transitions: [...],
  initialState: IdleState,
});
```

#### getDefinition(name)

Get a registered definition.

```typescript
const definition = engine.stateMachine.getDefinition('EnemyAI');
```

#### transitionTo(entity, stateType, ...args)

Manually trigger a state transition.

```typescript
// Force transition to ChaseState
engine.stateMachine.transitionTo(enemy, ChaseState, targetId);
```

#### queueTransition(entity, stateType, ...args)

Queue a transition for next frame.

```typescript
engine.stateMachine.queueTransition(enemy, AttackState);
```

#### getCurrentState(entity)

Get the current state type.

```typescript
const currentState = engine.stateMachine.getCurrentState(enemy);
if (currentState === ChaseState) {
  console.log('Enemy is chasing!');
}
```

#### getStateTime(entity)

Get time spent in current state.

```typescript
const timeInState = engine.stateMachine.getStateTime(enemy);
```

#### lock(entity) / unlock(entity) / isLocked(entity)

Lock/unlock transitions for critical sections.

```typescript
// Lock during attack animation
engine.stateMachine.lock(enemy);

// Unlock when animation complete
engine.stateMachine.unlock(enemy);
```

#### sendMessage(entity, messageType)

Send a message that can trigger transitions.

```typescript
// Trigger message-based transition
engine.stateMachine.sendMessage(enemy, 'player-spotted');
```

#### getEntitiesInState(stateType)

Get all entities currently in a specific state.

```typescript
const chasingEnemies = engine.stateMachine.getEntitiesInState(ChaseState);
```

## Custom Predicates

Register custom predicates with type-safe arguments:

```typescript
const fsmPlugin = new StateMachinePlugin()
  .predicate('target.inRange', (entity, args: { range: number }, context) => {
    const target = entity.getComponent(AITarget);
    return target ? target.distance < args.range : false;
  })
  .predicate('health.low', (entity, args: { threshold: number }) => {
    const health = entity.getComponent(Health);
    return health ? health.current < args.threshold : false;
  })
  .predicate('has.ammo', (entity, args: { minCount: number }) => {
    const ammo = entity.getComponent(Ammo);
    return ammo ? ammo.count >= args.minCount : false;
  });

const engine = new EngineBuilder()
  .use(fsmPlugin)
  .build();

// Use type-safe predicates in transitions
engine.stateMachine.define('CombatAI', {
  states: [IdleState, ChaseState, AttackState, FleeState],
  transitions: [
    transition(ChaseState, AttackState,
      when.predicate('target.inRange', { range: 5 })  // Type-safe args
    ),
    transition('*', FleeState,
      when.predicate('health.low', { threshold: 20 })
    ),
  ],
  initialState: IdleState,
});
```

### Predicate Context

Predicates receive a context object with:

```typescript
interface PredicateContext {
  getEngine(): Engine;      // Access engine instance
  getDeltaTime(): number;   // Frame delta time
}
```

### Built-in Predicates

```typescript
// Time in current state
when.predicate('state.time', { op: 'gt', seconds: 5 })

// Random chance (evaluated each frame)
when.predicate('random.chance', { probability: 0.1 })
```

## Events

The plugin emits events on state changes:

```typescript
// Listen for any state exit
engine.on('stateExit', (event) => {
  console.log(`Entity ${event.entity.name} exiting ${event.stateType.name}`);
  console.log(`Time in state: ${event.stateTime}s`);
});

// Listen for any state enter
engine.on('stateEnter', (event) => {
  console.log(`Entity ${event.entity.name} entering ${event.stateType.name}`);
  console.log(`Previous state: ${event.previousStateType?.name}`);
});

// Listen for specific state transitions
engine.on('stateEnter:ChaseState', (event) => {
  console.log('An enemy started chasing!');
});

engine.on('stateExit:AttackState', (event) => {
  console.log('Attack finished');
});
```

## Examples

### Enemy AI with Multiple Behaviors

```typescript
class IdleState {}
class PatrolState { waypoints: Vector2[] = []; }
class ChaseState { constructor(public targetId: symbol) {} }
class AttackState { constructor(public targetId: symbol) {} }
class FleeState {}
class DeadState {}

engine.stateMachine.define('EnemyAI', {
  states: [IdleState, PatrolState, ChaseState, AttackState, FleeState, DeadState],
  transitions: [
    // Death takes highest priority
    transition('*', DeadState,
      when.componentValue(Health, 'current', 'lte', 0),
      { priority: 1000 }
    ),

    // Flee when health is low
    transition('*', FleeState,
      when.and(
        when.componentValue(Health, 'current', 'lt', 20),
        when.not(when.hasComponent(DeadState))
      ),
      { priority: 500 }
    ),

    // Attack when in range
    transition(ChaseState, AttackState,
      when.componentValue(AITarget, 'distance', 'lt', 2),
      { priority: 200 }
    ),

    // Chase when target spotted
    transition([IdleState, PatrolState], ChaseState,
      when.hasComponent(AITarget),
      { priority: 100 }
    ),

    // Return to patrol after losing target
    transition(ChaseState, PatrolState,
      when.and(
        when.missingComponent(AITarget),
        when.after(3)  // Wait 3 seconds before giving up
      )
    ),

    // Idle -> Patrol after 5 seconds
    transition(IdleState, PatrolState, when.after(5)),

    // Patrol -> Idle when route complete
    transition(PatrolState, IdleState, when.message('patrol-complete')),
  ],
  initialState: IdleState,
});
```

### Door State Machine

```typescript
class ClosedState {}
class OpeningState {}
class OpenState {}
class ClosingState {}
class LockedState {}

engine.stateMachine.define('DoorFSM', {
  states: [ClosedState, OpeningState, OpenState, ClosingState, LockedState],
  transitions: [
    // Unlock -> Closed
    transition(LockedState, ClosedState, when.message('unlock')),

    // Closed -> Opening
    transition(ClosedState, OpeningState, when.message('open')),

    // Opening -> Open (after animation)
    transition(OpeningState, OpenState, when.after(0.5)),

    // Open -> Closing (auto-close after 3 seconds)
    transition(OpenState, ClosingState, when.after(3)),

    // Closing -> Closed (after animation)
    transition(ClosingState, ClosedState, when.after(0.5)),

    // Lock from closed
    transition(ClosedState, LockedState, when.message('lock')),
  ],
  initialState: ClosedState,
});

// Usage
const door = engine.createEntity('Door');
door.addComponent(ClosedState);
door.addComponent(StateMachine, ClosedState, 'DoorFSM');

// Open the door
engine.stateMachine.sendMessage(door, 'open');
```

### State-Based Systems

Create systems that react to specific states:

```typescript
// System that only runs for entities in ChaseState
engine.createSystem('ChaseSystem', {
  all: [ChaseState, Position, AITarget]
}, {
  priority: 50,
  act: (entity, chaseState, position, target) => {
    // Move toward target
    const targetEntity = engine.getEntity(target.entityId);
    if (targetEntity) {
      const targetPos = targetEntity.getComponent(Position);
      // Calculate direction and move...
    }
  }
});

// System for attack state
engine.createSystem('AttackSystem', {
  all: [AttackState, Position]
}, {
  priority: 50,
  act: (entity, attackState, position) => {
    // Perform attack logic
  }
});
```

## System Priority

The StateMachineTransitionSystem runs at priority 900 (high priority, runs early) to ensure state transitions are processed before behavior systems.

Recommended priority ranges:
- 900+: State machine transitions
- 100-200: AI/Behavior systems
- 50-100: Game logic systems
- 0-50: Rendering/visual systems

## Performance Considerations

- **Transition Evaluation**: Conditions are evaluated every frame for entities with state machines
- **Priority Sorting**: Transitions are sorted by priority each evaluation (use sparingly for many transitions)
- **Message Clearing**: Pending messages are cleared after each frame's evaluation
- **History Depth**: Set `historyDepth: 0` to disable history tracking in production

## Troubleshooting

### State Not Transitioning

1. Verify the entity has both the state component AND StateMachine component
2. Check that the definition name matches
3. Ensure conditions are being met (use debug logging)
4. Check if transitions are locked

### Missing Component Errors

1. State components must be added to the entity separately from StateMachine
2. Ensure component validators are satisfied

### Priority Issues

1. Higher priority transitions are evaluated first
2. Use '*' wildcard carefully - it matches from any state
3. Only one transition occurs per frame per entity

## Integration with Other Plugins

### With Decision Tree Plugin

Use state machines for high-level state and decision trees for action selection within states:

```typescript
engine.createSystem('ChaseDecisions', {
  all: [ChaseState, DecisionTree]
}, {
  act: (entity) => {
    // Decision tree handles detailed chase behavior
    engine.decisions.evaluate(entity);
  }
});
```

### With Timeline Plugin

Trigger timelines on state transitions:

```typescript
engine.on('stateEnter:AttackState', ({ entity }) => {
  engine.timeline.play(entity, 'attackAnimation');
});
```
