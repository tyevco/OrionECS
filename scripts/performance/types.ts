/**
 * Performance Regression Testing Type Definitions
 */

/**
 * Statistics from a single benchmark run
 */
export interface BenchmarkStats {
    mean: number;
    variance: number;
    moe: number; // Margin of error
    rme: number; // Relative margin of error
    sem: number; // Standard error of mean
    deviation: number;
    sample: number[];
}

/**
 * Complete benchmark result with timing info
 */
export interface BenchmarkResult {
    stats: BenchmarkStats;
    times: {
        cycle: number;
        elapsed: number;
        period: number;
        timeStamp: number;
    };
    count: number;
    cycles: number;
    hz: number; // Operations per second
}

/**
 * Raw benchmark results as stored in result.txt
 */
export type RawBenchmarkResults = Record<string, Array<[string, BenchmarkResult]>>;

/**
 * Processed benchmark data for comparison
 */
export interface ProcessedBenchmark {
    name: string;
    suite: string;
    opsPerSecond: number;
    meanMs: number;
    variance: number;
    rme: number;
    sampleCount: number;
    timestamp: number;
}

/**
 * Baseline benchmark data stored for comparison
 */
export interface BaselineData {
    version: string;
    generatedAt: string;
    gitRef: string;
    gitCommit: string;
    nodeVersion: string;
    platform: string;
    benchmarks: Record<string, ProcessedBenchmark>;
}

/**
 * Budget configuration for a single benchmark
 */
export interface BenchmarkBudget {
    minOpsPerSecond?: number;
    maxMeanMs?: number;
    regressionThreshold?: number;
    description?: string;
}

/**
 * Complete budgets configuration
 */
export interface BudgetsConfig {
    version: string;
    description?: string;
    defaults: {
        regressionThreshold: number;
        improvementThreshold: number;
        minSamples?: number;
        confidenceLevel?: number;
    };
    budgets: Record<string, Record<string, BenchmarkBudget>>;
    categories?: {
        critical?: string[];
        important?: string[];
        standard?: string[];
    };
}

/**
 * Result of comparing a single benchmark
 */
export interface ComparisonResult {
    name: string;
    suite: string;
    status: 'pass' | 'regression' | 'improvement' | 'new' | 'missing' | 'budget_exceeded';
    current: ProcessedBenchmark | null;
    baseline: ProcessedBenchmark | null;
    percentChange: number | null;
    absoluteChange: number | null;
    budgetViolations: string[];
    threshold: number;
    category: 'critical' | 'important' | 'standard';
}

/**
 * Overall comparison report
 */
export interface ComparisonReport {
    version: string;
    generatedAt: string;
    baselineRef: string;
    currentRef: string;
    summary: {
        total: number;
        passed: number;
        regressions: number;
        improvements: number;
        newBenchmarks: number;
        missing: number;
        budgetExceeded: number;
    };
    critical: ComparisonResult[];
    important: ComparisonResult[];
    standard: ComparisonResult[];
    all: ComparisonResult[];
    recommendation: 'approve' | 'review' | 'reject';
    recommendationReason: string;
}

/**
 * Configuration for running regression analysis
 */
export interface RegressionConfig {
    budgetsPath: string;
    baselinePath: string;
    resultsPath: string;
    /** Path to baseline results file for direct comparison (same-runner mode) */
    baselineResultsPath?: string;
    outputPath?: string;
    failOnRegression?: boolean;
    failOnBudgetExceeded?: boolean;
    updateBaseline?: boolean;
    verbose?: boolean;
}

/**
 * Exit codes for the regression script
 */
export enum ExitCode {
    SUCCESS = 0,
    REGRESSION_DETECTED = 1,
    BUDGET_EXCEEDED = 2,
    ERROR = 3,
    NO_BASELINE = 4,
}
