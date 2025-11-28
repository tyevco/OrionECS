// Existing rules

import { componentLifecycleComplete } from './rules/component-lifecycle-complete';
import { componentOrder } from './rules/component-order';
import { componentTypes } from './rules/component-types';
import { componentValidator } from './rules/component-validator';
import { dataOnlyComponents } from './rules/data-only-components';
import { noAsyncInSystemCallbacks } from './rules/no-async-in-system-callbacks';
import { noComponentLogic } from './rules/no-component-logic';
import { noEntityMutationOutsideSystem } from './rules/no-entity-mutation-outside-system';
import { noMagicTagStrings } from './rules/no-magic-tag-strings';
import { noNestedTransactions } from './rules/no-nested-transactions';
// Phase 1: Critical Safety Rules
import { noQueryInActCallback } from './rules/no-query-in-act-callback';
import { pluginLoggingFormat } from './rules/plugin-logging-format';
// Phase 3: Best Practice Rules
import { pluginStructureValidation } from './rules/plugin-structure-validation';
import { preferComposition } from './rules/prefer-composition';
import { preferEngineLogger } from './rules/prefer-engine-logger';
import { preferQueueFree } from './rules/prefer-queueFree';
import { queryValidator } from './rules/query-validator';
// Phase 2: Correctness Rules
import { requireHasComponentBeforeGetComponent } from './rules/require-hasComponent-before-getComponent';
import { singletonMarkDirty } from './rules/singleton-mark-dirty';
import { subscriptionCleanupRequired } from './rules/subscription-cleanup-required';
import { systemNamingConvention } from './rules/system-naming-convention';
import { systemPriorityExplicit } from './rules/system-priority-explicit';
import { useCommandBufferInSystem } from './rules/use-command-buffer-in-system';

// Export individual rules for direct access
export const rules = {
    // Original rules
    'data-only-components': dataOnlyComponents,
    'no-component-logic': noComponentLogic,
    'prefer-composition': preferComposition,
    'no-entity-mutation-outside-system': noEntityMutationOutsideSystem,
    'component-validator': componentValidator,
    'component-order': componentOrder,
    'component-types': componentTypes,
    'query-validator': queryValidator,

    // Phase 1: Critical Safety Rules
    'no-query-in-act-callback': noQueryInActCallback,
    'use-command-buffer-in-system': useCommandBufferInSystem,
    'subscription-cleanup-required': subscriptionCleanupRequired,

    // Phase 2: Correctness Rules
    'require-hasComponent-before-getComponent': requireHasComponentBeforeGetComponent,
    'singleton-mark-dirty': singletonMarkDirty,
    'no-async-in-system-callbacks': noAsyncInSystemCallbacks,

    // Phase 3: Best Practice Rules
    'plugin-structure-validation': pluginStructureValidation,
    'system-priority-explicit': systemPriorityExplicit,
    'component-lifecycle-complete': componentLifecycleComplete,
    'no-magic-tag-strings': noMagicTagStrings,
    'prefer-queueFree': preferQueueFree,
    'system-naming-convention': systemNamingConvention,
    'plugin-logging-format': pluginLoggingFormat,
    'no-nested-transactions': noNestedTransactions,
    'prefer-engine-logger': preferEngineLogger,
};

// Recommended configuration - warns on most rules
const recommendedRules = {
    // Original rules
    '@orion-ecs/ecs/data-only-components': 'warn',
    '@orion-ecs/ecs/no-component-logic': 'warn',
    '@orion-ecs/ecs/prefer-composition': 'warn',
    '@orion-ecs/ecs/no-entity-mutation-outside-system': 'off', // Off by default, can be noisy
    '@orion-ecs/ecs/component-validator': 'error', // Errors because these are likely bugs
    '@orion-ecs/ecs/component-order': 'warn', // Warn because may have false positives with dynamic code
    '@orion-ecs/ecs/component-types': 'warn', // Requires type information, validates at call sites
    '@orion-ecs/ecs/query-validator': 'error', // Errors because these are logical contradictions

    // Phase 1: Critical Safety Rules
    '@orion-ecs/ecs/no-query-in-act-callback': 'error', // Critical performance issue
    '@orion-ecs/ecs/use-command-buffer-in-system': 'error', // Prevents iterator invalidation
    '@orion-ecs/ecs/subscription-cleanup-required': 'error', // Prevents memory leaks

    // Phase 2: Correctness Rules
    '@orion-ecs/ecs/require-hasComponent-before-getComponent': 'warn', // Prevents runtime errors
    '@orion-ecs/ecs/singleton-mark-dirty': 'warn', // Ensures event propagation
    '@orion-ecs/ecs/no-async-in-system-callbacks': 'warn', // Prevents hidden bugs

    // Phase 3: Best Practice Rules
    '@orion-ecs/ecs/plugin-structure-validation': 'error', // Enforces plugin architecture
    '@orion-ecs/ecs/system-priority-explicit': 'off', // Off by default, can be noisy for simple projects
    '@orion-ecs/ecs/component-lifecycle-complete': 'warn', // Encourages proper cleanup
    '@orion-ecs/ecs/no-magic-tag-strings': 'off', // Off by default, can be noisy
    '@orion-ecs/ecs/prefer-queueFree': 'warn', // Encourages safe deletion
    '@orion-ecs/ecs/system-naming-convention': 'off', // Off by default, style preference
    '@orion-ecs/ecs/plugin-logging-format': 'off', // Off by default, style preference
    '@orion-ecs/ecs/no-nested-transactions': 'error', // Prevents runtime errors
    '@orion-ecs/ecs/prefer-engine-logger': 'warn', // Encourages secure, consistent logging
} as const;

// Strict configuration - errors on most rules
const strictRules = {
    // Original rules
    '@orion-ecs/ecs/data-only-components': 'error',
    '@orion-ecs/ecs/no-component-logic': 'error',
    '@orion-ecs/ecs/prefer-composition': 'error',
    '@orion-ecs/ecs/no-entity-mutation-outside-system': 'warn',
    '@orion-ecs/ecs/component-validator': 'error',
    '@orion-ecs/ecs/component-order': 'error',
    '@orion-ecs/ecs/component-types': 'error', // Requires type information, validates at call sites
    '@orion-ecs/ecs/query-validator': 'error',

    // Phase 1: Critical Safety Rules
    '@orion-ecs/ecs/no-query-in-act-callback': 'error',
    '@orion-ecs/ecs/use-command-buffer-in-system': 'error',
    '@orion-ecs/ecs/subscription-cleanup-required': 'error',

    // Phase 2: Correctness Rules
    '@orion-ecs/ecs/require-hasComponent-before-getComponent': 'error',
    '@orion-ecs/ecs/singleton-mark-dirty': 'error',
    '@orion-ecs/ecs/no-async-in-system-callbacks': 'error',

    // Phase 3: Best Practice Rules
    '@orion-ecs/ecs/plugin-structure-validation': 'error',
    '@orion-ecs/ecs/system-priority-explicit': 'warn',
    '@orion-ecs/ecs/component-lifecycle-complete': 'error',
    '@orion-ecs/ecs/no-magic-tag-strings': 'warn',
    '@orion-ecs/ecs/prefer-queueFree': 'error',
    '@orion-ecs/ecs/system-naming-convention': 'warn',
    '@orion-ecs/ecs/plugin-logging-format': 'warn',
    '@orion-ecs/ecs/no-nested-transactions': 'error',
    '@orion-ecs/ecs/prefer-engine-logger': 'error', // Enforces secure, consistent logging
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
