import { RuleTester } from '@typescript-eslint/rule-tester';
import { pluginLoggingFormat } from '../rules/plugin-logging-format';

const ruleTester = new RuleTester();

ruleTester.run('plugin-logging-format', pluginLoggingFormat, {
    valid: [
        // Correct logging format
        {
            code: `
        class PhysicsPlugin implements EnginePlugin {
          install(context) {
            console.log('[PhysicsPlugin] Installed successfully');
          }
          uninstall() {
            console.log('[PhysicsPlugin] Uninstalled successfully');
          }
        }
      `,
        },
        // Various log levels with correct format
        {
            code: `
        class AudioPlugin implements EnginePlugin {
          install(context) {
            console.info('[AudioPlugin] Loading audio system');
            console.warn('[AudioPlugin] Audio context not available');
            console.error('[AudioPlugin] Failed to load sound');
            console.debug('[AudioPlugin] Debug info');
          }
        }
      `,
        },
        // Non-plugin class (should be ignored)
        {
            code: `
        class GameManager {
          start() {
            console.log('Game started');
          }
        }
      `,
        },
        // Template literal with prefix
        {
            code: `
        class InputPlugin implements EnginePlugin {
          install(context) {
            console.log(\`[InputPlugin] Bound \${keys.length} keys\`);
          }
        }
      `,
        },
    ],
    invalid: [
        // Missing prefix
        {
            code: `
        class PhysicsPlugin implements EnginePlugin {
          install(context) {
            console.log('Installed successfully');
          }
        }
      `,
            errors: [{ messageId: 'missingPluginPrefix' }],
        },
        // Wrong prefix
        {
            code: `
        class AudioPlugin implements EnginePlugin {
          install(context) {
            console.log('[WrongName] Installed');
          }
        }
      `,
            errors: [{ messageId: 'incorrectLogFormat' }],
        },
        // Multiple logging issues
        {
            code: `
        class NetworkPlugin implements EnginePlugin {
          install(context) {
            console.log('Starting network');
            console.info('Connected');
          }
          uninstall() {
            console.log('Disconnected');
          }
        }
      `,
            errors: [
                { messageId: 'missingPluginPrefix' },
                { messageId: 'missingPluginPrefix' },
                { messageId: 'missingPluginPrefix' },
            ],
        },
    ],
});
