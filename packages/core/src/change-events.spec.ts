/**
 * Component Change Events - Comprehensive Test Suite
 * Tests for Issue #52 - Component Change Events Core Implementation
 */

import type { ComponentChangeEvent } from './definitions';
import { EngineBuilder } from './engine';

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

describe('Component Change Events', () => {
    describe('Core Event Infrastructure', () => {
        test('should emit onComponentAdded event when component is added', () => {
            const engine = new EngineBuilder().build();
            const events: any[] = [];

            engine.on('onComponentAdded', (entity, componentType) => {
                events.push({ entity, componentType });
            });

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);

            expect(events.length).toBe(1);
            expect(events[0].componentType).toBe(Position);
            expect(events[0].entity).toBe(entity);
        });

        test('should emit onComponentRemoved event when component is removed', () => {
            const engine = new EngineBuilder().build();
            const events: any[] = [];

            engine.on('onComponentRemoved', (entity, componentType, component) => {
                events.push({ entity, componentType, component });
            });

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);
            entity.removeComponent(Position);

            expect(events.length).toBe(1);
            expect(events[0].componentType).toBe(Position);
            expect(events[0].entity).toBe(entity);
            expect(events[0].component).toBeDefined();
        });

        test('should emit onComponentChanged event when component is marked dirty', () => {
            const engine = new EngineBuilder().build();
            const events: ComponentChangeEvent[] = [];

            engine.on('onComponentChanged', (event: ComponentChangeEvent) => {
                events.push(event);
            });

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);

            // Mark component as dirty
            engine.markComponentDirty(entity, Position);

            expect(events.length).toBe(1);
            expect(events[0].componentType).toBe(Position);
            expect(events[0].entity).toBe(entity);
            expect(events[0].newValue).toBeDefined();
            expect(events[0].timestamp).toBeDefined();
        });
    });

    describe('Change Detection - Manual Dirty Flagging', () => {
        test('should track dirty state in ComponentArray', () => {
            const engine = new EngineBuilder().build();
            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);

            // Mark as dirty
            engine.markComponentDirty(entity, Position);

            // Check dirty state
            const dirtyComponents = engine.getDirtyComponents(entity);
            expect(dirtyComponents).toContain(Position);
        });

        test('should clear dirty flags for a single entity', () => {
            const engine = new EngineBuilder().build();
            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);

            engine.markComponentDirty(entity, Position);
            expect(engine.getDirtyComponents(entity)).toContain(Position);

            engine.clearDirtyComponents(entity);
            expect(engine.getDirtyComponents(entity).length).toBe(0);
        });

        test('should clear all dirty flags across all entities', () => {
            const engine = new EngineBuilder().build();
            const entity1 = engine.createEntity();
            const entity2 = engine.createEntity();

            entity1.addComponent(Position, 10, 20);
            entity2.addComponent(Velocity, 1, 1);

            engine.markComponentDirty(entity1, Position);
            engine.markComponentDirty(entity2, Velocity);

            expect(engine.getDirtyComponents(entity1).length).toBe(1);
            expect(engine.getDirtyComponents(entity2).length).toBe(1);

            engine.clearAllDirtyComponents();

            expect(engine.getDirtyComponents(entity1).length).toBe(0);
            expect(engine.getDirtyComponents(entity2).length).toBe(0);
        });
    });

    describe('Change Detection - Proxy-based Tracking', () => {
        test('should create reactive component when proxy tracking is enabled', () => {
            const engine = new EngineBuilder()
                .withChangeTracking({ enableProxyTracking: true })
                .build();

            const entity = engine.createEntity();
            const position = new Position(10, 20);
            const reactivePosition = engine.createReactiveComponent(position, entity, Position);

            expect(reactivePosition).toBeDefined();
            expect(reactivePosition.x).toBe(10);
            expect(reactivePosition.y).toBe(20);
        });

        test('should emit change events when reactive component properties change', () => {
            const engine = new EngineBuilder()
                .withChangeTracking({ enableProxyTracking: true })
                .build();

            const events: ComponentChangeEvent[] = [];
            engine.on('onComponentChanged', (event: ComponentChangeEvent) => {
                events.push(event);
            });

            const entity = engine.createEntity();
            // Add component to entity first
            entity.addComponent(Position, 10, 20);

            // Get the component and wrap it in a proxy
            const position = entity.getComponent(Position);
            const reactivePosition = engine.createReactiveComponent(position, entity, Position);

            // Change property - should trigger change event
            reactivePosition.x = 30;

            expect(events.length).toBe(1);
            expect(events[0].componentType).toBe(Position);
        });

        test('should not create reactive component when proxy tracking is disabled', () => {
            const engine = new EngineBuilder()
                .withChangeTracking({ enableProxyTracking: false })
                .build();

            const entity = engine.createEntity();
            const position = new Position(10, 20);
            const reactivePosition = engine.createReactiveComponent(position, entity, Position);

            // Should return original component when proxy tracking is disabled
            expect(reactivePosition).toBe(position);
        });
    });

    describe('System Integration', () => {
        test('should allow systems to subscribe to component added events', () => {
            const engine = new EngineBuilder().build();
            const addedEvents: any[] = [];

            engine.createSystem(
                'TestSystem',
                { all: [Position] },
                {
                    act: () => {},
                    onComponentAdded: (event) => {
                        addedEvents.push(event);
                    },
                }
            );

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);

            expect(addedEvents.length).toBe(1);
            expect(addedEvents[0].componentType).toBe(Position);
        });

        test('should allow systems to subscribe to component removed events', () => {
            const engine = new EngineBuilder().build();
            const removedEvents: any[] = [];

            engine.createSystem(
                'TestSystem',
                { all: [Position] },
                {
                    act: () => {},
                    onComponentRemoved: (event) => {
                        removedEvents.push(event);
                    },
                }
            );

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);
            entity.removeComponent(Position);

            expect(removedEvents.length).toBe(1);
            expect(removedEvents[0].componentType).toBe(Position);
        });

        test('should allow systems to subscribe to component changed events', () => {
            const engine = new EngineBuilder().build();
            const changedEvents: any[] = [];

            engine.createSystem(
                'TestSystem',
                { all: [Position] },
                {
                    act: () => {},
                    onComponentChanged: (event) => {
                        changedEvents.push(event);
                    },
                }
            );

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);
            engine.markComponentDirty(entity, Position);

            expect(changedEvents.length).toBe(1);
            expect(changedEvents[0].componentType).toBe(Position);
        });

        test('should filter events by watchComponents', () => {
            const engine = new EngineBuilder().build();
            const events: any[] = [];

            engine.createSystem(
                'TestSystem',
                { all: [] },
                {
                    act: () => {},
                    onComponentAdded: (event) => {
                        events.push(event);
                    },
                    watchComponents: [Position], // Only watch Position
                }
            );

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);
            entity.addComponent(Velocity, 1, 1);

            // Should only receive Position event
            expect(events.length).toBe(1);
            expect(events[0].componentType).toBe(Position);
        });
    });

    describe('Performance & Memory - Batch Mode', () => {
        test('should suspend events when batch mode is enabled', () => {
            const engine = new EngineBuilder().build();
            const events: ComponentChangeEvent[] = [];

            engine.on('onComponentChanged', (event: ComponentChangeEvent) => {
                events.push(event);
            });

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);

            // Enable batch mode
            engine.setBatchMode(true);

            // Mark as dirty - should NOT emit event
            engine.markComponentDirty(entity, Position);

            expect(events.length).toBe(0);

            // Disable batch mode
            engine.setBatchMode(false);

            // Mark as dirty again - should emit event
            engine.markComponentDirty(entity, Position);

            expect(events.length).toBe(1);
        });

        test('should support batch() helper for scoped batch operations', () => {
            const engine = new EngineBuilder().build();
            const events: ComponentChangeEvent[] = [];

            engine.on('onComponentChanged', (event: ComponentChangeEvent) => {
                events.push(event);
            });

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);

            // Execute in batch mode
            engine.batch(() => {
                engine.markComponentDirty(entity, Position);
                engine.markComponentDirty(entity, Position);
                engine.markComponentDirty(entity, Position);
            });

            // Should NOT have emitted events during batch
            expect(events.length).toBe(0);

            // After batch, events should work normally
            engine.markComponentDirty(entity, Position);
            expect(events.length).toBe(1);
        });

        test('should restore previous batch mode state after batch()', () => {
            const engine = new EngineBuilder().build();

            // Start with batch mode enabled
            engine.setBatchMode(true);
            expect(engine.isBatchMode()).toBe(true);

            // Execute batch (which temporarily disables and re-enables)
            engine.batch(() => {
                // Inside batch
            });

            // Should restore to enabled state
            expect(engine.isBatchMode()).toBe(true);
        });
    });

    describe('Performance & Memory - Debouncing', () => {
        test('should debounce change events when configured', async () => {
            const engine = new EngineBuilder().withChangeTracking({ debounceMs: 50 }).build();

            const events: ComponentChangeEvent[] = [];
            engine.on('onComponentChanged', (event: ComponentChangeEvent) => {
                events.push(event);
            });

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);

            // Trigger multiple changes rapidly
            engine.markComponentDirty(entity, Position);
            engine.markComponentDirty(entity, Position);
            engine.markComponentDirty(entity, Position);

            // Should not have emitted yet (debounced)
            expect(events.length).toBe(0);

            // Wait for debounce timeout
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Should have emitted only once
            expect(events.length).toBe(1);
        });
    });

    describe('Integration Tests', () => {
        test('should support complete workflow with multiple entities and components', () => {
            const engine = new EngineBuilder().build();

            const addedEvents: any[] = [];
            const removedEvents: any[] = [];
            const changedEvents: any[] = [];

            engine.on('onComponentAdded', (entity, componentType) => {
                addedEvents.push({ entity, componentType });
            });

            engine.on('onComponentRemoved', (entity, componentType, component) => {
                removedEvents.push({ entity, componentType, component });
            });

            engine.on('onComponentChanged', (event: ComponentChangeEvent) => {
                changedEvents.push(event);
            });

            // Create entities
            const entity1 = engine.createEntity('Player');
            const entity2 = engine.createEntity('Enemy');

            // Add components
            entity1.addComponent(Position, 0, 0);
            entity1.addComponent(Health, 100, 100);

            entity2.addComponent(Position, 10, 10);
            entity2.addComponent(Velocity, 1, 0);

            expect(addedEvents.length).toBe(4);

            // Mark components as dirty
            engine.markComponentDirty(entity1, Position);
            engine.markComponentDirty(entity2, Velocity);

            expect(changedEvents.length).toBe(2);

            // Remove components
            entity1.removeComponent(Health);
            entity2.removeComponent(Velocity);

            expect(removedEvents.length).toBe(2);
        });

        test('should work correctly with archetype system enabled', () => {
            const engine = new EngineBuilder().withArchetypes(true).build();

            const events: any[] = [];
            engine.on('onComponentAdded', (entity, componentType) => {
                events.push({ entity, componentType });
            });

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);
            entity.addComponent(Velocity, 1, 1);

            expect(events.length).toBe(2);
            expect(engine.areArchetypesEnabled()).toBe(true);
        });

        test('should work correctly with archetype system disabled', () => {
            const engine = new EngineBuilder().withArchetypes(false).build();

            const events: any[] = [];
            engine.on('onComponentAdded', (entity, componentType) => {
                events.push({ entity, componentType });
            });

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);
            entity.addComponent(Velocity, 1, 1);

            expect(events.length).toBe(2);
            expect(engine.areArchetypesEnabled()).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        test('should handle marking non-existent component as dirty', () => {
            const engine = new EngineBuilder().build();
            const entity = engine.createEntity();

            // Should not throw when marking non-existent component as dirty
            expect(() => {
                engine.markComponentDirty(entity, Position);
            }).not.toThrow();

            // Should not be in dirty list
            expect(engine.getDirtyComponents(entity)).not.toContain(Position);
        });

        test('should handle clearing dirty flags on entity with no components', () => {
            const engine = new EngineBuilder().build();
            const entity = engine.createEntity();

            expect(() => {
                engine.clearDirtyComponents(entity);
            }).not.toThrow();
        });

        test('should handle multiple systems watching the same component', () => {
            const engine = new EngineBuilder().build();
            const events1: any[] = [];
            const events2: any[] = [];

            engine.createSystem(
                'System1',
                { all: [] },
                {
                    act: () => {},
                    onComponentAdded: (event) => events1.push(event),
                    watchComponents: [Position],
                }
            );

            engine.createSystem(
                'System2',
                { all: [] },
                {
                    act: () => {},
                    onComponentAdded: (event) => events2.push(event),
                    watchComponents: [Position],
                }
            );

            const entity = engine.createEntity();
            entity.addComponent(Position, 10, 20);

            // Both systems should receive the event
            expect(events1.length).toBe(1);
            expect(events2.length).toBe(1);
        });
    });
});
