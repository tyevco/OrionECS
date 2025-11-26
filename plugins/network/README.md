# @orion-ecs/network

A comprehensive, transport-agnostic multiplayer networking plugin for OrionECS.

## Features

- **Transport-Agnostic Architecture**: Pluggable transport layer supporting WebSocket, Socket.IO, WebRTC, and custom implementations
- **Client-Side Prediction**: Immediate response to player input with server reconciliation
- **Server Reconciliation**: Automatic correction of client state when server authoritative state differs
- **Entity Interpolation**: Smooth movement for remote entities using snapshot interpolation
- **Authoritative Server**: Server validates all actions and maintains game state authority
- **Automatic Latency Measurement**: Built-in ping/pong for latency tracking and clock synchronization

## Installation

```bash
npm install @orion-ecs/network ws
```

## Quick Start

### Server

```typescript
import { EngineBuilder } from '@orion-ecs/core';
import { NetworkPlugin, createWebSocketServerTransport } from '@orion-ecs/network';
import { WebSocketServer } from 'ws';

// Create transport
const transport = createWebSocketServerTransport(WebSocketServer, { debug: true });

// Create network plugin
const networkPlugin = new NetworkPlugin({
  role: 'server',
  transport,
  config: {
    tickRate: 20,
    snapshotRate: 10,
    debug: true,
  },
  callbacks: {
    onPlayerJoin: (clientId, playerName) => {
      console.log(`${playerName} joined!`);
    },
    onPlayerLeave: (clientId) => {
      console.log(`Player ${clientId} left`);
    },
  },
});

// Create engine with plugin
const engine = new EngineBuilder()
  .use(networkPlugin)
  .build();

// Start listening
await networkPlugin.listen(8080);

// Start game loop
engine.start();
setInterval(() => engine.update(), 1000 / 20);
```

### Client (Browser)

```typescript
import { EngineBuilder } from '@orion-ecs/core';
import { NetworkPlugin, createWebSocketClientTransport } from '@orion-ecs/network';

// Create transport (uses browser's native WebSocket)
const transport = createWebSocketClientTransport({ debug: true });

// Create network plugin
const networkPlugin = new NetworkPlugin({
  role: 'client',
  transport,
  config: {
    clientTickRate: 60,
    enablePrediction: true,
    enableInterpolation: true,
    enableReconciliation: true,
  },
  callbacks: {
    onConnected: () => console.log('Connected!'),
    onDisconnected: (reason) => console.log('Disconnected:', reason),
  },
});

// Create engine with plugin
const engine = new EngineBuilder()
  .use(networkPlugin)
  .build();

// Connect and join
await networkPlugin.connect('ws://localhost:8080', 'PlayerName');

// Start game loop
engine.start();
requestAnimationFrame(function loop() {
  engine.update();
  requestAnimationFrame(loop);
});
```

### Client (Node.js)

```typescript
import WebSocket from 'ws';
import { createWebSocketClientTransport } from '@orion-ecs/network';

// Pass WebSocket constructor for Node.js
const transport = createWebSocketClientTransport({
  WebSocket,
  debug: true
});

// Rest is the same as browser client...
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NetworkPlugin                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ NetworkManager  │  │ Serialization   │  │ Components      │              │
│  │ - server/client │  │ - snapshot      │  │ - NetworkId     │              │
│  │ - connections   │  │ - interpolation │  │ - NetworkInput  │              │
│  │ - message queue │  │                 │  │ - InputBuffer   │              │
│  └────────┬────────┘  └─────────────────┘  │ - ServerState   │              │
│           │                                 │ - Interpolation │              │
│           ▼                                 └─────────────────┘              │
│  ┌─────────────────────────────────────┐                                    │
│  │      NetworkTransport (Interface)    │◄─── Pluggable!                    │
│  └─────────────────────────────────────┘                                    │
│           ▲                       ▲                                          │
│  ┌────────┴────────┐    ┌────────┴────────┐                                 │
│  │ WebSocketServer │    │ WebSocketClient │                                 │
│  │ Transport (ws)  │    │ Transport       │                                 │
│  └─────────────────┘    └─────────────────┘                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### NetworkId
Marks an entity for network synchronization.

```typescript
entity.addComponent(NetworkId, 'unique-id', 'owner-client-id', 'player');
```

### NetworkPosition / NetworkVelocity
Position and velocity with network serialization support.

```typescript
entity.addComponent(NetworkPosition, 100, 200);
entity.addComponent(NetworkVelocity, 50, 0);
```

### NetworkInput
Current input state for the local player.

```typescript
const input = entity.getComponent(NetworkInput);
input.setMovement(1, 0); // Move right
input.setAction('shoot', true);
```

### InputBuffer
Stores input history for client-side prediction and reconciliation.

### InterpolationBuffer
Stores position snapshots for smooth remote entity rendering.

### LocalPlayer / RemotePlayer
Tag components to distinguish local and remote players.

## Configuration

```typescript
interface NetworkConfig {
  tickRate: number;           // Server tick rate (default: 20)
  snapshotRate: number;       // Snapshots per second (default: 10)
  clientTickRate: number;     // Client update rate (default: 60)
  interpolationDelay: number; // Interpolation delay in ms (default: 100)
  reconciliationWindow: number; // Input buffer size (default: 60)
  maxLatency: number;         // Max latency before disconnect (default: 5000)
  enablePrediction: boolean;  // Enable client prediction (default: true)
  enableInterpolation: boolean; // Enable interpolation (default: true)
  enableReconciliation: boolean; // Enable reconciliation (default: true)
  debug: boolean;             // Enable debug logging (default: false)
}
```

## API Reference

### NetworkPlugin

```typescript
// Server methods
await networkPlugin.listen(port, host?);
await networkPlugin.close();
networkPlugin.getConnectedClients();
networkPlugin.kickClient(clientId, reason?);

// Client methods
await networkPlugin.connect(url, playerName);
networkPlugin.disconnect();
networkPlugin.setInput({ moveX, moveY, actions });

// Common methods
networkPlugin.createNetworkEntity(options);
networkPlugin.destroyNetworkEntity(networkEntityId);
networkPlugin.getNetworkEntity(networkEntityId);
networkPlugin.getLocalPlayer();
networkPlugin.getServerTime();
```

### NetworkAPI (via engine.network)

After installing the plugin, access the API via `engine.network`:

```typescript
const engine = new EngineBuilder().use(networkPlugin).build();

engine.network.isServer;      // boolean
engine.network.isClient;      // boolean
engine.network.isConnected;   // boolean
engine.network.latency;       // number (ms)
engine.network.serverTime;    // number
engine.network.currentTick;   // number
```

## Custom Transports

Implement the `NetworkTransport` interface to create custom transports:

```typescript
interface NetworkTransport {
  readonly state: ConnectionState;
  readonly connectionId?: string;

  connect(url: string): Promise<void>;
  disconnect(): void;
  send(message: NetworkMessage): void;

  onMessage(handler: (message: NetworkMessage, senderId?: string) => void): void;
  onConnect(handler: (connectionId: string) => void): void;
  onDisconnect(handler: (connectionId: string, reason?: string) => void): void;
  onError(handler: (error: Error) => void): void;

  destroy(): void;
}
```

For server transports, also implement `ServerTransport`:

```typescript
interface ServerTransport extends NetworkTransport {
  listen(port: number, host?: string): Promise<void>;
  close(): Promise<void>;
  sendTo(connectionId: string, message: NetworkMessage): void;
  broadcast(message: NetworkMessage): void;
  broadcastExcept(excludeId: string, message: NetworkMessage): void;
  getConnectedClients(): string[];
  disconnectClient(connectionId: string, reason?: string): void;
}
```

## Message Protocol

### Client → Server

| Type | Description |
|------|-------------|
| `join` | Request to join the game |
| `input` | Player input with sequence number |
| `ping` | Latency measurement |

### Server → Client

| Type | Description |
|------|-------------|
| `join_accepted` | Join successful, includes client ID |
| `join_rejected` | Join failed with reason |
| `world_snapshot` | Full world state update |
| `input_ack` | Input acknowledged with server position |
| `entity_spawn` | New entity created |
| `entity_destroy` | Entity removed |
| `player_joined` | Another player joined |
| `player_left` | Another player left |
| `pong` | Latency measurement response |

## Examples

See the `examples/multiplayer/bouncy-box/` directory for a complete working example:

- `server.ts` - Node.js server implementation
- `client.html` - Browser client with Canvas rendering
- `shared.ts` - Shared configuration and components

To run:

```bash
# Install dependencies
npm install

# Build
npm run build

# Start server
node dist/examples/multiplayer/bouncy-box/server.js

# Open client.html in browser
```

## Best Practices

1. **Keep tick rates reasonable**: 20-60 TPS is typical for most games
2. **Tune interpolation delay**: Higher delay = smoother but more latency feel
3. **Validate on server**: Never trust client input completely
4. **Handle disconnects gracefully**: Clean up entities and notify other players
5. **Test with simulated latency**: Use browser DevTools to throttle network

## Future Enhancements

- [ ] Delta compression for bandwidth optimization
- [ ] Socket.IO transport implementation
- [ ] WebRTC transport for P2P connections
- [ ] Interest management (only sync nearby entities)
- [ ] Lag compensation / rollback netcode
- [ ] Replay system

## License

MIT
