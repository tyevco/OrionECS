/**
 * Budget Dashboard Utilities for OrionECS
 *
 * Provides utilities for visualizing budget states, violations,
 * and performance metrics. Can be used to create custom dashboards
 * or integrate with existing debugging tools.
 *
 * @packageDocumentation
 * @module BudgetDashboard
 */

import type { BudgetState, BudgetSystemMetrics, BudgetViolation, DashboardData } from './types';

// =============================================================================
// Constants
// =============================================================================

const SEVERITY_COLORS = {
    low: '#ffc107',
    medium: '#fd7e14',
    high: '#dc3545',
    critical: '#721c24',
};

const STATUS_COLORS = {
    healthy: '#28a745',
    warning: '#ffc107',
    violated: '#dc3545',
};

const BUDGET_TYPE_ICONS = {
    time: '⏱️',
    memory: '💾',
    entityCount: '🎮',
    frameTime: '🖼️',
    queryTime: '🔍',
};

// =============================================================================
// Text-based Dashboard Renderer
// =============================================================================

/**
 * Renders budget data as a text-based dashboard for console output.
 *
 * @example
 * ```typescript
 * const dashboard = new TextDashboard();
 * const output = dashboard.render(engine.budgets.getDashboardData());
 * console.log(output);
 * ```
 */
export class TextDashboard {
    private width: number;

    constructor(width: number = 70) {
        this.width = width;
    }

    /**
     * Render the dashboard data as a string.
     *
     * @param data - Dashboard data to render
     * @returns Formatted string output
     */
    render(data: DashboardData): string {
        const lines: string[] = [];

        // Header
        lines.push(this.line('═'));
        lines.push(this.center('PERFORMANCE BUDGET DASHBOARD'));
        lines.push(this.line('═'));
        lines.push('');

        // Health Score
        lines.push(this.renderHealthScore(data.metrics));
        lines.push('');

        // Quick Stats
        lines.push(this.line('─'));
        lines.push(this.center('QUICK STATS'));
        lines.push(this.line('─'));
        lines.push(this.renderQuickStats(data.metrics));
        lines.push('');

        // Budget List
        lines.push(this.line('─'));
        lines.push(this.center('BUDGET STATUS'));
        lines.push(this.line('─'));
        lines.push(this.renderBudgetList(data.budgets));
        lines.push('');

        // Recent Violations
        if (data.recentViolations.length > 0) {
            lines.push(this.line('─'));
            lines.push(this.center('RECENT VIOLATIONS'));
            lines.push(this.line('─'));
            lines.push(this.renderViolations(data.recentViolations.slice(0, 5)));
            lines.push('');
        }

        // Footer
        lines.push(this.line('═'));
        lines.push(this.center(`Updated: ${new Date(data.timestamp).toLocaleTimeString()}`));
        lines.push(this.line('═'));

        return lines.join('\n');
    }

    private line(char: string): string {
        return char.repeat(this.width);
    }

    private center(text: string): string {
        const padding = Math.max(0, Math.floor((this.width - text.length) / 2));
        return ' '.repeat(padding) + text;
    }

    private renderHealthScore(metrics: BudgetSystemMetrics): string {
        const score = metrics.healthScore;
        const bars = 20;
        const filled = Math.round((score / 100) * bars);
        const bar = '█'.repeat(filled) + '░'.repeat(bars - filled);

        let status = 'HEALTHY';
        if (score < 50) status = 'CRITICAL';
        else if (score < 75) status = 'WARNING';

        return `  Health: [${bar}] ${score.toFixed(0)}% (${status})`;
    }

    private renderQuickStats(metrics: BudgetSystemMetrics): string {
        const lines: string[] = [];
        lines.push(`  Total Budgets: ${metrics.totalBudgets}`);
        lines.push(`  Violated: ${metrics.violatedBudgets} | Warning: ${metrics.warningBudgets}`);
        lines.push(`  Violations (total): ${metrics.totalViolations}`);
        lines.push(`  Violations (1min): ${metrics.violationsLastMinute}`);
        lines.push(`  Overhead: ${metrics.overheadMs.toFixed(3)}ms`);
        return lines.join('\n');
    }

    private renderBudgetList(budgets: BudgetState[]): string {
        if (budgets.length === 0) {
            return '  No budgets configured';
        }

        const lines: string[] = [];

        for (const budget of budgets) {
            const icon = BUDGET_TYPE_ICONS[budget.config.type];
            const status = budget.isViolated ? '❌' : budget.isWarning ? '⚠️ ' : '✅';
            const limit = this.getLimitValue(budget);
            const percentage = ((budget.currentValue / limit) * 100).toFixed(1);

            const name = budget.config.name.substring(0, 25).padEnd(25);
            const value = budget.currentValue.toFixed(2).padStart(10);
            const limitStr = limit.toFixed(2).padStart(10);

            lines.push(`  ${status} ${icon} ${name} ${value} / ${limitStr} (${percentage}%)`);
        }

        return lines.join('\n');
    }

    private renderViolations(violations: BudgetViolation[]): string {
        const lines: string[] = [];

        for (const v of violations) {
            const time = new Date(v.timestamp).toLocaleTimeString();
            const severity = v.severity.toUpperCase().padEnd(8);
            const name = v.budgetName.substring(0, 20).padEnd(20);
            const overage = ((v.overageRatio - 1) * 100).toFixed(1);

            lines.push(`  [${time}] ${severity} ${name} +${overage}% over budget`);
        }

        return lines.join('\n');
    }

    private getLimitValue(budget: BudgetState): number {
        const config = budget.config;
        switch (config.type) {
            case 'time':
                return config.maxTimeMs;
            case 'memory':
                return config.maxMemoryBytes;
            case 'entityCount':
                return config.maxEntities;
            case 'frameTime':
                return config.targetFrameTimeMs + (config.maxDeviationMs ?? 0);
            case 'queryTime':
                return config.maxTimeMs;
            default:
                return 0;
        }
    }
}

// =============================================================================
// JSON Dashboard Renderer
// =============================================================================

/**
 * Renders budget data as structured JSON for integration with external tools.
 *
 * @example
 * ```typescript
 * const renderer = new JsonDashboardRenderer();
 * const json = renderer.render(data);
 * fetch('/api/metrics', { method: 'POST', body: json });
 * ```
 */
export class JsonDashboardRenderer {
    /**
     * Render dashboard data as a JSON string.
     *
     * @param data - Dashboard data to render
     * @param pretty - Whether to format with indentation
     * @returns JSON string
     */
    render(data: DashboardData, pretty: boolean = false): string {
        const output = {
            timestamp: data.timestamp,
            metrics: data.metrics,
            budgets: data.budgets.map((b) => ({
                id: b.config.id,
                name: b.config.name,
                type: b.config.type,
                enabled: b.config.enabled,
                enforcementMode: b.config.enforcementMode,
                currentValue: b.currentValue,
                isViolated: b.isViolated,
                isWarning: b.isWarning,
                violationCount: b.violationStats.totalViolations,
                trend: b.violationStats.trend,
            })),
            recentViolations: data.recentViolations.map((v) => ({
                budgetId: v.budgetId,
                budgetName: v.budgetName,
                timestamp: v.timestamp,
                severity: v.severity,
                overageRatio: v.overageRatio,
                actualValue: v.actualValue,
                limitValue: v.limitValue,
            })),
        };

        return pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);
    }
}

// =============================================================================
// HTML Dashboard Renderer
// =============================================================================

/**
 * Renders budget data as HTML for web-based dashboards.
 *
 * @example
 * ```typescript
 * const renderer = new HtmlDashboardRenderer();
 * const html = renderer.render(data);
 * document.getElementById('dashboard').innerHTML = html;
 * ```
 */
export class HtmlDashboardRenderer {
    private includeStyles: boolean;

    constructor(includeStyles: boolean = true) {
        this.includeStyles = includeStyles;
    }

    /**
     * Render dashboard data as an HTML string.
     *
     * @param data - Dashboard data to render
     * @returns HTML string
     */
    render(data: DashboardData): string {
        const styles = this.includeStyles ? this.getStyles() : '';
        const healthColor = this.getHealthColor(data.metrics.healthScore);

        return `
<div class="budget-dashboard">
  ${styles}
  <div class="dashboard-header">
    <h2>Performance Budget Dashboard</h2>
    <div class="health-score" style="color: ${healthColor}">
      ${data.metrics.healthScore.toFixed(0)}%
    </div>
  </div>

  <div class="dashboard-stats">
    <div class="stat">
      <span class="stat-value">${data.metrics.totalBudgets}</span>
      <span class="stat-label">Total</span>
    </div>
    <div class="stat stat-violated">
      <span class="stat-value">${data.metrics.violatedBudgets}</span>
      <span class="stat-label">Violated</span>
    </div>
    <div class="stat stat-warning">
      <span class="stat-value">${data.metrics.warningBudgets}</span>
      <span class="stat-label">Warning</span>
    </div>
    <div class="stat">
      <span class="stat-value">${data.metrics.totalViolations}</span>
      <span class="stat-label">Violations</span>
    </div>
  </div>

  <div class="budget-list">
    ${data.budgets.map((b) => this.renderBudget(b)).join('')}
  </div>

  ${this.renderViolations(data.recentViolations)}

  <div class="dashboard-footer">
    Updated: ${new Date(data.timestamp).toLocaleTimeString()}
  </div>
</div>`;
    }

    private renderBudget(budget: BudgetState): string {
        const limit = this.getLimitValue(budget);
        const percentage = Math.min(100, (budget.currentValue / limit) * 100);
        const statusClass = budget.isViolated
            ? 'violated'
            : budget.isWarning
              ? 'warning'
              : 'healthy';
        const icon = BUDGET_TYPE_ICONS[budget.config.type];

        return `
<div class="budget-item ${statusClass}">
  <div class="budget-header">
    <span class="budget-icon">${icon}</span>
    <span class="budget-name">${budget.config.name}</span>
    <span class="budget-status">${budget.isViolated ? '❌' : budget.isWarning ? '⚠️' : '✅'}</span>
  </div>
  <div class="budget-progress">
    <div class="progress-bar" style="width: ${percentage}%"></div>
  </div>
  <div class="budget-values">
    <span>${budget.currentValue.toFixed(2)}</span>
    <span>/</span>
    <span>${limit.toFixed(2)}</span>
    <span>(${percentage.toFixed(1)}%)</span>
  </div>
</div>`;
    }

    private renderViolations(violations: BudgetViolation[]): string {
        if (violations.length === 0) return '';

        return `
<div class="violations-section">
  <h3>Recent Violations</h3>
  <ul class="violation-list">
    ${violations
        .slice(0, 5)
        .map(
            (v) => `
    <li class="violation-item severity-${v.severity}">
      <span class="violation-time">${new Date(v.timestamp).toLocaleTimeString()}</span>
      <span class="violation-name">${v.budgetName}</span>
      <span class="violation-severity">${v.severity}</span>
      <span class="violation-overage">+${((v.overageRatio - 1) * 100).toFixed(1)}%</span>
    </li>`
        )
        .join('')}
  </ul>
</div>`;
    }

    private getLimitValue(budget: BudgetState): number {
        const config = budget.config;
        switch (config.type) {
            case 'time':
                return config.maxTimeMs;
            case 'memory':
                return config.maxMemoryBytes;
            case 'entityCount':
                return config.maxEntities;
            case 'frameTime':
                return config.targetFrameTimeMs + (config.maxDeviationMs ?? 0);
            case 'queryTime':
                return config.maxTimeMs;
            default:
                return 0;
        }
    }

    private getHealthColor(score: number): string {
        if (score >= 75) return STATUS_COLORS.healthy;
        if (score >= 50) return STATUS_COLORS.warning;
        return STATUS_COLORS.violated;
    }

    private getStyles(): string {
        return `
<style>
.budget-dashboard {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e;
  color: #eaeaea;
  padding: 16px;
  border-radius: 8px;
  max-width: 400px;
}
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.dashboard-header h2 {
  margin: 0;
  font-size: 16px;
}
.health-score {
  font-size: 24px;
  font-weight: bold;
}
.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.stat {
  text-align: center;
  padding: 8px;
  background: #16213e;
  border-radius: 4px;
}
.stat-value {
  display: block;
  font-size: 20px;
  font-weight: bold;
}
.stat-label {
  font-size: 10px;
  opacity: 0.7;
}
.stat-violated .stat-value { color: ${STATUS_COLORS.violated}; }
.stat-warning .stat-value { color: ${STATUS_COLORS.warning}; }
.budget-item {
  background: #16213e;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 8px;
  border-left: 3px solid ${STATUS_COLORS.healthy};
}
.budget-item.warning { border-left-color: ${STATUS_COLORS.warning}; }
.budget-item.violated { border-left-color: ${STATUS_COLORS.violated}; }
.budget-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.budget-name { flex: 1; font-weight: 500; }
.budget-progress {
  height: 4px;
  background: #0f3460;
  border-radius: 2px;
  margin-bottom: 4px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: ${STATUS_COLORS.healthy};
  transition: width 0.3s;
}
.budget-item.warning .progress-bar { background: ${STATUS_COLORS.warning}; }
.budget-item.violated .progress-bar { background: ${STATUS_COLORS.violated}; }
.budget-values {
  font-size: 12px;
  opacity: 0.8;
  display: flex;
  gap: 4px;
}
.violations-section h3 {
  font-size: 14px;
  margin: 16px 0 8px;
}
.violation-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.violation-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: #16213e;
  border-radius: 4px;
  margin-bottom: 4px;
  font-size: 12px;
  align-items: center;
}
.violation-time { opacity: 0.7; }
.violation-name { flex: 1; }
.violation-severity {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  text-transform: uppercase;
}
.severity-low .violation-severity { background: ${SEVERITY_COLORS.low}; color: #000; }
.severity-medium .violation-severity { background: ${SEVERITY_COLORS.medium}; color: #000; }
.severity-high .violation-severity { background: ${SEVERITY_COLORS.high}; }
.severity-critical .violation-severity { background: ${SEVERITY_COLORS.critical}; }
.violation-overage { color: ${STATUS_COLORS.violated}; }
.dashboard-footer {
  margin-top: 16px;
  text-align: center;
  font-size: 11px;
  opacity: 0.5;
}
</style>`;
    }
}

// =============================================================================
// Budget Report Generator
// =============================================================================

/**
 * Generates detailed performance budget reports.
 *
 * @example
 * ```typescript
 * const generator = new BudgetReportGenerator();
 * const report = generator.generateReport(data);
 * console.log(report);
 * ```
 */
export class BudgetReportGenerator {
    /**
     * Generate a detailed text report.
     *
     * @param data - Dashboard data
     * @returns Formatted report string
     */
    generateReport(data: DashboardData): string {
        const lines: string[] = [];
        const now = new Date(data.timestamp);

        lines.push('═'.repeat(80));
        lines.push('                    PERFORMANCE BUDGET REPORT');
        lines.push('═'.repeat(80));
        lines.push('');
        lines.push(`Generated: ${now.toLocaleString()}`);
        lines.push('');

        // Executive Summary
        lines.push('─'.repeat(80));
        lines.push('EXECUTIVE SUMMARY');
        lines.push('─'.repeat(80));
        lines.push('');
        lines.push(this.generateSummary(data));
        lines.push('');

        // Detailed Budget Analysis
        lines.push('─'.repeat(80));
        lines.push('DETAILED BUDGET ANALYSIS');
        lines.push('─'.repeat(80));
        lines.push('');

        for (const budget of data.budgets) {
            lines.push(this.generateBudgetAnalysis(budget));
            lines.push('');
        }

        // Violation Analysis
        if (data.recentViolations.length > 0) {
            lines.push('─'.repeat(80));
            lines.push('VIOLATION ANALYSIS');
            lines.push('─'.repeat(80));
            lines.push('');
            lines.push(this.generateViolationAnalysis(data.recentViolations));
            lines.push('');
        }

        // Recommendations
        lines.push('─'.repeat(80));
        lines.push('RECOMMENDATIONS');
        lines.push('─'.repeat(80));
        lines.push('');
        lines.push(this.generateRecommendations(data));
        lines.push('');

        lines.push('═'.repeat(80));

        return lines.join('\n');
    }

    private generateSummary(data: DashboardData): string {
        const { metrics } = data;
        const lines: string[] = [];

        const healthStatus =
            metrics.healthScore >= 75
                ? 'HEALTHY'
                : metrics.healthScore >= 50
                  ? 'DEGRADED'
                  : 'CRITICAL';

        lines.push(`Overall Health: ${healthStatus} (${metrics.healthScore.toFixed(0)}%)`);
        lines.push('');
        lines.push(`  Active Budgets:     ${metrics.totalBudgets}`);
        lines.push(`  Budgets in Violation: ${metrics.violatedBudgets}`);
        lines.push(`  Budgets in Warning:   ${metrics.warningBudgets}`);
        lines.push(`  Total Violations:     ${metrics.totalViolations}`);
        lines.push(`  Monitoring Overhead:  ${metrics.overheadMs.toFixed(3)}ms`);

        return lines.join('\n');
    }

    private generateBudgetAnalysis(budget: BudgetState): string {
        const lines: string[] = [];
        const limit = this.getLimitValue(budget);
        const usage = (budget.currentValue / limit) * 100;

        lines.push(`[${budget.config.type.toUpperCase()}] ${budget.config.name}`);
        lines.push(
            `  Status: ${budget.isViolated ? 'VIOLATED' : budget.isWarning ? 'WARNING' : 'OK'}`
        );
        lines.push(`  Current Value: ${budget.currentValue.toFixed(2)}`);
        lines.push(`  Limit: ${limit.toFixed(2)}`);
        lines.push(`  Usage: ${usage.toFixed(1)}%`);
        lines.push(`  Enforcement: ${budget.config.enforcementMode}`);
        lines.push(`  Violations: ${budget.violationStats.totalViolations}`);
        lines.push(`  Trend: ${budget.violationStats.trend}`);

        return lines.join('\n');
    }

    private generateViolationAnalysis(violations: BudgetViolation[]): string {
        const lines: string[] = [];

        // Group by budget
        const byBudget = new Map<string, BudgetViolation[]>();
        for (const v of violations) {
            const existing = byBudget.get(v.budgetId) ?? [];
            existing.push(v);
            byBudget.set(v.budgetId, existing);
        }

        // Group by severity
        const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
        for (const v of violations) {
            bySeverity[v.severity]++;
        }

        lines.push(`Total Violations: ${violations.length}`);
        lines.push('');
        lines.push('By Severity:');
        lines.push(`  Critical: ${bySeverity.critical}`);
        lines.push(`  High: ${bySeverity.high}`);
        lines.push(`  Medium: ${bySeverity.medium}`);
        lines.push(`  Low: ${bySeverity.low}`);
        lines.push('');
        lines.push('By Budget:');

        for (const [_budgetId, budgetViolations] of byBudget) {
            if (budgetViolations.length === 0) continue;
            const name = budgetViolations[0]!.budgetName;
            const avgOverage =
                budgetViolations.reduce((sum, v) => sum + v.overageRatio, 0) /
                budgetViolations.length;
            lines.push(
                `  ${name}: ${budgetViolations.length} violations (avg ${((avgOverage - 1) * 100).toFixed(1)}% over)`
            );
        }

        return lines.join('\n');
    }

    private generateRecommendations(data: DashboardData): string {
        const recommendations: string[] = [];
        const { metrics, budgets, recentViolations } = data;

        // Health-based recommendations
        if (metrics.healthScore < 50) {
            recommendations.push(
                '• CRITICAL: Multiple budgets are in violation. Immediate optimization required.'
            );
        }

        // Violation-based recommendations
        const criticalViolations = recentViolations.filter((v) => v.severity === 'critical');
        if (criticalViolations.length > 0) {
            recommendations.push(
                `• ${criticalViolations.length} critical violation(s) detected. Review and optimize affected systems.`
            );
        }

        // Time budget recommendations
        const timeBudgets = budgets.filter((b) => b.config.type === 'time' && b.isViolated);
        if (timeBudgets.length > 0) {
            recommendations.push(
                '• Time budgets exceeded. Consider reducing system complexity or increasing budget limits.'
            );
        }

        // Entity count recommendations
        const entityBudgets = budgets.filter(
            (b) => b.config.type === 'entityCount' && b.isViolated
        );
        if (entityBudgets.length > 0) {
            recommendations.push(
                '• Entity count limits exceeded. Implement entity pooling or reduce spawn rates.'
            );
        }

        // Memory recommendations
        const memoryBudgets = budgets.filter((b) => b.config.type === 'memory' && b.isViolated);
        if (memoryBudgets.length > 0) {
            recommendations.push(
                '• Memory budgets exceeded. Check for memory leaks or implement object pooling.'
            );
        }

        // Overhead recommendation
        if (metrics.overheadMs > 1.0) {
            recommendations.push(
                '• Budget monitoring overhead is high. Consider reducing the number of active budgets.'
            );
        }

        if (recommendations.length === 0) {
            recommendations.push(
                '• All systems operating within budget limits. No immediate action required.'
            );
        }

        return recommendations.join('\n');
    }

    private getLimitValue(budget: BudgetState): number {
        const config = budget.config;
        switch (config.type) {
            case 'time':
                return config.maxTimeMs;
            case 'memory':
                return config.maxMemoryBytes;
            case 'entityCount':
                return config.maxEntities;
            case 'frameTime':
                return config.targetFrameTimeMs + (config.maxDeviationMs ?? 0);
            case 'queryTime':
                return config.maxTimeMs;
            default:
                return 0;
        }
    }
}

// =============================================================================
// Exports
// =============================================================================

export { SEVERITY_COLORS, STATUS_COLORS, BUDGET_TYPE_ICONS };
