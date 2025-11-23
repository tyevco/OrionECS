# Console Examples

These examples demonstrate the Orion ECS framework features through command-line applications. They showcase all the enhanced ECS capabilities without requiring a visual interface.

## 📋 Available Examples

### 01 - Basic Game (`01-basic-game.ts`)
**Features Demonstrated:**
- Entity creation and management
- Component addition/removal
- Basic system execution
- Movement and collision detection
- Entity pooling and cleanup

**Run with:** `npm run example:basic`

### 02 - RPG Combat (`02-rpg-combat.ts`)  
**Features Demonstrated:**
- Health and damage systems
- Status effects and buffs
- Component validation
- Entity death and cleanup
- System priority ordering

**Run with:** `npm run example:rpg`

### 03 - Particle System (`03-particle-system.ts`)
**Features Demonstrated:**
- Object pooling efficiency
- Lifetime management
- Bulk entity operations
- Performance optimization
- Memory management

**Run with:** `npm run example:particles`

### 04 - Entity Hierarchy (`04-entity-hierarchy.ts`)
**Features Demonstrated:**
- Parent-child relationships
- Hierarchical transformations
- Automatic child cleanup
- Relative positioning
- Tree traversal

**Run with:** `npm run example:hierarchy`

### 05 - Save/Load System (`05-save-load-system.ts`)
**Features Demonstrated:**
- World state serialization
- Entity data persistence
- Component serialization
- State restoration
- Snapshot management

**Run with:** `npm run example:save-load`

### 06 - Event Messaging (`06-event-messaging.ts`)
**Features Demonstrated:**
- Inter-system communication
- Event publishing/subscribing
- Message routing
- Decoupled architecture
- Event-driven gameplay

**Run with:** `npm run example:messaging`

## 🚀 Running Examples

### Individual Examples
```bash
# Run specific examples
npm run example:basic
npm run example:rpg
npm run example:particles
npm run example:hierarchy  
npm run example:save-load
npm run example:messaging
```

### Direct Execution
```bash
# Alternative method using ts-node directly
npx ts-node examples/console-examples/01-basic-game.ts
npx ts-node examples/console-examples/02-rpg-combat.ts
# ... etc
```

## 📚 Learning Path

**Recommended order for learning:**

1. **Basic Game** - Core ECS concepts
2. **RPG Combat** - System interactions and validation
3. **Particle System** - Performance and memory management
4. **Entity Hierarchy** - Advanced entity relationships
5. **Event Messaging** - Decoupled communication patterns
6. **Save/Load System** - State persistence

## 🔧 Code Structure

Each example follows this pattern:
```typescript
// 1. Component definitions
class Position { /* ... */ }
class Health { /* ... */ }

// 2. System setup with engine
const engine = new Engine(60, true);
engine.createSystem(/* ... */);

// 3. Entity creation and population
const entity = engine.createEntity();
entity.addComponent(/* ... */);

// 4. Simulation execution
for (let i = 0; i < steps; i++) {
    engine.update(deltaTime);
}

// 5. Results analysis
console.log('Results:', /* analysis */);
```

## 💡 Key Concepts Demonstrated

- **Entity Management**: Creation, deletion, and pooling
- **Component Design**: Data-only structures with validation
- **System Architecture**: Priority-based execution with lifecycle hooks
- **Query System**: ALL/ANY/NOT queries with tag filtering
- **Performance**: Profiling, memory management, and optimization
- **Architecture**: Decoupled, scalable, and maintainable code

## 🎯 Performance Analysis

Each example includes performance analysis:
- Execution timing
- Memory usage
- System profiles
- Entity counts
- Operation benchmarks

Use these examples to understand:
- How different features impact performance
- Best practices for entity/component design
- System organization strategies
- Memory management techniques

## 📊 Output Examples

Console examples provide detailed output showing:
```
🎮 Orion ECS Example - Basic Game
Creating entities...
✅ Created 100 entities in 2.34ms
Running simulation...
⚡ Update 1: 98 entities processed (1.12ms)
⚡ Update 2: 96 entities processed (1.08ms)
📊 Final Results:
  - Entities: 95
  - Average update time: 1.1ms
  - Memory usage: 2.4KB
```

Each example demonstrates different aspects of the framework while providing concrete performance data and usage patterns.