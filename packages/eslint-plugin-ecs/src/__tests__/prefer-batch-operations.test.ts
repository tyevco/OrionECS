import { RuleTester } from '@typescript-eslint/rule-tester';

import { preferBatchOperations } from '../rules/prefer-batch-operations';

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

ruleTester.run('prefer-batch-operations', preferBatchOperations, {
    valid: [
        // Small loops (below threshold)
        {
            code: `
                for (let i = 0; i < 3; i++) {
                    engine.createEntity();
                }
            `,
        },
        // Already wrapped in batch
        {
            code: `
                engine.batch(() => {
                    for (let i = 0; i < 100; i++) {
                        engine.createEntity();
                    }
                });
            `,
        },
        // Already wrapped in transaction
        {
            code: `
                engine.beginTransaction();
                for (let i = 0; i < 100; i++) {
                    entity.addComponent(Position, i, i);
                }
                engine.commitTransaction();
            `,
        },
        // Inside system callback (handled by different rule)
        {
            code: `
                engine.createSystem('Spawner', { all: [SpawnRequest] }, {
                    act: (entity) => {
                        for (let i = 0; i < 100; i++) {
                            engine.createEntity();
                        }
                    }
                });
            `,
        },
        // Single entity creation (not in loop pattern)
        {
            code: `
                const entity = engine.createEntity();
                entity.addComponent(Position, 0, 0);
            `,
        },
        // Using createEntities (bulk creation)
        {
            code: `
                const entities = engine.createEntities(100);
            `,
        },
        // Low iteration count loop
        {
            code: `
                for (let i = 0; i < 2; i++) {
                    engine.createEntity();
                }
            `,
        },
        // Custom threshold - below it
        {
            code: `
                for (let i = 0; i < 10; i++) {
                    engine.createEntity();
                }
            `,
            options: [{ threshold: 15 }],
        },
    ],
    invalid: [
        // Basic case - many entity creations
        {
            code: `
                for (let i = 0; i < 100; i++) {
                    engine.createEntity();
                }
            `,
            errors: [{ messageId: 'preferBulkCreate' }],
        },
        // For-of loop with entity creation
        {
            code: `
                for (const item of items) {
                    const entity = engine.createEntity();
                    entity.addComponent(Position, item.x, item.y);
                }
            `,
            errors: [{ messageId: 'preferBatch' }],
        },
        // While loop with entity creation
        {
            code: `
                let count = 0;
                while (count < 50) {
                    engine.createEntity();
                    count++;
                }
            `,
            errors: [{ messageId: 'preferBatch' }],
        },
        // Multiple component operations
        {
            code: `
                for (const entity of entities) {
                    entity.addComponent(Position, 0, 0);
                    entity.addComponent(Velocity, 1, 1);
                }
            `,
            errors: [{ messageId: 'preferTransaction' }],
        },
        // Do-while loop
        {
            code: `
                let i = 0;
                do {
                    engine.createEntity();
                    i++;
                } while (i < 20);
            `,
            errors: [{ messageId: 'preferBatch' }],
        },
        // Array.length iteration
        {
            code: `
                for (let i = 0; i < positions.length; i++) {
                    const entity = engine.createEntity();
                    entity.addComponent(Position, positions[i].x, positions[i].y);
                }
            `,
            errors: [{ messageId: 'preferBatch' }],
        },
        // Custom lower threshold
        {
            code: `
                for (let i = 0; i < 5; i++) {
                    engine.createEntity();
                }
            `,
            options: [{ threshold: 3 }],
            errors: [{ messageId: 'preferBulkCreate' }],
        },
        // Multiple createEntity calls per iteration
        {
            code: `
                for (let i = 0; i < 10; i++) {
                    engine.createEntity();
                    engine.createEntity();
                }
            `,
            errors: [{ messageId: 'preferBatch' }],
        },
        // Component removal in loop
        {
            code: `
                for (const entity of deadEntities) {
                    entity.removeComponent(Health);
                    entity.removeComponent(Velocity);
                }
            `,
            errors: [{ messageId: 'preferTransaction' }],
        },
        // For-in loop
        {
            code: `
                for (const key in entityMap) {
                    engine.createEntity();
                }
            `,
            errors: [{ messageId: 'preferBatch' }],
        },
    ],
});
