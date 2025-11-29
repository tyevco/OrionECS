---
"@orion-ecs/core": minor
---

Add stricter component type utilities for improved type safety

- Add `StrictComponentClass<T, Args>` type that captures both instance type and constructor arguments
- Add `InferStrictComponentClass<C>` utility type to infer strict component types from constructors
- Improve documentation for `ComponentIdentifier` explaining the type safety model and why `any[]` is used
- Enhance `ComponentArgs<T>` documentation with usage examples

These new types provide an opt-in stricter alternative for cases where compile-time validation of constructor arguments is needed at the definition site rather than just at call sites.
