#!/usr/bin/env node

/**
 * Comparative Benchmark CLI
 *
 * Command-line interface for running OrionECS comparative benchmarks.
 *
 * Usage:
 *   npx ts-node benchmarks/comparative/cli.ts [options]
 *
 * Options:
 *   --quick         Run quick benchmark suite (fewer scenarios)
 *   --full          Run full benchmark suite (default)
 *   --report        Generate reports only (from last run)
 *   --format        Output format: json, markdown, html, csv, all (default: all)
 *   --save-history  Save results to history (default: true in CI)
 *   --no-history    Don't save results to history
 *   --threshold     Regression threshold percentage (default: 10)
 *   --compare-baseline <path>  Path to baseline results file for same-runner comparison
 *   --current-results <path>   Path to current results file (for comparison mode)
 *   --help          Show help
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { OrionAdapter } from './adapters';
import {
    detectRegressions,
    detectRegressionsFromBaseline,
    getLatestResult,
    saveToHistory,
} from './history';
import { generateAllReports, printSummary, saveReport } from './reporter';
import { printResultsTable, runComparativeBenchmarks } from './runner';
import { allScenarios, quickScenarios } from './scenarios';
import type { ComparativeBenchmarkResults, ReportFormat } from './types';
import { DEFAULT_CONFIG } from './types';

interface CliOptions {
    quick: boolean;
    full: boolean;
    reportOnly: boolean;
    format: ReportFormat | 'all';
    saveHistory: boolean;
    threshold: number;
    help: boolean;
    /** Path to baseline results file for same-runner comparison */
    compareBaselinePath?: string;
    /** Path to current results file (for comparison mode) */
    currentResultsPath?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CliOptions {
    const args = process.argv.slice(2);
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

    const options: CliOptions = {
        quick: false,
        full: true,
        reportOnly: false,
        format: 'all',
        saveHistory: isCI, // Auto-save in CI
        threshold: 10,
        help: false,
        compareBaselinePath: undefined,
        currentResultsPath: undefined,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--quick':
            case '-q':
                options.quick = true;
                options.full = false;
                break;
            case '--full':
            case '-f':
                options.full = true;
                options.quick = false;
                break;
            case '--report':
            case '-r':
                options.reportOnly = true;
                break;
            case '--format':
                i++;
                if (args[i] && ['json', 'markdown', 'html', 'csv', 'all'].includes(args[i]!)) {
                    options.format = args[i]! as ReportFormat | 'all';
                }
                break;
            case '--save-history':
                options.saveHistory = true;
                break;
            case '--no-history':
                options.saveHistory = false;
                break;
            case '--threshold':
                i++;
                if (args[i]) {
                    options.threshold = parseFloat(args[i]!);
                }
                break;
            case '--compare-baseline':
                i++;
                if (args[i]) {
                    options.compareBaselinePath = path.resolve(process.cwd(), args[i]!);
                }
                break;
            case '--current-results':
                i++;
                if (args[i]) {
                    options.currentResultsPath = path.resolve(process.cwd(), args[i]!);
                }
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
        }
    }

    return options;
}

/**
 * Print help message
 */
function printHelp(): void {
    console.log(`
OrionECS Comparative Benchmark Suite
=====================================

Usage: npx ts-node benchmarks/comparative/cli.ts [options]

Options:
  --quick, -q       Run quick benchmark suite (fewer scenarios, faster)
  --full, -f        Run full benchmark suite (default)
  --report, -r      Generate reports only (uses last run results)
  --format <fmt>    Output format: json, markdown, html, csv, all (default: all)
  --save-history    Save results to history file
  --no-history      Don't save results to history
  --threshold <n>   Regression threshold percentage (default: 10)
  --compare-baseline <path>
                    Path to baseline results file for same-runner comparison.
                    When provided, compares against this file instead of history.
  --current-results <path>
                    Path to current results file (used with --compare-baseline)
  --help, -h        Show this help message

Examples:
  # Run full benchmarks and save to history
  npx ts-node benchmarks/comparative/cli.ts --save-history

  # Run quick benchmarks
  npx ts-node benchmarks/comparative/cli.ts --quick

  # Generate markdown report from last run
  npx ts-node benchmarks/comparative/cli.ts --report --format markdown

  # Same-runner comparison (recommended for CI)
  npx ts-node benchmarks/comparative/cli.ts \\
    --compare-baseline base-results.json \\
    --current-results current-results.json \\
    --threshold 15

Environment Variables:
  CI=true           Automatically saves to history
  GITHUB_SHA        Sets commit SHA in results
  GITHUB_REF_NAME   Sets branch name in results
`);
}

/**
 * Load results from a JSON file
 */
function loadResultsFromFile(filePath: string): ComparativeBenchmarkResults | null {
    try {
        if (!fs.existsSync(filePath)) {
            console.error(`Results file not found: ${filePath}`);
            return null;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as ComparativeBenchmarkResults;
    } catch (error) {
        console.error(`Failed to load results from ${filePath}:`, error);
        return null;
    }
}

/**
 * Run benchmarks
 */
async function runBenchmarks(options: CliOptions): Promise<ComparativeBenchmarkResults> {
    const scenarios = options.quick ? quickScenarios : allScenarios;

    console.log('');
    console.log(`Running ${options.quick ? 'QUICK' : 'FULL'} benchmark suite...`);
    console.log(`Scenarios: ${scenarios.length}`);
    console.log('');

    // Create adapters
    const adapters = [new OrionAdapter()];

    // Run benchmarks
    const results = await runComparativeBenchmarks(adapters, scenarios, {
        ...DEFAULT_CONFIG,
        measurementIterations: options.quick ? 20 : DEFAULT_CONFIG.measurementIterations,
        warmupIterations: options.quick ? 3 : DEFAULT_CONFIG.warmupIterations,
    });

    return results;
}

/**
 * Generate reports
 */
function generateReports(results: ComparativeBenchmarkResults, format: ReportFormat | 'all'): void {
    console.log('\nGenerating reports...');

    if (format === 'all') {
        const reports = generateAllReports(results);
        console.log('  JSON:     ' + reports.json);
        console.log('  Markdown: ' + reports.markdown);
        console.log('  HTML:     ' + reports.html);
        console.log('  CSV:      ' + reports.csv);
    } else {
        const reportPath = saveReport(results, format);
        console.log(`  ${format.toUpperCase()}: ${reportPath}`);
    }
}

/**
 * Check for regressions and exit with error if found
 */
function checkRegressions(results: ComparativeBenchmarkResults, threshold: number): boolean {
    const regressions = detectRegressionsFromBaseline(results, threshold);
    const significantRegressions = regressions.filter((r) => r.isSignificant);

    if (significantRegressions.length > 0) {
        console.log('\n⚠️  SIGNIFICANT PERFORMANCE REGRESSIONS DETECTED:');
        console.log('');
        for (const reg of significantRegressions) {
            console.log(`  - ${reg.scenario}: -${reg.regressionPercent.toFixed(1)}%`);
            console.log(
                `    (${reg.previousOps.toFixed(0)} → ${reg.currentOps.toFixed(0)} ops/sec)`
            );
        }
        console.log('');
        return true;
    }

    return false;
}

/**
 * Check for regressions comparing two result files directly
 */
function checkRegressionsFromFiles(
    current: ComparativeBenchmarkResults,
    baseline: ComparativeBenchmarkResults,
    threshold: number
): boolean {
    console.log('\n');
    console.log('============================================================');
    console.log('  SAME-RUNNER COMPARISON');
    console.log('============================================================');
    console.log('');
    console.log(`Baseline: ${baseline.commitSha || 'unknown'} (${baseline.branch || 'unknown'})`);
    console.log(`Current:  ${current.commitSha || 'unknown'} (${current.branch || 'unknown'})`);
    console.log(`Threshold: ${threshold}%`);
    console.log('');

    const regressions = detectRegressions(current, baseline, threshold);
    const significantRegressions = regressions.filter((r) => r.isSignificant);
    const improvements = regressions.filter((r) => r.regressionPercent < 0);

    // Print all comparisons
    console.log('--- BENCHMARK COMPARISON ---');
    console.log('');

    const currentOrion = current.libraries.find((l) => l.library === 'OrionECS');
    const baselineOrion = baseline.libraries.find((l) => l.library === 'OrionECS');

    if (currentOrion && baselineOrion) {
        for (const result of currentOrion.results) {
            if (!result.success) continue;

            const baseResult = baselineOrion.results.find((r) => r.scenario === result.scenario);
            if (!baseResult?.success) continue;

            const prevOps = baseResult.measurement.opsPerSecond;
            const currOps = result.measurement.opsPerSecond;
            const change = ((currOps - prevOps) / prevOps) * 100;

            let status = '[PASS]';
            if (change < -threshold) {
                status = '[REGR]';
            } else if (change > threshold) {
                status = '[IMPR]';
            }

            const changeStr = change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
            console.log(
                `${status} ${result.scenario}: ${prevOps.toFixed(0)} → ${currOps.toFixed(0)} ops/sec (${changeStr})`
            );
        }
    }

    console.log('');

    if (significantRegressions.length > 0) {
        console.log('⚠️  SIGNIFICANT REGRESSIONS DETECTED:');
        console.log('');
        for (const reg of significantRegressions) {
            console.log(`  - ${reg.scenario}: -${reg.regressionPercent.toFixed(1)}%`);
            console.log(
                `    (${reg.previousOps.toFixed(0)} → ${reg.currentOps.toFixed(0)} ops/sec)`
            );
        }
        console.log('');
        return true;
    }

    if (improvements.length > 0) {
        console.log('✅ IMPROVEMENTS:');
        for (const imp of improvements) {
            console.log(
                `  - ${imp.scenario}: +${Math.abs(imp.regressionPercent).toFixed(1)}% faster`
            );
        }
        console.log('');
    }

    console.log('✅ No significant regressions detected.');
    console.log('');
    return false;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
    const options = parseArgs();

    if (options.help) {
        printHelp();
        process.exit(0);
    }

    try {
        // Same-runner comparison mode
        if (options.compareBaselinePath && options.currentResultsPath) {
            console.log('Running same-runner comparison mode...');

            const baseline = loadResultsFromFile(options.compareBaselinePath);
            const current = loadResultsFromFile(options.currentResultsPath);

            if (!baseline || !current) {
                console.error('Failed to load result files for comparison.');
                process.exit(1);
            }

            const hasRegressions = checkRegressionsFromFiles(current, baseline, options.threshold);

            if (hasRegressions && process.env.CI === 'true') {
                console.log('\n❌ CI failing due to performance regressions.');
                process.exit(1);
            }

            console.log('\n✅ Comparison completed successfully.');
            process.exit(0);
        }

        let results: ComparativeBenchmarkResults;

        if (options.reportOnly) {
            // Get last results from history
            const lastResult = getLatestResult();
            if (!lastResult) {
                console.error('No benchmark results found. Run benchmarks first.');
                process.exit(1);
            }
            results = lastResult;
            console.log(`Using results from ${lastResult.timestamp}`);
        } else {
            // Run benchmarks
            results = await runBenchmarks(options);

            // Print results table
            printResultsTable(results);

            // Save to history if requested
            if (options.saveHistory) {
                console.log('\nSaving results to history...');
                saveToHistory(results);
            }
        }

        // Generate reports
        generateReports(results, options.format);

        // Print summary
        printSummary(results);

        // Check for regressions (fail CI if found)
        const hasRegressions = checkRegressions(results, options.threshold);

        if (hasRegressions && process.env.CI === 'true') {
            console.log('\n❌ CI failing due to performance regressions.');
            process.exit(1);
        }

        console.log('\n✅ Benchmark suite completed successfully.');
    } catch (error) {
        console.error('\n❌ Benchmark suite failed:', error);
        process.exit(1);
    }
}

// Run if executed directly
main();
