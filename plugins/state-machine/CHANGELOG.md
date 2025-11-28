# @orion-ecs/state-machine

## 1.0.0

### Minor Changes

- [#201](https://github.com/tyevco/OrionECS/pull/201) [`eb73b56`](https://github.com/tyevco/OrionECS/commit/eb73b564e98ab5b3172d7f65e3f3b59090b4e3dd) Thanks [@tyevco](https://github.com/tyevco)! - Add ECS-native State Machine plugin for finite state machine functionality

  - State as Component Presence: States are represented as components on entities, enabling natural ECS query patterns
  - Type-safe Condition Factories: `when.hasComponent()`, `when.componentValue()`, `when.stateTime()`, etc.
  - Type-accumulating Predicates: Register custom predicates with `.predicate()` method that accumulates types for full IDE support
  - Declarative Transitions: Define transition rules with conditions, priorities, and wildcard source states
  - Full ECS Integration: State changes emit events, support message-based triggers, and work with existing ECS queries
  - StateMachineAPI: Engine extension providing `define()`, `transitionTo()`, `lock()`, `unlock()`, and more
  - History Tracking: Optional state history for debugging
  - Composite Conditions: Support for `and`, `or`, `not` condition combinators

### Patch Changes

- Updated dependencies [[`f3bf00f`](https://github.com/tyevco/OrionECS/commit/f3bf00f132287784b6d890b362dfe8372515984f), [`a08f297`](https://github.com/tyevco/OrionECS/commit/a08f297abecb32287a11f682870df0d90b143da9), [`e4a40d8`](https://github.com/tyevco/OrionECS/commit/e4a40d8c192688f1c767a10e1089e939b3f95e39), [`5166280`](https://github.com/tyevco/OrionECS/commit/5166280830aafd2086e43d3902530475f1d61e68)]:
  - @orion-ecs/core@0.4.0
