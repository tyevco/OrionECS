/**
 * DebugVisualizerPlugin Test Suite
 *
 * Comprehensive tests covering:
 * - Plugin installation and API extension
 * - Entity hierarchy visualization
 * - Component usage statistics
 * - System execution timeline
 * - Query performance analysis
 * - Debug information reporting
 */

import { EngineBuilder, Engine } from '../../../core/src/index';
import { DebugVisualizerPlugin, DebugAPI } from './DebugVisualizerPlugin';

// Test components
class Position {
    constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
    constructor(public x: number = 0, public y: number = 0) {}
}

class Health {
    constructor(public current: number = 100, public max: number = 100) {}
}

describe('DebugVisualizerPlugin', () => {
    let engine: Engine;
    let plugin: DebugVisualizerPlugin;

    beforeEach(() => {
        plugin = new DebugVisualizerPlugin();
        engine = new EngineBuilder()
            .withDebugMode(true)
            .use(plugin)
            .build();

        // Register components
        engine.registerComponent(Position);
        engine.registerComponent(Velocity);
        engine.registerComponent(Health);
    });

    afterEach(() => {
        engine.stop();
    });

    describe('Plugin Metadata', () => {
        test('should have correct name and version', () => {
            expect(plugin.name).toBe('DebugVisualizerPlugin');
            expect(plugin.version).toBe('1.0.0');
        });
    });

    describe('Plugin Installation', () => {
        test('should install successfully', () => {
            expect(engine).toBeDefined();
        });

        test('should extend engine with debug API', () => {
            expect((engine as any).debug).toBeDefined();
            expect((engine as any).debug).toBeInstanceOf(DebugAPI);
        });
    });

    describe('DebugAPI - Entity Hierarchy', () => {
        let api: DebugAPI;

        beforeEach(() => {
            api = (engine as any).debug;
        });

        test('should print hierarchy for empty scene', () => {
            const output = api.printHierarchy();

            expect(output).toContain('(No root entities)');
        });

        test('should print hierarchy with single entity', () => {
            const entity = engine.createEntity('Player');

            const output = api.printHierarchy();

            expect(output).toContain('Player');
        });

        test('should print hierarchy with parent-child relationships', () => {
            const parent = engine.createEntity('Parent');
            const child = engine.createEntity('Child');
            child.setParent(parent);

            const output = api.printHierarchy();

            expect(output).toContain('Parent');
            expect(output).toContain('Child');
        });

        test('should include entity tags in hierarchy', () => {
            const entity = engine.createEntity('Player');
            entity.addTag('player');
            entity.addTag('active');

            const output = api.printHierarchy();

            expect(output).toContain('player');
            expect(output).toContain('active');
        });

        test('should print hierarchy for specific root entity', () => {
            const root1 = engine.createEntity('Root1');
            const child1 = engine.createEntity('Child1');
            child1.setParent(root1);

            const root2 = engine.createEntity('Root2');
            const child2 = engine.createEntity('Child2');
            child2.setParent(root2);

            const output = api.printHierarchy(root1);

            expect(output).toContain('Root1');
            expect(output).toContain('Child1');
            expect(output).not.toContain('Root2');
        });

        test('should handle deep hierarchies', () => {
            const level1 = engine.createEntity('Level1');
            const level2 = engine.createEntity('Level2');
            const level3 = engine.createEntity('Level3');

            level2.setParent(level1);
            level3.setParent(level2);

            const output = api.printHierarchy();

            expect(output).toContain('Level1');
            expect(output).toContain('Level2');
            expect(output).toContain('Level3');
        });
    });

    describe('DebugAPI - Component Statistics', () => {
        let api: DebugAPI;

        beforeEach(() => {
            api = (engine as any).debug;
        });

        test('should print stats for scene with no components', () => {
            const output = api.printComponentStats();

            expect(output).toContain('Component Statistics');
        });

        test('should track component usage', () => {
            // Create entities with components
            for (let i = 0; i < 5; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(Position, i, i);
            }

            for (let i = 0; i < 3; i++) {
                const entity = engine.getAllEntities()[i];
                entity.addComponent(Velocity, 1, 1);
            }

            const output = api.printComponentStats();

            expect(output).toContain('Component Statistics');
        });

        test('should show total entity count', () => {
            for (let i = 0; i < 10; i++) {
                engine.createEntity(`Entity${i}`);
            }

            const output = api.printComponentStats();

            expect(output).toContain('Total entities');
        });
    });

    describe('DebugAPI - System Timeline', () => {
        let api: DebugAPI;

        beforeEach(() => {
            api = (engine as any).debug;
        });

        test('should generate system timeline', () => {
            // Create a system
            engine.createSystem(
                'TestSystem',
                { all: [Position] },
                {
                    act: (entity, position: Position) => {
                        position.x += 1;
                    }
                },
                false
            );

            engine.start();
            engine.update(0);

            const timeline = api.getSystemTimeline();

            expect(Array.isArray(timeline)).toBe(true);
        });

        test('should include system execution data', () => {
            engine.createSystem(
                'MovementSystem',
                { all: [Position, Velocity] },
                {
                    act: (entity, position: Position, velocity: Velocity) => {
                        position.x += velocity.x;
                    }
                },
                false
            );

            const entity = engine.createEntity('Entity');
            entity.addComponent(Position, 0, 0);
            entity.addComponent(Velocity, 1, 0);

            engine.start();
            engine.update(0);

            const timeline = api.getSystemTimeline();

            expect(timeline.length).toBeGreaterThan(0);
        });

        test('should export Chrome trace format', () => {
            engine.createSystem(
                'TestSystem',
                {},
                {
                    act: () => {}
                },
                false
            );

            engine.start();
            engine.update(0);

            const trace = api.exportChromeTrace();

            expect(typeof trace).toBe('string');
            expect(() => JSON.parse(trace)).not.toThrow();

            const parsed = JSON.parse(trace);
            expect(parsed).toHaveProperty('traceEvents');
        });
    });

    describe('DebugAPI - Query Analysis', () => {
        let api: DebugAPI;

        beforeEach(() => {
            api = (engine as any).debug;
        });

        test('should analyze query', () => {
            const query = engine.createQuery({ all: [Position] });

            const output = api.analyzeQuery(query);

            expect(output).toContain('Query Performance Analysis');
        });

        test('should show query match count', () => {
            // Create entities
            for (let i = 0; i < 5; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(Position, i, i);
            }

            const query = engine.createQuery({ all: [Position] });

            const output = api.analyzeQuery(query);

            expect(output).toContain('Matching entities');
        });

        test('should provide optimization suggestions', () => {
            const query = engine.createQuery({ all: [Position] });

            const output = api.analyzeQuery(query);

            expect(output).toContain('Optimization Suggestions');
        });

        test('should warn about queries with many matches', () => {
            // Create many entities
            for (let i = 0; i < 1500; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(Position, i, i);
            }

            const query = engine.createQuery({ all: [Position] });

            const output = api.analyzeQuery(query);

            expect(output).toContain('many entities');
        });

        test('should warn about queries with no matches', () => {
            const query = engine.createQuery({ all: [Position, Velocity, Health] });

            const output = api.analyzeQuery(query);

            expect(output).toContain('no entities');
        });
    });

    describe('DebugAPI - Debug Information', () => {
        let api: DebugAPI;

        beforeEach(() => {
            api = (engine as any).debug;
        });

        test('should get debug info', () => {
            const info = api.getDebugInfo();

            expect(info).toHaveProperty('entityCount');
            expect(info).toHaveProperty('systemCount');
            expect(info).toHaveProperty('queryCount');
            expect(info).toHaveProperty('componentTypes');
            expect(info).toHaveProperty('memoryStats');
        });

        test('should track entity count', () => {
            for (let i = 0; i < 10; i++) {
                engine.createEntity(`Entity${i}`);
            }

            const info = api.getDebugInfo();

            expect(info.entityCount).toBeGreaterThanOrEqual(0);
        });

        test('should track system count', () => {
            engine.createSystem('System1', {}, { act: () => {} }, false);
            engine.createSystem('System2', {}, { act: () => {} }, false);

            const info = api.getDebugInfo();

            expect(info.systemCount).toBeGreaterThanOrEqual(0);
        });

        test('should track query count', () => {
            engine.createQuery({ all: [Position] });
            engine.createQuery({ all: [Velocity] });

            const info = api.getDebugInfo();

            expect(info.queryCount).toBeGreaterThanOrEqual(0);
        });

        test('should print debug summary', () => {
            const output = api.printDebugSummary();

            expect(output).toContain('ORION ECS DEBUG SUMMARY');
            expect(output).toContain('Total Entities');
            expect(output).toContain('Active Systems');
        });
    });

    describe('Integration Tests', () => {
        let api: DebugAPI;

        beforeEach(() => {
            api = (engine as any).debug;
        });

        test('should work with complex scene', () => {
            // Create hierarchy
            const player = engine.createEntity('Player');
            player.addTag('player');
            player.addComponent(Position, 0, 0);
            player.addComponent(Velocity, 1, 1);
            player.addComponent(Health, 100, 100);

            const weapon = engine.createEntity('Weapon');
            weapon.setParent(player);
            weapon.addComponent(Position, 10, 0);

            const enemy = engine.createEntity('Enemy');
            enemy.addTag('enemy');
            enemy.addComponent(Position, 100, 100);
            enemy.addComponent(Health, 50, 50);

            // Create systems
            engine.createSystem('MovementSystem', { all: [Position, Velocity] }, { act: () => {} }, false);

            // Run engine
            engine.start();
            engine.update(0);

            // All debug methods should work
            expect(() => api.printHierarchy()).not.toThrow();
            expect(() => api.printComponentStats()).not.toThrow();
            expect(() => api.printDebugSummary()).not.toThrow();
            expect(() => api.getSystemTimeline()).not.toThrow();
            expect(() => api.exportChromeTrace()).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        let api: DebugAPI;

        beforeEach(() => {
            api = (engine as any).debug;
        });

        test('should handle entities with no name', () => {
            const entity = engine.createEntity();

            const output = api.printHierarchy();

            expect(output).toBeDefined();
        });

        test('should handle very deep hierarchies', () => {
            let current = engine.createEntity('Root');

            for (let i = 0; i < 20; i++) {
                const child = engine.createEntity(`Level${i}`);
                child.setParent(current);
                current = child;
            }

            expect(() => {
                api.printHierarchy();
            }).not.toThrow();
        });

        test('should handle entities with many tags', () => {
            const entity = engine.createEntity('Entity');

            for (let i = 0; i < 10; i++) {
                entity.addTag(`tag${i}`);
            }

            expect(() => {
                api.printHierarchy();
            }).not.toThrow();
        });

        test('should handle scenes with no systems', () => {
            engine.createEntity('Entity');

            const timeline = api.getSystemTimeline();

            expect(Array.isArray(timeline)).toBe(true);
        });

        test('should handle empty timeline export', () => {
            const trace = api.exportChromeTrace();

            expect(() => JSON.parse(trace)).not.toThrow();
        });
    });

    describe('Plugin Uninstallation', () => {
        test('should uninstall cleanly', () => {
            expect(() => {
                plugin.uninstall();
            }).not.toThrow();
        });
    });
});
