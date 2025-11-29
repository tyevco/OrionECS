/**
 * Canvas2DRendererPlugin Test Suite
 *
 * Comprehensive tests covering:
 * - Component initialization and validation
 * - Canvas setup and rendering context
 * - Camera and viewport management
 * - Sprite rendering with transforms
 * - Multi-camera support
 * - Screen-to-world coordinate conversion
 */

import { TestEngineBuilder } from '@orion-ecs/testing';
import type { Engine } from '../../../packages/core/src/index';
import {
    Camera,
    Canvas2DAPI,
    Canvas2DRendererPlugin,
    type Mesh,
    ScreenElement,
    Sprite,
    Transform,
    Unit,
} from './Canvas2DRendererPlugin';

// Type extensions for testing
type EngineWithCanvas2D = Engine & { canvas2d: Canvas2DAPI };

// Mock canvas and context
class MockCanvasRenderingContext2D {
    fillStyle: string = '#000000';
    strokeStyle: string = '#000000';
    lineWidth: number = 1;
    globalAlpha: number = 1;

    clearRect = jest.fn();
    fillRect = jest.fn();
    strokeRect = jest.fn();
    beginPath = jest.fn();
    moveTo = jest.fn();
    lineTo = jest.fn();
    closePath = jest.fn();
    fill = jest.fn();
    stroke = jest.fn();
    save = jest.fn();
    restore = jest.fn();
    translate = jest.fn();
    rotate = jest.fn();
    scale = jest.fn();
}

class MockHTMLCanvasElement {
    width: number = 800;
    height: number = 600;

    getContext(contextId: string): MockCanvasRenderingContext2D | null {
        if (contextId === '2d') {
            return new MockCanvasRenderingContext2D();
        }
        return null;
    }
}

describe('Canvas2DRendererPlugin', () => {
    let engine: EngineWithCanvas2D;
    let plugin: Canvas2DRendererPlugin;
    let mockCanvas: MockHTMLCanvasElement;

    beforeEach(() => {
        plugin = new Canvas2DRendererPlugin();
        engine = new TestEngineBuilder().use(plugin).build() as unknown as EngineWithCanvas2D;

        mockCanvas = new MockHTMLCanvasElement();
    });

    afterEach(() => {
        engine.stop();
    });

    describe('Plugin Metadata', () => {
        test('should have correct name and version', () => {
            expect(plugin.name).toBe('Canvas2DRendererPlugin');
            expect(plugin.version).toBe('1.0.0');
        });
    });

    describe('Plugin Installation', () => {
        test('should install successfully', () => {
            expect(engine).toBeDefined();
        });

        test('should extend engine with canvas2d API', () => {
            expect((engine as EngineWithCanvas2D).canvas2d).toBeDefined();
            expect((engine as EngineWithCanvas2D).canvas2d).toBeInstanceOf(Canvas2DAPI);
        });

        test('should register all components', () => {
            const entity = engine.createEntity('TestEntity');

            expect(() => entity.addComponent(Transform, 0, 0)).not.toThrow();
            expect(() => entity.addComponent(ScreenElement, 0, 0, 100, 100)).not.toThrow();
            expect(() => entity.addComponent(Camera, 800, 600)).not.toThrow();
        });

        test('should create rendering systems', () => {
            const systems = engine.getSystemProfiles();
            const systemNames = systems.map((s) => s.name);

            expect(systemNames).toContain('CameraSetupSystem');
            expect(systemNames).toContain('SpriteRendererSystem');
        });
    });

    describe('Component - Transform', () => {
        test('should create Transform with default values', () => {
            const transform = new Transform();
            expect(transform.x).toBe(0);
            expect(transform.y).toBe(0);
            expect(transform.rotation).toBe(0);
            expect(transform.scaleX).toBe(1);
            expect(transform.scaleY).toBe(1);
        });

        test('should create Transform with custom values', () => {
            const transform = new Transform(100, 200, Math.PI / 2, 2, 0.5);
            expect(transform.x).toBe(100);
            expect(transform.y).toBe(200);
            expect(transform.rotation).toBe(Math.PI / 2);
            expect(transform.scaleX).toBe(2);
            expect(transform.scaleY).toBe(0.5);
        });

        test('should allow direct property access for position', () => {
            const transform = new Transform(50, 75);
            expect(transform.x).toBe(50);
            expect(transform.y).toBe(75);

            transform.x = 100;
            transform.y = 200;
            expect(transform.x).toBe(100);
            expect(transform.y).toBe(200);
        });
    });

    describe('Component - ScreenElement', () => {
        test('should create ScreenElement with default values', () => {
            const element = new ScreenElement();
            expect(element.left).toBe(0);
            expect(element.top).toBe(0);
            expect(element.width).toBe(100);
            expect(element.height).toBe(100);
            expect(element.unit).toBe(Unit.Percentage);
        });

        test('should create ScreenElement with pixel units', () => {
            const element = new ScreenElement(100, 50, 400, 300, Unit.Pixels);
            expect(element.left).toBe(100);
            expect(element.top).toBe(50);
            expect(element.width).toBe(400);
            expect(element.height).toBe(300);
            expect(element.unit).toBe(Unit.Pixels);
        });

        test('should create ScreenElement with percentage units', () => {
            const element = new ScreenElement(25, 25, 50, 50, Unit.Percentage);
            expect(element.left).toBe(25);
            expect(element.top).toBe(25);
            expect(element.width).toBe(50);
            expect(element.height).toBe(50);
            expect(element.unit).toBe(Unit.Percentage);
        });
    });

    describe('Component - Camera', () => {
        test('should create Camera with default values', () => {
            const camera = new Camera();
            expect(camera.width).toBe(800);
            expect(camera.height).toBe(600);
            expect(camera.backgroundColor).toBeUndefined();
        });

        test('should create Camera with custom values', () => {
            const camera = new Camera(1920, 1080, '#FF0000');
            expect(camera.width).toBe(1920);
            expect(camera.height).toBe(1080);
            expect(camera.backgroundColor).toBe('#FF0000');
        });

        test('should validate positive dimensions', () => {
            const entity = engine.createEntity('TestCamera');
            entity.addComponent(Transform, 0, 0);
            entity.addComponent(ScreenElement);

            // Negative width should fail
            expect(() => {
                entity.addComponent(Camera, -100, 600);
            }).toThrow(/Camera dimensions must be positive/);

            // Negative height should fail
            expect(() => {
                entity.addComponent(Camera, 800, -100);
            }).toThrow(/Camera dimensions must be positive/);

            // Zero dimensions should fail
            expect(() => {
                entity.addComponent(Camera, 0, 0);
            }).toThrow(/Camera dimensions must be positive/);
        });

        test('should require Transform and ScreenElement', () => {
            const entity = engine.createEntity('TestCamera');

            // Should fail without dependencies
            expect(() => {
                entity.addComponent(Camera, 800, 600);
            }).toThrow(/requires/);
        });
    });

    describe('Component - Sprite', () => {
        const mockMesh = {
            vertices: [
                { position: { x: 0, y: 0 } },
                { position: { x: 10, y: 0 } },
                { position: { x: 10, y: 10 } },
            ],
            color: { value: '#FF0000' },
        } as unknown as Mesh;

        test('should create Sprite with default values', () => {
            const sprite = new Sprite(mockMesh);
            expect(sprite.mesh).toBe(mockMesh);
            expect(sprite.visible).toBe(true);
            expect(sprite.layer).toBe(0);
        });

        test('should create Sprite with custom values', () => {
            const sprite = new Sprite(mockMesh, false, 5);
            expect(sprite.mesh).toBe(mockMesh);
            expect(sprite.visible).toBe(false);
            expect(sprite.layer).toBe(5);
        });

        test('should validate mesh requirement', () => {
            const entity = engine.createEntity('TestSprite');
            entity.addComponent(Transform);

            // Should fail without mesh
            expect(() => {
                entity.addComponent(Sprite, null as unknown as Mesh);
            }).toThrow(/Sprite must have a mesh/);
        });

        test('should require Transform component', () => {
            const entity = engine.createEntity('TestSprite');

            expect(() => {
                entity.addComponent(Sprite, mockMesh);
            }).toThrow(/requires/);
        });
    });

    describe('Canvas2DAPI - Canvas Management', () => {
        let api: Canvas2DAPI;

        beforeEach(() => {
            api = (engine as EngineWithCanvas2D).canvas2d;
        });

        test('should set canvas', () => {
            expect(() => {
                api.setCanvas(mockCanvas as unknown as HTMLCanvasElement);
            }).not.toThrow();

            expect(api.getCanvas()).toBe(mockCanvas);
        });

        test('should get rendering context', () => {
            api.setCanvas(mockCanvas as unknown as HTMLCanvasElement);
            const ctx = api.getContext();

            expect(ctx).toBeDefined();
            expect(ctx).toBeInstanceOf(MockCanvasRenderingContext2D);
        });

        test('should throw error if 2D context unavailable', () => {
            const badCanvas = {
                getContext: () => null,
            };

            expect(() => {
                api.setCanvas(badCanvas as unknown as HTMLCanvasElement);
            }).toThrow('Failed to get 2D rendering context');
        });

        test('should return undefined for canvas before setup', () => {
            expect(api.getCanvas()).toBeUndefined();
        });
    });

    describe('Canvas2DAPI - Render Settings', () => {
        let api: Canvas2DAPI;

        beforeEach(() => {
            api = (engine as EngineWithCanvas2D).canvas2d;
        });

        test('should have default clear before render', () => {
            expect(api.getClearBeforeRender()).toBe(true);
        });

        test('should set clear before render', () => {
            api.setClearBeforeRender(false);
            expect(api.getClearBeforeRender()).toBe(false);

            api.setClearBeforeRender(true);
            expect(api.getClearBeforeRender()).toBe(true);
        });

        test('should have default global alpha', () => {
            expect(api.getGlobalAlpha()).toBe(1);
        });

        test('should set global alpha', () => {
            api.setGlobalAlpha(0.5);
            expect(api.getGlobalAlpha()).toBe(0.5);
        });

        test('should clamp global alpha to valid range', () => {
            api.setGlobalAlpha(-0.5);
            expect(api.getGlobalAlpha()).toBe(0);

            api.setGlobalAlpha(1.5);
            expect(api.getGlobalAlpha()).toBe(1);
        });
    });

    describe('Canvas2DAPI - Screen to World Conversion', () => {
        let api: Canvas2DAPI;

        beforeEach(() => {
            api = (engine as EngineWithCanvas2D).canvas2d;
            api.setCanvas(mockCanvas as unknown as HTMLCanvasElement);
        });

        test('should convert screen to world coordinates', () => {
            const camera = engine.createEntity('Camera');
            camera.addComponent(Transform, 400, 300);
            camera.addComponent(ScreenElement, 0, 0, 100, 100, Unit.Percentage);
            camera.addComponent(Camera, 800, 600);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const worldPos = api.screenToWorld(400, 300, camera as any);

            expect(worldPos).not.toBeNull();
            expect(worldPos).toHaveProperty('x');
            expect(worldPos).toHaveProperty('y');
        });

        test('should throw if camera missing required components', () => {
            const camera = engine.createEntity('Camera');
            camera.addComponent(Transform, 0, 0);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(() => api.screenToWorld(100, 100, camera as any)).toThrow(
                /Component .* not found/
            );
        });

        test('should return null if canvas not set', () => {
            const apiWithoutCanvas = new Canvas2DAPI();
            const camera = engine.createEntity('Camera');
            camera.addComponent(Transform, 0, 0);
            camera.addComponent(ScreenElement);
            camera.addComponent(Camera, 800, 600);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const worldPos = apiWithoutCanvas.screenToWorld(100, 100, camera as any);

            expect(worldPos).toBeNull();
        });
    });

    describe('Rendering Systems - Camera Setup', () => {
        let api: Canvas2DAPI;

        beforeEach(() => {
            api = (engine as EngineWithCanvas2D).canvas2d;
            api.setCanvas(mockCanvas as unknown as HTMLCanvasElement);
        });

        test('should set up camera viewport', () => {
            const camera = engine.createEntity('Camera');
            camera.addComponent(Transform, 400, 300);
            camera.addComponent(ScreenElement, 0, 0, 100, 100, Unit.Percentage);
            camera.addComponent(Camera, 800, 600);

            engine.start();
            engine.update(0);

            // Should have cleared and drawn camera border
            const ctx = api.getContext() as unknown as MockCanvasRenderingContext2D;
            expect(ctx.clearRect).toHaveBeenCalled();
            expect(ctx.strokeRect).toHaveBeenCalled();
        });

        test('should handle multiple cameras', () => {
            const camera1 = engine.createEntity('Camera1');
            camera1.addComponent(Transform, 200, 150);
            camera1.addComponent(ScreenElement, 0, 0, 50, 100, Unit.Percentage);
            camera1.addComponent(Camera, 400, 300);

            const camera2 = engine.createEntity('Camera2');
            camera2.addComponent(Transform, 600, 150);
            camera2.addComponent(ScreenElement, 50, 0, 50, 100, Unit.Percentage);
            camera2.addComponent(Camera, 400, 300);

            engine.start();
            engine.update(0);

            // Should clear both viewports
            const ctx = api.getContext() as unknown as MockCanvasRenderingContext2D;
            expect(ctx.clearRect).toHaveBeenCalledTimes(3); // Once for full canvas, once per camera
        });

        test('should draw background color if specified', () => {
            const camera = engine.createEntity('Camera');
            camera.addComponent(Transform, 400, 300);
            camera.addComponent(ScreenElement, 0, 0, 100, 100, Unit.Percentage);
            camera.addComponent(Camera, 800, 600, '#87CEEB');

            engine.start();
            engine.update(0);

            const ctx = api.getContext() as unknown as MockCanvasRenderingContext2D;
            expect(ctx.fillRect).toHaveBeenCalled();
            expect(ctx.fillStyle).toBe('#87CEEB');
        });
    });

    describe('Rendering Systems - Sprite Rendering', () => {
        let api: Canvas2DAPI;

        const mockMesh = {
            vertices: [
                { position: { x: -10, y: -10 } },
                { position: { x: 10, y: -10 } },
                { position: { x: 10, y: 10 } },
                { position: { x: -10, y: 10 } },
            ],
            color: { value: '#FF0000' },
        } as unknown as Mesh;

        beforeEach(() => {
            api = (engine as EngineWithCanvas2D).canvas2d;
            api.setCanvas(mockCanvas as unknown as HTMLCanvasElement);
        });

        test('should render visible sprites', () => {
            // Create camera
            const camera = engine.createEntity('Camera');
            camera.addComponent(Transform, 400, 300);
            camera.addComponent(ScreenElement, 0, 0, 100, 100, Unit.Percentage);
            camera.addComponent(Camera, 800, 600);

            // Create sprite in camera view
            const sprite = engine.createEntity('Sprite');
            sprite.addComponent(Transform, 400, 300);
            sprite.addComponent(Sprite, mockMesh);

            engine.start();
            engine.update(0);

            const ctx = api.getContext() as unknown as MockCanvasRenderingContext2D;
            expect(ctx.beginPath).toHaveBeenCalled();
            expect(ctx.fill).toHaveBeenCalled();
        });

        test('should not render invisible sprites', () => {
            const camera = engine.createEntity('Camera');
            camera.addComponent(Transform, 400, 300);
            camera.addComponent(ScreenElement, 0, 0, 100, 100, Unit.Percentage);
            camera.addComponent(Camera, 800, 600);

            const sprite = engine.createEntity('Sprite');
            sprite.addComponent(Transform, 400, 300);
            sprite.addComponent(Sprite, mockMesh, false); // invisible

            engine.start();

            const ctx = api.getContext() as unknown as MockCanvasRenderingContext2D;
            const fillCallsBefore = ctx.fill.mock.calls.length;

            engine.update(0);

            // Should not have called fill for invisible sprite
            expect(ctx.fill.mock.calls.length).toBe(fillCallsBefore);
        });

        test('should apply transform (rotation)', () => {
            const camera = engine.createEntity('Camera');
            camera.addComponent(Transform, 400, 300);
            camera.addComponent(ScreenElement, 0, 0, 100, 100, Unit.Percentage);
            camera.addComponent(Camera, 800, 600);

            const sprite = engine.createEntity('Sprite');
            sprite.addComponent(Transform, 400, 300, Math.PI / 4); // 45 degree rotation
            sprite.addComponent(Sprite, mockMesh);

            engine.start();
            engine.update(0);

            const ctx = api.getContext() as unknown as MockCanvasRenderingContext2D;
            expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 4);
        });

        test('should apply transform (scale)', () => {
            const camera = engine.createEntity('Camera');
            camera.addComponent(Transform, 400, 300);
            camera.addComponent(ScreenElement, 0, 0, 100, 100, Unit.Percentage);
            camera.addComponent(Camera, 800, 600);

            const sprite = engine.createEntity('Sprite');
            sprite.addComponent(Transform, 400, 300, 0, 2, 0.5);
            sprite.addComponent(Sprite, mockMesh);

            engine.start();
            engine.update(0);

            const ctx = api.getContext() as unknown as MockCanvasRenderingContext2D;
            expect(ctx.scale).toHaveBeenCalledWith(2, 0.5);
        });
    });

    describe('Integration Tests', () => {
        test('should work with complete scene setup', () => {
            const api = (engine as EngineWithCanvas2D).canvas2d;
            api.setCanvas(mockCanvas as unknown as HTMLCanvasElement);

            // Create camera
            const camera = engine.createEntity('MainCamera');
            camera.addComponent(Transform, 400, 300);
            camera.addComponent(ScreenElement, 0, 0, 100, 100, Unit.Percentage);
            camera.addComponent(Camera, 800, 600, '#87CEEB');

            // Create multiple sprites
            for (let i = 0; i < 5; i++) {
                const sprite = engine.createEntity(`Sprite${i}`);
                sprite.addComponent(Transform, 300 + i * 50, 300);
                sprite.addComponent(Sprite, {
                    vertices: [
                        { position: { x: -10, y: -10 } },
                        { position: { x: 10, y: -10 } },
                        { position: { x: 10, y: 10 } },
                    ],
                    color: { value: '#FF0000' },
                } as unknown as Mesh);
            }

            expect(() => {
                engine.start();
                engine.update(0);
            }).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        test('should handle sprites outside camera bounds', () => {
            const api = (engine as EngineWithCanvas2D).canvas2d;
            api.setCanvas(mockCanvas as unknown as HTMLCanvasElement);

            const camera = engine.createEntity('Camera');
            camera.addComponent(Transform, 400, 300);
            camera.addComponent(ScreenElement, 0, 0, 100, 100, Unit.Percentage);
            camera.addComponent(Camera, 800, 600);

            // Sprite far outside camera view
            const sprite = engine.createEntity('Sprite');
            sprite.addComponent(Transform, 10000, 10000);
            sprite.addComponent(Sprite, {
                vertices: [{ position: { x: 0, y: 0 } }],
                color: { value: '#FF0000' },
            } as unknown as Mesh);

            expect(() => {
                engine.start();
                engine.update(0);
            }).not.toThrow();
        });

        test('should handle empty mesh vertices', () => {
            const api = (engine as EngineWithCanvas2D).canvas2d;
            api.setCanvas(mockCanvas as unknown as HTMLCanvasElement);

            const camera = engine.createEntity('Camera');
            camera.addComponent(Transform, 400, 300);
            camera.addComponent(ScreenElement, 0, 0, 100, 100, Unit.Percentage);
            camera.addComponent(Camera, 800, 600);

            const sprite = engine.createEntity('Sprite');
            sprite.addComponent(Transform, 400, 300);
            sprite.addComponent(Sprite, {
                vertices: [],
                color: { value: '#FF0000' },
            } as unknown as Mesh);

            expect(() => {
                engine.start();
                engine.update(0);
            }).not.toThrow();
        });

        test('should handle pixel-based screen elements', () => {
            const api = (engine as EngineWithCanvas2D).canvas2d;
            api.setCanvas(mockCanvas as unknown as HTMLCanvasElement);

            const camera = engine.createEntity('Camera');
            camera.addComponent(Transform, 200, 150);
            camera.addComponent(ScreenElement, 100, 50, 400, 300, Unit.Pixels);
            camera.addComponent(Camera, 400, 300);

            expect(() => {
                engine.start();
                engine.update(0);
            }).not.toThrow();
        });
    });

    describe('Plugin Uninstallation', () => {
        test('should uninstall cleanly', () => {
            expect(() => {
                plugin.uninstall();
            }).not.toThrow();
        });
    });
});
