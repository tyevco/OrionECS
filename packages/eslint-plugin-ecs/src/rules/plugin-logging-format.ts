import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'missingPluginPrefix' | 'incorrectLogFormat';

type Options = [
    {
        /** Expected log format pattern */
        formatPattern?: string;
    },
];

/**
 * Check if we're inside a plugin class
 */
function findEnclosingPluginClass(node: TSESTree.Node): TSESTree.ClassDeclaration | null {
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        if (current.type === 'ClassDeclaration') {
            // Check if it's a plugin
            if (current.id?.name.endsWith('Plugin')) {
                return current;
            }
            if (current.implements) {
                for (const impl of current.implements) {
                    if (
                        impl.expression.type === 'Identifier' &&
                        impl.expression.name === 'EnginePlugin'
                    ) {
                        return current;
                    }
                }
            }
        }
        current = current.parent;
    }

    return null;
}

/**
 * Get the first string argument from a console.log call
 */
function getFirstStringArg(
    node: TSESTree.CallExpression
): { value: string; node: TSESTree.Node } | null {
    const firstArg = node.arguments[0];

    if (firstArg?.type === 'Literal' && typeof firstArg.value === 'string') {
        return { value: firstArg.value, node: firstArg };
    }

    if (firstArg?.type === 'TemplateLiteral' && firstArg.quasis.length > 0) {
        const value = firstArg.quasis[0].value.raw;
        return { value, node: firstArg };
    }

    return null;
}

/**
 * Rule: plugin-logging-format
 *
 * Enforces consistent logging format in plugins.
 * Plugin logs should include the plugin name in brackets.
 */
export const pluginLoggingFormat = createRule<Options, MessageIds>({
    name: 'plugin-logging-format',
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Enforce consistent logging format in plugins',
        },
        messages: {
            missingPluginPrefix:
                'Plugin log message should include "[{{pluginName}}]" prefix for consistency.',
            incorrectLogFormat:
                'Plugin log format should be "[{{pluginName}}] message". Found: "{{actualFormat}}".',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    formatPattern: {
                        type: 'string',
                        description: 'Expected log format pattern',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            formatPattern: '\\[\\w+\\]',
        },
    ],
    create(context) {
        let currentPluginName: string | null = null;

        return {
            ClassDeclaration(node) {
                if (node.id?.name.endsWith('Plugin')) {
                    currentPluginName = node.id.name;
                }
            },

            'ClassDeclaration:exit'(node: TSESTree.ClassDeclaration) {
                if (node.id?.name === currentPluginName) {
                    currentPluginName = null;
                }
            },

            CallExpression(node) {
                // Check for console.log calls
                if (node.callee.type !== 'MemberExpression') return;
                if (node.callee.object.type !== 'Identifier') return;
                if (node.callee.object.name !== 'console') return;
                if (node.callee.property.type !== 'Identifier') return;

                const method = node.callee.property.name;
                if (!['log', 'info', 'warn', 'error', 'debug'].includes(method)) return;

                // Only check within plugin classes
                const pluginClass = findEnclosingPluginClass(node);
                if (!pluginClass || !pluginClass.id) return;

                const pluginName = pluginClass.id.name;
                const expectedPrefix = `[${pluginName}]`;

                const stringArg = getFirstStringArg(node);
                if (!stringArg) return;

                // Check if message starts with plugin prefix
                if (!stringArg.value.startsWith(expectedPrefix)) {
                    // Check if it has any bracket prefix
                    const hasBracketPrefix = /^\[[\w]+\]/.test(stringArg.value);

                    if (hasBracketPrefix) {
                        context.report({
                            node: stringArg.node,
                            messageId: 'incorrectLogFormat',
                            data: {
                                pluginName,
                                actualFormat: stringArg.value.substring(0, 30) + '...',
                            },
                        });
                    } else {
                        context.report({
                            node: stringArg.node,
                            messageId: 'missingPluginPrefix',
                            data: { pluginName },
                        });
                    }
                }
            },
        };
    },
});

export default pluginLoggingFormat;
