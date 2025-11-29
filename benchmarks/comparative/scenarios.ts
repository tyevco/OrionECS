/**
 * Comparative Benchmark Scenarios
 *
 * Defines all benchmark scenarios for comparing ECS libraries.
 * Each scenario tests a specific aspect of ECS performance.
 */

import { measurePerformance } from './runner';
import type { BenchmarkConfig, BenchmarkMeasurement, BenchmarkScenario, EcsAdapter } from './types';

/**
 * Seeded random number generator for reproducible benchmarks
 * Note: Currently not used but available for future scenario extensions
 */
function _seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x7fffffff;
    };
}

// Initialize random generator for future use
const _random = _seededRandom(42);

/**
 * Entity Creation Benchmark
 * Tests how quickly the ECS can create entities with components
 */
export const entityCreationScenario: BenchmarkScenario = {
    id: 'entity-creation',
    name: 'Entity Creation (1000 entities)',
    description: 'Creates 1000 entities with Position and Velocity components',
    category: 'entity-creation',
    run: async (adapter: EcsAdapter, config: BenchmarkConfig): Promise<BenchmarkMeasurement> => {
        return measurePerformance(
            () => {
                adapter.initialize();
                adapter.createEntities(1000);
                adapter.cleanup();
            },
            config.measurementIterations,
            config.warmupIterations
        );
    },
};

/**
 * Bulk Entity Creation Benchmark
 * Tests entity creation at larger scale
 */
export const bulkEntityCreationScenario: BenchmarkScenario = {
    id: 'bulk-entity-creation',
    name: 'Bulk Entity Creation (5000 entities)',
    description: 'Creates 5000 entities with Position and Velocity components',
    category: 'entity-creation',
    run: async (adapter: EcsAdapter, config: BenchmarkConfig): Promise<BenchmarkMeasurement> => {
        return measurePerformance(
            () => {
                adapter.initialize();
                adapter.createEntities(5000);
                adapter.cleanup();
            },
            Math.floor(config.measurementIterations / 2),
            config.warmupIterations
        );
    },
};

/**
 * Component Addition Benchmark
 * Tests adding components to existing entities
 */
export const componentAdditionScenario: BenchmarkScenario = {
    id: 'component-addition',
    name: 'Component Addition',
    description: 'Adds Health component to all entities',
    category: 'component-operations',
    run: async (adapter: EcsAdapter, config: BenchmarkConfig): Promise<BenchmarkMeasurement> => {
        adapter.initialize();
        adapter.createEntities(1000);

        const measurement = await measurePerformance(
            () => {
                adapter.addComponentToAll();
                adapter.removeComponentFromAll();
            },
            config.measurementIterations,
            config.warmupIterations
        );

        adapter.cleanup();
        return measurement;
    },
};

/**
 * Simple Iteration Benchmark
 * Tests iterating over entities with a query
 */
export const simpleIterationScenario: BenchmarkScenario = {
    id: 'simple-iteration',
    name: 'Simple Iteration (1000 entities)',
    description: 'Iterates over 1000 entities with Position and Velocity, updating positions',
    category: 'iteration',
    run: async (adapter: EcsAdapter, config: BenchmarkConfig): Promise<BenchmarkMeasurement> => {
        adapter.initialize();
        adapter.createEntities(1000);

        const measurement = await measurePerformance(
            () => {
                adapter.iterateEntities();
            },
            config.measurementIterations,
            config.warmupIterations
        );

        adapter.cleanup();
        return measurement;
    },
};

/**
 * Large Scale Iteration Benchmark
 * Tests iteration performance with more entities
 */
export const largeIterationScenario: BenchmarkScenario = {
    id: 'large-iteration',
    name: 'Large Iteration (10000 entities)',
    description: 'Iterates over 10000 entities with Position and Velocity',
    category: 'iteration',
    run: async (adapter: EcsAdapter, config: BenchmarkConfig): Promise<BenchmarkMeasurement> => {
        adapter.initialize();
        adapter.createEntities(10000);

        const measurement = await measurePerformance(
            () => {
                adapter.iterateEntities();
            },
            Math.floor(config.measurementIterations / 2),
            config.warmupIterations
        );

        adapter.cleanup();
        return measurement;
    },
};

/**
 * Multi-System Execution Benchmark
 * Tests running multiple systems per frame
 */
export const multiSystemScenario: BenchmarkScenario = {
    id: 'multi-system',
    name: 'Multi-System Execution',
    description: 'Runs 3 systems over 1000 entities',
    category: 'systems',
    run: async (adapter: EcsAdapter, config: BenchmarkConfig): Promise<BenchmarkMeasurement> => {
        adapter.initialize();
        adapter.createEntities(1000);

        const measurement = await measurePerformance(
            () => {
                adapter.runSystems();
            },
            config.measurementIterations,
            config.warmupIterations
        );

        adapter.cleanup();
        return measurement;
    },
};

/**
 * Serialization Benchmark
 * Tests world state serialization
 */
export const serializationScenario: BenchmarkScenario = {
    id: 'serialization',
    name: 'World Serialization',
    description: 'Serializes world state with 500 entities',
    category: 'serialization',
    run: async (adapter: EcsAdapter, config: BenchmarkConfig): Promise<BenchmarkMeasurement> => {
        adapter.initialize();
        adapter.createEntities(500);

        const measurement = await measurePerformance(
            () => {
                adapter.serialize();
            },
            config.measurementIterations,
            config.warmupIterations
        );

        adapter.cleanup();
        return measurement;
    },
};

/**
 * Entity Lifecycle Benchmark
 * Tests create/destroy cycles
 */
export const entityLifecycleScenario: BenchmarkScenario = {
    id: 'entity-lifecycle',
    name: 'Entity Lifecycle',
    description: 'Tests entity creation and destruction cycles',
    category: 'entity-creation',
    run: async (adapter: EcsAdapter, config: BenchmarkConfig): Promise<BenchmarkMeasurement> => {
        return measurePerformance(
            () => {
                adapter.initialize();
                adapter.createEntities(100);
                adapter.cleanup();
            },
            config.measurementIterations,
            config.warmupIterations
        );
    },
};

/**
 * Memory Usage Benchmark
 * Tests memory consumption with many entities
 */
export const memoryBenchmarkScenario: BenchmarkScenario = {
    id: 'memory-usage',
    name: 'Memory Usage (10000 entities)',
    description: 'Measures memory usage with 10000 entities',
    category: 'memory',
    run: async (adapter: EcsAdapter, config: BenchmarkConfig): Promise<BenchmarkMeasurement> => {
        // Force GC before measurement
        if (global.gc) global.gc();

        const startMemory = process.memoryUsage().heapUsed;
        const times: number[] = [];

        for (let i = 0; i < config.measurementIterations; i++) {
            adapter.initialize();
            const start = performance.now();
            adapter.createEntities(10000);
            times.push(performance.now() - start);
            adapter.cleanup();
        }

        if (global.gc) global.gc();
        const endMemory = process.memoryUsage().heapUsed;

        const mean = times.reduce((a, b) => a + b, 0) / times.length;
        const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
        const stdDev = Math.sqrt(variance);

        return {
            opsPerSecond: 1000 / mean,
            meanTime: mean,
            stdDev,
            samples: times.length,
            marginOfError: (stdDev / Math.sqrt(times.length) / mean) * 100 * 1.96,
            memoryUsage: Math.max(0, endMemory - startMemory),
        };
    },
};

/**
 * Archetype Transition Benchmark
 * Tests adding/removing components (archetype changes)
 */
export const archetypeTransitionScenario: BenchmarkScenario = {
    id: 'archetype-transition',
    name: 'Archetype Transitions',
    description: 'Tests component add/remove causing archetype changes',
    category: 'component-operations',
    run: async (adapter: EcsAdapter, config: BenchmarkConfig): Promise<BenchmarkMeasurement> => {
        adapter.initialize();
        adapter.createEntities(1000);

        const measurement = await measurePerformance(
            () => {
                // Add components (transition to new archetype)
                adapter.addComponentToAll();
                // Remove components (transition back)
                adapter.removeComponentFromAll();
            },
            config.measurementIterations,
            config.warmupIterations
        );

        adapter.cleanup();
        return measurement;
    },
};

/**
 * All benchmark scenarios
 */
export const allScenarios: BenchmarkScenario[] = [
    entityCreationScenario,
    bulkEntityCreationScenario,
    componentAdditionScenario,
    simpleIterationScenario,
    largeIterationScenario,
    multiSystemScenario,
    serializationScenario,
    entityLifecycleScenario,
    memoryBenchmarkScenario,
    archetypeTransitionScenario,
];

/**
 * Get scenarios by category
 */
export function getScenariosByCategory(category: string): BenchmarkScenario[] {
    return allScenarios.filter((s) => s.category === category);
}

/**
 * Get scenario by ID
 */
export function getScenarioById(id: string): BenchmarkScenario | undefined {
    return allScenarios.find((s) => s.id === id);
}

/**
 * Quick scenarios for CI (faster execution)
 */
export const quickScenarios: BenchmarkScenario[] = [
    entityCreationScenario,
    simpleIterationScenario,
    multiSystemScenario,
    componentAdditionScenario,
];
