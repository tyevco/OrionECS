---
"@orion-ecs/core": patch
"@orion-ecs/plugin-api": patch
"@orion-ecs/network": patch
---

Fix log injection vulnerability with centralized Logger

- Add Logger interface to @orion-ecs/plugin-api for secure, structured logging
- Create EngineLogger implementation with automatic sanitization of ANSI escape sequences and control characters
- Update NetworkPlugin to use centralized logger via PluginContext
- Plugins now import types from @orion-ecs/plugin-api for lighter dependencies
