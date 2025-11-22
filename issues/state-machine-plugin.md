# State Machine Plugin

**Milestone:** v0.4.0 - Component Composition & Plugins
**Priority:** Medium
**Labels:** plugin, enhancement, game-dev
**Impact:** Game Development, AI Systems

## Description

Create a Finite State Machine (FSM) plugin for OrionECS to enable clean, declarative state-based behavior for entities. State machines are a fundamental pattern in game development for AI, animation, game flow, and more.

## Goals

- Provide easy-to-use state machine system for entities
- Support hierarchical/nested state machines
- Enable state transitions with conditions and events
- Include visual debugging of state machines
- Support serialization/deserialization of state machine state

## Use Cases

- **AI Behavior:** Enemy AI states (Idle → Patrol → Chase → Attack → Flee)
- **Animation:** Animation states (Idle → Walk → Run → Jump)
- **Game Flow:** Menu states (MainMenu → Settings → Gameplay → Pause → GameOver)
- **Entity Lifecycle:** Loading → Ready → Active → Destroyed
- **Player Actions:** Standing → Crouching → Jumping → Falling

## Subtasks

### 1. Design State Machine API
- [ ] Define state machine architecture
- [ ] Design state and transition interfaces
- [ ] Plan event/message-based transitions
- [ ] Design hierarchical state machine support
- [ ] Create API examples and use cases

### 2. Implement Core State Machine
- [ ] Create `State` class with enter/exit/update callbacks
- [ ] Implement `StateMachine` component
- [ ] Add state registration and management
- [ ] Implement state transitions with validation
- [ ] Add current state tracking

### 3. Implement Transition System
- [ ] Create `Transition` class with conditions
- [ ] Support predicate-based transitions
- [ ] Support event/message-based transitions
- [ ] Support time-based transitions
- [ ] Add transition priority and ordering

### 4. Implement State Callbacks
- [ ] `onEnter(entity)` - Called when entering state
- [ ] `onExit(entity)` - Called when leaving state
- [ ] `onUpdate(entity, dt)` - Called each frame in state
- [ ] `canEnter(entity)` - Guard condition for state
- [ ] `canExit(entity)` - Guard condition for leaving

### 5. Add Hierarchical State Machines
- [ ] Support parent/child states
- [ ] Implement state inheritance
- [ ] Add sub-state machines
- [ ] Handle hierarchical transitions
- [ ] Support state history (resume previous sub-state)

### 6. Create State Machine System
- [ ] Implement system to update all state machines
- [ ] Handle state transitions each frame
- [ ] Process queued transitions
- [ ] Update active states
- [ ] Emit state change events

### 7. Add Debugging and Visualization
- [ ] Add state machine inspection API
- [ ] Implement state history tracking
- [ ] Create visual state graph generator
- [ ] Add transition debugging
- [ ] Support state machine profiling

### 8. Implement Serialization
- [ ] Serialize current state
- [ ] Serialize state machine configuration
- [ ] Deserialize and restore state
- [ ] Support state machine templates/prefabs
- [ ] Handle version migration

### 9. Create Plugin Integration
- [ ] Implement `StateMachinePlugin` class
- [ ] Add plugin API extensions
- [ ] Integrate with engine lifecycle
- [ ] Add convenience methods to Engine
- [ ] Support plugin configuration

### 10. Documentation and Examples
- [ ] Write plugin README
- [ ] Create API documentation
- [ ] Add enemy AI example
- [ ] Add animation state machine example
- [ ] Add game flow example
- [ ] Include best practices guide

### 11. Testing
- [ ] Unit tests for State class
- [ ] Unit tests for StateMachine
- [ ] Unit tests for transitions
- [ ] Integration tests with ECS
- [ ] Performance benchmarks
- [ ] Example validation tests

## Success Criteria

- [ ] State machines easy to create and configure
- [ ] Supports all common game dev use cases
- [ ] Hierarchical state machines work correctly
- [ ] Transitions are reliable and debuggable
- [ ] Serialization preserves state correctly
- [ ] Good performance with many state machines
- [ ] Comprehensive documentation and examples
- [ ] Integrates cleanly with OrionECS architecture

## Implementation Notes

**Example API:**
```typescript
import { StateMachinePlugin, State, StateMachine } from 'orion-ecs/plugins/state-machine';

const engine = new EngineBuilder()
  .use(new StateMachinePlugin())
  .build();

// Define states
const idleState = new State('Idle')
  .onEnter((entity) => {
    console.log('Entering idle state');
  })
  .onUpdate((entity, dt) => {
    // Idle behavior
  })
  .onExit((entity) => {
    console.log('Leaving idle state');
  });

const patrolState = new State('Patrol')
  .onUpdate((entity, dt) => {
    const pos = entity.getComponent(Position);
    const patrol = entity.getComponent(PatrolPath);
    // Move along patrol path
  });

const chaseState = new State('Chase')
  .onEnter((entity) => {
    const target = findPlayer();
    entity.getComponent(AIData).target = target;
  })
  .onUpdate((entity, dt) => {
    const aiData = entity.getComponent(AIData);
    // Chase target
  });

// Create state machine
const enemy = engine.createEntity('Enemy');
const stateMachine = enemy.addComponent(StateMachine);

// Configure state machine
stateMachine
  .addState(idleState)
  .addState(patrolState)
  .addState(chaseState)
  .setInitialState('Idle');

// Add transitions
stateMachine
  .addTransition('Idle', 'Patrol', () => true) // Auto-transition
  .addTransition('Patrol', 'Chase', (entity) => {
    // Transition if player is nearby
    const player = engine.getEntityByName('Player');
    const enemyPos = entity.getComponent(Position);
    const playerPos = player.getComponent(Position);
    return distance(enemyPos, playerPos) < 100;
  })
  .addTransition('Chase', 'Patrol', (entity) => {
    // Transition if player is far
    const player = engine.getEntityByName('Player');
    const enemyPos = entity.getComponent(Position);
    const playerPos = player.getComponent(Position);
    return distance(enemyPos, playerPos) > 200;
  });

// Start the state machine
stateMachine.start();

// Manual transitions
stateMachine.transitionTo('Chase');

// Query current state
if (stateMachine.isInState('Chase')) {
  // ...
}
```

**Hierarchical Example:**
```typescript
// Animation state machine with sub-states
const movementState = new State('Movement')
  .addSubState(new State('Walk'))
  .addSubState(new State('Run'))
  .addSubState(new State('Sprint'));

const combatState = new State('Combat')
  .addSubState(new State('Aiming'))
  .addSubState(new State('Shooting'))
  .addSubState(new State('Reloading'));
```

## Related Issues

- #54 - Component Composition
- #55 - Replay System Plugin (state machines help with determinism)
- Behavior Tree Plugin (new issue - complementary to state machines)

## References

- [State Pattern](https://gameprogrammingpatterns.com/state.html) - Game Programming Patterns
- [Unity Animator](https://docs.unity3d.com/Manual/class-AnimatorController.html)
- [Unreal Engine Behavior Trees](https://docs.unrealengine.com/5.0/en-US/behavior-tree-in-unreal-engine/)
- [Godot StateMachine](https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html)
