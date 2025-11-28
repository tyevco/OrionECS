import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'preferEngineLogger' | 'preferEngineLoggerInSystem';

type Options = [
    {
        /** Console methods to check (default: all logging methods) */
        methods?: string[];
        /** Allow console statements in test files */
        allowInTests?: boolean;
        /** Allow console.error for critical errors */
        allowConsoleError?: boolean;
    },
];

/**
 * Check if the file path looks like a test file
 */
function isTestFile(filename: string): boolean {
    return (
        filename.includes('.spec.') ||
        filename.includes('.test.') ||
        filename.includes('__tests__') ||
        filename.includes('/test/') ||
        filename.includes('/tests/')
    );
}

/**
 * Check if we're inside a system callback (act, before, after, etc.)
 */
function isInsideSystemCallback(node: TSESTree.Node): boolean {
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        // Check if we're in a function that's a property of an object passed to createSystem
        if (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') {
            const parent = current.parent;

            // Check if this function is a value in a Property node
            if (parent?.type === 'Property') {
                const propName = parent.key.type === 'Identifier' ? parent.key.name : null;
                if (
                    propName &&
                    ['act', 'before', 'after', 'onEntityAdded', 'onEntityRemoved'].includes(
                        propName
                    )
                ) {
                    // Check if this property is in an object passed to createSystem
                    const objExpr = parent.parent;
                    if (objExpr?.type === 'ObjectExpression') {
                        const callExpr = objExpr.parent;
                        if (callExpr?.type === 'CallExpression') {
                            const callee = callExpr.callee;
                            if (
                                callee.type === 'MemberExpression' &&
                                callee.property.type === 'Identifier' &&
                                callee.property.name === 'createSystem'
                            ) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        current = current.parent;
    }

    return false;
}

/**
 * Check if we're inside a class that has access to an engine logger
 * (Plugin classes, System classes, etc.)
 */
function isInsideEngineAwareClass(node: TSESTree.Node): boolean {
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        if (current.type === 'ClassDeclaration' || current.type === 'ClassExpression') {
            const classNode = current as TSESTree.ClassDeclaration;

            // Check class name patterns
            if (classNode.id?.name) {
                const name = classNode.id.name;
                if (
                    name.endsWith('Plugin') ||
                    name.endsWith('System') ||
                    name.endsWith('Manager')
                ) {
                    return true;
                }
            }

            // Check if it implements EnginePlugin
            if (classNode.implements) {
                for (const impl of classNode.implements) {
                    if (
                        impl.expression.type === 'Identifier' &&
                        impl.expression.name === 'EnginePlugin'
                    ) {
                        return true;
                    }
                }
            }
        }
        current = current.parent;
    }

    return false;
}

/**
 * Rule: prefer-engine-logger
 *
 * Discourages use of console.* statements in favor of the engine's built-in logger.
 * The engine logger provides:
 * - Automatic sanitization to prevent log injection attacks
 * - Tagged logging for better organization
 * - Log level filtering
 * - Consistent formatting
 */
export const preferEngineLogger = createRule<Options, MessageIds>({
    name: 'prefer-engine-logger',
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Prefer using engine.logger over console statements for consistent, secure logging',
        },
        messages: {
            preferEngineLogger:
                'Avoid using console.{{method}}(). Use engine.logger.{{loggerMethod}}() instead for secure, consistent logging with automatic sanitization.',
            preferEngineLoggerInSystem:
                'Avoid using console.{{method}}() in system callbacks. Access the logger via engine.logger or pass it through system context.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    methods: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Console methods to check',
                    },
                    allowInTests: {
                        type: 'boolean',
                        description: 'Allow console statements in test files',
                    },
                    allowConsoleError: {
                        type: 'boolean',
                        description: 'Allow console.error for critical errors',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            methods: ['log', 'info', 'warn', 'error', 'debug'],
            allowInTests: true,
            allowConsoleError: false,
        },
    ],
    create(context, [options]) {
        const methods = options.methods ?? ['log', 'info', 'warn', 'error', 'debug'];
        const allowInTests = options.allowInTests ?? true;
        const allowConsoleError = options.allowConsoleError ?? false;

        const filename = context.filename ?? context.getFilename();

        // Skip test files if configured to do so
        if (allowInTests && isTestFile(filename)) {
            return {};
        }

        return {
            CallExpression(node) {
                // Check for console.* calls
                if (node.callee.type !== 'MemberExpression') return;
                if (node.callee.object.type !== 'Identifier') return;
                if (node.callee.object.name !== 'console') return;
                if (node.callee.property.type !== 'Identifier') return;

                const method = node.callee.property.name;

                // Check if this method should be checked
                if (!methods.includes(method)) return;

                // Allow console.error if configured
                if (allowConsoleError && method === 'error') return;

                // Map console methods to logger methods
                const loggerMethodMap: Record<string, string> = {
                    log: 'info',
                    info: 'info',
                    warn: 'warn',
                    error: 'error',
                    debug: 'debug',
                };
                const loggerMethod = loggerMethodMap[method] ?? method;

                // Provide more specific message if inside a system callback
                const inSystem = isInsideSystemCallback(node);
                const inEngineClass = isInsideEngineAwareClass(node);

                if (inSystem) {
                    context.report({
                        node,
                        messageId: 'preferEngineLoggerInSystem',
                        data: { method, loggerMethod },
                    });
                } else if (inEngineClass) {
                    context.report({
                        node,
                        messageId: 'preferEngineLogger',
                        data: { method, loggerMethod },
                    });
                } else {
                    // Still report for general code, but with the standard message
                    context.report({
                        node,
                        messageId: 'preferEngineLogger',
                        data: { method, loggerMethod },
                    });
                }
            },
        };
    },
});

export default preferEngineLogger;
