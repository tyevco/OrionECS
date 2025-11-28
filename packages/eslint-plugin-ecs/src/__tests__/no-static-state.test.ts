import { RuleTester } from '@typescript-eslint/rule-tester';
import { noStaticState } from '../rules/no-static-state';

const ruleTester = new RuleTester();

// Component tests
ruleTester.run('no-static-state (components)', noStaticState, {
    valid: [
        // Simple data-only component without static state
        {
            code: `
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
        },
        // Component with instance properties only
        {
            code: `
        class HealthComponent {
          public current: number = 100;
          public max: number = 100;
          constructor() {}
        }
      `,
        },
        // Non-component class with static (doesn't match pattern)
        {
            code: `
        class EntityManager {
          static instance: EntityManager | null = null;
          constructor() {}
        }
      `,
        },
        // Component with allowed static property (schema)
        {
            code: `
        class Position {
          static schema = { x: 'number', y: 'number' };
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
        },
        // Component with allowed static property (componentType)
        {
            code: `
        class VelocityComponent {
          static componentType = 'Velocity';
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
        },
        // Const module-level variable (immutable, allowed by default)
        {
            code: `
        const DEFAULT_HEALTH = 100;
        class HealthComponent {
          constructor(public current: number = DEFAULT_HEALTH) {}
        }
      `,
            options: [{ checkModuleLevelState: true }],
        },
        // Component with custom allowed static property
        {
            code: `
        class Position {
          static pool: Position[] = [];
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            options: [{ allowedStaticProperties: ['schema', 'componentType', 'pool'] }],
        },
        // Module-level let with allowed pattern
        {
            code: `
        let _debugMode = false;
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            options: [{ checkModuleLevelState: true, allowedModuleLevelPatterns: ['^_'] }],
        },
        // Module-level state not checked by default
        {
            code: `
        let globalCounter = 0;
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
        },
        // Component checking disabled
        {
            code: `
        class Position {
          static counter = 0;
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            options: [{ checkComponents: false }],
        },
    ],
    invalid: [
        // Component with static property (counter)
        {
            code: `
        class Position {
          static instanceCount = 0;
          constructor(public x: number = 0, public y: number = 0) {
            Position.instanceCount++;
          }
        }
      `,
            errors: [{ messageId: 'noStaticPropertyInComponent' }],
        },
        // Component with static property (cache)
        {
            code: `
        class VelocityComponent {
          static cache = new Map();
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            errors: [{ messageId: 'noStaticPropertyInComponent' }],
        },
        // Component with static method
        {
            code: `
        class HealthData {
          static create(current: number, max: number) {
            return new HealthData(current, max);
          }
          constructor(public current: number, public max: number) {}
        }
      `,
            errors: [{ messageId: 'noStaticMethodInComponent' }],
        },
        // Component with multiple static members
        {
            code: `
        class TransformComponent {
          static instances: TransformComponent[] = [];
          static counter = 0;
          static reset() {
            TransformComponent.instances = [];
            TransformComponent.counter = 0;
          }
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            errors: [
                { messageId: 'noStaticPropertyInComponent' },
                { messageId: 'noStaticPropertyInComponent' },
                { messageId: 'noStaticMethodInComponent' },
            ],
        },
        // Module-level mutable state (let)
        {
            code: `
        let entityCounter = 0;
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            options: [{ checkModuleLevelState: true }],
            errors: [{ messageId: 'noModuleLevelMutableState' }],
        },
        // Module-level mutable state (var)
        {
            code: `
        var globalState = { count: 0 };
        class VelocityComponent {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            options: [{ checkModuleLevelState: true }],
            errors: [{ messageId: 'noModuleLevelMutableState' }],
        },
        // Multiple module-level mutable variables
        {
            code: `
        let counter = 0;
        let cache = new Map();
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
            options: [{ checkModuleLevelState: true }],
            errors: [
                { messageId: 'noModuleLevelMutableState' },
                { messageId: 'noModuleLevelMutableState' },
            ],
        },
        // Component detected by custom pattern
        {
            code: `
        class PlayerData {
          static registry = new Map();
          constructor(public name: string) {}
        }
      `,
            options: [{ componentPattern: 'Data$' }],
            errors: [{ messageId: 'noStaticPropertyInComponent' }],
        },
        // Static property with initialization
        {
            code: `
        class SpriteComponent {
          static defaultTexture = 'missing.png';
          constructor(public texture: string = SpriteComponent.defaultTexture) {}
        }
      `,
            errors: [{ messageId: 'noStaticPropertyInComponent' }],
        },
    ],
});

// System tests
ruleTester.run('no-static-state (systems)', noStaticState, {
    valid: [
        // System without static state
        {
            code: `
        class MovementSystem {
          update(deltaTime: number) {
            // process entities
          }
        }
      `,
        },
        // System with instance properties only
        {
            code: `
        class PhysicsSystem {
          private gravity = 9.8;
          update(deltaTime: number) {
            // apply physics
          }
        }
      `,
        },
        // System with allowed static property
        {
            code: `
        class RenderSystem {
          static name = 'RenderSystem';
          update(deltaTime: number) {}
        }
      `,
        },
        // System checking disabled
        {
            code: `
        class MovementSystem {
          static cache = new Map();
          update(deltaTime: number) {}
        }
      `,
            options: [{ checkSystems: false }],
        },
    ],
    invalid: [
        // System with static property
        {
            code: `
        class MovementSystem {
          static entityCount = 0;
          update(deltaTime: number) {}
        }
      `,
            errors: [{ messageId: 'noStaticPropertyInSystem' }],
        },
        // System with static cache
        {
            code: `
        class CollisionSystem {
          static collisionCache = new Map();
          update(deltaTime: number) {}
        }
      `,
            errors: [{ messageId: 'noStaticPropertyInSystem' }],
        },
        // System with static method
        {
            code: `
        class RenderSystem {
          static getInstance() {
            return new RenderSystem();
          }
          update(deltaTime: number) {}
        }
      `,
            errors: [{ messageId: 'noStaticMethodInSystem' }],
        },
        // System with multiple static members
        {
            code: `
        class AISystem {
          static instances: AISystem[] = [];
          static counter = 0;
          static reset() {
            AISystem.instances = [];
          }
          update(deltaTime: number) {}
        }
      `,
            errors: [
                { messageId: 'noStaticPropertyInSystem' },
                { messageId: 'noStaticPropertyInSystem' },
                { messageId: 'noStaticMethodInSystem' },
            ],
        },
        // System detected by custom pattern
        {
            code: `
        class PlayerController {
          static sharedState = {};
          update(deltaTime: number) {}
        }
      `,
            options: [{ systemPattern: 'Controller$' }],
            errors: [{ messageId: 'noStaticPropertyInSystem' }],
        },
    ],
});

// Plugin tests
ruleTester.run('no-static-state (plugins)', noStaticState, {
    valid: [
        // Plugin without static state
        {
            code: `
        class PhysicsPlugin {
          name = 'PhysicsPlugin';
          version = '1.0.0';
          install(context: any) {}
        }
      `,
        },
        // Plugin implementing EnginePlugin without static state
        {
            code: `
        interface EnginePlugin {
          name: string;
          version: string;
          install(context: any): void;
        }
        class NetworkPlugin implements EnginePlugin {
          name = 'NetworkPlugin';
          version = '1.0.0';
          install(context: any) {}
        }
      `,
        },
        // Plugin with allowed static property
        {
            code: `
        class DebugPlugin {
          static name = 'DebugPlugin';
          version = '1.0.0';
          install(context: any) {}
        }
      `,
        },
        // Plugin checking disabled
        {
            code: `
        class AudioPlugin {
          static instances: AudioPlugin[] = [];
          install(context: any) {}
        }
      `,
            options: [{ checkPlugins: false }],
        },
    ],
    invalid: [
        // Plugin with static property
        {
            code: `
        class PhysicsPlugin {
          static instance: PhysicsPlugin | null = null;
          name = 'PhysicsPlugin';
          version = '1.0.0';
          install(context: any) {}
        }
      `,
            errors: [{ messageId: 'noStaticPropertyInPlugin' }],
        },
        // Plugin implementing EnginePlugin with static state
        {
            code: `
        interface EnginePlugin {
          name: string;
          version: string;
          install(context: any): void;
        }
        class NetworkPlugin implements EnginePlugin {
          static connections = new Map();
          name = 'NetworkPlugin';
          version = '1.0.0';
          install(context: any) {}
        }
      `,
            errors: [{ messageId: 'noStaticPropertyInPlugin' }],
        },
        // Plugin with static method
        {
            code: `
        class InputPlugin {
          static create() {
            return new InputPlugin();
          }
          install(context: any) {}
        }
      `,
            errors: [{ messageId: 'noStaticMethodInPlugin' }],
        },
        // Plugin with multiple static members
        {
            code: `
        class ResourcePlugin {
          static loadedResources: string[] = [];
          static resourceCount = 0;
          static clearCache() {
            ResourcePlugin.loadedResources = [];
          }
          install(context: any) {}
        }
      `,
            errors: [
                { messageId: 'noStaticPropertyInPlugin' },
                { messageId: 'noStaticPropertyInPlugin' },
                { messageId: 'noStaticMethodInPlugin' },
            ],
        },
        // Plugin detected by custom pattern
        {
            code: `
        class AudioExtension {
          static audioContext: any = null;
          install(context: any) {}
        }
      `,
            options: [{ pluginPattern: 'Extension$' }],
            errors: [{ messageId: 'noStaticPropertyInPlugin' }],
        },
    ],
});

// Mixed tests - verifying correct type detection
ruleTester.run('no-static-state (mixed types)', noStaticState, {
    valid: [
        // All types without static state
        {
            code: `
        class Position {
          constructor(public x: number = 0, public y: number = 0) {}
        }
        class MovementSystem {
          update(deltaTime: number) {}
        }
        class PhysicsPlugin {
          install(context: any) {}
        }
      `,
        },
    ],
    invalid: [
        // All types with static state in same file
        {
            code: `
        class Position {
          static counter = 0;
          constructor(public x: number = 0, public y: number = 0) {}
        }
        class MovementSystem {
          static cache = new Map();
          update(deltaTime: number) {}
        }
        class PhysicsPlugin {
          static instance = null;
          install(context: any) {}
        }
      `,
            errors: [
                { messageId: 'noStaticPropertyInComponent' },
                { messageId: 'noStaticPropertyInSystem' },
                { messageId: 'noStaticPropertyInPlugin' },
            ],
        },
    ],
});

// Usage-based detection tests
ruleTester.run('no-static-state (usage detection)', noStaticState, {
    valid: [
        // Component detected from usage, no static state
        {
            code: `
        class Player {
          constructor(public name: string) {}
        }
        const entity = { addComponent: (c: any, ...args: any[]) => {} };
        entity.addComponent(Player, 'Hero');
      `,
            options: [{ detectFromUsage: true }],
        },
        // Plugin detected from usage, no static state
        {
            code: `
        class MyCustom {
          install(context: any) {}
        }
        const engine = { use: (p: any) => {} };
        engine.use(new MyCustom());
      `,
            options: [{ detectFromUsage: true }],
        },
    ],
    invalid: [
        // Component detected from addComponent usage
        {
            code: `
        class Player {
          static count = 0;
          constructor(public name: string) {}
        }
        const entity = { addComponent: (c: any, ...args: any[]) => {} };
        entity.addComponent(Player, 'Hero');
      `,
            options: [{ detectFromUsage: true }],
            errors: [{ messageId: 'noStaticPropertyInComponent' }],
        },
        // Systems still detected even with usage detection enabled
        {
            code: `
        class AISystem {
          static decisions = [];
          update(deltaTime: number) {}
        }
        const entity = { addComponent: (c: any, ...args: any[]) => {} };
      `,
            options: [{ detectFromUsage: true }],
            errors: [{ messageId: 'noStaticPropertyInSystem' }],
        },
        // Plugin detected from engine.use() with static state
        {
            code: `
        class MyCustom {
          static instance = null;
          install(context: any) {}
        }
        const engine = { use: (p: any) => {} };
        engine.use(new MyCustom());
      `,
            options: [{ detectFromUsage: true }],
            errors: [{ messageId: 'noStaticPropertyInPlugin' }],
        },
        // Plugin detected from builder.use() with static state
        {
            code: `
        class NetworkManager {
          static connections = new Map();
          install(context: any) {}
        }
        const builder = { use: (p: any) => builder };
        builder.use(new NetworkManager());
      `,
            options: [{ detectFromUsage: true }],
            errors: [{ messageId: 'noStaticPropertyInPlugin' }],
        },
        // Plugin with static method detected from usage
        {
            code: `
        class AudioManager {
          static getInstance() { return null; }
          install(context: any) {}
        }
        const engine = { use: (p: any) => {} };
        engine.use(new AudioManager());
      `,
            options: [{ detectFromUsage: true }],
            errors: [{ messageId: 'noStaticMethodInPlugin' }],
        },
    ],
});
