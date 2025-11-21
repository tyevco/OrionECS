import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  external: ['orion-ecs', '@orion-ecs/utils', '@orion-ecs/input-manager', '@orion-ecs/canvas2d-renderer']
});
