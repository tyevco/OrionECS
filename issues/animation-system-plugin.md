# Animation System Plugin

**Milestone:** v0.4.0 - Component Composition & Plugins
**Priority:** Medium
**Labels:** plugin, enhancement, animation, game-dev
**Impact:** Game Development, Visual Polish

## Description

Create a comprehensive animation system plugin for OrionECS to handle sprite animations, property tweening, timeline-based animations, and animation state management. While the Canvas2D renderer handles rendering, we need a higher-level animation system.

## Goals

- Provide easy sprite sheet animation system
- Support property tweening and interpolation
- Enable timeline-based complex animations
- Support animation blending and transitions
- Integrate with state machine for animation states
- Include easing functions and animation curves

## Use Cases

- **Sprite Animation:** Character walk cycles, attack animations
- **Property Tweening:** Smooth position changes, color fades, scale effects
- **UI Animation:** Menu transitions, button effects, notifications
- **Particle Effects:** Animated particle systems
- **Camera Effects:** Screen shake, zoom, pan animations
- **Timeline Sequences:** Cutscenes, scripted events

## Subtasks

### 1. Design Animation System Architecture
- [ ] Research animation patterns in game engines
- [ ] Define animation types (Sprite, Tween, Timeline)
- [ ] Design animation component structure
- [ ] Plan animation state management
- [ ] Design easing function system

### 2. Implement Sprite Animation System
- [ ] Create `SpriteAnimation` component
- [ ] Support sprite sheet configuration
- [ ] Implement frame-based animation
- [ ] Add animation speed control
- [ ] Support animation looping modes (loop, once, ping-pong)
- [ ] Add animation events (on complete, on loop, on frame)

### 3. Implement Property Tweening System
- [ ] Create `Tween` component for property animation
- [ ] Support multiple property types (number, vector, color)
- [ ] Implement tween duration and timing
- [ ] Add easing function support
- [ ] Support tween chaining and sequencing
- [ ] Add tween callbacks (on start, on update, on complete)

### 4. Implement Easing Functions
- [ ] Linear easing
- [ ] Quadratic (In, Out, InOut)
- [ ] Cubic (In, Out, InOut)
- [ ] Quartic (In, Out, InOut)
- [ ] Quintic (In, Out, InOut)
- [ ] Sinusoidal (In, Out, InOut)
- [ ] Exponential (In, Out, InOut)
- [ ] Circular (In, Out, InOut)
- [ ] Elastic (In, Out, InOut)
- [ ] Back (In, Out, InOut)
- [ ] Bounce (In, Out, InOut)
- [ ] Custom curve support

### 5. Implement Timeline System
- [ ] Create `Timeline` component for complex animations
- [ ] Support multiple tracks per timeline
- [ ] Add keyframe-based animation
- [ ] Implement timeline playback control (play, pause, stop, seek)
- [ ] Support timeline looping and reverse
- [ ] Add timeline events and markers

### 6. Implement Animation Blending
- [ ] Support blending between sprite animations
- [ ] Add blend weights and transitions
- [ ] Implement animation crossfade
- [ ] Support additive animation blending
- [ ] Add blend tree structures

### 7. Create Animation State Machine Integration
- [ ] Integrate with State Machine plugin (if available)
- [ ] Create animation state transitions
- [ ] Support conditional animation states
- [ ] Add animation state blending
- [ ] Enable state-driven animation selection

### 8. Implement Animation System
- [ ] Create system to update all animations
- [ ] Handle sprite animation frame updates
- [ ] Process active tweens each frame
- [ ] Update timeline playback
- [ ] Emit animation events
- [ ] Support animation priorities

### 9. Add Animation Builder API
- [ ] Fluent API for creating animations
- [ ] Tween builder with chaining
- [ ] Timeline builder with tracks
- [ ] Animation preset library
- [ ] Support animation templates

### 10. Implement Common Animation Presets
- [ ] Fade in/out
- [ ] Slide in/out (up, down, left, right)
- [ ] Scale pulse
- [ ] Rotation spin
- [ ] Shake (position, rotation)
- [ ] Color flash
- [ ] Bounce
- [ ] Wobble

### 11. Create Debugging Tools
- [ ] Animation inspector UI
- [ ] Timeline visualization
- [ ] Tween curve preview
- [ ] Animation playback controls
- [ ] Performance profiling for animations

### 12. Create Plugin Integration
- [ ] Implement `AnimationPlugin` class
- [ ] Add plugin API extensions
- [ ] Integrate with Canvas2D renderer
- [ ] Add convenience methods to Engine
- [ ] Support plugin configuration

### 13. Documentation and Examples
- [ ] Write plugin README
- [ ] Create API documentation
- [ ] Add sprite animation example
- [ ] Add tweening example
- [ ] Add timeline cutscene example
- [ ] Add UI animation example
- [ ] Include easing function reference
- [ ] Add performance best practices

### 14. Testing
- [ ] Unit tests for sprite animation
- [ ] Unit tests for tweening system
- [ ] Unit tests for easing functions
- [ ] Unit tests for timeline system
- [ ] Integration tests with renderer
- [ ] Animation performance benchmarks
- [ ] Example validation tests

## Success Criteria

- [ ] Sprite animations are easy to set up and control
- [ ] Tweening system is intuitive and powerful
- [ ] Timeline system supports complex sequences
- [ ] Easing functions work correctly
- [ ] Animation blending is smooth
- [ ] Good performance with many animations
- [ ] Integrates well with Canvas2D renderer
- [ ] Comprehensive documentation and examples

## Implementation Notes

**Example API - Sprite Animation:**
```typescript
import { AnimationPlugin, SpriteAnimation } from 'orion-ecs/plugins/animation';

const engine = new EngineBuilder()
  .use(new AnimationPlugin())
  .build();

// Create sprite animation
const player = engine.createEntity('Player');

const walkAnimation = player.addComponent(SpriteAnimation, {
  spriteSheet: 'player-walk.png',
  frameWidth: 32,
  frameHeight: 32,
  frames: [0, 1, 2, 3, 4, 5],
  frameRate: 10, // 10 FPS
  loop: true
});

walkAnimation.play();

// Animation events
walkAnimation.on('complete', () => {
  console.log('Animation finished');
});

walkAnimation.on('frame', (frameIndex) => {
  if (frameIndex === 3) {
    // Play footstep sound
  }
});
```

**Example API - Tweening:**
```typescript
import { Tween, Easing } from 'orion-ecs/plugins/animation';

const entity = engine.createEntity();
const position = entity.addComponent(Position, 0, 0);

// Tween position to (100, 100) over 2 seconds
engine.animation.tween(position)
  .to({ x: 100, y: 100 }, 2000)
  .easing(Easing.Quadratic.InOut)
  .onComplete(() => console.log('Reached destination'))
  .start();

// Chained tweens
engine.animation.tween(position)
  .to({ x: 100, y: 0 }, 1000)
  .then()
  .to({ x: 100, y: 100 }, 1000)
  .then()
  .to({ x: 0, y: 100 }, 1000)
  .then()
  .to({ x: 0, y: 0 }, 1000)
  .loop()
  .start();

// Presets
engine.animation.fadeIn(entity, 1000);
engine.animation.fadeOut(entity, 1000);
engine.animation.shake(entity, { intensity: 5, duration: 500 });
```

**Example API - Timeline:**
```typescript
import { Timeline } from 'orion-ecs/plugins/animation';

const cutscene = engine.animation.createTimeline('Cutscene')
  .addTrack('camera', camera)
    .at(0, { x: 0, y: 0, zoom: 1 })
    .at(2000, { x: 100, y: 0, zoom: 1.5 })
    .at(4000, { x: 100, y: 100, zoom: 2 })
  .endTrack()
  .addTrack('player', player)
    .at(1000, { x: 50, y: 50 })
    .at(3000, { x: 100, y: 100 })
  .endTrack()
  .addEvent(2000, () => {
    console.log('Halfway through cutscene');
  })
  .onComplete(() => {
    console.log('Cutscene finished');
  });

cutscene.play();
```

**Integration with State Machine:**
```typescript
// Animation states
const idleState = new State('Idle')
  .onEnter((entity) => {
    entity.getComponent(SpriteAnimation).play('idle');
  });

const walkState = new State('Walk')
  .onEnter((entity) => {
    entity.getComponent(SpriteAnimation).crossfade('walk', 0.2);
  });

const attackState = new State('Attack')
  .onEnter((entity) => {
    entity.getComponent(SpriteAnimation).play('attack', { loop: false });
  });
```

## Related Issues

- State Machine Plugin (new issue)
- #77 - Multiplayer Networking Example (animations need to sync)
- Canvas2D Renderer Plugin (already implemented)

## References

- [Tween.js](https://github.com/tweenjs/tween.js/) - JavaScript tweening library
- [GreenSock GSAP](https://greensock.com/gsap/) - Professional animation library
- [Unity Animation System](https://docs.unity3d.com/Manual/AnimationSection.html)
- [Godot Animation](https://docs.godotengine.org/en/stable/tutorials/animation/index.html)
- [Easing Functions Cheat Sheet](https://easings.net/)
