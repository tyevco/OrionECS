# @orion-ecs/state-machine

## 0.4.1

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

## 0.4.0

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
