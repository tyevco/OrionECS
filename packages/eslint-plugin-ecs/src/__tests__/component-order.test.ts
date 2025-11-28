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
        // Prefab with correct component order
        {
            code: `
        class Position {}
        class Velocity {}
        engine.registerComponentValidator(Velocity, { dependencies: [Position] });
        engine.registerPrefab('Player', {
          name: 'Player',
          components: [
            { type: Position, args: [0, 0] },
            { type: Velocity, args: [1, 1] }
          ]
        });
      `,
        },
        // Prefab with no dependencies - any order is fine
        {
            code: `
        class Position {}
        class Health {}
        engine.registerPrefab('Enemy', {
          name: 'Enemy',
          components: [
            { type: Health, args: [100] },
            { type: Position, args: [0, 0] }
          ]
        });
      `,
        },
        // Prefab with non-conflicting components
        {
            code: `
        class Position {}
        class Health {}
        class Armor {}
        engine.registerComponentValidator(Health, { conflicts: [Ghost] });
        engine.registerPrefab('Tank', {
          name: 'Tank',
          components: [
            { type: Position, args: [0, 0] },
            { type: Health, args: [200] },
            { type: Armor, args: [50] }
          ]
        });
      `,
        },
        // Prefab with dependencies from options
        {
            code: `
        class Position {}
        class Velocity {}
        engine.registerPrefab('Player', {
          name: 'Player',
          components: [
            { type: Position, args: [0, 0] },
            { type: Velocity, args: [1, 1] }
          ]
        });
      `,
            options: [{ dependencies: { Velocity: ['Position'] } }],
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
        // Prefab with wrong component order - Velocity before Position
        {
            code: `
        class Position {}
        class Velocity {}
        engine.registerComponentValidator(Velocity, { dependencies: [Position] });
        engine.registerPrefab('Player', {
          name: 'Player',
          components: [
            { type: Velocity, args: [1, 1] },
            { type: Position, args: [0, 0] }
          ]
        });
      `,
            errors: [{ messageId: 'prefabMissingDependency' }],
        },
        // Prefab with conflicting components
        {
            code: `
        class Health {}
        class Ghost {}
        engine.registerComponentValidator(Ghost, { conflicts: [Health] });
        engine.registerPrefab('Invalid', {
          name: 'Invalid',
          components: [
            { type: Health, args: [100] },
            { type: Ghost }
          ]
        });
      `,
            errors: [{ messageId: 'prefabConflictingComponent' }],
        },
        // Prefab with missing dependency (using options)
        {
            code: `
        class Position {}
        class Velocity {}
        engine.registerPrefab('Player', {
          name: 'Player',
          components: [
            { type: Velocity, args: [1, 1] }
          ]
        });
      `,
            options: [{ dependencies: { Velocity: ['Position'] } }],
            errors: [{ messageId: 'prefabMissingDependency' }],
        },
        // Prefab with conflict (using options)
        {
            code: `
        class Physical {}
        class Ghost {}
        engine.registerPrefab('Invalid', {
          name: 'Invalid',
          components: [
            { type: Physical },
            { type: Ghost }
          ]
        });
      `,
            options: [{ conflicts: { Ghost: ['Physical'] } }],
            errors: [{ messageId: 'prefabConflictingComponent' }],
        },
        // Prefab with multiple missing dependencies
        {
            code: `
        class Position {}
        class Velocity {}
        class Movement {}
        engine.registerComponentValidator(Movement, { dependencies: [Position, Velocity] });
        engine.registerPrefab('Player', {
          name: 'Player',
          components: [
            { type: Movement }
          ]
        });
      `,
            errors: [
                { messageId: 'prefabMissingDependency' },
                { messageId: 'prefabMissingDependency' },
            ],
        },
        // Prefab with chain dependency violation
        {
            code: `
        class A {}
        class B {}
        class C {}
        engine.registerComponentValidator(B, { dependencies: [A] });
        engine.registerComponentValidator(C, { dependencies: [B] });
        engine.registerPrefab('Chain', {
          name: 'Chain',
          components: [
            { type: A },
            { type: C }
          ]
        });
      `,
            errors: [{ messageId: 'prefabMissingDependency' }],
        },
    ],
});
