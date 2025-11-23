/**
 * OrionECS Testing Utilities - Usage Examples
 *
 * This file demonstrates how to use the testing utilities to test your own
 * OrionECS systems, components, and game logic.
 */

import {
    createTestEntities,
    createTestEntity,
    setupTestMatchers,
    TestClock,
    TestEngineBuilder,
    TestSnapshot,
    TestSystemRunner,
} from '@orion-ecs/testing';

// =============================================================================
// Example 1: Basic Test Setup with TestEngineBuilder
// =============================================================================

describe('My Game Systems', () => {
    let engine: any;

    beforeEach(() => {
        // TestEngineBuilder provides test-friendly defaults
        // - Debug mode enabled for better error messages
        // - Fixed update at 60 FPS
        // - Deterministic behavior
        engine = new TestEngineBuilder().build();
    });

    afterEach(() => {
        // Clean up entities after each test
        const entities = engine.getAllEntities();
        for (const entity of entities) {
            entity.queueFree();
        }
        engine.update(0);

        // Or use the utility function
        // assertEngineClean(engine);
    });

    // Your tests go here...
});

// =============================================================================
// Example 2: Testing Systems with TestSystemRunner
// =============================================================================

// Define your components
class Position {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

class Velocity {
    constructor(
        public vx: number = 0,
        public vy: number = 0
    ) {}
}

describe('MovementSystem', () => {
    it('should move entities based on velocity', () => {
        const engine = new TestEngineBuilder().build();
        const runner = new TestSystemRunner(engine);

        // Create the system you want to test
        engine.createSystem(
            'MovementSystem',
            {
                all: [Position, Velocity],
            },
            {
                act: (_entity: any, ...components: any[]) => {
                    const position = components[0] as Position;
                    const velocity = components[1] as Velocity;
                    position.x += velocity.vx;
                    position.y += velocity.vy;
                },
            }
        );

        // Create test entities
        const entity = createTestEntity(engine, {
            components: [
                { type: Position, args: [0, 0] },
                { type: Velocity, args: [5, 10] },
            ],
        });

        // Run the system
        runner.runVariableSystems(16.67);

        // Verify the results
        const pos = entity.getComponent(Position);
        expect(pos.x).toBe(5);
        expect(pos.y).toBe(10);

        // Check system execution stats
        expect(runner.wasExecuted('MovementSystem')).toBe(true);
        expect(runner.getEntityCount('MovementSystem')).toBe(1);
        expect(runner.getExecutionTime('MovementSystem')).toBeGreaterThanOrEqual(0);
    });
});

// =============================================================================
// Example 3: Deterministic Time Control with TestClock
// =============================================================================

describe('Time-based Game Logic', () => {
    it('should spawn enemies every 60 frames', () => {
        const engine = new TestEngineBuilder().build();
        const clock = new TestClock(60); // 60 FPS

        let enemyCount = 0;
        let frameCounter = 0;

        engine.createSystem(
            'EnemySpawner',
            {
                all: [],
            },
            {
                act: () => {
                    frameCounter++;
                    if (frameCounter % 60 === 0) {
                        enemyCount++;
                    }
                },
            }
        );

        // Simulate 180 frames (3 seconds at 60 FPS)
        for (let i = 0; i < 180; i++) {
            clock.step();
            engine.update(clock.deltaTime);
        }

        // Should have spawned 3 enemies
        expect(enemyCount).toBe(3);
        expect(clock.currentTime).toBeCloseTo(3000, 0); // 3000ms
    });

    it('should support pausing and resuming time', () => {
        const clock = new TestClock(60);

        clock.step(5); // Advance 5 frames
        expect(clock.currentTime).toBeCloseTo(83.35, 1);

        clock.pause();
        clock.step(10); // Should not advance when paused
        expect(clock.currentTime).toBeCloseTo(83.35, 1);

        clock.resume();
        clock.step(5);
        expect(clock.currentTime).toBeCloseTo(166.7, 1);
    });
});

// =============================================================================
// Example 4: Entity Factory Helpers
// =============================================================================

describe('Entity Creation Helpers', () => {
    it('should create entities with components and tags', () => {
        const engine = new TestEngineBuilder().build();

        // Create a single test entity
        const player = createTestEntity(engine, {
            name: 'Player',
            tags: ['player', 'controllable'],
            components: [
                { type: Position, args: [100, 200] },
                { type: Velocity, args: [0, 0] },
            ],
        });

        expect(player.hasTag('player')).toBe(true);
        expect(player.hasComponent(Position)).toBe(true);

        const pos = player.getComponent(Position);
        expect(pos.x).toBe(100);
        expect(pos.y).toBe(200);
    });

    it('should create multiple entities with same configuration', () => {
        const engine = new TestEngineBuilder().build();

        // Create 10 enemies
        const enemies = createTestEntities(engine, 10, {
            name: 'Enemy',
            tags: ['enemy'],
            components: [{ type: Position }, { type: Velocity }],
        });

        expect(enemies.length).toBe(10);
        expect(enemies[0].name).toBe('Enemy_0');
        expect(enemies[9].name).toBe('Enemy_9');

        enemies.forEach((enemy) => {
            expect(enemy.hasTag('enemy')).toBe(true);
            expect(enemy.hasComponent(Position)).toBe(true);
        });
    });
});

// =============================================================================
// Example 5: Snapshot Testing
// =============================================================================

describe('Game State Snapshots', () => {
    it('should save and restore game state', () => {
        const engine = new TestEngineBuilder().build();
        const snapshot = new TestSnapshot(engine);

        // Create initial state
        createTestEntities(engine, 5, {
            components: [{ type: Position }],
        });

        const initialSnapshot = snapshot.create();
        expect(snapshot.getEntityCount()).toBe(5);

        // Modify state - add more entities
        createTestEntities(engine, 10, {
            components: [{ type: Position }],
        });

        expect(snapshot.getEntityCount()).toBe(15);

        // Restore to initial state
        snapshot.restore(initialSnapshot);
        expect(snapshot.getEntityCount()).toBe(5);
    });
});

// =============================================================================
// Example 6: Custom Matchers
// =============================================================================

// Setup custom matchers in your test setup file (e.g., jest.setup.ts)
// setupTestMatchers();

describe('Custom Jest Matchers', () => {
    beforeAll(() => {
        setupTestMatchers();
    });

    it('should use custom entity matchers', () => {
        const engine = new TestEngineBuilder().build();

        const entity = createTestEntity(engine, {
            tags: ['player'],
            components: [{ type: Position }],
        });

        // Use custom matchers for cleaner assertions
        expect(entity).toHaveComponent(Position);
        expect(entity).toHaveTag('player');
    });
});

// =============================================================================
// Example 7: Testing Combat System
// =============================================================================

class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
    ) {}
}

class Damage {
    constructor(public value: number = 10) {}
}

describe('Combat System', () => {
    it('should apply damage to entities', () => {
        const engine = new TestEngineBuilder().build();
        const runner = new TestSystemRunner(engine);

        // Create combat system
        engine.createSystem(
            'DamageSystem',
            {
                all: [Health, Damage],
            },
            {
                act: (entity: any, ...components: any[]) => {
                    const health = components[0] as Health;
                    const damage = components[1] as Damage;

                    health.current -= damage.value;
                    if (health.current <= 0) {
                        entity.queueFree();
                    }

                    // Remove damage component after applying
                    entity.removeComponent(Damage);
                },
            }
        );

        // Create entities
        const enemy1 = createTestEntity(engine, {
            name: 'Enemy1',
            components: [
                { type: Health, args: [50, 50] },
                { type: Damage, args: [20] },
            ],
        });

        createTestEntity(engine, {
            name: 'Enemy2',
            components: [
                { type: Health, args: [10, 10] },
                { type: Damage, args: [20] },
            ],
        });

        // Run the damage system
        runner.runVariableSystems(16.67);

        // Enemy1 should be alive with 30 health
        expect(enemy1.hasComponent(Health)).toBe(true);
        expect(enemy1.getComponent(Health).current).toBe(30);
        expect(enemy1.hasComponent(Damage)).toBe(false);

        // Enemy2 should be queued for deletion
        // Process deletions
        engine.update(0);

        // Check that enemy1 still exists but enemy2 is gone
        const remainingEntities = engine.getAllEntities();
        expect(remainingEntities.length).toBe(1);
        expect(remainingEntities[0]).toBe(enemy1);
    });
});

// =============================================================================
// Example 8: Integration Testing
// =============================================================================

describe('Full Game Loop Integration', () => {
    it('should run a complete game simulation', () => {
        const engine = new TestEngineBuilder().build();
        const clock = new TestClock(60);
        const snapshot = new TestSnapshot(engine);

        // Setup game systems
        engine.createSystem(
            'MovementSystem',
            {
                all: [Position, Velocity],
            },
            {
                act: (_entity: any, ...components: any[]) => {
                    const pos = components[0] as Position;
                    const vel = components[1] as Velocity;
                    pos.x += vel.vx;
                    pos.y += vel.vy;
                },
            }
        );

        // Create game entities
        const player = createTestEntity(engine, {
            name: 'Player',
            components: [
                { type: Position, args: [0, 0] },
                { type: Velocity, args: [1, 0] },
            ],
        });

        // Take initial snapshot
        const initialState = snapshot.create();

        // Simulate 60 frames (1 second)
        for (let i = 0; i < 60; i++) {
            clock.step();
            engine.update(clock.deltaTime);
        }

        // Player should have moved
        const pos = player.getComponent(Position);
        expect(pos.x).toBe(60);
        expect(pos.y).toBe(0);

        // Restore to initial state
        snapshot.restore(initialState);

        // Verify restoration
        const entities = engine.getAllEntities();
        expect(entities.length).toBe(1);
    });
});

/**
 * Best Practices for Testing with OrionECS
 *
 * 1. Use TestEngineBuilder for consistent test setup
 * 2. Clean up entities after each test to prevent test interference
 * 3. Use TestClock for deterministic time-based testing
 * 4. Use createTestEntity/createTestEntities for quick entity setup
 * 5. Use TestSystemRunner to verify system execution
 * 6. Use TestSnapshot for state restoration testing
 * 7. Setup custom matchers for cleaner assertions
 * 8. Test systems in isolation before integration testing
 * 9. Use descriptive entity names in tests for better debugging
 * 10. Verify both positive and negative test cases
 */
