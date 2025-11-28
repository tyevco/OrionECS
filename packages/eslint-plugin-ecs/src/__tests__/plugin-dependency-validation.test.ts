import { RuleTester } from '@typescript-eslint/rule-tester';

import { pluginDependencyValidation } from '../rules/plugin-dependency-validation';

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

ruleTester.run('plugin-dependency-validation', pluginDependencyValidation, {
    valid: [
        // With null check
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    install(context) {
                        const engine = context.getEngine();
                        if (!engine.input) {
                            console.warn('InputManager required');
                            return;
                        }
                        engine.input.on('click', handler);
                    }
                }
            `,
        },
        // With optional chaining
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    install(context) {
                        const engine = context.getEngine();
                        engine.input?.on('click', handler);
                    }
                }
            `,
        },
        // With existence check
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    install(context) {
                        const engine = context.getEngine();
                        if (engine.physics) {
                            engine.physics.setGravity(0, -9.8);
                        }
                    }
                }
            `,
        },
        // Optional type in cast
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    install(context) {
                        const engine = context.getEngine() as { input?: InputAPI };
                        engine.input?.on('click', handler);
                    }
                }
            `,
        },
        // Not in a plugin class
        {
            code: `
                class GameSetup {
                    init() {
                        const engine = new Engine();
                        engine.input.on('click', handler);
                    }
                }
            `,
        },
        // Unknown extension (not in known list)
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    install(context) {
                        const engine = context.getEngine();
                        engine.customExtension.doSomething();
                    }
                }
            `,
        },
        // With !== undefined check
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    install(context) {
                        const engine = context.getEngine();
                        if (engine.audio !== undefined) {
                            engine.audio.play('sound');
                        }
                    }
                }
            `,
        },
        // Plugin class by name pattern
        {
            code: `
                class AudioPlugin {
                    install(context) {
                        const engine = context.getEngine();
                        if (!engine.input) return;
                        engine.input.on('keydown', handler);
                    }
                }
            `,
        },
    ],
    invalid: [
        // Direct access without check
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    install(context) {
                        const engine = context.getEngine();
                        engine.input.on('click', handler);
                    }
                }
            `,
            errors: [{ messageId: 'missingDependencyCheck', suggestions: 1 }],
        },
        // Multiple accesses without checks
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    install(context) {
                        const engine = context.getEngine();
                        engine.input.on('click', handler);
                        engine.physics.setGravity(0, -9.8);
                    }
                }
            `,
            errors: [
                { messageId: 'missingDependencyCheck', suggestions: 1 },
                { messageId: 'missingDependencyCheck', suggestions: 1 },
            ],
        },
        // Unsafe type cast (non-optional)
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    install(context) {
                        const engine = context.getEngine() as { input: InputAPI };
                        engine.input.on('click', handler);
                    }
                }
            `,
            errors: [
                { messageId: 'unsafeCast' },
                { messageId: 'missingDependencyCheck', suggestions: 1 },
            ],
        },
        // Plugin by name pattern
        {
            code: `
                class InteractionPlugin {
                    install(context) {
                        const engine = context.getEngine();
                        engine.input.on('mousemove', handler);
                    }
                }
            `,
            errors: [{ messageId: 'missingDependencyCheck', suggestions: 1 }],
        },
        // Access in method
        {
            code: `
                class NetworkPlugin implements EnginePlugin {
                    private engine;

                    install(context) {
                        this.engine = context.getEngine();
                    }

                    sync() {
                        this.engine.network.broadcast(data);
                    }
                }
            `,
            errors: [{ messageId: 'missingDependencyCheck', suggestions: 1 }],
        },
        // Chained access
        {
            code: `
                class UIPlugin implements EnginePlugin {
                    install(context) {
                        const engine = context.getEngine();
                        engine.input.getMousePosition();
                    }
                }
            `,
            errors: [{ messageId: 'missingDependencyCheck', suggestions: 1 }],
        },
    ],
});
