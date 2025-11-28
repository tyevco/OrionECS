# Profiling Plugin

Comprehensive performance profiling and monitoring for Orion ECS, providing frame recording, memory leak detection, and performance budget enforcement.

## Overview

The Profiling Plugin provides advanced performance analysis tools including:

- **Frame-by-Frame Recording**: Capture detailed performance data for every frame
- **Chrome DevTools Trace Export**: Visualize performance in Chrome DevTools
- **Memory Leak Detection**: Automatically detect growing memory usage
- **Performance Budgets**: Set and monitor execution time limits for systems
- **Statistical Analysis**: Average frame times, violations, and trends
- **Production Monitoring**: Low-overhead monitoring suitable for production

**Use Cases:**
- Performance optimization and bottleneck identification
- Memory leak detection in long-running applications
- Performance regression testing
- Production monitoring with budget alerts
- System execution profiling

## Installation

```typescript
import { EngineBuilder } from '@orion-ecs/core';
import { ProfilingPlugin } from '@orion-ecs/profiling';

const engine = new EngineBuilder()
  .use(new ProfilingPlugin())
  .build();
```

## Quick Start

### Basic Performance Recording

```typescript
import { EngineBuilder } from '@orion-ecs/core';
import { ProfilingPlugin } from '@orion-ecs/profiling';

// Create engine with plugin
const engine = new EngineBuilder()
  .use(new ProfilingPlugin())
  .build();

// Start recording performance data
engine.profiler.startRecording();

// Run your game/simulation
for (let i = 0; i < 100; i++) {
  engine.update();
}

// Stop recording and get session data
const session = engine.profiler.stopRecording();
console.log(`Recorded ${session.frames.length} frames`);

// Print summary
engine.profiler.printSummary();

// Export to Chrome DevTools
const trace = engine.profiler.exportChromeTrace(session);
// Save to file and open in chrome://tracing
```

## API Reference

### Recording Control

#### startRecording(): void

Starts recording performance data for all frames.

```typescript
engine.profiler.startRecording();

// Recording is active
// All frames will be captured with detailed timing
```

**Note:** Recording has minimal overhead but stores frame data in memory.

#### stopRecording(): ProfilingSession | null

Stops recording and returns the session data.

```typescript
const session = engine.profiler.stopRecording();

if (session) {
  console.log(`Session duration: ${session.endTime - session.startTime}ms`);
  console.log(`Frames recorded: ${session.frames.length}`);
  console.log(`Memory snapshots: ${session.memorySnapshots.length}`);
}
```

**Returns:**
```typescript
interface ProfilingSession {
  startTime: number;
  endTime?: number;
  frames: FrameProfile[];
  memorySnapshots: MemorySnapshot[];
}
```

### Performance Budgets

#### setBudget(systemName: string, maxTimeMs: number): void

Sets a performance budget for a system.

```typescript
// Movement system should complete in under 2ms
engine.profiler.setBudget('MovementSystem', 2.0);

// Rendering system should complete in under 16ms (60 FPS target)
engine.profiler.setBudget('RenderSystem', 16.0);

// Physics system should complete in under 5ms
engine.profiler.setBudget('PhysicsSystem', 5.0);
```

**Budget Violation:** When system exceeds budget, a warning is logged automatically.

#### removeBudget(systemName: string): void

Removes a performance budget.

```typescript
engine.profiler.removeBudget('MovementSystem');
```

#### getBudgets(): PerformanceBudget[]

Gets all active performance budgets.

```typescript
const budgets = engine.profiler.getBudgets();
budgets.forEach(budget => {
  console.log(`${budget.system}: ${budget.maxTimeMs}ms (violations: ${budget.violations})`);
});
```

**Returns:**
```typescript
interface PerformanceBudget {
  system: string;
  maxTimeMs: number;
  violations: number;
}
```

#### onBudgetExceededCallback(callback: (system: string, time: number) => void): void

Set a callback for budget violation events.

```typescript
engine.profiler.onBudgetExceededCallback((system, time) => {
  console.error(`⚠️ Performance issue: ${system} took ${time.toFixed(2)}ms`);

  // Optionally take action
  if (system === 'RenderSystem' && time > 32) {
    // More than 2 frames behind, reduce quality
    reduceGraphicsQuality();
  }
});
```

### Memory Analysis

#### detectMemoryLeaks(): MemoryLeak[]

Analyzes memory snapshots to detect potential memory leaks.

```typescript
// Run game for a while to collect snapshots
setTimeout(() => {
  const leaks = engine.profiler.detectMemoryLeaks();

  if (leaks.length > 0) {
    console.warn('⚠️ Potential memory leaks detected:');
    leaks.forEach(leak => {
      console.warn(`  ${leak.type}: ${leak.count} instances`);
      console.warn(`    Trend: ${leak.trend}, Severity: ${leak.severity}`);
    });
  } else {
    console.log('✓ No memory leaks detected');
  }
}, 30000); // After 30 seconds
```

**Returns:**
```typescript
interface MemoryLeak {
  type: string;               // Component type name
  count: number;              // Current count
  trend: 'increasing' | 'stable' | 'decreasing';
  severity: 'low' | 'medium' | 'high';
}
```

**Requirements:** At least 3 memory snapshots needed (collected automatically every 1 second during recording).

### Trace Export

#### exportChromeTrace(session?: ProfilingSession): string

Exports profiling data to Chrome DevTools trace format.

```typescript
const trace = engine.profiler.exportChromeTrace();

// Node.js: Save to file
require('fs').writeFileSync('profile.json', trace);

// Browser: Download file
const blob = new Blob([trace], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'orion-ecs-profile.json';
a.click();

// Then open in Chrome:
// 1. Go to chrome://tracing
// 2. Click "Load"
// 3. Select profile.json
// 4. Analyze performance timeline
```

**Chrome DevTools Features:**
- Visual timeline of system execution
- Zoom and pan through frames
- Identify performance bottlenecks
- Compare frame-to-frame variation
- Export performance reports

### Statistics

#### getStats(): ProfilingStats

Gets current profiling statistics.

```typescript
const stats = engine.profiler.getStats();
console.log('Recording:', stats.isRecording);
console.log('Frames:', stats.frameCount);
console.log('Avg frame time:', stats.averageFrameTime.toFixed(2) + 'ms');
console.log('Budget violations:', stats.budgetViolations);
console.log('Memory snapshots:', stats.memorySnapshots);
```

**Returns:**
```typescript
interface ProfilingStats {
  isRecording: boolean;
  frameCount: number;
  averageFrameTime: number;
  budgetViolations: number;
  memorySnapshots: number;
}
```

#### printSummary(): void

Prints a formatted profiling summary.

```typescript
engine.profiler.printSummary();
```

**Output:**
```
════════════════════════════════════════════════════════════
  PROFILER SUMMARY
════════════════════════════════════════════════════════════
  Recording: No
  Frames Recorded: 1000
  Average Frame Time: 8.42ms
  Budget Violations: 12
  Memory Snapshots: 30

  Performance Budgets:
    MovementSystem: 2.0ms (violations: 0)
    RenderSystem: 16.0ms (violations: 5)
    PhysicsSystem: 5.0ms (violations: 7)

════════════════════════════════════════════════════════════
```

## Examples

### Basic Performance Profiling

```typescript
// Record a gameplay session
console.log('Starting profiling session...');
engine.profiler.startRecording();

// Play the game for 10 seconds
setTimeout(() => {
  const session = engine.profiler.stopRecording();
  console.log(`✓ Recorded ${session.frames.length} frames`);

  // Calculate statistics
  const avgFrameTime = session.frames.reduce((sum, f) => sum + f.duration, 0) / session.frames.length;
  const maxFrameTime = Math.max(...session.frames.map(f => f.duration));
  const minFrameTime = Math.min(...session.frames.map(f => f.duration));

  console.log(`Average frame time: ${avgFrameTime.toFixed(2)}ms`);
  console.log(`Max frame time: ${maxFrameTime.toFixed(2)}ms`);
  console.log(`Min frame time: ${minFrameTime.toFixed(2)}ms`);

  // Export for detailed analysis
  const trace = engine.profiler.exportChromeTrace(session);
  downloadFile('profile.json', trace);
}, 10000);
```

### Performance Budget Monitoring

```typescript
// Set budgets for all systems
engine.profiler.setBudget('InputSystem', 1.0);
engine.profiler.setBudget('MovementSystem', 2.0);
engine.profiler.setBudget('PhysicsSystem', 5.0);
engine.profiler.setBudget('RenderSystem', 16.0);

// Monitor violations
engine.profiler.onBudgetExceededCallback((system, time) => {
  console.warn(`⚠️ ${system} exceeded budget: ${time.toFixed(2)}ms`);

  // Track violations
  budgetViolations[system] = (budgetViolations[system] || 0) + 1;

  // Take action on repeated violations
  if (budgetViolations[system] > 10) {
    console.error(`🔥 ${system} has ${budgetViolations[system]} violations!`);

    if (system === 'PhysicsSystem') {
      // Reduce physics quality
      engine.physics.setTimeScale(0.5);
    } else if (system === 'RenderSystem') {
      // Reduce render quality
      reduceGraphicsQuality();
    }
  }
});

// Print budget summary periodically
setInterval(() => {
  const budgets = engine.profiler.getBudgets();
  console.table(budgets);
}, 5000);
```

### Memory Leak Detection

```typescript
// Start profiling for leak detection
engine.profiler.startRecording();

// Run game loop
function gameLoop() {
  engine.update();

  // Check for leaks every 30 seconds
  if (Date.now() % 30000 < 16) {
    const leaks = engine.profiler.detectMemoryLeaks();

    if (leaks.length > 0) {
      console.warn('⚠️ Memory leaks detected:');
      leaks.forEach(leak => {
        const emoji = leak.severity === 'high' ? '🔥' : leak.severity === 'medium' ? '⚠️' : 'ℹ️';
        console.warn(`${emoji} ${leak.type}: ${leak.count} (+${leak.trend})`);
      });

      // High severity leaks require immediate attention
      const criticalLeaks = leaks.filter(l => l.severity === 'high');
      if (criticalLeaks.length > 0) {
        console.error('🔥 CRITICAL: High severity memory leaks detected!');
        // Optionally pause game or show warning to user
      }
    }
  }

  requestAnimationFrame(gameLoop);
}
gameLoop();
```

### Performance Regression Testing

```typescript
// Save baseline performance
async function savePerformanceBaseline() {
  engine.profiler.startRecording();

  // Run standardized test scenario
  await runTestScenario();

  const session = engine.profiler.stopRecording();
  const avgFrameTime = session.frames.reduce((sum, f) => sum + f.duration, 0) / session.frames.length;

  const baseline = {
    avgFrameTime,
    frameCount: session.frames.length,
    timestamp: Date.now()
  };

  localStorage.setItem('performanceBaseline', JSON.stringify(baseline));
  console.log('✓ Baseline saved:', baseline);
}

// Compare against baseline
async function checkPerformanceRegression() {
  const baselineData = localStorage.getItem('performanceBaseline');
  if (!baselineData) {
    console.warn('No baseline found. Run savePerformanceBaseline() first.');
    return;
  }

  const baseline = JSON.parse(baselineData);

  engine.profiler.startRecording();
  await runTestScenario();
  const session = engine.profiler.stopRecording();

  const avgFrameTime = session.frames.reduce((sum, f) => sum + f.duration, 0) / session.frames.length;

  const difference = avgFrameTime - baseline.avgFrameTime;
  const percentChange = (difference / baseline.avgFrameTime) * 100;

  console.log('Performance Comparison:');
  console.log(`  Baseline: ${baseline.avgFrameTime.toFixed(2)}ms`);
  console.log(`  Current:  ${avgFrameTime.toFixed(2)}ms`);
  console.log(`  Change:   ${difference > 0 ? '+' : ''}${difference.toFixed(2)}ms (${percentChange.toFixed(1)}%)`);

  if (percentChange > 10) {
    console.error('❌ REGRESSION: Performance degraded by more than 10%!');
  } else if (percentChange > 5) {
    console.warn('⚠️ WARNING: Performance degraded by more than 5%');
  } else {
    console.log('✓ Performance within acceptable range');
  }
}
```

### Production Monitoring

```typescript
// Lightweight production monitoring without full recording
function setupProductionMonitoring() {
  // Set conservative budgets
  engine.profiler.setBudget('MainLoop', 16.0); // 60 FPS target
  engine.profiler.setBudget('PhysicsSystem', 5.0);
  engine.profiler.setBudget('RenderSystem', 10.0);

  // Log budget violations to analytics
  engine.profiler.onBudgetExceededCallback((system, time) => {
    // Send to analytics service
    analytics.track('performance_budget_exceeded', {
      system,
      time,
      target: engine.profiler.getBudgets().find(b => b.system === system)?.maxTimeMs
    });

    // Optionally adjust quality dynamically
    if (system === 'RenderSystem') {
      autoAdjustQuality(time);
    }
  });

  // Periodic health check
  setInterval(() => {
    const stats = engine.profiler.getStats();

    if (stats.averageFrameTime > 16) {
      console.warn('⚠️ Average frame time above 60 FPS target');
      analytics.track('low_framerate', {
        avgFrameTime: stats.averageFrameTime
      });
    }
  }, 60000); // Every minute
}

setupProductionMonitoring();
```

### Frame Time Histogram

```typescript
function analyzeFrameDistribution(session: ProfilingSession) {
  const buckets = {
    '<8ms (>120 FPS)': 0,
    '8-16ms (60-120 FPS)': 0,
    '16-33ms (30-60 FPS)': 0,
    '>33ms (<30 FPS)': 0
  };

  session.frames.forEach(frame => {
    if (frame.duration < 8) buckets['<8ms (>120 FPS)']++;
    else if (frame.duration < 16) buckets['8-16ms (60-120 FPS)']++;
    else if (frame.duration < 33) buckets['16-33ms (30-60 FPS)']++;
    else buckets['>33ms (<30 FPS)']++;
  });

  console.log('Frame Time Distribution:');
  Object.entries(buckets).forEach(([range, count]) => {
    const percentage = (count / session.frames.length) * 100;
    const bar = '█'.repeat(Math.floor(percentage / 2));
    console.log(`  ${range.padEnd(20)} ${bar} ${percentage.toFixed(1)}%`);
  });
}
```

## Performance Considerations

### Recording Overhead

Recording has minimal overhead:

```typescript
// Minimal overhead (< 1% typically)
engine.profiler.startRecording();

// Automatically collects data during engine.update()
// No additional API calls needed

// Stop when done to free memory
engine.profiler.stopRecording();
```

**Memory Usage:**
- ~100 bytes per frame
- Memory snapshots every 1 second
- Clear by calling stopRecording()

### Production Use

Safe for production with budgets:

```typescript
// Development: Full recording
if (isDevelopment) {
  engine.profiler.startRecording();
}

// Production: Budget monitoring only
engine.profiler.setBudget('MainLoop', 16.0);
engine.profiler.onBudgetExceededCallback(logToAnalytics);
```

### Best Practices

1. **Recording**: Only record when actively profiling
2. **Budgets**: Always use budgets for important systems
3. **Callbacks**: Use callbacks for automated monitoring
4. **Memory**: Detect leaks early with periodic checks
5. **Baselines**: Save baselines for regression testing
6. **Chrome Trace**: Export for deep analysis
7. **Production**: Use lightweight budget monitoring in production

## Integration with Other Plugins

### With DebugVisualizerPlugin

Complementary debugging tools:

```typescript
import { DebugVisualizerPlugin } from '@orion-ecs/debug-visualizer';

const engine = new EngineBuilder()
  .use(new ProfilingPlugin())
  .use(new DebugVisualizerPlugin())
  .build();

// Profiling: Performance and memory
engine.profiler.printSummary();

// Debug: Structure and state
engine.debug.printDebugSummary();
```

## System Priority

The plugin hooks into engine lifecycle:

- **beforeAct**: Automatically records frame data
- No systems created (minimal overhead)

## Troubleshooting

### No Data Being Recorded

1. Check that startRecording() was called
2. Verify engine.update() is being called
3. Ensure frames are being processed

### Memory Leak Detection Not Working

1. Need at least 3 snapshots (takes ~3 seconds)
2. Ensure recording is active
3. Check that memory is actually growing

### Budget Violations Not Triggering

1. Verify budget was set correctly
2. Check system name matches exactly
3. Ensure callback is registered
4. System must actually exceed budget

### Chrome Trace Not Loading

1. Verify JSON is valid
2. Use chrome://tracing (not chrome://inspect)
3. Try "Load" button
4. Check file has .json extension

### High Memory Usage

1. Stop recording when done
2. Clear session data: `stopRecording()`
3. Don't record for extended periods
4. Use budget monitoring instead of full recording

## Advanced Topics

### Custom Frame Analysis

```typescript
function analyzeSystemBottlenecks(session: ProfilingSession) {
  const systemTotals = new Map<string, number>();

  session.frames.forEach(frame => {
    frame.systems.forEach(sys => {
      const current = systemTotals.get(sys.name) || 0;
      systemTotals.set(sys.name, current + sys.duration);
    });
  });

  const sorted = Array.from(systemTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  console.log('Top 5 System Bottlenecks:');
  sorted.forEach(([system, totalTime]) => {
    const avgTime = totalTime / session.frames.length;
    console.log(`  ${system}: ${avgTime.toFixed(2)}ms avg, ${totalTime.toFixed(2)}ms total`);
  });
}
```

### Frame Variance Analysis

```typescript
function analyzeFrameVariance(session: ProfilingSession) {
  const times = session.frames.map(f => f.duration);
  const avg = times.reduce((a, b) => a + b) / times.length;

  const variance = times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  console.log(`Frame time variance: ${variance.toFixed(2)}`);
  console.log(`Standard deviation: ${stdDev.toFixed(2)}ms`);

  if (stdDev > avg * 0.3) {
    console.warn('⚠️ High frame time variance detected (inconsistent performance)');
  }
}
```
