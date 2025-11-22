# CLI & Project Scaffolding Tools

**Milestone:** v0.5.0 - Developer Tools & Performance
**Priority:** High
**Labels:** tooling, cli, developer-experience
**Impact:** Developer Experience, Adoption, Onboarding

## Description

Create CLI tools for project scaffolding, code generation, and common development tasks. Similar to `create-react-app`, `@angular/cli`, or `create-vite`, this will provide `create-orion-app` and `orion-cli` commands to streamline development workflow.

## Goals

- Provide `npx create-orion-app` for new project creation
- Create `orion-cli` for code generation and development tasks
- Support multiple project templates (vanilla, pixi, three, etc.)
- Include interactive setup wizard
- Generate boilerplate for components, systems, and plugins
- Integrate development tools and best practices

## Use Cases

- **New Projects:** Quickly scaffold a new OrionECS game project
- **Code Generation:** Generate component/system/plugin boilerplate
- **Development:** Run development server, build, test
- **Templates:** Start from different project templates (2D, 3D, multiplayer)
- **Migration:** Migrate from other ECS frameworks

## Subtasks

### 1. Design CLI Architecture
- [ ] Research modern CLI patterns (Commander.js, oclif, CAC)
- [ ] Design command structure and organization
- [ ] Plan interactive prompts and wizards
- [ ] Design template system
- [ ] Plan plugin architecture for CLI extensions

### 2. Implement `create-orion-app` Package
- [ ] Create standalone package for project creation
- [ ] Implement `npx create-orion-app` support
- [ ] Add interactive project setup wizard
- [ ] Support project name and directory selection
- [ ] Add template selection menu
- [ ] Implement dependency installation
- [ ] Generate initial project structure

### 3. Create Project Templates
- [ ] **Vanilla Template** - Minimal OrionECS setup
- [ ] **Canvas2D Template** - 2D game with Canvas2D renderer
- [ ] **Pixi Template** - 2D game with Pixi.js integration
- [ ] **Three Template** - 3D game with Three.js integration
- [ ] **Multiplayer Template** - Multiplayer game template
- [ ] **TypeScript Template** - TypeScript-first setup
- [ ] **JavaScript Template** - JavaScript setup
- [ ] **Vite Template** - Modern build with Vite
- [ ] **Webpack Template** - Traditional Webpack setup

### 4. Implement Template System
- [ ] Template variable substitution
- [ ] Conditional file inclusion
- [ ] Template inheritance/composition
- [ ] Support template versioning
- [ ] Enable custom user templates
- [ ] Implement template validation

### 5. Implement `orion-cli` Development Tool
- [ ] Create main CLI package
- [ ] Add command routing and parsing
- [ ] Implement help system
- [ ] Add version management
- [ ] Support configuration files (.orionrc)
- [ ] Add plugin system for commands

### 6. Implement Code Generation Commands
- [ ] `orion generate component <name>` - Generate component class
- [ ] `orion generate system <name>` - Generate system boilerplate
- [ ] `orion generate plugin <name>` - Generate plugin structure
- [ ] `orion generate prefab <name>` - Generate prefab template
- [ ] `orion generate query <name>` - Generate query helper
- [ ] Support custom templates and generators

### 7. Implement Development Commands
- [ ] `orion dev` - Start development server with hot reload
- [ ] `orion build` - Build for production
- [ ] `orion test` - Run test suite
- [ ] `orion lint` - Run linter
- [ ] `orion format` - Format code
- [ ] `orion serve` - Serve production build

### 8. Implement Utility Commands
- [ ] `orion info` - Display project information
- [ ] `orion doctor` - Check project health and dependencies
- [ ] `orion upgrade` - Upgrade OrionECS version
- [ ] `orion migrate` - Run migration scripts
- [ ] `orion benchmark` - Run performance benchmarks
- [ ] `orion analyze` - Analyze bundle size and performance

### 9. Add Interactive Features
- [ ] Interactive prompts for all commands
- [ ] Confirmation dialogs for destructive operations
- [ ] Progress indicators for long operations
- [ ] Colorful, helpful output
- [ ] Error messages with suggestions
- [ ] Success animations and feedback

### 10. Implement Configuration System
- [ ] Support `.orionrc.json` configuration file
- [ ] Support `.orion/config.ts` for advanced config
- [ ] Command-line argument override
- [ ] Environment variable support
- [ ] Project-specific settings
- [ ] Global CLI settings

### 11. Add Documentation and Help
- [ ] Comprehensive CLI documentation
- [ ] Help text for all commands
- [ ] Usage examples for each command
- [ ] Troubleshooting guide
- [ ] Template documentation
- [ ] Video walkthrough

### 12. Testing and Quality
- [ ] Unit tests for CLI commands
- [ ] Integration tests for project generation
- [ ] Template validation tests
- [ ] Cross-platform testing (Windows, macOS, Linux)
- [ ] Node.js version compatibility testing
- [ ] CLI output snapshot testing

## Success Criteria

- [ ] `npx create-orion-app` creates working projects
- [ ] All templates generate valid, runnable code
- [ ] Code generation produces quality boilerplate
- [ ] CLI is intuitive and well-documented
- [ ] Interactive prompts guide users effectively
- [ ] Works consistently across platforms
- [ ] Positive user feedback on onboarding experience

## Implementation Notes

**Example Usage:**
```bash
# Create new project
npx create-orion-app my-game

# Interactive wizard
? Project name: my-game
? Template: Pixi.js 2D Game
? Package manager: npm
? TypeScript: Yes
? Install dependencies: Yes

✔ Created project at ./my-game
✔ Installed dependencies
✔ Initialized git repository

Get started:
  cd my-game
  npm run dev

# Generate code
cd my-game
orion generate component Health
# Created: src/components/Health.ts

orion generate system Movement
# Created: src/systems/MovementSystem.ts

orion generate plugin Physics
# Created: src/plugins/physics/PhysicsPlugin.ts

# Development
orion dev
# ✔ Development server running at http://localhost:3000
# ✔ Hot reload enabled

orion build
# ✔ Building for production...
# ✔ Build complete: dist/

orion test
# ✔ Running tests...
# ✔ 42 tests passed

orion doctor
# ✔ OrionECS version: 0.5.0
# ✔ Node.js version: 18.0.0 (compatible)
# ✔ TypeScript version: 5.0.0 (compatible)
# ⚠ No tests found
# ℹ Run 'orion generate test' to add tests
```

**Template Structure:**
```
templates/
├── vanilla/
│   ├── template.json          # Template metadata
│   ├── package.json.template  # With variable substitution
│   ├── src/
│   │   ├── index.ts
│   │   ├── components/
│   │   ├── systems/
│   │   └── game.ts
│   └── README.md
├── pixi/
│   └── ...
└── three/
    └── ...
```

**Generated Component Example:**
```typescript
// src/components/Health.ts
export class Health {
  constructor(
    public current: number = 100,
    public max: number = 100
  ) {}

  get isDead(): boolean {
    return this.current <= 0;
  }

  get percentage(): number {
    return (this.current / this.max) * 100;
  }

  heal(amount: number): void {
    this.current = Math.min(this.current + amount, this.max);
  }

  damage(amount: number): void {
    this.current = Math.max(this.current - amount, 0);
  }
}
```

**Generated System Example:**
```typescript
// src/systems/MovementSystem.ts
import { Position, Velocity } from '../components';

export function createMovementSystem(engine: Engine) {
  engine.createSystem('MovementSystem', {
    all: [Position, Velocity]
  }, {
    priority: 100,
    act: (entity, position, velocity) => {
      position.x += velocity.x;
      position.y += velocity.y;
    }
  });
}
```

## Related Issues

- Comprehensive Tutorial Series (new issue)
- API Documentation Generation (new issue)
- #61 - Plugin Documentation
- VS Code Extension (new issue)

## References

- [Create React App](https://create-react-app.dev/)
- [Angular CLI](https://angular.io/cli)
- [Vite](https://vitejs.dev/)
- [oclif](https://oclif.io/) - CLI framework
- [Plop.js](https://plopjs.com/) - Code generator
