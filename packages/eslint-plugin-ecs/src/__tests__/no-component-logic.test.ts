import { RuleTester } from '@typescript-eslint/rule-tester';
import { noComponentLogic } from '../rules/no-component-logic';

const ruleTester = new RuleTester();

ruleTester.run('no-component-logic', noComponentLogic, {
    valid: [
        // Simple constructor with assignments
        {
            code: `
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
        },
        // Constructor with allowed function calls
        {
            code: `
        class Timestamp {
          public createdAt: number;
          constructor() {
            this.createdAt = Date.now();
          }
        }
      `,
        },
        // Constructor with Math functions
        {
            code: `
        class RandomData {
          public value: number;
          constructor() {
            this.value = Math.floor(Math.random() * 100);
          }
        }
      `,
        },
        // Non-component class with complex logic
        {
            code: `
        class GameManager {
          constructor(config: Config) {
            if (config.debug) {
              this.enableDebug();
            }
            for (const system of config.systems) {
              this.registerSystem(system);
            }
          }
          enableDebug() {}
          registerSystem(s: any) {}
        }
      `,
        },
    ],
    invalid: [
        // Conditional in constructor
        {
            code: `
        class HealthComponent {
          constructor(public current: number, public max: number) {
            if (current > max) {
              this.current = max;
            }
          }
        }
      `,
            errors: [{ messageId: 'noConditionalInConstructor' }],
        },
        // Loop in constructor
        {
            code: `
        class InventoryComponent {
          public items: Item[] = [];
          constructor(itemIds: number[]) {
            for (const id of itemIds) {
              this.items.push(new Item(id));
            }
          }
        }
        class Item { constructor(id: number) {} }
      `,
            errors: [
                { messageId: 'noLoopInConstructor' },
                { messageId: 'noFunctionCallInConstructor' },
            ],
        },
        // Switch statement in constructor
        {
            code: `
        class State {
          public mode: string;
          constructor(type: number) {
            switch (type) {
              case 1: this.mode = 'active'; break;
              case 2: this.mode = 'idle'; break;
              default: this.mode = 'unknown';
            }
          }
        }
      `,
            errors: [{ messageId: 'noConditionalInConstructor' }],
        },
        // Ternary in constructor (conditional expression)
        {
            code: `
        class HealthData {
          public status: string;
          constructor(current: number) {
            this.status = current > 50 ? 'healthy' : 'critical';
          }
        }
      `,
            errors: [{ messageId: 'noConditionalInConstructor' }],
        },
    ],
});
