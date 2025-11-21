/**
 * Platformer Game Example
 *
 * Demonstrates advanced OrionECS features:
 * - Physics system with gravity and jumping
 * - Platform collision detection and resolution
 * - State machines for character behavior
 * - Entity hierarchies for complex objects
 * - Level loading from data structures
 * - Animation state management
 * - Camera following player
 */

import { EngineBuilder } from '../../core/src/engine';
import type { EntityDef } from '../../core/src/definitions';

// ============================================================================
// Components
// ============================================================================

/**
 * Position in 2D space
 */
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

/**
 * Velocity for movement
 */
class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}

/**
 * Physics body with gravity
 */
class RigidBody {
  constructor(
    public mass: number = 1,
    public gravityScale: number = 1,
    public drag: number = 0.1
  ) {}
}

/**
 * Box collider for collision detection
 */
class BoxCollider {
  constructor(
    public width: number = 32,
    public height: number = 32,
    public offsetX: number = 0,
    public offsetY: number = 0
  ) {}

  get left(): number { return this.offsetX - this.width / 2; }
  get right(): number { return this.offsetX + this.width / 2; }
  get top(): number { return this.offsetY - this.height / 2; }
  get bottom(): number { return this.offsetY + this.height / 2; }
}

/**
 * Platform - static solid object
 */
class Platform {
  constructor(public isOneWay: boolean = false) {}
}

/**
 * Player controller
 */
class PlayerController {
  moveSpeed: number = 200;
  jumpForce: number = 400;
  airControl: number = 0.5;
  isGrounded: boolean = false;
  canJump: boolean = true;
  coyoteTime: number = 0.1; // Grace period for jumping after leaving ground
  coyoteTimer: number = 0;
  jumpBufferTime: number = 0.1; // Early jump input buffer
  jumpBufferTimer: number = 0;
}

/**
 * Input state
 */
class Input {
  left: boolean = false;
  right: boolean = false;
  jump: boolean = false;
  jumpPressed: boolean = false;
  down: boolean = false;
}

/**
 * Character state machine
 */
class CharacterState {
  constructor(
    public current: string = 'idle',
    public previous: string = 'idle'
  ) {}

  transition(newState: string): void {
    this.previous = this.current;
    this.current = newState;
  }
}

/**
 * Animation controller
 */
class AnimationController {
  constructor(
    public currentAnimation: string = 'idle',
    public frameIndex: number = 0,
    public frameTime: number = 0,
    public frameRate: number = 10
  ) {}
}

/**
 * Sprite renderer
 */
class Sprite {
  constructor(
    public spriteName: string = 'player',
    public flipX: boolean = false,
    public flipY: boolean = false
  ) {}
}

/**
 * Camera
 */
class Camera {
  x: number = 0;
  y: number = 0;
  targetX: number = 0;
  targetY: number = 0;
  smoothing: number = 0.1;
}

/**
 * Enemy AI
 */
class EnemyAI {
  constructor(
    public patrolSpeed: number = 50,
    public patrolDistance: number = 100,
    public startX: number = 0,
    public direction: number = 1
  ) {}
}

/**
 * Collectible item
 */
class Collectible {
  constructor(
    public type: string = 'coin',
    public value: number = 1
  ) {}
}

/**
 * Player stats
 */
class PlayerStats {
  coins: number = 0;
  lives: number = 3;
  score: number = 0;
}

// ============================================================================
// Game Configuration
// ============================================================================

const GRAVITY = 980; // pixels/second^2
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

// ============================================================================
// Engine Setup
// ============================================================================

const engine = new EngineBuilder()
  .withDebugMode(false)
  .withFixedUpdateFPS(60)
  .withMaxFixedIterations(10)
  .build();

// ============================================================================
// Prefabs
// ============================================================================

/**
 * Player prefab
 */
engine.registerPrefab('Player', {
  name: 'Player',
  components: [
    { type: Position, args: [100, 100] },
    { type: Velocity, args: [0, 0] },
    { type: RigidBody, args: [1, 1, 0.1] },
    { type: BoxCollider, args: [24, 32] },
    { type: PlayerController, args: [] },
    { type: Input, args: [] },
    { type: CharacterState, args: ['idle', 'idle'] },
    { type: AnimationController, args: ['idle'] },
    { type: Sprite, args: ['player'] },
    { type: PlayerStats, args: [] }
  ],
  tags: ['player', 'character']
});

/**
 * Platform prefab
 */
engine.registerPrefab('Platform', {
  name: 'Platform',
  components: [
    { type: Position, args: [0, 0] },
    { type: BoxCollider, args: [128, 32] },
    { type: Platform, args: [false] },
    { type: Sprite, args: ['platform'] }
  ],
  tags: ['platform', 'solid']
});

/**
 * One-way platform prefab
 */
engine.registerPrefab('OneWayPlatform', {
  name: 'OneWayPlatform',
  components: [
    { type: Position, args: [0, 0] },
    { type: BoxCollider, args: [128, 16] },
    { type: Platform, args: [true] },
    { type: Sprite, args: ['one_way_platform'] }
  ],
  tags: ['platform', 'one_way']
});

/**
 * Enemy prefab
 */
engine.registerPrefab('Enemy', {
  name: 'Enemy',
  components: [
    { type: Position, args: [0, 0] },
    { type: Velocity, args: [0, 0] },
    { type: RigidBody, args: [1, 1, 0.05] },
    { type: BoxCollider, args: [24, 24] },
    { type: EnemyAI, args: [50, 100, 0, 1] },
    { type: CharacterState, args: ['patrol'] },
    { type: Sprite, args: ['enemy'] }
  ],
  tags: ['enemy', 'character']
});

/**
 * Coin prefab
 */
engine.registerPrefab('Coin', {
  name: 'Coin',
  components: [
    { type: Position, args: [0, 0] },
    { type: BoxCollider, args: [16, 16] },
    { type: Collectible, args: ['coin', 1] },
    { type: Sprite, args: ['coin'] },
    { type: AnimationController, args: ['spin'] }
  ],
  tags: ['collectible']
});

// ============================================================================
// Input System
// ============================================================================

/**
 * Processes player input
 */
engine.createSystem('InputSystem',
  { all: [Input] },
  {
    priority: 1000,
    act: (entity: EntityDef, input: Input) => {
      // In a real game, this would read from keyboard events
      // For this example, we'll simulate some input

      // Example: Random movement for simulation
      if (Math.random() < 0.1) {
        input.left = Math.random() < 0.5;
        input.right = !input.left;
      }

      // Jump input buffering
      if (Math.random() < 0.05) {
        input.jumpPressed = true;
        input.jump = true;
      } else {
        input.jumpPressed = false;
        input.jump = false;
      }
    }
  },
  true // Fixed update
);

// ============================================================================
// Physics System
// ============================================================================

/**
 * Applies gravity to rigid bodies
 */
engine.createSystem('GravitySystem',
  { all: [Velocity, RigidBody] },
  {
    priority: 900,
    act: (entity: EntityDef, velocity: Velocity, rigidBody: RigidBody) => {
      const dt = 1 / 60;
      velocity.dy += GRAVITY * rigidBody.gravityScale * dt;
    }
  },
  true // Fixed update
);

/**
 * Applies drag to velocities
 */
engine.createSystem('DragSystem',
  { all: [Velocity, RigidBody] },
  {
    priority: 850,
    act: (entity: EntityDef, velocity: Velocity, rigidBody: RigidBody) => {
      velocity.dx *= (1 - rigidBody.drag);
    }
  },
  true
);

// ============================================================================
// Player Controller System
// ============================================================================

/**
 * Handles player movement and jumping
 */
engine.createSystem('PlayerControllerSystem',
  { all: [PlayerController, Input, Velocity, CharacterState] },
  {
    priority: 800,
    act: (entity: EntityDef, controller: PlayerController, input: Input, velocity: Velocity, state: CharacterState) => {
      const dt = 1 / 60;

      // Update timers
      controller.coyoteTimer -= dt;
      controller.jumpBufferTimer -= dt;

      // Store jump input in buffer
      if (input.jumpPressed) {
        controller.jumpBufferTimer = controller.jumpBufferTime;
      }

      // Horizontal movement
      const control = controller.isGrounded ? 1.0 : controller.airControl;

      if (input.left) {
        velocity.dx = -controller.moveSpeed * control;
      } else if (input.right) {
        velocity.dx = controller.moveSpeed * control;
      } else if (controller.isGrounded) {
        velocity.dx *= 0.7; // Ground friction
      }

      // Jumping
      const canCoyoteJump = controller.coyoteTimer > 0;
      const hasJumpBuffer = controller.jumpBufferTimer > 0;

      if (hasJumpBuffer && (controller.isGrounded || canCoyoteJump) && controller.canJump) {
        velocity.dy = -controller.jumpForce;
        controller.canJump = false;
        controller.coyoteTimer = 0;
        controller.jumpBufferTimer = 0;

        state.transition('jump');

        engine.messageBus.publish('player-jump', {}, 'PlayerControllerSystem');
      }

      // Reset jump when not pressing button
      if (!input.jump) {
        controller.canJump = true;
      }

      // Variable jump height (release jump early = shorter jump)
      if (!input.jump && velocity.dy < 0) {
        velocity.dy *= 0.5;
      }

      // Update character state
      if (controller.isGrounded) {
        if (Math.abs(velocity.dx) > 10) {
          if (state.current !== 'run') {
            state.transition('run');
          }
        } else {
          if (state.current !== 'idle') {
            state.transition('idle');
          }
        }
      } else {
        if (velocity.dy < 0 && state.current !== 'jump') {
          state.transition('jump');
        } else if (velocity.dy > 0 && state.current !== 'fall') {
          state.transition('fall');
        }
      }
    }
  },
  true
);

// ============================================================================
// Collision System
// ============================================================================

/**
 * Detects and resolves collisions with platforms
 */
engine.createSystem('PlatformCollisionSystem',
  { all: [Position, Velocity, BoxCollider, RigidBody] },
  {
    priority: 700,
    act: (entity: EntityDef, position: Position, velocity: Velocity, collider: BoxCollider, rigidBody: RigidBody) => {
      // Reset grounded state
      if (entity.hasComponent(PlayerController)) {
        const controller = entity.getComponent(PlayerController);
        const wasGrounded = controller.isGrounded;
        controller.isGrounded = false;

        // Update coyote timer
        if (wasGrounded) {
          controller.coyoteTimer = controller.coyoteTime;
        }
      }

      // Get all platforms
      const platforms = engine.createQuery({
        all: [Position, BoxCollider, Platform]
      }).getEntities();

      for (const platform of platforms) {
        const platPos = platform.getComponent(Position);
        const platCol = platform.getComponent(BoxCollider);
        const platComp = platform.getComponent(Platform);

        // Calculate overlap
        const entityLeft = position.x + collider.left;
        const entityRight = position.x + collider.right;
        const entityTop = position.y + collider.top;
        const entityBottom = position.y + collider.bottom;

        const platformLeft = platPos.x + platCol.left;
        const platformRight = platPos.x + platCol.right;
        const platformTop = platPos.y + platCol.top;
        const platformBottom = platPos.y + platCol.bottom;

        // Check for collision
        if (entityRight > platformLeft &&
            entityLeft < platformRight &&
            entityBottom > platformTop &&
            entityTop < platformBottom) {

          // One-way platform: only collide from above
          if (platComp.isOneWay) {
            if (velocity.dy > 0 && entityTop < platformTop) {
              position.y = platformTop + collider.top;
              velocity.dy = 0;

              if (entity.hasComponent(PlayerController)) {
                entity.getComponent(PlayerController).isGrounded = true;
              }
            }
            continue;
          }

          // Calculate overlap amounts
          const overlapLeft = entityRight - platformLeft;
          const overlapRight = platformRight - entityLeft;
          const overlapTop = entityBottom - platformTop;
          const overlapBottom = platformBottom - entityTop;

          // Find minimum overlap
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

          // Resolve collision
          if (minOverlap === overlapTop) {
            // Collision from top
            position.y = platformTop + collider.top;
            velocity.dy = 0;

            if (entity.hasComponent(PlayerController)) {
              entity.getComponent(PlayerController).isGrounded = true;
            }
          } else if (minOverlap === overlapBottom) {
            // Collision from bottom
            position.y = platformBottom + collider.bottom;
            velocity.dy = 0;
          } else if (minOverlap === overlapLeft) {
            // Collision from left
            position.x = platformLeft + collider.left;
            velocity.dx = 0;
          } else if (minOverlap === overlapRight) {
            // Collision from right
            position.x = platformRight + collider.right;
            velocity.dx = 0;
          }
        }
      }
    }
  },
  true
);

// ============================================================================
// Movement System
// ============================================================================

/**
 * Updates positions based on velocities
 */
engine.createSystem('MovementSystem',
  { all: [Position, Velocity] },
  {
    priority: 600,
    act: (entity: EntityDef, position: Position, velocity: Velocity) => {
      const dt = 1 / 60;
      position.x += velocity.dx * dt;
      position.y += velocity.dy * dt;
    }
  },
  true
);

// ============================================================================
// Enemy AI System
// ============================================================================

/**
 * Controls enemy patrol behavior
 */
engine.createSystem('EnemyAISystem',
  { all: [Position, Velocity, EnemyAI] },
  {
    priority: 750,
    act: (entity: EntityDef, position: Position, velocity: Velocity, ai: EnemyAI) => {
      // Simple patrol AI
      const distanceFromStart = Math.abs(position.x - ai.startX);

      if (distanceFromStart > ai.patrolDistance) {
        ai.direction *= -1; // Reverse direction
      }

      velocity.dx = ai.patrolSpeed * ai.direction;

      // Update sprite flip
      if (entity.hasComponent(Sprite)) {
        const sprite = entity.getComponent(Sprite);
        sprite.flipX = ai.direction < 0;
      }
    }
  },
  true
);

// ============================================================================
// Collectible System
// ============================================================================

/**
 * Handles collecting items
 */
engine.createSystem('CollectibleSystem',
  { all: [Position, BoxCollider, Collectible] },
  {
    priority: 650,
    act: (entity: EntityDef, position: Position, collider: BoxCollider, collectible: Collectible) => {
      // Check collision with player
      const players = engine.getEntitiesByTag('player');

      for (const player of players) {
        const playerPos = player.getComponent(Position);
        const playerCol = player.getComponent(BoxCollider);

        // Simple AABB collision
        const dx = Math.abs(position.x - playerPos.x);
        const dy = Math.abs(position.y - playerPos.y);

        if (dx < (collider.width + playerCol.width) / 2 &&
            dy < (collider.height + playerCol.height) / 2) {

          // Collect item
          if (player.hasComponent(PlayerStats)) {
            const stats = player.getComponent(PlayerStats);

            if (collectible.type === 'coin') {
              stats.coins += collectible.value;
              stats.score += collectible.value * 10;
            }
          }

          // Destroy collectible
          entity.queueFree();

          // Publish event
          engine.messageBus.publish('item-collected', {
            type: collectible.type,
            value: collectible.value
          }, 'CollectibleSystem');
        }
      }
    }
  },
  true
);

// ============================================================================
// Animation System
// ============================================================================

/**
 * Updates animation frames
 */
engine.createSystem('AnimationSystem',
  { all: [AnimationController, CharacterState] },
  {
    priority: 500,
    act: (entity: EntityDef, anim: AnimationController, state: CharacterState) => {
      const dt = 1 / 60;

      // Change animation based on state
      if (anim.currentAnimation !== state.current) {
        anim.currentAnimation = state.current;
        anim.frameIndex = 0;
        anim.frameTime = 0;
      }

      // Update frame
      anim.frameTime += dt;

      if (anim.frameTime >= 1 / anim.frameRate) {
        anim.frameIndex++;
        anim.frameTime = 0;

        // Loop animation (example: 8 frames per animation)
        if (anim.frameIndex >= 8) {
          anim.frameIndex = 0;
        }
      }
    }
  },
  true
);

// ============================================================================
// Camera System
// ============================================================================

/**
 * Makes camera follow player
 */
engine.createSystem('CameraFollowSystem',
  { all: [Camera] },
  {
    priority: 400,
    act: (entity: EntityDef, camera: Camera) => {
      const players = engine.getEntitiesByTag('player');

      if (players.length > 0) {
        const playerPos = players[0].getComponent(Position);

        // Set target to player position (centered on screen)
        camera.targetX = playerPos.x - SCREEN_WIDTH / 2;
        camera.targetY = playerPos.y - SCREEN_HEIGHT / 2;

        // Smooth camera movement
        camera.x += (camera.targetX - camera.x) * camera.smoothing;
        camera.y += (camera.targetY - camera.y) * camera.smoothing;

        // Clamp camera to level bounds (example: 0 to 2000)
        camera.x = Math.max(0, Math.min(camera.x, 2000 - SCREEN_WIDTH));
        camera.y = Math.max(0, Math.min(camera.y, 1000 - SCREEN_HEIGHT));
      }
    }
  },
  true
);

// ============================================================================
// Sprite Direction System
// ============================================================================

/**
 * Flips sprite based on movement direction
 */
engine.createSystem('SpriteDirectionSystem',
  { all: [Velocity, Sprite], tags: ['player'] },
  {
    priority: 450,
    act: (entity: EntityDef, velocity: Velocity, sprite: Sprite) => {
      if (Math.abs(velocity.dx) > 10) {
        sprite.flipX = velocity.dx < 0;
      }
    }
  },
  true
);

// ============================================================================
// Level Loading
// ============================================================================

/**
 * Load a level from data
 */
function loadLevel(levelData: LevelData): void {
  console.log(`Loading level: ${levelData.name}`);

  // Create platforms
  for (const platData of levelData.platforms) {
    const platform = engine.createFromPrefab(
      platData.oneWay ? 'OneWayPlatform' : 'Platform',
      `Platform_${platData.x}_${platData.y}`
    );

    const position = platform.getComponent(Position);
    const collider = platform.getComponent(BoxCollider);

    position.x = platData.x;
    position.y = platData.y;
    collider.width = platData.width;
    collider.height = platData.height;
  }

  // Create enemies
  for (const enemyData of levelData.enemies) {
    const enemy = engine.createFromPrefab('Enemy', `Enemy_${enemyData.x}_${enemyData.y}`);
    const position = enemy.getComponent(Position);
    const ai = enemy.getComponent(EnemyAI);

    position.x = enemyData.x;
    position.y = enemyData.y;
    ai.startX = enemyData.x;
  }

  // Create collectibles
  for (const coinData of levelData.coins) {
    const coin = engine.createFromPrefab('Coin', `Coin_${coinData.x}_${coinData.y}`);
    const position = coin.getComponent(Position);

    position.x = coinData.x;
    position.y = coinData.y;
  }

  console.log(`Level loaded: ${levelData.platforms.length} platforms, ${levelData.enemies.length} enemies, ${levelData.coins.length} coins`);
}

// ============================================================================
// Level Data Types
// ============================================================================

interface LevelData {
  name: string;
  platforms: PlatformData[];
  enemies: EnemyData[];
  coins: CoinData[];
}

interface PlatformData {
  x: number;
  y: number;
  width: number;
  height: number;
  oneWay: boolean;
}

interface EnemyData {
  x: number;
  y: number;
}

interface CoinData {
  x: number;
  y: number;
}

// Example level
const exampleLevel: LevelData = {
  name: 'Level 1',
  platforms: [
    { x: 400, y: 500, width: 800, height: 32, oneWay: false }, // Ground
    { x: 200, y: 400, width: 128, height: 32, oneWay: false },
    { x: 600, y: 350, width: 128, height: 32, oneWay: false },
    { x: 400, y: 250, width: 128, height: 16, oneWay: true }, // One-way platform
  ],
  enemies: [
    { x: 300, y: 450 },
    { x: 700, y: 300 }
  ],
  coins: [
    { x: 200, y: 350 },
    { x: 250, y: 350 },
    { x: 600, y: 300 },
    { x: 650, y: 300 },
    { x: 400, y: 200 }
  ]
};

// ============================================================================
// Game Initialization
// ============================================================================

/**
 * Initialize the game
 */
function initGame(): void {
  console.log('Initializing Platformer game...');

  // Create camera
  const camera = engine.createEntity('Camera');
  camera.addComponent(Camera);
  camera.addTag('camera');

  // Load level
  loadLevel(exampleLevel);

  // Create player
  const player = engine.createFromPrefab('Player', 'Player');
  const playerPos = player.getComponent(Position);
  playerPos.x = 100;
  playerPos.y = 100;

  console.log('Player created at', playerPos.x, playerPos.y);

  // Start engine
  engine.start();
  console.log('Engine started');
}

// ============================================================================
// Message Bus Subscriptions
// ============================================================================

engine.messageBus.subscribe('player-jump', (message) => {
  // Play jump sound
  console.log('Player jumped!');
});

engine.messageBus.subscribe('item-collected', (message) => {
  console.log(`Collected ${message.data.type} worth ${message.data.value}`);
});

// ============================================================================
// Game Loop
// ============================================================================

/**
 * Main game loop
 */
function gameLoop(): void {
  engine.update();
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Components
  Position,
  Velocity,
  RigidBody,
  BoxCollider,
  Platform,
  PlayerController,
  Input,
  CharacterState,
  AnimationController,
  Sprite,
  Camera,
  EnemyAI,
  Collectible,
  PlayerStats,

  // Functions
  initGame,
  gameLoop,
  loadLevel,

  // Types
  LevelData,
  PlatformData,
  EnemyData,
  CoinData,

  // Data
  exampleLevel,

  // Engine
  engine
};

// ============================================================================
// Usage Example
// ============================================================================

/*
// Browser usage:

import { initGame, gameLoop } from './examples/games/platformer';

// Initialize
initGame();

// Start game loop
function loop() {
  gameLoop();
  requestAnimationFrame(loop);
}
loop();

*/

// ============================================================================
// Notes
// ============================================================================

/*
This platformer example demonstrates:

1. **Physics System:**
   - Gravity implementation
   - Drag/friction
   - Rigid bodies with mass and gravity scale

2. **Collision Detection:**
   - AABB (Axis-Aligned Bounding Box) collision
   - Platform collision resolution
   - One-way platforms
   - Minimum overlap calculation

3. **Player Controller:**
   - Ground detection
   - Jumping with variable height
   - Coyote time (jump grace period)
   - Jump buffering (early input)
   - Air control
   - State-based animation

4. **Character States:**
   - Idle, run, jump, fall states
   - State transitions
   - Animation tied to state

5. **Enemy AI:**
   - Simple patrol behavior
   - Direction reversal
   - Sprite flipping

6. **Collectibles:**
   - Collision detection with player
   - Score tracking
   - Item removal on collect

7. **Camera System:**
   - Smooth follow player
   - Bounds clamping
   - Centered on player

8. **Level Loading:**
   - Data-driven level design
   - Dynamic entity creation
   - Prefab-based instantiation

To extend this example:
- Add more enemy types with different behaviors
- Implement player combat (attack, damage)
- Add checkpoints and respawning
- Create moving platforms
- Add hazards (spikes, pits)
- Implement level transitions
- Add power-ups (double jump, dash)
- Create boss battles
- Add parallax background layers
*/
