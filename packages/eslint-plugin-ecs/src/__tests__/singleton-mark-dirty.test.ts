import { RuleTester } from '@typescript-eslint/rule-tester';
import { singletonMarkDirty } from '../rules/singleton-mark-dirty';

const ruleTester = new RuleTester();

ruleTester.run('singleton-mark-dirty', singletonMarkDirty, {
    valid: [
        // Singleton modified and marked dirty
        {
            code: `
        class GameTime {}
        const time = engine.getSingleton(GameTime);
        time.elapsed += deltaTime;
        engine.markSingletonDirty(GameTime);
      `,
        },
        // Mark dirty before modification (still valid)
        {
            code: `
        class GameSettings {}
        const settings = engine.getSingleton(GameSettings);
        engine.markSingletonDirty(GameSettings);
        settings.volume = 0.5;
      `,
        },
        // Multiple singletons, all marked dirty
        {
            code: `
        class GameTime {}
        class Score {}
        const time = engine.getSingleton(GameTime);
        const score = engine.getSingleton(Score);
        time.elapsed += 1;
        score.value += 100;
        engine.markSingletonDirty(GameTime);
        engine.markSingletonDirty(Score);
      `,
        },
        // Singleton accessed but not modified
        {
            code: `
        class GameState {}
        const state = engine.getSingleton(GameState);
        console.log(state.level);
      `,
        },
        // Singleton used in condition only
        {
            code: `
        class GameTime {}
        const time = engine.getSingleton(GameTime);
        if (time.elapsed > 10) {
          console.log('10 seconds passed');
        }
      `,
        },
        // Modification in function with dirty mark
        {
            code: `
        class Counter {}
        function incrementCounter() {
          const counter = engine.getSingleton(Counter);
          counter.value += 1;
          engine.markSingletonDirty(Counter);
        }
      `,
        },
    ],
    invalid: [
        // Singleton modified without marking dirty
        {
            code: `
        class GameTime {}
        const time = engine.getSingleton(GameTime);
        time.elapsed += deltaTime;
      `,
            errors: [{ messageId: 'missingSingletonDirtyMark' }],
        },
        // Multiple modifications without marking dirty
        {
            code: `
        class GameSettings {}
        const settings = engine.getSingleton(GameSettings);
        settings.volume = 0.5;
        settings.difficulty = 'hard';
      `,
            errors: [
                { messageId: 'missingSingletonDirtyMark' },
                { messageId: 'missingSingletonDirtyMark' },
            ],
        },
        // Wrong singleton marked dirty
        {
            code: `
        class GameTime {}
        class Score {}
        const time = engine.getSingleton(GameTime);
        time.elapsed += 1;
        engine.markSingletonDirty(Score);
      `,
            errors: [{ messageId: 'missingSingletonDirtyMark' }],
        },
        // One singleton marked, another not
        {
            code: `
        class GameTime {}
        class Score {}
        const time = engine.getSingleton(GameTime);
        const score = engine.getSingleton(Score);
        time.elapsed += 1;
        score.value += 100;
        engine.markSingletonDirty(GameTime);
      `,
            errors: [{ messageId: 'missingSingletonDirtyMark' }],
        },
        // Modification in system without marking dirty
        {
            code: `
        class GameTime {}
        engine.createSystem('Timer', {}, {
          act: () => {
            const time = engine.getSingleton(GameTime);
            time.elapsed += 0.016;
          }
        });
      `,
            errors: [{ messageId: 'missingSingletonDirtyMark' }],
        },
    ],
});
