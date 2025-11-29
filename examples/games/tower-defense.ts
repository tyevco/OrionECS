/**
 * Tower Defense Game Example
 *
 * Demonstrates OrionECS features in a classic tower defense game:
 * - Entity creation and destruction
 * - Component-based design (Position, Health, Damage, Tower, Enemy, Projectile)
 * - System organization with priorities
 * - Fixed update for game logic
 * - Inter-system messaging
 * - Tag-based entity management
 * - Dynamic entity spawning
 *
 * Ported from v1 OrionECS-Examples repository
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
 * Health points
 */
class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
    ) {}
}

/**
 * Damage amount for attacks
 */
class Damage {
    constructor(public amount: number = 10) {}
}

/**
 * Movement speed component
 */
class Movement {
    constructor(public speed: number = 1) {}
}

/**
 * Tower component with firing capabilities
 */
class Tower {
    constructor(
        public range: number = 100,
        public fireRate: number = 30, // Frames between shots
        public lastFired: number = 0
    ) {}
}

/**
 * Enemy marker component (tag component)
 */
class Enemy {
    readonly isEnemy = true;
}

/**
 * Projectile component tracking target
 */
class Projectile {
    constructor(public targetId: symbol | null = null) {}
}

/**
 * Renderable component for visual representation
 */
class Renderable {
    constructor(
        public color: string = '#FFFFFF',
        public size: number = 10
    ) {}
}

/**
 * Game timer for tracking steps/frames
 */
class GameTimer {
    constructor(public steps: number = 0) {}
}

// ============================================================================
// Game Configuration
// ============================================================================

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const PROJECTILE_SPEED = 5;
const ENEMY_SPAWN_INTERVAL = 2000; // milliseconds

// ============================================================================
// Engine Setup
// ============================================================================

const engine = new EngineBuilder()
    .withDebugMode(false)
    .withFixedUpdateFPS(60)
    .withMaxFixedIterations(10)
    .withArchetypes(true) // Enable archetype system for better query performance
    .withProfiling(true) // Enable system profiling
    .withErrorRecovery({
        defaultStrategy: 'skip',
        maxRetries: 2,
        onError: (error) => {
            console.error(`Game system ${error.systemName} error:`, error.error.message);
        },
    })
    .build();

// ============================================================================
// Component Pooling
// ============================================================================

// Pool frequently created/destroyed components for performance
engine.registerComponentPool(Projectile, { initialSize: 20, maxSize: 100 });
engine.registerComponentPool(Position, { initialSize: 50, maxSize: 200 });
engine.registerComponentPool(Damage, { initialSize: 30, maxSize: 100 });

// ============================================================================
// Game Timer System
// ============================================================================

/**
 * Tracks game time/steps
 */
engine.createSystem(
    'GameTimerSystem',
    { all: [GameTimer] },
    {
        priority: 1000, // Run first
        act: (_entity: EntityDef, timer: GameTimer) => {
            timer.steps++;
        },
    },
    true // Fixed update
);

// ============================================================================
// Movement System
// ============================================================================

/**
 * Moves entities based on their Movement component
 */
engine.createSystem(
    'MovementSystem',
    { all: [Position, Movement] },
    {
        priority: 800,
        act: (entity: EntityDef, position: Position, movement: Movement) => {
            position.x += movement.speed;

            // Remove enemies that moved off screen
            if (entity.hasTag('enemy') && position.x > CANVAS_WIDTH + 50) {
                entity.queueFree();
                engine.messageBus.publish('enemy-escaped', {}, 'MovementSystem');
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Tower Firing System
// ============================================================================

/**
 * Towers detect enemies in range and fire projectiles
 */
engine.createSystem(
    'TowerFiringSystem',
    { all: [Tower, Position], tags: ['tower'] },
    {
        priority: 700,
        act: (entity: EntityDef, tower: Tower, position: Position) => {
            // Get game timer
            const timerEntities = engine.getEntitiesByTag('timer');
            if (timerEntities.length === 0) return;

            const timer = timerEntities[0].getComponent(GameTimer);

            if (timer.steps - tower.lastFired >= tower.fireRate) {
                // Find closest enemy in range
                const enemies = engine.getEntitiesByTag('enemy');
                let closestEnemy: EntityDef | null = null;
                let closestDistance = Infinity;

                for (const enemy of enemies) {
                    if (!enemy.hasComponent(Position)) continue;

                    const enemyPos = enemy.getComponent(Position);
                    const dx = enemyPos.x - position.x;
                    const dy = enemyPos.y - position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance <= tower.range && distance < closestDistance) {
                        closestDistance = distance;
                        closestEnemy = enemy;
                    }
                }

                if (closestEnemy) {
                    // Create projectile
                    const projectile = engine.createEntity(`Projectile_${timer.steps}`);
                    projectile.addComponent(Position, position.x, position.y);
                    projectile.addComponent(Projectile, closestEnemy.id);
                    projectile.addComponent(Damage, 10);
                    projectile.addComponent(Renderable, 'black', 5);
                    projectile.addTag('projectile');

                    tower.lastFired = timer.steps;

                    // Publish firing event
                    engine.messageBus.publish(
                        'tower-fired',
                        {
                            towerId: entity.id,
                            targetId: closestEnemy.id,
                        },
                        'TowerFiringSystem'
                    );
                }
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Projectile Movement System
// ============================================================================

/**
 * Moves projectiles toward targets and handles collisions
 */
engine.createSystem(
    'ProjectileMovementSystem',
    { all: [Projectile, Position], tags: ['projectile'] },
    {
        priority: 600,
        act: (entity: EntityDef, projectile: Projectile, position: Position) => {
            if (!projectile.targetId) {
                entity.queueFree();
                return;
            }

            // Find target entity
            const target = engine.getEntityById(projectile.targetId);

            if (!target || !target.hasComponent(Position)) {
                // Target is gone, remove projectile
                entity.queueFree();
                return;
            }

            const targetPos = target.getComponent(Position);
            const dx = targetPos.x - position.x;
            const dy = targetPos.y - position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 5) {
                // Hit the target
                if (target.hasComponent(Health)) {
                    const health = target.getComponent(Health);
                    const damage = entity.getComponent(Damage);
                    health.current -= damage.amount;

                    engine.messageBus.publish(
                        'enemy-hit',
                        {
                            enemyId: target.id,
                            damage: damage.amount,
                            remainingHealth: health.current,
                        },
                        'ProjectileMovementSystem'
                    );
                }
                entity.queueFree();
            } else {
                // Move towards target
                position.x += (dx / distance) * PROJECTILE_SPEED;
                position.y += (dy / distance) * PROJECTILE_SPEED;
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Health System
// ============================================================================

/**
 * Removes entities when health reaches zero
 */
engine.createSystem(
    'HealthSystem',
    { all: [Health] },
    {
        priority: 500,
        act: (entity: EntityDef, health: Health) => {
            if (health.current <= 0) {
                const isEnemy = entity.hasTag('enemy');
                entity.queueFree();

                if (isEnemy) {
                    engine.messageBus.publish(
                        'enemy-killed',
                        { enemyId: entity.id },
                        'HealthSystem'
                    );
                }
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Render System (Simulated)
// ============================================================================

/**
 * Simulated rendering system - renders all entities with Position and Renderable
 * In a real game this would draw to canvas/WebGL
 */
engine.createSystem(
    'RenderSystem',
    { all: [Position, Renderable] },
    {
        priority: -100, // Run last
        before: () => {
            // Clear screen (simulated)
            // In browser implementation: ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        },
        act: (_entity: EntityDef, _position: Position, _renderable: Renderable) => {
            // Draw entity (simulated)
            // In browser implementation:
            // ctx.fillStyle = _renderable.color;
            // ctx.fillRect(
            //   _position.x - _renderable.size / 2,
            //   _position.y - _renderable.size / 2,
            //   _renderable.size,
            //   _renderable.size
            // );
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

engine.messageBus.subscribe('tower-fired', (_message) => {
    // Could play sound effect here
});

engine.messageBus.subscribe('enemy-hit', (message) => {
    console.log(
        `Enemy hit! Damage: ${message.data.damage}, Health: ${message.data.remainingHealth}`
    );
});

engine.messageBus.subscribe('enemy-killed', (_message) => {
    console.log('Enemy killed!');
});

engine.messageBus.subscribe('enemy-escaped', (_message) => {
    console.log('Enemy escaped!');
});

// ============================================================================
// Game Initialization
// ============================================================================

/**
 * Initialize the game
 */
function initGame(): void {
    console.log('Initializing Tower Defense game...');

    // Create game timer
    const timer = engine.createEntity('GameTimer');
    timer.addComponent(GameTimer, 0);
    timer.addTag('timer');

    // Create tower 1
    const tower1 = engine.createEntity('Tower1');
    tower1.addComponent(Position, 100, 100);
    tower1.addComponent(Tower, 100, 30); // range=100, fireRate=30 frames
    tower1.addComponent(Renderable, 'blue', 20);
    tower1.addTag('tower');
    console.log('Tower 1 created at (100, 100)');

    // Create tower 2
    const tower2 = engine.createEntity('Tower2');
    tower2.addComponent(Position, 300, 100);
    tower2.addComponent(Tower, 120, 40); // range=120, fireRate=40 frames
    tower2.addComponent(Renderable, 'blue', 20);
    tower2.addTag('tower');
    console.log('Tower 2 created at (300, 100)');

    // Start engine
    engine.start();
    console.log('Engine started');
}

/**
 * Spawn a new enemy
 */
function spawnEnemy(): void {
    const timerEntities = engine.getEntitiesByTag('timer');
    if (timerEntities.length === 0) return;

    const timer = timerEntities[0].getComponent(GameTimer);

    const enemy = engine.createEntity(`Enemy_${timer.steps}`);
    enemy.addComponent(Enemy);
    enemy.addComponent(Position, 0, Math.random() * CANVAS_HEIGHT);
    enemy.addComponent(Movement, 1);
    enemy.addComponent(Health, 50, 50);
    enemy.addComponent(Renderable, 'red', 15);
    enemy.addTag('enemy');

    console.log(`Enemy spawned at y=${enemy.getComponent(Position).y.toFixed(2)}`);
}

// ============================================================================
// Game Loop
// ============================================================================

let enemySpawnTimer: NodeJS.Timeout | null = null;

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

/**
 * Start the game
 */
function startGame(): void {
    initGame();

    // Spawn enemies periodically
    enemySpawnTimer = setInterval(spawnEnemy, ENEMY_SPAWN_INTERVAL);

    // Note: In a real implementation, you would start the game loop here
    // For Node.js testing:
    // let frameCount = 0;
    // const maxFrames = 600; // Run for 10 seconds at 60fps
    // function nodeGameLoop() {
    //   gameLoop();
    //   frameCount++;
    //   if (frameCount < maxFrames) {
    //     setTimeout(nodeGameLoop, 16);
    //   } else {
    //     if (enemySpawnTimer) clearInterval(enemySpawnTimer);
    //   }
    // }
    // nodeGameLoop();
}

/**
 * Stop the game
 */
function stopGame(): void {
    if (enemySpawnTimer) {
        clearInterval(enemySpawnTimer);
        enemySpawnTimer = null;
    }
    engine.stop();
    console.log('Game stopped');
}

// ============================================================================
// Export for use in other files
// ============================================================================

export {
    // Components
    Position,
    Health,
    Damage,
    Movement,
    Tower,
    Enemy,
    Projectile,
    Renderable,
    GameTimer,
    // Constants
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    PROJECTILE_SPEED,
    ENEMY_SPAWN_INTERVAL,
    // Functions
    initGame,
    spawnEnemy,
    gameLoop,
    startGame,
    stopGame,
    // Engine
    engine,
};

// ============================================================================
// Usage Example
// ============================================================================

/*
// To run this game:

import { startGame, stopGame } from './examples/games/tower-defense';

// Start the game
startGame();

// Stop the game (cleanup)
// stopGame();

// For browser integration, see tower-defense-browser.ts
*/

// ============================================================================
// Notes
// ============================================================================

/*
This example demonstrates:

1. V1 to V2 Migration:
   - Engine() → EngineBuilder().build()
   - createSystem([Components], {}) → createSystem('Name', { all: [] }, {})
   - entity.hasComponent('Name') → entity.hasComponent(ComponentClass)
   - entity.components.X → entity.getComponent(X)
   - addComponent(new X()) → addComponent(X, args...)
   - Direct entity array manipulation → entity.queueFree()
   - game.steps tracking → GameTimer component

2. Core ECS Patterns:
   - Component-based design with data-only components
   - Systems with priorities and lifecycle hooks
   - Entity creation and destruction
   - Tag-based entity categorization
   - Component pooling for performance

3. Game Mechanics:
   - Tower placement and targeting
   - Enemy spawning and movement
   - Projectile tracking and collision
   - Health and damage system
   - Range-based detection

4. Advanced Features:
   - Inter-system messaging (tower-fired, enemy-hit, etc.)
   - Fixed timestep for consistent physics
   - Entity pooling for frequently spawned objects
   - Dynamic entity spawning at runtime

To extend this example:
- Add multiple tower types with different behaviors
- Implement wave-based enemy spawning
- Add resources/currency for tower placement
- Implement tower upgrades
- Add enemy paths/waypoints
- Create boss enemies
- Add special effects and animations
- Implement save/load functionality
*/
