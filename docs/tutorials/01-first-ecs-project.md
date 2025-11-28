# Tutorial 1: Your First ECS Project

**Difficulty:** Beginner
**Time:** ~20 minutes
**Prerequisites:** None

## What You'll Learn

- How to install and set up OrionECS in a new project
- What entities, components, and systems are and how they work together
- How to create a simple movement simulation
- How to run the ECS update loop
- Basic debugging and visualization techniques

## Prerequisites

**Knowledge:**
- Basic JavaScript or TypeScript syntax
- Understanding of object-oriented programming concepts
- Familiarity with npm and the command line

**Setup:**
- Node.js installed (v14 or higher)
- A code editor (VS Code recommended)
- Terminal or command prompt access

## Introduction

### Why This Matters

Entity Component System (ECS) is a powerful architectural pattern used in many modern game engines and simulations. Instead of using traditional inheritance hierarchies, ECS separates data (components) from behavior (systems) and treats game objects (entities) as simple containers.

This approach provides:
- **Better performance**: Systems process components in tight loops, improving cache locality
- **Greater flexibility**: Add/remove behaviors by composing components
- **Easier maintenance**: Logic is centralized in systems rather than scattered across classes
- **Better scalability**: Easily handle thousands of entities efficiently

### Real-World Use Cases

- **Games**: From simple arcade games to complex RPGs and simulations
- **Physics simulations**: Particle systems, fluid dynamics, soft body physics
- **Visual effects**: Thousands of particles, trails, and procedural animations
- **Data processing**: High-performance batch processing of structured data

## Step-by-Step Guide

### Step 1: Create a New Project

Let's start by creating a new Node.js project and installing OrionECS.

```bash
# Create a new directory for your project
mkdir my-first-ecs
cd my-first-ecs

# Initialize a new npm project
npm init -y

# Install OrionECS
npm install @orion-ecs/core

# Install TypeScript and development dependencies
npm install --save-dev typescript ts-node @types/node

# Initialize TypeScript configuration
npx tsc --init
```

**Explanation:**
- `npm init -y`: Creates a package.json file with default settings
- `npm install @orion-ecs/core`: Installs the OrionECS framework
- TypeScript dependencies: Allow us to use TypeScript for better development experience
- `tsc --init`: Creates a tsconfig.json with sensible defaults

### Step 2: Configure TypeScript

Update your `tsconfig.json` to use these settings:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Explanation:**
- `target: "ES2020"`: Use modern JavaScript features
- `strict: true`: Enable all strict type checking options for safety
- `outDir` and `rootDir`: Keep source and compiled code organized

### Step 3: Create Your First Components

Components are pure data structures that hold state. Create `src/components.ts`:

```typescript
// src/components.ts

/**
 * Position component stores x and y coordinates
 */
export class Position {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}
}

/**
 * Velocity component stores movement speed
 */
export class Velocity {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}
}

/**
 * Renderable component marks entities that should be displayed
 */
export class Renderable {
  constructor(
    public symbol: string = '•',
    public color: string = 'white'
  ) {}
}
```

**Explanation:**
- **Position**: Where an entity is located in 2D space
- **Velocity**: How fast and in what direction an entity moves
- **Renderable**: Visual representation (we'll just use text symbols for now)
- Components are just data - no methods or behavior
- Default values make components easier to instantiate

### Step 4: Build the Engine and Create Entities

Now let's create the engine and add some entities. Create `src/index.ts`:

```typescript
// src/index.ts
import { EngineBuilder } from '@orion-ecs/core';
import { Position, Velocity, Renderable } from './components';

// Build the engine with debug mode enabled
const engine = new EngineBuilder()
  .withDebugMode(true)
  .build();

// Register our component types
engine.registerComponent(Position);
engine.registerComponent(Velocity);
engine.registerComponent(Renderable);

// Create a few entities with different behaviors
function createEntities() {
  // Entity 1: Moving right
  const entity1 = engine.createEntity('Particle1');
  entity1.addComponent(Position, 0, 10);
  entity1.addComponent(Velocity, 1, 0);
  entity1.addComponent(Renderable, '→', 'cyan');

  // Entity 2: Moving diagonally
  const entity2 = engine.createEntity('Particle2');
  entity2.addComponent(Position, 0, 12);
  entity2.addComponent(Velocity, 0.5, 0.5);
  entity2.addComponent(Renderable, '↗', 'magenta');

  // Entity 3: Moving up
  const entity3 = engine.createEntity('Particle3');
  entity3.addComponent(Position, 0, 14);
  entity3.addComponent(Velocity, 0, -1);
  entity3.addComponent(Renderable, '↑', 'yellow');

  console.log(`Created ${engine.entityCount} entities`);
}

createEntities();
```

**Explanation:**
- **EngineBuilder**: Fluent API for configuring the engine
- **Debug mode**: Provides helpful error messages during development
- **registerComponent**: Tells the engine about our component types
- **createEntity**: Creates a new entity with an optional name
- **addComponent**: Attaches a component to an entity with initial values
- We create 3 entities with different positions, velocities, and symbols

### Step 5: Create a Movement System

Systems contain the logic that operates on entities. Add this to `src/index.ts`:

```typescript
// Add after createEntities() in src/index.ts

/**
 * MovementSystem updates entity positions based on their velocity
 */
engine.createSystem(
  'MovementSystem',
  {
    all: [Position, Velocity]  // Only process entities with BOTH components
  },
  {
    act: (entity, position, velocity) => {
      // Update position based on velocity
      position.x += velocity.x;
      position.y += velocity.y;
    }
  },
  false  // false = variable update (runs every frame)
);

console.log('MovementSystem created');
```

**Explanation:**
- **System name**: 'MovementSystem' for identification
- **Query**: `{ all: [Position, Velocity] }` - only entities with both components
- **act function**: Receives entity and its components, updates position
- **Variable update**: Runs every frame (we'll see fixed updates in later tutorials)
- The system automatically finds matching entities each frame

### Step 6: Create a Render System

Add a simple rendering system to visualize our entities:

```typescript
// Add after MovementSystem in src/index.ts

/**
 * RenderSystem displays entities in the console
 */
engine.createSystem(
  'RenderSystem',
  {
    all: [Position, Renderable]
  },
  {
    before: () => {
      // Clear console before rendering (simple approach)
      console.clear();
      console.log('='.repeat(50));
    },
    act: (entity, position, renderable) => {
      // Simple console rendering
      const x = Math.round(position.x);
      const y = Math.round(position.y);
      console.log(`${renderable.symbol} ${entity.name} at (${x}, ${y})`);
    },
    after: () => {
      console.log('='.repeat(50));
      console.log(`Frame complete. Entities: ${engine.entityCount}`);
    }
  },
  false
);

console.log('RenderSystem created');
```

**Explanation:**
- **before hook**: Runs before processing entities (clear screen)
- **act function**: Displays each entity's position
- **after hook**: Runs after processing all entities (show stats)
- System hooks are great for setup/teardown operations

### Step 7: Run the Simulation

Finally, create the main update loop:

```typescript
// Add at the end of src/index.ts

/**
 * Main update loop
 */
let frameCount = 0;
const maxFrames = 50;

function update() {
  frameCount++;

  // Update the engine (runs all systems)
  const deltaTime = 16; // ~60 FPS (16ms per frame)
  engine.update(deltaTime);

  // Run for a limited number of frames
  if (frameCount < maxFrames) {
    setTimeout(update, 100); // Slow down for visibility
  } else {
    console.log('\nSimulation complete!');
    console.log(`Total frames: ${frameCount}`);
    console.log('Final positions:');

    // Display final state
    engine.query({ all: [Position] }).forEach(entity => {
      const pos = entity.getComponent(Position);
      console.log(`  ${entity.name}: (${Math.round(pos.x)}, ${Math.round(pos.y)})`);
    });
  }
}

// Start the simulation
console.log('\nStarting simulation...\n');
update();
```

**Explanation:**
- **deltaTime**: Time since last frame (16ms ≈ 60 FPS)
- **engine.update()**: Executes all systems in order
- **setTimeout**: Creates a simple game loop (we slow it down to watch)
- **engine.query()**: Manual query to inspect entity state
- Real games would use `requestAnimationFrame` instead of setTimeout

### Step 8: Add Run Script to package.json

Update your `package.json` to include a run script:

```json
{
  "scripts": {
    "start": "ts-node src/index.ts",
    "build": "tsc",
    "dev": "ts-node --watch src/index.ts"
  }
}
```

## Complete Code

Here's the complete, runnable code for this tutorial:

**src/components.ts:**
```typescript
export class Position {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}
}

export class Velocity {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}
}

export class Renderable {
  constructor(
    public symbol: string = '•',
    public color: string = 'white'
  ) {}
}
```

**src/index.ts:**
```typescript
import { EngineBuilder } from '@orion-ecs/core';
import { Position, Velocity, Renderable } from './components';

// Build the engine
const engine = new EngineBuilder()
  .withDebugMode(true)
  .build();

// Register components
engine.registerComponent(Position);
engine.registerComponent(Velocity);
engine.registerComponent(Renderable);

// Create entities
function createEntities() {
  const entity1 = engine.createEntity('Particle1');
  entity1.addComponent(Position, 0, 10);
  entity1.addComponent(Velocity, 1, 0);
  entity1.addComponent(Renderable, '→', 'cyan');

  const entity2 = engine.createEntity('Particle2');
  entity2.addComponent(Position, 0, 12);
  entity2.addComponent(Velocity, 0.5, 0.5);
  entity2.addComponent(Renderable, '↗', 'magenta');

  const entity3 = engine.createEntity('Particle3');
  entity3.addComponent(Position, 0, 14);
  entity3.addComponent(Velocity, 0, -1);
  entity3.addComponent(Renderable, '↑', 'yellow');

  console.log(`Created ${engine.entityCount} entities`);
}

createEntities();

// Movement System
engine.createSystem(
  'MovementSystem',
  {
    all: [Position, Velocity]
  },
  {
    act: (entity, position, velocity) => {
      position.x += velocity.x;
      position.y += velocity.y;
    }
  },
  false
);

// Render System
engine.createSystem(
  'RenderSystem',
  {
    all: [Position, Renderable]
  },
  {
    before: () => {
      console.clear();
      console.log('='.repeat(50));
    },
    act: (entity, position, renderable) => {
      const x = Math.round(position.x);
      const y = Math.round(position.y);
      console.log(`${renderable.symbol} ${entity.name} at (${x}, ${y})`);
    },
    after: () => {
      console.log('='.repeat(50));
      console.log(`Frame complete. Entities: ${engine.entityCount}`);
    }
  },
  false
);

// Main loop
let frameCount = 0;
const maxFrames = 50;

function update() {
  frameCount++;
  engine.update(16);

  if (frameCount < maxFrames) {
    setTimeout(update, 100);
  } else {
    console.log('\nSimulation complete!');
    console.log(`Total frames: ${frameCount}`);
  }
}

console.log('\nStarting simulation...\n');
update();
```

**File Structure:**
```
my-first-ecs/
├── package.json
├── tsconfig.json
├── node_modules/
└── src/
    ├── components.ts
    └── index.ts
```

## Running the Code

```bash
# Make sure you're in the project directory
cd my-first-ecs

# Install dependencies (if you haven't already)
npm install

# Run the simulation
npm start
```

**Expected output:**
```
Created 3 entities
MovementSystem created
RenderSystem created

Starting simulation...

==================================================
→ Particle1 at (1, 10)
↗ Particle2 at (1, 12)
↑ Particle3 at (0, 13)
==================================================
Frame complete. Entities: 3

==================================================
→ Particle1 at (2, 10)
↗ Particle2 at (1, 13)
↑ Particle3 at (0, 12)
==================================================
Frame complete. Entities: 3

... (continues for 50 frames)

Simulation complete!
Total frames: 50
```

You should see the entities moving across the screen:
- Particle1 moves right (→)
- Particle2 moves diagonally up-right (↗)
- Particle3 moves up (↑)

## Try It Yourself

Now that you understand the basics, try these challenges:

### Challenge 1: Add More Entities (Easy)

**Task:** Create 5 more entities with random positions and velocities

**Hints:**
- Use a loop to create multiple entities
- Use `Math.random()` for random values
- Try different symbols: '●', '○', '★', '◆'

<details>
<summary>Solution</summary>

```typescript
function createRandomEntities(count: number) {
  const symbols = ['●', '○', '★', '◆', '◇', '♦', '♥', '♠'];

  for (let i = 0; i < count; i++) {
    const entity = engine.createEntity(`Random${i}`);
    entity.addComponent(Position,
      Math.random() * 20,
      Math.random() * 20
    );
    entity.addComponent(Velocity,
      (Math.random() - 0.5) * 2,  // -1 to 1
      (Math.random() - 0.5) * 2
    );
    entity.addComponent(Renderable,
      symbols[i % symbols.length],
      'green'
    );
  }
}

createRandomEntities(5);
```
</details>

### Challenge 2: Add Boundaries (Medium)

**Task:** Keep entities within a bounded area (0-80 for x, 0-24 for y) by wrapping them around

**Hints:**
- Create a new system that runs after MovementSystem
- Use modulo operator (%) to wrap coordinates
- System priority determines execution order

<details>
<summary>Solution</summary>

```typescript
engine.createSystem(
  'BoundsSystem',
  { all: [Position] },
  {
    priority: 5,  // Run after MovementSystem (default priority 10)
    act: (entity, position) => {
      // Wrap x coordinate
      if (position.x < 0) position.x = 80;
      if (position.x > 80) position.x = 0;

      // Wrap y coordinate
      if (position.y < 0) position.y = 24;
      if (position.y > 24) position.y = 0;
    }
  },
  false
);
```
</details>

### Challenge 3: Add Acceleration (Hard)

**Task:** Create an `Acceleration` component and system that modifies velocity over time

**Hints:**
- Create a new component similar to Velocity
- Create a system that updates Velocity based on Acceleration
- Entities with acceleration will speed up/slow down over time

<details>
<summary>Solution</summary>

```typescript
// Add to components.ts
export class Acceleration {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}
}

// Add to index.ts
engine.registerComponent(Acceleration);

engine.createSystem(
  'AccelerationSystem',
  { all: [Velocity, Acceleration] },
  {
    priority: 15,  // Run before MovementSystem
    act: (entity, velocity, acceleration) => {
      velocity.x += acceleration.x;
      velocity.y += acceleration.y;
    }
  },
  false
);

// Create an entity with acceleration
const acceleratingEntity = engine.createEntity('Accelerating');
acceleratingEntity.addComponent(Position, 10, 10);
acceleratingEntity.addComponent(Velocity, 0, 0);
acceleratingEntity.addComponent(Acceleration, 0.1, 0);
acceleratingEntity.addComponent(Renderable, '⇒', 'red');
```
</details>

## Key Takeaways

- **ECS separates data from logic**: Components hold data, systems contain behavior
- **Entities are just IDs**: They're containers for components, nothing more
- **Systems use queries**: `{ all: [...] }` finds entities with specific components
- **Engine coordinates everything**: Manages entities, components, and system execution
- **Composition over inheritance**: Build complex behavior by combining simple components
- **Systems are pure functions**: They transform component data each frame

## Next Steps

**Continue Learning:**
- **Tutorial 2: Understanding ECS** (Coming Soon - [Track Progress](https://github.com/tyevco/OrionECS/milestone/7))
- **Tutorial 3: Building a Particle System** (Coming Soon - [Tutorial Series Milestone](https://github.com/tyevco/OrionECS/milestone/7))

**Dive Deeper:**
- [Engine API](../../README.md#engine-api): Complete API reference
- [Examples](../../examples/): See complete game projects
- [Tutorial Series Roadmap](https://github.com/tyevco/OrionECS/milestone/7): See all 35 planned tutorials

## Troubleshooting

### Issue 1: "Cannot find module '@orion-ecs/core'"

**Problem:** TypeScript can't find the OrionECS module

**Solution:**
```bash
# Make sure OrionECS is installed
npm install @orion-ecs/core

# Clear cache and reinstall if needed
rm -rf node_modules package-lock.json
npm install
```

**Prevention:** Always run `npm install` after cloning or creating a project

### Issue 2: "Property 'addComponent' does not exist"

**Problem:** TypeScript doesn't recognize entity methods

**Solution:** Make sure you've registered the component:
```typescript
engine.registerComponent(Position);
engine.registerComponent(Velocity);
```

**Why It Happens:** OrionECS needs to know about component types before they can be used

### Issue 3: Entities Don't Move

**Problem:** Simulation runs but entities don't change position

**Solution:** Check these common issues:
1. Did you register all components?
2. Is your query correct? `{ all: [Position, Velocity] }`
3. Are you calling `engine.update(deltaTime)`?
4. Did you actually add Velocity components to your entities?

**Debugging Tip:** Enable debug mode and add console.log statements:
```typescript
const engine = new EngineBuilder()
  .withDebugMode(true)  // This helps!
  .build();
```

### Issue 4: Console Flickers or Looks Wrong

**Problem:** The console output is hard to read

**Solution:** The simple console rendering is just for learning. For real games:
- Use a proper rendering library (Canvas, Pixi.js, Three.js)
- Tutorial 29: Pixi.js Integration (Coming Soon - [See Roadmap](https://github.com/tyevco/OrionECS/milestone/7))
- Check the [examples/integrations](../../examples/integrations/) folder

## Additional Resources

- [OrionECS README](../../README.md): Complete framework documentation
- [EngineBuilder API](../../README.md#enginebuilder): All builder options
- [System Lifecycle](../../README.md#system-lifecycle): Understanding system hooks
- [ECS Overview](https://en.wikipedia.org/wiki/Entity_component_system): Wikipedia article

## Feedback

Found an issue with this tutorial? Have suggestions for improvement?

- [Open an Issue](https://github.com/tyevco/orionecs/issues)
- [Start a Discussion](https://github.com/tyevco/orionecs/discussions)

---

**Next Tutorial:** Tutorial 2: Understanding Entities, Components, and Systems ([Coming Soon](https://github.com/tyevco/OrionECS/milestone/7))
**Back to Tutorial Index:** [All Tutorials](./README.md)
