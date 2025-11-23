# Debug Visualizer Plugin

Comprehensive debugging and visualization tools for Orion ECS, providing entity hierarchy inspection, component statistics, and system performance analysis.

## Overview

The Debug Visualizer Plugin provides essential debugging tools including:

- **Entity Hierarchy Visualization**: ASCII tree view of parent/child relationships
- **Component Statistics**: Usage counts and percentages for all components
- **System Timeline**: Execution timeline with Chrome DevTools trace export
- **Query Analysis**: Performance analysis and optimization suggestions
- **Debug Summary**: Comprehensive engine state overview

**Use Cases:**
- Development debugging and inspection
- Performance analysis and optimization
- Understanding complex entity hierarchies
- Identifying component usage patterns
- System execution profiling

## Installation

```typescript
import { EngineBuilder } from 'orion-ecs';
import { DebugVisualizerPlugin } from '@orion-ecs/debug-visualizer';

const engine = new EngineBuilder()
  .withDebugMode(true)
  .use(new DebugVisualizerPlugin())
  .build();
```

## Quick Start

### Basic Debug Output

```typescript
import { EngineBuilder } from 'orion-ecs';
import { DebugVisualizerPlugin } from '@orion-ecs/debug-visualizer';

// Create engine with plugin
const engine = new EngineBuilder()
  .withDebugMode(true)
  .use(new DebugVisualizerPlugin())
  .build();

// Create some entities for testing
const player = engine.createEntity('Player');
player.addTag('player');

const weapon = engine.createEntity('Sword');
weapon.setParent(player);

const enemy = engine.createEntity('Goblin');
enemy.addTag('enemy');

// Print entity hierarchy
engine.debug.printHierarchy();

// Print component statistics
engine.debug.printComponentStats();

// Print comprehensive summary
engine.debug.printDebugSummary();

// Analyze a query
const query = engine.createQuery({ all: [Position, Velocity] });
engine.debug.analyzeQuery(query);
```

**Output:**
```
Entity Hierarchy:
└─ Player [player]
    └─ Sword
└─ Goblin [enemy]

Component Statistics:
──────────────────────────────────────────────────
  Position:    150 entities ( 75.0%)
  Velocity:    120 entities ( 60.0%)
  Health  :     50 entities ( 25.0%)
──────────────────────────────────────────────────
Total entities: 200
```

## API Reference

### Entity Visualization

#### printHierarchy(rootEntity?: Entity): string

Prints entity hierarchy as an ASCII tree.

```typescript
// Print all root entities and their children
engine.debug.printHierarchy();

// Print hierarchy starting from specific entity
const player = engine.queryEntities({ tags: ['player'] })[0];
engine.debug.printHierarchy(player);
```

**Output:**
```
Entity Hierarchy:
├─ Player [player, controllable] (Transform, Health, Inventory)
│   ├─ Weapon (Transform, Sprite)
│   │   └─ ParticleEffect (Transform, ParticleEmitter)
│   └─ Shield (Transform, Sprite)
└─ Enemy [enemy, hostile] (Transform, Health, AI)
    └─ Loot (Transform, Collider)
```

### Component Analysis

#### printComponentStats(): string

Prints component usage statistics across all entities.

```typescript
engine.debug.printComponentStats();
```

**Output:**
```
Component Statistics:
──────────────────────────────────────────────────
  Transform :    500 entities (100.0%)
  Sprite    :    450 entities ( 90.0%)
  Position  :    300 entities ( 60.0%)
  RigidBody :    200 entities ( 40.0%)
  Health    :    100 entities ( 20.0%)
  AI        :     50 entities ( 10.0%)
──────────────────────────────────────────────────
Total entities: 500
```

**Use Cases:**
- Identify most commonly used components
- Find unused component types
- Detect component bloat
- Optimize component allocation

### System Performance

#### getSystemTimeline(): any[]

Gets system execution timeline data in a structured format.

```typescript
const timeline = engine.debug.getSystemTimeline();
console.log('System timeline:', timeline);
```

**Returns:** Array of trace events with timing data.

#### exportChromeTrace(): string

Exports system timeline to Chrome DevTools trace format.

```typescript
const trace = engine.debug.exportChromeTrace();

// Save to file (Node.js)
require('fs').writeFileSync('trace.json', trace);

// Download in browser
const blob = new Blob([trace], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'orion-ecs-trace.json';
a.click();

// Open in Chrome DevTools:
// 1. Open chrome://tracing
// 2. Click "Load" and select trace.json
// 3. Visualize system execution timeline
```

**Chrome DevTools Output:**
- Visual timeline of all system executions
- Entity counts per system
- Execution times and overlaps
- Performance bottleneck identification

### Query Analysis

#### analyzeQuery(query: Query): string

Analyzes query performance and provides optimization suggestions.

```typescript
const query = engine.createQuery({
  all: [Position, Velocity],
  none: [Frozen],
  tags: ['active']
});

engine.debug.analyzeQuery(query);
```

**Output:**
```
Query Performance Analysis:
──────────────────────────────────────────────────
  Matching entities: 150
  Execution time: 0.234ms
  Required components (ALL): Position, Velocity
  Excluded components (NONE): Frozen
  Required tags: active

Optimization Suggestions:
  ✓ Query execution time is good (<1ms)
  ✓ Entity count is reasonable
  ℹ Consider caching results if queried frequently
──────────────────────────────────────────────────
```

**Optimization Suggestions Provided:**
- High entity count warnings
- Slow execution warnings
- Empty query warnings
- Missing constraints notifications

### Debug Information

#### getDebugInfo(): object

Gets comprehensive debug information about engine state.

```typescript
const info = engine.debug.getDebugInfo();
console.log('Entity count:', info.entityCount);
console.log('System count:', info.systemCount);
console.log('Query count:', info.queryCount);
console.log('Component types:', info.componentTypes);
console.log('Memory stats:', info.memoryStats);
```

**Returns:**
```typescript
{
  entityCount: number;
  systemCount: number;
  queryCount: number;
  componentTypes: number;
  memoryStats: {
    totalEntities: number;
    activeEntities: number;
    pooledEntities: number;
    componentArrays: { [type: string]: number };
  };
}
```

#### printDebugSummary(): string

Prints comprehensive debug summary with all key metrics.

```typescript
engine.debug.printDebugSummary();
```

**Output:**
```
════════════════════════════════════════════════════════════
  ORION ECS DEBUG SUMMARY
════════════════════════════════════════════════════════════

  Total Entities: 500
  Active Systems: 12
  Registered Queries: 8
  Component Types: 15

════════════════════════════════════════════════════════════
```

## Examples

### Development Debug Panel

```typescript
// Create in-game debug panel
function createDebugPanel() {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px;
    font-family: monospace;
    font-size: 12px;
    max-width: 400px;
    max-height: 90vh;
    overflow-y: auto;
  `;
  document.body.appendChild(panel);

  // Update debug info every second
  setInterval(() => {
    const info = engine.debug.getDebugInfo();
    panel.innerHTML = `
      <strong>ORION ECS DEBUG</strong><br>
      Entities: ${info.entityCount}<br>
      Systems: ${info.systemCount}<br>
      Queries: ${info.queryCount}<br>
      Components: ${info.componentTypes}<br>
      <br>
      <strong>Memory</strong><br>
      Active: ${info.memoryStats.activeEntities}<br>
      Pooled: ${info.memoryStats.pooledEntities}<br>
    `;
  }, 1000);
}

createDebugPanel();
```

### Console Debug Commands

```typescript
// Add debug commands to browser console
if (typeof window !== 'undefined') {
  (window as any).debugECS = {
    // Print hierarchy
    hierarchy: () => engine.debug.printHierarchy(),

    // Print components
    components: () => engine.debug.printComponentStats(),

    // Print summary
    summary: () => engine.debug.printDebugSummary(),

    // Export trace
    trace: () => {
      const trace = engine.debug.exportChromeTrace();
      console.log('Trace data:', trace);
      console.log('Copy this to a .json file and open in chrome://tracing');
    },

    // Get specific entity info
    entity: (name: string) => {
      const entities = engine.queryEntities({ name });
      if (entities.length === 0) {
        console.log(`No entity named "${name}"`);
        return;
      }
      const entity = entities[0];
      console.log('Entity:', entity.name);
      console.log('Tags:', Array.from(entity.tags));
      console.log('Children:', entity.children.size);
      console.log('Parent:', entity.parent?.name || 'none');
    },

    // Find entities by tag
    tagged: (tag: string) => {
      const entities = engine.queryEntities({ tags: [tag] });
      console.log(`Found ${entities.length} entities with tag "${tag}":`);
      entities.forEach(e => console.log(`  - ${e.name}`));
    }
  };

  console.log('Debug commands available:');
  console.log('  debugECS.hierarchy()   - Print entity hierarchy');
  console.log('  debugECS.components()  - Print component stats');
  console.log('  debugECS.summary()     - Print debug summary');
  console.log('  debugECS.trace()       - Export Chrome trace');
  console.log('  debugECS.entity(name)  - Get entity info');
  console.log('  debugECS.tagged(tag)   - Find tagged entities');
}
```

### Automated Testing Integration

```typescript
// Test helper for verifying engine state
function testEngineState() {
  const info = engine.debug.getDebugInfo();

  // Verify expected entity count
  if (info.entityCount !== 500) {
    console.error(`Expected 500 entities, got ${info.entityCount}`);
  }

  // Verify all systems are running
  if (info.systemCount !== 12) {
    console.error(`Expected 12 systems, got ${info.systemCount}`);
  }

  // Check for memory leaks
  if (info.memoryStats.pooledEntities > 1000) {
    console.warn(`High pooled entity count: ${info.memoryStats.pooledEntities}`);
  }

  console.log('✓ Engine state validated');
}
```

### Performance Regression Testing

```typescript
// Benchmark query performance
function benchmarkQueries() {
  const queries = engine.queries || [];
  const results: any[] = [];

  queries.forEach((query: any) => {
    const analysis = engine.debug.analyzeQuery(query);

    // Extract execution time from analysis
    // (In real implementation, you'd parse the string or use direct API)
    results.push({
      query: query.options,
      analysis
    });
  });

  console.log('Query benchmark results:', results);

  // Save baseline for regression testing
  localStorage.setItem('queryBaseline', JSON.stringify(results));
}
```

### Entity Leak Detection

```typescript
let lastEntityCount = 0;

function detectEntityLeaks() {
  const info = engine.debug.getDebugInfo();
  const currentCount = info.entityCount;

  if (currentCount > lastEntityCount + 100) {
    console.warn(`Entity count increased by ${currentCount - lastEntityCount}`);
    console.warn('Possible entity leak!');

    // Print hierarchy to identify leaked entities
    engine.debug.printHierarchy();
  }

  lastEntityCount = currentCount;
}

setInterval(detectEntityLeaks, 5000);
```

## Performance Considerations

### Debug Mode

The plugin is designed for development use:

```typescript
// Development: Enable debug plugin
const engine = new EngineBuilder()
  .withDebugMode(true)
  .use(new DebugVisualizerPlugin())
  .build();

// Production: Disable debug plugin
const engine = new EngineBuilder()
  .withDebugMode(false)
  // Don't use DebugVisualizerPlugin
  .build();
```

### Performance Impact

- **printHierarchy()**: O(n) for entity traversal
- **printComponentStats()**: O(n) for entity scanning
- **analyzeQuery()**: O(1) for already-executed queries
- **exportChromeTrace()**: O(s) where s = number of systems

**Recommendations:**
- Don't call in hot loops
- Use for debugging only, not in production
- Call on-demand (user input, console commands)
- Cache results if needed frequently

## Integration with Other Plugins

### With ProfilingPlugin

Complementary debugging tools:

```typescript
import { ProfilingPlugin } from '@orion-ecs/profiling';

const engine = new EngineBuilder()
  .use(new DebugVisualizerPlugin())
  .use(new ProfilingPlugin())
  .build();

// Debug: Entity and component visualization
engine.debug.printDebugSummary();

// Profiling: Performance and memory tracking
engine.profiler.printSummary();
```

**DebugVisualizerPlugin:** Structure and state inspection
**ProfilingPlugin:** Performance and memory analysis

## Troubleshooting

### printHierarchy() Shows Nothing

1. Check that entities exist: `engine.debug.getDebugInfo()`
2. Verify root entities (no parent): Most entities should have no parent
3. Ensure entities have names for better output

### Component Stats Empty

1. Check that components are registered
2. Verify entities have components
3. Ensure getMemoryStats() is available on engine

### Chrome Trace Not Loading

1. Verify JSON is valid (use JSON validator)
2. Check file extension is `.json`
3. Open chrome://tracing (not chrome://inspect)
4. Try "Load" button, not drag-and-drop

### Query Analysis Showing Wrong Data

1. Ensure query has been executed at least once
2. Check query.entities is populated
3. Verify query options are correct

## Best Practices

1. **Development Only**: Use debug plugin in development, remove for production
2. **On-Demand**: Call debug functions on-demand, not every frame
3. **Console Commands**: Expose debug functions to browser console
4. **Automated Testing**: Use getDebugInfo() for test assertions
5. **Chrome Trace**: Export traces for deep performance analysis
6. **Documentation**: Use printHierarchy() to document entity structures
7. **Regression Testing**: Baseline query performance with analyzeQuery()

## Advanced Topics

### Custom Debug Visualization

```typescript
// Extend debug API with custom visualizations
function visualizeEntityGraph() {
  const entities = engine.queryEntities({});

  // Build graph data structure
  const nodes = entities.map(e => ({
    id: e.id.toString(),
    label: e.name,
    tags: Array.from(e.tags)
  }));

  const edges = entities
    .filter(e => e.parent)
    .map(e => ({
      from: e.parent!.id.toString(),
      to: e.id.toString()
    }));

  // Export to graph visualization tool (e.g., vis.js, d3.js)
  return { nodes, edges };
}
```

### Component Dependency Analysis

```typescript
function analyzeComponentDependencies() {
  const stats = engine.debug.getDebugInfo();

  // Find components that always appear together
  const componentPairs = new Map<string, Set<string>>();

  const entities = engine.queryEntities({});
  entities.forEach(entity => {
    const components = getEntityComponents(entity);

    components.forEach(c1 => {
      components.forEach(c2 => {
        if (c1 !== c2) {
          if (!componentPairs.has(c1)) {
            componentPairs.set(c1, new Set());
          }
          componentPairs.get(c1)!.add(c2);
        }
      });
    });
  });

  console.log('Component co-occurrence:', componentPairs);
}
```

### System Execution Heatmap

```typescript
function generateSystemHeatmap() {
  const timeline = engine.debug.getSystemTimeline();

  // Generate heatmap data showing which systems take the most time
  const heatmap = timeline.map((event: any) => ({
    system: event.name,
    duration: event.dur / 1000, // Convert to ms
    entityCount: event.args.entityCount,
    avgTimePerEntity: event.dur / 1000 / event.args.entityCount
  }));

  // Sort by duration
  heatmap.sort((a, b) => b.duration - a.duration);

  console.table(heatmap);
  return heatmap;
}
```
