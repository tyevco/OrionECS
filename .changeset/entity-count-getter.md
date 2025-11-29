---
"@orion-ecs/core": minor
---

Add entityCount getter for efficient entity counting

New `engine.entityCount` getter provides O(1) access to the number of active entities without creating an intermediate array. More efficient than `engine.getAllEntities().length` for performance-sensitive code.
