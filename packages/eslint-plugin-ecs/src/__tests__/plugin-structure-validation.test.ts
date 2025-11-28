import { RuleTester } from '@typescript-eslint/rule-tester';
import { pluginStructureValidation } from '../rules/plugin-structure-validation';

const ruleTester = new RuleTester();

ruleTester.run('plugin-structure-validation', pluginStructureValidation, {
    valid: [
        // Well-formed plugin
        {
            code: `
        class PhysicsPlugin implements EnginePlugin {
          readonly name = 'PhysicsPlugin';
          readonly version = '1.0.0';

          install(context: PluginContext): void {
            // setup
          }
        }
      `,
        },
        // Plugin with uninstall (optional)
        {
            code: `
        class InputPlugin implements EnginePlugin {
          readonly name = 'InputPlugin';
          readonly version = '2.1.0';

          install(context: PluginContext): void {}
          uninstall(): void {}
        }
      `,
        },
        // Plugin with prerelease version
        {
            code: `
        class BetaPlugin implements EnginePlugin {
          readonly name = 'BetaPlugin';
          readonly version = '1.0.0-beta.1';

          install(context: PluginContext): void {}
        }
      `,
        },
        // Non-plugin class (should be ignored)
        {
            code: `
        class GameManager {
          name = 'manager';
          start() {}
        }
      `,
        },
        // Plugin suffix not required
        {
            code: `
        class NetworkExtension implements EnginePlugin {
          readonly name = 'NetworkExtension';
          readonly version = '1.0.0';
          install(context: PluginContext): void {}
        }
      `,
            options: [{ requirePluginSuffix: false, requireSemver: true }],
        },
    ],
    invalid: [
        // Missing name field
        {
            code: `
        class MyPlugin implements EnginePlugin {
          readonly version = '1.0.0';
          install(context: PluginContext): void {}
        }
      `,
            errors: [{ messageId: 'missingNameField' }],
        },
        // Missing version field
        {
            code: `
        class MyPlugin implements EnginePlugin {
          readonly name = 'MyPlugin';
          install(context: PluginContext): void {}
        }
      `,
            errors: [{ messageId: 'missingVersionField' }],
        },
        // Missing install method
        {
            code: `
        class MyPlugin implements EnginePlugin {
          readonly name = 'MyPlugin';
          readonly version = '1.0.0';
        }
      `,
            errors: [{ messageId: 'missingInstallMethod' }],
        },
        // Invalid version format
        {
            code: `
        class MyPlugin implements EnginePlugin {
          readonly name = 'MyPlugin';
          readonly version = 'v1';
          install(context: PluginContext): void {}
        }
      `,
            errors: [{ messageId: 'invalidVersionFormat' }],
        },
        // Missing Plugin suffix
        {
            code: `
        class NetworkManager implements EnginePlugin {
          readonly name = 'NetworkManager';
          readonly version = '1.0.0';
          install(context: PluginContext): void {}
        }
      `,
            errors: [{ messageId: 'pluginNamingConvention' }],
        },
        // Name field doesn't match class name
        {
            code: `
        class AudioPlugin implements EnginePlugin {
          readonly name = 'SoundPlugin';
          readonly version = '1.0.0';
          install(context: PluginContext): void {}
        }
      `,
            errors: [{ messageId: 'nameFieldMismatch' }],
        },
        // Multiple issues (errors ordered by node position in source)
        {
            code: `
        class BadExtension implements EnginePlugin {
          readonly name = 'WrongName';
        }
      `,
            errors: [
                { messageId: 'missingVersionField' },
                { messageId: 'missingInstallMethod' },
                { messageId: 'pluginNamingConvention' },
                { messageId: 'nameFieldMismatch' },
            ],
        },
    ],
});
