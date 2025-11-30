# @orion-ecs/budgets

## 0.5.0

### Minor Changes

- [#322](https://github.com/tyevco/OrionECS/pull/322) [`c0f762a`](https://github.com/tyevco/OrionECS/commit/c0f762a6935e68bd7a09827ba690b4192022ca61) Thanks [@tyevco](https://github.com/tyevco)! - Add performance budgets & monitoring plugin

  New plugin for comprehensive performance budgeting and monitoring:

  - **Budget Types**: Time, memory, entity count, frame time, and query time budgets
  - **Enforcement Modes**: Warning (log), strict (throw), and adaptive (escalating responses)
  - **Real-time Monitoring**: Configurable check intervals with warning thresholds
  - **Event System**: Subscribe to violation, warning, and health events
  - **Dashboard Renderers**: Text, JSON, and HTML output formats
  - **Health Scoring**: Overall system health calculation (0-100)
  - **Production Telemetry**: Built-in support for metrics collection

### Patch Changes

- [#349](https://github.com/tyevco/OrionECS/pull/349) [`09dded1`](https://github.com/tyevco/OrionECS/commit/09dded18893412ed39bcebae37599bfda4f0a497) Thanks [@tyevco](https://github.com/tyevco)! - Add strict TypeScript configuration and defineComponent utility

  **Core Package (minor):**

  - Enable `noUncheckedIndexedAccess`, `noImplicitAny`, and `strictNullChecks` in TypeScript config
  - Add `defineComponent` utility for defining components with typed properties and defaults
  - Add ESLint/oxlint configuration for type safety rules
  - Add comprehensive plugin system integration tests

  **All Packages (patch):**

  - Fix type errors caused by `noUncheckedIndexedAccess` with non-null assertions
  - Ensure array access is type-safe in iteration loops

  **Breaking Changes:**

  - `noUncheckedIndexedAccess` may require code updates for array access patterns
