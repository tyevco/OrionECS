/**
 * Tests for Entity Archetype System
 */

import { Archetype, ArchetypeManager } from './archetype';
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

    beforeEach(() => {
        archetype = new Archetype([Position, Velocity]);
    });

    describe('constructor', () => {
        it('should create archetype with sorted component types', () => {
            expect(archetype.componentTypes).toHaveLength(2);
            // ID includes unique identifiers to prevent collisions with same-named components
            expect(archetype.id).toContain('Position');
            expect(archetype.id).toContain('Velocity');
        });

        it('should handle empty component types', () => {
            const emptyArchetype = new Archetype([]);
            expect(emptyArchetype.componentTypes).toHaveLength(0);
            expect(emptyArchetype.id).toBe('');
        });

        it('should sort component types for consistent IDs', () => {
            const archetype1 = new Archetype([Velocity, Position]);
            const archetype2 = new Archetype([Position, Velocity]);
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

            archetype.forEach((e, position, velocity) => {
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
