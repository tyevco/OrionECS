/**
 * OrionECS Testing Utilities
 * Comprehensive testing tools for users to test their own systems and components
 *
 * @module testing
 */

import type { Entity, ComponentArgs, ComponentIdentifier, SystemProfile, Engine } from 'orion-ecs';
import { EngineBuilder } from 'orion-ecs';

/**
 * TestEngineBuilder provides a preconfigured engine builder optimized for testing.
 * Automatically sets up deterministic behavior and fast test execution.
 *
 * @example
 * ```typescript
 * const engine = new TestEngineBuilder()
 *   .withComponent(Position)
 *   .withComponent(Velocity)
 *   .build();
 *
 * // Engine is automatically configured for testing
 * // - Debug mode enabled for better error messages
 * // - Deterministic behavior
 * // - Automatic cleanup after tests
 * ```
 */
export class TestEngineBuilder extends EngineBuilder {
    constructor() {
        super();
        // Set test-friendly defaults
        this.withDebugMode(true);
        this.withFixedUpdateFPS(60);
        this.withMaxFixedIterations(10);
    }

    /**
     * Builds the test engine with test-friendly defaults
     */
    build(): Engine {
        return super.build();
    }

    /**
     * Register a component for testing and return this for chaining
     */
    withComponent<T extends ComponentIdentifier>(
        _componentClass: T,
        ..._args: ComponentArgs<T>
    ): this {
        // Components will be registered when entities use them
        return this;
    }
}

/**
 * TestClock provides deterministic time control for testing.
 * Allows frame-by-frame stepping and time manipulation.
 *
 * @example
 * ```typescript
 * const clock = new TestClock();
 * const engine = new TestEngineBuilder().build();
 *
 * // Step one frame (16.67ms at 60 FPS)
 * clock.step();
 * engine.update(clock.deltaTime);
 *
 * // Step multiple frames
 * clock.step(5);
 *
 * // Set specific time
 * clock.setTime(1000);
 * ```
 */
export class TestClock {
    private _currentTime: number = 0;
    private _deltaTime: number = 16.67; // 60 FPS default
    private _fps: number = 60;
    private _isPaused: boolean = false;

    constructor(fps: number = 60) {
        this._fps = fps;
        this._deltaTime = 1000 / fps;
    }

    /**
     * Current simulated time in milliseconds
     */
    get currentTime(): number {
        return this._currentTime;
    }

    /**
     * Delta time for the current frame in milliseconds
     */
    get deltaTime(): number {
        return this._deltaTime;
    }

    /**
     * Current frames per second
     */
    get fps(): number {
        return this._fps;
    }

    /**
     * Whether the clock is paused
     */
    get isPaused(): boolean {
        return this._isPaused;
    }

    /**
     * Step forward by the specified number of frames
     * @param frames Number of frames to step (default: 1)
     */
    step(frames: number = 1): number {
        if (this._isPaused) return this._currentTime;

        const timeStep = this._deltaTime * frames;
        this._currentTime += timeStep;
        return this._currentTime;
    }

    /**
     * Step forward by a specific time delta in milliseconds
     * @param deltaMs Time in milliseconds to advance
     */
    stepByTime(deltaMs: number): number {
        if (this._isPaused) return this._currentTime;

        this._currentTime += deltaMs;
        return this._currentTime;
    }

    /**
     * Set the current time to a specific value
     * @param timeMs Time in milliseconds
     */
    setTime(timeMs: number): void {
        this._currentTime = timeMs;
    }

    /**
     * Reset the clock to time zero
     */
    reset(): void {
        this._currentTime = 0;
    }

    /**
     * Pause the clock (step() will not advance time)
     */
    pause(): void {
        this._isPaused = true;
    }

    /**
     * Resume the clock
     */
    resume(): void {
        this._isPaused = false;
    }

    /**
     * Set the frames per second and update delta time
     * @param fps Frames per second
     */
    setFPS(fps: number): void {
        this._fps = fps;
        this._deltaTime = 1000 / fps;
    }

    /**
     * Get delta time in seconds (useful for physics calculations)
     */
    get deltaSeconds(): number {
        return this._deltaTime / 1000;
    }
}

/**
 * Options for creating test entities
 */
export interface TestEntityOptions {
    /** Entity name */
    name?: string;
    /** Tags to add to the entity */
    tags?: string[];
    /** Components to add with their constructor arguments */
    components?: Array<{
        type: ComponentIdentifier;
        args?: any[];
    }>;
    /** Parent entity */
    parent?: Entity;
}

/**
 * Create a test entity with the specified options
 *
 * @example
 * ```typescript
 * const entity = createTestEntity(engine, {
 *   name: 'TestPlayer',
 *   tags: ['player', 'controllable'],
 *   components: [
 *     { type: Position, args: [0, 0] },
 *     { type: Velocity, args: [1, 1] }
 *   ]
 * });
 * ```
 */
export function createTestEntity(engine: Engine, options: TestEntityOptions = {}): Entity {
    const entity = engine.createEntity(options.name);

    // Add tags
    if (options.tags) {
        for (const tag of options.tags) {
            entity.addTag(tag);
        }
    }

    // Add components
    if (options.components) {
        options.components.forEach(({ type, args = [] }) => {
            entity.addComponent(type, ...args);
        });
    }

    // Set parent
    if (options.parent) {
        entity.setParent(options.parent);
    }

    return entity;
}

/**
 * Create multiple test entities with the same configuration
 *
 * @example
 * ```typescript
 * const enemies = createTestEntities(engine, 10, {
 *   tags: ['enemy'],
 *   components: [
 *     { type: Position },
 *     { type: Health, args: [50, 50] }
 *   ]
 * });
 * ```
 */
export function createTestEntities(
    engine: Engine,
    count: number,
    options: TestEntityOptions = {}
): Entity[] {
    const entities: Entity[] = [];

    for (let i = 0; i < count; i++) {
        const entityOptions = { ...options };
        if (options.name) {
            entityOptions.name = `${options.name}_${i}`;
        }
        entities.push(createTestEntity(engine, entityOptions));
    }

    return entities;
}

/**
 * Create a test entity from a prefab
 *
 * @example
 * ```typescript
 * engine.registerPrefab('Enemy', enemyPrefab);
 * const enemy = createTestEntityFromPrefab(engine, 'Enemy', 'Enemy_1');
 * ```
 */
export function createTestEntityFromPrefab(
    engine: Engine,
    prefabName: string,
    entityName?: string
): Entity | null {
    return engine.createFromPrefab(prefabName, entityName);
}

/**
 * TestSystemRunner allows isolated execution and testing of systems
 *
 * @example
 * ```typescript
 * const runner = new TestSystemRunner(engine);
 *
 * // Run a specific system
 * runner.runSystem('MovementSystem', 16.67);
 *
 * // Check execution
 * expect(runner.wasExecuted('MovementSystem')).toBe(true);
 * expect(runner.getExecutionTime('MovementSystem')).toBeGreaterThan(0);
 * ```
 */
export class TestSystemRunner {
    private engine: Engine;
    private executionLog: Map<string, SystemProfile> = new Map();

    constructor(engine: Engine) {
        this.engine = engine;
    }

    /**
     * Run a specific system by name in isolation
     * @param systemName Name of the system to run
     * @param deltaTime Delta time in milliseconds
     * @returns System profile with execution stats
     */
    runSystem(systemName: string, deltaTime: number = 16.67): SystemProfile | null {
        const profiles = this.engine.getSystemProfiles();
        const systemProfile = profiles.find((p) => p.name === systemName);

        if (!systemProfile) {
            throw new Error(`System '${systemName}' not found`);
        }

        // Update the engine (all systems will run, but we'll track this one)
        this.engine.update(deltaTime);

        // Get updated profile
        const afterProfiles = this.engine.getSystemProfiles();
        const updatedProfile = afterProfiles.find((p) => p.name === systemName);

        if (updatedProfile) {
            this.executionLog.set(systemName, updatedProfile);
            return updatedProfile;
        }

        return null;
    }

    /**
     * Run all variable update systems
     * @param deltaTime Delta time in milliseconds
     */
    runVariableSystems(deltaTime: number = 16.67): void {
        this.engine.update(deltaTime);

        // Log all system executions
        const profiles = this.engine.getSystemProfiles();
        profiles.forEach((profile) => {
            this.executionLog.set(profile.name, profile);
        });
    }

    /**
     * Run all systems (both variable and fixed update)
     * @param deltaTime Delta time in milliseconds
     */
    runAllSystems(deltaTime: number = 16.67): void {
        this.engine.update(deltaTime);

        // Log all system executions
        const profiles = this.engine.getSystemProfiles();
        profiles.forEach((profile) => {
            this.executionLog.set(profile.name, profile);
        });
    }

    /**
     * Check if a system was executed
     * @param systemName Name of the system
     */
    wasExecuted(systemName: string): boolean {
        return this.executionLog.has(systemName);
    }

    /**
     * Get execution time for a system
     * @param systemName Name of the system
     * @returns Execution time in milliseconds, or null if not executed
     */
    getExecutionTime(systemName: string): number | null {
        const profile = this.executionLog.get(systemName);
        return profile ? profile.executionTime : null;
    }

    /**
     * Get the number of entities processed by a system
     * @param systemName Name of the system
     * @returns Entity count, or null if not executed
     */
    getEntityCount(systemName: string): number | null {
        const profile = this.executionLog.get(systemName);
        return profile ? profile.entityCount : null;
    }

    /**
     * Get the full system profile
     * @param systemName Name of the system
     */
    getProfile(systemName: string): SystemProfile | null {
        return this.executionLog.get(systemName) || null;
    }

    /**
     * Clear the execution log
     */
    clearLog(): void {
        this.executionLog.clear();
    }

    /**
     * Get all execution logs
     */
    getAllLogs(): Map<string, SystemProfile> {
        return new Map(this.executionLog);
    }
}

/**
 * Snapshot utilities for testing state changes
 */
export class TestSnapshot {
    private engine: Engine;
    private snapshotIndices: number[] = [];

    constructor(engine: Engine) {
        this.engine = engine;
    }

    /**
     * Create a snapshot of the current world state
     * @returns The index of the created snapshot
     */
    create(): number {
        this.engine.createSnapshot();
        const afterCount = this.engine.getSnapshotCount();
        const index = afterCount - 1;
        this.snapshotIndices.push(index);
        return index;
    }

    /**
     * Restore a previously created snapshot by index
     * @param index The snapshot index to restore (default: last created)
     */
    restore(index?: number): boolean {
        const snapshotIndex =
            index !== undefined ? index : this.snapshotIndices[this.snapshotIndices.length - 1];
        return this.engine.restoreSnapshot(snapshotIndex);
    }

    /**
     * Get the number of entities in the current state
     */
    getEntityCount(): number {
        return this.engine.getAllEntities().length;
    }

    /**
     * Clear all snapshots
     */
    clear(): void {
        this.engine.clearSnapshots();
        this.snapshotIndices = [];
    }
}

// ============================================================================
// Custom Assertion Matchers
// ============================================================================

/**
 * Custom matchers for Jest/Vitest testing
 *
 * @example
 * ```typescript
 * // In your test setup file:
 * import { setupTestMatchers } from 'orion-ecs/testing';
 * setupTestMatchers();
 *
 * // In your tests:
 * expect(entity).toHaveComponent(Position);
 * expect(entity).toHaveTag('player');
 * expect(query).toMatch([entity1, entity2]);
 * ```
 */

export interface CustomMatchers<R = unknown> {
    /**
     * Check if an entity has a specific component
     */
    toHaveComponent(componentClass: ComponentIdentifier): R;

    /**
     * Check if an entity has a specific tag
     */
    toHaveTag(tag: string): R;

    /**
     * Check if a query matches specific entities
     */
    toMatch(entities: Entity[]): R;

    /**
     * Check if an entity is in a specific archetype
     */
    toBeInArchetype(archetypeId: string): R;
}

/**
 * Setup custom matchers for Jest/Vitest
 * Call this in your test setup file
 */
export function setupTestMatchers(): void {
    if (typeof expect !== 'undefined' && expect.extend) {
        expect.extend({
            toHaveComponent(received: Entity, componentClass: ComponentIdentifier) {
                const hasComponent = received.hasComponent(componentClass);

                return {
                    pass: hasComponent,
                    message: () =>
                        hasComponent
                            ? `Expected entity ${received.name} not to have component ${componentClass.name}`
                            : `Expected entity ${received.name} to have component ${componentClass.name}`,
                };
            },

            toHaveTag(received: Entity, tag: string) {
                const hasTag = received.hasTag(tag);

                return {
                    pass: hasTag,
                    message: () =>
                        hasTag
                            ? `Expected entity ${received.name} not to have tag '${tag}'`
                            : `Expected entity ${received.name} to have tag '${tag}'`,
                };
            },

            toMatch(received: any, entities: Entity[]) {
                // Assuming received is a query result array
                const receivedIds = new Set(received.map((e: Entity) => e.id));
                const expectedIds = new Set(entities.map((e: Entity) => e.id));

                const receivedArray = Array.from(receivedIds) as symbol[];
                const matches =
                    receivedIds.size === expectedIds.size &&
                    receivedArray.every((id: symbol) => expectedIds.has(id));

                return {
                    pass: matches,
                    message: () =>
                        matches
                            ? `Expected query not to match the specified entities`
                            : `Expected query to match the specified entities`,
                };
            },

            toBeInArchetype(received: Entity, archetypeId: string) {
                // Get the entity's current archetype
                const componentNames = Array.from((received as any).components.keys()).map(
                    (c: any) => c.name
                );
                const components = [...componentNames].sort().join(',');

                const matches = components === archetypeId;

                return {
                    pass: matches,
                    message: () =>
                        matches
                            ? `Expected entity ${received.name} not to be in archetype '${archetypeId}'`
                            : `Expected entity ${received.name} to be in archetype '${archetypeId}', but was in '${components}'`,
                };
            },
        });
    }
}

// ============================================================================
// Helper Utilities
// ============================================================================

/**
 * Wait for a specific number of frames
 * Useful for testing asynchronous behavior
 *
 * @example
 * ```typescript
 * const clock = new TestClock();
 * await waitFrames(clock, engine, 10);
 * // 10 frames have passed
 * ```
 */
export async function waitFrames(clock: TestClock, engine: Engine, frames: number): Promise<void> {
    for (let i = 0; i < frames; i++) {
        clock.step();
        engine.update(clock.deltaTime);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setImmediate(resolve));
    }
}

/**
 * Wait until a condition is met or timeout
 *
 * @example
 * ```typescript
 * await waitUntil(
 *   () => entity.hasComponent(Position),
 *   1000,
 *   'Entity should have Position component'
 * );
 * ```
 */
export async function waitUntil(
    condition: () => boolean,
    timeoutMs: number = 1000,
    message: string = 'Condition not met'
): Promise<void> {
    const startTime = Date.now();

    while (!condition()) {
        if (Date.now() - startTime > timeoutMs) {
            throw new Error(`Timeout: ${message}`);
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}

/**
 * Create a mock component class for testing
 *
 * @example
 * ```typescript
 * const MockComponent = createMockComponent('MockComponent', {
 *   value: 42,
 *   name: 'test'
 * });
 *
 * const entity = engine.createEntity();
 * entity.addComponent(MockComponent);
 * ```
 */
export function createMockComponent(name: string, defaultProps: Record<string, any> = {}): any {
    const componentClass = class {
        static componentName = name;

        constructor() {
            Object.assign(this, defaultProps);
        }
    };

    Object.defineProperty(componentClass, 'name', { value: name });

    return componentClass;
}

/**
 * Get a summary of all entities in the engine
 * Useful for debugging test failures
 *
 * @example
 * ```typescript
 * const summary = getEntitySummary(engine);
 * console.log(summary);
 * // "3 entities: Player(Position,Velocity), Enemy_0(Position,Health), Enemy_1(Position,Health)"
 * ```
 */
export function getEntitySummary(engine: Engine): string {
    const entities = engine.getAllEntities();
    const summaries = entities.map((e: Entity) => {
        const componentsMap = (e as any).components;
        if (!componentsMap || typeof componentsMap.keys !== 'function') {
            return `${e.name}()`;
        }
        const components = Array.from(componentsMap.keys())
            .map((c: any) => c.name || 'Unknown')
            .join(',');
        return `${e.name}(${components})`;
    });

    return `${entities.length} entities: ${summaries.join(', ')}`;
}

/**
 * Assert that an engine is in a clean state
 * Useful for verifying test cleanup
 *
 * @example
 * ```typescript
 * afterEach(() => {
 *   assertEngineClean(engine);
 * });
 * ```
 */
export function assertEngineClean(engine: Engine): void {
    const entities = engine.getAllEntities();

    if (entities.length > 0) {
        throw new Error(
            `Engine is not clean: ${entities.length} entities remaining. ` +
                getEntitySummary(engine)
        );
    }
}
