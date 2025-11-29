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
 *   --help          Show help
 */

import { OrionAdapter } from './adapters';
import { detectRegressionsFromBaseline, getLatestResult, saveToHistory } from './history';
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
                if (args[i] && ['json', 'markdown', 'html', 'csv', 'all'].includes(args[i])) {
                    options.format = args[i] as ReportFormat | 'all';
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
                    options.threshold = parseFloat(args[i]);
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
  --help, -h        Show this help message

Examples:
  # Run full benchmarks and save to history
  npx ts-node benchmarks/comparative/cli.ts --save-history

  # Run quick benchmarks
  npx ts-node benchmarks/comparative/cli.ts --quick

  # Generate markdown report from last run
  npx ts-node benchmarks/comparative/cli.ts --report --format markdown

Environment Variables:
  CI=true           Automatically saves to history
  GITHUB_SHA        Sets commit SHA in results
  GITHUB_REF_NAME   Sets branch name in results
`);
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
        const path = saveReport(results, format);
        console.log(`  ${format.toUpperCase()}: ${path}`);
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
 * Main entry point
 */
async function main(): Promise<void> {
    const options = parseArgs();

    if (options.help) {
        printHelp();
        process.exit(0);
    }

    try {
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
