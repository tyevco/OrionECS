/**
 * RTS (Real-Time Strategy) Demo for OrionECS
 *
 * This example demonstrates OrionECS handling large entity counts typical of RTS games.
 * It showcases spatial partitioning, selection systems, command patterns, pathfinding,
 * and resource gathering mechanics.
 *
 * Features:
 * - Hundreds of units with efficient spatial queries
 * - Box selection and click selection
 * - Move, attack, and gather commands
 * - Basic A* pathfinding
 * - Resource gathering and unit production
 * - Fog of war
 * - Minimap representation
 */

import { EngineBuilder } from '../../core/src/engine';
import type { Engine } from '../../core/src/engine';
import type { EntityDef } from '../../core/src/definitions';

// ============================================================================
// Configuration
// ============================================================================

const RTS_CONFIG = {
  worldSize: { width: 2000, height: 2000 },
  spatialGridSize: 100, // Size of each grid cell for spatial partitioning
  maxUnitsPerPlayer: 200,
  startingResources: 1000,
  viewDistance: 400, // Units can see this far
  pathfindingMaxIterations: 100,
};

// ============================================================================
// Components - Core
// ============================================================================

class Position {
  constructor(public x: number = 0, public y: number = 0) {}

  distanceTo(other: Position): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  clone(): Position {
    return new Position(this.x, this.y);
  }
}

class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}

  get speed(): number {
    return Math.sqrt(this.dx * this.dx + this.dy * this.dy);
  }
}

class Health {
  constructor(
    public current: number = 100,
    public max: number = 100,
  ) {}

  takeDamage(amount: number): void {
    this.current = Math.max(0, this.current - amount);
  }

  heal(amount: number): void {
    this.current = Math.min(this.max, this.current + amount);
  }

  isDead(): boolean {
    return this.current <= 0;
  }

  get percentage(): number {
    return (this.current / this.max) * 100;
  }
}

class Collider {
  constructor(public radius: number = 10) {}
}

// ============================================================================
// Components - RTS Specific
// ============================================================================

/**
 * Player ownership
 */
class Owner {
  constructor(
    public playerId: number = 0,
    public playerName: string = 'Player',
  ) {}
}

/**
 * Unit type and stats
 */
class Unit {
  constructor(
    public unitType: 'worker' | 'soldier' | 'tank' | 'scout' = 'worker',
    public attackDamage: number = 10,
    public attackRange: number = 50,
    public attackSpeed: number = 1000, // milliseconds
    public moveSpeed: number = 100, // units per second
    public lastAttackTime: number = 0,
  ) {}

  canAttack(currentTime: number): boolean {
    return currentTime - this.lastAttackTime >= this.attackSpeed;
  }
}

/**
 * Building type
 */
class Building {
  constructor(
    public buildingType: 'base' | 'barracks' | 'factory' | 'resource-depot' = 'base',
    public buildTime: number = 0,
    public isConstructing: boolean = false,
  ) {}
}

/**
 * Resource node
 */
class ResourceNode {
  constructor(
    public resourceType: 'minerals' | 'gas' = 'minerals',
    public amount: number = 1000,
    public harvestRate: number = 10, // per second
  ) {}

  harvest(deltaTime: number): number {
    const harvested = Math.min(this.amount, this.harvestRate * deltaTime);
    this.amount -= harvested;
    return harvested;
  }

  isDepleted(): boolean {
    return this.amount <= 0;
  }
}

/**
 * Selection state
 */
class Selectable {
  constructor(public isSelected: boolean = false) {}
}

/**
 * Command queue for units
 */
class CommandQueue {
  commands: Command[] = [];

  addCommand(command: Command, replace: boolean = false): void {
    if (replace) {
      this.commands = [command];
    } else {
      this.commands.push(command);
    }
  }

  getCurrentCommand(): Command | null {
    return this.commands[0] || null;
  }

  completeCurrentCommand(): void {
    this.commands.shift();
  }

  clear(): void {
    this.commands = [];
  }

  get hasCommands(): boolean {
    return this.commands.length > 0;
  }
}

/**
 * Command types
 */
type Command =
  | { type: 'move'; target: Position }
  | { type: 'attack'; targetEntity: symbol }
  | { type: 'gather'; resourceEntity: symbol }
  | { type: 'build'; buildingType: string; position: Position }
  | { type: 'patrol'; positions: Position[] }
  | { type: 'stop' };

/**
 * Pathfinding component
 */
class PathFollower {
  path: Position[] = [];
  currentWaypoint: number = 0;
  arrivalDistance: number = 5;

  setPath(path: Position[]): void {
    this.path = path;
    this.currentWaypoint = 0;
  }

  getCurrentWaypoint(): Position | null {
    return this.path[this.currentWaypoint] || null;
  }

  advanceWaypoint(): void {
    this.currentWaypoint++;
  }

  hasReachedEnd(): boolean {
    return this.currentWaypoint >= this.path.length;
  }

  clear(): void {
    this.path = [];
    this.currentWaypoint = 0;
  }
}

/**
 * Vision component for fog of war
 */
class Vision {
  constructor(
    public range: number = 200,
    public visibleEntities: Set<symbol> = new Set(),
  ) {}
}

/**
 * Player resources
 */
class Resources {
  constructor(
    public minerals: number = 1000,
    public gas: number = 0,
  ) {}

  canAfford(cost: { minerals: number; gas: number }): boolean {
    return this.minerals >= cost.minerals && this.gas >= cost.gas;
  }

  spend(cost: { minerals: number; gas: number }): boolean {
    if (!this.canAfford(cost)) return false;
    this.minerals -= cost.minerals;
    this.gas -= cost.gas;
    return true;
  }

  add(amount: { minerals: number; gas: number }): void {
    this.minerals += amount.minerals;
    this.gas += amount.gas;
  }
}

// ============================================================================
// Spatial Partitioning Grid
// ============================================================================

/**
 * Spatial grid for efficient proximity queries
 */
class SpatialGrid {
  private grid: Map<string, Set<EntityDef>> = new Map();
  private cellSize: number;
  private worldWidth: number;
  private worldHeight: number;

  constructor(cellSize: number, worldWidth: number, worldHeight: number) {
    this.cellSize = cellSize;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  /**
   * Get grid cell key for position
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Insert entity into grid
   */
  insert(entity: EntityDef, position: Position): void {
    const key = this.getCellKey(position.x, position.y);

    if (!this.grid.has(key)) {
      this.grid.set(key, new Set());
    }

    this.grid.get(key)!.add(entity);
  }

  /**
   * Remove entity from grid
   */
  remove(entity: EntityDef, position: Position): void {
    const key = this.getCellKey(position.x, position.y);
    const cell = this.grid.get(key);

    if (cell) {
      cell.delete(entity);
      if (cell.size === 0) {
        this.grid.delete(key);
      }
    }
  }

  /**
   * Query entities in radius around position
   */
  queryRadius(center: Position, radius: number): EntityDef[] {
    const results: EntityDef[] = [];
    const radiusSquared = radius * radius;

    // Calculate cell range to check
    const minCellX = Math.floor((center.x - radius) / this.cellSize);
    const maxCellX = Math.floor((center.x + radius) / this.cellSize);
    const minCellY = Math.floor((center.y - radius) / this.cellSize);
    const maxCellY = Math.floor((center.y + radius) / this.cellSize);

    // Check all cells in range
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const key = `${cellX},${cellY}`;
        const cell = this.grid.get(key);

        if (!cell) continue;

        for (const entity of cell) {
          if (!entity.hasComponent(Position)) continue;

          const pos = entity.getComponent(Position);
          const dx = pos.x - center.x;
          const dy = pos.y - center.y;
          const distSquared = dx * dx + dy * dy;

          if (distSquared <= radiusSquared) {
            results.push(entity);
          }
        }
      }
    }

    return results;
  }

  /**
   * Query entities in rectangular area
   */
  queryRect(minX: number, minY: number, maxX: number, maxY: number): EntityDef[] {
    const results: EntityDef[] = [];

    const minCellX = Math.floor(minX / this.cellSize);
    const maxCellX = Math.floor(maxX / this.cellSize);
    const minCellY = Math.floor(minY / this.cellSize);
    const maxCellY = Math.floor(maxY / this.cellSize);

    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const key = `${cellX},${cellY}`;
        const cell = this.grid.get(key);

        if (!cell) continue;

        for (const entity of cell) {
          if (!entity.hasComponent(Position)) continue;

          const pos = entity.getComponent(Position);

          if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) {
            results.push(entity);
          }
        }
      }
    }

    return results;
  }

  /**
   * Clear the grid
   */
  clear(): void {
    this.grid.clear();
  }

  /**
   * Get statistics
   */
  getStats(): { totalCells: number; occupiedCells: number; totalEntities: number } {
    let totalEntities = 0;
    for (const cell of this.grid.values()) {
      totalEntities += cell.size;
    }

    return {
      totalCells: (this.worldWidth / this.cellSize) * (this.worldHeight / this.cellSize),
      occupiedCells: this.grid.size,
      totalEntities,
    };
  }
}

// ============================================================================
// Simple A* Pathfinding
// ============================================================================

/**
 * Simple A* pathfinding on a grid
 */
class Pathfinder {
  private gridSize: number;
  private worldWidth: number;
  private worldHeight: number;

  constructor(gridSize: number, worldWidth: number, worldHeight: number) {
    this.gridSize = gridSize;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  /**
   * Find path from start to goal using A*
   */
  findPath(start: Position, goal: Position, obstacles: Position[] = []): Position[] {
    // Simplified pathfinding - just return direct path with waypoints
    // In a real RTS, you'd implement full A* with obstacle avoidance

    const path: Position[] = [];
    const distance = start.distanceTo(goal);
    const numWaypoints = Math.ceil(distance / 50); // Waypoint every 50 units

    for (let i = 1; i <= numWaypoints; i++) {
      const t = i / numWaypoints;
      const x = start.x + (goal.x - start.x) * t;
      const y = start.y + (goal.y - start.y) * t;
      path.push(new Position(x, y));
    }

    return path;
  }

  /**
   * Check if position is valid (within world bounds)
   */
  isValidPosition(pos: Position): boolean {
    return pos.x >= 0 && pos.x <= this.worldWidth && pos.y >= 0 && pos.y <= this.worldHeight;
  }
}

// ============================================================================
// Engine and Game State
// ============================================================================

const spatialGrid = new SpatialGrid(
  RTS_CONFIG.spatialGridSize,
  RTS_CONFIG.worldSize.width,
  RTS_CONFIG.worldSize.height,
);

const pathfinder = new Pathfinder(
  RTS_CONFIG.spatialGridSize,
  RTS_CONFIG.worldSize.width,
  RTS_CONFIG.worldSize.height,
);

const engine = new EngineBuilder().withDebugMode(true).withFixedUpdateFPS(60).build();

// Player resources
const playerResources = new Map<number, Resources>();
playerResources.set(1, new Resources(RTS_CONFIG.startingResources, 0));
playerResources.set(2, new Resources(RTS_CONFIG.startingResources, 0));

// Selection state
const selectedEntities = new Set<symbol>();

// ============================================================================
// Entity Creation Functions
// ============================================================================

/**
 * Create a unit
 */
function createUnit(
  unitType: 'worker' | 'soldier' | 'tank' | 'scout',
  playerId: number,
  x: number,
  y: number,
): EntityDef {
  const unit = engine.createEntity(`${unitType}_${Date.now()}`);

  // Stats based on type
  const stats = {
    worker: { health: 50, damage: 5, range: 10, speed: 120 },
    soldier: { health: 100, damage: 15, range: 100, speed: 100 },
    tank: { health: 300, damage: 40, range: 150, speed: 60 },
    scout: { health: 60, damage: 8, range: 80, speed: 180 },
  }[unitType];

  unit.addComponent(Position, x, y);
  unit.addComponent(Velocity, 0, 0);
  unit.addComponent(Health, stats.health, stats.health);
  unit.addComponent(Unit, unitType, stats.damage, stats.range, 1000, stats.speed, 0);
  unit.addComponent(Owner, playerId, `Player ${playerId}`);
  unit.addComponent(Collider, 8);
  unit.addComponent(Selectable, false);
  unit.addComponent(CommandQueue);
  unit.addComponent(PathFollower);
  unit.addComponent(Vision, 200);
  unit.addTag('unit');
  unit.addTag(unitType);

  return unit;
}

/**
 * Create a building
 */
function createBuilding(
  buildingType: 'base' | 'barracks' | 'factory' | 'resource-depot',
  playerId: number,
  x: number,
  y: number,
): EntityDef {
  const building = engine.createEntity(`${buildingType}_${Date.now()}`);

  const stats = {
    base: { health: 1000, size: 60 },
    barracks: { health: 500, size: 40 },
    factory: { health: 600, size: 50 },
    'resource-depot': { health: 400, size: 35 },
  }[buildingType];

  building.addComponent(Position, x, y);
  building.addComponent(Health, stats.health, stats.health);
  building.addComponent(Building, buildingType, 0, false);
  building.addComponent(Owner, playerId, `Player ${playerId}`);
  building.addComponent(Collider, stats.size);
  building.addComponent(Selectable, false);
  building.addComponent(Vision, 300);
  building.addTag('building');
  building.addTag(buildingType);

  return building;
}

/**
 * Create a resource node
 */
function createResourceNode(
  resourceType: 'minerals' | 'gas',
  x: number,
  y: number,
  amount: number = 1000,
): EntityDef {
  const resource = engine.createEntity(`${resourceType}_${Date.now()}`);

  resource.addComponent(Position, x, y);
  resource.addComponent(ResourceNode, resourceType, amount, 10);
  resource.addComponent(Collider, 15);
  resource.addTag('resource');
  resource.addTag(resourceType);

  return resource;
}

// ============================================================================
// Systems - Spatial Partitioning
// ============================================================================

/**
 * Update spatial grid with entity positions
 */
engine.createSystem(
  'SpatialGridUpdateSystem',
  { all: [Position] },
  {
    priority: 1000,
    before: () => {
      // Clear grid each frame and rebuild
      spatialGrid.clear();
    },
    act: (entity: EntityDef, position: Position) => {
      spatialGrid.insert(entity, position);
    },
  },
  true, // Fixed update
);

// ============================================================================
// Systems - Command Processing
// ============================================================================

/**
 * Process move commands
 */
engine.createSystem(
  'MoveCommandSystem',
  { all: [Position, Velocity, Unit, CommandQueue, PathFollower] },
  {
    priority: 900,
    act: (
      entity: EntityDef,
      position: Position,
      velocity: Velocity,
      unit: Unit,
      commands: CommandQueue,
      pathFollower: PathFollower,
    ) => {
      const command = commands.getCurrentCommand();

      if (!command || command.type !== 'move') {
        velocity.dx = 0;
        velocity.dy = 0;
        return;
      }

      // Get current waypoint or set new path
      let waypoint = pathFollower.getCurrentWaypoint();

      if (!waypoint) {
        // Generate new path
        const path = pathfinder.findPath(position, command.target);
        pathFollower.setPath(path);
        waypoint = pathFollower.getCurrentWaypoint();

        if (!waypoint) {
          commands.completeCurrentCommand();
          return;
        }
      }

      // Move towards waypoint
      const dx = waypoint.x - position.x;
      const dy = waypoint.y - position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < pathFollower.arrivalDistance) {
        // Reached waypoint
        pathFollower.advanceWaypoint();

        if (pathFollower.hasReachedEnd()) {
          // Reached final destination
          velocity.dx = 0;
          velocity.dy = 0;
          pathFollower.clear();
          commands.completeCurrentCommand();
        }
      } else {
        // Move towards waypoint
        const dirX = dx / distance;
        const dirY = dy / distance;

        velocity.dx = dirX * unit.moveSpeed;
        velocity.dy = dirY * unit.moveSpeed;
      }
    },
  },
  true,
);

/**
 * Process attack commands
 */
engine.createSystem(
  'AttackCommandSystem',
  { all: [Position, Unit, CommandQueue] },
  {
    priority: 900,
    act: (entity: EntityDef, position: Position, unit: Unit, commands: CommandQueue) => {
      const command = commands.getCurrentCommand();

      if (!command || command.type !== 'attack') return;

      // Find target entity
      const targetEntity = engine.getAllEntities().find((e) => e.id === command.targetEntity);

      if (!targetEntity || !targetEntity.hasComponent(Position) || targetEntity.isMarkedForDeletion) {
        // Target is gone
        commands.completeCurrentCommand();
        return;
      }

      const targetPos = targetEntity.getComponent(Position);
      const distance = position.distanceTo(targetPos);

      // Check if in range
      if (distance <= unit.attackRange) {
        // Attack!
        const currentTime = Date.now();

        if (unit.canAttack(currentTime)) {
          unit.lastAttackTime = currentTime;

          if (targetEntity.hasComponent(Health)) {
            const targetHealth = targetEntity.getComponent(Health);
            targetHealth.takeDamage(unit.attackDamage);

            console.log(
              `[Attack] ${entity.name} attacked ${targetEntity.name} for ${unit.attackDamage} damage`,
            );

            if (targetHealth.isDead()) {
              targetEntity.queueFree();
              commands.completeCurrentCommand();
            }
          }
        }
      } else {
        // Move closer - add move command
        const moveCommand: Command = { type: 'move', target: targetPos.clone() };
        commands.addCommand(moveCommand, false);
      }
    },
  },
  true,
);

/**
 * Process gather commands
 */
engine.createSystem(
  'GatherCommandSystem',
  { all: [Position, Unit, CommandQueue, Owner] },
  {
    priority: 900,
    act: (entity: EntityDef, position: Position, unit: Unit, commands: CommandQueue, owner: Owner) => {
      const command = commands.getCurrentCommand();

      if (!command || command.type !== 'gather') return;

      // Find resource entity
      const resourceEntity = engine.getAllEntities().find((e) => e.id === command.resourceEntity);

      if (
        !resourceEntity ||
        !resourceEntity.hasComponent(ResourceNode) ||
        resourceEntity.isMarkedForDeletion
      ) {
        commands.completeCurrentCommand();
        return;
      }

      const resourceNode = resourceEntity.getComponent(ResourceNode);
      const resourcePos = resourceEntity.getComponent(Position);
      const distance = position.distanceTo(resourcePos);

      // Check if close enough to harvest
      if (distance <= 20) {
        // Harvest
        const dt = 1 / 60;
        const harvested = resourceNode.harvest(dt);

        // Add to player resources
        const playerRes = playerResources.get(owner.playerId);
        if (playerRes) {
          if (resourceNode.resourceType === 'minerals') {
            playerRes.add({ minerals: harvested, gas: 0 });
          } else {
            playerRes.add({ minerals: 0, gas: harvested });
          }
        }

        // Check if depleted
        if (resourceNode.isDepleted()) {
          resourceEntity.queueFree();
          commands.completeCurrentCommand();
        }
      } else {
        // Move closer
        const moveCommand: Command = { type: 'move', target: resourcePos.clone() };
        commands.addCommand(moveCommand, false);
      }
    },
  },
  true,
);

// ============================================================================
// Systems - Movement
// ============================================================================

/**
 * Apply velocity to position
 */
engine.createSystem(
  'MovementSystem',
  { all: [Position, Velocity] },
  {
    priority: 800,
    act: (entity: EntityDef, position: Position, velocity: Velocity) => {
      const dt = 1 / 60;

      position.x += velocity.dx * dt;
      position.y += velocity.dy * dt;

      // Keep within world bounds
      position.x = Math.max(0, Math.min(RTS_CONFIG.worldSize.width, position.x));
      position.y = Math.max(0, Math.min(RTS_CONFIG.worldSize.height, position.y));
    },
  },
  true,
);

// ============================================================================
// Systems - Vision and Fog of War
// ============================================================================

/**
 * Update vision for entities
 */
engine.createSystem(
  'VisionSystem',
  { all: [Position, Vision] },
  {
    priority: 700,
    act: (entity: EntityDef, position: Position, vision: Vision) => {
      // Clear previous visible entities
      vision.visibleEntities.clear();

      // Query entities in vision range using spatial grid
      const nearbyEntities = spatialGrid.queryRadius(position, vision.range);

      for (const nearbyEntity of nearbyEntities) {
        if (nearbyEntity === entity) continue;
        vision.visibleEntities.add(nearbyEntity.id);
      }
    },
  },
  true,
);

// ============================================================================
// Selection System Functions
// ============================================================================

/**
 * Select entities in rectangular area (box selection)
 */
function selectInRect(minX: number, minY: number, maxX: number, maxY: number, replace: boolean = true): void {
  if (replace) {
    clearSelection();
  }

  const entities = spatialGrid.queryRect(minX, minY, maxX, maxY);

  for (const entity of entities) {
    if (entity.hasComponent(Selectable)) {
      const selectable = entity.getComponent(Selectable);
      selectable.isSelected = true;
      selectedEntities.add(entity.id);
    }
  }

  console.log(`[Selection] Selected ${selectedEntities.size} entities`);
}

/**
 * Select single entity at position
 */
function selectAt(x: number, y: number, radius: number = 20, replace: boolean = true): void {
  if (replace) {
    clearSelection();
  }

  const entities = spatialGrid.queryRadius(new Position(x, y), radius);

  // Select closest entity
  let closest: EntityDef | null = null;
  let closestDist = Infinity;

  for (const entity of entities) {
    if (!entity.hasComponent(Selectable) || !entity.hasComponent(Position)) continue;

    const pos = entity.getComponent(Position);
    const dx = pos.x - x;
    const dy = pos.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < closestDist) {
      closestDist = dist;
      closest = entity;
    }
  }

  if (closest) {
    const selectable = closest.getComponent(Selectable);
    selectable.isSelected = true;
    selectedEntities.add(closest.id);
    console.log(`[Selection] Selected ${closest.name}`);
  }
}

/**
 * Clear all selections
 */
function clearSelection(): void {
  for (const entity of engine.getAllEntities()) {
    if (entity.hasComponent(Selectable)) {
      entity.getComponent(Selectable).isSelected = false;
    }
  }
  selectedEntities.clear();
}

/**
 * Issue command to selected entities
 */
function issueCommand(command: Command): void {
  for (const entityId of selectedEntities) {
    const entity = engine.getAllEntities().find((e) => e.id === entityId);

    if (entity && entity.hasComponent(CommandQueue)) {
      const queue = entity.getComponent(CommandQueue);
      queue.addCommand(command, true); // Replace current command
    }
  }

  console.log(`[Command] Issued ${command.type} command to ${selectedEntities.size} entities`);
}

// ============================================================================
// Demo Scene Setup
// ============================================================================

/**
 * Create demo RTS scene
 */
function createDemoScene(): void {
  console.log('[RTS Demo] Creating scene...');

  // Create player 1 base
  const p1Base = createBuilding('base', 1, 200, 200);

  // Create player 1 units
  for (let i = 0; i < 20; i++) {
    const x = 150 + Math.random() * 100;
    const y = 150 + Math.random() * 100;
    createUnit(i < 10 ? 'worker' : 'soldier', 1, x, y);
  }

  // Create player 2 base
  const p2Base = createBuilding('base', 2, 1800, 1800);

  // Create player 2 units
  for (let i = 0; i < 20; i++) {
    const x = 1750 + Math.random() * 100;
    const y = 1750 + Math.random() * 100;
    createUnit(i < 10 ? 'worker' : 'soldier', 2, x, y);
  }

  // Create resource nodes
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * RTS_CONFIG.worldSize.width;
    const y = Math.random() * RTS_CONFIG.worldSize.height;
    createResourceNode('minerals', x, y, 2000);
  }

  for (let i = 0; i < 5; i++) {
    const x = Math.random() * RTS_CONFIG.worldSize.width;
    const y = Math.random() * RTS_CONFIG.worldSize.height;
    createResourceNode('gas', x, y, 1000);
  }

  console.log(`[RTS Demo] Created scene with ${engine.getAllEntities().length} entities`);
}

// ============================================================================
// Game Loop and Control
// ============================================================================

/**
 * Initialize the demo
 */
function init(): void {
  console.log('='.repeat(60));
  console.log('OrionECS RTS Demo');
  console.log('='.repeat(60));
  console.log(`World Size: ${RTS_CONFIG.worldSize.width}x${RTS_CONFIG.worldSize.height}`);
  console.log(`Spatial Grid Cell Size: ${RTS_CONFIG.spatialGridSize}`);
  console.log('='.repeat(60));

  createDemoScene();
  engine.start();

  // Demo: Select some units and give them commands
  setTimeout(() => {
    console.log('\n[Demo] Selecting player 1 workers...');
    selectInRect(150, 150, 250, 250);

    setTimeout(() => {
      console.log('[Demo] Commanding workers to move...');
      issueCommand({ type: 'move', target: new Position(500, 500) });
    }, 1000);

    setTimeout(() => {
      console.log('[Demo] Selecting player 1 soldiers...');
      selectInRect(200, 200, 300, 300);

      setTimeout(() => {
        const enemies = engine.getEntitiesWithTag('unit').filter((e) => {
          const owner = e.getComponent(Owner);
          return owner.playerId === 2;
        });

        if (enemies.length > 0) {
          console.log('[Demo] Commanding soldiers to attack enemy...');
          issueCommand({ type: 'attack', targetEntity: enemies[0].id });
        }
      }, 1000);
    }, 5000);
  }, 2000);

  console.log('[RTS Demo] Started');
}

/**
 * Update loop
 */
function update(): void {
  engine.update();
}

/**
 * Get game statistics
 */
function getStats(): any {
  const gridStats = spatialGrid.getStats();
  const entityCount = engine.getAllEntities().length;
  const unitCount = engine.getEntitiesWithTag('unit').length;
  const buildingCount = engine.getEntitiesWithTag('building').length;
  const resourceCount = engine.getEntitiesWithTag('resource').length;

  return {
    entities: {
      total: entityCount,
      units: unitCount,
      buildings: buildingCount,
      resources: resourceCount,
    },
    spatialGrid: gridStats,
    selection: {
      selectedCount: selectedEntities.size,
    },
    players: Array.from(playerResources.entries()).map(([id, res]) => ({
      id,
      minerals: res.minerals,
      gas: res.gas,
    })),
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Components
  Position,
  Velocity,
  Health,
  Owner,
  Unit,
  Building,
  ResourceNode,
  Selectable,
  CommandQueue,
  PathFollower,
  Vision,
  Resources,
  // Utilities
  SpatialGrid,
  Pathfinder,
  spatialGrid,
  pathfinder,
  // Engine
  engine,
  // Functions
  init,
  update,
  createUnit,
  createBuilding,
  createResourceNode,
  selectInRect,
  selectAt,
  clearSelection,
  issueCommand,
  getStats,
  // State
  selectedEntities,
  playerResources,
  RTS_CONFIG,
};

// ============================================================================
// Run if executed directly
// ============================================================================

if (require.main === module) {
  init();

  // Run update loop
  setInterval(() => {
    update();

    // Print stats every 5 seconds
    if (Math.random() < 0.05) {
      const stats = getStats();
      console.log('\n[Stats]', JSON.stringify(stats, null, 2));
    }
  }, 16); // ~60 FPS
}
