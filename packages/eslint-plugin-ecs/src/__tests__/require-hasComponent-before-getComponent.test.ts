import { RuleTester } from '@typescript-eslint/rule-tester';
import { requireHasComponentBeforeGetComponent } from '../rules/require-hasComponent-before-getComponent';

const ruleTester = new RuleTester();

ruleTester.run('require-hasComponent-before-getComponent', requireHasComponentBeforeGetComponent, {
    valid: [
        // hasComponent check before getComponent
        {
            code: `
        class Velocity {}
        if (entity.hasComponent(Velocity)) {
          const vel = entity.getComponent(Velocity);
          vel.x += 1;
        }
      `,
        },
        // Component guaranteed by system query
        {
            code: `
        class Position {}
        class Velocity {}
        engine.createSystem('Movement', { all: [Position, Velocity] }, {
          act: (entity, pos, vel) => {
            // Position and Velocity are guaranteed by query
            const p = entity.getComponent(Position);
            const v = entity.getComponent(Velocity);
          }
        });
      `,
        },
        // Conditional expression with hasComponent
        {
            code: `
        class Health {}
        const health = entity.hasComponent(Health)
          ? entity.getComponent(Health).current
          : 0;
      `,
        },
        // Logical AND with hasComponent
        {
            code: `
        class Buff {}
        if (entity.hasComponent(Buff) && entity.getComponent(Buff).active) {
          applyBuff(entity);
        }
      `,
        },
        // getComponent on parameters (assumed valid context)
        {
            code: `
        class Armor {}
        function processArmored(entity: Entity) {
          if (entity.hasComponent(Armor)) {
            const armor = entity.getComponent(Armor);
            return armor.value;
          }
          return 0;
        }
      `,
        },
        // Query-guaranteed component accessed in nested function
        {
            code: `
        class Position {}
        engine.createSystem('Nested', { all: [Position] }, {
          act: (entity, pos) => {
            function doSomething() {
              const p = entity.getComponent(Position);
            }
            doSomething();
          }
        });
      `,
        },
        // Always-guaranteed component via options
        {
            code: `
        class Transform {}
        const t = entity.getComponent(Transform);
      `,
            options: [{ queryGuaranteedComponents: ['Transform'] }],
        },
    ],
    invalid: [
        // Direct getComponent without check
        {
            code: `
        class Velocity {}
        const vel = entity.getComponent(Velocity);
        vel.x += 1;
      `,
            errors: [{ messageId: 'missingHasComponentCheck' }],
        },
        // getComponent in system for non-query component
        {
            code: `
        class Position {}
        class Velocity {}
        class Acceleration {}
        engine.createSystem('Movement', { all: [Position, Velocity] }, {
          act: (entity, pos, vel) => {
            // Acceleration is NOT in query
            const accel = entity.getComponent(Acceleration);
            vel.x += accel.x;
          }
        });
      `,
            errors: [{ messageId: 'missingHasComponentCheck' }],
        },
        // getComponent in function without check
        {
            code: `
        class Health {}
        function damage(entity: Entity, amount: number) {
          const health = entity.getComponent(Health);
          health.current -= amount;
        }
      `,
            errors: [{ messageId: 'missingHasComponentCheck' }],
        },
        // Multiple getComponent calls without checks
        {
            code: `
        class Health {}
        class Shield {}
        const health = entity.getComponent(Health);
        const shield = entity.getComponent(Shield);
      `,
            errors: [
                { messageId: 'missingHasComponentCheck' },
                { messageId: 'missingHasComponentCheck' },
            ],
        },
        // Check for wrong component
        {
            code: `
        class Health {}
        class Shield {}
        if (entity.hasComponent(Health)) {
          // Check was for Health, not Shield
          const shield = entity.getComponent(Shield);
        }
      `,
            errors: [{ messageId: 'missingHasComponentCheck' }],
        },
        // getComponent in else branch (component not guaranteed)
        {
            code: `
        class Armor {}
        if (!entity.hasComponent(Armor)) {
          console.log('no armor');
        } else {
          // This is fine, but let's test the else-if case
        }
        const armor = entity.getComponent(Armor);
      `,
            errors: [{ messageId: 'missingHasComponentCheck' }],
        },
    ],
});
