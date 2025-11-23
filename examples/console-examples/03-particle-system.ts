/**
 * Particle System Example
 * Demonstrates object pooling, bulk operations, and high-performance particle effects
 */

import { Engine } from '../src/engine';

// Particle Components
class Position {
    constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
    constructor(public x: number = 0, public y: number = 0) {}
}

class Lifetime {
    constructor(
        public current: number = 1.0,
        public max: number = 1.0
    ) {}
    
    get normalized() { return this.current / this.max; }
    get isDead() { return this.current <= 0; }
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
        public positions: Array<{x: number, y: number}> = [],
        public maxLength: number = 10
    ) {}
}

// Initialize engine
const game = new Engine(60, true);

// Particle Update System - handles physics
game.createSystem('ParticlePhysicsSystem', {
    all: [Position, Velocity, ParticlePhysics],
    tags: ['particle']
}, {
    priority: 100,
    act: (entity, position, velocity, physics) => {
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
    }
});

// Lifetime System - handles particle death and recycling
game.createSystem('ParticleLifetimeSystem', {
    all: [Lifetime],
    tags: ['particle']
}, {
    priority: 90,
    act: (entity, lifetime) => {
        lifetime.current -= 0.016;
        
        if (lifetime.isDead) {
            entity.queueFree();
        }
    }
});

// Visual Update System - handles fading and size changes
game.createSystem('ParticleVisualSystem', {
    all: [Lifetime, ParticleVisual],
    tags: ['particle']
}, {
    priority: 80,
    act: (entity, lifetime, visual) => {
        // Fade out over lifetime
        visual.alpha = lifetime.normalized;
        
        // Shrink slightly over time
        visual.size = 4 * (0.5 + 0.5 * lifetime.normalized);
    }
});

// Trail System - creates trail effects for certain particles
game.createSystem('TrailSystem', {
    all: [Position, Trail],
    tags: ['particle']
}, {
    priority: 70,
    act: (entity, position, trail) => {
        // Add current position to trail
        trail.positions.push({ x: position.x, y: position.y });
        
        // Limit trail length
        if (trail.positions.length > trail.maxLength) {
            trail.positions.shift();
        }
    }
});

// Emitter System - spawns new particles
game.createSystem('EmitterSystem', {
    all: [Position, Emitter],
    tags: ['emitter']
}, {
    priority: 110,
    act: (entity, position, emitter) => {
        // Calculate how many particles to spawn this frame
        emitter.accumulator += emitter.particlesPerSecond * 0.016;
        
        while (emitter.accumulator >= 1) {
            emitter.accumulator -= 1;
            
            // Calculate spawn velocity
            const angle = Math.random() * emitter.spreadAngle - emitter.spreadAngle / 2;
            const speed = emitter.initialSpeed + (Math.random() - 0.5) * emitter.speedVariance;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            
            // Calculate lifetime
            const lifetime = emitter.lifetime + (Math.random() - 0.5) * emitter.lifetimeVariance;
            
            // Create particle
            const particle = game.createEntity();
            particle.addComponent(Position, position.x, position.y)
                   .addComponent(Velocity, vx, vy)
                   .addComponent(Lifetime, lifetime, lifetime)
                   .addComponent(ParticleVisual, 4, getRandomColor(), 1.0, getRandomShape())
                   .addComponent(ParticlePhysics, 200, 0.99, 0.7, Math.random() * 10)
                   .addTag('particle');
            
            // Add trail to some particles
            if (Math.random() < 0.2) {
                particle.addComponent(Trail, [], 15);
            }
        }
    }
});

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
fireworks.addComponent(Position, 400, 500)
         .addComponent(Emitter, 500, Math.PI / 4, 300, 100, 1.5, 0.5)
         .addTag('emitter');

// Fountain emitter - continuous stream
const fountain = game.createEntity('Fountain');
fountain.addComponent(Position, 200, 400)
        .addComponent(Emitter, 200, Math.PI / 6, 200, 50, 2.0, 0.3)
        .addTag('emitter');

// Explosion emitter - circular burst
const explosion = game.createEntity('Explosion');
explosion.addComponent(Position, 600, 300)
         .addComponent(Emitter, 1000, Math.PI * 2, 400, 200, 0.8, 0.2)
         .addTag('emitter');

// Snow emitter - gentle falling particles
const snow = game.createEntity('Snow');
snow.addComponent(Position, 400, 50)
    .addComponent(Emitter, 50, Math.PI, 50, 20, 5.0, 1.0)
    .addTag('emitter');

// Modify snow particles to have different physics
game.messageBus.subscribe('entity-created', (message) => {
    // This would be triggered by entity creation events if implemented
});

// Particle counter system for monitoring
let lastParticleCount = 0;
game.createSystem('ParticleCounterSystem', {
    all: []
}, {
    priority: 10,
    before: () => {
        const particles = game.getEntitiesByTag('particle').length;
        const emitters = game.getEntitiesByTag('emitter').length;
        
        if (particles !== lastParticleCount && particles % 100 === 0) {
            console.log(`Active Particles: ${particles}`);
            console.log(`Active Emitters: ${emitters}`);
            
            const memStats = game.getMemoryStats();
            console.log(`Memory Usage: ${(memStats.totalMemoryEstimate / 1024).toFixed(2)} KB`);
            console.log(`Entity Pool Reuse Rate: ${(memStats.activeEntities / memStats.totalEntities * 100).toFixed(2)}%\n`);
            
            lastParticleCount = particles;
        }
    }
});

// Emitter control system - varies emission rates over time
let emitterTime = 0;
game.createSystem('EmitterControlSystem', {
    all: [Emitter],
    tags: ['emitter']
}, {
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
    }
});

// Performance monitoring
setInterval(() => {
    const profiles = game.getSystemProfiles();
    console.log('\n=== Particle System Performance ===');
    profiles.forEach(profile => {
        if (profile.entityCount > 0) {
            console.log(`${profile.name}: ${profile.averageTime.toFixed(2)}ms (${profile.entityCount} entities)`);
        }
    });
    
    // Show particle distribution
    const particles = game.getEntitiesByTag('particle');
    const withTrails = particles.filter(p => p.hasComponent(Trail)).length;
    console.log(`\nParticles with trails: ${withTrails}/${particles.length}`);
}, 5000);

// Create a prefab for burst effects
const burstParticlePrefab = {
    name: 'BurstParticle',
    components: [
        { type: Position, args: [0, 0] },
        { type: Velocity, args: [0, 0] },
        { type: Lifetime, args: [1, 1] },
        { type: ParticleVisual, args: [6, '#ffff00', 1, 'star'] },
        { type: ParticlePhysics, args: [100, 0.95, 0.5, 5] }
    ],
    tags: ['particle', 'burst']
};

game.registerPrefab('BurstParticle', burstParticlePrefab);

// Burst spawner - creates prefab particles
let burstTimer = 0;
game.createSystem('BurstSpawnerSystem', {
    all: []
}, {
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
    }
});

// Run the particle system
console.log('Starting Particle System Example...');
console.log('Features demonstrated:');
console.log('- High-performance particle effects');
console.log('- Object pooling for thousands of entities');
console.log('- Different emitter types (fireworks, fountain, explosion, snow)');
console.log('- Particle physics with gravity and bounce');
console.log('- Trail effects for certain particles');
console.log('- Bulk entity creation with prefabs');
console.log('- Dynamic emission rate control\n');

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