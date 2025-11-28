---
"@orion-ecs/core": minor
"@orion-ecs/plugin-api": minor
"@orion-ecs/physics": minor
"@orion-ecs/debug-visualizer": minor
"@orion-ecs/profiling": minor
"@orion-ecs/resource-manager": minor
"@orion-ecs/spatial-partition": minor
"@orion-ecs/input-manager": minor
"@orion-ecs/interaction-system": minor
"@orion-ecs/canvas2d-renderer": minor
"@orion-ecs/testing": minor
"@orion-ecs/timeline": minor
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
