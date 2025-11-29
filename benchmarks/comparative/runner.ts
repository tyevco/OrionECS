/**
 * Comparative Benchmark Runner
 * Executes benchmarks across different ECS libraries and collects results
 */

import * as os from 'node:os';
import {
    type BenchmarkConfig,
    type BenchmarkMeasurement,
    type BenchmarkResult,
    type BenchmarkScenario,
    type ComparativeBenchmarkResults,
    DEFAULT_CONFIG,
    type EcsAdapter,
    type LibraryBenchmarkResults,
} from './types';

/**
 * Generates a unique run ID
 */
function generateRunId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `bench-${timestamp}-${random}`;
}

/**
 * Gets git information from environment or defaults
 */
function getGitInfo(): { commitSha: string; branch: string } {
    return {
        commitSha: process.env.GITHUB_SHA || process.env.GIT_COMMIT || 'local',
        branch: process.env.GITHUB_REF_NAME || process.env.GIT_BRANCH || 'local',
    };
}

/**
 * Gets platform information
 */
function getPlatformInfo(): ComparativeBenchmarkResults['platform'] {
    return {
        os: `${os.platform()} ${os.release()}`,
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: os.totalmem(),
    };
}

/**
 * Runs a single measurement and calculates statistics
 */
export async function measurePerformance(
    fn: () => void | Promise<void>,
    iterations: number,
    warmupIterations: number
): Promise<BenchmarkMeasurement> {
    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
        await fn();
    }

    // Force garbage collection if available
    if (global.gc) {
        global.gc();
    }

    // Measurement phase
    const times: number[] = [];
    const startMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fn();
        const end = performance.now();
        times.push(end - start);
    }

    const endMemory = process.memoryUsage().heapUsed;

    // Calculate statistics
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    const standardError = stdDev / Math.sqrt(times.length);
    const marginOfError = (standardError / mean) * 100 * 1.96; // 95% confidence

    return {
        opsPerSecond: 1000 / mean,
        meanTime: mean,
        stdDev,
        samples: iterations,
        marginOfError,
        memoryUsage: endMemory - startMemory,
    };
}

/**
 * Runs a benchmark scenario for a single adapter
 */
async function runScenario(
    scenario: BenchmarkScenario,
    adapter: EcsAdapter,
    config: BenchmarkConfig
): Promise<BenchmarkResult> {
    try {
        // Check if scenario is supported
        if (scenario.isSupported && !scenario.isSupported(adapter)) {
            return {
                scenario: scenario.id,
                measurement: {
                    opsPerSecond: 0,
                    meanTime: 0,
                    stdDev: 0,
                    samples: 0,
                    marginOfError: 0,
                },
                success: false,
                error: `Scenario not supported by ${adapter.name}`,
            };
        }

        // Run the benchmark with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(
                () => reject(new Error(`Benchmark timeout after ${config.timeout}ms`)),
                config.timeout
            );
        });

        const measurement = await Promise.race([scenario.run(adapter, config), timeoutPromise]);

        return {
            scenario: scenario.id,
            measurement,
            success: true,
        };
    } catch (error) {
        return {
            scenario: scenario.id,
            measurement: {
                opsPerSecond: 0,
                meanTime: 0,
                stdDev: 0,
                samples: 0,
                marginOfError: 0,
            },
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Runs all benchmark scenarios for a single adapter
 */
export async function runLibraryBenchmarks(
    adapter: EcsAdapter,
    scenarios: BenchmarkScenario[],
    config: BenchmarkConfig,
    onProgress?: (scenario: string, index: number, total: number) => void
): Promise<LibraryBenchmarkResults> {
    const startTime = Date.now();
    const results: BenchmarkResult[] = [];

    for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];
        if (onProgress) {
            onProgress(scenario.name, i + 1, scenarios.length);
        }

        // Initialize adapter before each scenario
        adapter.initialize();

        try {
            const result = await runScenario(scenario, adapter, config);
            results.push(result);
        } finally {
            // Cleanup after each scenario
            adapter.cleanup();
        }
    }

    return {
        library: adapter.name,
        version: adapter.version,
        results,
        totalTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Main benchmark runner - runs all scenarios for all adapters
 */
export async function runComparativeBenchmarks(
    adapters: EcsAdapter[],
    scenarios: BenchmarkScenario[],
    config: BenchmarkConfig = { ...DEFAULT_CONFIG },
    onProgress?: (library: string, scenario: string) => void
): Promise<ComparativeBenchmarkResults> {
    const gitInfo = getGitInfo();
    const libraries: LibraryBenchmarkResults[] = [];

    console.log('');
    console.log('='.repeat(60));
    console.log('  OrionECS Comparative Benchmark Suite');
    console.log('='.repeat(60));
    console.log('');
    console.log(`Run ID: ${generateRunId()}`);
    console.log(`Commit: ${gitInfo.commitSha}`);
    console.log(`Branch: ${gitInfo.branch}`);
    console.log(`Node.js: ${process.version}`);
    console.log(`Platform: ${os.platform()} ${os.arch()}`);
    console.log(`CPUs: ${os.cpus().length} x ${os.cpus()[0]?.model || 'Unknown'}`);
    console.log('');

    for (const adapter of adapters) {
        console.log(`\nBenchmarking: ${adapter.name} v${adapter.version}`);
        console.log('-'.repeat(40));

        const results = await runLibraryBenchmarks(
            adapter,
            scenarios,
            config,
            (scenario, index, total) => {
                if (onProgress) {
                    onProgress(adapter.name, scenario);
                }
                console.log(`  [${index}/${total}] ${scenario}`);
            }
        );

        libraries.push(results);

        // Print summary for this library
        const successCount = results.results.filter((r) => r.success).length;
        console.log(`  Completed: ${successCount}/${results.results.length} scenarios`);
        console.log(`  Total time: ${(results.totalTime / 1000).toFixed(2)}s`);
    }

    return {
        runId: generateRunId(),
        commitSha: gitInfo.commitSha,
        branch: gitInfo.branch,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: getPlatformInfo(),
        libraries,
        config,
    };
}

/**
 * Formats benchmark results as a simple console table
 */
export function printResultsTable(results: ComparativeBenchmarkResults): void {
    console.log('\n');
    console.log('='.repeat(80));
    console.log('  BENCHMARK RESULTS');
    console.log('='.repeat(80));

    // Get all unique scenarios
    const scenarios = new Set<string>();
    for (const lib of results.libraries) {
        for (const result of lib.results) {
            scenarios.add(result.scenario);
        }
    }

    // Print header
    const libraries = results.libraries.map((l) => l.library);
    console.log('\n' + 'Scenario'.padEnd(35) + libraries.map((l) => l.padStart(15)).join(''));
    console.log('-'.repeat(35 + libraries.length * 15));

    // Print results for each scenario
    for (const scenario of Array.from(scenarios)) {
        let row = scenario.substring(0, 34).padEnd(35);

        for (const lib of results.libraries) {
            const result = lib.results.find((r) => r.scenario === scenario);
            if (result?.success) {
                const ops = result.measurement.opsPerSecond;
                const formatted = ops >= 1000 ? `${(ops / 1000).toFixed(1)}K` : ops.toFixed(0);
                row += `${formatted} ops/s`.padStart(15);
            } else {
                row += 'N/A'.padStart(15);
            }
        }

        console.log(row);
    }

    console.log('-'.repeat(35 + libraries.length * 15));
    console.log('');
}

/**
 * Export utility for creating measurement from timing data
 */
export function createMeasurement(times: number[], memoryUsage?: number): BenchmarkMeasurement {
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    const standardError = stdDev / Math.sqrt(times.length);
    const marginOfError = (standardError / mean) * 100 * 1.96;

    return {
        opsPerSecond: 1000 / mean,
        meanTime: mean,
        stdDev,
        samples: times.length,
        marginOfError,
        memoryUsage,
    };
}
