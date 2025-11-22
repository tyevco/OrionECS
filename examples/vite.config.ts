import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/OrionECS/',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                asteroids: resolve(__dirname, 'games/asteroids.html'),
                platformer: resolve(__dirname, 'games/platformer.html'),
                pixi: resolve(__dirname, 'integrations/pixi.html'),
            },
        },
    },
    resolve: {
        alias: {
            '@orionecs/core': resolve(__dirname, '../core/src/index.ts'),
        },
    },
});
