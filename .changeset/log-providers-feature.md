---
"@orion-ecs/core": minor
"@orion-ecs/plugin-api": minor
---

Add multiple log providers support for flexible log destinations

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
const engine = new EngineBuilder()
  .withLogProvider(memoryLog)
  .build();

// Assert on captured logs
expect(memoryLog.getByLevel('error')).toHaveLength(0);
expect(memoryLog.search('entity created')).toHaveLength(1);

// Multiple providers (console + memory)
const engine = new EngineBuilder()
  .withLogProvider(new ConsoleLogProvider())
  .withLogProvider(memoryLog)
  .build();

// Custom provider for remote logging
const remoteProvider: LogProvider = {
  write(entry) {
    if (entry.level === 'error') {
      sendToErrorTracking(entry);
    }
  }
};
```

**Backward Compatibility:**
- Existing code continues to work without changes
- If no providers are configured, `ConsoleLogProvider` is used by default
- The `Logger` interface remains unchanged
