---
"@orion-ecs/core": minor
"@orion-ecs/math": patch
"@orion-ecs/graphics": patch
"@orion-ecs/network": patch
"@orion-ecs/state-machine": patch
"@orion-ecs/canvas2d-renderer": patch
---

Add strict TypeScript configuration and builder pattern for components

**Core Package (minor):**
- Enable `noUncheckedIndexedAccess`, `noImplicitAny`, and `strictNullChecks` in TypeScript config
- Add `ComponentBuilder` class for fluent, type-safe component construction
- Add `createComponentFactory` for reusable component factories with defaults
- Add `defineComponent` utility for defining components with typed properties
- Add ESLint/oxlint configuration for type safety rules
- Add comprehensive plugin system integration tests

**All Packages (patch):**
- Fix type errors caused by `noUncheckedIndexedAccess` with non-null assertions
- Ensure array access is type-safe in iteration loops

**Breaking Changes:**
- `noUncheckedIndexedAccess` may require code updates for array access patterns
- See `docs/migrations/STRICT-TYPESCRIPT.md` for migration guide
