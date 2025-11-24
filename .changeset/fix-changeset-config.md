---
"@orion-ecs/graphics": patch
---

Fix changeset configuration and internal dependencies

- Update changeset config to use correct package names (examples and tutorials)
- Add glob pattern to ignore all tutorial packages
- Change @orion-ecs/math dependency from file: to * for proper changeset validation
