import { RuleTester } from '@typescript-eslint/rule-tester';

import { preferComponentPooling } from '../rules/prefer-component-pooling';

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

ruleTester.run('prefer-component-pooling', preferComponentPooling, {
    valid: [
        // Low usage count
        {
            code: `
                entity.addComponent(Position, 0, 0);
                entity.addComponent(Position, 1, 1);
                entity.addComponent(Position, 2, 2);
            `,
        },
        // Already pooled
        {
            code: `
                engine.registerComponentPool(Position, { initialSize: 100 });
                entity.addComponent(Position, 0, 0);
                entity.addComponent(Position, 1, 1);
                entity.addComponent(Position, 2, 2);
                entity.addComponent(Position, 3, 3);
                entity.addComponent(Position, 4, 4);
                entity.addComponent(Position, 5, 5);
                entity.addComponent(Position, 6, 6);
                entity.addComponent(Position, 7, 7);
                entity.addComponent(Position, 8, 8);
                entity.addComponent(Position, 9, 9);
                entity.addComponent(Position, 10, 10);
            `,
        },
        // High-frequency component already pooled
        {
            code: `
                engine.registerComponentPool(Particle, { initialSize: 1000 });
                entity.addComponent(Particle);
            `,
        },
        // Custom threshold - below it
        {
            code: `
                entity.addComponent(Position, 0, 0);
                entity.addComponent(Position, 1, 1);
                entity.addComponent(Position, 2, 2);
                entity.addComponent(Position, 3, 3);
                entity.addComponent(Position, 4, 4);
            `,
            options: [{ threshold: 20 }],
        },
        // Different components - each below threshold
        {
            code: `
                entity1.addComponent(Position, 0, 0);
                entity2.addComponent(Velocity, 1, 1);
                entity3.addComponent(Health, 100);
            `,
        },
        // Custom alwaysPoolComponents - not matching
        {
            code: `
                entity.addComponent(Position, 0, 0);
            `,
            options: [{ alwaysPoolComponents: ['CustomParticle'] }],
        },
    ],
    invalid: [
        // Exceeds default threshold
        {
            code: `
                entity1.addComponent(Position, 0, 0);
                entity2.addComponent(Position, 1, 1);
                entity3.addComponent(Position, 2, 2);
                entity4.addComponent(Position, 3, 3);
                entity5.addComponent(Position, 4, 4);
                entity6.addComponent(Position, 5, 5);
                entity7.addComponent(Position, 6, 6);
                entity8.addComponent(Position, 7, 7);
                entity9.addComponent(Position, 8, 8);
                entity10.addComponent(Position, 9, 9);
            `,
            errors: [{ messageId: 'suggestPooling' }],
        },
        // High-frequency component without pooling
        {
            code: `
                entity.addComponent(Particle);
            `,
            errors: [{ messageId: 'frequentComponent' }],
        },
        // Bullet component (default high-frequency)
        {
            code: `
                const bullet = engine.createEntity();
                bullet.addComponent(Bullet);
            `,
            errors: [{ messageId: 'frequentComponent' }],
        },
        // Projectile component (default high-frequency)
        {
            code: `
                entity.addComponent(Projectile);
            `,
            errors: [{ messageId: 'frequentComponent' }],
        },
        // Effect component (default high-frequency)
        {
            code: `
                entity.addComponent(Effect);
            `,
            errors: [{ messageId: 'frequentComponent' }],
        },
        // VFX component (default high-frequency)
        {
            code: `
                entity.addComponent(VFX);
            `,
            errors: [{ messageId: 'frequentComponent' }],
        },
        // Custom lower threshold
        {
            code: `
                entity1.addComponent(Position, 0, 0);
                entity2.addComponent(Position, 1, 1);
                entity3.addComponent(Position, 2, 2);
                entity4.addComponent(Position, 3, 3);
                entity5.addComponent(Position, 4, 4);
            `,
            options: [{ threshold: 5 }],
            errors: [{ messageId: 'suggestPooling' }],
        },
        // Custom alwaysPoolComponents
        {
            code: `
                entity.addComponent(CustomParticle);
            `,
            options: [{ alwaysPoolComponents: ['CustomParticle'] }],
            errors: [{ messageId: 'frequentComponent' }],
        },
        // Multiple components with lower threshold (rule counts static calls, not iterations)
        {
            code: `
                entity.addComponent(Position, 0, 0);
                entity.addComponent(Velocity, 1, 1);
            `,
            options: [{ threshold: 1, alwaysPoolComponents: [] }],
            errors: [{ messageId: 'suggestPooling' }, { messageId: 'suggestPooling' }],
        },
    ],
});
