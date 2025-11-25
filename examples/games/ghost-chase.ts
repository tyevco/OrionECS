/**
 * Pac-Man Ghost AI using Decision Trees
 *
 * This example demonstrates the pure ECS approach:
 * - Decision trees decide WHAT intent components to add/remove
 * - ECS systems implement the actual behaviors
 *
 * Ghost personalities:
 * - Blinky (Red): Direct chaser
 * - Pinky (Pink): Ambusher (targets ahead of Pac-Man)
 * - Inky (Cyan): Unpredictable (uses Blinky's position)
 * - Clyde (Orange): Shy (chases when far, scatters when close)
 */

import { EngineBuilder, Entity } from '@orion-ecs/core';
import { DecisionTreePlugin, decide } from '@orion-ecs/decision-tree';

// =============================================================================
// COMPONENTS
// =============================================================================

// --- Core Components ---

class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

class Movement {
  constructor(
    public direction: Direction = Direction.None,
    public speed: number = 1
  ) {}
}

enum Direction {
  None = 'none',
  Up = 'up',
  Down = 'down',
  Left = 'left',
  Right = 'right',
}

// --- Identity Components ---

class PacMan {
  constructor(public lives: number = 3, public score: number = 0) {}
}

class Ghost {
  constructor(
    public personality: 'blinky' | 'pinky' | 'inky' | 'clyde' = 'blinky',
    public homeCorner: { x: number; y: number } = { x: 0, y: 0 }
  ) {}
}

// --- Intent Components (What the decision tree sets) ---

class Scattering {
  constructor(public targetX: number, public targetY: number) {}
}

class ChasingPacMan {}

class Frightened {
  constructor(public timeRemaining: number = 6) {}
}

class Eaten {}

class InGhostHouse {}

class ExitingGhostHouse {}

// --- State Components (Set by systems, read by predicates) ---

class GhostTarget {
  constructor(public x: number = 0, public y: number = 0) {}
}

// =============================================================================
// SINGLETON COMPONENTS
// =============================================================================

class GameState {
  constructor(
    public phase: 'scatter' | 'chase' = 'scatter',
    public phaseTimer: number = 7,
    public frightenedTimer: number = 0
  ) {}
}

// =============================================================================
// ENGINE SETUP
// =============================================================================

function createEngine() {
  const engine = new EngineBuilder()
    .use(new DecisionTreePlugin({ enableTracing: true }))
    .build();

  // Register components
  [
    Position, Movement, PacMan, Ghost, GhostTarget,
    Scattering, ChasingPacMan, Frightened, Eaten,
    InGhostHouse, ExitingGhostHouse
  ].forEach(c => engine.registerComponent(c));

  // Set up singleton
  engine.setSingleton(GameState);

  return engine;
}

// =============================================================================
// PREDICATES
// =============================================================================

function registerPredicates(engine: ReturnType<typeof createEngine>) {
  const dt = engine.decisions;

  // --- Game State Predicates ---

  dt.predicate('game.isScatterPhase', (_entity, _args, ctx) => {
    const state = ctx.getSingleton(GameState);
    return state?.phase === 'scatter';
  });

  dt.predicate('game.isChasePhase', (_entity, _args, ctx) => {
    const state = ctx.getSingleton(GameState);
    return state?.phase === 'chase';
  });

  dt.predicate('game.isFrightened', (_entity, _args, ctx) => {
    const state = ctx.getSingleton(GameState);
    return (state?.frightenedTimer ?? 0) > 0;
  });

  // --- Ghost State Predicates ---

  dt.predicate('ghost.isEaten', (entity) =>
    entity.hasComponent(Eaten)
  );

  dt.predicate('ghost.isInHouse', (entity) =>
    entity.hasComponent(InGhostHouse)
  );

  dt.predicate('ghost.isFrightened', (entity) =>
    entity.hasComponent(Frightened)
  );

  // --- Personality Predicates ---

  dt.predicate('ghost.isBlinky', (entity) =>
    entity.getComponent(Ghost)?.personality === 'blinky'
  );

  dt.predicate('ghost.isPinky', (entity) =>
    entity.getComponent(Ghost)?.personality === 'pinky'
  );

  dt.predicate('ghost.isInky', (entity) =>
    entity.getComponent(Ghost)?.personality === 'inky'
  );

  dt.predicate('ghost.isClyde', (entity) =>
    entity.getComponent(Ghost)?.personality === 'clyde'
  );

  // --- Distance Predicates ---

  dt.predicate('ghost.nearPacMan', (entity, { distance = 8 }) => {
    const ghostPos = entity.getComponent(Position);
    if (!ghostPos) return false;

    // In real implementation, query for Pac-Man position
    const pacManPos = { x: 14, y: 23 }; // Placeholder

    const dx = ghostPos.x - pacManPos.x;
    const dy = ghostPos.y - pacManPos.y;
    return Math.sqrt(dx * dx + dy * dy) < distance;
  });

  dt.predicate('ghost.atGhostHouse', (entity) => {
    const pos = entity.getComponent(Position);
    if (!pos) return false;

    const houseCenter = { x: 14, y: 17 };
    const dx = pos.x - houseCenter.x;
    const dy = pos.y - houseCenter.y;
    return Math.sqrt(dx * dx + dy * dy) < 2;
  });
}

// =============================================================================
// DECISION TREES
// =============================================================================

function registerDecisionTrees(engine: ReturnType<typeof createEngine>) {
  const dt = engine.decisions;

  // ---------------------------------------------------------------------------
  // Blinky (Red) - Direct Chaser
  // ---------------------------------------------------------------------------

  const blinkyTree = decide('BlinkyAI')
    .name('Blinky Decision Tree')
    .selector()
      // Priority 1: If eaten, remove other intents
      .sequence('Eaten')
        .predicate('ghost.isEaten')
        .remove(ChasingPacMan)
        .remove(Scattering)
        .remove(Frightened)
        // Eaten component already present, system handles return
      .end()

      // Priority 2: If in ghost house, exit
      .sequence('InHouse')
        .predicate('ghost.isInHouse')
        .remove(ChasingPacMan)
        .remove(Scattering)
        .add(ExitingGhostHouse)
      .end()

      // Priority 3: If game is frightened, become frightened
      .sequence('Frightened')
        .predicate('game.isFrightened')
        .not('ghost.isEaten')
        .remove(ChasingPacMan)
        .remove(Scattering)
        .add(Frightened)
      .end()

      // Priority 4: Scatter phase
      .sequence('Scatter')
        .predicate('game.isScatterPhase')
        .remove(ChasingPacMan)
        .remove(Frightened)
        .add(Scattering, 25, 0) // Blinky's corner: top-right
      .end()

      // Priority 5: Chase phase (default for Blinky)
      .sequence('Chase')
        .remove(Scattering)
        .remove(Frightened)
        .add(ChasingPacMan)
      .end()
    .end()
    .build();

  dt.register(blinkyTree);

  // ---------------------------------------------------------------------------
  // Clyde (Orange) - Shy (different from others)
  // ---------------------------------------------------------------------------

  const clydeTree = decide('ClydeAI')
    .name('Clyde Decision Tree')
    .selector()
      // Priority 1-3: Same as Blinky (Eaten, InHouse, Frightened)
      .sequence('Eaten')
        .predicate('ghost.isEaten')
        .remove(ChasingPacMan)
        .remove(Scattering)
        .remove(Frightened)
      .end()

      .sequence('InHouse')
        .predicate('ghost.isInHouse')
        .add(ExitingGhostHouse)
      .end()

      .sequence('Frightened')
        .predicate('game.isFrightened')
        .not('ghost.isEaten')
        .remove(ChasingPacMan)
        .remove(Scattering)
        .add(Frightened)
      .end()

      // Priority 4: Scatter phase
      .sequence('Scatter')
        .predicate('game.isScatterPhase')
        .remove(ChasingPacMan)
        .add(Scattering, 0, 30) // Clyde's corner: bottom-left
      .end()

      // Priority 5: Chase but scatter if too close (Clyde's unique behavior!)
      .sequence('TooClose')
        .predicate('game.isChasePhase')
        .predicate('ghost.nearPacMan', { distance: 8 })
        .remove(ChasingPacMan)
        .add(Scattering, 0, 30) // Run to corner when close
      .end()

      // Priority 6: Chase when far
      .sequence('Chase')
        .predicate('game.isChasePhase')
        .remove(Scattering)
        .add(ChasingPacMan)
      .end()
    .end()
    .build();

  dt.register(clydeTree);

  // Pinky and Inky would be similar structures
  // The difference is in the SYSTEMS that handle their targeting
}

// =============================================================================
// BEHAVIOR SYSTEMS
// =============================================================================

function createBehaviorSystems(engine: ReturnType<typeof createEngine>) {

  // ---------------------------------------------------------------------------
  // Scatter System - Move toward home corner
  // ---------------------------------------------------------------------------

  engine.createSystem('ScatterSystem', {
    all: [Scattering, Position, Movement, Ghost]
  }, {
    priority: 50,
    act: (entity, scattering, pos, movement, _ghost) => {
      // Move toward scatter target
      const dx = scattering.targetX - pos.x;
      const dy = scattering.targetY - pos.y;

      // Simple direction choice (real implementation would use pathfinding)
      if (Math.abs(dx) > Math.abs(dy)) {
        movement.direction = dx > 0 ? Direction.Right : Direction.Left;
      } else {
        movement.direction = dy > 0 ? Direction.Down : Direction.Up;
      }

      movement.speed = 0.75;
    }
  });

  // ---------------------------------------------------------------------------
  // Chase System - Each personality calculates target differently
  // ---------------------------------------------------------------------------

  engine.createSystem('BlinkyChaseSystem', {
    all: [ChasingPacMan, Position, Movement, Ghost, GhostTarget]
  }, {
    priority: 50,
    act: (entity, _chasing, pos, movement, ghost, target) => {
      if (ghost.personality !== 'blinky') return;

      // Blinky targets Pac-Man directly
      // In real implementation, query for Pac-Man position
      const pacManPos = { x: 14, y: 23 };

      target.x = pacManPos.x;
      target.y = pacManPos.y;

      // Move toward target
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;

      if (Math.abs(dx) > Math.abs(dy)) {
        movement.direction = dx > 0 ? Direction.Right : Direction.Left;
      } else {
        movement.direction = dy > 0 ? Direction.Down : Direction.Up;
      }

      movement.speed = 0.75;
    }
  });

  engine.createSystem('PinkyChaseSystem', {
    all: [ChasingPacMan, Position, Movement, Ghost, GhostTarget]
  }, {
    priority: 50,
    act: (entity, _chasing, pos, movement, ghost, target) => {
      if (ghost.personality !== 'pinky') return;

      // Pinky targets 4 tiles ahead of Pac-Man
      const pacManPos = { x: 14, y: 23 };
      const pacManDir = Direction.Left; // Would query this

      // Calculate 4 tiles ahead
      target.x = pacManPos.x;
      target.y = pacManPos.y;

      switch (pacManDir) {
        case Direction.Up: target.y -= 4; target.x -= 4; break; // Original bug!
        case Direction.Down: target.y += 4; break;
        case Direction.Left: target.x -= 4; break;
        case Direction.Right: target.x += 4; break;
      }

      // Move toward target (same as Blinky)
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;

      if (Math.abs(dx) > Math.abs(dy)) {
        movement.direction = dx > 0 ? Direction.Right : Direction.Left;
      } else {
        movement.direction = dy > 0 ? Direction.Down : Direction.Up;
      }

      movement.speed = 0.75;
    }
  });

  // Clyde uses ChasingPacMan the same as Blinky when the component is present
  // The decision tree handles when to add/remove it based on distance

  // ---------------------------------------------------------------------------
  // Frightened System - Random movement
  // ---------------------------------------------------------------------------

  engine.createSystem('FrightenedSystem', {
    all: [Frightened, Position, Movement]
  }, {
    priority: 50,
    act: (entity, frightened, pos, movement) => {
      // Random direction at intersections
      const directions = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];
      movement.direction = directions[Math.floor(Math.random() * 4)];
      movement.speed = 0.5; // Slower when frightened

      // Decrement timer
      frightened.timeRemaining -= 1 / 60;
      if (frightened.timeRemaining <= 0) {
        entity.removeComponent(Frightened);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Eaten System - Return to ghost house
  // ---------------------------------------------------------------------------

  engine.createSystem('EatenSystem', {
    all: [Eaten, Position, Movement]
  }, {
    priority: 50,
    act: (entity, _eaten, pos, movement) => {
      const houseCenter = { x: 14, y: 17 };

      // Move toward ghost house
      const dx = houseCenter.x - pos.x;
      const dy = houseCenter.y - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 1) {
        // Arrived at ghost house
        entity.removeComponent(Eaten);
        entity.addComponent(InGhostHouse);
        return;
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        movement.direction = dx > 0 ? Direction.Right : Direction.Left;
      } else {
        movement.direction = dy > 0 ? Direction.Down : Direction.Up;
      }

      movement.speed = 2.0; // Fast when returning
    }
  });

  // ---------------------------------------------------------------------------
  // Exit Ghost House System
  // ---------------------------------------------------------------------------

  engine.createSystem('ExitGhostHouseSystem', {
    all: [ExitingGhostHouse, InGhostHouse, Position]
  }, {
    priority: 50,
    act: (entity, _exiting, _inHouse, pos) => {
      const exitY = 14; // Y position of ghost house exit

      if (pos.y > exitY) {
        pos.y -= 0.1;
      } else {
        // Exited!
        entity.removeComponent(InGhostHouse);
        entity.removeComponent(ExitingGhostHouse);
      }
    }
  });
}

// =============================================================================
// ENTITY CREATION
// =============================================================================

function createGhost(
  engine: ReturnType<typeof createEngine>,
  personality: 'blinky' | 'pinky' | 'inky' | 'clyde',
  startX: number,
  startY: number,
  homeCorner: { x: number; y: number },
  treeId: string
): Entity {
  const ghost = engine.createEntity(`Ghost_${personality}`);

  ghost.addComponent(Position, startX, startY);
  ghost.addComponent(Movement, Direction.Left, 0.75);
  ghost.addComponent(Ghost, personality, homeCorner);
  ghost.addComponent(GhostTarget, homeCorner.x, homeCorner.y);

  // Blinky starts outside, others start in house
  if (personality !== 'blinky') {
    ghost.addComponent(InGhostHouse);
  }

  // Assign decision tree
  engine.decisions.assign(ghost, treeId);

  ghost.addTag('ghost');
  ghost.addTag(personality);

  return ghost;
}

// =============================================================================
// MAIN
// =============================================================================

export function setupPacManGame() {
  const engine = createEngine();

  registerPredicates(engine);
  registerDecisionTrees(engine);
  createBehaviorSystems(engine);

  // Create Pac-Man
  const pacMan = engine.createEntity('PacMan');
  pacMan.addComponent(Position, 14, 23);
  pacMan.addComponent(Movement, Direction.None, 0.8);
  pacMan.addComponent(PacMan, 3, 0);

  // Create ghosts
  const blinky = createGhost(engine, 'blinky', 14, 14, { x: 25, y: 0 }, 'BlinkyAI');
  const clyde = createGhost(engine, 'clyde', 16, 17, { x: 0, y: 30 }, 'ClydeAI');

  // For Pinky and Inky, we'd register their trees similarly
  // They differ in chase system targeting, not decision tree structure

  return { engine, pacMan, blinky, clyde };
}

// =============================================================================
// QUERYING AI STATE (The Power of ECS!)
// =============================================================================

export function debugGhosts(engine: ReturnType<typeof createEngine>) {
  console.log('=== Ghost States ===\n');

  // Query ghosts by intent - only possible because intent = component!

  const chasingGhosts = engine.createQuery({ all: [ChasingPacMan, Ghost] });
  console.log('Chasing Pac-Man:');
  chasingGhosts.forEach((entity, _chasing, ghost) => {
    console.log(`  - ${ghost.personality}`);
  });

  const scatteringGhosts = engine.createQuery({ all: [Scattering, Ghost] });
  console.log('\nScattering:');
  scatteringGhosts.forEach((entity, scattering, ghost) => {
    console.log(`  - ${ghost.personality} → (${scattering.targetX}, ${scattering.targetY})`);
  });

  const frightenedGhosts = engine.createQuery({ all: [Frightened, Ghost] });
  console.log('\nFrightened:');
  frightenedGhosts.forEach((entity, frightened, ghost) => {
    console.log(`  - ${ghost.personality} (${frightened.timeRemaining.toFixed(1)}s remaining)`);
  });

  const eatenGhosts = engine.createQuery({ all: [Eaten, Ghost] });
  console.log('\nEaten (returning):');
  eatenGhosts.forEach((entity, _eaten, ghost) => {
    console.log(`  - ${ghost.personality}`);
  });

  // Decision tree debug info
  console.log('\n=== Decision Paths ===\n');
  const allGhosts = engine.createQuery({ all: [Ghost] });
  allGhosts.forEach((entity, ghost) => {
    const path = engine.decisions.getLastPath(entity);
    console.log(`${ghost.personality}: ${path.join(' → ')}`);
  });
}
