import { RuleTester } from '@typescript-eslint/rule-tester';
import { systemPriorityExplicit } from '../rules/system-priority-explicit';

const ruleTester = new RuleTester();

ruleTester.run('system-priority-explicit', systemPriorityExplicit, {
    valid: [
        // Explicit priority
        {
            code: `
        class Position {}
        engine.createSystem('MovementSystem', { all: [Position] }, {
          priority: 100,
          act: (entity, pos) => {}
        });
      `,
        },
        // Priority of 0 (still explicit)
        {
            code: `
        class Position {}
        engine.createSystem('DefaultSystem', { all: [Position] }, {
          priority: 0,
          act: (entity, pos) => {}
        });
      `,
        },
        // Negative priority
        {
            code: `
        class Position {}
        engine.createSystem('LastSystem', { all: [Position] }, {
          priority: -100,
          act: (entity, pos) => {}
        });
      `,
        },
        // Non-createSystem call (should be ignored)
        {
            code: `
        someObject.createSystem('Test', {}, {
          act: () => {}
        });
      `,
        },
    ],
    invalid: [
        // Missing priority in options
        {
            code: `
        class Position {}
        engine.createSystem('MovementSystem', { all: [Position] }, {
          act: (entity, pos) => {}
        });
      `,
            errors: [{ messageId: 'missingPriority' }],
        },
        // Missing options object entirely
        {
            code: `
        class Position {}
        engine.createSystem('SimpleSystem', { all: [Position] });
      `,
            errors: [{ messageId: 'missingPriority' }],
        },
        // Multiple systems without priority
        {
            code: `
        class Position {}
        class Velocity {}
        engine.createSystem('System1', { all: [Position] }, {
          act: (entity, pos) => {}
        });
        engine.createSystem('System2', { all: [Velocity] }, {
          act: (entity, vel) => {}
        });
      `,
            errors: [{ messageId: 'missingPriority' }, { messageId: 'missingPriority' }],
        },
    ],
});
