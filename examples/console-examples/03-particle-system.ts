/**
 * Particle System Example
 * Demonstrates object pooling, bulk operations, and high-performance particle effects
 */

import { EngineBuilder } from '@orion-ecs/core';

// ============================================================================
// COMPONENTS (Pure data - no business logic)
// ============================================================================

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

class Lifetime {
    constructor(
        public current: number = 1.0,
        public max: number = 1.0
    ) {}
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getLifetimeNormalized(lifetime: Lifetime): number {
    return lifetime.current / lifetime.max;
}

function isLifetimeDead(lifetime: Lifetime): boolean {
    return lifetime.current <= 0;
}

class ParticleVisual {
    constructor(
        public size: number = 4,
        public color: string = '#ffffff',
        public alpha: number = 1.0,
        public shape: 'circle' | 'square' | 'star' = 'circle'
    ) {}
}

class ParticlePhysics {
    constructor(
        public gravity: number = 0,
        public drag: number = 0.98,
        public bounce: number = 0.8,
        public rotationSpeed: number = 0
    ) {}
}

class Emitter {
    constructor(
        public particlesPerSecond: number = 100,
        public spreadAngle: number = Math.PI * 2, // Full circle
        public initialSpeed: number = 100,
        public speedVariance: number = 50,
        public lifetime: number = 2.0,
        public lifetimeVariance: number = 0.5,
        public accumulator: number = 0
    ) {}
}

// Trail effect for some particles
class Trail {
    constructor(
        public positions: Array<{ x: number; y: number }> = [],
        public maxLength: number = 10
    ) {}
}

// Singleton for particle system configuration
class ParticleConfig {
    constructor(
        public maxParticles: number = 5000,
        public deltaTime: number = 0.016,
        public canvasWidth: number = 800,
        public canvasHeight: number = 600
    ) {}
}

// Initialize engine with optimizations for high-volume particle systems
const game = new EngineBuilder()
    .withDebugMode(true)
    .withFixedUpdateFPS(60)
    .withArchetypes(true) // Critical for particle system performance
    .withProfiling(true)
    .withErrorRecovery({
        defaultStrategy: 'skip',
        maxRetries: 1,
    })
    .build();

// Set up particle configuration singleton
game.setSingleton(ParticleConfig);

// Register component pools for high-churn particle components
// This is critical for particle systems to minimize GC pressure
game.registerComponentPool(Position, { initialSize: 1000, maxSize: 5000 });
game.registerComponentPool(Velocity, { initialSize: 1000, maxSize: 5000 });
game.registerComponentPool(Lifetime, { initialSize: 1000, maxSize: 5000 });
game.registerComponentPool(ParticleVisual, { initialSize: 1000, maxSize: 5000 });
game.registerComponentPool(ParticlePhysics, { initialSize: 1000, maxSize: 5000 });
game.registerComponentPool(Trail, { initialSize: 200, maxSize: 1000 });

// Particle Update System - handles physics
game.createSystem(
    'ParticlePhysicsSystem',
    {
        all: [Position, Velocity, ParticlePhysics],
        tags: ['particle'],
    },
    {
        priority: 100,
        act: (_entity, position, velocity, physics) => {
            // Apply gravity
            velocity.y += physics.gravity * 0.016;

            // Apply drag
            velocity.x *= physics.drag;
            velocity.y *= physics.drag;

            // Update position
            position.x += velocity.x * 0.016;
            position.y += velocity.y * 0.016;

            // Bounce off boundaries (assuming 800x600 canvas)
            if (position.x < 0 || position.x > 800) {
                velocity.x *= -physics.bounce;
                position.x = Math.max(0, Math.min(800, position.x));
            }
            if (position.y < 0 || position.y > 600) {
                velocity.y *= -physics.bounce;
                position.y = Math.max(0, Math.min(600, position.y));
            }
        },
    }
);

// Lifetime System - handles particle death and recycling
game.createSystem(
    'ParticleLifetimeSystem',
    {
        all: [Lifetime],
        tags: ['particle'],
    },
    {
        priority: 90,
        act: (entity, lifetime) => {
            lifetime.current -= 0.016;

            if (isLifetimeDead(lifetime)) {
                entity.queueFree();
            }
        },
    }
);

// Visual Update System - handles fading and size changes
game.createSystem(
    'ParticleVisualSystem',
    {
        all: [Lifetime, ParticleVisual],
        tags: ['particle'],
    },
    {
        priority: 80,
        act: (_entity, lifetime, visual) => {
            const normalized = getLifetimeNormalized(lifetime);

            // Fade out over lifetime
            visual.alpha = normalized;

            // Shrink slightly over time
            visual.size = 4 * (0.5 + 0.5 * normalized);
        },
    }
);

// Trail System - creates trail effects for certain particles
game.createSystem(
    'TrailSystem',
    {
        all: [Position, Trail],
        tags: ['particle'],
    },
    {
        priority: 70,
        act: (_entity, position, trail) => {
            // Add current position to trail
            trail.positions.push({ x: position.x, y: position.y });

            // Limit trail length
            if (trail.positions.length > trail.maxLength) {
                trail.positions.shift();
            }
        },
    }
);

// Emitter System - spawns new particles using command buffer for safe iteration
game.createSystem(
    'EmitterSystem',
    {
        all: [Position, Emitter],
        tags: ['emitter'],
    },
    {
        priority: 110,
        act: (_entity, position, emitter) => {
            const config = game.getSingleton(ParticleConfig)!;

            // Calculate how many particles to spawn this frame
            emitter.accumulator += emitter.particlesPerSecond * config.deltaTime;

            while (emitter.accumulator >= 1) {
                emitter.accumulator -= 1;

                // Calculate spawn velocity
                const angle = Math.random() * emitter.spreadAngle - emitter.spreadAngle / 2;
                const speed = emitter.initialSpeed + (Math.random() - 0.5) * emitter.speedVariance;
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;

                // Calculate lifetime
                const lifetime =
                    emitter.lifetime + (Math.random() - 0.5) * emitter.lifetimeVariance;

                // Use command buffer to safely spawn particles during system iteration
                // This prevents archetype invalidation during iteration
                const hasTrail = Math.random() < 0.2;
                const builder = game.commands
                    .spawn()
                    .with(Position, position.x, position.y)
                    .with(Velocity, vx, vy)
                    .with(Lifetime, lifetime, lifetime)
                    .with(ParticleVisual, 4, getRandomColor(), 1.0, getRandomShape())
                    .with(ParticlePhysics, 200, 0.99, 0.7, Math.random() * 10)
                    .withTag('particle');

                // Add trail to some particles
                if (hasTrail) {
                    builder.with(Trail, [], 15);
                }
            }
        },
    }
);

// Helper functions
function getRandomColor(): string {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function getRandomShape(): 'circle' | 'square' | 'star' {
    const shapes: Array<'circle' | 'square' | 'star'> = ['circle', 'square', 'star'];
    return shapes[Math.floor(Math.random() * shapes.length)];
}

// Create different types of emitters

// Fireworks emitter - upward burst
const fireworks = game.createEntity('Fireworks');
fireworks
    .addComponent(Position, 400, 500)
    .addComponent(Emitter, 500, Math.PI / 4, 300, 100, 1.5, 0.5)
    .addTag('emitter');

// Fountain emitter - continuous stream
const fountain = game.createEntity('Fountain');
fountain
    .addComponent(Position, 200, 400)
    .addComponent(Emitter, 200, Math.PI / 6, 200, 50, 2.0, 0.3)
    .addTag('emitter');

// Explosion emitter - circular burst
const explosion = game.createEntity('Explosion');
explosion
    .addComponent(Position, 600, 300)
    .addComponent(Emitter, 1000, Math.PI * 2, 400, 200, 0.8, 0.2)
    .addTag('emitter');

// Snow emitter - gentle falling particles
const snow = game.createEntity('Snow');
snow.addComponent(Position, 400, 50)
    .addComponent(Emitter, 50, Math.PI, 50, 20, 5.0, 1.0)
    .addTag('emitter');

// Modify snow particles to have different physics
game.messageBus.subscribe('entity-created', (_message) => {
    // This would be triggered by entity creation events if implemented
});

// Particle counter system for monitoring
let lastParticleCount = 0;
game.createSystem(
    'ParticleCounterSystem',
    {
        all: [],
    },
    {
        priority: 10,
        before: () => {
            const particles = game.getEntitiesByTag('particle').length;
            const emitters = game.getEntitiesByTag('emitter').length;

            if (particles !== lastParticleCount && particles % 100 === 0) {
                console.log(`Active Particles: ${particles}`);
                console.log(`Active Emitters: ${emitters}`);

                const memStats = game.getMemoryStats();
                console.log(`Memory Usage: ${(memStats.totalMemoryEstimate / 1024).toFixed(2)} KB`);
                console.log(
                    `Entity Pool Reuse Rate: ${((memStats.activeEntities / memStats.totalEntities) * 100).toFixed(2)}%\n`
                );

                lastParticleCount = particles;
            }
        },
    }
);

// Emitter control system - varies emission rates over time
let emitterTime = 0;
game.createSystem(
    'EmitterControlSystem',
    {
        all: [Emitter],
        tags: ['emitter'],
    },
    {
        priority: 120,
        act: (entity, emitter) => {
            emitterTime += 0.016;

            // Vary emission rates for dynamic effects
            switch (entity.name) {
                case 'Fireworks':
                    // Burst every 3 seconds
                    emitter.particlesPerSecond = Math.sin(emitterTime) > 0.9 ? 500 : 0;
                    break;
                case 'Fountain':
                    // Pulsing fountain
                    emitter.particlesPerSecond = 100 + Math.sin(emitterTime * 2) * 100;
                    break;
                case 'Explosion':
                    // Single burst then stop
                    if (emitterTime > 0.1) {
                        emitter.particlesPerSecond = 0;
                    }
                    break;
                case 'Snow':
                    // Gentle variation
                    emitter.particlesPerSecond = 50 + Math.sin(emitterTime * 0.5) * 20;
                    break;
            }
        },
    }
);

// Performance monitoring
setInterval(() => {
    const profiles = game.getSystemProfiles();
    console.log('\n=== Particle System Performance ===');
    profiles.forEach((profile) => {
        if (profile.entityCount > 0) {
            console.log(
                `${profile.name}: ${profile.averageTime.toFixed(2)}ms (${profile.entityCount} entities)`
            );
        }
    });

    // Show particle distribution
    const particles = game.getEntitiesByTag('particle');
    const withTrails = particles.filter((p) => p.hasComponent(Trail)).length;
    console.log(`\nParticles with trails: ${withTrails}/${particles.length}`);

    // Show component pool statistics - critical for particle systems
    const posPoolStats = game.getComponentPoolStats(Position);
    const lifetimePoolStats = game.getComponentPoolStats(Lifetime);
    if (posPoolStats && lifetimePoolStats) {
        console.log('\n=== Pool Statistics ===');
        console.log(
            `Position Pool: ${posPoolStats.available} available, ${(posPoolStats.reuseRate * 100).toFixed(1)}% reuse`
        );
        console.log(
            `Lifetime Pool: ${lifetimePoolStats.available} available, ${(lifetimePoolStats.reuseRate * 100).toFixed(1)}% reuse`
        );
    }

    // Show command buffer stats
    console.log(`Pending commands: ${game.commands.pendingCount}`);
}, 5000);

// Create a prefab for burst effects
const burstParticlePrefab = {
    name: 'BurstParticle',
    components: [
        { type: Position, args: [0, 0] },
        { type: Velocity, args: [0, 0] },
        { type: Lifetime, args: [1, 1] },
        { type: ParticleVisual, args: [6, '#ffff00', 1, 'star'] },
        { type: ParticlePhysics, args: [100, 0.95, 0.5, 5] },
    ],
    tags: ['particle', 'burst'],
};

game.registerPrefab('BurstParticle', burstParticlePrefab);

// Burst spawner - creates prefab particles
let burstTimer = 0;
game.createSystem(
    'BurstSpawnerSystem',
    {
        all: [],
    },
    {
        priority: 115,
        before: () => {
            burstTimer += 0.016;

            // Create burst every 2 seconds
            if (burstTimer > 2) {
                burstTimer = 0;

                const x = Math.random() * 800;
                const y = Math.random() * 600;

                // Create 50 particles in a burst using prefab
                const particles = game.createEntities(50, burstParticlePrefab);
                particles.forEach((particle, i) => {
                    const angle = (i / 50) * Math.PI * 2;
                    const speed = 200 + Math.random() * 100;

                    const pos = particle.getComponent(Position);
                    const vel = particle.getComponent(Velocity);

                    pos.x = x;
                    pos.y = y;
                    vel.x = Math.cos(angle) * speed;
                    vel.y = Math.sin(angle) * speed;
                });

                console.log(`💥 Burst created at (${x.toFixed(0)}, ${y.toFixed(0)})`);
            }
        },
    }
);

// Run the particle system
console.log('Starting Particle System Example...');
console.log('Features demonstrated:');
console.log('- High-performance particle effects');
console.log('- Component pooling for thousands of particles');
console.log('- Command buffer for safe entity spawning during iteration');
console.log('- Singleton configuration for particle settings');
console.log('- Different emitter types (fireworks, fountain, explosion, snow)');
console.log('- Particle physics with gravity and bounce');
console.log('- Trail effects for certain particles');
console.log('- Bulk entity creation with prefabs');
console.log('- Dynamic emission rate control');
console.log('- Archetype system for fast queries\n');

game.run();

// Stop after 60 seconds
setTimeout(() => {
    game.stop();
    console.log('\nParticle system stopped.');

    const debugInfo = game.getDebugInfo();
    console.log('\nFinal Statistics:');
    console.log(`Total entities created: ${game.getMemoryStats().totalEntities}`);
    console.log(`Peak active particles: ${game.getEntitiesByTag('particle').length}`);
    console.log(`Total systems: ${debugInfo.systems}`);
    console.log(`Total updates: ${debugInfo.steps}`);
}, 60000);
