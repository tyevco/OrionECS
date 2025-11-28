---
"orion-ecs-vscode": minor
---

Add refactoring support for ECS components

Rename Component:
- ComponentRenameProvider for intelligent component renaming
- Workspace-wide reference updates including:
  - Class definitions and imports
  - Entity methods (addComponent, getComponent, hasComponent, removeComponent)
  - System queries (all, any, none arrays)
  - Prefab type definitions
  - Singleton method calls
- Preview changes before applying
- Maintains code consistency across all files

Extract Component:
- ExtractComponentCodeActionProvider for property extraction
- Generate new component classes from selected properties
- Automatic boilerplate generation (constructor, TypeScript types)
- Option to extract to same file or new file
- Auto-import statements for new components

Additional Refactoring Commands:
- `orion-ecs.renameComponent`: Trigger rename operation at cursor
- `orion-ecs.previewComponentReferences`: Preview all component references
- `orion-ecs.moveComponentToFile`: Move component class to new file
- `orion-ecs.extractComponent`: Extract properties to new component class

Includes refactoring utilities for workspace-wide reference tracking and analysis.
