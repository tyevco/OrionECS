import { RuleTester } from '@typescript-eslint/rule-tester';
import { componentOrder } from '../rules/component-order';

const ruleTester = new RuleTester();

ruleTester.run('component-order', componentOrder, {
    valid: [
        // Components added in correct order (dependency first)
        {
            code: `
        class Position {}
        class Velocity {}
        engine.registerComponentValidator(Velocity, { dependencies: [Position] });
        const entity = engine.createEntity();
        entity.addComponent(Position, 0, 0);
        entity.addComponent(Velocity, 1, 1);
      `,
        },
        // No dependencies defined - any order is fine
        {
            code: `
        class Position {}
        class Velocity {}
        const entity = engine.createEntity();
        entity.addComponent(Velocity, 1, 1);
        entity.addComponent(Position, 0, 0);
      `,
        },
        // Different entities are tracked independently - each needs its own dependencies
        {
            code: `
        class Position {}
        class Velocity {}
        engine.registerComponentValidator(Velocity, { dependencies: [Position] });
        const entity1 = engine.createEntity();
        const entity2 = engine.createEntity();
        entity1.addComponent(Position, 0, 0);
        entity1.addComponent(Velocity, 1, 1);
        entity2.addComponent(Position, 0, 0);
        entity2.addComponent(Velocity, 1, 1);
      `,
        },
        // No conflicts - components can coexist
        {
            code: `
        class Health {}
        class Armor {}
        engine.registerComponentValidator(Health, { conflicts: [Ghost] });
        const entity = engine.createEntity();
        entity.addComponent(Health, 100);
        entity.addComponent(Armor, 50);
      `,
        },
        // Dependencies from options
        {
            code: `
        class Position {}
        class Velocity {}
        const entity = engine.createEntity();
        entity.addComponent(Position, 0, 0);
        entity.addComponent(Velocity, 1, 1);
      `,
            options: [{ dependencies: { Velocity: ['Position'] } }],
        },
        // Chain of dependencies satisfied
        {
            code: `
        class A {}
        class B {}
        class C {}
        engine.registerComponentValidator(B, { dependencies: [A] });
        engine.registerComponentValidator(C, { dependencies: [B] });
        const entity = engine.createEntity();
        entity.addComponent(A);
        entity.addComponent(B);
        entity.addComponent(C);
      `,
        },
        // Multiple dependencies all satisfied
        {
            code: `
        class Position {}
        class Velocity {}
        class Movement {}
        engine.registerComponentValidator(Movement, { dependencies: [Position, Velocity] });
        const entity = engine.createEntity();
        entity.addComponent(Position, 0, 0);
        entity.addComponent(Velocity, 1, 1);
        entity.addComponent(Movement);
      `,
        },
        // Function scope resets - each function tracks independently
        {
            code: `
        class Position {}
        class Velocity {}
        engine.registerComponentValidator(Velocity, { dependencies: [Position] });
        function setup1() {
          const entity = engine.createEntity();
          entity.addComponent(Position, 0, 0);
          entity.addComponent(Velocity, 1, 1);
        }
        function setup2() {
          const entity = engine.createEntity();
          entity.addComponent(Position, 0, 0);
          entity.addComponent(Velocity, 1, 1);
        }
      `,
        },
    ],
    invalid: [
        // Missing dependency - Velocity added before Position
        {
            code: `
        class Position {}
        class Velocity {}
        engine.registerComponentValidator(Velocity, { dependencies: [Position] });
        const entity = engine.createEntity();
        entity.addComponent(Velocity, 1, 1);
      `,
            errors: [{ messageId: 'missingDependency' }],
        },
        // Dependency added after dependent component
        {
            code: `
        class Position {}
        class Velocity {}
        engine.registerComponentValidator(Velocity, { dependencies: [Position] });
        const entity = engine.createEntity();
        entity.addComponent(Velocity, 1, 1);
        entity.addComponent(Position, 0, 0);
      `,
            errors: [{ messageId: 'missingDependency' }],
        },
        // Conflicting components on same entity
        {
            code: `
        class Health {}
        class Ghost {}
        engine.registerComponentValidator(Ghost, { conflicts: [Health] });
        const entity = engine.createEntity();
        entity.addComponent(Health, 100);
        entity.addComponent(Ghost);
      `,
            errors: [{ messageId: 'conflictingComponent' }],
        },
        // Dependencies from options - missing
        {
            code: `
        class Position {}
        class Velocity {}
        const entity = engine.createEntity();
        entity.addComponent(Velocity, 1, 1);
      `,
            options: [{ dependencies: { Velocity: ['Position'] } }],
            errors: [{ messageId: 'missingDependency' }],
        },
        // Conflicts from options
        {
            code: `
        class Health {}
        class Ghost {}
        const entity = engine.createEntity();
        entity.addComponent(Health, 100);
        entity.addComponent(Ghost);
      `,
            options: [{ conflicts: { Ghost: ['Health'] } }],
            errors: [{ messageId: 'conflictingComponent' }],
        },
        // Chain dependency - C added without B
        {
            code: `
        class A {}
        class B {}
        class C {}
        engine.registerComponentValidator(B, { dependencies: [A] });
        engine.registerComponentValidator(C, { dependencies: [B] });
        const entity = engine.createEntity();
        entity.addComponent(A);
        entity.addComponent(C);
      `,
            errors: [{ messageId: 'missingDependency' }],
        },
        // Multiple missing dependencies
        {
            code: `
        class Position {}
        class Velocity {}
        class Movement {}
        engine.registerComponentValidator(Movement, { dependencies: [Position, Velocity] });
        const entity = engine.createEntity();
        entity.addComponent(Movement);
      `,
            errors: [{ messageId: 'missingDependency' }, { messageId: 'missingDependency' }],
        },
        // Multiple entities - one has wrong order
        {
            code: `
        class Position {}
        class Velocity {}
        engine.registerComponentValidator(Velocity, { dependencies: [Position] });
        function setup() {
          const entity1 = engine.createEntity();
          entity1.addComponent(Position, 0, 0);
          entity1.addComponent(Velocity, 1, 1);
          const entity2 = engine.createEntity();
          entity2.addComponent(Velocity, 1, 1);
        }
      `,
            errors: [{ messageId: 'missingDependency' }],
        },
    ],
});
