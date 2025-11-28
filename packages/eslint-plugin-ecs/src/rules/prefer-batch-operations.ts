import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'preferBatch' | 'preferTransaction' | 'preferBulkCreate';

type Options = [
    {
        /** Minimum number of entity operations in a loop to trigger warning */
        threshold?: number;
        /** Whether to suggest transactions for component operations */
        suggestTransaction?: boolean;
    },
];

/**
 * Track entity operations within a loop context
 */
interface LoopContext {
    node: TSESTree.Node;
    createEntityCount: number;
    addComponentCount: number;
    removeComponentCount: number;
    hasEntityCreation: boolean;
}

/**
 * Check if a loop appears to iterate many times (heuristic)
 */
function mightIterateManyTimes(node: TSESTree.Node): boolean {
    if (node.type === 'ForStatement') {
        const forNode = node as TSESTree.ForStatement;
        // Check for patterns like i < 100, i < array.length, etc.
        if (forNode.test?.type === 'BinaryExpression') {
            const test = forNode.test;
            // Check for numeric literal comparisons
            if (test.right.type === 'Literal' && typeof test.right.value === 'number') {
                return test.right.value > 1;
            }
            // Check for .length comparisons (likely array iteration)
            if (
                test.right.type === 'MemberExpression' &&
                test.right.property.type === 'Identifier' &&
                test.right.property.name === 'length'
            ) {
                return true;
            }
        }
    }

    // For-of/for-in loops typically iterate multiple times
    if (node.type === 'ForOfStatement' || node.type === 'ForInStatement') {
        return true;
    }

    // While loops could iterate many times
    if (node.type === 'WhileStatement' || node.type === 'DoWhileStatement') {
        return true;
    }

    return false;
}

/**
 * Check if a statement is a transaction method call
 */
function isTransactionCall(
    node: TSESTree.Node,
    methodName: 'beginTransaction' | 'commitTransaction' | 'batch'
): boolean {
    if (node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression') {
        const callee = node.expression.callee;
        if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
            return callee.property.name === methodName;
        }
    }
    return false;
}

/**
 * Check if the loop is already wrapped in batch/transaction
 */
function isWrappedInBatchOrTransaction(node: TSESTree.Node): boolean {
    // Check for parent CallExpression (batch() callback pattern)
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        if (current.type === 'CallExpression') {
            const callee = current.callee;
            if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
                const methodName = callee.property.name;
                if (methodName === 'batch') {
                    return true;
                }
            }
        }
        current = current.parent;
    }

    // Check for sibling beginTransaction/commitTransaction pattern
    const parent = node.parent;
    let statements: TSESTree.Statement[] | undefined;

    if (parent?.type === 'BlockStatement') {
        statements = parent.body;
    } else if (parent?.type === 'Program') {
        statements = parent.body as TSESTree.Statement[];
    }

    if (statements) {
        const loopIndex = statements.indexOf(node as TSESTree.Statement);

        if (loopIndex > 0) {
            // Check for beginTransaction before the loop
            for (let i = 0; i < loopIndex; i++) {
                if (isTransactionCall(statements[i], 'beginTransaction')) {
                    // Check for commitTransaction after the loop
                    for (let j = loopIndex + 1; j < statements.length; j++) {
                        if (isTransactionCall(statements[j], 'commitTransaction')) {
                            return true;
                        }
                    }
                }
            }
        }
    }

    return false;
}

/**
 * Check if we're inside a system callback (where command buffer should be used instead)
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
 * Rule: prefer-batch-operations
 *
 * Detects bulk entity operations that should use batching or transactions
 * for better performance.
 */
export const preferBatchOperations = createRule<Options, MessageIds>({
    name: 'prefer-batch-operations',
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Suggest using batch() or transactions for bulk entity operations to improve performance',
        },
        messages: {
            preferBatch:
                'Loop contains {{count}} entity creation(s). Consider wrapping in engine.batch() to suspend events and improve performance.',
            preferTransaction:
                'Loop contains {{count}} component operation(s). Consider using beginTransaction()/commitTransaction() to batch query updates.',
            preferBulkCreate:
                'Creating {{count}} entities in a loop. Consider using engine.createEntities({{count}}) for bulk entity creation.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    threshold: {
                        type: 'number',
                        description: 'Minimum operations to trigger warning (default: 5)',
                    },
                    suggestTransaction: {
                        type: 'boolean',
                        description: 'Whether to suggest transactions for component ops',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            threshold: 5,
            suggestTransaction: true,
        },
    ],
    create(context, [options]) {
        const threshold = options.threshold ?? 5;
        const suggestTransaction = options.suggestTransaction ?? true;
        const loopContexts: LoopContext[] = [];

        function getCurrentLoopContext(): LoopContext | undefined {
            return loopContexts[loopContexts.length - 1];
        }

        function enterLoop(node: TSESTree.Node): void {
            // Skip if already wrapped in batch/transaction
            if (isWrappedInBatchOrTransaction(node)) {
                return;
            }

            // Skip if inside system callback (command buffer rule handles this)
            if (isInsideSystemCallback(node)) {
                return;
            }

            // Only track loops that might iterate many times
            if (!mightIterateManyTimes(node)) {
                return;
            }

            loopContexts.push({
                node,
                createEntityCount: 0,
                addComponentCount: 0,
                removeComponentCount: 0,
                hasEntityCreation: false,
            });
        }

        function exitLoop(node: TSESTree.Node): void {
            const loopContext = getCurrentLoopContext();
            if (!loopContext || loopContext.node !== node) {
                return;
            }

            loopContexts.pop();

            // Check if it's a fixed-count loop for bulk create suggestion
            let bulkCount: number | null = null;
            if (node.type === 'ForStatement') {
                const forNode = node as TSESTree.ForStatement;
                if (
                    forNode.test?.type === 'BinaryExpression' &&
                    forNode.test.right.type === 'Literal' &&
                    typeof forNode.test.right.value === 'number'
                ) {
                    bulkCount = forNode.test.right.value;
                }
            }

            // For loops, any entity creation is a batching opportunity
            // The threshold determines the minimum iterations, not calls per iteration
            const estimatedIterations = bulkCount ?? threshold;
            const totalCreateOps = loopContext.createEntityCount * estimatedIterations;
            const totalComponentOps =
                (loopContext.addComponentCount + loopContext.removeComponentCount) *
                estimatedIterations;

            // Check for entity creation patterns
            if (loopContext.createEntityCount > 0 && totalCreateOps >= threshold) {
                if (bulkCount !== null && loopContext.createEntityCount === 1) {
                    // Single createEntity per iteration - suggest bulk create
                    context.report({
                        node,
                        messageId: 'preferBulkCreate',
                        data: {
                            count: String(bulkCount),
                        },
                    });
                } else {
                    context.report({
                        node,
                        messageId: 'preferBatch',
                        data: {
                            count: String(loopContext.createEntityCount),
                        },
                    });
                }
            }

            // Check for component operations (without entity creation)
            if (
                suggestTransaction &&
                loopContext.createEntityCount === 0 &&
                loopContext.addComponentCount + loopContext.removeComponentCount > 0 &&
                totalComponentOps >= threshold
            ) {
                context.report({
                    node,
                    messageId: 'preferTransaction',
                    data: {
                        count: String(
                            loopContext.addComponentCount + loopContext.removeComponentCount
                        ),
                    },
                });
            }
        }

        return {
            ForStatement: enterLoop,
            'ForStatement:exit': exitLoop,
            ForInStatement: enterLoop,
            'ForInStatement:exit': exitLoop,
            ForOfStatement: enterLoop,
            'ForOfStatement:exit': exitLoop,
            WhileStatement: enterLoop,
            'WhileStatement:exit': exitLoop,
            DoWhileStatement: enterLoop,
            'DoWhileStatement:exit': exitLoop,

            CallExpression(node) {
                const loopContext = getCurrentLoopContext();
                if (!loopContext) return;

                if (node.callee.type === 'MemberExpression') {
                    const property = node.callee.property;
                    if (property.type === 'Identifier') {
                        const methodName = property.name;

                        if (methodName === 'createEntity') {
                            loopContext.createEntityCount++;
                            loopContext.hasEntityCreation = true;
                        } else if (methodName === 'addComponent') {
                            loopContext.addComponentCount++;
                        } else if (methodName === 'removeComponent') {
                            loopContext.removeComponentCount++;
                        }
                    }
                }
            },
        };
    },
});

export default preferBatchOperations;
