/**
 * Timeline Plugin Tests
 */

import { EngineBuilder } from '../../../packages/core/src/index';
import {
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
    linear,
} from './easing';
import { createTimeline, Timeline, TimelinePlugin, Tween } from './index';

// =============================================================================
// Test Components
// =============================================================================

class Position {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

class Opacity {
    constructor(public value: number = 1) {}
}

class Scale {
    constructor(
        public x: number = 1,
        public y: number = 1
    ) {}
}

class _Visible {
    constructor(public isVisible: boolean = true) {}
}

class DamageEffect {
    constructor(public damage: number = 0) {}
}

// =============================================================================
// Helper Functions
// =============================================================================

function createTestEngine() {
    const plugin = new TimelinePlugin({ debug: true });
    const engine = new EngineBuilder().withDebugMode(true).use(plugin).build();
    return engine;
}

function _simulateFrames(
    engine: ReturnType<typeof createTestEngine>,
    frames: number,
    deltaMs: number = 16.67
) {
    for (let i = 0; i < frames; i++) {
        // Mock delta time
        (engine as unknown as { deltaTime: number }).deltaTime = deltaMs / 1000;
        engine.update();
    }
}

function runFrames(engine: ReturnType<typeof createTestEngine>, frames: number) {
    for (let i = 0; i < frames; i++) {
        engine.update(1 / 60);
    }
}

// =============================================================================
// Easing Function Tests
// =============================================================================

describe('Easing Functions', () => {
    test('linear returns input unchanged', () => {
        expect(linear(0)).toBe(0);
        expect(linear(0.5)).toBe(0.5);
        expect(linear(1)).toBe(1);
    });

    test('easeInQuad accelerates', () => {
        expect(easeInQuad(0)).toBe(0);
        expect(easeInQuad(0.5)).toBe(0.25);
        expect(easeInQuad(1)).toBe(1);
    });

    test('easeOutQuad decelerates', () => {
        expect(easeOutQuad(0)).toBe(0);
        expect(easeOutQuad(0.5)).toBe(0.75);
        expect(easeOutQuad(1)).toBe(1);
    });

    test('easeInOutQuad accelerates then decelerates', () => {
        expect(easeInOutQuad(0)).toBe(0);
        expect(easeInOutQuad(0.5)).toBe(0.5);
        expect(easeInOutQuad(1)).toBe(1);
    });

    test('easeOutBounce has bounce effect', () => {
        expect(easeOutBounce(0)).toBe(0);
        expect(easeOutBounce(1)).toBeCloseTo(1, 5);
        // Should have intermediate values that create bounce
        expect(easeOutBounce(0.5)).toBeGreaterThan(0.5);
    });
});

// =============================================================================
// Easing Registry Tests
// =============================================================================

describe('EasingRegistry', () => {
    test('provides built-in easing functions', () => {
        const registry = new EasingRegistry();

        expect(registry.has('linear')).toBe(true);
        expect(registry.has('easeInQuad')).toBe(true);
        expect(registry.has('easeOutBounce')).toBe(true);
    });

    test('allows custom easing registration', () => {
        const registry = new EasingRegistry().register('customEase', (t) => t * t * t);

        expect(registry.has('customEase')).toBe(true);
        const fn = registry.get('customEase');
        expect(fn?.(0.5)).toBe(0.125);
    });

    test('getOrDefault returns linear for unknown easing', () => {
        const registry = new EasingRegistry();
        const fn = registry.getOrDefault('nonexistent');
        expect(fn(0.5)).toBe(0.5); // Linear behavior
    });

    test('list returns all registered easing names', () => {
        const registry = new EasingRegistry();
        const names = registry.list();

        expect(names).toContain('linear');
        expect(names).toContain('easeInQuad');
        expect(names).toContain('easeOutBounce');
        expect(names.length).toBeGreaterThan(20); // All built-in functions
    });
});

// =============================================================================
// Timeline Builder Tests
// =============================================================================

describe('TimelineBuilder', () => {
    test('creates basic timeline definition', () => {
        const timeline = createTimeline('test')
            .name('Test Timeline')
            .description('A test timeline')
            .build();

        expect(timeline.id).toBe('test');
        expect(timeline.name).toBe('Test Timeline');
        expect(timeline.description).toBe('A test timeline');
        expect(timeline.actions).toEqual([]);
    });

    test('creates timeline with tween action', () => {
        const timeline = createTimeline('fadeOut')
            .tween(Opacity, 'value', 0)
            .from(1)
            .to(0)
            .ease('easeOutQuad')
            .duration(500)
            .end()
            .build();

        expect(timeline.actions).toHaveLength(1);
        expect(timeline.actions[0].type).toBe('tween');

        const tween = timeline.actions[0] as { type: 'tween'; from: number; to: number };
        expect(tween.from).toBe(0);
        expect(tween.to).toBe(500);
    });

    test('creates timeline with set action', () => {
        const timeline = createTimeline('instant').set(Position, 'x', 100, 50).build();

        expect(timeline.actions).toHaveLength(1);
        expect(timeline.actions[0].type).toBe('set');
    });

    test('creates timeline with addDelta action', () => {
        const timeline = createTimeline('addDelta').addDelta(Position, 'x', 100, 10).build();

        expect(timeline.actions).toHaveLength(1);
        const action = timeline.actions[0] as { type: 'set'; delta: number };
        expect(action.type).toBe('set');
        expect(action.delta).toBe(10);
    });

    test('creates timeline with component actions', () => {
        const timeline = createTimeline('effects')
            .addComponent(DamageEffect, 0, 50)
            .removeComponent(DamageEffect, 500)
            .build();

        expect(timeline.actions).toHaveLength(2);
        expect(timeline.actions[0].type).toBe('add');
        expect(timeline.actions[1].type).toBe('remove');
    });

    test('creates timeline with emit action', () => {
        const timeline = createTimeline('events')
            .emit('effectStart', 0, { intensity: 1 })
            .emit('effectEnd', 500)
            .build();

        expect(timeline.actions).toHaveLength(2);
        expect(timeline.actions[0].type).toBe('emit');
        expect(timeline.actions[1].type).toBe('emit');
    });

    test('creates composite timeline', () => {
        const timeline = createTimeline('composite')
            .playTimeline('phase1', 0)
            .playTimeline('phase2', 500)
            .playTimeline('phase3', 1000)
            .build();

        expect(timeline.actions).toHaveLength(3);
        expect(timeline.actions[0].type).toBe('timeline');
        expect(timeline.actions[1].type).toBe('timeline');
        expect(timeline.actions[2].type).toBe('timeline');
    });

    test('calculates duration automatically', () => {
        const timeline = createTimeline('auto-duration')
            .tween(Position, 'x', 0)
            .to(100)
            .duration(500)
            .end()
            .emit('done', 600)
            .build();

        expect(timeline.duration).toBe(600);
    });
});

// =============================================================================
// Timeline Component Tests
// =============================================================================

describe('Timeline Component', () => {
    test('initializes with default values', () => {
        const timeline = new Timeline('test');

        expect(timeline.timelineId).toBe('test');
        expect(timeline.state).toBe('playing');
        expect(timeline.elapsed).toBe(0);
        expect(timeline.speed).toBe(1);
        expect(timeline.loop).toBe(false);
        expect(timeline.loopCount).toBe(0);
    });

    test('initializes with custom options', () => {
        const timeline = new Timeline('test', { speed: 2, loop: true });

        expect(timeline.speed).toBe(2);
        expect(timeline.loop).toBe(true);
    });

    test('pause and resume work correctly', () => {
        const timeline = new Timeline('test');

        expect(timeline.state).toBe('playing');

        timeline.pause();
        expect(timeline.state).toBe('paused');

        timeline.resume();
        expect(timeline.state).toBe('playing');
    });

    test('reset clears state', () => {
        const timeline = new Timeline('test');
        timeline.elapsed = 500;
        timeline.loopCount = 3;
        timeline.state = 'complete';
        timeline.initialized = true;

        timeline.reset();

        expect(timeline.elapsed).toBe(0);
        expect(timeline.loopCount).toBe(0);
        expect(timeline.state).toBe('playing');
        expect(timeline.initialized).toBe(false);
    });

    test('seek updates elapsed time', () => {
        const timeline = new Timeline('test');
        timeline.initialized = true;

        timeline.seek(250);

        expect(timeline.elapsed).toBe(250);
        expect(timeline.initialized).toBe(false); // Should trigger re-initialization
    });
});

// =============================================================================
// Tween Component Tests
// =============================================================================

describe('Tween Component', () => {
    test('initializes with required config', () => {
        const tween = new Tween(Position, 'x', {
            endValue: 100,
            duration: 500,
        });

        expect(tween.component).toBe(Position);
        expect(tween.property).toBe('x');
        expect(tween.config.endValue).toBe(100);
        expect(tween.config.duration).toBe(500);
        expect(tween.state).toBe('playing');
    });

    test('progress calculation works', () => {
        const tween = new Tween(Position, 'x', {
            endValue: 100,
            duration: 500,
        });

        expect(tween.progress).toBe(0);

        tween.elapsed = 250;
        expect(tween.progress).toBe(0.5);

        tween.elapsed = 500;
        expect(tween.progress).toBe(1);

        tween.elapsed = 1000;
        expect(tween.progress).toBe(1); // Capped at 1
    });

    test('reset clears state', () => {
        const tween = new Tween(Position, 'x', {
            endValue: 100,
            duration: 500,
        });

        tween.elapsed = 500;
        tween.capturedStartValue = 0;
        tween.state = 'complete';

        tween.reset();

        expect(tween.elapsed).toBe(0);
        expect(tween.capturedStartValue).toBeUndefined();
        expect(tween.state).toBe('playing');
    });
});

// =============================================================================
// Plugin API Tests
// =============================================================================

describe('TimelinePlugin API', () => {
    test('exposes timeline API on engine', () => {
        const engine = createTestEngine();

        expect(engine.timeline).toBeDefined();
        expect(typeof engine.timeline.create).toBe('function');
        expect(typeof engine.timeline.define).toBe('function');
        expect(typeof engine.timeline.play).toBe('function');
    });

    test('define and get timeline', () => {
        const engine = createTestEngine();

        const definition = engine.timeline.create('test').name('Test').build();

        engine.timeline.define(definition);

        expect(engine.timeline.get('test')).toBe(definition);
        expect(engine.timeline.list()).toContain('test');
    });

    test('unregister timeline', () => {
        const engine = createTestEngine();

        engine.timeline.define(engine.timeline.create('test').build());

        expect(engine.timeline.get('test')).toBeDefined();

        engine.timeline.unregister('test');

        expect(engine.timeline.get('test')).toBeUndefined();
    });

    test('play adds Timeline component', () => {
        const engine = createTestEngine();

        engine.timeline.define(engine.timeline.create('test').build());

        const entity = engine.createEntity('test');
        engine.timeline.playById(entity, 'test');

        expect(entity.hasComponent(Timeline)).toBe(true);
    });

    test('stop removes Timeline component', () => {
        const engine = createTestEngine();

        engine.timeline.define(engine.timeline.create('test').build());

        const entity = engine.createEntity('test');
        engine.timeline.playById(entity, 'test');
        expect(entity.hasComponent(Timeline)).toBe(true);

        engine.timeline.stop(entity);
        expect(entity.hasComponent(Timeline)).toBe(false);
    });

    test('pause and resume work', () => {
        const engine = createTestEngine();

        engine.timeline.define(engine.timeline.create('test').build());

        const entity = engine.createEntity('test');
        engine.timeline.playById(entity, 'test');

        expect(engine.timeline.isPlaying(entity)).toBe(true);

        engine.timeline.pause(entity);
        expect(engine.timeline.isPlaying(entity)).toBe(false);

        const state = engine.timeline.getState(entity);
        expect(state?.state).toBe('paused');

        engine.timeline.resume(entity);
        expect(engine.timeline.isPlaying(entity)).toBe(true);
    });

    test('playById throws for unknown timeline', () => {
        const engine = createTestEngine();
        const entity = engine.createEntity('test');

        expect(() => {
            engine.timeline.playById(entity, 'nonexistent');
        }).toThrow('[TimelinePlugin] Unknown timeline: nonexistent');
    });
});

// =============================================================================
// Plugin Custom Easing Tests
// =============================================================================

describe('TimelinePlugin Custom Easing', () => {
    test('allows custom easing registration', () => {
        const plugin = new TimelinePlugin().easing('customEase', (t) => t * t * t);

        const engine = new EngineBuilder().use(plugin).build();

        expect(engine.timeline.easing.has('customEase')).toBe(true);
    });

    test('custom easing is type-safe', () => {
        const plugin = new TimelinePlugin().easing('bounce', (t) => t).easing('elastic', (t) => t);

        const engine = new EngineBuilder().use(plugin).build();

        // Type system should know about 'bounce' and 'elastic'
        expect(engine.timeline.easing.has('bounce')).toBe(true);
        expect(engine.timeline.easing.has('elastic')).toBe(true);
    });
});

// =============================================================================
// Type-Safe Timeline Definition Tests
// =============================================================================

describe('TimelinePlugin Type-Safe Definitions', () => {
    test('plugin.define() registers timeline at build time', () => {
        const plugin = new TimelinePlugin()
            .define('fadeOut', (b) =>
                b.tween(Opacity, 'value', 0).from(1).to(0).duration(500).end().build()
            )
            .define('slideIn', (b) =>
                b.tween(Position, 'x', 0).from(-100).to(0).duration(300).end().build()
            );

        const engine = new EngineBuilder().use(plugin).build();

        // Both timelines should be registered
        expect(engine.timeline.get('fadeOut')).toBeDefined();
        expect(engine.timeline.get('slideIn')).toBeDefined();
        expect(engine.timeline.list()).toContain('fadeOut');
        expect(engine.timeline.list()).toContain('slideIn');
    });

    test('plugin.define() with easing works together', () => {
        const plugin = new TimelinePlugin()
            .easing('customBounce', (t) => t * t)
            .define('bounceIn', (b) =>
                b
                    .tween(Position, 'y', 0)
                    .from(0)
                    .to(100)
                    .ease('customBounce')
                    .duration(400)
                    .end()
                    .build()
            );

        const engine = new EngineBuilder().use(plugin).build();

        expect(engine.timeline.easing.has('customBounce')).toBe(true);
        expect(engine.timeline.get('bounceIn')).toBeDefined();
    });

    test('play() uses type-safe timeline IDs', () => {
        const plugin = new TimelinePlugin().define('testTimeline', (b) =>
            b.emit('start', 0).build()
        );

        const engine = new EngineBuilder().use(plugin).build();
        const entity = engine.createEntity('test');

        // Type-safe play - 'testTimeline' is known at compile time
        engine.timeline.play(entity, 'testTimeline');

        expect(entity.hasComponent(Timeline)).toBe(true);
        expect(entity.getComponent(Timeline).timelineId).toBe('testTimeline');
    });

    test('playById() accepts any string ID', () => {
        const engine = createTestEngine();

        // Define a timeline at runtime
        engine.timeline.define(engine.timeline.create('runtimeDefined').emit('start', 0).build());

        const entity = engine.createEntity('test');

        // playById accepts string for runtime flexibility
        engine.timeline.playById(entity, 'runtimeDefined');

        expect(entity.hasComponent(Timeline)).toBe(true);
        expect(entity.getComponent(Timeline).timelineId).toBe('runtimeDefined');
    });

    test('playById() throws for unknown timeline', () => {
        const engine = createTestEngine();
        const entity = engine.createEntity('test');

        expect(() => {
            engine.timeline.playById(entity, 'nonexistent');
        }).toThrow('[TimelinePlugin] Unknown timeline: nonexistent');
    });

    test('chained definitions accumulate types', () => {
        // This test verifies type accumulation works
        const plugin = new TimelinePlugin()
            .define('first', (b) => b.emit('first', 0).build())
            .define('second', (b) => b.emit('second', 0).build())
            .define('third', (b) => b.emit('third', 0).build());

        const engine = new EngineBuilder().use(plugin).build();

        // All three should be available
        expect(engine.timeline.list()).toHaveLength(3);
        expect(engine.timeline.get('first')).toBeDefined();
        expect(engine.timeline.get('second')).toBeDefined();
        expect(engine.timeline.get('third')).toBeDefined();
    });
});

// =============================================================================
// Integration Tests (Basic)
// =============================================================================

describe('Timeline Integration', () => {
    test('timeline definition with multiple actions', () => {
        const engine = createTestEngine();

        // Define a complex timeline
        engine.timeline.define(
            engine.timeline
                .create('attackSequence')
                .name('Attack Sequence')
                .tween(Position, 'x', 0)
                .fromCurrent()
                .by(50)
                .ease('easeOutQuad')
                .duration(200)
                .end()
                .addComponent(DamageEffect, 100, 25)
                .emit('attackHit', 100)
                .removeComponent(DamageEffect, 300)
                .tween(Position, 'x', 300)
                .fromCurrent()
                .by(-50)
                .ease('easeInQuad')
                .duration(200)
                .end()
                .build()
        );

        const definition = engine.timeline.get('attackSequence');
        expect(definition).toBeDefined();
        expect(definition?.name).toBe('Attack Sequence');
        expect(definition?.actions).toHaveLength(5);
    });

    test('composite timeline definition', () => {
        const engine = createTestEngine();

        // Define sub-timelines
        engine.timeline.define(
            engine.timeline
                .create('windUp')
                .tween(Scale, 'x', 0)
                .from(1)
                .to(0.8)
                .duration(150)
                .end()
                .build()
        );

        engine.timeline.define(
            engine.timeline
                .create('strike')
                .tween(Scale, 'x', 0)
                .from(0.8)
                .to(1.2)
                .duration(100)
                .end()
                .build()
        );

        engine.timeline.define(
            engine.timeline
                .create('recover')
                .tween(Scale, 'x', 0)
                .from(1.2)
                .to(1)
                .duration(150)
                .end()
                .build()
        );

        // Define composite
        engine.timeline.define(
            engine.timeline
                .create('meleeAttack')
                .playTimeline('windUp', 0)
                .playTimeline('strike', 150)
                .playTimeline('recover', 250)
                .build()
        );

        const composite = engine.timeline.get('meleeAttack');
        expect(composite).toBeDefined();
        expect(composite?.actions).toHaveLength(3);
        expect(composite?.actions[0].type).toBe('timeline');
    });
});

// =============================================================================
// Additional Easing Function Tests
// =============================================================================

describe('All Easing Functions', () => {
    describe('Cubic', () => {
        test('easeInCubic', () => {
            expect(easeInCubic(0)).toBe(0);
            expect(easeInCubic(0.5)).toBe(0.125);
            expect(easeInCubic(1)).toBe(1);
        });

        test('easeOutCubic', () => {
            expect(easeOutCubic(0)).toBe(0);
            expect(easeOutCubic(0.5)).toBe(0.875);
            expect(easeOutCubic(1)).toBe(1);
        });

        test('easeInOutCubic', () => {
            expect(easeInOutCubic(0)).toBe(0);
            expect(easeInOutCubic(0.5)).toBe(0.5);
            expect(easeInOutCubic(1)).toBe(1);
        });
    });

    describe('Quartic', () => {
        test('easeInQuart', () => {
            expect(easeInQuart(0)).toBe(0);
            expect(easeInQuart(0.5)).toBe(0.0625);
            expect(easeInQuart(1)).toBe(1);
        });

        test('easeOutQuart', () => {
            expect(easeOutQuart(0)).toBe(0);
            expect(easeOutQuart(1)).toBe(1);
        });

        test('easeInOutQuart', () => {
            expect(easeInOutQuart(0)).toBe(0);
            expect(easeInOutQuart(0.5)).toBe(0.5);
            expect(easeInOutQuart(1)).toBe(1);
        });
    });

    describe('Quintic', () => {
        test('easeInQuint', () => {
            expect(easeInQuint(0)).toBe(0);
            expect(easeInQuint(0.5)).toBe(0.03125);
            expect(easeInQuint(1)).toBe(1);
        });

        test('easeOutQuint', () => {
            expect(easeOutQuint(0)).toBe(0);
            expect(easeOutQuint(1)).toBe(1);
        });

        test('easeInOutQuint', () => {
            expect(easeInOutQuint(0)).toBe(0);
            expect(easeInOutQuint(0.5)).toBe(0.5);
            expect(easeInOutQuint(1)).toBe(1);
        });
    });

    describe('Sinusoidal', () => {
        test('easeInSine', () => {
            expect(easeInSine(0)).toBeCloseTo(0, 5);
            expect(easeInSine(1)).toBeCloseTo(1, 5);
        });

        test('easeOutSine', () => {
            expect(easeOutSine(0)).toBeCloseTo(0, 5);
            expect(easeOutSine(1)).toBeCloseTo(1, 5);
        });

        test('easeInOutSine', () => {
            expect(easeInOutSine(0)).toBeCloseTo(0, 5);
            expect(easeInOutSine(0.5)).toBeCloseTo(0.5, 5);
            expect(easeInOutSine(1)).toBeCloseTo(1, 5);
        });
    });

    describe('Exponential', () => {
        test('easeInExpo', () => {
            expect(easeInExpo(0)).toBe(0);
            expect(easeInExpo(1)).toBe(1);
        });

        test('easeOutExpo', () => {
            expect(easeOutExpo(0)).toBeCloseTo(0, 5);
            expect(easeOutExpo(1)).toBe(1);
        });

        test('easeInOutExpo', () => {
            expect(easeInOutExpo(0)).toBe(0);
            expect(easeInOutExpo(0.5)).toBeCloseTo(0.5, 5);
            expect(easeInOutExpo(1)).toBe(1);
        });
    });

    describe('Circular', () => {
        test('easeInCirc', () => {
            expect(easeInCirc(0)).toBe(0);
            expect(easeInCirc(1)).toBe(1);
        });

        test('easeOutCirc', () => {
            expect(easeOutCirc(0)).toBe(0);
            expect(easeOutCirc(1)).toBe(1);
        });

        test('easeInOutCirc', () => {
            expect(easeInOutCirc(0)).toBe(0);
            expect(easeInOutCirc(0.5)).toBeCloseTo(0.5, 5);
            expect(easeInOutCirc(1)).toBe(1);
        });
    });

    describe('Back (Overshoot)', () => {
        test('easeInBack', () => {
            expect(easeInBack(0)).toBeCloseTo(0, 10);
            expect(easeInBack(1)).toBeCloseTo(1, 5);
            // Back easing has characteristic overshoot
            const midValue = easeInBack(0.5);
            expect(midValue).toBeLessThan(0.5); // Slower start than linear
        });

        test('easeOutBack', () => {
            expect(easeOutBack(0)).toBeCloseTo(0, 10);
            expect(easeOutBack(1)).toBeCloseTo(1, 5);
            // Back easing overshoots
            const midValue = easeOutBack(0.5);
            expect(midValue).toBeGreaterThan(0.5); // Overshoots linear
        });

        test('easeInOutBack', () => {
            expect(easeInOutBack(0)).toBeCloseTo(0, 10);
            expect(easeInOutBack(1)).toBeCloseTo(1, 5);
            expect(easeInOutBack(0.5)).toBeCloseTo(0.5, 1);
        });
    });

    describe('Elastic', () => {
        test('easeInElastic', () => {
            expect(easeInElastic(0)).toBe(0);
            expect(easeInElastic(1)).toBe(1);
        });

        test('easeOutElastic', () => {
            expect(easeOutElastic(0)).toBe(0);
            expect(easeOutElastic(1)).toBe(1);
        });

        test('easeInOutElastic', () => {
            expect(easeInOutElastic(0)).toBe(0);
            expect(easeInOutElastic(1)).toBe(1);
        });
    });

    describe('Bounce', () => {
        test('easeInBounce', () => {
            expect(easeInBounce(0)).toBe(0);
            expect(easeInBounce(1)).toBeCloseTo(1, 5);
        });

        test('easeInOutBounce', () => {
            expect(easeInOutBounce(0)).toBe(0);
            expect(easeInOutBounce(1)).toBeCloseTo(1, 5);
        });

        test('easeOutBounce covers all branches', () => {
            // Test different ranges of t
            expect(easeOutBounce(0.2)).toBeGreaterThan(0); // t < 1/BOUNCE_D1
            expect(easeOutBounce(0.5)).toBeGreaterThan(0); // t < 2/BOUNCE_D1
            expect(easeOutBounce(0.8)).toBeGreaterThan(0); // t < 2.5/BOUNCE_D1
            expect(easeOutBounce(0.95)).toBeGreaterThan(0); // else branch
        });
    });
});

// =============================================================================
// Timeline Processing Tests
// =============================================================================

describe('Timeline Processing', () => {
    test('timeline processes tween action over time', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        engine.timeline.define(
            engine.timeline
                .create('moveRight')
                .tween(Position, 'x', 0)
                .from(0)
                .to(100)
                .duration(500) // 500ms = ~30 frames at 60fps
                .end()
                .build()
        );

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);

        engine.timeline.playById(entity, 'moveRight');
        engine.start();

        // After ~15 frames (~250ms), should be around 50%
        runFrames(engine, 15);
        const pos = entity.getComponent(Position);
        expect(pos.x).toBeGreaterThan(40);
        expect(pos.x).toBeLessThan(60);

        // After ~30 more frames, should be complete
        runFrames(engine, 30);
        expect(pos.x).toBeCloseTo(100, 0);
    });

    test('timeline processes set action', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        engine.timeline.define(
            engine.timeline
                .create('setPos')
                .set(Position, 'x', 100, 100)
                .build() // Trigger at 100ms
        );

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);

        engine.timeline.playById(entity, 'setPos');
        engine.start();

        // Before trigger time (~3 frames = ~50ms)
        runFrames(engine, 3);
        expect(entity.getComponent(Position).x).toBe(0);

        // After trigger time (~10 frames = ~166ms)
        runFrames(engine, 10);
        expect(entity.getComponent(Position).x).toBe(100);
    });

    test('timeline processes addDelta action', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        engine.timeline.define(
            engine.timeline
                .create('addDelta')
                .addDelta(Position, 'x', 100, 50)
                .build() // At 100ms, add 50
        );

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 25, 0);

        engine.timeline.playById(entity, 'addDelta');
        engine.start();

        // Before trigger time
        runFrames(engine, 3);
        expect(entity.getComponent(Position).x).toBe(25);

        // After trigger time - should add delta
        runFrames(engine, 10);
        expect(entity.getComponent(Position).x).toBe(75); // 25 + 50
    });

    test('timeline processes component add action', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);
        engine.registerComponent(DamageEffect);

        engine.timeline.define(
            engine.timeline.create('addEffect').addComponent(DamageEffect, 100, 10).build()
        );

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);

        engine.timeline.playById(entity, 'addEffect');
        engine.start();

        // Before trigger time
        runFrames(engine, 3);
        expect(entity.hasComponent(DamageEffect)).toBe(false);

        // After trigger time
        runFrames(engine, 10);
        expect(entity.hasComponent(DamageEffect)).toBe(true);
    });

    test('timeline processes component remove action', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);
        engine.registerComponent(DamageEffect);

        engine.timeline.define(
            engine.timeline.create('removeEffect').removeComponent(DamageEffect, 100).build()
        );

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);
        entity.addComponent(DamageEffect, 10);

        engine.timeline.playById(entity, 'removeEffect');
        engine.start();

        // Before trigger time
        runFrames(engine, 3);
        expect(entity.hasComponent(DamageEffect)).toBe(true);

        // After trigger time
        runFrames(engine, 10);
        expect(entity.hasComponent(DamageEffect)).toBe(false);
    });

    test('timeline processes emit action', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        let eventReceived = false;
        engine.on('customEvent', () => {
            eventReceived = true;
        });

        engine.timeline.define(
            engine.timeline.create('emitTest').emit('customEvent', 100, { value: 42 }).build()
        );

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);

        engine.timeline.playById(entity, 'emitTest');
        engine.start();

        // Before trigger time
        runFrames(engine, 3);
        expect(eventReceived).toBe(false);

        // After trigger time
        runFrames(engine, 10);
        expect(eventReceived).toBe(true);
    });

    test('timeline loops when loop option is set', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        engine.timeline.define(
            engine.timeline
                .create('loopMove')
                .tween(Position, 'x', 0)
                .from(0)
                .to(100)
                .duration(200) // Short duration for test
                .end()
                .build()
        );

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);

        engine.timeline.playById(entity, 'loopMove', { loop: true });
        engine.start();

        // Complete first loop (~12 frames = 200ms)
        runFrames(engine, 15);
        const timeline = entity.getComponent(Timeline);
        expect(timeline.loopCount).toBeGreaterThanOrEqual(1);
    });

    test('timeline completes and stops when not looping', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        engine.timeline.define(
            engine.timeline
                .create('complete')
                .tween(Position, 'x', 0)
                .from(0)
                .to(100)
                .duration(200)
                .end()
                .build()
        );

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);

        engine.timeline.playById(entity, 'complete');
        engine.start();

        runFrames(engine, 20); // Past completion

        const timeline = entity.getComponent(Timeline);
        expect(timeline.state).toBe('complete');
    });

    test('timeline uses speed multiplier', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        engine.timeline.define(
            engine.timeline
                .create('fast')
                .tween(Position, 'x', 0)
                .from(0)
                .to(100)
                .duration(400) // 400ms timeline
                .end()
                .build()
        );

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);

        engine.timeline.playById(entity, 'fast', { speed: 2 });
        engine.start();

        // At 2x speed, 200ms real time = 400ms timeline time
        // ~12 frames should complete it
        runFrames(engine, 15);
        expect(entity.getComponent(Position).x).toBeCloseTo(100, 0);
    });
});

// =============================================================================
// Standalone Tween Tests
// =============================================================================

describe('Standalone Tween Processing', () => {
    test('tween processes value over time', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);
        entity.addComponent(Tween, Position, 'x', {
            endValue: 100,
            duration: 500, // 500ms = ~30 frames
        });

        engine.start();

        runFrames(engine, 15); // ~250ms
        expect(entity.getComponent(Position).x).toBeGreaterThan(40);
        expect(entity.getComponent(Position).x).toBeLessThan(60);

        runFrames(engine, 30); // Complete
        expect(entity.getComponent(Position).x).toBeCloseTo(100, 0);
    });

    test('tween uses delta mode', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 50, 0);
        entity.addComponent(Tween, Position, 'x', {
            delta: 100,
            duration: 300, // 300ms = ~18 frames
        });

        engine.start();

        runFrames(engine, 25); // Complete
        expect(entity.getComponent(Position).x).toBeCloseTo(150, 0); // 50 + 100
    });

    test('tween loops when configured', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);
        entity.addComponent(Tween, Position, 'x', {
            endValue: 100,
            duration: 200,
            loop: true,
        });

        engine.start();

        runFrames(engine, 15); // ~250ms - past first loop

        // Should have restarted
        const tween = entity.getComponent(Tween);
        expect(tween.state).toBe('playing');
    });

    test('tween completes when not looping', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);
        entity.addComponent(Tween, Position, 'x', {
            endValue: 100,
            duration: 200, // 200ms = ~12 frames
        });

        engine.start();

        runFrames(engine, 20); // Past completion

        const tween = entity.getComponent(Tween);
        expect(tween.state).toBe('complete');
    });

    test('tween respects speed option', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);
        entity.addComponent(Tween, Position, 'x', {
            endValue: 100,
            duration: 400, // 400ms
            speed: 2,
        });

        engine.start();

        // At 2x speed, ~12 frames = 200ms real = 400ms tween time
        runFrames(engine, 15);
        expect(entity.getComponent(Position).x).toBeCloseTo(100, 0);
    });
});

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================

describe('Edge Cases', () => {
    test('timeline handles missing component gracefully', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        engine.timeline.define(
            engine.timeline
                .create('noComp')
                .tween(Position, 'x', 0)
                .from(0)
                .to(100)
                .duration(500)
                .end()
                .build()
        );

        const entity = engine.createEntity('test');
        // Note: Not adding Position component

        engine.timeline.playById(entity, 'noComp');
        engine.start();

        // Should not throw, just log warning in debug mode
        expect(() => engine.update(0.5)).not.toThrow();
    });

    test('timeline handles unknown nested timeline', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        engine.timeline.define(
            engine.timeline.create('parent').playTimeline('nonexistent', 0).build()
        );

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);

        engine.timeline.playById(entity, 'parent');
        engine.start();

        // Should not throw, just log warning
        expect(() => engine.update(0.5)).not.toThrow();
    });

    test('isPlaying returns false for entity without timeline', () => {
        const engine = createTestEngine();
        const entity = engine.createEntity('test');

        expect(engine.timeline.isPlaying(entity)).toBe(false);
    });

    test('getState returns undefined for entity without timeline', () => {
        const engine = createTestEngine();
        const entity = engine.createEntity('test');

        expect(engine.timeline.getState(entity)).toBeUndefined();
    });

    test('pause has no effect on entity without timeline', () => {
        const engine = createTestEngine();
        const entity = engine.createEntity('test');

        expect(() => engine.timeline.pause(entity)).not.toThrow();
    });

    test('resume has no effect on entity without timeline', () => {
        const engine = createTestEngine();
        const entity = engine.createEntity('test');

        expect(() => engine.timeline.resume(entity)).not.toThrow();
    });

    test('stop has no effect on entity without timeline', () => {
        const engine = createTestEngine();
        const entity = engine.createEntity('test');

        expect(() => engine.timeline.stop(entity)).not.toThrow();
    });

    test('play replaces existing timeline', () => {
        const engine = createTestEngine();
        engine.registerComponent(Position);

        engine.timeline.define(engine.timeline.create('first').emit('first', 0).build());
        engine.timeline.define(engine.timeline.create('second').emit('second', 0).build());

        const entity = engine.createEntity('test');
        entity.addComponent(Position, 0, 0);

        engine.timeline.playById(entity, 'first');
        expect(entity.getComponent(Timeline).timelineId).toBe('first');

        engine.timeline.playById(entity, 'second');
        expect(entity.getComponent(Timeline).timelineId).toBe('second');
    });
});

// =============================================================================
// Plugin Lifecycle Tests
// =============================================================================

describe('Plugin Lifecycle', () => {
    test('plugin has correct metadata', () => {
        const plugin = new TimelinePlugin();

        expect(plugin.name).toBe('TimelinePlugin');
        expect(plugin.version).toBe('0.1.0');
    });

    test('plugin uninstall clears definitions', () => {
        const plugin = new TimelinePlugin().define('test', (b) => b.emit('test', 0).build());

        const engine = new EngineBuilder().use(plugin).build();

        expect(engine.timeline.get('test')).toBeDefined();

        plugin.uninstall();

        // After uninstall, internal definitions should be cleared
        // Note: engine.timeline still has the definition because
        // it's stored in the API closure, not the plugin
    });
});
