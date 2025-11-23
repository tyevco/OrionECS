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

import type { EnginePlugin, Entity, PluginContext } from '../../../packages/core/src/index';
import { Bounds, type Vector2 } from '../../../packages/math/src/index';

/**
 * Makes an entity clickable
 */
export class Clickable {
    constructor(
        public enabled: boolean = true,
        public layer: number = 0
    ) {}

    public onClick?: (entity: Entity, position: Vector2) => void;
}

/**
 * Makes an entity draggable
 */
export class Draggable {
    constructor(
        public enabled: boolean = true,
        public layer: number = 0,
        public dragButton: number = 0 // 0 = left, 1 = middle, 2 = right
    ) {}

    public onDragStart?: (entity: Entity, position: Vector2) => void;
    public onDrag?: (entity: Entity, delta: Vector2) => void;
    public onDragEnd?: (entity: Entity, position: Vector2) => void;

    // Internal state
    public isDragging: boolean = false;
}

/**
 * Makes an entity selectable
 */
export class Selectable {
    constructor(
        public enabled: boolean = true,
        public layer: number = 0
    ) {}

    public selected: boolean = false;
    public onSelect?: (entity: Entity) => void;
    public onDeselect?: (entity: Entity) => void;
}

/**
 * Makes an entity hoverable
 */
export class Hoverable {
    constructor(
        public enabled: boolean = true,
        public layer: number = 0
    ) {}

    public hovered: boolean = false;
    public onHoverEnter?: (entity: Entity) => void;
    public onHoverExit?: (entity: Entity) => void;
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

/**
 * Interaction System API
 */
export class InteractionAPI {
    private selectedEntities: Set<Entity> = new Set();
    private hoveredEntities: Set<Entity> = new Set();

    /**
     * Gets all currently selected entities
     */
    public getSelectedEntities(): Entity[] {
        return Array.from(this.selectedEntities);
    }

    /**
     * Selects an entity
     */
    public selectEntity(entity: Entity): void {
        const selectable = entity.getComponent(Selectable);
        if (selectable && !selectable.selected) {
            selectable.selected = true;
            this.selectedEntities.add(entity);
            if (selectable.onSelect) {
                selectable.onSelect(entity);
            }
        }
    }

    /**
     * Deselects an entity
     */
    public deselectEntity(entity: Entity): void {
        const selectable = entity.getComponent(Selectable);
        if (selectable && selectable.selected) {
            selectable.selected = false;
            this.selectedEntities.delete(entity);
            if (selectable.onDeselect) {
                selectable.onDeselect(entity);
            }
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
    public getHoveredEntities(): Entity[] {
        return Array.from(this.hoveredEntities);
    }

    /**
     * Marks an entity as hovered (internal use)
     */
    public _setHovered(entity: Entity, hovered: boolean): void {
        if (hovered) {
            this.hoveredEntities.add(entity);
        } else {
            this.hoveredEntities.delete(entity);
        }
    }
}

/**
 * Interaction System Plugin
 */
export class InteractionSystemPlugin implements EnginePlugin {
    name = 'InteractionSystemPlugin';
    version = '1.0.0';

    private api = new InteractionAPI();
    private currentDrag: { entity: Entity; startPos: Vector2 } | null = null;

    install(context: PluginContext): void {
        // Register components
        context.registerComponent(Clickable);
        context.registerComponent(Draggable);
        context.registerComponent(Selectable);
        context.registerComponent(Hoverable);
        context.registerComponent(InteractionBounds);

        // Check if input plugin is available
        const engine = (context as any).engine;
        if (!engine || !engine.input) {
            console.warn(
                '[InteractionSystemPlugin] InputManagerPlugin not found. Interaction will not work.'
            );
            return;
        }

        // Subscribe to input events
        const input = engine.input;

        // Handle click events
        input.on('click', (e: any) => {
            this.handleClick(context, e.position);
        });

        // Handle drag events
        input.on('dragstart', (e: any) => {
            this.handleDragStart(context, e.startPosition);
        });

        input.on('drag', (e: any) => {
            this.handleDrag(context, e.deltaPosition);
        });

        input.on('dragend', (e: any) => {
            this.handleDragEnd(context, e.currentPosition);
        });

        // Handle mouse move for hover
        input.on('mousemove', (e: any) => {
            this.handleMouseMove(context, e.position);
        });

        // Create system for updating interaction bounds
        context.createSystem(
            'InteractionBoundsUpdateSystem',
            {
                all: [InteractionBounds],
            },
            {
                priority: 950,
                act: (entity: any, ...components: any[]) => {
                    const [interactionBounds] = components as [InteractionBounds];
                    if (!interactionBounds.autoUpdate) return;

                    // Try to get Transform from Canvas2DRenderer plugin
                    const Transform = (entity as any).constructor.prototype.Transform;
                    if (!Transform) return;

                    const transform = entity.getComponent(Transform);
                    if (!transform) return;

                    // Try to get Sprite
                    const Sprite = (entity as any).constructor.prototype.Sprite;
                    const sprite = Sprite ? entity.getComponent(Sprite) : null;

                    if (sprite && sprite.mesh) {
                        const meshBounds = sprite.mesh.getBounds();
                        if (meshBounds) {
                            // Update interaction bounds based on mesh bounds
                            interactionBounds.bounds = new Bounds(
                                transform.x + meshBounds.left,
                                transform.y + meshBounds.top,
                                meshBounds.width,
                                meshBounds.height
                            );
                        }
                    }
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
        clickables.sort((a: Entity, b: Entity) => {
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
                if (clickable.onClick) {
                    clickable.onClick(entity, position);
                }

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
        draggables.sort((a: Entity, b: Entity) => {
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

                if (draggable.onDragStart) {
                    draggable.onDragStart(entity, position);
                }

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
            if (draggable.onDrag) {
                draggable.onDrag(entity, delta);
            } else {
                // Default behavior: move the entity
                // Try to get Transform from Canvas2DRenderer plugin
                const transform =
                    (entity as any).transform || entity.getComponent('Transform' as any);
                if (transform) {
                    transform.x += delta.x;
                    transform.y += delta.y;
                }
            }
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

            if (draggable.onDragEnd) {
                draggable.onDragEnd(entity, position);
            }
        }

        this.currentDrag = null;
    }

    /**
     * Handles mouse move for hover detection
     */
    private handleMouseMove(context: PluginContext, position: Vector2): void {
        const engine = context.getEngine();
        const hoverables = engine.queryEntities({ all: [Hoverable, InteractionBounds] });

        const currentlyHovered = new Set<Entity>();

        // Check which entities are hovered
        for (const entity of hoverables) {
            const hoverable = entity.getComponent(Hoverable)!;
            const bounds = entity.getComponent(InteractionBounds)!;

            if (!hoverable.enabled) continue;

            const isHovered = bounds.bounds.contains(position);

            if (isHovered) {
                currentlyHovered.add(entity);

                // Trigger hover enter if not already hovered
                if (!hoverable.hovered) {
                    hoverable.hovered = true;
                    this.api._setHovered(entity, true);
                    if (hoverable.onHoverEnter) {
                        hoverable.onHoverEnter(entity);
                    }
                }
            } else {
                // Trigger hover exit if was hovered
                if (hoverable.hovered) {
                    hoverable.hovered = false;
                    this.api._setHovered(entity, false);
                    if (hoverable.onHoverExit) {
                        hoverable.onHoverExit(entity);
                    }
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
 * import { EngineBuilder } from 'orion-ecs';
 * import { Canvas2DRendererPlugin, Transform, Sprite } from './Canvas2DRendererPlugin';
 * import { InputManagerPlugin } from './InputManagerPlugin';
 * import { InteractionSystemPlugin, Clickable, Draggable, Selectable, InteractionBounds } from './InteractionSystemPlugin';
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
 * // Add callbacks
 * const clickable = button.getComponent(Clickable);
 * clickable.onClick = (entity, pos) => {
 *   console.log('Button clicked at', pos);
 * };
 *
 * const draggable = button.getComponent(Draggable);
 * draggable.onDrag = (entity, delta) => {
 *   const transform = entity.getComponent(Transform);
 *   transform.x += delta.x;
 *   transform.y += delta.y;
 * };
 *
 * engine.start();
 */
