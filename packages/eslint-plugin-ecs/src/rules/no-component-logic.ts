import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds =
    | 'noConditionalInConstructor'
    | 'noLoopInConstructor'
    | 'noFunctionCallInConstructor'
    | 'noAsyncInConstructor';

type Options = [
    {
        componentPattern?: string;
        allowedFunctions?: string[];
        maxConstructorStatements?: number;
    },
];

/**
 * Rule: no-component-logic
 *
 * Ensures ECS component constructors only perform simple initialization.
 * Complex logic, conditionals, loops, and function calls should be
 * handled by systems, not in component constructors.
 *
 * This enforces the ECS principle that components are pure data containers.
 */
export const noComponentLogic = createRule<Options, MessageIds>({
    name: 'no-component-logic',
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Disallow complex logic in ECS component constructors',
        },
        messages: {
            noConditionalInConstructor:
                'Avoid conditional logic in component constructors. Components should be simple data containers.',
            noLoopInConstructor:
                'Avoid loops in component constructors. Initialize data directly or use a factory system.',
            noFunctionCallInConstructor:
                'Avoid calling "{{functionName}}" in component constructors. Use simple value assignments instead.',
            noAsyncInConstructor:
                'Component constructors must be synchronous. Async initialization should be handled by systems.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    componentPattern: {
                        type: 'string',
                        description: 'Regex pattern to identify component classes',
                    },
                    allowedFunctions: {
                        type: 'array',
                        items: { type: 'string' },
                        description:
                            'Function calls allowed in constructors (e.g., "Date.now", "Math.random")',
                    },
                    maxConstructorStatements: {
                        type: 'number',
                        description: 'Maximum number of statements allowed in constructor body',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            componentPattern:
                '(Component|Position|Velocity|Health|Transform|Sprite|Collider|State|Data)$',
            allowedFunctions: [
                'Date.now',
                'Math.random',
                'Math.floor',
                'Math.ceil',
                'Math.round',
                'Object.assign',
                'Array.from',
                'Set',
                'Map',
                'Symbol',
            ],
            maxConstructorStatements: 20,
        },
    ],
    create(context, [options]) {
        const componentPattern = new RegExp(
            options.componentPattern ||
                '(Component|Position|Velocity|Health|Transform|Sprite|Collider|State|Data)$'
        );
        const allowedFunctions = new Set(options.allowedFunctions || []);

        function isComponentClass(
            node: TSESTree.ClassDeclaration | TSESTree.ClassExpression
        ): boolean {
            if (node.type === 'ClassDeclaration' && node.id) {
                return componentPattern.test(node.id.name);
            }
            return false;
        }

        function getFunctionName(node: TSESTree.CallExpression): string {
            if (node.callee.type === 'Identifier') {
                return node.callee.name;
            }
            if (node.callee.type === 'MemberExpression') {
                const obj = node.callee.object.type === 'Identifier' ? node.callee.object.name : '';
                const prop =
                    node.callee.property.type === 'Identifier' ? node.callee.property.name : '';
                return `${obj}.${prop}`;
            }
            return '<unknown>';
        }

        function checkConstructorBody(
            constructorNode: TSESTree.MethodDefinition,
            classNode: TSESTree.ClassDeclaration
        ): void {
            if (!isComponentClass(classNode)) {
                return;
            }

            const body = constructorNode.value.body;
            if (!body) {
                return;
            }

            // Walk all nodes in constructor body
            function checkNode(node: TSESTree.Node): void {
                switch (node.type) {
                    // Check for conditionals
                    case 'IfStatement':
                    case 'ConditionalExpression':
                    case 'SwitchStatement':
                        context.report({
                            node,
                            messageId: 'noConditionalInConstructor',
                        });
                        break;

                    // Check for loops
                    case 'ForStatement':
                    case 'ForInStatement':
                    case 'ForOfStatement':
                    case 'WhileStatement':
                    case 'DoWhileStatement':
                        context.report({
                            node,
                            messageId: 'noLoopInConstructor',
                        });
                        break;

                    // Check for async/await
                    case 'AwaitExpression':
                        context.report({
                            node,
                            messageId: 'noAsyncInConstructor',
                        });
                        break;

                    // Check for function calls
                    case 'CallExpression':
                        {
                            const funcName = getFunctionName(node);
                            // Allow certain functions and new expressions
                            if (
                                !allowedFunctions.has(funcName) &&
                                // Allow constructors (new X())
                                node.callee.type !== 'Super'
                            ) {
                                // Check if it's a constructor call we should allow
                                const isNewSet = node.parent?.type === 'NewExpression';
                                if (!isNewSet) {
                                    context.report({
                                        node,
                                        messageId: 'noFunctionCallInConstructor',
                                        data: { functionName: funcName },
                                    });
                                }
                            }
                        }
                        break;
                }

                // Recursively check child nodes
                for (const key of Object.keys(node)) {
                    // Skip parent references to avoid infinite loops
                    if (key === 'parent') continue;

                    const child = (node as Record<string, unknown>)[key];
                    if (child && typeof child === 'object') {
                        if (Array.isArray(child)) {
                            for (const item of child) {
                                if (item && typeof item === 'object' && 'type' in item) {
                                    checkNode(item as TSESTree.Node);
                                }
                            }
                        } else if ('type' in child) {
                            checkNode(child as TSESTree.Node);
                        }
                    }
                }
            }

            for (const statement of body.body) {
                checkNode(statement);
            }
        }

        return {
            ClassDeclaration(classNode) {
                for (const member of classNode.body.body) {
                    if (member.type === 'MethodDefinition' && member.kind === 'constructor') {
                        checkConstructorBody(member, classNode);
                    }
                }
            },
        };
    },
});

export default noComponentLogic;
