/**
 * Bouncy Box - Server Implementation
 *
 * A multiplayer game server demonstrating the OrionECS Network Plugin.
 * Players control colored boxes that move around and bounce off walls.
 *
 * To run:
 * 1. Build: npm run build
 * 2. Run: node dist/examples/multiplayer/bouncy-box/server.js
 *
 * Or with ts-node:
 *   npx ts-node examples/multiplayer/bouncy-box/server.ts
 */

import { WebSocketServer } from 'ws';
import type { EntityDef } from '../../../packages/core/src/definitions';
import { EngineBuilder } from '../../../packages/core/src/engine';
import {
    ClientInputState,
    createWebSocketServerTransport,
    NetworkId,
    NetworkPlugin,
    NetworkPosition,
    NetworkVelocity,
} from '../../../plugins/network/src';
import {
    Bouncing,
    BoxVisual,
    GAME_CONFIG,
    getPlayerColor,
    NETWORK_CONFIG,
    PlayerInfo,
} from './shared';

// ============================================================================
// Security Helpers
// ============================================================================

/**
 * Sanitize string for safe logging (remove newlines to prevent log injection)
 */
function sanitizeLog(str: string): string {
    if (typeof str !== 'string') return String(str);
    return str.replace(/[\r\n]/g, '');
}

// ============================================================================
// Server Setup
// ============================================================================

console.log('='.repeat(60));
console.log('Bouncy Box - OrionECS Multiplayer Server');
console.log('='.repeat(60));
console.log(`World Size: ${GAME_CONFIG.worldWidth}x${GAME_CONFIG.worldHeight}`);
console.log(`Tick Rate: ${NETWORK_CONFIG.tickRate} TPS`);
console.log(`Port: ${GAME_CONFIG.serverPort}`);
console.log('='.repeat(60));

// Create WebSocket transport
const transport = createWebSocketServerTransport(WebSocketServer, { debug: true });

// Track player count for color assignment
let playerCount = 0;

// Create network plugin
const networkPlugin = new NetworkPlugin({
    role: 'server',
    transport,
    config: {
        ...NETWORK_CONFIG,
        debug: true,
    },
    callbacks: {
        onPlayerJoin: (clientId, playerName) => {
            console.log(
                `[Game] Player joined: ${sanitizeLog(playerName)} (${sanitizeLog(clientId)})`
            );

            // Get the player entity and add game-specific components
            const clients = networkPlugin.getConnectedClients();
            const client = clients.find((c) => c.id === clientId);

            if (client && client.networkEntityId) {
                const entity = networkPlugin.getNetworkEntity(client.networkEntityId);
                if (entity) {
                    // Add visual component with assigned color
                    const color = getPlayerColor(playerCount++);
                    entity.addComponent(
                        BoxVisual,
                        GAME_CONFIG.boxWidth,
                        GAME_CONFIG.boxHeight,
                        color
                    );
                    entity.addComponent(Bouncing, false, 0);
                    entity.addComponent(PlayerInfo, playerName, 0, Date.now());

                    console.log(
                        `[Game] Assigned color ${sanitizeLog(color)} to ${sanitizeLog(playerName)}`
                    );
                }
            }
        },
        onPlayerLeave: (clientId) => {
            console.log(`[Game] Player left: ${sanitizeLog(clientId)}`);
        },
    },
});

// Create engine with network plugin
const engine = new EngineBuilder()
    .withDebugMode(true)
    .withFixedUpdateFPS(NETWORK_CONFIG.tickRate!)
    .use(networkPlugin)
    .build();

// ============================================================================
// Game Systems
// ============================================================================

/**
 * Movement System - Apply input to velocity and update position
 */
engine.createSystem(
    'MovementSystem',
    { all: [NetworkPosition, NetworkVelocity, ClientInputState] },
    {
        priority: 100,
        act: (
            entity: EntityDef,
            position: NetworkPosition,
            velocity: NetworkVelocity,
            input: ClientInputState
        ) => {
            const dt = 1 / NETWORK_CONFIG.tickRate!;
            const speed = GAME_CONFIG.boxSpeed;

            // Apply input to velocity
            velocity.x = input.moveX * speed;
            velocity.y = input.moveY * speed;

            // Update position
            position.x += velocity.x * dt;
            position.y += velocity.y * dt;
        },
    },
    true // Fixed update
);

/**
 * Bounds System - Keep boxes within world bounds and bounce off walls
 */
engine.createSystem(
    'BoundsSystem',
    { all: [NetworkPosition, NetworkVelocity, BoxVisual] },
    {
        priority: 90,
        act: (
            entity: EntityDef,
            position: NetworkPosition,
            velocity: NetworkVelocity,
            visual: BoxVisual
        ) => {
            let bounced = false;

            // Check horizontal bounds
            if (position.x < 0) {
                position.x = 0;
                velocity.x = Math.abs(velocity.x); // Bounce right
                bounced = true;
            } else if (position.x + visual.width > GAME_CONFIG.worldWidth) {
                position.x = GAME_CONFIG.worldWidth - visual.width;
                velocity.x = -Math.abs(velocity.x); // Bounce left
                bounced = true;
            }

            // Check vertical bounds
            if (position.y < 0) {
                position.y = 0;
                velocity.y = Math.abs(velocity.y); // Bounce down
                bounced = true;
            } else if (position.y + visual.height > GAME_CONFIG.worldHeight) {
                position.y = GAME_CONFIG.worldHeight - visual.height;
                velocity.y = -Math.abs(velocity.y); // Bounce up
                bounced = true;
            }

            // Update bouncing state
            if (entity.hasComponent(Bouncing)) {
                const bouncing = entity.getComponent(Bouncing);
                if (bounced) {
                    bouncing.isBouncing = true;
                    bouncing.lastBounceTime = Date.now();
                } else if (Date.now() - bouncing.lastBounceTime > 100) {
                    bouncing.isBouncing = false;
                }
            }

            // Mark entity as dirty for network sync
            if (entity.hasComponent(NetworkId)) {
                entity.getComponent(NetworkId).markDirty();
            }
        },
    },
    true // Fixed update
);

// ============================================================================
// Server Lifecycle
// ============================================================================

async function startServer(): Promise<void> {
    try {
        // Start listening
        await networkPlugin.listen(GAME_CONFIG.serverPort, GAME_CONFIG.serverHost);
        console.log(
            `[Server] Listening on ws://${GAME_CONFIG.serverHost}:${GAME_CONFIG.serverPort}`
        );

        // Start engine
        engine.start();
        console.log('[Server] Engine started');

        // Main game loop
        const tickInterval = 1000 / NETWORK_CONFIG.tickRate!;
        setInterval(() => {
            engine.update();
        }, tickInterval);

        // Status logging
        setInterval(() => {
            const clients = networkPlugin.getConnectedClients();
            if (clients.length > 0) {
                console.log(`[Server] ${clients.length} players connected`);
            }
        }, 10000);

        console.log('[Server] Ready for connections!');
        console.log(`[Server] Open client.html in a browser to play`);
    } catch (error) {
        console.error('[Server] Failed to start:', error);
        process.exit(1);
    }
}

// Handle shutdown
process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down...');
    await networkPlugin.close();
    engine.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n[Server] Shutting down...');
    await networkPlugin.close();
    engine.stop();
    process.exit(0);
});

// Start the server
startServer();
