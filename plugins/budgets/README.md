# @orion-ecs/budgets

Performance budgeting and monitoring plugin for OrionECS. Define performance limits for systems, queries, memory usage, and entity counts, then monitor and enforce those budgets at runtime.

## Features

- **Multiple Budget Types**: Time, memory, entity count, frame time, and query time budgets
- **Enforcement Modes**: Warning (logs), strict (throws), and adaptive (escalates)
- **Real-time Monitoring**: Track budget usage and violations in real-time
- **Adaptive Enforcement**: Automatically escalate responses to repeated violations
- **Dashboard Utilities**: Text, HTML, and JSON renderers for visualization
- **Event System**: Subscribe to violation and warning events
- **Telemetry Support**: Export metrics for production monitoring
- **Minimal Overhead**: Less than 1% performance impact

## Installation

```bash
npm install @orion-ecs/budgets
```

## Quick Start

```typescript
import { EngineBuilder } from '@orion-ecs/core';
import { BudgetPlugin } from '@orion-ecs/budgets';

const engine = new EngineBuilder()
  .withDebugMode(true)
  .use(new BudgetPlugin())
  .build();

// Add a time budget for a system (max 2ms)
engine.budgets.addTimeBudget('MovementSystem', 2.0);

// Add a frame time budget for 60 FPS
engine.budgets.addFrameTimeBudget(16.67);

// Add an entity count limit
engine.budgets.addEntityCountBudget(10000);

// Listen for violations
engine.budgets.onViolation((event) => {
  console.error(`Budget violated: ${event.violation.budgetName}`);
});

// Game loop
function gameLoop() {
  engine.update();
  requestAnimationFrame(gameLoop);
}
```

## Budget Types

### Time Budget

Monitor system execution time:

```typescript
// Simple time budget
engine.budgets.addTimeBudget('PhysicsSystem', 5.0); // 5ms max

// With options
engine.budgets.addTimeBudget('RenderSystem', 10.0, {
  name: 'Render Time Budget',
  enforcementMode: 'strict',
  warningThreshold: 0.75, // Warn at 75% of limit
  useAverageWindow: true, // Use rolling average
  averageWindowSize: 20,  // Over 20 samples
});
```

### Memory Budget

Monitor memory usage:

```typescript
// Total memory budget (100 MB)
engine.budgets.addMemoryBudget(100 * 1024 * 1024);

// Component-specific budget
engine.budgets.addMemoryBudget(10 * 1024 * 1024, 'Position', {
  name: 'Position Component Memory',
});
```

### Entity Count Budget

Limit entity counts:

```typescript
// Global entity limit
engine.budgets.addEntityCountBudget(10000);

// Tag-filtered budget
engine.budgets.addEntityCountBudget(1000, {
  tagFilter: 'enemy',
  name: 'Enemy Count Limit',
  enforcementMode: 'adaptive',
});
```

### Frame Time Budget

Monitor frame performance:

```typescript
// 60 FPS target
engine.budgets.addFrameTimeBudget(16.67);

// 30 FPS with custom deviation
engine.budgets.addFrameTimeBudget(33.33, {
  maxDeviationMs: 5, // Allow up to 5ms over
  useAverageWindow: true,
});
```

### Query Time Budget

Monitor query execution:

```typescript
engine.budgets.addQueryTimeBudget(1.0, {
  name: 'Query Performance Budget',
});
```

## Enforcement Modes

### Warning Mode (Default)

Logs warnings but continues execution:

```typescript
engine.budgets.addTimeBudget('System', 5.0, {
  enforcementMode: 'warning',
});
// Console: [Budget] System Time Budget exceeded: 6.50 > 5.00 (130.0%)
```

### Strict Mode

Throws an error on violation:

```typescript
engine.budgets.addTimeBudget('CriticalSystem', 2.0, {
  enforcementMode: 'strict',
});
// Throws: Budget violation: CriticalSystem Time Budget exceeded limit
```

### Adaptive Mode

Escalates response based on violation frequency:

```typescript
import { BudgetPlugin, AdaptiveStrategyConfig } from '@orion-ecs/budgets';

const adaptiveStrategy: AdaptiveStrategyConfig = {
  escalationThreshold: 5,    // Violations before escalating
  escalationWindowMs: 10000, // Time window for counting
  cooldownMs: 30000,         // Cooldown after de-escalation
  escalationActions: [
    { level: 0, action: 'logWarning' },
    { level: 1, action: 'logError' },
    { level: 2, action: 'throttleSystem' },
    { level: 3, action: 'disableSystem' },
  ],
};

const engine = new EngineBuilder()
  .use(new BudgetPlugin({
    adaptiveStrategy,
  }))
  .build();

engine.budgets.addTimeBudget('HighLoadSystem', 5.0, {
  enforcementMode: 'adaptive',
});
```

## Event Handling

```typescript
// All events
engine.budgets.onEvent((event) => {
  console.log(`Event: ${event.type}`);
});

// Violation events only
engine.budgets.onViolation((event) => {
  const v = event.violation;
  console.error(`${v.budgetName}: ${v.actualValue}ms (limit: ${v.limitValue}ms)`);
});

// Warning events only
engine.budgets.onWarning((event) => {
  console.warn(`Warning: ${event.budgetId} approaching limit`);
});
```

## Metrics and Reporting

```typescript
// Get system metrics
const metrics = engine.budgets.getMetrics();
console.log(`Health Score: ${metrics.healthScore}%`);
console.log(`Violated: ${metrics.violatedBudgets}`);
console.log(`Violations: ${metrics.totalViolations}`);
console.log(`Overhead: ${metrics.overheadMs}ms`);

// Get recent violations
const violations = engine.budgets.getRecentViolations(10);

// Print summary to console
engine.budgets.printSummary();

// Reset statistics
engine.budgets.resetStats();
```

## Dashboard Utilities

### Text Dashboard (Console)

```typescript
import { TextDashboard } from '@orion-ecs/budgets';

const dashboard = new TextDashboard();
console.log(dashboard.render(engine.budgets.getDashboardData()));
```

Output:
```
══════════════════════════════════════════════════════════════════════
                    PERFORMANCE BUDGET DASHBOARD
══════════════════════════════════════════════════════════════════════

  Health: [████████████████░░░░] 80% (HEALTHY)

──────────────────────────────────────────────────────────────────────
                           QUICK STATS
──────────────────────────────────────────────────────────────────────
  Total Budgets: 3
  Violated: 0 | Warning: 1
  Violations (total): 5
  Violations (1min): 2
  Overhead: 0.500ms

──────────────────────────────────────────────────────────────────────
                          BUDGET STATUS
──────────────────────────────────────────────────────────────────────
  ✅ ⏱️ MovementSystem Time Budget       2.50 /       5.00 (50.0%)
  ⚠️  🖼️ 60 FPS Frame Budget            15.20 /      16.67 (91.2%)
  ✅ 🎮 Entity Count Budget           500.00 /   10000.00 (5.0%)
```

### HTML Dashboard

```typescript
import { HtmlDashboardRenderer } from '@orion-ecs/budgets';

const renderer = new HtmlDashboardRenderer();
document.getElementById('dashboard').innerHTML =
  renderer.render(engine.budgets.getDashboardData());
```

### JSON Export

```typescript
import { JsonDashboardRenderer } from '@orion-ecs/budgets';

const renderer = new JsonDashboardRenderer();
const json = renderer.render(engine.budgets.getDashboardData(), true);

// Send to monitoring service
fetch('/api/metrics', { method: 'POST', body: json });
```

### Report Generator

```typescript
import { BudgetReportGenerator } from '@orion-ecs/budgets';

const generator = new BudgetReportGenerator();
console.log(generator.generateReport(engine.budgets.getDashboardData()));
```

## Telemetry

Configure telemetry for production monitoring:

```typescript
engine.budgets.configureTelemetry({
  enabled: true,
  samplingRate: 0.1,      // Sample 10% of violations
  endpoint: '/api/telemetry',
  batchSize: 100,
  flushIntervalMs: 60000, // Flush every minute
  metadata: {
    environment: 'production',
    version: '1.0.0',
  },
});

// Manual flush
await engine.budgets.flushTelemetry();

// Get payload for custom handling
const payload = engine.budgets.getTelemetryPayload();
```

## Budget Management

```typescript
// Get all budgets
const budgets = engine.budgets.getAllBudgets();

// Get by type
const timeBudgets = engine.budgets.getBudgetsByType('time');

// Enable/disable individual budgets
engine.budgets.setBudgetEnabled(budgetId, false);

// Enable/disable all
engine.budgets.enableAll();
engine.budgets.disableAll();

// Change enforcement mode
engine.budgets.setEnforcementMode(budgetId, 'strict');

// Remove budget
engine.budgets.removeBudget(budgetId);
```

## Plugin Configuration

```typescript
const engine = new EngineBuilder()
  .use(new BudgetPlugin({
    // Automatically check budgets on each update
    autoCheck: true,

    // Default enforcement for new budgets
    defaultEnforcementMode: 'warning',

    // Default warning threshold (0-1)
    defaultWarningThreshold: 0.8,

    // Adaptive strategy configuration
    adaptiveStrategy: {
      escalationThreshold: 3,
      escalationWindowMs: 5000,
      cooldownMs: 10000,
      escalationActions: [
        { level: 0, action: 'logWarning' },
        { level: 1, action: 'logError' },
        { level: 2, action: 'disableSystem' },
      ],
    },

    // Dashboard configuration
    dashboard: {
      enabled: true,
      updateIntervalMs: 500,
      position: 'top-right',
      mode: 'mini',
    },

    // Telemetry configuration
    telemetry: {
      enabled: false,
      samplingRate: 0.1,
    },
  }))
  .build();
```

## API Reference

### IBudgetAPI

| Method | Description |
|--------|-------------|
| `addTimeBudget(systemName, maxTimeMs, options?)` | Add system time budget |
| `addMemoryBudget(maxBytes, componentName?, options?)` | Add memory budget |
| `addEntityCountBudget(maxEntities, options?)` | Add entity count budget |
| `addFrameTimeBudget(targetMs, options?)` | Add frame time budget |
| `addQueryTimeBudget(maxTimeMs, options?)` | Add query time budget |
| `removeBudget(id)` | Remove a budget |
| `getBudget(id)` | Get budget state by ID |
| `getAllBudgets()` | Get all budget states |
| `getBudgetsByType(type)` | Get budgets by type |
| `setBudgetEnabled(id, enabled)` | Enable/disable budget |
| `setEnforcementMode(id, mode)` | Change enforcement mode |
| `enableAll()` | Enable all budgets |
| `disableAll()` | Disable all budgets |
| `getMetrics()` | Get system metrics |
| `getRecentViolations(limit?)` | Get recent violations |
| `resetStats()` | Reset all statistics |
| `printSummary()` | Print summary to console |
| `onEvent(callback)` | Subscribe to all events |
| `onViolation(callback)` | Subscribe to violations |
| `onWarning(callback)` | Subscribe to warnings |
| `getDashboardData()` | Get dashboard data |
| `configureDashboard(config)` | Configure dashboard |
| `configureTelemetry(config)` | Configure telemetry |
| `getTelemetryPayload()` | Get telemetry payload |
| `flushTelemetry()` | Flush telemetry data |

## Performance

The budget monitoring system is designed for minimal overhead:

- Budget checks are O(n) where n is the number of active budgets
- Typical overhead is less than 0.5ms per frame
- Overhead is tracked and reported in metrics
- Budgets can be disabled in production for zero overhead

## License

MIT
