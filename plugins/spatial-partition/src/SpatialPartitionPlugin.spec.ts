/**
 * SpatialPartitionPlugin Test Suite
 *
 * Comprehensive tests covering:
 * - Component initialization and validation
 * - Grid-based spatial partitioning
 * - Radius queries for proximity detection
 * - Rectangle queries for area searches
 * - Dynamic entity updates and grid management
 * - Performance characteristics
 */

import { TestEngineBuilder } from '@orion-ecs/testing';
import type { Engine } from 'orion-ecs';
import {
    SpatialAPI,
    SpatialCell,
    type SpatialPartitionOptions,
    SpatialPartitionPlugin,
    SpatialPosition,
} from './SpatialPartitionPlugin';

describe('SpatialPartitionPlugin', () => {
    let engine: Engine;
    let plugin: SpatialPartitionPlugin;

    beforeEach(() => {
        plugin = new SpatialPartitionPlugin();
        engine = new TestEngineBuilder().use(plugin).build();
    });

    afterEach(() => {
        engine.stop();
    });

    describe('Plugin Metadata', () => {
        test('should have correct name and version', () => {
            expect(plugin.name).toBe('SpatialPartitionPlugin');
            expect(plugin.version).toBe('1.0.0');
        });
    });

    describe('Plugin Installation', () => {
        test('should install successfully', () => {
            expect(engine).toBeDefined();
        });

        test('should extend engine with spatial API', () => {
            expect((engine as EngineWithSpatial).spatial).toBeDefined();
            expect((engine as EngineWithSpatial).spatial).toBeInstanceOf(SpatialAPI);
        });

        test('should register spatial components', () => {
            const entity = engine.createEntity('TestEntity');

            expect(() => entity.addComponent(SpatialPosition, 0, 0)).not.toThrow();
            expect(() => entity.addComponent(SpatialCell, 0, 0)).not.toThrow();
        });

        test('should create spatial indexing system', () => {
            const systems = engine.getSystemProfiles();
            const systemNames = systems.map((s) => s.name);

            expect(systemNames).toContain('SpatialIndexSystem');
        });

        test('should create default partition', () => {
            const api = (engine as EngineWithSpatial).spatial as SpatialAPI;
            const stats = api.getStats();

            // Default partition should exist
            expect(stats).toBeDefined();
        });
    });

    describe('Component - SpatialPosition', () => {
        test('should create SpatialPosition with default values', () => {
            const pos = new SpatialPosition();
            expect(pos.x).toBe(0);
            expect(pos.y).toBe(0);
        });

        test('should create SpatialPosition with custom values', () => {
            const pos = new SpatialPosition(100, 200);
            expect(pos.x).toBe(100);
            expect(pos.y).toBe(200);
        });

        test('should handle negative coordinates', () => {
            const pos = new SpatialPosition(-50, -100);
            expect(pos.x).toBe(-50);
            expect(pos.y).toBe(-100);
        });

        test('should handle large coordinates', () => {
            const pos = new SpatialPosition(10000, 10000);
            expect(pos.x).toBe(10000);
            expect(pos.y).toBe(10000);
        });
    });

    describe('Component - SpatialCell', () => {
        test('should create SpatialCell with default values', () => {
            const cell = new SpatialCell();
            expect(cell.gridX).toBe(0);
            expect(cell.gridY).toBe(0);
        });

        test('should create SpatialCell with custom values', () => {
            const cell = new SpatialCell(5, 10);
            expect(cell.gridX).toBe(5);
            expect(cell.gridY).toBe(10);
        });
    });

    describe('SpatialAPI - Partition Configuration', () => {
        let api: SpatialAPI;

        beforeEach(() => {
            api = (engine as EngineWithSpatial).spatial;
        });

        test('should create partition with custom settings', () => {
            const options: SpatialPartitionOptions = {
                type: 'grid',
                cellSize: 50,
                bounds: { x: 0, y: 0, width: 1000, height: 1000 },
            };

            expect(() => {
                api.createPartition(options);
            }).not.toThrow();
        });

        test('should clear existing partition when recreated', () => {
            // Add entity to partition
            const entity = engine.createEntity('Entity');
            entity.addComponent(SpatialPosition, 100, 100);

            engine.start();
            engine.update(0);

            let stats = api.getStats();
            expect(stats.totalEntities).toBeGreaterThan(0);

            // Recreate partition
            api.createPartition({
                type: 'grid',
                cellSize: 200,
                bounds: { x: 0, y: 0, width: 5000, height: 5000 },
            });

            stats = api.getStats();
            expect(stats.totalEntities).toBe(0);
        });
    });

    describe('SpatialAPI - Entity Updates', () => {
        let api: SpatialAPI;

        beforeEach(() => {
            api = (engine as EngineWithSpatial).spatial;
        });

        test('should add entity to spatial grid', () => {
            const entity = engine.createEntity('Entity');
            entity.addComponent(SpatialPosition, 100, 100);

            engine.start();
            engine.update(0);

            const stats = api.getStats();
            expect(stats.totalEntities).toBe(1);
        });

        test('should update entity position in grid', () => {
            const entity = engine.createEntity('Entity');
            const pos = entity.addComponent(SpatialPosition, 100, 100);

            engine.start();
            engine.update(0);

            // Move entity to different cell
            pos.x = 500;
            pos.y = 500;

            engine.update(0);

            // Should still be tracked
            const stats = api.getStats();
            expect(stats.totalEntities).toBe(1);
        });

        test('should remove entity from old cell when moved', () => {
            const entity = engine.createEntity('Entity');
            const pos = entity.addComponent(SpatialPosition, 50, 50);

            engine.start();
            engine.update(0);

            // Query original position
            const nearbyBefore = api.queryRadius({ x: 50, y: 50 }, 10);
            expect(nearbyBefore).toContain(entity);

            // Move entity far away
            pos.x = 5000;
            pos.y = 5000;
            engine.update(0);

            // Should not be near original position
            const nearbyAfter = api.queryRadius({ x: 50, y: 50 }, 10);
            expect(nearbyAfter).not.toContain(entity);
        });

        test('should handle entity deletion', () => {
            const entity = engine.createEntity('Entity');
            entity.addComponent(SpatialPosition, 100, 100);

            engine.start();
            engine.update(0);

            let stats = api.getStats();
            expect(stats.totalEntities).toBe(1);

            // Delete entity
            entity.queueFree();
            engine.update(0);

            stats = api.getStats();
            expect(stats.totalEntities).toBe(0);
        });
    });

    describe('SpatialAPI - Radius Queries', () => {
        let api: SpatialAPI;

        beforeEach(() => {
            api = (engine as EngineWithSpatial).spatial;
        });

        test('should find entities within radius', () => {
            const entity1 = engine.createEntity('Entity1');
            entity1.addComponent(SpatialPosition, 100, 100);

            const entity2 = engine.createEntity('Entity2');
            entity2.addComponent(SpatialPosition, 110, 100);

            const entity3 = engine.createEntity('Entity3');
            entity3.addComponent(SpatialPosition, 500, 500);

            engine.start();
            engine.update(0);

            const nearby = api.queryRadius({ x: 100, y: 100 }, 20);

            expect(nearby).toContain(entity1);
            expect(nearby).toContain(entity2);
            expect(nearby).not.toContain(entity3);
        });

        test('should return empty array when no entities in radius', () => {
            const entity = engine.createEntity('Entity');
            entity.addComponent(SpatialPosition, 500, 500);

            engine.start();
            engine.update(0);

            const nearby = api.queryRadius({ x: 0, y: 0 }, 10);

            expect(nearby).toHaveLength(0);
        });

        test('should handle radius of 0', () => {
            const entity = engine.createEntity('Entity');
            entity.addComponent(SpatialPosition, 100, 100);

            engine.start();
            engine.update(0);

            const nearby = api.queryRadius({ x: 100, y: 100 }, 0);

            expect(nearby).toContain(entity);
        });

        test('should handle large radius', () => {
            const entities = [];
            for (let i = 0; i < 10; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(SpatialPosition, i * 100, i * 100);
                entities.push(entity);
            }

            engine.start();
            engine.update(0);

            const nearby = api.queryRadius({ x: 500, y: 500 }, 1000);

            expect(nearby.length).toBeGreaterThan(0);
        });

        test('should handle queries across multiple grid cells', () => {
            // Create entities in different grid cells
            const entity1 = engine.createEntity('Entity1');
            entity1.addComponent(SpatialPosition, 90, 90);

            const entity2 = engine.createEntity('Entity2');
            entity2.addComponent(SpatialPosition, 110, 90);

            const entity3 = engine.createEntity('Entity3');
            entity3.addComponent(SpatialPosition, 90, 110);

            engine.start();
            engine.update(0);

            // Query that spans multiple cells
            const nearby = api.queryRadius({ x: 100, y: 100 }, 30);

            expect(nearby.length).toBe(3);
        });
    });

    describe('SpatialAPI - Rectangle Queries', () => {
        let api: SpatialAPI;

        beforeEach(() => {
            api = (engine as EngineWithSpatial).spatial;
        });

        test('should find entities within rectangle', () => {
            const entity1 = engine.createEntity('Entity1');
            entity1.addComponent(SpatialPosition, 50, 50);

            const entity2 = engine.createEntity('Entity2');
            entity2.addComponent(SpatialPosition, 150, 50);

            const entity3 = engine.createEntity('Entity3');
            entity3.addComponent(SpatialPosition, 500, 500);

            engine.start();
            engine.update(0);

            const inRect = api.queryRect(0, 0, 200, 200);

            expect(inRect).toContain(entity1);
            expect(inRect).toContain(entity2);
            expect(inRect).not.toContain(entity3);
        });

        test('should return empty array when no entities in rectangle', () => {
            const entity = engine.createEntity('Entity');
            entity.addComponent(SpatialPosition, 500, 500);

            engine.start();
            engine.update(0);

            const inRect = api.queryRect(0, 0, 100, 100);

            expect(inRect).toHaveLength(0);
        });

        test('should handle rectangle at edges', () => {
            const entity = engine.createEntity('Entity');
            entity.addComponent(SpatialPosition, 0, 0);

            engine.start();
            engine.update(0);

            const inRect = api.queryRect(0, 0, 100, 100);

            expect(inRect).toContain(entity);
        });

        test('should handle queries across multiple grid cells', () => {
            // Create entities in different grid cells
            for (let x = 0; x < 5; x++) {
                for (let y = 0; y < 5; y++) {
                    const entity = engine.createEntity(`Entity_${x}_${y}`);
                    entity.addComponent(SpatialPosition, x * 50, y * 50);
                }
            }

            engine.start();
            engine.update(0);

            // Query large rectangle
            const inRect = api.queryRect(0, 0, 200, 200);

            expect(inRect.length).toBeGreaterThan(0);
        });
    });

    describe('SpatialAPI - Statistics', () => {
        let api: SpatialAPI;

        beforeEach(() => {
            api = (engine as EngineWithSpatial).spatial;
        });

        test('should provide statistics', () => {
            const stats = api.getStats();

            expect(stats).toHaveProperty('totalCells');
            expect(stats).toHaveProperty('occupiedCells');
            expect(stats).toHaveProperty('totalEntities');
            expect(stats).toHaveProperty('averageEntitiesPerCell');
        });

        test('should track occupied cells', () => {
            const entity1 = engine.createEntity('Entity1');
            entity1.addComponent(SpatialPosition, 50, 50);

            const entity2 = engine.createEntity('Entity2');
            entity2.addComponent(SpatialPosition, 250, 250); // Different cell

            engine.start();
            engine.update(0);

            const stats = api.getStats();

            expect(stats.occupiedCells).toBe(2);
        });

        test('should track total entities', () => {
            for (let i = 0; i < 10; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(SpatialPosition, i * 10, i * 10);
            }

            engine.start();
            engine.update(0);

            const stats = api.getStats();

            expect(stats.totalEntities).toBe(10);
        });

        test('should calculate average entities per cell', () => {
            // Create 4 entities in same cell
            for (let i = 0; i < 4; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(SpatialPosition, 50 + i, 50);
            }

            engine.start();
            engine.update(0);

            const stats = api.getStats();

            expect(stats.averageEntitiesPerCell).toBeGreaterThan(0);
        });
    });

    describe('Integration Tests', () => {
        test('should work with many entities', () => {
            const api = (engine as EngineWithSpatial).spatial;

            // Create 1000 entities
            for (let i = 0; i < 1000; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(SpatialPosition, Math.random() * 5000, Math.random() * 5000);
            }

            engine.start();
            engine.update(0);

            const stats = api.getStats();

            expect(stats.totalEntities).toBe(1000);
            expect(stats.occupiedCells).toBeGreaterThan(0);
        });

        test('should efficiently handle proximity queries', () => {
            const api = (engine as EngineWithSpatial).spatial;

            // Create many entities
            for (let i = 0; i < 500; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(SpatialPosition, Math.random() * 5000, Math.random() * 5000);
            }

            engine.start();
            engine.update(0);

            // Query should complete quickly
            const startTime = performance.now();
            api.queryRadius({ x: 1000, y: 1000 }, 100);
            const endTime = performance.now();

            expect(endTime - startTime).toBeLessThan(10); // Should be fast
        });

        test('should handle dynamic entity movement', () => {
            const api = (engine as EngineWithSpatial).spatial;

            const entities = [];
            for (let i = 0; i < 50; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(SpatialPosition, i * 10, i * 10);
                entities.push(entity);
            }

            engine.start();
            engine.update(0);

            // Move all entities
            entities.forEach((entity) => {
                const pos = entity.getComponent(SpatialPosition);
                if (pos) {
                    pos.x += 100;
                    pos.y += 100;
                }
            });

            engine.update(0);

            // All entities should still be tracked
            const stats = api.getStats();
            expect(stats.totalEntities).toBe(50);
        });
    });

    describe('Edge Cases', () => {
        let api: SpatialAPI;

        beforeEach(() => {
            api = (engine as EngineWithSpatial).spatial;
        });

        test('should handle entities at negative coordinates', () => {
            const entity = engine.createEntity('Entity');
            entity.addComponent(SpatialPosition, -100, -100);

            engine.start();
            engine.update(0);

            const nearby = api.queryRadius({ x: -100, y: -100 }, 50);

            expect(nearby).toContain(entity);
        });

        test('should handle entities outside partition bounds', () => {
            const entity = engine.createEntity('Entity');
            entity.addComponent(SpatialPosition, 20000, 20000);

            expect(() => {
                engine.start();
                engine.update(0);
            }).not.toThrow();
        });

        test('should handle very small cell sizes', () => {
            api.createPartition({
                type: 'grid',
                cellSize: 1,
                bounds: { x: 0, y: 0, width: 100, height: 100 },
            });

            const entity = engine.createEntity('Entity');
            entity.addComponent(SpatialPosition, 50, 50);

            expect(() => {
                engine.start();
                engine.update(0);
            }).not.toThrow();
        });

        test('should handle very large cell sizes', () => {
            api.createPartition({
                type: 'grid',
                cellSize: 10000,
                bounds: { x: 0, y: 0, width: 50000, height: 50000 },
            });

            const entity = engine.createEntity('Entity');
            entity.addComponent(SpatialPosition, 5000, 5000);

            expect(() => {
                engine.start();
                engine.update(0);
            }).not.toThrow();
        });

        test('should handle zero-sized queries', () => {
            const entity = engine.createEntity('Entity');
            entity.addComponent(SpatialPosition, 100, 100);

            engine.start();
            engine.update(0);

            const inRect = api.queryRect(100, 100, 0, 0);

            // Should find entity at exact position
            expect(inRect).toContain(entity);
        });
    });

    describe('Plugin Uninstallation', () => {
        test('should uninstall cleanly', () => {
            expect(() => {
                plugin.uninstall();
            }).not.toThrow();
        });

        test('should clean up entity subscriptions', () => {
            const api = (engine as EngineWithSpatial).spatial;

            const entity = engine.createEntity('Entity');
            entity.addComponent(SpatialPosition, 100, 100);

            engine.start();
            engine.update(0);

            plugin.uninstall();

            // After uninstall, entity deletion should not throw
            expect(() => {
                entity.queueFree();
                engine.update(0);
            }).not.toThrow();
        });
    });

    describe('Performance Tests', () => {
        let api: SpatialAPI;

        beforeEach(() => {
            api = (engine as EngineWithSpatial).spatial;
        });

        test('should scale well with many entities', () => {
            // Create 5000 entities
            for (let i = 0; i < 5000; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(SpatialPosition, Math.random() * 10000, Math.random() * 10000);
            }

            const startTime = performance.now();
            engine.start();
            engine.update(0);
            const endTime = performance.now();

            // Should complete in reasonable time
            expect(endTime - startTime).toBeLessThan(100);
        });

        test('should perform queries efficiently', () => {
            // Create many entities
            for (let i = 0; i < 1000; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                entity.addComponent(SpatialPosition, Math.random() * 5000, Math.random() * 5000);
            }

            engine.start();
            engine.update(0);

            // Perform many queries
            const startTime = performance.now();
            for (let i = 0; i < 100; i++) {
                api.queryRadius({ x: Math.random() * 5000, y: Math.random() * 5000 }, 50);
            }
            const endTime = performance.now();

            // 100 queries should be fast
            expect(endTime - startTime).toBeLessThan(50);
        });
    });
});
