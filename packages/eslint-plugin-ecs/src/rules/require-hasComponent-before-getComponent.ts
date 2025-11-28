import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'missingHasComponentCheck';

type Options = [
    {
        /** Component types guaranteed by system query (skip check for these) */
        queryGuaranteedComponents?: string[];
    },
];

/**
 * Check if a getComponent call is preceded by hasComponent check for the same component
 */
function hasComponentCheckExists(node: TSESTree.CallExpression, componentName: string): boolean {
    // Walk up to find the containing function or block
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        // Check if we're inside an if statement that checks hasComponent
        if (current.type === 'IfStatement') {
            const test = current.test;

            // Check for hasComponent(Component) pattern
            if (isHasComponentCall(test, componentName)) {
                return true;
            }

            // Check for entity.hasComponent(Component) && ... pattern
            if (test.type === 'LogicalExpression' && test.operator === '&&') {
                if (
                    isHasComponentCall(test.left, componentName) ||
                    isHasComponentCall(test.right, componentName)
                ) {
                    return true;
                }
            }
        }

        // Check for conditional expression: hasComponent(X) ? getComponent(X) : ...
        if (current.type === 'ConditionalExpression') {
            if (isHasComponentCall(current.test, componentName)) {
                return true;
            }
        }

        // Check for optional chaining: entity?.getComponent(X)
        if (current.type === 'ChainExpression') {
            return true;
        }

        current = current.parent;

        // Stop at function boundaries
        if (
            current?.type === 'FunctionDeclaration' ||
            current?.type === 'FunctionExpression' ||
            current?.type === 'ArrowFunctionExpression' ||
            current?.type === 'MethodDefinition'
        ) {
            break;
        }
    }

    return false;
}

/**
 * Check if a node is a hasComponent call for the given component
 */
function isHasComponentCall(node: TSESTree.Node | undefined, componentName: string): boolean {
    if (!node) return false;

    if (node.type === 'CallExpression') {
        if (
            node.callee.type === 'MemberExpression' &&
            node.callee.property.type === 'Identifier' &&
            node.callee.property.name === 'hasComponent'
        ) {
            // Check the component argument
            const arg = node.arguments[0];
            if (arg?.type === 'Identifier' && arg.name === componentName) {
                return true;
            }
        }
    }

    // Handle negation: !entity.hasComponent(X)
    if (node.type === 'UnaryExpression' && node.operator === '!') {
        return isHasComponentCall(node.argument, componentName);
    }

    return false;
}

/**
 * Get component name from argument
 */
function getComponentNameFromArg(node: TSESTree.Node | undefined): string | null {
    if (!node) return null;
    if (node.type === 'Identifier') return node.name;
    return null;
}

/**
 * Check if we're inside a system act callback with query-guaranteed components
 */
function getQueryGuaranteedComponents(node: TSESTree.Node): Set<string> {
    const guaranteed = new Set<string>();
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        if (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') {
            const parent = current.parent;

            if (parent?.type === 'Property' && parent.key.type === 'Identifier') {
                if (parent.key.name === 'act') {
                    // Find the createSystem call and extract query components
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
                                // Get query argument (second arg)
                                const queryArg = callExpr.arguments[1];
                                if (queryArg?.type === 'ObjectExpression') {
                                    for (const prop of queryArg.properties) {
                                        if (
                                            prop.type === 'Property' &&
                                            prop.key.type === 'Identifier' &&
                                            prop.key.name === 'all' &&
                                            prop.value.type === 'ArrayExpression'
                                        ) {
                                            for (const elem of prop.value.elements) {
                                                if (elem?.type === 'Identifier') {
                                                    guaranteed.add(elem.name);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        current = current.parent;
    }

    return guaranteed;
}

/**
 * Rule: require-hasComponent-before-getComponent
 *
 * Ensures that getComponent is preceded by a hasComponent check when
 * accessing components that aren't guaranteed by a system query.
 * This prevents runtime errors from accessing non-existent components.
 */
export const requireHasComponentBeforeGetComponent = createRule<Options, MessageIds>({
    name: 'require-hasComponent-before-getComponent',
    meta: {
        type: 'problem',
        docs: {
            description:
                'Require hasComponent check before getComponent for non-query-guaranteed components',
        },
        messages: {
            missingHasComponentCheck:
                'Call to getComponent({{componentName}}) without prior hasComponent check. Either add "if (entity.hasComponent({{componentName}}))" or use a system query to guarantee the component exists.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    queryGuaranteedComponents: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Components guaranteed by query (skip check)',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            queryGuaranteedComponents: [],
        },
    ],
    create(context, [options]) {
        const alwaysGuaranteed = new Set(options.queryGuaranteedComponents || []);

        return {
            CallExpression(node) {
                // Check for entity.getComponent(Component) pattern
                if (node.callee.type !== 'MemberExpression') return;
                if (node.callee.property.type !== 'Identifier') return;
                if (node.callee.property.name !== 'getComponent') return;

                const componentName = getComponentNameFromArg(node.arguments[0]);
                if (!componentName) return;

                // Skip if always guaranteed
                if (alwaysGuaranteed.has(componentName)) return;

                // Get components guaranteed by enclosing system query
                const queryGuaranteed = getQueryGuaranteedComponents(node);
                if (queryGuaranteed.has(componentName)) return;

                // Check if there's a hasComponent check
                if (hasComponentCheckExists(node, componentName)) return;

                context.report({
                    node,
                    messageId: 'missingHasComponentCheck',
                    data: { componentName },
                });
            },
        };
    },
});

export default requireHasComponentBeforeGetComponent;
