import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'missingDirtyMark' | 'suggestMarkDirty';

type Options = [
    {
        /** Component property names that indicate modification */
        modificationProperties?: string[];
        /** Whether to check inside system callbacks */
        checkInSystems?: boolean;
    },
];

/**
 * Track variable assignments from getComponent
 */
interface ComponentVariable {
    name: string;
    componentType: string | null;
    entityVar: string | null;
    node: TSESTree.Node;
}

/**
 * Check if inside a system callback
 */
function isInsideSystemCallback(node: TSESTree.Node): boolean {
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        if (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') {
            const parent = current.parent;

            if (parent?.type === 'Property' && parent.key.type === 'Identifier') {
                const propName = parent.key.name;
                if (['act', 'before', 'after'].includes(propName)) {
                    return true;
                }
            }
        }
        current = current.parent;
    }

    return false;
}

/**
 * Check if markComponentDirty is called after the modification
 */
function hasMarkDirtyAfter(
    node: TSESTree.Node,
    componentType: string | null,
    entityVar: string | null
): boolean {
    // Get the parent block statement or program
    let blockParent: TSESTree.Node | undefined = node.parent;
    while (blockParent && blockParent.type !== 'BlockStatement' && blockParent.type !== 'Program') {
        blockParent = blockParent.parent;
    }

    if (!blockParent || (blockParent.type !== 'BlockStatement' && blockParent.type !== 'Program')) {
        return false;
    }

    // Find the index of the current statement
    const statements = blockParent.type === 'BlockStatement' ? blockParent.body : blockParent.body;
    let currentIdx = -1;

    for (let i = 0; i < statements.length; i++) {
        if (containsNode(statements[i], node)) {
            currentIdx = i;
            break;
        }
    }

    if (currentIdx === -1) return false;

    // Check subsequent statements for markComponentDirty
    for (let i = currentIdx; i < statements.length; i++) {
        if (containsMarkDirty(statements[i], componentType, entityVar)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if a node contains another node
 */
function containsNode(parent: TSESTree.Node, target: TSESTree.Node): boolean {
    if (parent === target) return true;

    for (const key of Object.keys(parent)) {
        if (key === 'parent') continue;
        const child = (parent as Record<string, unknown>)[key];

        if (child && typeof child === 'object') {
            if (Array.isArray(child)) {
                for (const item of child) {
                    if (item && typeof item === 'object' && 'type' in item) {
                        if (containsNode(item as TSESTree.Node, target)) return true;
                    }
                }
            } else if ('type' in child) {
                if (containsNode(child as TSESTree.Node, target)) return true;
            }
        }
    }

    return false;
}

/**
 * Check if a statement contains markComponentDirty call
 */
function containsMarkDirty(
    node: TSESTree.Node,
    componentType: string | null,
    entityVar: string | null
): boolean {
    let found = false;

    function visit(n: TSESTree.Node): void {
        if (found) return;

        if (n.type === 'CallExpression') {
            const callee = n.callee;

            // Check for entity.markComponentDirty(Component)
            if (
                callee.type === 'MemberExpression' &&
                callee.property.type === 'Identifier' &&
                callee.property.name === 'markComponentDirty'
            ) {
                // Check if called on the right entity
                if (entityVar && callee.object.type === 'Identifier') {
                    if (callee.object.name === entityVar) {
                        found = true;
                        return;
                    }
                } else {
                    found = true;
                    return;
                }
            }
        }

        for (const key of Object.keys(n)) {
            if (key === 'parent') continue;
            const child = (n as Record<string, unknown>)[key];

            if (child && typeof child === 'object') {
                if (Array.isArray(child)) {
                    for (const item of child) {
                        if (item && typeof item === 'object' && 'type' in item) {
                            visit(item as TSESTree.Node);
                        }
                    }
                } else if ('type' in child) {
                    visit(child as TSESTree.Node);
                }
            }
        }
    }

    visit(node);
    return found;
}

/**
 * Rule: mark-component-dirty
 *
 * Ensures component changes are followed by markComponentDirty() for reactive systems.
 */
export const markComponentDirty = createRule<Options, MessageIds>({
    name: 'mark-component-dirty',
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Ensure component modifications are followed by markComponentDirty() for reactive systems',
        },
        messages: {
            missingDirtyMark:
                'Component "{{component}}" is modified but markComponentDirty() is not called. Reactive systems won\'t detect this change.',
            suggestMarkDirty:
                'Add entity.markComponentDirty({{component}}) after modifying the component.',
        },
        hasSuggestions: true,
        schema: [
            {
                type: 'object',
                properties: {
                    modificationProperties: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Property names that indicate modification',
                    },
                    checkInSystems: {
                        type: 'boolean',
                        description: 'Whether to check inside system callbacks (default: true)',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            modificationProperties: [
                'x',
                'y',
                'z',
                'current',
                'value',
                'amount',
                'health',
                'speed',
            ],
            checkInSystems: true,
        },
    ],
    create(context, [options]) {
        const checkInSystems = options.checkInSystems ?? true;

        // Track component variables
        const componentVariables = new Map<string, ComponentVariable>();
        // Track reported nodes
        const reportedNodes = new Set<TSESTree.Node>();

        return {
            // Track getComponent calls
            VariableDeclarator(node) {
                if (node.id.type !== 'Identifier') return;
                if (!node.init || node.init.type !== 'CallExpression') return;

                const call = node.init;
                if (call.callee.type !== 'MemberExpression') return;

                const property = call.callee.property;
                if (property.type !== 'Identifier' || property.name !== 'getComponent') return;

                // Get the component type
                let componentType: string | null = null;
                if (call.arguments.length > 0 && call.arguments[0].type === 'Identifier') {
                    componentType = call.arguments[0].name;
                }

                // Get the entity variable
                let entityVar: string | null = null;
                if (call.callee.object.type === 'Identifier') {
                    entityVar = call.callee.object.name;
                }

                componentVariables.set(node.id.name, {
                    name: node.id.name,
                    componentType,
                    entityVar,
                    node,
                });
            },

            // Check for component property modifications
            AssignmentExpression(node) {
                // Skip if not checking in systems and we're in a system
                if (!checkInSystems && isInsideSystemCallback(node)) {
                    return;
                }

                const left = node.left;
                if (left.type !== 'MemberExpression') return;

                // Check if we're assigning to a component variable's property
                if (left.object.type !== 'Identifier') return;

                const varName = left.object.name;
                const componentVar = componentVariables.get(varName);

                if (!componentVar) return;

                // Check if markComponentDirty is called after this
                if (!hasMarkDirtyAfter(node, componentVar.componentType, componentVar.entityVar)) {
                    if (reportedNodes.has(node)) return;
                    reportedNodes.add(node);

                    context.report({
                        node,
                        messageId: 'missingDirtyMark',
                        data: {
                            component: componentVar.componentType || varName,
                        },
                        suggest: [
                            {
                                desc: `Add markComponentDirty(${componentVar.componentType || 'Component'})`,
                                fix: (fixer) => {
                                    const entityRef = componentVar.entityVar || 'entity';
                                    const componentRef = componentVar.componentType || 'Component';
                                    return fixer.insertTextAfter(
                                        node,
                                        `;\n${entityRef}.markComponentDirty(${componentRef})`
                                    );
                                },
                            },
                        ],
                    });
                }
            },

            // Check for compound assignments (+=, -=, etc.)
            'AssignmentExpression[operator!="="]'(node: TSESTree.AssignmentExpression) {
                if (!checkInSystems && isInsideSystemCallback(node)) {
                    return;
                }

                const left = node.left;
                if (left.type !== 'MemberExpression') return;

                if (left.object.type !== 'Identifier') return;

                const varName = left.object.name;
                const componentVar = componentVariables.get(varName);

                if (!componentVar) return;

                if (!hasMarkDirtyAfter(node, componentVar.componentType, componentVar.entityVar)) {
                    if (reportedNodes.has(node)) return;
                    reportedNodes.add(node);

                    context.report({
                        node,
                        messageId: 'missingDirtyMark',
                        data: {
                            component: componentVar.componentType || varName,
                        },
                        suggest: [
                            {
                                desc: `Add markComponentDirty(${componentVar.componentType || 'Component'})`,
                                fix: (fixer) => {
                                    const entityRef = componentVar.entityVar || 'entity';
                                    const componentRef = componentVar.componentType || 'Component';
                                    return fixer.insertTextAfter(
                                        node,
                                        `;\n${entityRef}.markComponentDirty(${componentRef})`
                                    );
                                },
                            },
                        ],
                    });
                }
            },

            // Check for increment/decrement
            UpdateExpression(node) {
                if (!checkInSystems && isInsideSystemCallback(node)) {
                    return;
                }

                const argument = node.argument;
                if (argument.type !== 'MemberExpression') return;

                if (argument.object.type !== 'Identifier') return;

                const varName = argument.object.name;
                const componentVar = componentVariables.get(varName);

                if (!componentVar) return;

                if (!hasMarkDirtyAfter(node, componentVar.componentType, componentVar.entityVar)) {
                    if (reportedNodes.has(node)) return;
                    reportedNodes.add(node);

                    context.report({
                        node,
                        messageId: 'missingDirtyMark',
                        data: {
                            component: componentVar.componentType || varName,
                        },
                        suggest: [
                            {
                                desc: `Add markComponentDirty(${componentVar.componentType || 'Component'})`,
                                fix: (fixer) => {
                                    const entityRef = componentVar.entityVar || 'entity';
                                    const componentRef = componentVar.componentType || 'Component';
                                    return fixer.insertTextAfter(
                                        node,
                                        `;\n${entityRef}.markComponentDirty(${componentRef})`
                                    );
                                },
                            },
                        ],
                    });
                }
            },
        };
    },
});

export default markComponentDirty;
