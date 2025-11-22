# API Documentation Generation

**Milestone:** v0.3.0 - Component Change Events & Reactive Programming
**Priority:** High
**Labels:** documentation, tooling
**Impact:** Developer Experience, Adoption

## Description

Implement automated API documentation generation from TypeScript source code to provide comprehensive reference documentation for all public APIs, components, systems, and plugins.

Currently, OrionECS has excellent README and CLAUDE.md documentation, but lacks detailed API reference documentation that developers can browse when integrating the framework.

## Goals

- Generate comprehensive API documentation from TypeScript source
- Provide searchable, browsable API reference
- Include all public classes, interfaces, methods, and properties
- Integrate with existing documentation structure
- Support automatic updates on releases

## Subtasks

### 1. Research and Select Documentation Tool
- [ ] Evaluate TypeDoc for TypeScript documentation
- [ ] Evaluate API Extractor + API Documenter
- [ ] Evaluate TSDoc standard compliance
- [ ] Compare output formats (HTML, Markdown, JSON)
- [ ] Select tool based on project needs

### 2. Configure Documentation Generator
- [ ] Install selected documentation tool
- [ ] Configure tsconfig.json for doc generation
- [ ] Set up documentation output directory (e.g., `docs/api/`)
- [ ] Configure theme and styling to match project branding
- [ ] Set up proper categorization (Core, Managers, Plugins, etc.)

### 3. Add TSDoc Comments to Core API
- [ ] Document Engine class and EngineBuilder
- [ ] Document Entity, Component, System classes
- [ ] Document all Manager classes
- [ ] Document Query and QueryBuilder
- [ ] Document Plugin interfaces (EnginePlugin, PluginContext)
- [ ] Document utility functions

### 4. Add TSDoc Comments to Plugins
- [ ] Document PhysicsPlugin API
- [ ] Document SpatialPartitionPlugin API
- [ ] Document ProfilingPlugin API
- [ ] Document ResourceManagerPlugin API
- [ ] Document DebugVisualizerPlugin API
- [ ] Document Canvas2DRendererPlugin API
- [ ] Document InputManagerPlugin API
- [ ] Document InteractionSystemPlugin API

### 5. Add Documentation Generation Scripts
- [ ] Add `npm run docs:generate` script to package.json
- [ ] Add `npm run docs:watch` for development
- [ ] Add `npm run docs:serve` to preview locally
- [ ] Configure output location and structure

### 6. Integrate with CI/CD
- [ ] Add docs generation to build process
- [ ] Deploy docs to GitHub Pages or separate docs site
- [ ] Set up automatic deployment on releases
- [ ] Add docs version selector for multiple versions

### 7. Documentation Quality Checks
- [ ] Add linting for TSDoc comments
- [ ] Ensure all public APIs have documentation
- [ ] Add examples to complex APIs
- [ ] Cross-reference related APIs
- [ ] Add "See Also" sections

### 8. Update README
- [ ] Add link to generated API documentation
- [ ] Update documentation section with API docs location
- [ ] Add badge for documentation status

## Success Criteria

- [ ] All public APIs have TSDoc comments
- [ ] Documentation generates without errors
- [ ] Documentation is deployed and accessible online
- [ ] Documentation includes examples for complex APIs
- [ ] Documentation is searchable and navigable
- [ ] Documentation updates automatically with releases

## Implementation Notes

**Recommended Tool:** TypeDoc
- Well-established in TypeScript ecosystem
- Excellent TypeScript support
- Customizable themes
- Good GitHub integration
- Supports multiple output formats

**Example TSDoc Comment:**
```typescript
/**
 * Creates a new entity with optional name.
 *
 * Entities are the fundamental objects in the ECS architecture. They serve as
 * containers for components and can be organized in hierarchies.
 *
 * @param name - Optional human-readable name for the entity
 * @returns The newly created entity
 *
 * @example
 * ```typescript
 * const player = engine.createEntity('Player');
 * player.addComponent(Position, 0, 0);
 * player.addTag('player');
 * ```
 *
 * @see {@link Entity}
 * @see {@link EngineBuilder}
 */
createEntity(name?: string): Entity;
```

## Related Issues

- #61 - Plugin Documentation (README files)
- #53 - Component Change Events Documentation

## References

- [TypeDoc](https://typedoc.org/)
- [TSDoc Standard](https://tsdoc.org/)
- [API Extractor](https://api-extractor.com/)
