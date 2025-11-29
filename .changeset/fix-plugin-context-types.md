---
"@orion-ecs/core": patch
---

Fix type safety in plugin context methods by returning proper types instead of `any`

- `createSystem` now returns `System<ComponentTypes<All>>` instead of `any`
- `createQuery` now returns `Query<ComponentTypes<All>>` instead of `any`
- `getEngine` now returns `Engine` instead of `any`

This improves TypeScript type inference for plugins using the plugin context API.
