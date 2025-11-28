import { RuleTester } from '@typescript-eslint/rule-tester';

import { preferPrefabForTemplates } from '../rules/prefer-prefab-for-templates';

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

ruleTester.run('prefer-prefab-for-templates', preferPrefabForTemplates, {
    valid: [
        // Simple entity creation (few components)
        {
            code: `
                const entity = engine.createEntity();
                entity.addComponent(Position, 0, 0);
            `,
        },
        // Already using prefab
        {
            code: `
                function spawnEnemy(x, y) {
                    return engine.createFromPrefab('Enemy', 'Enemy_' + Date.now());
                }
            `,
        },
        // Not a spawn function
        {
            code: `
                function processData() {
                    const entity = engine.createEntity();
                    entity.addComponent(Position, 0, 0);
                    entity.addComponent(Velocity, 1, 1);
                    entity.addComponent(Health, 100);
                    return entity;
                }
            `,
        },
        // Below component threshold
        {
            code: `
                function spawnEntity(x, y) {
                    const entity = engine.createEntity();
                    entity.addComponent(Position, x, y);
                    entity.addComponent(Velocity, 0, 0);
                    return entity;
                }
            `,
        },
        // Custom threshold - below it
        {
            code: `
                function spawnPlayer(x, y) {
                    const entity = engine.createEntity();
                    entity.addComponent(Position, x, y);
                    entity.addComponent(Velocity, 0, 0);
                    entity.addComponent(Health, 100);
                    return entity;
                }
            `,
            options: [{ minComponents: 5 }],
        },
        // Not repeated enough for pattern detection
        {
            code: `
                function setupGame() {
                    const player = engine.createEntity();
                    player.addComponent(Position, 0, 0);
                    player.addComponent(Velocity, 1, 1);
                    player.addComponent(Health, 100);
                }
            `,
        },
    ],
    invalid: [
        // Spawn function with many components
        {
            code: `
                function spawnEnemy(x, y) {
                    const entity = engine.createEntity();
                    entity.addComponent(Position, x, y);
                    entity.addComponent(Velocity, 0, 0);
                    entity.addComponent(Health, 100);
                    entity.addComponent(Damage, 10);
                    return entity;
                }
            `,
            errors: [{ messageId: 'preferPrefab' }],
        },
        // Create function with many components
        {
            code: `
                function createBullet(x, y, vx, vy) {
                    const bullet = engine.createEntity();
                    bullet.addComponent(Position, x, y);
                    bullet.addComponent(Velocity, vx, vy);
                    bullet.addComponent(Damage, 5);
                    return bullet;
                }
            `,
            errors: [{ messageId: 'preferPrefab' }],
        },
        // Arrow function factory
        {
            code: `
                const spawnAsteroid = (size) => {
                    const asteroid = engine.createEntity();
                    asteroid.addComponent(Position, 0, 0);
                    asteroid.addComponent(Velocity, 1, 1);
                    asteroid.addComponent(Size, size);
                    return asteroid;
                };
            `,
            errors: [{ messageId: 'preferPrefab' }],
        },
        // Make function
        {
            code: `
                function makeParticle(x, y, color) {
                    const particle = engine.createEntity();
                    particle.addComponent(Position, x, y);
                    particle.addComponent(Velocity, 0, -1);
                    particle.addComponent(Renderable, color);
                    particle.addComponent(Lifetime, 1000);
                    return particle;
                }
            `,
            errors: [{ messageId: 'preferPrefab' }],
        },
        // Build function
        {
            code: `
                function buildPlayer() {
                    const player = engine.createEntity('Player');
                    player.addComponent(Position, 0, 0);
                    player.addComponent(Velocity, 0, 0);
                    player.addComponent(Health, 100);
                    player.addComponent(Inventory);
                    return player;
                }
            `,
            errors: [{ messageId: 'preferPrefab' }],
        },
        // Factory function expression
        {
            code: `
                const enemyFactory = function(type) {
                    const enemy = engine.createEntity();
                    enemy.addComponent(Position, 0, 0);
                    enemy.addComponent(Health, 50);
                    enemy.addComponent(AI, type);
                    return enemy;
                };
            `,
            errors: [{ messageId: 'preferPrefab' }],
        },
        // Lower threshold
        {
            code: `
                function spawnSimple(x, y) {
                    const entity = engine.createEntity();
                    entity.addComponent(Position, x, y);
                    entity.addComponent(Velocity, 0, 0);
                    return entity;
                }
            `,
            options: [{ minComponents: 2 }],
            errors: [{ messageId: 'preferPrefab' }],
        },
        // Multiple factory functions (each reports preferPrefab)
        {
            code: `
                function spawnEnemy1(x, y) {
                    const entity = engine.createEntity();
                    entity.addComponent(Position, x, y);
                    entity.addComponent(Health, 50);
                    entity.addComponent(AI);
                    return entity;
                }
                function spawnEnemy2(x, y) {
                    const entity = engine.createEntity();
                    entity.addComponent(Position, x, y);
                    entity.addComponent(Health, 50);
                    entity.addComponent(AI);
                    return entity;
                }
            `,
            errors: [{ messageId: 'preferPrefab' }, { messageId: 'preferPrefab' }],
        },
    ],
});
