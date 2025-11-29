/**
 * Benchmark Dashboard Generator
 *
 * Generates an interactive HTML dashboard with historical trends
 * and comparative analysis using Chart.js.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { calculateHistoricalStats, getScenarioHistory, loadHistory } from './history';
import type { ComparativeBenchmarkResults, PerformanceHistory } from './types';

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

/**
 * Generates the interactive dashboard HTML
 */
export function generateDashboard(): string {
    const history = loadHistory();
    const latestRun = history.entries[history.entries.length - 1];

    if (!latestRun) {
        return generateEmptyDashboard();
    }

    const orionResults = latestRun.libraries.find((l) => l.library === 'OrionECS');
    const scenarios = orionResults?.results.filter((r) => r.success).map((r) => r.scenario) || [];

    // Collect historical data for charts
    const historicalData: Record<string, PerformanceHistory> = {};
    for (const scenario of scenarios) {
        historicalData[scenario] = getScenarioHistory('OrionECS', scenario, 50);
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OrionECS Performance Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
  <style>
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --border: #30363d;
      --text-primary: #c9d1d9;
      --text-secondary: #8b949e;
      --accent-blue: #58a6ff;
      --accent-green: #3fb950;
      --accent-yellow: #d29922;
      --accent-red: #f85149;
      --accent-purple: #a371f7;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }

    header h1 {
      color: var(--accent-blue);
      font-size: 1.75rem;
    }

    .meta-info {
      display: flex;
      gap: 1.5rem;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .meta-info span {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .summary-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem;
      text-align: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .summary-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .summary-card .value {
      font-size: 2.5rem;
      font-weight: 700;
      line-height: 1.2;
    }

    .summary-card .label {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .summary-card .trend {
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .trend-up { color: var(--accent-green); }
    .trend-down { color: var(--accent-red); }
    .trend-stable { color: var(--text-secondary); }

    /* Section styling */
    .section {
      margin-bottom: 2rem;
    }

    .section h2 {
      color: var(--text-primary);
      font-size: 1.25rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    /* Charts */
    .chart-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 1.5rem;
    }

    .chart-container {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem;
    }

    .chart-container h3 {
      color: var(--text-primary);
      font-size: 1rem;
      margin-bottom: 1rem;
    }

    .chart-wrapper {
      position: relative;
      height: 300px;
    }

    /* Main overview chart */
    .main-chart {
      height: 400px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    th, td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    th {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.5px;
    }

    tr:hover {
      background: var(--bg-tertiary);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .status-healthy { background: rgba(63, 185, 80, 0.2); color: var(--accent-green); }
    .status-warning { background: rgba(210, 153, 34, 0.2); color: var(--accent-yellow); }
    .status-critical { background: rgba(248, 81, 73, 0.2); color: var(--accent-red); }

    /* Tabs */
    .tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.5rem;
    }

    .tab-button {
      background: none;
      border: none;
      color: var(--text-secondary);
      padding: 0.5rem 1rem;
      cursor: pointer;
      font-size: 0.875rem;
      border-radius: 4px;
      transition: background 0.2s, color 0.2s;
    }

    .tab-button:hover {
      background: var(--bg-tertiary);
    }

    .tab-button.active {
      background: var(--accent-blue);
      color: white;
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    /* Footer */
    footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-secondary);
      font-size: 0.875rem;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .container { padding: 1rem; }
      header { flex-direction: column; gap: 1rem; text-align: center; }
      .meta-info { flex-wrap: wrap; justify-content: center; }
      .chart-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>⚡ OrionECS Performance Dashboard</h1>
      <div class="meta-info">
        <span>📅 ${new Date(latestRun.timestamp).toLocaleDateString()}</span>
        <span>🔗 ${latestRun.commitSha.slice(0, 7)}</span>
        <span>🌿 ${latestRun.branch}</span>
        <span>📊 ${history.entries.length} runs</span>
      </div>
    </header>

    ${generateSummaryCards(latestRun, history.entries)}

    <div class="section">
      <h2>Performance Overview</h2>
      <div class="chart-container">
        <div class="chart-wrapper main-chart">
          <canvas id="overviewChart"></canvas>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Historical Trends</h2>
      <div class="tabs">
        ${scenarios
            .slice(0, 6)
            .map(
                (s, i) => `
          <button class="tab-button ${i === 0 ? 'active' : ''}" onclick="showTab('${s}')">${formatScenarioName(s)}</button>
        `
            )
            .join('')}
      </div>
      ${scenarios
          .slice(0, 6)
          .map(
              (s, i) => `
        <div id="tab-${s}" class="tab-content ${i === 0 ? 'active' : ''}">
          <div class="chart-container">
            <div class="chart-wrapper">
              <canvas id="trend-${s}"></canvas>
            </div>
          </div>
        </div>
      `
          )
          .join('')}
    </div>

    <div class="section">
      <h2>Detailed Results</h2>
      <div class="chart-container">
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Ops/sec</th>
              <th>Mean Time</th>
              <th>Std Dev</th>
              <th>Trend</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${generateResultsRows(orionResults?.results || [], historicalData)}
          </tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>Performance Distribution</h2>
      <div class="chart-grid">
        <div class="chart-container">
          <h3>Operations per Second by Category</h3>
          <div class="chart-wrapper">
            <canvas id="categoryChart"></canvas>
          </div>
        </div>
        <div class="chart-container">
          <h3>Execution Time Distribution</h3>
          <div class="chart-wrapper">
            <canvas id="timeChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <footer>
      <p>Generated by OrionECS Benchmark Suite • ${new Date().toISOString()}</p>
    </footer>
  </div>

  <script>
    // Chart.js configuration
    Chart.defaults.color = '#8b949e';
    Chart.defaults.borderColor = '#30363d';

    const chartColors = {
      blue: 'rgba(88, 166, 255, 0.8)',
      green: 'rgba(63, 185, 80, 0.8)',
      yellow: 'rgba(210, 153, 34, 0.8)',
      red: 'rgba(248, 81, 73, 0.8)',
      purple: 'rgba(163, 113, 247, 0.8)',
    };

    // Overview Chart
    const overviewData = ${JSON.stringify(
        orionResults?.results
            .filter((r) => r.success)
            .map((r) => ({
                scenario: r.scenario,
                opsPerSecond: r.measurement.opsPerSecond,
            })) || []
    )};

    new Chart(document.getElementById('overviewChart'), {
      type: 'bar',
      data: {
        labels: overviewData.map(d => d.scenario),
        datasets: [{
          label: 'Operations per Second',
          data: overviewData.map(d => d.opsPerSecond),
          backgroundColor: Object.values(chartColors),
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Current Benchmark Results (ops/sec)',
            color: '#c9d1d9',
            font: { size: 14 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#30363d' },
            ticks: {
              callback: function(value) {
                return value >= 1000 ? (value/1000).toFixed(0) + 'K' : value;
              }
            }
          },
          x: {
            grid: { display: false },
            ticks: { maxRotation: 45, minRotation: 45 }
          }
        }
      }
    });

    // Trend charts
    const historicalData = ${JSON.stringify(
        Object.fromEntries(
            scenarios.slice(0, 6).map((s) => [
                s,
                historicalData[s]?.dataPoints.map((d) => ({
                    x: d.timestamp,
                    y: d.opsPerSecond,
                })) || [],
            ])
        )
    )};

    Object.entries(historicalData).forEach(([scenario, data]) => {
      const canvas = document.getElementById('trend-' + scenario);
      if (canvas && data.length > 0) {
        new Chart(canvas, {
          type: 'line',
          data: {
            datasets: [{
              label: 'Ops/sec',
              data: data,
              borderColor: chartColors.blue,
              backgroundColor: 'rgba(88, 166, 255, 0.1)',
              fill: true,
              tension: 0.3,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                type: 'time',
                time: { unit: 'day' },
                grid: { color: '#30363d' }
              },
              y: {
                beginAtZero: false,
                grid: { color: '#30363d' }
              }
            },
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    });

    // Category Chart (pie/doughnut)
    const categoryData = overviewData.reduce((acc, d) => {
      const category = d.scenario.includes('creation') ? 'Creation' :
                       d.scenario.includes('iteration') ? 'Iteration' :
                       d.scenario.includes('system') ? 'Systems' :
                       d.scenario.includes('component') ? 'Components' : 'Other';
      acc[category] = (acc[category] || 0) + d.opsPerSecond;
      return acc;
    }, {});

    new Chart(document.getElementById('categoryChart'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(categoryData),
        datasets: [{
          data: Object.values(categoryData),
          backgroundColor: Object.values(chartColors),
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' }
        }
      }
    });

    // Time Distribution Chart
    const timeData = ${JSON.stringify(
        orionResults?.results
            .filter((r) => r.success)
            .map((r) => ({
                scenario: r.scenario,
                meanTime: r.measurement.meanTime,
                stdDev: r.measurement.stdDev,
            })) || []
    )};

    new Chart(document.getElementById('timeChart'), {
      type: 'bar',
      data: {
        labels: timeData.map(d => d.scenario),
        datasets: [{
          label: 'Mean Time (ms)',
          data: timeData.map(d => d.meanTime),
          backgroundColor: chartColors.green,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { color: '#30363d' } },
          y: { grid: { display: false } }
        }
      }
    });

    // Tab functionality
    function showTab(scenario) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-button').forEach(el => el.classList.remove('active'));
      document.getElementById('tab-' + scenario).classList.add('active');
      event.target.classList.add('active');
    }
  </script>
</body>
</html>`;
}

/**
 * Generates summary cards HTML
 */
function generateSummaryCards(
    latestRun: ComparativeBenchmarkResults,
    allRuns: ComparativeBenchmarkResults[]
): string {
    const orion = latestRun.libraries.find((l) => l.library === 'OrionECS');
    const successCount = orion?.results.filter((r) => r.success).length || 0;
    const totalCount = orion?.results.length || 0;

    // Calculate average ops/sec
    const avgOps =
        orion?.results
            .filter((r) => r.success)
            .reduce((sum, r) => sum + r.measurement.opsPerSecond, 0) || 0;
    const avgOpsFormatted = avgOps / successCount;

    // Compare to previous run
    let trendClass = 'trend-stable';
    let trendText = 'No previous data';
    if (allRuns.length > 1) {
        const prevRun = allRuns[allRuns.length - 2];
        const prevOrion = prevRun.libraries.find((l) => l.library === 'OrionECS');
        const prevAvg =
            prevOrion?.results
                .filter((r) => r.success)
                .reduce((sum, r) => sum + r.measurement.opsPerSecond, 0) || 0;
        const prevAvgCount = prevOrion?.results.filter((r) => r.success).length || 1;
        const prevAvgOps = prevAvg / prevAvgCount;

        const diff = ((avgOpsFormatted - prevAvgOps) / prevAvgOps) * 100;
        if (diff > 2) {
            trendClass = 'trend-up';
            trendText = `↑ ${diff.toFixed(1)}% from last`;
        } else if (diff < -2) {
            trendClass = 'trend-down';
            trendText = `↓ ${Math.abs(diff).toFixed(1)}% from last`;
        } else {
            trendText = 'Stable performance';
        }
    }

    return `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="value" style="color: var(--accent-blue)">
          ${formatNumber(avgOpsFormatted)}
        </div>
        <div class="label">Avg. Ops/sec</div>
        <div class="trend ${trendClass}">${trendText}</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color: var(--accent-green)">
          ${successCount}/${totalCount}
        </div>
        <div class="label">Scenarios Passed</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color: var(--accent-purple)">
          ${allRuns.length}
        </div>
        <div class="label">Total Benchmark Runs</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color: var(--accent-yellow)">
          ${latestRun.platform.cpus}
        </div>
        <div class="label">CPU Cores</div>
      </div>
    </div>
  `;
}

/**
 * Generates table rows for results
 */
function generateResultsRows(
    results: ComparativeBenchmarkResults['libraries'][0]['results'],
    historicalData: Record<string, PerformanceHistory>
): string {
    return results
        .map((r) => {
            if (!r.success) {
                return `
        <tr>
          <td>${r.scenario}</td>
          <td colspan="4" style="color: var(--accent-red)">Failed: ${r.error || 'Unknown error'}</td>
          <td><span class="status-badge status-critical">Failed</span></td>
        </tr>
      `;
            }

            const history = historicalData[r.scenario];
            const stats = calculateHistoricalStats(history);

            let trendHtml = '<span class="trend-stable">—</span>';
            let statusHtml = '<span class="status-badge status-healthy">Healthy</span>';

            if (stats && history.dataPoints.length > 1) {
                const change = ((stats.latest - stats.mean) / stats.mean) * 100;
                if (change > 5) {
                    trendHtml = `<span class="trend-up">↑ ${change.toFixed(1)}%</span>`;
                } else if (change < -5) {
                    trendHtml = `<span class="trend-down">↓ ${Math.abs(change).toFixed(1)}%</span>`;
                    if (change < -10) {
                        statusHtml = '<span class="status-badge status-critical">Regressed</span>';
                    } else {
                        statusHtml = '<span class="status-badge status-warning">Warning</span>';
                    }
                }
            }

            return `
      <tr>
        <td>${r.scenario}</td>
        <td>${formatNumber(r.measurement.opsPerSecond)}</td>
        <td>${r.measurement.meanTime.toFixed(2)}ms</td>
        <td>±${r.measurement.stdDev.toFixed(2)}ms</td>
        <td>${trendHtml}</td>
        <td>${statusHtml}</td>
      </tr>
    `;
        })
        .join('');
}

/**
 * Format scenario name for display
 */
function formatScenarioName(scenario: string): string {
    return scenario
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
        .substring(0, 15);
}

/**
 * Format large numbers
 */
function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
}

/**
 * Generate empty dashboard when no data exists
 */
function generateEmptyDashboard(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OrionECS Performance Dashboard</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      text-align: center;
    }
    .empty-state h1 { color: #58a6ff; margin-bottom: 1rem; }
    .empty-state p { color: #8b949e; }
    code { background: #161b22; padding: 0.5rem 1rem; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="empty-state">
    <h1>⚡ OrionECS Performance Dashboard</h1>
    <p>No benchmark data available yet.</p>
    <p style="margin-top: 1rem">Run benchmarks to populate the dashboard:</p>
    <code>npm run benchmark:comparative</code>
  </div>
</body>
</html>`;
}

/**
 * Save the dashboard to file
 */
export function saveDashboard(filename: string = 'dashboard.html'): string {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }

    const dashboard = generateDashboard();
    const outputPath = path.join(REPORTS_DIR, filename);
    fs.writeFileSync(outputPath, dashboard);

    return outputPath;
}

// CLI support
if (require.main === module) {
    console.log('Generating dashboard...');
    const path = saveDashboard();
    console.log(`Dashboard saved to: ${path}`);
}
