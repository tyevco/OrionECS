# Migration Guide: Polling-Based Systems to Event-Driven Systems

This guide helps you migrate existing polling-based systems to use OrionECS's component change events for better performance and cleaner code.

## Table of Contents

1. [When to Migrate](#when-to-migrate)
2. [Migration Strategy](#migration-strategy)
3. [Step-by-Step Process](#step-by-step-process)
4. [Common Patterns](#common-patterns)
5. [Performance Impact](#performance-impact)
6. [Troubleshooting](#troubleshooting)

---

## When to Migrate

### ✅ Good Candidates for Migration

Migrate to events when systems exhibit these characteristics:

- **UI Updates**: Health bars, inventory displays, score counters
- **Infrequent Changes**: Components that change rarely (< 20% per frame)
- **Many Entities**: 100+ entities being polled every frame
- **Reaction-Based**: Logic that only runs when something changes
- **Network Sync**: Components that need to be synchronized over network
- **Audio/Visual Effects**: Triggered by state changes

### ❌ Keep Using Polling/Systems

Don't migrate these systems:

- **Every-Frame Logic**: Movement, physics, animation
- **High-Frequency Changes**: Components that change 50%+ every frame
- **Small Entity Counts**: < 50 entities with simple logic
- **Performance Already Good**: No noticeable frame drops
- **Tight Timing Requirements**: Physics that need consistent timing

---

## Migration Strategy

### Incremental Approach (Recommended)

1. **Identify** candidate systems for migration
2. **Add** change tracking to one system at a time
3. **Test** thoroughly after each migration
4. **Measure** performance improvements
5. **Iterate** until all suitable systems are migrated

### Benefits of Incremental Migration:
- Lower risk of introducing bugs
- Easy to rollback if issues arise
- Can measure impact of each change
- Team can learn incrementally

---

## Step-by-Step Process

### Step 1: Identify Polling Systems

Look for systems that check component values every frame:

```typescript
// BEFORE: Polling-based system
engine.createSystem('HealthBarSystem',
  { all: [Health, HealthBar] },
  {
    act: (entity, health, healthBar) => {
      // Runs every frame, even if health didn't change
      healthBar.setPercent(health.current / health.max);

      // Conditional logic that rarely executes
      if (health.current <= 0) {
        entity.addTag('dead');
      }
    }
  }
);
```

**Signs of a polling system:**
- `act()` method updates UI/state unconditionally
- Conditional logic that rarely executes
- Same calculation repeated every frame
- No component modifications, just reads

### Step 2: Add Change Tracking

First, mark components as dirty when they're modified:

```typescript
// Find all systems that MODIFY the component
engine.createSystem('CombatSystem',
  { all: [Health] },
  {
    act: (entity, health) => {
      const damage = getPendingDamage(entity);
      if (damage > 0) {
        health.current -= damage;

        // NEW: Notify listeners of the change
        engine.markComponentDirty(entity, Health);
      }
    }
  }
);
```

**Where to add dirty marking:**
- After any component property changes
- Before expensive calculations based on component data
- When component state affects other systems

### Step 3: Convert to Event-Driven

Replace the `act()` method with event handlers:

```typescript
// AFTER: Event-driven system
engine.createSystem('HealthBarSystem',
  { all: [Health, HealthBar] },
  {
    // Filter to only Health changes
    watchComponents: [Health],

    // Initialize when component is added
    onComponentAdded: (event) => {
      const health = event.component;
      const healthBar = event.entity.getComponent(HealthBar);
      healthBar.setPercent(health.current / health.max);
    },

    // React to changes only
    onComponentChanged: (event) => {
      const health = event.newValue;
      const healthBar = event.entity.getComponent(HealthBar);

      // Update display
      healthBar.setPercent(health.current / health.max);

      // Check for death
      if (health.current <= 0) {
        event.entity.addTag('dead');
      }

      // Access old value for comparisons
      if (event.oldValue && event.oldValue.current > health.current) {
        healthBar.showDamageEffect();
      }
    },

    onComponentRemoved: (event) => {
      const healthBar = event.entity.getComponent(HealthBar);
      healthBar.hide();
    }

    // No act() method needed!
  }
);
```

### Step 4: Test Thoroughly

Create tests to verify the migration:

```typescript
describe('HealthBarSystem Migration', () => {
  let engine;
  let player;

  beforeEach(() => {
    engine = new EngineBuilder().build();
    player = engine.createEntity('Player');
    player.addComponent(Health, 100, 100);
    player.addComponent(HealthBar);
  });

  test('updates when health changes', () => {
    const healthBar = player.getComponent(HealthBar);
    const initialCount = healthBar.getUpdateCount();

    // Damage player
    const health = player.getComponent(Health);
    health.current = 80;
    engine.markComponentDirty(player, Health);
    engine.update(16);

    expect(healthBar.getUpdateCount()).toBe(initialCount + 1);
  });

  test('does not update when health is unchanged', () => {
    engine.update(16); // Initial update
    const healthBar = player.getComponent(HealthBar);
    const initialCount = healthBar.getUpdateCount();

    // Run frames without damage
    for (let i = 0; i < 10; i++) {
      engine.update(16);
    }

    // Should not have updated
    expect(healthBar.getUpdateCount()).toBe(initialCount);
  });

  test('shows damage effect when health decreases', () => {
    const healthBar = player.getComponent(HealthBar);
    const showDamageEffect = jest.spyOn(healthBar, 'showDamageEffect');

    const health = player.getComponent(Health);
    health.current = 80;
    engine.markComponentDirty(player, Health);
    engine.update(16);

    expect(showDamageEffect).toHaveBeenCalled();
  });
});
```

### Step 5: Measure Performance

Compare before and after performance:

```typescript
// Benchmark helper
function benchmarkSystem(systemName: string, frames: number): number {
  const start = performance.now();

  for (let i = 0; i < frames; i++) {
    engine.update(16);
  }

  const end = performance.now();
  const avgTime = (end - start) / frames;

  console.log(`${systemName}: ${avgTime.toFixed(2)}ms per frame`);
  return avgTime;
}

// Before migration
const pollingTime = benchmarkSystem('Polling', 1000);

// After migration
const eventsTime = benchmarkSystem('Events', 1000);

const improvement = ((pollingTime - eventsTime) / pollingTime) * 100;
console.log(`Improvement: ${improvement.toFixed(1)}%`);
```

---

## Common Patterns

### Pattern 1: UI Synchronization

**Before:**
```typescript
engine.createSystem('ScoreUISystem',
  { all: [Score, ScoreDisplay] },
  {
    act: (entity, score, display) => {
      display.setText(`Score: ${score.value}`);
    }
  }
);
```

**After:**
```typescript
engine.createSystem('ScoreUISystem',
  { all: [Score, ScoreDisplay] },
  {
    watchComponents: [Score],

    onComponentAdded: (event) => {
      const score = event.component;
      const display = event.entity.getComponent(ScoreDisplay);
      display.setText(`Score: ${score.value}`);
    },

    onComponentChanged: (event) => {
      const score = event.newValue;
      const display = event.entity.getComponent(ScoreDisplay);
      display.setText(`Score: ${score.value}`);

      // Optional: Animate score change
      const oldScore = event.oldValue?.value || 0;
      const newScore = score.value;
      if (newScore > oldScore) {
        display.playIncreaseAnimation(newScore - oldScore);
      }
    }
  }
);
```

### Pattern 2: State Transitions

**Before:**
```typescript
engine.createSystem('DeathSystem',
  { all: [Health] },
  {
    act: (entity, health) => {
      if (health.current <= 0 && !entity.hasTag('dead')) {
        entity.addTag('dead');
        createDeathEffect(entity);
      }
    }
  }
);
```

**After:**
```typescript
engine.createSystem('DeathSystem',
  { all: [Health] },
  {
    watchComponents: [Health],

    onComponentChanged: (event) => {
      const health = event.newValue;

      // Only trigger death once when crossing threshold
      if (health.current <= 0 && !event.entity.hasTag('dead')) {
        event.entity.addTag('dead');
        createDeathEffect(event.entity);
      }
    }
  }
);
```

### Pattern 3: Inventory Management

**Before:**
```typescript
engine.createSystem('InventoryUISystem',
  { all: [Inventory, InventoryUI] },
  {
    act: (entity, inventory, ui) => {
      // Refresh entire UI every frame
      ui.refresh(inventory);
    }
  }
);
```

**After:**
```typescript
engine.createSystem('InventoryUISystem',
  { all: [Inventory, InventoryUI] },
  {
    watchComponents: [Inventory],

    onComponentChanged: (event) => {
      const oldInv = event.oldValue;
      const newInv = event.newValue;
      const ui = event.entity.getComponent(InventoryUI);

      // Detect specific changes
      if (oldInv) {
        // Item added
        if (newInv.items.length > oldInv.items.length) {
          const newItem = newInv.items[newInv.items.length - 1];
          ui.animateItemAdded(newItem);
        }

        // Item removed
        else if (newInv.items.length < oldInv.items.length) {
          ui.animateItemRemoved();
        }

        // Gold changed
        if (newInv.gold !== oldInv.gold) {
          ui.animateGoldChange(oldInv.gold, newInv.gold);
        }
      }

      ui.refresh(newInv);
    }
  }
);
```

### Pattern 4: Achievement Tracking

**Before:**
```typescript
engine.createSystem('AchievementSystem',
  { all: [PlayerStats] },
  {
    act: (entity, stats) => {
      if (stats.kills >= 100 && !entity.hasTag('achievement-centurion')) {
        unlockAchievement('Centurion');
        entity.addTag('achievement-centurion');
      }
    }
  }
);
```

**After:**
```typescript
engine.createSystem('AchievementSystem',
  { all: [PlayerStats] },
  {
    watchComponents: [PlayerStats],

    onComponentChanged: (event) => {
      const stats = event.newValue;
      const entity = event.entity;

      // Check achievements only when stats change
      if (stats.kills >= 100 && !entity.hasTag('achievement-centurion')) {
        unlockAchievement('Centurion');
        entity.addTag('achievement-centurion');
      }

      if (stats.level >= 10 && !entity.hasTag('achievement-veteran')) {
        unlockAchievement('Veteran');
        entity.addTag('achievement-veteran');
      }
    }
  }
);
```

---

## Performance Impact

### Expected Improvements

| Entity Count | Change Rate | Expected Speedup |
|--------------|-------------|------------------|
| 100          | 10%         | 2-4x             |
| 1,000        | 10%         | 10-20x           |
| 10,000       | 10%         | 50-150x          |

### Real-World Example

```
BEFORE (Polling):
  - 1000 entities
  - Health bar system runs every frame
  - Checks per second: 1000 × 60 = 60,000
  - Frame time: 2.1ms

AFTER (Events):
  - 1000 entities
  - Only 100 entities take damage per second
  - Updates per second: 100
  - Frame time: 0.08ms
  - Improvement: 26x faster (96% reduction)
```

### Break-Even Analysis

Events become beneficial when:

```
Cost(Events) < Cost(Polling)

Where:
  Cost(Events) = (Changes × EventOverhead)
  Cost(Polling) = (Entities × CheckCost)

Break-even point:
  Changes < (Entities × CheckCost) / EventOverhead

Example:
  - 1000 entities
  - CheckCost = 0.001ms
  - EventOverhead = 0.005ms
  - Break-even: < 200 changes per frame (20%)
```

---

## Troubleshooting

### Issue 1: Events Not Firing

**Problem:** Component changes but no event is emitted.

**Solutions:**
1. Ensure `markComponentDirty()` is called after modifications:
   ```typescript
   health.current -= damage;
   engine.markComponentDirty(entity, Health); // Don't forget!
   ```

2. Check `watchComponents` includes the component:
   ```typescript
   {
     watchComponents: [Health], // Must be specified
     onComponentChanged: (event) => { ... }
   }
   ```

3. Verify batch mode is not enabled:
   ```typescript
   console.log(engine.isBatchMode()); // Should be false
   ```

### Issue 2: Too Many Events

**Problem:** Events fire too frequently, causing performance issues.

**Solutions:**
1. Use batch mode for bulk operations:
   ```typescript
   engine.batch(() => {
     // Many changes here won't emit events
   });
   ```

2. Enable debouncing:
   ```typescript
   const engine = new EngineBuilder()
     .withChangeTracking({ debounceMs: 50 })
     .build();
   ```

3. Throttle manual dirty marking:
   ```typescript
   let lastMarked = 0;
   const throttleMs = 16; // ~1 frame

   if (Date.now() - lastMarked > throttleMs) {
     engine.markComponentDirty(entity, Position);
     lastMarked = Date.now();
   }
   ```

### Issue 3: Old Value is Undefined

**Problem:** `event.oldValue` is always undefined.

**Cause:** Old value is only available when using proxy-based tracking or when the system captures it.

**Solution 1: Use proxy tracking:**
```typescript
const engine = new EngineBuilder()
  .withChangeTracking({ enableProxyTracking: true })
  .build();
```

**Solution 2: Manually track old values:**
```typescript
const healthCache = new Map<Entity, number>();

engine.createSystem('HealthSystem',
  { all: [Health] },
  {
    watchComponents: [Health],

    onComponentChanged: (event) => {
      const newHealth = event.newValue.current;
      const oldHealth = healthCache.get(event.entity) || newHealth;

      if (oldHealth > newHealth) {
        console.log(`Lost ${oldHealth - newHealth} HP`);
      }

      healthCache.set(event.entity, newHealth);
    }
  }
);
```

### Issue 4: Performance Worse After Migration

**Problem:** System is slower with events than polling.

**Possible Causes:**
1. **High change rate (>50% per frame)**
   - Events have overhead; not suitable for high-frequency changes
   - Solution: Keep using polling/systems for this case

2. **Event handler is too expensive**
   - Doing too much work in event handlers
   - Solution: Defer expensive work or use debouncing

3. **Too many systems watching same component**
   - Each system receives event separately
   - Solution: Consolidate systems or use message bus

**Diagnosis:**
```typescript
// Profile event handler
console.time('EventHandler');
onComponentChanged: (event) => {
  // Your code here
}
console.timeEnd('EventHandler');

// If handler takes >1ms, it's too expensive
```

---

## Best Practices

### DO:
- ✅ Start with one system and measure results
- ✅ Use `watchComponents` to filter events
- ✅ Add tests before and after migration
- ✅ Mark components dirty immediately after changes
- ✅ Use batch mode for bulk operations
- ✅ Document why each system uses events

### DON'T:
- ❌ Migrate all systems at once
- ❌ Use events for high-frequency updates (>50% per frame)
- ❌ Forget to mark components as dirty
- ❌ Do expensive work in event handlers
- ❌ Mix polling and events for same component

### Performance Checklist:
- [ ] Change rate is < 20% per frame
- [ ] Event handler is < 0.5ms
- [ ] Using `watchComponents` filter
- [ ] Batch mode for bulk operations
- [ ] Tests verify correct behavior
- [ ] Benchmarks show improvement

---

## Summary

### Migration Workflow:
1. **Identify** polling systems (UI, infrequent changes)
2. **Add** `markComponentDirty()` to modifier systems
3. **Replace** `act()` with event handlers
4. **Test** thoroughly
5. **Measure** performance improvement
6. **Iterate** to next system

### Expected Benefits:
- 💰 **Performance**: 2-150x faster depending on scale
- 🧹 **Code Quality**: Cleaner, more reactive architecture
- 🎨 **Features**: Easier to add animations and effects
- 📊 **Debugging**: Track what changed and when
- 🚀 **Scalability**: Handles more entities efficiently

### When to Use Events:
- UI synchronization
- Achievement tracking
- Audio/visual effects
- Network synchronization
- Infrequent state changes
- Large entity counts

### When to Keep Polling:
- Movement and physics
- Every-frame logic
- High-frequency updates
- Small entity counts
- Performance already good

---

For more examples and patterns, see:
- [Reactive Programming Patterns (COOKBOOK.md)](../COOKBOOK.md#reactive-programming-patterns)
- [Component Change Events (README.md)](../../README.md#component-change-events)
- [Examples](../../examples/component-change-events/)
