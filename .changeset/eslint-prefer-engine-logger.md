---
"@orion-ecs/eslint-plugin-ecs": minor
---

Add prefer-engine-logger rule to encourage secure logging

Discourages `console.*` statements in favor of the engine's built-in logger which provides:
- Automatic sanitization to prevent log injection attacks
- Tagged logging for better organization and filtering
- Configurable log levels (debug, info, warn, error)
- Consistent formatting across the application
- Integration with engine lifecycle and debugging tools

Rule Options:
- `methods`: Array of console methods to flag (default: all logging methods)
- `allowInTests`: Allow console.* in test files (default: true)
- `allowConsoleError`: Allow console.error for critical unrecoverable errors (default: true)

Provides contextual error messages:
- System callbacks: "Use engine.logger or system-specific logger"
- Plugin code: "Use this.logger from PluginContext"
- General code: "Use engine.logger for consistent logging"

Includes auto-fix suggestions to replace console.log with appropriate logger calls based on context.
