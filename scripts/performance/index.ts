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
    createBaseline,
    generateComparisonReport,
    generateMarkdownSummary,
    printReport,
    processRawResults,
    runRegressionAnalysis,
} from './regression-detector';

export type {
    BaselineData,
    BenchmarkBudget,
    BenchmarkResult,
    BenchmarkStats,
    BudgetsConfig,
    ComparisonReport,
    ComparisonResult,
    ExitCode,
    ProcessedBenchmark,
    RawBenchmarkResults,
    RegressionConfig,
} from './types';
