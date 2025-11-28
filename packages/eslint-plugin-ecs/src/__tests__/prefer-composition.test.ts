import { RuleTester } from '@typescript-eslint/rule-tester';
import { preferComposition } from '../rules/prefer-composition';

const ruleTester = new RuleTester();

ruleTester.run('prefer-composition', preferComposition, {
    valid: [
        // Component without inheritance
        {
            code: `
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
        },
        // Multiple independent components
        {
            code: `
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
        class Velocity {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
        },
        // Non-component class extending another
        {
            code: `
        class BaseSystem {
          update() {}
        }
        class MovementSystem extends BaseSystem {
          update() { /* logic */ }
        }
      `,
        },
        // Component extending allowed base class
        {
            code: `
        class Position extends SerializableBase {
          constructor(public x: number = 0, public y: number = 0) {
            super();
          }
        }
      `,
            options: [{ allowedBaseClasses: ['SerializableBase'] }],
        },
    ],
    invalid: [
        // Component extending another component
        {
            code: `
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
        class Position3DComponent extends Position {
          constructor(x: number, y: number, public z: number = 0) {
            super(x, y);
          }
        }
      `,
            errors: [{ messageId: 'noComponentInheritance' }],
        },
        // Health component extending another health component
        {
            code: `
        class Health {
          constructor(public current: number = 100) {}
        }
        class ExtendedHealth extends Health {
          constructor(current: number, public regenRate: number = 1) {
            super(current);
          }
        }
      `,
            errors: [{ messageId: 'noComponentInheritance' }],
        },
        // Velocity extending Position
        {
            code: `
        class Position {
          constructor(public x: number, public y: number) {}
        }
        class Velocity extends Position {
          constructor(x: number, y: number) {
            super(x, y);
          }
        }
      `,
            errors: [{ messageId: 'noComponentInheritance' }],
        },
    ],
});
