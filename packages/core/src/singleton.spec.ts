/**
 * Singleton Components Test Suite
 * Tests for global state management using singleton components
 */

import { EngineBuilder } from './engine';

// Test components for singleton tests
class GameTime {
    constructor(
        public elapsed: number = 0,
        public deltaTime: number = 0
    ) {}
}

class GameSettings {
    constructor(
        public volume: number = 1.0,
        public difficulty: string = 'normal'
    ) {}
}

class ScoreManager {
    constructor(
        public score: number = 0,
        public highScore: number = 0
    ) {}
}

describe('Singleton Components', () => {
    describe('Basic Singleton Operations', () => {
        test('should set and get a singleton component', () => {
            const engine = new EngineBuilder().build();

            const time = engine.setSingleton(GameTime, 10.5, 0.016);
            expect(time.elapsed).toBe(10.5);
            expect(time.deltaTime).toBe(0.016);

            const retrieved = engine.getSingleton(GameTime);
            expect(retrieved).toBeDefined();
            expect(retrieved?.elapsed).toBe(10.5);
            expect(retrieved?.deltaTime).toBe(0.016);
        });

        test('should check if singleton exists', () => {
            const engine = new EngineBuilder().build();

            expect(engine.hasSingleton(GameTime)).toBe(false);

            engine.setSingleton(GameTime, 0, 0);
            expect(engine.hasSingleton(GameTime)).toBe(true);
        });

        test('should remove a singleton component', () => {
            const engine = new EngineBuilder().build();

            engine.setSingleton(GameTime, 10.5, 0.016);
            expect(engine.hasSingleton(GameTime)).toBe(true);

            const removed = engine.removeSingleton(GameTime);
            expect(removed).toBeDefined();
            expect(removed?.elapsed).toBe(10.5);
            expect(engine.hasSingleton(GameTime)).toBe(false);
        });

        test('should return undefined when getting non-existent singleton', () => {
            const engine = new EngineBuilder().build();

            const result = engine.getSingleton(GameTime);
            expect(result).toBeUndefined();
        });

        test('should return undefined when removing non-existent singleton', () => {
            const engine = new EngineBuilder().build();

            const result = engine.removeSingleton(GameTime);
            expect(result).toBeUndefined();
        });

        test('should replace existing singleton when set again', () => {
            const engine = new EngineBuilder().build();

            engine.setSingleton(GameTime, 10.5, 0.016);
            const first = engine.getSingleton(GameTime);
            expect(first?.elapsed).toBe(10.5);

            engine.setSingleton(GameTime, 20.5, 0.032);
            const second = engine.getSingleton(GameTime);
            expect(second?.elapsed).toBe(20.5);
            expect(second?.deltaTime).toBe(0.032);
        });
    });

    describe('Multiple Singletons', () => {
        test('should manage multiple singleton types', () => {
            const engine = new EngineBuilder().build();

            engine.setSingleton(GameTime, 10.5, 0.016);
            engine.setSingleton(GameSettings, 0.8, 'hard');
            engine.setSingleton(ScoreManager, 1000, 5000);

            expect(engine.hasSingleton(GameTime)).toBe(true);
            expect(engine.hasSingleton(GameSettings)).toBe(true);
            expect(engine.hasSingleton(ScoreManager)).toBe(true);

            const time = engine.getSingleton(GameTime);
            const settings = engine.getSingleton(GameSettings);
            const score = engine.getSingleton(ScoreManager);

            expect(time?.elapsed).toBe(10.5);
            expect(settings?.difficulty).toBe('hard');
            expect(score?.score).toBe(1000);
        });

        test('should get all singletons', () => {
            const engine = new EngineBuilder().build();

            engine.setSingleton(GameTime, 10.5, 0.016);
            engine.setSingleton(GameSettings, 0.8, 'hard');

            const singletons = engine.getAllSingletons();
            expect(singletons.size).toBe(2);

            const types = Array.from(singletons.keys()).map((t) => t.name);
            expect(types).toContain('GameTime');
            expect(types).toContain('GameSettings');
        });
    });

    describe('Singleton Events', () => {
        test('should emit event when singleton is set', (done) => {
            const engine = new EngineBuilder().build();

            engine.on('onSingletonSet', (event: any) => {
                expect(event.componentType).toBe(GameTime);
                expect(event.newValue.elapsed).toBe(10.5);
                expect(event.timestamp).toBeDefined();
                done();
            });

            engine.setSingleton(GameTime, 10.5, 0.016);
        });

        test('should emit event when singleton is replaced', (done) => {
            const engine = new EngineBuilder().build();

            engine.setSingleton(GameTime, 10.5, 0.016);

            engine.on('onSingletonSet', (event: any) => {
                expect(event.componentType).toBe(GameTime);
                expect(event.oldValue).toBeDefined();
                expect(event.oldValue.elapsed).toBe(10.5);
                expect(event.newValue.elapsed).toBe(20.5);
                done();
            });

            engine.setSingleton(GameTime, 20.5, 0.032);
        });

        test('should emit event when singleton is removed', (done) => {
            const engine = new EngineBuilder().build();

            engine.setSingleton(GameTime, 10.5, 0.016);

            engine.on('onSingletonRemoved', (event: any) => {
                expect(event.componentType).toBe(GameTime);
                expect(event.component.elapsed).toBe(10.5);
                expect(event.timestamp).toBeDefined();
                done();
            });

            engine.removeSingleton(GameTime);
        });

        test('should emit event when singleton is marked dirty', (done) => {
            const engine = new EngineBuilder().build();

            const time = engine.setSingleton(GameTime, 10.5, 0.016);

            engine.on('onSingletonSet', (event: any) => {
                if (event.oldValue === event.newValue) {
                    // This is the dirty mark event
                    expect(event.componentType).toBe(GameTime);
                    expect(event.newValue).toBe(time);
                    done();
                }
            });

            // Modify and mark dirty
            time.elapsed = 20.5;
            engine.markSingletonDirty(GameTime);
        });
    });

    describe('Singleton with System Callbacks', () => {
        test('should trigger system callback when singleton is set', (done) => {
            const engine = new EngineBuilder().build();

            engine.createSystem(
                'SingletonWatcher',
                { all: [] },
                {
                    onSingletonSet: (event: any) => {
                        expect(event.componentType).toBe(GameTime);
                        expect(event.newValue.elapsed).toBe(10.5);
                        done();
                    },
                }
            );

            engine.setSingleton(GameTime, 10.5, 0.016);
        });

        test('should trigger system callback when singleton is removed', (done) => {
            const engine = new EngineBuilder().build();

            engine.setSingleton(GameTime, 10.5, 0.016);

            engine.createSystem(
                'SingletonWatcher',
                { all: [] },
                {
                    onSingletonRemoved: (event: any) => {
                        expect(event.componentType).toBe(GameTime);
                        expect(event.component.elapsed).toBe(10.5);
                        done();
                    },
                }
            );

            engine.removeSingleton(GameTime);
        });

        test('should filter singleton events by watchSingletons', () => {
            const engine = new EngineBuilder().build();

            let gameTimeCalls = 0;
            let settingsCalls = 0;

            engine.createSystem(
                'GameTimeWatcher',
                { all: [] },
                {
                    watchSingletons: [GameTime],
                    onSingletonSet: (event: any) => {
                        if (event.componentType === GameTime) gameTimeCalls++;
                        if (event.componentType === GameSettings) settingsCalls++;
                    },
                }
            );

            engine.setSingleton(GameTime, 10.5, 0.016);
            engine.setSingleton(GameSettings, 0.8, 'hard');

            expect(gameTimeCalls).toBe(1);
            expect(settingsCalls).toBe(0);
        });
    });

    describe('Singleton Serialization', () => {
        test('should serialize singletons in world snapshot', () => {
            const engine = new EngineBuilder().build();

            engine.setSingleton(GameTime, 10.5, 0.016);
            engine.setSingleton(GameSettings, 0.8, 'hard');

            const world = engine.serialize();

            expect(world.singletons).toBeDefined();
            expect(world.singletons!['GameTime']).toBeDefined();
            const gameTime = world.singletons!['GameTime'] as { elapsed: number };
            expect(gameTime.elapsed).toBe(10.5);
            expect(world.singletons!['GameSettings']).toBeDefined();
            const gameSettings = world.singletons!['GameSettings'] as { difficulty: string };
            expect(gameSettings.difficulty).toBe('hard');
        });

        test('should restore singletons from snapshot', () => {
            const engine = new EngineBuilder().build();

            // Set initial singletons
            engine.setSingleton(GameTime, 10.5, 0.016);
            engine.setSingleton(GameSettings, 0.8, 'hard');

            // Create snapshot
            engine.createSnapshot();

            // Modify singletons
            engine.setSingleton(GameTime, 50.0, 0.032);
            engine.setSingleton(GameSettings, 0.5, 'easy');

            // Verify they changed
            expect(engine.getSingleton(GameTime)?.elapsed).toBe(50.0);
            expect(engine.getSingleton(GameSettings)?.difficulty).toBe('easy');

            // Restore snapshot
            const restored = engine.restoreSnapshot();
            expect(restored).toBe(true);

            // Verify singletons were restored
            const time = engine.getSingleton(GameTime);
            const settings = engine.getSingleton(GameSettings);

            expect(time?.elapsed).toBe(10.5);
            expect(time?.deltaTime).toBe(0.016);
            expect(settings?.volume).toBe(0.8);
            expect(settings?.difficulty).toBe('hard');
        });

        test('should handle snapshots with no singletons', () => {
            const engine = new EngineBuilder().build();

            engine.createSnapshot();

            const restored = engine.restoreSnapshot();
            expect(restored).toBe(true);

            expect(engine.getAllSingletons().size).toBe(0);
        });
    });

    describe('Singleton in Plugins', () => {
        test('should allow plugins to set and get singletons', () => {
            class TestPlugin {
                name = 'TestPlugin';

                install(context: any): void {
                    context.setSingleton(GameTime, 10.5, 0.016);
                }
            }

            const engine = new EngineBuilder().use(new TestPlugin()).build();

            const time = engine.getSingleton(GameTime);
            expect(time).toBeDefined();
            expect(time?.elapsed).toBe(10.5);
        });

        test('should allow plugins to check and remove singletons', () => {
            class TestPlugin {
                name = 'TestPlugin';

                install(context: any): void {
                    context.setSingleton(GameTime, 10.5, 0.016);

                    expect(context.hasSingleton(GameTime)).toBe(true);

                    const removed = context.removeSingleton(GameTime);
                    expect(removed).toBeDefined();
                    expect(context.hasSingleton(GameTime)).toBe(false);
                }
            }

            new EngineBuilder().use(new TestPlugin()).build();
        });
    });

    describe('Singleton with Debug Mode', () => {
        test('should log singleton operations in debug mode', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const engine = new EngineBuilder().withDebugMode(true).build();

            engine.setSingleton(GameTime, 10.5, 0.016);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Singleton component GameTime set')
            );

            engine.removeSingleton(GameTime);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Singleton component GameTime removed')
            );

            consoleSpy.mockRestore();
        });
    });

    describe('Practical Use Cases', () => {
        test('should manage game time singleton', () => {
            const engine = new EngineBuilder().build();

            // Initialize time
            engine.setSingleton(GameTime, 0, 0);

            // Simulate game loop
            for (let i = 0; i < 60; i++) {
                const time = engine.getSingleton(GameTime)!;
                time.elapsed += 0.016;
                time.deltaTime = 0.016;
            }

            const finalTime = engine.getSingleton(GameTime);
            expect(finalTime?.elapsed).toBeCloseTo(0.96, 2);
            expect(finalTime?.deltaTime).toBe(0.016);
        });

        test('should manage global settings singleton', () => {
            const engine = new EngineBuilder().build();

            // Initialize settings
            engine.setSingleton(GameSettings, 1.0, 'normal');

            // System can read settings
            const settings = engine.getSingleton(GameSettings);
            expect(settings?.volume).toBe(1.0);
            expect(settings?.difficulty).toBe('normal');

            // Update settings
            engine.setSingleton(GameSettings, 0.5, 'hard');

            const updated = engine.getSingleton(GameSettings);
            expect(updated?.volume).toBe(0.5);
            expect(updated?.difficulty).toBe('hard');
        });

        test('should manage score with singleton', () => {
            const engine = new EngineBuilder().build();

            // Initialize score
            engine.setSingleton(ScoreManager, 0, 0);

            // Add points
            const score = engine.getSingleton(ScoreManager)!;
            score.score += 100;
            score.score += 50;
            score.score += 200;

            // Update high score
            if (score.score > score.highScore) {
                score.highScore = score.score;
            }

            expect(score.score).toBe(350);
            expect(score.highScore).toBe(350);
        });
    });
});
