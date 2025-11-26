/**
 * Example Physics Plugin for Orion ECS
 *
 * This demonstrates how to create a plugin that:
 * - Registers custom components
 * - Creates systems
 * - Extends the engine with custom APIs
 */

import type { EnginePlugin, PluginContext } from '@orion-ecs/plugin-api';

// Physics components
export class RigidBody {
    constructor(
        public mass: number = 1,
        public velocity: { x: number; y: number } = { x: 0, y: 0 },
        public acceleration: { x: number; y: number } = { x: 0, y: 0 }
    ) {}
}

export class Collider {
    constructor(
        public radius: number = 10,
        public isStatic: boolean = false,
        public layer: number = 0
    ) {}
}

export class Position {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

// =============================================================================
// Physics API Interface
// =============================================================================

/**
 * Physics API that will be added to the engine.
 * Provides gravity, time scaling, and force/impulse application.
 */
export interface IPhysicsAPI {
    /** Set the global gravity vector */
    setGravity(x: number, y: number): void;
    /** Get the current gravity vector */
    getGravity(): { x: number; y: number };
    /** Set the physics time scale (0 = paused, 1 = normal) */
    setTimeScale(scale: number): void;
    /** Get the current time scale */
    getTimeScale(): number;
    /** Apply a force to a rigid body (affected by mass) */
    applyForce(rigidBody: RigidBody, forceX: number, forceY: number): void;
    /** Apply an impulse to a rigid body (instant velocity change) */
    applyImpulse(rigidBody: RigidBody, impulseX: number, impulseY: number): void;
}

// =============================================================================
// Physics API Implementation
// =============================================================================

/**
 * Physics API implementation class.
 */
export class PhysicsAPI implements IPhysicsAPI {
    private gravity = { x: 0, y: 9.8 };
    private timeScale = 1;

    setGravity(x: number, y: number): void {
        this.gravity = { x, y };
    }

    getGravity(): { x: number; y: number } {
        return { ...this.gravity };
    }

    setTimeScale(scale: number): void {
        this.timeScale = Math.max(0, scale);
    }

    getTimeScale(): number {
        return this.timeScale;
    }

    applyForce(rigidBody: RigidBody, forceX: number, forceY: number): void {
        if (rigidBody.mass > 0) {
            rigidBody.acceleration.x += forceX / rigidBody.mass;
            rigidBody.acceleration.y += forceY / rigidBody.mass;
        }
    }

    applyImpulse(rigidBody: RigidBody, impulseX: number, impulseY: number): void {
        if (rigidBody.mass > 0) {
            rigidBody.velocity.x += impulseX / rigidBody.mass;
            rigidBody.velocity.y += impulseY / rigidBody.mass;
        }
    }
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Physics Plugin with type-safe engine extension.
 */
export class PhysicsPlugin implements EnginePlugin<{ physics: IPhysicsAPI }> {
    name = 'PhysicsPlugin';
    version = '1.0.0';

    /** Type brand for compile-time type inference */
    declare readonly __extensions: { physics: IPhysicsAPI };

    private physicsAPI = new PhysicsAPI();
    private unsubscribe?: () => void;

    install(context: PluginContext): void {
        // Register physics components
        context.registerComponent(RigidBody);
        context.registerComponent(Collider);
        context.registerComponent(Position);

        // Register component validators
        context.registerComponentValidator(RigidBody, {
            validate: (component: RigidBody) => {
                if (component.mass < 0) {
                    return 'Mass cannot be negative';
                }
                return true;
            },
            dependencies: [Position], // RigidBody requires Position
        });

        context.registerComponentValidator(Collider, {
            validate: (component: Collider) => {
                if (component.radius <= 0) {
                    return 'Radius must be positive';
                }
                return true;
            },
            dependencies: [Position], // Collider requires Position
        });

        // Create physics movement system
        context.createSystem(
            'PhysicsMovementSystem',
            {
                all: [Position, RigidBody],
            },
            {
                priority: 100,
                act: (_entity, ...components) => {
                    const [position, rigidBody] = components as [Position, RigidBody];
                    const timeScale = this.physicsAPI.getTimeScale();
                    const gravity = this.physicsAPI.getGravity();
                    const dt = 1 / 60; // Fixed timestep for physics

                    // Apply gravity
                    rigidBody.acceleration.x += gravity.x;
                    rigidBody.acceleration.y += gravity.y;

                    // Update velocity
                    rigidBody.velocity.x += rigidBody.acceleration.x * dt * timeScale;
                    rigidBody.velocity.y += rigidBody.acceleration.y * dt * timeScale;

                    // Update position
                    position.x += rigidBody.velocity.x * dt * timeScale;
                    position.y += rigidBody.velocity.y * dt * timeScale;

                    // Reset acceleration for next frame
                    rigidBody.acceleration.x = 0;
                    rigidBody.acceleration.y = 0;
                },
            },
            true // Fixed update system
        );

        // Create simple collision detection system
        context.createSystem(
            'CollisionDetectionSystem',
            {
                all: [Position, Collider],
            },
            {
                priority: 90,
                before: () => {
                    // Could build spatial partitioning here
                },
                act: () => {
                    // This is a simple example - real collision detection would be more complex
                    // You would typically check against other entities here
                },
            },
            true // Fixed update system
        );

        // Subscribe to collision messages
        this.unsubscribe = context.messageBus.subscribe('collision', (message) => {
            console.log('Collision detected:', message.data);
        });

        // Extend the engine with physics API
        context.extend('physics', this.physicsAPI);

        console.log('[PhysicsPlugin] Installed successfully');
    }

    uninstall(): void {
        // Clean up subscriptions
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        console.log('[PhysicsPlugin] Uninstalled successfully');
    }
}

/**
 * Usage example:
 *
 * import { EngineBuilder } from '../../../packages/core/src/index';
 * import { PhysicsPlugin } from './examples/PhysicsPlugin';
 *
 * const engine = new EngineBuilder()
 *   .withDebugMode(true)
 *   .use(new PhysicsPlugin())
 *   .build();
 *
 * // Access the physics API
 * engine.physics.setGravity(0, 20);
 * engine.physics.setTimeScale(0.5);
 *
 * // Create an entity with physics
 * const ball = engine.createEntity('Ball');
 * ball.addComponent(Position, 100, 100);
 * ball.addComponent(RigidBody, 1);
 * ball.addComponent(Collider, 10);
 *
 * // Apply a force
 * const rigidBody = ball.getComponent(RigidBody);
 * engine.physics.applyImpulse(rigidBody, 5, -10);
 *
 * // Start the engine
 * engine.start();
 *
 * // Update loop
 * function gameLoop() {
 *   engine.update();
 *   requestAnimationFrame(gameLoop);
 * }
 * gameLoop();
 */
