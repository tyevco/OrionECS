---
"@orion-ecs/eslint-plugin-ecs": minor
---

Add no-static-state rule to prevent static state in ECS classes

Detects and prevents static state in:
- **Component classes**: Static properties/methods break entity isolation, interfere with serialization, and cause pooling issues
- **System classes**: Static state creates hidden global state that violates ECS patterns
- **Plugin classes**: Static state interferes with multi-engine scenarios and testing

Detection Methods:
- Pattern-based: Matches classes ending in 'Component', 'System', 'Plugin'
- Interface-based: Detects classes implementing `EnginePlugin`
- Usage-based: Tracks classes registered via `engine.use()` or `EngineBuilder.use()`

Configurable Options:
- `componentPattern`: Regex to identify component classes (default: 'Component$')
- `systemPattern`: Regex to identify system classes (default: 'System$')
- `pluginPattern`: Regex to identify plugin classes (default: 'Plugin$')
- `detectFromUsage`: Detect from ECS API calls (default: true)
- `checkComponents`: Enable component checking (default: true)
- `checkSystems`: Enable system checking (default: true)
- `checkPlugins`: Enable plugin checking (default: true)
- `checkModuleLevelState`: Warn about module-level let/var (default: false)
- `allowedStaticProperties`: Whitelist static properties like 'schema' or 'version'
- `allowedModuleLevelPatterns`: Regex patterns for allowed module variables

Encourages proper ECS patterns using singleton components or engine services instead of static state.
