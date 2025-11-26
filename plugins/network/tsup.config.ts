import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/transports/WebSocketServerTransport.ts',
    'src/transports/WebSocketClientTransport.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['ws', '@orion-ecs/core'],
});
