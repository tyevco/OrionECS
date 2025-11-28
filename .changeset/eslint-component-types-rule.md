---
"@orion-ecs/eslint-plugin-ecs": minor
---

Add component-types ESLint rule for call-site validation

Validates that types used as components are data-only classes without logic:
- Detects methods, getters/setters, and arrow function properties
- Uses TypeScript type checker for accurate type resolution
- Works with external library types and type aliases
- Validates at all ECS API call sites (addComponent, getComponent, etc.)

Configurable Options:
- `allowedMethods`: Whitelist specific methods (default: clone, reset, toString, toJSON, valueOf)
- `excludePatterns`: Exclude specific type names from checking
- `checkExternalTypes`: Validate types from node_modules (default: false)

Coverage:
- Entity methods (addComponent, getComponent, hasComponent, removeComponent)
- System query definitions (all, any, none)
- Singleton operations (setSingleton, getSingleton)
- Prefab type definitions
- Fluent query builder (withAll, withAny, withNone)

Catches violations like using complex classes with business logic as components, enforcing the data-only component pattern.
