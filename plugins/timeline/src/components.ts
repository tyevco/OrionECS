/**
 * Timeline Components
 *
 * ECS components for timeline functionality.
 *
 * @packageDocumentation
 */

import type { ActionState, NestedTimelineState } from './types';

// =============================================================================
// Timeline Component
// =============================================================================

/**
 * Playback state of a timeline.
 */
export type TimelineState = 'playing' | 'paused' | 'complete';

/**
 * Component that controls timeline playback for an entity.
 *
 * Adding this component to an entity starts the timeline. The TimelineSystem
 * processes entities with this component and updates their state.
 *
 * @example
 * ```typescript
 * // Start a timeline on an entity
 * entity.addComponent(Timeline, 'fadeOut');
 *
 * // Start with options
 * entity.addComponent(Timeline, 'attackSequence', {
 *   speed: 1.5,
 *   loop: true
 * });
 * ```
 */
export class Timeline {
    /** Current playback state */
    public state: TimelineState = 'playing';

    /** Elapsed time in milliseconds */
    public elapsed: number = 0;

    /** Playback speed multiplier (1 = normal, 2 = double speed, 0.5 = half speed) */
    public speed: number;

    /** Whether the timeline should loop when complete */
    public loop: boolean;

    /** Number of times the timeline has looped */
    public loopCount: number = 0;

    /** State tracking for each action in the timeline */
    public actionStates: ActionState[] = [];

    /** State tracking for nested timelines */
    public nestedTimelines: NestedTimelineState[] = [];

    /** Whether this timeline has been initialized (action states created) */
    public initialized: boolean = false;

    /**
     * Create a new Timeline component.
     *
     * @param timelineId - ID of the registered timeline definition to play
     * @param options - Optional playback configuration
     */
    constructor(
        public readonly timelineId: string,
        options: { speed?: number; loop?: boolean } = {}
    ) {
        this.speed = options.speed ?? 1;
        this.loop = options.loop ?? false;
    }

    /**
     * Pause the timeline.
     */
    pause(): void {
        if (this.state === 'playing') {
            this.state = 'paused';
        }
    }

    /**
     * Resume the timeline from a paused state.
     */
    resume(): void {
        if (this.state === 'paused') {
            this.state = 'playing';
        }
    }

    /**
     * Reset the timeline to the beginning.
     *
     * @param autoPlay - Whether to start playing immediately (default: true)
     */
    reset(autoPlay: boolean = true): void {
        this.elapsed = 0;
        this.loopCount = 0;
        this.state = autoPlay ? 'playing' : 'paused';
        this.initialized = false;
        this.actionStates = [];
        this.nestedTimelines = [];
    }

    /**
     * Set the playback position.
     *
     * @param timeMs - Time in milliseconds to seek to
     */
    seek(timeMs: number): void {
        this.elapsed = Math.max(0, timeMs);
        // Mark as needing re-initialization to recalculate action states
        this.initialized = false;
        this.actionStates = [];
        this.nestedTimelines = [];
    }
}

// =============================================================================
// Tween Component (Standalone)
// =============================================================================

/**
 * Standalone tween component for simple single-property animations.
 *
 * Use this for one-off tweens that don't need the full timeline system.
 * The TimelineSystem will process this component alongside Timeline components.
 *
 * @example
 * ```typescript
 * // Tween position.x from current to 100 over 500ms
 * entity.addComponent(Tween, Position, 'x', {
 *   endValue: 100,
 *   duration: 500,
 *   easing: 'easeOutQuad'
 * });
 * ```
 */
export class Tween<TComponent = unknown, TProperty extends string = string> {
    /** Current playback state */
    public state: TimelineState = 'playing';

    /** Elapsed time in milliseconds */
    public elapsed: number = 0;

    /** Captured start value (set on first update) */
    public capturedStartValue?: number;

    /**
     * Create a new Tween component.
     *
     * @param component - The component class to tween
     * @param property - The property name to tween
     * @param config - Tween configuration
     */
    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: Component constructors have varying signatures
        public readonly component: new (...args: any[]) => TComponent,
        public readonly property: TProperty,
        public readonly config: {
            /** Starting value (uses current if not specified) */
            startValue?: number;
            /** Ending value (absolute) */
            endValue?: number;
            /** Relative delta to add */
            delta?: number;
            /** Duration in milliseconds */
            duration: number;
            /** Easing function name */
            easing?: string;
            /** Whether to loop */
            loop?: boolean;
            /** Playback speed multiplier */
            speed?: number;
        }
    ) {}

    /**
     * Get the effective duration accounting for speed.
     */
    get effectiveDuration(): number {
        const speed = this.config.speed ?? 1;
        return speed > 0 ? this.config.duration / speed : this.config.duration;
    }

    /**
     * Check if the tween is complete.
     */
    get complete(): boolean {
        return this.state === 'complete';
    }

    /**
     * Get the current progress (0-1).
     */
    get progress(): number {
        const duration = this.config.duration;
        if (duration <= 0) return 1;
        return Math.min(1, this.elapsed / duration);
    }

    /**
     * Reset the tween to the beginning.
     */
    reset(autoPlay: boolean = true): void {
        this.elapsed = 0;
        this.capturedStartValue = undefined;
        this.state = autoPlay ? 'playing' : 'paused';
    }
}
