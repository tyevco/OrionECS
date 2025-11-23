/**
 * Canvas2D Renderer Plugin for Orion ECS
 *
 * Exports:
 * - Canvas2DRendererPlugin: The main plugin
 * - Components: Transform, Camera, Sprite, ScreenElement
 * - Types and enums
 */

export type { Vector2 } from '@orion-ecs/math';
export type { Bounds, Color, Mesh } from './Canvas2DRendererPlugin';
export {
    Camera,
    Canvas2DAPI,
    Canvas2DRendererPlugin,
    ScreenElement,
    Sprite,
    Transform,
    Unit,
} from './Canvas2DRendererPlugin';
