import { RuleTester } from '@typescript-eslint/rule-tester';
import { preferEngineLogger } from '../rules/prefer-engine-logger';

const ruleTester = new RuleTester();

ruleTester.run('prefer-engine-logger', preferEngineLogger, {
    valid: [
        // Using engine.logger is fine
        {
            code: `
        class MyPlugin implements EnginePlugin {
          install(context) {
            context.logger.info('Plugin installed');
          }
        }
      `,
        },
        // Using logger.* methods
        {
            code: `
        function initGame(engine) {
          const logger = engine.logger;
          logger.info('Game initialized');
          logger.debug('Debug info');
          logger.warn('Warning message');
          logger.error('Error occurred');
        }
      `,
        },
        // Test files should be allowed by default
        {
            code: `
        console.log('Testing something');
        console.error('Test error');
      `,
            filename: 'myfile.spec.ts',
        },
        {
            code: `
        console.log('Testing something');
      `,
            filename: 'myfile.test.ts',
        },
        {
            code: `
        console.log('Testing something');
      `,
            filename: '__tests__/myfile.ts',
        },
        // console.error allowed when option is set
        {
            code: `
        function handleCriticalError() {
          console.error('Critical error!');
        }
      `,
            options: [{ allowConsoleError: true }],
        },
        // Non-logging console methods are not flagged by default
        {
            code: `
        console.time('benchmark');
        console.timeEnd('benchmark');
        console.trace();
        console.clear();
      `,
        },
        // Custom methods list excludes certain methods
        {
            code: `
        function debug() {
          console.log('Debug info');
        }
      `,
            options: [{ methods: ['warn', 'error'], allowInTests: false }],
            filename: 'src/system.ts',
        },
    ],
    invalid: [
        // Basic console.log usage
        {
            code: `
        function init() {
          console.log('Initializing');
        }
      `,
            filename: 'src/game.ts',
            errors: [{ messageId: 'preferEngineLogger' }],
        },
        // console.warn usage
        {
            code: `
        function checkHealth(health) {
          if (health < 10) {
            console.warn('Low health!');
          }
        }
      `,
            filename: 'src/health.ts',
            errors: [{ messageId: 'preferEngineLogger' }],
        },
        // console.error usage
        {
            code: `
        function processEntity(entity) {
          if (!entity) {
            console.error('Entity is null');
          }
        }
      `,
            filename: 'src/entity.ts',
            errors: [{ messageId: 'preferEngineLogger' }],
        },
        // console.info usage
        {
            code: `
        function start() {
          console.info('Starting game');
        }
      `,
            filename: 'src/start.ts',
            errors: [{ messageId: 'preferEngineLogger' }],
        },
        // console.debug usage
        {
            code: `
        function update(dt) {
          console.debug('Delta time:', dt);
        }
      `,
            filename: 'src/update.ts',
            errors: [{ messageId: 'preferEngineLogger' }],
        },
        // Multiple console statements
        {
            code: `
        function gameLoop() {
          console.log('Loop start');
          console.debug('Processing entities');
          console.log('Loop end');
        }
      `,
            filename: 'src/loop.ts',
            errors: [
                { messageId: 'preferEngineLogger' },
                { messageId: 'preferEngineLogger' },
                { messageId: 'preferEngineLogger' },
            ],
        },
        // Inside a Plugin class
        {
            code: `
        class PhysicsPlugin implements EnginePlugin {
          install(context) {
            console.log('Physics initialized');
          }
        }
      `,
            filename: 'src/plugins/physics.ts',
            errors: [{ messageId: 'preferEngineLogger' }],
        },
        // Inside a System class
        {
            code: `
        class MovementSystem {
          update(entities) {
            console.log('Processing movement');
          }
        }
      `,
            filename: 'src/systems/movement.ts',
            errors: [{ messageId: 'preferEngineLogger' }],
        },
        // Inside a Manager class
        {
            code: `
        class EntityManager {
          createEntity() {
            console.log('Creating entity');
            return {};
          }
        }
      `,
            filename: 'src/managers/entity.ts',
            errors: [{ messageId: 'preferEngineLogger' }],
        },
        // Inside system callback (createSystem)
        {
            code: `
        engine.createSystem('Movement', { all: [Position, Velocity] }, {
          act: (entity, pos, vel) => {
            console.log('Moving entity');
            pos.x += vel.x;
          }
        });
      `,
            filename: 'src/systems.ts',
            errors: [{ messageId: 'preferEngineLoggerInSystem' }],
        },
        // Inside system before callback
        {
            code: `
        engine.createSystem('Physics', { all: [RigidBody] }, {
          before: () => {
            console.log('Before physics update');
          },
          act: (entity) => {}
        });
      `,
            filename: 'src/systems.ts',
            errors: [{ messageId: 'preferEngineLoggerInSystem' }],
        },
        // Inside system after callback
        {
            code: `
        engine.createSystem('Render', { all: [Sprite] }, {
          act: (entity) => {},
          after: () => {
            console.debug('Render complete');
          }
        });
      `,
            filename: 'src/systems.ts',
            errors: [{ messageId: 'preferEngineLoggerInSystem' }],
        },
        // Test files not allowed when option is false
        {
            code: `
        console.log('This should be flagged');
      `,
            filename: 'src/game.spec.ts',
            options: [{ allowInTests: false }],
            errors: [{ messageId: 'preferEngineLogger' }],
        },
        // Custom methods list
        {
            code: `
        function debug() {
          console.warn('Warning');
          console.error('Error');
        }
      `,
            options: [{ methods: ['warn', 'error'], allowInTests: false }],
            filename: 'src/debug.ts',
            errors: [{ messageId: 'preferEngineLogger' }, { messageId: 'preferEngineLogger' }],
        },
    ],
});
