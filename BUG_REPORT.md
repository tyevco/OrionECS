# Orion ECS - Bug and Code Smell Report

Generated: 2025-11-20

## Critical Bugs

### 1. **Broken Component Validation Logic** (src/engine.ts:299-303)
**Severity:** Critical 🔴

The validation logic is inverted and broken:

```typescript
if (validator && !validator.validate(component)) {
    const validationResult = validator.validate(component);
    const errorMessage = typeof validationResult === 'string' ? validationResult : 'Component validation failed';
    throw new Error(`${errorMessage} for ${type.name} on entity ${this._name || this._id.toString()}`);
}
```

**Problems:**
- `validator.validate()` returns `true | string`, never `false`
- If validation fails (returns string), the string is truthy, so `!validator.validate()` is `false` → no error thrown
- If validation succeeds (returns `true`), `!true` is `false` → no error thrown either
- The validation is called twice unnecessarily
- **This means component validation never actually works**

**Fix:** Should be:
```typescript
const validationResult = validator.validate(component);
if (validationResult !== true) {
    const errorMessage = typeof validationResult === 'string' ? validationResult : 'Component validation failed';
    throw new Error(`${errorMessage} for ${type.name} on entity ${this._name || this._id.toString()}`);
}
```

---

### 2. **restoreSnapshot() Doesn't Actually Restore** (src/engine.ts:858-868)
**Severity:** Critical 🔴

```typescript
restoreSnapshot(index: number = -1): boolean {
    const snapshot = index === -1 ? this._snapshots[this._snapshots.length - 1] : this._snapshots[index];
    if (!snapshot) return false;

    // Clears all entities
    for (const entity of this.getAllEntities()) {
        entity.queueFree();
    }
    this._entityManager.cleanup();

    return true;  // ← Returns true but never restores the snapshot!
}
```

**Impact:**
- Deletes all entities but never recreates them from snapshot
- Claims success by returning `true`
- Essentially just a "delete all entities" function
- Tests don't catch this because they only validate snapshot creation, not restoration

---

### 3. **Symbol Serialization Loses Identity** (src/engine.ts:412)
**Severity:** High 🟠

```typescript
serialize(): SerializedEntity {
    return {
        id: this._id.toString(),  // ← Symbol().toString() → "Symbol()"
        // ...
    };
}
```

**Problems:**
- All entity symbols serialize to the same string `"Symbol()"`
- Impossible to correlate serialized entities with their originals
- Cannot properly deserialize entity references (parent/child relationships)
- Entity IDs are not unique in serialized form

**Impact:** Serialization system is fundamentally broken for entity identity tracking.

---

### 4. **Unbounded Fixed Update Loop** (src/engine.ts:767-775)
**Severity:** High 🟠

```typescript
this._fixedUpdateAccumulator += deltaTime;
while (this._fixedUpdateAccumulator >= this._fixedUpdateInterval) {
    for (const system of this._fixedUpdateSystems) {
        if (system.enabled) {
            system.step();
        }
    }
    this._fixedUpdateAccumulator -= this._fixedUpdateInterval;
}
```

**Problem:**
- If `deltaTime` is very large (e.g., 5000ms after tab switch), the while loop runs many iterations
- For 5 seconds of lag with 60 FPS fixed update = 300 iterations in one frame
- Can cause the main thread to freeze
- No iteration limit or spiral-of-death detection

**Common Fix:** Clamp max iterations:
```typescript
const maxIterations = 10;
let iterations = 0;
while (this._fixedUpdateAccumulator >= this._fixedUpdateInterval && iterations < maxIterations) {
    // ... update logic
    iterations++;
}
if (iterations >= maxIterations) {
    this._fixedUpdateAccumulator = 0; // Reset to prevent permanent lag
}
```

---

### 5. **ComponentArray Bounds Checking Missing** (src/engine.ts:81-83)
**Severity:** Medium 🟡

```typescript
get(index: number): T | null {
    return this.components[index];
}
```

**Problem:**
- No bounds checking
- Accessing `this.components[99999]` returns `undefined`, not `null`
- Type signature promises `T | null` but can return `undefined`
- Inconsistent with the rest of the API

---

### 6. **Query.match() Has Unexpected Side Effects** (src/engine.ts:103-137)
**Severity:** Medium 🟡

The `match()` method both returns a boolean AND mutates the internal `matchingEntities` set:

```typescript
match(entity: Entity): boolean {
    if (all.length > 0 && !all.every(type => entity.hasComponent(type))) {
        this.matchingEntities.delete(entity);  // ← Side effect on failure
        return false;
    }
    // ... more checks with deletes

    this.matchingEntities.add(entity);  // ← Side effect on success
    return true;
}
```

**Problems:**
- Mixing query testing with query registration
- Caller expects a pure check, gets state mutation
- Deleting before all checks complete means partial evaluation affects state

---

## Code Smells

### 7. **God Class Anti-Pattern**
**Location:** Engine class (src/engine.ts:636-886)

The Engine class violates Single Responsibility Principle by managing:
- Entity lifecycle
- Component storage
- System execution
- Query management
- Event emission
- Message bus
- Prefab registry
- Snapshot management
- Debug information
- Performance profiling

**Impact:**
- Hard to test in isolation
- Changes cascade through entire class
- Difficult to understand and maintain

---

### 8. **Breaking Encapsulation** (src/engine.ts:528)
**Severity:** Medium 🟡

```typescript
get stats(): MemoryStats {
    for (const entity of entities) {
        for (const [componentType] of (entity as any)._componentIndices) {
            // Accessing private member with type cast
        }
    }
}
```

**Problem:** Casting to `any` to access private `_componentIndices` defeats encapsulation.

**Better approach:** Add public method to Entity like `getComponentTypes()`.

---

### 9. **Magic Numbers Throughout Codebase**

- `1000` (line 157) - max message history
- `500` (line 207) - max event history
- `10` (line 650) - max snapshots
- `32` (line 94, 538) - bytes per component (wild guess)
- `60` (line 898) - max performance samples

**Fix:** Extract to named constants:
```typescript
const MAX_MESSAGE_HISTORY = 1000;
const MAX_EVENT_HISTORY = 500;
const ESTIMATED_COMPONENT_SIZE_BYTES = 32;
```

---

### 10. **Inconsistent Time APIs**

- `Date.now()` used for change tracking (lines 65, 92, 176, 226, 799, 800, 876)
- `performance.now()` used for system profiling (lines 599, 618)

**Problem:** Mixing timing APIs reduces precision and consistency.

**Fix:** Use `performance.now()` for all performance-related timing, `Date.now()` only for absolute timestamps.

---

### 11. **Inaccurate Memory Estimates** (src/engine.ts:94, 538)

```typescript
get memoryEstimate(): number {
    return this.components.length * 32;  // ← Why 32?
}
```

**Problems:**
- Hardcoded 32 bytes is arbitrary
- JavaScript objects don't have fixed sizes
- Different components have different sizes
- Estimates will be wildly wrong

**Better:** Either use actual memory profiling APIs or document this as a rough heuristic.

---

### 12. **No Pool Size Limits** (src/engine.ts:22-54)

The Pool class has unbounded growth:

```typescript
public release(item: T): void {
    this._totalReleased++;
    this.resetFunc(item);
    this.available.push(item);  // ← No max size check
}
```

**Problem:** If you create 10,000 entities then delete them, the pool keeps all 10,000 forever.

**Fix:** Add max pool size and don't pool beyond that limit.

---

### 13. **Inefficient Array Conversions**

Frequent `Array.from()` calls on Sets/Maps:
- Line 141: `Array.from(this.matchingEntities)`
- Line 144: `Array.from(this.matchingEntities)`
- Line 199: `Array.from(this.messageHistory)`
- Line 489: `[...entity.children]`
- Line 502: `Array.from(this.activeEntities.values())`
- Line 605: `Array.from(this.query.getEntities())`
- Line 835: `[...this._systems, ...this._fixedUpdateSystems]`

**Impact:** Creates garbage on every call, especially problematic in hot paths like system execution.

---

### 14. **Systems Sorted on Every Creation** (src/engine.ts:702)

```typescript
createSystem(...): System<C> {
    // ... add system to array
    this.sortSystems();  // ← Full sort every time
    return system;
}

private sortSystems(): void {
    this._systems.sort((a, b) => b.priority - a.priority);
    this._fixedUpdateSystems.sort((a, b) => b.priority - a.priority);
}
```

**Problem:**
- Sorts both arrays even if only one changed
- Could sort once before first update instead
- O(n log n) on every system creation

---

### 15. **Legacy Method Indicates Technical Debt** (src/engine.ts:706-718)

```typescript
// Backwards compatible system creation (for old tests)
createSystemLegacy<C extends any[] = any[]>(
    components: ComponentIdentifier[],
    options: SystemType<C>,
    isFixedUpdate: boolean = false
): System<C> {
    return this.createSystem(
        'LegacySystem',
        { all: components },
        options,
        isFixedUpdate
    );
}
```

**Smell:** Keeping legacy APIs for backwards compatibility increases maintenance burden.

---

### 16. **Unused Type Definitions**

- `Scene` interface (definitions.ts:124-129) - defined but never used
- `Archetype` interface (definitions.ts:111-116) - defined but archetype system not implemented

**Impact:** Dead code confuses readers and suggests incomplete features.

---

### 17. **Awkward Validator Return Type**

```typescript
interface ComponentValidator<T = any> {
    validate(component: T): boolean | string;  // ← true = valid, string = error
}
```

**Problems:**
- Mixing success boolean with error string is confusing
- Callers must check both type and truthiness
- Inconsistent with typical error handling patterns

**Better:**
```typescript
interface ValidationResult {
    valid: boolean;
    error?: string;
}
```

---

### 18. **Type Casting for Hierarchy Operations**

Heavy use of type assertions in parent/child methods:
```typescript
setParent(parent: EntityDef | null): this {
    if (this._parent) {
        (this._parent as Entity)._children.delete(this);  // ← Line 370
    }
    this._parent = parent as Entity;  // ← Line 373
    if (this._parent) {
        (this._parent as Entity)._children.add(this);  // ← Line 376
    }
}
```

**Smell:** Interface (`EntityDef`) doesn't match internal implementation needs.

---

### 19. **Potential Memory Leak in History**

Both `MessageBus` and `EventEmitter` store unbounded history if events fire rapidly:

```typescript
publish(messageType: string, data: any, sender?: string): void {
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.maxHistorySize) {
        this.messageHistory.shift();  // ← Only removes ONE item
    }
}
```

**Problem:** If 100 messages arrive in one tick, history grows by 99 items, only 1 removed.

**Fix:** Use `while` or calculate how many to remove:
```typescript
while (this.messageHistory.length > this.maxHistorySize) {
    this.messageHistory.shift();
}
```

---

### 20. **Error Handling Inconsistency**

Some methods throw on error:
- `Entity.getComponent()` - throws if not found (line 334)
- `Entity.addComponent()` - throws on validation failure (line 302)

Others return null/false:
- `Engine.createFromPrefab()` - returns null if prefab not found (line 758)
- `Engine.restoreSnapshot()` - returns false if snapshot not found (line 860)

**Impact:** Callers can't predict error handling strategy, leading to bugs.

---

## Test Coverage Gaps

### 21. **Tests Don't Validate Core Functionality**

- Component validation tests (line 90-97, 399-411) only test validators directly, not through `addComponent()`
  - This is why the broken validation logic wasn't caught
- Snapshot restore test (line 333-343) only creates snapshot, doesn't verify restoration
- No tests for error conditions (invalid component indices, missing prefabs, etc.)
- No tests for circular parent-child relationships
- No tests for fixed update spiral of death scenario
- No tests for pool size growth
- No integration tests for serialization round-trips

---

## Summary

**Critical Issues:** 4
**High Priority:** 2
**Medium Priority:** 4
**Code Smells:** 14

### Recommendations Priority

1. **Immediate:** Fix component validation logic (Bug #1) - currently broken
2. **Immediate:** Fix or remove `restoreSnapshot()` (Bug #2) - claims to work but doesn't
3. **High:** Add max iterations to fixed update loop (Bug #4) - can freeze app
4. **High:** Fix symbol serialization (Bug #3) - breaks entire serialization system
5. **Medium:** Add comprehensive integration tests
6. **Medium:** Extract constants for magic numbers
7. **Medium:** Refactor God class into smaller, focused classes
8. **Low:** Clean up unused interfaces and legacy methods

### Testing Recommendations

- Add tests that actually call `entity.addComponent()` with invalid data
- Add serialization round-trip tests
- Add tests for edge cases (huge deltaTime, circular refs, etc.)
- Add performance regression tests
- Test error handling paths, not just happy paths
