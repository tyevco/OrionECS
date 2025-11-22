# Unit Testing Utilities for Users

**Milestone:** v0.3.0 - Component Change Events & Reactive Programming
**Priority:** High
**Labels:** testing, developer-experience, tooling
**Impact:** Developer Experience, Code Quality

## Description

Provide comprehensive testing utilities and helpers to make it easy for users to write unit tests for their ECS systems, components, and game logic. While OrionECS has excellent internal test coverage, users need tools to test their own code.

## Goals

- Provide test fixtures and mock entities for testing
- Create assertion helpers for ECS-specific testing
- Provide test utilities for systems, queries, and components
- Include examples of testing patterns
- Support all major test frameworks (Jest, Vitest, Mocha)

## Subtasks

### 1. Design Testing API
- [ ] Define test helper API surface
- [ ] Research testing patterns in other ECS frameworks
- [ ] Design mock/fixture creation utilities
- [ ] Design assertion helpers
- [ ] Create testing utilities architecture

### 2. Create Test Engine Builder
- [ ] Implement `TestEngineBuilder` for isolated test environments
- [ ] Add automatic cleanup after tests
- [ ] Provide deterministic test configuration
- [ ] Support fast test mode (disable profiling, debug output)
- [ ] Add snapshot testing support

### 3. Create Entity Test Fixtures
- [ ] Implement `createTestEntity()` helper
- [ ] Implement `createTestEntities()` for bulk creation
- [ ] Add prefab-based test entity creation
- [ ] Support entity templates for common test scenarios
- [ ] Add cleanup utilities for test entities

### 4. Create System Testing Utilities
- [ ] Implement `TestSystemRunner` for isolated system execution
- [ ] Add system execution mocking
- [ ] Create system output capture utilities
- [ ] Add time manipulation for fixed/variable updates
- [ ] Support step-by-step system execution

### 5. Create Query Testing Utilities
- [ ] Implement query result assertions
- [ ] Add query matching helpers
- [ ] Create query spy/mock utilities
- [ ] Add query performance assertions
- [ ] Support query snapshot testing

### 6. Create Component Testing Utilities
- [ ] Implement component value assertions
- [ ] Add component lifecycle testing helpers
- [ ] Create component pool testing utilities
- [ ] Add component validation testing
- [ ] Support component serialization testing

### 7. Create Assertion Helpers
- [ ] `expect(entity).toHaveComponent(Component)`
- [ ] `expect(entity).toHaveTag(tag)`
- [ ] `expect(query).toMatch(count)`
- [ ] `expect(system).toHaveExecuted()`
- [ ] `expect(entity).toBeInArchetype(signature)`
- [ ] Add custom Jest/Vitest matchers

### 8. Create Time Manipulation Utilities
- [ ] Implement `TestClock` for deterministic time
- [ ] Add `advance(ms)` to move time forward
- [ ] Support frame-by-frame stepping
- [ ] Add fixed update time control
- [ ] Support time travel for replay testing

### 9. Documentation and Examples
- [ ] Write testing guide documentation
- [ ] Create example test suites for common patterns
- [ ] Add testing best practices guide
- [ ] Include integration test examples
- [ ] Add performance testing examples

### 10. Framework Integration
- [ ] Create Jest preset for OrionECS testing
- [ ] Create Vitest preset for OrionECS testing
- [ ] Add TypeScript support for test utilities
- [ ] Provide ESM and CommonJS builds
- [ ] Add type definitions for all test utilities

## Success Criteria

- [ ] Users can easily create test engines and entities
- [ ] System testing is straightforward and isolated
- [ ] Query assertions are intuitive and helpful
- [ ] Component testing covers all lifecycle phases
- [ ] Time manipulation supports deterministic tests
- [ ] All utilities have TypeScript types
- [ ] Documentation includes comprehensive examples
- [ ] Works with Jest, Vitest, and Mocha

## Implementation Notes

**Package Structure:**
```typescript
// Main test utilities export
import {
  createTestEngine,
  createTestEntity,
  TestSystemRunner,
  TestClock,
  expect  // Enhanced with ECS matchers
} from 'orion-ecs/testing';

// Example usage
describe('MovementSystem', () => {
  let engine;
  let clock;

  beforeEach(() => {
    clock = new TestClock();
    engine = createTestEngine({ clock });
  });

  afterEach(() => {
    engine.destroy();
  });

  it('should move entities with velocity', () => {
    const entity = createTestEntity(engine, {
      components: [
        { type: Position, args: [0, 0] },
        { type: Velocity, args: [10, 5] }
      ]
    });

    engine.update(1.0); // 1 second

    const pos = entity.getComponent(Position);
    expect(pos.x).toBe(10);
    expect(pos.y).toBe(5);
  });

  it('should only affect entities with velocity', () => {
    const query = engine.createQuery({ all: [Position, Velocity] });

    createTestEntities(engine, 10, {
      components: [{ type: Position, args: [0, 0] }]
    });

    createTestEntities(engine, 5, {
      components: [
        { type: Position, args: [0, 0] },
        { type: Velocity, args: [1, 1] }
      ]
    });

    expect(query).toMatch(5);
  });
});
```

**Custom Matchers:**
```typescript
expect.extend({
  toHaveComponent(entity: Entity, ComponentType: any) {
    const pass = entity.hasComponent(ComponentType);
    return {
      pass,
      message: () =>
        pass
          ? `Expected entity not to have ${ComponentType.name}`
          : `Expected entity to have ${ComponentType.name}`
    };
  }
});
```

## Related Issues

- #62 - Test Coverage - Comprehensive Plugin Test Suites
- #53 - Component Change Events - Documentation & Examples

## References

- [Jest Custom Matchers](https://jestjs.io/docs/expect#custom-matchers-api)
- [Vitest Custom Matchers](https://vitest.dev/guide/extending-matchers.html)
- [React Testing Library](https://testing-library.com/) (inspiration for API design)
