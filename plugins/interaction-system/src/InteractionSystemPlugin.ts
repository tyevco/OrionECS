/**
 * Interaction System Plugin for Orion ECS
 *
 * This plugin provides UI interaction capabilities including:
 * - Clickable entities
 * - Draggable entities
 * - Selectable entities
 * - Hover detection
 * - Interaction layers
 *
 * Requires: InputManagerPlugin, Canvas2DRendererPlugin
 * Based on the prototypedestination project's MouseMonitor system.
 */

import type { DragEventData, InputAPI, MouseEventData } from '@orion-ecs/input-manager';
import { Bounds, type Vector2 } from '@orion-ecs/math';
import type { EnginePlugin, EntityDef, PluginContext } from '@orion-ecs/plugin-api';

// =============================================================================
// Interaction Event Types
// =============================================================================

/**
 * Event emitted when a clickable entity is clicked.
 * Subscribe with: context.on('interaction:click', handler)
 */
export interface ClickEvent {
    entity: EntityDef;
    position: Vector2;
}

/**
 * Event emitted when a draggable entity starts being dragged.
 * Subscribe with: context.on('interaction:dragStart', handler)
 */
export interface DragStartEvent {
    entity: EntityDef;
    position: Vector2;
}

/**
 * Event emitted when a draggable entity is being dragged.
 * Subscribe with: context.on('interaction:drag', handler)
 */
export interface DragEvent {
    entity: EntityDef;
    delta: Vector2;
}

/**
 * Event emitted when a draggable entity stops being dragged.
 * Subscribe with: context.on('interaction:dragEnd', handler)
 */
export interface DragEndEvent {
    entity: EntityDef;
    position: Vector2;
}

/**
 * Event emitted when an entity is selected.
 * Subscribe with: context.on('interaction:select', handler)
 */
export interface SelectEvent {
    entity: EntityDef;
}

/**
 * Event emitted when an entity is deselected.
 * Subscribe with: context.on('interaction:deselect', handler)
 */
export interface DeselectEvent {
    entity: EntityDef;
}

/**
 * Event emitted when mouse enters an entity.
 * Subscribe with: context.on('interaction:hoverEnter', handler)
 */
export interface HoverEnterEvent {
    entity: EntityDef;
}

/**
 * Event emitted when mouse exits an entity.
 * Subscribe with: context.on('interaction:hoverExit', handler)
 */
export interface HoverExitEvent {
    entity: EntityDef;
}

// =============================================================================
// Interaction Components (Data-Only)
// =============================================================================

/**
 * Makes an entity clickable.
 * Listen for clicks via 'interaction:click' event.
 */
export class Clickable {
    constructor(
        public enabled: boolean = true,
        public layer: number = 0
    ) {}
}

/**
 * Makes an entity draggable.
 * Listen for drag events via 'interaction:dragStart', 'interaction:drag', 'interaction:dragEnd' events.
 */
export class Draggable {
    constructor(
        public enabled: boolean = true,
        public layer: number = 0,
        public dragButton: number = 0 // 0 = left, 1 = middle, 2 = right
    ) {}

    // Internal state
    public isDragging: boolean = false;
}

/**
 * Makes an entity selectable.
 * Listen for selection events via 'interaction:select' and 'interaction:deselect' events.
 */
export class Selectable {
    constructor(
        public enabled: boolean = true,
        public layer: number = 0
    ) {}

    public selected: boolean = false;
}

/**
 * Makes an entity hoverable.
 * Listen for hover events via 'interaction:hoverEnter' and 'interaction:hoverExit' events.
 */
export class Hoverable {
    constructor(
        public enabled: boolean = true,
        public layer: number = 0
    ) {}

    public hovered: boolean = false;
}

/**
 * Defines the bounds for interaction testing
 * Can be manually set or auto-calculated from sprite/screen element
 */
export class InteractionBounds {
    constructor(
        public bounds: Bounds,
        public autoUpdate: boolean = false
    ) {}
}

// =============================================================================
// Interaction API Interface
// =============================================================================

/**
 * Interaction System API interface for type-safe engine extension.
 */
export interface IInteractionAPI {
    /** Gets all currently selected entities */
    getSelectedEntities(): EntityDef[];
    /** Selects an entity */
    selectEntity(entity: EntityDef): void;
    /** Deselects an entity */
    deselectEntity(entity: EntityDef): void;
    /** Clears all selections */
    clearSelection(): void;
    /** Gets all currently hovered entities */
    getHoveredEntities(): EntityDef[];
    /** Marks an entity as hovered (internal use) */
    _setHovered(entity: EntityDef, hovered: boolean): void;
}

// =============================================================================
// Interaction API Implementation
// =============================================================================

/**
 * Interaction System API implementation class.
 */
export class InteractionAPI implements IInteractionAPI {
    private selectedEntities: Set<EntityDef> = new Set();
    private hoveredEntities: Set<EntityDef> = new Set();
    private context: PluginContext | null = null;

    /**
     * Initialize with plugin context for event emission.
     * @internal
     */
    _init(context: PluginContext): void {
        this.context = context;
    }

    /**
     * Gets all currently selected entities
     */
    public getSelectedEntities(): EntityDef[] {
        return Array.from(this.selectedEntities);
    }

    /**
     * Selects an entity
     */
    public selectEntity(entity: EntityDef): void {
        const selectable = entity.getComponent(Selectable);
        if (selectable && !selectable.selected) {
            selectable.selected = true;
            this.selectedEntities.add(entity);
            this.context?.emit('interaction:select', { entity } as SelectEvent);
        }
    }

    /**
     * Deselects an entity
     */
    public deselectEntity(entity: EntityDef): void {
        const selectable = entity.getComponent(Selectable);
        if (selectable && selectable.selected) {
            selectable.selected = false;
            this.selectedEntities.delete(entity);
            this.context?.emit('interaction:deselect', { entity } as DeselectEvent);
        }
    }

    /**
     * Clears all selections
     */
    public clearSelection(): void {
        for (const entity of this.selectedEntities) {
            this.deselectEntity(entity);
        }
    }

    /**
     * Gets all currently hovered entities
     */
    public getHoveredEntities(): EntityDef[] {
        return Array.from(this.hoveredEntities);
    }

    /**
     * Marks an entity as hovered (internal use)
     */
    public _setHovered(entity: EntityDef, hovered: boolean): void {
        if (hovered) {
            this.hoveredEntities.add(entity);
        } else {
            this.hoveredEntities.delete(entity);
        }
    }
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Interaction System Plugin with type-safe engine extension.
 */
export class InteractionSystemPlugin implements EnginePlugin<{ interaction: IInteractionAPI }> {
    name = 'InteractionSystemPlugin';
    version = '1.0.0';

    /** Type brand for compile-time type inference */
    declare readonly __extensions: { interaction: IInteractionAPI };

    private api = new InteractionAPI();
    private currentDrag: { entity: EntityDef; startPos: Vector2 } | null = null;

    install(context: PluginContext): void {
        // Initialize API with context for event emission
        this.api._init(context);

        // Register components
        context.registerComponent(Clickable);
        context.registerComponent(Draggable);
        context.registerComponent(Selectable);
        context.registerComponent(Hoverable);
        context.registerComponent(InteractionBounds);

        // Check if input plugin is available
        const engine = context.getEngine() as { input?: InputAPI };
        if (!engine.input) {
            console.warn(
                '[InteractionSystemPlugin] InputManagerPlugin not found. Interaction will not work.'
            );
            return;
        }

        // Subscribe to input events
        const input = engine.input;

        // Handle click events
        input.on('click', (e: MouseEventData) => {
            this.handleClick(context, e.position);
        });

        // Handle drag events
        input.on('dragstart', (e: DragEventData) => {
            this.handleDragStart(context, e.startPosition);
        });

        input.on('drag', (e: DragEventData) => {
            this.handleDrag(context, e.deltaPosition);
        });

        input.on('dragend', (e: DragEventData) => {
            this.handleDragEnd(context, e.currentPosition);
        });

        // Handle mouse move for hover
        input.on('mousemove', (e: MouseEventData) => {
            this.handleMouseMove(context, e.position);
        });

        // Create system for updating interaction bounds
        // Note: This system integrates with Canvas2DRenderer plugin components dynamically
        context.createSystem(
            'InteractionBoundsUpdateSystem',
            {
                all: [InteractionBounds],
            },
            {
                priority: 950,
                act: (entity: EntityDef, interactionBounds: InteractionBounds) => {
                    if (!interactionBounds.autoUpdate) return;

                    // Transform component interface for cross-plugin integration
                    interface TransformLike {
                        x: number;
                        y: number;
                    }

                    // Canvas2DRenderer plugin API interface
                    interface Canvas2DAPI {
                        Transform?: new (...args: unknown[]) => TransformLike;
                        Position?: new (...args: unknown[]) => TransformLike;
                    }

                    // Try to get component classes from Canvas2DRenderer plugin
                    const engine = context.getEngine() as { canvas2d?: Canvas2DAPI };

                    // If Canvas2DRenderer plugin is not installed, skip auto-update
                    if (!engine.canvas2d) return;

                    // Try to find a transform-like component using proper component access
                    let transform: TransformLike | null = null;

                    // Check for Transform component
                    if (engine.canvas2d.Transform) {
                        const TransformClass = engine.canvas2d.Transform;
                        if (entity.hasComponent(TransformClass)) {
                            transform = entity.getComponent(TransformClass);
                        }
                    }

                    // Fallback: check for Position component
                    if (!transform && engine.canvas2d.Position) {
                        const PositionClass = engine.canvas2d.Position;
                        if (entity.hasComponent(PositionClass)) {
                            transform = entity.getComponent(PositionClass);
                        }
                    }

                    if (!transform) return;

                    // Auto-update is a simplified approach - users should set bounds manually
                    // for more precise control
                    interactionBounds.bounds = new Bounds(
                        transform.x - 25, // Default half-width
                        transform.y - 25, // Default half-height
                        50, // Default width
                        50 // Default height
                    );
                },
            },
            false
        );

        // Extend engine with interaction API
        context.extend('interaction', this.api);

        console.log('[InteractionSystemPlugin] Installed successfully');
    }

    /**
     * Handles click events
     */
    private handleClick(context: PluginContext, position: Vector2): void {
        const engine = context.getEngine();
        const clickables = engine.queryEntities({ all: [Clickable, InteractionBounds] });

        // Sort by layer (higher layer = checked first)
        clickables.sort((a: EntityDef, b: EntityDef) => {
            const aClickable = a.getComponent(Clickable)!;
            const bClickable = b.getComponent(Clickable)!;
            return bClickable.layer - aClickable.layer;
        });

        // Check for clicks
        for (const entity of clickables) {
            const clickable = entity.getComponent(Clickable)!;
            const bounds = entity.getComponent(InteractionBounds)!;

            if (!clickable.enabled) continue;

            if (bounds.bounds.contains(position)) {
                // Emit click event
                context.emit('interaction:click', { entity, position } as ClickEvent);

                // Check for selectable
                const selectable = entity.getComponent(Selectable);
                if (selectable && selectable.enabled) {
                    if (selectable.selected) {
                        this.api.deselectEntity(entity);
                    } else {
                        this.api.selectEntity(entity);
                    }
                }

                break; // Only click the topmost entity
            }
        }
    }

    /**
     * Handles drag start events
     */
    private handleDragStart(context: PluginContext, position: Vector2): void {
        const engine = context.getEngine();
        const draggables = engine.queryEntities({ all: [Draggable, InteractionBounds] });

        // Sort by layer
        draggables.sort((a: EntityDef, b: EntityDef) => {
            const aDraggable = a.getComponent(Draggable)!;
            const bDraggable = b.getComponent(Draggable)!;
            return bDraggable.layer - aDraggable.layer;
        });

        // Find the topmost draggable
        for (const entity of draggables) {
            const draggable = entity.getComponent(Draggable)!;
            const bounds = entity.getComponent(InteractionBounds)!;

            if (!draggable.enabled) continue;

            if (bounds.bounds.contains(position)) {
                draggable.isDragging = true;
                this.currentDrag = { entity, startPos: position.clone() };

                // Emit drag start event
                context.emit('interaction:dragStart', { entity, position } as DragStartEvent);

                break; // Only drag one entity
            }
        }
    }

    /**
     * Handles drag events
     */
    private handleDrag(context: PluginContext, delta: Vector2): void {
        if (!this.currentDrag) return;

        const { entity } = this.currentDrag;
        const draggable = entity.getComponent(Draggable);

        if (draggable && draggable.isDragging) {
            // Emit drag event
            context.emit('interaction:drag', { entity, delta } as DragEvent);
        }
    }

    /**
     * Handles drag end events
     */
    private handleDragEnd(context: PluginContext, position: Vector2): void {
        if (!this.currentDrag) return;

        const { entity } = this.currentDrag;
        const draggable = entity.getComponent(Draggable);

        if (draggable && draggable.isDragging) {
            draggable.isDragging = false;

            // Emit drag end event
            context.emit('interaction:dragEnd', { entity, position } as DragEndEvent);
        }

        this.currentDrag = null;
    }

    /**
     * Handles mouse move for hover detection
     */
    private handleMouseMove(context: PluginContext, position: Vector2): void {
        const engine = context.getEngine();
        const hoverables = engine.queryEntities({ all: [Hoverable, InteractionBounds] });

        // Check which entities are hovered
        for (const entity of hoverables) {
            const hoverable = entity.getComponent(Hoverable)!;
            const bounds = entity.getComponent(InteractionBounds)!;

            if (!hoverable.enabled) continue;

            const isHovered = bounds.bounds.contains(position);

            if (isHovered) {
                // Trigger hover enter if not already hovered
                if (!hoverable.hovered) {
                    hoverable.hovered = true;
                    this.api._setHovered(entity, true);
                    // Emit hover enter event
                    context.emit('interaction:hoverEnter', { entity } as HoverEnterEvent);
                }
            } else {
                // Trigger hover exit if was hovered
                if (hoverable.hovered) {
                    hoverable.hovered = false;
                    this.api._setHovered(entity, false);
                    // Emit hover exit event
                    context.emit('interaction:hoverExit', { entity } as HoverExitEvent);
                }
            }
        }
    }

    uninstall(): void {
        this.api.clearSelection();
        console.log('[InteractionSystemPlugin] Uninstalled successfully');
    }
}

/**
 * Usage example:
 *
 * import { EngineBuilder } from '../../../packages/core/src/index';
 * import { Canvas2DRendererPlugin, Transform, Sprite } from './Canvas2DRendererPlugin';
 * import { InputManagerPlugin } from './InputManagerPlugin';
 * import {
 *   InteractionSystemPlugin,
 *   Clickable,
 *   Draggable,
 *   Selectable,
 *   InteractionBounds,
 *   ClickEvent,
 *   DragEvent
 * } from './InteractionSystemPlugin';
 * import { Mesh, Color } from '@orion-ecs/graphics';
 * import { Bounds } from '@orion-ecs/math';
 *
 * const engine = new EngineBuilder()
 *   .withDebugMode(true)
 *   .use(new Canvas2DRendererPlugin())
 *   .use(new InputManagerPlugin())
 *   .use(new InteractionSystemPlugin())
 *   .build();
 *
 * // Initialize
 * const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
 * engine.canvas2d.setCanvas(canvas);
 * engine.input.initialize(canvas);
 *
 * // Create an interactive entity
 * const button = engine.createEntity('Button');
 * button.addComponent(Transform, 400, 300);
 * const mesh = Mesh.rectangle(-50, -25, 100, 50, Color.Blue);
 * button.addComponent(Sprite, mesh);
 * button.addComponent(InteractionBounds, Bounds.fromCenter({ x: 0, y: 0 }, 100, 50), true);
 * button.addComponent(Clickable);
 * button.addComponent(Draggable);
 * button.addComponent(Selectable);
 *
 * // Subscribe to interaction events
 * engine.on('interaction:click', (event: ClickEvent) => {
 *   console.log('Entity clicked at', event.position);
 * });
 *
 * engine.on('interaction:drag', (event: DragEvent) => {
 *   const transform = event.entity.getComponent(Transform);
 *   transform.x += event.delta.x;
 *   transform.y += event.delta.y;
 * });
 *
 * engine.on('interaction:select', (event) => {
 *   console.log('Entity selected:', event.entity.name);
 * });
 *
 * engine.start();
 */
