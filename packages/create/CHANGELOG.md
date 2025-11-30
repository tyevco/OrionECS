# @orion-ecs/create

## 0.2.0

### Minor Changes

- [#319](https://github.com/tyevco/OrionECS/pull/319) [`7882941`](https://github.com/tyevco/OrionECS/commit/788294138397fc0d45037a9eba11498d9fb293bb) Thanks [@tyevco](https://github.com/tyevco)! - Add @orion-ecs/create package for project scaffolding

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
