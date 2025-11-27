/**
 * Node.js Server Integration Example for OrionECS
 *
 * This example demonstrates how to run OrionECS in a headless server environment
 * for multiplayer games. It shows authoritative server architecture, network
 * synchronization, and tick-based updates.
 *
 * To run this example:
 * 1. Install dependencies: npm install ws
 * 2. Build the project: npm run build
 * 3. Run: node dist/examples/integrations/nodejs-server.js
 * 4. Connect clients via WebSocket on ws://localhost:8080
 */

import { EngineBuilder, type EntityDef } from '@orion-ecs/core';

// ============================================================================
// WebSocket Server Setup (optional - uncomment when ws is installed)
// ============================================================================

/*
import { WebSocket, WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
const clients: Set<WebSocket> = new Set();

wss.on('connection', (ws: WebSocket) => {
  console.log('[Server] Client connected');
  clients.add(ws);

  ws.on('message', (data: Buffer) => {
    handleClientMessage(ws, JSON.parse(data.toString()));
  });

  ws.on('close', () => {
    console.log('[Server] Client disconnected');
    clients.delete(ws);
    handleClientDisconnect(ws);
  });

  // Send initial world state
  sendWorldState(ws);
});

function broadcast(message: any): void {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function sendToClient(client: WebSocket, message: any): void {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}
*/

// For this example without ws installed:
const clients: Set<any> = new Set();
function broadcast(message: any): void {
    console.log('[Server] Broadcasting:', message);
}
function sendToClient(_client: any, message: any): void {
    console.log('[Server] Sending to client:', message);
}

// ============================================================================
// Server Configuration
// ============================================================================

const SERVER_CONFIG = {
    tickRate: 20, // Server updates per second (20 TPS = 50ms per tick)
    broadcastRate: 10, // Network updates per second (10 Hz = 100ms)
    maxPlayers: 16,
    worldSize: { width: 1000, height: 1000 },
    enableDebug: true,
};

// ============================================================================
// Components - Shared between client and server
// ============================================================================

/**
 * Position in 2D space
 */
class Position {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}

    toJSON() {
        return { x: this.x, y: this.y };
    }
}

/**
 * Velocity for movement
 */
class Velocity {
    constructor(
        public dx: number = 0,
        public dy: number = 0
    ) {}

    toJSON() {
        return { dx: this.dx, dy: this.dy };
    }
}

/**
 * Player health
 */
class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
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

    toJSON() {
        return { current: this.current, max: this.max };
    }
}

/**
 * Player input state
 */
class PlayerInput {
    constructor(
        public moveX: number = 0, // -1, 0, 1
        public moveY: number = 0, // -1, 0, 1
        public shoot: boolean = false,
        public lastProcessedSeq: number = 0 // For client reconciliation
    ) {}
}

/**
 * Network identity - marks entities that should be synchronized
 */
class NetworkedEntity {
    constructor(
        public ownerId: string = '', // Client/player ID
        public entityType: string = 'unknown',
        public needsSync: boolean = true
    ) {}
}

/**
 * Player metadata
 */
class PlayerData {
    constructor(
        public playerId: string = '',
        public playerName: string = 'Player',
        public score: number = 0,
        public lastInputTime: number = 0
    ) {}
}

/**
 * Weapon component
 */
class Weapon {
    constructor(
        public fireRate: number = 200, // milliseconds between shots
        public lastFireTime: number = 0,
        public damage: number = 10
    ) {}

    canFire(currentTime: number): boolean {
        return currentTime - this.lastFireTime >= this.fireRate;
    }

    fire(currentTime: number): void {
        this.lastFireTime = currentTime;
    }
}

/**
 * Projectile component
 */
class Projectile {
    constructor(
        public lifetime: number = 3000, // milliseconds
        public spawnTime: number = Date.now(),
        public damage: number = 10
    ) {}

    isExpired(currentTime: number): boolean {
        return currentTime - this.spawnTime >= this.lifetime;
    }
}

/**
 * Collision circle
 */
class Collider {
    constructor(public radius: number = 10) {}
}

// ============================================================================
// Server Engine Setup
// ============================================================================

const serverEngine = new EngineBuilder()
    .withDebugMode(SERVER_CONFIG.enableDebug)
    .withFixedUpdateFPS(SERVER_CONFIG.tickRate)
    .withMaxFixedIterations(5) // Prevent spiral of death
    .build();

// ============================================================================
// Server State Management
// ============================================================================

interface ClientConnection {
    id: string;
    socket: any; // WebSocket when available
    playerId: symbol | null;
    lastPingTime: number;
}

const clientConnections = new Map<string, ClientConnection>();
let serverStartTime = Date.now();
let lastBroadcastTime = 0;

// ============================================================================
// Player Management
// ============================================================================

/**
 * Create a new player entity
 */
function createPlayer(clientId: string, playerName: string): EntityDef {
    const player = serverEngine.createEntity(`Player_${clientId}`);

    // Random spawn position
    const spawnX = Math.random() * SERVER_CONFIG.worldSize.width;
    const spawnY = Math.random() * SERVER_CONFIG.worldSize.height;

    player.addComponent(Position, spawnX, spawnY);
    player.addComponent(Velocity, 0, 0);
    player.addComponent(Health, 100, 100);
    player.addComponent(PlayerInput, 0, 0, false, 0);
    player.addComponent(NetworkedEntity, clientId, 'player');
    player.addComponent(PlayerData, clientId, playerName, 0);
    player.addComponent(Weapon, 200, 0, 10);
    player.addComponent(Collider, 15);
    player.addTag('player');
    player.addTag('alive');

    console.log(
        `[Server] Created player: ${playerName} at (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)})`
    );

    return player;
}

/**
 * Create a projectile
 */
function createProjectile(
    x: number,
    y: number,
    dx: number,
    dy: number,
    ownerId: string
): EntityDef {
    const projectile = serverEngine.createEntity(`Projectile_${Date.now()}`);

    projectile.addComponent(Position, x, y);
    projectile.addComponent(Velocity, dx, dy);
    projectile.addComponent(Projectile, 3000, Date.now(), 10);
    projectile.addComponent(NetworkedEntity, ownerId, 'projectile');
    projectile.addComponent(Collider, 5);
    projectile.addTag('projectile');

    return projectile;
}

// ============================================================================
// Game Systems
// ============================================================================

/**
 * Process player input and apply movement
 */
serverEngine.createSystem(
    'PlayerInputSystem',
    {
        all: [PlayerInput, Velocity, Position],
        tags: ['player', 'alive'],
    },
    {
        priority: 1000,
        act: (entity: EntityDef, input: PlayerInput, velocity: Velocity, position: Position) => {
            const moveSpeed = 200; // units per second

            // Apply input to velocity
            velocity.dx = input.moveX * moveSpeed;
            velocity.dy = input.moveY * moveSpeed;

            // Handle shooting
            if (input.shoot && entity.hasComponent(Weapon)) {
                const weapon = entity.getComponent(Weapon);
                const currentTime = Date.now();

                if (weapon.canFire(currentTime)) {
                    weapon.fire(currentTime);

                    // Spawn projectile
                    const projectileSpeed = 400;
                    const angle = Math.atan2(input.moveY, input.moveX) || 0;
                    const dx = Math.cos(angle) * projectileSpeed;
                    const dy = Math.sin(angle) * projectileSpeed;

                    const networked = entity.getComponent(NetworkedEntity);
                    createProjectile(position.x, position.y, dx, dy, networked.ownerId);

                    console.log(`[Server] Player ${entity.name} fired projectile`);
                }
            }
        },
    },
    true // Fixed update
);

/**
 * Apply velocity to position
 */
serverEngine.createSystem(
    'MovementSystem',
    { all: [Position, Velocity] },
    {
        priority: 900,
        act: (entity: EntityDef, position: Position, velocity: Velocity) => {
            const dt = 1 / SERVER_CONFIG.tickRate;

            position.x += velocity.dx * dt;
            position.y += velocity.dy * dt;

            // World bounds wrapping
            if (position.x < 0) position.x += SERVER_CONFIG.worldSize.width;
            if (position.x > SERVER_CONFIG.worldSize.width)
                position.x -= SERVER_CONFIG.worldSize.width;
            if (position.y < 0) position.y += SERVER_CONFIG.worldSize.height;
            if (position.y > SERVER_CONFIG.worldSize.height)
                position.y -= SERVER_CONFIG.worldSize.height;

            // Mark entity for network sync
            if (entity.hasComponent(NetworkedEntity)) {
                entity.getComponent(NetworkedEntity).needsSync = true;
            }
        },
    },
    true // Fixed update
);

/**
 * Collision detection system
 */
serverEngine.createSystem(
    'CollisionSystem',
    { all: [Position, Collider] },
    {
        priority: 800,
        after: () => {
            // Simple O(n²) collision detection for projectiles vs players
            const projectiles = serverEngine.getEntitiesWithTag('projectile');
            const players = serverEngine
                .getEntitiesWithTag('player')
                .filter((p) => p.hasTag('alive'));

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

                    // Circle collision
                    const dx = projPos.x - playerPos.x;
                    const dy = projPos.y - playerPos.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const minDistance = projCol.radius + playerCol.radius;

                    if (distance < minDistance) {
                        // Hit!
                        const health = player.getComponent(Health);
                        health.takeDamage(projComp.damage);

                        console.log(
                            `[Server] Player ${player.name} hit! Health: ${health.current}/${health.max}`
                        );

                        // Destroy projectile
                        projectile.queueFree();

                        // Check if player died
                        if (health.isDead()) {
                            player.removeTag('alive');
                            player.addTag('dead');

                            const playerData = player.getComponent(PlayerData);
                            console.log(`[Server] Player ${playerData.playerName} died!`);

                            // Award point to shooter
                            const shooterEntities = serverEngine.getAllEntities().filter((e) => {
                                if (!e.hasComponent(NetworkedEntity)) return false;
                                return e.getComponent(NetworkedEntity).ownerId === projNet.ownerId;
                            });

                            for (const shooter of shooterEntities) {
                                if (shooter.hasComponent(PlayerData)) {
                                    shooter.getComponent(PlayerData).score++;
                                }
                            }
                        }

                        break; // Projectile can only hit one player
                    }
                }
            }
        },
    },
    true // Fixed update
);

/**
 * Cleanup expired projectiles
 */
serverEngine.createSystem(
    'ProjectileCleanupSystem',
    { all: [Projectile] },
    {
        priority: 700,
        act: (entity: EntityDef, projectile: Projectile) => {
            const currentTime = Date.now();
            if (projectile.isExpired(currentTime)) {
                entity.queueFree();
            }
        },
    },
    true // Fixed update
);

/**
 * Respawn dead players
 */
serverEngine.createSystem(
    'RespawnSystem',
    { all: [Position, Health, PlayerData], tags: ['player', 'dead'] },
    {
        priority: 600,
        act: (entity: EntityDef, position: Position, health: Health) => {
            // Respawn after 3 seconds
            const _respawnDelay = 3000;
            const _timeSinceDeath = Date.now(); // Simplified - would track death time in real impl

            // Reset health
            health.current = health.max;

            // Random respawn position
            position.x = Math.random() * SERVER_CONFIG.worldSize.width;
            position.y = Math.random() * SERVER_CONFIG.worldSize.height;

            // Reset velocity
            if (entity.hasComponent(Velocity)) {
                const velocity = entity.getComponent(Velocity);
                velocity.dx = 0;
                velocity.dy = 0;
            }

            // Mark as alive
            entity.removeTag('dead');
            entity.addTag('alive');

            console.log(`[Server] Player ${entity.name} respawned`);
        },
    },
    true
);

// ============================================================================
// Network Systems
// ============================================================================

/**
 * Network synchronization system
 * Broadcasts world state to all clients at configured rate
 */
serverEngine.createSystem(
    'NetworkSyncSystem',
    { all: [] },
    {
        priority: -100, // Run late
        after: () => {
            const currentTime = Date.now();
            const timeSinceLastBroadcast = currentTime - lastBroadcastTime;
            const broadcastInterval = 1000 / SERVER_CONFIG.broadcastRate;

            // Only broadcast at configured rate
            if (timeSinceLastBroadcast < broadcastInterval) return;

            lastBroadcastTime = currentTime;

            // Collect entities that need syncing
            const networkedEntities = serverEngine
                .getAllEntities()
                .filter((e) => e.hasComponent(NetworkedEntity));

            const worldState: any[] = [];

            for (const entity of networkedEntities) {
                const networked = entity.getComponent(NetworkedEntity);

                if (!networked.needsSync) continue;

                const state: any = {
                    id: String(entity.id),
                    type: networked.entityType,
                    owner: networked.ownerId,
                };

                // Serialize relevant components
                if (entity.hasComponent(Position)) {
                    state.position = entity.getComponent(Position).toJSON();
                }

                if (entity.hasComponent(Velocity)) {
                    state.velocity = entity.getComponent(Velocity).toJSON();
                }

                if (entity.hasComponent(Health)) {
                    state.health = entity.getComponent(Health).toJSON();
                }

                if (entity.hasComponent(PlayerData)) {
                    const data = entity.getComponent(PlayerData);
                    state.playerData = {
                        name: data.playerName,
                        score: data.score,
                    };
                }

                worldState.push(state);

                // Clear sync flag
                networked.needsSync = false;
            }

            // Broadcast world state
            if (worldState.length > 0) {
                broadcast({
                    type: 'world_state',
                    timestamp: currentTime,
                    tick: Math.floor(
                        (currentTime - serverStartTime) / (1000 / SERVER_CONFIG.tickRate)
                    ),
                    entities: worldState,
                });
            }
        },
    },
    false // Variable update
);

// ============================================================================
// Network Message Handlers
// ============================================================================

/**
 * Handle incoming client messages
 */
function handleClientMessage(client: any, message: any): void {
    switch (message.type) {
        case 'join':
            handleJoinRequest(client, message);
            break;

        case 'input':
            handlePlayerInput(client, message);
            break;

        case 'ping':
            handlePing(client, message);
            break;

        default:
            console.log(`[Server] Unknown message type: ${message.type}`);
    }
}

/**
 * Handle player join request
 */
function handleJoinRequest(client: any, message: any): void {
    const clientId = message.clientId || `client_${Date.now()}`;
    const playerName = message.playerName || `Player_${clientId}`;

    // Check max players
    if (clientConnections.size >= SERVER_CONFIG.maxPlayers) {
        sendToClient(client, {
            type: 'join_rejected',
            reason: 'Server full',
        });
        return;
    }

    // Create player
    const player = createPlayer(clientId, playerName);

    // Store connection
    clientConnections.set(clientId, {
        id: clientId,
        socket: client,
        playerId: player.id,
        lastPingTime: Date.now(),
    });

    // Send acceptance
    sendToClient(client, {
        type: 'join_accepted',
        clientId: clientId,
        playerId: String(player.id),
        worldConfig: SERVER_CONFIG,
    });

    // Broadcast new player to all clients
    broadcast({
        type: 'player_joined',
        playerId: String(player.id),
        playerName: playerName,
    });

    console.log(
        `[Server] Player ${playerName} joined (${clientConnections.size}/${SERVER_CONFIG.maxPlayers})`
    );
}

/**
 * Handle player input
 */
function handlePlayerInput(_client: any, message: any): void {
    const clientId = message.clientId;
    const connection = clientConnections.get(clientId);

    if (!connection || !connection.playerId) {
        console.warn(`[Server] Input from unknown client: ${clientId}`);
        return;
    }

    // Find player entity
    const player = serverEngine.getAllEntities().find((e) => e.id === connection.playerId);

    if (!player || !player.hasComponent(PlayerInput)) {
        return;
    }

    // Update input
    const input = player.getComponent(PlayerInput);
    input.moveX = message.input.moveX || 0;
    input.moveY = message.input.moveY || 0;
    input.shoot = message.input.shoot || false;
    input.lastProcessedSeq = message.sequence || 0;

    // Update player data
    if (player.hasComponent(PlayerData)) {
        player.getComponent(PlayerData).lastInputTime = Date.now();
    }
}

/**
 * Handle ping message
 */
function handlePing(client: any, message: any): void {
    sendToClient(client, {
        type: 'pong',
        timestamp: message.timestamp,
        serverTime: Date.now(),
    });
}

/**
 * Handle client disconnect
 */
function _handleClientDisconnect(client: any): void {
    // Find and remove client
    for (const [clientId, connection] of clientConnections.entries()) {
        if (connection.socket === client) {
            // Remove player entity
            if (connection.playerId) {
                const player = serverEngine
                    .getAllEntities()
                    .find((e) => e.id === connection.playerId);
                if (player) {
                    player.queueFree();
                    console.log(`[Server] Removed player entity for ${clientId}`);
                }
            }

            clientConnections.delete(clientId);

            // Broadcast player left
            broadcast({
                type: 'player_left',
                clientId: clientId,
            });

            console.log(`[Server] Client ${clientId} disconnected`);
            break;
        }
    }
}

/**
 * Send initial world state to newly connected client
 */
function _sendWorldState(client: any): void {
    const entities = serverEngine.getAllEntities().filter((e) => e.hasComponent(NetworkedEntity));

    const worldState = entities.map((entity) => {
        const state: any = {
            id: String(entity.id),
            type: entity.getComponent(NetworkedEntity).entityType,
        };

        if (entity.hasComponent(Position)) {
            state.position = entity.getComponent(Position).toJSON();
        }

        if (entity.hasComponent(Health)) {
            state.health = entity.getComponent(Health).toJSON();
        }

        return state;
    });

    sendToClient(client, {
        type: 'initial_state',
        entities: worldState,
    });
}

// ============================================================================
// Server Loop
// ============================================================================

/**
 * Main server update loop
 */
function serverUpdate(): void {
    serverEngine.update();
}

/**
 * Start the server
 */
function startServer(): void {
    console.log('='.repeat(60));
    console.log('OrionECS Headless Server Example');
    console.log('='.repeat(60));
    console.log(`Tick Rate: ${SERVER_CONFIG.tickRate} TPS`);
    console.log(`Network Update Rate: ${SERVER_CONFIG.broadcastRate} Hz`);
    console.log(`Max Players: ${SERVER_CONFIG.maxPlayers}`);
    console.log(`World Size: ${SERVER_CONFIG.worldSize.width}x${SERVER_CONFIG.worldSize.height}`);
    console.log('='.repeat(60));

    serverEngine.start();
    serverStartTime = Date.now();
    lastBroadcastTime = serverStartTime;

    // Start server loop
    const tickInterval = 1000 / SERVER_CONFIG.tickRate;
    setInterval(serverUpdate, tickInterval);

    console.log('[Server] Server started successfully');
    console.log('[Server] Waiting for connections on ws://localhost:8080');
    console.log('[Server] (Install ws package and uncomment WebSocket code to enable networking)');

    // For demonstration without WebSocket, create some AI players
    if (clients.size === 0) {
        console.log('[Server] Creating demo AI players...');
        createPlayer('ai_1', 'Bot Alpha');
        createPlayer('ai_2', 'Bot Beta');

        // Simulate some movement
        setTimeout(() => {
            const players = serverEngine.getEntitiesWithTag('player');
            for (const player of players) {
                const input = player.getComponent(PlayerInput);
                input.moveX = Math.random() > 0.5 ? 1 : -1;
                input.moveY = Math.random() > 0.5 ? 1 : -1;
            }
        }, 1000);
    }
}

/**
 * Graceful shutdown
 */
function shutdown(): void {
    console.log('[Server] Shutting down...');

    // Notify all clients
    broadcast({
        type: 'server_shutdown',
    });

    // Close all connections (when WebSocket is enabled)
    // for (const client of clients) {
    //   client.close();
    // }

    // Stop engine
    serverEngine.stop();

    console.log('[Server] Shutdown complete');
    process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ============================================================================
// Exports
// ============================================================================

export {
    // Components
    Position,
    Velocity,
    Health,
    PlayerInput,
    NetworkedEntity,
    PlayerData,
    Weapon,
    Projectile,
    Collider,
    // Engine
    serverEngine,
    // Functions
    startServer,
    handleClientMessage,
    createPlayer,
    createProjectile,
    // State
    clientConnections,
    SERVER_CONFIG,
};

// ============================================================================
// Run if executed directly
// ============================================================================

if (require.main === module) {
    startServer();
}
