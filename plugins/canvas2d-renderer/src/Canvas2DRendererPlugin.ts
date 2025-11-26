/**
 * Canvas2D Renderer Plugin for Orion ECS
 *
 * This plugin provides 2D canvas rendering capabilities including:
 * - Camera system with viewport management
 * - Sprite rendering with world-to-screen coordinate conversion
 * - Multi-camera support
 * - Screen element rendering
 *
 * Based on the prototypedestination project's rendering systems.
 */

import type { EnginePlugin, PluginContext, EntityDef } from '@orion-ecs/plugin-api';
import type { Color, Mesh } from '../../../packages/graphics/src/index';
import type { Bounds } from '../../../packages/math/src/index';

// Re-export utility types for consumers
export type { Bounds, Mesh, Color };

/**
 * Transform component for entity position, rotation, and scale
 */
export class Transform {
    constructor(
        public x: number = 0,
        public y: number = 0,
        public rotation: number = 0,
        public scaleX: number = 1,
        public scaleY: number = 1
    ) {}

    public get position(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }

    public setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
    }
}

/**
 * Unit type for screen element positioning
 */
export enum Unit {
    Percentage = 'percentage',
    Pixels = 'pixels',
}

/**
 * Screen element component for UI positioning
 */
export class ScreenElement {
    constructor(
        public left: number = 0,
        public top: number = 0,
        public width: number = 100,
        public height: number = 100,
        public unit: Unit = Unit.Percentage
    ) {}
}

/**
 * Camera component for rendering viewports
 */
export class Camera {
    constructor(
        public width: number = 800,
        public height: number = 600,
        public backgroundColor?: string
    ) {}
}

/**
 * Sprite component for rendering meshes
 */
export class Sprite {
    constructor(
        public mesh: Mesh,
        public visible: boolean = true,
        public layer: number = 0
    ) {}
}

// =============================================================================
// Canvas2D API Interface
// =============================================================================

/**
 * Canvas2D Rendering API interface for type-safe engine extension.
 */
export interface ICanvas2DAPI {
    /** Sets the canvas element to render to */
    setCanvas(canvas: HTMLCanvasElement): void;
    /** Gets the current canvas element */
    getCanvas(): HTMLCanvasElement | undefined;
    /** Gets the 2D rendering context */
    getContext(): CanvasRenderingContext2D | undefined;
    /** Sets whether to clear the canvas before rendering */
    setClearBeforeRender(clear: boolean): void;
    /** Gets whether the canvas is cleared before rendering */
    getClearBeforeRender(): boolean;
    /** Sets the global alpha (transparency) for rendering */
    setGlobalAlpha(alpha: number): void;
    /** Gets the global alpha */
    getGlobalAlpha(): number;
    /** Converts screen coordinates to world coordinates for a camera */
    screenToWorld(screenX: number, screenY: number, camera: EntityDef): { x: number; y: number } | null;
}

// =============================================================================
// Canvas2D API Implementation
// =============================================================================

/**
 * Canvas2D Rendering API implementation class.
 */
export class Canvas2DAPI implements ICanvas2DAPI {
    private canvas?: HTMLCanvasElement;
    private context?: CanvasRenderingContext2D;
    private clearBeforeRender: boolean = true;
    private globalAlpha: number = 1;

    /**
     * Sets the canvas element to render to
     */
    public setCanvas(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D rendering context');
        }
        this.context = ctx;
    }

    /**
     * Gets the current canvas element
     */
    public getCanvas(): HTMLCanvasElement | undefined {
        return this.canvas;
    }

    /**
     * Gets the 2D rendering context
     */
    public getContext(): CanvasRenderingContext2D | undefined {
        return this.context;
    }

    /**
     * Sets whether to clear the canvas before rendering
     */
    public setClearBeforeRender(clear: boolean): void {
        this.clearBeforeRender = clear;
    }

    /**
     * Gets whether the canvas is cleared before rendering
     */
    public getClearBeforeRender(): boolean {
        return this.clearBeforeRender;
    }

    /**
     * Sets the global alpha (transparency) for rendering
     */
    public setGlobalAlpha(alpha: number): void {
        this.globalAlpha = Math.max(0, Math.min(1, alpha));
        if (this.context) {
            this.context.globalAlpha = this.globalAlpha;
        }
    }

    /**
     * Gets the global alpha
     */
    public getGlobalAlpha(): number {
        return this.globalAlpha;
    }

    /**
     * Converts screen coordinates to world coordinates for a camera
     */
    public screenToWorld(
        screenX: number,
        screenY: number,
        camera: Entity
    ): { x: number; y: number } | null {
        if (!this.canvas) return null;

        const cameraTransform = camera.getComponent(Transform);
        const cameraComp = camera.getComponent(Camera);
        const screenElement = camera.getComponent(ScreenElement);

        if (!cameraTransform || !cameraComp || !screenElement) {
            return null;
        }

        // Calculate camera screen position
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;

        const screenLeft =
            screenElement.unit === Unit.Percentage
                ? (screenElement.left / 100) * canvasWidth
                : screenElement.left;

        const screenTop =
            screenElement.unit === Unit.Percentage
                ? (screenElement.top / 100) * canvasHeight
                : screenElement.top;

        // Convert screen to camera space
        const cameraX = screenX - screenLeft;
        const cameraY = screenY - screenTop;

        // Convert camera space to world space
        const worldX = cameraX + cameraTransform.x - cameraComp.width / 2;
        const worldY = cameraY + cameraTransform.y - cameraComp.height / 2;

        return { x: worldX, y: worldY };
    }
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Canvas2D Renderer Plugin with type-safe engine extension.
 */
export class Canvas2DRendererPlugin implements EnginePlugin<{ canvas2d: ICanvas2DAPI }> {
    name = 'Canvas2DRendererPlugin';
    version = '1.0.0';

    /** Type brand for compile-time type inference */
    declare readonly __extensions: { canvas2d: ICanvas2DAPI };

    private api = new Canvas2DAPI();
    private canvas?: HTMLCanvasElement;
    private context?: CanvasRenderingContext2D;
    private cameraQuery: any;

    install(context: PluginContext): void {
        // Register components
        context.registerComponent(Transform);
        context.registerComponent(ScreenElement);
        context.registerComponent(Camera);
        context.registerComponent(Sprite);

        // Component validators
        context.registerComponentValidator(Camera, {
            validate: (component: Camera) => {
                if (component.width <= 0 || component.height <= 0) {
                    return 'Camera dimensions must be positive';
                }
                return true;
            },
            dependencies: [Transform, ScreenElement],
        });

        context.registerComponentValidator(Sprite, {
            validate: (component: Sprite) => {
                if (!component.mesh) {
                    return 'Sprite must have a mesh';
                }
                return true;
            },
            dependencies: [Transform],
        });

        // Create a query for cameras
        this.cameraQuery = context.createQuery({ all: [Camera, Transform, ScreenElement] });

        // Camera setup and clearing system
        context.createSystem(
            'CameraSetupSystem',
            {
                all: [Camera, Transform, ScreenElement],
            },
            {
                priority: 1000, // Run before rendering
                before: () => {
                    // Get canvas and context
                    if (!this.canvas && this.api.getCanvas()) {
                        this.canvas = this.api.getCanvas();
                        this.context = this.api.getContext();
                    }

                    // Clear the entire canvas if enabled
                    if (this.context && this.canvas && this.api.getClearBeforeRender()) {
                        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
                    }
                },
                act: (_entity: any, ...components: any[]) => {
                    const [camera, transform, screenElement] = components as [
                        Camera,
                        Transform,
                        ScreenElement,
                    ];
                    if (!this.context || !this.canvas) return;

                    // Calculate screen position
                    const canvasWidth = this.canvas.width;
                    const canvasHeight = this.canvas.height;

                    const screenLeft =
                        screenElement.unit === Unit.Percentage
                            ? (screenElement.left / 100) * canvasWidth
                            : screenElement.left;

                    const screenTop =
                        screenElement.unit === Unit.Percentage
                            ? (screenElement.top / 100) * canvasHeight
                            : screenElement.top;

                    const screenWidth =
                        screenElement.unit === Unit.Percentage
                            ? (screenElement.width / 100) * canvasWidth
                            : screenElement.width;

                    const screenHeight =
                        screenElement.unit === Unit.Percentage
                            ? (screenElement.height / 100) * canvasHeight
                            : screenElement.height;

                    // Calculate world bounds for this camera
                    const worldLeft = transform.x - camera.width / 2;
                    const worldTop = transform.y - camera.height / 2;

                    // Store bounds on entity for sprite rendering to use
                    (_entity as any)._renderBounds = {
                        worldLeft,
                        worldTop,
                        worldRight: worldLeft + camera.width,
                        worldBottom: worldTop + camera.height,
                        screenLeft,
                        screenTop,
                        screenWidth,
                        screenHeight,
                    };

                    // Clear camera viewport
                    this.context.clearRect(screenLeft, screenTop, screenWidth, screenHeight);

                    // Draw background if specified
                    if (camera.backgroundColor) {
                        this.context.fillStyle = camera.backgroundColor;
                        this.context.fillRect(screenLeft, screenTop, screenWidth, screenHeight);
                    }

                    // Draw camera border (debug)
                    this.context.strokeStyle = '#00ff00';
                    this.context.lineWidth = 2;
                    this.context.strokeRect(screenLeft, screenTop, screenWidth, screenHeight);
                },
            },
            false // Variable update
        );

        // Sprite rendering system
        context.createSystem(
            'SpriteRendererSystem',
            {
                all: [Sprite, Transform],
            },
            {
                priority: 900, // Run after camera setup
                act: (_entity: any, ...components: any[]) => {
                    const [sprite, transform] = components as [Sprite, Transform];
                    if (!this.context || !sprite.visible) return;

                    // Get all cameras
                    const cameras = this.cameraQuery.entities;

                    // Render sprite in each camera that can see it
                    for (const camera of cameras) {
                        const bounds = (camera as any)._renderBounds;
                        if (!bounds) continue;

                        // Check if sprite is in camera bounds
                        if (
                            transform.x >= bounds.worldLeft &&
                            transform.x <= bounds.worldRight &&
                            transform.y >= bounds.worldTop &&
                            transform.y <= bounds.worldBottom
                        ) {
                            // Convert world position to screen position
                            const screenX = bounds.screenLeft + (transform.x - bounds.worldLeft);
                            const screenY = bounds.screenTop + (transform.y - bounds.worldTop);

                            // Render the mesh
                            this.renderMesh(sprite.mesh, screenX, screenY, transform);
                        }
                    }
                },
            },
            false // Variable update
        );

        // Extend engine with Canvas2D API
        context.extend('canvas2d', this.api);

        console.log('[Canvas2DRendererPlugin] Installed successfully');
    }

    /**
     * Renders a mesh at the specified screen position
     */
    private renderMesh(mesh: any, screenX: number, screenY: number, transform: Transform): void {
        if (!this.context || !mesh.vertices || mesh.vertices.length === 0) return;

        this.context.save();

        // Apply transform
        this.context.translate(screenX, screenY);
        if (transform.rotation !== 0) {
            this.context.rotate(transform.rotation);
        }
        if (transform.scaleX !== 1 || transform.scaleY !== 1) {
            this.context.scale(transform.scaleX, transform.scaleY);
        }

        // Draw mesh
        this.context.beginPath();
        const firstVertex = mesh.vertices[0];
        this.context.moveTo(firstVertex.position.x, firstVertex.position.y);

        for (let i = 1; i < mesh.vertices.length; i++) {
            const vertex = mesh.vertices[i];
            this.context.lineTo(vertex.position.x, vertex.position.y);
        }

        this.context.closePath();

        // Fill with mesh color
        if (mesh.color) {
            this.context.fillStyle = mesh.color.value || mesh.color.toString();
            this.context.fill();
        }

        // Stroke outline
        this.context.strokeStyle = '#000000';
        this.context.lineWidth = 1;
        this.context.stroke();

        this.context.restore();
    }

    uninstall(): void {
        console.log('[Canvas2DRendererPlugin] Uninstalled successfully');
    }
}

/**
 * Usage example:
 *
 * import { EngineBuilder } from '../../../packages/core/src/index';
 * import { Canvas2DRendererPlugin, Transform, Camera, Sprite, ScreenElement, Unit } from './Canvas2DRendererPlugin';
 * import { Mesh, Color } from '@orion-ecs/graphics';
 *
 * const engine = new EngineBuilder()
 *   .withDebugMode(true)
 *   .use(new Canvas2DRendererPlugin())
 *   .build();
 *
 * // Set the canvas
 * const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
 * engine.canvas2d.setCanvas(canvas);
 *
 * // Create a camera
 * const camera = engine.createEntity('MainCamera');
 * camera.addComponent(Transform, 400, 300);
 * camera.addComponent(Camera, 800, 600, '#87CEEB');
 * camera.addComponent(ScreenElement, 0, 0, 100, 100, Unit.Percentage);
 *
 * // Create a sprite
 * const player = engine.createEntity('Player');
 * player.addComponent(Transform, 400, 300);
 * const mesh = Mesh.rectangle(-25, -25, 50, 50, Color.Red);
 * player.addComponent(Sprite, mesh);
 *
 * // Start rendering
 * engine.start();
 * function gameLoop() {
 *   engine.update();
 *   requestAnimationFrame(gameLoop);
 * }
 * gameLoop();
 */
