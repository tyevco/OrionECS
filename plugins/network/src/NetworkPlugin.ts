/**
 * Network Plugin for OrionECS
 *
 * A comprehensive multiplayer networking plugin that provides:
 * - Transport-agnostic architecture (WebSocket, Socket.IO, WebRTC, etc.)
 * - Client-side prediction with input buffering
 * - Server reconciliation
 * - Entity interpolation for smooth remote player movement
 * - Authoritative server architecture
 *
 * @example Server:
 * ```typescript
 * import { EngineBuilder } from '@orion-ecs/core';
 * import { NetworkPlugin, createWebSocketServerTransport } from '@orion-ecs/network';
 * import { WebSocketServer } from 'ws';
 *
 * const transport = createWebSocketServerTransport(WebSocketServer, { debug: true });
 * const networkPlugin = new NetworkPlugin({ role: 'server', transport });
 *
 * const engine = new EngineBuilder()
 *   .use(networkPlugin)
 *   .build();
 *
 * await networkPlugin.listen(8080);
 * ```
 *
 * @example Client:
 * ```typescript
 * import { EngineBuilder } from '@orion-ecs/core';
 * import { NetworkPlugin, createWebSocketClientTransport } from '@orion-ecs/network';
 *
 * const transport = createWebSocketClientTransport({ debug: true });
 * const networkPlugin = new NetworkPlugin({ role: 'client', transport });
 *
 * const engine = new EngineBuilder()
 *   .use(networkPlugin)
 *   .build();
 *
 * await networkPlugin.connect('ws://localhost:8080', 'PlayerName');
 * ```
 */

import type { EnginePlugin, EntityDef, PluginContext } from '@orion-ecs/core';
import {
    ClientInputState,
    InputBuffer,
    InterpolationBuffer,
    LocalPlayer,
    NetworkId,
    NetworkInput,
    NetworkPosition,
    NetworkVelocity,
    RemotePlayer,
    ServerState,
    serializeNetworkEntity,
} from './components';
import type {
    ClientConnection,
    ClientToServerMessage,
    ClientTransport,
    InputState,
    NetworkConfig,
    NetworkEntityOptions,
    NetworkEventCallbacks,
    NetworkRole,
    NetworkTransport,
    SerializedNetworkEntity,
    ServerToClientMessage,
    ServerTransport,
} from './types';
import { DEFAULT_NETWORK_CONFIG } from './types';

// ============================================================================
// Network Plugin Options
// ============================================================================

export interface NetworkPluginOptions {
    /** Role: 'server' or 'client' */
    role: NetworkRole;

    /** Transport implementation */
    transport: NetworkTransport;

    /** Network configuration (optional, uses defaults) */
    config?: Partial<NetworkConfig>;

    /** Event callbacks */
    callbacks?: NetworkEventCallbacks;
}

// ============================================================================
// Network API (exposed on engine)
// ============================================================================

export class NetworkAPI {
    constructor(private plugin: NetworkPlugin) {}

    // Connection management
    get isServer(): boolean {
        return this.plugin.role === 'server';
    }

    get isClient(): boolean {
        return this.plugin.role === 'client';
    }

    get isConnected(): boolean {
        return this.plugin.transport.state === 'connected';
    }

    get latency(): number {
        return this.plugin.role === 'client'
            ? (this.plugin.transport as ClientTransport).latency
            : 0;
    }

    get serverTime(): number {
        return this.plugin.getServerTime();
    }

    get currentTick(): number {
        return this.plugin.currentTick;
    }

    // Entity management
    createNetworkEntity(options: NetworkEntityOptions): EntityDef | null {
        return this.plugin.createNetworkEntity(options);
    }

    destroyNetworkEntity(networkEntityId: string): void {
        this.plugin.destroyNetworkEntity(networkEntityId);
    }

    getNetworkEntity(networkEntityId: string): EntityDef | null {
        return this.plugin.getNetworkEntity(networkEntityId);
    }

    getLocalPlayer(): EntityDef | null {
        return this.plugin.getLocalPlayer();
    }

    // Input (client only)
    setInput(input: Partial<InputState>): void {
        this.plugin.setInput(input);
    }

    // Server only
    getConnectedClients(): ClientConnection[] {
        return this.plugin.getConnectedClients();
    }

    kickClient(clientId: string, reason?: string): void {
        this.plugin.kickClient(clientId, reason);
    }
}

// ============================================================================
// Network Plugin Implementation
// ============================================================================

export class NetworkPlugin implements EnginePlugin {
    readonly name = 'NetworkPlugin';
    readonly version = '1.0.0';

    readonly role: NetworkRole;
    readonly transport: NetworkTransport;
    readonly config: NetworkConfig;

    private context: PluginContext | null = null;
    private networkAPI: NetworkAPI;
    private callbacks: NetworkEventCallbacks;

    // Server state
    private clients: Map<string, ClientConnection> = new Map();
    private networkEntities: Map<string, EntityDef> = new Map();
    private networkIdCounter = 0;

    // Client state
    private localPlayerId: string | null = null;
    private localPlayerNetworkId: string | null = null;

    // Tick tracking
    private _currentTick = 0;
    private tickAccumulator = 0;
    private lastUpdateTime = 0;
    private serverStartTime = 0;

    // Snapshot timing
    private lastSnapshotTime = 0;

    constructor(options: NetworkPluginOptions) {
        this.role = options.role;
        this.transport = options.transport;
        this.config = { ...DEFAULT_NETWORK_CONFIG, ...options.config };
        this.callbacks = options.callbacks ?? {};
        this.networkAPI = new NetworkAPI(this);
    }

    get currentTick(): number {
        return this._currentTick;
    }

    // ============================================================================
    // Plugin Lifecycle
    // ============================================================================

    install(context: PluginContext): void {
        this.context = context;
        this.serverStartTime = Date.now();
        this.lastUpdateTime = this.serverStartTime;

        // Register components
        this.registerComponents(context);

        // Setup transport handlers
        this.setupTransportHandlers();

        // Create systems based on role
        if (this.role === 'server') {
            this.createServerSystems(context);
        } else {
            this.createClientSystems(context);
        }

        // Extend engine with network API
        context.extend('network', this.networkAPI);

        this.log(`Installed as ${this.role}`);
    }

    uninstall(): void {
        this.transport.destroy();
        this.clients.clear();
        this.networkEntities.clear();
        this.context = null;
        this.log('Uninstalled');
    }

    // ============================================================================
    // Component Registration
    // ============================================================================

    private registerComponents(context: PluginContext): void {
        context.registerComponent(NetworkId);
        context.registerComponent(NetworkPosition);
        context.registerComponent(NetworkVelocity);
        context.registerComponent(NetworkInput);
        context.registerComponent(InputBuffer);
        context.registerComponent(ServerState);
        context.registerComponent(InterpolationBuffer);
        context.registerComponent(LocalPlayer);
        context.registerComponent(RemotePlayer);
        context.registerComponent(ClientInputState);
    }

    // ============================================================================
    // Transport Handlers
    // ============================================================================

    private setupTransportHandlers(): void {
        this.transport.onMessage((message, senderId) => {
            if (this.role === 'server') {
                this.handleClientMessage(message as ClientToServerMessage, senderId!);
            } else {
                this.handleServerMessage(message as ServerToClientMessage);
            }
        });

        this.transport.onConnect((connectionId) => {
            if (this.role === 'server') {
                this.log(`Client connected: ${this.sanitizeLog(connectionId)}`);
            } else {
                this.log('Connected to server');
                if (this.callbacks.onConnected) {
                    this.callbacks.onConnected();
                }
            }
        });

        this.transport.onDisconnect((connectionId, reason) => {
            if (this.role === 'server') {
                this.handleClientDisconnect(connectionId, reason);
            } else {
                this.log(`Disconnected: ${this.sanitizeLog(reason || '')}`);
                if (this.callbacks.onDisconnected) {
                    this.callbacks.onDisconnected(reason);
                }
            }
        });

        this.transport.onError((error) => {
            this.log('Transport error:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
        });
    }

    // ============================================================================
    // Server Methods
    // ============================================================================

    async listen(port: number, host?: string): Promise<void> {
        if (this.role !== 'server') {
            throw new Error('Only server can listen');
        }

        const serverTransport = this.transport as ServerTransport;
        await serverTransport.listen(port, host);
        this.log(`Listening on port ${port}`);
    }

    async close(): Promise<void> {
        if (this.role !== 'server') {
            throw new Error('Only server can close');
        }

        const serverTransport = this.transport as ServerTransport;
        await serverTransport.close();
        this.log('Server closed');
    }

    private handleClientMessage(message: ClientToServerMessage, senderId: string): void {
        switch (message.type) {
            case 'join':
                this.handleJoinRequest(senderId, message.data.playerName);
                break;

            case 'input':
                this.handleClientInput(senderId, message.data);
                break;

            case 'ping':
                this.handlePing(senderId, message.data.clientTime);
                break;
        }
    }

    private handleJoinRequest(clientId: string, playerName: string): void {
        if (!this.context) return;

        // Create player entity
        const entity = this.createNetworkEntity({
            entityType: 'player',
            position: {
                x: Math.random() * 800,
                y: Math.random() * 600,
            },
            tags: ['player', 'networked'],
        });

        if (!entity) {
            this.sendToClient(clientId, {
                type: 'join_rejected',
                timestamp: Date.now(),
                data: { reason: 'Failed to create player entity' },
            });
            return;
        }

        const networkId = entity.getComponent(NetworkId);
        networkId.ownerId = clientId;

        // Add server-side input component
        entity.addComponent(ClientInputState);

        // Store client connection
        const connection: ClientConnection = {
            id: clientId,
            playerName,
            networkEntityId: networkId.networkEntityId,
            joinedAt: Date.now(),
            lastInputTime: Date.now(),
            lastInputSequence: 0,
            latency: 0,
        };
        this.clients.set(clientId, connection);

        // Send acceptance
        this.sendToClient(clientId, {
            type: 'join_accepted',
            timestamp: Date.now(),
            data: {
                clientId,
                networkEntityId: networkId.networkEntityId,
                serverConfig: this.config,
                serverTime: Date.now(),
            },
        });

        // Broadcast player joined
        (this.transport as ServerTransport).broadcastExcept(clientId, {
            type: 'player_joined',
            timestamp: Date.now(),
            data: {
                clientId,
                playerName,
                networkEntityId: networkId.networkEntityId,
            },
        });

        this.log(`Player ${this.sanitizeLog(playerName)} joined (${this.clients.size} players)`);

        if (this.callbacks.onPlayerJoin) {
            this.callbacks.onPlayerJoin(clientId, playerName);
        }
    }

    private handleClientInput(
        clientId: string,
        data: { sequence: number; inputs: InputState; timestamp: number }
    ): void {
        const connection = this.clients.get(clientId);
        if (!connection || !connection.networkEntityId) return;

        const entity = this.networkEntities.get(connection.networkEntityId);
        if (!entity || !entity.hasComponent(ClientInputState)) return;

        // Apply input
        const inputState = entity.getComponent(ClientInputState);
        inputState.applyInput(data.inputs, data.sequence);

        connection.lastInputTime = Date.now();
        connection.lastInputSequence = data.sequence;

        // Send acknowledgment
        const position = entity.getComponent(NetworkPosition);
        const velocity = entity.hasComponent(NetworkVelocity)
            ? entity.getComponent(NetworkVelocity)
            : undefined;

        this.sendToClient(clientId, {
            type: 'input_ack',
            timestamp: Date.now(),
            data: {
                sequence: data.sequence,
                position: { x: position.x, y: position.y },
                velocity: velocity ? { x: velocity.x, y: velocity.y } : undefined,
                serverTick: this._currentTick,
                serverTime: Date.now(),
            },
        });
    }

    private handlePing(clientId: string, clientTime: number): void {
        this.sendToClient(clientId, {
            type: 'pong',
            timestamp: Date.now(),
            data: {
                clientTime,
                serverTime: Date.now(),
            },
        });
    }

    private handleClientDisconnect(clientId: string, reason?: string): void {
        const connection = this.clients.get(clientId);
        if (!connection) return;

        // Remove player entity
        if (connection.networkEntityId) {
            this.destroyNetworkEntity(connection.networkEntityId);
        }

        this.clients.delete(clientId);

        // Broadcast player left
        (this.transport as ServerTransport).broadcast({
            type: 'player_left',
            timestamp: Date.now(),
            data: { clientId },
        });

        this.log(
            `Player ${this.sanitizeLog(connection.playerName)} left: ${this.sanitizeLog(reason || '')}`
        );

        if (this.callbacks.onPlayerLeave) {
            this.callbacks.onPlayerLeave(clientId);
        }
    }

    private sendToClient(clientId: string, message: ServerToClientMessage): void {
        (this.transport as ServerTransport).sendTo(clientId, message);
    }

    // ============================================================================
    // Client Methods
    // ============================================================================

    async connect(url: string, playerName: string): Promise<void> {
        if (this.role !== 'client') {
            throw new Error('Only client can connect');
        }

        await this.transport.connect(url);

        // Send join request
        this.transport.send({
            type: 'join',
            timestamp: Date.now(),
            data: { playerName },
        });
    }

    disconnect(): void {
        if (this.role !== 'client') {
            throw new Error('Only client can disconnect');
        }

        this.transport.disconnect();
    }

    private handleServerMessage(message: ServerToClientMessage): void {
        switch (message.type) {
            case 'join_accepted':
                this.handleJoinAccepted(message.data);
                break;

            case 'join_rejected':
                this.log('Join rejected:', message.data.reason);
                break;

            case 'world_snapshot':
                this.handleWorldSnapshot(message.data);
                break;

            case 'input_ack':
                this.handleInputAck(message.data);
                break;

            case 'entity_spawn':
                this.handleEntitySpawn(message.data);
                break;

            case 'entity_destroy':
                this.handleEntityDestroy(message.data.networkEntityId);
                break;

            case 'player_joined':
                this.log(`Player ${this.sanitizeLog(message.data.playerName)} joined`);
                if (this.callbacks.onPlayerJoin) {
                    this.callbacks.onPlayerJoin(message.data.clientId, message.data.playerName);
                }
                break;

            case 'player_left':
                this.log(`Player ${this.sanitizeLog(message.data.clientId)} left`);
                if (this.callbacks.onPlayerLeave) {
                    this.callbacks.onPlayerLeave(message.data.clientId);
                }
                break;
        }
    }

    private handleJoinAccepted(data: {
        clientId: string;
        networkEntityId: string;
        serverConfig: NetworkConfig;
        serverTime: number;
    }): void {
        this.localPlayerId = data.clientId;
        this.localPlayerNetworkId = data.networkEntityId;

        // Update transport connection ID
        if ('setConnectionId' in this.transport) {
            (
                this.transport as unknown as { setConnectionId: (id: string) => void }
            ).setConnectionId(data.clientId);
        }

        this.log(
            `Joined as ${this.sanitizeLog(data.clientId)}, entity: ${this.sanitizeLog(data.networkEntityId)}`
        );
    }

    private handleWorldSnapshot(data: {
        tick: number;
        timestamp: number;
        entities: SerializedNetworkEntity[];
        removedEntityIds?: string[];
    }): void {
        if (!this.context) return;

        this._currentTick = data.tick;

        // Handle removed entities
        if (data.removedEntityIds) {
            for (const id of data.removedEntityIds) {
                this.handleEntityDestroy(id);
            }
        }

        // Update or create entities
        for (const entityData of data.entities) {
            let entity = this.networkEntities.get(entityData.networkEntityId);

            if (!entity) {
                entity = this.createEntityFromSnapshot(entityData);
                if (!entity) continue;
            }

            // Update entity based on whether it's local or remote
            const isLocalPlayer = entityData.networkEntityId === this.localPlayerNetworkId;

            if (isLocalPlayer) {
                // Local player - server state is only updated through input_ack, not world snapshots
                // This ensures proper reconciliation
            } else {
                // Remote entity - add snapshot for interpolation
                if (entity.hasComponent(InterpolationBuffer) && entityData.position) {
                    const interpBuffer = entity.getComponent(InterpolationBuffer);
                    const velocity = entityData.velocity
                        ? new NetworkVelocity(entityData.velocity.x, entityData.velocity.y)
                        : undefined;
                    interpBuffer.addSnapshot(
                        new NetworkPosition(entityData.position.x, entityData.position.y),
                        data.tick,
                        data.timestamp,
                        velocity
                    );
                }
            }
        }
    }

    private handleInputAck(data: {
        sequence: number;
        position: { x: number; y: number };
        velocity?: { x: number; y: number };
        serverTick: number;
        serverTime: number;
    }): void {
        const localPlayer = this.getLocalPlayer();
        if (!localPlayer) return;

        // Update server state
        if (localPlayer.hasComponent(ServerState)) {
            const serverState = localPlayer.getComponent(ServerState);
            serverState.update(data.sequence, data.position, data.velocity, data.serverTick);
        }

        // Acknowledge input in buffer
        if (localPlayer.hasComponent(InputBuffer)) {
            const inputBuffer = localPlayer.getComponent(InputBuffer);
            inputBuffer.acknowledgeInput(data.sequence);

            // Reconciliation: if there are unacknowledged inputs, replay them
            if (this.config.enableReconciliation) {
                const unackedInputs = inputBuffer.getUnacknowledgedInputs();
                if (unackedInputs.length > 0) {
                    this.performReconciliation(
                        localPlayer,
                        data.position,
                        data.velocity,
                        unackedInputs
                    );
                }
            }
        }
    }

    private performReconciliation(
        entity: EntityDef,
        serverPosition: { x: number; y: number },
        serverVelocity: { x: number; y: number } | undefined,
        unackedInputs: { input: InputState }[]
    ): void {
        const position = entity.getComponent(NetworkPosition);
        const velocity = entity.hasComponent(NetworkVelocity)
            ? entity.getComponent(NetworkVelocity)
            : null;

        // Reset to server state
        position.set(serverPosition.x, serverPosition.y);
        if (velocity && serverVelocity) {
            velocity.set(serverVelocity.x, serverVelocity.y);
        }

        // Replay unacknowledged inputs
        const dt = 1 / this.config.clientTickRate;
        const moveSpeed = 200; // Should be configurable

        for (const { input } of unackedInputs) {
            // Apply input
            const velX = input.moveX * moveSpeed;
            const velY = input.moveY * moveSpeed;

            position.x += velX * dt;
            position.y += velY * dt;
        }

        this.log(`Reconciled ${unackedInputs.length} inputs`);
    }

    private handleEntitySpawn(data: SerializedNetworkEntity): void {
        if (this.networkEntities.has(data.networkEntityId)) return;

        this.createEntityFromSnapshot(data);
    }

    private handleEntityDestroy(networkEntityId: string): void {
        const entity = this.networkEntities.get(networkEntityId);
        if (!entity) return;

        entity.queueFree();
        this.networkEntities.delete(networkEntityId);
        this.log(`Entity destroyed: ${this.sanitizeLog(networkEntityId)}`);
    }

    private createEntityFromSnapshot(data: SerializedNetworkEntity): EntityDef | undefined {
        if (!this.context) return undefined;

        const engine = this.context.getEngine();
        const entity = engine.createEntity(`Network_${data.networkEntityId}`);

        // Add network ID
        entity.addComponent(NetworkId, data.networkEntityId, data.ownerId, data.entityType);

        // Add position
        if (data.position) {
            entity.addComponent(NetworkPosition, data.position.x, data.position.y);
        } else {
            entity.addComponent(NetworkPosition, 0, 0);
        }

        // Add velocity
        if (data.velocity) {
            entity.addComponent(NetworkVelocity, data.velocity.x, data.velocity.y);
        }

        // Determine if local or remote
        const isLocalPlayer = data.networkEntityId === this.localPlayerNetworkId;

        if (isLocalPlayer) {
            // Local player - add prediction components
            entity.addComponent(LocalPlayer, this.localPlayerId!);
            entity.addComponent(NetworkInput);
            entity.addComponent(InputBuffer, this.config.reconciliationWindow);
            entity.addComponent(ServerState);
            entity.addTag('local-player');
            this.log('Created local player entity');
        } else {
            // Remote entity - add interpolation
            entity.addComponent(RemotePlayer, data.ownerId);
            entity.addComponent(InterpolationBuffer, 10, this.config.interpolationDelay);
            entity.addTag('remote-player');
        }

        entity.addTag('networked');
        if (data.entityType === 'player') {
            entity.addTag('player');
        }

        this.networkEntities.set(data.networkEntityId, entity);
        return entity;
    }

    // ============================================================================
    // Systems
    // ============================================================================

    private createServerSystems(context: PluginContext): void {
        // Input processing system
        context.createSystem(
            'NetworkInputProcessingSystem',
            { all: [NetworkPosition, NetworkVelocity, ClientInputState] },
            {
                priority: 1000,
                act: (_entity, ...components) => {
                    const [position, velocity, input] = components as [
                        NetworkPosition,
                        NetworkVelocity,
                        ClientInputState,
                    ];
                    const moveSpeed = 200;
                    const dt = 1 / this.config.tickRate;

                    velocity.set(input.moveX * moveSpeed, input.moveY * moveSpeed);
                    position.x += velocity.x * dt;
                    position.y += velocity.y * dt;

                    // World bounds (configurable later)
                    position.x = Math.max(0, Math.min(800, position.x));
                    position.y = Math.max(0, Math.min(600, position.y));
                },
            },
            true // Fixed update
        );

        // Network broadcast system
        context.createSystem(
            'NetworkBroadcastSystem',
            { all: [] },
            {
                priority: -1000,
                after: () => {
                    const now = Date.now();
                    const snapshotInterval = 1000 / this.config.snapshotRate;

                    if (now - this.lastSnapshotTime < snapshotInterval) return;
                    this.lastSnapshotTime = now;

                    this.broadcastWorldSnapshot();
                },
            },
            false // Variable update
        );

        // Tick counter system
        context.createSystem(
            'NetworkTickSystem',
            { all: [] },
            {
                priority: 2000,
                before: () => {
                    this._currentTick++;
                },
            },
            true // Fixed update
        );
    }

    private createClientSystems(context: PluginContext): void {
        // Client prediction system
        context.createSystem(
            'ClientPredictionSystem',
            { all: [NetworkPosition, NetworkVelocity, NetworkInput, LocalPlayer] },
            {
                priority: 1000,
                act: (_entity, ...components) => {
                    if (!this.config.enablePrediction) return;

                    const [position, velocity, input] = components as [
                        NetworkPosition,
                        NetworkVelocity,
                        NetworkInput,
                    ];
                    const moveSpeed = 200;
                    const dt = 1 / this.config.clientTickRate;

                    // Apply input immediately (prediction)
                    velocity.set(input.moveX * moveSpeed, input.moveY * moveSpeed);
                    position.x += velocity.x * dt;
                    position.y += velocity.y * dt;

                    // World bounds
                    position.x = Math.max(0, Math.min(800, position.x));
                    position.y = Math.max(0, Math.min(600, position.y));
                },
            },
            true // Fixed update
        );

        // Input send system
        context.createSystem(
            'ClientInputSendSystem',
            { all: [NetworkInput, InputBuffer, LocalPlayer] },
            {
                priority: 900,
                after: () => {
                    const localPlayer = this.getLocalPlayer();
                    if (!localPlayer) return;

                    const input = localPlayer.getComponent(NetworkInput);
                    const inputBuffer = localPlayer.getComponent(InputBuffer);

                    // Only send if there's actual input
                    if (
                        input.moveX !== 0 ||
                        input.moveY !== 0 ||
                        Object.keys(input.actions).length > 0
                    ) {
                        const inputState = input.toInputState();
                        const sequence = inputBuffer.addInput(inputState);

                        this.transport.send({
                            type: 'input',
                            timestamp: Date.now(),
                            data: {
                                sequence,
                                inputs: inputState,
                                timestamp: Date.now(),
                            },
                        });
                    }
                },
            },
            true // Fixed update
        );

        // Interpolation system
        context.createSystem(
            'ClientInterpolationSystem',
            { all: [NetworkPosition, InterpolationBuffer, RemotePlayer] },
            {
                priority: 800,
                act: (_entity, ...components) => {
                    if (!this.config.enableInterpolation) return;

                    const [position, interpBuffer] = components as [
                        NetworkPosition,
                        InterpolationBuffer,
                    ];
                    const interpolated = interpBuffer.getInterpolatedPosition(Date.now());

                    if (interpolated) {
                        position.set(interpolated.x, interpolated.y);
                    }
                },
            },
            false // Variable update for smooth rendering
        );
    }

    // ============================================================================
    // World Snapshot (Server)
    // ============================================================================

    private broadcastWorldSnapshot(): void {
        const entities: SerializedNetworkEntity[] = [];

        for (const [_networkEntityId, entity] of this.networkEntities) {
            if (!entity.hasComponent(NetworkId)) continue;

            const networkId = entity.getComponent(NetworkId);
            const position = entity.hasComponent(NetworkPosition)
                ? entity.getComponent(NetworkPosition)
                : undefined;
            const velocity = entity.hasComponent(NetworkVelocity)
                ? entity.getComponent(NetworkVelocity)
                : undefined;

            entities.push(serializeNetworkEntity(networkId, position, velocity));
        }

        const snapshot: ServerToClientMessage = {
            type: 'world_snapshot',
            timestamp: Date.now(),
            data: {
                tick: this._currentTick,
                timestamp: Date.now(),
                entities,
            },
        };

        (this.transport as ServerTransport).broadcast(snapshot);
    }

    // ============================================================================
    // Entity Management
    // ============================================================================

    createNetworkEntity(options: NetworkEntityOptions): EntityDef | null {
        if (!this.context) return null;

        const engine = this.context.getEngine();
        const networkEntityId = `entity_${++this.networkIdCounter}_${Date.now()}`;
        const entity = engine.createEntity(`Network_${networkEntityId}`);

        // Add network ID
        entity.addComponent(NetworkId, networkEntityId, '', options.entityType);

        // Add position
        entity.addComponent(NetworkPosition, options.position?.x ?? 0, options.position?.y ?? 0);

        // Add velocity
        entity.addComponent(NetworkVelocity, options.velocity?.x ?? 0, options.velocity?.y ?? 0);

        // Add tags
        entity.addTag('networked');
        if (options.tags) {
            for (const tag of options.tags) {
                entity.addTag(tag);
            }
        }

        // Add additional components
        if (options.additionalComponents) {
            for (const comp of options.additionalComponents) {
                entity.addComponent(comp.type, ...comp.args);
            }
        }

        this.networkEntities.set(networkEntityId, entity);

        // If server, broadcast entity spawn
        if (this.role === 'server') {
            const networkId = entity.getComponent(NetworkId);
            const position = entity.getComponent(NetworkPosition);
            const velocity = entity.getComponent(NetworkVelocity);

            (this.transport as ServerTransport).broadcast({
                type: 'entity_spawn',
                timestamp: Date.now(),
                data: serializeNetworkEntity(networkId, position, velocity),
            });
        }

        return entity;
    }

    destroyNetworkEntity(networkEntityId: string): void {
        const entity = this.networkEntities.get(networkEntityId);
        if (!entity) return;

        entity.queueFree();
        this.networkEntities.delete(networkEntityId);

        // If server, broadcast entity destruction
        if (this.role === 'server') {
            (this.transport as ServerTransport).broadcast({
                type: 'entity_destroy',
                timestamp: Date.now(),
                data: { networkEntityId },
            });
        }
    }

    getNetworkEntity(networkEntityId: string): EntityDef | null {
        return this.networkEntities.get(networkEntityId) ?? null;
    }

    getLocalPlayer(): EntityDef | null {
        if (!this.localPlayerNetworkId) return null;
        return this.networkEntities.get(this.localPlayerNetworkId) ?? null;
    }

    // ============================================================================
    // Input Management (Client)
    // ============================================================================

    setInput(input: Partial<InputState>): void {
        const localPlayer = this.getLocalPlayer();
        if (!localPlayer || !localPlayer.hasComponent(NetworkInput)) return;

        const networkInput = localPlayer.getComponent(NetworkInput);

        if (input.moveX !== undefined) networkInput.moveX = input.moveX;
        if (input.moveY !== undefined) networkInput.moveY = input.moveY;
        if (input.aimX !== undefined) networkInput.aimX = input.aimX;
        if (input.aimY !== undefined) networkInput.aimY = input.aimY;
        if (input.actions) {
            for (const [action, pressed] of Object.entries(input.actions)) {
                networkInput.setAction(action, pressed);
            }
        }
    }

    // ============================================================================
    // Client Management (Server)
    // ============================================================================

    getConnectedClients(): ClientConnection[] {
        return Array.from(this.clients.values());
    }

    kickClient(clientId: string, reason?: string): void {
        if (this.role !== 'server') return;

        (this.transport as ServerTransport).disconnectClient(clientId, reason);
    }

    // ============================================================================
    // Time Management
    // ============================================================================

    getServerTime(): number {
        if (this.role === 'server') {
            return Date.now();
        } else {
            const clientTransport = this.transport as ClientTransport;
            return Date.now() + clientTransport.serverTimeOffset;
        }
    }

    // ============================================================================
    // Utilities
    // ============================================================================

    private log(...args: unknown[]): void {
        if (this.config.debug) {
            console.log(`[NetworkPlugin:${this.role}]`, ...args);
        }
    }

    /**
     * Sanitize string for safe logging (remove newlines to prevent log injection)
     */
    private sanitizeLog(str: string): string {
        if (typeof str !== 'string') return String(str);
        return str.replace(/[\r\n]/g, '');
    }
}
