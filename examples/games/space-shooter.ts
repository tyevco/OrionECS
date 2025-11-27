/**
 * Space Shooter Game Example
 *
 * A classic vertical scrolling space shooter demonstrating OrionECS features:
 * - Entity creation and destruction with pooling
 * - Component-based design (Position, Velocity, Health, etc.)
 * - System organization with priorities
 * - Wave-based enemy spawning
 * - Power-up system
 * - Boss battles
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
 * Renderable sprite data
 */
class Renderable {
    constructor(
        public sprite: string,
        public width: number = 32,
        public height: number = 32,
        public color: string = '#FFFFFF'
    ) {}
}

/**
 * Rectangular collider for collision detection
 */
class Collider {
    constructor(
        public width: number = 32,
        public height: number = 32
    ) {}
}

/**
 * Health/damage system
 */
class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
    ) {}
}

/**
 * Damage value for projectiles
 */
class Damage {
    constructor(public value: number = 10) {}
}

/**
 * Player-specific data
 */
class Player {
    shootCooldown: number = 0;
    shootCooldownMax: number = 0.15; // Seconds between shots
    moveSpeed: number = 300;
    score: number = 0;
    lives: number = 3;
    powerLevel: number = 1; // 1-5
    invulnerable: number = 0; // Invulnerability timer
}

/**
 * Enemy-specific data
 */
class Enemy {
    constructor(
        public type: 'basic' | 'fast' | 'tank' | 'boss' = 'basic',
        public scoreValue: number = 100,
        public shootCooldown: number = 0,
        public shootCooldownMax: number = 1.5
    ) {}
}

/**
 * Bullet/projectile data
 */
class Bullet {
    constructor(
        public lifetime: number = 3.0,
        public owner: 'player' | 'enemy' = 'player'
    ) {}
}

/**
 * Power-up data
 */
class PowerUp {
    constructor(
        public type: 'health' | 'weapon' | 'shield' | 'speed' = 'weapon',
        public lifetime: number = 10.0
    ) {}
}

/**
 * Input state tracking
 */
class InputState {
    up: boolean = false;
    down: boolean = false;
    left: boolean = false;
    right: boolean = false;
    shoot: boolean = false;
}

/**
 * Wave/level data
 */
class WaveData {
    currentWave: number = 1;
    enemiesSpawned: number = 0;
    enemiesAlive: number = 0;
    waveComplete: boolean = false;
    waveTimer: number = 0;
    timeBetweenWaves: number = 3.0;
}

/**
 * Background layer for parallax scrolling
 */
class Background {
    constructor(
        public layer: number = 0,
        public scrollSpeed: number = 50
    ) {}
}

// ============================================================================
// Game Configuration
// ============================================================================

const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;
const PLAYER_BULLET_SPEED = 500;
const ENEMY_BULLET_SPEED = 300;
const ENEMY_BASE_SPEED = 100;

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
engine.registerComponentPool(Bullet, { initialSize: 50, maxSize: 200 });
engine.registerComponentPool(Position, { initialSize: 100, maxSize: 500 });
engine.registerComponentPool(Velocity, { initialSize: 100, maxSize: 500 });
engine.registerComponentPool(Enemy, { initialSize: 30, maxSize: 100 });
engine.registerComponentPool(PowerUp, { initialSize: 10, maxSize: 50 });

// ============================================================================
// Prefabs
// ============================================================================

/**
 * Player ship prefab
 */
engine.registerPrefab('Player', {
    name: 'Player',
    components: [
        { type: Position, args: [SCREEN_WIDTH / 2, SCREEN_HEIGHT - 100] },
        { type: Velocity, args: [0, 0] },
        { type: Renderable, args: ['player-ship', 48, 48, '#00FF00'] },
        { type: Collider, args: [40, 40] },
        { type: Health, args: [100, 100] },
        { type: Player, args: [] },
        { type: InputState, args: [] },
    ],
    tags: ['player', 'alive'],
});

/**
 * Player bullet prefab
 */
engine.registerPrefab('PlayerBullet', {
    name: 'PlayerBullet',
    components: [
        { type: Position, args: [0, 0] },
        { type: Velocity, args: [0, -PLAYER_BULLET_SPEED] },
        { type: Renderable, args: ['bullet', 8, 16, '#FFFF00'] },
        { type: Collider, args: [6, 14] },
        { type: Bullet, args: [3.0, 'player'] },
        { type: Damage, args: [20] },
    ],
    tags: ['bullet', 'player-bullet', 'alive'],
});

/**
 * Basic enemy prefab
 */
engine.registerPrefab('EnemyBasic', {
    name: 'EnemyBasic',
    components: [
        { type: Position, args: [0, -50] },
        { type: Velocity, args: [0, ENEMY_BASE_SPEED] },
        { type: Renderable, args: ['enemy-basic', 32, 32, '#FF4444'] },
        { type: Collider, args: [28, 28] },
        { type: Health, args: [50, 50] },
        { type: Enemy, args: ['basic', 100, 0, 1.5] },
    ],
    tags: ['enemy', 'alive'],
});

/**
 * Fast enemy prefab
 */
engine.registerPrefab('EnemyFast', {
    name: 'EnemyFast',
    components: [
        { type: Position, args: [0, -50] },
        { type: Velocity, args: [0, ENEMY_BASE_SPEED * 2] },
        { type: Renderable, args: ['enemy-fast', 24, 24, '#FF8844'] },
        { type: Collider, args: [20, 20] },
        { type: Health, args: [30, 30] },
        { type: Enemy, args: ['fast', 150, 0, 2.0] },
    ],
    tags: ['enemy', 'alive'],
});

/**
 * Tank enemy prefab
 */
engine.registerPrefab('EnemyTank', {
    name: 'EnemyTank',
    components: [
        { type: Position, args: [0, -50] },
        { type: Velocity, args: [0, ENEMY_BASE_SPEED * 0.5] },
        { type: Renderable, args: ['enemy-tank', 48, 48, '#FF0000'] },
        { type: Collider, args: [44, 44] },
        { type: Health, args: [200, 200] },
        { type: Enemy, args: ['tank', 300, 0, 1.0] },
    ],
    tags: ['enemy', 'alive'],
});

/**
 * Boss enemy prefab
 */
engine.registerPrefab('Boss', {
    name: 'Boss',
    components: [
        { type: Position, args: [SCREEN_WIDTH / 2, 100] },
        { type: Velocity, args: [50, 0] }, // Moves side to side
        { type: Renderable, args: ['boss', 96, 96, '#FF00FF'] },
        { type: Collider, args: [88, 88] },
        { type: Health, args: [1000, 1000] },
        { type: Enemy, args: ['boss', 5000, 0, 0.5] },
    ],
    tags: ['enemy', 'boss', 'alive'],
});

/**
 * Enemy bullet prefab
 */
engine.registerPrefab('EnemyBullet', {
    name: 'EnemyBullet',
    components: [
        { type: Position, args: [0, 0] },
        { type: Velocity, args: [0, ENEMY_BULLET_SPEED] },
        { type: Renderable, args: ['enemy-bullet', 8, 16, '#FF0000'] },
        { type: Collider, args: [6, 14] },
        { type: Bullet, args: [5.0, 'enemy'] },
        { type: Damage, args: [10] },
    ],
    tags: ['bullet', 'enemy-bullet', 'alive'],
});

/**
 * Health power-up prefab
 */
engine.registerPrefab('PowerUpHealth', {
    name: 'PowerUpHealth',
    components: [
        { type: Position, args: [0, 0] },
        { type: Velocity, args: [0, 100] },
        { type: Renderable, args: ['powerup-health', 24, 24, '#00FF00'] },
        { type: Collider, args: [20, 20] },
        { type: PowerUp, args: ['health', 10.0] },
    ],
    tags: ['powerup', 'alive'],
});

/**
 * Weapon power-up prefab
 */
engine.registerPrefab('PowerUpWeapon', {
    name: 'PowerUpWeapon',
    components: [
        { type: Position, args: [0, 0] },
        { type: Velocity, args: [0, 100] },
        { type: Renderable, args: ['powerup-weapon', 24, 24, '#FFFF00'] },
        { type: Collider, args: [20, 20] },
        { type: PowerUp, args: ['weapon', 10.0] },
    ],
    tags: ['powerup', 'alive'],
});

/**
 * Background layer prefabs
 */
engine.registerPrefab('BackgroundLayer1', {
    name: 'BackgroundLayer1',
    components: [
        { type: Position, args: [0, 0] },
        { type: Velocity, args: [0, 25] },
        { type: Renderable, args: ['bg-stars-1', SCREEN_WIDTH, SCREEN_HEIGHT, '#111111'] },
        { type: Background, args: [1, 25] },
    ],
    tags: ['background'],
});

engine.registerPrefab('BackgroundLayer2', {
    name: 'BackgroundLayer2',
    components: [
        { type: Position, args: [0, 0] },
        { type: Velocity, args: [0, 50] },
        { type: Renderable, args: ['bg-stars-2', SCREEN_WIDTH, SCREEN_HEIGHT, '#222222'] },
        { type: Background, args: [2, 50] },
    ],
    tags: ['background'],
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

            // Simulate AI behavior for testing
            if (Math.random() < 0.3) {
                input.left = Math.random() < 0.5;
                input.right = !input.left;
            } else {
                input.left = false;
                input.right = false;
            }

            // Shoot frequently
            input.shoot = Math.random() < 0.5;

            // Manage shoot cooldown
            if (player.shootCooldown > 0) {
                player.shootCooldown -= 1 / 60; // Fixed timestep
            }

            // Manage invulnerability timer
            if (player.invulnerable > 0) {
                player.invulnerable -= 1 / 60;
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
    { all: [Player, InputState, Position, Velocity] },
    {
        priority: 900,
        act: (
            _entity: EntityDef,
            player: Player,
            input: InputState,
            position: Position,
            velocity: Velocity
        ) => {
            // Movement
            velocity.dx = 0;
            velocity.dy = 0;

            if (input.left) {
                velocity.dx = -player.moveSpeed;
            }
            if (input.right) {
                velocity.dx = player.moveSpeed;
            }
            if (input.up) {
                velocity.dy = -player.moveSpeed;
            }
            if (input.down) {
                velocity.dy = player.moveSpeed;
            }

            // Shooting
            if (input.shoot && player.shootCooldown <= 0) {
                player.shootCooldown = player.shootCooldownMax;

                // Fire based on power level
                const bulletCount = Math.min(player.powerLevel, 5);
                const spreadAngle = Math.PI / 8; // 22.5 degrees

                for (let i = 0; i < bulletCount; i++) {
                    const bullet = engine.createFromPrefab(
                        'PlayerBullet',
                        `PlayerBullet_${Date.now()}_${i}`
                    );
                    const bulletPos = bullet.getComponent(Position);
                    const bulletVel = bullet.getComponent(Velocity);

                    // Position bullet at ship position
                    bulletPos.x = position.x;
                    bulletPos.y = position.y - 20;

                    // Calculate spread angle for multiple bullets
                    let angle = -Math.PI / 2; // Straight up
                    if (bulletCount > 1) {
                        const offset = (i - (bulletCount - 1) / 2) / (bulletCount - 1);
                        angle += offset * spreadAngle;
                    }

                    // Set bullet velocity
                    bulletVel.dx = Math.cos(angle) * PLAYER_BULLET_SPEED;
                    bulletVel.dy = Math.sin(angle) * PLAYER_BULLET_SPEED;
                }

                // Publish shoot event
                engine.messageBus.publish(
                    'player-shoot',
                    {
                        position: { x: position.x, y: position.y },
                        bulletCount,
                    },
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
        act: (entity: EntityDef, position: Position, velocity: Velocity) => {
            const dt = 1 / 60; // Fixed timestep

            position.x += velocity.dx * dt;
            position.y += velocity.dy * dt;

            // Keep player within bounds
            if (entity.hasTag('player')) {
                position.x = Math.max(20, Math.min(SCREEN_WIDTH - 20, position.x));
                position.y = Math.max(20, Math.min(SCREEN_HEIGHT - 20, position.y));
            }

            // Boss boundary (moves side to side)
            if (entity.hasTag('boss')) {
                if (position.x < 100 || position.x > SCREEN_WIDTH - 100) {
                    velocity.dx = -velocity.dx;
                }
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Background Scroll System
// ============================================================================

/**
 * Handles scrolling background layers
 */
engine.createSystem(
    'BackgroundScrollSystem',
    { all: [Position, Background] },
    {
        priority: 450,
        act: (_entity: EntityDef, position: Position, _background: Background) => {
            // Wrap background when it scrolls off screen
            if (position.y > SCREEN_HEIGHT) {
                position.y = -SCREEN_HEIGHT;
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Enemy AI System
// ============================================================================

/**
 * Controls enemy behavior and shooting
 */
engine.createSystem(
    'EnemyAISystem',
    { all: [Enemy, Position, Velocity] },
    {
        priority: 600,
        act: (_entity: EntityDef, enemy: Enemy, position: Position, velocity: Velocity) => {
            const dt = 1 / 60; // Fixed timestep

            // Update shoot cooldown
            if (enemy.shootCooldown > 0) {
                enemy.shootCooldown -= dt;
            } else {
                // Shoot at player
                enemy.shootCooldown = enemy.shootCooldownMax;

                const playerEntities = engine.getEntitiesByTag('player');
                if (playerEntities.length > 0) {
                    const playerPos = playerEntities[0].getComponent(Position);

                    // Calculate direction to player
                    const dx = playerPos.x - position.x;
                    const dy = playerPos.y - position.y;
                    const angle = Math.atan2(dy, dx);

                    // Create bullet
                    const bullet = engine.createFromPrefab(
                        'EnemyBullet',
                        `EnemyBullet_${Date.now()}`
                    );
                    const bulletPos = bullet.getComponent(Position);
                    const bulletVel = bullet.getComponent(Velocity);

                    bulletPos.x = position.x;
                    bulletPos.y = position.y + 20;

                    bulletVel.dx = Math.cos(angle) * ENEMY_BULLET_SPEED;
                    bulletVel.dy = Math.sin(angle) * ENEMY_BULLET_SPEED;
                }
            }

            // Boss additional behavior - add vertical movement pattern
            if (enemy.type === 'boss') {
                const time = engine.getTime();
                velocity.dy = Math.sin(time * 0.5) * 30;
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

                // Rectangle collision detection
                const rect1 = {
                    x: position.x - collider.width / 2,
                    y: position.y - collider.height / 2,
                    w: collider.width,
                    h: collider.height,
                };

                const rect2 = {
                    x: otherPos.x - otherCol.width / 2,
                    y: otherPos.y - otherCol.height / 2,
                    w: otherCol.width,
                    h: otherCol.height,
                };

                if (
                    rect1.x < rect2.x + rect2.w &&
                    rect1.x + rect1.w > rect2.x &&
                    rect1.y < rect2.y + rect2.h &&
                    rect1.y + rect1.h > rect2.y
                ) {
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
    // Player bullet hits enemy
    if (entity1.hasTag('player-bullet') && entity2.hasTag('enemy')) {
        const damage = entity1.getComponent(Damage);
        damageEntity(entity2, damage.value);
        destroyEntity(entity1);
    }
    // Enemy hits player bullet (reverse)
    else if (entity1.hasTag('enemy') && entity2.hasTag('player-bullet')) {
        const damage = entity2.getComponent(Damage);
        damageEntity(entity1, damage.value);
        destroyEntity(entity2);
    }
    // Enemy bullet hits player
    else if (entity1.hasTag('enemy-bullet') && entity2.hasTag('player')) {
        const damage = entity1.getComponent(Damage);
        damagePlayer(entity2, damage.value);
        destroyEntity(entity1);
    }
    // Player hits enemy bullet (reverse)
    else if (entity1.hasTag('player') && entity2.hasTag('enemy-bullet')) {
        const damage = entity2.getComponent(Damage);
        damagePlayer(entity1, damage.value);
        destroyEntity(entity2);
    }
    // Player hits enemy (collision damage)
    else if (entity1.hasTag('player') && entity2.hasTag('enemy')) {
        damagePlayer(entity1, 25);
        damageEntity(entity2, 50);
    }
    // Enemy hits player (reverse)
    else if (entity1.hasTag('enemy') && entity2.hasTag('player')) {
        damagePlayer(entity2, 25);
        damageEntity(entity1, 50);
    }
    // Player collects power-up
    else if (entity1.hasTag('player') && entity2.hasTag('powerup')) {
        collectPowerUp(entity1, entity2);
        destroyEntity(entity2);
    }
    // Power-up collected by player (reverse)
    else if (entity1.hasTag('powerup') && entity2.hasTag('player')) {
        collectPowerUp(entity2, entity1);
        destroyEntity(entity1);
    }
}

/**
 * Damage an entity
 */
function damageEntity(entity: EntityDef, damage: number): void {
    const health = entity.getComponent(Health);
    if (!health) return;

    health.current -= damage;

    if (health.current <= 0) {
        // Award score if enemy
        if (entity.hasTag('enemy')) {
            const enemy = entity.getComponent(Enemy);
            const playerEntities = engine.getEntitiesByTag('player');
            if (playerEntities.length > 0) {
                const player = playerEntities[0].getComponent(Player);
                player.score += enemy.scoreValue;
            }

            // Chance to drop power-up
            if (Math.random() < 0.2) {
                const powerUpType = Math.random() < 0.5 ? 'PowerUpHealth' : 'PowerUpWeapon';
                const powerUp = engine.createFromPrefab(powerUpType, `PowerUp_${Date.now()}`);
                const position = entity.getComponent(Position);
                const powerUpPos = powerUp.getComponent(Position);
                powerUpPos.x = position.x;
                powerUpPos.y = position.y;
            }

            // Publish enemy destroyed event
            engine.messageBus.publish(
                'enemy-destroyed',
                {
                    type: enemy.type,
                    score: enemy.scoreValue,
                },
                'CollisionSystem'
            );
        }

        destroyEntity(entity);
    }
}

/**
 * Damage the player
 */
function damagePlayer(entity: EntityDef, damage: number): void {
    const player = entity.getComponent(Player);
    const health = entity.getComponent(Health);

    // Check invulnerability
    if (player.invulnerable > 0) {
        return;
    }

    health.current -= damage;

    if (health.current <= 0) {
        player.lives--;

        if (player.lives > 0) {
            // Respawn player
            const position = entity.getComponent(Position);
            const velocity = entity.getComponent(Velocity);
            position.x = SCREEN_WIDTH / 2;
            position.y = SCREEN_HEIGHT - 100;
            velocity.dx = 0;
            velocity.dy = 0;
            health.current = health.max;
            player.invulnerable = 3.0; // 3 seconds invulnerability

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
    } else {
        // Brief invulnerability after getting hit
        player.invulnerable = 0.5;
    }
}

/**
 * Collect a power-up
 */
function collectPowerUp(playerEntity: EntityDef, powerUpEntity: EntityDef): void {
    const player = playerEntity.getComponent(Player);
    const health = playerEntity.getComponent(Health);
    const powerUp = powerUpEntity.getComponent(PowerUp);

    switch (powerUp.type) {
        case 'health':
            health.current = Math.min(health.current + 50, health.max);
            break;
        case 'weapon':
            player.powerLevel = Math.min(player.powerLevel + 1, 5);
            break;
        case 'shield':
            player.invulnerable = 5.0;
            break;
        case 'speed':
            player.moveSpeed = 400;
            break;
    }

    engine.messageBus.publish('powerup-collected', { type: powerUp.type }, 'CollisionSystem');
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
 * Removes bullets after their lifetime expires or they go off-screen
 */
engine.createSystem(
    'BulletLifetimeSystem',
    { all: [Bullet, Position] },
    {
        priority: 300,
        act: (entity: EntityDef, bullet: Bullet, position: Position) => {
            const dt = 1 / 60; // Fixed timestep
            bullet.lifetime -= dt;

            // Remove if lifetime expired or off-screen
            if (
                bullet.lifetime <= 0 ||
                position.x < -50 ||
                position.x > SCREEN_WIDTH + 50 ||
                position.y < -50 ||
                position.y > SCREEN_HEIGHT + 50
            ) {
                destroyEntity(entity);
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Power-Up Lifetime System
// ============================================================================

/**
 * Removes power-ups after their lifetime expires or they go off-screen
 */
engine.createSystem(
    'PowerUpLifetimeSystem',
    { all: [PowerUp, Position] },
    {
        priority: 300,
        act: (entity: EntityDef, powerUp: PowerUp, position: Position) => {
            const dt = 1 / 60; // Fixed timestep
            powerUp.lifetime -= dt;

            // Remove if lifetime expired or off-screen
            if (powerUp.lifetime <= 0 || position.y > SCREEN_HEIGHT + 50) {
                destroyEntity(entity);
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Enemy Cleanup System
// ============================================================================

/**
 * Removes enemies that go off-screen
 */
engine.createSystem(
    'EnemyCleanupSystem',
    { all: [Enemy, Position] },
    {
        priority: 250,
        act: (entity: EntityDef, enemy: Enemy, position: Position) => {
            // Remove enemies that go off bottom of screen (but not bosses)
            if (enemy.type !== 'boss' && position.y > SCREEN_HEIGHT + 100) {
                destroyEntity(entity);
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Wave Management System
// ============================================================================

/**
 * Manages enemy wave spawning
 */
let waveManager: WaveData | null = null;

engine.createSystem(
    'WaveManagementSystem',
    { all: [] }, // No entity query
    {
        priority: 200,
        before: () => {
            // Initialize wave manager on first run
            if (!waveManager) {
                waveManager = new WaveData();
            }
        },
        act: () => {
            if (!waveManager) return;

            const dt = 1 / 60; // Fixed timestep

            // Count alive enemies
            waveManager.enemiesAlive = engine.getEntitiesByTag('enemy').length;

            // Check if wave is complete
            if (
                waveManager.enemiesSpawned >= getEnemiesPerWave(waveManager.currentWave) &&
                waveManager.enemiesAlive === 0
            ) {
                waveManager.waveComplete = true;
                waveManager.waveTimer += dt;

                if (waveManager.waveTimer >= waveManager.timeBetweenWaves) {
                    // Start next wave
                    waveManager.currentWave++;
                    waveManager.enemiesSpawned = 0;
                    waveManager.waveComplete = false;
                    waveManager.waveTimer = 0;

                    engine.messageBus.publish(
                        'wave-start',
                        { wave: waveManager.currentWave },
                        'WaveManagementSystem'
                    );
                }
            }
        },
    },
    true // Fixed update
);

/**
 * Get number of enemies for a wave
 */
function getEnemiesPerWave(wave: number): number {
    return 5 + wave * 3;
}

// ============================================================================
// Enemy Spawner System
// ============================================================================

/**
 * Spawns enemies based on current wave
 */
engine.createSystem(
    'EnemySpawnerSystem',
    { all: [] }, // No entity query
    {
        priority: 150,
        act: () => {
            if (!waveManager || waveManager.waveComplete) return;

            const enemiesNeeded = getEnemiesPerWave(waveManager.currentWave);
            const canSpawn = waveManager.enemiesSpawned < enemiesNeeded;

            if (canSpawn && Math.random() < 0.02) {
                // 2% chance per frame to spawn
                spawnEnemy(waveManager.currentWave);
                waveManager.enemiesSpawned++;
            }

            // Spawn boss every 5 waves
            if (
                waveManager.currentWave % 5 === 0 &&
                waveManager.enemiesSpawned === 0 &&
                waveManager.enemiesAlive === 0
            ) {
                spawnBoss();
                waveManager.enemiesSpawned = enemiesNeeded; // Skip normal spawning for boss wave
            }
        },
    },
    true // Fixed update
);

/**
 * Spawn an enemy based on wave number
 */
function spawnEnemy(wave: number): void {
    const rand = Math.random();
    let prefabName = 'EnemyBasic';

    // Higher waves spawn more difficult enemies
    if (wave >= 3 && rand < 0.3) {
        prefabName = 'EnemyFast';
    } else if (wave >= 5 && rand < 0.15) {
        prefabName = 'EnemyTank';
    }

    const enemy = engine.createFromPrefab(prefabName, `Enemy_${Date.now()}`);
    const position = enemy.getComponent(Position);

    // Random horizontal position
    position.x = Math.random() * (SCREEN_WIDTH - 100) + 50;
    position.y = -50;
}

/**
 * Spawn a boss enemy
 */
function spawnBoss(): void {
    engine.createFromPrefab('Boss', `Boss_${Date.now()}`);
    engine.messageBus.publish('boss-spawn', {}, 'EnemySpawnerSystem');
}

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
            // - Draw sprite/shape at position
            // - Apply size and color
            // - Handle invulnerability flashing for player
        },
        after: () => {
            // Draw UI (simulated)
            // In real implementation:
            // - Score: player.score
            // - Lives: player.lives
            // - Health bar: health.current / health.max
            // - Power level: player.powerLevel
            // - Wave number: waveManager?.currentWave
        },
    },
    false // Variable update
);

// ============================================================================
// Message Bus Subscriptions
// ============================================================================

engine.messageBus.subscribe('enemy-destroyed', (message) => {
    console.log(`Enemy destroyed! Type: ${message.data.type}, Score: ${message.data.score}`);
});

engine.messageBus.subscribe('player-shoot', (_message) => {
    // Could play sound effect here
});

engine.messageBus.subscribe('player-respawn', (message) => {
    console.log(`Player respawned! Lives left: ${message.data.livesLeft}`);
});

engine.messageBus.subscribe('powerup-collected', (message) => {
    console.log(`Power-up collected! Type: ${message.data.type}`);
});

engine.messageBus.subscribe('wave-start', (message) => {
    console.log(`Wave ${message.data.wave} starting!`);
});

engine.messageBus.subscribe('boss-spawn', (_message) => {
    console.log('Boss spawned!');
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
    console.log('Initializing Space Shooter game...');

    // Create background layers
    engine.createFromPrefab('BackgroundLayer1', 'Background1');
    engine.createFromPrefab('BackgroundLayer2', 'Background2');
    console.log('Background layers created');

    // Create player
    const player = engine.createFromPrefab('Player', 'Player1');
    console.log('Player created:', player.name);

    // Initialize wave manager
    waveManager = new WaveData();

    // Start engine
    engine.start();
    console.log('Engine started');
    console.log('Wave 1 starting!');
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
    Renderable,
    Collider,
    Health,
    Damage,
    Player,
    Enemy,
    Bullet,
    PowerUp,
    InputState,
    WaveData,
    Background,
    // Functions
    initGame,
    gameLoop,
    // Engine
    engine,
    // Wave Manager
    waveManager,
};

// ============================================================================
// Usage Example
// ============================================================================

/*
// To run this game:

import { initGame, gameLoop } from './examples/games/space-shooter';

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
const maxFrames = 3600; // Run for 60 seconds at 60fps
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
   - Entity pooling for bullets and enemies
   - Background entities for parallax scrolling

2. Component Design:
   - Data-only components
   - Component composition
   - Health, damage, and power-up systems

3. System Architecture:
   - System priorities (higher runs first)
   - Fixed vs variable update systems
   - System lifecycle hooks (before/after)
   - Inter-system communication via message bus
   - Wave management system

4. Game Mechanics:
   - Player movement with boundary detection
   - Multi-bullet shooting with power-ups
   - Multiple enemy types (basic, fast, tank, boss)
   - Enemy AI with targeting
   - Wave-based spawning
   - Boss battles every 5 waves
   - Power-up collection system
   - Health and lives system
   - Score tracking
   - Invulnerability frames

5. Performance Optimization:
   - Component pooling for frequently created objects
   - Fixed timestep physics
   - Query-based entity filtering
   - Efficient collision detection

To integrate with actual rendering:
- Add a canvas/WebGL renderer
- Implement the RenderSystem to draw sprites
- Add keyboard event listeners for input
- Use requestAnimationFrame for the game loop
- Add sprite assets and animations
- Implement particle effects for explosions
- Add sound effects and music

To extend this example:
- Add more enemy types with unique behaviors
- Implement more power-up types (shield, bomb, etc.)
- Add visual effects for explosions and impacts
- Implement combo system for consecutive hits
- Add achievements and unlockables
- Implement difficulty scaling
- Add multiple player ships with different stats
- Implement local co-op multiplayer
*/
