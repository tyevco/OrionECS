# Multiple World/Scene Support

**Milestone:** v0.6.0 - Production Hardening
**Priority:** High
**Labels:** enhancement, architecture, game-dev
**Impact:** Architecture, Game Development, Flexibility

## Description

Implement support for multiple independent ECS worlds/scenes running simultaneously. This allows games to have separate ECS instances for different purposes (main game world, UI, menu system, mini-games) without interference.

## Goals

- Support multiple independent Engine instances
- Enable scene switching and transitions
- Allow concurrent scenes (e.g., game + UI)
- Provide scene lifecycle management
- Support scene serialization and loading
- Enable scene composition and layering

## Use Cases

- **Menu Systems:** Separate ECS instance for main menu vs gameplay
- **UI Layers:** Dedicated world for UI that doesn't interfere with game world
- **Mini-Games:** Run mini-game in separate world while pausing main game
- **Split-Screen:** Multiple game worlds for local multiplayer
- **Client-Side Prediction:** Separate worlds for client prediction vs server state
- **Cutscenes:** Isolated world for cinematic sequences
- **Level Streaming:** Load/unload scenes as player moves through world

## Subtasks

### 1. Design Multi-World Architecture
- [ ] Define World/Scene concept and API
- [ ] Plan world isolation strategy
- [ ] Design inter-world communication
- [ ] Plan resource sharing between worlds
- [ ] Design world lifecycle management

### 2. Implement World/Scene Class
- [ ] Create `World` or `Scene` class
- [ ] Each world has independent Engine instance
- [ ] Isolated entity/component/system storage
- [ ] Independent update loops
- [ ] Separate performance monitoring per world

### 3. Implement World Manager
- [ ] Create `WorldManager` for managing multiple worlds
- [ ] World creation and destruction
- [ ] World activation/deactivation
- [ ] World enumeration and lookup
- [ ] Default/active world management
- [ ] World lifecycle events

### 4. Add Scene Switching
- [ ] Switch between scenes
- [ ] Transition effects support
- [ ] Scene unloading and cleanup
- [ ] Scene preloading
- [ ] History/back navigation
- [ ] Async scene loading

### 5. Implement Concurrent Scenes
- [ ] Run multiple scenes simultaneously
- [ ] Scene layering and z-order
- [ ] Scene update priority
- [ ] Selective scene updates (pause background scenes)
- [ ] Input routing to active scene
- [ ] Render order management

### 6. Add Scene Serialization
- [ ] Serialize scene to JSON
- [ ] Deserialize scene from JSON
- [ ] Scene templates/prefabs
- [ ] Incremental scene loading
- [ ] Scene versioning
- [ ] Migration support

### 7. Implement Resource Sharing
- [ ] Share resources between worlds (textures, sounds)
- [ ] Reference counting for shared resources
- [ ] Resource isolation when needed
- [ ] Asset manager integration
- [ ] Prevent resource duplication

### 8. Add Inter-World Communication
- [ ] Message passing between worlds
- [ ] Shared blackboard for data
- [ ] World events and listeners
- [ ] Entity references across worlds (with caution)
- [ ] Synchronized updates

### 9. Implement Scene Transitions
- [ ] Fade in/out transitions
- [ ] Slide transitions
- [ ] Cross-fade between scenes
- [ ] Custom transition effects
- [ ] Transition callbacks
- [ ] Async transition handling

### 10. Add Scene Lifecycle Hooks
- [ ] `onLoad` - Scene loaded
- [ ] `onUnload` - Scene unloaded
- [ ] `onActivate` - Scene becomes active
- [ ] `onDeactivate` - Scene becomes inactive
- [ ] `onPause` - Scene paused
- [ ] `onResume` - Scene resumed

### 11. Create Scene Composition
- [ ] Compose scenes from multiple sub-scenes
- [ ] Additive scene loading
- [ ] Scene overlays
- [ ] Persistent scenes (HUD, music)
- [ ] Dynamic scene composition
- [ ] Scene groups

### 12. Implement Split-Screen Support
- [ ] Multiple viewports per world
- [ ] Camera per viewport
- [ ] Input routing per viewport
- [ ] Render to texture support
- [ ] Layout management
- [ ] Local multiplayer support

### 13. Add Development Tools
- [ ] Scene hierarchy inspector
- [ ] Active scenes panel
- [ ] Scene switching UI
- [ ] Scene memory usage
- [ ] Scene debugging tools
- [ ] Scene graph visualization

### 14. Documentation and Examples
- [ ] Write multi-world guide
- [ ] Document scene management API
- [ ] Add menu system example
- [ ] Add split-screen example
- [ ] Add scene transition example
- [ ] Add mini-game example
- [ ] Document best practices

### 15. Testing
- [ ] Unit tests for World/Scene
- [ ] Integration tests for multi-world
- [ ] Scene loading/unloading tests
- [ ] Resource sharing tests
- [ ] Performance tests with multiple worlds
- [ ] Memory leak tests

## Success Criteria

- [ ] Multiple worlds can run independently
- [ ] Scene switching works smoothly
- [ ] Concurrent scenes don't interfere
- [ ] Resources are shared efficiently
- [ ] Scene serialization preserves state
- [ ] Good performance with multiple worlds
- [ ] Documentation is comprehensive
- [ ] Examples demonstrate key use cases

## Implementation Notes

**Basic API:**
```typescript
import { WorldManager } from 'orion-ecs';

// Create world manager
const worldManager = new WorldManager();

// Create worlds
const menuWorld = worldManager.createWorld('Menu');
const gameWorld = worldManager.createWorld('Game');
const uiWorld = worldManager.createWorld('UI');

// Configure each world independently
menuWorld.engine.createSystem('MenuSystem', ...);
gameWorld.engine.createSystem('GameplaySystem', ...);
uiWorld.engine.createSystem('UISystem', ...);

// Switch to a world (deactivates others)
worldManager.switchTo('Menu');

// Run multiple worlds concurrently
worldManager.activate('Game');
worldManager.activate('UI'); // Both active

// Update all active worlds
worldManager.update(deltaTime);

// Pause a world
worldManager.pause('Game');
worldManager.resume('Game');

// Unload a world
worldManager.unload('Menu');
```

**Scene Switching with Transitions:**
```typescript
// Switch with fade transition
await worldManager.switchTo('Game', {
  transition: 'fade',
  duration: 1000,
  onProgress: (progress) => {
    console.log(`Transition ${Math.round(progress * 100)}% complete`);
  }
});

// Custom transition
await worldManager.switchTo('Game', {
  transition: async (from, to, progress) => {
    from.alpha = 1 - progress;
    to.alpha = progress;
  },
  duration: 500
});
```

**Scene Lifecycle:**
```typescript
const gameWorld = worldManager.createWorld('Game', {
  onLoad: async (world) => {
    console.log('Loading game world...');
    // Load assets
    await world.loadAssets(['player.png', 'level1.tmx']);
  },

  onActivate: (world) => {
    console.log('Game world activated');
    world.engine.start();
  },

  onDeactivate: (world) => {
    console.log('Game world deactivated');
    world.engine.stop();
  },

  onUnload: (world) => {
    console.log('Unloading game world...');
    world.cleanup();
  }
});
```

**Scene Composition:**
```typescript
// Create persistent HUD scene
const hudWorld = worldManager.createWorld('HUD', {
  persistent: true, // Never unloaded
  layer: 100 // Render on top
});

// Load main game
worldManager.activate('Game');

// HUD stays active across scene changes
worldManager.switchTo('Shop'); // HUD still visible
worldManager.switchTo('Inventory'); // HUD still visible
```

**Split-Screen:**
```typescript
// Create two game worlds for local multiplayer
const player1World = worldManager.createWorld('Player1', {
  viewport: { x: 0, y: 0, width: 0.5, height: 1.0 }
});

const player2World = worldManager.createWorld('Player2', {
  viewport: { x: 0.5, y: 0, width: 0.5, height: 1.0 }
});

// Both worlds share same game logic but different cameras
player1World.engine.createEntity('Player1');
player2World.engine.createEntity('Player2');

// Update both
worldManager.activate('Player1');
worldManager.activate('Player2');
worldManager.update(deltaTime);
```

**Resource Sharing:**
```typescript
// Create shared resource manager
const resources = new SharedResourceManager();

// Share resources between worlds
worldManager.createWorld('Game1', {
  resources: resources
});

worldManager.createWorld('Game2', {
  resources: resources // Same resources instance
});

// Texture loaded once, used by both worlds
const texture = resources.load('player.png');
```

**Scene Serialization:**
```typescript
// Save scene
const sceneData = worldManager.serialize('Game');
localStorage.setItem('savedGame', JSON.stringify(sceneData));

// Load scene
const sceneData = JSON.parse(localStorage.getItem('savedGame'));
const gameWorld = worldManager.deserialize('Game', sceneData);
worldManager.activate('Game');
```

**Inter-World Communication:**
```typescript
// Publish message from one world
gameWorld.messageBus.publish('player-died', { score: 1000 });

// Listen in another world
uiWorld.messageBus.subscribe('player-died', (message) => {
  // Update UI to show game over
  showGameOver(message.data.score);
});

// Shared blackboard
const sharedData = worldManager.getSharedBlackboard();
sharedData.set('playerScore', 1000);

// Access from any world
const score = worldManager.getSharedBlackboard().get('playerScore');
```

## Related Issues

- High-Level Save/Load System (new issue - builds on serialization)
- Component Schema Evolution (new issue - needed for scene migration)
- #55 - Replay System Plugin (record/replay across scenes)
- Network Synchronization Plugin (sync scenes in multiplayer)

## References

- [Unity Scene Management](https://docs.unity3d.com/Manual/SceneManagement.html)
- [Godot Scene System](https://docs.godotengine.org/en/stable/getting_started/step_by_step/scenes_and_nodes.html)
- [Phaser Scene Manager](https://photonstorm.github.io/phaser3-docs/Phaser.Scenes.SceneManager.html)
- [BabylonJS Scene](https://doc.babylonjs.com/divingDeeper/scene)
