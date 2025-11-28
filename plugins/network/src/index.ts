/**
 * OrionECS Network Plugin
 *
 * A comprehensive multiplayer networking plugin that provides:
 * - Transport-agnostic architecture (WebSocket, Socket.IO, WebRTC, etc.)
 * - Client-side prediction with input buffering
 * - Server reconciliation
 * - Entity interpolation for smooth remote player movement
 * - Authoritative server architecture
 *
 * @packageDocumentation
 */

// Components
export {
    ClientInputState,
    clearNetworkDirty,
    InputBuffer,
    InterpolationBuffer,
    LocalPlayer,
    markNetworkDirty,
    NetworkId,
    NetworkInput,
    NetworkPosition,
    NetworkVelocity,
    RemotePlayer,
    ServerState,
    serializeNetworkEntity,
} from './components';
// Main plugin
export { NetworkAPI, NetworkPlugin, type NetworkPluginOptions } from './NetworkPlugin';
// Transports
export {
    createWebSocketClientTransport,
    createWebSocketServerTransport,
    type WebSocketClientOptions,
    WebSocketClientTransport,
    WebSocketServerTransport,
} from './transports';
// Types
export type {
    ClientConnection,
    ClientToServerMessage,
    ClientTransport,
    ConnectionState,
    EntityDestroyMessage,
    EntitySpawnMessage,
    InputAckMessage,
    InputMessage,
    InputState,
    JoinAcceptedMessage,
    JoinMessage,
    JoinRejectedMessage,
    // Configuration
    NetworkConfig,
    NetworkEntityOptions,
    NetworkEventCallbacks,
    // Messages
    NetworkMessage,
    NetworkRole,
    // Transport
    NetworkTransport,
    PingMessage,
    PlayerJoinedMessage,
    PlayerLeftMessage,
    PongMessage,
    SequencedInput,
    // Serialization
    SerializedNetworkEntity,
    ServerToClientMessage,
    ServerTransport,
    SnapshotEntry,
    WorldSnapshotMessage,
} from './types';
export { DEFAULT_NETWORK_CONFIG } from './types';
