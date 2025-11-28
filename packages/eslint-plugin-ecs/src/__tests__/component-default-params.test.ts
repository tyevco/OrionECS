import { RuleTester } from '@typescript-eslint/rule-tester';

import { componentDefaultParams } from '../rules/component-default-params';

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

ruleTester.run('component-default-params', componentDefaultParams, {
    valid: [
        // All params have defaults
        {
            code: `
                class Position {
                    constructor(public x: number = 0, public y: number = 0) {}
                }
            `,
        },
        // Using assignment pattern
        {
            code: `
                class Velocity {
                    x: number;
                    y: number;
                    constructor(x = 0, y = 0) {
                        this.x = x;
                        this.y = y;
                    }
                }
            `,
        },
        // No constructor
        {
            code: `
                class HealthComponent {
                    current = 100;
                    max = 100;
                }
            `,
        },
        // Empty constructor
        {
            code: `
                class TagComponent {
                    constructor() {}
                }
            `,
        },
        // Rest parameter (allowed)
        {
            code: `
                class DataComponent {
                    constructor(...args: any[]) {}
                }
            `,
        },
        // Optional parameters
        {
            code: `
                class OptionalComponent {
                    constructor(public value?: number) {}
                }
            `,
        },
        // Not a component class
        {
            code: `
                class MyService {
                    constructor(public config: object) {}
                }
            `,
        },
        // Custom pattern - matches
        {
            code: `
                class PlayerStats {
                    constructor(public health: number = 100) {}
                }
            `,
            options: [{ componentPattern: 'Stats$' }],
        },
        // Mixed defaults and optionals
        {
            code: `
                class Transform {
                    constructor(
                        public x: number = 0,
                        public y: number = 0,
                        public rotation?: number
                    ) {}
                }
            `,
        },
    ],
    invalid: [
        // Missing default
        {
            code: `
                class Position {
                    constructor(public x: number, public y: number) {}
                }
            `,
            errors: [
                { messageId: 'missingDefault', suggestions: 1 },
                { messageId: 'missingDefault', suggestions: 1 },
            ],
        },
        // One missing default
        {
            code: `
                class Velocity {
                    constructor(public x: number, public y: number = 0) {}
                }
            `,
            errors: [{ messageId: 'missingDefault', suggestions: 1 }],
        },
        // Health component without defaults
        {
            code: `
                class Health {
                    constructor(public current: number, public max: number) {}
                }
            `,
            errors: [
                { messageId: 'missingDefault', suggestions: 1 },
                { messageId: 'missingDefault', suggestions: 1 },
            ],
        },
        // Transform without defaults
        {
            code: `
                class Transform {
                    constructor(
                        public x: number,
                        public y: number,
                        public z: number
                    ) {}
                }
            `,
            errors: [
                { messageId: 'missingDefault', suggestions: 1 },
                { messageId: 'missingDefault', suggestions: 1 },
                { messageId: 'missingDefault', suggestions: 1 },
            ],
        },
        // Sprite component
        {
            code: `
                class Sprite {
                    constructor(public texture: string) {}
                }
            `,
            errors: [{ messageId: 'missingDefault', suggestions: 1 }],
        },
        // Collider component
        {
            code: `
                class Collider {
                    constructor(public width: number, public height: number) {}
                }
            `,
            errors: [
                { messageId: 'missingDefault', suggestions: 1 },
                { messageId: 'missingDefault', suggestions: 1 },
            ],
        },
        // RigidBody component
        {
            code: `
                class RigidBody {
                    constructor(public mass: number) {}
                }
            `,
            errors: [{ messageId: 'missingDefault', suggestions: 1 }],
        },
        // Optional not allowed
        {
            code: `
                class Renderable {
                    constructor(public color?: string) {}
                }
            `,
            options: [{ allowOptionalWithoutDefault: false }],
            errors: [{ messageId: 'missingDefault', suggestions: 1 }],
        },
        // Custom pattern
        {
            code: `
                class PlayerData {
                    constructor(public score: number) {}
                }
            `,
            options: [{ componentPattern: 'Data$' }],
            errors: [{ messageId: 'missingDefault', suggestions: 1 }],
        },
    ],
});
