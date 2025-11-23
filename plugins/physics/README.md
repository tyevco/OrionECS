# Physics Plugin

Rigid body physics simulation for Orion ECS, providing gravity, forces, impulses, and collision detection.

## Overview

The Physics Plugin provides 2D physics simulation features including:

- **Rigid Body Dynamics**: Mass, velocity, and acceleration-based movement
- **Gravity System**: Configurable global gravity
- **Force Application**: Apply forces and impulses to bodies
- **Collision Detection**: Basic circle-based collision detection
- **Time Scaling**: Slow-motion and fast-forward effects
- **Fixed Update**: Physics runs at consistent 60 FPS

## Installation

```typescript
import { EngineBuilder } from 'orion-ecs';
import { PhysicsPlugin } from '@orion-ecs/physics';

const engine = new EngineBuilder()
  .use(new PhysicsPlugin())
  .build();
```

## Quick Start

### Basic Physics Object

```typescript
import { EngineBuilder } from 'orion-ecs';
import { PhysicsPlugin, RigidBody, Collider, Position } from '@orion-ecs/physics';

// Create engine with plugin
const engine = new EngineBuilder()
  .use(new PhysicsPlugin())
  .build();

// Configure physics
engine.physics.setGravity(0, 980); // Gravity in pixels/s² (down)
engine.physics.setTimeScale(1.0);  // Normal speed

// Create a falling ball
const ball = engine.createEntity('Ball');
ball.addComponent(Position, 400, 100);      // Starting position
ball.addComponent(RigidBody, 1);             // Mass = 1kg
ball.addComponent(Collider, 25, false, 0);  // Radius = 25px

// Apply initial velocity
const rigidBody = ball.getComponent(RigidBody);
rigidBody.velocity.y = -200; // Launch upward

// Apply a force (e.g., wind)
engine.physics.applyForce(rigidBody, 50, 0); // Push right

// Start simulation
engine.start();
function gameLoop() {
  engine.update();
  requestAnimationFrame(gameLoop);
}
gameLoop();
```

## API Reference

### Components

#### Position

Defines entity position in 2D space.

```typescript
class Position {
  constructor(
    public x: number = 0,
    public y: number = 0
  )
}
```

**Example:**
```typescript
const position = entity.addComponent(Position, 400, 300);
console.log(`Entity at ${position.x}, ${position.y}`);
```

#### RigidBody

Adds physics properties to an entity.

```typescript
class RigidBody {
  constructor(
    public mass: number = 1,
    public velocity: { x: number; y: number } = { x: 0, y: 0 },
    public acceleration: { x: number; y: number } = { x: 0, y: 0 }
  )
}
```

**Validators:**
- Requires `Position` component
- Mass cannot be negative

**Example:**
```typescript
const rigidBody = entity.addComponent(RigidBody, 2.5); // 2.5kg mass
rigidBody.velocity.x = 100;  // 100 pixels/s right
rigidBody.velocity.y = -50;  // 50 pixels/s up
```

#### Collider

Defines collision bounds (circle-based).

```typescript
class Collider {
  constructor(
    public radius: number = 10,
    public isStatic: boolean = false,
    public layer: number = 0
  )
}
```

**Validators:**
- Requires `Position` component
- Radius must be positive

**Example:**
```typescript
// Dynamic collider (moves with physics)
entity.addComponent(Collider, 25, false, 0);

// Static collider (doesn't move, for walls/ground)
wall.addComponent(Collider, 50, true, 0);
```

### Extension Methods

The plugin extends the engine with `physics` API:

#### setGravity(x: number, y: number): void

Sets the global gravity force applied to all rigid bodies.

```typescript
// Earth-like gravity (downward)
engine.physics.setGravity(0, 980);

// Moon-like gravity
engine.physics.setGravity(0, 162);

// Zero gravity (space)
engine.physics.setGravity(0, 0);

// Horizontal gravity (sideways platformer)
engine.physics.setGravity(500, 0);
```

#### getGravity(): { x: number; y: number }

Gets the current gravity settings.

```typescript
const gravity = engine.physics.getGravity();
console.log(`Gravity: ${gravity.x}, ${gravity.y}`);
```

#### setTimeScale(scale: number): void

Sets physics time scale for slow-motion or fast-forward effects.

```typescript
// Normal speed
engine.physics.setTimeScale(1.0);

// Slow motion (50% speed)
engine.physics.setTimeScale(0.5);

// Fast forward (2x speed)
engine.physics.setTimeScale(2.0);

// Freeze physics
engine.physics.setTimeScale(0.0);
```

#### getTimeScale(): number

Gets the current time scale.

```typescript
const timeScale = engine.physics.getTimeScale();
console.log(`Physics running at ${timeScale * 100}% speed`);
```

#### applyForce(rigidBody: RigidBody, forceX: number, forceY: number): void

Applies a continuous force to a rigid body (F = ma).

```typescript
const rigidBody = entity.getComponent(RigidBody);

// Apply wind force
engine.physics.applyForce(rigidBody, 100, 0);

// Apply thrust (over multiple frames)
if (thrustActive) {
  engine.physics.applyForce(rigidBody, 0, -500);
}
```

**Note:** Forces are applied every frame and affect acceleration.

#### applyImpulse(rigidBody: RigidBody, impulseX: number, impulseY: number): void

Applies an instant impulse to a rigid body (changes velocity immediately).

```typescript
const rigidBody = entity.getComponent(RigidBody);

// Jump
engine.physics.applyImpulse(rigidBody, 0, -400);

// Explosion knockback
engine.physics.applyImpulse(rigidBody, 200, -100);

// Bounce
engine.physics.applyImpulse(rigidBody, 0, -rigidBody.velocity.y * 1.5);
```

**Note:** Impulses are one-time velocity changes.

## Examples

### Platformer Character

```typescript
// Create player
const player = engine.createEntity('Player');
player.addComponent(Position, 100, 400);
player.addComponent(RigidBody, 1);
player.addComponent(Collider, 20);

// Movement system
engine.createSystem('PlayerControlSystem', {
  all: [Position, RigidBody]
}, {
  priority: 110,
  act: (entity) => {
    const rigidBody = entity.getComponent(RigidBody);

    // Horizontal movement (apply force)
    if (input.isKeyDown('ArrowLeft')) {
      engine.physics.applyForce(rigidBody, -500, 0);
    }
    if (input.isKeyDown('ArrowRight')) {
      engine.physics.applyForce(rigidBody, 500, 0);
    }

    // Jump (apply impulse)
    if (input.wasKeyPressed('Space') && isOnGround(entity)) {
      engine.physics.applyImpulse(rigidBody, 0, -600);
    }

    // Air resistance
    rigidBody.velocity.x *= 0.95;
  }
}, true);

function isOnGround(entity) {
  const position = entity.getComponent(Position);
  return position.y >= 550; // Simplified ground check
}
```

### Bouncing Balls

```typescript
// Create multiple bouncing balls
for (let i = 0; i < 10; i++) {
  const ball = engine.createEntity(`Ball${i}`);
  ball.addComponent(Position, Math.random() * 800, 100);
  ball.addComponent(RigidBody, 0.5 + Math.random());
  ball.addComponent(Collider, 15);

  // Random initial velocity
  const rigidBody = ball.getComponent(RigidBody);
  rigidBody.velocity.x = (Math.random() - 0.5) * 400;
  rigidBody.velocity.y = Math.random() * -200;
}

// Bounce off ground
engine.createSystem('GroundBounceSystem', {
  all: [Position, RigidBody]
}, {
  priority: 80,
  act: (entity) => {
    const position = entity.getComponent(Position);
    const rigidBody = entity.getComponent(RigidBody);

    if (position.y >= 570) {
      position.y = 570;
      rigidBody.velocity.y = -Math.abs(rigidBody.velocity.y) * 0.8; // Bounce with damping
    }
  }
}, true);
```

### Projectile Physics

```typescript
function fireProjectile(fromX, fromY, angle, speed) {
  const projectile = engine.createEntity('Projectile');
  projectile.addComponent(Position, fromX, fromY);
  projectile.addComponent(RigidBody, 0.1);
  projectile.addComponent(Collider, 5);

  // Calculate velocity from angle and speed
  const rigidBody = projectile.getComponent(RigidBody);
  rigidBody.velocity.x = Math.cos(angle) * speed;
  rigidBody.velocity.y = Math.sin(angle) * speed;

  // Projectile lifespan
  setTimeout(() => {
    projectile.queueFree();
  }, 5000);
}

// Fire projectile at 45 degrees
fireProjectile(100, 500, -Math.PI / 4, 600);
```

### Static Platforms

```typescript
// Create static platform (doesn't move)
const platform = engine.createEntity('Platform');
platform.addComponent(Position, 400, 450);
platform.addComponent(Collider, 200, true, 0); // isStatic = true

// Platform collision system
engine.createSystem('PlatformCollisionSystem', {
  all: [Position, RigidBody, Collider]
}, {
  priority: 85,
  act: (entity) => {
    const position = entity.getComponent(Position);
    const rigidBody = entity.getComponent(RigidBody);
    const collider = entity.getComponent(Collider);

    // Get all platforms
    const platforms = engine.queryEntities({
      all: [Position, Collider]
    }).filter(p => {
      const col = p.getComponent(Collider);
      return col.isStatic;
    });

    // Check collision with each platform
    platforms.forEach(platform => {
      const platformPos = platform.getComponent(Position);
      const platformCol = platform.getComponent(Collider);

      const dx = position.x - platformPos.x;
      const dy = position.y - platformPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = collider.radius + platformCol.radius;

      if (distance < minDistance) {
        // Collision! Push entity out and stop downward movement
        const overlap = minDistance - distance;
        const angle = Math.atan2(dy, dx);
        position.x += Math.cos(angle) * overlap;
        position.y += Math.sin(angle) * overlap;

        // Stop downward velocity if landing on top
        if (dy > 0 && rigidBody.velocity.y > 0) {
          rigidBody.velocity.y = 0;
        }
      }
    });
  }
}, true);
```

### Orbital Mechanics

```typescript
// Sun (massive static body)
const sun = engine.createEntity('Sun');
sun.addComponent(Position, 400, 300);

// Planet (orbiting)
const planet = engine.createEntity('Planet');
planet.addComponent(Position, 600, 300);
planet.addComponent(RigidBody, 1);

// Orbital velocity
const planetBody = planet.getComponent(RigidBody);
planetBody.velocity.y = 150;

// Gravity system
engine.createSystem('OrbitalGravitySystem', {
  all: [Position, RigidBody]
}, {
  priority: 105,
  act: (entity) => {
    if (entity === sun) return;

    const position = entity.getComponent(Position);
    const rigidBody = entity.getComponent(RigidBody);
    const sunPos = sun.getComponent(Position);

    // Calculate gravitational force
    const dx = sunPos.x - position.x;
    const dy = sunPos.y - position.y;
    const distanceSquared = dx * dx + dy * dy;
    const distance = Math.sqrt(distanceSquared);

    const G = 50000; // Gravitational constant
    const forceMagnitude = G / distanceSquared;

    const forceX = (dx / distance) * forceMagnitude;
    const forceY = (dy / distance) * forceMagnitude;

    engine.physics.applyForce(rigidBody, forceX, forceY);
  }
}, true);
```

## Performance Considerations

### Fixed Update

Physics runs at fixed 60 FPS for stability:

```typescript
// Physics always runs at same rate, independent of frame rate
// No configuration needed - handled automatically
```

### Collision Optimization

Current implementation uses simple O(n²) collision detection:

```typescript
// For better performance with many objects, use SpatialPartitionPlugin
import { SpatialPartitionPlugin } from '@orion-ecs/spatial-partition';

const engine = new EngineBuilder()
  .use(new PhysicsPlugin())
  .use(new SpatialPartitionPlugin())
  .build();
```

### Mass Optimization

Use mass = 0 for infinite mass (immovable objects):

```typescript
// Infinite mass object (won't be affected by forces)
wall.addComponent(RigidBody, 0); // Special case: infinite mass
```

Or use static colliders:

```typescript
// Better: Use static colliders for immovable objects
wall.addComponent(Collider, 50, true, 0);
```

### Best Practices

1. **Use Appropriate Mass**: Typical range 0.1 - 10
2. **Limit Active Bodies**: Remove off-screen entities
3. **Static Colliders**: Use for walls, platforms, obstacles
4. **Spatial Partitioning**: Use for > 100 dynamic objects
5. **Fixed Update**: Physics runs independently of frame rate

## Integration with Other Plugins

### With Canvas2DRendererPlugin

Use Transform instead of Position for rendering:

```typescript
import { Canvas2DRendererPlugin, Transform } from '@orion-ecs/canvas2d-renderer';
import { PhysicsPlugin, Position, RigidBody } from '@orion-ecs/physics';

const engine = new EngineBuilder()
  .use(new Canvas2DRendererPlugin())
  .use(new PhysicsPlugin())
  .build();

// Sync physics position to rendering transform
engine.createSystem('PhysicsSyncSystem', {
  all: [Position, Transform]
}, {
  priority: 95,
  act: (entity) => {
    const position = entity.getComponent(Position);
    const transform = entity.getComponent(Transform);
    transform.x = position.x;
    transform.y = position.y;
  }
}, true);
```

### With SpatialPartitionPlugin

Optimize collision detection for many objects:

```typescript
import { SpatialPartitionPlugin, SpatialPosition } from '@orion-ecs/spatial-partition';

const engine = new EngineBuilder()
  .use(new PhysicsPlugin())
  .use(new SpatialPartitionPlugin())
  .build();

// Use spatial queries for collision detection
engine.createSystem('SpatialCollisionSystem', {
  all: [Position, Collider]
}, {
  priority: 85,
  act: (entity) => {
    const position = entity.getComponent(Position);
    const collider = entity.getComponent(Collider);

    // Query nearby entities only
    const nearby = engine.spatial.queryRadius(
      position,
      collider.radius * 2
    );

    // Check collision with nearby entities only
    nearby.forEach(other => {
      if (other === entity) return;
      checkCollision(entity, other);
    });
  }
}, true);
```

## System Priority

The plugin creates two systems:

- **PhysicsMovementSystem** (priority: 100): Updates velocity and position
- **CollisionDetectionSystem** (priority: 90): Detects collisions (basic)

Create custom physics systems with priorities between 90-100 for collision response.

## Troubleshooting

### Objects Not Moving

1. Check that Position and RigidBody are both added
2. Verify mass > 0 (mass = 0 means infinite mass)
3. Check time scale is not 0
4. Ensure engine.update() is being called

### Unexpected Movement

1. Check gravity settings
2. Verify forces are being applied correctly
3. Check for conflicting systems modifying position
4. Review time scale value

### Collisions Not Detecting

1. Ensure both entities have Collider components
2. Check collider radius values
3. Verify entities are close enough
4. Implement collision response system (not automatic)

### Performance Issues

1. Limit number of active physics bodies
2. Use static colliders where possible
3. Integrate SpatialPartitionPlugin for many objects
4. Consider reducing physics update rate

### Jittery Movement

1. Physics uses fixed update (60 FPS) - this is correct
2. Interpolate visuals if needed
3. Don't mix variable and fixed update for physics

## Advanced Topics

### Custom Forces

```typescript
// Implement custom force field
engine.createSystem('ForceFieldSystem', {
  all: [Position, RigidBody]
}, {
  priority: 105,
  act: (entity) => {
    const position = entity.getComponent(Position);
    const rigidBody = entity.getComponent(RigidBody);

    // Radial force field at (400, 300)
    const centerX = 400;
    const centerY = 300;
    const dx = position.x - centerX;
    const dy = position.y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 200) {
      const strength = (200 - distance) * 2;
      engine.physics.applyForce(rigidBody, -dx * strength, -dy * strength);
    }
  }
}, true);
```

### Damping

```typescript
// Air resistance
rigidBody.velocity.x *= 0.98;
rigidBody.velocity.y *= 0.98;

// Water resistance
if (inWater(entity)) {
  rigidBody.velocity.x *= 0.85;
  rigidBody.velocity.y *= 0.85;
}
```

### Velocity Limits

```typescript
// Terminal velocity
const maxSpeed = 500;
const speed = Math.sqrt(
  rigidBody.velocity.x ** 2 + rigidBody.velocity.y ** 2
);
if (speed > maxSpeed) {
  const scale = maxSpeed / speed;
  rigidBody.velocity.x *= scale;
  rigidBody.velocity.y *= scale;
}
```
