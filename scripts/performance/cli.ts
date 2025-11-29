#!/usr/bin/env node
/**
 * Performance Regression CLI
 *
 * Command-line interface for running performance regression analysis.
 *
 * Usage:
 *   npx ts-node scripts/performance/cli.ts [options]
 *
 * Options:
 *   --check           Run regression check (default mode)
 *   --update-baseline Update the baseline with current results
 *   --fail-on-regression  Exit with error code on regression
 *   --fail-on-budget  Exit with error code on budget exceeded
 *   --verbose         Show detailed output
 *   --output <path>   Save report to specified path
 *   --results <path>  Path to benchmark results (default: benchmarks/result.txt)
 *   --baseline <path> Path to baseline file (default: .performance/baseline.json)
 *   --budgets <path>  Path to budgets config (default: .performance/budgets.json)
 */

import * as path from 'path';
import { runRegressionAnalysis } from './regression-detector';
import type { RegressionConfig } from './types';

function printUsage(): void {
    console.log(`
Performance Regression Testing CLI

Usage:
  npx ts-node scripts/performance/cli.ts [options]

Options:
  --check              Run regression check (default mode)
  --update-baseline    Update the baseline with current results
  --fail-on-regression Exit with error code on regression
  --fail-on-budget     Exit with error code on budget exceeded
  --verbose, -v        Show detailed output
  --output <path>      Save report to specified path
  --results <path>     Path to benchmark results
                       (default: benchmarks/result.txt)
  --baseline <path>    Path to baseline file
                       (default: .performance/baseline.json)
  --baseline-results <path>
                       Path to baseline results file for direct comparison.
                       Use this for same-runner comparisons in CI to avoid
                       hardware variance issues. When specified, this takes
                       precedence over the stored baseline file.
  --budgets <path>     Path to budgets config
                       (default: .performance/budgets.json)
  --help, -h           Show this help message

Examples:
  # Check for regressions
  npx ts-node scripts/performance/cli.ts --check

  # Update baseline after a release
  npx ts-node scripts/performance/cli.ts --update-baseline

  # CI check with failure on regression
  npx ts-node scripts/performance/cli.ts --fail-on-regression --output report.json

  # Same-runner comparison (recommended for CI)
  npx ts-node scripts/performance/cli.ts --results current.txt --baseline-results base.txt
`);
}

function parseArgs(args: string[]): {
    config: RegressionConfig;
    showHelp: boolean;
} {
    const config: RegressionConfig = {
        budgetsPath: path.resolve(process.cwd(), '.performance/budgets.json'),
        baselinePath: path.resolve(process.cwd(), '.performance/baseline.json'),
        resultsPath: path.resolve(process.cwd(), 'benchmarks/result.txt'),
        baselineResultsPath: undefined,
        outputPath: undefined,
        failOnRegression: false,
        failOnBudgetExceeded: false,
        updateBaseline: false,
        verbose: false,
    };

    let showHelp = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--help':
            case '-h':
                showHelp = true;
                break;

            case '--check':
                // Default mode, no action needed
                break;

            case '--update-baseline':
                config.updateBaseline = true;
                break;

            case '--fail-on-regression':
                config.failOnRegression = true;
                break;

            case '--fail-on-budget':
                config.failOnBudgetExceeded = true;
                break;

            case '--verbose':
            case '-v':
                config.verbose = true;
                break;

            case '--output':
                i++;
                if (i < args.length) {
                    config.outputPath = path.resolve(process.cwd(), args[i]);
                } else {
                    console.error('Error: --output requires a path argument');
                    process.exit(3);
                }
                break;

            case '--results':
                i++;
                if (i < args.length) {
                    config.resultsPath = path.resolve(process.cwd(), args[i]);
                } else {
                    console.error('Error: --results requires a path argument');
                    process.exit(3);
                }
                break;

            case '--baseline':
                i++;
                if (i < args.length) {
                    config.baselinePath = path.resolve(process.cwd(), args[i]);
                } else {
                    console.error('Error: --baseline requires a path argument');
                    process.exit(3);
                }
                break;

            case '--baseline-results':
                i++;
                if (i < args.length) {
                    config.baselineResultsPath = path.resolve(process.cwd(), args[i]);
                } else {
                    console.error('Error: --baseline-results requires a path argument');
                    process.exit(3);
                }
                break;

            case '--budgets':
                i++;
                if (i < args.length) {
                    config.budgetsPath = path.resolve(process.cwd(), args[i]);
                } else {
                    console.error('Error: --budgets requires a path argument');
                    process.exit(3);
                }
                break;

            default:
                if (arg.startsWith('-')) {
                    console.error(`Unknown option: ${arg}`);
                    showHelp = true;
                }
        }
    }

    return { config, showHelp };
}

async function main(): Promise<void> {
    const { config, showHelp } = parseArgs(process.argv.slice(2));

    if (showHelp) {
        printUsage();
        process.exit(0);
    }

    console.log('OrionECS Performance Regression Testing');
    console.log('========================================\n');

    const { exitCode } = await runRegressionAnalysis(config);
    process.exit(exitCode);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(3);
});
