---
"@orion-ecs/decision-tree": minor
---

Add ECS-native Decision Tree plugin for AI decision making

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
