---
"@orion-ecs/core": minor
"@orion-ecs/math": patch
"@orion-ecs/graphics": patch
"@orion-ecs/network": patch
"@orion-ecs/state-machine": patch
"@orion-ecs/canvas2d-renderer": patch
"@orion-ecs/profiling": patch
---

Add strict TypeScript configuration and defineComponent utility

**Core Package (minor):**
- Enable `noUncheckedIndexedAccess`, `noImplicitAny`, and `strictNullChecks` in TypeScript config
- Add `defineComponent` utility for defining components with typed properties and defaults
- Add ESLint/oxlint configuration for type safety rules
- Add comprehensive plugin system integration tests

**All Packages (patch):**
- Fix type errors caused by `noUncheckedIndexedAccess` with non-null assertions
- Ensure array access is type-safe in iteration loops

**Breaking Changes:**
- `noUncheckedIndexedAccess` may require code updates for array access patterns
