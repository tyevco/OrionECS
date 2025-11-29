---
"@orion-ecs/core": patch
---

Fix EventCallback type to preserve type information using generic constraints

The EventCallback type now uses `TArgs extends unknown[]` instead of `any[]` for arguments,
allowing callers to specify exact argument types while maintaining backward compatibility.
