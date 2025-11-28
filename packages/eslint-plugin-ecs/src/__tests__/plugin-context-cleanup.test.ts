import { RuleTester } from '@typescript-eslint/rule-tester';

import { pluginContextCleanup } from '../rules/plugin-context-cleanup';

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

ruleTester.run('plugin-context-cleanup', pluginContextCleanup, {
    valid: [
        // Properly clears context
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private context;

                    install(context) {
                        this.context = context;
                    }

                    uninstall() {
                        this.context = undefined;
                    }
                }
            `,
        },
        // Clears with null
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private context;

                    install(context) {
                        this.context = context;
                    }

                    uninstall() {
                        this.context = null;
                    }
                }
            `,
        },
        // Clears engine reference
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private engine;

                    install(context) {
                        this.engine = context.getEngine();
                    }

                    uninstall() {
                        this.engine = undefined;
                    }
                }
            `,
        },
        // No context stored
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    install(context) {
                        // Uses context but doesn't store it
                        context.registerComponent(Position);
                    }

                    uninstall() {}
                }
            `,
        },
        // Not a plugin class
        {
            code: `
                class DataManager {
                    private context;

                    init(context) {
                        this.context = context;
                    }
                }
            `,
        },
        // Uses delete
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private context;

                    install(context) {
                        this.context = context;
                    }

                    uninstall() {
                        delete this.context;
                    }
                }
            `,
        },
        // Multiple properties all cleared
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private context;
                    private engine;

                    install(context) {
                        this.context = context;
                        this.engine = context.getEngine();
                    }

                    uninstall() {
                        this.context = undefined;
                        this.engine = undefined;
                    }
                }
            `,
        },
        // Plugin by name pattern
        {
            code: `
                class NetworkPlugin {
                    private pluginContext;

                    install(context) {
                        this.pluginContext = context;
                    }

                    uninstall() {
                        this.pluginContext = undefined;
                    }
                }
            `,
        },
    ],
    invalid: [
        // No uninstall method (no suggestions since there's no uninstall to add to)
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private context;

                    install(context) {
                        this.context = context;
                    }
                }
            `,
            errors: [{ messageId: 'contextNotCleared' }],
        },
        // Uninstall doesn't clear context
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private context;

                    install(context) {
                        this.context = context;
                    }

                    uninstall() {
                        // Does something else but doesn't clear context
                        console.log('uninstalling');
                    }
                }
            `,
            errors: [{ messageId: 'contextNotCleared', suggestions: 1 }],
        },
        // Engine not cleared
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private engine;

                    install(context) {
                        this.engine = context.getEngine();
                    }

                    uninstall() {}
                }
            `,
            errors: [{ messageId: 'engineNotCleared', suggestions: 1 }],
        },
        // Multiple properties not cleared
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private context;
                    private engine;

                    install(context) {
                        this.context = context;
                        this.engine = context.getEngine();
                    }

                    uninstall() {}
                }
            `,
            errors: [
                { messageId: 'contextNotCleared', suggestions: 1 },
                { messageId: 'engineNotCleared', suggestions: 1 },
            ],
        },
        // Only one property cleared
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private context;
                    private engine;

                    install(context) {
                        this.context = context;
                        this.engine = context.getEngine();
                    }

                    uninstall() {
                        this.context = undefined;
                    }
                }
            `,
            errors: [{ messageId: 'engineNotCleared', suggestions: 1 }],
        },
        // Plugin by name pattern (no uninstall method - no suggestions)
        {
            code: `
                class TimelinePlugin {
                    private _context;

                    install(context) {
                        this._context = context;
                    }
                }
            `,
            errors: [{ messageId: 'contextNotCleared' }],
        },
        // Underscore prefixed properties
        {
            code: `
                class StatePlugin implements EnginePlugin {
                    private _engine;

                    install(context) {
                        this._engine = context.getEngine();
                    }

                    uninstall() {
                        // Forgot to clear
                    }
                }
            `,
            errors: [{ messageId: 'engineNotCleared', suggestions: 1 }],
        },
    ],
});
