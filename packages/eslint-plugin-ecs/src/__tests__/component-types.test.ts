import { RuleTester } from '@typescript-eslint/rule-tester';
import * as path from 'path';
import { componentTypes } from '../rules/component-types';

// Configure RuleTester with TypeScript parser for type-aware rules
// Use projectService for better handling of virtual test files
const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            projectService: {
                allowDefaultProject: ['*.ts'],
                defaultProject: path.join(__dirname, '../../tsconfig.test.json'),
            },
            tsconfigRootDir: path.join(__dirname, '../..'),
        },
    },
});

ruleTester.run('component-types', componentTypes, {
    valid: [
        // Data-only component class
        {
            code: `
        class Position {
          x: number = 0;
          y: number = 0;
          constructor(x: number = 0, y: number = 0) {
            this.x = x;
            this.y = y;
          }
        }

        declare const entity: { addComponent: <T>(type: new (...args: any[]) => T, ...args: any[]) => T };
        entity.addComponent(Position, 0, 0);
      `,
        },
        // Component with allowed methods (clone, reset, toString)
        {
            code: `
        class Velocity {
          x: number = 0;
          y: number = 0;
          constructor(x: number = 0, y: number = 0) {
            this.x = x;
            this.y = y;
          }
          clone() { return new Velocity(this.x, this.y); }
          reset() { this.x = 0; this.y = 0; }
          toString() { return \`(\${this.x}, \${this.y})\`; }
        }

        declare const entity: { addComponent: <T>(type: new (...args: any[]) => T, ...args: any[]) => T };
        entity.addComponent(Velocity, 1, 1);
      `,
        },
        // Using component in createSystem query
        {
            code: `
        class Position {
          x: number = 0;
          y: number = 0;
        }
        class Velocity {
          x: number = 0;
          y: number = 0;
        }

        declare const engine: { createSystem: (name: string, query: any, options: any) => void };
        engine.createSystem('Movement', {
          all: [Position, Velocity]
        }, {
          act: () => {}
        });
      `,
        },
        // Component with private methods (prefixed with _) - allowed
        {
            code: `
        class Health {
          current: number = 100;
          max: number = 100;
          private _validate() { return this.current >= 0; }
        }

        declare const entity: { addComponent: <T>(type: new (...args: any[]) => T, ...args: any[]) => T };
        entity.addComponent(Health);
      `,
        },
        // Excluded pattern
        {
            code: `
        class ServiceWithMethods {
          doSomething() { return 'result'; }
        }

        declare const entity: { addComponent: <T>(type: new (...args: any[]) => T, ...args: any[]) => T };
        entity.addComponent(ServiceWithMethods);
      `,
            options: [{ excludePatterns: ['Service'] }],
        },
    ],
    invalid: [
        // Component with method
        {
            code: `
        class Position {
          x: number = 0;
          y: number = 0;
          distanceTo(other: Position): number {
            return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
          }
        }

        declare const entity: { addComponent: <T>(type: new (...args: any[]) => T, ...args: any[]) => T };
        entity.addComponent(Position, 0, 0);
      `,
            errors: [{ messageId: 'componentHasMethods' }],
        },
        // Component with getter
        {
            code: `
        class Health {
          current: number = 100;
          max: number = 100;
          get percentage(): number {
            return this.current / this.max;
          }
        }

        declare const entity: { addComponent: <T>(type: new (...args: any[]) => T, ...args: any[]) => T };
        entity.addComponent(Health);
      `,
            errors: [{ messageId: 'componentHasGettersSetters' }],
        },
        // Component with setter
        {
            code: `
        class Transform {
          x: number = 0;
          y: number = 0;
          set position(value: { x: number; y: number }) {
            this.x = value.x;
            this.y = value.y;
          }
        }

        declare const entity: { addComponent: <T>(type: new (...args: any[]) => T, ...args: any[]) => T };
        entity.addComponent(Transform);
      `,
            errors: [{ messageId: 'componentHasGettersSetters' }],
        },
        // Component with arrow function property
        {
            code: `
        class Velocity {
          x: number = 0;
          y: number = 0;
          normalize = () => {
            const len = Math.sqrt(this.x * this.x + this.y * this.y);
            this.x /= len;
            this.y /= len;
          };
        }

        declare const entity: { addComponent: <T>(type: new (...args: any[]) => T, ...args: any[]) => T };
        entity.addComponent(Velocity);
      `,
            errors: [{ messageId: 'componentHasMethods' }],
        },
        // Method in createSystem query
        {
            code: `
        class Position {
          x: number = 0;
          y: number = 0;
          update() { /* logic */ }
        }
        class Velocity {
          x: number = 0;
          y: number = 0;
        }

        declare const engine: { createSystem: (name: string, query: any, options: any) => void };
        engine.createSystem('Movement', {
          all: [Position, Velocity]
        }, {
          act: () => {}
        });
      `,
            errors: [{ messageId: 'componentHasMethods' }],
        },
        // Multiple methods
        {
            code: `
        class ComplexComponent {
          data: number = 0;
          process() { return this.data * 2; }
          transform(factor: number) { this.data *= factor; }
          validate() { return this.data >= 0; }
        }

        declare const entity: { addComponent: <T>(type: new (...args: any[]) => T, ...args: any[]) => T };
        entity.addComponent(ComplexComponent);
      `,
            errors: [{ messageId: 'componentHasMethods' }],
        },
        // Both methods and getters
        {
            code: `
        class BadComponent {
          value: number = 0;
          get doubled(): number { return this.value * 2; }
          compute() { return this.value * 3; }
        }

        declare const entity: { addComponent: <T>(type: new (...args: any[]) => T, ...args: any[]) => T };
        entity.addComponent(BadComponent);
      `,
            errors: [
                { messageId: 'componentHasMethods' },
                { messageId: 'componentHasGettersSetters' },
            ],
        },
        // Using getComponent with bad type
        {
            code: `
        class HasMethod {
          x: number = 0;
          doThing() { return this.x; }
        }

        declare const entity: { getComponent: <T>(type: new (...args: any[]) => T) => T | undefined };
        entity.getComponent(HasMethod);
      `,
            errors: [{ messageId: 'componentHasMethods' }],
        },
        // Using hasComponent with bad type
        {
            code: `
        class HasGetter {
          x: number = 0;
          get y(): number { return this.x * 2; }
        }

        declare const entity: { hasComponent: <T>(type: new (...args: any[]) => T) => boolean };
        entity.hasComponent(HasGetter);
      `,
            errors: [{ messageId: 'componentHasGettersSetters' }],
        },
        // Fluent query builder withAll
        {
            code: `
        class BadComponent {
          x: number = 0;
          method() {}
        }

        declare const query: { withAll: (...types: any[]) => any };
        query.withAll(BadComponent);
      `,
            errors: [{ messageId: 'componentHasMethods' }],
        },
    ],
});
