/**
 * State Machine Components
 *
 * ECS components for state machine functionality.
 *
 * @packageDocumentation
 */

import type { ComponentIdentifier } from '../../../packages/core/src/index';

/** Mutable version of StateHistoryEntry for internal use */
interface MutableHistoryEntry {
    stateType: ComponentIdentifier;
    enteredAt: number;
    exitedAt: number | null;
    duration: number;
}

// ============================================================================
// StateMachine Component
// ============================================================================

/**
 * Component that tracks state machine metadata for an entity.
 *
 * The actual "state" is represented by having a state component on the entity
 * (e.g., IdleState, ChaseState). This component tracks metadata needed for
 * transitions and debugging.
 *
 * @example
 * ```typescript
 * // Entity has both the state component AND the metadata
 * entity.addComponent(IdleState);
 * entity.addComponent(StateMachine, IdleState, 'EnemyAI');
 * ```
 */
export class StateMachine {
    /** Time spent in current state (seconds) */
    public stateTime: number = 0;

    /** Total number of transitions made */
    public transitionCount: number = 0;

    /** Whether transitions are locked (for critical sections) */
    public locked: boolean = false;

    /** State history for debugging (most recent last) */
    public history: MutableHistoryEntry[] = [];

    /** Pending messages that can trigger transitions */
    public pendingMessages: Set<string> = new Set();

    /**
     * Create a new StateMachine component.
     *
     * @param currentStateType - The component type of the current state
     * @param definitionName - Name of the registered state definition
     * @param historyDepth - Maximum history entries to keep (0 to disable)
     */
    constructor(
        public currentStateType: ComponentIdentifier,
        public definitionName: string,
        public historyDepth: number = 10
    ) {}

    /**
     * Record a state change in history.
     */
    recordTransition(
        _fromState: ComponentIdentifier,
        toState: ComponentIdentifier,
        _stateTime: number
    ): void {
        if (this.historyDepth <= 0) return;

        const now = Date.now();

        // Update the exit time of the last entry
        if (this.history.length > 0) {
            const last = this.history[this.history.length - 1];
            last.exitedAt = now;
            last.duration = now - last.enteredAt;
        }

        // Add new entry
        this.history.push({
            stateType: toState,
            enteredAt: now,
            exitedAt: null,
            duration: 0,
        });

        // Trim history if needed
        while (this.history.length > this.historyDepth) {
            this.history.shift();
        }
    }

    /**
     * Clear pending messages.
     */
    clearPendingMessages(): void {
        this.pendingMessages.clear();
    }

    /**
     * Check if a message is pending.
     */
    hasMessage(messageType: string): boolean {
        return this.pendingMessages.has(messageType);
    }

    /**
     * Add a pending message.
     */
    addMessage(messageType: string): void {
        this.pendingMessages.add(messageType);
    }
}
