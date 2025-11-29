/**
 * Performance History Tracking System
 *
 * Stores, retrieves, and analyzes historical benchmark data
 * for performance regression detection.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ComparativeBenchmarkResults, PerformanceHistory, RegressionResult } from './types';

const HISTORY_DIR = path.join(__dirname, '..', 'history');
const HISTORY_FILE = path.join(HISTORY_DIR, 'benchmark-history.json');
const MAX_HISTORY_ENTRIES = 100;

/**
 * Structure of the history file
 */
interface HistoryData {
    version: string;
    lastUpdated: string;
    entries: ComparativeBenchmarkResults[];
}

/**
 * Ensures the history directory exists
 */
function ensureHistoryDir(): void {
    if (!fs.existsSync(HISTORY_DIR)) {
        fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }
}

/**
 * Loads the history file
 */
export function loadHistory(): HistoryData {
    ensureHistoryDir();

    if (!fs.existsSync(HISTORY_FILE)) {
        return {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            entries: [],
        };
    }

    try {
        const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
        return JSON.parse(data) as HistoryData;
    } catch (error) {
        console.warn('Failed to load history file, starting fresh:', error);
        return {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            entries: [],
        };
    }
}

/**
 * Saves benchmark results to history
 */
export function saveToHistory(results: ComparativeBenchmarkResults): void {
    const history = loadHistory();

    // Add new entry
    history.entries.push(results);

    // Trim to max entries
    if (history.entries.length > MAX_HISTORY_ENTRIES) {
        history.entries = history.entries.slice(-MAX_HISTORY_ENTRIES);
    }

    history.lastUpdated = new Date().toISOString();

    ensureHistoryDir();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

/**
 * Gets the most recent benchmark result
 */
export function getLatestResult(): ComparativeBenchmarkResults | undefined {
    const history = loadHistory();
    return history.entries[history.entries.length - 1];
}

/**
 * Gets benchmark results for a specific commit
 */
export function getResultByCommit(commitSha: string): ComparativeBenchmarkResults | undefined {
    const history = loadHistory();
    return history.entries.find((e) => e.commitSha === commitSha);
}

/**
 * Gets performance history for a specific scenario and library
 */
export function getScenarioHistory(
    library: string,
    scenario: string,
    limit: number = 50
): PerformanceHistory {
    const history = loadHistory();

    const dataPoints: PerformanceHistory['dataPoints'] = [];

    for (const entry of history.entries.slice(-limit)) {
        const libResult = entry.libraries.find((l) => l.library === library);
        if (!libResult) continue;

        const scenarioResult = libResult.results.find((r) => r.scenario === scenario);
        if (!scenarioResult || !scenarioResult.success) continue;

        dataPoints.push({
            commitSha: entry.commitSha,
            timestamp: entry.timestamp,
            opsPerSecond: scenarioResult.measurement.opsPerSecond,
            meanTime: scenarioResult.measurement.meanTime,
        });
    }

    return {
        library,
        scenario,
        dataPoints,
    };
}

/**
 * Detects performance regressions between two results
 */
export function detectRegressions(
    current: ComparativeBenchmarkResults,
    baseline: ComparativeBenchmarkResults,
    threshold: number = 10 // 10% regression threshold
): RegressionResult[] {
    const regressions: RegressionResult[] = [];

    // Compare OrionECS results
    const currentOrion = current.libraries.find((l) => l.library === 'OrionECS');
    const baselineOrion = baseline.libraries.find((l) => l.library === 'OrionECS');

    if (!currentOrion || !baselineOrion) {
        return regressions;
    }

    for (const currentResult of currentOrion.results) {
        if (!currentResult.success) continue;

        const baselineResult = baselineOrion.results.find(
            (r) => r.scenario === currentResult.scenario && r.success
        );
        if (!baselineResult) continue;

        const previousOps = baselineResult.measurement.opsPerSecond;
        const currentOps = currentResult.measurement.opsPerSecond;

        // Calculate regression percentage (negative means slower)
        const regressionPercent = ((previousOps - currentOps) / previousOps) * 100;

        const isSignificant = regressionPercent > threshold;

        if (regressionPercent > 0) {
            // Only record actual regressions (slower performance)
            regressions.push({
                scenario: currentResult.scenario,
                previousOps,
                currentOps,
                regressionPercent,
                isSignificant,
                threshold,
            });
        }
    }

    return regressions;
}

/**
 * Detects regressions against the baseline (first entry or main branch)
 */
export function detectRegressionsFromBaseline(
    results: ComparativeBenchmarkResults,
    threshold: number = 10
): RegressionResult[] {
    const history = loadHistory();

    // Find baseline (prefer main branch, fall back to first entry)
    const baseline =
        history.entries.find((e) => e.branch === 'main' || e.branch === 'master') ||
        history.entries[0];

    if (!baseline) {
        return [];
    }

    return detectRegressions(results, baseline, threshold);
}

/**
 * Gets performance trend (improvement/regression) over time
 */
export function getPerformanceTrend(
    library: string,
    scenario: string,
    windowSize: number = 10
): {
    trend: 'improving' | 'stable' | 'degrading';
    changePercent: number;
    dataPoints: number;
} {
    const historyData = getScenarioHistory(library, scenario, windowSize * 2);

    if (historyData.dataPoints.length < 2) {
        return { trend: 'stable', changePercent: 0, dataPoints: historyData.dataPoints.length };
    }

    const recent = historyData.dataPoints.slice(-windowSize);
    const previous = historyData.dataPoints.slice(-windowSize * 2, -windowSize);

    if (previous.length === 0) {
        return { trend: 'stable', changePercent: 0, dataPoints: historyData.dataPoints.length };
    }

    const recentAvg = recent.reduce((sum, d) => sum + d.opsPerSecond, 0) / recent.length;
    const previousAvg = previous.reduce((sum, d) => sum + d.opsPerSecond, 0) / previous.length;

    const changePercent = ((recentAvg - previousAvg) / previousAvg) * 100;

    let trend: 'improving' | 'stable' | 'degrading';
    if (changePercent > 5) {
        trend = 'improving';
    } else if (changePercent < -5) {
        trend = 'degrading';
    } else {
        trend = 'stable';
    }

    return {
        trend,
        changePercent,
        dataPoints: historyData.dataPoints.length,
    };
}

/**
 * Calculates statistics for historical data
 */
export function calculateHistoricalStats(history: PerformanceHistory): {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
    latest: number;
} | null {
    if (history.dataPoints.length === 0) {
        return null;
    }

    const values = history.dataPoints.map((d) => d.opsPerSecond);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const latest = values[values.length - 1];

    return { min, max, mean, stdDev, latest };
}

/**
 * Clears all history data
 */
export function clearHistory(): void {
    ensureHistoryDir();
    fs.writeFileSync(
        HISTORY_FILE,
        JSON.stringify(
            {
                version: '1.0.0',
                lastUpdated: new Date().toISOString(),
                entries: [],
            },
            null,
            2
        )
    );
}

/**
 * Exports history to a specific format
 */
export function exportHistory(format: 'json' | 'csv'): string {
    const history = loadHistory();

    if (format === 'json') {
        return JSON.stringify(history, null, 2);
    }

    // CSV export
    const lines: string[] = ['commit,timestamp,library,scenario,opsPerSecond,meanTime,stdDev'];

    for (const entry of history.entries) {
        for (const lib of entry.libraries) {
            for (const result of lib.results) {
                if (result.success) {
                    lines.push(
                        [
                            entry.commitSha,
                            entry.timestamp,
                            lib.library,
                            result.scenario,
                            result.measurement.opsPerSecond.toFixed(2),
                            result.measurement.meanTime.toFixed(4),
                            result.measurement.stdDev.toFixed(4),
                        ].join(',')
                    );
                }
            }
        }
    }

    return lines.join('\n');
}
