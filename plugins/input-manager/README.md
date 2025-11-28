# Input Manager Plugin

Comprehensive input handling for Orion ECS, providing mouse and keyboard event management with state tracking.

## Overview

The Input Manager Plugin provides complete input handling features including:

- **Mouse Events**: Click, move, down, up, and drag detection
- **Keyboard Events**: Key down, up, and state tracking
- **Event System**: Subscribe to input events with callbacks
- **State Queries**: Check current input state at any time
- **Drag Detection**: Automatic drag threshold and event emission
- **Frame-Based Input**: Per-frame pressed/released tracking

## Installation

```typescript
import { EngineBuilder } from '@orion-ecs/core';
import { InputManagerPlugin } from '@orion-ecs/input-manager';

const engine = new EngineBuilder()
  .use(new InputManagerPlugin())
  .build();
```

## Quick Start

### Basic Setup

```typescript
import { EngineBuilder } from '@orion-ecs/core';
import { InputManagerPlugin, MouseButton } from '@orion-ecs/input-manager';

// Create engine with plugin
const engine = new EngineBuilder()
  .use(new InputManagerPlugin())
  .build();

// Initialize with target element (usually canvas)
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
engine.input.initialize(canvas);

// Subscribe to events
engine.input.on('click', (e) => {
  console.log('Clicked at', e.position.x, e.position.y);
  console.log('Button:', e.button); // 0=left, 1=middle, 2=right
});

engine.input.on('keydown', (e) => {
  console.log('Key pressed:', e.key, e.code);
});

// Query input state in systems
engine.createSystem('PlayerControlSystem', {}, {
  act: () => {
    if (engine.input.isKeyDown('ArrowLeft')) {
      // Move player left
    }
    if (engine.input.wasKeyPressed('Space')) {
      // Jump (only once per press)
    }
  }
}, false);

engine.start();
```

## API Reference

### Initialization

#### initialize(element: HTMLElement): void

Initializes the input manager with a target element for event listening.

```typescript
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
engine.input.initialize(canvas);
```

**Note:** Call this before using any input features.

### Mouse Events

#### on(event: string, callback: Function): () => void

Subscribe to mouse or keyboard events. Returns an unsubscribe function.

**Mouse Events:**
- `'mousemove'` - Mouse moved
- `'mousedown'` - Mouse button pressed
- `'mouseup'` - Mouse button released
- `'click'` - Mouse clicked
- `'dragstart'` - Drag started (after 3px threshold)
- `'drag'` - Dragging in progress
- `'dragend'` - Drag ended

```typescript
// Mouse move
const unsubscribe = engine.input.on('mousemove', (e: MouseEventData) => {
  console.log(`Mouse at ${e.position.x}, ${e.position.y}`);
});

// Mouse click
engine.input.on('click', (e: MouseEventData) => {
  if (e.button === MouseButton.Left) {
    console.log('Left click at', e.position);
  }
  if (e.shiftKey) {
    console.log('Shift was held');
  }
});

// Drag events
engine.input.on('dragstart', (e: DragEventData) => {
  console.log('Drag started at', e.startPosition);
});

engine.input.on('drag', (e: DragEventData) => {
  console.log('Dragging, delta:', e.deltaPosition);
});

engine.input.on('dragend', (e: DragEventData) => {
  console.log('Drag ended at', e.currentPosition);
});

// Unsubscribe when done
unsubscribe();
```

### Keyboard Events

**Keyboard Events:**
- `'keydown'` - Key pressed
- `'keyup'` - Key released

```typescript
engine.input.on('keydown', (e: KeyboardEventData) => {
  console.log(`Key: ${e.key}, Code: ${e.code}`);
  if (e.ctrlKey && e.key === 's') {
    console.log('Ctrl+S pressed');
  }
});

engine.input.on('keyup', (e: KeyboardEventData) => {
  console.log(`Key released: ${e.key}`);
});
```

### Mouse State Queries

#### getMousePosition(): Vector2 | null

Gets the current mouse position relative to the element.

```typescript
const pos = engine.input.getMousePosition();
if (pos) {
  console.log(`Mouse at ${pos.x}, ${pos.y}`);
}
```

#### isMouseButtonDown(button: MouseButton): boolean

Checks if a mouse button is currently pressed.

```typescript
if (engine.input.isMouseButtonDown(MouseButton.Left)) {
  console.log('Left mouse button is down');
}
```

#### getIsDragging(): boolean

Checks if currently dragging.

```typescript
if (engine.input.getIsDragging()) {
  console.log('Currently dragging');
}
```

#### getDragState(): DragEventData | null

Gets current drag state including start position, current position, and delta.

```typescript
const dragState = engine.input.getDragState();
if (dragState) {
  console.log('Drag delta:', dragState.deltaPosition);
  console.log('Dragging from', dragState.startPosition);
  console.log('Currently at', dragState.currentPosition);
}
```

### Keyboard State Queries

#### isKeyDown(code: string): boolean

Checks if a key is currently held down.

```typescript
if (engine.input.isKeyDown('ArrowUp')) {
  // Move up while key is held
}
```

**Note:** Use key codes like `'ArrowUp'`, `'Space'`, `'KeyW'`, not key values.

#### wasKeyPressed(code: string): boolean

Checks if a key was pressed this frame (only true once per press).

```typescript
if (engine.input.wasKeyPressed('Space')) {
  // Jump (only triggers once per key press)
}
```

#### wasKeyReleased(code: string): boolean

Checks if a key was released this frame.

```typescript
if (engine.input.wasKeyReleased('KeyF')) {
  console.log('F key was just released');
}
```

#### getPressedKeys(): string[]

Gets all currently pressed keys.

```typescript
const keys = engine.input.getPressedKeys();
console.log('Pressed keys:', keys); // ['KeyW', 'Space', 'ShiftLeft']
```

### Utility

#### cleanup(): void

Removes all event listeners and cleans up state. Called automatically on plugin uninstall.

```typescript
engine.input.cleanup();
```

## Data Types

### MouseButton

```typescript
enum MouseButton {
  Left = 0,
  Middle = 1,
  Right = 2
}
```

### MouseEventData

```typescript
interface MouseEventData {
  position: Vector2;
  button: MouseButton;
  buttons: number;           // Bitfield of pressed buttons
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}
```

### DragEventData

```typescript
interface DragEventData {
  startPosition: Vector2;
  currentPosition: Vector2;
  deltaPosition: Vector2;     // Current - start
  button: MouseButton;
}
```

### KeyboardEventData

```typescript
interface KeyboardEventData {
  key: string;                // 'a', 'Enter', ' '
  code: string;               // 'KeyA', 'Enter', 'Space'
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;            // True if key is auto-repeating
}
```

## Examples

### Player Movement System

```typescript
engine.createSystem('PlayerMovementSystem', {
  all: [Position, Velocity]
}, {
  act: (entity, position, velocity) => {
    const speed = 200;
    velocity.x = 0;
    velocity.y = 0;

    // WASD movement
    if (engine.input.isKeyDown('KeyW')) velocity.y = -speed;
    if (engine.input.isKeyDown('KeyS')) velocity.y = speed;
    if (engine.input.isKeyDown('KeyA')) velocity.x = -speed;
    if (engine.input.isKeyDown('KeyD')) velocity.x = speed;

    // Arrow keys alternative
    if (engine.input.isKeyDown('ArrowUp')) velocity.y = -speed;
    if (engine.input.isKeyDown('ArrowDown')) velocity.y = speed;
    if (engine.input.isKeyDown('ArrowLeft')) velocity.x = -speed;
    if (engine.input.isKeyDown('ArrowRight')) velocity.x = speed;

    // Jump on space (once per press)
    if (engine.input.wasKeyPressed('Space')) {
      velocity.y = -400;
    }
  }
}, false);
```

### Mouse Camera Control

```typescript
let lastMousePos = null;

engine.input.on('mousedown', (e) => {
  if (e.button === MouseButton.Middle) {
    lastMousePos = e.position.clone();
  }
});

engine.input.on('mousemove', (e) => {
  if (engine.input.isMouseButtonDown(MouseButton.Middle) && lastMousePos) {
    const camera = engine.queryEntities({ all: [Camera] })[0];
    const cameraTransform = camera.getComponent(Transform);

    const delta = {
      x: e.position.x - lastMousePos.x,
      y: e.position.y - lastMousePos.y
    };

    cameraTransform.x -= delta.x;
    cameraTransform.y -= delta.y;

    lastMousePos = e.position.clone();
  }
});

engine.input.on('mouseup', (e) => {
  if (e.button === MouseButton.Middle) {
    lastMousePos = null;
  }
});
```

### Context Menu on Right Click

```typescript
engine.input.on('click', (e) => {
  if (e.button === MouseButton.Right) {
    showContextMenu(e.position.x, e.position.y);
  }
});
```

### Keyboard Shortcuts

```typescript
engine.input.on('keydown', (e) => {
  // Save: Ctrl+S
  if (e.ctrlKey && e.code === 'KeyS') {
    e.preventDefault?.();
    saveGame();
  }

  // Load: Ctrl+L
  if (e.ctrlKey && e.code === 'KeyL') {
    loadGame();
  }

  // Fullscreen: F11
  if (e.code === 'F11') {
    toggleFullscreen();
  }
});
```

### Drag and Drop

```typescript
let draggedEntity = null;

engine.input.on('dragstart', (e) => {
  // Find entity at cursor
  const entities = engine.queryEntities({ all: [Transform, Draggable] });
  draggedEntity = entities.find(ent => {
    const transform = ent.getComponent(Transform);
    const distance = Math.hypot(
      transform.x - e.startPosition.x,
      transform.y - e.startPosition.y
    );
    return distance < 50; // Click radius
  });
});

engine.input.on('drag', (e) => {
  if (draggedEntity) {
    const transform = draggedEntity.getComponent(Transform);
    transform.x += e.deltaPosition.x;
    transform.y += e.deltaPosition.y;
  }
});

engine.input.on('dragend', (e) => {
  draggedEntity = null;
});
```

## Performance Considerations

### Event Subscription

- Unsubscribe from events when no longer needed
- Avoid creating multiple subscriptions for the same event
- Use state queries instead of events for continuous checks

```typescript
// Good: Single subscription
const unsubscribe = engine.input.on('click', handleClick);
// Later: unsubscribe();

// Bad: Multiple subscriptions for same purpose
engine.input.on('click', handleClick1);
engine.input.on('click', handleClick2);
engine.input.on('click', handleClick3);
```

### State Queries vs Events

```typescript
// For one-time actions: Use events
engine.input.on('click', () => {
  fireWeapon();
});

// For continuous checks: Use state queries in systems
engine.createSystem('MovementSystem', {}, {
  act: () => {
    // More efficient than subscribing to keydown events
    if (engine.input.isKeyDown('KeyW')) {
      moveForward();
    }
  }
}, false);
```

### Frame State Management

The plugin automatically clears frame-based state:
- `wasKeyPressed()` - Cleared at end of frame
- `wasKeyReleased()` - Cleared at end of frame

No manual cleanup needed.

## Integration with Other Plugins

### With Canvas2DRendererPlugin

```typescript
import { Canvas2DRendererPlugin } from '@orion-ecs/canvas2d-renderer';

const engine = new EngineBuilder()
  .use(new Canvas2DRendererPlugin())
  .use(new InputManagerPlugin())
  .build();

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
engine.canvas2d.setCanvas(canvas);
engine.input.initialize(canvas);

// Convert mouse to world coordinates
engine.input.on('click', (e) => {
  const camera = engine.queryEntities({ all: [Camera] })[0];
  const worldPos = engine.canvas2d.screenToWorld(
    e.position.x,
    e.position.y,
    camera
  );
  console.log('Clicked world position:', worldPos);
});
```

### With InteractionSystemPlugin

The Interaction System Plugin depends on Input Manager for click/drag/hover detection.

```typescript
import { InteractionSystemPlugin } from '@orion-ecs/interaction-system';

const engine = new EngineBuilder()
  .use(new InputManagerPlugin())
  .use(new InteractionSystemPlugin())
  .build();

engine.input.initialize(canvas);
```

## System Priority

The plugin creates one system:

- **InputFrameCleanupSystem** (priority: -1000): Clears frame-based input state

Runs last (lowest priority) to ensure frame state is available throughout the frame.

## Troubleshooting

### Events Not Firing

1. Check that `initialize()` was called with correct element
2. Verify element is in the DOM and visible
3. Check element has focus for keyboard events
4. Ensure preventDefault isn't blocking events

### Mouse Position Incorrect

1. Verify correct element passed to `initialize()`
2. Check for CSS transforms on element
3. Account for canvas scaling

### Keyboard Not Working

1. Ensure window/element has focus
2. Check for browser keyboard shortcuts conflicting
3. Use key codes (`'KeyW'`) not key values (`'w'`)

### Drag Not Triggering

1. Check drag threshold (3px minimum movement)
2. Verify mouse down event fires first
3. Check for conflicting mouse handlers

## Best Practices

1. **Initialize Once**: Call `initialize()` once during setup
2. **Unsubscribe**: Clean up event subscriptions when done
3. **Use State Queries**: Prefer state queries over events for continuous input
4. **Frame-Based Input**: Use `wasKeyPressed()` for single-frame actions
5. **Key Codes**: Use key codes, not key values, for consistency
6. **Context Menu**: Right-click shows context menu by default (prevented by plugin)
