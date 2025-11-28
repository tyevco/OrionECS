import { RuleTester } from '@typescript-eslint/rule-tester';

import { entityUniqueNames } from '../rules/entity-unique-names';

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

ruleTester.run('entity-unique-names', entityUniqueNames, {
    valid: [
        // Unique entity names
        {
            code: `
                const player = engine.createEntity('Player');
                const enemy = engine.createEntity('Enemy');
            `,
        },
        // Using Date.now() for uniqueness
        {
            code: `
                const bullet = engine.createFromPrefab('Bullet', \`Bullet_\${Date.now()}\`);
            `,
        },
        // Using counter for uniqueness
        {
            code: `
                for (let i = 0; i < 10; i++) {
                    engine.createFromPrefab('Enemy', \`Enemy_\${i}\`);
                }
            `,
        },
        // Using uuid
        {
            code: `
                const entity = engine.createFromPrefab('Player', uuid());
            `,
        },
        // Using Math.random
        {
            code: `
                const entity = engine.createFromPrefab('Particle', 'Particle_' + Math.random());
            `,
        },
        // Using crypto.randomUUID
        {
            code: `
                const entity = engine.createFromPrefab('Item', crypto.randomUUID());
            `,
        },
        // Using variable passed directly - with uuid in name
        {
            code: `
                const uniqueId = uuid();
                engine.createFromPrefab('Enemy', uniqueId);
            `,
        },
        // No entity name (allowed)
        {
            code: `
                const entity = engine.createEntity();
            `,
        },
        // Disable prefab uniqueness check
        {
            code: `
                for (let i = 0; i < 10; i++) {
                    engine.createFromPrefab('Enemy', 'Enemy');
                }
            `,
            options: [{ enforcePrefabUniqueness: false }],
        },
        // Using nanoid
        {
            code: `
                engine.createFromPrefab('Item', nanoid());
            `,
        },
        // Index variable
        {
            code: `
                for (let idx = 0; idx < 10; idx++) {
                    engine.createFromPrefab('Enemy', 'Enemy_' + idx);
                }
            `,
        },
    ],
    invalid: [
        // Duplicate entity names
        {
            code: `
                const player1 = engine.createEntity('Player');
                const player2 = engine.createEntity('Player');
            `,
            errors: [{ messageId: 'duplicateName' }],
        },
        // Static name in loop
        {
            code: `
                for (let i = 0; i < 10; i++) {
                    engine.createFromPrefab('Bullet', 'Bullet');
                }
            `,
            errors: [{ messageId: 'staticPrefabName', suggestions: 1 }],
        },
        // Static name in while loop
        {
            code: `
                while (spawning) {
                    engine.createFromPrefab('Enemy', 'Enemy');
                }
            `,
            errors: [{ messageId: 'staticPrefabName', suggestions: 1 }],
        },
        // Static name in for-of loop
        {
            code: `
                for (const pos of positions) {
                    engine.createFromPrefab('Particle', 'Particle');
                }
            `,
            errors: [{ messageId: 'staticPrefabName', suggestions: 1 }],
        },
        // Multiple duplicates
        {
            code: `
                engine.createEntity('Enemy');
                engine.createEntity('Enemy');
                engine.createEntity('Enemy');
            `,
            errors: [{ messageId: 'duplicateName' }, { messageId: 'duplicateName' }],
        },
        // Static name in for-in loop
        {
            code: `
                for (const key in config) {
                    engine.createFromPrefab('Item', 'Item');
                }
            `,
            errors: [{ messageId: 'staticPrefabName', suggestions: 1 }],
        },
        // Do-while loop
        {
            code: `
                do {
                    engine.createFromPrefab('Bullet', 'Bullet');
                } while (firing);
            `,
            errors: [{ messageId: 'staticPrefabName', suggestions: 1 }],
        },
        // Variable that doesn't look unique
        {
            code: `
                const name = 'Enemy';
                engine.createFromPrefab('Enemy', name);
            `,
            errors: [{ messageId: 'suggestUniqueName' }],
        },
    ],
});
