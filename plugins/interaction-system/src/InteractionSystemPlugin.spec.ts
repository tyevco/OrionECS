/**
 * InteractionSystemPlugin Test Suite
 *
 * Comprehensive tests covering:
 * - Component initialization and validation
 * - Click detection and handling
 * - Drag and drop functionality
 * - Selection management
 * - Hover detection
 * - Layer-based interaction priority
 * - Integration with InputManager
 */

import { TestEngineBuilder } from '@orion-ecs/testing';
import type { Engine } from 'orion-ecs';
import {
    Clickable,
    Draggable,
    Hoverable,
    InteractionAPI,
    InteractionBounds,
    InteractionSystemPlugin,
    Selectable,
} from './InteractionSystemPlugin';

// Mock Vector2 and Bounds utilities
const mockBounds = {
    contains: jest.fn((point: unknown) => true),
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

        contains(point: unknown): boolean {
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
    on: jest.fn((event: string, callback: Function) => {
        mockInputAPI._callbacks.set(event, callback);
        return () => mockInputAPI._callbacks.delete(event);
    }),
    _callbacks: new Map<string, Function>(),
    _trigger: (event: string, data: unknown) => {
        const callback = mockInputAPI._callbacks.get(event);
        if (callback) {
            callback(data);
        }
    },
};

describe('InteractionSystemPlugin', () => {
    let engine: Engine;
    let plugin: InteractionSystemPlugin;

    beforeEach(() => {
        plugin = new InteractionSystemPlugin();

        // Create engine without the plugin first
        engine = new TestEngineBuilder().build();

        // Manually add mock input API
        (engine as Record<string, unknown>).input = mockInputAPI;

        // Now install the plugin manually
        const context = {
            registerComponent: (component: unknown) => engine.registerComponent(component),
            registerComponentValidator: (component: unknown, validator: unknown) =>
                engine.registerComponentValidator(component, validator),
            createSystem: (name: string, query: unknown, options: unknown, fixed: boolean) =>
                engine.createSystem(name, query, options, fixed),
            createQuery: (options: unknown) => engine.createQuery(options),
            extend: (name: string, api: unknown) => {
                (engine as Record<string, unknown>)[name] = api;
            },
            getEngine: () => engine,
            messageBus: engine.messageBus,
            engine: engine,
        };

        plugin.install(context as unknown as PluginContext);
    });

    afterEach(() => {
        engine.stop();
        mockInputAPI._callbacks.clear();
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
            expect(clickable.onClick).toBeUndefined();
        });

        test('should create Clickable with custom values', () => {
            const clickable = new Clickable(false, 5);
            expect(clickable.enabled).toBe(false);
            expect(clickable.layer).toBe(5);
        });

        test('should allow setting onClick callback', () => {
            const clickable = new Clickable();
            const mockCallback = jest.fn();

            clickable.onClick = mockCallback;
            expect(clickable.onClick).toBe(mockCallback);
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

        test('should allow setting drag callbacks', () => {
            const draggable = new Draggable();
            const mockStart = jest.fn();
            const mockDrag = jest.fn();
            const mockEnd = jest.fn();

            draggable.onDragStart = mockStart;
            draggable.onDrag = mockDrag;
            draggable.onDragEnd = mockEnd;

            expect(draggable.onDragStart).toBe(mockStart);
            expect(draggable.onDrag).toBe(mockDrag);
            expect(draggable.onDragEnd).toBe(mockEnd);
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

        test('should allow setting selection callbacks', () => {
            const selectable = new Selectable();
            const mockSelect = jest.fn();
            const mockDeselect = jest.fn();

            selectable.onSelect = mockSelect;
            selectable.onDeselect = mockDeselect;

            expect(selectable.onSelect).toBe(mockSelect);
            expect(selectable.onDeselect).toBe(mockDeselect);
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

        test('should allow setting hover callbacks', () => {
            const hoverable = new Hoverable();
            const mockEnter = jest.fn();
            const mockExit = jest.fn();

            hoverable.onHoverEnter = mockEnter;
            hoverable.onHoverExit = mockExit;

            expect(hoverable.onHoverEnter).toBe(mockEnter);
            expect(hoverable.onHoverExit).toBe(mockExit);
        });
    });

    describe('Component - InteractionBounds', () => {
        test('should create InteractionBounds', () => {
            const bounds = new InteractionBounds(mockBounds as unknown as Bounds);
            expect(bounds.bounds).toBe(mockBounds);
            expect(bounds.autoUpdate).toBe(false);
        });

        test('should create InteractionBounds with auto-update', () => {
            const bounds = new InteractionBounds(mockBounds as unknown as Bounds, true);
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

            api.selectEntity(entity);

            expect(api.getSelectedEntities()).toContain(entity);
            const selectable = entity.getComponent(Selectable);
            expect(selectable!.selected).toBe(true);
        });

        test('should deselect entity', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Selectable);

            api.selectEntity(entity);
            api.deselectEntity(entity);

            expect(api.getSelectedEntities()).not.toContain(entity);
            const selectable = entity.getComponent(Selectable);
            expect(selectable!.selected).toBe(false);
        });

        test('should call onSelect callback', () => {
            const mockCallback = jest.fn();
            const entity = engine.createEntity('TestEntity');
            const selectable = entity.addComponent(Selectable);
            selectable.onSelect = mockCallback;

            api.selectEntity(entity);

            expect(mockCallback).toHaveBeenCalledWith(entity);
        });

        test('should call onDeselect callback', () => {
            const mockCallback = jest.fn();
            const entity = engine.createEntity('TestEntity');
            const selectable = entity.addComponent(Selectable);
            selectable.onDeselect = mockCallback;

            api.selectEntity(entity);
            api.deselectEntity(entity);

            expect(mockCallback).toHaveBeenCalledWith(entity);
        });

        test('should clear all selections', () => {
            const entity1 = engine.createEntity('Entity1');
            entity1.addComponent(Selectable);

            const entity2 = engine.createEntity('Entity2');
            entity2.addComponent(Selectable);

            api.selectEntity(entity1);
            api.selectEntity(entity2);

            api.clearSelection();

            expect(api.getSelectedEntities()).toHaveLength(0);
        });

        test('should not select same entity twice', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Selectable);

            api.selectEntity(entity);
            api.selectEntity(entity);

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

            api._setHovered(entity, true);

            expect(api.getHoveredEntities()).toContain(entity);
        });

        test('should remove from hovered entities', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Hoverable);

            api._setHovered(entity, true);
            api._setHovered(entity, false);

            expect(api.getHoveredEntities()).not.toContain(entity);
        });
    });

    describe('Click Interaction', () => {
        let api: InteractionAPI;

        beforeEach(() => {
            api = (engine as EngineWithInteraction).interaction;
        });

        test('should trigger onClick callback when clicked', () => {
            const mockCallback = jest.fn();

            const entity = engine.createEntity('Button');
            const clickable = entity.addComponent(Clickable);
            clickable.onClick = mockCallback;

            const Bounds = require('@orion-ecs/math').Bounds;
            entity.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            mockInputAPI._trigger('click', {
                position: { x: 50, y: 50 },
            });

            expect(mockCallback).toHaveBeenCalled();
        });

        test('should not trigger onClick when disabled', () => {
            const mockCallback = jest.fn();

            const entity = engine.createEntity('Button');
            const clickable = entity.addComponent(Clickable, false); // disabled
            clickable.onClick = mockCallback;

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
            const mockCallback1 = jest.fn();
            const mockCallback2 = jest.fn();

            const Bounds = require('@orion-ecs/math').Bounds;

            // Lower layer entity
            const entity1 = engine.createEntity('Button1');
            const clickable1 = entity1.addComponent(Clickable, true, 0);
            clickable1.onClick = mockCallback1;
            entity1.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            // Higher layer entity (same position)
            const entity2 = engine.createEntity('Button2');
            const clickable2 = entity2.addComponent(Clickable, true, 10);
            clickable2.onClick = mockCallback2;
            entity2.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            mockInputAPI._trigger('click', {
                position: { x: 50, y: 50 },
            });

            // Only higher layer should be clicked
            expect(mockCallback2).toHaveBeenCalled();
            expect(mockCallback1).not.toHaveBeenCalled();
        });
    });

    describe('Drag Interaction', () => {
        let api: InteractionAPI;

        beforeEach(() => {
            api = (engine as EngineWithInteraction).interaction;
        });

        test('should trigger onDragStart callback', () => {
            const mockCallback = jest.fn();

            const entity = engine.createEntity('Draggable');
            const draggable = entity.addComponent(Draggable);
            draggable.onDragStart = mockCallback;

            const Bounds = require('@orion-ecs/math').Bounds;
            entity.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            const Vector2 = require('@orion-ecs/math').Vector2;
            mockInputAPI._trigger('dragstart', {
                startPosition: new Vector2(50, 50),
            });

            expect(mockCallback).toHaveBeenCalled();
            expect(draggable.isDragging).toBe(true);
        });

        test('should trigger onDrag callback', () => {
            const mockCallback = jest.fn();

            const entity = engine.createEntity('Draggable');
            const draggable = entity.addComponent(Draggable);
            draggable.onDrag = mockCallback;
            draggable.isDragging = true; // Simulate drag started

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

            expect(mockCallback).toHaveBeenCalled();
        });

        test('should trigger onDragEnd callback', () => {
            const mockCallback = jest.fn();

            const entity = engine.createEntity('Draggable');
            const draggable = entity.addComponent(Draggable);
            draggable.onDragEnd = mockCallback;

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

            expect(mockCallback).toHaveBeenCalled();
            expect(draggable.isDragging).toBe(false);
        });

        test('should not drag when disabled', () => {
            const mockCallback = jest.fn();

            const entity = engine.createEntity('Draggable');
            const draggable = entity.addComponent(Draggable, false); // disabled
            draggable.onDragStart = mockCallback;

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
        let api: InteractionAPI;

        beforeEach(() => {
            api = (engine as EngineWithInteraction).interaction;
        });

        test('should trigger onHoverEnter callback', () => {
            const mockCallback = jest.fn();

            const entity = engine.createEntity('Hoverable');
            const hoverable = entity.addComponent(Hoverable);
            hoverable.onHoverEnter = mockCallback;

            const Bounds = require('@orion-ecs/math').Bounds;
            entity.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            const Vector2 = require('@orion-ecs/math').Vector2;
            mockInputAPI._trigger('mousemove', {
                position: new Vector2(50, 50),
            });

            expect(mockCallback).toHaveBeenCalled();
            expect(hoverable.hovered).toBe(true);
        });

        test('should trigger onHoverExit callback', () => {
            const mockEnter = jest.fn();
            const mockExit = jest.fn();

            const entity = engine.createEntity('Hoverable');
            const hoverable = entity.addComponent(Hoverable);
            hoverable.onHoverEnter = mockEnter;
            hoverable.onHoverExit = mockExit;
            hoverable.hovered = true; // Start as hovered

            const Bounds = require('@orion-ecs/math').Bounds;
            const bounds = new Bounds(0, 0, 100, 100);
            entity.addComponent(InteractionBounds, bounds);

            const Vector2 = require('@orion-ecs/math').Vector2;

            // Move outside bounds
            bounds.contains = jest.fn(() => false);
            mockInputAPI._trigger('mousemove', {
                position: new Vector2(200, 200),
            });

            expect(mockExit).toHaveBeenCalled();
            expect(hoverable.hovered).toBe(false);
        });
    });

    describe('Plugin Uninstallation', () => {
        test('should uninstall and clear selections', () => {
            const api = (engine as EngineWithInteraction).interaction;

            const entity = engine.createEntity('Entity');
            entity.addComponent(Selectable);
            api.selectEntity(entity);

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
            const Bounds = require('@orion-ecs/math').Bounds;
            const Vector2 = require('@orion-ecs/math').Vector2;

            const mockCallback1 = jest.fn();
            const mockCallback2 = jest.fn();
            const mockCallback3 = jest.fn();

            const entity1 = engine.createEntity('Button1');
            const clickable1 = entity1.addComponent(Clickable, true, 0);
            clickable1.onClick = mockCallback1;
            entity1.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            const entity2 = engine.createEntity('Button2');
            const clickable2 = entity2.addComponent(Clickable, true, 5);
            clickable2.onClick = mockCallback2;
            entity2.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            const entity3 = engine.createEntity('Button3');
            const clickable3 = entity3.addComponent(Clickable, true, 3);
            clickable3.onClick = mockCallback3;
            entity3.addComponent(InteractionBounds, new Bounds(0, 0, 100, 100));

            mockInputAPI._trigger('click', {
                position: new Vector2(50, 50),
            });

            // Only highest layer (5) should be clicked
            expect(mockCallback2).toHaveBeenCalled();
            expect(mockCallback1).not.toHaveBeenCalled();
            expect(mockCallback3).not.toHaveBeenCalled();
        });
    });
});
