---
"@orion-ecs/state-machine": minor
---

Add ECS-native State Machine plugin for finite state machine functionality

- State as Component Presence: States are represented as components on entities, enabling natural ECS query patterns
- Type-safe Condition Factories: `when.hasComponent()`, `when.componentValue()`, `when.stateTime()`, etc.
- Type-accumulating Predicates: Register custom predicates with `.predicate()` method that accumulates types for full IDE support
- Declarative Transitions: Define transition rules with conditions, priorities, and wildcard source states
- Full ECS Integration: State changes emit events, support message-based triggers, and work with existing ECS queries
- StateMachineAPI: Engine extension providing `define()`, `transitionTo()`, `lock()`, `unlock()`, and more
- History Tracking: Optional state history for debugging
- Composite Conditions: Support for `and`, `or`, `not` condition combinators
