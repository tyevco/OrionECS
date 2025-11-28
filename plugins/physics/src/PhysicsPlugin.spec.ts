/**
 * PhysicsPlugin Test Suite
 *
 * Comprehensive tests covering:
 * - Component initialization and validation
 * - API functionality
 * - Plugin lifecycle (install/uninstall)
 * - System execution and physics simulation
 * - Edge cases and error scenarios
 */

import { TestEngineBuilder } from '@orion-ecs/testing';
import type { Engine } from '../../../packages/core/src/index';
import { Collider, PhysicsAPI, PhysicsPlugin, Position, RigidBody } from './PhysicsPlugin';

// Type extensions for testing
interface EngineWithPhysics extends Engine {
    physics: PhysicsAPI;
}

describe('PhysicsPlugin', () => {
    let engine: Engine;
    let plugin: PhysicsPlugin;

    beforeEach(() => {
        plugin = new PhysicsPlugin();
        engine = new TestEngineBuilder().use(plugin).build();
    });

    afterEach(() => {
        engine.stop();
    });

    describe('Plugin Metadata', () => {
        test('should have correct name and version', () => {
            expect(plugin.name).toBe('PhysicsPlugin');
            expect(plugin.version).toBe('1.0.0');
        });
    });

    describe('Plugin Installation', () => {
        test('should install successfully', () => {
            // Plugin is already installed in beforeEach
            expect(engine).toBeDefined();
        });

        test('should extend engine with physics API', () => {
            expect((engine as EngineWithPhysics).physics).toBeDefined();
            expect((engine as EngineWithPhysics).physics).toBeInstanceOf(PhysicsAPI);
        });

        test('should register all components', () => {
            const entity = engine.createEntity('TestEntity');

            // Should be able to add all physics components
            expect(() => entity.addComponent(Position, 0, 0)).not.toThrow();
            expect(() => entity.addComponent(RigidBody, 1)).not.toThrow();
            expect(() => entity.addComponent(Collider, 10)).not.toThrow();
        });

        test('should create physics systems', () => {
            const systems = engine.getSystemProfiles();
            const systemNames = systems.map((s) => s.name);

            expect(systemNames).toContain('PhysicsMovementSystem');
            expect(systemNames).toContain('CollisionDetectionSystem');
        });
    });

    describe('Component - Position', () => {
        test('should create Position with default values', () => {
            const pos = new Position();
            expect(pos.x).toBe(0);
            expect(pos.y).toBe(0);
        });

        test('should create Position with custom values', () => {
            const pos = new Position(100, 200);
            expect(pos.x).toBe(100);
            expect(pos.y).toBe(200);
        });

        test('should handle negative coordinates', () => {
            const pos = new Position(-50, -100);
            expect(pos.x).toBe(-50);
            expect(pos.y).toBe(-100);
        });

        test('should handle floating point values', () => {
            const pos = new Position(1.5, 2.75);
            expect(pos.x).toBe(1.5);
            expect(pos.y).toBe(2.75);
        });
    });

    describe('Component - RigidBody', () => {
        test('should create RigidBody with default values', () => {
            const rb = new RigidBody();
            expect(rb.mass).toBe(1);
            expect(rb.velocity).toEqual({ x: 0, y: 0 });
            expect(rb.acceleration).toEqual({ x: 0, y: 0 });
        });

        test('should create RigidBody with custom values', () => {
            const rb = new RigidBody(2, { x: 5, y: 10 }, { x: 1, y: 2 });
            expect(rb.mass).toBe(2);
            expect(rb.velocity).toEqual({ x: 5, y: 10 });
            expect(rb.acceleration).toEqual({ x: 1, y: 2 });
        });

        test('should validate positive mass', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Position, 0, 0);

            // Negative mass should fail validation
            expect(() => {
                entity.addComponent(RigidBody, -1);
            }).toThrow();
        });

        test('should validate zero mass', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Position, 0, 0);

            // Zero mass is valid (static objects)
            expect(() => {
                entity.addComponent(RigidBody, 0);
            }).not.toThrow();
        });

        test('should require Position component', () => {
            const entity = engine.createEntity('TestEntity');

            // Should fail without Position
            expect(() => {
                entity.addComponent(RigidBody, 1);
            }).toThrow();
        });
    });

    describe('Component - Collider', () => {
        test('should create Collider with default values', () => {
            const collider = new Collider();
            expect(collider.radius).toBe(10);
            expect(collider.isStatic).toBe(false);
            expect(collider.layer).toBe(0);
        });

        test('should create Collider with custom values', () => {
            const collider = new Collider(25, true, 2);
            expect(collider.radius).toBe(25);
            expect(collider.isStatic).toBe(true);
            expect(collider.layer).toBe(2);
        });

        test('should validate positive radius', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Position, 0, 0);

            // Negative radius should fail validation
            expect(() => {
                entity.addComponent(Collider, -5);
            }).toThrow();
        });

        test('should validate zero radius', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Position, 0, 0);

            // Zero radius should fail validation
            expect(() => {
                entity.addComponent(Collider, 0);
            }).toThrow();
        });

        test('should require Position component', () => {
            const entity = engine.createEntity('TestEntity');

            // Should fail without Position
            expect(() => {
                entity.addComponent(Collider, 10);
            }).toThrow();
        });
    });

    describe('PhysicsAPI - Gravity', () => {
        let physicsAPI: PhysicsAPI;

        beforeEach(() => {
            physicsAPI = (engine as EngineWithPhysics).physics;
        });

        test('should have default gravity', () => {
            const gravity = physicsAPI.getGravity();
            expect(gravity).toEqual({ x: 0, y: 9.8 });
        });

        test('should set custom gravity', () => {
            physicsAPI.setGravity(0, 20);
            const gravity = physicsAPI.getGravity();
            expect(gravity).toEqual({ x: 0, y: 20 });
        });

        test('should set negative gravity', () => {
            physicsAPI.setGravity(0, -9.8);
            const gravity = physicsAPI.getGravity();
            expect(gravity).toEqual({ x: 0, y: -9.8 });
        });

        test('should set horizontal gravity', () => {
            physicsAPI.setGravity(5, 0);
            const gravity = physicsAPI.getGravity();
            expect(gravity).toEqual({ x: 5, y: 0 });
        });

        test('should return a copy of gravity (immutability)', () => {
            const gravity1 = physicsAPI.getGravity();
            const gravity2 = physicsAPI.getGravity();

            expect(gravity1).not.toBe(gravity2);
            expect(gravity1).toEqual(gravity2);
        });
    });

    describe('PhysicsAPI - Time Scale', () => {
        let physicsAPI: PhysicsAPI;

        beforeEach(() => {
            physicsAPI = (engine as EngineWithPhysics).physics;
        });

        test('should have default time scale', () => {
            expect(physicsAPI.getTimeScale()).toBe(1);
        });

        test('should set custom time scale', () => {
            physicsAPI.setTimeScale(0.5);
            expect(physicsAPI.getTimeScale()).toBe(0.5);
        });

        test('should clamp negative time scale to zero', () => {
            physicsAPI.setTimeScale(-1);
            expect(physicsAPI.getTimeScale()).toBe(0);
        });

        test('should allow time scale greater than 1', () => {
            physicsAPI.setTimeScale(2);
            expect(physicsAPI.getTimeScale()).toBe(2);
        });
    });

    describe('PhysicsAPI - Force Application', () => {
        let physicsAPI: PhysicsAPI;

        beforeEach(() => {
            physicsAPI = (engine as EngineWithPhysics).physics;
        });

        test('should apply force to rigid body', () => {
            const rb = new RigidBody(2);

            physicsAPI.applyForce(rb, 10, 0);

            expect(rb.acceleration.x).toBe(5); // force / mass = 10 / 2 = 5
            expect(rb.acceleration.y).toBe(0);
        });

        test('should accumulate forces', () => {
            const rb = new RigidBody(1);

            physicsAPI.applyForce(rb, 5, 0);
            physicsAPI.applyForce(rb, 3, 0);

            expect(rb.acceleration.x).toBe(8);
        });

        test('should not affect zero mass bodies', () => {
            const rb = new RigidBody(0);

            physicsAPI.applyForce(rb, 100, 100);

            expect(rb.acceleration.x).toBe(0);
            expect(rb.acceleration.y).toBe(0);
        });
    });

    describe('PhysicsAPI - Impulse Application', () => {
        let physicsAPI: PhysicsAPI;

        beforeEach(() => {
            physicsAPI = (engine as EngineWithPhysics).physics;
        });

        test('should apply impulse to rigid body', () => {
            const rb = new RigidBody(2);

            physicsAPI.applyImpulse(rb, 10, 0);

            expect(rb.velocity.x).toBe(5); // impulse / mass = 10 / 2 = 5
            expect(rb.velocity.y).toBe(0);
        });

        test('should accumulate impulses', () => {
            const rb = new RigidBody(1);

            physicsAPI.applyImpulse(rb, 5, 0);
            physicsAPI.applyImpulse(rb, 3, 0);

            expect(rb.velocity.x).toBe(8);
        });

        test('should not affect zero mass bodies', () => {
            const rb = new RigidBody(0);

            physicsAPI.applyImpulse(rb, 100, 100);

            expect(rb.velocity.x).toBe(0);
            expect(rb.velocity.y).toBe(0);
        });
    });

    describe('Physics Simulation - Movement', () => {
        test('should have gravity configuration available for rigid bodies', () => {
            const entity = engine.createEntity('Ball');
            entity.addComponent(Position, 0, 0);
            entity.addComponent(RigidBody, 1);

            const rb = entity.getComponent(RigidBody)!;
            const physicsAPI = (engine as EngineWithPhysics).physics;
            const gravity = physicsAPI.getGravity();

            // Verify gravity is configured correctly
            expect(gravity.x).toBe(0);
            expect(gravity.y).toBe(9.8);

            // Verify rigid body can have acceleration applied
            expect(rb.acceleration).toBeDefined();
            expect(rb.velocity).toBeDefined();
        });

        test('should respect time scale setting', () => {
            const physicsAPI = (engine as EngineWithPhysics).physics;

            // Verify default time scale
            expect(physicsAPI.getTimeScale()).toBe(1);

            // Set time scale to 0.5
            physicsAPI.setTimeScale(0.5);
            expect(physicsAPI.getTimeScale()).toBe(0.5);

            // Set time scale to 2
            physicsAPI.setTimeScale(2);
            expect(physicsAPI.getTimeScale()).toBe(2);

            // Verify time scale affects the physics API state
            physicsAPI.setTimeScale(0);
            expect(physicsAPI.getTimeScale()).toBe(0);
        });

        test('should track velocity on rigid body', () => {
            const entity = engine.createEntity('Ball');
            entity.addComponent(Position, 0, 0);
            entity.addComponent(RigidBody, 1);
            const rb = entity.getComponent(RigidBody)!;

            // Verify initial velocity is zero
            expect(rb.velocity.x).toBe(0);
            expect(rb.velocity.y).toBe(0);

            // Apply impulse directly (doesn't require system to run)
            (engine as EngineWithPhysics).physics.applyImpulse(rb, 10, 5);

            // Velocity should be updated immediately from impulse
            expect(rb.velocity.x).toBe(10);
            expect(rb.velocity.y).toBe(5);
        });

        test('should track acceleration from applied force', () => {
            const entity = engine.createEntity('Ball');
            entity.addComponent(Position, 0, 0);
            entity.addComponent(RigidBody, 1);
            const rb = entity.getComponent(RigidBody)!;

            // Verify initial acceleration is zero
            expect(rb.acceleration.x).toBe(0);
            expect(rb.acceleration.y).toBe(0);

            // Apply force
            (engine as EngineWithPhysics).physics.applyForce(rb, 60, 30);

            // Acceleration should be updated (force / mass)
            expect(rb.acceleration.x).toBe(60);
            expect(rb.acceleration.y).toBe(30);
        });
    });

    describe('Message Bus Integration', () => {
        test('should subscribe to collision messages', () => {
            const mockCallback = jest.fn();

            engine.messageBus.subscribe('collision', mockCallback);

            // Publish a collision event
            engine.messageBus.publish('collision', {
                entityA: 'entity1',
                entityB: 'entity2',
            });

            // Process messages
            engine.update(0);

            expect(mockCallback).toHaveBeenCalled();
        });
    });

    describe('Plugin Uninstallation', () => {
        test('should uninstall cleanly', () => {
            expect(() => {
                plugin.uninstall();
            }).not.toThrow();
        });

        test('should clean up its own message subscriptions', () => {
            // The plugin's own subscription should be cleaned up
            // But external subscriptions remain (that's expected behavior)
            expect(() => {
                plugin.uninstall();
            }).not.toThrow();

            // Verify plugin can be safely uninstalled without affecting engine
            expect(() => {
                engine.messageBus.publish('collision', { test: true });
                engine.update(0);
            }).not.toThrow();
        });
    });

    describe('Integration Tests', () => {
        test('should work with multiple physics entities', () => {
            // Create multiple entities with physics components
            const entities = [];
            for (let i = 0; i < 10; i++) {
                const entity = engine.createEntity(`Ball${i}`);
                entity.addComponent(Position, i * 10, 0);
                entity.addComponent(RigidBody, 1);
                entity.addComponent(Collider, 5);
                entities.push(entity);
            }

            // Verify all entities have correct components
            entities.forEach((entity, i) => {
                const pos = entity.getComponent(Position);
                const rb = entity.getComponent(RigidBody);
                const col = entity.getComponent(Collider);

                expect(pos).toBeDefined();
                expect(pos?.x).toBe(i * 10);
                expect(rb).toBeDefined();
                expect(rb?.mass).toBe(1);
                expect(col).toBeDefined();
                expect(col?.radius).toBe(5);
            });

            // Verify engine can run with all these entities
            expect(() => {
                engine.start();
                engine.update(1 / 60);
            }).not.toThrow();
        });

        test('should handle entities with different masses', () => {
            const light = engine.createEntity('Light');
            light.addComponent(Position, 0, 0);
            light.addComponent(RigidBody, 0.5);

            const heavy = engine.createEntity('Heavy');
            heavy.addComponent(Position, 100, 0);
            heavy.addComponent(RigidBody, 2);

            // Apply same force
            const physicsAPI = (engine as EngineWithPhysics).physics;
            physicsAPI.applyImpulse(light.getComponent(RigidBody)!, 10, 0);
            physicsAPI.applyImpulse(heavy.getComponent(RigidBody)!, 10, 0);

            engine.start();
            engine.update(1 / 60);

            // Light object should move faster
            const lightVel = light.getComponent(RigidBody)?.velocity.x;
            const heavyVel = heavy.getComponent(RigidBody)?.velocity.x;

            expect(lightVel).toBeGreaterThan(heavyVel);
        });

        test('should handle static objects (zero mass)', () => {
            const staticObj = engine.createEntity('Static');
            staticObj.addComponent(Position, 0, 0);
            staticObj.addComponent(RigidBody, 0);

            const initialPos = staticObj.getComponent(Position);
            const initialY = initialPos?.y;

            engine.start();
            engine.update(1 / 60);

            const finalPos = staticObj.getComponent(Position);

            // Static object should not move
            expect(finalPos?.y).toBe(initialY);
        });
    });

    describe('Edge Cases', () => {
        test('should handle very small mass values', () => {
            const entity = engine.createEntity('Tiny');
            entity.addComponent(Position, 0, 0);
            entity.addComponent(RigidBody, 0.0001);

            expect(() => {
                engine.start();
                engine.update(1 / 60);
            }).not.toThrow();
        });

        test('should handle very large force values', () => {
            const entity = engine.createEntity('Ball');
            entity.addComponent(Position, 0, 0);
            entity.addComponent(RigidBody, 1);
            const rb = entity.getComponent(RigidBody)!;

            const physicsAPI = (engine as EngineWithPhysics).physics;

            expect(() => {
                physicsAPI.applyForce(rb, 1000000, 1000000);
            }).not.toThrow();
        });

        test('should handle entities without RigidBody', () => {
            const entity = engine.createEntity('Static');
            entity.addComponent(Position, 0, 0);
            entity.addComponent(Collider, 10);

            expect(() => {
                engine.start();
                engine.update(1 / 60);
            }).not.toThrow();
        });

        test('should handle paused time scale', () => {
            const physicsAPI = (engine as EngineWithPhysics).physics;
            physicsAPI.setTimeScale(0);

            const entity = engine.createEntity('Ball');
            entity.addComponent(Position, 0, 0);
            entity.addComponent(RigidBody, 1);

            const initialPos = entity.getComponent(Position);
            const initialY = initialPos?.y;

            engine.start();
            engine.update(1 / 60);

            const finalPos = entity.getComponent(Position);

            // Should not move with zero time scale
            expect(finalPos?.y).toBe(initialY);
        });
    });

    describe('Performance Tests', () => {
        test('should handle large number of physics entities', () => {
            // Create 1000 entities
            for (let i = 0; i < 1000; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(Position, Math.random() * 1000, Math.random() * 1000);
                entity.addComponent(RigidBody, 1);
            }

            engine.start();

            const startTime = performance.now();
            engine.update(1 / 60);
            const endTime = performance.now();

            const executionTime = endTime - startTime;

            // Should complete in reasonable time (< 100ms)
            expect(executionTime).toBeLessThan(100);
        });
    });
});
