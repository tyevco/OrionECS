import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'missingDependencyCheck' | 'unsafeCast' | 'suggestOptionalChaining';

type Options = [
    {
        /** Known plugin extension names */
        knownExtensions?: string[];
    },
];

/**
 * Check if a node is inside a plugin class
 */
function isInsidePluginClass(node: TSESTree.Node): boolean {
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        if (current.type === 'ClassDeclaration' || current.type === 'ClassExpression') {
            // Check if it implements EnginePlugin
            const classNode = current as TSESTree.ClassDeclaration | TSESTree.ClassExpression;
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
            // Check class name pattern
            if (classNode.id?.name?.endsWith('Plugin')) {
                return true;
            }
        }
        current = current.parent;
    }

    return false;
}

/**
 * Check if a test expression checks for the given property
 */
function testChecksProperty(test: TSESTree.Expression, propertyName: string): boolean {
    // Check for patterns like: if (!engine.property)
    if (
        test.type === 'UnaryExpression' &&
        test.operator === '!' &&
        test.argument.type === 'MemberExpression' &&
        test.argument.property.type === 'Identifier' &&
        test.argument.property.name === propertyName
    ) {
        return true;
    }

    // Check for: if (engine.property)
    if (
        test.type === 'MemberExpression' &&
        test.property.type === 'Identifier' &&
        test.property.name === propertyName
    ) {
        return true;
    }

    // Check for: if (engine.property !== undefined)
    if (
        test.type === 'BinaryExpression' &&
        (test.operator === '!==' ||
            test.operator === '!=' ||
            test.operator === '===' ||
            test.operator === '==') &&
        test.left.type === 'MemberExpression' &&
        test.left.property.type === 'Identifier' &&
        test.left.property.name === propertyName
    ) {
        return true;
    }

    return false;
}

/**
 * Check if there's a null/undefined check before this usage
 */
function hasNullCheck(
    node: TSESTree.Node,
    propertyName: string,
    _context: { sourceCode: { getText: (node: TSESTree.Node) => string } }
): boolean {
    // Look for preceding if statement with null check (guard clause)
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        // Check for optional chaining in parent
        if (
            current.type === 'ChainExpression' ||
            (current.type === 'MemberExpression' && current.optional)
        ) {
            return true;
        }

        // Check for being inside an if statement consequent with the right test
        if (current.type === 'IfStatement') {
            if (testChecksProperty(current.test, propertyName)) {
                return true;
            }
        }

        // Check for guard clause pattern: if (!prop) return; <our-code>
        if (current.type === 'BlockStatement') {
            const block = current;
            // Find our position in the block
            let foundGuard = false;

            for (const statement of block.body) {
                // Check for guard clause: if (!engine.property) return;
                if (
                    statement.type === 'IfStatement' &&
                    testChecksProperty(statement.test, propertyName) &&
                    statement.consequent.type === 'ReturnStatement'
                ) {
                    foundGuard = true;
                }

                // Check for block guard: if (!engine.property) { ... return; }
                if (
                    statement.type === 'IfStatement' &&
                    testChecksProperty(statement.test, propertyName) &&
                    statement.consequent.type === 'BlockStatement' &&
                    statement.consequent.body.length > 0
                ) {
                    const lastStmt =
                        statement.consequent.body[statement.consequent.body.length - 1];
                    if (lastStmt.type === 'ReturnStatement') {
                        foundGuard = true;
                    }
                }

                // If we've seen a guard and we're past it, check if current node is in this statement
                if (foundGuard && isNodeInSubtree(node, statement)) {
                    return true;
                }
            }
        }

        current = current.parent;
    }

    return false;
}

/**
 * Check if a node is contained within a subtree
 */
function isNodeInSubtree(node: TSESTree.Node, subtree: TSESTree.Node): boolean {
    let current: TSESTree.Node | undefined = node;
    while (current) {
        if (current === subtree) return true;
        current = current.parent;
    }
    return false;
}

/**
 * Check if using optional chaining
 */
function isUsingOptionalChaining(node: TSESTree.MemberExpression): boolean {
    return node.optional === true;
}

/**
 * Rule: plugin-dependency-validation
 *
 * Ensures plugins validate their dependencies exist before using them.
 */
export const pluginDependencyValidation = createRule<Options, MessageIds>({
    name: 'plugin-dependency-validation',
    meta: {
        type: 'problem',
        docs: {
            description:
                'Ensure plugins validate that required dependencies exist before using them',
        },
        messages: {
            missingDependencyCheck:
                'Plugin accesses "{{property}}" without checking if it exists. Add a null/undefined check or use optional chaining.',
            unsafeCast:
                'Unsafe type cast to access "{{property}}". The extension may not be installed. Use optional type (e.g., `{ {{property}}?: ... }`).',
            suggestOptionalChaining:
                'Consider using optional chaining: `engine.{{property}}?.method()` to safely access plugin extensions.',
        },
        hasSuggestions: true,
        schema: [
            {
                type: 'object',
                properties: {
                    knownExtensions: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Known plugin extension names to check',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            knownExtensions: [
                'input',
                'physics',
                'network',
                'audio',
                'stateMachine',
                'timeline',
                'decisionTree',
                'resourceManager',
                'profiler',
                'canvas2d',
                'spatial',
            ],
        },
    ],
    create(context, [options]) {
        const knownExtensions = new Set(options.knownExtensions ?? []);

        // Track type assertions
        const typeCastNodes: Array<{
            node: TSESTree.TSAsExpression | TSESTree.TSTypeAssertion;
            propertyNames: string[];
        }> = [];

        return {
            // Track type assertions: context.getEngine() as { property: Type }
            TSAsExpression(node) {
                if (!isInsidePluginClass(node)) return;

                // Check if this is a getEngine() cast
                if (
                    node.expression.type === 'CallExpression' &&
                    node.expression.callee.type === 'MemberExpression' &&
                    node.expression.callee.property.type === 'Identifier' &&
                    node.expression.callee.property.name === 'getEngine'
                ) {
                    // Extract property names from the type
                    const typeAnnotation = node.typeAnnotation;
                    if (typeAnnotation.type === 'TSTypeLiteral') {
                        const propertyNames: string[] = [];

                        for (const member of typeAnnotation.members) {
                            if (
                                member.type === 'TSPropertySignature' &&
                                member.key.type === 'Identifier'
                            ) {
                                const propName = member.key.name;
                                // Check if property is optional
                                if (!member.optional && knownExtensions.has(propName)) {
                                    propertyNames.push(propName);
                                }
                            }
                        }

                        if (propertyNames.length > 0) {
                            typeCastNodes.push({ node, propertyNames });
                        }
                    }
                }
            },

            // Check member access on engine variables
            MemberExpression(node) {
                if (!isInsidePluginClass(node)) return;

                const property = node.property;
                if (property.type !== 'Identifier') return;

                const propName = property.name;

                // Check if accessing a known extension
                if (!knownExtensions.has(propName)) return;

                // Check if object is engine-like
                const object = node.object;
                let isEngineAccess = false;

                if (object.type === 'Identifier') {
                    const name = object.name.toLowerCase();
                    isEngineAccess = name === 'engine' || name.includes('engine');
                }

                // Check for this.engine pattern
                if (
                    object.type === 'MemberExpression' &&
                    object.object.type === 'ThisExpression' &&
                    object.property.type === 'Identifier'
                ) {
                    const name = object.property.name.toLowerCase();
                    isEngineAccess = name === 'engine' || name.includes('engine');
                }

                if (!isEngineAccess) return;

                // Check if there's a null check
                if (hasNullCheck(node, propName, context)) return;

                // Check if using optional chaining
                if (isUsingOptionalChaining(node)) return;

                // Check if this is followed by a method call
                if (
                    node.parent?.type === 'MemberExpression' ||
                    node.parent?.type === 'CallExpression'
                ) {
                    context.report({
                        node,
                        messageId: 'missingDependencyCheck',
                        data: { property: propName },
                        suggest: [
                            {
                                desc: `Add optional chaining: engine.${propName}?.`,
                                fix: (fixer) => {
                                    const dotToken = context.sourceCode.getTokenAfter(object);
                                    if (dotToken && dotToken.value === '.') {
                                        return fixer.replaceText(dotToken, '?.');
                                    }
                                    return null;
                                },
                            },
                        ],
                    });
                }
            },

            'Program:exit'() {
                // Report unsafe type casts
                for (const { node, propertyNames } of typeCastNodes) {
                    for (const propName of propertyNames) {
                        context.report({
                            node,
                            messageId: 'unsafeCast',
                            data: { property: propName },
                        });
                    }
                }
            },
        };
    },
});

export default pluginDependencyValidation;
