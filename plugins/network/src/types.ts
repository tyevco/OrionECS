/**
 * Network Plugin Types and Interfaces
 *
 * This module defines the core abstractions for the network plugin,
 * enabling transport-agnostic multiplayer networking for OrionECS.
 */

// ============================================================================
// Transport Abstraction
// ============================================================================

/**
 * Connection state for a network transport
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * Abstract transport interface - implement this for different backends
 * (WebSocket, Socket.IO, WebRTC, etc.)
 */
export interface NetworkTransport {
    /** Current connection state */
    readonly state: ConnectionState;

    /** Unique identifier for this connection (client ID on client, undefined on server) */
    readonly connectionId?: string;

    // Lifecycle
    connect(url: string): Promise<void>;
    disconnect(): void;

    // Messaging
    send(message: NetworkMessage): void;
    broadcast?(message: NetworkMessage): void; // Server only

    // Event handlers
    onMessage(handler: (message: NetworkMessage, senderId?: string) => void): void;
    onConnect(handler: (connectionId: string) => void): void;
    onDisconnect(handler: (connectionId: string, reason?: string) => void): void;
    onError(handler: (error: Error) => void): void;

    // Cleanup
    destroy(): void;
}

/**
 * Server-side transport interface with additional capabilities
 */
export interface ServerTransport extends NetworkTransport {
    /** Start listening for connections */
    listen(port: number, host?: string): Promise<void>;

    /** Stop listening */
    close(): Promise<void>;

    /** Send to specific client */
    sendTo(connectionId: string, message: NetworkMessage): void;

    /** Broadcast to all connected clients */
    broadcast(message: NetworkMessage): void;

    /** Broadcast to all except specific client */
    broadcastExcept(excludeId: string, message: NetworkMessage): void;

    /** Get all connected client IDs */
    getConnectedClients(): string[];

    /** Disconnect specific client */
    disconnectClient(connectionId: string, reason?: string): void;
}

/**
 * Client-side transport interface
 */
export interface ClientTransport extends NetworkTransport {
    /** Latency to server in milliseconds */
    readonly latency: number;

    /** Server time offset for clock synchronization */
    readonly serverTimeOffset: number;
}

// ============================================================================
// Network Messages
// ============================================================================

/**
 * Base network message structure
 */
export interface NetworkMessage {
    type: string;
    timestamp: number;
    data?: unknown;
}

// --- Client -> Server Messages ---

export interface JoinMessage extends NetworkMessage {
    type: 'join';
    data: {
        playerName: string;
        clientVersion?: string;
    };
}

export interface InputMessage extends NetworkMessage {
    type: 'input';
    data: {
        sequence: number;
        inputs: InputState;
        timestamp: number;
    };
}

export interface PingMessage extends NetworkMessage {
    type: 'ping';
    data: {
        clientTime: number;
    };
}

// --- Server -> Client Messages ---

export interface JoinAcceptedMessage extends NetworkMessage {
    type: 'join_accepted';
    data: {
        clientId: string;
        networkEntityId: string;
        serverConfig: NetworkConfig;
        serverTime: number;
    };
}

export interface JoinRejectedMessage extends NetworkMessage {
    type: 'join_rejected';
    data: {
        reason: string;
    };
}

export interface WorldSnapshotMessage extends NetworkMessage {
    type: 'world_snapshot';
    data: {
        tick: number;
        timestamp: number;
        entities: SerializedNetworkEntity[];
        removedEntityIds?: string[];
    };
}

export interface InputAckMessage extends NetworkMessage {
    type: 'input_ack';
    data: {
        sequence: number;
        position: { x: number; y: number };
        velocity?: { x: number; y: number };
        serverTick: number;
        serverTime: number;
    };
}

export interface EntitySpawnMessage extends NetworkMessage {
    type: 'entity_spawn';
    data: SerializedNetworkEntity;
}

export interface EntityDestroyMessage extends NetworkMessage {
    type: 'entity_destroy';
    data: {
        networkEntityId: string;
    };
}

export interface PlayerJoinedMessage extends NetworkMessage {
    type: 'player_joined';
    data: {
        clientId: string;
        playerName: string;
        networkEntityId: string;
    };
}

export interface PlayerLeftMessage extends NetworkMessage {
    type: 'player_left';
    data: {
        clientId: string;
    };
}

export interface PongMessage extends NetworkMessage {
    type: 'pong';
    data: {
        clientTime: number;
        serverTime: number;
    };
}

// Union type for all messages
export type ClientToServerMessage = JoinMessage | InputMessage | PingMessage;
export type ServerToClientMessage =
    | JoinAcceptedMessage
    | JoinRejectedMessage
    | WorldSnapshotMessage
    | InputAckMessage
    | EntitySpawnMessage
    | EntityDestroyMessage
    | PlayerJoinedMessage
    | PlayerLeftMessage
    | PongMessage;

// ============================================================================
// Serialization Types
// ============================================================================

/**
 * Serialized network entity for transmission
 */
export interface SerializedNetworkEntity {
    networkEntityId: string;
    ownerId: string;
    entityType: string;
    position?: { x: number; y: number };
    velocity?: { x: number; y: number };
    rotation?: number;
    components?: Record<string, unknown>;
}

/**
 * Input state structure
 */
export interface InputState {
    moveX: number; // -1, 0, 1
    moveY: number; // -1, 0, 1
    actions: Record<string, boolean>; // shoot, jump, etc.
    aimX?: number;
    aimY?: number;
}

/**
 * Input with sequence number for reconciliation
 */
export interface SequencedInput {
    sequence: number;
    input: InputState;
    timestamp: number;
    applied: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Network configuration
 */
export interface NetworkConfig {
    /** Server tick rate (ticks per second) */
    tickRate: number;

    /** Network snapshot rate (snapshots per second) */
    snapshotRate: number;

    /** Client update rate */
    clientTickRate: number;

    /** Interpolation delay in milliseconds */
    interpolationDelay: number;

    /** Number of inputs to keep for reconciliation */
    reconciliationWindow: number;

    /** Maximum allowed latency before disconnect (ms) */
    maxLatency: number;

    /** Enable client-side prediction */
    enablePrediction: boolean;

    /** Enable entity interpolation */
    enableInterpolation: boolean;

    /** Enable server reconciliation */
    enableReconciliation: boolean;

    /** Debug mode - extra logging */
    debug: boolean;
}

/**
 * Default network configuration
 */
export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
    tickRate: 20,
    snapshotRate: 10,
    clientTickRate: 60,
    interpolationDelay: 100,
    reconciliationWindow: 60,
    maxLatency: 5000,
    enablePrediction: true,
    enableInterpolation: true,
    enableReconciliation: true,
    debug: false,
};

// ============================================================================
// Plugin Types
// ============================================================================

/**
 * Network role - server or client
 */
export type NetworkRole = 'server' | 'client';

/**
 * Connection info for a connected client (server-side)
 */
export interface ClientConnection {
    id: string;
    playerName: string;
    networkEntityId: string | null;
    joinedAt: number;
    lastInputTime: number;
    lastInputSequence: number;
    latency: number;
}

/**
 * Snapshot buffer entry for interpolation
 */
export interface SnapshotEntry {
    tick: number;
    timestamp: number;
    entities: Map<string, SerializedNetworkEntity>;
}

/**
 * Callback types for network events
 */
export interface NetworkEventCallbacks {
    onPlayerJoin?: (clientId: string, playerName: string) => void;
    onPlayerLeave?: (clientId: string) => void;
    onConnected?: () => void;
    onDisconnected?: (reason?: string) => void;
    onError?: (error: Error) => void;
}

/**
 * Options for creating a network entity
 */
export interface NetworkEntityOptions {
    entityType: string;
    position?: { x: number; y: number };
    velocity?: { x: number; y: number };
    additionalComponents?: Array<{ type: new (...args: unknown[]) => unknown; args: unknown[] }>;
    tags?: string[];
}
