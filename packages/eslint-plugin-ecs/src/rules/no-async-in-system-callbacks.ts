import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'noAsyncSystemCallback' | 'noAwaitInSystemCallback';

type Options = [
    {
        /** System callback names to check */
        callbackNames?: string[];
    },
];

/**
 * Check if a function is inside a system callback
 */
function getSystemCallbackInfo(node: TSESTree.Node): {
    isInside: boolean;
    callbackName: string | null;
} {
    let current: TSESTree.Node | undefined = node;

    while (current) {
        if (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') {
            const parent = current.parent;

            if (parent?.type === 'Property' && parent.key.type === 'Identifier') {
                const propName = parent.key.name;

                if (['act', 'before', 'after'].includes(propName)) {
                    // Verify this is in a createSystem call
                    let objParent: TSESTree.Node | undefined = parent.parent;

                    while (objParent && objParent.type !== 'ObjectExpression') {
                        objParent = objParent.parent;
                    }

                    if (objParent?.type === 'ObjectExpression') {
                        const callExpr = objParent.parent;

                        if (callExpr?.type === 'CallExpression') {
                            const callee = callExpr.callee;
                            if (
                                callee.type === 'MemberExpression' &&
                                callee.property.type === 'Identifier' &&
                                callee.property.name === 'createSystem'
                            ) {
                                return { isInside: true, callbackName: propName };
                            }
                        }
                    }
                }
            }
        }

        current = current.parent;
    }

    return { isInside: false, callbackName: null };
}

/**
 * Check if a node is directly a system callback function
 */
function isSystemCallbackFunction(
    node: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression
): { isCallback: boolean; callbackName: string | null } {
    const parent = node.parent;

    if (parent?.type === 'Property' && parent.key.type === 'Identifier') {
        const propName = parent.key.name;

        if (['act', 'before', 'after'].includes(propName)) {
            // Verify this is in a createSystem call
            let objParent: TSESTree.Node | undefined = parent.parent;

            while (objParent && objParent.type !== 'ObjectExpression') {
                objParent = objParent.parent;
            }

            if (objParent?.type === 'ObjectExpression') {
                const callExpr = objParent.parent;

                if (callExpr?.type === 'CallExpression') {
                    const callee = callExpr.callee;
                    if (
                        callee.type === 'MemberExpression' &&
                        callee.property.type === 'Identifier' &&
                        callee.property.name === 'createSystem'
                    ) {
                        return { isCallback: true, callbackName: propName };
                    }
                }
            }
        }
    }

    return { isCallback: false, callbackName: null };
}

/**
 * Rule: no-async-in-system-callbacks
 *
 * Prevents async functions and await expressions in system callbacks.
 * System callbacks (act, before, after) run synchronously during the game loop.
 * Async operations can cause frame timing issues and unexpected behavior.
 */
export const noAsyncInSystemCallbacks = createRule<Options, MessageIds>({
    name: 'no-async-in-system-callbacks',
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow async functions and await expressions in system callbacks',
        },
        messages: {
            noAsyncSystemCallback:
                'System callback "{{callbackName}}" should not be async. Async operations can cause frame timing issues. Use a message queue or command buffer for async work.',
            noAwaitInSystemCallback:
                'Avoid await expressions inside system callback "{{callbackName}}". Systems run synchronously during the game loop. Queue async work using events or a task system instead.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    callbackNames: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'System callback names to check',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            callbackNames: ['act', 'before', 'after'],
        },
    ],
    create(context) {
        return {
            // Check for async arrow functions
            ArrowFunctionExpression(node) {
                if (!node.async) return;

                const { isCallback, callbackName } = isSystemCallbackFunction(node);
                if (isCallback && callbackName) {
                    context.report({
                        node,
                        messageId: 'noAsyncSystemCallback',
                        data: { callbackName },
                    });
                }
            },

            // Check for async function expressions
            FunctionExpression(node) {
                if (!node.async) return;

                const { isCallback, callbackName } = isSystemCallbackFunction(node);
                if (isCallback && callbackName) {
                    context.report({
                        node,
                        messageId: 'noAsyncSystemCallback',
                        data: { callbackName },
                    });
                }
            },

            // Check for await expressions inside system callbacks
            AwaitExpression(node) {
                const { isInside, callbackName } = getSystemCallbackInfo(node);
                if (isInside && callbackName) {
                    context.report({
                        node,
                        messageId: 'noAwaitInSystemCallback',
                        data: { callbackName },
                    });
                }
            },
        };
    },
});

export default noAsyncInSystemCallbacks;
