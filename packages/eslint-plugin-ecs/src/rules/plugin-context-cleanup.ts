import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'contextNotCleared' | 'engineNotCleared' | 'suggestCleanup';

type Options = [
    {
        /** Additional property names to check for cleanup */
        additionalProperties?: string[];
    },
];

/**
 * Check if a class is a plugin
 */
function isPluginClass(node: TSESTree.ClassDeclaration | TSESTree.ClassExpression): boolean {
    // Check if it implements EnginePlugin
    if (node.implements) {
        for (const impl of node.implements) {
            if (impl.expression.type === 'Identifier' && impl.expression.name === 'EnginePlugin') {
                return true;
            }
        }
    }
    // Check class name pattern
    if (node.id?.name?.endsWith('Plugin')) {
        return true;
    }
    return false;
}

/**
 * Get the name of a property
 */
function getPropertyName(
    node: TSESTree.PropertyDefinition | TSESTree.MethodDefinition
): string | null {
    if (node.key.type === 'Identifier') {
        return node.key.name;
    }
    return null;
}

/**
 * Check if a property holds context or engine
 */
function isContextOrEngineProperty(name: string): boolean {
    const lowerName = name.toLowerCase();
    return (
        lowerName === 'context' ||
        lowerName === 'plugincontext' ||
        lowerName === 'engine' ||
        lowerName === '_context' ||
        lowerName === '_engine' ||
        lowerName.endsWith('context') ||
        lowerName.endsWith('engine')
    );
}

/**
 * Check if uninstall method clears the property
 */
function doesUninstallClearProperty(
    uninstallMethod: TSESTree.MethodDefinition,
    propertyName: string
): boolean {
    const body = uninstallMethod.value;
    if (body.type !== 'FunctionExpression' || !body.body) {
        return false;
    }

    // Search for assignment to undefined/null in the method body
    let found = false;

    function visit(node: TSESTree.Node): void {
        if (found) return;

        // Check for this.property = undefined/null
        if (node.type === 'AssignmentExpression') {
            const left = node.left;
            const right = node.right;

            if (
                left.type === 'MemberExpression' &&
                left.object.type === 'ThisExpression' &&
                left.property.type === 'Identifier' &&
                left.property.name === propertyName
            ) {
                // Check if assigning undefined, null, or deleting
                if (
                    (right.type === 'Identifier' && right.name === 'undefined') ||
                    (right.type === 'Literal' && right.value === null) ||
                    right.type === 'UnaryExpression'
                ) {
                    found = true;
                    return;
                }
            }
        }

        // Check for delete this.property
        if (
            node.type === 'UnaryExpression' &&
            node.operator === 'delete' &&
            node.argument.type === 'MemberExpression' &&
            node.argument.object.type === 'ThisExpression' &&
            node.argument.property.type === 'Identifier' &&
            node.argument.property.name === propertyName
        ) {
            found = true;
            return;
        }

        // Recurse into child nodes
        for (const key of Object.keys(node)) {
            if (key === 'parent') continue;
            const child = (node as Record<string, unknown>)[key];

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

    for (const statement of body.body.body) {
        visit(statement);
        if (found) break;
    }

    return found;
}

/**
 * Rule: plugin-context-cleanup
 *
 * Ensures plugins clear context/engine references in uninstall() to prevent memory leaks.
 */
export const pluginContextCleanup = createRule<Options, MessageIds>({
    name: 'plugin-context-cleanup',
    meta: {
        type: 'problem',
        docs: {
            description:
                'Ensure plugins clear context and engine references in uninstall() to prevent memory leaks',
        },
        messages: {
            contextNotCleared:
                'Plugin stores "{{property}}" but doesn\'t clear it in uninstall(). Add `this.{{property}} = undefined;` to uninstall().',
            engineNotCleared:
                'Plugin stores engine reference "{{property}}" but doesn\'t clear it in uninstall(). This may cause memory leaks.',
            suggestCleanup: 'Add `this.{{property}} = undefined;` to the uninstall() method.',
        },
        hasSuggestions: true,
        schema: [
            {
                type: 'object',
                properties: {
                    additionalProperties: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Additional property names to check for cleanup',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            additionalProperties: [],
        },
    ],
    create(context, [options]) {
        const additionalProperties = new Set(options.additionalProperties ?? []);

        return {
            ClassDeclaration(node) {
                if (!isPluginClass(node)) return;
                analyzePluginClass(node);
            },
            ClassExpression(node) {
                if (!isPluginClass(node)) return;
                analyzePluginClass(node);
            },
        };

        function analyzePluginClass(
            classNode: TSESTree.ClassDeclaration | TSESTree.ClassExpression
        ): void {
            // Find context/engine properties
            const contextProperties: Array<{
                node: TSESTree.PropertyDefinition;
                name: string;
            }> = [];

            // Find uninstall method
            let uninstallMethod: TSESTree.MethodDefinition | null = null;

            for (const member of classNode.body.body) {
                // Track properties
                if (member.type === 'PropertyDefinition') {
                    const name = getPropertyName(member);
                    if (
                        name &&
                        (isContextOrEngineProperty(name) || additionalProperties.has(name))
                    ) {
                        contextProperties.push({ node: member, name });
                    }
                }

                // Find uninstall method
                if (member.type === 'MethodDefinition') {
                    const name = getPropertyName(member);
                    if (name === 'uninstall') {
                        uninstallMethod = member;
                    }
                }
            }

            // Check if context properties are cleared in uninstall
            for (const prop of contextProperties) {
                if (!uninstallMethod) {
                    // No uninstall method at all
                    const messageId = prop.name.toLowerCase().includes('engine')
                        ? 'engineNotCleared'
                        : 'contextNotCleared';

                    context.report({
                        node: prop.node,
                        messageId,
                        data: { property: prop.name },
                    });
                } else if (!doesUninstallClearProperty(uninstallMethod, prop.name)) {
                    // Uninstall exists but doesn't clear this property
                    const messageId = prop.name.toLowerCase().includes('engine')
                        ? 'engineNotCleared'
                        : 'contextNotCleared';

                    // Build suggestions only if we can provide a valid fix
                    const methodBody = uninstallMethod.value;
                    const canProvideFix =
                        methodBody.type === 'FunctionExpression' &&
                        methodBody.body &&
                        methodBody.body.range;

                    context.report({
                        node: prop.node,
                        messageId,
                        data: { property: prop.name },
                        suggest: canProvideFix
                            ? [
                                  {
                                      desc: `Add this.${prop.name} = undefined to uninstall()`,
                                      fix: (fixer) => {
                                          const body = (methodBody as TSESTree.FunctionExpression)
                                              .body;
                                          const lastStatement = body.body[body.body.length - 1];
                                          if (lastStatement) {
                                              return fixer.insertTextAfter(
                                                  lastStatement,
                                                  `\n        this.${prop.name} = undefined;`
                                              );
                                          } else {
                                              // Empty body - range guaranteed by canProvideFix check
                                              const rangeStart = body.range?.[0] ?? 0;
                                              return fixer.insertTextAfterRange(
                                                  [rangeStart + 1, rangeStart + 1],
                                                  `\n        this.${prop.name} = undefined;\n    `
                                              );
                                          }
                                      },
                                  },
                              ]
                            : undefined,
                    });
                }
            }
        }
    },
});

export default pluginContextCleanup;
