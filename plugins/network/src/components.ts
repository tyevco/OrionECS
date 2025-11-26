/**
 * Network Components for OrionECS
 *
 * These components are added to entities that need network synchronization.
 */

import type { InputState, SequencedInput, SerializedNetworkEntity } from './types';

// ============================================================================
// Core Network Components
// ============================================================================

/**
 * Network identity component - marks an entity for network synchronization
 */
export class NetworkId {
    constructor(
        /** Unique network identifier (consistent across server and clients) */
        public networkEntityId: string = '',
        /** Client ID that owns/controls this entity */
        public ownerId: string = '',
        /** Type of entity for serialization */
        public entityType: string = 'generic',
        /** Whether this entity needs to be synced this frame */
        public dirty: boolean = true,
        /** Server tick when this entity was last updated */
        public lastUpdateTick: number = 0
    ) {}

    markDirty(): void {
        this.dirty = true;
    }

    clearDirty(): void {
        this.dirty = false;
    }

    toJSON(): object {
        return {
            networkEntityId: this.networkEntityId,
            ownerId: this.ownerId,
            entityType: this.entityType,
        };
    }
}

/**
 * Position component with network serialization support
 */
export class NetworkPosition {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}

    set(x: number, y: number): void {
        this.x = x;
        this.y = y;
    }

    clone(): NetworkPosition {
        return new NetworkPosition(this.x, this.y);
    }

    distanceTo(other: NetworkPosition): number {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    lerp(target: NetworkPosition, t: number): NetworkPosition {
        return new NetworkPosition(
            this.x + (target.x - this.x) * t,
            this.y + (target.y - this.y) * t
        );
    }

    toJSON(): object {
        return { x: this.x, y: this.y };
    }
}

/**
 * Velocity component with network serialization support
 */
export class NetworkVelocity {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}

    set(x: number, y: number): void {
        this.x = x;
        this.y = y;
    }

    clone(): NetworkVelocity {
        return new NetworkVelocity(this.x, this.y);
    }

    toJSON(): object {
        return { x: this.x, y: this.y };
    }
}

// ============================================================================
// Client-Side Prediction Components
// ============================================================================

/**
 * Marks an entity as the local player (controlled by this client)
 */
export class LocalPlayer {
    constructor(
        /** Client ID */
        public clientId: string = ''
    ) {}
}

/**
 * Marks an entity as a remote player (controlled by another client)
 */
export class RemotePlayer {
    constructor(
        /** Client ID of the controlling player */
        public clientId: string = ''
    ) {}
}

/**
 * Current input state for the local player
 */
export class NetworkInput {
    public moveX: number = 0;
    public moveY: number = 0;
    public actions: Record<string, boolean> = {};
    public aimX: number = 0;
    public aimY: number = 0;

    setMovement(x: number, y: number): void {
        this.moveX = Math.max(-1, Math.min(1, x));
        this.moveY = Math.max(-1, Math.min(1, y));
    }

    setAction(action: string, pressed: boolean): void {
        this.actions[action] = pressed;
    }

    isActionPressed(action: string): boolean {
        return this.actions[action] ?? false;
    }

    setAim(x: number, y: number): void {
        this.aimX = x;
        this.aimY = y;
    }

    toInputState(): InputState {
        return {
            moveX: this.moveX,
            moveY: this.moveY,
            actions: { ...this.actions },
            aimX: this.aimX,
            aimY: this.aimY,
        };
    }

    clear(): void {
        this.moveX = 0;
        this.moveY = 0;
        this.actions = {};
    }
}

/**
 * Input history buffer for client-side prediction and reconciliation
 */
export class InputBuffer {
    public inputs: SequencedInput[] = [];
    public nextSequence: number = 0;
    public lastAcknowledgedSequence: number = -1;

    constructor(
        /** Maximum number of inputs to keep */
        public maxSize: number = 60
    ) {}

    /**
     * Add a new input and return its sequence number
     */
    addInput(input: InputState): number {
        const sequence = this.nextSequence++;
        this.inputs.push({
            sequence,
            input: { ...input, actions: { ...input.actions } },
            timestamp: Date.now(),
            applied: false,
        });

        // Trim old inputs
        while (this.inputs.length > this.maxSize) {
            this.inputs.shift();
        }

        return sequence;
    }

    /**
     * Mark an input as acknowledged by the server
     */
    acknowledgeInput(sequence: number): void {
        this.lastAcknowledgedSequence = sequence;

        // Remove all inputs up to and including the acknowledged one
        this.inputs = this.inputs.filter((i) => i.sequence > sequence);
    }

    /**
     * Get all unacknowledged inputs for replay during reconciliation
     */
    getUnacknowledgedInputs(): SequencedInput[] {
        return this.inputs.filter((i) => i.sequence > this.lastAcknowledgedSequence);
    }

    /**
     * Get the most recent input
     */
    getLatestInput(): SequencedInput | null {
        return this.inputs.length > 0 ? this.inputs[this.inputs.length - 1] : null;
    }

    /**
     * Clear all inputs
     */
    clear(): void {
        this.inputs = [];
        this.nextSequence = 0;
        this.lastAcknowledgedSequence = -1;
    }
}

/**
 * Server state for reconciliation
 */
export class ServerState {
    constructor(
        /** Last acknowledged input sequence */
        public lastAckSequence: number = -1,
        /** Server-authoritative position */
        public serverPosition: NetworkPosition = new NetworkPosition(),
        /** Server-authoritative velocity */
        public serverVelocity: NetworkVelocity = new NetworkVelocity(),
        /** Server tick of last update */
        public serverTick: number = 0,
        /** Timestamp of last server update */
        public lastUpdateTime: number = 0
    ) {}

    update(
        sequence: number,
        position: { x: number; y: number },
        velocity: { x: number; y: number } | undefined,
        tick: number
    ): void {
        this.lastAckSequence = sequence;
        this.serverPosition.set(position.x, position.y);
        if (velocity) {
            this.serverVelocity.set(velocity.x, velocity.y);
        }
        this.serverTick = tick;
        this.lastUpdateTime = Date.now();
    }
}

// ============================================================================
// Interpolation Components
// ============================================================================

/**
 * Snapshot buffer for entity interpolation
 */
export interface PositionSnapshot {
    position: NetworkPosition;
    velocity?: NetworkVelocity;
    timestamp: number;
    tick: number;
}

/**
 * Interpolation state for smooth remote entity movement
 */
export class InterpolationBuffer {
    public snapshots: PositionSnapshot[] = [];

    constructor(
        /** Maximum snapshots to keep */
        public maxSnapshots: number = 10,
        /** Interpolation delay in ms */
        public delay: number = 100
    ) {}

    /**
     * Add a new snapshot
     */
    addSnapshot(
        position: NetworkPosition,
        tick: number,
        timestamp: number,
        velocity?: NetworkVelocity
    ): void {
        this.snapshots.push({
            position: position.clone(),
            velocity: velocity?.clone(),
            timestamp,
            tick,
        });

        // Keep only recent snapshots
        while (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }
    }

    /**
     * Get interpolated position at render time
     */
    getInterpolatedPosition(currentTime: number): NetworkPosition | null {
        const renderTime = currentTime - this.delay;

        if (this.snapshots.length === 0) {
            return null;
        }

        if (this.snapshots.length === 1) {
            return this.snapshots[0].position.clone();
        }

        // Find the two snapshots to interpolate between
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

        // If render time is past all snapshots, extrapolate from the last one
        if (renderTime > this.snapshots[this.snapshots.length - 1].timestamp) {
            const last = this.snapshots[this.snapshots.length - 1];
            if (last.velocity) {
                const elapsed = (renderTime - last.timestamp) / 1000;
                return new NetworkPosition(
                    last.position.x + last.velocity.x * elapsed,
                    last.position.y + last.velocity.y * elapsed
                );
            }
            return last.position.clone();
        }

        // Interpolate
        const duration = to.timestamp - from.timestamp;
        if (duration <= 0) {
            return from.position.clone();
        }

        const t = Math.max(0, Math.min(1, (renderTime - from.timestamp) / duration));
        return from.position.lerp(to.position, t);
    }

    /**
     * Clear all snapshots
     */
    clear(): void {
        this.snapshots = [];
    }
}

// ============================================================================
// Server-Side Components
// ============================================================================

/**
 * Server-side input state from a client
 */
export class ClientInputState {
    public moveX: number = 0;
    public moveY: number = 0;
    public actions: Record<string, boolean> = {};
    public aimX: number = 0;
    public aimY: number = 0;
    public lastSequence: number = 0;
    public lastInputTime: number = 0;

    applyInput(input: InputState, sequence: number): void {
        this.moveX = input.moveX;
        this.moveY = input.moveY;
        this.actions = { ...input.actions };
        this.aimX = input.aimX ?? 0;
        this.aimY = input.aimY ?? 0;
        this.lastSequence = sequence;
        this.lastInputTime = Date.now();
    }

    clear(): void {
        this.moveX = 0;
        this.moveY = 0;
        this.actions = {};
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Serialize an entity's network-relevant components
 */
export function serializeNetworkEntity(
    networkId: NetworkId,
    position?: NetworkPosition,
    velocity?: NetworkVelocity,
    additionalData?: Record<string, unknown>
): SerializedNetworkEntity {
    const serialized: SerializedNetworkEntity = {
        networkEntityId: networkId.networkEntityId,
        ownerId: networkId.ownerId,
        entityType: networkId.entityType,
    };

    if (position) {
        serialized.position = { x: position.x, y: position.y };
    }

    if (velocity) {
        serialized.velocity = { x: velocity.x, y: velocity.y };
    }

    if (additionalData) {
        serialized.components = additionalData;
    }

    return serialized;
}
