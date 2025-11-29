---
"@orion-ecs/core": minor
---

Add error recovery and resilience system for fault-tolerant ECS execution

**New Features:**
- `ErrorRecoveryManager` for system error isolation and recovery
- Multiple recovery strategies: `skip`, `retry`, `disable`, `fallback`, `ignore`
- Circuit breaker pattern to prevent cascading failures
- Health monitoring with `healthy`, `degraded`, `unhealthy`, `disabled` states
- Error collection and reporting for production services (Sentry, Rollbar, etc.)
- Per-system error configuration via `SystemOptions.errorConfig`

**New EngineBuilder Method:**
- `withErrorRecovery(config?)` - Enable error recovery with optional configuration

**New Engine Methods:**
- `isErrorRecoveryEnabled()` - Check if error recovery is enabled
- `getSystemHealth(name)` - Get health status of a specific system
- `getAllSystemHealth()` - Get health of all systems
- `getEngineHealth()` - Get overall engine health status
- `getErrorHistory()` - Get collected errors
- `clearErrorHistory()` - Clear error history
- `generateErrorReport()` - Generate comprehensive error report
- `resetSystem(name)` - Reset system to healthy state
- `resetAllSystems()` - Reset all systems

**New Types:**
- `RecoveryStrategy`, `ErrorSeverity`, `CircuitBreakerState`
- `SystemError`, `SystemHealth`, `SystemErrorConfig`
- `ErrorRecoveryConfig`, `CircuitBreakerConfig`
- `EngineHealthEvent`, `ErrorReport`

**Usage Example:**
```typescript
const engine = new EngineBuilder()
  .withErrorRecovery({
    defaultStrategy: 'skip',
    circuitBreaker: {
      failureThreshold: 3,
      resetTimeout: 10000
    },
    onError: (error) => {
      Sentry.captureException(error.error);
    }
  })
  .build();
```
