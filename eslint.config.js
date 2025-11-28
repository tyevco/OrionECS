import tseslint from '@typescript-eslint/parser';

/**
 * ESLint Configuration for OrionECS
 *
 * This configuration uses the custom @orion-ecs/eslint-plugin-ecs plugin
 * to enforce ECS best practices. The plugin is built locally before use.
 *
 * ECS Rules Available:
 * - ecs/data-only-components: Ensures components have no methods
 * - ecs/no-component-logic: Prevents complex logic in component constructors
 * - ecs/prefer-composition: Discourages component inheritance
 * - ecs/no-entity-mutation-outside-system: Warns about entity mutations outside systems
 * - ecs/component-validator: Catches issues in registerComponentValidator calls
 *
 * Usage:
 *   npm run lint:ecs
 */

// Dynamic import to handle the case where the plugin hasn't been built yet
let ecsPlugin;
try {
    ecsPlugin = await import('./packages/eslint-plugin-ecs/dist/index.js');
} catch {
    console.warn('Warning: @orion-ecs/eslint-plugin-ecs not built yet. Run "npm run build" first.');
    ecsPlugin = null;
}

const config = [
    {
        // Ignore patterns
        ignores: ['**/node_modules/**', '**/dist/**', '**/*.js', '**/*.mjs', '**/*.bench.ts'],
    },
    {
        // Main TypeScript configuration
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tseslint,
            parserOptions: {
                ecmaVersion: 2023,
                sourceType: 'module',
            },
        },
        linterOptions: {
            // Don't report errors for missing rule definitions (from existing eslint-disable comments)
            reportUnusedDisableDirectives: 'off',
        },
        plugins: {
            ...(ecsPlugin ? { ecs: ecsPlugin.default || ecsPlugin } : {}),
        },
        rules: {
            // ECS Best Practice Rules (only if plugin is loaded)
            ...(ecsPlugin
                ? {
                      // Data-only components - Components should not have methods
                      'ecs/data-only-components': [
                          'warn',
                          {
                              componentPattern:
                                  '(Component|Position|Velocity|Health|Transform|Sprite|Collider|State|Data|RigidBody|StateMachine)$',
                              allowedMethods: ['clone', 'reset', 'toString', 'toJSON'],
                          },
                      ],

                      // No complex logic in component constructors
                      'ecs/no-component-logic': [
                          'warn',
                          {
                              componentPattern:
                                  '(Component|Position|Velocity|Health|Transform|Sprite|Collider|State|Data|RigidBody)$',
                              allowedFunctions: [
                                  'Date.now',
                                  'Math.random',
                                  'Math.floor',
                                  'Math.ceil',
                                  'Math.round',
                                  'Object.assign',
                                  'Array.from',
                                  'Set',
                                  'Map',
                                  'Symbol',
                              ],
                          },
                      ],

                      // Prefer composition over inheritance
                      'ecs/prefer-composition': [
                          'warn',
                          {
                              componentPattern:
                                  '(Component|Position|Velocity|Health|Transform|Sprite|Collider|State|Data)$',
                          },
                      ],

                      // Entity mutations should happen in systems (off by default, can be noisy)
                      'ecs/no-entity-mutation-outside-system': 'off',

                      // Component validator - catch issues in registerComponentValidator
                      'ecs/component-validator': 'error',
                  }
                : {}),
        },
    },
];

export default config;
