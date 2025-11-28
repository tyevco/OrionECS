import { RuleTester } from '@typescript-eslint/rule-tester';

import { hierarchyCyclePrevention } from '../rules/hierarchy-cycle-prevention';

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

ruleTester.run('hierarchy-cycle-prevention', hierarchyCyclePrevention, {
    valid: [
        // Simple parent-child
        {
            code: `
                const parent = engine.createEntity('Parent');
                const child = engine.createEntity('Child');
                parent.addChild(child);
            `,
        },
        // Multiple children
        {
            code: `
                const parent = engine.createEntity('Parent');
                const child1 = engine.createEntity('Child1');
                const child2 = engine.createEntity('Child2');
                parent.addChild(child1);
                parent.addChild(child2);
            `,
        },
        // Using setParent
        {
            code: `
                const parent = engine.createEntity('Parent');
                const child = engine.createEntity('Child');
                child.setParent(parent);
            `,
        },
        // Removing parent (null)
        {
            code: `
                const child = engine.createEntity('Child');
                child.setParent(null);
            `,
        },
        // Deep hierarchy (no cycle)
        {
            code: `
                const a = engine.createEntity('A');
                const b = engine.createEntity('B');
                const c = engine.createEntity('C');
                const d = engine.createEntity('D');
                a.addChild(b);
                b.addChild(c);
                c.addChild(d);
            `,
        },
        // Multiple independent hierarchies
        {
            code: `
                const parent1 = engine.createEntity('Parent1');
                const child1 = engine.createEntity('Child1');
                const parent2 = engine.createEntity('Parent2');
                const child2 = engine.createEntity('Child2');
                parent1.addChild(child1);
                parent2.addChild(child2);
            `,
        },
        // Disable reverse relationship check
        {
            code: `
                const a = engine.createEntity('A');
                const b = engine.createEntity('B');
                a.addChild(b);
                b.addChild(a);
            `,
            options: [{ checkReverseRelationships: false }],
        },
    ],
    invalid: [
        // Self-reference with addChild
        {
            code: `
                const entity = engine.createEntity('Entity');
                entity.addChild(entity);
            `,
            errors: [{ messageId: 'selfReference' }],
        },
        // Self-reference with setParent
        {
            code: `
                const entity = engine.createEntity('Entity');
                entity.setParent(entity);
            `,
            errors: [{ messageId: 'selfReference' }],
        },
        // Direct reverse relationship
        {
            code: `
                const parent = engine.createEntity('Parent');
                const child = engine.createEntity('Child');
                parent.addChild(child);
                child.addChild(parent);
            `,
            errors: [{ messageId: 'reverseRelationship' }],
        },
        // Reverse with setParent
        {
            code: `
                const a = engine.createEntity('A');
                const b = engine.createEntity('B');
                a.addChild(b);
                a.setParent(b);
            `,
            errors: [{ messageId: 'reverseRelationship' }],
        },
        // Cycle of 3
        {
            code: `
                const a = engine.createEntity('A');
                const b = engine.createEntity('B');
                const c = engine.createEntity('C');
                a.addChild(b);
                b.addChild(c);
                c.addChild(a);
            `,
            errors: [{ messageId: 'potentialCycle' }],
        },
        // Cycle of 4
        {
            code: `
                const a = engine.createEntity('A');
                const b = engine.createEntity('B');
                const c = engine.createEntity('C');
                const d = engine.createEntity('D');
                a.addChild(b);
                b.addChild(c);
                c.addChild(d);
                d.addChild(a);
            `,
            errors: [{ messageId: 'potentialCycle' }],
        },
        // Mixed addChild and setParent cycle
        {
            code: `
                const a = engine.createEntity('A');
                const b = engine.createEntity('B');
                const c = engine.createEntity('C');
                a.addChild(b);
                c.setParent(b);
                a.setParent(c);
            `,
            errors: [{ messageId: 'potentialCycle' }],
        },
    ],
});
