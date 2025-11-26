---
"@orion-ecs/core": minor
"@orion-ecs/plugin-api": minor
"@orion-ecs/physics": patch
"@orion-ecs/debug-visualizer": patch
"@orion-ecs/profiling": patch
"@orion-ecs/resource-manager": patch
"@orion-ecs/spatial-partition": patch
"@orion-ecs/input-manager": patch
"@orion-ecs/interaction-system": patch
"@orion-ecs/canvas2d-renderer": patch
---

Add type safety to plugins and conditional profiling support

Core:
- Add `withProfiling(enabled)` option to EngineBuilder for conditional system profiling
- Add `isProfilingEnabled()` method to Engine for runtime checks
- System profiling can now be disabled in production builds to eliminate overhead

Plugin API:
- Export `EntityDef` interface for type-safe entity handling in plugins
- Export `SystemProfile` interface for building debugging/profiling plugins

All Plugins:
- Migrate to `@orion-ecs/plugin-api` with TypeScript type inference
- Add type-safe API interfaces (e.g., `IPhysicsAPI`, `IDebugAPI`)
- Replace `Entity` with `EntityDef` for proper type safety
