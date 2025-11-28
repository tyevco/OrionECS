import { RuleTester } from '@typescript-eslint/rule-tester';
import { dataOnlyComponents } from '../rules/data-only-components';

const ruleTester = new RuleTester();

ruleTester.run('data-only-components', dataOnlyComponents, {
    valid: [
        // Simple data-only component
        {
            code: `
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
        },
        // Component with allowed methods
        {
            code: `
        class Velocity {
          constructor(public x: number = 0, public y: number = 0) {}
          clone() { return new Velocity(this.x, this.y); }
          reset() { this.x = 0; this.y = 0; }
        }
      `,
        },
        // Non-component class (doesn't match pattern)
        {
            code: `
        class EntityManager {
          constructor() {}
          update() { /* logic */ }
          destroy() { /* cleanup */ }
        }
      `,
        },
        // Component with property definitions only
        {
            code: `
        class HealthComponent {
          public current: number = 100;
          public max: number = 100;
          constructor() {}
        }
      `,
        },
    ],
    invalid: [
        // Component with a method
        {
            code: `
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
          distanceTo(other: Position): number {
            return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
          }
        }
      `,
            errors: [{ messageId: 'noMethodsInComponent' }],
        },
        // Component with getter
        {
            code: `
        class Health {
          constructor(public current: number = 100, public max: number = 100) {}
          get percentage(): number {
            return this.current / this.max;
          }
        }
      `,
            errors: [{ messageId: 'noGettersSettersInComponent' }],
        },
        // Component with setter
        {
            code: `
        class Transform {
          constructor(public x: number = 0, public y: number = 0) {}
          set position(value: { x: number; y: number }) {
            this.x = value.x;
            this.y = value.y;
          }
        }
      `,
            errors: [{ messageId: 'noGettersSettersInComponent' }],
        },
        // Component with arrow function property
        {
            code: `
        class Velocity {
          constructor(public x: number = 0, public y: number = 0) {}
          normalize = () => {
            const len = Math.sqrt(this.x * this.x + this.y * this.y);
            this.x /= len;
            this.y /= len;
          };
        }
      `,
            errors: [{ messageId: 'noMethodsInComponent' }],
        },
    ],
});
