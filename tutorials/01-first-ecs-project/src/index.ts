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

// Get a tagged logger for this tutorial
const log = engine.logger.withTag('Tutorial');

// Register our component types with the engine
engine.registerComponent(Position);
engine.registerComponent(Velocity);
engine.registerComponent(Renderable);

/**
 * Create a few entities with different behaviors
 */
function createEntities() {
  log.info('--- Creating Entities ---');

  // Entity 1: Moving right
  const entity1 = engine.createEntity('Particle1');
  entity1.addComponent(Position, 0, 10);
  entity1.addComponent(Velocity, 1, 0);
  entity1.addComponent(Renderable, '→', 'cyan');
  log.info(`Created ${entity1.name} (moving right)`);

  // Entity 2: Moving diagonally up-right
  const entity2 = engine.createEntity('Particle2');
  entity2.addComponent(Position, 0, 12);
  entity2.addComponent(Velocity, 0.5, 0.5);
  entity2.addComponent(Renderable, '↗', 'magenta');
  log.info(`Created ${entity2.name} (moving diagonally)`);

  // Entity 3: Moving up
  const entity3 = engine.createEntity('Particle3');
  entity3.addComponent(Position, 0, 14);
  entity3.addComponent(Velocity, 0, -1);
  entity3.addComponent(Renderable, '↑', 'yellow');
  log.info(`Created ${entity3.name} (moving up)`);

  log.info(`Total entities created: ${engine.entityCount}`);
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
    act: (_entity, pos, vel) => {
      // Type assertions for components (passed in query order)
      const position = pos as Position;
      const velocity = vel as Velocity;

      // Update position based on velocity
      position.x += velocity.x;
      position.y += velocity.y;
    }
  }
  // Note: omitting the 4th parameter defaults to variable update (runs every frame)
);

log.info('MovementSystem created');

// Create a render logger for the render system output
const renderLog = engine.logger.withTag('Render');

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
      renderLog.info('--- Frame ' + frameCount + ' ---');
    },
    act: (entity, pos, rend) => {
      // Type assertions for components (passed in query order)
      const position = pos as Position;
      const renderable = rend as Renderable;

      // Simple console rendering
      const x = Math.round(position.x).toString().padStart(3);
      const y = Math.round(position.y).toString().padStart(3);
      const name = entity.name || 'Unknown';
      renderLog.info(`${renderable.symbol} ${name} at (${x}, ${y})`);
    },
    after: () => {
      renderLog.info(`Entities: ${engine.entityCount}`);
    }
  }
);

log.info('RenderSystem created');

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
    log.info('=== Simulation Complete! ===');
    log.info(`Total frames: ${frameCount}`);
    log.info('Final positions:');

    // Display final state using a query
    // createQuery is the preferred API for one-off queries
    const query = engine.createQuery({ all: [Position] });
    for (const entity of query.getEntities()) {
      const pos = entity.getComponent(Position)!;
      const x = Math.round(pos.x).toString().padStart(3);
      const y = Math.round(pos.y).toString().padStart(3);
      const name = entity.name || 'Unknown';
      log.info(`  ${name}: (${x}, ${y})`);
    }

    log.info('Try the challenges in the tutorial to learn more!');
    log.info('Next: Tutorial 2 - Understanding Entities, Components, and Systems');
  }
}

// Start the simulation
log.info('--- Starting Simulation ---');
setTimeout(() => update(), 500); // Small delay before starting
