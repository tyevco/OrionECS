import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'useCommandBufferForCreate' | 'useCommandBufferForMutation';

type Options = [
    {
        /** Method names that create entities */
        createMethods?: string[];
        /** Method names that mutate entities */
        mutationMethods?: string[];
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
        if (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') {
            const parent = current.parent;

            if (parent?.type === 'Property' && parent.key.type === 'Identifier') {
                const propName = parent.key.name;

                if (['act', 'before', 'after'].includes(propName)) {
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
 * Check if a call expression is part of a command buffer chain
 * e.g., engine.commands.entity(e).add(X).addTag('foo')
 */
function isCommandBufferChain(node: TSESTree.Node): boolean {
    let current: TSESTree.Node | undefined = node;

    while (current) {
        if (current.type === 'MemberExpression') {
            // Check for .commands property
            if (current.property.type === 'Identifier' && current.property.name === 'commands') {
                return true;
            }
            current = current.object;
        } else if (current.type === 'CallExpression') {
            // Check if callee is a member expression to continue chain
            if (current.callee.type === 'MemberExpression') {
                current = current.callee.object;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    return false;
}

/**
 * Rule: use-command-buffer-in-system
 *
 * Requires using command buffer for entity creation and mutation inside
 * system callbacks. Direct entity operations during system iteration can
 * cause iterator invalidation and archetype transition issues.
 */
export const useCommandBufferInSystem = createRule<Options, MessageIds>({
    name: 'use-command-buffer-in-system',
    meta: {
        type: 'problem',
        docs: {
            description:
                'Require using command buffer for entity operations inside system callbacks',
        },
        messages: {
            useCommandBufferForCreate:
                'Avoid calling "{{methodName}}" directly inside system callbacks. Use "engine.commands.spawn()" instead to safely create entities during iteration.',
            useCommandBufferForMutation:
                'Avoid calling "{{methodName}}" directly inside system callbacks. Use "engine.commands.entity(entity).{{suggestedMethod}}()" instead to safely modify entities during iteration.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    createMethods: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Method names that create entities',
                    },
                    mutationMethods: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Method names that mutate entities',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            createMethods: [],
            mutationMethods: [],
        },
    ],
    create(context, [options]) {
        // Methods on engine that create entities
        const engineCreateMethods = new Set([
            'createEntity',
            'createEntities',
            'createFromPrefab',
            ...(options.createMethods || []),
        ]);

        // Methods on entity that mutate state
        const entityMutationMethods = new Set([
            'addComponent',
            'removeComponent',
            'addTag',
            'removeTag',
            'queueFree',
            'destroy',
            'setParent',
            'addChild',
            'removeChild',
            ...(options.mutationMethods || []),
        ]);

        // Map mutation methods to their command buffer equivalents
        const mutationToCommandMethod: Record<string, string> = {
            addComponent: 'add',
            removeComponent: 'remove',
            addTag: 'addTag',
            removeTag: 'removeTag',
            queueFree: 'despawn',
            destroy: 'despawn',
        };

        return {
            CallExpression(node) {
                if (node.callee.type !== 'MemberExpression') return;
                if (node.callee.property.type !== 'Identifier') return;

                const methodName = node.callee.property.name;

                // Check if we're inside a system callback
                const { isInside } = isInsideSystemCallback(node);
                if (!isInside) return;

                // Check for engine create methods
                if (engineCreateMethods.has(methodName)) {
                    // Verify it's being called on engine (not command buffer)
                    const obj = node.callee.object;

                    // Skip if it's already using command buffer
                    if (obj.type === 'MemberExpression') {
                        if (
                            obj.property.type === 'Identifier' &&
                            obj.property.name === 'commands'
                        ) {
                            return;
                        }
                    }

                    context.report({
                        node,
                        messageId: 'useCommandBufferForCreate',
                        data: { methodName },
                    });
                    return;
                }

                // Check for entity mutation methods
                if (entityMutationMethods.has(methodName)) {
                    const obj = node.callee.object;

                    // Skip if this is part of a command buffer chain
                    // e.g., engine.commands.entity(entity).add(X).addTag('foo')
                    if (isCommandBufferChain(obj)) {
                        return;
                    }

                    const suggestedMethod = mutationToCommandMethod[methodName] || methodName;

                    context.report({
                        node,
                        messageId: 'useCommandBufferForMutation',
                        data: {
                            methodName,
                            suggestedMethod,
                        },
                    });
                }
            },
        };
    },
});

export default useCommandBufferInSystem;
