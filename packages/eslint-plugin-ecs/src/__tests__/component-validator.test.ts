import { RuleTester } from '@typescript-eslint/rule-tester';
import { componentValidator } from '../rules/component-validator';

const ruleTester = new RuleTester();

ruleTester.run('component-validator', componentValidator, {
    valid: [
        // Valid validator with different dependencies and conflicts
        {
            code: `
        class Position {}
        class Velocity {}
        class Ghost {}
        engine.registerComponentValidator(Health, {
          validate: (c) => c.current >= 0,
          dependencies: [Position],
          conflicts: [Ghost]
        });
      `,
        },
        // Validator with only validate function
        {
            code: `
        engine.registerComponentValidator(Health, {
          validate: (c) => c.current >= 0
        });
      `,
        },
        // Validator with only dependencies
        {
            code: `
        class Position {}
        engine.registerComponentValidator(Health, {
          dependencies: [Position]
        });
      `,
        },
        // Validator with only conflicts
        {
            code: `
        class Ghost {}
        engine.registerComponentValidator(Health, {
          conflicts: [Ghost]
        });
      `,
        },
        // Multiple validators with non-circular dependencies
        {
            code: `
        class A {}
        class B {}
        class C {}
        engine.registerComponentValidator(A, { dependencies: [B] });
        engine.registerComponentValidator(B, { dependencies: [C] });
      `,
        },
    ],
    invalid: [
        // Self-dependency
        {
            code: `
        class Health {}
        engine.registerComponentValidator(Health, {
          dependencies: [Health]
        });
      `,
            errors: [{ messageId: 'selfDependency' }],
        },
        // Self-conflict
        {
            code: `
        class Health {}
        engine.registerComponentValidator(Health, {
          conflicts: [Health]
        });
      `,
            errors: [{ messageId: 'selfConflict' }],
        },
        // Dependency-conflict contradiction
        {
            code: `
        class Position {}
        engine.registerComponentValidator(Health, {
          dependencies: [Position],
          conflicts: [Position]
        });
      `,
            errors: [{ messageId: 'dependencyConflictContradiction' }],
        },
        // Duplicate dependency
        {
            code: `
        class Position {}
        engine.registerComponentValidator(Health, {
          dependencies: [Position, Position]
        });
      `,
            errors: [{ messageId: 'duplicateDependency' }],
        },
        // Duplicate conflict
        {
            code: `
        class Ghost {}
        engine.registerComponentValidator(Health, {
          conflicts: [Ghost, Ghost]
        });
      `,
            errors: [{ messageId: 'duplicateConflict' }],
        },
        // Circular dependency: A -> B -> A
        {
            code: `
        class A {}
        class B {}
        engine.registerComponentValidator(A, { dependencies: [B] });
        engine.registerComponentValidator(B, { dependencies: [A] });
      `,
            errors: [{ messageId: 'circularDependency' }],
        },
        // Circular dependency: A -> B -> C -> A
        {
            code: `
        class A {}
        class B {}
        class C {}
        engine.registerComponentValidator(A, { dependencies: [B] });
        engine.registerComponentValidator(B, { dependencies: [C] });
        engine.registerComponentValidator(C, { dependencies: [A] });
      `,
            errors: [{ messageId: 'circularDependency' }],
        },
        // Multiple issues in one validator
        {
            code: `
        class Health {}
        class Position {}
        engine.registerComponentValidator(Health, {
          dependencies: [Health, Position, Position],
          conflicts: [Health]
        });
      `,
            errors: [
                { messageId: 'dependencyConflictContradiction' },
                { messageId: 'selfDependency' },
                { messageId: 'duplicateDependency' },
                { messageId: 'selfConflict' },
            ],
        },
    ],
});
