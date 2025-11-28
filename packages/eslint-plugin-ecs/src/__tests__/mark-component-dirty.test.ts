import { RuleTester } from '@typescript-eslint/rule-tester';

import { markComponentDirty } from '../rules/mark-component-dirty';

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

ruleTester.run('mark-component-dirty', markComponentDirty, {
    valid: [
        // Properly marks dirty
        {
            code: `
                const position = entity.getComponent(Position);
                position.x = 10;
                entity.markComponentDirty(Position);
            `,
        },
        // Multiple modifications, one mark dirty
        {
            code: `
                const position = entity.getComponent(Position);
                position.x = 10;
                position.y = 20;
                entity.markComponentDirty(Position);
            `,
        },
        // Inside system with mark dirty
        {
            code: `
                engine.createSystem('Movement', { all: [Position] }, {
                    act: (entity, position) => {
                        const vel = entity.getComponent(Velocity);
                        vel.x = 5;
                        entity.markComponentDirty(Velocity);
                    }
                });
            `,
        },
        // Skip check in systems when disabled
        {
            code: `
                engine.createSystem('Movement', { all: [Position] }, {
                    act: (entity, position) => {
                        const vel = entity.getComponent(Velocity);
                        vel.x = 5;
                    }
                });
            `,
            options: [{ checkInSystems: false }],
        },
        // Not a component variable
        {
            code: `
                const obj = { x: 0 };
                obj.x = 10;
            `,
        },
        // Different variable modified
        {
            code: `
                const position = entity.getComponent(Position);
                const other = { x: 0 };
                other.x = 10;
            `,
        },
        // Mark dirty comes after in same block
        {
            code: `
                function update() {
                    const health = entity.getComponent(Health);
                    health.current -= 10;
                    doSomething();
                    entity.markComponentDirty(Health);
                }
            `,
        },
    ],
    invalid: [
        // Missing mark dirty
        {
            code: `
                const position = entity.getComponent(Position);
                position.x = 10;
            `,
            errors: [{ messageId: 'missingDirtyMark', suggestions: 1 }],
        },
        // Compound assignment without mark dirty
        {
            code: `
                const position = entity.getComponent(Position);
                position.x += 5;
            `,
            errors: [{ messageId: 'missingDirtyMark', suggestions: 1 }],
        },
        // Decrement without mark dirty
        {
            code: `
                const health = entity.getComponent(Health);
                health.current--;
            `,
            errors: [{ messageId: 'missingDirtyMark', suggestions: 1 }],
        },
        // Increment without mark dirty
        {
            code: `
                const counter = entity.getComponent(Counter);
                counter.value++;
            `,
            errors: [{ messageId: 'missingDirtyMark', suggestions: 1 }],
        },
        // Multiple properties modified
        {
            code: `
                const position = entity.getComponent(Position);
                position.x = 10;
                position.y = 20;
            `,
            errors: [
                { messageId: 'missingDirtyMark', suggestions: 1 },
                { messageId: 'missingDirtyMark', suggestions: 1 },
            ],
        },
        // Inside system callback
        {
            code: `
                engine.createSystem('Damage', { all: [Health] }, {
                    act: (entity, health) => {
                        const pos = entity.getComponent(Position);
                        pos.x = 0;
                    }
                });
            `,
            errors: [{ messageId: 'missingDirtyMark', suggestions: 1 }],
        },
        // Subtract assignment
        {
            code: `
                const health = entity.getComponent(Health);
                health.current -= damage;
            `,
            errors: [{ messageId: 'missingDirtyMark', suggestions: 1 }],
        },
        // Multiply assignment
        {
            code: `
                const velocity = entity.getComponent(Velocity);
                velocity.x *= 0.99;
            `,
            errors: [{ messageId: 'missingDirtyMark', suggestions: 1 }],
        },
    ],
});
