---
"@orion-ecs/core": minor
---

Add Entity Commands / Deferred Operations system for safe entity manipulation during system execution

This release introduces a comprehensive command buffer system that allows safe, deferred entity operations during system execution. Commands are queued and executed at the end of the update cycle, preventing issues with iterator invalidation and archetype transitions during iteration.

**New Features:**

- **`engine.commands.spawn()`** - Create entities with fluent component chaining
  ```typescript
  engine.commands.spawn()
    .named('Bullet')
    .with(Position, x, y)
    .with(Velocity, vx, vy)
    .withTag('projectile')
    .onCreate(entity => { /* callback */ });
  ```

- **`engine.commands.entity(e)`** - Modify existing entities safely
  ```typescript
  engine.commands.entity(player)
    .addComponent(Buff, 'speed', 1.5)
    .removeComponent(Debuff)
    .addTag('buffed');
  ```

- **`engine.commands.despawn(entity)`** - Queue entity destruction
  ```typescript
  engine.commands.despawn(enemy);
  ```

- **`engine.commands.spawnBatch(count, callback)`** - Efficient batch entity creation
  ```typescript
  engine.commands.spawnBatch(100, (builder, index) => {
    builder
      .named(`Particle_${index}`)
      .with(Position, Math.random() * 800, Math.random() * 600);
  });
  ```

- **`engine.commands.execute()`** - Manual command execution with statistics
  ```typescript
  const result = engine.commands.execute();
  console.log(`Spawned ${result.entitiesSpawned} entities`);
  ```

**Key Features:**
- Automatic execution during `engine.update()` (configurable via `setAutoExecuteCommands()`)
- FIFO command execution order
- Rollback support on errors (enabled by default)
- Full TypeScript type inference
- Hierarchy support (parent/child relationships)
- Tag management (add/remove tags)
- Comprehensive execution statistics

**Safety Guarantees:**
- Prevents iterator invalidation during query traversal
- Maintains consistent entity state throughout update cycles
- No archetype transitions during system iteration

**Integration with Systems:**
```typescript
engine.createSystem('DamageSystem', { all: [Health, DamageReceiver] }, {
  act: (entity, health, receiver) => {
    health.current -= receiver.pendingDamage;
    if (health.current <= 0) {
      // Safe to despawn during iteration
      engine.commands.despawn(entity);
    }
  }
});
```

This feature is essential for building complex game logic where systems need to create, modify, or destroy entities during execution.
