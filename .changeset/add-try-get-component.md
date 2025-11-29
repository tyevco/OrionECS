---
"@orion-ecs/core": minor
---

Add tryGetComponent method for null-safe component access

- Added `tryGetComponent` method to Entity that returns `T | null` instead of throwing
- Refactored `getComponent` to use `tryGetComponent` internally for cleaner code
- Enables safer component access patterns without needing hasComponent checks
