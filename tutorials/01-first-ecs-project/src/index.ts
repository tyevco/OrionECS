/**
 * Tutorial 1: Your First ECS Project
 * Main Entry Point
 *
 * This tutorial demonstrates:
 * - Creating an Engine with EngineBuilder
 * - Registering components
 * - Creating entities and adding components
 * - Creating systems with queries
 * - Running a basic update loop
 */

import { EngineBuilder } from '@orion-ecs/core';
import { Position, Velocity, Renderable } from './components';

// Build the engine with debug mode enabled for helpful error messages
const engine = new EngineBuilder()
  .withDebugMode(true)
  .build();

// Register our component types with the engine
engine.registerComponent(Position);
engine.registerComponent(Velocity);
engine.registerComponent(Renderable);

/**
 * Create a few entities with different behaviors
 */
function createEntities() {
  console.log('\n--- Creating Entities ---\n');

  // Entity 1: Moving right
  const entity1 = engine.createEntity('Particle1');
  entity1.addComponent(Position, 0, 10);
  entity1.addComponent(Velocity, 1, 0);
  entity1.addComponent(Renderable, '→', 'cyan');
  console.log(`✓ Created ${entity1.name} (moving right)`);

  // Entity 2: Moving diagonally up-right
  const entity2 = engine.createEntity('Particle2');
  entity2.addComponent(Position, 0, 12);
  entity2.addComponent(Velocity, 0.5, 0.5);
  entity2.addComponent(Renderable, '↗', 'magenta');
  console.log(`✓ Created ${entity2.name} (moving diagonally)`);

  // Entity 3: Moving up
  const entity3 = engine.createEntity('Particle3');
  entity3.addComponent(Position, 0, 14);
  entity3.addComponent(Velocity, 0, -1);
  entity3.addComponent(Renderable, '↑', 'yellow');
  console.log(`✓ Created ${entity3.name} (moving up)`);

  console.log(`\n✓ Total entities created: ${engine.getAllEntities().length}\n`);
}

// Create our entities
createEntities();

/**
 * MovementSystem updates entity positions based on their velocity
 * This system only processes entities that have BOTH Position and Velocity components
 */
engine.createSystem(
  'MovementSystem',
  {
    all: [Position, Velocity]  // Query: entities with both components
  },
  {
    act: (_entity, position, velocity) => {
      // Update position based on velocity
      // Components are passed in the same order as specified in the query
      position.x += velocity.x;
      position.y += velocity.y;
    }
  }
  // Note: omitting the 4th parameter defaults to variable update (runs every frame)
);

console.log('✓ MovementSystem created');

/**
 * RenderSystem displays entities in the console
 * This system processes entities with Position and Renderable components
 */
engine.createSystem(
  'RenderSystem',
  {
    all: [Position, Renderable]
  },
  {
    before: () => {
      // Clear console before rendering (simple approach for this tutorial)
      console.clear();
      console.log('╔' + '═'.repeat(48) + '╗');
      console.log('║' + ' OrionECS Tutorial 1: Your First ECS Project '.padEnd(48) + '║');
      console.log('╠' + '═'.repeat(48) + '╣');
    },
    act: (entity, position, renderable) => {
      // Simple console rendering
      const x = Math.round(position.x).toString().padStart(3);
      const y = Math.round(position.y).toString().padStart(3);
      const name = entity.name || 'Unknown';
      console.log(`║ ${renderable.symbol} ${name.padEnd(12)} at (${x}, ${y})           ║`);
    },
    after: () => {
      console.log('╠' + '═'.repeat(48) + '╣');
      console.log(`║ Frame: ${frameCount.toString().padStart(3)}  |  Entities: ${engine.getAllEntities().length}                    ║`);
      console.log('╚' + '═'.repeat(48) + '╝');
    }
  }
);

console.log('✓ RenderSystem created');

/**
 * Main update loop
 * In a real game, you would use requestAnimationFrame instead of setTimeout
 */
let frameCount = 0;
const maxFrames = 50;

function update() {
  frameCount++;

  // Update the engine (this runs all systems)
  const deltaTime = 16; // ~60 FPS (16ms per frame)
  engine.update(deltaTime);

  // Run for a limited number of frames for this tutorial
  if (frameCount < maxFrames) {
    setTimeout(update, 100); // Slow down for visibility (100ms delay)
  } else {
    // Simulation complete - show final statistics
    console.log('\n╔' + '═'.repeat(48) + '╗');
    console.log('║' + ' Simulation Complete! '.padEnd(48) + '║');
    console.log('╠' + '═'.repeat(48) + '╣');
    console.log(`║ Total frames: ${frameCount.toString().padEnd(35)} ║`);
    console.log('╠' + '═'.repeat(48) + '╣');
    console.log('║ Final positions:'.padEnd(49) + '║');

    // Display final state using a query
    // createQuery is the preferred API for one-off queries
    const query = engine.createQuery({ all: [Position] });
    for (const entity of query.getEntities()) {
      const pos = entity.getComponent(Position)!;
      const x = Math.round(pos.x).toString().padStart(3);
      const y = Math.round(pos.y).toString().padStart(3);
      const name = entity.name || 'Unknown';
      console.log(`║   ${name.padEnd(12)}: (${x}, ${y})              ║`);
    }

    console.log('╚' + '═'.repeat(48) + '╝');
    console.log('\nTry the challenges in the tutorial to learn more!');
    console.log('Next: Tutorial 2 - Understanding Entities, Components, and Systems\n');
  }
}

// Start the simulation
console.log('\n--- Starting Simulation ---\n');
setTimeout(() => update(), 500); // Small delay before starting
