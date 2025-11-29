/**
 * Basic Game Example
 * Demonstrates entity creation, movement, collision detection, and rendering
 */

import { EngineBuilder } from '@orion-ecs/core';

// Components
class Position {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

class Velocity {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

class Size {
    constructor(
        public width: number = 32,
        public height: number = 32
    ) {}
}

class Sprite {
    constructor(
        public texture: string = 'default',
        public color: string = '#ffffff'
    ) {}
}

class Collider {
    constructor(
        public solid: boolean = true,
        public trigger: boolean = false
    ) {}
}

class Player {
    constructor(public id: number = 1) {}
}

class Enemy {
    constructor(
        public type: string = 'basic',
        public speed: number = 50
    ) {}
}

class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
    ) {}
}

// Singleton component for global game configuration
class GameConfig {
    constructor(
        public screenWidth: number = 800,
        public screenHeight: number = 600,
        public deltaTime: number = 0.016
    ) {}
}

// Initialize engine with enhanced configuration
const game = new EngineBuilder()
    .withDebugMode(true)
    .withFixedUpdateFPS(60)
    .withArchetypes(true) // Enable archetype system for better performance
    .withProfiling(true) // Enable system profiling
    .withErrorRecovery({
        defaultStrategy: 'skip', // Skip failing systems instead of crashing
        maxRetries: 3,
        onError: (error) => {
            console.error(`System ${error.systemName} failed:`, error.error.message);
        },
    })
    .build();

// Set up global game configuration as a singleton
game.setSingleton(GameConfig, 800, 600, 0.016);

// Register component pools for frequently created/destroyed components
game.registerComponentPool(Position, { initialSize: 100, maxSize: 500 });
game.registerComponentPool(Velocity, { initialSize: 100, maxSize: 500 });

// Movement System - Highest priority, uses singleton for delta time
game.createSystem(
    'MovementSystem',
    {
        all: [Position, Velocity],
    },
    {
        priority: 100,
        act: (_entity, position, velocity) => {
            // Use singleton for consistent delta time across systems
            const config = game.getSingleton(GameConfig)!;

            position.x += velocity.x * config.deltaTime;
            position.y += velocity.y * config.deltaTime;

            // Apply friction
            velocity.x *= 0.98;
            velocity.y *= 0.98;
        },
    }
);

// Collision Detection System
game.createSystem(
    'CollisionSystem',
    {
        all: [Position, Size, Collider],
    },
    {
        priority: 90,
        act: (entity, position, size, collider) => {
            if (!collider.solid) return;

            // Check collisions with other collidable entities using query system
            const collidables = game
                .createQuery({
                    all: [Position, Size, Collider],
                })
                .getEntities();

            for (const other of collidables) {
                if (other === entity) continue;

                const otherPos = other.getComponent(Position);
                const otherSize = other.getComponent(Size);
                const otherCollider = other.getComponent(Collider);

                if (!otherCollider.solid && !otherCollider.trigger) continue;

                // AABB collision detection
                if (
                    position.x < otherPos.x + otherSize.width &&
                    position.x + size.width > otherPos.x &&
                    position.y < otherPos.y + otherSize.height &&
                    position.y + size.height > otherPos.y
                ) {
                    // Collision detected!
                    game.messageBus.publish(
                        'collision',
                        {
                            entity1: entity,
                            entity2: other,
                            trigger: otherCollider.trigger,
                        },
                        'CollisionSystem'
                    );

                    // Push entities apart if both are solid
                    if (collider.solid && otherCollider.solid) {
                        const dx = position.x + size.width / 2 - (otherPos.x + otherSize.width / 2);
                        const dy =
                            position.y + size.height / 2 - (otherPos.y + otherSize.height / 2);
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance > 0) {
                            const pushX = (dx / distance) * 2;
                            const pushY = (dy / distance) * 2;
                            position.x += pushX;
                            position.y += pushY;
                        }
                    }
                }
            }
        },
    }
);

// Enemy AI System
game.createSystem(
    'EnemyAISystem',
    {
        all: [Enemy, Position, Velocity],
        withoutTags: ['dead'],
    },
    {
        priority: 80,
        act: (_entity, enemy, position, velocity) => {
            // Find player
            const players = game.getEntitiesByTag('player');
            if (players.length === 0) return;

            const player = players[0];
            if (!player.hasComponent(Position)) return;

            const playerPos = player.getComponent(Position);

            // Move towards player
            const dx = playerPos.x - position.x;
            const dy = playerPos.y - position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 50) {
                // Don't get too close
                velocity.x = (dx / distance) * enemy.speed;
                velocity.y = (dy / distance) * enemy.speed;
            } else {
                velocity.x *= 0.5;
                velocity.y *= 0.5;
            }
        },
    }
);

// Damage System - responds to collision events
game.messageBus.subscribe('collision', (message) => {
    const { entity1, entity2, trigger } = message.data;

    // Check if it's a player-enemy collision
    const isPlayerEnemy =
        (entity1.hasTag('player') && entity2.hasTag('enemy')) ||
        (entity1.hasTag('enemy') && entity2.hasTag('player'));

    if (isPlayerEnemy && !trigger) {
        // Deal damage to player
        const player = entity1.hasTag('player') ? entity1 : entity2;
        if (player.hasComponent(Health)) {
            const health = player.getComponent(Health);
            health.current -= 10;

            if (health.current <= 0) {
                player.addTag('dead');
                game.messageBus.publish('player-death', { player }, 'DamageSystem');
            }
        }
    }
});

// Health Bar Rendering System
game.createSystem(
    'HealthBarSystem',
    {
        all: [Position, Health],
        tags: ['player'],
    },
    {
        priority: 20,
        act: (_entity, _position, health) => {
            const percentage = health.current / health.max;
            const color = percentage > 0.5 ? '#00ff00' : percentage > 0.25 ? '#ffff00' : '#ff0000';

            // In a real game, this would render to canvas
            console.log(`Health: ${health.current}/${health.max} [${color}]`);
        },
    }
);

// Create player entity
const player = game.createEntity('Player1');
player
    .addComponent(Position, 400, 300)
    .addComponent(Velocity, 0, 0)
    .addComponent(Size, 32, 32)
    .addComponent(Sprite, 'player', '#00ff00')
    .addComponent(Collider, true, false)
    .addComponent(Player, 1)
    .addComponent(Health, 100, 100)
    .addTag('player')
    .addTag('controllable');

// Create enemy prefab
const enemyPrefab = {
    name: 'BasicEnemy',
    components: [
        { type: Position, args: [0, 0] },
        { type: Velocity, args: [0, 0] },
        { type: Size, args: [24, 24] },
        { type: Sprite, args: ['enemy', '#ff0000'] },
        { type: Collider, args: [true, false] },
        { type: Enemy, args: ['basic', 50] },
        { type: Health, args: [50, 50] },
    ],
    tags: ['enemy', 'hostile'],
};

game.registerPrefab('BasicEnemy', enemyPrefab);

// Spawn enemies at random positions
for (let i = 0; i < 5; i++) {
    const enemy = game.createFromPrefab('BasicEnemy', `Enemy${i}`);
    if (enemy) {
        const pos = enemy.getComponent(Position);
        pos.x = Math.random() * 800;
        pos.y = Math.random() * 600;
    }
}

// Create walls
for (let i = 0; i < 10; i++) {
    const wall = game.createEntity(`Wall${i}`);
    wall.addComponent(Position, Math.random() * 800, Math.random() * 600)
        .addComponent(Size, 64, 64)
        .addComponent(Sprite, 'wall', '#808080')
        .addComponent(Collider, true, false)
        .addTag('wall')
        .addTag('static');
}

// Input handling (simulated)
let inputTimer = 0;
game.createSystem(
    'InputSystem',
    {
        tags: ['controllable'],
        all: [Velocity],
    },
    {
        priority: 110,
        act: (_entity, velocity) => {
            // Simulate WASD input
            inputTimer += 0.016;
            const speed = 200;

            // Simple pattern movement for demo
            velocity.x = Math.sin(inputTimer) * speed;
            velocity.y = Math.cos(inputTimer * 0.7) * speed;
        },
    }
);

// Performance monitoring
setInterval(() => {
    const profiles = game.getSystemProfiles();
    console.log('\n=== Performance Stats ===');
    profiles.forEach((profile) => {
        console.log(
            `${profile.name}: ${profile.averageTime.toFixed(2)}ms (${profile.entityCount} entities)`
        );
    });

    const memStats = game.getMemoryStats();
    console.log(`Active Entities: ${memStats.activeEntities}`);
    console.log(`Memory Estimate: ${(memStats.totalMemoryEstimate / 1024).toFixed(2)} KB`);

    // Show component pool statistics
    const posPoolStats = game.getComponentPoolStats(Position);
    const velPoolStats = game.getComponentPoolStats(Velocity);
    if (posPoolStats && velPoolStats) {
        console.log(
            `Position Pool: ${posPoolStats.available} available, ${(posPoolStats.reuseRate * 100).toFixed(1)}% reuse rate`
        );
        console.log(
            `Velocity Pool: ${velPoolStats.available} available, ${(velPoolStats.reuseRate * 100).toFixed(1)}% reuse rate`
        );
    }

    // Show archetype stats if enabled
    if (game.areArchetypesEnabled()) {
        const archetypeStats = game.getArchetypeStats();
        console.log(`Archetypes: ${archetypeStats.archetypeCount} groups`);
    }
}, 5000);

// Run the game
console.log('Starting Basic Game Example...');
console.log('Features demonstrated:');
console.log('- Entity creation with components');
console.log('- Movement and collision systems');
console.log('- Enemy AI following player');
console.log('- Health and damage system');
console.log('- Message bus for collision events');
console.log('- Performance monitoring');
console.log('- Singleton components for global config');
console.log('- Component pooling for performance');
console.log('- Error recovery configuration');
console.log('- Archetype system for faster queries\n');

game.run();

// Stop after 30 seconds for demo
setTimeout(() => {
    game.stop();
    console.log('\nGame stopped.');

    // Show debug info
    const debugInfo = game.getDebugInfo();
    console.log('Final Debug Info:', debugInfo);
}, 30000);
