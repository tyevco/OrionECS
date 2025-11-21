# Integration Examples

This directory contains examples of integrating OrionECS with popular libraries and frameworks.

## Overview

OrionECS is designed to be renderer and framework agnostic. These examples show how to integrate it with various tools for rendering, UI, networking, and more.

## Examples

### 1. Pixi.js Integration (`pixi-example.ts`)

Demonstrates 2D rendering with [Pixi.js](https://pixijs.com/), a fast 2D WebGL renderer.

**What it Shows:**
- Synchronizing ECS entities with Pixi display objects
- Component lifecycle hooks for sprite management
- Automatic cleanup when entities are destroyed
- Sprite, Graphics, and Container management
- Position, rotation, scale, opacity synchronization
- Efficient rendering pipeline

**Key Patterns:**
```typescript
// Component for Pixi sprite
class PixiSprite {
  sprite: PIXI.Sprite;
  // Lifecycle hooks
  onCreate(entity) { /* Create sprite */ }
  onDestroy(entity) { /* Cleanup sprite */ }
}

// Sync system updates Pixi from ECS
engine.createSystem('PixiSyncSystem',
  { all: [PixiSprite, Position] },
  {
    act: (entity, pixiSprite, position) => {
      pixiSprite.sprite.x = position.x;
      pixiSprite.sprite.y = position.y;
    }
  }
);
```

**Installation:**
```bash
npm install pixi.js
```

**Usage:**
```typescript
import { init, gameLoop } from './examples/integrations/pixi-example';

await init();

function loop() {
  gameLoop();
  requestAnimationFrame(loop);
}
loop();
```

**Advanced Features:**
- Sprite pooling for performance
- Texture atlas support
- Particle systems with ParticleContainer
- Camera system
- Render layers and z-indexing
- Frustum culling

---

### 2. Three.js Integration (`threejs-example.ts`)

**Coming Soon**

Demonstrates 3D rendering with [Three.js](https://threejs.org/).

**Will Show:**
- 3D transform components (position, rotation, scale)
- Camera management
- Mesh and material synchronization
- Lighting systems
- Scene graph integration

**Example Pattern:**
```typescript
class ThreeMesh {
  mesh: THREE.Mesh;
}

class Transform3D {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

engine.createSystem('ThreeSyncSystem',
  { all: [ThreeMesh, Transform3D] },
  {
    act: (entity, threeMesh, transform) => {
      threeMesh.mesh.position.copy(transform.position);
      threeMesh.mesh.rotation.copy(transform.rotation);
      threeMesh.mesh.scale.copy(transform.scale);
    }
  }
);
```

---

### 3. React Integration (`react-example.tsx`)

**Coming Soon**

Demonstrates using OrionECS with [React](https://react.dev/) for UI.

**Will Show:**
- Custom hooks for entity queries
- React components that observe ECS state
- Event handlers that create/modify entities
- Performance optimization with React.memo
- Server-side rendering considerations

**Example Pattern:**
```typescript
// Custom hook for querying entities
function useEntities(query: QueryOptions) {
  const [entities, setEntities] = useState([]);

  useEffect(() => {
    const q = engine.createQuery(query);
    const update = () => setEntities(q.getEntities());

    update();
    const unsubscribe = engine.on('entityChanged', update);
    return unsubscribe;
  }, []);

  return entities;
}

// React component
function PlayerUI() {
  const players = useEntities({ tags: ['player'] });

  return (
    <div>
      {players.map(player => {
        const health = player.getComponent(Health);
        return <div key={player.id}>{health.current} HP</div>;
      })}
    </div>
  );
}
```

---

### 4. Node.js Server (`nodejs-server.ts`)

**Coming Soon**

Demonstrates headless server-side ECS for multiplayer games.

**Will Show:**
- Running ECS without rendering
- Authoritative server architecture
- Network synchronization
- Client validation
- Tick-based updates

**Example Pattern:**
```typescript
// Headless server setup
const server = new EngineBuilder()
  .withDebugMode(false)
  .withFixedUpdateFPS(20) // Server tick rate
  .build();

// Network sync system
server.createSystem('NetworkSyncSystem',
  { all: [Position, NetworkedEntity] },
  {
    act: (entity, position, networked) => {
      // Send state to clients
      broadcastToClients({
        id: entity.id,
        position: { x: position.x, y: position.y }
      });
    }
  }
);

// Start server loop
setInterval(() => server.update(), 50); // 20 FPS
```

---

## Common Integration Patterns

### Pattern 1: Component Lifecycle Hooks

Use component lifecycle methods to manage external resources:

```typescript
class AudioSource {
  sound: Sound;

  onCreate(entity: Entity) {
    this.sound = loadSound(this.url);
  }

  onDestroy(entity: Entity) {
    this.sound.dispose();
  }
}
```

### Pattern 2: Sync Systems

Create systems that sync ECS state with external libraries:

```typescript
// ECS -> External Library
engine.createSystem('SyncSystem',
  { all: [ECSComponent, ExternalComponent] },
  {
    priority: -100, // Run late
    act: (entity, ecsComp, extComp) => {
      extComp.externalObject.value = ecsComp.value;
    }
  }
);
```

### Pattern 3: Wrapper Components

Wrap external library objects in ECS components:

```typescript
class PixiSpriteWrapper {
  constructor(public sprite: PIXI.Sprite) {}

  // ECS methods
  setPosition(x: number, y: number) {
    this.sprite.position.set(x, y);
  }
}
```

### Pattern 4: Manager Classes

Use manager classes to handle library-specific setup:

```typescript
class RenderManager {
  private renderer: Renderer;

  initialize() {
    this.renderer = createRenderer();
  }

  render(entities: Entity[]) {
    this.renderer.clear();
    for (const entity of entities) {
      this.renderEntity(entity);
    }
    this.renderer.present();
  }
}

const renderManager = new RenderManager();
renderManager.initialize();

engine.createSystem('RenderSystem', query, {
  after: () => {
    renderManager.render(entities);
  }
});
```

### Pattern 5: Plugin Architecture

Create plugins for library integrations:

```typescript
class PixiPlugin implements EnginePlugin {
  name = 'PixiPlugin';

  install(context: PluginContext) {
    // Register components
    context.registerComponent(PixiSprite);

    // Create systems
    context.createSystem('PixiSync', query, options);

    // Extend engine
    context.extend('pixi', {
      getApp: () => this.app,
      getStage: () => this.stage
    });
  }
}

const engine = new EngineBuilder()
  .use(new PixiPlugin())
  .build();

// Access plugin API
engine.pixi.getStage();
```

## Performance Considerations

### 1. Update Frequency

Different systems may need different update rates:

```typescript
// Physics at 60 FPS (fixed)
engine.createSystem('Physics', query, options, true);

// Rendering at display refresh rate (variable)
engine.createSystem('Render', query, options, false);

// Network at 20 FPS (custom)
setInterval(() => networkSystem.update(), 50);
```

### 2. Batch Operations

Batch external library operations for efficiency:

```typescript
engine.createSystem('BatchRenderSystem',
  { all: [Sprite, Position] },
  {
    before: () => renderer.beginBatch(),
    act: (entity, sprite, pos) => {
      renderer.addToBatch(sprite, pos);
    },
    after: () => renderer.endBatch()
  }
);
```

### 3. Object Pooling

Pool both ECS components and external objects:

```typescript
// Pool ECS components
engine.registerComponentPool(Particle, { initialSize: 100 });

// Pool external objects
class SpritePool {
  acquire() { /* ... */ }
  release(sprite) { /* ... */ }
}
```

### 4. Culling and LOD

Skip rendering for off-screen or distant entities:

```typescript
engine.createSystem('CullingSystem',
  { all: [Position, Visible] },
  {
    act: (entity, position, visible) => {
      visible.value = isOnScreen(position);
    }
  }
);

engine.createSystem('RenderSystem',
  { all: [Sprite, Visible] },
  {
    act: (entity, sprite, visible) => {
      if (visible.value) {
        renderer.draw(sprite);
      }
    }
  }
);
```

## Testing Integrations

### Unit Testing

Test ECS logic independently of rendering:

```typescript
// Test game logic without rendering
test('player takes damage', () => {
  const player = engine.createEntity('Player');
  player.addComponent(Health, 100);

  const health = player.getComponent(Health);
  health.current -= 10;

  expect(health.current).toBe(90);
});
```

### Integration Testing

Test ECS with mocked external libraries:

```typescript
// Mock Pixi.js
jest.mock('pixi.js', () => ({
  Sprite: class MockSprite {
    x = 0;
    y = 0;
  }
}));

test('position syncs to sprite', () => {
  const entity = createEntity();
  entity.addComponent(Position, 10, 20);
  entity.addComponent(PixiSprite);

  engine.update();

  const sprite = entity.getComponent(PixiSprite).sprite;
  expect(sprite.x).toBe(10);
  expect(sprite.y).toBe(20);
});
```

## Common Pitfalls

### ❌ Pitfall 1: Forgetting Cleanup

**Problem:**
```typescript
class PixiSprite {
  sprite: PIXI.Sprite;
  // No cleanup - memory leak!
}
```

**Solution:**
```typescript
class PixiSprite {
  sprite: PIXI.Sprite;

  onDestroy() {
    this.sprite.destroy();
  }
}
```

### ❌ Pitfall 2: Sync Order Issues

**Problem:**
```typescript
// Render before logic - uses stale data!
RenderSystem (priority: 100)
GameLogicSystem (priority: 50)
```

**Solution:**
```typescript
// Logic before rendering
GameLogicSystem (priority: 100)
RenderSystem (priority: -100)
```

### ❌ Pitfall 3: Mixed Update Rates

**Problem:**
```typescript
// Physics at variable rate - non-deterministic!
engine.createSystem('Physics', query, options, false);
```

**Solution:**
```typescript
// Physics at fixed rate - deterministic
engine.createSystem('Physics', query, options, true);
```

## Resources

- [Pixi.js Documentation](https://pixijs.download/release/docs/index.html)
- [Three.js Documentation](https://threejs.org/docs/)
- [React Documentation](https://react.dev/)
- [OrionECS Main README](../../README.md)
- [OrionECS Cookbook](../../docs/COOKBOOK.md)

## Contributing

Have an integration example to contribute?

1. Follow the existing example structure
2. Include comprehensive comments
3. Add to this README
4. Submit a pull request

We'd especially love examples for:
- Phaser integration
- Babylon.js integration
- Vue.js integration
- Svelte integration
- WebSocket networking
- WebRTC multiplayer

---

**Happy integrating! 🚀**
