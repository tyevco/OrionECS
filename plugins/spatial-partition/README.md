# Spatial Partition Plugin

Efficient spatial data structures for Orion ECS, providing grid-based partitioning for fast proximity queries in large worlds.

## Overview

The Spatial Partition Plugin provides optimized spatial queries for games with many entities:

- **Grid-Based Partitioning**: Divide world into cells for fast lookups
- **Radius Queries**: Find all entities within a radius of a point
- **Rectangle Queries**: Find all entities within a rectangular area
- **Automatic Updates**: Entities automatically move between cells
- **Performance Statistics**: Monitor spatial partition efficiency
- **Configurable Grid**: Adjust cell size for different scales

**Use Cases:**
- Collision detection optimization (find nearby entities only)
- AI perception (what can this entity "see"?)
- Rendering culling (only render visible entities)
- Network relevance (send updates for nearby entities)
- Effect radius (explosion damage, area of effect)

## Installation

```typescript
import { EngineBuilder } from 'orion-ecs';
import { SpatialPartitionPlugin } from '@orion-ecs/spatial-partition';

const engine = new EngineBuilder()
  .use(new SpatialPartitionPlugin())
  .build();
```

## Quick Start

### Basic Spatial Queries

```typescript
import { EngineBuilder } from 'orion-ecs';
import { SpatialPartitionPlugin, SpatialPosition } from '@orion-ecs/spatial-partition';

// Create engine with plugin
const engine = new EngineBuilder()
  .use(new SpatialPartitionPlugin())
  .build();

// Configure spatial partition
engine.spatial.createPartition({
  type: 'grid',
  cellSize: 100,  // 100x100 pixel cells
  bounds: { x: 0, y: 0, width: 5000, height: 5000 }
});

// Create entities with spatial positions
for (let i = 0; i < 1000; i++) {
  const entity = engine.createEntity(`Entity${i}`);
  const x = Math.random() * 5000;
  const y = Math.random() * 5000;
  entity.addComponent(SpatialPosition, x, y);
}

// Query entities near a point
const playerPos = { x: 500, y: 500 };
const nearby = engine.spatial.queryRadius(playerPos, 200);
console.log(`Found ${nearby.length} entities within 200 units`);

// Query entities in a rectangle
const inArea = engine.spatial.queryRect(0, 0, 500, 500);
console.log(`Found ${inArea.length} entities in top-left quadrant`);

// Get statistics
const stats = engine.spatial.getStats();
console.log('Spatial partition stats:', stats);
```

## API Reference

### Components

#### SpatialPosition

Defines an entity's position in the spatial partition grid.

```typescript
class SpatialPosition {
  constructor(
    public x: number = 0,
    public y: number = 0
  )
}
```

**Note:** Entities with this component are automatically tracked in the spatial grid.

**Example:**
```typescript
const position = entity.addComponent(SpatialPosition, 100, 200);
console.log(`Entity at ${position.x}, ${position.y}`);

// Moving the entity automatically updates the spatial grid
position.x = 150;
position.y = 250;
```

#### SpatialCell

Internal component tracking which grid cell an entity occupies.

```typescript
class SpatialCell {
  constructor(
    public gridX: number = 0,
    public gridY: number = 0
  )
}
```

**Note:** Automatically managed by the plugin. Don't modify directly.

### Configuration

#### createPartition(options: SpatialPartitionOptions): void

Creates or reconfigures the spatial partition.

```typescript
interface SpatialPartitionOptions {
  type: 'grid';
  cellSize: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

**Example:**
```typescript
// Small game world
engine.spatial.createPartition({
  type: 'grid',
  cellSize: 50,
  bounds: { x: 0, y: 0, width: 2000, height: 2000 }
});

// Large open world
engine.spatial.createPartition({
  type: 'grid',
  cellSize: 200,
  bounds: { x: -10000, y: -10000, width: 20000, height: 20000 }
});

// Reconfigure at runtime (clears existing partition)
engine.spatial.createPartition({
  type: 'grid',
  cellSize: 100,
  bounds: { x: 0, y: 0, width: 5000, height: 5000 }
});
```

**Choosing Cell Size:**
- Too small: Many empty cells, overhead
- Too large: Less benefit from partitioning
- Rule of thumb: Cell size ≈ typical query radius × 2
- For collision: Cell size ≈ largest entity diameter × 2

### Queries

#### queryRadius(position: { x: number; y: number }, radius: number): Entity[]

Finds all entities within a circular radius of a point.

```typescript
// Find entities near player
const playerPos = { x: 500, y: 300 };
const nearby = engine.spatial.queryRadius(playerPos, 150);

// Process nearby entities
nearby.forEach(entity => {
  const distance = calculateDistance(playerPos, entity);
  if (distance < 150) {
    // Actually within radius (grid gives approximate results)
    handleNearbyEntity(entity);
  }
});
```

**Performance:** O(k) where k = entities in nearby cells (much better than O(n) for all entities)

#### queryRect(x: number, y: number, width: number, height: number): Entity[]

Finds all entities within a rectangular area.

```typescript
// Find entities in camera view
const cameraX = 0;
const cameraY = 0;
const viewWidth = 800;
const viewHeight = 600;

const visible = engine.spatial.queryRect(
  cameraX,
  cameraY,
  viewWidth,
  viewHeight
);

console.log(`${visible.length} entities visible`);
```

**Performance:** O(k) where k = entities in covered cells

### Statistics

#### getStats(): SpatialStats

Gets statistics about the spatial partition.

```typescript
interface SpatialStats {
  totalCells: number;
  occupiedCells: number;
  totalEntities: number;
  averageEntitiesPerCell: number;
}
```

**Example:**
```typescript
const stats = engine.spatial.getStats();
console.log(`Total cells: ${stats.totalCells}`);
console.log(`Occupied cells: ${stats.occupiedCells}`);
console.log(`Total entities: ${stats.totalEntities}`);
console.log(`Avg entities/cell: ${stats.averageEntitiesPerCell.toFixed(2)}`);

// Monitor efficiency
if (stats.averageEntitiesPerCell > 10) {
  console.warn('Cell size too large - consider smaller cells');
}
if (stats.occupiedCells / stats.totalCells < 0.1) {
  console.warn('Too many empty cells - consider larger cells or smaller bounds');
}
```

## Examples

### Optimized Collision Detection

```typescript
// Without spatial partition: O(n²)
// With spatial partition: O(n × k) where k << n

engine.createSystem('SpatialCollisionSystem', {
  all: [SpatialPosition, Collider]
}, {
  priority: 90,
  act: (entity, position, collider) => {
    // Query only nearby entities
    const nearby = engine.spatial.queryRadius(position, collider.radius * 2);

    nearby.forEach(other => {
      if (other === entity) return;

      const otherPos = other.getComponent(SpatialPosition);
      const otherCol = other.getComponent(Collider);
      if (!otherPos || !otherCol) return;

      // Check actual collision
      const dx = position.x - otherPos.x;
      const dy = position.y - otherPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < collider.radius + otherCol.radius) {
        handleCollision(entity, other);
      }
    });
  }
}, true);
```

### AI Vision System

```typescript
engine.createSystem('AIVisionSystem', {
  all: [SpatialPosition, AIVision]
}, {
  act: (entity, position, vision) => {
    // Find entities in vision radius
    const visible = engine.spatial.queryRadius(position, vision.range);

    // Filter by vision cone
    const inVisionCone = visible.filter(other => {
      const otherPos = other.getComponent(SpatialPosition);
      if (!otherPos) return false;

      const dx = otherPos.x - position.x;
      const dy = otherPos.y - position.y;
      const angle = Math.atan2(dy, dx);

      // Check if within vision cone angle
      const angleDiff = Math.abs(angle - vision.facing);
      return angleDiff < vision.fov / 2;
    });

    // React to visible entities
    vision.visibleEntities = inVisionCone;
    if (inVisionCone.some(e => e.hasTag('player'))) {
      alertAI(entity);
    }
  }
}, false);
```

### Camera Culling

```typescript
engine.createSystem('CameraCullingSystem', {
  all: [Camera, Transform]
}, {
  priority: 950,
  act: (camera, cameraComp, transform) => {
    // Query entities in camera view
    const visible = engine.spatial.queryRect(
      transform.x - cameraComp.width / 2,
      transform.y - cameraComp.height / 2,
      cameraComp.width,
      cameraComp.height
    );

    // Enable rendering for visible entities only
    const allSprites = engine.queryEntities({ all: [Sprite] });
    allSprites.forEach(entity => {
      const sprite = entity.getComponent(Sprite);
      sprite.visible = visible.includes(entity);
    });
  }
}, false);
```

### Area of Effect

```typescript
function createExplosion(x, y, radius, damage) {
  // Find all entities in blast radius
  const affected = engine.spatial.queryRadius({ x, y }, radius);

  affected.forEach(entity => {
    const position = entity.getComponent(SpatialPosition);
    if (!position) return;

    // Calculate actual distance
    const dx = position.x - x;
    const dy = position.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= radius) {
      // Apply damage with falloff
      const falloff = 1 - (distance / radius);
      const actualDamage = damage * falloff;

      const health = entity.getComponent(Health);
      if (health) {
        health.current -= actualDamage;
      }

      // Apply knockback
      const rigidBody = entity.getComponent(RigidBody);
      if (rigidBody) {
        const knockback = 500 * falloff;
        const angle = Math.atan2(dy, dx);
        engine.physics.applyImpulse(
          rigidBody,
          Math.cos(angle) * knockback,
          Math.sin(angle) * knockback
        );
      }
    }
  });
}

// Trigger explosion
createExplosion(500, 300, 200, 100);
```

### Network Relevance

```typescript
// Multiplayer: Only send updates for nearby entities
function getRelevantEntitiesForPlayer(playerId) {
  const player = getPlayerEntity(playerId);
  const position = player.getComponent(SpatialPosition);

  // Get entities within network relevance radius
  const relevant = engine.spatial.queryRadius(position, 1000);

  // Filter by network priority
  return relevant.filter(entity => {
    // Always send important entities
    if (entity.hasTag('important')) return true;

    // Send entities player can see
    const sprite = entity.getComponent(Sprite);
    if (sprite && sprite.visible) return true;

    // Send entities with physics
    if (entity.hasComponent(RigidBody)) return true;

    return false;
  });
}

// Send updates only for relevant entities
setInterval(() => {
  players.forEach(player => {
    const relevant = getRelevantEntitiesForPlayer(player.id);
    sendNetworkUpdate(player.id, relevant);
  });
}, 100); // 10 updates per second
```

### Dynamic Cell Visualization

```typescript
// Debug: Visualize spatial partition grid
engine.createSystem('SpatialDebugRenderSystem', {}, {
  priority: 800,
  after: () => {
    const ctx = engine.canvas2d.getContext();
    if (!ctx) return;

    const stats = engine.spatial.getStats();
    const partition = engine.spatial; // Access internal grid

    // Draw grid lines
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.lineWidth = 1;

    for (let x = 0; x < 5000; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 5000);
      ctx.stroke();
    }
    for (let y = 0; y < 5000; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(5000, y);
      ctx.stroke();
    }

    // Draw entity counts per cell
    ctx.fillStyle = 'white';
    ctx.font = '10px monospace';
    // ... (implementation details)
  }
}, false);
```

## Performance Considerations

### Cell Size Selection

```typescript
// Too small (lots of empty cells, memory overhead)
engine.spatial.createPartition({
  type: 'grid',
  cellSize: 10,  // ❌ Too small
  bounds: { x: 0, y: 0, width: 5000, height: 5000 }
});

// Too large (defeats purpose of partitioning)
engine.spatial.createPartition({
  type: 'grid',
  cellSize: 2500,  // ❌ Too large
  bounds: { x: 0, y: 0, width: 5000, height: 5000 }
});

// Optimal (2-4× typical query radius)
engine.spatial.createPartition({
  type: 'grid',
  cellSize: 100,  // ✓ Good for radius ~25-50
  bounds: { x: 0, y: 0, width: 5000, height: 5000 }
});
```

### Query Optimization

```typescript
// Bad: Query every frame for every entity
engine.createSystem('BadSystem', {
  all: [SpatialPosition]
}, {
  act: (entity, position) => {
    const nearby = engine.spatial.queryRadius(position, 100);
    // ... O(n) queries per frame
  }
}, false);

// Good: Query only when needed
engine.createSystem('GoodSystem', {
  all: [SpatialPosition]
}, {
  act: (entity, position) => {
    // Only query for entities that need it
    if (entity.hasComponent(AIVision)) {
      const nearby = engine.spatial.queryRadius(position, 100);
      // ... O(k) queries per frame, where k << n
    }
  }
}, false);

// Better: Cache results, update periodically
let cachedQueries = new Map();
let lastQueryTime = 0;

engine.createSystem('CachedQuerySystem', {
  all: [SpatialPosition, AIVision]
}, {
  act: (entity, position) => {
    const now = Date.now();
    if (now - lastQueryTime > 200) { // Update every 200ms
      cachedQueries.set(entity, engine.spatial.queryRadius(position, 100));
      lastQueryTime = now;
    }

    const nearby = cachedQueries.get(entity) || [];
    // Use cached results
  }
}, false);
```

### Memory Optimization

Monitor spatial partition efficiency:

```typescript
function monitorSpatialPartition() {
  const stats = engine.spatial.getStats();

  const occupancyRatio = stats.occupiedCells / stats.totalCells;
  const avgEntities = stats.averageEntitiesPerCell;

  console.log(`Occupancy: ${(occupancyRatio * 100).toFixed(1)}%`);
  console.log(`Avg entities/cell: ${avgEntities.toFixed(2)}`);

  if (occupancyRatio < 0.1) {
    console.warn('Low occupancy - consider larger cells or smaller bounds');
  }
  if (avgEntities > 20) {
    console.warn('High entity density - consider smaller cells');
  }
}

setInterval(monitorSpatialPartition, 5000);
```

### Best Practices

1. **Choose Appropriate Cell Size**: 2-4× typical query radius
2. **Set Tight Bounds**: Don't make world bounds larger than needed
3. **Cache Queries**: Don't query every frame if results don't change often
4. **Filter Results**: Spatial queries return approximations, verify actual distance
5. **Monitor Stats**: Use `getStats()` to optimize configuration

## Integration with Other Plugins

### With PhysicsPlugin

```typescript
import { PhysicsPlugin, Position, RigidBody } from '@orion-ecs/physics';
import { SpatialPartitionPlugin, SpatialPosition } from '@orion-ecs/spatial-partition';

const engine = new EngineBuilder()
  .use(new PhysicsPlugin())
  .use(new SpatialPartitionPlugin())
  .build();

// Sync physics position to spatial position
engine.createSystem('PhysicsSpatialSyncSystem', {
  all: [Position, SpatialPosition]
}, {
  priority: 95,
  act: (entity, physicsPos, spatialPos) => {
    spatialPos.x = physicsPos.x;
    spatialPos.y = physicsPos.y;
  }
}, true);

// Use spatial queries for collision
engine.createSystem('SpatialCollisionSystem', {
  all: [SpatialPosition, Collider]
}, {
  priority: 85,
  act: (entity, position, collider) => {
    const nearby = engine.spatial.queryRadius(position, collider.radius * 2);
    nearby.forEach(other => checkCollision(entity, other));
  }
}, true);
```

### With Canvas2DRendererPlugin

```typescript
import { Canvas2DRendererPlugin, Transform, Sprite } from '@orion-ecs/canvas2d-renderer';

// Sync transform to spatial position
engine.createSystem('TransformSpatialSyncSystem', {
  all: [Transform, SpatialPosition]
}, {
  priority: 950,
  act: (entity, transform, spatialPos) => {
    spatialPos.x = transform.x;
    spatialPos.y = transform.y;
  }
}, false);
```

## System Priority

The plugin creates one system:

- **SpatialIndexSystem** (priority: 200): Updates spatial grid as entities move

Runs early to ensure spatial data is current for other systems.

## Troubleshooting

### Queries Returning No Results

1. Check partition bounds contain query position
2. Verify entities have SpatialPosition component
3. Ensure createPartition() was called
4. Check cell size isn't too large

### Queries Returning Wrong Results

1. Remember queries return approximations (cells, not exact)
2. Verify actual distance after query
3. Check for position sync issues (physics vs spatial)
4. Ensure positions are being updated

### Performance Not Improving

1. Check cell size (too large or too small)
2. Verify you're using queries efficiently
3. Monitor with getStats() for issues
4. Ensure many entities in same area

### Memory Issues

1. Reduce world bounds
2. Increase cell size
3. Check for entity leaks (not being removed)
4. Monitor with getStats()

## Advanced Topics

### Custom Spatial Structures

The current implementation uses a grid. Future versions may support:

- Quadtree (adaptive subdivision)
- R-tree (hierarchical bounding boxes)
- Hash spatial (infinite worlds)

### Dynamic Reconfiguration

```typescript
// Start with small world
engine.spatial.createPartition({
  type: 'grid',
  cellSize: 100,
  bounds: { x: 0, y: 0, width: 2000, height: 2000 }
});

// Expand world later (warning: clears existing data)
function expandWorld() {
  engine.spatial.createPartition({
    type: 'grid',
    cellSize: 100,
    bounds: { x: -5000, y: -5000, width: 10000, height: 10000 }
  });

  // Re-index all entities
  const entities = engine.queryEntities({ all: [SpatialPosition] });
  entities.forEach(entity => {
    const pos = entity.getComponent(SpatialPosition);
    // Position update triggers re-index automatically
    pos.x = pos.x;
  });
}
```

### Hierarchical Queries

```typescript
// Broad phase: Coarse spatial query
const broadPhase = engine.spatial.queryRadius(position, 500);

// Narrow phase: Refined check
const narrowPhase = broadPhase.filter(entity => {
  const pos = entity.getComponent(SpatialPosition);
  const dx = pos.x - position.x;
  const dy = pos.y - position.y;
  return Math.sqrt(dx * dx + dy * dy) < 500;
});

// Exact test: Final validation
const exact = narrowPhase.filter(entity => {
  return preciseCollisionTest(position, entity);
});
```
