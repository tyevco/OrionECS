# OrionECS VS Code Extension

A Visual Studio Code extension that enhances the OrionECS development experience with code snippets, IntelliSense, and developer tools.

## Features

### Code Snippets

Quickly scaffold ECS patterns with powerful code snippets:

| Prefix | Description |
|--------|-------------|
| `orion-component` | Create a component class |
| `orion-system` | Create a system |
| `orion-system-hooks` | Create a system with lifecycle hooks |
| `orion-system-fixed` | Create a fixed-update system |
| `orion-entity` | Create an entity |
| `orion-prefab` | Create and register a prefab |
| `orion-engine` | Create and configure an engine |
| `orion-plugin` | Create a plugin |
| `orion-singleton` | Create and use a singleton |
| `orion-query` | Create a fluent query |
| `orion-gameloop` | Create a game loop |
| `orion-spawn` | Spawn entity with command buffer |
| `orion-import` | Import OrionECS |

All snippets also work with the `ecs-` prefix (e.g., `ecs-component`).

### IntelliSense Enhancements

- **Component completion**: Auto-complete component names in queries and entity methods
- **System completion**: Auto-complete system names in `getSystem()` calls
- **Method completion**: Smart completion for entity and engine methods
- **Tag suggestions**: Common tag suggestions in tag contexts

### CodeLens

- **Component usage**: See how many systems and prefabs use each component
- **System info**: Quick system type indicator
- **Prefab info**: Quick prefab indicator

### Hover Documentation

Hover over ECS methods and patterns to see inline documentation:

- Entity methods (`addComponent`, `getComponent`, `hasComponent`, etc.)
- Engine methods (`createEntity`, `createSystem`, `update`, etc.)
- Query patterns (`all`, `any`, `none`)
- System options (`priority`, `act`, `before`, `after`)

### Tree Views

The OrionECS sidebar provides three tree views:

1. **Components**: Lists all component classes in your project
2. **Systems**: Lists all registered systems with their priority and query info
3. **Entities**: Lists all entity prefabs

Click any item to navigate to its definition.

### Commands

Access from Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| `Orion: Create New Component` | Scaffold a new component with prompts |
| `Orion: Create New System` | Scaffold a new system with prompts |
| `Orion: Create Entity Prefab` | Scaffold a new prefab with prompts |
| `Orion: Show Entity Inspector` | Open the entity inspector panel |
| `Orion: Show System Execution Order` | View system execution order |
| `Orion: Open Documentation` | Open OrionECS documentation |
| `Orion: Refresh Entity Tree` | Refresh all tree views |

## Configuration

Configure the extension in your VS Code settings:

```json
{
  "orion-ecs.enableCodeLens": true,
  "orion-ecs.enableInlineHints": true,
  "orion-ecs.snippetStyle": "verbose",
  "orion-ecs.autoImport": true
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enableCodeLens` | boolean | `true` | Enable CodeLens for component usage |
| `enableInlineHints` | boolean | `true` | Enable inline hints for ECS patterns |
| `snippetStyle` | string | `"verbose"` | Style of generated snippets (`"verbose"` or `"compact"`) |
| `autoImport` | boolean | `true` | Auto-add imports when using snippets |

## Requirements

- VS Code 1.85.0 or higher
- An OrionECS project (extension activates when `@orion-ecs/core` is detected)

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "OrionECS"
4. Click Install

### From VSIX

1. Download the `.vsix` file
2. Open VS Code
3. Go to Extensions
4. Click the `...` menu and select "Install from VSIX..."
5. Select the downloaded file

## Development

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Watch for changes
npm run watch

# Package the extension
npm run package
```

## Contributing

Contributions are welcome! Please see the [OrionECS repository](https://github.com/tyevco/OrionECS) for contribution guidelines.

## License

MIT License - see the [LICENSE](../../LICENSE) file for details.
