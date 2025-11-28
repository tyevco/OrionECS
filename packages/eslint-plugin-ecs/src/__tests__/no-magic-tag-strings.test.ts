import { RuleTester } from '@typescript-eslint/rule-tester';
import { noMagicTagStrings } from '../rules/no-magic-tag-strings';

const ruleTester = new RuleTester();

ruleTester.run('no-magic-tag-strings', noMagicTagStrings, {
    valid: [
        // Using constant/variable
        {
            code: `
        const TAGS = { PLAYER: 'player', ENEMY: 'enemy' };
        entity.addTag(TAGS.PLAYER);
      `,
        },
        // Using imported constant
        {
            code: `
        import { PLAYER_TAG } from './tags';
        entity.addTag(PLAYER_TAG);
      `,
        },
        // Allowed tag from options
        {
            code: `
        entity.addTag('active');
        entity.hasTag('active');
      `,
            options: [{ allowedTags: ['active'] }],
        },
        // Non-tag method with string (should be ignored)
        {
            code: `
        entity.setName('player');
        console.log('enemy');
      `,
        },
    ],
    invalid: [
        // Magic string in addTag
        {
            code: `
        entity.addTag('player');
      `,
            errors: [{ messageId: 'useMagicTagString' }],
        },
        // Magic string in removeTag
        {
            code: `
        entity.removeTag('enemy');
      `,
            errors: [{ messageId: 'useMagicTagString' }],
        },
        // Magic string in hasTag
        {
            code: `
        if (entity.hasTag('active')) {
          // do something
        }
      `,
            errors: [{ messageId: 'useMagicTagString' }],
        },
        // Magic string in getEntitiesByTag
        {
            code: `
        const enemies = engine.getEntitiesByTag('enemy');
      `,
            errors: [{ messageId: 'useMagicTagString' }],
        },
        // Multiple magic strings
        {
            code: `
        entity.addTag('player');
        entity.addTag('controllable');
        entity.addTag('active');
      `,
            errors: [
                { messageId: 'useMagicTagString' },
                { messageId: 'useMagicTagString' },
                { messageId: 'useMagicTagString' },
            ],
        },
    ],
});
