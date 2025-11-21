# Game Examples

This directory contains complete game examples demonstrating various OrionECS features and patterns.

## Overview

These examples showcase real-world usage of OrionECS in game development scenarios. Each example is a fully functional game implementation (minus rendering) that demonstrates best practices and common patterns.

## Examples

### 1. Asteroids (`asteroids.ts`)

A complete implementation of the classic Asteroids game.

**Demonstrates:**
- **Entity Lifecycle**: Creating, destroying, and pooling entities
- **Component Design**: Data-only components for position, velocity, collision
- **System Organization**: Input, movement, collision, and rendering systems
- **Prefab System**: Template-based entity creation for players, asteroids, and bullets
- **Component Pooling**: Performance optimization for frequently created bullets
- **Fixed Updates**: Physics and game logic at 60 FPS
- **Inter-System Communication**: Message bus for events (shooting, collisions, game over)
- **Tag System**: Managing entity categories (player, asteroid, bullet, alive)
- **Collision Detection**: Circle-based collision with response
- **Game Mechanics**: Lives, score, asteroid splitting, player respawn

**Key Features:**
- Player ship with thrust and rotation controls
- Asteroid spawning and splitting mechanics
- Bullet system with lifetime management
- Collision detection and response
- Score tracking and lives system
- Screen wrapping for entities

**Code Structure:**
```typescript
// Components define data
class Position { x, y }
class Velocity { dx, dy }
class Collider { radius }

// Systems define behavior
MovementSystem: Updates positions from velocities
CollisionSystem: Detects and handles collisions
PlayerControlSystem: Applies input to player movement

// Prefabs for entity templates
engine.registerPrefab('Player', { components: [...], tags: ['player'] })
engine.registerPrefab('Asteroid', { components: [...], tags: ['asteroid'] })
```

**Running the Example:**
```typescript
import { initGame, gameLoop } from './examples/games/asteroids';

// Initialize
initGame();

// Browser game loop
function browserLoop() {
  gameLoop();
  requestAnimationFrame(browserLoop);
}
browserLoop();

// Node.js game loop (for testing)
setInterval(gameLoop, 16); // ~60fps
```

**Extending the Example:**
- Add a canvas renderer to visualize the game
- Implement keyboard controls for actual player input
- Add sound effects using Web Audio API
- Implement particle effects for explosions
- Add power-ups (shields, multi-shot, etc.)
- Create multiple difficulty levels
- Add UFOs as additional enemies
- Implement a high score system with persistence

---

### 2. Platformer (`platformer.ts`)

**Coming Soon**

A 2D platformer game demonstrating physics, collision detection, and level loading.

**Will Demonstrate:**
- Gravity and jumping physics
- Platform collision detection
- Entity hierarchies for complex objects
- Level loading from data
- State machines for character behavior
- Tile-based world representation

---

### 3. RTS Demo (`rts-demo.ts`)

**Coming Soon**

A real-time strategy game demo showing performance with large entity counts.

**Will Demonstrate:**
- Spatial partitioning for performance
- Selection system
- Command pattern for unit orders
- Pathfinding basics
- Handling hundreds of entities efficiently

---

### 4. Multiplayer Demo (`multiplayer-demo.ts`)

**Coming Soon**

A basic multiplayer game demonstrating network synchronization.

**Will Demonstrate:**
- Client-side prediction
- Server reconciliation
- Entity replication
- Network messaging
- Lag compensation

---

## Common Patterns

All examples follow these patterns:

### 1. Entity Creation
```typescript
// From prefab
const entity = engine.createFromPrefab('Player', 'Player1');

// Manual
const entity = engine.createEntity('MyEntity');
entity.addComponent(Position, 0, 0);
entity.addComponent(Velocity, 1, 1);
entity.addTag('player');
```

### 2. System Organization
```typescript
// Systems execute by priority (higher = first)
InputSystem     (priority: 1000)  // Handle input
LogicSystem     (priority: 500)   // Game logic
PhysicsSystem   (priority: 400)   // Physics
CollisionSystem (priority: 300)   // Collisions
RenderSystem    (priority: -100)  // Rendering (last)
```

### 3. Component Pooling
```typescript
// Pool frequently created components
engine.registerComponentPool(Bullet, {
  initialSize: 20,
  maxSize: 100
});
```

### 4. Fixed vs Variable Updates
```typescript
// Fixed update (physics, game logic)
engine.createSystem('PhysicsSystem', query, options, true);

// Variable update (rendering, input)
engine.createSystem('RenderSystem', query, options, false);
```

### 5. Message Bus Communication
```typescript
// Publish event
engine.messageBus.publish('player-shoot', { position }, 'PlayerSystem');

// Subscribe to event
engine.messageBus.subscribe('player-shoot', (message) => {
  playSound('shoot.mp3');
});
```

### 6. Queries and Tags
```typescript
// Complex query
engine.createSystem('System', {
  all: [Position, Velocity],    // Must have both
  none: [Frozen],               // Must not have
  tags: ['active'],             // Must have tag
  withoutTags: ['disabled']     // Must not have tag
}, options);
```

## Integration with Rendering

These examples are designed to be renderer-agnostic. To add rendering:

### Canvas 2D
```typescript
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

engine.createSystem('RenderSystem',
  { all: [Position, Renderable] },
  {
    before: () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    act: (entity, position, renderable) => {
      ctx.fillStyle = renderable.color;
      ctx.fillRect(position.x, position.y, 10, 10);
    }
  }
);
```

### Pixi.js
See `examples/integrations/pixi-example.ts` for full integration.

### Three.js
See `examples/integrations/threejs-example.ts` for full integration.

## Performance Tips

1. **Use Component Pooling**: Pool frequently created/destroyed components
   ```typescript
   engine.registerComponentPool(Particle, { initialSize: 100 });
   ```

2. **Optimize Queries**: More specific queries = better performance
   ```typescript
   // Good: Specific query
   { all: [Position, Velocity], tags: ['active'] }

   // Avoid: Too broad
   { any: [Position] } // Matches almost everything
   ```

3. **Fixed Updates for Physics**: Use fixed timestep for deterministic physics
   ```typescript
   engine.createSystem('PhysicsSystem', query, options, true); // Fixed
   ```

4. **Batch Operations**: Use transactions for bulk changes (when available)
   ```typescript
   engine.beginTransaction();
   // Create many entities
   engine.commitTransaction(); // Single query update
   ```

5. **Disable Debug Mode in Production**:
   ```typescript
   const engine = new EngineBuilder()
     .withDebugMode(false) // Disable for performance
     .build();
   ```

## Testing Games

Examples include patterns for testing game logic:

```typescript
// Test entity creation
const player = engine.createFromPrefab('Player');
expect(player.hasComponent(Position)).toBe(true);

// Test system behavior
const system = engine.getSystem('MovementSystem');
engine.update(16); // Single frame
const position = player.getComponent(Position);
expect(position.x).toBe(expectedX);

// Test collisions
const bullet = engine.createFromPrefab('Bullet');
const asteroid = engine.createFromPrefab('Asteroid');
// Position for collision
engine.update(16);
expect(bullet.isMarkedForDeletion).toBe(true);
```

## Next Steps

After reviewing these examples:

1. **Study the Code**: Read through the examples to understand patterns
2. **Experiment**: Modify examples to test different approaches
3. **Build Your Game**: Use examples as templates for your own games
4. **Check Cookbook**: See `docs/COOKBOOK.md` for more patterns
5. **Review Integrations**: Check `examples/integrations/` for renderer integration

## Resources

- [Main README](../../README.md) - Framework overview
- [API Documentation](../../README.md#api-reference) - Detailed API reference
- [Cookbook](../../docs/COOKBOOK.md) - Common patterns and best practices
- [Integration Examples](../integrations/) - Renderer and framework integrations

## Contributing

Have a game example to contribute? We'd love to see it!

1. Ensure it demonstrates unique features or patterns
2. Follow the existing code style and documentation format
3. Include comprehensive comments
4. Add it to this README
5. Submit a pull request

---

**Happy coding! 🎮**
