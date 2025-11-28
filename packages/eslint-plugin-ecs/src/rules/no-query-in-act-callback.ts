import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'noQueryInCallback' | 'noQueryInSystemCallback';

type Options = [
    {
        /** Additional method names to treat as query-creating methods */
        queryMethods?: string[];
    },
];

/**
 * Check if a node is inside a system callback (act, before, after)
 */
function isInsideSystemCallback(node: TSESTree.Node): {
    isInside: boolean;
    callbackType: string | null;
} {
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        // Check if we're in a function that's a property value
        if (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') {
            const parent = current.parent;

            // Check if this function is a property in an object
            if (parent?.type === 'Property' && parent.key.type === 'Identifier') {
                const propName = parent.key.name;

                // Check for system callback property names
                if (['act', 'before', 'after'].includes(propName)) {
                    // Verify this is in a createSystem call by checking parent chain
                    let objParent: TSESTree.Node | undefined = parent.parent;

                    // Go up to find the ObjectExpression
                    while (objParent && objParent.type !== 'ObjectExpression') {
                        objParent = objParent.parent;
                    }

                    if (objParent?.type === 'ObjectExpression') {
                        const callExpr = objParent.parent;

                        // Check if this object is an argument to createSystem
                        if (callExpr?.type === 'CallExpression') {
                            const callee = callExpr.callee;
                            if (
                                callee.type === 'MemberExpression' &&
                                callee.property.type === 'Identifier' &&
                                callee.property.name === 'createSystem'
                            ) {
                                return { isInside: true, callbackType: propName };
                            }
                        }
                    }
                }
            }
        }

        current = current.parent;
    }

    return { isInside: false, callbackType: null };
}

/**
 * Rule: no-query-in-act-callback
 *
 * Prevents creating queries inside system callbacks (act, before, after).
 * Queries created inside callbacks are recreated every frame, causing
 * performance issues. Queries should be created once and cached.
 */
export const noQueryInActCallback = createRule<Options, MessageIds>({
    name: 'no-query-in-act-callback',
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow creating queries inside system callbacks (act, before, after)',
        },
        messages: {
            noQueryInCallback:
                'Avoid calling "{{methodName}}" inside system callbacks. Queries are recreated every frame. Create and cache the query outside the system instead.',
            noQueryInSystemCallback:
                'Query created inside "{{callbackType}}" callback will be recreated every frame. Move the query creation outside the system and cache it.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    queryMethods: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Additional method names that create queries',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            queryMethods: [],
        },
    ],
    create(context, [options]) {
        // Methods that create queries
        const queryMethods = new Set([
            'createQuery',
            'query', // Fluent query builder
            ...(options.queryMethods || []),
        ]);

        return {
            CallExpression(node) {
                // Check if this is a query-creating method call
                let methodName: string | null = null;

                if (node.callee.type === 'MemberExpression') {
                    if (node.callee.property.type === 'Identifier') {
                        const propName = node.callee.property.name;
                        if (queryMethods.has(propName)) {
                            methodName = propName;
                        }
                    }
                }

                if (!methodName) return;

                // Check if we're inside a system callback
                const { isInside, callbackType } = isInsideSystemCallback(node);

                if (isInside && callbackType) {
                    context.report({
                        node,
                        messageId: 'noQueryInSystemCallback',
                        data: {
                            callbackType,
                        },
                    });
                }
            },
        };
    },
});

export default noQueryInActCallback;
