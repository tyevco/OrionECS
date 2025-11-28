/**
 * InteractionSystemPlugin Test Suite
 *
 * Comprehensive tests covering:
 * - Component initialization and validation
 * - Click detection and handling (event-based)
 * - Drag and drop functionality (event-based)
 * - Selection management (event-based)
 * - Hover detection (event-based)
 * - Layer-based interaction priority
 * - Integration with InputManager
 */

import { TestEngineBuilder } from '@orion-ecs/testing';
import type {
    ComponentIdentifier,
    Engine,
    PluginContext,
    QueryOptions,
} from '../../../packages/core/src/index';
import {
    Clickable,
    type ClickEvent,
    Draggable,
    Hoverable,
    InteractionAPI,
    InteractionBounds,
    InteractionSystemPlugin,
    Selectable,
} from './InteractionSystemPlugin';

// Type extensions for testing
type EngineWithInteraction = Engine & { interaction: InteractionAPI };

// Mock Vector2 and Bounds utilities
const mockBounds = {
    contains: jest.fn((_point: unknown) => true),
};

jest.mock('@orion-ecs/math', () => ({
    Vector2: class Vector2 {
        constructor(
            public x: number = 0,
            public y: number = 0
        ) {}
        clone() {
            return new Vector2(this.x, this.y);
        }
    },
    Bounds: class Bounds {
        constructor(
            public left: number,
            public top: number,
            public width: number,
            public height: number
        ) {}

        contains(point: { x: number; y: number }): boolean {
            return (
                point.x >= this.left &&
                point.x <= this.left + this.width &&
                point.y >= this.top &&
                point.y <= this.top + this.height
            );
        }

        static fromCenter(center: { x: number; y: number }, width: number, height: number) {
            return new Bounds(center.x - width / 2, center.y - height / 2, width, height);
        }
    },
}));

// Mock InputManagerPlugin
const mockInputAPI = {
    on: jest.fn((event: string, callback: (data: unknown) => void) => {
        mockInputAPI._callbacks.set(event, callback);
        return () => mockInputAPI._callbacks.delete(event);
    }),
    _callbacks: new Map<string, (data: unknown) => void>(),
    _trigger: (event: string, data: unknown) => {
        const callback = mockInputAPI._callbacks.get(event);
        if (callback) {
            callback(data);
        }
    },
};

describe('InteractionSystemPlugin', () => {
    let engine: EngineWithInteraction;
    let plugin: InteractionSystemPlugin;
    // Event listeners for testing
    let eventListeners: Map<string, ((data: unknown) => void)[]>;

    beforeEach(() => {
        plugin = new InteractionSystemPlugin();
        eventListeners = new Map();

        // Create engine without the plugin first
        const baseEngine = new TestEngineBuilder().build() as unknown as Engine;

        // Manually add mock input API
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (baseEngine as any).input = mockInputAPI;

        // Add queryEntities method to engine (used by the plugin)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (baseEngine as any).queryEntities = (options: QueryOptions<any>) => {
            const query = baseEngine.createQuery(options);
            return Array.from(query);
        };

        // Now install the plugin manually
        const context = {
            registerComponent: (component: ComponentIdentifier<unknown>) =>
                baseEngine.registerComponent(component),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            registerComponentValidator: (component: ComponentIdentifier<unknown>, validator: any) =>
                baseEngine.registerComponentValidator(component, validator),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            createSystem: (name: string, query: QueryOptions<any>, options: any, fixed: boolean) =>
                baseEngine.createSystem(name, query, options, fixed),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            createQuery: (options: QueryOptions<any>) => baseEngine.createQuery(options),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extend: (name: string, api: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (baseEngine as any)[name] = api;
            },
            on: (event: string, callback: (data: unknown) => void) => {
                if (!eventListeners.has(event)) {
                    eventListeners.set(event, []);
                }
                const listeners = eventListeners.get(event);
                listeners?.push(callback);
                return () => {
                    const currentListeners = eventListeners.get(event);
                    if (currentListeners) {
                        const index = currentListeners.indexOf(callback);
                        if (index > -1) {
                            currentListeners.splice(index, 1);
                        }
                    }
                };
            },
            emit: (event: string, data: unknown) => {
                const listeners = eventListeners.get(event);
                if (listeners) {
                    listeners.forEach((callback) => callback(data));
                }
            },
            getEngine: () => baseEngine,
            messageBus: baseEngine.messageBus,
            engine: baseEngine,
        };

        plugin.install(context as unknown as PluginContext);
        engine = baseEngine as unknown as EngineWithInteraction;
    });

    afterEach(() => {
        engine.stop();
        mockInputAPI._callbacks.clear();
        eventListeners.clear();
    });

    describe('Plugin Metadata', () => {
        test('should have correct name and version', () => {
            expect(plugin.name).toBe('InteractionSystemPlugin');
            expect(plugin.version).toBe('1.0.0');
        });
    });

    describe('Plugin Installation', () => {
        test('should install successfully', () => {
            expect(engine).toBeDefined();
        });

        test('should extend engine with interaction API', () => {
            expect((engine as EngineWithInteraction).interaction).toBeDefined();
            expect((engine as EngineWithInteraction).interaction).toBeInstanceOf(InteractionAPI);
        });

        test('should register all components', () => {
            const entity = engine.createEntity('TestEntity');

            expect(() => entity.addComponent(Clickable)).not.toThrow();
            expect(() => entity.addComponent(Draggable)).not.toThrow();
            expect(() => entity.addComponent(Selectable)).not.toThrow();
            expect(() => entity.addComponent(Hoverable)).not.toThrow();
        });

        test('should subscribe to input events', () => {
            expect(mockInputAPI.on).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockInputAPI.on).toHaveBeenCalledWith('dragstart', expect.any(Function));
            expect(mockInputAPI.on).toHaveBeenCalledWith('drag', expect.any(Function));
            expect(mockInputAPI.on).toHaveBeenCalledWith('dragend', expect.any(Function));
            expect(mockInputAPI.on).toHaveBeenCalledWith('mousemove', expect.any(Function));
        });
    });

    describe('Component - Clickable', () => {
        test('should create Clickable with default values', () => {
            const clickable = new Clickable();
            expect(clickable.enabled).toBe(true);
            expect(clickable.layer).toBe(0);
        });

        test('should create Clickable with custom values', () => {
            const clickable = new Clickable(false, 5);
            expect(clickable.enabled).toBe(false);
            expect(clickable.layer).toBe(5);
        });
    });

    describe('Component - Draggable', () => {
        test('should create Draggable with default values', () => {
            const draggable = new Draggable();
            expect(draggable.enabled).toBe(true);
            expect(draggable.layer).toBe(0);
            expect(draggable.dragButton).toBe(0);
            expect(draggable.isDragging).toBe(false);
        });

        test('should create Draggable with custom values', () => {
            const draggable = new Draggable(false, 3, 2);
            expect(draggable.enabled).toBe(false);
            expect(draggable.layer).toBe(3);
            expect(draggable.dragButton).toBe(2);
        });
    });

    describe('Component - Selectable', () => {
        test('should create Selectable with default values', () => {
            const selectable = new Selectable();
            expect(selectable.enabled).toBe(true);
            expect(selectable.layer).toBe(0);
            expect(selectable.selected).toBe(false);
        });

        test('should create Selectable with custom values', () => {
            const selectable = new Selectable(false, 2);
            expect(selectable.enabled).toBe(false);
            expect(selectable.layer).toBe(2);
        });
    });

    describe('Component - Hoverable', () => {
        test('should create Hoverable with default values', () => {
            const hoverable = new Hoverable();
            expect(hoverable.enabled).toBe(true);
            expect(hoverable.layer).toBe(0);
            expect(hoverable.hovered).toBe(false);
        });

        test('should create Hoverable with custom values', () => {
            const hoverable = new Hoverable(false, 4);
            expect(hoverable.enabled).toBe(false);
            expect(hoverable.layer).toBe(4);
        });
    });

    describe('Component - InteractionBounds', () => {
        test('should create InteractionBounds', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const bounds = new InteractionBounds(mockBounds as any);
            expect(bounds.bounds).toBe(mockBounds);
            expect(bounds.autoUpdate).toBe(false);
        });

        test('should create InteractionBounds with auto-update', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const bounds = new InteractionBounds(mockBounds as any, true);
            expect(bounds.autoUpdate).toBe(true);
        });
    });

    describe('InteractionAPI - Selection Management', () => {
        let api: InteractionAPI;

        beforeEach(() => {
            api = (engine as EngineWithInteraction).interaction;
        });

        test('should start with no selected entities', () => {
            const selected = api.getSelectedEntities();
            expect(selected).toHaveLength(0);
        });

        test('should select entity', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Selectable);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api.selectEntity(entity as any);

            expect(api.getSelectedEntities()).toContain(entity);
            const selectable = entity.getComponent(Selectable);
            expect(selectable?.selected).toBe(true);
        });

        test('should deselect entity', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Selectable);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api.selectEntity(entity as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api.deselectEntity(entity as any);

            expect(api.getSelectedEntities()).not.toContain(entity);
            const selectable = entity.getComponent(Selectable);
            expect(selectable?.selected).toBe(false);
        });

        test('should emit interaction:select event', () => {
            const mockCallback = jest.fn();
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Selectable);

            // Subscribe to event
            eventListeners.set('interaction:select', [mockCallback]);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api.selectEntity(entity as any);

            expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({ entity }));
        });

        test('should emit interaction:deselect event', () => {
            const mockCallback = jest.fn();
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Selectable);

            // Subscribe to event
            eventListeners.set('interaction:deselect', [mockCallback]);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api.selectEntity(entity as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api.deselectEntity(entity as any);

            expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({ entity }));
        });

        test('should clear all selections', () => {
            const entity1 = engine.createEntity('Entity1');
            entity1.addComponent(Selectable);

            const entity2 = engine.createEntity('Entity2');
            entity2.addComponent(Selectable);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api.selectEntity(entity1 as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api.selectEntity(entity2 as any);

            api.clearSelection();

            expect(api.getSelectedEntities()).toHaveLength(0);
        });

        test('should not select same entity twice', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Selectable);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api.selectEntity(entity as any);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api.selectEntity(entity as any);

            expect(api.getSelectedEntities()).toHaveLength(1);
        });
    });

    describe('InteractionAPI - Hover Management', () => {
        let api: InteractionAPI;

        beforeEach(() => {
            api = (engine as EngineWithInteraction).interaction;
        });

        test('should start with no hovered entities', () => {
            const hovered = api.getHoveredEntities();
            expect(hovered).toHaveLength(0);
        });

        test('should track hovered entities', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Hoverable);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api._setHovered(entity as any, true);

            expect(api.getHoveredEntities()).toContain(entity);
        });

        test('should remove from hovered entities', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Hoverable);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api._setHovered(entity as any, true);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api._setHovered(entity as any, false);

            expect(api.getHoveredEntities()).not.toContain(entity);
        });
    });

    describe('Click Interaction', () => {
        let api: InteractionAPI;

        beforeEach(() => {
            api = (engine as EngineWithInteraction).interaction;
        });

        test('should emit interaction:click event when clicked', () => {
            const mockCallback = jest.fn();
            eventListeners.set('interaction:click', [mockCallback]);

            const entity = engine.createEntity('Button');
            entity.addComponent(Clickable);
            entity.addComponent(Selectable, false); // Add Selectable (disabled) to prevent getComponent error

            const Bounds = require('@orion-ecs/math').Bounds;
            entity.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            mockInputAPI._trigger('click', {
                position: { x: 50, y: 50 },
            });

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    entity: expect.anything(),
                    position: expect.objectContaining({ x: 50, y: 50 }),
                })
            );
        });

        test('should not emit click event when disabled', () => {
            const mockCallback = jest.fn();
            eventListeners.set('interaction:click', [mockCallback]);

            const entity = engine.createEntity('Button');
            entity.addComponent(Clickable, false); // disabled

            const Bounds = require('@orion-ecs/math').Bounds;
            entity.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            mockInputAPI._trigger('click', {
                position: { x: 50, y: 50 },
            });

            expect(mockCallback).not.toHaveBeenCalled();
        });

        test('should toggle selection on click', () => {
            const entity = engine.createEntity('Button');
            entity.addComponent(Clickable);
            entity.addComponent(Selectable);

            const Bounds = require('@orion-ecs/math').Bounds;
            entity.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            // First click - select
            mockInputAPI._trigger('click', {
                position: { x: 50, y: 50 },
            });

            expect(api.getSelectedEntities()).toContain(entity);

            // Second click - deselect
            mockInputAPI._trigger('click', {
                position: { x: 50, y: 50 },
            });

            expect(api.getSelectedEntities()).not.toContain(entity);
        });

        test('should prioritize higher layer entities', () => {
            const mockCallback = jest.fn();
            eventListeners.set('interaction:click', [mockCallback]);

            const Bounds = require('@orion-ecs/math').Bounds;

            // Lower layer entity
            const entity1 = engine.createEntity('Button1');
            entity1.addComponent(Clickable, true, 0);
            entity1.addComponent(Selectable, false); // Add Selectable (disabled) to prevent getComponent error
            entity1.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            // Higher layer entity (same position)
            const entity2 = engine.createEntity('Button2');
            entity2.addComponent(Clickable, true, 10);
            entity2.addComponent(Selectable, false); // Add Selectable (disabled) to prevent getComponent error
            entity2.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            mockInputAPI._trigger('click', {
                position: { x: 50, y: 50 },
            });

            // Only higher layer should be clicked
            expect(mockCallback).toHaveBeenCalledTimes(1);
            const clickEvent = mockCallback.mock.calls[0][0] as ClickEvent;
            expect(clickEvent.entity).toBe(entity2);
        });
    });

    describe('Drag Interaction', () => {
        let _api: InteractionAPI;

        beforeEach(() => {
            _api = (engine as EngineWithInteraction).interaction;
        });

        test('should emit interaction:dragStart event', () => {
            const mockCallback = jest.fn();
            eventListeners.set('interaction:dragStart', [mockCallback]);

            const entity = engine.createEntity('Draggable');
            entity.addComponent(Draggable);

            const Bounds = require('@orion-ecs/math').Bounds;
            entity.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            const Vector2 = require('@orion-ecs/math').Vector2;
            mockInputAPI._trigger('dragstart', {
                startPosition: new Vector2(50, 50),
            });

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    entity: expect.anything(),
                    position: expect.objectContaining({ x: 50, y: 50 }),
                })
            );

            const draggable = entity.getComponent(Draggable);
            expect(draggable?.isDragging).toBe(true);
        });

        test('should emit interaction:drag event', () => {
            const mockCallback = jest.fn();
            eventListeners.set('interaction:drag', [mockCallback]);

            const entity = engine.createEntity('Draggable');
            entity.addComponent(Draggable);
            const draggable = entity.getComponent(Draggable);
            if (draggable) draggable.isDragging = true; // Simulate drag started

            const Bounds = require('@orion-ecs/math').Bounds;
            entity.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            const Vector2 = require('@orion-ecs/math').Vector2;

            // Start drag first
            mockInputAPI._trigger('dragstart', {
                startPosition: new Vector2(50, 50),
            });

            // Then drag
            mockInputAPI._trigger('drag', {
                deltaPosition: new Vector2(10, 5),
            });

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    entity: expect.anything(),
                    delta: expect.objectContaining({ x: 10, y: 5 }),
                })
            );
        });

        test('should emit interaction:dragEnd event', () => {
            const mockCallback = jest.fn();
            eventListeners.set('interaction:dragEnd', [mockCallback]);

            const entity = engine.createEntity('Draggable');
            entity.addComponent(Draggable);

            const Bounds = require('@orion-ecs/math').Bounds;
            entity.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            const Vector2 = require('@orion-ecs/math').Vector2;

            // Start drag
            mockInputAPI._trigger('dragstart', {
                startPosition: new Vector2(50, 50),
            });

            // End drag
            mockInputAPI._trigger('dragend', {
                currentPosition: new Vector2(60, 55),
            });

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    entity: expect.anything(),
                    position: expect.objectContaining({ x: 60, y: 55 }),
                })
            );

            const draggable = entity.getComponent(Draggable);
            expect(draggable?.isDragging).toBe(false);
        });

        test('should not drag when disabled', () => {
            const mockCallback = jest.fn();
            eventListeners.set('interaction:dragStart', [mockCallback]);

            const entity = engine.createEntity('Draggable');
            entity.addComponent(Draggable, false); // disabled

            const Bounds = require('@orion-ecs/math').Bounds;
            entity.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            const Vector2 = require('@orion-ecs/math').Vector2;
            mockInputAPI._trigger('dragstart', {
                startPosition: new Vector2(50, 50),
            });

            expect(mockCallback).not.toHaveBeenCalled();
        });
    });

    describe('Hover Interaction', () => {
        let _api: InteractionAPI;

        beforeEach(() => {
            _api = (engine as EngineWithInteraction).interaction;
        });

        test('should emit interaction:hoverEnter event', () => {
            const mockCallback = jest.fn();
            eventListeners.set('interaction:hoverEnter', [mockCallback]);

            const entity = engine.createEntity('Hoverable');
            entity.addComponent(Hoverable);

            const Bounds = require('@orion-ecs/math').Bounds;
            entity.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            const Vector2 = require('@orion-ecs/math').Vector2;
            mockInputAPI._trigger('mousemove', {
                position: new Vector2(50, 50),
            });

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    entity: expect.anything(),
                })
            );

            const hoverable = entity.getComponent(Hoverable);
            expect(hoverable?.hovered).toBe(true);
        });

        test('should emit interaction:hoverExit event', () => {
            const mockEnterCallback = jest.fn();
            const mockExitCallback = jest.fn();
            eventListeners.set('interaction:hoverEnter', [mockEnterCallback]);
            eventListeners.set('interaction:hoverExit', [mockExitCallback]);

            const entity = engine.createEntity('Hoverable');
            entity.addComponent(Hoverable);
            const hoverable = entity.getComponent(Hoverable);
            if (hoverable) hoverable.hovered = true; // Start as hovered

            const Bounds = require('@orion-ecs/math').Bounds;
            const bounds = new Bounds(0, 0, 100, 100);
            entity.addComponent(InteractionBounds, bounds);

            const Vector2 = require('@orion-ecs/math').Vector2;

            // Move outside bounds
            bounds.contains = jest.fn(() => false);
            mockInputAPI._trigger('mousemove', {
                position: new Vector2(200, 200),
            });

            expect(mockExitCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    entity: expect.anything(),
                })
            );
            expect(hoverable?.hovered).toBe(false);
        });
    });

    describe('Plugin Uninstallation', () => {
        test('should uninstall and clear selections', () => {
            const api = (engine as EngineWithInteraction).interaction;

            const entity = engine.createEntity('Entity');
            entity.addComponent(Selectable);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            api.selectEntity(entity as any);

            plugin.uninstall();

            expect(api.getSelectedEntities()).toHaveLength(0);
        });
    });

    describe('Edge Cases', () => {
        test('should handle entity without bounds', () => {
            const entity = engine.createEntity('Button');
            entity.addComponent(Clickable);

            const Vector2 = require('@orion-ecs/math').Vector2;

            expect(() => {
                mockInputAPI._trigger('click', {
                    position: new Vector2(50, 50),
                });
            }).not.toThrow();
        });

        test('should handle multiple entities in same position', () => {
            const mockCallback = jest.fn();
            eventListeners.set('interaction:click', [mockCallback]);

            const Bounds = require('@orion-ecs/math').Bounds;
            const Vector2 = require('@orion-ecs/math').Vector2;

            const entity1 = engine.createEntity('Button1');
            entity1.addComponent(Clickable, true, 0);
            entity1.addComponent(Selectable, false); // Add Selectable (disabled) to prevent getComponent error
            entity1.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            const entity2 = engine.createEntity('Button2');
            entity2.addComponent(Clickable, true, 5);
            entity2.addComponent(Selectable, false); // Add Selectable (disabled) to prevent getComponent error
            entity2.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            const entity3 = engine.createEntity('Button3');
            entity3.addComponent(Clickable, true, 3);
            entity3.addComponent(Selectable, false); // Add Selectable (disabled) to prevent getComponent error
            entity3.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            mockInputAPI._trigger('click', {
                position: new Vector2(50, 50),
            });

            // Only highest layer (5) should be clicked
            expect(mockCallback).toHaveBeenCalledTimes(1);
            const clickEvent = mockCallback.mock.calls[0][0] as ClickEvent;
            expect(clickEvent.entity).toBe(entity2);
        });
    });
});
