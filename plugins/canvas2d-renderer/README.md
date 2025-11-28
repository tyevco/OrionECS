# Canvas2D Renderer Plugin

2D canvas rendering capabilities for Orion ECS, providing camera systems, sprite rendering, and viewport management.

## Overview

The Canvas2D Renderer Plugin provides comprehensive 2D rendering features including:

- **Camera System**: Multi-camera support with independent viewports
- **Sprite Rendering**: Mesh-based sprite rendering with world-to-screen coordinate conversion
- **Transform Management**: Position, rotation, and scale support
- **Screen Elements**: Flexible UI positioning with pixels or percentages
- **Viewport Management**: Multiple viewports on a single canvas

## Installation

```typescript
import { EngineBuilder } from '@orion-ecs/core';
import { Canvas2DRendererPlugin } from '@orion-ecs/canvas2d-renderer';

const engine = new EngineBuilder()
  .use(new Canvas2DRendererPlugin())
  .build();
```

## Quick Start

### Basic Setup

```typescript
import { EngineBuilder } from '@orion-ecs/core';
import { Canvas2DRendererPlugin, Transform, Camera, Sprite, ScreenElement, Unit } from '@orion-ecs/canvas2d-renderer';
import { Mesh, Color } from '@orion-ecs/graphics';

// Create engine with plugin
const engine = new EngineBuilder()
  .withDebugMode(true)
  .use(new Canvas2DRendererPlugin())
  .build();

// Set the canvas element
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
engine.canvas2d.setCanvas(canvas);

// Create a camera
const camera = engine.createEntity('MainCamera');
camera.addComponent(Transform, 400, 300);  // Center position
camera.addComponent(Camera, 800, 600, '#87CEEB');  // Width, height, background color
camera.addComponent(ScreenElement, 0, 0, 100, 100, Unit.Percentage);  // Full screen

// Create a sprite
const player = engine.createEntity('Player');
player.addComponent(Transform, 400, 300);
const mesh = Mesh.rectangle(-25, -25, 50, 50, Color.Red);
player.addComponent(Sprite, mesh, true, 0);  // mesh, visible, layer

// Start the game loop
engine.start();
function gameLoop() {
  engine.update();
  requestAnimationFrame(gameLoop);
}
gameLoop();
```

## API Reference

### Components

#### Transform

Defines entity position, rotation, and scale in world space.

```typescript
class Transform {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public rotation: number = 0,
    public scaleX: number = 1,
    public scaleY: number = 1
  )

  get position(): { x: number; y: number }
  setPosition(x: number, y: number): void
}
```

**Example:**
```typescript
const transform = entity.addComponent(Transform, 100, 200, 0, 1.5, 1.5);
transform.setPosition(150, 250);
console.log(transform.position); // { x: 150, y: 250 }
```

#### Camera

Defines a rendering viewport with dimensions and background color.

```typescript
class Camera {
  constructor(
    public width: number = 800,
    public height: number = 600,
    public backgroundColor?: string
  )
}
```

**Validators:**
- Requires `Transform` and `ScreenElement` components
- Width and height must be positive

**Example:**
```typescript
camera.addComponent(Camera, 1920, 1080, '#000000');
```

#### ScreenElement

Defines where a camera viewport appears on the canvas.

```typescript
enum Unit {
  Percentage = 'percentage',
  Pixels = 'pixels'
}

class ScreenElement {
  constructor(
    public left: number = 0,
    public top: number = 0,
    public width: number = 100,
    public height: number = 100,
    public unit: Unit = Unit.Percentage
  )
}
```

**Example:**
```typescript
// Full screen camera
camera.addComponent(ScreenElement, 0, 0, 100, 100, Unit.Percentage);

// Picture-in-picture camera (bottom-right corner)
pipCamera.addComponent(ScreenElement, 75, 75, 25, 25, Unit.Percentage);

// Fixed pixel position
uiCamera.addComponent(ScreenElement, 10, 10, 400, 300, Unit.Pixels);
```

#### Sprite

Renders a mesh at the entity's transform position.

```typescript
class Sprite {
  constructor(
    public mesh: Mesh,
    public visible: boolean = true,
    public layer: number = 0
  )
}
```

**Validators:**
- Requires `Transform` component
- Mesh must be defined

**Example:**
```typescript
import { Mesh, Color } from '@orion-ecs/graphics';

const mesh = Mesh.rectangle(-50, -50, 100, 100, Color.Blue);
entity.addComponent(Sprite, mesh, true, 0);
```

### Extension Methods

The plugin extends the engine with `canvas2d` API:

#### setCanvas(canvas: HTMLCanvasElement): void

Sets the canvas element to render to.

```typescript
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
engine.canvas2d.setCanvas(canvas);
```

#### getCanvas(): HTMLCanvasElement | undefined

Gets the current canvas element.

```typescript
const canvas = engine.canvas2d.getCanvas();
if (canvas) {
  console.log(`Canvas size: ${canvas.width}x${canvas.height}`);
}
```

#### getContext(): CanvasRenderingContext2D | undefined

Gets the 2D rendering context.

```typescript
const ctx = engine.canvas2d.getContext();
if (ctx) {
  // Direct canvas API access for custom rendering
  ctx.fillStyle = 'red';
  ctx.fillRect(10, 10, 50, 50);
}
```

#### setClearBeforeRender(clear: boolean): void

Controls whether the canvas is cleared before each render.

```typescript
engine.canvas2d.setClearBeforeRender(true);  // Clear each frame (default)
engine.canvas2d.setClearBeforeRender(false); // Persistent drawing
```

#### setGlobalAlpha(alpha: number): void

Sets global transparency for all rendering (0.0 - 1.0).

```typescript
engine.canvas2d.setGlobalAlpha(0.5);  // 50% transparent
```

#### screenToWorld(screenX: number, screenY: number, camera: Entity): { x: number; y: number } | null

Converts screen coordinates to world coordinates for a specific camera.

```typescript
const mousePos = { x: 150, y: 200 };
const worldPos = engine.canvas2d.screenToWorld(mousePos.x, mousePos.y, camera);
if (worldPos) {
  console.log(`World position: ${worldPos.x}, ${worldPos.y}`);
}
```

## Examples

### Multi-Camera Split Screen

```typescript
// Left camera
const leftCamera = engine.createEntity('LeftCamera');
leftCamera.addComponent(Transform, 200, 300);
leftCamera.addComponent(Camera, 400, 600, '#87CEEB');
leftCamera.addComponent(ScreenElement, 0, 0, 50, 100, Unit.Percentage);

// Right camera
const rightCamera = engine.createEntity('RightCamera');
rightCamera.addComponent(Transform, 600, 300);
rightCamera.addComponent(Camera, 400, 600, '#98D8C8');
rightCamera.addComponent(ScreenElement, 50, 0, 50, 100, Unit.Percentage);
```

### Layer-Based Rendering

```typescript
// Background layer (layer 0)
const background = engine.createEntity('Background');
background.addComponent(Transform, 400, 300);
background.addComponent(Sprite, bgMesh, true, 0);

// Player layer (layer 1)
const player = engine.createEntity('Player');
player.addComponent(Transform, 400, 300);
player.addComponent(Sprite, playerMesh, true, 1);

// UI layer (layer 2)
const healthBar = engine.createEntity('HealthBar');
healthBar.addComponent(Transform, 50, 50);
healthBar.addComponent(Sprite, uiMesh, true, 2);
```

### Camera Following Player

```typescript
// Create follow system
engine.createSystem('CameraFollowSystem', {
  all: [Transform]
}, {
  priority: 950,
  act: () => {
    const player = engine.queryEntities({ tags: ['player'] })[0];
    const camera = engine.queryEntities({ all: [Camera] })[0];

    if (player && camera) {
      const playerTransform = player.getComponent(Transform);
      const cameraTransform = camera.getComponent(Transform);

      // Smooth camera follow
      const lerp = 0.1;
      cameraTransform.x += (playerTransform.x - cameraTransform.x) * lerp;
      cameraTransform.y += (playerTransform.y - cameraTransform.y) * lerp;
    }
  }
}, false);
```

## Performance Considerations

### Culling

The plugin automatically culls sprites outside camera view:

```typescript
// Only sprites within camera bounds are rendered
// No manual culling needed
```

### Layer Optimization

Use layers to control rendering order:

- Lower layer numbers render first
- Group similar sprites on the same layer
- Use layers for depth sorting

### Canvas Operations

```typescript
// Disable clearing for performance (e.g., static backgrounds)
engine.canvas2d.setClearBeforeRender(false);

// Reduce global alpha changes
engine.canvas2d.setGlobalAlpha(1.0);  // Set once if possible
```

### Multi-Camera Performance

Each camera adds overhead:

- Limit active cameras to what's visible
- Use camera.visible = false for inactive cameras (if implemented)
- Share viewports when possible

### Best Practices

1. **Minimize Mesh Complexity**: Use simple meshes for better performance
2. **Batch Similar Sprites**: Group sprites with similar properties
3. **Cache Mesh Instances**: Reuse mesh objects across entities
4. **Optimize Transform Updates**: Only update transforms when needed
5. **Use Appropriate Canvas Size**: Match canvas resolution to display requirements

## Integration with Other Plugins

### With InputManagerPlugin

```typescript
import { InputManagerPlugin } from '@orion-ecs/input-manager';

const engine = new EngineBuilder()
  .use(new Canvas2DRendererPlugin())
  .use(new InputManagerPlugin())
  .build();

// Initialize both
engine.canvas2d.setCanvas(canvas);
engine.input.initialize(canvas);

// Convert mouse position to world coordinates
engine.input.on('click', (e) => {
  const worldPos = engine.canvas2d.screenToWorld(
    e.position.x,
    e.position.y,
    mainCamera
  );
  console.log('Clicked at world position:', worldPos);
});
```

### With InteractionSystemPlugin

Requires both Canvas2D and Input plugins for full interactivity.

```typescript
import { InteractionSystemPlugin } from '@orion-ecs/interaction-system';

const engine = new EngineBuilder()
  .use(new Canvas2DRendererPlugin())
  .use(new InputManagerPlugin())
  .use(new InteractionSystemPlugin())
  .build();
```

## System Priority

The plugin creates two systems:

- **CameraSetupSystem** (priority: 1000): Sets up cameras and clears viewports
- **SpriteRendererSystem** (priority: 900): Renders sprites to all cameras

Create custom rendering systems with priorities between 900-1000 to render between camera setup and sprite rendering.

## Troubleshooting

### Sprites Not Rendering

1. Check that canvas is set: `engine.canvas2d.setCanvas(canvas)`
2. Verify camera has all required components: `Transform`, `Camera`, `ScreenElement`
3. Ensure sprite has `Transform` component
4. Check sprite.visible is true
5. Verify sprite is within camera bounds

### Camera Not Showing

1. Check ScreenElement positioning
2. Verify canvas dimensions match expectations
3. Check backgroundColor is set if you expect to see it

### Performance Issues

1. Reduce number of active cameras
2. Simplify mesh complexity
3. Use sprite layers for organization
4. Enable culling (automatic)
5. Optimize transform updates
