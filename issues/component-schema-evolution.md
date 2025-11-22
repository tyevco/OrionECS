# Component Schema Evolution & Migration

**Milestone:** v0.6.0 - Production Hardening
**Priority:** High
**Labels:** enhancement, production, versioning
**Impact:** Production Readiness, Maintainability, User Experience

## Description

Implement component schema versioning and migration system to handle evolving component definitions across game versions. Allow developers to update component structures while maintaining compatibility with existing save files and serialized data.

## Goals

- Version component schemas
- Automatically migrate old data to new schemas
- Maintain backward compatibility with save files
- Provide migration validation and testing
- Support complex schema transformations
- Enable gradual migration strategies

## Use Cases

- **Adding Fields:** Add new component properties with defaults
- **Removing Fields:** Remove deprecated properties
- **Renaming Fields:** Rename properties without breaking saves
- **Type Changes:** Change property types (string to number, etc.)
- **Restructuring:** Split/merge components
- **Game Updates:** Update game without breaking player saves
- **Data Migration:** Migrate from old game versions to new

## Subtasks

### 1. Design Schema Versioning System
- [ ] Define schema version format
- [ ] Plan version tracking mechanism
- [ ] Design migration pipeline
- [ ] Define migration DSL/API
- [ ] Plan validation strategy

### 2. Implement Schema Version Tracking
- [ ] Add `@version` decorator for components
- [ ] Track schema version in metadata
- [ ] Detect version mismatches on deserialize
- [ ] Store version in serialized data
- [ ] Version comparison utilities
- [ ] Automatic version bump detection

### 3. Create Migration Framework
- [ ] Define `Migration` interface
- [ ] Implement migration registry
- [ ] Support sequential migrations (v1→v2→v3)
- [ ] Enable migration composition
- [ ] Add migration validation
- [ ] Track applied migrations

### 4. Implement Migration Types
- [ ] **Add Field** - Add new property with default value
- [ ] **Remove Field** - Remove property
- [ ] **Rename Field** - Rename property
- [ ] **Transform Field** - Change type or format
- [ ] **Split Component** - Split into multiple components
- [ ] **Merge Components** - Combine components
- [ ] **Custom Migration** - User-defined transformation

### 5. Add Migration DSL
- [ ] Fluent migration builder API
- [ ] Declarative migration syntax
- [ ] Type-safe migrations
- [ ] Migration chaining
- [ ] Conditional migrations
- [ ] Rollback support

### 6. Implement Automatic Migrations
- [ ] Detect schema changes automatically
- [ ] Generate simple migrations
- [ ] Infer default values for new fields
- [ ] Warn about breaking changes
- [ ] Suggest migration strategies
- [ ] Auto-generate migration code

### 7. Add Migration Validation
- [ ] Validate migration correctness
- [ ] Test migrations on sample data
- [ ] Detect data loss
- [ ] Check type compatibility
- [ ] Verify required fields
- [ ] Integration test generation

### 8. Implement Migration Execution
- [ ] Execute migrations on deserialization
- [ ] Batch migration for performance
- [ ] Incremental migration support
- [ ] Migration error handling
- [ ] Migration logging and reporting
- [ ] Dry-run mode

### 9. Add Backward Compatibility
- [ ] Maintain old schema support
- [ ] Gradual deprecation
- [ ] Version negotiation
- [ ] Fallback strategies
- [ ] Compatibility mode
- [ ] Legacy data support

### 10. Create Migration Tools
- [ ] CLI migration generator
- [ ] Migration test harness
- [ ] Schema diff tool
- [ ] Migration validator
- [ ] Data migration utility
- [ ] Version upgrade assistant

### 11. Implement Save File Versioning
- [ ] Version entire save files
- [ ] Track component versions in saves
- [ ] Detect incompatible saves
- [ ] Migrate saves on load
- [ ] Save backup before migration
- [ ] Migration success/failure reporting

### 12. Add Schema Registry
- [ ] Central schema registry
- [ ] Schema publishing
- [ ] Schema validation
- [ ] Schema documentation
- [ ] Schema versioning history
- [ ] Schema change notifications

### 13. Create Migration Documentation
- [ ] Write migration guide
- [ ] Document migration patterns
- [ ] Add migration examples
- [ ] Create troubleshooting guide
- [ ] Document breaking changes
- [ ] Best practices guide

### 14. Testing
- [ ] Unit tests for migrations
- [ ] Integration tests for schema evolution
- [ ] Test migration chains
- [ ] Test data preservation
- [ ] Performance tests for large migrations
- [ ] Backward compatibility tests

## Success Criteria

- [ ] Component schemas can evolve without breaking saves
- [ ] Migrations are easy to write and test
- [ ] Automatic migrations work for simple changes
- [ ] Migration validation catches errors
- [ ] Save files migrate transparently
- [ ] Backward compatibility maintained
- [ ] Documentation is comprehensive
- [ ] Tools support development workflow

## Implementation Notes

**Schema Versioning:**
```typescript
import { version, migrate } from 'orion-ecs/schema';

// Version 1
@version(1)
class Player {
  constructor(
    public health: number = 100
  ) {}
}

// Version 2 - Add new field
@version(2)
@migrate(1, {
  addField: {
    maxHealth: 100 // Default value
  }
})
class Player {
  constructor(
    public health: number = 100,
    public maxHealth: number = 100
  ) {}
}

// Version 3 - Rename field
@version(3)
@migrate(2, {
  renameField: {
    health: 'currentHealth'
  }
})
class Player {
  constructor(
    public currentHealth: number = 100,
    public maxHealth: number = 100
  ) {}
}
```

**Migration Builder API:**
```typescript
import { createMigration } from 'orion-ecs/schema';

// Programmatic migration
const playerMigration = createMigration('Player', 1, 2)
  .addField('maxHealth', 100)
  .addField('armor', 0)
  .transform('health', (value) => Math.min(value, 100))
  .build();

// Register migration
engine.registerMigration(playerMigration);
```

**Complex Migration:**
```typescript
// Split component into two
const splitMigration = createMigration('Transform', 2, 3)
  .split({
    from: 'Transform',
    to: [
      {
        component: 'Position',
        fields: ['x', 'y']
      },
      {
        component: 'Rotation',
        fields: ['angle']
      }
    ]
  })
  .build();

// Merge components
const mergeMigration = createMigration('Character', 3, 4)
  .merge({
    from: ['Health', 'Armor'],
    to: 'Vitals',
    transform: (health, armor) => ({
      currentHealth: health.current,
      maxHealth: health.max,
      armorValue: armor.value
    })
  })
  .build();
```

**Custom Migration:**
```typescript
const customMigration = createMigration('Inventory', 4, 5)
  .custom((oldData) => {
    // Complex transformation logic
    const newData = {
      items: oldData.items.map(item => ({
        id: item.itemId,
        quantity: item.count,
        equipped: item.isEquipped || false
      })),
      capacity: oldData.maxItems || 20,
      gold: oldData.currency?.gold || 0
    };
    return newData;
  })
  .build();
```

**Migration Testing:**
```typescript
import { testMigration } from 'orion-ecs/schema';

// Test migration
testMigration(playerMigration, {
  input: { health: 75 },
  expected: { currentHealth: 75, maxHealth: 100, armor: 0 },
  validate: (output) => {
    expect(output.currentHealth).toBeLessThanOrEqual(output.maxHealth);
  }
});

// Test migration chain
testMigrationChain('Player', [
  { version: 1, data: { health: 75 } },
  { version: 2, data: { health: 75, maxHealth: 100 } },
  { version: 3, data: { currentHealth: 75, maxHealth: 100 } }
]);
```

**Automatic Migration Detection:**
```typescript
// CLI tool detects schema changes
$ orion schema:diff v0.1.0 v0.2.0

Changes detected in Player component:
  + Added field: maxHealth (number)
  ~ Renamed field: health → currentHealth

Suggested migration:

  @version(3)
  @migrate(2, {
    addField: { maxHealth: 100 },
    renameField: { health: 'currentHealth' }
  })

Generate migration? (Y/n)
```

**Save File Migration:**
```typescript
// Automatic migration on load
const saveData = loadFromFile('save.json');
// {
//   version: 1,
//   entities: [...]
// }

// Engine detects old version and migrates
const world = engine.deserialize(saveData);
// Migrations applied automatically
// Save file upgraded to version 3

// Optional: Save migrated data
if (world.wasMigrated()) {
  console.log('Save file migrated from v1 to v3');

  // Save upgraded version
  const upgradedData = engine.serialize();
  saveToFile('save.json', upgradedData);
}
```

**Migration with Validation:**
```typescript
const migration = createMigration('Player', 2, 3)
  .addField('maxHealth', 100)
  .validate((data) => {
    if (data.currentHealth > data.maxHealth) {
      throw new Error('currentHealth cannot exceed maxHealth');
    }
    if (data.maxHealth <= 0) {
      throw new Error('maxHealth must be positive');
    }
  })
  .onError('warn') // 'throw' | 'warn' | 'skip'
  .build();
```

**Migration Events:**
```typescript
// Listen for migration events
engine.on('migrationStarted', ({ component, from, to }) => {
  console.log(`Migrating ${component} from v${from} to v${to}`);
});

engine.on('migrationCompleted', ({ component, count, duration }) => {
  console.log(`Migrated ${count} ${component} components in ${duration}ms`);
});

engine.on('migrationFailed', ({ component, error, data }) => {
  console.error(`Migration failed for ${component}:`, error);
  // Optionally handle failure
});
```

## Related Issues

- Multiple World/Scene Support (new issue - scene serialization needs this)
- High-Level Save/Load System (new issue - save system needs migrations)
- #52 - Component Change Events (change events can trigger migrations)
- API Documentation Generation (new issue - document schema versions)

## References

- [Database Migrations](https://en.wikipedia.org/wiki/Schema_migration)
- [Knex.js Migrations](https://knexjs.org/guide/migrations.html)
- [Django Migrations](https://docs.djangoproject.com/en/4.0/topics/migrations/)
- [Protocol Buffers Schema Evolution](https://developers.google.com/protocol-buffers/docs/proto3#updating)
- [JSON Schema Versioning](https://json-schema.org/understanding-json-schema/reference/schema.html)
