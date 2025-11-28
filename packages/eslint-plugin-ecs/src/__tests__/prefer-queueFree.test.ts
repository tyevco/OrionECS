import { RuleTester } from '@typescript-eslint/rule-tester';
import { preferQueueFree } from '../rules/prefer-queueFree';

const ruleTester = new RuleTester();

ruleTester.run('prefer-queueFree', preferQueueFree, {
    valid: [
        // Using queueFree
        {
            code: `
        entity.queueFree();
      `,
        },
        // Non-entity destroy
        {
            code: `
        audioContext.destroy();
        window.remove();
      `,
        },
        // destroy on non-entity object
        {
            code: `
        this.component.destroy();
        manager.destroy();
      `,
        },
    ],
    invalid: [
        // entity.destroy()
        {
            code: `
        entity.destroy();
      `,
            errors: [{ messageId: 'preferQueueFree' }],
        },
        // this.entity.destroy()
        {
            code: `
        this.entity.destroy();
      `,
            errors: [{ messageId: 'preferQueueFree' }],
        },
        // e.destroy() (common shorthand)
        {
            code: `
        const e = engine.createEntity();
        e.destroy();
      `,
            errors: [{ messageId: 'preferQueueFree' }],
        },
        // ent.remove()
        {
            code: `
        ent.remove();
      `,
            errors: [{ messageId: 'preferQueueFree' }],
        },
    ],
});
