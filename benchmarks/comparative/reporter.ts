/**
 * Benchmark Results Reporter
 *
 * Generates reports in multiple formats: JSON, Markdown, HTML, CSV
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    calculateHistoricalStats,
    detectRegressionsFromBaseline,
    getScenarioHistory,
} from './history';
import type {
    ComparativeBenchmarkResults,
    PerformanceComparison,
    RegressionResult,
    ReportFormat,
} from './types';

const OUTPUT_DIR = path.join(__dirname, '..', 'reports');

/**
 * Ensures the output directory exists
 */
function ensureOutputDir(): void {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
}

/**
 * Generates performance comparisons between libraries
 */
export function generateComparisons(
    results: ComparativeBenchmarkResults,
    baselineLibrary: string = 'OrionECS'
): PerformanceComparison[] {
    const baseline = results.libraries.find((l) => l.library === baselineLibrary);
    if (!baseline) return [];

    const comparisons: PerformanceComparison[] = [];

    for (const baselineResult of baseline.results) {
        if (!baselineResult.success) continue;

        const comparison: PerformanceComparison = {
            scenario: baselineResult.scenario,
            baseline: baselineLibrary,
            comparisons: [],
        };

        for (const lib of results.libraries) {
            if (lib.library === baselineLibrary) continue;

            const libResult = lib.results.find((r) => r.scenario === baselineResult.scenario);
            if (!libResult || !libResult.success) continue;

            const baselineOps = baselineResult.measurement.opsPerSecond;
            const libOps = libResult.measurement.opsPerSecond;
            const ratio = libOps / baselineOps;
            const percentDiff = ((libOps - baselineOps) / baselineOps) * 100;

            comparison.comparisons.push({
                library: lib.library,
                ratio,
                percentDiff,
                baselineFaster: ratio < 1,
            });
        }

        comparisons.push(comparison);
    }

    return comparisons;
}

/**
 * Generates a JSON report
 */
export function generateJsonReport(results: ComparativeBenchmarkResults): string {
    const regressions = detectRegressionsFromBaseline(results);
    const comparisons = generateComparisons(results);

    return JSON.stringify(
        {
            ...results,
            analysis: {
                comparisons,
                regressions,
                summary: generateSummaryData(results, regressions),
            },
        },
        null,
        2
    );
}

/**
 * Generates summary data for reports
 */
function generateSummaryData(
    results: ComparativeBenchmarkResults,
    regressions: RegressionResult[]
): {
    totalScenarios: number;
    successfulScenarios: number;
    significantRegressions: number;
    overallHealth: 'healthy' | 'warning' | 'critical';
} {
    const orion = results.libraries.find((l) => l.library === 'OrionECS');
    const totalScenarios = orion?.results.length || 0;
    const successfulScenarios = orion?.results.filter((r) => r.success).length || 0;
    const significantRegressions = regressions.filter((r) => r.isSignificant).length;

    let overallHealth: 'healthy' | 'warning' | 'critical';
    if (significantRegressions === 0) {
        overallHealth = 'healthy';
    } else if (significantRegressions <= 2) {
        overallHealth = 'warning';
    } else {
        overallHealth = 'critical';
    }

    return {
        totalScenarios,
        successfulScenarios,
        significantRegressions,
        overallHealth,
    };
}

/**
 * Generates a Markdown report
 */
export function generateMarkdownReport(results: ComparativeBenchmarkResults): string {
    const regressions = detectRegressionsFromBaseline(results);
    const comparisons = generateComparisons(results);
    const summary = generateSummaryData(results, regressions);

    const lines: string[] = [];

    // Header
    lines.push('# OrionECS Performance Benchmark Report');
    lines.push('');
    lines.push(`**Run ID:** ${results.runId}`);
    lines.push(`**Commit:** ${results.commitSha}`);
    lines.push(`**Branch:** ${results.branch}`);
    lines.push(`**Date:** ${new Date(results.timestamp).toLocaleString()}`);
    lines.push(`**Node.js:** ${results.nodeVersion}`);
    lines.push(`**Platform:** ${results.platform.os} (${results.platform.arch})`);
    lines.push('');

    // Summary
    const healthEmoji =
        summary.overallHealth === 'healthy'
            ? '✅'
            : summary.overallHealth === 'warning'
              ? '⚠️'
              : '❌';
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Health | ${healthEmoji} ${summary.overallHealth.toUpperCase()} |`);
    lines.push(`| Total Scenarios | ${summary.totalScenarios} |`);
    lines.push(`| Successful | ${summary.successfulScenarios} |`);
    lines.push(`| Significant Regressions | ${summary.significantRegressions} |`);
    lines.push('');

    // Regression alerts
    if (regressions.length > 0) {
        lines.push('## Performance Regressions');
        lines.push('');
        lines.push('| Scenario | Previous | Current | Change |');
        lines.push('|----------|----------|---------|--------|');

        for (const reg of regressions) {
            const emoji = reg.isSignificant ? '🔴' : '🟡';
            lines.push(
                `| ${emoji} ${reg.scenario} | ${formatOps(reg.previousOps)} | ${formatOps(reg.currentOps)} | -${reg.regressionPercent.toFixed(1)}% |`
            );
        }
        lines.push('');
    }

    // Results table
    lines.push('## Benchmark Results');
    lines.push('');
    lines.push('### OrionECS Performance');
    lines.push('');

    const orion = results.libraries.find((l) => l.library === 'OrionECS');
    if (orion) {
        lines.push('| Scenario | Ops/sec | Mean Time | Std Dev | Margin |');
        lines.push('|----------|---------|-----------|---------|--------|');

        for (const result of orion.results) {
            if (result.success) {
                const m = result.measurement;
                lines.push(
                    `| ${result.scenario} | ${formatOps(m.opsPerSecond)} | ${m.meanTime.toFixed(2)}ms | ±${m.stdDev.toFixed(2)}ms | ±${m.marginOfError.toFixed(1)}% |`
                );
            } else {
                lines.push(`| ${result.scenario} | ❌ Failed | - | - | - |`);
            }
        }
        lines.push('');
    }

    // Comparative analysis
    if (comparisons.length > 0 && comparisons[0]!.comparisons.length > 0) {
        lines.push('## Comparative Analysis');
        lines.push('');
        lines.push(
            '| Scenario | ' + comparisons[0]!.comparisons.map((c) => c.library).join(' | ') + ' |'
        );
        lines.push(
            '|----------|' + comparisons[0]!.comparisons.map(() => '------').join('|') + '|'
        );

        for (const comp of comparisons) {
            let row = `| ${comp.scenario} |`;
            for (const c of comp.comparisons) {
                const emoji = c.baselineFaster ? '✅' : '❌';
                row += ` ${emoji} ${c.ratio.toFixed(2)}x |`;
            }
            lines.push(row);
        }
        lines.push('');
        lines.push('*Ratio < 1 means OrionECS is faster*');
        lines.push('');
    }

    // Historical trends (for OrionECS)
    lines.push('## Performance Trends');
    lines.push('');

    if (orion) {
        for (const result of orion.results.slice(0, 5)) {
            if (!result.success) continue;

            const history = getScenarioHistory('OrionECS', result.scenario, 10);
            const stats = calculateHistoricalStats(history);

            if (stats && history.dataPoints.length > 1) {
                const trend =
                    stats.latest > stats.mean ? '📈' : stats.latest < stats.mean ? '📉' : '➡️';
                lines.push(
                    `- **${result.scenario}**: ${trend} ${formatOps(stats.latest)} (avg: ${formatOps(stats.mean)}, range: ${formatOps(stats.min)}-${formatOps(stats.max)})`
                );
            }
        }
        lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push(`*Generated at ${new Date().toISOString()}*`);

    return lines.join('\n');
}

/**
 * Generates an HTML report with interactive charts
 */
export function generateHtmlReport(results: ComparativeBenchmarkResults): string {
    const regressions = detectRegressionsFromBaseline(results);
    const summary = generateSummaryData(results, regressions);
    const orion = results.libraries.find((l) => l.library === 'OrionECS');

    const chartData =
        orion?.results
            .filter((r) => r.success)
            .map((r) => ({
                scenario: r.scenario,
                opsPerSecond: r.measurement.opsPerSecond,
                meanTime: r.measurement.meanTime,
            })) || [];

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OrionECS Benchmark Report - ${results.commitSha.slice(0, 7)}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #58a6ff; margin-bottom: 1rem; }
    h2 { color: #8b949e; margin: 2rem 0 1rem; border-bottom: 1px solid #30363d; padding-bottom: 0.5rem; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }
    .summary-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 1rem;
      text-align: center;
    }
    .summary-card .value { font-size: 2rem; font-weight: bold; }
    .summary-card .label { color: #8b949e; font-size: 0.875rem; }
    .healthy { color: #3fb950; }
    .warning { color: #d29922; }
    .critical { color: #f85149; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #30363d; }
    th { background: #161b22; color: #8b949e; }
    tr:hover { background: #161b22; }
    .chart-container {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 1rem;
      margin: 1rem 0;
    }
    .meta { color: #8b949e; font-size: 0.875rem; margin-bottom: 2rem; }
    .meta span { margin-right: 1rem; }
    .regression-alert {
      background: #f8514926;
      border: 1px solid #f85149;
      border-radius: 6px;
      padding: 1rem;
      margin: 1rem 0;
    }
    .regression-alert h3 { color: #f85149; margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>OrionECS Performance Benchmark Report</h1>

    <div class="meta">
      <span><strong>Commit:</strong> ${results.commitSha.slice(0, 7)}</span>
      <span><strong>Branch:</strong> ${results.branch}</span>
      <span><strong>Date:</strong> ${new Date(results.timestamp).toLocaleString()}</span>
      <span><strong>Node:</strong> ${results.nodeVersion}</span>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="value ${summary.overallHealth}">${summary.overallHealth.toUpperCase()}</div>
        <div class="label">Overall Health</div>
      </div>
      <div class="summary-card">
        <div class="value">${summary.successfulScenarios}/${summary.totalScenarios}</div>
        <div class="label">Scenarios Passed</div>
      </div>
      <div class="summary-card">
        <div class="value ${summary.significantRegressions > 0 ? 'critical' : 'healthy'}">${summary.significantRegressions}</div>
        <div class="label">Regressions</div>
      </div>
      <div class="summary-card">
        <div class="value">${results.platform.cpus}</div>
        <div class="label">CPU Cores</div>
      </div>
    </div>

    ${
        regressions.filter((r) => r.isSignificant).length > 0
            ? `
    <div class="regression-alert">
      <h3>⚠️ Performance Regressions Detected</h3>
      <ul>
        ${regressions
            .filter((r) => r.isSignificant)
            .map(
                (r) => `
          <li><strong>${r.scenario}</strong>: -${r.regressionPercent.toFixed(1)}% (${formatOps(r.previousOps)} → ${formatOps(r.currentOps)})</li>
        `
            )
            .join('')}
      </ul>
    </div>
    `
            : ''
    }

    <h2>Performance Overview</h2>
    <div class="chart-container">
      <canvas id="opsChart"></canvas>
    </div>

    <h2>Detailed Results</h2>
    <table>
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Ops/sec</th>
          <th>Mean Time</th>
          <th>Std Dev</th>
          <th>Margin of Error</th>
        </tr>
      </thead>
      <tbody>
        ${
            orion?.results
                .map((r) =>
                    r.success
                        ? `
          <tr>
            <td>${r.scenario}</td>
            <td>${formatOps(r.measurement.opsPerSecond)}</td>
            <td>${r.measurement.meanTime.toFixed(2)}ms</td>
            <td>±${r.measurement.stdDev.toFixed(2)}ms</td>
            <td>±${r.measurement.marginOfError.toFixed(1)}%</td>
          </tr>
        `
                        : `
          <tr>
            <td>${r.scenario}</td>
            <td colspan="4" class="critical">Failed: ${r.error || 'Unknown error'}</td>
          </tr>
        `
                )
                .join('') || ''
        }
      </tbody>
    </table>

    <h2>Platform Information</h2>
    <table>
      <tr><td>Operating System</td><td>${results.platform.os}</td></tr>
      <tr><td>Architecture</td><td>${results.platform.arch}</td></tr>
      <tr><td>CPU Cores</td><td>${results.platform.cpus}</td></tr>
      <tr><td>Total Memory</td><td>${(results.platform.memory / 1024 / 1024 / 1024).toFixed(1)} GB</td></tr>
      <tr><td>Node.js Version</td><td>${results.nodeVersion}</td></tr>
    </table>
  </div>

  <script>
    const chartData = ${JSON.stringify(chartData)};

    new Chart(document.getElementById('opsChart'), {
      type: 'bar',
      data: {
        labels: chartData.map(d => d.scenario),
        datasets: [{
          label: 'Operations per Second',
          data: chartData.map(d => d.opsPerSecond),
          backgroundColor: 'rgba(88, 166, 255, 0.5)',
          borderColor: 'rgba(88, 166, 255, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Benchmark Performance (ops/sec)', color: '#c9d1d9' }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#30363d' },
            ticks: { color: '#8b949e' }
          },
          x: {
            grid: { color: '#30363d' },
            ticks: { color: '#8b949e' }
          }
        }
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Generates a CSV report
 */
export function generateCsvReport(results: ComparativeBenchmarkResults): string {
    const lines: string[] = ['library,scenario,opsPerSecond,meanTime,stdDev,marginOfError,success'];

    for (const lib of results.libraries) {
        for (const result of lib.results) {
            if (result.success) {
                const m = result.measurement;
                lines.push(
                    `${lib.library},${result.scenario},${m.opsPerSecond.toFixed(2)},${m.meanTime.toFixed(4)},${m.stdDev.toFixed(4)},${m.marginOfError.toFixed(2)},true`
                );
            } else {
                lines.push(`${lib.library},${result.scenario},0,0,0,0,false`);
            }
        }
    }

    return lines.join('\n');
}

/**
 * Helper to format ops/sec
 */
function formatOps(ops: number): string {
    if (ops >= 1000000) return `${(ops / 1000000).toFixed(1)}M`;
    if (ops >= 1000) return `${(ops / 1000).toFixed(1)}K`;
    return ops.toFixed(0);
}

/**
 * Saves a report to file
 */
export function saveReport(
    results: ComparativeBenchmarkResults,
    format: ReportFormat,
    filename?: string
): string {
    ensureOutputDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `benchmark-report-${timestamp}`;

    let content: string;
    let extension: string;

    switch (format) {
        case 'json':
            content = generateJsonReport(results);
            extension = 'json';
            break;
        case 'markdown':
            content = generateMarkdownReport(results);
            extension = 'md';
            break;
        case 'html':
            content = generateHtmlReport(results);
            extension = 'html';
            break;
        case 'csv':
            content = generateCsvReport(results);
            extension = 'csv';
            break;
    }

    const outputPath = path.join(OUTPUT_DIR, `${filename || defaultFilename}.${extension}`);
    fs.writeFileSync(outputPath, content);

    return outputPath;
}

/**
 * Generates all report formats
 */
export function generateAllReports(results: ComparativeBenchmarkResults): {
    json: string;
    markdown: string;
    html: string;
    csv: string;
} {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `benchmark-report-${timestamp}`;

    return {
        json: saveReport(results, 'json', baseFilename),
        markdown: saveReport(results, 'markdown', baseFilename),
        html: saveReport(results, 'html', baseFilename),
        csv: saveReport(results, 'csv', baseFilename),
    };
}

/**
 * Prints a summary to console
 */
export function printSummary(results: ComparativeBenchmarkResults): void {
    const regressions = detectRegressionsFromBaseline(results);
    const summary = generateSummaryData(results, regressions);

    console.log('\n');
    console.log('='.repeat(60));
    console.log('  BENCHMARK SUMMARY');
    console.log('='.repeat(60));
    console.log('');
    console.log(`  Health: ${summary.overallHealth.toUpperCase()}`);
    console.log(`  Scenarios: ${summary.successfulScenarios}/${summary.totalScenarios} passed`);
    console.log(`  Regressions: ${summary.significantRegressions} significant`);
    console.log('');

    if (regressions.filter((r) => r.isSignificant).length > 0) {
        console.log('  SIGNIFICANT REGRESSIONS:');
        for (const reg of regressions.filter((r) => r.isSignificant)) {
            console.log(`    - ${reg.scenario}: -${reg.regressionPercent.toFixed(1)}%`);
        }
        console.log('');
    }

    console.log('='.repeat(60));
}
