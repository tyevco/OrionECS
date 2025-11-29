---
"@orion-ecs/core": patch
---

Fix mutable module-level state in MemoryEstimationConfig that was shared across engine instances

- Convert `MemoryEstimationConfig` from mutable object to immutable interface
- Add `DEFAULT_MEMORY_ESTIMATION_CONFIG` as frozen default configuration
- Add `createMemoryEstimationConfig()` factory for custom configurations
- Add `detectMemoryEnvironment()` for platform-specific auto-detection
- Move memory config to ArchetypeManager instance level for proper isolation
- Pass memory config from ArchetypeManager to Archetype instances

This ensures multiple Engine instances can operate independently without sharing global state.
