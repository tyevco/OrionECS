import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'duplicateName' | 'staticPrefabName' | 'suggestUniqueName';

type Options = [
    {
        /** Whether to enforce unique names for createFromPrefab */
        enforcePrefabUniqueness?: boolean;
        /** Patterns that make names unique (e.g., Date.now(), uuid) */
        uniquePatterns?: string[];
    },
];

/**
 * Check if a name expression appears to be unique
 */
function isLikelyUniqueName(node: TSESTree.Node): boolean {
    // Template literal with expressions
    if (node.type === 'TemplateLiteral' && node.expressions.length > 0) {
        return true;
    }

    // String concatenation
    if (node.type === 'BinaryExpression' && node.operator === '+') {
        // Check if right side has Date.now(), Math.random(), uuid, etc.
        return containsUniquePattern(node.right) || containsUniquePattern(node.left);
    }

    // Function call that likely generates unique value
    if (node.type === 'CallExpression') {
        return isUniquenessGenerator(node);
    }

    // Identifier with unique-looking name (e.g., uniqueId, entityUuid, etc.)
    if (node.type === 'Identifier') {
        const name = node.name.toLowerCase();
        return (
            name.includes('unique') ||
            name.includes('uuid') ||
            name.includes('guid') ||
            name.includes('random')
        );
    }

    return false;
}

/**
 * Check if a node contains a uniqueness pattern
 */
function containsUniquePattern(node: TSESTree.Node): boolean {
    if (node.type === 'CallExpression') {
        return isUniquenessGenerator(node);
    }

    if (node.type === 'BinaryExpression') {
        return containsUniquePattern(node.left) || containsUniquePattern(node.right);
    }

    if (node.type === 'Identifier') {
        const name = node.name.toLowerCase();
        return (
            name.includes('id') ||
            name.includes('uuid') ||
            name.includes('guid') ||
            name.includes('counter') ||
            name.includes('index') ||
            name === 'i' ||
            name === 'idx'
        );
    }

    return false;
}

/**
 * Check if a call expression generates unique values
 */
function isUniquenessGenerator(node: TSESTree.CallExpression): boolean {
    const callee = node.callee;

    // Date.now()
    if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'Date' &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'now'
    ) {
        return true;
    }

    // Math.random()
    if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'Math' &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'random'
    ) {
        return true;
    }

    // uuid(), generateId(), etc.
    if (callee.type === 'Identifier') {
        const name = callee.name.toLowerCase();
        return (
            name.includes('uuid') ||
            name.includes('guid') ||
            name.includes('generateid') ||
            name.includes('uniqueid') ||
            name.includes('createid') ||
            name === 'nanoid' ||
            name === 'cuid'
        );
    }

    // crypto.randomUUID()
    if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'crypto' &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'randomUUID'
    ) {
        return true;
    }

    return false;
}

/**
 * Get the string value of a literal node
 */
function getStringValue(node: TSESTree.Node): string | null {
    if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
    }
    return null;
}

/**
 * Rule: entity-unique-names
 *
 * Ensures entity names are unique, especially when using createFromPrefab.
 * Detects static string names that will cause duplicates.
 */
export const entityUniqueNames = createRule<Options, MessageIds>({
    name: 'entity-unique-names',
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Ensure entity names are unique to avoid debugging issues and name collisions',
        },
        messages: {
            duplicateName:
                'Entity name "{{name}}" is used multiple times. Consider using unique names for better debugging.',
            staticPrefabName:
                'createFromPrefab uses static name "{{name}}". This will cause duplicates. Use a unique suffix like `{{name}}_\\${Date.now()}`.',
            suggestUniqueName:
                'Entity name should be unique. Consider adding a unique suffix like `_\\${Date.now()}` or using a counter.',
        },
        hasSuggestions: true,
        schema: [
            {
                type: 'object',
                properties: {
                    enforcePrefabUniqueness: {
                        type: 'boolean',
                        description: 'Enforce unique names for createFromPrefab (default: true)',
                    },
                    uniquePatterns: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Additional patterns that make names unique',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            enforcePrefabUniqueness: true,
            uniquePatterns: [],
        },
    ],
    create(context, [options]) {
        const enforcePrefabUniqueness = options.enforcePrefabUniqueness ?? true;

        // Track entity names used
        const entityNames = new Map<string, TSESTree.Node[]>();

        function trackEntityName(name: string, node: TSESTree.Node): void {
            const existing = entityNames.get(name);
            if (existing) {
                existing.push(node);
            } else {
                entityNames.set(name, [node]);
            }
        }

        return {
            CallExpression(node) {
                if (node.callee.type !== 'MemberExpression') return;

                const property = node.callee.property;
                if (property.type !== 'Identifier') return;

                const methodName = property.name;

                // Check createEntity
                if (methodName === 'createEntity') {
                    if (node.arguments.length > 0) {
                        const nameArg = node.arguments[0];
                        const name = getStringValue(nameArg);

                        if (name) {
                            trackEntityName(name, node);
                        }
                    }
                }

                // Check createFromPrefab
                if (methodName === 'createFromPrefab' && enforcePrefabUniqueness) {
                    // createFromPrefab(prefabName, entityName)
                    if (node.arguments.length >= 2) {
                        const nameArg = node.arguments[1];

                        // Check if name is a static string
                        const name = getStringValue(nameArg);
                        if (name) {
                            // Check if this is in a loop context
                            let isInLoop = false;
                            let current: TSESTree.Node | undefined = node.parent;
                            while (current) {
                                if (
                                    current.type === 'ForStatement' ||
                                    current.type === 'ForOfStatement' ||
                                    current.type === 'ForInStatement' ||
                                    current.type === 'WhileStatement' ||
                                    current.type === 'DoWhileStatement'
                                ) {
                                    isInLoop = true;
                                    break;
                                }
                                current = current.parent;
                            }

                            // Static name is especially problematic in loops
                            if (isInLoop) {
                                context.report({
                                    node: nameArg,
                                    messageId: 'staticPrefabName',
                                    data: { name },
                                    suggest: [
                                        {
                                            desc: 'Add Date.now() suffix for uniqueness',
                                            fix: (fixer) =>
                                                fixer.replaceText(
                                                    nameArg,
                                                    `\`${name}_\${Date.now()}\``
                                                ),
                                        },
                                    ],
                                });
                            } else {
                                // Track for duplicate detection
                                trackEntityName(name, node);
                            }
                        } else if (!isLikelyUniqueName(nameArg)) {
                            // Not a literal but also doesn't look unique
                            context.report({
                                node: nameArg,
                                messageId: 'suggestUniqueName',
                            });
                        }
                    }
                }
            },

            'Program:exit'() {
                // Report duplicate entity names
                for (const [name, nodes] of entityNames) {
                    if (nodes.length > 1) {
                        // Report on all occurrences except the first
                        for (let i = 1; i < nodes.length; i++) {
                            context.report({
                                node: nodes[i],
                                messageId: 'duplicateName',
                                data: { name },
                            });
                        }
                    }
                }
            },
        };
    },
});

export default entityUniqueNames;
