/**
 * Easing Functions
 *
 * Standard easing functions for smooth interpolation.
 * Based on Robert Penner's easing equations.
 *
 * @packageDocumentation
 */

import type { BuiltInEasing, BuiltInEasingName, EasingFn } from './types';

// =============================================================================
// Linear
// =============================================================================

export const linear: EasingFn = (t) => t;

// =============================================================================
// Quadratic
// =============================================================================

export const easeInQuad: EasingFn = (t) => t * t;

export const easeOutQuad: EasingFn = (t) => t * (2 - t);

export const easeInOutQuad: EasingFn = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

// =============================================================================
// Cubic
// =============================================================================

export const easeInCubic: EasingFn = (t) => t * t * t;

export const easeOutCubic: EasingFn = (t) => {
    const t1 = t - 1;
    return t1 * t1 * t1 + 1;
};

export const easeInOutCubic: EasingFn = (t) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

// =============================================================================
// Quartic
// =============================================================================

export const easeInQuart: EasingFn = (t) => t * t * t * t;

export const easeOutQuart: EasingFn = (t) => {
    const t1 = t - 1;
    return 1 - t1 * t1 * t1 * t1;
};

export const easeInOutQuart: EasingFn = (t) => {
    const t1 = t - 1;
    return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * t1 * t1 * t1 * t1;
};

// =============================================================================
// Quintic
// =============================================================================

export const easeInQuint: EasingFn = (t) => t * t * t * t * t;

export const easeOutQuint: EasingFn = (t) => {
    const t1 = t - 1;
    return 1 + t1 * t1 * t1 * t1 * t1;
};

export const easeInOutQuint: EasingFn = (t) => {
    const t1 = t - 1;
    return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * t1 * t1 * t1 * t1 * t1;
};

// =============================================================================
// Sinusoidal
// =============================================================================

export const easeInSine: EasingFn = (t) => 1 - Math.cos((t * Math.PI) / 2);

export const easeOutSine: EasingFn = (t) => Math.sin((t * Math.PI) / 2);

export const easeInOutSine: EasingFn = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

// =============================================================================
// Exponential
// =============================================================================

export const easeInExpo: EasingFn = (t) => (t === 0 ? 0 : 2 ** (10 * (t - 1)));

export const easeOutExpo: EasingFn = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));

export const easeInOutExpo: EasingFn = (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) return 2 ** (20 * t - 10) / 2;
    return (2 - 2 ** (-20 * t + 10)) / 2;
};

// =============================================================================
// Circular
// =============================================================================

export const easeInCirc: EasingFn = (t) => 1 - Math.sqrt(1 - t * t);

export const easeOutCirc: EasingFn = (t) => {
    const t1 = t - 1;
    return Math.sqrt(1 - t1 * t1);
};

export const easeInOutCirc: EasingFn = (t) => {
    if (t < 0.5) {
        return (1 - Math.sqrt(1 - 4 * t * t)) / 2;
    }
    return (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2;
};

// =============================================================================
// Back (Overshoot)
// =============================================================================

const BACK_OVERSHOOT = 1.70158;
const BACK_OVERSHOOT_INOUT = BACK_OVERSHOOT * 1.525;

export const easeInBack: EasingFn = (t) => t * t * ((BACK_OVERSHOOT + 1) * t - BACK_OVERSHOOT);

export const easeOutBack: EasingFn = (t) => {
    const t1 = t - 1;
    return t1 * t1 * ((BACK_OVERSHOOT + 1) * t1 + BACK_OVERSHOOT) + 1;
};

export const easeInOutBack: EasingFn = (t) => {
    if (t < 0.5) {
        return ((2 * t) ** 2 * ((BACK_OVERSHOOT_INOUT + 1) * 2 * t - BACK_OVERSHOOT_INOUT)) / 2;
    }
    return (
        ((2 * t - 2) ** 2 * ((BACK_OVERSHOOT_INOUT + 1) * (t * 2 - 2) + BACK_OVERSHOOT_INOUT) + 2) /
        2
    );
};

// =============================================================================
// Elastic
// =============================================================================

const ELASTIC_PERIOD = (2 * Math.PI) / 3;
const ELASTIC_PERIOD_INOUT = (2 * Math.PI) / 4.5;

export const easeInElastic: EasingFn = (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * ELASTIC_PERIOD);
};

export const easeOutElastic: EasingFn = (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ELASTIC_PERIOD) + 1;
};

export const easeInOutElastic: EasingFn = (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) {
        return -(2 ** (20 * t - 10) * Math.sin((20 * t - 11.125) * ELASTIC_PERIOD_INOUT)) / 2;
    }
    return (2 ** (-20 * t + 10) * Math.sin((20 * t - 11.125) * ELASTIC_PERIOD_INOUT)) / 2 + 1;
};

// =============================================================================
// Bounce
// =============================================================================

const BOUNCE_N1 = 7.5625;
const BOUNCE_D1 = 2.75;

export const easeOutBounce: EasingFn = (t) => {
    if (t < 1 / BOUNCE_D1) {
        return BOUNCE_N1 * t * t;
    } else if (t < 2 / BOUNCE_D1) {
        const t1 = t - 1.5 / BOUNCE_D1;
        return BOUNCE_N1 * t1 * t1 + 0.75;
    } else if (t < 2.5 / BOUNCE_D1) {
        const t1 = t - 2.25 / BOUNCE_D1;
        return BOUNCE_N1 * t1 * t1 + 0.9375;
    } else {
        const t1 = t - 2.625 / BOUNCE_D1;
        return BOUNCE_N1 * t1 * t1 + 0.984375;
    }
};

export const easeInBounce: EasingFn = (t) => 1 - easeOutBounce(1 - t);

export const easeInOutBounce: EasingFn = (t) =>
    t < 0.5 ? (1 - easeOutBounce(1 - 2 * t)) / 2 : (1 + easeOutBounce(2 * t - 1)) / 2;

// =============================================================================
// Easing Registry
// =============================================================================

/**
 * Map of all built-in easing functions.
 */
export const builtInEasingFunctions: Record<BuiltInEasingName, EasingFn> = {
    linear,
    easeInQuad,
    easeOutQuad,
    easeInOutQuad,
    easeInCubic,
    easeOutCubic,
    easeInOutCubic,
    easeInQuart,
    easeOutQuart,
    easeInOutQuart,
    easeInQuint,
    easeOutQuint,
    easeInOutQuint,
    easeInSine,
    easeOutSine,
    easeInOutSine,
    easeInExpo,
    easeOutExpo,
    easeInOutExpo,
    easeInCirc,
    easeOutCirc,
    easeInOutCirc,
    easeInBack,
    easeOutBack,
    easeInOutBack,
    easeInElastic,
    easeOutElastic,
    easeInOutElastic,
    easeInBounce,
    easeOutBounce,
    easeInOutBounce,
};

/**
 * Registry for managing easing functions with type accumulation.
 *
 * @example
 * ```typescript
 * const registry = new EasingRegistry()
 *   .register('customBounce', (t) => /* custom logic *\/)
 *   .register('superElastic', (t) => /* custom logic *\/);
 *
 * // Type-safe access
 * const fn = registry.get('customBounce'); // EasingFn
 * ```
 */
export class EasingRegistry<
    TEasing extends Record<string, Record<string, unknown>> = BuiltInEasing,
> {
    private readonly easingFns = new Map<string, EasingFn>();

    constructor() {
        // Register all built-in easing functions
        for (const [name, fn] of Object.entries(builtInEasingFunctions)) {
            this.easingFns.set(name, fn);
        }
    }

    /**
     * Register a custom easing function with type accumulation.
     *
     * @param name - Name for the easing function
     * @param fn - The easing function
     * @returns Registry with accumulated type
     */
    register<K extends string>(
        name: K,
        fn: EasingFn
    ): EasingRegistry<TEasing & Record<K, Record<string, never>>> {
        this.easingFns.set(name, fn);
        return this as unknown as EasingRegistry<TEasing & Record<K, Record<string, never>>>;
    }

    /**
     * Get an easing function by name.
     *
     * @param name - Easing function name
     * @returns The easing function or undefined
     */
    get<K extends keyof TEasing & string>(name: K): EasingFn | undefined {
        return this.easingFns.get(name);
    }

    /**
     * Get an easing function by name, falling back to linear if not found.
     *
     * @param name - Easing function name
     * @returns The easing function or linear
     */
    getOrDefault(name: string): EasingFn {
        return this.easingFns.get(name) ?? linear;
    }

    /**
     * Check if an easing function is registered.
     *
     * @param name - Easing function name
     */
    has(name: string): boolean {
        return this.easingFns.has(name);
    }

    /**
     * Get all registered easing function names.
     */
    list(): string[] {
        return Array.from(this.easingFns.keys());
    }
}
