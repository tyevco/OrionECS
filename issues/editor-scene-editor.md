# Scene Editor - Visual Entity & Hierarchy Management

**Milestone:** v1.2.0 - Core Editor Features
**Priority:** Critical
**Labels:** editor, scene, viewport, ui
**Impact:** User Experience, Game Development

## Description

Implement the visual scene editor for managing entities, components, and hierarchies in a graphical interface. This is the core feature that allows users to visually create and edit their game worlds without writing code.

## Goals

- Provide intuitive visual scene editing
- Enable drag-and-drop entity manipulation
- Support transform gizmos for positioning
- Display entity hierarchy as tree view
- Support multi-select and group operations
- Enable undo/redo for all operations
- Provide grid, snapping, and alignment tools

## Dependencies

- Frontend Editor Application
- Pixi.js or Three.js for rendering
- OrionECS runtime integration

## Subtasks

### 1. Hierarchy Panel Implementation
- [ ] Tree view component for entities
- [ ] Drag-and-drop to reparent entities
- [ ] Expand/collapse hierarchy nodes
- [ ] Entity visibility toggles
- [ ] Entity lock toggles (prevent selection)
- [ ] Search/filter entities
- [ ] Multi-select with Ctrl/Shift
- [ ] Context menu (duplicate, delete, etc.)
- [ ] Drag to reorder siblings

### 2. Viewport Rendering
- [ ] Choose rendering engine (Pixi.js 2D / Three.js 3D)
- [ ] Render all entities in scene
- [ ] Camera controls (pan, zoom, rotate)
- [ ] Grid display with configurable size
- [ ] Infinite canvas/world
- [ ] Viewport performance optimization
- [ ] LOD for many entities
- [ ] Frustum culling

### 3. Entity Selection System
- [ ] Click to select entity
- [ ] Multi-select with box selection
- [ ] Multi-select with Ctrl+Click
- [ ] Selection outline/highlight
- [ ] Selection in hierarchy syncs with viewport
- [ ] Selection persistence
- [ ] Select all / deselect all
- [ ] Select by component type
- [ ] Select by tag

### 4. Transform Gizmos
- [ ] **Move Gizmo** - Drag to move entity
- [ ] **Rotate Gizmo** - Drag to rotate entity
- [ ] **Scale Gizmo** - Drag to scale entity
- [ ] Gizmo axis highlighting on hover
- [ ] Local vs World space transforms
- [ ] Gizmo size scales with zoom
- [ ] Snap to grid while dragging
- [ ] Numeric input for precise values

### 5. Grid & Snapping
- [ ] Configurable grid size
- [ ] Grid visibility toggle
- [ ] Snap to grid (positional)
- [ ] Snap to rotation (15°, 45°, 90°)
- [ ] Snap to scale (0.5x, 1x, 2x)
- [ ] Snap to other entities
- [ ] Smart guides (alignment lines)
- [ ] Snap configuration panel

### 6. Entity Creation
- [ ] Create empty entity button
- [ ] Create from prefab menu
- [ ] Create from template
- [ ] Duplicate selected entities (Ctrl+D)
- [ ] Instantiate at mouse position
- [ ] Entity naming dialog
- [ ] Auto-naming for duplicates
- [ ] Drag prefab from panel to scene

### 7. Entity Manipulation
- [ ] Delete entities (Del key)
- [ ] Copy/paste entities (Ctrl+C/V)
- [ ] Cut entities (Ctrl+X)
- [ ] Group entities
- [ ] Ungroup entities
- [ ] Align entities (left, center, right, top, middle, bottom)
- [ ] Distribute entities evenly
- [ ] Flip horizontal/vertical

### 8. Camera Controls
- [ ] Pan with middle mouse or spacebar+drag
- [ ] Zoom with mouse wheel
- [ ] Rotate camera (3D mode)
- [ ] Frame selected (F key)
- [ ] Frame all entities
- [ ] Camera presets (Top, Front, Side, Perspective)
- [ ] Orthographic vs Perspective toggle
- [ ] Camera movement speed settings

### 9. Viewport Tools
- [ ] **Select Tool** (default)
- [ ] **Move Tool** (translate only)
- [ ] **Rotate Tool** (rotate only)
- [ ] **Scale Tool** (scale only)
- [ ] **Hand Tool** (pan viewport)
- [ ] Tool switching with shortcuts (Q, W, E, R)
- [ ] Tool cursor feedback
- [ ] Tool-specific options panel

### 10. Visual Helpers
- [ ] Entity icons/sprites in viewport
- [ ] Component icons (show what components entity has)
- [ ] Bounding boxes
- [ ] Pivot point indicators
- [ ] Hierarchy lines (parent-child connections)
- [ ] Collider visualization
- [ ] Path/waypoint visualization
- [ ] Name labels above entities

### 11. Layers & Visibility
- [ ] Layer system for entities
- [ ] Layer visibility toggles
- [ ] Layer lock toggles
- [ ] Layer reordering
- [ ] Entity z-index/depth sorting
- [ ] Isolate selection (hide others)
- [ ] Show/hide by component type
- [ ] Show/hide by tag

### 12. Undo/Redo System
- [ ] Undo/redo for entity creation/deletion
- [ ] Undo/redo for transform changes
- [ ] Undo/redo for hierarchy changes
- [ ] Undo/redo for component changes
- [ ] Undo/redo for property edits
- [ ] History panel showing actions
- [ ] Configurable history limit
- [ ] Undo/redo shortcuts (Ctrl+Z, Ctrl+Shift+Z)

### 13. Prefab System Integration
- [ ] Create prefab from selection
- [ ] Apply prefab overrides
- [ ] Revert to prefab
- [ ] Break prefab connection
- [ ] Prefab indicator in hierarchy
- [ ] Prefab override visualization
- [ ] Nested prefabs support
- [ ] Prefab auto-update

### 14. Entity Copying & Pasting
- [ ] Copy entity data to clipboard
- [ ] Paste as new entity
- [ ] Paste as child of selection
- [ ] Cross-scene copy/paste
- [ ] Copy multiple entities
- [ ] Preserve hierarchy on paste
- [ ] Preserve component references
- [ ] Handle ID conflicts

### 15. Performance Optimization
- [ ] Virtual scrolling for hierarchy
- [ ] Entity pooling in viewport
- [ ] Frustum culling for rendering
- [ ] Batch rendering for similar entities
- [ ] Lazy loading of entity details
- [ ] Throttle transform updates
- [ ] Optimize re-renders
- [ ] Profile and optimize bottlenecks

### 16. Accessibility
- [ ] Keyboard-only entity creation
- [ ] Keyboard navigation in hierarchy
- [ ] Screen reader support for hierarchy
- [ ] Focus management
- [ ] Keyboard shortcuts documentation
- [ ] High contrast mode support

## Success Criteria

- [ ] Smooth 60 FPS viewport rendering
- [ ] Hierarchy handles 10,000+ entities
- [ ] Gizmos are precise and responsive
- [ ] Undo/redo works reliably for all operations
- [ ] Selection is intuitive and fast
- [ ] Grid and snapping feel natural
- [ ] Can create complex scenes visually
- [ ] Keyboard shortcuts accelerate workflow

## Implementation Notes

**Hierarchy Component:**
```tsx
function HierarchyPanel() {
  const entities = useEditorStore(s => s.entities);
  const selected = useEditorStore(s => s.selectedEntities);

  return (
    <Panel title="Hierarchy">
      <Toolbar>
        <Button onClick={createEmptyEntity}>
          <PlusIcon /> New Entity
        </Button>
        <Input placeholder="Search entities..." />
      </Toolbar>

      <Tree>
        {entities.map(entity => (
          <TreeNode
            key={entity.id}
            entity={entity}
            selected={selected.includes(entity)}
            onSelect={() => selectEntity(entity)}
            onDragStart={() => startDrag(entity)}
            onDrop={(parent) => reparentEntity(entity, parent)}
          />
        ))}
      </Tree>
    </Panel>
  );
}
```

**Viewport Component:**
```tsx
function ViewportPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('select');

  useEffect(() => {
    const app = new PIXI.Application({
      view: canvasRef.current,
      width: 800,
      height: 600
    });

    // Render entities
    const renderEntities = () => {
      entities.forEach(entity => {
        const sprite = renderEntity(entity);
        app.stage.addChild(sprite);
      });
    };

    renderEntities();

    return () => app.destroy();
  }, []);

  return (
    <Panel title="Scene">
      <Toolbar>
        <ToolButton tool="select" active={tool === 'select'} onClick={() => setTool('select')} />
        <ToolButton tool="move" active={tool === 'move'} onClick={() => setTool('move')} />
        <ToolButton tool="rotate" active={tool === 'rotate'} onClick={() => setTool('rotate')} />
        <ToolButton tool="scale" active={tool === 'scale'} onClick={() => setTool('scale')} />
      </Toolbar>

      <canvas ref={canvasRef} />

      <StatusBar>
        <span>Zoom: 100%</span>
        <span>Entities: {entities.length}</span>
      </StatusBar>
    </Panel>
  );
}
```

**Transform Gizmo:**
```typescript
class TransformGizmo {
  private mode: 'translate' | 'rotate' | 'scale' = 'translate';
  private space: 'local' | 'world' = 'world';

  constructor(private entity: Entity) {}

  render(graphics: PIXI.Graphics) {
    switch (this.mode) {
      case 'translate':
        this.renderTranslateGizmo(graphics);
        break;
      case 'rotate':
        this.renderRotateGizmo(graphics);
        break;
      case 'scale':
        this.renderScaleGizmo(graphics);
        break;
    }
  }

  private renderTranslateGizmo(g: PIXI.Graphics) {
    const pos = this.entity.getComponent(Position);

    // X axis (red)
    g.lineStyle(2, 0xFF0000);
    g.moveTo(pos.x, pos.y);
    g.lineTo(pos.x + 50, pos.y);

    // Y axis (green)
    g.lineStyle(2, 0x00FF00);
    g.moveTo(pos.x, pos.y);
    g.lineTo(pos.x, pos.y + 50);

    // Center square
    g.beginFill(0xFFFFFF);
    g.drawRect(pos.x - 5, pos.y - 5, 10, 10);
    g.endFill();
  }

  handleDrag(delta: Vector2) {
    const pos = this.entity.getComponent(Position);

    if (this.snap) {
      delta = this.snapToGrid(delta);
    }

    pos.x += delta.x;
    pos.y += delta.y;

    // Record for undo
    recordTransformChange(this.entity, pos);
  }
}
```

**Undo/Redo System:**
```typescript
interface Action {
  type: string;
  execute: () => void;
  undo: () => void;
}

class UndoRedoManager {
  private history: Action[] = [];
  private currentIndex = -1;
  private maxHistory = 100;

  execute(action: Action) {
    // Remove any actions after current index (if we undid and then made a new action)
    this.history = this.history.slice(0, this.currentIndex + 1);

    // Execute the action
    action.execute();

    // Add to history
    this.history.push(action);
    this.currentIndex++;

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  undo() {
    if (this.currentIndex >= 0) {
      this.history[this.currentIndex].undo();
      this.currentIndex--;
    }
  }

  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      this.history[this.currentIndex].execute();
    }
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }
}

// Example usage
const moveAction: Action = {
  type: 'move-entity',
  execute: () => {
    entity.getComponent(Position).set(newX, newY);
  },
  undo: () => {
    entity.getComponent(Position).set(oldX, oldY);
  }
};

undoManager.execute(moveAction);
```

**Grid & Snapping:**
```typescript
interface GridConfig {
  size: number;
  visible: boolean;
  color: number;
  opacity: number;
}

class GridSystem {
  constructor(private config: GridConfig) {}

  render(graphics: PIXI.Graphics) {
    if (!this.config.visible) return;

    graphics.lineStyle(1, this.config.color, this.config.opacity);

    const bounds = getViewportBounds();
    const gridSize = this.config.size;

    // Draw vertical lines
    for (let x = bounds.left; x < bounds.right; x += gridSize) {
      graphics.moveTo(x, bounds.top);
      graphics.lineTo(x, bounds.bottom);
    }

    // Draw horizontal lines
    for (let y = bounds.top; y < bounds.bottom; y += gridSize) {
      graphics.moveTo(bounds.left, y);
      graphics.lineTo(bounds.right, y);
    }
  }

  snapToGrid(value: number): number {
    return Math.round(value / this.config.size) * this.config.size;
  }

  snapPosition(pos: Vector2): Vector2 {
    return {
      x: this.snapToGrid(pos.x),
      y: this.snapToGrid(pos.y)
    };
  }
}
```

## Related Issues

- Frontend Editor Application (new issue)
- Inspector & Property Editors (new issue)
- Asset Management System (new issue)
- #78 - Visual Scene Editor (GitHub issue this expands on)

## References

- [Unity Scene View](https://docs.unity3d.com/Manual/UsingTheSceneView.html)
- [Godot 2D Editor](https://docs.godotengine.org/en/stable/tutorials/2d/2d_transforms.html)
- [Pixi.js](https://pixijs.com/)
- [Three.js](https://threejs.org/)
- [TransformControls](https://threejs.org/docs/#examples/en/controls/TransformControls)
