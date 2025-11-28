# Timeline Plugin

ECS-native timeline system for orchestrating component property changes, tweens, and events over time.

## Overview

The Timeline Plugin provides time-based orchestration of component changes. Timelines define sequences of actions that execute over time:

- **Property Tweening**: Smoothly interpolate numeric properties with easing
- **Component Manipulation**: Add/remove components at specific times
- **Event Emission**: Emit events at precise moments
- **Nested Timelines**: Compose timelines from reusable sub-timelines
- **Type-Safe Definitions**: Timeline IDs accumulate types for compile-time safety
- **30+ Built-in Easings**: Full suite of easing functions

## Installation

```typescript
import { EngineBuilder } from '@orion-ecs/core';
import { TimelinePlugin } from '@orion-ecs/timeline';

const engine = new EngineBuilder()
  .use(new TimelinePlugin())
  .build();
```

## Quick Start

### Define a Timeline

```typescript
// Create and register a timeline
engine.timeline.define(
  engine.timeline.create('fadeOut')
    .name('Fade Out Effect')
    .tween(Opacity, 'value', 0)    // Start at 0ms
      .from(1)                       // Starting value
      .to(0)                         // Ending value
      .ease('easeOutQuad')           // Easing function
      .duration(500)                 // 500ms duration
      .end()
    .emit('fadeComplete', 500)       // Emit event when done
    .build()
);
```

### Play on an Entity

```typescript
// Entity must have the components being tweened
const entity = engine.createEntity('FadingSprite');
entity.addComponent(Opacity, 1);

// Play the timeline
engine.timeline.playById(entity, 'fadeOut');

// Or add the component directly
entity.addComponent(Timeline, 'fadeOut');
```

### Type-Safe Definitions

Define timelines at plugin creation for compile-time type safety:

```typescript
const timelinePlugin = new TimelinePlugin()
  .define('fadeOut', (b) => b
    .tween(Opacity, 'value', 0)
      .from(1)
      .to(0)
      .ease('easeOutQuad')
      .duration(500)
      .end()
    .build()
  )
  .define('slideIn', (b) => b
    .tween(Position, 'x', 0)
      .from(-100)
      .to(0)
      .duration(300)
      .end()
    .build()
  );

const engine = new EngineBuilder()
  .use(timelinePlugin)
  .build();

// Type-safe play - only 'fadeOut' or 'slideIn' allowed
engine.timeline.play(entity, 'fadeOut');  // ✅ Valid
engine.timeline.play(entity, 'typo');     // ❌ Compile error
```

## API Reference

### Components

#### Timeline

Controls timeline playback for an entity.

```typescript
class Timeline {
  constructor(
    timelineId: string,                      // ID of timeline definition
    options?: { speed?: number; loop?: boolean }
  )

  // State
  state: 'playing' | 'paused' | 'complete';
  elapsed: number;           // Elapsed time in ms
  speed: number;             // Playback speed (1 = normal)
  loop: boolean;             // Whether to loop
  loopCount: number;         // Number of loops completed

  // Methods
  pause(): void;
  resume(): void;
  reset(autoPlay?: boolean): void;
  seek(timeMs: number): void;
}
```

#### Tween

Standalone tween for single-property animations.

```typescript
class Tween {
  constructor(
    component: ComponentClass,
    property: string,
    config: {
      startValue?: number;
      endValue?: number;
      delta?: number;
      duration: number;
      easing?: string;
      loop?: boolean;
      speed?: number;
    }
  )

  // Properties
  progress: number;          // 0-1 progress
  complete: boolean;         // Whether tween finished
}
```

### Timeline Builder

#### create(id)

Create a new timeline builder.

```typescript
import { createTimeline } from '@orion-ecs/timeline';

const timeline = createTimeline('myTimeline')
  .name('My Animation')
  .description('A custom animation')
  // ... add actions
  .build();
```

#### tween(component, property, startTime)

Start building a tween action.

```typescript
.tween(Position, 'x', 0)        // Tween Position.x starting at 0ms
  .from(0)                       // Starting value (optional, uses current if omitted)
  .to(100)                       // Ending value
  .ease('easeOutBounce')         // Easing function
  .duration(500)                 // Duration in ms
  .end()                         // Finish tween definition
```

**Tween Methods:**

| Method | Description |
|--------|-------------|
| `.from(value)` | Set starting value (absolute) |
| `.fromCurrent()` | Use current component value |
| `.to(value)` | Set ending value (absolute) |
| `.by(delta)` | Set relative change from start |
| `.ease(name)` | Set easing function |
| `.duration(ms)` | Set duration in milliseconds |
| `.end()` | Finish and return to builder |

#### set(component, property, at, value)

Instantly set a property at a specific time.

```typescript
.set(Scale, 'x', 500, 2.0)  // Set Scale.x to 2.0 at 500ms
```

#### addDelta(component, property, at, delta)

Add a relative value to a property.

```typescript
.addDelta(Score, 'value', 100, 10)  // Add 10 to Score.value at 100ms
```

#### addComponent(component, at, ...args)

Add a component at a specific time.

```typescript
.addComponent(DamageEffect, 100, 50)    // Add DamageEffect(50) at 100ms
.addComponent(Invincible, 0)            // Add Invincible at start
```

#### removeComponent(component, at)

Remove a component at a specific time.

```typescript
.removeComponent(DamageEffect, 500)     // Remove DamageEffect at 500ms
```

#### emit(event, at, data?)

Emit an event at a specific time.

```typescript
.emit('hitPeak', 250)                   // Emit 'hitPeak' at 250ms
.emit('damage', 100, { amount: 50 })    // With data
```

#### playTimeline(timelineId, at)

Play another timeline at a specific time.

```typescript
.playTimeline('windUp', 0)
.playTimeline('strike', 150)
.playTimeline('recover', 250)
```

### Extension Methods

The plugin extends the engine with `timeline` API:

#### create(id)

Create a new timeline builder.

```typescript
const builder = engine.timeline.create('myTimeline');
```

#### define(definition)

Register a timeline definition at runtime.

```typescript
engine.timeline.define(
  engine.timeline.create('flash')
    .tween(Opacity, 'value', 0).from(1).to(0).duration(100).end()
    .tween(Opacity, 'value', 100).from(0).to(1).duration(100).end()
    .build()
);
```

#### get(id)

Get a registered timeline definition.

```typescript
const definition = engine.timeline.get('fadeOut');
```

#### list()

Get all registered timeline IDs.

```typescript
const ids = engine.timeline.list();
```

#### unregister(id)

Remove a timeline definition.

```typescript
engine.timeline.unregister('fadeOut');
```

#### play(entity, timelineId, options?)

Play a type-safe timeline on an entity.

```typescript
engine.timeline.play(entity, 'fadeOut');
engine.timeline.play(entity, 'loop', { speed: 2, loop: true });
```

#### playById(entity, timelineId, options?)

Play a timeline by string ID (runtime flexibility).

```typescript
engine.timeline.playById(entity, dynamicTimelineId);
```

#### stop(entity)

Stop and remove the timeline.

```typescript
engine.timeline.stop(entity);
```

#### pause(entity)

Pause the timeline.

```typescript
engine.timeline.pause(entity);
```

#### resume(entity)

Resume a paused timeline.

```typescript
engine.timeline.resume(entity);
```

#### isPlaying(entity)

Check if entity has an active timeline.

```typescript
if (engine.timeline.isPlaying(entity)) {
  // Timeline is running
}
```

#### getState(entity)

Get the Timeline component state.

```typescript
const timeline = engine.timeline.getState(entity);
console.log(`Elapsed: ${timeline?.elapsed}ms`);
```

## Easing Functions

### Built-in Easings

| Category | Functions |
|----------|-----------|
| Linear | `linear` |
| Quadratic | `easeInQuad`, `easeOutQuad`, `easeInOutQuad` |
| Cubic | `easeInCubic`, `easeOutCubic`, `easeInOutCubic` |
| Quartic | `easeInQuart`, `easeOutQuart`, `easeInOutQuart` |
| Quintic | `easeInQuint`, `easeOutQuint`, `easeInOutQuint` |
| Sinusoidal | `easeInSine`, `easeOutSine`, `easeInOutSine` |
| Exponential | `easeInExpo`, `easeOutExpo`, `easeInOutExpo` |
| Circular | `easeInCirc`, `easeOutCirc`, `easeInOutCirc` |
| Back | `easeInBack`, `easeOutBack`, `easeInOutBack` |
| Elastic | `easeInElastic`, `easeOutElastic`, `easeInOutElastic` |
| Bounce | `easeInBounce`, `easeOutBounce`, `easeInOutBounce` |

### Custom Easings

Register custom easing functions:

```typescript
const plugin = new TimelinePlugin()
  .easing('customBounce', (t) => {
    // Custom easing logic
    return t * t * (3 - 2 * t);
  })
  .easing('superElastic', (t) => {
    return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  });

// Use in timelines
.tween(Position, 'y', 0)
  .to(100)
  .ease('customBounce')
  .duration(500)
  .end()
```

## Events

The plugin emits events during timeline playback:

```typescript
// Timeline started
engine.on('timelineStart', (event) => {
  console.log(`Timeline ${event.timelineId} started on ${event.entity.name}`);
});

// Timeline completed
engine.on('timelineComplete', (event) => {
  console.log(`Timeline completed in ${event.elapsedTime}ms`);
});

// Timeline paused
engine.on('timelinePause', (event) => {
  console.log(`Paused at ${event.pausedAt}ms`);
});

// Timeline looped
engine.on('timelineLoop', (event) => {
  console.log(`Loop #${event.loopCount}`);
});

// Custom events from emit() actions
engine.on('attackHit', (event) => {
  console.log('Attack connected!', event.data);
});
```

## Configuration Options

```typescript
const plugin = new TimelinePlugin({
  // Priority of TimelineSystem (default: 50)
  systemPriority: 50,

  // Use fixed update instead of variable update
  useFixedUpdate: false,

  // Enable debug logging
  debug: true,
});
```

## Examples

### Attack Animation Sequence

```typescript
engine.timeline.define(
  engine.timeline.create('meleeAttack')
    .name('Melee Attack')
    // Wind-up: pull back
    .tween(Position, 'x', 0)
      .fromCurrent()
      .by(-20)
      .ease('easeOutQuad')
      .duration(150)
      .end()
    // Strike: lunge forward
    .tween(Position, 'x', 150)
      .fromCurrent()
      .by(60)
      .ease('easeInQuad')
      .duration(100)
      .end()
    // Hit event
    .emit('attackHit', 200, { damage: 25 })
    .addComponent(DamageDealer, 200, 25)
    // Recovery: return to position
    .tween(Position, 'x', 250)
      .fromCurrent()
      .by(-40)
      .ease('easeOutQuad')
      .duration(200)
      .end()
    .removeComponent(DamageDealer, 450)
    .emit('attackComplete', 450)
    .build()
);

// Listen for hit
engine.on('attackHit', ({ entity, data }) => {
  // Deal damage to nearby enemies
});
```

### UI Fade In/Out

```typescript
// Fade in
engine.timeline.define(
  engine.timeline.create('uiFadeIn')
    .tween(Opacity, 'value', 0)
      .from(0)
      .to(1)
      .ease('easeOutQuad')
      .duration(300)
      .end()
    .build()
);

// Fade out
engine.timeline.define(
  engine.timeline.create('uiFadeOut')
    .tween(Opacity, 'value', 0)
      .from(1)
      .to(0)
      .ease('easeInQuad')
      .duration(300)
      .end()
    .emit('fadeOutComplete', 300)
    .build()
);

// Pulse effect (looping)
engine.timeline.define(
  engine.timeline.create('uiPulse')
    .tween(Scale, 'x', 0)
      .from(1).to(1.1).ease('easeInOutSine').duration(500).end()
    .tween(Scale, 'y', 0)
      .from(1).to(1.1).ease('easeInOutSine').duration(500).end()
    .tween(Scale, 'x', 500)
      .from(1.1).to(1).ease('easeInOutSine').duration(500).end()
    .tween(Scale, 'y', 500)
      .from(1.1).to(1).ease('easeInOutSine').duration(500).end()
    .build()
);

// Play with loop
engine.timeline.playById(button, 'uiPulse', { loop: true });
```

### Composite Timelines

Build complex animations from reusable parts:

```typescript
// Define sub-timelines
engine.timeline.define(
  engine.timeline.create('squash')
    .tween(Scale, 'x', 0).from(1).to(1.3).duration(100).end()
    .tween(Scale, 'y', 0).from(1).to(0.7).duration(100).end()
    .build()
);

engine.timeline.define(
  engine.timeline.create('stretch')
    .tween(Scale, 'x', 0).from(1.3).to(0.8).duration(100).end()
    .tween(Scale, 'y', 0).from(0.7).to(1.3).duration(100).end()
    .build()
);

engine.timeline.define(
  engine.timeline.create('recover')
    .tween(Scale, 'x', 0).from(0.8).to(1).ease('easeOutElastic').duration(300).end()
    .tween(Scale, 'y', 0).from(1.3).to(1).ease('easeOutElastic').duration(300).end()
    .build()
);

// Compose into jump animation
engine.timeline.define(
  engine.timeline.create('jump')
    .playTimeline('squash', 0)
    .playTimeline('stretch', 100)
    .tween(Position, 'y', 100)
      .fromCurrent()
      .by(-100)
      .ease('easeOutQuad')
      .duration(200)
      .end()
    .tween(Position, 'y', 300)
      .fromCurrent()
      .by(100)
      .ease('easeInQuad')
      .duration(200)
      .end()
    .playTimeline('recover', 500)
    .build()
);
```

### Standalone Tweens

For simple one-off animations, use the Tween component directly:

```typescript
import { Tween } from '@orion-ecs/timeline';

// Simple position tween
entity.addComponent(Tween, Position, 'x', {
  endValue: 100,
  duration: 500,
  easing: 'easeOutQuad'
});

// Relative delta tween
entity.addComponent(Tween, Opacity, 'value', {
  delta: -1,  // Reduce by 1
  duration: 300,
  easing: 'easeInQuad'
});

// Looping tween
entity.addComponent(Tween, Scale, 'x', {
  startValue: 1,
  endValue: 1.5,
  duration: 1000,
  easing: 'easeInOutSine',
  loop: true
});
```

### Speed Control

```typescript
// Slow motion playback
engine.timeline.playById(entity, 'attack', { speed: 0.5 });

// Fast forward
engine.timeline.playById(entity, 'walk', { speed: 2 });

// Modify speed during playback
const timeline = entity.getComponent(Timeline);
timeline.speed = 0.25;  // Quarter speed
```

## System Priority

The TimelineSystem runs at priority 50 by default. The TweenSystem runs at 49.

Recommended priority ranges:
- 100+: AI/Decision systems
- 50-100: Animation/Timeline systems
- 0-50: Rendering systems

## Performance Considerations

- **Action Evaluation**: Actions are evaluated each frame based on elapsed time
- **Nested Timelines**: Each nesting level adds overhead; prefer flat timelines for performance
- **Component Access**: Tween targets access components every frame
- **Duration Auto-Calculation**: Duration is computed from actions if not specified

## Troubleshooting

### Tween Not Animating

1. Verify the entity has the target component
2. Check that the property exists and is numeric
3. Ensure the Timeline component is added and playing
4. Verify the timeline ID matches a registered definition

### Unexpected Values

1. Check `from()` value - uses current value if not specified
2. Verify `to()` vs `by()` - absolute vs relative
3. Check easing function is correct
4. Verify duration is in milliseconds

### Timeline Not Completing

1. Check if timeline is paused
2. Verify duration calculation is correct
3. Check for infinite loops in nested timelines

## Integration with Other Plugins

### With State Machine Plugin

Trigger timelines on state transitions:

```typescript
engine.on('stateEnter:AttackState', ({ entity }) => {
  engine.timeline.play(entity, 'attackAnimation');
});

engine.on('stateExit:AttackState', ({ entity }) => {
  engine.timeline.stop(entity);
});
```

### With Decision Tree Plugin

Play animations based on intent components:

```typescript
engine.createSystem('AttackAnimationSystem', {
  all: [Attacking]
}, {
  act: (entity) => {
    if (!engine.timeline.isPlaying(entity)) {
      engine.timeline.play(entity, 'attackAnim');
    }
  }
});
```

### With Physics Plugin

Combine tweens with physics:

```typescript
// Timeline for visual effects, physics for movement
engine.timeline.define(
  engine.timeline.create('hitReaction')
    .tween(Tint, 'r', 0).from(1).to(0).duration(100).end()
    .tween(Tint, 'r', 100).from(0).to(1).duration(200).end()
    .build()
);

// Apply knockback through physics
engine.on('attackHit', ({ entity }) => {
  engine.timeline.play(entity, 'hitReaction');
  engine.physics.applyImpulse(entity.getComponent(RigidBody), 100, -50);
});
```
