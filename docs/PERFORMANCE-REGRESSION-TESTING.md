# Performance Regression Testing

This document describes the automated performance regression testing system for OrionECS. The system detects performance changes between commits and enforces performance budgets.

## Overview

The performance regression testing system:

1. **Runs benchmarks** automatically on every PR and push to main
2. **Compares results** against stored baseline metrics
3. **Detects regressions** when performance drops below thresholds
4. **Enforces budgets** for minimum acceptable performance
5. **Reports findings** via PR comments and GitHub Actions summaries

## Quick Start

### Running a Regression Check

```bash
# Run benchmarks first
npm run benchmark

# Check for regressions
npm run perf:check

# Verbose output with all details
npm run perf:check:verbose

# Generate a full report
npm run perf:report
```

### Updating the Baseline

After a release or intentional performance change:

```bash
# Run benchmarks and update baseline
npm run benchmark
npm run perf:update-baseline
```

## Architecture

### Directory Structure

```
.performance/
├── budgets.json        # Performance budgets configuration
├── budgets.schema.json # JSON schema for budgets
├── baseline.json       # Stored baseline metrics
└── reports/            # Generated reports (gitignored)

scripts/performance/
├── cli.ts              # Command-line interface
├── regression-detector.ts # Core regression detection
├── types.ts            # TypeScript type definitions
└── index.ts            # Module exports
```

### GitHub Actions Workflow

The `performance.yml` workflow:

1. **benchmark** job: Runs the full benchmark suite
2. **regression-check** job: Compares against baseline
3. **update-baseline** job: Updates baseline on main branch

## Configuration

### Performance Budgets (`.performance/budgets.json`)

Budgets define acceptable performance thresholds:

```json
{
  "defaults": {
    "regressionThreshold": 10,  // 10% slower = regression
    "improvementThreshold": 5    // 5% faster = improvement
  },
  "budgets": {
    "Enhanced ECS Performance Benchmarks": {
      "Entity Creation (1000 entities)": {
        "minOpsPerSecond": 180,   // Minimum acceptable ops/sec
        "maxMeanMs": 6,           // Maximum mean time in ms
        "regressionThreshold": 15, // Custom threshold for this test
        "description": "Core entity creation performance"
      }
    }
  },
  "categories": {
    "critical": ["Entity Creation (1000 entities)"],
    "important": ["Simple Query Performance (1000 entities)"],
    "standard": ["Tag Query Performance"]
  }
}
```

### Benchmark Categories

| Category | Description | Behavior |
|----------|-------------|----------|
| **critical** | Core ECS operations | Regressions block PRs |
| **important** | Key functionality | Regressions require review |
| **standard** | All other benchmarks | Regressions are reported |

## CLI Reference

### Commands

```bash
# Check for regressions (default mode)
npx ts-node scripts/performance/cli.ts --check

# Update baseline with current results
npx ts-node scripts/performance/cli.ts --update-baseline

# Options
--verbose, -v          Show detailed output
--output <path>        Save report to JSON/Markdown
--fail-on-regression   Exit with code 1 on regression
--fail-on-budget       Exit with code 2 on budget exceeded
--results <path>       Custom benchmark results path
--baseline <path>      Custom baseline path
--budgets <path>       Custom budgets config path
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - all benchmarks passed |
| 1 | Regression detected |
| 2 | Budget exceeded |
| 3 | Error occurred |
| 4 | No baseline found |

## Comparison Report

The system generates detailed reports:

```
========================================
   PERFORMANCE REGRESSION REPORT
========================================

Baseline: main
Current:  feature/new-system

--- SUMMARY ---
Total benchmarks: 12
  Passed:       10
  Regressions:  1
  Improvements: 1

--- ISSUES ---
[REGR] Entity Creation (1000 entities)
       Current: 180.5 ops/sec | Baseline: 220.4 ops/sec | Change: -18.11%

--- IMPROVEMENTS ---
[IMPR] Inter-System Messaging
       Current: 310.2 ops/sec | Baseline: 293.5 ops/sec | Change: +5.69%

--- RECOMMENDATION ---
REVIEW: 1 important benchmark(s) regressed - manual review recommended
```

## GitHub Integration

### PR Comments

Every PR receives an automatic comment with:
- Summary of benchmark results
- List of regressions and improvements
- Recommendation (approve/review/reject)

### Workflow Triggers

| Event | Behavior |
|-------|----------|
| Pull Request | Run benchmarks, compare, comment |
| Push to main | Run benchmarks, update baseline |
| Manual dispatch | Optional baseline update |

## Best Practices

### When to Update Baseline

Update the baseline when:
- Releasing a new version
- Intentionally accepting a performance trade-off
- Adding new benchmarks
- Fixing benchmark inconsistencies

### Investigating Regressions

1. **Check the report** for specific benchmarks affected
2. **Review changes** in the PR that might impact performance
3. **Run locally** with verbose output for details
4. **Profile the code** to identify bottlenecks
5. **Consider trade-offs** - some regressions may be acceptable

### Adding New Benchmarks

1. Add the benchmark to `benchmarks/benchmark.ts`
2. Run benchmarks: `npm run benchmark`
3. Add budget in `.performance/budgets.json`
4. Update baseline: `npm run perf:update-baseline`
5. Commit all changes together

## Troubleshooting

### "No baseline found"

Run `npm run perf:update-baseline` to create an initial baseline.

### Inconsistent Results

Benchmarks can vary between runs. The system accounts for this with:
- Statistical analysis (margin of error, RME)
- Configurable thresholds
- Multiple samples per benchmark

If results are too inconsistent:
- Run on consistent hardware (CI)
- Increase sample sizes in benchmarks
- Adjust thresholds in budgets.json

### CI Timeout

If benchmarks take too long:
- Reduce entity counts in non-critical benchmarks
- Split into multiple benchmark files
- Use Turborepo caching
