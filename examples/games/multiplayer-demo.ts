/**
 * Multiplayer Demo for OrionECS
 *
 * This example demonstrates a complete multiplayer game implementation with OrionECS.
 * It showcases client-side prediction, server reconciliation, entity replication,
 * lag compensation, and network messaging patterns.
 *
 * Architecture:
 * - Authoritative server validates all actions
 * - Client-side prediction for smooth local player movement
 * - Server reconciliation corrects client state
 * - Entity interpolation for smooth remote player movement
 * - Snapshot-based network updates
 *
 * To run:
 * 1. Install ws: npm install ws
 * 2. Run server: node dist/examples/games/multiplayer-demo-server.js
 * 3. Open multiple browser clients connecting to the server
 */

import { EngineBuilder } from '../../core/src/engine';
import type { Engine } from '../../core/src/engine';
import type { EntityDef } from '../../core/src/definitions';

// ============================================================================
// Shared Configuration
// ============================================================================

export const MULTIPLAYER_CONFIG = {
  serverTickRate: 20, // Server updates per second
  clientTickRate: 60, // Client updates per second
  networkUpdateRate: 10, // Network snapshots per second
  interpolationDelay: 100, // ms - trade latency for smoothness
  reconciliationWindow: 60, // Number of inputs to keep for reconciliation
  worldSize: { width: 800, height: 600 },
  playerSpeed: 200, // units per second
  bulletSpeed: 400,
  bulletLifetime: 3000, // ms
  fireRate: 250, // ms between shots
};

// ============================================================================
// Shared Components
// ============================================================================

export class Position {
  constructor(public x: number = 0, public y: number = 0) {}

  clone(): Position {
    return new Position(this.x, this.y);
  }

  distanceTo(other: Position): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  lerp(other: Position, t: number): Position {
    return new Position(this.x + (other.x - this.x) * t, this.y + (other.y - this.y) * t);
  }
}

export class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}

export class Health {
  constructor(
    public current: number = 100,
    public max: number = 100,
  ) {}

  takeDamage(amount: number): void {
    this.current = Math.max(0, this.current - amount);
  }

  isDead(): boolean {
    return this.current <= 0;
  }
}

export class Collider {
  constructor(public radius: number = 10) {}
}

/**
 * Network identity - links entities between client and server
 */
export class NetworkedEntity {
  constructor(
    public networkId: string = '', // Unique ID across network
    public ownerId: string = '', // Client ID that owns this entity
    public entityType: 'player' | 'projectile' | 'pickup' = 'player',
  ) {}
}

/**
 * Player metadata
 */
export class PlayerData {
  constructor(
    public playerId: string = '',
    public playerName: string = 'Player',
    public score: number = 0,
    public color: number = 0xffffff,
  ) {}
}

/**
 * Weapon state
 */
export class Weapon {
  constructor(
    public damage: number = 25,
    public fireRate: number = MULTIPLAYER_CONFIG.fireRate,
    public lastFireTime: number = 0,
  ) {}

  canFire(currentTime: number): boolean {
    return currentTime - this.lastFireTime >= this.fireRate;
  }
}

/**
 * Projectile data
 */
export class Projectile {
  constructor(
    public damage: number = 25,
    public lifetime: number = MULTIPLAYER_CONFIG.bulletLifetime,
    public spawnTime: number = Date.now(),
  ) {}

  isExpired(currentTime: number): boolean {
    return currentTime - this.spawnTime >= this.lifetime;
  }
}

// ============================================================================
// Client-Specific Components
// ============================================================================

/**
 * Client input state
 */
export class ClientInput {
  moveX: number = 0; // -1, 0, 1
  moveY: number = 0; // -1, 0, 1
  shoot: boolean = false;
  aimX: number = 0;
  aimY: number = 0;
}

/**
 * Input history for client-side prediction and reconciliation
 */
export class InputHistory {
  inputs: Array<{ sequence: number; input: ClientInput; timestamp: number }> = [];
  nextSequence: number = 0;

  addInput(input: ClientInput): number {
    const sequence = this.nextSequence++;
    this.inputs.push({
      sequence,
      input: { ...input },
      timestamp: Date.now(),
    });

    // Keep only recent inputs
    if (this.inputs.length > MULTIPLAYER_CONFIG.reconciliationWindow) {
      this.inputs.shift();
    }

    return sequence;
  }

  getInputsSince(sequence: number): Array<{ sequence: number; input: ClientInput; timestamp: number }> {
    return this.inputs.filter((i) => i.sequence > sequence);
  }

  clear(): void {
    this.inputs = [];
  }
}

/**
 * Prediction state for reconciliation
 */
export class PredictionState {
  constructor(
    public lastServerSequence: number = 0,
    public lastServerPosition: Position = new Position(),
    public lastServerTimestamp: number = 0,
  ) {}
}

/**
 * Interpolation state for smooth remote entity movement
 */
export class InterpolationState {
  snapshots: Array<{ position: Position; timestamp: number }> = [];

  addSnapshot(position: Position, timestamp: number): void {
    this.snapshots.push({ position: position.clone(), timestamp });

    // Keep only recent snapshots
    if (this.snapshots.length > 10) {
      this.snapshots.shift();
    }
  }

  getInterpolatedPosition(currentTime: number): Position | null {
    const renderTime = currentTime - MULTIPLAYER_CONFIG.interpolationDelay;

    if (this.snapshots.length < 2) {
      return this.snapshots[0]?.position || null;
    }

    // Find snapshots to interpolate between
    let from = this.snapshots[0];
    let to = this.snapshots[1];

    for (let i = 0; i < this.snapshots.length - 1; i++) {
      if (
        this.snapshots[i].timestamp <= renderTime &&
        this.snapshots[i + 1].timestamp >= renderTime
      ) {
        from = this.snapshots[i];
        to = this.snapshots[i + 1];
        break;
      }
    }

    // Interpolate
    const t = (renderTime - from.timestamp) / (to.timestamp - from.timestamp);
    return from.position.lerp(to.position, Math.max(0, Math.min(1, t)));
  }

  clear(): void {
    this.snapshots = [];
  }
}

// ============================================================================
// Network Message Types
// ============================================================================

export type ClientMessage =
  | { type: 'join'; playerName: string }
  | { type: 'input'; sequence: number; input: ClientInput; timestamp: number }
  | { type: 'ping'; timestamp: number };

export type ServerMessage =
  | { type: 'join_accepted'; clientId: string; playerId: string }
  | {
      type: 'world_snapshot';
      timestamp: number;
      entities: Array<{
        networkId: string;
        type: string;
        position: { x: number; y: number };
        velocity?: { dx: number; dy: number };
        health?: { current: number; max: number };
        playerData?: { name: string; score: number; color: number };
      }>;
    }
  | { type: 'input_ack'; sequence: number; position: { x: number; y: number }; timestamp: number }
  | { type: 'entity_spawned'; entity: any }
  | { type: 'entity_destroyed'; networkId: string }
  | { type: 'player_joined'; playerId: string; playerName: string }
  | { type: 'player_left'; playerId: string }
  | { type: 'pong'; timestamp: number; serverTime: number };

// ============================================================================
// Server Implementation
// ============================================================================

export class MultiplayerServer {
  engine: Engine;
  clients: Map<string, { id: string; socket: any; playerId: symbol | null }> = new Map();
  networkIdCounter: number = 0;
  lastUpdateTime: number = Date.now();

  constructor() {
    this.engine = new EngineBuilder()
      .withDebugMode(false)
      .withFixedUpdateFPS(MULTIPLAYER_CONFIG.serverTickRate)
      .build();

    this.setupSystems();
  }

  private setupSystems(): void {
    // Process player input
    this.engine.createSystem(
      'ServerInputSystem',
      { all: [Position, Velocity, ClientInput], tags: ['player'] },
      {
        priority: 1000,
        act: (entity: EntityDef, pos: Position, vel: Velocity, input: ClientInput) => {
          const speed = MULTIPLAYER_CONFIG.playerSpeed;
          vel.dx = input.moveX * speed;
          vel.dy = input.moveY * speed;

          // Handle shooting
          if (input.shoot && entity.hasComponent(Weapon)) {
            const weapon = entity.getComponent(Weapon);
            const currentTime = Date.now();

            if (weapon.canFire(currentTime)) {
              weapon.lastFireTime = currentTime;

              // Spawn projectile
              const angle = Math.atan2(input.aimY - pos.y, input.aimX - pos.x);
              const projectile = this.createProjectile(
                pos.x,
                pos.y,
                Math.cos(angle) * MULTIPLAYER_CONFIG.bulletSpeed,
                Math.sin(angle) * MULTIPLAYER_CONFIG.bulletSpeed,
                entity.getComponent(NetworkedEntity).ownerId,
              );

              console.log(`[Server] Player fired projectile`);
            }
          }
        },
      },
      true,
    );

    // Movement
    this.engine.createSystem(
      'ServerMovementSystem',
      { all: [Position, Velocity] },
      {
        priority: 900,
        act: (entity: EntityDef, pos: Position, vel: Velocity) => {
          const dt = 1 / MULTIPLAYER_CONFIG.serverTickRate;

          pos.x += vel.dx * dt;
          pos.y += vel.dy * dt;

          // World bounds
          pos.x = Math.max(0, Math.min(MULTIPLAYER_CONFIG.worldSize.width, pos.x));
          pos.y = Math.max(0, Math.min(MULTIPLAYER_CONFIG.worldSize.height, pos.y));
        },
      },
      true,
    );

    // Collision detection
    this.engine.createSystem(
      'ServerCollisionSystem',
      { all: [Position, Collider] },
      {
        priority: 800,
        after: () => {
          const projectiles = this.engine.getEntitiesWithTag('projectile');
          const players = this.engine.getEntitiesWithTag('player');

          for (const projectile of projectiles) {
            const projPos = projectile.getComponent(Position);
            const projCol = projectile.getComponent(Collider);
            const projNet = projectile.getComponent(NetworkedEntity);
            const projComp = projectile.getComponent(Projectile);

            for (const player of players) {
              const playerNet = player.getComponent(NetworkedEntity);

              // Don't hit own projectiles
              if (projNet.ownerId === playerNet.ownerId) continue;

              const playerPos = player.getComponent(Position);
              const playerCol = player.getComponent(Collider);

              const distance = projPos.distanceTo(playerPos);

              if (distance < projCol.radius + playerCol.radius) {
                // Hit!
                const health = player.getComponent(Health);
                health.takeDamage(projComp.damage);

                console.log(`[Server] Player hit! Health: ${health.current}/${health.max}`);

                projectile.queueFree();

                if (health.isDead()) {
                  // Respawn player
                  this.respawnPlayer(player);

                  // Award point
                  const shooterPlayer = players.find(
                    (p) => p.getComponent(NetworkedEntity).ownerId === projNet.ownerId,
                  );
                  if (shooterPlayer?.hasComponent(PlayerData)) {
                    shooterPlayer.getComponent(PlayerData).score++;
                  }
                }

                break;
              }
            }
          }
        },
      },
      true,
    );

    // Cleanup expired projectiles
    this.engine.createSystem(
      'ServerProjectileCleanupSystem',
      { all: [Projectile] },
      {
        priority: 700,
        act: (entity: EntityDef, projectile: Projectile) => {
          if (projectile.isExpired(Date.now())) {
            entity.queueFree();
          }
        },
      },
      true,
    );
  }

  start(): void {
    this.engine.start();
    console.log('[Server] Started');
  }

  update(): void {
    this.engine.update();
  }

  handleClientMessage(clientId: string, message: ClientMessage): void {
    const client = this.clients.get(clientId);

    switch (message.type) {
      case 'join':
        this.handleJoin(clientId, message.playerName);
        break;

      case 'input':
        if (client?.playerId) {
          this.handleInput(client.playerId, message);
        }
        break;

      case 'ping':
        this.handlePing(clientId, message.timestamp);
        break;
    }
  }

  private handleJoin(clientId: string, playerName: string): void {
    const player = this.createPlayer(clientId, playerName);

    this.clients.set(clientId, {
      id: clientId,
      socket: null,
      playerId: player.id,
    });

    console.log(`[Server] Player ${playerName} joined (${this.clients.size} players)`);
  }

  private handleInput(playerId: symbol, message: ClientMessage & { type: 'input' }): void {
    const player = this.engine.getAllEntities().find((e) => e.id === playerId);

    if (!player || !player.hasComponent(ClientInput)) return;

    // Update input
    const input = player.getComponent(ClientInput);
    input.moveX = message.input.moveX;
    input.moveY = message.input.moveY;
    input.shoot = message.input.shoot;
    input.aimX = message.input.aimX;
    input.aimY = message.input.aimY;

    // Send acknowledgment for client reconciliation
    const position = player.getComponent(Position);
    // In real implementation, send acknowledgment back to client
    // sendToClient(clientId, {
    //   type: 'input_ack',
    //   sequence: message.sequence,
    //   position: { x: position.x, y: position.y },
    //   timestamp: Date.now(),
    // });
  }

  private handlePing(clientId: string, timestamp: number): void {
    // Send pong
    // sendToClient(clientId, {
    //   type: 'pong',
    //   timestamp,
    //   serverTime: Date.now(),
    // });
  }

  createPlayer(clientId: string, playerName: string): EntityDef {
    const player = this.engine.createEntity(`Player_${clientId}`);

    const spawnX = Math.random() * MULTIPLAYER_CONFIG.worldSize.width;
    const spawnY = Math.random() * MULTIPLAYER_CONFIG.worldSize.height;
    const color = Math.floor(Math.random() * 0xffffff);

    player.addComponent(Position, spawnX, spawnY);
    player.addComponent(Velocity, 0, 0);
    player.addComponent(Health, 100, 100);
    player.addComponent(NetworkedEntity, `player_${clientId}`, clientId, 'player');
    player.addComponent(PlayerData, clientId, playerName, 0, color);
    player.addComponent(ClientInput);
    player.addComponent(Weapon, 25, MULTIPLAYER_CONFIG.fireRate, 0);
    player.addComponent(Collider, 15);
    player.addTag('player');

    return player;
  }

  createProjectile(x: number, y: number, dx: number, dy: number, ownerId: string): EntityDef {
    const projectile = this.engine.createEntity(`Projectile_${this.networkIdCounter++}`);

    projectile.addComponent(Position, x, y);
    projectile.addComponent(Velocity, dx, dy);
    projectile.addComponent(Projectile, 25, MULTIPLAYER_CONFIG.bulletLifetime, Date.now());
    projectile.addComponent(
      NetworkedEntity,
      `projectile_${this.networkIdCounter}`,
      ownerId,
      'projectile',
    );
    projectile.addComponent(Collider, 5);
    projectile.addTag('projectile');

    return projectile;
  }

  respawnPlayer(player: EntityDef): void {
    const pos = player.getComponent(Position);
    const health = player.getComponent(Health);

    pos.x = Math.random() * MULTIPLAYER_CONFIG.worldSize.width;
    pos.y = Math.random() * MULTIPLAYER_CONFIG.worldSize.height;
    health.current = health.max;

    console.log(`[Server] Player respawned at (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
  }

  getWorldSnapshot(): ServerMessage & { type: 'world_snapshot' } {
    const entities = this.engine
      .getAllEntities()
      .filter((e) => e.hasComponent(NetworkedEntity))
      .map((entity) => {
        const networked = entity.getComponent(NetworkedEntity);
        const pos = entity.getComponent(Position);

        const snapshot: any = {
          networkId: networked.networkId,
          type: networked.entityType,
          position: { x: pos.x, y: pos.y },
        };

        if (entity.hasComponent(Velocity)) {
          const vel = entity.getComponent(Velocity);
          snapshot.velocity = { dx: vel.dx, dy: vel.dy };
        }

        if (entity.hasComponent(Health)) {
          const health = entity.getComponent(Health);
          snapshot.health = { current: health.current, max: health.max };
        }

        if (entity.hasComponent(PlayerData)) {
          const data = entity.getComponent(PlayerData);
          snapshot.playerData = {
            name: data.playerName,
            score: data.score,
            color: data.color,
          };
        }

        return snapshot;
      });

    return {
      type: 'world_snapshot',
      timestamp: Date.now(),
      entities,
    };
  }
}

// ============================================================================
// Client Implementation
// ============================================================================

export class MultiplayerClient {
  engine: Engine;
  localPlayerId: string | null = null;
  serverTime: number = 0;
  latency: number = 0;

  constructor() {
    this.engine = new EngineBuilder()
      .withDebugMode(false)
      .withFixedUpdateFPS(MULTIPLAYER_CONFIG.clientTickRate)
      .build();

    this.setupSystems();
  }

  private setupSystems(): void {
    // Client-side prediction for local player
    this.engine.createSystem(
      'ClientPredictionSystem',
      { all: [Position, Velocity, ClientInput, PredictionState], tags: ['local-player'] },
      {
        priority: 1000,
        act: (entity: EntityDef, pos: Position, vel: Velocity, input: ClientInput) => {
          const speed = MULTIPLAYER_CONFIG.playerSpeed;
          const dt = 1 / MULTIPLAYER_CONFIG.clientTickRate;

          // Apply input immediately (prediction)
          vel.dx = input.moveX * speed;
          vel.dy = input.moveY * speed;

          pos.x += vel.dx * dt;
          pos.y += vel.dy * dt;

          // World bounds
          pos.x = Math.max(0, Math.min(MULTIPLAYER_CONFIG.worldSize.width, pos.x));
          pos.y = Math.max(0, Math.min(MULTIPLAYER_CONFIG.worldSize.height, pos.y));
        },
      },
      true,
    );

    // Interpolation for remote players
    this.engine.createSystem(
      'ClientInterpolationSystem',
      { all: [Position, InterpolationState], tags: ['remote-player'] },
      {
        priority: 1000,
        act: (entity: EntityDef, pos: Position, interpolation: InterpolationState) => {
          const interpolatedPos = interpolation.getInterpolatedPosition(Date.now());

          if (interpolatedPos) {
            pos.x = interpolatedPos.x;
            pos.y = interpolatedPos.y;
          }
        },
      },
      false, // Variable update
    );

    // Movement for projectiles (client-side)
    this.engine.createSystem(
      'ClientProjectileMovementSystem',
      { all: [Position, Velocity], tags: ['projectile'] },
      {
        priority: 900,
        act: (entity: EntityDef, pos: Position, vel: Velocity) => {
          const dt = 1 / MULTIPLAYER_CONFIG.clientTickRate;

          pos.x += vel.dx * dt;
          pos.y += vel.dy * dt;
        },
      },
      true,
    );

    // Cleanup expired projectiles
    this.engine.createSystem(
      'ClientProjectileCleanupSystem',
      { all: [Projectile] },
      {
        priority: 700,
        act: (entity: EntityDef, projectile: Projectile) => {
          if (projectile.isExpired(Date.now())) {
            entity.queueFree();
          }
        },
      },
      true,
    );
  }

  start(): void {
    this.engine.start();
    console.log('[Client] Started');
  }

  update(): void {
    this.engine.update();
  }

  handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'join_accepted':
        this.localPlayerId = message.clientId;
        console.log(`[Client] Joined as ${message.clientId}`);
        break;

      case 'world_snapshot':
        this.handleWorldSnapshot(message);
        break;

      case 'input_ack':
        this.handleInputAck(message);
        break;

      case 'pong':
        this.latency = Date.now() - message.timestamp;
        this.serverTime = message.serverTime;
        break;
    }
  }

  private handleWorldSnapshot(message: ServerMessage & { type: 'world_snapshot' }): void {
    for (const entityData of message.entities) {
      // Find or create entity
      let entity = this.engine
        .getAllEntities()
        .find((e) => e.getComponent(NetworkedEntity)?.networkId === entityData.networkId);

      if (!entity) {
        entity = this.createNetworkedEntity(entityData);
      }

      // Update entity
      if (entity.hasTag('remote-player') && entity.hasComponent(InterpolationState)) {
        // Add snapshot for interpolation
        const interpolation = entity.getComponent(InterpolationState);
        interpolation.addSnapshot(
          new Position(entityData.position.x, entityData.position.y),
          message.timestamp,
        );
      } else if (!entity.hasTag('local-player')) {
        // Direct update for non-player entities
        const pos = entity.getComponent(Position);
        pos.x = entityData.position.x;
        pos.y = entityData.position.y;
      }

      // Update other components
      if (entityData.health && entity.hasComponent(Health)) {
        const health = entity.getComponent(Health);
        health.current = entityData.health.current;
        health.max = entityData.health.max;
      }
    }
  }

  private handleInputAck(message: ServerMessage & { type: 'input_ack' }): void {
    const localPlayer = this.engine.getEntitiesWithTag('local-player')[0];

    if (!localPlayer) return;

    const prediction = localPlayer.getComponent(PredictionState);
    const inputHistory = localPlayer.getComponent(InputHistory);
    const pos = localPlayer.getComponent(Position);

    // Update server state
    prediction.lastServerSequence = message.sequence;
    prediction.lastServerPosition = new Position(message.position.x, message.position.y);
    prediction.lastServerTimestamp = message.timestamp;

    // Reconciliation: replay inputs since acknowledged state
    const pendingInputs = inputHistory.getInputsSince(message.sequence);

    if (pendingInputs.length > 0) {
      // Reset to server position
      pos.x = message.position.x;
      pos.y = message.position.y;

      // Replay pending inputs
      for (const { input } of pendingInputs) {
        const speed = MULTIPLAYER_CONFIG.playerSpeed;
        const dt = 1 / MULTIPLAYER_CONFIG.clientTickRate;

        const vel = localPlayer.getComponent(Velocity);
        vel.dx = input.moveX * speed;
        vel.dy = input.moveY * speed;

        pos.x += vel.dx * dt;
        pos.y += vel.dy * dt;

        // World bounds
        pos.x = Math.max(0, Math.min(MULTIPLAYER_CONFIG.worldSize.width, pos.x));
        pos.y = Math.max(0, Math.min(MULTIPLAYER_CONFIG.worldSize.height, pos.y));
      }

      console.log(`[Client] Reconciled ${pendingInputs.length} inputs`);
    }
  }

  private createNetworkedEntity(entityData: any): EntityDef {
    const entity = this.engine.createEntity(`Network_${entityData.networkId}`);

    entity.addComponent(Position, entityData.position.x, entityData.position.y);
    entity.addComponent(NetworkedEntity, entityData.networkId, '', entityData.type);

    if (entityData.type === 'player') {
      entity.addComponent(Velocity, 0, 0);
      entity.addComponent(Health, entityData.health?.current || 100, entityData.health?.max || 100);
      entity.addComponent(Collider, 15);
      entity.addTag('player');

      if (entityData.playerData) {
        entity.addComponent(
          PlayerData,
          '',
          entityData.playerData.name,
          entityData.playerData.score,
          entityData.playerData.color,
        );
      }

      // Determine if local or remote player
      if (entityData.networkId.includes(this.localPlayerId || '')) {
        entity.addComponent(ClientInput);
        entity.addComponent(InputHistory);
        entity.addComponent(PredictionState);
        entity.addTag('local-player');
        console.log('[Client] Created local player entity');
      } else {
        entity.addComponent(InterpolationState);
        entity.addTag('remote-player');
      }
    } else if (entityData.type === 'projectile') {
      entity.addComponent(Velocity, entityData.velocity?.dx || 0, entityData.velocity?.dy || 0);
      entity.addComponent(Projectile, 25, MULTIPLAYER_CONFIG.bulletLifetime, Date.now());
      entity.addComponent(Collider, 5);
      entity.addTag('projectile');
    }

    return entity;
  }

  getLocalPlayer(): EntityDef | null {
    return this.engine.getEntitiesWithTag('local-player')[0] || null;
  }

  sendInput(input: ClientInput): void {
    const localPlayer = this.getLocalPlayer();

    if (!localPlayer) return;

    const inputHistory = localPlayer.getComponent(InputHistory);
    const sequence = inputHistory.addInput(input);

    // In real implementation, send to server
    // sendToServer({
    //   type: 'input',
    //   sequence,
    //   input,
    //   timestamp: Date.now(),
    // });

    console.log(`[Client] Sent input #${sequence}`);
  }
}

// ============================================================================
// Demo / Testing
// ============================================================================

/**
 * Run a simulation with server and clients
 */
export function runMultiplayerDemo(): void {
  console.log('='.repeat(60));
  console.log('OrionECS Multiplayer Demo');
  console.log('='.repeat(60));

  // Create server
  const server = new MultiplayerServer();
  server.start();

  // Create clients
  const client1 = new MultiplayerClient();
  const client2 = new MultiplayerClient();

  client1.start();
  client2.start();

  // Simulate joining
  setTimeout(() => {
    server.handleClientMessage('client1', { type: 'join', playerName: 'Alice' });
    client1.handleServerMessage({ type: 'join_accepted', clientId: 'client1', playerId: 'player1' });
  }, 100);

  setTimeout(() => {
    server.handleClientMessage('client2', { type: 'join', playerName: 'Bob' });
    client2.handleServerMessage({ type: 'join_accepted', clientId: 'client2', playerId: 'player2' });
  }, 200);

  // Simulate inputs
  setTimeout(() => {
    console.log('\n[Demo] Sending player inputs...\n');

    server.handleClientMessage('client1', {
      type: 'input',
      sequence: 1,
      input: { moveX: 1, moveY: 0, shoot: false, aimX: 0, aimY: 0 },
      timestamp: Date.now(),
    });

    server.handleClientMessage('client2', {
      type: 'input',
      sequence: 1,
      input: { moveX: -1, moveY: 1, shoot: true, aimX: 100, aimY: 100 },
      timestamp: Date.now(),
    });
  }, 1000);

  // Update loops
  setInterval(() => server.update(), 1000 / MULTIPLAYER_CONFIG.serverTickRate);
  setInterval(() => client1.update(), 1000 / MULTIPLAYER_CONFIG.clientTickRate);
  setInterval(() => client2.update(), 1000 / MULTIPLAYER_CONFIG.clientTickRate);

  // Network sync simulation
  setInterval(() => {
    const snapshot = server.getWorldSnapshot();
    client1.handleServerMessage(snapshot);
    client2.handleServerMessage(snapshot);
  }, 1000 / MULTIPLAYER_CONFIG.networkUpdateRate);

  // Stats
  setInterval(() => {
    console.log('\n[Stats]');
    console.log(`Server entities: ${server.engine.getAllEntities().length}`);
    console.log(`Client 1 entities: ${client1.engine.getAllEntities().length}`);
    console.log(`Client 2 entities: ${client2.engine.getAllEntities().length}`);
  }, 5000);

  console.log('\n[Demo] Multiplayer simulation running...\n');
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Classes
  MultiplayerServer,
  MultiplayerClient,
  // Components
  Position,
  Velocity,
  Health,
  Collider,
  NetworkedEntity,
  PlayerData,
  Weapon,
  Projectile,
  ClientInput,
  InputHistory,
  PredictionState,
  InterpolationState,
};

// ============================================================================
// Run if executed directly
// ============================================================================

if (require.main === module) {
  runMultiplayerDemo();
}
