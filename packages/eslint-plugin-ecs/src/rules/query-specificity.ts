import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'emptyQuery' | 'broadQuery' | 'emptyActCallback' | 'unusedQueryResults';

type Options = [
    {
        /** Whether to allow empty queries (default: false) */
        allowEmptyQueries?: boolean;
        /** Minimum components for a specific query */
        minComponents?: number;
    },
];

/**
 * Check if a function body is effectively empty or minimal
 */
function isEmptyOrMinimalBody(body: TSESTree.BlockStatement | TSESTree.Expression): boolean {
    if (body.type !== 'BlockStatement') {
        // Arrow function with expression body - not empty
        return false;
    }

    const statements = body.body;

    // Empty body
    if (statements.length === 0) {
        return true;
    }

    // Only empty statements or comments
    if (statements.every((s) => s.type === 'EmptyStatement')) {
        return true;
    }

    // Single return with no value
    if (
        statements.length === 1 &&
        statements[0].type === 'ReturnStatement' &&
        statements[0].argument === null
    ) {
        return true;
    }

    return false;
}

/**
 * Get the query options from createSystem call
 */
function getQueryOptions(node: TSESTree.CallExpression): TSESTree.ObjectExpression | null {
    // createSystem(name, queryOptions, systemOptions, ...)
    if (node.arguments.length >= 2) {
        const queryArg = node.arguments[1];
        if (queryArg.type === 'ObjectExpression') {
            return queryArg;
        }
    }
    return null;
}

/**
 * Get the system options from createSystem call
 */
function getSystemOptions(node: TSESTree.CallExpression): TSESTree.ObjectExpression | null {
    // createSystem(name, queryOptions, systemOptions, ...)
    if (node.arguments.length >= 3) {
        const optionsArg = node.arguments[2];
        if (optionsArg.type === 'ObjectExpression') {
            return optionsArg;
        }
    }
    return null;
}

/**
 * Get a property from an object expression
 */
function getProperty(obj: TSESTree.ObjectExpression, name: string): TSESTree.Property | null {
    for (const prop of obj.properties) {
        if (prop.type === 'Property' && prop.key.type === 'Identifier' && prop.key.name === name) {
            return prop;
        }
    }
    return null;
}

/**
 * Count components in a query
 */
function countQueryComponents(queryOptions: TSESTree.ObjectExpression): number {
    let count = 0;

    const allProp = getProperty(queryOptions, 'all');
    if (allProp?.value.type === 'ArrayExpression') {
        count += allProp.value.elements.length;
    }

    const anyProp = getProperty(queryOptions, 'any');
    if (anyProp?.value.type === 'ArrayExpression') {
        count += anyProp.value.elements.length;
    }

    return count;
}

/**
 * Check if query has any filters
 */
function hasQueryFilters(queryOptions: TSESTree.ObjectExpression): boolean {
    const allProp = getProperty(queryOptions, 'all');
    const anyProp = getProperty(queryOptions, 'any');
    const noneProp = getProperty(queryOptions, 'none');
    const tagsProp = getProperty(queryOptions, 'tags');
    const withoutTagsProp = getProperty(queryOptions, 'withoutTags');

    // Check if all is non-empty
    if (allProp?.value.type === 'ArrayExpression' && allProp.value.elements.length > 0) {
        return true;
    }

    // Check if any is non-empty
    if (anyProp?.value.type === 'ArrayExpression' && anyProp.value.elements.length > 0) {
        return true;
    }

    // Check if none is non-empty
    if (noneProp?.value.type === 'ArrayExpression' && noneProp.value.elements.length > 0) {
        return true;
    }

    // Check if tags is non-empty
    if (tagsProp?.value.type === 'ArrayExpression' && tagsProp.value.elements.length > 0) {
        return true;
    }

    // Check if withoutTags is non-empty
    if (
        withoutTagsProp?.value.type === 'ArrayExpression' &&
        withoutTagsProp.value.elements.length > 0
    ) {
        return true;
    }

    return false;
}

/**
 * Rule: query-specificity
 *
 * Warns about overly broad or empty queries that may cause performance issues
 * or indicate incorrect system setup.
 */
export const querySpecificity = createRule<Options, MessageIds>({
    name: 'query-specificity',
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Warn about overly broad or empty system queries that may indicate issues',
        },
        messages: {
            emptyQuery:
                'System "{{systemName}}" has an empty query (no components or tags). This will match ALL entities. If intentional, add a comment explaining why.',
            broadQuery:
                'System "{{systemName}}" query only specifies {{count}} component(s). Consider adding more filters for better performance.',
            emptyActCallback:
                'System "{{systemName}}" has an empty act() callback. If only using before/after hooks, consider using { all: [] } explicitly with a comment.',
            unusedQueryResults:
                'System "{{systemName}}" queries for components but act() callback doesn\'t use them. Remove unused components from query.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    allowEmptyQueries: {
                        type: 'boolean',
                        description: 'Whether to allow empty queries (default: false)',
                    },
                    minComponents: {
                        type: 'number',
                        description: 'Minimum components for specific query (default: 1)',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            allowEmptyQueries: false,
            minComponents: 1,
        },
    ],
    create(context, [options]) {
        const allowEmptyQueries = options.allowEmptyQueries ?? false;
        const minComponents = options.minComponents ?? 1;

        return {
            CallExpression(node) {
                // Check for createSystem calls
                if (
                    node.callee.type !== 'MemberExpression' ||
                    node.callee.property.type !== 'Identifier' ||
                    node.callee.property.name !== 'createSystem'
                ) {
                    return;
                }

                // Get system name
                let systemName = 'Unknown';
                if (node.arguments.length > 0 && node.arguments[0].type === 'Literal') {
                    systemName = String(node.arguments[0].value);
                }

                // Get query options
                const queryOptions = getQueryOptions(node);
                if (!queryOptions) return;

                // Check for empty query
                if (!hasQueryFilters(queryOptions)) {
                    if (!allowEmptyQueries) {
                        // Check if there's an after hook (which might be intentional)
                        const systemOptions = getSystemOptions(node);
                        const hasAfterHook = systemOptions && getProperty(systemOptions, 'after');
                        const hasBeforeHook = systemOptions && getProperty(systemOptions, 'before');

                        // Only report if there's no before/after hook
                        if (!hasAfterHook && !hasBeforeHook) {
                            context.report({
                                node: queryOptions,
                                messageId: 'emptyQuery',
                                data: { systemName },
                            });
                        }
                    }
                    return; // Don't check other things for empty queries
                }

                // Get system options
                const systemOptions = getSystemOptions(node);
                if (!systemOptions) return;

                // Check component count for broad query warning
                const componentCount = countQueryComponents(queryOptions);
                if (componentCount > 0 && componentCount < minComponents) {
                    context.report({
                        node: queryOptions,
                        messageId: 'broadQuery',
                        data: {
                            systemName,
                            count: String(componentCount),
                        },
                    });
                }

                // Check for empty act callback
                const actProp = getProperty(systemOptions, 'act');
                if (actProp) {
                    const actValue = actProp.value;
                    if (
                        (actValue.type === 'ArrowFunctionExpression' ||
                            actValue.type === 'FunctionExpression') &&
                        actValue.body.type === 'BlockStatement'
                    ) {
                        if (isEmptyOrMinimalBody(actValue.body)) {
                            // Check if there are before/after hooks
                            const hasAfterHook = getProperty(systemOptions, 'after');
                            const hasBeforeHook = getProperty(systemOptions, 'before');

                            if (hasAfterHook || hasBeforeHook) {
                                // Has hooks but empty act - suggest using empty query
                                context.report({
                                    node: actProp,
                                    messageId: 'emptyActCallback',
                                    data: { systemName },
                                });
                            }
                        }
                    }
                }

                // Check if queried components are used in act callback
                if (actProp && componentCount > 0) {
                    const actValue = actProp.value;
                    if (
                        actValue.type === 'ArrowFunctionExpression' ||
                        actValue.type === 'FunctionExpression'
                    ) {
                        // Count parameters (entity + components)
                        const paramCount = actValue.params.length;
                        // First param is entity, rest are components
                        const componentParams = paramCount - 1;

                        // If fewer params than components, some components are unused
                        if (componentParams < componentCount && componentParams >= 0) {
                            context.report({
                                node: queryOptions,
                                messageId: 'unusedQueryResults',
                                data: { systemName },
                            });
                        }
                    }
                }
            },
        };
    },
});

export default querySpecificity;
