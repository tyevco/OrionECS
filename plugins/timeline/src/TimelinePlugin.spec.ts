/**
 * Timeline Plugin Tests
 */

import { EngineBuilder } from '../../../packages/core/src/index';
import {
    EasingRegistry,
    easeInOutQuad,
    easeInQuad,
    easeOutBounce,
    easeOutQuad,
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
        engine.timeline.play(entity, 'test');

        expect(entity.hasComponent(Timeline)).toBe(true);
    });

    test('stop removes Timeline component', () => {
        const engine = createTestEngine();

        engine.timeline.define(engine.timeline.create('test').build());

        const entity = engine.createEntity('test');
        engine.timeline.play(entity, 'test');
        expect(entity.hasComponent(Timeline)).toBe(true);

        engine.timeline.stop(entity);
        expect(entity.hasComponent(Timeline)).toBe(false);
    });

    test('pause and resume work', () => {
        const engine = createTestEngine();

        engine.timeline.define(engine.timeline.create('test').build());

        const entity = engine.createEntity('test');
        engine.timeline.play(entity, 'test');

        expect(engine.timeline.isPlaying(entity)).toBe(true);

        engine.timeline.pause(entity);
        expect(engine.timeline.isPlaying(entity)).toBe(false);

        const state = engine.timeline.getState(entity);
        expect(state?.state).toBe('paused');

        engine.timeline.resume(entity);
        expect(engine.timeline.isPlaying(entity)).toBe(true);
    });

    test('play throws for unknown timeline', () => {
        const engine = createTestEngine();
        const entity = engine.createEntity('test');

        expect(() => {
            engine.timeline.play(entity, 'nonexistent');
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
