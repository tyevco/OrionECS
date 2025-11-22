# VS Code Extension

**Milestone:** v0.5.0 - Developer Tools & Performance
**Priority:** Medium
**Labels:** tooling, editor, developer-experience
**Impact:** Developer Experience, Productivity

## Description

Create a Visual Studio Code extension to enhance the OrionECS development experience with code snippets, syntax highlighting, IntelliSense enhancements, refactoring tools, and visual debugging aids.

## Goals

- Provide code snippets for common ECS patterns
- Add IntelliSense enhancements for components and systems
- Enable quick navigation between entities, components, and systems
- Support visual debugging and entity inspection
- Integrate with CLI tools
- Provide refactoring assistance

## Use Cases

- **Quick Scaffolding:** Generate components/systems with snippets
- **Navigation:** Jump between component definitions and usage
- **Debugging:** Inspect entity state during development
- **Refactoring:** Rename components across entire codebase
- **Visualization:** See entity hierarchies and relationships
- **Documentation:** Inline documentation and examples

## Subtasks

### 1. Extension Setup and Architecture
- [ ] Set up VS Code extension project
- [ ] Configure TypeScript and build system
- [ ] Set up extension manifest (package.json)
- [ ] Configure extension activation events
- [ ] Set up testing infrastructure
- [ ] Plan extension architecture

### 2. Implement Code Snippets
- [ ] Component class snippets
- [ ] System creation snippets
- [ ] Query builder snippets
- [ ] Plugin creation snippets
- [ ] Prefab definition snippets
- [ ] Entity creation snippets
- [ ] Common patterns (pooling, hierarchies, etc.)
- [ ] Make snippets configurable

### 3. Enhance IntelliSense
- [ ] Component type completion in queries
- [ ] System name completion
- [ ] Tag name completion
- [ ] Component property suggestions
- [ ] Parameter hints for ECS methods
- [ ] Hover information for entities/components
- [ ] Document symbols for ECS structures

### 4. Implement Code Navigation
- [ ] Go to Component Definition
- [ ] Find All Component References
- [ ] Go to System Definition
- [ ] Find Entities Using Component
- [ ] Navigate Entity Hierarchy
- [ ] Component Usage Codelens
- [ ] System Execution Order View

### 5. Create Debugging Tools
- [ ] Entity Inspector Panel
- [ ] Component Value Viewer
- [ ] System Execution Visualizer
- [ ] Query Result Inspector
- [ ] Performance Monitor Integration
- [ ] Breakpoint support for systems
- [ ] Entity state snapshots

### 6. Add Refactoring Support
- [ ] Rename Component (update all references)
- [ ] Rename System
- [ ] Extract Component from Class
- [ ] Convert to Prefab
- [ ] Inline Component
- [ ] Move Component to File

### 7. Implement Code Actions
- [ ] Quick Fix: Add missing component
- [ ] Quick Fix: Register component
- [ ] Quick Fix: Add component to query
- [ ] Organize imports for ECS types
- [ ] Generate getter/setter for component
- [ ] Add validation to component

### 8. Create Visualization Tools
- [ ] Entity Hierarchy Tree View
- [ ] Component Dependency Graph
- [ ] System Execution Order Timeline
- [ ] Archetype Visualization
- [ ] Query Match Preview
- [ ] Memory Usage Charts

### 9. Integrate with CLI
- [ ] Terminal integration for orion-cli
- [ ] Quick commands from Command Palette
- [ ] Project scaffolding from extension
- [ ] Build/test task integration
- [ ] npm script runners
- [ ] One-click project setup

### 10. Add Diagnostics and Linting
- [ ] Detect unused components
- [ ] Detect missing component registration
- [ ] Warn about performance anti-patterns
- [ ] Validate query syntax
- [ ] Check for circular dependencies
- [ ] Suggest optimization opportunities

### 11. Create Documentation Integration
- [ ] Inline documentation lookup
- [ ] Code examples from docs
- [ ] Link to API documentation
- [ ] Tutorial integration
- [ ] Context-aware help
- [ ] Searchable command reference

### 12. Testing and Polish
- [ ] Unit tests for all features
- [ ] Integration tests
- [ ] Manual testing workflow
- [ ] Performance optimization
- [ ] Icon and branding design
- [ ] Extension documentation

### 13. Publishing and Distribution
- [ ] Publish to VS Code Marketplace
- [ ] Create extension landing page
- [ ] Add screenshots and demos
- [ ] Write installation guide
- [ ] Create video walkthrough
- [ ] Set up update mechanism

## Success Criteria

- [ ] Extension installs cleanly from marketplace
- [ ] All snippets generate valid code
- [ ] IntelliSense provides helpful suggestions
- [ ] Navigation features work reliably
- [ ] Debugging tools aid development
- [ ] Refactoring preserves code correctness
- [ ] Visualizations are useful and performant
- [ ] Positive user feedback and ratings

## Implementation Notes

**Snippet Example:**
```json
{
  "Create Component": {
    "prefix": "orion-component",
    "body": [
      "export class ${1:ComponentName} {",
      "  constructor(",
      "    public ${2:value}: ${3:number} = ${4:0}",
      "  ) {}",
      "}"
    ],
    "description": "Create an OrionECS component"
  },

  "Create System": {
    "prefix": "orion-system",
    "body": [
      "engine.createSystem('${1:SystemName}', {",
      "  all: [${2:ComponentType}]",
      "}, {",
      "  priority: ${3:100},",
      "  act: (entity, ${4:component}) => {",
      "    ${5:// System logic}",
      "  }",
      "});"
    ],
    "description": "Create an OrionECS system"
  }
}
```

**Entity Inspector UI:**
```
ENTITY INSPECTOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entity: Player (ID: Symbol(1))
Tags: player, active

Components:
┌─ Position
│  x: 100
│  y: 200
├─ Velocity
│  x: 5
│  y: -2
├─ Health
│  current: 85
│  max: 100
└─ Sprite
   texture: "player.png"

Hierarchy:
┌─ World (parent)
└─ Player
   ├─ Weapon (child)
   └─ HealthBar (child)

[Refresh] [Export State] [Destroy]
```

**Component Usage Codelens:**
```typescript
export class Position {  // ↓ Used by 42 entities ↓ MovementSystem, RenderSystem
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}
}
```

**Quick Commands (Command Palette):**
```
> Orion: Create New Component
> Orion: Create New System
> Orion: Generate Entity Prefab
> Orion: Inspect Entity at Cursor
> Orion: Show System Execution Order
> Orion: Visualize Archetypes
> Orion: Run Benchmarks
> Orion: Open Documentation
```

**Refactoring Example:**
```typescript
// Before: Rename Position component
class Position { ... }
engine.createSystem('Movement', { all: [Position] }, ...);

// Right-click > Rename Symbol > "Transform"

// After: All references updated
class Transform { ... }
engine.createSystem('Movement', { all: [Transform] }, ...);
```

**Tree View - Entity Hierarchy:**
```
ENTITIES
├── 📦 World
│   ├── 🎮 Player
│   │   ├── 🗡️ Weapon
│   │   └── ❤️ HealthBar
│   ├── 👾 Enemy (x15)
│   └── 🌟 Particle (x100)
└── 🎨 UI
    ├── 📊 ScoreDisplay
    └── ⏸️ PauseMenu
```

## Related Issues

- CLI & Project Scaffolding Tools (new issue)
- API Documentation Generation (new issue)
- #57 - Entity Inspector Plugin (complementary web-based tool)
- Comprehensive Tutorial Series (new issue)

## References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [TreeView API](https://code.visualstudio.com/api/extension-guides/tree-view)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
