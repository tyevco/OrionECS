import { RuleTester } from '@typescript-eslint/rule-tester';

import { useWatchComponentsFilter } from '../rules/use-watchComponents-filter';

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

ruleTester.run('use-watchComponents-filter', useWatchComponentsFilter, {
    valid: [
        // Has watchComponents with onComponentAdded
        {
            code: `
                engine.createSystem('HealthWatcher', { all: [Health] }, {
                    watchComponents: [Health],
                    onComponentAdded: (event) => {
                        console.log('Health added');
                    }
                });
            `,
        },
        // Has watchComponents with onComponentChanged
        {
            code: `
                engine.createSystem('PositionWatcher', { all: [Position] }, {
                    watchComponents: [Position, Velocity],
                    onComponentChanged: (event) => {
                        console.log('Component changed');
                    }
                });
            `,
        },
        // Has watchComponents with onComponentRemoved
        {
            code: `
                engine.createSystem('CleanupWatcher', { all: [Position] }, {
                    watchComponents: [Position],
                    onComponentRemoved: (event) => {
                        console.log('Component removed');
                    }
                });
            `,
        },
        // No component change callbacks
        {
            code: `
                engine.createSystem('Movement', { all: [Position, Velocity] }, {
                    act: (entity, position, velocity) => {
                        position.x += velocity.x;
                    }
                });
            `,
        },
        // System with only act callback
        {
            code: `
                engine.createSystem('SimpleSystem', { all: [Health] }, {
                    priority: 10,
                    act: (entity, health) => {
                        health.current++;
                    }
                });
            `,
        },
        // Has all callbacks with filter
        {
            code: `
                engine.createSystem('FullWatcher', { all: [Health, Position] }, {
                    watchComponents: [Health],
                    onComponentAdded: (event) => {},
                    onComponentChanged: (event) => {},
                    onComponentRemoved: (event) => {}
                });
            `,
        },
    ],
    invalid: [
        // onComponentAdded without watchComponents
        {
            code: `
                engine.createSystem('HealthWatcher', { all: [Health] }, {
                    onComponentAdded: (event) => {
                        console.log('Health added');
                    }
                });
            `,
            errors: [{ messageId: 'missingWatchComponents', suggestions: 1 }],
        },
        // onComponentChanged without watchComponents
        {
            code: `
                engine.createSystem('PositionWatcher', { all: [Position] }, {
                    onComponentChanged: (event) => {
                        console.log('Component changed');
                    }
                });
            `,
            errors: [{ messageId: 'missingWatchComponents', suggestions: 1 }],
        },
        // onComponentRemoved without watchComponents
        {
            code: `
                engine.createSystem('CleanupWatcher', { all: [Position] }, {
                    onComponentRemoved: (event) => {
                        console.log('Component removed');
                    }
                });
            `,
            errors: [{ messageId: 'missingWatchComponents', suggestions: 1 }],
        },
        // Multiple callbacks without watchComponents (reports once)
        {
            code: `
                engine.createSystem('MultiWatcher', { all: [Health] }, {
                    onComponentAdded: (event) => {},
                    onComponentChanged: (event) => {},
                    onComponentRemoved: (event) => {}
                });
            `,
            errors: [{ messageId: 'missingWatchComponents', suggestions: 1 }],
        },
        // With act and component callback
        {
            code: `
                engine.createSystem('ReactiveSystem', { all: [Health, Position] }, {
                    act: (entity, health, position) => {
                        position.x++;
                    },
                    onComponentChanged: (event) => {
                        // This gets called for ALL component changes
                    }
                });
            `,
            errors: [{ messageId: 'missingWatchComponents', suggestions: 1 }],
        },
        // With before/after and component callback
        {
            code: `
                engine.createSystem('BatchWatcher', { all: [Position] }, {
                    before: () => {},
                    onComponentAdded: (event) => {},
                    after: () => {}
                });
            `,
            errors: [{ messageId: 'missingWatchComponents', suggestions: 1 }],
        },
    ],
});
