---
"@orion-ecs/eslint-plugin-ecs": minor
---

Add 13 advanced ESLint rules for ECS patterns (Phases 4-8)

Phase 4 - Performance & Optimization Rules:
- `prefer-batch-operations`: Encourage `commands.spawnBatch()` for bulk entity creation
- `prefer-prefab-for-templates`: Suggest prefabs for repeated entity patterns
- `prefer-component-pooling`: Recommend pooling for frequently created components
- `query-specificity`: Ensure queries are specific and results are actually used

Phase 5 - Entity & Hierarchy Rules:
- `entity-unique-names`: Ensure entity names are unique for better debugging
- `hierarchy-cycle-prevention`: Detect and prevent cycles in parent-child hierarchies

Phase 6 - Advanced Plugin Rules:
- `plugin-dependency-validation`: Validate plugin dependencies exist before use
- `plugin-unbounded-collection`: Warn about unbounded collection growth in plugins
- `plugin-context-cleanup`: Ensure proper context/engine cleanup in plugin uninstall()

Phase 7 - Reactive Programming Rules:
- `mark-component-dirty`: Ensure `markComponentDirty()` is called after component modifications
- `use-watchComponents-filter`: Encourage filtered component watching for performance

Phase 8 - Type Safety & Physics Rules:
- `component-default-params`: Suggest default parameter values in component constructors
- `fixed-update-for-physics`: Require physics systems use `fixedUpdate` for determinism

All rules include:
- Comprehensive test coverage (217 new tests, 444 total passing)
- Fix suggestions where applicable
- Configurable severity levels
- Detailed documentation with examples

Brings total ESLint plugin rule count to 28 comprehensive rules for ECS development.
