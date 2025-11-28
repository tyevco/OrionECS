import { RuleTester } from '@typescript-eslint/rule-tester';
import { componentLifecycleComplete } from '../rules/component-lifecycle-complete';

const ruleTester = new RuleTester();

ruleTester.run('component-lifecycle-complete', componentLifecycleComplete, {
    valid: [
        // Both lifecycle methods present
        {
            code: `
        class EventListenerComponent {
          onCreate(entity) {
            window.addEventListener('click', this.handleClick);
          }
          onDestroy(entity) {
            window.removeEventListener('click', this.handleClick);
          }
        }
      `,
        },
        // No lifecycle methods (just data)
        {
            code: `
        class PositionComponent {
          constructor(public x: number = 0, public y: number = 0) {}
        }
      `,
        },
        // Only onDestroy (less common but allowed)
        {
            code: `
        class CleanupComponent {
          onDestroy(entity) {
            console.log('cleaned up');
          }
        }
      `,
        },
        // Non-component class
        {
            code: `
        class GameManager {
          onCreate() {
            // Not a component, should be ignored
          }
        }
      `,
        },
        // Component with onChanged only
        {
            code: `
        class HealthComponent {
          onChanged() {
            console.log('health changed');
          }
        }
      `,
        },
    ],
    invalid: [
        // onCreate without onDestroy
        {
            code: `
        class ResourceComponent {
          onCreate(entity) {
            this.resource = loadResource();
          }
        }
      `,
            errors: [{ messageId: 'missingOnDestroy' }],
        },
        // Multiple components with missing onDestroy
        {
            code: `
        class AudioComponent {
          onCreate(entity) {
            this.audio = new AudioContext();
          }
        }
        class NetworkComponent {
          onCreate(entity) {
            this.socket = new WebSocket('ws://server');
          }
        }
      `,
            errors: [{ messageId: 'missingOnDestroy' }, { messageId: 'missingOnDestroy' }],
        },
    ],
});
