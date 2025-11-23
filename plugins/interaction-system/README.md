# Interaction System Plugin

UI interaction capabilities for Orion ECS, providing clickable, draggable, selectable, and hoverable entities.

## Overview

The Interaction System Plugin provides comprehensive UI interaction features including:

- **Clickable Entities**: Detect and handle click events on entities
- **Draggable Entities**: Drag entities with mouse or touch
- **Selectable Entities**: Single or multi-select with visual feedback
- **Hoverable Entities**: Detect when mouse hovers over entities
- **Interaction Layers**: Control interaction priority and overlap
- **Bounds Detection**: Automatic or manual interaction bounds

**Dependencies:** Requires `InputManagerPlugin` and `Canvas2DRendererPlugin`

## Installation

```typescript
import { EngineBuilder } from 'orion-ecs';
import { Canvas2DRendererPlugin } from '@orion-ecs/canvas2d-renderer';
import { InputManagerPlugin } from '@orion-ecs/input-manager';
import { InteractionSystemPlugin } from '@orion-ecs/interaction-system';

const engine = new EngineBuilder()
  .use(new Canvas2DRendererPlugin())
  .use(new InputManagerPlugin())
  .use(new InteractionSystemPlugin())
  .build();
```

## Quick Start

### Basic Interactive Button

```typescript
import { EngineBuilder } from 'orion-ecs';
import { Canvas2DRendererPlugin, Transform, Sprite } from '@orion-ecs/canvas2d-renderer';
import { InputManagerPlugin } from '@orion-ecs/input-manager';
import {
  InteractionSystemPlugin,
  Clickable,
  Draggable,
  InteractionBounds
} from '@orion-ecs/interaction-system';
import { Mesh, Color, Bounds } from '@orion-ecs/utils';

// Create engine with required plugins
const engine = new EngineBuilder()
  .use(new Canvas2DRendererPlugin())
  .use(new InputManagerPlugin())
  .use(new InteractionSystemPlugin())
  .build();

// Initialize
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
engine.canvas2d.setCanvas(canvas);
engine.input.initialize(canvas);

// Create an interactive button
const button = engine.createEntity('Button');
button.addComponent(Transform, 400, 300);

const mesh = Mesh.rectangle(-50, -25, 100, 50, Color.Blue);
button.addComponent(Sprite, mesh);

// Define interaction bounds
const bounds = Bounds.fromCenter({ x: 400, y: 300 }, 100, 50);
button.addComponent(InteractionBounds, bounds, false);

// Make it clickable
const clickable = button.addComponent(Clickable, true, 0);
clickable.onClick = (entity, position) => {
  console.log('Button clicked at', position);
};

// Make it draggable
const draggable = button.addComponent(Draggable, true, 0, 0);
draggable.onDrag = (entity, delta) => {
  const transform = entity.getComponent(Transform);
  transform.x += delta.x;
  transform.y += delta.y;
};

engine.start();
```

## API Reference

### Components

#### Clickable

Makes an entity respond to click events.

```typescript
class Clickable {
  constructor(
    public enabled: boolean = true,
    public layer: number = 0
  )

  onClick?: (entity: Entity, position: Vector2) => void
}
```

**Example:**
```typescript
const clickable = entity.addComponent(Clickable, true, 5);
clickable.onClick = (entity, pos) => {
  console.log(`Clicked entity ${entity.name} at ${pos.x}, ${pos.y}`);
};

// Temporarily disable
clickable.enabled = false;
```

#### Draggable

Makes an entity draggable with the mouse.

```typescript
class Draggable {
  constructor(
    public enabled: boolean = true,
    public layer: number = 0,
    public dragButton: number = 0  // 0=left, 1=middle, 2=right
  )

  onDragStart?: (entity: Entity, position: Vector2) => void
  onDrag?: (entity: Entity, delta: Vector2) => void
  onDragEnd?: (entity: Entity, position: Vector2) => void
  isDragging: boolean  // Read-only state
}
```

**Example:**
```typescript
const draggable = entity.addComponent(Draggable, true, 0, 0);

draggable.onDragStart = (entity, pos) => {
  console.log('Started dragging at', pos);
};

draggable.onDrag = (entity, delta) => {
  // Default: moves entity transform
  const transform = entity.getComponent(Transform);
  transform.x += delta.x;
  transform.y += delta.y;
};

draggable.onDragEnd = (entity, pos) => {
  console.log('Stopped dragging at', pos);
};

// Check if currently dragging
if (draggable.isDragging) {
  console.log('Entity is being dragged');
}
```

#### Selectable

Makes an entity selectable (single or multi-select).

```typescript
class Selectable {
  constructor(
    public enabled: boolean = true,
    public layer: number = 0
  )

  selected: boolean  // Current selection state
  onSelect?: (entity: Entity) => void
  onDeselect?: (entity: Entity) => void
}
```

**Example:**
```typescript
const selectable = entity.addComponent(Selectable, true, 0);

selectable.onSelect = (entity) => {
  console.log('Selected:', entity.name);
  // Change visual appearance
  const sprite = entity.getComponent(Sprite);
  sprite.mesh.color = Color.Yellow;
};

selectable.onDeselect = (entity) => {
  console.log('Deselected:', entity.name);
  const sprite = entity.getComponent(Sprite);
  sprite.mesh.color = Color.Blue;
};

// Check selection state
if (selectable.selected) {
  console.log('Entity is selected');
}
```

#### Hoverable

Makes an entity respond to mouse hover.

```typescript
class Hoverable {
  constructor(
    public enabled: boolean = true,
    public layer: number = 0
  )

  hovered: boolean  // Current hover state
  onHoverEnter?: (entity: Entity) => void
  onHoverExit?: (entity: Entity) => void
}
```

**Example:**
```typescript
const hoverable = entity.addComponent(Hoverable, true, 0);

hoverable.onHoverEnter = (entity) => {
  console.log('Mouse entered:', entity.name);
  const sprite = entity.getComponent(Sprite);
  sprite.mesh.color = Color.LightBlue;
};

hoverable.onHoverExit = (entity) => {
  console.log('Mouse exited:', entity.name);
  const sprite = entity.getComponent(Sprite);
  sprite.mesh.color = Color.Blue;
};

// Check hover state
if (hoverable.hovered) {
  console.log('Mouse is over entity');
}
```

#### InteractionBounds

Defines the clickable/hoverable area for an entity.

```typescript
class InteractionBounds {
  constructor(
    public bounds: Bounds,
    public autoUpdate: boolean = false
  )
}
```

**Example:**
```typescript
import { Bounds } from '@orion-ecs/utils';

// Manual bounds (won't update when entity moves)
const bounds = new Bounds(350, 275, 100, 50);
entity.addComponent(InteractionBounds, bounds, false);

// Auto-updating bounds (updates with transform)
const autoBounds = Bounds.fromCenter({ x: 0, y: 0 }, 100, 50);
entity.addComponent(InteractionBounds, autoBounds, true);
```

### Extension Methods

The plugin extends the engine with `interaction` API:

#### selectEntity(entity: Entity): void

Programmatically select an entity.

```typescript
const entity = engine.queryEntities({ tags: ['button'] })[0];
engine.interaction.selectEntity(entity);
```

#### deselectEntity(entity: Entity): void

Programmatically deselect an entity.

```typescript
engine.interaction.deselectEntity(entity);
```

#### clearSelection(): void

Deselect all entities.

```typescript
engine.interaction.clearSelection();
```

#### getSelectedEntities(): Entity[]

Get all currently selected entities.

```typescript
const selected = engine.interaction.getSelectedEntities();
console.log(`${selected.length} entities selected`);
selected.forEach(entity => {
  console.log('Selected:', entity.name);
});
```

#### getHoveredEntities(): Entity[]

Get all currently hovered entities.

```typescript
const hovered = engine.interaction.getHoveredEntities();
if (hovered.length > 0) {
  console.log('Hovering over:', hovered[0].name);
}
```

## Examples

### Interactive Menu

```typescript
// Create menu buttons
const buttons = ['New Game', 'Load Game', 'Options', 'Quit'];
buttons.forEach((text, index) => {
  const button = engine.createEntity(text);
  button.addComponent(Transform, 400, 200 + index * 80);

  const mesh = Mesh.rectangle(-100, -30, 200, 60, Color.Blue);
  button.addComponent(Sprite, mesh);

  const bounds = Bounds.fromCenter({ x: 400, y: 200 + index * 80 }, 200, 60);
  button.addComponent(InteractionBounds, bounds);

  const clickable = button.addComponent(Clickable);
  clickable.onClick = () => {
    console.log(`${text} clicked`);
    handleMenuAction(text);
  };

  const hoverable = button.addComponent(Hoverable);
  hoverable.onHoverEnter = (entity) => {
    const sprite = entity.getComponent(Sprite);
    sprite.mesh.color = Color.LightBlue;
  };
  hoverable.onHoverExit = (entity) => {
    const sprite = entity.getComponent(Sprite);
    sprite.mesh.color = Color.Blue;
  };
});
```

### Drag and Drop Inventory

```typescript
// Create inventory items
for (let i = 0; i < 10; i++) {
  const item = engine.createEntity(`Item${i}`);
  item.addComponent(Transform, 100 + (i % 5) * 80, 100 + Math.floor(i / 5) * 80);

  const mesh = Mesh.rectangle(-30, -30, 60, 60, Color.Green);
  item.addComponent(Sprite, mesh);

  const bounds = Bounds.fromCenter({ x: 0, y: 0 }, 60, 60);
  item.addComponent(InteractionBounds, bounds, true);  // Auto-update

  const draggable = item.addComponent(Draggable);
  draggable.onDragStart = (entity) => {
    // Bring to front
    const sprite = entity.getComponent(Sprite);
    sprite.layer = 10;
  };
  draggable.onDragEnd = (entity) => {
    // Snap to grid
    const transform = entity.getComponent(Transform);
    transform.x = Math.round(transform.x / 80) * 80;
    transform.y = Math.round(transform.y / 80) * 80;

    // Reset layer
    const sprite = entity.getComponent(Sprite);
    sprite.layer = 0;
  };
}
```

### Multi-Select with Shift

```typescript
// Custom click handler for multi-select
const entities = engine.queryEntities({ all: [Selectable] });
entities.forEach(entity => {
  const clickable = entity.getComponent(Clickable);
  clickable.onClick = (entity, pos) => {
    // Check if shift is held (you'd get this from input event)
    const shiftHeld = engine.input.isKeyDown('ShiftLeft') ||
                      engine.input.isKeyDown('ShiftRight');

    if (!shiftHeld) {
      // Clear other selections
      engine.interaction.clearSelection();
    }

    // Toggle this entity
    const selectable = entity.getComponent(Selectable);
    if (selectable.selected) {
      engine.interaction.deselectEntity(entity);
    } else {
      engine.interaction.selectEntity(entity);
    }
  };
});
```

### Interaction Layers

```typescript
// Background elements (layer 0)
background.addComponent(Clickable, true, 0);

// Game objects (layer 1)
player.addComponent(Clickable, true, 1);
enemy.addComponent(Clickable, true, 1);

// UI elements (layer 2 - highest priority)
button.addComponent(Clickable, true, 2);

// Higher layer numbers are checked first
// Only the topmost entity receives the click
```

### Context-Sensitive Cursors

```typescript
const hoverable = entity.addComponent(Hoverable);

hoverable.onHoverEnter = (entity) => {
  // Change cursor when hovering
  const canvas = engine.canvas2d.getCanvas();
  if (canvas) {
    canvas.style.cursor = 'pointer';
  }
};

hoverable.onHoverExit = (entity) => {
  // Reset cursor
  const canvas = engine.canvas2d.getCanvas();
  if (canvas) {
    canvas.style.cursor = 'default';
  }
};
```

### Double-Click Detection

```typescript
let lastClickTime = 0;
const DOUBLE_CLICK_DELAY = 300; // ms

const clickable = entity.addComponent(Clickable);
clickable.onClick = (entity, pos) => {
  const now = Date.now();
  if (now - lastClickTime < DOUBLE_CLICK_DELAY) {
    console.log('Double-clicked!');
    handleDoubleClick(entity);
    lastClickTime = 0; // Reset
  } else {
    lastClickTime = now;
  }
};
```

## Performance Considerations

### Interaction Layers

- Use layers to limit entities checked per click
- Higher layers are checked first
- First matching entity stops the search

```typescript
// Efficient: UI on high layer, background on low layer
uiButton.addComponent(Clickable, true, 10);
background.addComponent(Clickable, true, 0);
```

### Bounds Optimization

- Use manual bounds when entities don't move
- Use auto-update only for moving entities
- Keep bounds as simple as possible

```typescript
// Static entities: Manual bounds
staticButton.addComponent(InteractionBounds, bounds, false);

// Moving entities: Auto-update bounds
movingEnemy.addComponent(InteractionBounds, bounds, true);
```

### Selective Interaction

- Only add interaction components where needed
- Disable interaction components when not in use

```typescript
// Disable when not needed
clickable.enabled = false;

// Re-enable when needed
clickable.enabled = true;
```

## Integration with Other Plugins

### Required: Canvas2DRendererPlugin

Transform component used for entity positioning.

```typescript
import { Transform } from '@orion-ecs/canvas2d-renderer';
```

### Required: InputManagerPlugin

Mouse events used for interaction detection.

```typescript
const engine = new EngineBuilder()
  .use(new InputManagerPlugin())
  .use(new InteractionSystemPlugin())
  .build();

engine.input.initialize(canvas);
```

## System Priority

The plugin creates one system:

- **InteractionBoundsUpdateSystem** (priority: 950): Updates auto-updating bounds

Runs before rendering (priority 900) to ensure bounds are current.

## Troubleshooting

### Clicks Not Working

1. Check that InputManagerPlugin is installed first
2. Verify `engine.input.initialize(canvas)` was called
3. Ensure entity has InteractionBounds component
4. Check that clickable.enabled is true
5. Verify bounds contain the click position

### Wrong Entity Receiving Clicks

1. Check interaction layers (higher = priority)
2. Verify bounds don't overlap unintentionally
3. Ensure layer values are correct

### Drag Not Working

1. Verify Draggable component is added
2. Check dragButton matches mouse button used
3. Ensure entity has Transform component
4. Verify bounds are correct

### Auto-Update Bounds Not Working

1. Ensure autoUpdate is true
2. Check that entity has Transform component
3. Verify sprite mesh has bounds

### Selection Not Persisting

1. Check that Selectable component is added
2. Verify onClick toggles selection properly
3. Ensure clearSelection() isn't called unintentionally

## Best Practices

1. **Use Layers**: Organize interaction priority with layers
2. **Manual Bounds**: Use manual bounds for static UI elements
3. **Auto Bounds**: Use auto-update for moving game objects
4. **Disable When Hidden**: Disable interaction for off-screen entities
5. **Visual Feedback**: Always provide visual feedback for interactions
6. **Clean Selection**: Clear selection when appropriate (scene changes, etc.)
7. **Cursor Changes**: Update cursor to indicate interactive elements
