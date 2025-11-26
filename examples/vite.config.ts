import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/OrionECS/examples/',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                // Games
                asteroids: resolve(__dirname, 'games/asteroids.html'),
                platformer: resolve(__dirname, 'games/platformer.html'),
                'tower-defense': resolve(__dirname, 'games/tower-defense.html'),
                'void-vanguard': resolve(__dirname, 'games/void-vanguard.html'),
                'rts-demo': resolve(__dirname, 'games/rts-demo.html'),
                'space-shooter': resolve(__dirname, 'games/space-shooter.html'),
                // Integrations
                pixi: resolve(__dirname, 'integrations/pixi.html'),
                threejs: resolve(__dirname, 'integrations/threejs.html'),
            },
        },
    },
    resolve: {
        alias: {
            // Package aliases
            '@orion-ecs/core': resolve(__dirname, '../packages/core/src/index.ts'),
            '@orion-ecs/state-machine': resolve(__dirname, '../plugins/state-machine/src/index.ts'),
            // Relative path aliases (various patterns used in examples)
            '../../core/src': resolve(__dirname, '../packages/core/src'),
            '../../packages/core/src': resolve(__dirname, '../packages/core/src'),
            '../src': resolve(__dirname, '../packages/core/src'),
            '../../plugins': resolve(__dirname, '../plugins'),
        },
    },
});
