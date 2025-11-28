import { RuleTester } from '@typescript-eslint/rule-tester';
import { queryValidator } from '../rules/query-validator';

const ruleTester = new RuleTester();

ruleTester.run('query-validator', queryValidator, {
    valid: [
        // Simple valid query with all
        {
            code: `
        class Position {}
        class Velocity {}
        engine.createSystem('Movement', {
          all: [Position, Velocity]
        }, {
          act: (entity, pos, vel) => {}
        });
      `,
        },
        // Query with all and none (different components)
        {
            code: `
        class Position {}
        class Velocity {}
        class Frozen {}
        engine.createSystem('Movement', {
          all: [Position, Velocity],
          none: [Frozen]
        }, {
          act: (entity, pos, vel) => {}
        });
      `,
        },
        // Query with tags and withoutTags (different tags)
        {
            code: `
        class Position {}
        engine.createSystem('ActiveEntities', {
          all: [Position],
          tags: ['active', 'player'],
          withoutTags: ['disabled', 'paused']
        }, {
          act: (entity, pos) => {}
        });
      `,
        },
        // Query with non-conflicting components
        {
            code: `
        class Position {}
        class Health {}
        class Armor {}
        engine.registerComponentValidator(Health, { conflicts: [Ghost] });
        engine.createSystem('Tank', {
          all: [Position, Health, Armor]
        }, {
          act: (entity, pos, health, armor) => {}
        });
      `,
        },
        // Query with only tags
        {
            code: `
        engine.createSystem('TaggedEntities', {
          tags: ['active']
        }, {
          act: (entity) => {}
        });
      `,
        },
        // Empty query (matches all entities)
        {
            code: `
        engine.createSystem('AllEntities', {}, {
          act: (entity) => {}
        });
      `,
        },
        // Conflicts from options - but not in same all array
        {
            code: `
        class Health {}
        class Ghost {}
        engine.createSystem('GhostSystem', {
          all: [Ghost],
          none: [Health]
        }, {
          act: (entity, ghost) => {}
        });
      `,
            options: [{ conflicts: { Ghost: ['Health'] } }],
        },
    ],
    invalid: [
        // Component in both all and none
        {
            code: `
        class Position {}
        class Velocity {}
        engine.createSystem('Impossible', {
          all: [Position, Velocity],
          none: [Position]
        }, {
          act: (entity, pos, vel) => {}
        });
      `,
            errors: [{ messageId: 'componentInAllAndNone' }],
        },
        // Tag in both tags and withoutTags
        {
            code: `
        class Position {}
        engine.createSystem('ImpossibleTags', {
          all: [Position],
          tags: ['active'],
          withoutTags: ['active']
        }, {
          act: (entity, pos) => {}
        });
      `,
            errors: [{ messageId: 'tagInBothTagArrays' }],
        },
        // Duplicate component in all
        {
            code: `
        class Position {}
        class Velocity {}
        engine.createSystem('DuplicateAll', {
          all: [Position, Velocity, Position]
        }, {
          act: (entity, pos, vel) => {}
        });
      `,
            errors: [{ messageId: 'duplicateComponentInAll' }],
        },
        // Duplicate component in none
        {
            code: `
        class Position {}
        class Frozen {}
        engine.createSystem('DuplicateNone', {
          all: [Position],
          none: [Frozen, Frozen]
        }, {
          act: (entity, pos) => {}
        });
      `,
            errors: [{ messageId: 'duplicateComponentInNone' }],
        },
        // Duplicate tag
        {
            code: `
        class Position {}
        engine.createSystem('DuplicateTag', {
          all: [Position],
          tags: ['active', 'player', 'active']
        }, {
          act: (entity, pos) => {}
        });
      `,
            errors: [{ messageId: 'duplicateTag' }],
        },
        // Duplicate withoutTag
        {
            code: `
        class Position {}
        engine.createSystem('DuplicateWithoutTag', {
          all: [Position],
          withoutTags: ['disabled', 'disabled']
        }, {
          act: (entity, pos) => {}
        });
      `,
            errors: [{ messageId: 'duplicateWithoutTag' }],
        },
        // Conflicting components in all (detected from registerComponentValidator)
        {
            code: `
        class Health {}
        class Ghost {}
        engine.registerComponentValidator(Ghost, { conflicts: [Health] });
        engine.createSystem('ImpossibleConflict', {
          all: [Health, Ghost]
        }, {
          act: (entity, health, ghost) => {}
        });
      `,
            errors: [{ messageId: 'conflictingComponentsInAll' }],
        },
        // Conflicting components in all (from options)
        {
            code: `
        class Solid {}
        class Ghost {}
        engine.createSystem('ImpossibleConflict', {
          all: [Solid, Ghost]
        }, {
          act: (entity, solid, ghost) => {}
        });
      `,
            options: [{ conflicts: { Ghost: ['Solid'] } }],
            errors: [{ messageId: 'conflictingComponentsInAll' }],
        },
        // Multiple issues
        {
            code: `
        class Position {}
        class Velocity {}
        engine.createSystem('MultipleIssues', {
          all: [Position, Position, Velocity],
          none: [Velocity],
          tags: ['active', 'active'],
          withoutTags: ['active']
        }, {
          act: (entity, pos, vel) => {}
        });
      `,
            errors: [
                { messageId: 'componentInAllAndNone' },
                { messageId: 'tagInBothTagArrays' },
                { messageId: 'tagInBothTagArrays' }, // Both 'active' tags conflict with withoutTags
                { messageId: 'duplicateComponentInAll' },
                { messageId: 'duplicateTag' },
            ],
        },
    ],
});
