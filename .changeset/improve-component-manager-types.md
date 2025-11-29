---
"@orion-ecs/core": patch
---

Improve type safety for ComponentManager heterogeneous storage by updating `getComponentArray<T>` to use `ComponentIdentifier<T>` parameter and adding a new `getPool<T>` method for type-safe pool access
