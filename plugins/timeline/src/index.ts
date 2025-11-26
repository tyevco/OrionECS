/**
 * Timeline Plugin for OrionECS
 *
 * ECS-native timeline system for orchestrating component changes over time.
 *
 * @example
 * ```typescript
 * import { TimelinePlugin, Timeline, Tween, createTimeline } from '@orion-ecs/timeline';
 *
 * // Create plugin with optional custom easing
 * const timelinePlugin = new TimelinePlugin()
 *   .easing('customBounce', (t) => /* custom easing *\/);
 *
 * // Build engine
 * const engine = new EngineBuilder()
 *   .use(timelinePlugin)
 *   .build();
 *
 * // Define a timeline using the builder
 * engine.timeline.define(
 *   engine.timeline.create('fadeOut')
 *     .name('Fade Out Effect')
 *     .tween(Opacity, 'value', 0)
 *       .from(1)
 *       .to(0)
 *       .ease('easeOutQuad')
 *       .duration(500)
 *       .end()
 *     .removeComponent(Visible, 500)
 *     .emit('fadeComplete', 500)
 *     .build()
 * );
 *
 * // Play timeline on an entity
 * engine.timeline.play(entity, 'fadeOut');
 *
 * // Or add component directly
 * entity.addComponent(Timeline, 'fadeOut');
 *
 * // Listen for completion
 * engine.on('timelineComplete', ({ entity, timelineId }) => {
 *   console.log(`Timeline ${timelineId} completed on entity ${entity.name}`);
 * });
 *
 * // Standalone tweens (without full timeline)
 * entity.addComponent(Tween, Position, 'x', {
 *   endValue: 100,
 *   duration: 500,
 *   easing: 'easeOutQuad'
 * });
 * ```
 *
 * @packageDocumentation
 */

// Builder
export { createTimeline, TimelineBuilder, TweenPropertyBuilder } from './builder';
export type { TimelineState } from './components';
// Components
export { Timeline, Tween } from './components';

// Easing
export {
    builtInEasingFunctions,
    EasingRegistry,
    easeInBack,
    easeInBounce,
    easeInCirc,
    easeInCubic,
    easeInElastic,
    easeInExpo,
    easeInOutBack,
    easeInOutBounce,
    easeInOutCirc,
    easeInOutCubic,
    easeInOutElastic,
    easeInOutExpo,
    easeInOutQuad,
    easeInOutQuart,
    easeInOutQuint,
    easeInOutSine,
    easeInQuad,
    easeInQuart,
    easeInQuint,
    easeInSine,
    easeOutBack,
    easeOutBounce,
    easeOutCirc,
    easeOutCubic,
    easeOutElastic,
    easeOutExpo,
    easeOutQuad,
    easeOutQuart,
    easeOutQuint,
    easeOutSine,
    // Individual easing functions
    linear,
} from './easing';
export type { TimelineAPI } from './TimelinePlugin';
// Core plugin
export { TimelinePlugin } from './TimelinePlugin';

// Types
export type {
    // Runtime state
    ActionState,
    AddComponentAction,
    BuiltInEasing,
    BuiltInEasingName,
    // Comparison
    ComparisonOp,
    // Utilities
    ConstructorArgs,
    // Easing
    EasingFn,
    EasingRegistry as EasingRegistryType,
    EmitAction,
    NestedTimelineState,
    NumericProperties,
    NumericPropertyTarget,
    // Property targeting
    PropertyTarget,
    RemoveComponentAction,
    RequiresArgs,
    SetAction,
    // Actions
    TimelineAction,
    TimelineCompleteEvent,
    // Definition
    TimelineDefinition,
    TimelineLoopEvent,
    TimelinePauseEvent,
    // Options
    TimelinePluginOptions,
    TimelineRefAction,
    // Events
    TimelineStartEvent,
    TweenAction,
} from './types';

// Utility function
export { compare } from './types';
