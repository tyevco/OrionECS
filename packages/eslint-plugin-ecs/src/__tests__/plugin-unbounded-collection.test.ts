import { RuleTester } from '@typescript-eslint/rule-tester';

import { pluginUnboundedCollection } from '../rules/plugin-unbounded-collection';

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

ruleTester.run('plugin-unbounded-collection', pluginUnboundedCollection, {
    valid: [
        // Has MAX_SIZE constant
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private static readonly MAX_CACHE_SIZE = 1000;
                    private cache = new Map();

                    install(context) {}
                }
            `,
        },
        // Has LIMIT constant
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private static readonly QUEUE_LIMIT = 100;
                    private queue = [];

                    install(context) {}
                }
            `,
        },
        // Has cleanup method
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private data = new Map();

                    install(context) {}

                    uninstall() {
                        this.data.clear();
                    }
                }
            `,
        },
        // Not in a plugin class
        {
            code: `
                class DataManager {
                    private cache = new Map();

                    init() {}
                }
            `,
        },
        // Non-empty array initialization
        {
            code: `
                class MyPlugin implements EnginePlugin {
                    private defaults = [1, 2, 3];

                    install(context) {}
                }
            `,
        },
        // Has capacity constant
        {
            code: `
                class CachePlugin implements EnginePlugin {
                    private static readonly MAX_CAPACITY = 500;
                    private items = new Set();

                    install(context) {}
                }
            `,
        },
        // Has clear method
        {
            code: `
                class StatePlugin implements EnginePlugin {
                    private states = new Map();

                    install(context) {}

                    clear() {
                        this.states.clear();
                    }
                }
            `,
        },
        // Has dispose method
        {
            code: `
                class ResourcePlugin implements EnginePlugin {
                    private resources = [];

                    install(context) {}

                    dispose() {
                        this.resources.length = 0;
                    }
                }
            `,
        },
    ],
    invalid: [
        // Map without size limit
        {
            code: `
                class CachePlugin implements EnginePlugin {
                    private cache = new Map();

                    install(context) {}
                }
            `,
            errors: [{ messageId: 'unboundedMap', suggestions: 1 }],
        },
        // Set without size limit
        {
            code: `
                class TrackerPlugin implements EnginePlugin {
                    private tracked = new Set();

                    install(context) {}
                }
            `,
            errors: [{ messageId: 'unboundedSet', suggestions: 1 }],
        },
        // Array without size limit
        {
            code: `
                class QueuePlugin implements EnginePlugin {
                    private queue = [];

                    install(context) {}
                }
            `,
            errors: [{ messageId: 'unboundedArray', suggestions: 1 }],
        },
        // new Array() without size limit
        {
            code: `
                class BufferPlugin implements EnginePlugin {
                    private buffer = new Array();

                    install(context) {}
                }
            `,
            errors: [{ messageId: 'unboundedArray', suggestions: 1 }],
        },
        // Multiple collections
        {
            code: `
                class DataPlugin implements EnginePlugin {
                    private cache = new Map();
                    private ids = new Set();
                    private queue = [];

                    install(context) {}
                }
            `,
            errors: [
                { messageId: 'unboundedMap', suggestions: 1 },
                { messageId: 'unboundedSet', suggestions: 1 },
                { messageId: 'unboundedArray', suggestions: 1 },
            ],
        },
        // Plugin by name pattern
        {
            code: `
                class NetworkPlugin {
                    private connections = new Map();
                    private messages = [];

                    install(context) {}
                }
            `,
            errors: [
                { messageId: 'unboundedMap', suggestions: 1 },
                { messageId: 'unboundedArray', suggestions: 1 },
            ],
        },
        // Has install but no cleanup
        {
            code: `
                class StatePlugin implements EnginePlugin {
                    private transitions = new Map();

                    install(context) {
                        // setup
                    }

                    process() {
                        // processing but no cleanup
                    }
                }
            `,
            errors: [{ messageId: 'unboundedMap', suggestions: 1 }],
        },
    ],
});
