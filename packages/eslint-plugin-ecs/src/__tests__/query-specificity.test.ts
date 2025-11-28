import { RuleTester } from '@typescript-eslint/rule-tester';

import { querySpecificity } from '../rules/query-specificity';

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

ruleTester.run('query-specificity', querySpecificity, {
    valid: [
        // Specific query with components
        {
            code: `
                engine.createSystem('Movement', { all: [Position, Velocity] }, {
                    act: (entity, position, velocity) => {
                        position.x += velocity.x;
                    }
                });
            `,
        },
        // Query with tags
        {
            code: `
                engine.createSystem('ActiveEntities', { tags: ['active'] }, {
                    act: (entity) => {
                        console.log(entity.name);
                    }
                });
            `,
        },
        // Empty query with after hook (intentional pattern)
        {
            code: `
                engine.createSystem('Cleanup', { all: [] }, {
                    after: () => {
                        cleanupDeadEntities();
                    }
                });
            `,
        },
        // Empty query with before hook
        {
            code: `
                engine.createSystem('Setup', { all: [] }, {
                    before: () => {
                        prepareFrame();
                    }
                });
            `,
        },
        // Query with none filter
        {
            code: `
                engine.createSystem('NonFrozen', { all: [Position], none: [Frozen] }, {
                    act: (entity, position) => {
                        position.x++;
                    }
                });
            `,
        },
        // Allow empty queries option
        {
            code: `
                engine.createSystem('Broadcast', { all: [] }, {
                    act: () => {}
                });
            `,
            options: [{ allowEmptyQueries: true }],
        },
        // Query with any - needs matching param count for components
        {
            code: `
                engine.createSystem('Damageable', { any: [Health, Shield] }, {
                    act: (entity, health, shield) => {
                        console.log(health || shield);
                    }
                });
            `,
        },
        // Query with withoutTags
        {
            code: `
                engine.createSystem('EnabledOnly', { all: [Position], withoutTags: ['disabled'] }, {
                    act: (entity, position) => {
                        position.x++;
                    }
                });
            `,
        },
        // All parameters used
        {
            code: `
                engine.createSystem('Physics', { all: [Position, Velocity, Mass] }, {
                    act: (entity, position, velocity, mass) => {
                        velocity.y += 9.8 / mass.value;
                        position.x += velocity.x;
                    }
                });
            `,
        },
    ],
    invalid: [
        // Empty query without hooks
        {
            code: `
                engine.createSystem('AllEntities', { all: [] }, {
                    act: (entity) => {
                        console.log(entity);
                    }
                });
            `,
            errors: [{ messageId: 'emptyQuery' }],
        },
        // Empty query - no all, any, none, or tags
        {
            code: `
                engine.createSystem('Everything', {}, {
                    act: (entity) => {
                        entity.queueFree();
                    }
                });
            `,
            errors: [{ messageId: 'emptyQuery' }],
        },
        // Empty act callback with hooks
        {
            code: `
                engine.createSystem('BatchProcessor', { all: [Position, Velocity] }, {
                    act: (entity) => {},
                    after: () => {
                        processBatch();
                    }
                });
            `,
            errors: [{ messageId: 'unusedQueryResults' }, { messageId: 'emptyActCallback' }],
        },
        // Unused query results
        {
            code: `
                engine.createSystem('Movement', { all: [Position, Velocity, Rotation] }, {
                    act: (entity, position) => {
                        position.x++;
                    }
                });
            `,
            errors: [{ messageId: 'unusedQueryResults' }],
        },
        // Query with only entity param but multiple components
        {
            code: `
                engine.createSystem('AllComponents', { all: [Position, Velocity] }, {
                    act: (entity) => {
                        entity.queueFree();
                    }
                });
            `,
            errors: [{ messageId: 'unusedQueryResults' }],
        },
        // Empty return in act - also reports unused query results since position isn't used
        {
            code: `
                engine.createSystem('NoOp', { all: [Position] }, {
                    act: (entity) => { return; },
                    before: () => { setup(); }
                });
            `,
            errors: [{ messageId: 'unusedQueryResults' }, { messageId: 'emptyActCallback' }],
        },
    ],
});
