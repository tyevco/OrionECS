---
"@orion-ecs/core": patch
---

Improve type safety in SystemManager by replacing `System<any>[]` with `System<AnySystemTuple>[]` for heterogeneous system storage. This provides better type inference while maintaining flexibility for systems with different component requirements.
