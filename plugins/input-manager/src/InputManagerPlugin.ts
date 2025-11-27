/**
 * Input Manager Plugin for Orion ECS
 *
 * This plugin provides comprehensive input handling including:
 * - Mouse events (click, move, down, up, drag)
 * - Keyboard events (keydown, keyup, key state)
 * - Event emission and handling
 * - Input state querying
 *
 * Based on the prototypedestination project's input systems.
 */

import type { Vector2 } from '@orion-ecs/math';
import type { EnginePlugin, PluginContext } from '@orion-ecs/plugin-api';

// Import utilities
let Vector2Class: typeof Vector2;

/**
 * Mouse button enum
 */
export enum MouseButton {
    Left = 0,
    Middle = 1,
    Right = 2,
}

/**
 * Mouse event data
 */
export interface MouseEventData {
    position: Vector2;
    button: MouseButton;
    buttons: number;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
}

/**
 * Drag event data
 */
export interface DragEventData {
    startPosition: Vector2;
    currentPosition: Vector2;
    deltaPosition: Vector2;
    button: MouseButton;
}

/**
 * Keyboard event data
 */
export interface KeyboardEventData {
    key: string;
    code: string;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    repeat: boolean;
}

// =============================================================================
// Input API Interface
// =============================================================================

/**
 * Callback type for input event handlers.
 */
export type InputEventCallback<T = MouseEventData | DragEventData | KeyboardEventData> = (
    data: T
) => void;

/**
 * Input Manager API interface for type-safe engine extension.
 */
export interface IInputAPI {
    /** Initializes the input manager with a target element */
    initialize(element: HTMLElement): void;
    /** Clears frame-specific input state (call at end of frame) */
    clearFrameState(): void;
    /** Gets the current mouse position */
    getMousePosition(): Vector2 | null;
    /** Checks if a mouse button is currently pressed */
    isMouseButtonDown(button: MouseButton): boolean;
    /** Checks if currently dragging */
    getIsDragging(): boolean;
    /** Gets the current drag state */
    getDragState(): DragEventData | null;
    /** Checks if a key is currently held down */
    isKeyDown(code: string): boolean;
    /** Checks if a key was pressed this frame */
    wasKeyPressed(code: string): boolean;
    /** Checks if a key was released this frame */
    wasKeyReleased(code: string): boolean;
    /** Gets all currently pressed keys */
    getPressedKeys(): string[];
    /** Subscribes to an input event */
    on<T = MouseEventData | DragEventData | KeyboardEventData>(
        event: string,
        callback: InputEventCallback<T>
    ): () => void;
    /** Cleans up event listeners */
    cleanup(): void;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Prevents the context menu from appearing on right-click.
 * Defined at module level to satisfy consistent-function-scoping rule.
 */
function handleContextMenu(e: Event): boolean {
    e.preventDefault();
    return false;
}

// =============================================================================
// Input API Implementation
// =============================================================================

/**
 * Input Manager API implementation class.
 */
export class InputAPI implements IInputAPI {
    private element?: HTMLElement;

    // Mouse state
    private mousePosition: Vector2 | null = null;
    private mouseDown: boolean = false;
    private mouseButtons: Set<MouseButton> = new Set();
    private dragStart: Vector2 | null = null;
    private isDragging: boolean = false;
    private dragButton: MouseButton = MouseButton.Left;

    // Keyboard state
    private keysDown: Set<string> = new Set();
    private keysPressed: Set<string> = new Set(); // Keys pressed this frame
    private keysReleased: Set<string> = new Set(); // Keys released this frame

    // Event listeners
    private listeners: Map<string, Set<InputEventCallback<unknown>>> = new Map();

    // Bound event handlers for cleanup
    private boundHandlers: Map<string, EventListener> = new Map();

    /**
     * Initializes the input manager with a target element
     */
    public initialize(element: HTMLElement): void {
        if (this.element) {
            this.cleanup();
        }

        this.element = element;

        // Ensure Vector2 is available
        if (!Vector2Class) {
            try {
                const math = require('@orion-ecs/math');
                Vector2Class = math.Vector2;
            } catch {
                console.error('[InputAPI] Could not load Vector2 utility');
                return;
            }
        }

        this.mousePosition = new Vector2Class(0, 0);
        this.setupEventListeners();
    }

    /**
     * Sets up event listeners on the target element
     */
    private setupEventListeners(): void {
        if (!this.element) return;

        // Mouse events
        const onMouseMove = (e: MouseEvent) => this.handleMouseMove(e);
        const onMouseDown = (e: MouseEvent) => this.handleMouseDown(e);
        const onMouseUp = (e: MouseEvent) => this.handleMouseUp(e);
        const onClick = (e: MouseEvent) => this.handleClick(e);

        // Keyboard events
        const onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
        const onKeyUp = (e: KeyboardEvent) => this.handleKeyUp(e);

        this.element.addEventListener('mousemove', onMouseMove);
        this.element.addEventListener('mousedown', onMouseDown);
        this.element.addEventListener('mouseup', onMouseUp);
        this.element.addEventListener('click', onClick);
        this.element.addEventListener('contextmenu', handleContextMenu);

        // Keyboard events on window
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        // Store bound handlers for cleanup
        this.boundHandlers.set('mousemove', onMouseMove as EventListener);
        this.boundHandlers.set('mousedown', onMouseDown as EventListener);
        this.boundHandlers.set('mouseup', onMouseUp as EventListener);
        this.boundHandlers.set('click', onClick as EventListener);
        this.boundHandlers.set('contextmenu', handleContextMenu as EventListener);
        this.boundHandlers.set('keydown', onKeyDown as EventListener);
        this.boundHandlers.set('keyup', onKeyUp as EventListener);
    }

    /**
     * Handles mouse move events
     */
    private handleMouseMove(e: MouseEvent): void {
        if (!this.element || !this.mousePosition) return;

        const rect = this.element.getBoundingClientRect();
        this.mousePosition.x = e.clientX - rect.left;
        this.mousePosition.y = e.clientY - rect.top;

        const eventData: MouseEventData = {
            position: this.mousePosition.clone(),
            button: e.button,
            buttons: e.buttons,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
        };

        this.emit('mousemove', eventData);

        // Handle dragging
        if (this.mouseDown && this.dragStart) {
            if (!this.isDragging) {
                // Check if moved enough to start drag (threshold: 3 pixels)
                const distance = this.mousePosition.distanceTo(this.dragStart);
                if (distance > 3) {
                    this.isDragging = true;
                    this.emit('dragstart', {
                        startPosition: this.dragStart.clone(),
                        currentPosition: this.mousePosition.clone(),
                        deltaPosition: this.mousePosition.vectorTo(this.dragStart),
                        button: this.dragButton,
                    });
                }
            } else {
                this.emit('drag', {
                    startPosition: this.dragStart.clone(),
                    currentPosition: this.mousePosition.clone(),
                    deltaPosition: new Vector2Class(
                        this.mousePosition.x - this.dragStart.x,
                        this.mousePosition.y - this.dragStart.y
                    ),
                    button: this.dragButton,
                });
            }
        }
    }

    /**
     * Handles mouse down events
     */
    private handleMouseDown(e: MouseEvent): void {
        if (!this.mousePosition) return;

        this.mouseDown = true;
        this.mouseButtons.add(e.button);
        this.dragStart = this.mousePosition.clone();
        this.dragButton = e.button;

        const eventData: MouseEventData = {
            position: this.mousePosition.clone(),
            button: e.button,
            buttons: e.buttons,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
        };

        this.emit('mousedown', eventData);
    }

    /**
     * Handles mouse up events
     */
    private handleMouseUp(e: MouseEvent): void {
        if (!this.mousePosition) return;

        if (this.isDragging && this.dragStart) {
            this.emit('dragend', {
                startPosition: this.dragStart.clone(),
                currentPosition: this.mousePosition.clone(),
                deltaPosition: new Vector2Class(
                    this.mousePosition.x - this.dragStart.x,
                    this.mousePosition.y - this.dragStart.y
                ),
                button: this.dragButton,
            });
        }

        this.mouseDown = false;
        this.mouseButtons.delete(e.button);
        this.dragStart = null;
        this.isDragging = false;

        const eventData: MouseEventData = {
            position: this.mousePosition.clone(),
            button: e.button,
            buttons: e.buttons,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
        };

        this.emit('mouseup', eventData);
    }

    /**
     * Handles click events
     */
    private handleClick(e: MouseEvent): void {
        if (!this.mousePosition) return;

        const eventData: MouseEventData = {
            position: this.mousePosition.clone(),
            button: e.button,
            buttons: e.buttons,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
        };

        this.emit('click', eventData);
    }

    /**
     * Handles key down events
     */
    private handleKeyDown(e: KeyboardEvent): void {
        const wasDown = this.keysDown.has(e.code);

        this.keysDown.add(e.code);

        if (!wasDown) {
            this.keysPressed.add(e.code);
        }

        const eventData: KeyboardEventData = {
            key: e.key,
            code: e.code,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
            repeat: e.repeat,
        };

        this.emit('keydown', eventData);
    }

    /**
     * Handles key up events
     */
    private handleKeyUp(e: KeyboardEvent): void {
        this.keysDown.delete(e.code);
        this.keysReleased.add(e.code);

        const eventData: KeyboardEventData = {
            key: e.key,
            code: e.code,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
            repeat: false,
        };

        this.emit('keyup', eventData);
    }

    /**
     * Clears frame-specific input state (call at end of frame)
     */
    public clearFrameState(): void {
        this.keysPressed.clear();
        this.keysReleased.clear();
    }

    // --- Public query methods ---

    /**
     * Gets the current mouse position
     */
    public getMousePosition(): Vector2 | null {
        return this.mousePosition ? this.mousePosition.clone() : null;
    }

    /**
     * Checks if a mouse button is currently pressed
     */
    public isMouseButtonDown(button: MouseButton): boolean {
        return this.mouseButtons.has(button);
    }

    /**
     * Checks if currently dragging
     */
    public getIsDragging(): boolean {
        return this.isDragging;
    }

    /**
     * Gets the current drag state
     */
    public getDragState(): DragEventData | null {
        if (!this.isDragging || !this.dragStart || !this.mousePosition) {
            return null;
        }

        return {
            startPosition: this.dragStart.clone(),
            currentPosition: this.mousePosition.clone(),
            deltaPosition: new Vector2Class(
                this.mousePosition.x - this.dragStart.x,
                this.mousePosition.y - this.dragStart.y
            ),
            button: this.dragButton,
        };
    }

    /**
     * Checks if a key is currently held down
     */
    public isKeyDown(code: string): boolean {
        return this.keysDown.has(code);
    }

    /**
     * Checks if a key was pressed this frame
     */
    public wasKeyPressed(code: string): boolean {
        return this.keysPressed.has(code);
    }

    /**
     * Checks if a key was released this frame
     */
    public wasKeyReleased(code: string): boolean {
        return this.keysReleased.has(code);
    }

    /**
     * Gets all currently pressed keys
     */
    public getPressedKeys(): string[] {
        return Array.from(this.keysDown);
    }

    // --- Event system ---

    /**
     * Subscribes to an input event
     */
    public on<T = MouseEventData | DragEventData | KeyboardEventData>(
        event: string,
        callback: InputEventCallback<T>
    ): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback as InputEventCallback<unknown>);

        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(callback as InputEventCallback<unknown>);
        };
    }

    /**
     * Emits an input event
     */
    private emit(event: string, data: MouseEventData | DragEventData | KeyboardEventData): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            for (const callback of callbacks) {
                callback(data);
            }
        }
    }

    /**
     * Cleans up event listeners
     */
    public cleanup(): void {
        if (!this.element) return;

        // Remove element listeners
        for (const [event, handler] of this.boundHandlers) {
            if (event === 'keydown' || event === 'keyup') {
                window.removeEventListener(event, handler);
            } else {
                this.element.removeEventListener(event, handler);
            }
        }

        this.boundHandlers.clear();
        this.listeners.clear();
        this.element = undefined;
    }
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Input Manager Plugin with type-safe engine extension.
 */
export class InputManagerPlugin implements EnginePlugin<{ input: IInputAPI }> {
    name = 'InputManagerPlugin';
    version = '1.0.0';

    /** Type brand for compile-time type inference */
    declare readonly __extensions: { input: IInputAPI };

    private api = new InputAPI();

    install(context: PluginContext): void {
        // Dynamically import utilities
        try {
            const math = require('@orion-ecs/math');
            Vector2Class = math.Vector2;
        } catch {
            console.warn('[InputManagerPlugin] Could not load math package');
        }

        // Create a system to clear frame state at end of frame
        context.createSystem(
            'InputFrameCleanupSystem',
            {},
            {
                priority: -1000, // Run last
                after: () => {
                    this.api.clearFrameState();
                },
            },
            false
        );

        // Extend engine with input API
        context.extend('input', this.api);

        console.log('[InputManagerPlugin] Installed successfully');
    }

    uninstall(): void {
        this.api.cleanup();
        console.log('[InputManagerPlugin] Uninstalled successfully');
    }
}

/**
 * Usage example:
 *
 * import { EngineBuilder } from '../../../packages/core/src/index';
 * import { InputManagerPlugin } from './InputManagerPlugin';
 *
 * const engine = new EngineBuilder()
 *   .withDebugMode(true)
 *   .use(new InputManagerPlugin())
 *   .build();
 *
 * // Initialize with canvas element
 * const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
 * engine.input.initialize(canvas);
 *
 * // Subscribe to events
 * engine.input.on('click', (e) => {
 *   console.log('Clicked at', e.position);
 * });
 *
 * engine.input.on('drag', (e) => {
 *   console.log('Dragging', e.deltaPosition);
 * });
 *
 * engine.input.on('keydown', (e) => {
 *   console.log('Key pressed:', e.key);
 * });
 *
 * // Query input state in systems
 * engine.createSystem('PlayerControlSystem', {}, {
 *   act: () => {
 *     if (engine.input.isKeyDown('ArrowLeft')) {
 *       // Move left
 *     }
 *     if (engine.input.wasKeyPressed('Space')) {
 *       // Jump
 *     }
 *   }
 * }, false);
 *
 * engine.start();
 */
