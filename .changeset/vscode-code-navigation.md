---
"orion-ecs-vscode": minor
---

Add enhanced code navigation (Go to Definition, Find References)

Go to Definition Support:
- Jump to component class definitions from any usage
- Navigate to system definitions from getSystem() calls
- Find prefab definitions from createFromPrefab() calls
- Context-aware detection (query arrays, entity methods, singletons)
- Works across TypeScript and JavaScript files

Find All References:
- Find all component references with context categorization
- Locate system references across workspace
- Track prefab usage throughout codebase
- Results displayed in peek view or references panel
- Distinguishes between definitions, imports, and usage

Enhanced Commands:
- `orion-ecs.findComponentReferences`: Find component usage
- `orion-ecs.findSystemReferences`: Find system usage
- `orion-ecs.findPrefabReferences`: Find prefab usage
- `orion-ecs.goToDefinition`: Jump to ECS element definition

Includes comprehensive test coverage for navigation providers and context detection logic.
