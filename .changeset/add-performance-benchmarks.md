---
"orion-ecs-monorepo": minor
---

Add comprehensive comparative benchmark suite for performance tracking and regression detection

- Add new comparative benchmark infrastructure with TypeScript types
- Implement 10 benchmark scenarios covering entity creation, iteration, systems, and memory
- Create performance history tracking with JSON storage
- Add multi-format report generation (JSON, Markdown, HTML, CSV)
- Build interactive dashboard with Chart.js visualizations
- Add GitHub Actions workflow for automated benchmark runs
- Include regression detection with configurable thresholds
- Add PR comment integration for benchmark results
- Update PERFORMANCE.md with methodology documentation

New commands:
- `npm run benchmark:comparative` - Run full benchmark suite
- `npm run benchmark:comparative:quick` - Run quick benchmarks
- `npm run benchmark:report` - Generate reports from last run
- `npm run benchmark:dashboard` - Generate interactive dashboard
