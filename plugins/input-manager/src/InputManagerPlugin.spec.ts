/**
 * InputManagerPlugin Test Suite
 *
 * Comprehensive tests covering:
 * - Mouse event handling (click, move, down, up)
 * - Drag detection and tracking
 * - Keyboard event handling
 * - Input state queries
 * - Event subscriptions and cleanup
 */

import { EngineBuilder, Engine } from '../../../core/src/index';
import {
    InputManagerPlugin,
    InputAPI,
    MouseButton,
    MouseEventData,
    DragEventData,
    KeyboardEventData
} from './InputManagerPlugin';

// Mock Vector2 utility
jest.mock('../../../utils/src/index', () => ({
    Vector2: class Vector2 {
        constructor(public x: number = 0, public y: number = 0) {}

        clone() {
            return new Vector2(this.x, this.y);
        }

        distanceTo(other: any) {
            const dx = this.x - other.x;
            const dy = this.y - other.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        vectorTo(other: any) {
            return new Vector2(other.x - this.x, other.y - this.y);
        }
    }
}));

// Mock HTML element
class MockHTMLElement {
    private listeners: Map<string, Set<EventListener>> = new Map();

    addEventListener(event: string, listener: EventListener): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener);
    }

    removeEventListener(event: string, listener: EventListener): void {
        this.listeners.get(event)?.delete(listener);
    }

    getBoundingClientRect() {
        return {
            left: 0,
            top: 0,
            width: 800,
            height: 600
        };
    }

    dispatchEvent(event: Event): void {
        const listeners = this.listeners.get(event.type);
        if (listeners) {
            listeners.forEach(listener => listener(event));
        }
    }
}

// Mock window
const originalWindow = global.window;

describe('InputManagerPlugin', () => {
    let engine: Engine;
    let plugin: InputManagerPlugin;
    let mockElement: MockHTMLElement;
    let mockWindowListeners: Map<string, Set<EventListener>>;

    beforeEach(() => {
        mockWindowListeners = new Map();

        // Mock window event listeners
        (global as any).window = {
            addEventListener: (event: string, listener: EventListener) => {
                if (!mockWindowListeners.has(event)) {
                    mockWindowListeners.set(event, new Set());
                }
                mockWindowListeners.get(event)!.add(listener);
            },
            removeEventListener: (event: string, listener: EventListener) => {
                mockWindowListeners.get(event)?.delete(listener);
            }
        };

        plugin = new InputManagerPlugin();
        engine = new EngineBuilder()
            .withDebugMode(true)
            .use(plugin)
            .build();

        mockElement = new MockHTMLElement();
    });

    afterEach(() => {
        engine.stop();
        global.window = originalWindow;
    });

    describe('Plugin Metadata', () => {
        test('should have correct name and version', () => {
            expect(plugin.name).toBe('InputManagerPlugin');
            expect(plugin.version).toBe('1.0.0');
        });
    });

    describe('Plugin Installation', () => {
        test('should install successfully', () => {
            expect(engine).toBeDefined();
        });

        test('should extend engine with input API', () => {
            expect((engine as any).input).toBeDefined();
            expect((engine as any).input).toBeInstanceOf(InputAPI);
        });

        test('should create input cleanup system', () => {
            const systems = engine.getSystemProfiles();
            const systemNames = systems.map(s => s.name);

            expect(systemNames).toContain('InputFrameCleanupSystem');
        });
    });

    describe('InputAPI - Initialization', () => {
        let api: InputAPI;

        beforeEach(() => {
            api = (engine as any).input;
        });

        test('should initialize with element', () => {
            expect(() => {
                api.initialize(mockElement as any);
            }).not.toThrow();
        });

        test('should cleanup previous initialization', () => {
            const element1 = new MockHTMLElement();
            const element2 = new MockHTMLElement();

            api.initialize(element1 as any);
            api.initialize(element2 as any);

            // Should not throw
            expect(true).toBe(true);
        });

        test('should return null for mouse position before initialization', () => {
            const uninitializedApi = new InputAPI();
            expect(uninitializedApi.getMousePosition()).toBeNull();
        });
    });

    describe('Mouse Events - Movement', () => {
        let api: InputAPI;

        beforeEach(() => {
            api = (engine as any).input;
            api.initialize(mockElement as any);
        });

        test('should track mouse position', () => {
            const mockCallback = jest.fn();
            api.on('mousemove', mockCallback);

            const event = new MouseEvent('mousemove', {
                clientX: 150,
                clientY: 200
            });
            mockElement.dispatchEvent(event);

            expect(mockCallback).toHaveBeenCalled();
            const position = api.getMousePosition();
            expect(position).not.toBeNull();
            expect(position!.x).toBe(150);
            expect(position!.y).toBe(200);
        });

        test('should emit mousemove events', () => {
            const mockCallback = jest.fn();
            api.on('mousemove', mockCallback);

            const event = new MouseEvent('mousemove', {
                clientX: 100,
                clientY: 100,
                button: MouseButton.Left
            });
            mockElement.dispatchEvent(event);

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    position: expect.any(Object),
                    button: MouseButton.Left
                })
            );
        });
    });

    describe('Mouse Events - Clicks', () => {
        let api: InputAPI;

        beforeEach(() => {
            api = (engine as any).input;
            api.initialize(mockElement as any);
        });

        test('should emit click events', () => {
            const mockCallback = jest.fn();
            api.on('click', mockCallback);

            const event = new MouseEvent('click', {
                clientX: 100,
                clientY: 100,
                button: MouseButton.Left
            });
            mockElement.dispatchEvent(event);

            expect(mockCallback).toHaveBeenCalled();
        });

        test('should handle right click', () => {
            const mockCallback = jest.fn();
            api.on('click', mockCallback);

            const event = new MouseEvent('click', {
                clientX: 100,
                clientY: 100,
                button: MouseButton.Right
            });
            mockElement.dispatchEvent(event);

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    button: MouseButton.Right
                })
            );
        });

        test('should prevent context menu', () => {
            const event = new Event('contextmenu');
            const preventDefaultSpy = jest.spyOn(event, 'preventDefault');

            mockElement.dispatchEvent(event);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });
    });

    describe('Mouse Events - Button State', () => {
        let api: InputAPI;

        beforeEach(() => {
            api = (engine as any).input;
            api.initialize(mockElement as any);
        });

        test('should track mousedown state', () => {
            const event = new MouseEvent('mousedown', {
                clientX: 100,
                clientY: 100,
                button: MouseButton.Left
            });
            mockElement.dispatchEvent(event);

            expect(api.isMouseButtonDown(MouseButton.Left)).toBe(true);
        });

        test('should emit mousedown events', () => {
            const mockCallback = jest.fn();
            api.on('mousedown', mockCallback);

            const event = new MouseEvent('mousedown', {
                clientX: 100,
                clientY: 100,
                button: MouseButton.Left
            });
            mockElement.dispatchEvent(event);

            expect(mockCallback).toHaveBeenCalled();
        });

        test('should track mouseup state', () => {
            // Press button
            const downEvent = new MouseEvent('mousedown', {
                clientX: 100,
                clientY: 100,
                button: MouseButton.Left
            });
            mockElement.dispatchEvent(downEvent);

            // Release button
            const upEvent = new MouseEvent('mouseup', {
                clientX: 100,
                clientY: 100,
                button: MouseButton.Left
            });
            mockElement.dispatchEvent(upEvent);

            expect(api.isMouseButtonDown(MouseButton.Left)).toBe(false);
        });

        test('should emit mouseup events', () => {
            const mockCallback = jest.fn();
            api.on('mouseup', mockCallback);

            const event = new MouseEvent('mouseup', {
                clientX: 100,
                clientY: 100,
                button: MouseButton.Left
            });
            mockElement.dispatchEvent(event);

            expect(mockCallback).toHaveBeenCalled();
        });
    });

    describe('Drag Detection', () => {
        let api: InputAPI;

        beforeEach(() => {
            api = (engine as any).input;
            api.initialize(mockElement as any);
        });

        test('should detect drag start after threshold', () => {
            const mockCallback = jest.fn();
            api.on('dragstart', mockCallback);

            // Mouse down
            mockElement.dispatchEvent(new MouseEvent('mousedown', {
                clientX: 100,
                clientY: 100,
                button: MouseButton.Left
            }));

            // Move slightly (below threshold)
            mockElement.dispatchEvent(new MouseEvent('mousemove', {
                clientX: 101,
                clientY: 101
            }));

            expect(mockCallback).not.toHaveBeenCalled();

            // Move beyond threshold (3 pixels)
            mockElement.dispatchEvent(new MouseEvent('mousemove', {
                clientX: 105,
                clientY: 105
            }));

            expect(mockCallback).toHaveBeenCalled();
        });

        test('should emit drag events during dragging', () => {
            const mockCallback = jest.fn();
            api.on('drag', mockCallback);

            // Start drag
            mockElement.dispatchEvent(new MouseEvent('mousedown', {
                clientX: 100,
                clientY: 100
            }));

            mockElement.dispatchEvent(new MouseEvent('mousemove', {
                clientX: 110,
                clientY: 110
            }));

            expect(mockCallback).toHaveBeenCalled();
        });

        test('should emit dragend on mouse up', () => {
            const mockCallback = jest.fn();
            api.on('dragend', mockCallback);

            // Start drag
            mockElement.dispatchEvent(new MouseEvent('mousedown', {
                clientX: 100,
                clientY: 100
            }));

            mockElement.dispatchEvent(new MouseEvent('mousemove', {
                clientX: 110,
                clientY: 110
            }));

            // End drag
            mockElement.dispatchEvent(new MouseEvent('mouseup', {
                clientX: 110,
                clientY: 110
            }));

            expect(mockCallback).toHaveBeenCalled();
        });

        test('should track dragging state', () => {
            mockElement.dispatchEvent(new MouseEvent('mousedown', {
                clientX: 100,
                clientY: 100
            }));

            mockElement.dispatchEvent(new MouseEvent('mousemove', {
                clientX: 110,
                clientY: 110
            }));

            expect(api.getIsDragging()).toBe(true);

            mockElement.dispatchEvent(new MouseEvent('mouseup', {
                clientX: 110,
                clientY: 110
            }));

            expect(api.getIsDragging()).toBe(false);
        });

        test('should provide drag state information', () => {
            mockElement.dispatchEvent(new MouseEvent('mousedown', {
                clientX: 100,
                clientY: 100
            }));

            mockElement.dispatchEvent(new MouseEvent('mousemove', {
                clientX: 110,
                clientY: 110
            }));

            const dragState = api.getDragState();

            expect(dragState).not.toBeNull();
            expect(dragState!.startPosition).toBeDefined();
            expect(dragState!.currentPosition).toBeDefined();
            expect(dragState!.deltaPosition).toBeDefined();
        });

        test('should return null drag state when not dragging', () => {
            const dragState = api.getDragState();
            expect(dragState).toBeNull();
        });
    });

    describe('Keyboard Events', () => {
        let api: InputAPI;

        beforeEach(() => {
            api = (engine as any).input;
            api.initialize(mockElement as any);
        });

        test('should track keydown state', () => {
            const listeners = mockWindowListeners.get('keydown');
            expect(listeners).toBeDefined();

            if (listeners) {
                const listener = Array.from(listeners)[0];
                listener(new KeyboardEvent('keydown', { code: 'KeyA' }));
            }

            expect(api.isKeyDown('KeyA')).toBe(true);
        });

        test('should emit keydown events', () => {
            const mockCallback = jest.fn();
            api.on('keydown', mockCallback);

            const listeners = mockWindowListeners.get('keydown');
            if (listeners) {
                const listener = Array.from(listeners)[0];
                listener(new KeyboardEvent('keydown', {
                    code: 'KeyA',
                    key: 'a'
                }));
            }

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'KeyA',
                    key: 'a'
                })
            );
        });

        test('should track keyup state', () => {
            const listeners = mockWindowListeners.get('keydown');
            if (listeners) {
                const listener = Array.from(listeners)[0];
                listener(new KeyboardEvent('keydown', { code: 'KeyA' }));
            }

            const upListeners = mockWindowListeners.get('keyup');
            if (upListeners) {
                const listener = Array.from(upListeners)[0];
                listener(new KeyboardEvent('keyup', { code: 'KeyA' }));
            }

            expect(api.isKeyDown('KeyA')).toBe(false);
        });

        test('should emit keyup events', () => {
            const mockCallback = jest.fn();
            api.on('keyup', mockCallback);

            const listeners = mockWindowListeners.get('keyup');
            if (listeners) {
                const listener = Array.from(listeners)[0];
                listener(new KeyboardEvent('keyup', {
                    code: 'KeyA',
                    key: 'a'
                }));
            }

            expect(mockCallback).toHaveBeenCalled();
        });

        test('should track pressed keys this frame', () => {
            const listeners = mockWindowListeners.get('keydown');
            if (listeners) {
                const listener = Array.from(listeners)[0];
                listener(new KeyboardEvent('keydown', { code: 'KeyA' }));
            }

            expect(api.wasKeyPressed('KeyA')).toBe(true);
        });

        test('should track released keys this frame', () => {
            // Press key
            const downListeners = mockWindowListeners.get('keydown');
            if (downListeners) {
                const listener = Array.from(downListeners)[0];
                listener(new KeyboardEvent('keydown', { code: 'KeyA' }));
            }

            // Release key
            const upListeners = mockWindowListeners.get('keyup');
            if (upListeners) {
                const listener = Array.from(upListeners)[0];
                listener(new KeyboardEvent('keyup', { code: 'KeyA' }));
            }

            expect(api.wasKeyReleased('KeyA')).toBe(true);
        });

        test('should get all pressed keys', () => {
            const listeners = mockWindowListeners.get('keydown');
            if (listeners) {
                const listener = Array.from(listeners)[0];
                listener(new KeyboardEvent('keydown', { code: 'KeyA' }));
                listener(new KeyboardEvent('keydown', { code: 'KeyB' }));
            }

            const pressedKeys = api.getPressedKeys();
            expect(pressedKeys).toContain('KeyA');
            expect(pressedKeys).toContain('KeyB');
        });

        test('should not duplicate key presses', () => {
            const listeners = mockWindowListeners.get('keydown');
            if (listeners) {
                const listener = Array.from(listeners)[0];
                listener(new KeyboardEvent('keydown', { code: 'KeyA' }));
                listener(new KeyboardEvent('keydown', { code: 'KeyA' }));
            }

            const pressedKeys = api.getPressedKeys();
            expect(pressedKeys.filter(k => k === 'KeyA')).toHaveLength(1);
        });
    });

    describe('Frame State Management', () => {
        let api: InputAPI;

        beforeEach(() => {
            api = (engine as any).input;
            api.initialize(mockElement as any);
        });

        test('should clear pressed keys after frame', () => {
            const listeners = mockWindowListeners.get('keydown');
            if (listeners) {
                const listener = Array.from(listeners)[0];
                listener(new KeyboardEvent('keydown', { code: 'KeyA' }));
            }

            expect(api.wasKeyPressed('KeyA')).toBe(true);

            api.clearFrameState();

            expect(api.wasKeyPressed('KeyA')).toBe(false);
            expect(api.isKeyDown('KeyA')).toBe(true); // Still held down
        });

        test('should clear released keys after frame', () => {
            // Press and release
            const downListeners = mockWindowListeners.get('keydown');
            if (downListeners) {
                const listener = Array.from(downListeners)[0];
                listener(new KeyboardEvent('keydown', { code: 'KeyA' }));
            }

            const upListeners = mockWindowListeners.get('keyup');
            if (upListeners) {
                const listener = Array.from(upListeners)[0];
                listener(new KeyboardEvent('keyup', { code: 'KeyA' }));
            }

            expect(api.wasKeyReleased('KeyA')).toBe(true);

            api.clearFrameState();

            expect(api.wasKeyReleased('KeyA')).toBe(false);
        });

        test('should automatically clear frame state via system', () => {
            const listeners = mockWindowListeners.get('keydown');
            if (listeners) {
                const listener = Array.from(listeners)[0];
                listener(new KeyboardEvent('keydown', { code: 'KeyA' }));
            }

            expect(api.wasKeyPressed('KeyA')).toBe(true);

            engine.start();
            engine.update(0);

            expect(api.wasKeyPressed('KeyA')).toBe(false);
        });
    });

    describe('Event Subscriptions', () => {
        let api: InputAPI;

        beforeEach(() => {
            api = (engine as any).input;
            api.initialize(mockElement as any);
        });

        test('should subscribe to events', () => {
            const mockCallback = jest.fn();
            const unsubscribe = api.on('click', mockCallback);

            expect(typeof unsubscribe).toBe('function');
        });

        test('should call multiple subscribers', () => {
            const mockCallback1 = jest.fn();
            const mockCallback2 = jest.fn();

            api.on('click', mockCallback1);
            api.on('click', mockCallback2);

            mockElement.dispatchEvent(new MouseEvent('click', {
                clientX: 100,
                clientY: 100
            }));

            expect(mockCallback1).toHaveBeenCalled();
            expect(mockCallback2).toHaveBeenCalled();
        });

        test('should unsubscribe from events', () => {
            const mockCallback = jest.fn();
            const unsubscribe = api.on('click', mockCallback);

            unsubscribe();

            mockElement.dispatchEvent(new MouseEvent('click', {
                clientX: 100,
                clientY: 100
            }));

            expect(mockCallback).not.toHaveBeenCalled();
        });
    });

    describe('Cleanup', () => {
        let api: InputAPI;

        beforeEach(() => {
            api = (engine as any).input;
        });

        test('should cleanup event listeners', () => {
            api.initialize(mockElement as any);

            expect(() => {
                api.cleanup();
            }).not.toThrow();
        });

        test('should clear all subscriptions on cleanup', () => {
            api.initialize(mockElement as any);

            const mockCallback = jest.fn();
            api.on('click', mockCallback);

            api.cleanup();

            mockElement.dispatchEvent(new MouseEvent('click', {
                clientX: 100,
                clientY: 100
            }));

            expect(mockCallback).not.toHaveBeenCalled();
        });
    });

    describe('Plugin Uninstallation', () => {
        test('should uninstall and cleanup', () => {
            const api = (engine as any).input;
            api.initialize(mockElement as any);

            expect(() => {
                plugin.uninstall();
            }).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        let api: InputAPI;

        beforeEach(() => {
            api = (engine as any).input;
            api.initialize(mockElement as any);
        });

        test('should handle mouse events before position set', () => {
            const freshApi = new InputAPI();

            expect(() => {
                freshApi.isMouseButtonDown(MouseButton.Left);
            }).not.toThrow();
        });

        test('should handle modifier keys', () => {
            const mockCallback = jest.fn();
            api.on('click', mockCallback);

            mockElement.dispatchEvent(new MouseEvent('click', {
                clientX: 100,
                clientY: 100,
                ctrlKey: true,
                shiftKey: true,
                altKey: true
            }));

            expect(mockCallback).toHaveBeenCalledWith(
                expect.objectContaining({
                    ctrlKey: true,
                    shiftKey: true,
                    altKey: true
                })
            );
        });

        test('should handle multiple simultaneous mouse buttons', () => {
            mockElement.dispatchEvent(new MouseEvent('mousedown', {
                clientX: 100,
                clientY: 100,
                button: MouseButton.Left
            }));

            mockElement.dispatchEvent(new MouseEvent('mousedown', {
                clientX: 100,
                clientY: 100,
                button: MouseButton.Right
            }));

            expect(api.isMouseButtonDown(MouseButton.Left)).toBe(true);
            expect(api.isMouseButtonDown(MouseButton.Right)).toBe(true);
        });
    });
});
