import { RuleTester } from '@typescript-eslint/rule-tester';
import { noQueryInActCallback } from '../rules/no-query-in-act-callback';

const ruleTester = new RuleTester();

ruleTester.run('no-query-in-act-callback', noQueryInActCallback, {
    valid: [
        // Query created outside system - correct pattern
        {
            code: `
        class Position {}
        class Velocity {}
        const movementQuery = engine.createQuery({ all: [Position, Velocity] });
        engine.createSystem('Movement', { all: [Position] }, {
          act: (entity, pos) => {
            for (const other of movementQuery.getEntities()) {
              // do something
            }
          }
        });
      `,
        },
        // Query created in module scope
        {
            code: `
        class Position {}
        const query = engine.createQuery({ all: [Position] });
        function process() {
          for (const entity of query.getEntities()) {}
        }
      `,
        },
        // Regular method call inside act (not a query method)
        {
            code: `
        class Position {}
        engine.createSystem('Movement', { all: [Position] }, {
          act: (entity, pos) => {
            entity.getComponent(Position);
            console.log('processing');
          }
        });
      `,
        },
        // Query in a non-system function
        {
            code: `
        class Position {}
        function findEntities() {
          return engine.createQuery({ all: [Position] }).getEntities();
        }
      `,
        },
        // Query created before system in same scope
        {
            code: `
        class Position {}
        class Enemy {}
        function setupGame() {
          const enemyQuery = engine.createQuery({ all: [Enemy] });
          engine.createSystem('Combat', { all: [Position] }, {
            act: (entity, pos) => {
              for (const enemy of enemyQuery.getEntities()) {}
            }
          });
        }
      `,
        },
    ],
    invalid: [
        // Query created inside act callback
        {
            code: `
        class Position {}
        class Collider {}
        engine.createSystem('Collision', { all: [Position] }, {
          act: (entity, pos) => {
            const others = engine.createQuery({ all: [Position, Collider] });
            for (const other of others.getEntities()) {}
          }
        });
      `,
            errors: [{ messageId: 'noQueryInSystemCallback' }],
        },
        // Query created inside before callback
        {
            code: `
        class Position {}
        engine.createSystem('Setup', { all: [Position] }, {
          before: () => {
            const query = engine.createQuery({ all: [Position] });
          },
          act: (entity, pos) => {}
        });
      `,
            errors: [{ messageId: 'noQueryInSystemCallback' }],
        },
        // Query created inside after callback
        {
            code: `
        class Position {}
        engine.createSystem('Cleanup', { all: [Position] }, {
          act: (entity, pos) => {},
          after: () => {
            const query = engine.createQuery({ all: [Position] });
          }
        });
      `,
            errors: [{ messageId: 'noQueryInSystemCallback' }],
        },
        // Fluent query builder inside act
        {
            code: `
        class Position {}
        class Velocity {}
        engine.createSystem('Movement', { all: [Position] }, {
          act: (entity, pos) => {
            const query = engine.query().withAll(Position, Velocity).build();
          }
        });
      `,
            errors: [{ messageId: 'noQueryInSystemCallback' }],
        },
        // Multiple queries inside callbacks
        {
            code: `
        class Position {}
        class Enemy {}
        class Bullet {}
        engine.createSystem('Combat', { all: [Position] }, {
          before: () => {
            const enemies = engine.createQuery({ all: [Enemy] });
          },
          act: (entity, pos) => {
            const bullets = engine.createQuery({ all: [Bullet] });
          }
        });
      `,
            errors: [
                { messageId: 'noQueryInSystemCallback' },
                { messageId: 'noQueryInSystemCallback' },
            ],
        },
        // Query in nested function inside act
        {
            code: `
        class Position {}
        engine.createSystem('Deep', { all: [Position] }, {
          act: (entity, pos) => {
            function findNearby() {
              return engine.createQuery({ all: [Position] });
            }
            findNearby();
          }
        });
      `,
            errors: [{ messageId: 'noQueryInSystemCallback' }],
        },
    ],
});
