/**
 * Types and interfaces for the comparative benchmark suite
 * Used for testing OrionECS against competing ECS libraries
 */

/**
 * Represents a single benchmark measurement
 */
export interface BenchmarkMeasurement {
    /** Operations per second */
    opsPerSecond: number;
    /** Mean time per operation in milliseconds */
    meanTime: number;
    /** Standard deviation in milliseconds */
    stdDev: number;
    /** Number of samples taken */
    samples: number;
    /** Margin of error as a percentage */
    marginOfError: number;
    /** Memory usage in bytes (if available) */
    memoryUsage?: number;
}

/**
 * Results from a single benchmark scenario
 */
export interface BenchmarkResult {
    /** Name of the benchmark scenario */
    scenario: string;
    /** Detailed measurement data */
    measurement: BenchmarkMeasurement;
    /** Whether this benchmark was successful */
    success: boolean;
    /** Error message if benchmark failed */
    error?: string;
}

/**
 * Results from benchmarking a single library
 */
export interface LibraryBenchmarkResults {
    /** Name of the ECS library */
    library: string;
    /** Version of the library */
    version: string;
    /** Results for each benchmark scenario */
    results: BenchmarkResult[];
    /** Total execution time in milliseconds */
    totalTime: number;
    /** Timestamp when benchmarks were run */
    timestamp: string;
}

/**
 * Complete comparative benchmark results
 */
export interface ComparativeBenchmarkResults {
    /** Unique run identifier */
    runId: string;
    /** Git commit SHA */
    commitSha: string;
    /** Git branch name */
    branch: string;
    /** Timestamp of the benchmark run */
    timestamp: string;
    /** Node.js version used */
    nodeVersion: string;
    /** Platform information */
    platform: {
        os: string;
        arch: string;
        cpus: number;
        memory: number;
    };
    /** Results for each library */
    libraries: LibraryBenchmarkResults[];
    /** Benchmark configuration */
    config: BenchmarkConfig;
}

/**
 * Configuration for benchmark runs
 */
export interface BenchmarkConfig {
    /** Number of iterations for warmup */
    warmupIterations: number;
    /** Number of measurement iterations */
    measurementIterations: number;
    /** Entity counts to test */
    entityCounts: number[];
    /** System counts to test */
    systemCounts: number[];
    /** Whether to run memory benchmarks */
    runMemoryBenchmarks: boolean;
    /** Timeout per benchmark in milliseconds */
    timeout: number;
}

/**
 * Performance comparison between libraries
 */
export interface PerformanceComparison {
    /** Scenario being compared */
    scenario: string;
    /** Baseline library (typically OrionECS) */
    baseline: string;
    /** Comparisons to other libraries */
    comparisons: {
        library: string;
        /** Ratio compared to baseline (>1 means baseline is faster) */
        ratio: number;
        /** Percentage difference */
        percentDiff: number;
        /** Whether baseline is faster */
        baselineFaster: boolean;
    }[];
}

/**
 * Historical performance data for tracking
 */
export interface PerformanceHistory {
    /** Library being tracked */
    library: string;
    /** Scenario being tracked */
    scenario: string;
    /** Historical data points */
    dataPoints: {
        commitSha: string;
        timestamp: string;
        opsPerSecond: number;
        meanTime: number;
    }[];
}

/**
 * Regression detection result
 */
export interface RegressionResult {
    /** Scenario that regressed */
    scenario: string;
    /** Previous ops/sec */
    previousOps: number;
    /** Current ops/sec */
    currentOps: number;
    /** Regression percentage */
    regressionPercent: number;
    /** Whether this is a significant regression */
    isSignificant: boolean;
    /** Threshold used for detection */
    threshold: number;
}

/**
 * Report format options
 */
export type ReportFormat = 'json' | 'markdown' | 'html' | 'csv';

/**
 * Interface for ECS library adapters
 */
export interface EcsAdapter {
    /** Name of the library */
    name: string;
    /** Version of the library */
    version: string;
    /** Initialize the library */
    initialize(): void;
    /** Clean up resources */
    cleanup(): void;
    /** Create entities with Position and Velocity components */
    createEntities(count: number): void;
    /** Add a component to all entities */
    addComponentToAll(): void;
    /** Remove a component from all entities */
    removeComponentFromAll(): void;
    /** Run a simple iteration query */
    iterateEntities(): number;
    /** Run multiple systems */
    runSystems(): void;
    /** Serialize world state */
    serialize(): string;
    /** Get entity count */
    getEntityCount(): number;
}

/**
 * Benchmark scenario definition
 */
export interface BenchmarkScenario {
    /** Unique scenario identifier */
    id: string;
    /** Human-readable name */
    name: string;
    /** Description of what this benchmark tests */
    description: string;
    /** Category for grouping */
    category: BenchmarkCategory;
    /** Function to run the benchmark */
    run: (adapter: EcsAdapter, config: BenchmarkConfig) => Promise<BenchmarkMeasurement>;
    /** Whether this scenario is supported by an adapter */
    isSupported?: (adapter: EcsAdapter) => boolean;
}

/**
 * Benchmark categories
 */
export type BenchmarkCategory =
    | 'entity-creation'
    | 'component-operations'
    | 'iteration'
    | 'queries'
    | 'systems'
    | 'serialization'
    | 'memory';

/**
 * Default benchmark configuration
 */
export const DEFAULT_CONFIG: BenchmarkConfig = {
    warmupIterations: 5,
    measurementIterations: 50,
    entityCounts: [1000, 5000, 10000],
    systemCounts: [1, 3, 5],
    runMemoryBenchmarks: true,
    timeout: 30000,
};

/**
 * Regression threshold as a percentage (10% regression = significant)
 */
export const REGRESSION_THRESHOLD = 10;

/**
 * Libraries to compare against OrionECS
 */
export const COMPETITOR_LIBRARIES = ['bitecs', 'ecsy', 'miniplex', 'becsy'] as const;

export type CompetitorLibrary = (typeof COMPETITOR_LIBRARIES)[number];
