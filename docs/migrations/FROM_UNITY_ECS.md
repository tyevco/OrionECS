# Migrating from Unity ECS/DOTS to OrionECS

This guide helps Unity ECS (DOTS - Data-Oriented Technology Stack) developers transition to OrionECS. While the frameworks share similar philosophies, there are important differences in implementation and API design.

## Table of Contents

1. [Concept Mapping](#concept-mapping)
2. [API Comparison](#api-comparison)
3. [Architecture Differences](#architecture-differences)
4. [Common Patterns Translation](#common-patterns-translation)
5. [Example Conversions](#example-conversions)
6. [What's Different](#whats-different)
7. [What's Similar](#whats-similar)

---

## Concept Mapping

| Unity ECS (DOTS) | OrionECS | Notes |
|------------------|----------|-------|
| `Entity` | `EntityDef` | OrionECS entities have names and tags |
| `IComponentData` | Component class | Plain TypeScript classes |
| `EntityManager` | `Engine` | Central facade for engine |
| `World` | `Engine` | Manages all entities and systems |
| `ComponentSystem` | System with query | Created via `engine.createSystem()` |
| `EntityQuery` | `Query` | Created via `engine.createQuery()` |
| `EntityCommandBuffer` | `queueFree()` | Deferred entity deletion |
| `Archetype` | N/A (planned) | OrionECS doesn't have archetypes yet |
| `Chunk` | N/A | No chunk-based storage |
| `Job` | N/A | No built-in job system |
| `Burst` | N/A | No compiler optimizations |
| `EntityArchetype` | Prefab | Template for entity creation |
| `BlobAsset` | N/A | No blob assets |
| `DynamicBuffer` | Array in component | Regular TypeScript arrays |

---

## API Comparison

### Creating Entities

**Unity ECS:**
```csharp
// Create entity
Entity entity = entityManager.CreateEntity();

// Create with archetype
EntityArchetype archetype = entityManager.CreateArchetype(
    typeof(Translation),
    typeof(Rotation)
);
Entity entity = entityManager.CreateEntity(archetype);

// Create from prefab
Entity instance = entityManager.Instantiate(prefabEntity);
```

**OrionECS:**
```typescript
// Create entity
const entity = engine.createEntity('EntityName');

// Create with components (no archetype needed)
const entity = engine.createEntity('Entity');
entity.addComponent(Position, 0, 0);
entity.addComponent(Rotation, 0);

// Create from prefab
engine.registerPrefab('Prefab', {
  name: 'Prefab',
  components: [
    { type: Position, args: [0, 0] },
    { type: Rotation, args: [0] }
  ],
  tags: []
});
const instance = engine.createFromPrefab('Prefab', 'Instance1');
```

---

### Components

**Unity ECS:**
```csharp
// Component definition
public struct Translation : IComponentData
{
    public float3 Value;
}

public struct Rotation : IComponentData
{
    public quaternion Value;
}

// Add component
entityManager.AddComponentData(entity, new Translation { Value = float3.zero });

// Get component
Translation translation = entityManager.GetComponentData<Translation>(entity);

// Set component
entityManager.SetComponentData(entity, new Translation { Value = new float3(1, 0, 0) });

// Remove component
entityManager.RemoveComponent<Translation>(entity);
```

**OrionECS:**
```typescript
// Component definition
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Rotation {
  constructor(public angle: number = 0) {}
}

// Add component
entity.addComponent(Position, 0, 0);

// Get component
const position = entity.getComponent(Position);

// Set component (modify directly)
position.x = 1;
position.y = 0;

// Remove component
entity.removeComponent(Position);

// Check for component
if (entity.hasComponent(Position)) {
  // ...
}
```

---

### Systems

**Unity ECS:**
```csharp
public class MovementSystem : SystemBase
{
    protected override void OnUpdate()
    {
        float deltaTime = Time.DeltaTime;

        Entities
            .WithAll<Player>()
            .ForEach((ref Translation translation, in Velocity velocity) =>
            {
                translation.Value += velocity.Value * deltaTime;
            })
            .ScheduleParallel();
    }
}
```

**OrionECS:**
```typescript
engine.createSystem('MovementSystem',
  {
    all: [Position, Velocity],
    tags: ['player']
  },
  {
    priority: 500,
    act: (entity, position, velocity) => {
      const deltaTime = 1 / 60; // Fixed timestep
      position.x += velocity.dx * deltaTime;
      position.y += velocity.dy * deltaTime;
    }
  },
  true // Fixed update (like Unity's FixedUpdate)
);
```

---

### Queries

**Unity ECS:**
```csharp
// Create query
EntityQuery query = GetEntityQuery(
    ComponentType.ReadOnly<Translation>(),
    ComponentType.ReadWrite<Velocity>(),
    ComponentType.Exclude<Frozen>()
);

// Iterate
var entities = query.ToEntityArray(Allocator.Temp);
foreach (var entity in entities)
{
    // Process entity
}
entities.Dispose();
```

**OrionECS:**
```typescript
// Create query
const query = engine.createQuery({
  all: [Position, Velocity],
  none: [Frozen]
});

// Iterate
const entities = query.getEntities();
for (const entity of entities) {
  const position = entity.getComponent(Position);
  const velocity = entity.getComponent(Velocity);
  // Process entity
}

// No manual disposal needed (garbage collected)
```

---

### Entity Destruction

**Unity ECS:**
```csharp
// Immediate destruction
entityManager.DestroyEntity(entity);

// Deferred destruction (command buffer)
var ecb = new EntityCommandBuffer(Allocator.TempJob);
ecb.DestroyEntity(entity);
ecb.Playback(entityManager);
ecb.Dispose();
```

**OrionECS:**
```typescript
// Deferred destruction (default)
entity.queueFree();

// Entity is destroyed at end of frame
// No manual playback or disposal needed
```

---

## Architecture Differences

### 1. Memory Layout

**Unity ECS:**
- Archetype-based storage (entities grouped by component composition)
- Chunk-based memory layout for cache efficiency
- Components stored in contiguous arrays
- Structural changes (add/remove component) expensive

**OrionECS:**
- Component-based storage (sparse arrays)
- No archetype system (planned for future)
- Components stored per entity
- Structural changes less expensive

### 2. Concurrency

**Unity ECS:**
- Built-in job system (IJobEntity, IJobChunk)
- Burst compiler for SIMD optimizations
- Parallel system execution
- Thread-safe by design

**OrionECS:**
- Single-threaded execution
- No built-in job system
- Systems execute sequentially
- Can integrate with Web Workers manually

### 3. Update Loops

**Unity ECS:**
- `ComponentSystem.OnUpdate()` - Main thread
- `SystemBase.OnUpdate()` - Job-based
- Can schedule jobs and dependencies

**OrionECS:**
- Fixed update systems (60 FPS default)
- Variable update systems (every frame)
- Priority-based execution order

---

## Common Patterns Translation

### Pattern 1: Parent-Child Relationships

**Unity ECS:**
```csharp
// Add Parent component
entityManager.AddComponentData(child, new Parent { Value = parent });

// Traverse hierarchy
var children = entityManager.GetBuffer<Child>(parent);
foreach (var child in children)
{
    // Process child
}
```

**OrionECS:**
```typescript
// Set parent
child.setParent(parent);

// Or add child
parent.addChild(child);

// Traverse hierarchy
for (const child of parent.children) {
  // Process child
}

// Destroying parent destroys all children automatically
parent.queueFree();
```

---

### Pattern 2: Singleton Components

**Unity ECS:**
```csharp
// Create singleton entity
Entity singleton = entityManager.CreateEntity(typeof(GameSettings));
entityManager.SetComponentData(singleton, new GameSettings
{
    Difficulty = 1.0f
});

// Access in system
var settings = GetSingleton<GameSettings>();
```

**OrionECS:**
```typescript
// Create singleton entity with tag
const singleton = engine.createEntity('GameSettings');
singleton.addComponent(GameSettings);
singleton.addTag('singleton');

// Access in system
const gameSettings = engine.getEntitiesByTag('singleton')[0]
  ?.getComponent(GameSettings);
```

---

### Pattern 3: Prefabs

**Unity ECS:**
```csharp
// Create prefab entity
Entity prefab = entityManager.CreateEntity();
entityManager.AddComponentData(prefab, new Translation { Value = float3.zero });
entityManager.AddComponentData(prefab, new Prefab());

// Instantiate
Entity instance = entityManager.Instantiate(prefab);
```

**OrionECS:**
```typescript
// Register prefab
engine.registerPrefab('Enemy', {
  name: 'Enemy',
  components: [
    { type: Position, args: [0, 0] },
    { type: Health, args: [100, 100] }
  ],
  tags: ['enemy']
});

// Instantiate
const instance = engine.createFromPrefab('Enemy', 'Enemy1');
```

---

### Pattern 4: Tags and Filters

**Unity ECS:**
```csharp
// Tag component (zero-size)
public struct PlayerTag : IComponentData {}

// Query with tag
EntityQuery query = GetEntityQuery(
    typeof(Translation),
    typeof(PlayerTag)
);

// Exclude tag
EntityQuery query = GetEntityQuery(
    typeof(Translation),
    ComponentType.Exclude<EnemyTag>()
);
```

**OrionECS:**
```typescript
// No need for tag components - use string tags
entity.addTag('player');
entity.addTag('active');

// Query with tags
const query = engine.createQuery({
  all: [Position],
  tags: ['player', 'active']
});

// Exclude tags
const query = engine.createQuery({
  all: [Position],
  withoutTags: ['enemy']
});
```

---

### Pattern 5: Entity Command Buffer

**Unity ECS:**
```csharp
public class SpawnerSystem : SystemBase
{
    private EndSimulationEntityCommandBufferSystem ecbSystem;

    protected override void OnCreate()
    {
        ecbSystem = World.GetOrCreateSystem<EndSimulationEntityCommandBufferSystem>();
    }

    protected override void OnUpdate()
    {
        var ecb = ecbSystem.CreateCommandBuffer().AsParallelWriter();

        Entities.ForEach((int entityInQueryIndex, in Spawner spawner) =>
        {
            var entity = ecb.CreateEntity(entityInQueryIndex);
            ecb.AddComponent(entityInQueryIndex, entity, new Translation());
        }).ScheduleParallel();

        ecbSystem.AddJobHandleForProducer(Dependency);
    }
}
```

**OrionECS:**
```typescript
// OrionECS automatically defers entity changes
engine.createSystem('SpawnerSystem',
  { all: [Spawner] },
  {
    act: (entity, spawner) => {
      // Create entities during system execution
      const newEntity = engine.createEntity('Spawned');
      newEntity.addComponent(Position, 0, 0);

      // Deletions are automatically deferred
      if (spawner.shouldDespawn) {
        entity.queueFree();
      }
    }
  }
);

// Changes are applied after all systems run
// No manual command buffer management needed
```

---

## Example Conversions

### Example 1: Movement System

**Unity ECS:**
```csharp
using Unity.Entities;
using Unity.Transforms;
using Unity.Mathematics;

public partial class MovementSystem : SystemBase
{
    protected override void OnUpdate()
    {
        float deltaTime = SystemAPI.Time.DeltaTime;

        Entities
            .WithAll<Player>()
            .ForEach((ref Translation translation, in Velocity velocity) =>
            {
                translation.Value += velocity.Value * deltaTime;
            })
            .ScheduleParallel();
    }
}

public struct Velocity : IComponentData
{
    public float3 Value;
}
```

**OrionECS:**
```typescript
class Velocity {
  constructor(public dx = 0, public dy = 0) {}
}

class Position {
  constructor(public x = 0, public y = 0) {}
}

engine.createSystem('MovementSystem',
  {
    all: [Position, Velocity],
    tags: ['player']
  },
  {
    priority: 500,
    act: (entity, position, velocity) => {
      const deltaTime = 1 / 60; // Fixed timestep
      position.x += velocity.dx * deltaTime;
      position.y += velocity.dy * deltaTime;
    }
  },
  true // Fixed update
);
```

---

### Example 2: Spawner System

**Unity ECS:**
```csharp
public partial class SpawnerSystem : SystemBase
{
    private BeginSimulationEntityCommandBufferSystem m_CommandBufferSystem;

    protected override void OnCreate()
    {
        m_CommandBufferSystem = World.GetOrCreateSystem<BeginSimulationEntityCommandBufferSystem>();
    }

    protected override void OnUpdate()
    {
        var commandBuffer = m_CommandBufferSystem.CreateCommandBuffer();

        Entities.ForEach((ref Spawner spawner) =>
        {
            spawner.SpawnTimer -= SystemAPI.Time.DeltaTime;

            if (spawner.SpawnTimer <= 0)
            {
                var entity = commandBuffer.Instantiate(spawner.Prefab);
                spawner.SpawnTimer = spawner.SpawnInterval;
            }
        }).Run();

        m_CommandBufferSystem.AddJobHandleForProducer(Dependency);
    }
}
```

**OrionECS:**
```typescript
class Spawner {
  constructor(
    public prefabName: string,
    public spawnInterval: number,
    public spawnTimer: number = 0
  ) {}
}

engine.createSystem('SpawnerSystem',
  { all: [Spawner, Position] },
  {
    act: (entity, spawner, position) => {
      const deltaTime = 1 / 60;
      spawner.spawnTimer -= deltaTime;

      if (spawner.spawnTimer <= 0) {
        const spawned = engine.createFromPrefab(spawner.prefabName);
        const spawnedPos = spawned.getComponent(Position);
        spawnedPos.x = position.x;
        spawnedPos.y = position.y;

        spawner.spawnTimer = spawner.spawnInterval;
      }
    }
  },
  true // Fixed update
);
```

---

### Example 3: Collision Detection

**Unity ECS:**
```csharp
public partial class CollisionSystem : SystemBase
{
    protected override void OnUpdate()
    {
        var ecb = new EntityCommandBuffer(Allocator.TempJob);

        // Get all collidables
        var entities = GetEntityQuery(typeof(Translation), typeof(Collider)).ToEntityArray(Allocator.Temp);

        for (int i = 0; i < entities.Length; i++)
        {
            var entityA = entities[i];
            var translationA = EntityManager.GetComponentData<Translation>(entityA);
            var colliderA = EntityManager.GetComponentData<Collider>(entityA);

            for (int j = i + 1; j < entities.Length; j++)
            {
                var entityB = entities[j];
                var translationB = EntityManager.GetComponentData<Translation>(entityB);
                var colliderB = EntityManager.GetComponentData<Collider>(entityB);

                float distance = math.distance(translationA.Value, translationB.Value);

                if (distance < colliderA.Radius + colliderB.Radius)
                {
                    // Handle collision
                    ecb.DestroyEntity(entityA);
                    ecb.DestroyEntity(entityB);
                }
            }
        }

        ecb.Playback(EntityManager);
        ecb.Dispose();
        entities.Dispose();
    }
}
```

**OrionECS:**
```typescript
class Collider {
  constructor(public radius: number = 10) {}
}

engine.createSystem('CollisionSystem',
  { all: [Position, Collider] },
  {
    act: (entity, position, collider) => {
      const others = engine.createQuery({ all: [Position, Collider] })
        .getEntities();

      for (const other of others) {
        if (other === entity) continue;

        const otherPos = other.getComponent(Position);
        const otherCol = other.getComponent(Collider);

        const dx = position.x - otherPos.x;
        const dy = position.y - otherPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < collider.radius + otherCol.radius) {
          // Handle collision
          entity.queueFree();
          other.queueFree();
          break;
        }
      }
    }
  },
  true
);
```

---

## What's Different

### Missing from OrionECS (compared to Unity ECS)

1. **No Archetypes** - OrionECS doesn't group entities by component composition (yet)
2. **No Job System** - Single-threaded, no built-in parallel execution
3. **No Burst Compiler** - No SIMD optimizations
4. **No Chunks** - Different memory layout
5. **No BlobAssets** - No immutable shared data
6. **No Write Groups** - Different approach to exclusive component access
7. **No System State Components** - No automatic cleanup tracking

### Different in OrionECS

1. **String-based Tags** - Unity uses zero-size tag components, OrionECS uses string tags
2. **Named Entities** - OrionECS entities have optional names for debugging
3. **Simpler Prefabs** - OrionECS prefabs are declarative, not entity-based
4. **Automatic Cleanup** - Parent-child destruction is automatic
5. **Message Bus** - Built-in inter-system communication
6. **Plugin System** - Extensibility via plugins
7. **Debug Mode** - Built-in comprehensive debugging

---

## What's Similar

1. **Core ECS Philosophy** - Both use entity-component-system architecture
2. **Data-Oriented Design** - Components are data, systems are behavior
3. **Query-Based Systems** - Systems process entities matching queries
4. **Deferred Changes** - Entity destruction is deferred
5. **Component Validation** - Both support component requirements
6. **Fixed/Variable Update** - Both support different update frequencies

---

## Performance Considerations

### Unity ECS Advantages

- **Archetypes and Chunks** provide better cache locality
- **Job System** enables parallel execution
- **Burst Compiler** provides SIMD optimizations
- Better for games with 100,000+ entities

### OrionECS Advantages

- **Simpler API** - Less boilerplate, easier to learn
- **TypeScript** - Better tooling, type safety, IDE support
- **Flexible** - Easier to prototype and iterate
- **Debuggable** - Better debugging tools and error messages
- Better for web games and moderate entity counts (1,000-10,000)

---

## Migration Checklist

When migrating from Unity ECS to OrionECS:

- [ ] Convert `IComponentData` structs to TypeScript classes
- [ ] Replace `EntityManager` calls with `Engine` API
- [ ] Convert `SystemBase.OnUpdate()` to `engine.createSystem()`
- [ ] Replace archetypes with prefabs
- [ ] Convert queries to OrionECS query syntax
- [ ] Replace tag components with string tags
- [ ] Replace `EntityCommandBuffer` with `queueFree()`
- [ ] Remove job scheduling and Burst code
- [ ] Adapt for single-threaded execution
- [ ] Replace `float3`/`quaternion` with simple numbers
- [ ] Add debug mode for development
- [ ] Set up fixed/variable update systems

---

## Resources

- [OrionECS README](../../README.md)
- [OrionECS Cookbook](../COOKBOOK.md)
- [Unity DOTS Documentation](https://docs.unity3d.com/Packages/com.unity.entities@latest)
- [Game Examples](../../examples/games/)

---

## Getting Help

If you're stuck migrating from Unity ECS:

1. Check the [Cookbook](../COOKBOOK.md) for common patterns
2. Review [example games](../../examples/games/) for reference implementations
3. Open an issue on GitHub with your specific question
4. Join the community discussions

**Welcome to OrionECS! 🎮**
