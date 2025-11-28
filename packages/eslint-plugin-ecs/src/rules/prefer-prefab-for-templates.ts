import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'preferPrefab' | 'repeatedEntityPattern';

type Options = [
    {
        /** Minimum component count to suggest prefab */
        minComponents?: number;
        /** Minimum repetitions to suggest prefab */
        minRepetitions?: number;
    },
];

/**
 * Represents an entity creation pattern
 */
interface EntityPattern {
    node: TSESTree.Node;
    functionNode:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
        | null;
    components: string[];
    location: string;
}

/**
 * Get the parent function of a node
 */
function getParentFunction(
    node: TSESTree.Node
):
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression
    | null {
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        if (
            current.type === 'FunctionDeclaration' ||
            current.type === 'FunctionExpression' ||
            current.type === 'ArrowFunctionExpression'
        ) {
            return current;
        }
        current = current.parent;
    }

    return null;
}

/**
 * Check if a function looks like a spawn/factory function
 */
function isSpawnFunction(
    node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression
): boolean {
    // Check function name if it's a declaration
    if (node.type === 'FunctionDeclaration' && node.id) {
        const name = node.id.name.toLowerCase();
        return (
            name.includes('spawn') ||
            name.includes('create') ||
            name.includes('make') ||
            name.includes('build') ||
            name.includes('factory') ||
            name.includes('instantiate')
        );
    }

    // Check if it's a variable declaration with spawn-like name
    if (node.parent?.type === 'VariableDeclarator') {
        const varDecl = node.parent;
        if (varDecl.id.type === 'Identifier') {
            const name = varDecl.id.name.toLowerCase();
            return (
                name.includes('spawn') ||
                name.includes('create') ||
                name.includes('make') ||
                name.includes('build') ||
                name.includes('factory') ||
                name.includes('instantiate')
            );
        }
    }

    return false;
}

/**
 * Check if already using prefab
 */
function isUsingPrefab(node: TSESTree.CallExpression): boolean {
    if (node.callee.type === 'MemberExpression') {
        const property = node.callee.property;
        if (property.type === 'Identifier') {
            return property.name === 'createFromPrefab';
        }
    }
    return false;
}

/**
 * Get a location key for a node
 */
function getLocationKey(node: TSESTree.Node): string {
    return `${node.loc?.start.line}:${node.loc?.start.column}`;
}

/**
 * Rule: prefer-prefab-for-templates
 *
 * Detects repeated entity creation patterns that should use prefabs
 * for consistency and maintainability.
 */
export const preferPrefabForTemplates = createRule<Options, MessageIds>({
    name: 'prefer-prefab-for-templates',
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Suggest using prefabs for repeated entity creation patterns with multiple components',
        },
        messages: {
            preferPrefab:
                'Entity created with {{count}} components in factory function "{{functionName}}". Consider using engine.registerPrefab() for reusable entity templates.',
            repeatedEntityPattern:
                'Similar entity creation pattern found {{count}} times. Consider extracting to a prefab for consistency.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    minComponents: {
                        type: 'number',
                        description: 'Minimum components to suggest prefab (default: 3)',
                    },
                    minRepetitions: {
                        type: 'number',
                        description: 'Minimum repetitions to detect pattern (default: 2)',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            minComponents: 3,
            minRepetitions: 2,
        },
    ],
    create(context, [options]) {
        const minComponents = options.minComponents ?? 3;
        const minRepetitions = options.minRepetitions ?? 2;

        // Track entity creation patterns
        const entityPatterns: EntityPattern[] = [];
        // Track components added to entities by variable name
        const entityComponentMap = new Map<string, { node: TSESTree.Node; components: string[] }>();
        // Track createEntity calls
        const createEntityCalls = new Map<string, TSESTree.CallExpression>();
        // Track reported nodes to avoid duplicates
        const reportedNodes = new Set<string>();

        return {
            // Track createEntity calls
            CallExpression(node) {
                // Skip if already using prefab
                if (isUsingPrefab(node)) {
                    return;
                }

                if (
                    node.callee.type === 'MemberExpression' &&
                    node.callee.property.type === 'Identifier' &&
                    node.callee.property.name === 'createEntity'
                ) {
                    // Track the variable this is assigned to
                    if (node.parent?.type === 'VariableDeclarator') {
                        const varDecl = node.parent;
                        if (varDecl.id.type === 'Identifier') {
                            const varName = varDecl.id.name;
                            createEntityCalls.set(varName, node);
                            entityComponentMap.set(varName, { node, components: [] });
                        }
                    }
                }

                // Track addComponent calls
                if (
                    node.callee.type === 'MemberExpression' &&
                    node.callee.property.type === 'Identifier' &&
                    node.callee.property.name === 'addComponent'
                ) {
                    const callee = node.callee;
                    let entityVarName: string | null = null;

                    // Get the entity variable name
                    if (callee.object.type === 'Identifier') {
                        entityVarName = callee.object.name;
                    } else if (
                        callee.object.type === 'CallExpression' &&
                        callee.object.callee.type === 'MemberExpression'
                    ) {
                        // Chained call: entity.addComponent(...).addComponent(...)
                        // Track back to original
                        let current: TSESTree.Node = callee.object;
                        while (
                            current.type === 'CallExpression' &&
                            current.callee.type === 'MemberExpression'
                        ) {
                            if (current.callee.object.type === 'Identifier') {
                                entityVarName = current.callee.object.name;
                                break;
                            }
                            current = current.callee.object;
                        }
                    }

                    if (entityVarName && node.arguments.length > 0) {
                        const firstArg = node.arguments[0];
                        let componentName = 'Unknown';

                        if (firstArg.type === 'Identifier') {
                            componentName = firstArg.name;
                        }

                        const existing = entityComponentMap.get(entityVarName);
                        if (existing) {
                            existing.components.push(componentName);
                        }
                    }
                }
            },

            // Analyze at function exit
            'FunctionDeclaration:exit'(node: TSESTree.FunctionDeclaration) {
                analyzeFunction(node);
            },
            'FunctionExpression:exit'(node: TSESTree.FunctionExpression) {
                analyzeFunction(node);
            },
            'ArrowFunctionExpression:exit'(node: TSESTree.ArrowFunctionExpression) {
                analyzeFunction(node);
            },

            // Final analysis at program exit
            'Program:exit'() {
                // Group patterns by component signature
                const patternGroups = new Map<string, EntityPattern[]>();

                for (const pattern of entityPatterns) {
                    const signature = [...pattern.components].toSorted().join(',');
                    if (!patternGroups.has(signature)) {
                        patternGroups.set(signature, []);
                    }
                    patternGroups.get(signature)?.push(pattern);
                }

                // Report repeated patterns
                for (const [signature, patterns] of patternGroups) {
                    if (
                        patterns.length >= minRepetitions &&
                        signature.split(',').length >= minComponents
                    ) {
                        // Report on first occurrence only
                        const firstPattern = patterns[0];
                        const locationKey = getLocationKey(firstPattern.node);

                        if (!reportedNodes.has(locationKey)) {
                            reportedNodes.add(locationKey);
                            context.report({
                                node: firstPattern.node,
                                messageId: 'repeatedEntityPattern',
                                data: {
                                    count: String(patterns.length),
                                },
                            });
                        }
                    }
                }
            },
        };

        function analyzeFunction(
            node:
                | TSESTree.FunctionDeclaration
                | TSESTree.FunctionExpression
                | TSESTree.ArrowFunctionExpression
        ): void {
            // Check if this is a spawn/factory function
            if (!isSpawnFunction(node)) {
                return;
            }

            // Check entities created in this function
            for (const [varName, data] of entityComponentMap) {
                const createCall = createEntityCalls.get(varName);
                if (!createCall) continue;

                // Check if this entity was created in the current function
                const parentFunc = getParentFunction(createCall);
                if (parentFunc !== node) continue;

                // Check component count
                if (data.components.length >= minComponents) {
                    let functionName = 'anonymous';
                    if (node.type === 'FunctionDeclaration' && node.id) {
                        functionName = node.id.name;
                    } else if (node.parent?.type === 'VariableDeclarator') {
                        const varDecl = node.parent;
                        if (varDecl.id.type === 'Identifier') {
                            functionName = varDecl.id.name;
                        }
                    }

                    const locationKey = getLocationKey(createCall);
                    if (!reportedNodes.has(locationKey)) {
                        reportedNodes.add(locationKey);
                        context.report({
                            node: createCall,
                            messageId: 'preferPrefab',
                            data: {
                                count: String(data.components.length),
                                functionName,
                            },
                        });
                    }

                    // Track for pattern detection
                    entityPatterns.push({
                        node: createCall,
                        functionNode: node,
                        components: data.components,
                        location: locationKey,
                    });
                }
            }
        }
    },
});

export default preferPrefabForTemplates;
