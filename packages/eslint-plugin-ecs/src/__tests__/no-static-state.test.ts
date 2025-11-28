import { RuleTester } from '@typescript-eslint/rule-tester';
import { noStaticState } from '../rules/no-static-state';

const ruleTester = new RuleTester();

ruleTester.run('no-static-state', noStaticState, {
    valid: [
        // Simple data-only component without static state
        {
            code: `
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
        },
        // Component with instance properties only
        {
            code: `
        class HealthComponent {
          public current: number = 100;
          public max: number = 100;
          constructor() {}
        }
      `,
        },
        // Non-component class with static (doesn't match pattern)
        {
            code: `
        class EntityManager {
          static instance: EntityManager | null = null;
          constructor() {}
        }
      `,
        },
        // Component with allowed static property (schema)
        {
            code: `
        class Position {
          static schema = { x: 'number', y: 'number' };
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
        },
        // Component with allowed static property (componentType)
        {
            code: `
        class VelocityComponent {
          static componentType = 'Velocity';
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
        },
        // Const module-level variable (immutable, allowed by default)
        {
            code: `
        const DEFAULT_HEALTH = 100;
        class HealthComponent {
          constructor(public current: number = DEFAULT_HEALTH) {}
        }
      `,
            options: [{ checkModuleLevelState: true }],
        },
        // Component with custom allowed static property
        {
            code: `
        class Position {
          static pool: Position[] = [];
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            options: [{ allowedStaticProperties: ['schema', 'componentType', 'pool'] }],
        },
        // Module-level let with allowed pattern
        {
            code: `
        let _debugMode = false;
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            options: [{ checkModuleLevelState: true, allowedModuleLevelPatterns: ['^_'] }],
        },
        // Module-level state not checked by default
        {
            code: `
        let globalCounter = 0;
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
        },
    ],
    invalid: [
        // Component with static property (counter)
        {
            code: `
        class Position {
          static instanceCount = 0;
          constructor(public x: number = 0, public y: number = 0) {
            Position.instanceCount++;
          }
        }
      `,
            errors: [{ messageId: 'noStaticPropertyInComponent' }],
        },
        // Component with static property (cache)
        {
            code: `
        class VelocityComponent {
          static cache = new Map();
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            errors: [{ messageId: 'noStaticPropertyInComponent' }],
        },
        // Component with static method
        {
            code: `
        class HealthData {
          static create(current: number, max: number) {
            return new HealthData(current, max);
          }
          constructor(public current: number, public max: number) {}
        }
      `,
            errors: [{ messageId: 'noStaticMethodInComponent' }],
        },
        // Component with multiple static members
        {
            code: `
        class TransformComponent {
          static instances: TransformComponent[] = [];
          static counter = 0;
          static reset() {
            TransformComponent.instances = [];
            TransformComponent.counter = 0;
          }
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            errors: [
                { messageId: 'noStaticPropertyInComponent' },
                { messageId: 'noStaticPropertyInComponent' },
                { messageId: 'noStaticMethodInComponent' },
            ],
        },
        // Module-level mutable state (let)
        {
            code: `
        let entityCounter = 0;
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            options: [{ checkModuleLevelState: true }],
            errors: [{ messageId: 'noModuleLevelMutableState' }],
        },
        // Module-level mutable state (var)
        {
            code: `
        var globalState = { count: 0 };
        class VelocityComponent {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            options: [{ checkModuleLevelState: true }],
            errors: [{ messageId: 'noModuleLevelMutableState' }],
        },
        // Multiple module-level mutable variables
        {
            code: `
        let counter = 0;
        let cache = new Map();
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            options: [{ checkModuleLevelState: true }],
            errors: [
                { messageId: 'noModuleLevelMutableState' },
                { messageId: 'noModuleLevelMutableState' },
            ],
        },
        // Component detected by custom pattern
        {
            code: `
        class PlayerData {
          static registry = new Map();
          constructor(public name: string) {}
        }
      `,
            options: [{ componentPattern: 'Data$' }],
            errors: [{ messageId: 'noStaticPropertyInComponent' }],
        },
        // Static property with initialization
        {
            code: `
        class SpriteComponent {
          static defaultTexture = 'missing.png';
          constructor(public texture: string = SpriteComponent.defaultTexture) {}
        }
      `,
            errors: [{ messageId: 'noStaticPropertyInComponent' }],
        },
    ],
});

// Additional tests for usage-based detection
ruleTester.run('no-static-state (usage detection)', noStaticState, {
    valid: [
        // Component detected from usage, no static state
        {
            code: `
        class Player {
          constructor(public name: string) {}
        }
        const entity = { addComponent: (c: any, ...args: any[]) => {} };
        entity.addComponent(Player, 'Hero');
      `,
            options: [{ detectFromUsage: true }],
        },
    ],
    invalid: [
        // Component detected from addComponent usage
        {
            code: `
        class Player {
          static count = 0;
          constructor(public name: string) {}
        }
        const entity = { addComponent: (c: any, ...args: any[]) => {} };
        entity.addComponent(Player, 'Hero');
      `,
            options: [{ detectFromUsage: true }],
            errors: [{ messageId: 'noStaticPropertyInComponent' }],
        },
    ],
});
