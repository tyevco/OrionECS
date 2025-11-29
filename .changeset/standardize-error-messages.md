---
"@orion-ecs/core": patch
---

Standardize error message format using EngineLogger consistently

- Replace direct console.log/warn/error calls with EngineLogger methods
- Pass logger to CommandBuffer, ArchetypeManager, MessageBus, and EventEmitter
- Add setLogger() method to ComponentManager for archetype operations
- Update EngineBuilder to create logger before managers for consistent logging
- Fix logger isEnabled() method bug where debug messages were incorrectly filtered by minLevel
- Messages now use consistent [ECS] prefix via the logger
- Sub-components use tagged loggers (e.g., [Commands], [Archetype]) for easier filtering
