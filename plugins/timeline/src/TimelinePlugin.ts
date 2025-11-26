/**
 * Timeline Plugin for OrionECS
 *
 * ECS-native timeline system for orchestrating component changes over time.
 *
 * @packageDocumentation
 */

import type { EntityDef } from '../../../packages/core/src/definitions';
import type {
    ComponentIdentifier,
    EnginePlugin,
    PluginContext,
} from '../../../packages/plugin-api/src/index';
import { createTimeline, type TimelineBuilder } from './builder';
import { Timeline, Tween } from './components';
import { EasingRegistry } from './easing';
import type {
    ActionState,
    AddComponentAction,
    BuiltInEasing,
    EasingFn,
    EmitAction,
    NestedTimelineState,
    RemoveComponentAction,
    SetAction,
    TimelineCompleteEvent,
    TimelineDefinition,
    TimelineLoopEvent,
    TimelinePauseEvent,
    TimelinePluginOptions,
    TimelineRefAction,
    TimelineStartEvent,
    TweenAction,
} from './types';

// =============================================================================
// Timeline API
// =============================================================================

/**
 * API exposed on the engine for timeline operations.
 */
export interface TimelineAPI<
    TEasing extends Record<string, Record<string, unknown>> = BuiltInEasing,
> {
    /**
     * Create a new timeline builder.
     */
    create(id: string): TimelineBuilder<TEasing>;

    /**
     * Register a timeline definition.
     */
    define(definition: TimelineDefinition): void;

    /**
     * Get a registered timeline definition.
     */
    get(id: string): TimelineDefinition | undefined;

    /**
     * List all registered timeline IDs.
     */
    list(): string[];

    /**
     * Unregister a timeline definition.
     */
    unregister(id: string): void;

    /**
     * Play a timeline on an entity.
     * Convenience method that adds a Timeline component.
     */
    play(entity: EntityDef, timelineId: string, options?: { speed?: number; loop?: boolean }): void;

    /**
     * Stop a timeline on an entity.
     * Removes the Timeline component.
     */
    stop(entity: EntityDef): void;

    /**
     * Pause a timeline on an entity.
     */
    pause(entity: EntityDef): void;

    /**
     * Resume a paused timeline on an entity.
     */
    resume(entity: EntityDef): void;

    /**
     * Check if an entity has an active timeline.
     */
    isPlaying(entity: EntityDef): boolean;

    /**
     * Get the current timeline state for an entity.
     */
    getState(entity: EntityDef): Timeline | undefined;

    /**
     * Get the easing registry for registering custom easing functions.
     */
    readonly easing: EasingRegistry<TEasing>;
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * ECS-native Timeline Plugin.
 *
 * Provides timeline-based orchestration of component changes. Timelines define
 * sequences of actions (tweens, property sets, component additions/removals)
 * that execute over time.
 *
 * @example
 * ```typescript
 * // Create plugin
 * const timelinePlugin = new TimelinePlugin();
 *
 * // Build engine
 * const engine = new EngineBuilder()
 *   .use(timelinePlugin)
 *   .build();
 *
 * // Define a timeline
 * engine.timeline.define(
 *   engine.timeline.create('fadeOut')
 *     .tween(Opacity, 'value', 0)
 *       .from(1)
 *       .to(0)
 *       .ease('easeOutQuad')
 *       .duration(500)
 *       .end()
 *     .emit('fadeComplete', 500)
 *     .build()
 * );
 *
 * // Play on an entity
 * engine.timeline.play(entity, 'fadeOut');
 *
 * // Or add component directly
 * entity.addComponent(Timeline, 'fadeOut');
 * ```
 *
 * @typeParam TEasing - Accumulated easing registry type
 */
export class TimelinePlugin<TEasing extends Record<string, Record<string, unknown>> = BuiltInEasing>
    implements EnginePlugin<{ timeline: TimelineAPI<TEasing> }>
{
    readonly name = 'TimelinePlugin';
    readonly version = '0.1.0';

    /** Type brand for compile-time type inference */
    declare readonly __extensions: { timeline: TimelineAPI<TEasing> };

    /** Registered timeline definitions */
    private definitions = new Map<string, TimelineDefinition>();

    /** Easing function registry */
    private easingRegistry = new EasingRegistry<TEasing>();

    /** Plugin context */
    private context?: PluginContext;

    /** Delta time for current frame */
    private deltaTime: number = 0;

    /** Plugin options */
    private options: TimelinePluginOptions;

    constructor(options: TimelinePluginOptions = {}) {
        this.options = options;
    }

    // ===========================================================================
    // Custom Easing Registration (Type Accumulation)
    // ===========================================================================

    /**
     * Register a custom easing function with type accumulation.
     *
     * @example
     * ```typescript
     * const plugin = new TimelinePlugin()
     *   .easing('customBounce', (t) => /* custom logic *\/)
     *   .easing('superElastic', (t) => /* custom logic *\/);
     * ```
     */
    easing<K extends string>(
        name: K,
        fn: EasingFn
    ): TimelinePlugin<TEasing & Record<K, Record<string, never>>> {
        this.easingRegistry.register(name, fn);
        return this as unknown as TimelinePlugin<TEasing & Record<K, Record<string, never>>>;
    }

    // ===========================================================================
    // Plugin Lifecycle
    // ===========================================================================

    install(context: PluginContext): void {
        this.context = context;

        // Register components
        context.registerComponent(Timeline);
        context.registerComponent(Tween);

        // Create the timeline processing system
        this.createTimelineSystem(context);

        // Create the standalone tween processing system
        this.createTweenSystem(context);

        // Extend engine with timeline API
        context.extend('timeline', this.createAPI());
    }

    uninstall(): void {
        this.definitions.clear();
        this.context = undefined;
    }

    // ===========================================================================
    // Systems
    // ===========================================================================

    private createTimelineSystem(context: PluginContext): void {
        context.createSystem(
            'TimelineSystem',
            { all: [Timeline] },
            {
                priority: this.options.systemPriority ?? 50,

                before: () => {
                    // Get delta time from engine
                    const engine = context.getEngine() as { getDeltaTime?: () => number };
                    this.deltaTime = (engine.getDeltaTime?.() ?? 1 / 60) * 1000; // Convert to ms
                },

                act: (entity: EntityDef, timeline: Timeline) => {
                    this.processTimeline(entity, timeline);
                },
            },
            this.options.useFixedUpdate ?? false
        );
    }

    private createTweenSystem(context: PluginContext): void {
        context.createSystem(
            'TweenSystem',
            { all: [Tween] },
            {
                priority: (this.options.systemPriority ?? 50) - 1, // Run after timeline system

                act: (entity: EntityDef, tween: Tween) => {
                    this.processTween(entity, tween);
                },
            },
            this.options.useFixedUpdate ?? false
        );
    }

    // ===========================================================================
    // Timeline Processing
    // ===========================================================================

    private processTimeline(entity: EntityDef, timeline: Timeline): void {
        // Skip if not playing
        if (timeline.state !== 'playing') return;

        // Get definition
        const definition = this.definitions.get(timeline.timelineId);
        if (!definition) {
            if (this.options.debug) {
                console.warn(`[TimelinePlugin] Unknown timeline: ${timeline.timelineId}`);
            }
            return;
        }

        // Initialize action states if needed
        if (!timeline.initialized) {
            this.initializeTimeline(timeline, definition);
            timeline.initialized = true;

            // Emit start event
            this.emitTimelineEvent('timelineStart', {
                entity,
                timelineId: timeline.timelineId,
            } as TimelineStartEvent);
        }

        // Update elapsed time
        const previousElapsed = timeline.elapsed;
        timeline.elapsed += this.deltaTime * timeline.speed;

        // Process actions
        this.processActions(entity, timeline, definition, previousElapsed);

        // Check for completion
        const duration = definition.duration ?? this.calculateDuration(definition);
        if (timeline.elapsed >= duration) {
            if (timeline.loop) {
                // Loop the timeline
                timeline.elapsed = timeline.elapsed % duration;
                timeline.loopCount++;
                this.resetActionStates(timeline);

                // Emit loop event
                this.emitTimelineEvent('timelineLoop', {
                    entity,
                    timelineId: timeline.timelineId,
                    loopCount: timeline.loopCount,
                } as TimelineLoopEvent);
            } else {
                // Mark complete
                timeline.state = 'complete';

                // Emit complete event
                this.emitTimelineEvent('timelineComplete', {
                    entity,
                    timelineId: timeline.timelineId,
                    elapsedTime: timeline.elapsed,
                } as TimelineCompleteEvent);
            }
        }
    }

    private initializeTimeline(timeline: Timeline, definition: TimelineDefinition): void {
        timeline.actionStates = definition.actions.map((_, index) => ({
            actionIndex: index,
            started: false,
            completed: false,
        }));
        timeline.nestedTimelines = [];
    }

    private resetActionStates(timeline: Timeline): void {
        for (const state of timeline.actionStates) {
            state.started = false;
            state.completed = false;
            state.capturedStartValue = undefined;
        }
        timeline.nestedTimelines = [];
    }

    private processActions(
        entity: EntityDef,
        timeline: Timeline,
        definition: TimelineDefinition,
        previousElapsed: number
    ): void {
        for (let i = 0; i < definition.actions.length; i++) {
            const action = definition.actions[i];
            const state = timeline.actionStates[i];

            if (state.completed) continue;

            switch (action.type) {
                case 'tween':
                    this.processTweenAction(
                        entity,
                        action,
                        state,
                        timeline.elapsed,
                        previousElapsed
                    );
                    break;
                case 'set':
                    this.processSetAction(entity, action, state, timeline.elapsed, previousElapsed);
                    break;
                case 'add':
                    this.processAddAction(entity, action, state, timeline.elapsed, previousElapsed);
                    break;
                case 'remove':
                    this.processRemoveAction(
                        entity,
                        action,
                        state,
                        timeline.elapsed,
                        previousElapsed
                    );
                    break;
                case 'emit':
                    this.processEmitAction(
                        entity,
                        action,
                        state,
                        timeline.elapsed,
                        previousElapsed
                    );
                    break;
                case 'timeline':
                    this.processTimelineRefAction(entity, action, state, timeline);
                    break;
            }
        }

        // Process nested timelines
        for (const nested of timeline.nestedTimelines) {
            if (nested.completed) continue;
            this.processNestedTimeline(entity, nested, timeline.elapsed);
        }
    }

    private processTweenAction(
        entity: EntityDef,
        action: TweenAction,
        state: ActionState,
        elapsed: number,
        _previousElapsed: number
    ): void {
        // Check if tween is in range
        if (elapsed < action.from) return;

        // Capture start value on first frame
        if (!state.started) {
            state.started = true;
            if (action.fromCurrent || action.startValue === undefined) {
                state.capturedStartValue = this.getPropertyValue(entity, action.target);
            } else {
                state.capturedStartValue = action.startValue;
            }
        }

        // Calculate progress
        const duration = action.to - action.from;
        const progress = Math.min(1, (elapsed - action.from) / duration);

        // Apply easing
        const easingFn = this.easingRegistry.getOrDefault(action.easing ?? 'linear');
        const easedProgress = easingFn(progress);

        // Calculate target value
        const startValue = state.capturedStartValue ?? 0;
        let targetValue: number;

        if (action.delta !== undefined) {
            targetValue = startValue + action.delta * easedProgress;
        } else {
            const endValue = action.endValue ?? startValue;
            targetValue = startValue + (endValue - startValue) * easedProgress;
        }

        // Apply value
        this.setPropertyValue(entity, action.target, targetValue);

        // Mark complete if finished
        if (elapsed >= action.to) {
            state.completed = true;
        }
    }

    private processSetAction(
        entity: EntityDef,
        action: SetAction,
        state: ActionState,
        elapsed: number,
        previousElapsed: number
    ): void {
        // Check if we crossed the trigger point
        if (previousElapsed < action.at && elapsed >= action.at) {
            if (action.delta !== undefined) {
                const currentValue = this.getPropertyValue(entity, action.target);
                this.setPropertyValue(entity, action.target, currentValue + action.delta);
            } else if (action.value !== undefined) {
                this.setPropertyValue(entity, action.target, action.value);
            }
            state.started = true;
            state.completed = true;
        }
    }

    private processAddAction(
        entity: EntityDef,
        action: AddComponentAction,
        state: ActionState,
        elapsed: number,
        previousElapsed: number
    ): void {
        if (previousElapsed < action.at && elapsed >= action.at) {
            if (!entity.hasComponent(action.component)) {
                const args = action.args ?? [];
                entity.addComponent(action.component, ...(args as []));
            }
            state.started = true;
            state.completed = true;
        }
    }

    private processRemoveAction(
        entity: EntityDef,
        action: RemoveComponentAction,
        state: ActionState,
        elapsed: number,
        previousElapsed: number
    ): void {
        if (previousElapsed < action.at && elapsed >= action.at) {
            if (entity.hasComponent(action.component)) {
                entity.removeComponent(action.component);
            }
            state.started = true;
            state.completed = true;
        }
    }

    private processEmitAction(
        entity: EntityDef,
        action: EmitAction,
        state: ActionState,
        elapsed: number,
        previousElapsed: number
    ): void {
        if (previousElapsed < action.at && elapsed >= action.at) {
            this.context?.emit(action.event, { entity, data: action.data });
            state.started = true;
            state.completed = true;
        }
    }

    private processTimelineRefAction(
        entity: EntityDef,
        action: TimelineRefAction,
        state: ActionState,
        parentTimeline: Timeline
    ): void {
        if (parentTimeline.elapsed < action.at) return;

        if (!state.started) {
            // Start the nested timeline
            const nestedDef = this.definitions.get(action.name);
            if (!nestedDef) {
                if (this.options.debug) {
                    console.warn(`[TimelinePlugin] Unknown nested timeline: ${action.name}`);
                }
                state.started = true;
                state.completed = true;
                return;
            }

            const nestedState: NestedTimelineState = {
                timelineName: action.name,
                startOffset: action.at,
                elapsed: 0,
                completed: false,
                actionStates: nestedDef.actions.map((_, index) => ({
                    actionIndex: index,
                    started: false,
                    completed: false,
                })),
            };

            parentTimeline.nestedTimelines.push(nestedState);
            state.started = true;
        }
    }

    private processNestedTimeline(
        entity: EntityDef,
        nested: NestedTimelineState,
        parentElapsed: number
    ): void {
        const definition = this.definitions.get(nested.timelineName);
        if (!definition) return;

        const previousNested = nested.elapsed;
        nested.elapsed = parentElapsed - nested.startOffset;

        // Process actions in nested timeline
        for (let i = 0; i < definition.actions.length; i++) {
            const action = definition.actions[i];
            const state = nested.actionStates[i];

            if (state.completed) continue;

            switch (action.type) {
                case 'tween':
                    this.processTweenAction(entity, action, state, nested.elapsed, previousNested);
                    break;
                case 'set':
                    this.processSetAction(entity, action, state, nested.elapsed, previousNested);
                    break;
                case 'add':
                    this.processAddAction(entity, action, state, nested.elapsed, previousNested);
                    break;
                case 'remove':
                    this.processRemoveAction(entity, action, state, nested.elapsed, previousNested);
                    break;
                case 'emit':
                    this.processEmitAction(entity, action, state, nested.elapsed, previousNested);
                    break;
                // Note: Nested timelines don't support further nesting for simplicity
            }
        }

        // Check if nested timeline is complete
        const duration = definition.duration ?? this.calculateDuration(definition);
        if (nested.elapsed >= duration) {
            nested.completed = true;
        }
    }

    // ===========================================================================
    // Standalone Tween Processing
    // ===========================================================================

    private processTween(entity: EntityDef, tween: Tween): void {
        if (tween.state !== 'playing') return;

        const speed = tween.config.speed ?? 1;
        tween.elapsed += this.deltaTime * speed;

        // Capture start value on first frame
        if (tween.capturedStartValue === undefined) {
            if (tween.config.startValue !== undefined) {
                tween.capturedStartValue = tween.config.startValue;
            } else {
                tween.capturedStartValue = this.getComponentPropertyValue(
                    entity,
                    tween.component,
                    tween.property
                );
            }
        }

        // Calculate progress
        const progress = Math.min(1, tween.elapsed / tween.config.duration);

        // Apply easing
        const easingFn = this.easingRegistry.getOrDefault(tween.config.easing ?? 'linear');
        const easedProgress = easingFn(progress);

        // Calculate target value
        const startValue = tween.capturedStartValue;
        let targetValue: number;

        if (tween.config.delta !== undefined) {
            targetValue = startValue + tween.config.delta * easedProgress;
        } else {
            const endValue = tween.config.endValue ?? startValue;
            targetValue = startValue + (endValue - startValue) * easedProgress;
        }

        // Apply value
        this.setComponentPropertyValue(entity, tween.component, tween.property, targetValue);

        // Check completion
        if (tween.elapsed >= tween.config.duration) {
            if (tween.config.loop) {
                tween.elapsed = tween.elapsed % tween.config.duration;
                tween.capturedStartValue = undefined; // Re-capture on next loop
            } else {
                tween.state = 'complete';
            }
        }
    }

    // ===========================================================================
    // Property Access Helpers
    // ===========================================================================

    private getPropertyValue(
        entity: EntityDef,
        target: readonly [ComponentIdentifier, string]
    ): number {
        const [componentType, property] = target;
        return this.getComponentPropertyValue(entity, componentType, property);
    }

    private setPropertyValue(
        entity: EntityDef,
        target: readonly [ComponentIdentifier, string],
        value: number
    ): void {
        const [componentType, property] = target;
        this.setComponentPropertyValue(entity, componentType, property, value);
    }

    private getComponentPropertyValue(
        entity: EntityDef,
        componentType: ComponentIdentifier,
        property: string
    ): number {
        if (!entity.hasComponent(componentType)) {
            if (this.options.debug) {
                console.warn(`[TimelinePlugin] Entity missing component for tween`);
            }
            return 0;
        }

        const component = entity.getComponent(componentType) as Record<string, unknown>;
        const value = component[property];

        if (typeof value !== 'number') {
            if (this.options.debug) {
                console.warn(`[TimelinePlugin] Property ${property} is not a number`);
            }
            return 0;
        }

        return value;
    }

    private setComponentPropertyValue(
        entity: EntityDef,
        componentType: ComponentIdentifier,
        property: string,
        value: number
    ): void {
        if (!entity.hasComponent(componentType)) {
            if (this.options.debug) {
                console.warn(`[TimelinePlugin] Entity missing component for tween`);
            }
            return;
        }

        const component = entity.getComponent(componentType) as Record<string, unknown>;
        component[property] = value;
    }

    // ===========================================================================
    // Utility Methods
    // ===========================================================================

    private calculateDuration(definition: TimelineDefinition): number {
        let maxTime = 0;

        for (const action of definition.actions) {
            let actionEnd = 0;

            if (action.type === 'tween') {
                actionEnd = action.to;
            } else if ('at' in action) {
                actionEnd = action.at;

                // For timeline refs, add the nested timeline duration
                if (action.type === 'timeline') {
                    const nested = this.definitions.get(action.name);
                    if (nested) {
                        actionEnd += nested.duration ?? this.calculateDuration(nested);
                    }
                }
            }

            if (actionEnd > maxTime) {
                maxTime = actionEnd;
            }
        }

        return maxTime;
    }

    private emitTimelineEvent(eventName: string, event: unknown): void {
        this.context?.emit(eventName, event);
    }

    // ===========================================================================
    // API Creation
    // ===========================================================================

    private createAPI(): TimelineAPI<TEasing> {
        return {
            create: (id: string) => createTimeline<TEasing>(id),

            define: (definition: TimelineDefinition) => {
                this.definitions.set(definition.id, definition);
            },

            get: (id: string) => this.definitions.get(id),

            list: () => Array.from(this.definitions.keys()),

            unregister: (id: string) => {
                this.definitions.delete(id);
            },

            play: (
                entity: EntityDef,
                timelineId: string,
                options?: { speed?: number; loop?: boolean }
            ) => {
                if (!this.definitions.has(timelineId)) {
                    throw new Error(`[TimelinePlugin] Unknown timeline: ${timelineId}`);
                }

                if (entity.hasComponent(Timeline)) {
                    const existing = entity.getComponent(Timeline);
                    existing.reset();
                    // Note: Can't change timelineId as it's readonly, so remove and re-add
                    entity.removeComponent(Timeline);
                }

                entity.addComponent(Timeline, timelineId, options);
            },

            stop: (entity: EntityDef) => {
                if (entity.hasComponent(Timeline)) {
                    entity.removeComponent(Timeline);
                }
            },

            pause: (entity: EntityDef) => {
                if (entity.hasComponent(Timeline)) {
                    const timeline = entity.getComponent(Timeline);
                    timeline.pause();

                    this.emitTimelineEvent('timelinePause', {
                        entity,
                        timelineId: timeline.timelineId,
                        pausedAt: timeline.elapsed,
                    } as TimelinePauseEvent);
                }
            },

            resume: (entity: EntityDef) => {
                if (entity.hasComponent(Timeline)) {
                    const timeline = entity.getComponent(Timeline);
                    timeline.resume();
                }
            },

            isPlaying: (entity: EntityDef) => {
                if (!entity.hasComponent(Timeline)) return false;
                const timeline = entity.getComponent(Timeline);
                return timeline.state === 'playing';
            },

            getState: (entity: EntityDef) => {
                if (!entity.hasComponent(Timeline)) return undefined;
                return entity.getComponent(Timeline);
            },

            easing: this.easingRegistry,
        };
    }
}
