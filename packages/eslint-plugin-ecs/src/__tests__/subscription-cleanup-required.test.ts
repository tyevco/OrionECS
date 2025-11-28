import { RuleTester } from '@typescript-eslint/rule-tester';
import { subscriptionCleanupRequired } from '../rules/subscription-cleanup-required';

const ruleTester = new RuleTester();

ruleTester.run('subscription-cleanup-required', subscriptionCleanupRequired, {
    valid: [
        // Properly stored and cleaned up subscription
        {
            code: `
        class MyPlugin {
          private unsubscribe?: () => void;

          install(context: PluginContext): void {
            this.unsubscribe = context.on('onComponentAdded', () => {});
          }

          uninstall(): void {
            this.unsubscribe?.();
          }
        }
      `,
        },
        // Multiple subscriptions properly handled
        {
            code: `
        class PhysicsPlugin {
          private sub1?: () => void;
          private sub2?: () => void;

          install(context: PluginContext): void {
            this.sub1 = context.on('onStart', () => {});
            this.sub2 = context.messageBus.subscribe('collision', () => {});
          }

          uninstall(): void {
            this.sub1?.();
            this.sub2?.();
          }
        }
      `,
        },
        // Non-plugin class with subscriptions (should not be checked)
        {
            code: `
        class GameManager {
          install(): void {
            engine.on('onStart', () => {});
          }
        }
      `,
        },
        // Plugin without subscriptions
        {
            code: `
        class SimplePlugin {
          install(context: PluginContext): void {
            context.registerComponent(Position);
          }
        }
      `,
        },
        // Subscription stored and cleaned via unsubscribe method
        {
            code: `
        class EventPlugin {
          private subscription?: { unsubscribe: () => void };

          install(context: PluginContext): void {
            this.subscription = context.on('onUpdate', () => {});
          }

          uninstall(): void {
            this.subscription?.unsubscribe();
          }
        }
      `,
        },
        // Plugin class identified by implements clause
        {
            code: `
        class MyExtension implements EnginePlugin {
          private cleanup?: () => void;

          install(context: PluginContext): void {
            this.cleanup = context.on('onStop', () => {});
          }

          uninstall(): void {
            this.cleanup?.();
          }
        }
      `,
        },
    ],
    invalid: [
        // Subscription not stored
        {
            code: `
        class LeakyPlugin {
          install(context: PluginContext): void {
            context.on('onComponentAdded', () => {});
          }

          uninstall(): void {}
        }
      `,
            errors: [{ messageId: 'subscriptionNotStored' }],
        },
        // Subscription stored but not cleaned up
        {
            code: `
        class ForgetfulPlugin {
          private unsubscribe?: () => void;

          install(context: PluginContext): void {
            this.unsubscribe = context.on('onStart', () => {});
          }

          uninstall(): void {
            // Forgot to call this.unsubscribe
            console.log('uninstalled');
          }
        }
      `,
            errors: [{ messageId: 'subscriptionNotCleanedUp' }],
        },
        // Plugin with subscriptions but no uninstall method
        {
            code: `
        class IncompletePlugin {
          private sub?: () => void;

          install(context: PluginContext): void {
            this.sub = context.on('onUpdate', () => {});
          }
        }
      `,
            errors: [{ messageId: 'missingUninstallMethod' }],
        },
        // Multiple subscriptions, one not cleaned
        {
            code: `
        class PartialPlugin {
          private sub1?: () => void;
          private sub2?: () => void;

          install(context: PluginContext): void {
            this.sub1 = context.on('onStart', () => {});
            this.sub2 = context.on('onStop', () => {});
          }

          uninstall(): void {
            this.sub1?.();
            // Forgot sub2
          }
        }
      `,
            errors: [{ messageId: 'subscriptionNotCleanedUp' }],
        },
        // MessageBus subscription not stored
        {
            code: `
        class MessagePlugin {
          install(context: PluginContext): void {
            context.messageBus.subscribe('player-died', () => {});
          }

          uninstall(): void {}
        }
      `,
            errors: [{ messageId: 'subscriptionNotStored' }],
        },
        // Multiple issues
        {
            code: `
        class BadPlugin {
          private storedSub?: () => void;

          install(context: PluginContext): void {
            context.on('onStart', () => {});
            this.storedSub = context.on('onStop', () => {});
          }

          uninstall(): void {
            // Neither subscription is cleaned up
          }
        }
      `,
            errors: [
                { messageId: 'subscriptionNotStored' },
                { messageId: 'subscriptionNotCleanedUp' },
            ],
        },
    ],
});
