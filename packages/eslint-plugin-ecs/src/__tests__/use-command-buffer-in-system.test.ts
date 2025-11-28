import { RuleTester } from '@typescript-eslint/rule-tester';
import { useCommandBufferInSystem } from '../rules/use-command-buffer-in-system';

const ruleTester = new RuleTester();

ruleTester.run('use-command-buffer-in-system', useCommandBufferInSystem, {
    valid: [
        // Using command buffer for spawning - correct pattern
        {
            code: `
        class Position {}
        class Weapon {}
        engine.createSystem('Spawner', { all: [Weapon] }, {
          act: (entity, weapon) => {
            if (weapon.shouldFire) {
              engine.commands.spawn()
                .named('Bullet')
                .with(Position, 0, 0);
            }
          }
        });
      `,
        },
        // Using command buffer for entity modification
        {
            code: `
        class Health {}
        class Buff {}
        engine.createSystem('BuffSystem', { all: [Health] }, {
          act: (entity, health) => {
            engine.commands.entity(entity)
              .add(Buff, 1.5)
              .addTag('buffed');
          }
        });
      `,
        },
        // Using command buffer for despawn
        {
            code: `
        class Health {}
        engine.createSystem('DeathSystem', { all: [Health] }, {
          act: (entity, health) => {
            if (health.current <= 0) {
              engine.commands.despawn(entity);
            }
          }
        });
      `,
        },
        // Entity creation outside of system callback
        {
            code: `
        class Position {}
        function setupGame() {
          const player = engine.createEntity('Player');
          player.addComponent(Position, 0, 0);
        }
      `,
        },
        // Component modification outside of system callback
        {
            code: `
        class Health {}
        function healPlayer(player) {
          const health = player.getComponent(Health);
          health.current = health.max;
        }
      `,
        },
        // Nested function outside system context
        {
            code: `
        class Enemy {}
        class Position {}
        function spawnEnemies() {
          for (let i = 0; i < 10; i++) {
            const enemy = engine.createEntity('Enemy');
            enemy.addComponent(Position, i * 10, 0);
            enemy.addTag('enemy');
          }
        }
      `,
        },
    ],
    invalid: [
        // Direct entity creation in act callback
        {
            code: `
        class Weapon {}
        class Position {}
        engine.createSystem('Spawner', { all: [Weapon] }, {
          act: (entity, weapon) => {
            if (weapon.shouldFire) {
              const bullet = engine.createEntity('Bullet');
              bullet.addComponent(Position, 0, 0);
            }
          }
        });
      `,
            errors: [
                { messageId: 'useCommandBufferForCreate' },
                { messageId: 'useCommandBufferForMutation' },
            ],
        },
        // createEntities in before callback
        {
            code: `
        class Position {}
        engine.createSystem('Setup', { all: [Position] }, {
          before: () => {
            engine.createEntities(10);
          },
          act: (entity, pos) => {}
        });
      `,
            errors: [{ messageId: 'useCommandBufferForCreate' }],
        },
        // createFromPrefab in act callback
        {
            code: `
        class Spawner {}
        engine.createSystem('EnemySpawner', { all: [Spawner] }, {
          act: (entity, spawner) => {
            if (spawner.shouldSpawn) {
              engine.createFromPrefab('Enemy', 'Enemy1');
            }
          }
        });
      `,
            errors: [{ messageId: 'useCommandBufferForCreate' }],
        },
        // Direct component operations in act callback
        {
            code: `
        class Health {}
        class Buff {}
        engine.createSystem('PowerUp', { all: [Health] }, {
          act: (entity, health) => {
            entity.addComponent(Buff, 1.5);
            entity.addTag('powered');
          }
        });
      `,
            errors: [
                { messageId: 'useCommandBufferForMutation' },
                { messageId: 'useCommandBufferForMutation' },
            ],
        },
        // Direct queueFree in act callback
        {
            code: `
        class Health {}
        engine.createSystem('Death', { all: [Health] }, {
          act: (entity, health) => {
            if (health.current <= 0) {
              entity.queueFree();
            }
          }
        });
      `,
            errors: [{ messageId: 'useCommandBufferForMutation' }],
        },
        // Component removal in act callback
        {
            code: `
        class Debuff {}
        class Timer {}
        engine.createSystem('DebuffExpiry', { all: [Debuff, Timer] }, {
          act: (entity, debuff, timer) => {
            if (timer.elapsed > debuff.duration) {
              entity.removeComponent(Debuff);
            }
          }
        });
      `,
            errors: [{ messageId: 'useCommandBufferForMutation' }],
        },
        // Hierarchy operations in act callback
        {
            code: `
        class Parent {}
        class Child {}
        engine.createSystem('Hierarchy', { all: [Parent] }, {
          act: (entity, parent) => {
            const child = engine.createEntity('Child');
            entity.addChild(child);
          }
        });
      `,
            errors: [
                { messageId: 'useCommandBufferForCreate' },
                { messageId: 'useCommandBufferForMutation' },
            ],
        },
        // Operations in after callback
        {
            code: `
        class Position {}
        engine.createSystem('Cleanup', { all: [Position] }, {
          act: (entity, pos) => {},
          after: () => {
            const marker = engine.createEntity('Marker');
          }
        });
      `,
            errors: [{ messageId: 'useCommandBufferForCreate' }],
        },
    ],
});
