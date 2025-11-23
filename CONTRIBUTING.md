# Contributing to Orion ECS

Thank you for your interest in contributing to Orion ECS! We appreciate your support and welcome contributions of all kinds. This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Plugin Development](#plugin-development)
- [Testing](#testing)
- [Documentation](#documentation)
- [Getting Help](#getting-help)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- A clear and descriptive title
- Detailed steps to reproduce the issue
- Expected behavior vs. actual behavior
- Your environment (OS, Node.js version, OrionECS version)
- Code samples or test cases if applicable
- Any relevant error messages or stack traces

Use the bug report template when creating issues.

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:

- A clear and descriptive title
- Detailed description of the proposed functionality
- Use cases and examples
- Any implementation ideas you might have
- How this fits with existing features

Use the feature request template when creating issues.

### Contributing Code

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes following our guidelines
4. Add or update tests as needed
5. Ensure all tests pass
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js 18+ and npm 10+
- Git

### Installation

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/your-username/OrionECS.git
   cd OrionECS
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Run tests to verify setup:
   ```bash
   npm test
   ```

### Project Structure

OrionECS uses a monorepo structure managed with npm workspaces and Turbo:

```
OrionECS/
├── core/               # Core ECS engine package
│   ├── src/
│   │   ├── engine.ts      # Engine facade and builder
│   │   ├── core.ts        # Core ECS components
│   │   ├── managers.ts    # Specialized managers
│   │   ├── archetype.ts   # Archetype system
│   │   └── definitions.ts # TypeScript interfaces
│   └── package.json
├── plugins/            # Official plugins
│   ├── physics/
│   ├── spatial-partition/
│   ├── debug-visualizer/
│   └── ...
├── examples/           # Example applications
│   ├── games/
│   └── integrations/
├── benchmarks/         # Performance benchmarks
└── utils/              # Shared utilities
```

### Development Commands

```bash
# Build all packages
npm run build

# Run all tests
npm test

# Run benchmarks
npm run benchmark

# Lint code
npm run lint

# Format code
npm run format

# Check formatting without changes
npm run format:check

# Type check
npm run typecheck

# Run all checks (lint + format + typecheck)
npm run check

# Clean build artifacts
npm run clean
```

### Working with Specific Packages

```bash
# Run commands in specific workspace
npm run build --workspace=core
npm test --workspace=plugins/physics
```

## Code Style Guidelines

OrionECS uses Biome for code formatting and linting. The configuration is automatically applied when you run formatting commands.

### Key Style Rules

- **Indentation**: 4 spaces (TypeScript/JavaScript), 2 spaces (JSON)
- **Line Width**: 100 characters maximum
- **Quotes**: Single quotes for strings, double quotes for JSX
- **Semicolons**: Always required
- **Trailing Commas**: ES5 style (objects, arrays)
- **Arrow Functions**: Always use parentheses around parameters
- **Naming Conventions**:
  - Classes: PascalCase (`EngineBuilder`, `ComponentManager`)
  - Functions/Methods: camelCase (`createEntity`, `addComponent`)
  - Constants: UPPER_SNAKE_CASE (`MAX_ENTITIES`)
  - Private fields: prefix with underscore (`_internalState`)

### Automatic Formatting

Before committing, run:

```bash
npm run format
```

Husky pre-commit hooks will automatically format staged files.

### Linting

```bash
# Run Biome linter
npm run lint

# Run Oxlint (additional linting)
# Automatically runs on .ts files via lint-staged
```

## Commit Message Guidelines

OrionECS follows the [Conventional Commits](https://www.conventionalcommits.org/) specification. All commit messages must follow this format:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### Commit Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `chore`: Maintenance tasks
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `ci`: CI/CD changes
- `perf`: Performance improvements
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `build`: Build system or dependency changes

### Commit Message Rules

- Subject line must NOT start with uppercase letter
- Subject line maximum 100 characters
- Body line maximum 100 characters
- Use imperative mood ("add feature" not "added feature")
- Reference issues and pull requests when applicable

### Examples

```bash
# Good commits
git commit -m "feat(engine): add entity prefab system"
git commit -m "fix(query): resolve memory leak in archetype matching"
git commit -m "docs: update plugin development guide"
git commit -m "test(systems): add integration tests for system execution"

# Bad commits
git commit -m "Fixed bug"  # Not descriptive, starts with uppercase
git commit -m "Add new stuff"  # Too vague
git commit -m "WIP"  # Work in progress should not be committed to main
```

Commitlint will validate your commit messages automatically.

## Pull Request Process

### Before Submitting

1. **Update your branch** with the latest changes from `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run all checks**:
   ```bash
   npm run check
   npm test
   npm run build
   ```

3. **Update documentation** if you've changed APIs

4. **Add tests** for new features or bug fixes

### Submitting a Pull Request

1. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a pull request** on GitHub

3. **Fill out the PR template** completely:
   - Describe your changes
   - Explain the motivation
   - List any breaking changes
   - Reference related issues
   - Describe your testing approach

4. **Respond to review feedback** promptly

5. **Keep your PR updated** with main branch if needed

### PR Requirements

- All tests must pass
- Code coverage should not decrease
- No merge conflicts with main
- At least one approving review from a maintainer
- All CI checks must pass
- Commit messages must follow Conventional Commits
- PR title must follow Conventional Commits format

### PR Title Format

PR titles must follow the same format as commit messages:

```
<type>: <description>
```

Examples:
- `feat: add entity prefab system`
- `fix: resolve memory leak in query matching`
- `docs: update contributing guidelines`

## Plugin Development

Orion ECS has a powerful plugin architecture. When developing plugins:

### Plugin Structure

```typescript
import { EnginePlugin, PluginContext } from 'orion-ecs';

export class MyPlugin implements EnginePlugin {
    name = 'MyPlugin';
    version = '1.0.0';

    install(context: PluginContext): void {
        // Register components
        context.registerComponent(MyComponent);

        // Create systems
        context.createSystem('MySystem',
            { all: [MyComponent] },
            {
                act: (entity, component) => {
                    // System logic
                }
            }
        );

        // Extend API
        context.extend('myFeature', {
            doSomething: () => { /* ... */ }
        });
    }

    uninstall?(): void {
        // Cleanup logic
    }
}
```

### Plugin Guidelines

- Use descriptive names with clear purpose
- Document all public APIs with JSDoc comments
- Provide TypeScript type definitions
- Include comprehensive tests
- Add usage examples in plugin README
- Follow the same code style as core
- Avoid modifying core engine behavior
- Use `PluginContext` for all engine interactions

### Plugin Location

- Official plugins: `plugins/<plugin-name>/`
- Each plugin should have its own `package.json`
- Include README.md with usage examples
- Add tests in `src/__tests__/` or `*.spec.ts` files

## Testing

### Writing Tests

- Use Jest for all tests
- Place tests next to source files (`.spec.ts`) or in `__tests__/` directory
- Aim for high code coverage (>80%)
- Write both unit and integration tests
- Test edge cases and error conditions

### Test Structure

```typescript
describe('FeatureName', () => {
    it('should do something specific', () => {
        // Arrange
        const engine = new EngineBuilder().build();

        // Act
        const result = engine.doSomething();

        // Assert
        expect(result).toBe(expected);
    });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests for specific package
npm test --workspace=core

# Run tests with coverage
npm test -- --coverage
```

### Benchmarks

Add performance benchmarks for performance-critical features:

```bash
npm run benchmark
```

Place benchmark files in `benchmarks/` directory with `.bench.ts` extension.

## Documentation

### Code Documentation

- Add JSDoc comments to all public APIs
- Include parameter descriptions and return types
- Provide usage examples in comments
- Document any edge cases or limitations

Example:

```typescript
/**
 * Creates a new entity with an optional name.
 *
 * @param name - Optional name for the entity
 * @returns The newly created entity
 *
 * @example
 * ```typescript
 * const player = engine.createEntity('Player');
 * ```
 */
createEntity(name?: string): Entity {
    // Implementation
}
```

### README Updates

When adding features:

- Update the main README.md with usage examples
- Add to the features list if it's a major feature
- Update the API reference section
- Add examples to the Quick Start if relevant

### CLAUDE.md Updates

If you change core architecture or patterns:

- Update CLAUDE.md to reflect changes
- Add new patterns to the Code Patterns section
- Update the Core Architecture section if needed

## Getting Help

- **Issues**: Search existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check README.md and CLAUDE.md
- **Examples**: Look at the examples/ directory

## Recognition

Contributors will be recognized in:

- Release notes for their contributions
- GitHub contributors page
- Special mentions for significant contributions

Thank you for contributing to Orion ECS! 🚀
