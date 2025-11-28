import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'nestedTransaction';

type Options = [];

/**
 * Check if a call is beginTransaction
 */
function isBeginTransaction(node: TSESTree.CallExpression): boolean {
    if (node.callee.type !== 'MemberExpression') return false;
    if (node.callee.property.type !== 'Identifier') return false;
    return node.callee.property.name === 'beginTransaction';
}

/**
 * Check if a call is commitTransaction or rollbackTransaction
 */
function isEndTransaction(node: TSESTree.CallExpression): boolean {
    if (node.callee.type !== 'MemberExpression') return false;
    if (node.callee.property.type !== 'Identifier') return false;
    const name = node.callee.property.name;
    return name === 'commitTransaction' || name === 'rollbackTransaction';
}

/**
 * Rule: no-nested-transactions
 *
 * Prevents nested beginTransaction calls which are an error.
 * Transactions cannot be nested and will throw at runtime.
 */
export const noNestedTransactions = createRule<Options, MessageIds>({
    name: 'no-nested-transactions',
    meta: {
        type: 'problem',
        docs: {
            description: 'Prevent nested transaction calls',
        },
        messages: {
            nestedTransaction:
                'Nested beginTransaction call detected. Transactions cannot be nested and will throw at runtime. Ensure you call commitTransaction or rollbackTransaction before starting a new transaction.',
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        // Track transaction state per function scope
        const transactionStack: { inTransaction: boolean; node: TSESTree.Node | null }[] = [];

        function enterScope(): void {
            transactionStack.push({ inTransaction: false, node: null });
        }

        function exitScope(): void {
            transactionStack.pop();
        }

        function getCurrentScope():
            | { inTransaction: boolean; node: TSESTree.Node | null }
            | undefined {
            return transactionStack[transactionStack.length - 1];
        }

        return {
            // Track function scopes
            Program() {
                enterScope();
            },
            'Program:exit'() {
                exitScope();
            },
            FunctionDeclaration() {
                enterScope();
            },
            'FunctionDeclaration:exit'() {
                exitScope();
            },
            FunctionExpression() {
                enterScope();
            },
            'FunctionExpression:exit'() {
                exitScope();
            },
            ArrowFunctionExpression() {
                enterScope();
            },
            'ArrowFunctionExpression:exit'() {
                exitScope();
            },

            CallExpression(node) {
                const scope = getCurrentScope();
                if (!scope) return;

                if (isBeginTransaction(node)) {
                    if (scope.inTransaction) {
                        context.report({
                            node,
                            messageId: 'nestedTransaction',
                        });
                    } else {
                        scope.inTransaction = true;
                        scope.node = node;
                    }
                } else if (isEndTransaction(node)) {
                    scope.inTransaction = false;
                    scope.node = null;
                }
            },
        };
    },
});

export default noNestedTransactions;
