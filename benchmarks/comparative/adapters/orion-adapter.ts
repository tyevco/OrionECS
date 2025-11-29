/**
 * OrionECS Adapter for Comparative Benchmarks
 */

import type { EcsAdapter } from '../types';

// Dynamically import to avoid TypeScript resolution issues during standalone checks
// The actual engine will be available at runtime when the project is built
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let EngineBuilder: any;

try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const core = require('@orion-ecs/core');
    EngineBuilder = core.EngineBuilder;
} catch {
    // Fallback for development - use relative path
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const core = require('../../../packages/core/src/index');
        EngineBuilder = core.EngineBuilder;
    } catch {
        // Will be available at runtime
    }
}

// Components for benchmarking
class Position {
    x: number;
    y: number;
    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }
}

class Velocity {
    vx: number;
    vy: number;
    constructor(vx: number = 0, vy: number = 0) {
        this.vx = vx;
        this.vy = vy;
    }
}

class Health {
    current: number;
    max: number;
    constructor(current: number = 100, max: number = 100) {
        this.current = current;
        this.max = max;
    }
}

class Damage {
    value: number;
    constructor(value: number = 10) {
        this.value = value;
    }
}

class Transform {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    constructor(
        x: number = 0,
        y: number = 0,
        rotation: number = 0,
        scaleX: number = 1,
        scaleY: number = 1
    ) {
        this.x = x;
        this.y = y;
        this.rotation = rotation;
        this.scaleX = scaleX;
        this.scaleY = scaleY;
    }
}

/**
 * OrionECS adapter implementation
 */
export class OrionAdapter implements EcsAdapter {
    name = 'OrionECS';
    version: string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private engine: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private entities: any[] = [];
    private systemsCreated = false;

    constructor() {
        this.version = '0.2.0';
    }

    initialize(): void {
        if (!EngineBuilder) {
            throw new Error('OrionECS not available. Make sure the package is built.');
        }
        this.engine = new EngineBuilder().withDebugMode(false).withArchetypes(true).build();
        this.entities = [];
        this.systemsCreated = false;
    }

    cleanup(): void {
        if (this.engine) {
            // Destroy all entities
            for (const entity of this.entities) {
                try {
                    entity.queueFree();
                } catch {
                    // Entity may already be destroyed
                }
            }
            this.engine.update(0);
        }
        this.engine = null;
        this.entities = [];
        this.systemsCreated = false;
    }

    createEntities(count: number): void {
        if (!this.engine) {
            throw new Error('Engine not initialized');
        }

        for (let i = 0; i < count; i++) {
            const entity = this.engine.createEntity();
            entity.addComponent(Position, Math.random() * 1000, Math.random() * 1000);
            entity.addComponent(Velocity, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
            this.entities.push(entity);
        }
    }

    addComponentToAll(): void {
        for (const entity of this.entities) {
            if (!entity.hasComponent(Health)) {
                entity.addComponent(Health, 100, 100);
            }
        }
    }

    removeComponentFromAll(): void {
        for (const entity of this.entities) {
            if (entity.hasComponent(Health)) {
                entity.removeComponent(Health);
            }
        }
    }

    iterateEntities(): number {
        if (!this.engine) {
            throw new Error('Engine not initialized');
        }

        let count = 0;

        // Create movement system if not exists
        if (!this.systemsCreated) {
            this.engine.createSystem(
                'MovementSystem',
                { all: [Position, Velocity] },
                {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    act: (_entity: any, position: Position, velocity: Velocity) => {
                        position.x += velocity.vx;
                        position.y += velocity.vy;
                        count++;
                    },
                }
            );
            this.systemsCreated = true;
        }

        this.engine.update(16);
        return count;
    }

    runSystems(): void {
        if (!this.engine) {
            throw new Error('Engine not initialized');
        }

        // Create systems if not already created
        if (!this.systemsCreated) {
            this.engine.createSystem(
                'MovementSystem',
                { all: [Position, Velocity] },
                {
                    priority: 100,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    act: (_entity: any, position: Position, velocity: Velocity) => {
                        position.x += velocity.vx * 0.016;
                        position.y += velocity.vy * 0.016;
                    },
                }
            );

            this.engine.createSystem(
                'BoundsSystem',
                { all: [Position] },
                {
                    priority: 90,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    act: (_entity: any, position: Position) => {
                        if (position.x < 0) position.x = 1000;
                        if (position.x > 1000) position.x = 0;
                        if (position.y < 0) position.y = 1000;
                        if (position.y > 1000) position.y = 0;
                    },
                }
            );

            this.systemsCreated = true;
        }

        this.engine.update(16);
    }

    serialize(): string {
        if (!this.engine) {
            throw new Error('Engine not initialized');
        }

        const state = this.engine.serialize();
        return JSON.stringify(state);
    }

    getEntityCount(): number {
        return this.entities.length;
    }
}

// Export component classes for use in scenarios
export { Position, Velocity, Health, Damage, Transform };
