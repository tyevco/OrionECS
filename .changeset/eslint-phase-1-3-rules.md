---
"@orion-ecs/eslint-plugin-ecs": minor
---

Add 15 new ESLint rules for ECS best practices (Phases 1-3)

Phase 1 - Critical Safety Rules:
- `no-query-in-act-callback`: Prevent expensive query creation inside system callbacks
- `use-command-buffer-in-system`: Require command buffer for entity operations in systems
- `subscription-cleanup-required`: Ensure plugin subscriptions are cleaned up in uninstall()

Phase 2 - Correctness Rules:
- `require-hasComponent-before-getComponent`: Require safety checks before component access
- `singleton-mark-dirty`: Ensure singletons call markComponentDirty() after modifications
- `no-async-in-system-callbacks`: Prevent async/await in system callbacks (breaks iteration)

Phase 3 - Best Practice Rules:
- `plugin-structure-validation`: Validate plugin class has name, version, and install()
- `system-priority-explicit`: Require explicit system priority values
- `component-lifecycle-complete`: Check onCreate/onDestroy callback pairing
- `no-magic-tag-strings`: Discourage inline tag strings, prefer constants
- `prefer-queueFree`: Prefer safe deferred deletion over immediate despawn
- `system-naming-convention`: Enforce consistent system naming patterns
- `plugin-logging-format`: Enforce structured logging in plugins
- `no-nested-transactions`: Prevent nested command buffer execution errors

Includes 227 comprehensive tests covering error cases, edge cases, and fix suggestions. Configured in both `recommended` and `strict` presets.
