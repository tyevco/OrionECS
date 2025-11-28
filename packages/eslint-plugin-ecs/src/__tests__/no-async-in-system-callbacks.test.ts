import { RuleTester } from '@typescript-eslint/rule-tester';
import { noAsyncInSystemCallbacks } from '../rules/no-async-in-system-callbacks';

const ruleTester = new RuleTester();

ruleTester.run('no-async-in-system-callbacks', noAsyncInSystemCallbacks, {
    valid: [
        // Synchronous act callback
        {
            code: `
        class Position {}
        engine.createSystem('Movement', { all: [Position] }, {
          act: (entity, pos) => {
            pos.x += 1;
          }
        });
      `,
        },
        // Synchronous before/after callbacks
        {
            code: `
        class Position {}
        engine.createSystem('Render', { all: [Position] }, {
          before: () => {
            console.log('before');
          },
          act: (entity, pos) => {},
          after: () => {
            console.log('after');
          }
        });
      `,
        },
        // Async function outside system
        {
            code: `
        async function loadData() {
          const data = await fetch('/api/data');
          return data.json();
        }
      `,
        },
        // Async callback in non-system context
        {
            code: `
        someObject.onEvent(async () => {
          await doAsyncWork();
        });
      `,
        },
        // Promise-based work queued (non-blocking)
        {
            code: `
        class Position {}
        engine.createSystem('Network', { all: [Position] }, {
          act: (entity, pos) => {
            // Queue async work without awaiting
            loadData().then(data => {
              engine.messageBus.publish('data-loaded', data, 'Network');
            });
          }
        });
      `,
        },
        // Function expression (non-async)
        {
            code: `
        class Position {}
        engine.createSystem('Test', { all: [Position] }, {
          act: function(entity, pos) {
            pos.x += 1;
          }
        });
      `,
        },
    ],
    invalid: [
        // Async arrow function in act
        {
            code: `
        class Position {}
        engine.createSystem('BadSystem', { all: [Position] }, {
          act: async (entity, pos) => {
            const data = await fetch('/api');
          }
        });
      `,
            errors: [
                { messageId: 'noAsyncSystemCallback' },
                { messageId: 'noAwaitInSystemCallback' },
            ],
        },
        // Async function expression in act
        {
            code: `
        class Position {}
        engine.createSystem('BadSystem', { all: [Position] }, {
          act: async function(entity, pos) {
            await doSomething();
          }
        });
      `,
            errors: [
                { messageId: 'noAsyncSystemCallback' },
                { messageId: 'noAwaitInSystemCallback' },
            ],
        },
        // Async before callback
        {
            code: `
        class Position {}
        engine.createSystem('Setup', { all: [Position] }, {
          before: async () => {
            await loadResources();
          },
          act: (entity, pos) => {}
        });
      `,
            errors: [
                { messageId: 'noAsyncSystemCallback' },
                { messageId: 'noAwaitInSystemCallback' },
            ],
        },
        // Async after callback
        {
            code: `
        class Position {}
        engine.createSystem('Cleanup', { all: [Position] }, {
          act: (entity, pos) => {},
          after: async () => {
            await saveState();
          }
        });
      `,
            errors: [
                { messageId: 'noAsyncSystemCallback' },
                { messageId: 'noAwaitInSystemCallback' },
            ],
        },
        // Await in nested function inside act
        {
            code: `
        class Position {}
        engine.createSystem('Nested', { all: [Position] }, {
          act: (entity, pos) => {
            async function innerAsync() {
              await fetch('/api');
            }
            innerAsync();
          }
        });
      `,
            errors: [{ messageId: 'noAwaitInSystemCallback' }],
        },
        // Multiple async callbacks
        {
            code: `
        class Position {}
        engine.createSystem('AllAsync', { all: [Position] }, {
          before: async () => {},
          act: async (entity, pos) => {},
          after: async () => {}
        });
      `,
            errors: [
                { messageId: 'noAsyncSystemCallback' },
                { messageId: 'noAsyncSystemCallback' },
                { messageId: 'noAsyncSystemCallback' },
            ],
        },
    ],
});
