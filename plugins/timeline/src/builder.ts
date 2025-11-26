/**
 * Timeline Builder
 *
 * Type-safe fluent builder for creating timeline definitions.
 *
 * @packageDocumentation
 */

import type { ComponentIdentifier } from '../../../packages/plugin-api/src/index';
import type {
    AddComponentAction,
    BuiltInEasing,
    ConstructorArgs,
    EmitAction,
    RemoveComponentAction,
    SetAction,
    TimelineAction,
    TimelineDefinition,
    TimelineRefAction,
    TweenAction,
} from './types';

// =============================================================================
// Tween Property Builder
// =============================================================================

/**
 * Builder for configuring a tween action on a specific property.
 *
 * @typeParam TComponent - The component type being tweened
 * @typeParam TProperty - The property name being tweened
 * @typeParam TEasing - The easing registry type
 */
export class TweenPropertyBuilder<
    TComponent,
    TProperty extends string,
    TEasing extends Record<string, Record<string, unknown>>,
> {
    private startValue?: number;
    private endValue?: number;
    private delta?: number;
    private useCurrentValue: boolean = false;
    private easingName: string = 'linear';
    private durationMs: number = 0;

    constructor(
        private readonly timelineBuilder: TimelineBuilder<TEasing>,
        private readonly componentType: ComponentIdentifier<TComponent>,
        private readonly property: TProperty,
        private readonly startTime: number
    ) {}

    /**
     * Set the starting value (absolute).
     * If not called, uses fromCurrent() behavior.
     */
    from(value: number): this {
        this.startValue = value;
        this.useCurrentValue = false;
        return this;
    }

    /**
     * Start from the current component value.
     */
    fromCurrent(): this {
        this.useCurrentValue = true;
        this.startValue = undefined;
        return this;
    }

    /**
     * Set the ending value (absolute).
     */
    to(value: number): this {
        this.endValue = value;
        this.delta = undefined;
        return this;
    }

    /**
     * Set a relative change (delta) from the start value.
     */
    by(delta: number): this {
        this.delta = delta;
        this.endValue = undefined;
        return this;
    }

    /**
     * Set the easing function.
     */
    ease<K extends keyof TEasing & string>(name: K): this {
        this.easingName = name;
        return this;
    }

    /**
     * Set the duration in milliseconds.
     */
    duration(ms: number): this {
        this.durationMs = ms;
        return this;
    }

    /**
     * Finish building this tween and return to the timeline builder.
     */
    end(): TimelineBuilder<TEasing> {
        const action: TweenAction<TComponent> = {
            type: 'tween',
            from: this.startTime,
            to: this.startTime + this.durationMs,
            target: [this.componentType, this.property] as const,
            startValue: this.startValue,
            endValue: this.endValue,
            delta: this.delta,
            fromCurrent: this.useCurrentValue || this.startValue === undefined,
            easing: this.easingName,
        };

        this.timelineBuilder['addAction'](action);
        return this.timelineBuilder;
    }
}

// =============================================================================
// Timeline Builder
// =============================================================================

/**
 * Type-safe fluent builder for creating timeline definitions.
 *
 * @example
 * ```typescript
 * const timeline = new TimelineBuilder('fadeOut')
 *   .name('Fade Out Effect')
 *   .tween(Opacity, 'value', 0)
 *     .from(1)
 *     .to(0)
 *     .ease('easeOutQuad')
 *     .duration(500)
 *     .end()
 *   .emit('fadeComplete', 500)
 *   .build();
 * ```
 */
export class TimelineBuilder<
    TEasing extends Record<string, Record<string, unknown>> = BuiltInEasing,
> {
    private timelineName?: string;
    private timelineDescription?: string;
    private actions: TimelineAction[] = [];
    private calculatedDuration: number = 0;

    constructor(private readonly id: string) {}

    /**
     * Set a human-readable name for the timeline.
     */
    name(name: string): this {
        this.timelineName = name;
        return this;
    }

    /**
     * Set a description for the timeline.
     */
    description(desc: string): this {
        this.timelineDescription = desc;
        return this;
    }

    // ===========================================================================
    // Tween Actions
    // ===========================================================================

    /**
     * Start building a tween action for a numeric property.
     *
     * @param component - The component class containing the property
     * @param property - The property name to tween (must be numeric at runtime)
     * @param startTime - Start time in milliseconds
     *
     * @example
     * ```typescript
     * builder
     *   .tween(Position, 'x', 0)
     *     .from(0)
     *     .to(100)
     *     .ease('easeOutQuad')
     *     .duration(500)
     *     .end()
     * ```
     */
    tween<TComponent, TProperty extends string>(
        component: ComponentIdentifier<TComponent>,
        property: TProperty,
        startTime: number
    ): TweenPropertyBuilder<TComponent, TProperty, TEasing> {
        return new TweenPropertyBuilder<TComponent, TProperty, TEasing>(
            this,
            component,
            property,
            startTime
        );
    }

    /**
     * Add a tween action directly (for advanced use cases).
     */
    tweenRaw<TComponent>(
        component: ComponentIdentifier<TComponent>,
        property: string,
        config: {
            from: number;
            to: number;
            startValue?: number;
            endValue?: number;
            delta?: number;
            fromCurrent?: boolean;
            easing?: keyof TEasing & string;
        }
    ): this {
        const action: TweenAction<TComponent> = {
            type: 'tween',
            from: config.from,
            to: config.to,
            target: [component, property] as const,
            startValue: config.startValue,
            endValue: config.endValue,
            delta: config.delta,
            fromCurrent: config.fromCurrent,
            easing: config.easing,
        };
        this.addAction(action);
        return this;
    }

    // ===========================================================================
    // Set Actions
    // ===========================================================================

    /**
     * Set a property to a specific value at a point in time.
     *
     * @param component - The component class containing the property
     * @param property - The property name to set
     * @param at - Time in milliseconds
     * @param value - Value to set
     */
    set<TComponent>(
        component: ComponentIdentifier<TComponent>,
        property: string,
        at: number,
        value: number
    ): this {
        const action: SetAction<TComponent> = {
            type: 'set',
            at,
            target: [component, property] as const,
            value,
        };
        this.addAction(action);
        return this;
    }

    /**
     * Add a relative delta to a property at a point in time.
     *
     * @param component - The component class containing the property
     * @param property - The property name to modify
     * @param at - Time in milliseconds
     * @param delta - Delta to add to current value
     */
    addDelta<TComponent>(
        component: ComponentIdentifier<TComponent>,
        property: string,
        at: number,
        delta: number
    ): this {
        const action: SetAction<TComponent> = {
            type: 'set',
            at,
            target: [component, property] as const,
            delta,
        };
        this.addAction(action);
        return this;
    }

    // ===========================================================================
    // Component Actions
    // ===========================================================================

    /**
     * Add a component to the entity at a point in time.
     *
     * @param component - The component class to add
     * @param at - Time in milliseconds
     * @param args - Constructor arguments for the component
     */
    addComponent<TComponent>(
        component: ComponentIdentifier<TComponent>,
        at: number,
        ...args: ConstructorArgs<ComponentIdentifier<TComponent>>
    ): this {
        const action: AddComponentAction<TComponent> = {
            type: 'add',
            at,
            component,
            args: args.length > 0 ? args : undefined,
        };
        this.addAction(action);
        return this;
    }

    /**
     * Remove a component from the entity at a point in time.
     *
     * @param component - The component class to remove
     * @param at - Time in milliseconds
     */
    removeComponent<TComponent>(component: ComponentIdentifier<TComponent>, at: number): this {
        const action: RemoveComponentAction<TComponent> = {
            type: 'remove',
            at,
            component,
        };
        this.addAction(action);
        return this;
    }

    // ===========================================================================
    // Event Actions
    // ===========================================================================

    /**
     * Emit an event at a point in time.
     *
     * @param event - Event name to emit
     * @param at - Time in milliseconds
     * @param data - Optional event data
     */
    emit(event: string, at: number, data?: unknown): this {
        const action: EmitAction = {
            type: 'emit',
            at,
            event,
            data,
        };
        this.addAction(action);
        return this;
    }

    // ===========================================================================
    // Composite Timeline Actions
    // ===========================================================================

    /**
     * Play another timeline at a point in time.
     *
     * @param timelineName - Name of the timeline to play
     * @param at - Start time in milliseconds
     */
    playTimeline(timelineName: string, at: number): this {
        const action: TimelineRefAction = {
            type: 'timeline',
            at,
            name: timelineName,
        };
        this.addAction(action);
        return this;
    }

    // ===========================================================================
    // Build
    // ===========================================================================

    /**
     * Build the timeline definition.
     */
    build(): TimelineDefinition {
        return {
            id: this.id,
            name: this.timelineName,
            description: this.timelineDescription,
            duration: this.calculatedDuration,
            actions: [...this.actions],
        };
    }

    // ===========================================================================
    // Internal
    // ===========================================================================

    /**
     * Add an action and update the calculated duration.
     * @internal
     */
    private addAction(action: TimelineAction): void {
        this.actions.push(action);

        // Update calculated duration
        let actionEnd = 0;
        if (action.type === 'tween') {
            actionEnd = action.to;
        } else if ('at' in action) {
            actionEnd = action.at;
        }

        if (actionEnd > this.calculatedDuration) {
            this.calculatedDuration = actionEnd;
        }
    }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new timeline builder.
 *
 * @param id - Unique identifier for the timeline
 * @returns A new TimelineBuilder instance
 *
 * @example
 * ```typescript
 * const timeline = createTimeline('fadeOut')
 *   .tween(Opacity, 'value', 0)
 *     .from(1)
 *     .to(0)
 *     .duration(500)
 *     .end()
 *   .build();
 * ```
 */
export function createTimeline<
    TEasing extends Record<string, Record<string, unknown>> = BuiltInEasing,
>(id: string): TimelineBuilder<TEasing> {
    return new TimelineBuilder<TEasing>(id);
}
