---
"@orion-ecs/eslint-plugin-ecs": minor
---

Add TypeScript type-aware linting for cross-file component resolution

TypeScript Integration:
- Enable type-checking in ESLint rules via `project` option
- Resolve component types across files and packages
- Support for type aliases and renamed imports
- External package type resolution via TypeScript compiler API

Type Resolution Utilities:
- `resolveTypeInfo()`: Resolve types including imports and type aliases
- `resolveComponentType()`: Get component class from type references
- `isValidComponentClass()`: Validate component class structure
- Cross-file type tracking for dependency analysis

Enhanced Rules:
- Component-order rule now resolves imported component types
- Component-validator rule validates cross-file validators
- Support for components from external @orion-ecs packages
- Proper handling of re-exported types

This enables comprehensive validation of component dependencies and usage patterns even when components are defined in different files or external packages.
