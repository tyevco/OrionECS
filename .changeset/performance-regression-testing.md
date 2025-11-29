---
"@orion-ecs/core": minor
---

Add automated performance regression testing system

New Features:
- Regression detection algorithm comparing benchmark results against stored baselines
- Configurable performance budgets with thresholds for each benchmark
- GitHub Actions workflow for automated testing on every PR
- CLI tool for local regression checking (`npm run perf:check`)
- Markdown report generation for PR comments
- Benchmark categorization (critical/important/standard) with different failure behaviors

Configuration:
- `.performance/budgets.json`: Define minimum ops/sec, maximum mean time, and custom thresholds
- `.performance/baseline.json`: Stored baseline metrics for comparison

Commands:
- `npm run perf:check`: Check for regressions against baseline
- `npm run perf:check:verbose`: Detailed regression output
- `npm run perf:update-baseline`: Update baseline after releases
- `npm run perf:report`: Generate full JSON/Markdown report

This enables catching performance degradations before they reach production and enforces
performance budgets across CI/CD pipelines.
