---
"@orion-ecs/eslint-plugin-ecs": minor
---

Add core validation rules for ECS patterns

Component Order Rule:
- Validates component dependency ordering in prefabs and systems
- Ensures dependencies are added before dependents
- Detects circular dependencies between components
- Supports registerComponentValidator dependencies
- Works with prefab definitions and system queries

Component Validator Rule:
- Validates registerComponentValidator usage
- Ensures validator functions have correct signatures
- Detects missing or incorrect dependency specifications
- Validates component class references in validators
- Prevents common validation pattern mistakes

Query Validator Rule:
- Validates system query definitions (all, any, none)
- Ensures query arrays contain valid component references
- Detects duplicate components in queries
- Warns about conflicting query constraints
- Validates query structure and syntax

Usage-Based Detection:
- Automatically detects components from ECS API usage
- Tracks addComponent, getComponent, hasComponent calls
- No manual component registration required
- Cross-file component detection via imports
