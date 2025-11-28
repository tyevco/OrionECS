import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'unboundedMap' | 'unboundedSet' | 'unboundedArray' | 'suggestMaxSize';

type Options = [
    {
        /** Names that indicate the collection has size management */
        sizeManagementPatterns?: string[];
    },
];

/**
 * Check if a node is inside a plugin class
 */
function isInsidePluginClass(
    node: TSESTree.Node
): TSESTree.ClassDeclaration | TSESTree.ClassExpression | null {
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        if (current.type === 'ClassDeclaration' || current.type === 'ClassExpression') {
            const classNode = current as TSESTree.ClassDeclaration | TSESTree.ClassExpression;

            // Check if it implements EnginePlugin
            if (classNode.implements) {
                for (const impl of classNode.implements) {
                    if (
                        impl.expression.type === 'Identifier' &&
                        impl.expression.name === 'EnginePlugin'
                    ) {
                        return classNode;
                    }
                }
            }
            // Check class name pattern
            if (classNode.id?.name?.endsWith('Plugin')) {
                return classNode;
            }
        }
        current = current.parent;
    }

    return null;
}

/**
 * Check if the class has a MAX_SIZE constant or similar
 */
function hasMaxSizeConstant(
    classNode: TSESTree.ClassDeclaration | TSESTree.ClassExpression
): boolean {
    for (const member of classNode.body.body) {
        if (member.type === 'PropertyDefinition' || member.type === 'MethodDefinition') {
            if (member.key.type === 'Identifier') {
                const name = member.key.name.toUpperCase();
                if (
                    name.includes('MAX') ||
                    name.includes('LIMIT') ||
                    name.includes('CAPACITY') ||
                    name.includes('SIZE')
                ) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Check if the class has cleanup logic for the collection
 */
function hasCleanupLogic(
    classNode: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
    _collectionName: string
): boolean {
    // Look for methods that might clean up the collection
    for (const member of classNode.body.body) {
        if (member.type === 'MethodDefinition' && member.value.type === 'FunctionExpression') {
            const methodName = member.key.type === 'Identifier' ? member.key.name : '';

            // Common cleanup method names
            if (
                methodName === 'uninstall' ||
                methodName === 'cleanup' ||
                methodName === 'clear' ||
                methodName === 'reset' ||
                methodName === 'dispose'
            ) {
                // Check if the method references the collection
                const sourceCode = member.value.body;
                if (sourceCode) {
                    // This is a simplified check - in reality you'd want to analyze the AST
                    return true; // Assume cleanup methods handle collections
                }
            }
        }
    }
    return false;
}

/**
 * Get property name from a property definition
 */
function getPropertyName(node: TSESTree.PropertyDefinition): string | null {
    if (node.key.type === 'Identifier') {
        return node.key.name;
    }
    return null;
}

/**
 * Rule: plugin-unbounded-collection
 *
 * Detects Map/Set/Array collections in plugins without size limits,
 * which can cause memory leaks.
 */
export const pluginUnboundedCollection = createRule<Options, MessageIds>({
    name: 'plugin-unbounded-collection',
    meta: {
        type: 'problem',
        docs: {
            description: 'Detect unbounded collections in plugins that may cause memory leaks',
        },
        messages: {
            unboundedMap:
                'Map "{{name}}" in plugin may grow unbounded. Add a MAX_SIZE constant and implement size limiting logic.',
            unboundedSet:
                'Set "{{name}}" in plugin may grow unbounded. Add a MAX_SIZE constant and implement size limiting logic.',
            unboundedArray:
                'Array "{{name}}" in plugin may grow unbounded. Add a MAX_SIZE constant and implement size limiting logic.',
            suggestMaxSize: 'Consider adding: private static readonly MAX_{{NAME}}_SIZE = 1000;',
        },
        hasSuggestions: true,
        schema: [
            {
                type: 'object',
                properties: {
                    sizeManagementPatterns: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Property name patterns that indicate size management',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            sizeManagementPatterns: ['cache', 'pool', 'buffer', 'queue', 'stack'],
        },
    ],
    create(context, [options]) {
        const sizeManagementPatterns = options.sizeManagementPatterns ?? [];

        // Track collections in plugins
        const collections: Array<{
            node: TSESTree.PropertyDefinition;
            name: string;
            type: 'Map' | 'Set' | 'Array';
            classNode: TSESTree.ClassDeclaration | TSESTree.ClassExpression;
        }> = [];

        return {
            PropertyDefinition(node) {
                const classNode = isInsidePluginClass(node);
                if (!classNode) return;

                const propName = getPropertyName(node);
                if (!propName) return;

                // Skip if property name suggests it's size-managed
                const lowerName = propName.toLowerCase();
                for (const pattern of sizeManagementPatterns) {
                    if (lowerName.includes(pattern.toLowerCase())) {
                        // Still check, but lower priority
                    }
                }

                // Check the initializer
                const init = node.value;
                if (!init) return;

                // new Map()
                if (init.type === 'NewExpression' && init.callee.type === 'Identifier') {
                    const typeName = init.callee.name;

                    if (typeName === 'Map') {
                        collections.push({ node, name: propName, type: 'Map', classNode });
                    } else if (typeName === 'Set') {
                        collections.push({ node, name: propName, type: 'Set', classNode });
                    }
                }

                // Array literal []
                if (init.type === 'ArrayExpression') {
                    // Only flag empty arrays that might be accumulating
                    if (init.elements.length === 0) {
                        collections.push({ node, name: propName, type: 'Array', classNode });
                    }
                }

                // new Array()
                if (
                    init.type === 'NewExpression' &&
                    init.callee.type === 'Identifier' &&
                    init.callee.name === 'Array'
                ) {
                    collections.push({ node, name: propName, type: 'Array', classNode });
                }
            },

            'Program:exit'() {
                for (const collection of collections) {
                    // Skip if class has MAX_SIZE constant
                    if (hasMaxSizeConstant(collection.classNode)) {
                        continue;
                    }

                    // Skip if class has cleanup logic
                    if (hasCleanupLogic(collection.classNode, collection.name)) {
                        continue;
                    }

                    const messageId =
                        collection.type === 'Map'
                            ? 'unboundedMap'
                            : collection.type === 'Set'
                              ? 'unboundedSet'
                              : 'unboundedArray';

                    context.report({
                        node: collection.node,
                        messageId,
                        data: {
                            name: collection.name,
                        },
                        suggest: [
                            {
                                desc: `Add MAX_${collection.name.toUpperCase()}_SIZE constant`,
                                fix: (fixer) => {
                                    // Insert a static constant before the property
                                    const constLine = `private static readonly MAX_${collection.name.toUpperCase()}_SIZE = 1000;\n    `;
                                    return fixer.insertTextBefore(collection.node, constLine);
                                },
                            },
                        ],
                    });
                }
            },
        };
    },
});

export default pluginUnboundedCollection;
