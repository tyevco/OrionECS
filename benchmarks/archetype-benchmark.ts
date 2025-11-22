/**
 * Archetype System Performance Benchmarks
 * Compares performance with and without archetypes enabled
 */

import { benchmarkSuite } from 'jest-bench';
import { EngineBuilder } from '../core/src/engine';

// Test components
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

class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
    ) {}
}

class Transform {
    constructor(
        public x: number = 0,
        public y: number = 0,
        public rotation: number = 0
    ) {}
}

class Renderable {
    constructor(
        public sprite: string = 'default',
        public layer: number = 0
    ) {}
}

benchmarkSuite('Archetype System Performance', {
    // ===== ITERATION PERFORMANCE =====

    'Iteration: 10000 entities (Archetypes ENABLED)': () => {
        const engine = new EngineBuilder().withArchetypes(true).withDebugMode(false).build();

        // Create 10000 entities with same component composition
        for (let i = 0; i < 10000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, i, i);
            entity.addComponent(Velocity, 1, 1);
        }

        // Create system that iterates over all entities
        engine.createSystem(
            'MovementSystem',
            { all: [Position, Velocity] },
            {
                act: (entity, position, velocity) => {
                    position.x += velocity.x;
                    position.y += velocity.y;
                },
            }
        );

        // Run 100 updates
        for (let i = 0; i < 100; i++) {
            engine.update(16);
        }
    },

    'Iteration: 10000 entities (Archetypes DISABLED)': () => {
        const engine = new EngineBuilder().withArchetypes(false).withDebugMode(false).build();

        // Create 10000 entities with same component composition
        for (let i = 0; i < 10000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, i, i);
            entity.addComponent(Velocity, 1, 1);
        }

        // Create system that iterates over all entities
        engine.createSystem(
            'MovementSystem',
            { all: [Position, Velocity] },
            {
                act: (entity, position, velocity) => {
                    position.x += velocity.x;
                    position.y += velocity.y;
                },
            }
        );

        // Run 100 updates
        for (let i = 0; i < 100; i++) {
            engine.update(16);
        }
    },

    // ===== MULTI-ARCHETYPE ITERATION =====

    'Multi-Archetype: Mixed entities (Archetypes ENABLED)': () => {
        const engine = new EngineBuilder().withArchetypes(true).withDebugMode(false).build();

        // Create entities with various component compositions (creates multiple archetypes)
        for (let i = 0; i < 5000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, i, i);

            if (i % 2 === 0) entity.addComponent(Velocity, 1, 1);
            if (i % 3 === 0) entity.addComponent(Health, 100, 100);
            if (i % 4 === 0) entity.addComponent(Transform, i, i, 0);
            if (i % 5 === 0) entity.addComponent(Renderable, 'sprite', 0);
        }

        // System that queries Position + Velocity
        engine.createSystem(
            'MovementSystem',
            { all: [Position, Velocity] },
            {
                act: (entity, position, velocity) => {
                    position.x += velocity.x;
                    position.y += velocity.y;
                },
            }
        );

        // Run 100 updates
        for (let i = 0; i < 100; i++) {
            engine.update(16);
        }
    },

    'Multi-Archetype: Mixed entities (Archetypes DISABLED)': () => {
        const engine = new EngineBuilder().withArchetypes(false).withDebugMode(false).build();

        // Create entities with various component compositions
        for (let i = 0; i < 5000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, i, i);

            if (i % 2 === 0) entity.addComponent(Velocity, 1, 1);
            if (i % 3 === 0) entity.addComponent(Health, 100, 100);
            if (i % 4 === 0) entity.addComponent(Transform, i, i, 0);
            if (i % 5 === 0) entity.addComponent(Renderable, 'sprite', 0);
        }

        // System that queries Position + Velocity
        engine.createSystem(
            'MovementSystem',
            { all: [Position, Velocity] },
            {
                act: (entity, position, velocity) => {
                    position.x += velocity.x;
                    position.y += velocity.y;
                },
            }
        );

        // Run 100 updates
        for (let i = 0; i < 100; i++) {
            engine.update(16);
        }
    },

    // ===== MULTIPLE SYSTEMS =====

    'Multi-System: 5 systems, 5000 entities (Archetypes ENABLED)': () => {
        const engine = new EngineBuilder().withArchetypes(true).withDebugMode(false).build();

        // Create diverse entity population
        for (let i = 0; i < 5000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, i, i);
            entity.addComponent(Transform, i, i, 0);

            if (i % 2 === 0) entity.addComponent(Velocity, 1, 1);
            if (i % 3 === 0) entity.addComponent(Health, 100, 100);
            if (i % 4 === 0) entity.addComponent(Renderable, 'sprite', 0);
        }

        // Movement System
        engine.createSystem(
            'MovementSystem',
            { all: [Position, Velocity] },
            {
                priority: 100,
                act: (entity, position, velocity) => {
                    position.x += velocity.x;
                    position.y += velocity.y;
                },
            }
        );

        // Health System
        engine.createSystem(
            'HealthSystem',
            { all: [Health] },
            {
                priority: 90,
                act: (entity, health) => {
                    if (health.current > 0) {
                        health.current = Math.max(0, health.current - 0.1);
                    }
                },
            }
        );

        // Transform Update System
        engine.createSystem(
            'TransformSystem',
            { all: [Position, Transform] },
            {
                priority: 80,
                act: (entity, position, transform) => {
                    transform.x = position.x;
                    transform.y = position.y;
                },
            }
        );

        // Render System
        engine.createSystem(
            'RenderSystem',
            { all: [Transform, Renderable] },
            {
                priority: 10,
                act: (entity, transform, renderable) => {
                    // Simulate render calculations
                    const distance = Math.sqrt(
                        transform.x * transform.x + transform.y * transform.y
                    );
                    renderable.layer = distance > 1000 ? 1 : 0;
                },
            }
        );

        // Cleanup System
        engine.createSystem(
            'CleanupSystem',
            { all: [Health] },
            {
                priority: 5,
                act: (entity, health) => {
                    if (health.current <= 0) {
                        entity.queueFree();
                    }
                },
            }
        );

        // Run 100 updates
        for (let i = 0; i < 100; i++) {
            engine.update(16);
        }
    },

    'Multi-System: 5 systems, 5000 entities (Archetypes DISABLED)': () => {
        const engine = new EngineBuilder().withArchetypes(false).withDebugMode(false).build();

        // Create diverse entity population
        for (let i = 0; i < 5000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, i, i);
            entity.addComponent(Transform, i, i, 0);

            if (i % 2 === 0) entity.addComponent(Velocity, 1, 1);
            if (i % 3 === 0) entity.addComponent(Health, 100, 100);
            if (i % 4 === 0) entity.addComponent(Renderable, 'sprite', 0);
        }

        // Movement System
        engine.createSystem(
            'MovementSystem',
            { all: [Position, Velocity] },
            {
                priority: 100,
                act: (entity, position, velocity) => {
                    position.x += velocity.x;
                    position.y += velocity.y;
                },
            }
        );

        // Health System
        engine.createSystem(
            'HealthSystem',
            { all: [Health] },
            {
                priority: 90,
                act: (entity, health) => {
                    if (health.current > 0) {
                        health.current = Math.max(0, health.current - 0.1);
                    }
                },
            }
        );

        // Transform Update System
        engine.createSystem(
            'TransformSystem',
            { all: [Position, Transform] },
            {
                priority: 80,
                act: (entity, position, transform) => {
                    transform.x = position.x;
                    transform.y = position.y;
                },
            }
        );

        // Render System
        engine.createSystem(
            'RenderSystem',
            { all: [Transform, Renderable] },
            {
                priority: 10,
                act: (entity, transform, renderable) => {
                    // Simulate render calculations
                    const distance = Math.sqrt(
                        transform.x * transform.x + transform.y * transform.y
                    );
                    renderable.layer = distance > 1000 ? 1 : 0;
                },
            }
        );

        // Cleanup System
        engine.createSystem(
            'CleanupSystem',
            { all: [Health] },
            {
                priority: 5,
                act: (entity, health) => {
                    if (health.current <= 0) {
                        entity.queueFree();
                    }
                },
            }
        );

        // Run 100 updates
        for (let i = 0; i < 100; i++) {
            engine.update(16);
        }
    },

    // ===== CACHE LOCALITY TEST =====

    'Cache Locality: Tight loop access (Archetypes ENABLED)': () => {
        const engine = new EngineBuilder().withArchetypes(true).withDebugMode(false).build();

        // Create many entities with same composition (all in one archetype)
        for (let i = 0; i < 20000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, i % 1000, i % 1000);
            entity.addComponent(Velocity, (i % 10) - 5, (i % 10) - 5);
            entity.addComponent(Health, 100, 100);
        }

        // Intensive computation system
        engine.createSystem(
            'PhysicsSystem',
            { all: [Position, Velocity, Health] },
            {
                act: (entity, position, velocity, health) => {
                    // Simulate physics calculations
                    const dx = velocity.x * 0.016;
                    const dy = velocity.y * 0.016;

                    position.x += dx;
                    position.y += dy;

                    // Boundary check
                    if (position.x < 0 || position.x > 1000) velocity.x *= -1;
                    if (position.y < 0 || position.y > 1000) velocity.y *= -1;

                    // Health decay based on movement
                    const speed = Math.sqrt(dx * dx + dy * dy);
                    health.current -= speed * 0.01;
                },
            }
        );

        // Run 50 updates (intensive computation)
        for (let i = 0; i < 50; i++) {
            engine.update(16);
        }
    },

    'Cache Locality: Tight loop access (Archetypes DISABLED)': () => {
        const engine = new EngineBuilder().withArchetypes(false).withDebugMode(false).build();

        // Create many entities with same composition
        for (let i = 0; i < 20000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, i % 1000, i % 1000);
            entity.addComponent(Velocity, (i % 10) - 5, (i % 10) - 5);
            entity.addComponent(Health, 100, 100);
        }

        // Intensive computation system
        engine.createSystem(
            'PhysicsSystem',
            { all: [Position, Velocity, Health] },
            {
                act: (entity, position, velocity, health) => {
                    // Simulate physics calculations
                    const dx = velocity.x * 0.016;
                    const dy = velocity.y * 0.016;

                    position.x += dx;
                    position.y += dy;

                    // Boundary check
                    if (position.x < 0 || position.x > 1000) velocity.x *= -1;
                    if (position.y < 0 || position.y > 1000) velocity.y *= -1;

                    // Health decay based on movement
                    const speed = Math.sqrt(dx * dx + dy * dy);
                    health.current -= speed * 0.01;
                },
            }
        );

        // Run 50 updates (intensive computation)
        for (let i = 0; i < 50; i++) {
            engine.update(16);
        }
    },

    // ===== COMPONENT ACCESS PATTERNS =====

    'Random Access Pattern (Archetypes ENABLED)': () => {
        const engine = new EngineBuilder().withArchetypes(true).withDebugMode(false).build();
        const entities = [];

        // Create entities
        for (let i = 0; i < 5000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, i, i);
            entity.addComponent(Velocity, 1, 1);
            entity.addComponent(Health, 100, 100);
            entities.push(entity);
        }

        // Simulate random access pattern
        for (let i = 0; i < 10000; i++) {
            const randomEntity = entities[Math.floor(Math.random() * entities.length)];
            const pos = randomEntity.getComponent(Position);
            const vel = randomEntity.getComponent(Velocity);
            pos.x += vel.x;
            pos.y += vel.y;
        }
    },

    'Random Access Pattern (Archetypes DISABLED)': () => {
        const engine = new EngineBuilder().withArchetypes(false).withDebugMode(false).build();
        const entities = [];

        // Create entities
        for (let i = 0; i < 5000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, i, i);
            entity.addComponent(Velocity, 1, 1);
            entity.addComponent(Health, 100, 100);
            entities.push(entity);
        }

        // Simulate random access pattern
        for (let i = 0; i < 10000; i++) {
            const randomEntity = entities[Math.floor(Math.random() * entities.length)];
            const pos = randomEntity.getComponent(Position);
            const vel = randomEntity.getComponent(Velocity);
            pos.x += vel.x;
            pos.y += vel.y;
        }
    },
});
