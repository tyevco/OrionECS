/**
 * Performance Regression Detection System
 *
 * This module provides utilities for detecting performance regressions
 * by comparing current benchmark results against stored baselines.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
    BaselineData,
    BenchmarkBudget,
    BudgetsConfig,
    ComparisonReport,
    ComparisonResult,
    ProcessedBenchmark,
    RawBenchmarkResults,
    RegressionConfig,
} from './types';

/**
 * Load and parse JSON file
 */
function loadJsonFile<T>(filePath: string): T {
    const absolutePath = path.resolve(filePath);
    const content = fs.readFileSync(absolutePath, 'utf-8');
    return JSON.parse(content) as T;
}

/**
 * Save JSON file with pretty formatting
 */
function saveJsonFile(filePath: string, data: unknown): void {
    const absolutePath = path.resolve(filePath);
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(absolutePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Process raw benchmark results into a normalized format
 */
export function processRawResults(raw: RawBenchmarkResults): Record<string, ProcessedBenchmark> {
    const processed: Record<string, ProcessedBenchmark> = {};

    for (const [suiteName, benchmarks] of Object.entries(raw)) {
        for (const [benchmarkName, result] of benchmarks) {
            const key = `${suiteName}::${benchmarkName}`;
            processed[key] = {
                name: benchmarkName,
                suite: suiteName,
                opsPerSecond: result.hz,
                meanMs: result.stats.mean * 1000, // Convert to milliseconds
                variance: result.stats.variance,
                rme: result.stats.rme,
                sampleCount: result.stats.sample.length,
                timestamp: result.times.timeStamp,
            };
        }
    }

    return processed;
}

/**
 * Get the category for a benchmark
 */
function getBenchmarkCategory(
    benchmarkName: string,
    config: BudgetsConfig
): 'critical' | 'important' | 'standard' {
    if (config.categories?.critical?.includes(benchmarkName)) return 'critical';
    if (config.categories?.important?.includes(benchmarkName)) return 'important';
    return 'standard';
}

/**
 * Get budget for a specific benchmark
 */
function getBudget(
    suite: string,
    benchmarkName: string,
    config: BudgetsConfig
): BenchmarkBudget | null {
    return config.budgets[suite]?.[benchmarkName] ?? null;
}

/**
 * Check if a benchmark violates its budget
 */
function checkBudgetViolations(
    benchmark: ProcessedBenchmark,
    budget: BenchmarkBudget | null
): string[] {
    const violations: string[] = [];

    if (!budget) return violations;

    if (budget.minOpsPerSecond !== undefined && benchmark.opsPerSecond < budget.minOpsPerSecond) {
        violations.push(
            `ops/sec ${benchmark.opsPerSecond.toFixed(2)} < minimum ${budget.minOpsPerSecond}`
        );
    }

    if (budget.maxMeanMs !== undefined && benchmark.meanMs > budget.maxMeanMs) {
        violations.push(`mean ${benchmark.meanMs.toFixed(2)}ms > maximum ${budget.maxMeanMs}ms`);
    }

    return violations;
}

/**
 * Compare a single benchmark against its baseline
 */
function compareBenchmark(
    key: string,
    current: ProcessedBenchmark | null,
    baseline: ProcessedBenchmark | null,
    config: BudgetsConfig
): ComparisonResult {
    const [suite, name] = key.split('::');
    const budget = getBudget(suite, name, config);
    const category = getBenchmarkCategory(name, config);
    const threshold = budget?.regressionThreshold ?? config.defaults.regressionThreshold;

    // Handle missing cases
    if (!current && baseline) {
        return {
            name,
            suite,
            status: 'missing',
            current: null,
            baseline,
            percentChange: null,
            absoluteChange: null,
            budgetViolations: [],
            threshold,
            category,
        };
    }

    if (current && !baseline) {
        const budgetViolations = checkBudgetViolations(current, budget);
        return {
            name,
            suite,
            status: budgetViolations.length > 0 ? 'budget_exceeded' : 'new',
            current,
            baseline: null,
            percentChange: null,
            absoluteChange: null,
            budgetViolations,
            threshold,
            category,
        };
    }

    if (!current || !baseline) {
        throw new Error(`Invalid state: both current and baseline are null for ${key}`);
    }

    // Calculate changes (using ops/sec - higher is better)
    const percentChange =
        ((current.opsPerSecond - baseline.opsPerSecond) / baseline.opsPerSecond) * 100;
    const absoluteChange = current.opsPerSecond - baseline.opsPerSecond;

    // Check budget violations
    const budgetViolations = checkBudgetViolations(current, budget);

    // Determine status
    let status: ComparisonResult['status'];
    if (budgetViolations.length > 0) {
        status = 'budget_exceeded';
    } else if (percentChange < -threshold) {
        status = 'regression';
    } else if (percentChange > config.defaults.improvementThreshold) {
        status = 'improvement';
    } else {
        status = 'pass';
    }

    return {
        name,
        suite,
        status,
        current,
        baseline,
        percentChange,
        absoluteChange,
        budgetViolations,
        threshold,
        category,
    };
}

/**
 * Generate a full comparison report
 */
export function generateComparisonReport(
    currentResults: Record<string, ProcessedBenchmark>,
    baseline: BaselineData,
    config: BudgetsConfig,
    currentRef: string
): ComparisonReport {
    const allKeys = new Set([...Object.keys(currentResults), ...Object.keys(baseline.benchmarks)]);

    const results: ComparisonResult[] = [];
    for (const key of allKeys) {
        const comparison = compareBenchmark(
            key,
            currentResults[key] ?? null,
            baseline.benchmarks[key] ?? null,
            config
        );
        results.push(comparison);
    }

    // Categorize results
    const critical = results.filter((r) => r.category === 'critical');
    const important = results.filter((r) => r.category === 'important');
    const standard = results.filter((r) => r.category === 'standard');

    // Calculate summary
    const summary = {
        total: results.length,
        passed: results.filter((r) => r.status === 'pass').length,
        regressions: results.filter((r) => r.status === 'regression').length,
        improvements: results.filter((r) => r.status === 'improvement').length,
        newBenchmarks: results.filter((r) => r.status === 'new').length,
        missing: results.filter((r) => r.status === 'missing').length,
        budgetExceeded: results.filter((r) => r.status === 'budget_exceeded').length,
    };

    // Determine recommendation
    const criticalRegressions = critical.filter(
        (r) => r.status === 'regression' || r.status === 'budget_exceeded'
    );
    const importantRegressions = important.filter(
        (r) => r.status === 'regression' || r.status === 'budget_exceeded'
    );

    let recommendation: ComparisonReport['recommendation'];
    let recommendationReason: string;

    if (criticalRegressions.length > 0) {
        recommendation = 'reject';
        recommendationReason = `${criticalRegressions.length} critical benchmark(s) regressed: ${criticalRegressions.map((r) => r.name).join(', ')}`;
    } else if (importantRegressions.length > 0) {
        recommendation = 'review';
        recommendationReason = `${importantRegressions.length} important benchmark(s) regressed - manual review recommended`;
    } else if (summary.regressions > 0 || summary.budgetExceeded > 0) {
        recommendation = 'review';
        recommendationReason = `${summary.regressions + summary.budgetExceeded} benchmark(s) need attention`;
    } else {
        recommendation = 'approve';
        recommendationReason = 'All benchmarks within acceptable thresholds';
    }

    return {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        baselineRef: baseline.gitRef,
        currentRef,
        summary,
        critical,
        important,
        standard,
        all: results,
        recommendation,
        recommendationReason,
    };
}

/**
 * Format a comparison result for console output
 */
function formatResult(result: ComparisonResult): string {
    const statusIcons: Record<ComparisonResult['status'], string> = {
        pass: '[PASS]',
        regression: '[REGR]',
        improvement: '[IMPR]',
        new: '[NEW] ',
        missing: '[MISS]',
        budget_exceeded: '[OVER]',
    };

    const icon = statusIcons[result.status];
    const change =
        result.percentChange !== null
            ? `${result.percentChange >= 0 ? '+' : ''}${result.percentChange.toFixed(2)}%`
            : 'N/A';

    const current = result.current ? `${result.current.opsPerSecond.toFixed(2)} ops/sec` : 'N/A';

    const baseline = result.baseline ? `${result.baseline.opsPerSecond.toFixed(2)} ops/sec` : 'N/A';

    let line = `${icon} ${result.name}`;
    line += `\n       Current: ${current} | Baseline: ${baseline} | Change: ${change}`;

    if (result.budgetViolations.length > 0) {
        line += `\n       Budget violations: ${result.budgetViolations.join(', ')}`;
    }

    return line;
}

/**
 * Print comparison report to console
 */
export function printReport(report: ComparisonReport, verbose = false): void {
    console.log('\n========================================');
    console.log('   PERFORMANCE REGRESSION REPORT');
    console.log('========================================\n');

    console.log(`Baseline: ${report.baselineRef}`);
    console.log(`Current:  ${report.currentRef}`);
    console.log(`Generated: ${report.generatedAt}\n`);

    console.log('--- SUMMARY ---');
    console.log(`Total benchmarks: ${report.summary.total}`);
    console.log(`  Passed:       ${report.summary.passed}`);
    console.log(`  Regressions:  ${report.summary.regressions}`);
    console.log(`  Improvements: ${report.summary.improvements}`);
    console.log(`  New:          ${report.summary.newBenchmarks}`);
    console.log(`  Missing:      ${report.summary.missing}`);
    console.log(`  Over budget:  ${report.summary.budgetExceeded}`);
    console.log('');

    // Always show regressions and budget exceeded
    const problems = report.all.filter(
        (r) => r.status === 'regression' || r.status === 'budget_exceeded'
    );
    if (problems.length > 0) {
        console.log('--- ISSUES ---');
        for (const result of problems) {
            console.log(formatResult(result));
        }
        console.log('');
    }

    // Show improvements
    const improvements = report.all.filter((r) => r.status === 'improvement');
    if (improvements.length > 0) {
        console.log('--- IMPROVEMENTS ---');
        for (const result of improvements) {
            console.log(formatResult(result));
        }
        console.log('');
    }

    // Show all results in verbose mode
    if (verbose) {
        console.log('--- ALL RESULTS ---');
        for (const result of report.all) {
            console.log(formatResult(result));
        }
        console.log('');
    }

    // Recommendation
    const recommendationColors: Record<ComparisonReport['recommendation'], string> = {
        approve: '\x1b[32m', // Green
        review: '\x1b[33m', // Yellow
        reject: '\x1b[31m', // Red
    };
    const resetColor = '\x1b[0m';

    console.log('--- RECOMMENDATION ---');
    console.log(
        `${recommendationColors[report.recommendation]}${report.recommendation.toUpperCase()}${resetColor}: ${report.recommendationReason}`
    );
    console.log('');
}

/**
 * Generate GitHub Actions markdown summary
 */
export function generateMarkdownSummary(report: ComparisonReport): string {
    const lines: string[] = [];

    lines.push('## Performance Regression Report');
    lines.push('');
    lines.push(`**Baseline:** \`${report.baselineRef}\` | **Current:** \`${report.currentRef}\``);
    lines.push('');

    // Summary table
    lines.push('### Summary');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total | ${report.summary.total} |`);
    lines.push(`| Passed | ${report.summary.passed} |`);
    lines.push(`| Regressions | ${report.summary.regressions} |`);
    lines.push(`| Improvements | ${report.summary.improvements} |`);
    lines.push(`| Over Budget | ${report.summary.budgetExceeded} |`);
    lines.push('');

    // Recommendation badge
    const badges: Record<ComparisonReport['recommendation'], string> = {
        approve: '![Approve](https://img.shields.io/badge/recommendation-approve-success)',
        review: '![Review](https://img.shields.io/badge/recommendation-review-yellow)',
        reject: '![Reject](https://img.shields.io/badge/recommendation-reject-critical)',
    };
    lines.push(`### Recommendation: ${badges[report.recommendation]}`);
    lines.push('');
    lines.push(`> ${report.recommendationReason}`);
    lines.push('');

    // Issues section
    const problems = report.all.filter(
        (r) => r.status === 'regression' || r.status === 'budget_exceeded'
    );
    if (problems.length > 0) {
        lines.push('### Issues Detected');
        lines.push('');
        lines.push('| Benchmark | Status | Current | Baseline | Change |');
        lines.push('|-----------|--------|---------|----------|--------|');
        for (const r of problems) {
            const current = r.current ? `${r.current.opsPerSecond.toFixed(2)} ops/s` : 'N/A';
            const baseline = r.baseline ? `${r.baseline.opsPerSecond.toFixed(2)} ops/s` : 'N/A';
            const change =
                r.percentChange !== null
                    ? `${r.percentChange >= 0 ? '+' : ''}${r.percentChange.toFixed(2)}%`
                    : 'N/A';
            const status = r.status === 'regression' ? ':x: Regression' : ':warning: Over Budget';
            lines.push(`| ${r.name} | ${status} | ${current} | ${baseline} | ${change} |`);
        }
        lines.push('');
    }

    // Improvements section
    const improvements = report.all.filter((r) => r.status === 'improvement');
    if (improvements.length > 0) {
        lines.push('<details>');
        lines.push('<summary>Improvements (' + improvements.length + ')</summary>');
        lines.push('');
        lines.push('| Benchmark | Current | Baseline | Change |');
        lines.push('|-----------|---------|----------|--------|');
        for (const r of improvements) {
            const current = r.current ? `${r.current.opsPerSecond.toFixed(2)} ops/s` : 'N/A';
            const baseline = r.baseline ? `${r.baseline.opsPerSecond.toFixed(2)} ops/s` : 'N/A';
            const change = r.percentChange !== null ? `+${r.percentChange.toFixed(2)}%` : 'N/A';
            lines.push(`| ${r.name} | ${current} | ${baseline} | ${change} |`);
        }
        lines.push('');
        lines.push('</details>');
        lines.push('');
    }

    // Full results
    lines.push('<details>');
    lines.push('<summary>All Results (' + report.all.length + ')</summary>');
    lines.push('');
    lines.push('| Benchmark | Status | Current | Baseline | Change |');
    lines.push('|-----------|--------|---------|----------|--------|');
    for (const r of report.all) {
        const current = r.current ? `${r.current.opsPerSecond.toFixed(2)} ops/s` : 'N/A';
        const baseline = r.baseline ? `${r.baseline.opsPerSecond.toFixed(2)} ops/s` : 'N/A';
        const change =
            r.percentChange !== null
                ? `${r.percentChange >= 0 ? '+' : ''}${r.percentChange.toFixed(2)}%`
                : 'N/A';
        const statusEmoji: Record<ComparisonResult['status'], string> = {
            pass: ':white_check_mark:',
            regression: ':x:',
            improvement: ':rocket:',
            new: ':new:',
            missing: ':grey_question:',
            budget_exceeded: ':warning:',
        };
        lines.push(
            `| ${r.name} | ${statusEmoji[r.status]} ${r.status} | ${current} | ${baseline} | ${change} |`
        );
    }
    lines.push('');
    lines.push('</details>');

    return lines.join('\n');
}

/**
 * Create a new baseline from current results
 */
export function createBaseline(
    results: Record<string, ProcessedBenchmark>,
    gitRef: string,
    gitCommit: string
): BaselineData {
    return {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        gitRef,
        gitCommit,
        nodeVersion: process.version,
        platform: process.platform,
        benchmarks: results,
    };
}

/**
 * Main regression detection function
 */
export async function runRegressionAnalysis(config: RegressionConfig): Promise<{
    report: ComparisonReport | null;
    exitCode: number;
}> {
    try {
        // Load configuration
        const budgets = loadJsonFile<BudgetsConfig>(config.budgetsPath);

        // Load current results
        const rawResults = loadJsonFile<RawBenchmarkResults>(config.resultsPath);
        const currentResults = processRawResults(rawResults);

        // Get git info
        const gitRef = process.env.GITHUB_REF || process.env.GIT_REF || 'unknown';
        const gitCommit = process.env.GITHUB_SHA || process.env.GIT_SHA || 'unknown';

        let baseline: BaselineData;

        // Check if we're doing a direct comparison (same-runner mode)
        if (config.baselineResultsPath) {
            if (!fs.existsSync(config.baselineResultsPath)) {
                console.log(`Baseline results file not found: ${config.baselineResultsPath}`);
                return { report: null, exitCode: 4 }; // NO_BASELINE
            }

            console.log('Using same-runner comparison mode (baseline results file provided)');
            console.log(`Baseline results: ${config.baselineResultsPath}`);
            console.log(`Current results: ${config.resultsPath}`);

            // Load and process baseline results directly from file
            const rawBaselineResults = loadJsonFile<RawBenchmarkResults>(
                config.baselineResultsPath
            );
            const baselineResults = processRawResults(rawBaselineResults);

            // Create a temporary baseline object for comparison
            baseline = {
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                gitRef: 'base-branch',
                gitCommit: 'same-runner-comparison',
                nodeVersion: process.version,
                platform: process.platform,
                benchmarks: baselineResults,
            };
        } else {
            // Traditional mode: use stored baseline file
            if (!fs.existsSync(config.baselinePath)) {
                console.log('No baseline found. Creating initial baseline...');

                if (config.updateBaseline) {
                    const newBaseline = createBaseline(currentResults, gitRef, gitCommit);
                    saveJsonFile(config.baselinePath, newBaseline);
                    console.log(`Baseline saved to ${config.baselinePath}`);
                } else {
                    console.log('Skipping baseline creation (--update-baseline not set)');
                }

                return { report: null, exitCode: 4 }; // NO_BASELINE
            }

            baseline = loadJsonFile<BaselineData>(config.baselinePath);
        }

        // Generate comparison report
        const report = generateComparisonReport(currentResults, baseline, budgets, gitRef);

        // Print report
        printReport(report, config.verbose);

        // Save markdown summary if output path specified
        if (config.outputPath) {
            const markdown = generateMarkdownSummary(report);
            const mdPath = config.outputPath.replace('.json', '.md');
            // Save markdown as text, not JSON
            const dir = path.dirname(mdPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(mdPath, markdown);
            saveJsonFile(config.outputPath, report);
            console.log(`Report saved to ${config.outputPath}`);
        }

        // Update baseline if requested (only in traditional mode)
        if (config.updateBaseline && !config.baselineResultsPath) {
            const newBaseline = createBaseline(currentResults, gitRef, gitCommit);
            saveJsonFile(config.baselinePath, newBaseline);
            console.log(`Baseline updated at ${config.baselinePath}`);
        }

        // Determine exit code
        let exitCode = 0;
        if (config.failOnRegression && report.summary.regressions > 0) {
            exitCode = 1;
        }
        if (config.failOnBudgetExceeded && report.summary.budgetExceeded > 0) {
            exitCode = 2;
        }
        if (report.recommendation === 'reject') {
            exitCode = 1;
        }

        return { report, exitCode };
    } catch (error) {
        console.error('Error running regression analysis:', error);
        return { report: null, exitCode: 3 };
    }
}
