import { dataOnlyComponents } from './rules/data-only-components';
import { noComponentLogic } from './rules/no-component-logic';
import { noEntityMutationOutsideSystem } from './rules/no-entity-mutation-outside-system';
import { preferComposition } from './rules/prefer-composition';

// Export individual rules for direct access
export const rules = {
    'data-only-components': dataOnlyComponents,
    'no-component-logic': noComponentLogic,
    'prefer-composition': preferComposition,
    'no-entity-mutation-outside-system': noEntityMutationOutsideSystem,
};

// Recommended configuration - warns on all rules
const recommendedRules = {
    '@orion-ecs/ecs/data-only-components': 'warn',
    '@orion-ecs/ecs/no-component-logic': 'warn',
    '@orion-ecs/ecs/prefer-composition': 'warn',
    '@orion-ecs/ecs/no-entity-mutation-outside-system': 'off', // Off by default, can be noisy
} as const;

// Strict configuration - errors on core rules
const strictRules = {
    '@orion-ecs/ecs/data-only-components': 'error',
    '@orion-ecs/ecs/no-component-logic': 'error',
    '@orion-ecs/ecs/prefer-composition': 'error',
    '@orion-ecs/ecs/no-entity-mutation-outside-system': 'warn',
} as const;

// Export configurations
export const configs = {
    recommended: {
        plugins: ['@orion-ecs/ecs'],
        rules: recommendedRules,
    },
    strict: {
        plugins: ['@orion-ecs/ecs'],
        rules: strictRules,
    },
};

// Default export for ESLint plugin format
const plugin = {
    rules,
    configs,
};

export default plugin;
