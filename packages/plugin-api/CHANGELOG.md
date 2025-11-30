# @orion-ecs/plugin-api

## 0.5.0

### Minor Changes

- [#354](https://github.com/tyevco/OrionECS/pull/354) [`10914c6`](https://github.com/tyevco/OrionECS/commit/10914c686591f945a718f220923bc204c414df20) Thanks [@tyevco](https://github.com/tyevco)! - Add multiple log providers support for flexible log destinations

  This update introduces a provider-based logging architecture that allows developers to direct log output to multiple destinations simultaneously.

  **New Types in @orion-ecs/plugin-api:**

  - `LogProvider` interface for creating custom log destinations
  - `LogEntry` type containing structured log information (level, args, tag, timestamp)

  Plugin authors can now implement custom log providers with only the lightweight plugin-api dependency.

  **New Features in @orion-ecs/core:**

  - `ConsoleLogProvider` - built-in provider for console output (default)
  - `MemoryLogProvider` - built-in provider for capturing logs in memory (great for testing)
  - `EngineBuilder.withLogProvider()` - method for registering log providers during engine configuration

  **Usage Examples:**

  ```typescript
  // Memory-only logging for tests (no console output)
  const memoryLog = new MemoryLogProvider();
  const engine = new EngineBuilder().withLogProvider(memoryLog).build();

  // Assert on captured logs
  expect(memoryLog.getByLevel("error")).toHaveLength(0);
  expect(memoryLog.search("entity created")).toHaveLength(1);

  // Multiple providers (console + memory)
  const engine = new EngineBuilder()
    .withLogProvider(new ConsoleLogProvider())
    .withLogProvider(memoryLog)
    .build();

  // Custom provider for remote logging
  const remoteProvider: LogProvider = {
    write(entry) {
      if (entry.level === "error") {
        sendToErrorTracking(entry);
      }
    },
  };
  ```

  **Backward Compatibility:**

  - Existing code continues to work without changes
  - If no providers are configured, `ConsoleLogProvider` is used by default
  - The `Logger` interface remains unchanged

## 0.4.0

### Minor Changes

- [#202](https://github.com/tyevco/OrionECS/pull/202) [`5166280`](https://github.com/tyevco/OrionECS/commit/5166280830aafd2086e43d3902530475f1d61e68) Thanks [@tyevco](https://github.com/tyevco)! - Add type safety to plugins and conditional profiling support

  Core:

  - Add `withProfiling(enabled)` option to EngineBuilder for conditional system profiling
  - Add `isProfilingEnabled()` method to Engine for runtime checks
  - System profiling can now be disabled in production builds to eliminate overhead

  Plugin API:

  - Export `EntityDef` interface for type-safe entity handling in plugins
  - Export `SystemProfile` interface for building debugging/profiling plugins

  All Plugins:

  - Migrate to `@orion-ecs/plugin-api` with TypeScript type inference
  - Add type-safe API interfaces (e.g., `IPhysicsAPI`, `IDebugAPI`)
  - Replace `Entity` with `EntityDef` for proper type safety

### Patch Changes

- [#263](https://github.com/tyevco/OrionECS/pull/263) [`e4a40d8`](https://github.com/tyevco/OrionECS/commit/e4a40d8c192688f1c767a10e1089e939b3f95e39) Thanks [@tyevco](https://github.com/tyevco)! - Fix log injection vulnerability with centralized Logger

  - Add Logger interface to @orion-ecs/plugin-api for secure, structured logging
  - Create EngineLogger implementation with automatic sanitization of ANSI escape sequences and control characters
  - Update NetworkPlugin to use centralized logger via PluginContext
  - Plugins now import types from @orion-ecs/plugin-api for lighter dependencies
