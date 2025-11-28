import { RuleTester } from '@typescript-eslint/rule-tester';
import { systemNamingConvention } from '../rules/system-naming-convention';

const ruleTester = new RuleTester();

ruleTester.run('system-naming-convention', systemNamingConvention, {
    valid: [
        // Correct naming with System suffix
        {
            code: `
        class Position {}
        engine.createSystem('MovementSystem', { all: [Position] }, {
          priority: 100,
          act: (entity, pos) => {}
        });
      `,
        },
        // Multiple correctly named systems
        {
            code: `
        engine.createSystem('RenderSystem', {}, { act: () => {} });
        engine.createSystem('PhysicsSystem', {}, { act: () => {} });
        engine.createSystem('InputSystem', {}, { act: () => {} });
      `,
        },
        // Custom suffix via options
        {
            code: `
        engine.createSystem('MovementProcessor', {}, { act: () => {} });
      `,
            options: [{ requiredSuffix: 'Processor', requirePascalCase: true }],
        },
        // No suffix requirement
        {
            code: `
        engine.createSystem('Movement', {}, { act: () => {} });
      `,
            options: [{ requiredSuffix: '', requirePascalCase: true }],
        },
    ],
    invalid: [
        // Missing System suffix
        {
            code: `
        engine.createSystem('Movement', {}, { act: () => {} });
      `,
            errors: [{ messageId: 'systemNamingSuffix' }],
        },
        // lowercase name
        {
            code: `
        engine.createSystem('movementSystem', {}, { act: () => {} });
      `,
            errors: [{ messageId: 'systemNamingCase' }],
        },
        // All lowercase
        {
            code: `
        engine.createSystem('movement', {}, { act: () => {} });
      `,
            errors: [{ messageId: 'systemNamingSuffix' }, { messageId: 'systemNamingCase' }],
        },
        // snake_case
        {
            code: `
        engine.createSystem('movement_system', {}, { act: () => {} });
      `,
            errors: [{ messageId: 'systemNamingSuffix' }, { messageId: 'systemNamingCase' }],
        },
        // Multiple violations
        {
            code: `
        engine.createSystem('render', {}, { act: () => {} });
        engine.createSystem('physics', {}, { act: () => {} });
      `,
            errors: [
                { messageId: 'systemNamingSuffix' },
                { messageId: 'systemNamingCase' },
                { messageId: 'systemNamingSuffix' },
                { messageId: 'systemNamingCase' },
            ],
        },
    ],
});
