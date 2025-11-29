---
"@orion-ecs/budgets": minor
---

Add performance budgets & monitoring plugin

New plugin for comprehensive performance budgeting and monitoring:

- **Budget Types**: Time, memory, entity count, frame time, and query time budgets
- **Enforcement Modes**: Warning (log), strict (throw), and adaptive (escalating responses)
- **Real-time Monitoring**: Configurable check intervals with warning thresholds
- **Event System**: Subscribe to violation, warning, and health events
- **Dashboard Renderers**: Text, JSON, and HTML output formats
- **Health Scoring**: Overall system health calculation (0-100)
- **Production Telemetry**: Built-in support for metrics collection
