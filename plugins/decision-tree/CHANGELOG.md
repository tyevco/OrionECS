# @orion-ecs/decision-tree

## 1.0.0

### Minor Changes

- [#200](https://github.com/tyevco/OrionECS/pull/200) [`fbf0c8b`](https://github.com/tyevco/OrionECS/commit/fbf0c8bb5e762eea95695f436acc41d080f40b63) Thanks [@tyevco](https://github.com/tyevco)! - Add ECS-native Decision Tree plugin for AI decision making

  This plugin implements a decision tree system deeply integrated with ECS architecture:

  - **Decision trees decide WHAT** - add/remove components based on predicates
  - **ECS systems decide HOW** - execute behaviors based on component presence
  - **Intent = Component presence** - Chasing, Attacking, Patrolling are components

  Features:

  - PredicateRegistry with type accumulation (like EngineBuilder.use())
  - Type-safe predicate registration and validation
  - Fluent builder API for tree construction
  - JSON tree parsing for data-driven definitions
  - Built-in predicates (hasComponent, hasTag, random, etc.)
  - Debug tracing of decision paths

  Example: Pac-Man ghost AI with all 4 ghost personalities implemented as pure ECS

### Patch Changes

- Updated dependencies [[`f3bf00f`](https://github.com/tyevco/OrionECS/commit/f3bf00f132287784b6d890b362dfe8372515984f), [`a08f297`](https://github.com/tyevco/OrionECS/commit/a08f297abecb32287a11f682870df0d90b143da9), [`e4a40d8`](https://github.com/tyevco/OrionECS/commit/e4a40d8c192688f1c767a10e1089e939b3f95e39), [`5166280`](https://github.com/tyevco/OrionECS/commit/5166280830aafd2086e43d3902530475f1d61e68)]:
  - @orion-ecs/core@0.4.0
  - @orion-ecs/plugin-api@0.4.0
