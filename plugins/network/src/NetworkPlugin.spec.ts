/**
 * NetworkPlugin Test Suite
 *
 * Comprehensive tests covering:
 * - Component initialization and functionality
 * - Plugin lifecycle (install/uninstall)
 * - API functionality
 * - Mock transport behavior
 * - Client-side prediction components
 * - Interpolation components
 */

import type { Engine } from '@orion-ecs/core';
import { TestEngineBuilder } from '@orion-ecs/testing';
import {
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
import { NetworkAPI, NetworkPlugin } from './NetworkPlugin';
import type { ClientTransport, ConnectionState, NetworkMessage, ServerTransport } from './types';
import { DEFAULT_NETWORK_CONFIG } from './types';

// ============================================================================
// Mock Transports
// ============================================================================

/**
 * Mock client transport for testing
 */
class MockClientTransport implements ClientTransport {
    private _state: ConnectionState = 'disconnected';
    private _latency = 50;
    private _serverTimeOffset = 0;
    private _connectionId = 'mock-client-1';

    private messageHandler: ((message: NetworkMessage, senderId?: string) => void) | null = null;
    private connectHandler: ((connectionId: string) => void) | null = null;
    private disconnectHandler: ((connectionId: string, reason?: string) => void) | null = null;
    private errorHandler: ((error: Error) => void) | null = null;

    public sentMessages: NetworkMessage[] = [];

    get state(): ConnectionState {
        return this._state;
    }

    get connectionId(): string {
        return this._connectionId;
    }

    get latency(): number {
        return this._latency;
    }

    get serverTimeOffset(): number {
        return this._serverTimeOffset;
    }

    async connect(_url: string): Promise<void> {
        this._state = 'connecting';
        await new Promise((resolve) => setTimeout(resolve, 10));
        this._state = 'connected';
        if (this.connectHandler) {
            this.connectHandler(this._connectionId);
        }
    }

    disconnect(): void {
        this._state = 'disconnected';
        if (this.disconnectHandler) {
            this.disconnectHandler(this._connectionId, 'Client disconnect');
        }
    }

    send(message: NetworkMessage): void {
        this.sentMessages.push(message);
    }

    onMessage(handler: (message: NetworkMessage, senderId?: string) => void): void {
        this.messageHandler = handler;
    }

    onConnect(handler: (connectionId: string) => void): void {
        this.connectHandler = handler;
    }

    onDisconnect(handler: (connectionId: string, reason?: string) => void): void {
        this.disconnectHandler = handler;
    }

    onError(handler: (error: Error) => void): void {
        this.errorHandler = handler;
    }

    destroy(): void {
        this.disconnect();
        this.messageHandler = null;
        this.connectHandler = null;
        this.disconnectHandler = null;
        this.errorHandler = null;
    }

    // Test helpers
    simulateMessage(message: NetworkMessage): void {
        if (this.messageHandler) {
            this.messageHandler(message);
        }
    }

    simulateError(error: Error): void {
        if (this.errorHandler) {
            this.errorHandler(error);
        }
    }

    setConnectionId(id: string): void {
        this._connectionId = id;
    }

    clearSentMessages(): void {
        this.sentMessages = [];
    }
}

/**
 * Mock server transport for testing
 */
class MockServerTransport implements ServerTransport {
    private _state: ConnectionState = 'disconnected';
    private connectedClients: Set<string> = new Set();

    private messageHandler: ((message: NetworkMessage, senderId?: string) => void) | null = null;
    private connectHandler: ((connectionId: string) => void) | null = null;
    private disconnectHandler: ((connectionId: string, reason?: string) => void) | null = null;
    private errorHandler: ((error: Error) => void) | null = null;

    public sentMessages: Map<string, NetworkMessage[]> = new Map();
    public broadcastMessages: NetworkMessage[] = [];

    get state(): ConnectionState {
        return this._state;
    }

    get connectionId(): string | undefined {
        return undefined;
    }

    async connect(_url: string): Promise<void> {
        // Server doesn't connect
    }

    async listen(_port: number, _host?: string): Promise<void> {
        this._state = 'connected';
    }

    async close(): Promise<void> {
        this._state = 'disconnected';
        this.connectedClients.clear();
    }

    disconnect(): void {
        this._state = 'disconnected';
    }

    send(_message: NetworkMessage): void {
        // Not used on server
    }

    sendTo(connectionId: string, message: NetworkMessage): void {
        if (!this.sentMessages.has(connectionId)) {
            this.sentMessages.set(connectionId, []);
        }
        this.sentMessages.get(connectionId)!.push(message);
    }

    broadcast(message: NetworkMessage): void {
        this.broadcastMessages.push(message);
    }

    broadcastExcept(_excludeId: string, message: NetworkMessage): void {
        this.broadcastMessages.push(message);
    }

    getConnectedClients(): string[] {
        return Array.from(this.connectedClients);
    }

    disconnectClient(connectionId: string, _reason?: string): void {
        this.connectedClients.delete(connectionId);
        if (this.disconnectHandler) {
            this.disconnectHandler(connectionId, 'Server kicked');
        }
    }

    onMessage(handler: (message: NetworkMessage, senderId?: string) => void): void {
        this.messageHandler = handler;
    }

    onConnect(handler: (connectionId: string) => void): void {
        this.connectHandler = handler;
    }

    onDisconnect(handler: (connectionId: string, reason?: string) => void): void {
        this.disconnectHandler = handler;
    }

    onError(handler: (error: Error) => void): void {
        this.errorHandler = handler;
    }

    destroy(): void {
        this.close();
        this.messageHandler = null;
        this.connectHandler = null;
        this.disconnectHandler = null;
        this.errorHandler = null;
    }

    // Test helpers
    simulateClientConnect(clientId: string): void {
        this.connectedClients.add(clientId);
        if (this.connectHandler) {
            this.connectHandler(clientId);
        }
    }

    simulateClientMessage(clientId: string, message: NetworkMessage): void {
        if (this.messageHandler) {
            this.messageHandler(message, clientId);
        }
    }

    simulateClientDisconnect(clientId: string, reason?: string): void {
        this.connectedClients.delete(clientId);
        if (this.disconnectHandler) {
            this.disconnectHandler(clientId, reason);
        }
    }

    clearMessages(): void {
        this.sentMessages.clear();
        this.broadcastMessages = [];
    }
}

// Type extensions for testing
interface EngineWithNetwork extends Engine {
    network: NetworkAPI;
}

// ============================================================================
// Component Tests
// ============================================================================

describe('Network Components', () => {
    describe('NetworkId', () => {
        test('should create with default values', () => {
            const networkId = new NetworkId();
            expect(networkId.networkEntityId).toBe('');
            expect(networkId.ownerId).toBe('');
            expect(networkId.entityType).toBe('generic');
            expect(networkId.dirty).toBe(true);
            expect(networkId.lastUpdateTick).toBe(0);
        });

        test('should create with custom values', () => {
            const networkId = new NetworkId('entity_1', 'player_1', 'player', false, 100);
            expect(networkId.networkEntityId).toBe('entity_1');
            expect(networkId.ownerId).toBe('player_1');
            expect(networkId.entityType).toBe('player');
            expect(networkId.dirty).toBe(false);
            expect(networkId.lastUpdateTick).toBe(100);
        });

        test('should mark as dirty', () => {
            const networkId = new NetworkId('entity_1', 'player_1', 'player', false);
            expect(networkId.dirty).toBe(false);
            markNetworkDirty(networkId);
            expect(networkId.dirty).toBe(true);
        });

        test('should clear dirty flag', () => {
            const networkId = new NetworkId();
            expect(networkId.dirty).toBe(true);
            clearNetworkDirty(networkId);
            expect(networkId.dirty).toBe(false);
        });

        test('should serialize to JSON', () => {
            const networkId = new NetworkId('entity_1', 'player_1', 'player');
            const json = networkId.toJSON();
            expect(json).toEqual({
                networkEntityId: 'entity_1',
                ownerId: 'player_1',
                entityType: 'player',
            });
        });
    });

    describe('NetworkPosition', () => {
        test('should create with default values', () => {
            const pos = new NetworkPosition();
            expect(pos.x).toBe(0);
            expect(pos.y).toBe(0);
        });

        test('should create with custom values', () => {
            const pos = new NetworkPosition(100, 200);
            expect(pos.x).toBe(100);
            expect(pos.y).toBe(200);
        });

        test('should set position', () => {
            const pos = new NetworkPosition();
            pos.set(50, 75);
            expect(pos.x).toBe(50);
            expect(pos.y).toBe(75);
        });

        test('should clone position', () => {
            const pos = new NetworkPosition(10, 20);
            const cloned = pos.clone();
            expect(cloned.x).toBe(10);
            expect(cloned.y).toBe(20);
            expect(cloned).not.toBe(pos);
        });

        test('should calculate distance', () => {
            const pos1 = new NetworkPosition(0, 0);
            const pos2 = new NetworkPosition(3, 4);
            expect(pos1.distanceTo(pos2)).toBe(5);
        });

        test('should interpolate (lerp)', () => {
            const pos1 = new NetworkPosition(0, 0);
            const pos2 = new NetworkPosition(10, 20);
            const lerped = pos1.lerp(pos2, 0.5);
            expect(lerped.x).toBe(5);
            expect(lerped.y).toBe(10);
        });

        test('should serialize to JSON', () => {
            const pos = new NetworkPosition(15, 25);
            expect(pos.toJSON()).toEqual({ x: 15, y: 25 });
        });
    });

    describe('NetworkVelocity', () => {
        test('should create with default values', () => {
            const vel = new NetworkVelocity();
            expect(vel.x).toBe(0);
            expect(vel.y).toBe(0);
        });

        test('should create with custom values', () => {
            const vel = new NetworkVelocity(5, -10);
            expect(vel.x).toBe(5);
            expect(vel.y).toBe(-10);
        });

        test('should set velocity', () => {
            const vel = new NetworkVelocity();
            vel.set(100, -50);
            expect(vel.x).toBe(100);
            expect(vel.y).toBe(-50);
        });

        test('should clone velocity', () => {
            const vel = new NetworkVelocity(7, 14);
            const cloned = vel.clone();
            expect(cloned.x).toBe(7);
            expect(cloned.y).toBe(14);
            expect(cloned).not.toBe(vel);
        });
    });

    describe('LocalPlayer', () => {
        test('should create with default values', () => {
            const local = new LocalPlayer();
            expect(local.clientId).toBe('');
        });

        test('should create with client ID', () => {
            const local = new LocalPlayer('client_123');
            expect(local.clientId).toBe('client_123');
        });
    });

    describe('RemotePlayer', () => {
        test('should create with default values', () => {
            const remote = new RemotePlayer();
            expect(remote.clientId).toBe('');
        });

        test('should create with client ID', () => {
            const remote = new RemotePlayer('client_456');
            expect(remote.clientId).toBe('client_456');
        });
    });

    describe('NetworkInput', () => {
        test('should create with default values', () => {
            const input = new NetworkInput();
            expect(input.moveX).toBe(0);
            expect(input.moveY).toBe(0);
            expect(input.actions).toEqual({});
            expect(input.aimX).toBe(0);
            expect(input.aimY).toBe(0);
        });

        test('should set movement', () => {
            const input = new NetworkInput();
            input.setMovement(1, -1);
            expect(input.moveX).toBe(1);
            expect(input.moveY).toBe(-1);
        });

        test('should clamp movement to [-1, 1]', () => {
            const input = new NetworkInput();
            input.setMovement(5, -5);
            expect(input.moveX).toBe(1);
            expect(input.moveY).toBe(-1);
        });

        test('should set and check actions', () => {
            const input = new NetworkInput();
            input.setAction('shoot', true);
            input.setAction('jump', false);

            expect(input.isActionPressed('shoot')).toBe(true);
            expect(input.isActionPressed('jump')).toBe(false);
            expect(input.isActionPressed('nonexistent')).toBe(false);
        });

        test('should set aim', () => {
            const input = new NetworkInput();
            input.setAim(100, 200);
            expect(input.aimX).toBe(100);
            expect(input.aimY).toBe(200);
        });

        test('should convert to InputState', () => {
            const input = new NetworkInput();
            input.setMovement(1, 0);
            input.setAction('shoot', true);
            input.setAim(50, 75);

            const state = input.toInputState();
            expect(state).toEqual({
                moveX: 1,
                moveY: 0,
                actions: { shoot: true },
                aimX: 50,
                aimY: 75,
            });
        });

        test('should clear input', () => {
            const input = new NetworkInput();
            input.setMovement(1, 1);
            input.setAction('shoot', true);

            input.clear();

            expect(input.moveX).toBe(0);
            expect(input.moveY).toBe(0);
            expect(input.actions).toEqual({});
        });
    });

    describe('InputBuffer', () => {
        test('should create with default max size', () => {
            const buffer = new InputBuffer();
            expect(buffer.maxSize).toBe(60);
            expect(buffer.inputs).toEqual([]);
            expect(buffer.nextSequence).toBe(0);
            expect(buffer.lastAcknowledgedSequence).toBe(-1);
        });

        test('should create with custom max size', () => {
            const buffer = new InputBuffer(100);
            expect(buffer.maxSize).toBe(100);
        });

        test('should add input and return sequence', () => {
            const buffer = new InputBuffer();
            const seq1 = buffer.addInput({ moveX: 1, moveY: 0, actions: {} });
            const seq2 = buffer.addInput({ moveX: 0, moveY: 1, actions: {} });

            expect(seq1).toBe(0);
            expect(seq2).toBe(1);
            expect(buffer.inputs.length).toBe(2);
        });

        test('should trim old inputs when max size exceeded', () => {
            const buffer = new InputBuffer(3);

            buffer.addInput({ moveX: 1, moveY: 0, actions: {} });
            buffer.addInput({ moveX: 0, moveY: 1, actions: {} });
            buffer.addInput({ moveX: -1, moveY: 0, actions: {} });
            buffer.addInput({ moveX: 0, moveY: -1, actions: {} });

            expect(buffer.inputs.length).toBe(3);
            expect(buffer.inputs[0].sequence).toBe(1); // First input was trimmed
        });

        test('should acknowledge input', () => {
            const buffer = new InputBuffer();
            buffer.addInput({ moveX: 1, moveY: 0, actions: {} });
            buffer.addInput({ moveX: 0, moveY: 1, actions: {} });
            buffer.addInput({ moveX: -1, moveY: 0, actions: {} });

            buffer.acknowledgeInput(1);

            expect(buffer.lastAcknowledgedSequence).toBe(1);
            expect(buffer.inputs.length).toBe(1);
            expect(buffer.inputs[0].sequence).toBe(2);
        });

        test('should get unacknowledged inputs', () => {
            const buffer = new InputBuffer();
            buffer.addInput({ moveX: 1, moveY: 0, actions: {} });
            buffer.addInput({ moveX: 0, moveY: 1, actions: {} });
            buffer.addInput({ moveX: -1, moveY: 0, actions: {} });

            buffer.acknowledgeInput(0);

            const unacked = buffer.getUnacknowledgedInputs();
            expect(unacked.length).toBe(2);
            expect(unacked[0].sequence).toBe(1);
            expect(unacked[1].sequence).toBe(2);
        });

        test('should get latest input', () => {
            const buffer = new InputBuffer();
            expect(buffer.getLatestInput()).toBeNull();

            buffer.addInput({ moveX: 1, moveY: 0, actions: {} });
            buffer.addInput({ moveX: 0, moveY: 1, actions: {} });

            const latest = buffer.getLatestInput();
            expect(latest).not.toBeNull();
            expect(latest?.sequence).toBe(1);
            expect(latest?.input.moveY).toBe(1);
        });

        test('should clear buffer', () => {
            const buffer = new InputBuffer();
            buffer.addInput({ moveX: 1, moveY: 0, actions: {} });
            buffer.addInput({ moveX: 0, moveY: 1, actions: {} });
            buffer.acknowledgeInput(0);

            buffer.clear();

            expect(buffer.inputs).toEqual([]);
            expect(buffer.nextSequence).toBe(0);
            expect(buffer.lastAcknowledgedSequence).toBe(-1);
        });
    });

    describe('ServerState', () => {
        test('should create with default values', () => {
            const state = new ServerState();
            expect(state.lastAckSequence).toBe(-1);
            expect(state.serverPosition).toBeInstanceOf(NetworkPosition);
            expect(state.serverVelocity).toBeInstanceOf(NetworkVelocity);
            expect(state.serverTick).toBe(0);
            expect(state.lastUpdateTime).toBe(0);
        });

        test('should update state', () => {
            const state = new ServerState();
            state.update(5, { x: 100, y: 200 }, { x: 10, y: 20 }, 42);

            expect(state.lastAckSequence).toBe(5);
            expect(state.serverPosition.x).toBe(100);
            expect(state.serverPosition.y).toBe(200);
            expect(state.serverVelocity.x).toBe(10);
            expect(state.serverVelocity.y).toBe(20);
            expect(state.serverTick).toBe(42);
            expect(state.lastUpdateTime).toBeGreaterThan(0);
        });

        test('should handle update without velocity', () => {
            const state = new ServerState();
            state.update(3, { x: 50, y: 75 }, undefined, 10);

            expect(state.serverPosition.x).toBe(50);
            expect(state.serverVelocity.x).toBe(0);
        });
    });

    describe('InterpolationBuffer', () => {
        test('should create with default values', () => {
            const buffer = new InterpolationBuffer();
            expect(buffer.maxSnapshots).toBe(10);
            expect(buffer.delay).toBe(100);
            expect(buffer.snapshots).toEqual([]);
        });

        test('should add snapshot', () => {
            const buffer = new InterpolationBuffer();
            const pos = new NetworkPosition(100, 200);
            const vel = new NetworkVelocity(5, 10);

            buffer.addSnapshot(pos, 1, Date.now(), vel);

            expect(buffer.snapshots.length).toBe(1);
            expect(buffer.snapshots[0].position.x).toBe(100);
            expect(buffer.snapshots[0].velocity?.x).toBe(5);
        });

        test('should trim old snapshots', () => {
            const buffer = new InterpolationBuffer(3, 100);
            const now = Date.now();

            for (let i = 0; i < 5; i++) {
                buffer.addSnapshot(new NetworkPosition(i * 10, i * 10), i, now + i * 100);
            }

            expect(buffer.snapshots.length).toBe(3);
            expect(buffer.snapshots[0].position.x).toBe(20);
        });

        test('should return null for empty buffer', () => {
            const buffer = new InterpolationBuffer();
            expect(buffer.getInterpolatedPosition(Date.now())).toBeNull();
        });

        test('should return position for single snapshot', () => {
            const buffer = new InterpolationBuffer();
            buffer.addSnapshot(new NetworkPosition(50, 75), 1, Date.now());

            const result = buffer.getInterpolatedPosition(Date.now());
            expect(result?.x).toBe(50);
            expect(result?.y).toBe(75);
        });

        test('should interpolate between snapshots', () => {
            const buffer = new InterpolationBuffer(10, 50); // 50ms delay
            const now = Date.now();

            buffer.addSnapshot(new NetworkPosition(0, 0), 1, now - 100);
            buffer.addSnapshot(new NetworkPosition(100, 100), 2, now);

            // At render time (now - 50ms delay), we should be halfway
            const result = buffer.getInterpolatedPosition(now);
            expect(result?.x).toBe(50);
            expect(result?.y).toBe(50);
        });

        test('should clear snapshots', () => {
            const buffer = new InterpolationBuffer();
            buffer.addSnapshot(new NetworkPosition(10, 20), 1, Date.now());

            buffer.clear();

            expect(buffer.snapshots).toEqual([]);
        });
    });

    describe('ClientInputState', () => {
        test('should create with default values', () => {
            const state = new ClientInputState();
            expect(state.moveX).toBe(0);
            expect(state.moveY).toBe(0);
            expect(state.actions).toEqual({});
            expect(state.lastSequence).toBe(0);
            expect(state.lastInputTime).toBe(0);
        });

        test('should apply input', () => {
            const state = new ClientInputState();
            state.applyInput(
                {
                    moveX: 1,
                    moveY: -1,
                    actions: { shoot: true },
                    aimX: 100,
                    aimY: 200,
                },
                5
            );

            expect(state.moveX).toBe(1);
            expect(state.moveY).toBe(-1);
            expect(state.actions).toEqual({ shoot: true });
            expect(state.aimX).toBe(100);
            expect(state.aimY).toBe(200);
            expect(state.lastSequence).toBe(5);
            expect(state.lastInputTime).toBeGreaterThan(0);
        });

        test('should handle input without aim', () => {
            const state = new ClientInputState();
            state.applyInput(
                {
                    moveX: 1,
                    moveY: 0,
                    actions: {},
                },
                1
            );

            expect(state.aimX).toBe(0);
            expect(state.aimY).toBe(0);
        });

        test('should clear state', () => {
            const state = new ClientInputState();
            state.applyInput(
                {
                    moveX: 1,
                    moveY: 1,
                    actions: { jump: true },
                },
                3
            );

            state.clear();

            expect(state.moveX).toBe(0);
            expect(state.moveY).toBe(0);
            expect(state.actions).toEqual({});
        });
    });

    describe('serializeNetworkEntity', () => {
        test('should serialize basic entity', () => {
            const networkId = new NetworkId('entity_1', 'player_1', 'player');
            const result = serializeNetworkEntity(networkId);

            expect(result).toEqual({
                networkEntityId: 'entity_1',
                ownerId: 'player_1',
                entityType: 'player',
            });
        });

        test('should include position when provided', () => {
            const networkId = new NetworkId('entity_1', 'player_1', 'player');
            const position = new NetworkPosition(100, 200);
            const result = serializeNetworkEntity(networkId, position);

            expect(result.position).toEqual({ x: 100, y: 200 });
        });

        test('should include velocity when provided', () => {
            const networkId = new NetworkId('entity_1', 'player_1', 'player');
            const position = new NetworkPosition(100, 200);
            const velocity = new NetworkVelocity(5, 10);
            const result = serializeNetworkEntity(networkId, position, velocity);

            expect(result.velocity).toEqual({ x: 5, y: 10 });
        });

        test('should include additional data when provided', () => {
            const networkId = new NetworkId('entity_1', 'player_1', 'player');
            const additionalData = { health: 100, score: 50 };
            const result = serializeNetworkEntity(networkId, undefined, undefined, additionalData);

            expect(result.components).toEqual({ health: 100, score: 50 });
        });
    });
});

// ============================================================================
// Plugin Tests
// ============================================================================

describe('NetworkPlugin', () => {
    describe('Plugin Metadata', () => {
        test('should have correct name and version', () => {
            const transport = new MockClientTransport();
            const plugin = new NetworkPlugin({ role: 'client', transport });

            expect(plugin.name).toBe('NetworkPlugin');
            expect(plugin.version).toBe('1.0.0');
        });

        test('should have correct role', () => {
            const clientTransport = new MockClientTransport();
            const clientPlugin = new NetworkPlugin({ role: 'client', transport: clientTransport });

            const serverTransport = new MockServerTransport();
            const serverPlugin = new NetworkPlugin({ role: 'server', transport: serverTransport });

            expect(clientPlugin.role).toBe('client');
            expect(serverPlugin.role).toBe('server');
        });
    });

    describe('Configuration', () => {
        test('should use default config when not provided', () => {
            const transport = new MockClientTransport();
            const plugin = new NetworkPlugin({ role: 'client', transport });

            expect(plugin.config).toEqual(DEFAULT_NETWORK_CONFIG);
        });

        test('should merge custom config with defaults', () => {
            const transport = new MockClientTransport();
            const plugin = new NetworkPlugin({
                role: 'client',
                transport,
                config: { tickRate: 30, debug: true },
            });

            expect(plugin.config.tickRate).toBe(30);
            expect(plugin.config.debug).toBe(true);
            expect(plugin.config.snapshotRate).toBe(DEFAULT_NETWORK_CONFIG.snapshotRate);
        });
    });

    describe('Client Plugin Installation', () => {
        let engine: Engine;
        let plugin: NetworkPlugin;
        let transport: MockClientTransport;

        beforeEach(() => {
            transport = new MockClientTransport();
            plugin = new NetworkPlugin({
                role: 'client',
                transport,
                config: { debug: false },
            });
            engine = new TestEngineBuilder().use(plugin).build();
        });

        afterEach(() => {
            engine.stop();
        });

        test('should install successfully', () => {
            expect(engine).toBeDefined();
        });

        test('should extend engine with network API', () => {
            expect((engine as EngineWithNetwork).network).toBeDefined();
            expect((engine as EngineWithNetwork).network).toBeInstanceOf(NetworkAPI);
        });

        test('should register all components', () => {
            const entity = engine.createEntity('TestEntity');

            expect(() => entity.addComponent(NetworkId, 'id', 'owner', 'type')).not.toThrow();
            expect(() => entity.addComponent(NetworkPosition, 0, 0)).not.toThrow();
            expect(() => entity.addComponent(NetworkVelocity, 0, 0)).not.toThrow();
            expect(() => entity.addComponent(NetworkInput)).not.toThrow();
            expect(() => entity.addComponent(InputBuffer, 60)).not.toThrow();
            expect(() => entity.addComponent(ServerState)).not.toThrow();
            expect(() => entity.addComponent(InterpolationBuffer, 10, 100)).not.toThrow();
            expect(() => entity.addComponent(LocalPlayer, 'client')).not.toThrow();
        });

        test('should create client systems', () => {
            const systems = engine.getSystemProfiles();
            const systemNames = systems.map((s) => s.name);

            expect(systemNames).toContain('ClientPredictionSystem');
            expect(systemNames).toContain('ClientInputSendSystem');
            expect(systemNames).toContain('ClientInterpolationSystem');
        });

        test('should report correct role via API', () => {
            const api = (engine as EngineWithNetwork).network;

            expect(api.isClient).toBe(true);
            expect(api.isServer).toBe(false);
        });
    });

    describe('Server Plugin Installation', () => {
        let engine: Engine;
        let plugin: NetworkPlugin;
        let transport: MockServerTransport;

        beforeEach(() => {
            transport = new MockServerTransport();
            plugin = new NetworkPlugin({
                role: 'server',
                transport,
                config: { debug: false },
            });
            engine = new TestEngineBuilder().use(plugin).build();
        });

        afterEach(() => {
            engine.stop();
        });

        test('should install successfully', () => {
            expect(engine).toBeDefined();
        });

        test('should create server systems', () => {
            const systems = engine.getSystemProfiles();
            const systemNames = systems.map((s) => s.name);

            expect(systemNames).toContain('NetworkInputProcessingSystem');
            expect(systemNames).toContain('NetworkBroadcastSystem');
            expect(systemNames).toContain('NetworkTickSystem');
        });

        test('should report correct role via API', () => {
            const api = (engine as EngineWithNetwork).network;

            expect(api.isServer).toBe(true);
            expect(api.isClient).toBe(false);
        });
    });

    describe('NetworkAPI - Client', () => {
        let engine: Engine;
        let plugin: NetworkPlugin;
        let transport: MockClientTransport;
        let api: NetworkAPI;

        beforeEach(() => {
            transport = new MockClientTransport();
            plugin = new NetworkPlugin({
                role: 'client',
                transport,
                config: { debug: false },
            });
            engine = new TestEngineBuilder().use(plugin).build();
            api = (engine as EngineWithNetwork).network;
        });

        afterEach(() => {
            engine.stop();
        });

        test('should report connection status', () => {
            expect(api.isConnected).toBe(false);
        });

        test('should report latency', () => {
            expect(api.latency).toBe(50); // Mock transport's latency
        });

        test('should report current tick', () => {
            expect(api.currentTick).toBe(0);
        });

        test('should get server time', () => {
            const serverTime = api.serverTime;
            expect(serverTime).toBeGreaterThan(0);
        });

        test('should return null for local player when not connected', () => {
            expect(api.getLocalPlayer()).toBeNull();
        });

        test('should return empty array for connected clients', () => {
            expect(api.getConnectedClients()).toEqual([]);
        });
    });

    describe('NetworkAPI - Server', () => {
        let engine: Engine;
        let plugin: NetworkPlugin;
        let transport: MockServerTransport;
        let api: NetworkAPI;

        beforeEach(() => {
            transport = new MockServerTransport();
            plugin = new NetworkPlugin({
                role: 'server',
                transport,
                config: { debug: false },
            });
            engine = new TestEngineBuilder().use(plugin).build();
            api = (engine as EngineWithNetwork).network;
        });

        afterEach(() => {
            engine.stop();
        });

        test('should report latency as 0 for server', () => {
            expect(api.latency).toBe(0);
        });

        test('should create network entity', () => {
            const entity = api.createNetworkEntity({
                entityType: 'player',
                position: { x: 100, y: 200 },
            });

            expect(entity).not.toBeNull();
            expect(entity?.hasComponent(NetworkId)).toBe(true);
            expect(entity?.hasComponent(NetworkPosition)).toBe(true);
            expect(entity?.hasComponent(NetworkVelocity)).toBe(true);

            const pos = entity?.getComponent(NetworkPosition);
            expect(pos?.x).toBe(100);
            expect(pos?.y).toBe(200);
        });

        test('should broadcast entity spawn when creating network entity', () => {
            transport.clearMessages();

            api.createNetworkEntity({
                entityType: 'enemy',
                position: { x: 50, y: 75 },
            });

            expect(transport.broadcastMessages.length).toBe(1);
            expect(transport.broadcastMessages[0].type).toBe('entity_spawn');
        });

        test('should destroy network entity', () => {
            const entity = api.createNetworkEntity({
                entityType: 'player',
                position: { x: 0, y: 0 },
            });

            const networkId = entity?.getComponent(NetworkId);
            expect(networkId).toBeDefined();

            transport.clearMessages();
            api.destroyNetworkEntity(networkId!.networkEntityId);

            expect(transport.broadcastMessages.length).toBe(1);
            expect(transport.broadcastMessages[0].type).toBe('entity_destroy');
        });

        test('should get network entity by ID', () => {
            const entity = api.createNetworkEntity({
                entityType: 'item',
            });

            const networkId = entity?.getComponent(NetworkId);
            const found = api.getNetworkEntity(networkId!.networkEntityId);

            expect(found).toBe(entity);
        });

        test('should return null for non-existent network entity', () => {
            const found = api.getNetworkEntity('non_existent_id');
            expect(found).toBeNull();
        });
    });

    describe('Server - Client Join Flow', () => {
        let engine: Engine;
        let plugin: NetworkPlugin;
        let transport: MockServerTransport;

        beforeEach(async () => {
            transport = new MockServerTransport();
            plugin = new NetworkPlugin({
                role: 'server',
                transport,
                config: { debug: false },
            });
            engine = new TestEngineBuilder().use(plugin).build();
            await plugin.listen(8080);
        });

        afterEach(() => {
            engine.stop();
        });

        test('should handle client join', () => {
            transport.clearMessages();
            transport.simulateClientConnect('client_1');

            transport.simulateClientMessage('client_1', {
                type: 'join',
                timestamp: Date.now(),
                data: { playerName: 'Player1' },
            });

            // Should have sent join_accepted
            const clientMessages = transport.sentMessages.get('client_1') || [];
            const joinAccepted = clientMessages.find((m) => m.type === 'join_accepted');
            expect(joinAccepted).toBeDefined();

            // Should have broadcasted player_joined
            const playerJoined = transport.broadcastMessages.find(
                (m) => m.type === 'player_joined'
            );
            expect(playerJoined).toBeDefined();

            // Should track connected client
            const clients = plugin.getConnectedClients();
            expect(clients.length).toBe(1);
            expect(clients[0].playerName).toBe('Player1');
        });

        test('should handle client input', () => {
            transport.simulateClientConnect('client_1');
            transport.simulateClientMessage('client_1', {
                type: 'join',
                timestamp: Date.now(),
                data: { playerName: 'Player1' },
            });

            transport.clearMessages();

            transport.simulateClientMessage('client_1', {
                type: 'input',
                timestamp: Date.now(),
                data: {
                    sequence: 1,
                    inputs: { moveX: 1, moveY: 0, actions: {} },
                    timestamp: Date.now(),
                },
            });

            // Should have sent input_ack
            const clientMessages = transport.sentMessages.get('client_1') || [];
            const inputAck = clientMessages.find((m) => m.type === 'input_ack');
            expect(inputAck).toBeDefined();
        });

        test('should handle ping/pong', () => {
            transport.simulateClientConnect('client_1');
            transport.clearMessages();

            const clientTime = Date.now();
            transport.simulateClientMessage('client_1', {
                type: 'ping',
                timestamp: clientTime,
                data: { clientTime },
            });

            const clientMessages = transport.sentMessages.get('client_1') || [];
            const pong = clientMessages.find((m) => m.type === 'pong');
            expect(pong).toBeDefined();
            expect((pong!.data as { clientTime: number }).clientTime).toBe(clientTime);
        });

        test('should handle client disconnect', () => {
            transport.simulateClientConnect('client_1');
            transport.simulateClientMessage('client_1', {
                type: 'join',
                timestamp: Date.now(),
                data: { playerName: 'Player1' },
            });

            expect(plugin.getConnectedClients().length).toBe(1);

            transport.clearMessages();
            transport.simulateClientDisconnect('client_1', 'Connection lost');

            // Should have broadcasted player_left
            const playerLeft = transport.broadcastMessages.find((m) => m.type === 'player_left');
            expect(playerLeft).toBeDefined();

            // Should have removed client
            expect(plugin.getConnectedClients().length).toBe(0);
        });

        test('should kick client', () => {
            transport.simulateClientConnect('client_1');
            transport.simulateClientMessage('client_1', {
                type: 'join',
                timestamp: Date.now(),
                data: { playerName: 'Player1' },
            });

            plugin.kickClient('client_1', 'Kicked by admin');

            // Client should be disconnected
            expect(plugin.getConnectedClients().length).toBe(0);
        });
    });

    describe('Client - Connection Flow', () => {
        let engine: Engine;
        let plugin: NetworkPlugin;
        let transport: MockClientTransport;

        beforeEach(() => {
            transport = new MockClientTransport();
            plugin = new NetworkPlugin({
                role: 'client',
                transport,
                config: { debug: false },
            });
            engine = new TestEngineBuilder().use(plugin).build();
        });

        afterEach(() => {
            engine.stop();
        });

        test('should connect and send join request', async () => {
            await plugin.connect('ws://localhost:8080', 'TestPlayer');

            expect(transport.state).toBe('connected');
            expect(transport.sentMessages.length).toBe(1);
            expect(transport.sentMessages[0].type).toBe('join');
            expect((transport.sentMessages[0].data as { playerName: string }).playerName).toBe(
                'TestPlayer'
            );
        });

        test('should disconnect', async () => {
            await plugin.connect('ws://localhost:8080', 'TestPlayer');
            plugin.disconnect();

            expect(transport.state).toBe('disconnected');
        });

        test('should handle join_accepted', async () => {
            await plugin.connect('ws://localhost:8080', 'TestPlayer');

            transport.simulateMessage({
                type: 'join_accepted',
                timestamp: Date.now(),
                data: {
                    clientId: 'client_123',
                    networkEntityId: 'entity_456',
                    serverConfig: DEFAULT_NETWORK_CONFIG,
                    serverTime: Date.now(),
                },
            });

            // Connection ID should be updated
            expect(transport.connectionId).toBe('client_123');
        });

        test('should handle world_snapshot', async () => {
            await plugin.connect('ws://localhost:8080', 'TestPlayer');

            // First accept the join
            transport.simulateMessage({
                type: 'join_accepted',
                timestamp: Date.now(),
                data: {
                    clientId: 'client_123',
                    networkEntityId: 'entity_456',
                    serverConfig: DEFAULT_NETWORK_CONFIG,
                    serverTime: Date.now(),
                },
            });

            // Then send world snapshot
            transport.simulateMessage({
                type: 'world_snapshot',
                timestamp: Date.now(),
                data: {
                    tick: 100,
                    timestamp: Date.now(),
                    entities: [
                        {
                            networkEntityId: 'entity_456',
                            ownerId: 'client_123',
                            entityType: 'player',
                            position: { x: 100, y: 200 },
                        },
                    ],
                },
            });

            // Tick should be updated
            expect(plugin.currentTick).toBe(100);
        });
    });

    describe('Input Management', () => {
        let engine: Engine;
        let plugin: NetworkPlugin;
        let transport: MockClientTransport;

        beforeEach(async () => {
            transport = new MockClientTransport();
            plugin = new NetworkPlugin({
                role: 'client',
                transport,
                config: { debug: false },
            });
            engine = new TestEngineBuilder().use(plugin).build();
            await plugin.connect('ws://localhost:8080', 'TestPlayer');

            // Simulate join acceptance and local player creation
            transport.simulateMessage({
                type: 'join_accepted',
                timestamp: Date.now(),
                data: {
                    clientId: 'client_123',
                    networkEntityId: 'entity_456',
                    serverConfig: DEFAULT_NETWORK_CONFIG,
                    serverTime: Date.now(),
                },
            });

            // Create local player entity through world snapshot
            transport.simulateMessage({
                type: 'world_snapshot',
                timestamp: Date.now(),
                data: {
                    tick: 1,
                    timestamp: Date.now(),
                    entities: [
                        {
                            networkEntityId: 'entity_456',
                            ownerId: 'client_123',
                            entityType: 'player',
                            position: { x: 100, y: 100 },
                        },
                    ],
                },
            });
        });

        afterEach(() => {
            engine.stop();
        });

        test('should set input on local player', () => {
            const localPlayer = plugin.getLocalPlayer();
            expect(localPlayer).not.toBeNull();

            plugin.setInput({ moveX: 1, moveY: -1 });

            const input = localPlayer?.getComponent(NetworkInput);
            expect(input?.moveX).toBe(1);
            expect(input?.moveY).toBe(-1);
        });

        test('should set action inputs', () => {
            const localPlayer = plugin.getLocalPlayer();

            plugin.setInput({ actions: { shoot: true, jump: false } });

            const input = localPlayer?.getComponent(NetworkInput);
            expect(input?.isActionPressed('shoot')).toBe(true);
            expect(input?.isActionPressed('jump')).toBe(false);
        });
    });

    describe('Plugin Uninstallation', () => {
        test('should uninstall cleanly for client', () => {
            const transport = new MockClientTransport();
            const plugin = new NetworkPlugin({
                role: 'client',
                transport,
                config: { debug: false },
            });
            const engine = new TestEngineBuilder().use(plugin).build();

            expect(() => {
                plugin.uninstall();
            }).not.toThrow();

            engine.stop();
        });

        test('should uninstall cleanly for server', () => {
            const transport = new MockServerTransport();
            const plugin = new NetworkPlugin({
                role: 'server',
                transport,
                config: { debug: false },
            });
            const engine = new TestEngineBuilder().use(plugin).build();

            expect(() => {
                plugin.uninstall();
            }).not.toThrow();

            engine.stop();
        });
    });

    describe('Error Handling', () => {
        test('should not allow client to listen', async () => {
            const transport = new MockClientTransport();
            const plugin = new NetworkPlugin({
                role: 'client',
                transport,
            });
            new TestEngineBuilder().use(plugin).build();

            await expect(plugin.listen(8080)).rejects.toThrow('Only server can listen');
        });

        test('should not allow server to connect', async () => {
            const transport = new MockServerTransport();
            const plugin = new NetworkPlugin({
                role: 'server',
                transport,
            });
            new TestEngineBuilder().use(plugin).build();

            await expect(plugin.connect('ws://localhost:8080', 'Player')).rejects.toThrow(
                'Only client can connect'
            );
        });

        test('should not allow server to disconnect', () => {
            const transport = new MockServerTransport();
            const plugin = new NetworkPlugin({
                role: 'server',
                transport,
            });
            new TestEngineBuilder().use(plugin).build();

            expect(() => plugin.disconnect()).toThrow('Only client can disconnect');
        });

        test('should not allow client to close', async () => {
            const transport = new MockClientTransport();
            const plugin = new NetworkPlugin({
                role: 'client',
                transport,
            });
            new TestEngineBuilder().use(plugin).build();

            await expect(plugin.close()).rejects.toThrow('Only server can close');
        });
    });

    describe('Event Callbacks', () => {
        test('should call onPlayerJoin callback for server', () => {
            const onPlayerJoin = jest.fn();
            const transport = new MockServerTransport();
            const plugin = new NetworkPlugin({
                role: 'server',
                transport,
                callbacks: { onPlayerJoin },
            });
            new TestEngineBuilder().use(plugin).build();

            transport.simulateClientConnect('client_1');
            transport.simulateClientMessage('client_1', {
                type: 'join',
                timestamp: Date.now(),
                data: { playerName: 'Player1' },
            });

            expect(onPlayerJoin).toHaveBeenCalledWith('client_1', 'Player1');
        });

        test('should call onPlayerLeave callback for server', () => {
            const onPlayerLeave = jest.fn();
            const transport = new MockServerTransport();
            const plugin = new NetworkPlugin({
                role: 'server',
                transport,
                callbacks: { onPlayerLeave },
            });
            new TestEngineBuilder().use(plugin).build();

            transport.simulateClientConnect('client_1');
            transport.simulateClientMessage('client_1', {
                type: 'join',
                timestamp: Date.now(),
                data: { playerName: 'Player1' },
            });

            transport.simulateClientDisconnect('client_1');

            expect(onPlayerLeave).toHaveBeenCalledWith('client_1');
        });

        test('should call onConnected callback for client', async () => {
            const onConnected = jest.fn();
            const transport = new MockClientTransport();
            const plugin = new NetworkPlugin({
                role: 'client',
                transport,
                callbacks: { onConnected },
            });
            new TestEngineBuilder().use(plugin).build();

            await plugin.connect('ws://localhost:8080', 'Player');

            expect(onConnected).toHaveBeenCalled();
        });

        test('should call onDisconnected callback for client', async () => {
            const onDisconnected = jest.fn();
            const transport = new MockClientTransport();
            const plugin = new NetworkPlugin({
                role: 'client',
                transport,
                callbacks: { onDisconnected },
            });
            new TestEngineBuilder().use(plugin).build();

            await plugin.connect('ws://localhost:8080', 'Player');
            plugin.disconnect();

            expect(onDisconnected).toHaveBeenCalled();
        });

        test('should call onError callback', async () => {
            const onError = jest.fn();
            const transport = new MockClientTransport();
            const plugin = new NetworkPlugin({
                role: 'client',
                transport,
                callbacks: { onError },
            });
            new TestEngineBuilder().use(plugin).build();

            await plugin.connect('ws://localhost:8080', 'Player');

            const error = new Error('Test error');
            transport.simulateError(error);

            expect(onError).toHaveBeenCalledWith(error);
        });
    });
});

// ============================================================================
// Default Config Tests
// ============================================================================

describe('DEFAULT_NETWORK_CONFIG', () => {
    test('should have correct default values', () => {
        expect(DEFAULT_NETWORK_CONFIG.tickRate).toBe(20);
        expect(DEFAULT_NETWORK_CONFIG.snapshotRate).toBe(10);
        expect(DEFAULT_NETWORK_CONFIG.clientTickRate).toBe(60);
        expect(DEFAULT_NETWORK_CONFIG.interpolationDelay).toBe(100);
        expect(DEFAULT_NETWORK_CONFIG.reconciliationWindow).toBe(60);
        expect(DEFAULT_NETWORK_CONFIG.maxLatency).toBe(5000);
        expect(DEFAULT_NETWORK_CONFIG.enablePrediction).toBe(true);
        expect(DEFAULT_NETWORK_CONFIG.enableInterpolation).toBe(true);
        expect(DEFAULT_NETWORK_CONFIG.enableReconciliation).toBe(true);
        expect(DEFAULT_NETWORK_CONFIG.debug).toBe(false);
    });
});
