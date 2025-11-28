// Existing rules

// Phase 8: Type Safety & Physics Rules
import { componentDefaultParams } from './rules/component-default-params';
import { componentLifecycleComplete } from './rules/component-lifecycle-complete';
import { componentOrder } from './rules/component-order';
import { componentTypes } from './rules/component-types';
import { componentValidator } from './rules/component-validator';
import { dataOnlyComponents } from './rules/data-only-components';
// Phase 5: Entity & Hierarchy Rules
import { entityUniqueNames } from './rules/entity-unique-names';
import { fixedUpdateForPhysics } from './rules/fixed-update-for-physics';
import { hierarchyCyclePrevention } from './rules/hierarchy-cycle-prevention';
// Phase 7: Reactive Programming Rules
import { markComponentDirty } from './rules/mark-component-dirty';
import { noAsyncInSystemCallbacks } from './rules/no-async-in-system-callbacks';
import { noComponentLogic } from './rules/no-component-logic';
import { noEntityMutationOutsideSystem } from './rules/no-entity-mutation-outside-system';
import { noMagicTagStrings } from './rules/no-magic-tag-strings';
import { noNestedTransactions } from './rules/no-nested-transactions';
// Phase 1: Critical Safety Rules
import { noQueryInActCallback } from './rules/no-query-in-act-callback';
import { noStaticState } from './rules/no-static-state';
// Phase 6: Advanced Plugin Rules
import { pluginContextCleanup } from './rules/plugin-context-cleanup';
import { pluginDependencyValidation } from './rules/plugin-dependency-validation';
import { pluginLoggingFormat } from './rules/plugin-logging-format';
// Phase 3: Best Practice Rules
import { pluginStructureValidation } from './rules/plugin-structure-validation';
import { pluginUnboundedCollection } from './rules/plugin-unbounded-collection';
// Phase 4: Performance & Optimization Rules
import { preferBatchOperations } from './rules/prefer-batch-operations';
import { preferComponentPooling } from './rules/prefer-component-pooling';
import { preferComposition } from './rules/prefer-composition';
import { preferEngineLogger } from './rules/prefer-engine-logger';
import { preferPrefabForTemplates } from './rules/prefer-prefab-for-templates';
import { preferQueueFree } from './rules/prefer-queueFree';
import { querySpecificity } from './rules/query-specificity';
import { queryValidator } from './rules/query-validator';
// Phase 2: Correctness Rules
import { requireHasComponentBeforeGetComponent } from './rules/require-hasComponent-before-getComponent';
import { singletonMarkDirty } from './rules/singleton-mark-dirty';
import { subscriptionCleanupRequired } from './rules/subscription-cleanup-required';
import { systemNamingConvention } from './rules/system-naming-convention';
import { systemPriorityExplicit } from './rules/system-priority-explicit';
import { useCommandBufferInSystem } from './rules/use-command-buffer-in-system';
import { useWatchComponentsFilter } from './rules/use-watchComponents-filter';

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
    'no-static-state': noStaticState,

    // Phase 4: Performance & Optimization Rules
    'prefer-batch-operations': preferBatchOperations,
    'prefer-prefab-for-templates': preferPrefabForTemplates,
    'prefer-component-pooling': preferComponentPooling,
    'query-specificity': querySpecificity,

    // Phase 5: Entity & Hierarchy Rules
    'entity-unique-names': entityUniqueNames,
    'hierarchy-cycle-prevention': hierarchyCyclePrevention,

    // Phase 6: Advanced Plugin Rules
    'plugin-dependency-validation': pluginDependencyValidation,
    'plugin-unbounded-collection': pluginUnboundedCollection,
    'plugin-context-cleanup': pluginContextCleanup,

    // Phase 7: Reactive Programming Rules
    'mark-component-dirty': markComponentDirty,
    'use-watchComponents-filter': useWatchComponentsFilter,

    // Phase 8: Type Safety & Physics Rules
    'component-default-params': componentDefaultParams,
    'fixed-update-for-physics': fixedUpdateForPhysics,
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
    '@orion-ecs/ecs/no-static-state': 'warn', // Warns about static state in components

    // Phase 4: Performance & Optimization Rules
    '@orion-ecs/ecs/prefer-batch-operations': 'warn', // Encourages performance best practices
    '@orion-ecs/ecs/prefer-prefab-for-templates': 'off', // Off by default, can be noisy
    '@orion-ecs/ecs/prefer-component-pooling': 'off', // Off by default, requires analysis
    '@orion-ecs/ecs/query-specificity': 'warn', // Encourages specific queries

    // Phase 5: Entity & Hierarchy Rules
    '@orion-ecs/ecs/entity-unique-names': 'warn', // Helps debugging
    '@orion-ecs/ecs/hierarchy-cycle-prevention': 'error', // Prevents runtime errors

    // Phase 6: Advanced Plugin Rules
    '@orion-ecs/ecs/plugin-dependency-validation': 'warn', // Prevents runtime crashes
    '@orion-ecs/ecs/plugin-unbounded-collection': 'warn', // Prevents memory leaks
    '@orion-ecs/ecs/plugin-context-cleanup': 'warn', // Prevents memory leaks

    // Phase 7: Reactive Programming Rules
    '@orion-ecs/ecs/mark-component-dirty': 'off', // Off by default, only for reactive systems
    '@orion-ecs/ecs/use-watchComponents-filter': 'warn', // Improves performance

    // Phase 8: Type Safety & Physics Rules
    '@orion-ecs/ecs/component-default-params': 'off', // Off by default, style preference
    '@orion-ecs/ecs/fixed-update-for-physics': 'error', // Ensures correct physics behavior
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
    '@orion-ecs/ecs/no-static-state': 'error', // Errors on static state in components

    // Phase 4: Performance & Optimization Rules
    '@orion-ecs/ecs/prefer-batch-operations': 'error',
    '@orion-ecs/ecs/prefer-prefab-for-templates': 'warn',
    '@orion-ecs/ecs/prefer-component-pooling': 'warn',
    '@orion-ecs/ecs/query-specificity': 'error',

    // Phase 5: Entity & Hierarchy Rules
    '@orion-ecs/ecs/entity-unique-names': 'error',
    '@orion-ecs/ecs/hierarchy-cycle-prevention': 'error',

    // Phase 6: Advanced Plugin Rules
    '@orion-ecs/ecs/plugin-dependency-validation': 'error',
    '@orion-ecs/ecs/plugin-unbounded-collection': 'error',
    '@orion-ecs/ecs/plugin-context-cleanup': 'error',

    // Phase 7: Reactive Programming Rules
    '@orion-ecs/ecs/mark-component-dirty': 'warn',
    '@orion-ecs/ecs/use-watchComponents-filter': 'error',

    // Phase 8: Type Safety & Physics Rules
    '@orion-ecs/ecs/component-default-params': 'warn',
    '@orion-ecs/ecs/fixed-update-for-physics': 'error',
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
