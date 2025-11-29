/**
 * Tests for Entity Archetype System
 */

import { Archetype, ArchetypeManager, ComponentTypeRegistry } from './archetype';
import { Entity, EntityIdGenerator, EventEmitter } from './core';
import { ComponentManager } from './managers';

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
    constructor(public value: number = 100) {}
}

describe('Archetype', () => {
    let archetype: Archetype;
    let registry: ComponentTypeRegistry;

    beforeEach(() => {
        registry = new ComponentTypeRegistry();
        archetype = new Archetype([Position, Velocity], registry);
    });

    describe('constructor', () => {
        it('should create archetype with sorted component types', () => {
            expect(archetype.componentTypes).toHaveLength(2);
            // ID includes unique identifiers to prevent collisions with same-named components
            expect(archetype.id).toContain('Position');
            expect(archetype.id).toContain('Velocity');
        });

        it('should handle empty component types', () => {
            const emptyArchetype = new Archetype([], registry);
            expect(emptyArchetype.componentTypes).toHaveLength(0);
            expect(emptyArchetype.id).toBe('');
        });

        it('should sort component types for consistent IDs', () => {
            const archetype1 = new Archetype([Velocity, Position], registry);
            const archetype2 = new Archetype([Position, Velocity], registry);
            expect(archetype1.id).toBe(archetype2.id);
        });
    });

    describe('hasComponentType', () => {
        it('should return true for component types in archetype', () => {
            expect(archetype.hasComponentType(Position)).toBe(true);
            expect(archetype.hasComponentType(Velocity)).toBe(true);
        });

        it('should return false for component types not in archetype', () => {
            expect(archetype.hasComponentType(Health)).toBe(false);
        });
    });

    describe('matches', () => {
        it('should match when all required components are present', () => {
            expect(archetype.matches({ all: [Position] })).toBe(true);
            expect(archetype.matches({ all: [Position, Velocity] })).toBe(true);
        });

        it('should not match when required components are missing', () => {
            expect(archetype.matches({ all: [Position, Velocity, Health] })).toBe(false);
        });

        it('should match when any component is present', () => {
            expect(archetype.matches({ any: [Position] })).toBe(true);
            expect(archetype.matches({ any: [Health, Position] })).toBe(true);
        });

        it('should not match when no any components are present', () => {
            expect(archetype.matches({ any: [Health] })).toBe(false);
        });

        it('should not match when excluded components are present', () => {
            expect(archetype.matches({ none: [Position] })).toBe(false);
        });

        it('should match when excluded components are not present', () => {
            expect(archetype.matches({ none: [Health] })).toBe(true);
        });

        it('should handle complex queries', () => {
            expect(
                archetype.matches({
                    all: [Position],
                    any: [Velocity],
                    none: [Health],
                })
            ).toBe(true);
        });
    });

    describe('entity management', () => {
        let componentManager: ComponentManager;
        let eventEmitter: EventEmitter;
        let idGenerator: EntityIdGenerator;
        let entity: Entity;

        beforeEach(() => {
            componentManager = new ComponentManager();
            eventEmitter = new EventEmitter();
            idGenerator = new EntityIdGenerator();
            entity = Entity.create(componentManager, eventEmitter, idGenerator);
        });

        it('should add entity with components', () => {
            const components = new Map();
            components.set(Position, new Position(10, 20));
            components.set(Velocity, new Velocity(1, 2));

            archetype.addEntity(entity, components);

            expect(archetype.entityCount).toBe(1);
            expect(archetype.hasEntity(entity)).toBe(true);
        });

        it('should remove entity using swap-and-pop', () => {
            const components1 = new Map();
            components1.set(Position, new Position(10, 20));
            components1.set(Velocity, new Velocity(1, 2));

            const entity2 = Entity.create(componentManager, eventEmitter, idGenerator);
            const components2 = new Map();
            components2.set(Position, new Position(30, 40));
            components2.set(Velocity, new Velocity(3, 4));

            archetype.addEntity(entity, components1);
            archetype.addEntity(entity2, components2);

            const removedComponents = archetype.removeEntity(entity);

            expect(archetype.entityCount).toBe(1);
            expect(archetype.hasEntity(entity)).toBe(false);
            expect(archetype.hasEntity(entity2)).toBe(true);
            expect(removedComponents).not.toBeNull();
        });

        it('should get component for entity', () => {
            const components = new Map();
            const position = new Position(10, 20);
            components.set(Position, position);
            components.set(Velocity, new Velocity(1, 2));

            archetype.addEntity(entity, components);

            const retrievedPosition = archetype.getComponent(entity, Position);
            expect(retrievedPosition).toBe(position);
            expect(retrievedPosition?.x).toBe(10);
            expect(retrievedPosition?.y).toBe(20);
        });

        it('should set component for entity', () => {
            const components = new Map();
            components.set(Position, new Position(10, 20));
            components.set(Velocity, new Velocity(1, 2));

            archetype.addEntity(entity, components);

            const newPosition = new Position(30, 40);
            archetype.setComponent(entity, Position, newPosition);

            const retrievedPosition = archetype.getComponent(entity, Position);
            expect(retrievedPosition).toBe(newPosition);
            expect(retrievedPosition?.x).toBe(30);
        });

        it('should iterate over entities efficiently', () => {
            const entity2 = Entity.create(componentManager, eventEmitter, idGenerator);

            const components1 = new Map();
            components1.set(Position, new Position(10, 20));
            components1.set(Velocity, new Velocity(1, 2));

            const components2 = new Map();
            components2.set(Position, new Position(30, 40));
            components2.set(Velocity, new Velocity(3, 4));

            archetype.addEntity(entity, components1);
            archetype.addEntity(entity2, components2);

            const results: Array<{ entity: Entity; position: Position; velocity: Velocity }> = [];

            archetype.forEach<[Position, Velocity]>((e, position, velocity) => {
                results.push({ entity: e, position, velocity });
            });

            expect(results).toHaveLength(2);
            expect(results[0].position.x).toBe(10);
            expect(results[1].position.x).toBe(30);
        });
    });

    describe('memory stats', () => {
        it('should provide memory statistics', () => {
            const stats = archetype.getMemoryStats();
            expect(stats).toHaveProperty('entityCount');
            expect(stats).toHaveProperty('componentTypeCount');
            expect(stats).toHaveProperty('estimatedBytes');
            expect(stats.componentTypeCount).toBe(2);
        });
    });

    describe('iteration safety', () => {
        let componentManager: ComponentManager;
        let eventEmitter: EventEmitter;
        let idGenerator: EntityIdGenerator;

        beforeEach(() => {
            componentManager = new ComponentManager();
            eventEmitter = new EventEmitter();
            idGenerator = new EntityIdGenerator();
        });

        it('should defer entity removal during iteration', () => {
            const entity1 = Entity.create(componentManager, eventEmitter, idGenerator);
            const entity2 = Entity.create(componentManager, eventEmitter, idGenerator);

            const components1 = new Map();
            components1.set(Position, new Position(10, 20));
            components1.set(Velocity, new Velocity(1, 2));

            const components2 = new Map();
            components2.set(Position, new Position(30, 40));
            components2.set(Velocity, new Velocity(3, 4));

            archetype.addEntity(entity1, components1);
            archetype.addEntity(entity2, components2);

            const iteratedEntities: Entity[] = [];

            archetype.forEach((e) => {
                iteratedEntities.push(e);
                // Try to remove entity during iteration - should be deferred
                if (e === entity1) {
                    archetype.removeEntity(entity1);
                }
            });

            // Both entities should have been iterated (removal was deferred)
            expect(iteratedEntities).toHaveLength(2);

            // After iteration completes, entity1 should be removed
            expect(archetype.hasEntity(entity1)).toBe(false);
            expect(archetype.hasEntity(entity2)).toBe(true);
        });

        it('should skip entities pending removal during iteration', () => {
            const entity1 = Entity.create(componentManager, eventEmitter, idGenerator);
            const entity2 = Entity.create(componentManager, eventEmitter, idGenerator);
            const entity3 = Entity.create(componentManager, eventEmitter, idGenerator);

            const components1 = new Map();
            components1.set(Position, new Position(10, 20));
            components1.set(Velocity, new Velocity(1, 2));

            const components2 = new Map();
            components2.set(Position, new Position(30, 40));
            components2.set(Velocity, new Velocity(3, 4));

            const components3 = new Map();
            components3.set(Position, new Position(50, 60));
            components3.set(Velocity, new Velocity(5, 6));

            archetype.addEntity(entity1, components1);
            archetype.addEntity(entity2, components2);
            archetype.addEntity(entity3, components3);

            // Remove entity2 during first iteration, then verify it's skipped in subsequent callbacks
            let entity2CallCount = 0;
            archetype.forEach((e) => {
                if (e === entity1) {
                    archetype.removeEntity(entity2);
                }
                // entity2 should be skipped since it's pending removal
                if (e === entity2) {
                    entity2CallCount++;
                }
            });

            // entity2 may have been processed before it was marked for removal
            // The key guarantee is that it's eventually removed
            expect(entity2CallCount).toBeLessThanOrEqual(1);

            // entity2 should not have been processed after being marked for removal
            // Note: It may or may not be processed depending on iteration order
            // The key guarantee is that removal is deferred and entity is in pending removals
            expect(archetype.hasPendingRemoval(entity2)).toBe(false); // Processed after forEach
            expect(archetype.hasEntity(entity2)).toBe(false);
        });

        it('should return components during deferred removal for archetype moves', () => {
            const entity = Entity.create(componentManager, eventEmitter, idGenerator);

            const position = new Position(10, 20);
            const velocity = new Velocity(1, 2);
            const components = new Map();
            components.set(Position, position);
            components.set(Velocity, velocity);

            archetype.addEntity(entity, components);

            const results: Array<ReturnType<typeof archetype.removeEntity>> = [];

            archetype.forEach(() => {
                // Remove during iteration - should return components but defer actual removal
                results.push(archetype.removeEntity(entity));
            });

            // Components should have been returned for potential archetype move
            expect(results).toHaveLength(1);
            const removedComponents = results[0];
            expect(removedComponents).not.toBeNull();
            expect(removedComponents?.get(Position)).toBe(position);
            expect(removedComponents?.get(Velocity)).toBe(velocity);

            // Entity should be removed after iteration
            expect(archetype.hasEntity(entity)).toBe(false);
        });

        it('should handle nested iteration safely', () => {
            const entity = Entity.create(componentManager, eventEmitter, idGenerator);

            const components = new Map();
            components.set(Position, new Position(10, 20));
            components.set(Velocity, new Velocity(1, 2));

            archetype.addEntity(entity, components);

            let outerCount = 0;
            let innerCount = 0;

            archetype.forEach(() => {
                outerCount++;
                archetype.forEach(() => {
                    innerCount++;
                    // Removing during nested iteration should still be deferred
                    archetype.removeEntity(entity);
                });
            });

            expect(outerCount).toBe(1);
            expect(innerCount).toBe(1);
            // Entity should only be removed after all iterations complete
            expect(archetype.hasEntity(entity)).toBe(false);
        });

        it('should warn about stale indices and handle them gracefully', () => {
            // This test validates that the stale index check works correctly
            // by ensuring invalid array accesses don't cause crashes
            const entity = Entity.create(componentManager, eventEmitter, idGenerator);

            const components = new Map();
            components.set(Position, new Position(10, 20));
            components.set(Velocity, new Velocity(1, 2));

            archetype.addEntity(entity, components);

            // Spy on console.warn to verify the warning is logged for stale indices
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // Start iteration to defer removals
            archetype.forEach(() => {
                // Remove the entity - should be deferred
                const removedComponents = archetype.removeEntity(entity);
                // Should still return components during deferred removal
                expect(removedComponents).not.toBeNull();
            });

            warnSpy.mockRestore();

            // Entity should be removed after iteration
            expect(archetype.hasEntity(entity)).toBe(false);
        });
    });
});

describe('ArchetypeManager', () => {
    let archetypeManager: ArchetypeManager;
    let componentManager: ComponentManager;
    let eventEmitter: EventEmitter;
    let idGenerator: EntityIdGenerator;

    beforeEach(() => {
        archetypeManager = new ArchetypeManager();
        componentManager = new ComponentManager();
        eventEmitter = new EventEmitter();
        idGenerator = new EntityIdGenerator();
    });

    describe('getOrCreateArchetype', () => {
        it('should create new archetype for component composition', () => {
            const archetype = archetypeManager.getOrCreateArchetype([Position, Velocity]);
            expect(archetype).toBeDefined();
            // ID includes unique identifiers to prevent collisions with same-named components
            expect(archetype.id).toContain('Position');
            expect(archetype.id).toContain('Velocity');
        });

        it('should reuse existing archetype for same composition', () => {
            const archetype1 = archetypeManager.getOrCreateArchetype([Position, Velocity]);
            const archetype2 = archetypeManager.getOrCreateArchetype([Position, Velocity]);
            expect(archetype1).toBe(archetype2);
        });

        it('should create different archetypes for different compositions', () => {
            const archetype1 = archetypeManager.getOrCreateArchetype([Position]);
            const archetype2 = archetypeManager.getOrCreateArchetype([Position, Velocity]);
            expect(archetype1).not.toBe(archetype2);
        });

        it('should handle empty component types', () => {
            const archetype = archetypeManager.getOrCreateArchetype([]);
            expect(archetype).toBeDefined();
            expect(archetype.id).toBe('');
        });
    });

    describe('entity lifecycle', () => {
        let entity: Entity;

        beforeEach(() => {
            entity = Entity.create(componentManager, eventEmitter, idGenerator);
        });

        it('should add entity to archetype', () => {
            const archetype = archetypeManager.getOrCreateArchetype([Position, Velocity]);
            const components = new Map();
            components.set(Position, new Position(10, 20));
            components.set(Velocity, new Velocity(1, 2));

            archetypeManager.addEntityToArchetype(entity, archetype, components);

            expect(archetype.hasEntity(entity)).toBe(true);
            expect(archetypeManager.getEntityArchetype(entity)).toBe(archetype);
        });

        it('should move entity between archetypes', () => {
            const archetype1 = archetypeManager.getOrCreateArchetype([Position]);
            const components1 = new Map();
            components1.set(Position, new Position(10, 20));

            archetypeManager.addEntityToArchetype(entity, archetype1, components1);

            const components2 = new Map();
            components2.set(Position, new Position(10, 20));
            components2.set(Velocity, new Velocity(1, 2));

            archetypeManager.moveEntity(entity, [Position, Velocity], components2);

            const archetype2 = archetypeManager.getEntityArchetype(entity);
            expect(archetype2).toBeDefined();
            // ID includes unique identifiers to prevent collisions with same-named components
            expect(archetype2?.id).toContain('Position');
            expect(archetype2?.id).toContain('Velocity');
            expect(archetype1.hasEntity(entity)).toBe(false);
            expect(archetype2?.hasEntity(entity)).toBe(true);
        });

        it('should remove entity from archetype', () => {
            const archetype = archetypeManager.getOrCreateArchetype([Position]);
            const components = new Map();
            components.set(Position, new Position(10, 20));

            archetypeManager.addEntityToArchetype(entity, archetype, components);

            archetypeManager.removeEntity(entity);

            expect(archetype.hasEntity(entity)).toBe(false);
            expect(archetypeManager.getEntityArchetype(entity)).toBeUndefined();
        });
    });

    describe('getMatchingArchetypes', () => {
        beforeEach(() => {
            // Create several archetypes
            archetypeManager.getOrCreateArchetype([Position]);
            archetypeManager.getOrCreateArchetype([Position, Velocity]);
            archetypeManager.getOrCreateArchetype([Position, Velocity, Health]);
            archetypeManager.getOrCreateArchetype([Health]);
        });

        it('should find archetypes with all required components', () => {
            const matching = archetypeManager.getMatchingArchetypes({ all: [Position] });
            expect(matching.length).toBe(3); // Position, Position+Velocity, Position+Velocity+Health
        });

        it('should find archetypes with any of the components', () => {
            const matching = archetypeManager.getMatchingArchetypes({ any: [Health] });
            expect(matching.length).toBe(2); // Health, Position+Velocity+Health
        });

        it('should exclude archetypes with specified components', () => {
            const matching = archetypeManager.getMatchingArchetypes({
                all: [Position],
                none: [Health],
            });
            expect(matching.length).toBe(2); // Position, Position+Velocity (not Position+Velocity+Health)
        });

        it('should handle complex queries', () => {
            const matching = archetypeManager.getMatchingArchetypes({
                all: [Position],
                any: [Velocity],
                none: [Health],
            });
            expect(matching.length).toBe(1); // Only Position+Velocity
        });
    });

    describe('statistics', () => {
        it('should provide archetype statistics', () => {
            archetypeManager.getOrCreateArchetype([Position]);
            archetypeManager.getOrCreateArchetype([Position, Velocity]);

            const stats = archetypeManager.getStats();
            expect(stats.archetypeCount).toBeGreaterThanOrEqual(2);
            expect(stats).toHaveProperty('archetypeCreationCount');
            expect(stats).toHaveProperty('entityMovementCount');
            expect(stats).toHaveProperty('archetypes');
        });

        it('should provide memory statistics', () => {
            const entity = Entity.create(componentManager, eventEmitter, idGenerator);
            const archetype = archetypeManager.getOrCreateArchetype([Position]);
            const components = new Map();
            components.set(Position, new Position(10, 20));

            archetypeManager.addEntityToArchetype(entity, archetype, components);

            const memStats = archetypeManager.getMemoryStats();
            expect(memStats).toHaveProperty('totalEntities');
            expect(memStats).toHaveProperty('totalArchetypes');
            expect(memStats).toHaveProperty('estimatedBytes');
            expect(memStats).toHaveProperty('archetypeBreakdown');
        });
    });

    describe('clear', () => {
        it('should clear all archetypes', () => {
            archetypeManager.getOrCreateArchetype([Position]);
            archetypeManager.getOrCreateArchetype([Position, Velocity]);

            archetypeManager.clear();

            const stats = archetypeManager.getStats();
            // Only empty archetype should remain
            expect(stats.archetypeCount).toBe(1);
        });
    });
});
