/**
 * Asteroids Game Example
 *
 * Demonstrates core OrionECS features:
 * - Entity creation and destruction
 * - Component-based design (Position, Velocity, Renderable, Collider)
 * - System organization (MovementSystem, CollisionSystem, InputSystem)
 * - Game loop with fixed and variable updates
 * - Entity pooling for bullets and asteroids
 * - Prefab system for entity templates
 * - Inter-system messaging
 * - Tag-based entity management
 */

import { EngineBuilder, type EntityDef } from '@orion-ecs/core';

// ============================================================================
// Components
// ============================================================================

/**
 * Position in 2D space
 */
class Position {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

/**
 * Velocity for movement
 */
class Velocity {
    constructor(
        public dx: number = 0,
        public dy: number = 0
    ) {}
}

/**
 * Rotation state
 */
class Rotation {
    constructor(
        public angle: number = 0,
        public speed: number = 0
    ) {}
}

/**
 * Renderable sprite data
 */
class Renderable {
    constructor(
        public sprite: string,
        public size: number = 1,
        public color: string = '#FFFFFF'
    ) {}
}

/**
 * Circular collider for collision detection
 */
class Collider {
    constructor(public radius: number = 10) {}
}

/**
 * Health/life points
 */
class Health {
    constructor(
        public value: number = 1,
        public max: number = 1
    ) {}
}

/**
 * Player-specific data
 */
class Player {
    thrustPower: number = 200;
    rotationSpeed: number = 4;
    shootCooldown: number = 0;
    shootCooldownMax: number = 0.25; // Seconds between shots
    lives: number = 3;
    score: number = 0;
}

/**
 * Asteroid-specific data
 */
class Asteroid {
    constructor(public size: number = 3) {} // 3 = large, 2 = medium, 1 = small
}

/**
 * Bullet-specific data
 */
class Bullet {
    constructor(public lifetime: number = 2.0) {} // Lifetime in seconds
}

/**
 * Input state tracking
 */
class InputState {
    left: boolean = false;
    right: boolean = false;
    thrust: boolean = false;
    shoot: boolean = false;
}

// ============================================================================
// Game Configuration
// ============================================================================

const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;
const BULLET_SPEED = 400;
const ASTEROID_BASE_SPEED = 50;
const MAX_ASTEROIDS = 10;

// ============================================================================
// Engine Setup
// ============================================================================

const engine = new EngineBuilder()
    .withDebugMode(false)
    .withFixedUpdateFPS(60)
    .withMaxFixedIterations(10)
    .build();

// ============================================================================
// Component Pooling
// ============================================================================

// Pool frequently created/destroyed components for performance
engine.registerComponentPool(Bullet, { initialSize: 20, maxSize: 100 });
engine.registerComponentPool(Position, { initialSize: 50, maxSize: 200 });
engine.registerComponentPool(Velocity, { initialSize: 50, maxSize: 200 });

// ============================================================================
// Prefabs
// ============================================================================

/**
 * Player ship prefab
 */
engine.registerPrefab('Player', {
    name: 'Player',
    components: [
        { type: Position, args: [SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2] },
        { type: Velocity, args: [0, 0] },
        { type: Rotation, args: [0, 0] },
        { type: Renderable, args: ['ship', 1, '#00FF00'] },
        { type: Collider, args: [15] },
        { type: Health, args: [1, 1] },
        { type: Player, args: [] },
        { type: InputState, args: [] },
    ],
    tags: ['player', 'alive'],
});

/**
 * Asteroid prefab (parameterized via component args)
 */
engine.registerPrefab('Asteroid', {
    name: 'Asteroid',
    components: [
        { type: Position, args: [0, 0] },
        { type: Velocity, args: [0, 0] },
        { type: Rotation, args: [0, 0.02] },
        { type: Renderable, args: ['asteroid', 1, '#888888'] },
        { type: Collider, args: [30] },
        { type: Health, args: [1, 1] },
        { type: Asteroid, args: [3] },
    ],
    tags: ['asteroid', 'alive'],
});

/**
 * Bullet prefab
 */
engine.registerPrefab('Bullet', {
    name: 'Bullet',
    components: [
        { type: Position, args: [0, 0] },
        { type: Velocity, args: [0, 0] },
        { type: Renderable, args: ['bullet', 0.3, '#FFFF00'] },
        { type: Collider, args: [3] },
        { type: Bullet, args: [2.0] },
    ],
    tags: ['bullet', 'alive'],
});

// ============================================================================
// Input System
// ============================================================================

/**
 * Handles keyboard input and updates player input state
 */
engine.createSystem(
    'InputSystem',
    { all: [Player, InputState] },
    {
        priority: 1000, // Run first
        act: (_entity: EntityDef, player: Player, input: InputState) => {
            // In a real game, this would read from keyboard events
            // For this example, we'll simulate some basic behavior

            // Example: Random chance to thrust/shoot for simulation
            if (Math.random() < 0.1) {
                input.thrust = !input.thrust;
            }
            if (Math.random() < 0.05) {
                input.shoot = true;
            } else {
                input.shoot = false;
            }

            // Cooldown management
            if (player.shootCooldown > 0) {
                player.shootCooldown -= 1 / 60; // Fixed timestep
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Player Control System
// ============================================================================

/**
 * Applies player input to movement and shooting
 */
engine.createSystem(
    'PlayerControlSystem',
    { all: [Player, InputState, Rotation, Velocity, Position] },
    {
        priority: 900,
        act: (
            _entity: EntityDef,
            player: Player,
            input: InputState,
            rotation: Rotation,
            velocity: Velocity,
            position: Position
        ) => {
            const dt = 1 / 60; // Fixed timestep

            // Rotation
            if (input.left) {
                rotation.angle -= player.rotationSpeed * dt;
            }
            if (input.right) {
                rotation.angle += player.rotationSpeed * dt;
            }

            // Thrust
            if (input.thrust) {
                const thrustX = Math.cos(rotation.angle) * player.thrustPower * dt;
                const thrustY = Math.sin(rotation.angle) * player.thrustPower * dt;
                velocity.dx += thrustX;
                velocity.dy += thrustY;
            }

            // Apply drag
            velocity.dx *= 0.99;
            velocity.dy *= 0.99;

            // Shooting
            if (input.shoot && player.shootCooldown <= 0) {
                player.shootCooldown = player.shootCooldownMax;

                // Create bullet
                const bullet = engine.createFromPrefab('Bullet', `Bullet_${Date.now()}`);
                const bulletPos = bullet.getComponent(Position);
                const bulletVel = bullet.getComponent(Velocity);

                // Position bullet at ship nose
                bulletPos.x = position.x + Math.cos(rotation.angle) * 20;
                bulletPos.y = position.y + Math.sin(rotation.angle) * 20;

                // Set bullet velocity (ship velocity + bullet speed)
                bulletVel.dx = velocity.dx + Math.cos(rotation.angle) * BULLET_SPEED;
                bulletVel.dy = velocity.dy + Math.sin(rotation.angle) * BULLET_SPEED;

                // Publish shoot event
                engine.messageBus.publish(
                    'player-shoot',
                    { position: bulletPos },
                    'PlayerControlSystem'
                );
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Movement System
// ============================================================================

/**
 * Updates entity positions based on velocity
 */
engine.createSystem(
    'MovementSystem',
    { all: [Position, Velocity] },
    {
        priority: 500,
        act: (_entity: EntityDef, position: Position, velocity: Velocity) => {
            const dt = 1 / 60; // Fixed timestep

            position.x += velocity.dx * dt;
            position.y += velocity.dy * dt;

            // Wrap around screen edges
            if (position.x < 0) position.x = SCREEN_WIDTH;
            if (position.x > SCREEN_WIDTH) position.x = 0;
            if (position.y < 0) position.y = SCREEN_HEIGHT;
            if (position.y > SCREEN_HEIGHT) position.y = 0;
        },
    },
    true // Fixed update
);

// ============================================================================
// Rotation System
// ============================================================================

/**
 * Updates rotation angles
 */
engine.createSystem(
    'RotationSystem',
    { all: [Rotation] },
    {
        priority: 500,
        act: (_entity: EntityDef, rotation: Rotation) => {
            rotation.angle += rotation.speed;

            // Normalize angle to 0-2π
            if (rotation.angle > Math.PI * 2) {
                rotation.angle -= Math.PI * 2;
            }
            if (rotation.angle < 0) {
                rotation.angle += Math.PI * 2;
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Collision System
// ============================================================================

/**
 * Detects and handles collisions between entities
 */
engine.createSystem(
    'CollisionSystem',
    { all: [Position, Collider], tags: ['alive'] },
    {
        priority: 400,
        act: (entity: EntityDef, position: Position, collider: Collider) => {
            // Get all other collidable entities
            const others = engine
                .createQuery({
                    all: [Position, Collider],
                    tags: ['alive'],
                })
                .getEntities();

            for (const other of others) {
                if (other === entity) continue;

                const otherPos = other.getComponent(Position);
                const otherCol = other.getComponent(Collider);

                // Simple circle collision detection
                const dx = position.x - otherPos.x;
                const dy = position.y - otherPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < collider.radius + otherCol.radius) {
                    handleCollision(entity, other);
                }
            }
        },
    },
    true // Fixed update
);

/**
 * Handle collision between two entities
 */
function handleCollision(entity1: EntityDef, entity2: EntityDef): void {
    // Bullet hits asteroid
    if (entity1.hasTag('bullet') && entity2.hasTag('asteroid')) {
        destroyEntity(entity1); // Destroy bullet
        damageAsteroid(entity2);
    }
    // Asteroid hits bullet (reverse)
    else if (entity1.hasTag('asteroid') && entity2.hasTag('bullet')) {
        destroyEntity(entity2); // Destroy bullet
        damageAsteroid(entity1);
    }
    // Player hits asteroid
    else if (entity1.hasTag('player') && entity2.hasTag('asteroid')) {
        damagePlayer(entity1);
        destroyEntity(entity2);
    }
    // Asteroid hits player (reverse)
    else if (entity1.hasTag('asteroid') && entity2.hasTag('player')) {
        damagePlayer(entity2);
        destroyEntity(entity1);
    }
}

/**
 * Damage an asteroid and potentially split it
 */
function damageAsteroid(entity: EntityDef): void {
    const asteroid = entity.getComponent(Asteroid);
    const position = entity.getComponent(Position);

    // Award points
    const playerEntities = engine.getEntitiesByTag('player');
    if (playerEntities.length > 0) {
        const player = playerEntities[0].getComponent(Player);
        player.score += (4 - asteroid.size) * 100; // Larger = more points
    }

    // Split asteroid if not smallest size
    if (asteroid.size > 1) {
        const newSize = asteroid.size - 1;
        const pieces = 2;

        for (let i = 0; i < pieces; i++) {
            const piece = engine.createFromPrefab('Asteroid', `Asteroid_${Date.now()}_${i}`);
            const piecePos = piece.getComponent(Position);
            const pieceVel = piece.getComponent(Velocity);
            const pieceAst = piece.getComponent(Asteroid);
            const pieceCol = piece.getComponent(Collider);
            const pieceRen = piece.getComponent(Renderable);

            // Position at parent asteroid
            piecePos.x = position.x;
            piecePos.y = position.y;

            // Random velocity
            const angle = ((Math.PI * 2) / pieces) * i + Math.random() * 0.5;
            const speed = ASTEROID_BASE_SPEED * (1 + (3 - newSize) * 0.5);
            pieceVel.dx = Math.cos(angle) * speed;
            pieceVel.dy = Math.sin(angle) * speed;

            // Update size
            pieceAst.size = newSize;
            pieceCol.radius = 30 * (newSize / 3);
            pieceRen.size = newSize / 3;
        }
    }

    // Destroy original asteroid
    destroyEntity(entity);

    // Publish asteroid destroyed event
    engine.messageBus.publish('asteroid-destroyed', { size: asteroid.size }, 'CollisionSystem');
}

/**
 * Damage the player
 */
function damagePlayer(entity: EntityDef): void {
    const player = entity.getComponent(Player);
    const health = entity.getComponent(Health);

    health.value--;
    player.lives--;

    if (health.value <= 0) {
        if (player.lives > 0) {
            // Respawn player
            const position = entity.getComponent(Position);
            const velocity = entity.getComponent(Velocity);
            position.x = SCREEN_WIDTH / 2;
            position.y = SCREEN_HEIGHT / 2;
            velocity.dx = 0;
            velocity.dy = 0;
            health.value = health.max;

            engine.messageBus.publish(
                'player-respawn',
                { livesLeft: player.lives },
                'CollisionSystem'
            );
        } else {
            // Game over
            destroyEntity(entity);
            engine.messageBus.publish('game-over', { score: player.score }, 'CollisionSystem');
        }
    }
}

/**
 * Destroy an entity
 */
function destroyEntity(entity: EntityDef): void {
    entity.removeTag('alive');
    entity.queueFree();
}

// ============================================================================
// Bullet Lifetime System
// ============================================================================

/**
 * Removes bullets after their lifetime expires
 */
engine.createSystem(
    'BulletLifetimeSystem',
    { all: [Bullet] },
    {
        priority: 300,
        act: (entity: EntityDef, bullet: Bullet) => {
            const dt = 1 / 60; // Fixed timestep
            bullet.lifetime -= dt;

            if (bullet.lifetime <= 0) {
                destroyEntity(entity);
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Asteroid Spawner System
// ============================================================================

/**
 * Spawns new asteroids to maintain difficulty
 */
engine.createSystem(
    'AsteroidSpawnerSystem',
    { all: [] }, // No entity query, just runs
    {
        priority: 200,
        act: () => {
            const asteroidCount = engine.getEntitiesByTag('asteroid').length;

            if (asteroidCount < MAX_ASTEROIDS) {
                const asteroid = engine.createFromPrefab('Asteroid', `Asteroid_${Date.now()}`);
                const position = asteroid.getComponent(Position);
                const velocity = asteroid.getComponent(Velocity);
                const rotation = asteroid.getComponent(Rotation);

                // Spawn at random edge position
                const edge = Math.floor(Math.random() * 4);
                if (edge === 0) {
                    // Top
                    position.x = Math.random() * SCREEN_WIDTH;
                    position.y = 0;
                } else if (edge === 1) {
                    // Right
                    position.x = SCREEN_WIDTH;
                    position.y = Math.random() * SCREEN_HEIGHT;
                } else if (edge === 2) {
                    // Bottom
                    position.x = Math.random() * SCREEN_WIDTH;
                    position.y = SCREEN_HEIGHT;
                } else {
                    // Left
                    position.x = 0;
                    position.y = Math.random() * SCREEN_HEIGHT;
                }

                // Random velocity toward center
                const angleToCenter = Math.atan2(
                    SCREEN_HEIGHT / 2 - position.y,
                    SCREEN_WIDTH / 2 - position.x
                );
                const variance = ((Math.random() - 0.5) * Math.PI) / 2;
                const angle = angleToCenter + variance;
                const speed = ASTEROID_BASE_SPEED + Math.random() * ASTEROID_BASE_SPEED;

                velocity.dx = Math.cos(angle) * speed;
                velocity.dy = Math.sin(angle) * speed;

                // Random rotation speed
                rotation.speed = (Math.random() - 0.5) * 0.1;
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Render System (Simulated)
// ============================================================================

/**
 * Simulated rendering system - in a real game this would draw to canvas/WebGL
 */
engine.createSystem(
    'RenderSystem',
    { all: [Position, Renderable] },
    {
        priority: -100, // Run last
        before: () => {
            // Clear screen (simulated)
            // ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        },
        act: (_entity: EntityDef, _position: Position, _renderable: Renderable) => {
            // Draw entity (simulated)
            // In real implementation:
            // - Get rotation if available
            // - Draw sprite/shape at position
            // - Apply size and color
            // For this example, we just track that rendering would happen
        },
        after: () => {
            // Present frame (simulated)
        },
    },
    false // Variable update
);

// ============================================================================
// Message Bus Subscriptions
// ============================================================================

engine.messageBus.subscribe('asteroid-destroyed', (message) => {
    console.log(`Asteroid destroyed! Size: ${message.data.size}`);
});

engine.messageBus.subscribe('player-shoot', (_message) => {
    // Could play sound effect here
});

engine.messageBus.subscribe('player-respawn', (message) => {
    console.log(`Player respawned! Lives left: ${message.data.livesLeft}`);
});

engine.messageBus.subscribe('game-over', (message) => {
    console.log(`Game Over! Final score: ${message.data.score}`);
    engine.stop();
});

// ============================================================================
// Game Initialization
// ============================================================================

/**
 * Initialize the game
 */
function initGame(): void {
    console.log('Initializing Asteroids game...');

    // Create player
    const player = engine.createFromPrefab('Player', 'Player1');
    console.log('Player created:', player.name);

    // Create initial asteroids
    const initialAsteroidCount = 5;
    for (let i = 0; i < initialAsteroidCount; i++) {
        const asteroid = engine.createFromPrefab('Asteroid', `Asteroid_${i}`);
        const position = asteroid.getComponent(Position);
        const velocity = asteroid.getComponent(Velocity);
        const rotation = asteroid.getComponent(Rotation);

        // Random position
        position.x = Math.random() * SCREEN_WIDTH;
        position.y = Math.random() * SCREEN_HEIGHT;

        // Random velocity
        const angle = Math.random() * Math.PI * 2;
        const speed = ASTEROID_BASE_SPEED + Math.random() * ASTEROID_BASE_SPEED;
        velocity.dx = Math.cos(angle) * speed;
        velocity.dy = Math.sin(angle) * speed;

        // Random rotation
        rotation.speed = (Math.random() - 0.5) * 0.1;
    }

    console.log(`Created ${initialAsteroidCount} initial asteroids`);

    // Start engine
    engine.start();
    console.log('Engine started');
}

// ============================================================================
// Game Loop
// ============================================================================

/**
 * Main game loop
 * In a real browser environment, this would use requestAnimationFrame
 */
function gameLoop(): void {
    // Update engine
    engine.update();

    // Continue loop
    // In browser: requestAnimationFrame(gameLoop);
    // In Node.js: setTimeout(gameLoop, 16);
}

// ============================================================================
// Export for use in other files
// ============================================================================

export {
    // Components
    Position,
    Velocity,
    Rotation,
    Renderable,
    Collider,
    Health,
    Player,
    Asteroid,
    Bullet,
    InputState,
    // Functions
    initGame,
    gameLoop,
    // Engine
    engine,
};

// ============================================================================
// Usage Example
// ============================================================================

/*
// To run this game:

import { initGame, gameLoop } from './examples/games/asteroids';

// Initialize the game
initGame();

// Start the game loop
// In a browser:
function browserGameLoop() {
  gameLoop();
  requestAnimationFrame(browserGameLoop);
}
browserGameLoop();

// In Node.js (for testing):
let frameCount = 0;
const maxFrames = 600; // Run for 10 seconds at 60fps
function nodeGameLoop() {
  gameLoop();
  frameCount++;
  if (frameCount < maxFrames) {
    setTimeout(nodeGameLoop, 16);
  }
}
nodeGameLoop();

*/

// ============================================================================
// Notes
// ============================================================================

/*
This example demonstrates:

1. Entity Management:
   - Creating entities from prefabs
   - Destroying entities
   - Entity pooling for bullets

2. Component Design:
   - Data-only components
   - Components with behavior methods
   - Component composition

3. System Architecture:
   - System priorities (higher runs first)
   - Fixed vs variable update systems
   - System lifecycle hooks (before/after)
   - Inter-system communication via message bus

4. Game Mechanics:
   - Player movement and shooting
   - Asteroid spawning and splitting
   - Collision detection
   - Health and lives system
   - Score tracking

5. Performance Optimization:
   - Component pooling for frequently created objects
   - Fixed timestep physics
   - Query-based entity filtering

To integrate with actual rendering:
- Add a canvas/WebGL renderer
- Implement the RenderSystem to draw sprites
- Add keyboard event listeners for input
- Use requestAnimationFrame for the game loop

To extend this example:
- Add power-ups
- Implement sound effects
- Add particle effects for explosions
- Implement a high score system
- Add multiple levels with increasing difficulty
- Implement UFOs as additional enemies
*/
