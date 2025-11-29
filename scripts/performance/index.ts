/**
 * Performance Regression Testing Module
 *
 * Provides utilities for detecting performance regressions in benchmark results.
 *
 * @example
 * ```typescript
 * import {
 *   runRegressionAnalysis,
 *   generateComparisonReport,
 *   createBaseline
 * } from './performance';
 *
 * // Run full regression analysis
 * const { report, exitCode } = await runRegressionAnalysis({
 *   budgetsPath: '.performance/budgets.json',
 *   baselinePath: '.performance/baseline.json',
 *   resultsPath: 'benchmarks/result.txt',
 * });
 * ```
 */

export {
    runRegressionAnalysis,
    generateComparisonReport,
    processRawResults,
    createBaseline,
    printReport,
    generateMarkdownSummary,
} from './regression-detector';

export type {
    BenchmarkStats,
    BenchmarkResult,
    RawBenchmarkResults,
    ProcessedBenchmark,
    BaselineData,
    BenchmarkBudget,
    BudgetsConfig,
    ComparisonResult,
    ComparisonReport,
    RegressionConfig,
    ExitCode,
} from './types';
