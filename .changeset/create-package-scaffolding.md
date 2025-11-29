---
"@orion-ecs/create": minor
---

Add @orion-ecs/create package for project scaffolding

New CLI tool to quickly scaffold OrionECS game projects with a single command.

Features:
- Interactive project setup wizard with prompts for configuration
- Multiple project templates: vanilla, canvas2d, pixi, three, multiplayer, vite, webpack
- TypeScript and JavaScript language support
- Package manager selection (npm, yarn, pnpm)
- Automatic git initialization and dependency installation
- Complete project structure with components, systems, and engine setup

Usage:
```bash
npm create @orion-ecs my-game
npm create @orion-ecs my-game -t pixi
npm create @orion-ecs my-game -t three --skip-install
```
