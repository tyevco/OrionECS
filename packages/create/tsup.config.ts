import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        cli: 'src/cli.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    banner: {
        js: '#!/usr/bin/env node',
    },
    esbuildOptions(options) {
        // Only add shebang banner to cli.js
        if (options.entryPoints && Array.isArray(options.entryPoints)) {
            const isCli = options.entryPoints.some(
                (entry) => typeof entry === 'string' && entry.includes('cli')
            );
            if (!isCli) {
                options.banner = {};
            }
        }
    },
});
