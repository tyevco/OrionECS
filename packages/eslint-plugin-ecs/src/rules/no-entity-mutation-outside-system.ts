import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'entityMutationOutsideSystem' | 'componentMutationOutsideSystem';

type Options = [
    {
        systemPattern?: string;
        entityMethods?: string[];
    },
];

/**
 * Rule: no-entity-mutation-outside-system
 *
 * Enforces that entity mutations (addComponent, removeComponent, queueFree, etc.)
 * should primarily happen within Systems, not in arbitrary code.
 *
 * This is a best practice because:
 * 1. Systems provide predictable execution order
 * 2. Mutations during system iteration are handled safely via command buffers
 * 3. It makes the data flow easier to understand and debug
 */
export const noEntityMutationOutsideSystem = createRule<Options, MessageIds>({
    name: 'no-entity-mutation-outside-system',
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Warn when entity mutations occur outside of ECS systems',
        },
        messages: {
            entityMutationOutsideSystem:
                'Entity method "{{methodName}}" should be called within a System for predictable behavior. Consider using the command buffer for deferred operations.',
            componentMutationOutsideSystem:
                'Direct component mutation detected. Prefer mutating components within Systems for better predictability.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    systemPattern: {
                        type: 'string',
                        description: 'Regex pattern to identify system-related contexts',
                    },
                    entityMethods: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Entity methods to check for',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            systemPattern: '(System|act|before|after|onEntityAdded|onEntityRemoved)',
            entityMethods: [
                'addComponent',
                'removeComponent',
                'queueFree',
                'setParent',
                'addChild',
                'removeChild',
                'addTag',
                'removeTag',
            ],
        },
    ],
    create(context, [options]) {
        const systemPattern = new RegExp(
            options.systemPattern || '(System|act|before|after|onEntityAdded|onEntityRemoved)'
        );
        const entityMethods = new Set(options.entityMethods || []);

        // Track if we're inside a system-like context
        let systemContextDepth = 0;

        function isSystemContext(node: TSESTree.Node): boolean {
            // Check if we're in a function that looks like a system callback
            if (
                node.type === 'FunctionDeclaration' ||
                node.type === 'FunctionExpression' ||
                node.type === 'ArrowFunctionExpression'
            ) {
                // Check parent for property name (e.g., act: () => {})
                const parent = node.parent;
                if (parent?.type === 'Property' && parent.key.type === 'Identifier') {
                    return systemPattern.test(parent.key.name);
                }
                // Check for function name
                if (node.type === 'FunctionDeclaration' && node.id) {
                    return systemPattern.test(node.id.name);
                }
            }

            // Check if we're in a class that looks like a system
            if (node.type === 'MethodDefinition' && node.key.type === 'Identifier') {
                return systemPattern.test(node.key.name);
            }

            return false;
        }

        function enterPotentialSystemContext(node: TSESTree.Node): void {
            if (isSystemContext(node)) {
                systemContextDepth++;
            }
        }

        function exitPotentialSystemContext(node: TSESTree.Node): void {
            if (isSystemContext(node)) {
                systemContextDepth--;
            }
        }

        return {
            // Track entering/exiting system contexts
            FunctionDeclaration: enterPotentialSystemContext,
            'FunctionDeclaration:exit': exitPotentialSystemContext,
            FunctionExpression: enterPotentialSystemContext,
            'FunctionExpression:exit': exitPotentialSystemContext,
            ArrowFunctionExpression: enterPotentialSystemContext,
            'ArrowFunctionExpression:exit': exitPotentialSystemContext,
            MethodDefinition: enterPotentialSystemContext,
            'MethodDefinition:exit': exitPotentialSystemContext,

            // Check for entity mutations
            CallExpression(node) {
                // Only warn if we're NOT in a system context
                if (systemContextDepth > 0) {
                    return;
                }

                // Check if calling an entity method
                if (
                    node.callee.type === 'MemberExpression' &&
                    node.callee.property.type === 'Identifier'
                ) {
                    const methodName = node.callee.property.name;

                    if (entityMethods.has(methodName)) {
                        context.report({
                            node,
                            messageId: 'entityMutationOutsideSystem',
                            data: { methodName },
                        });
                    }
                }
            },
        };
    },
});

export default noEntityMutationOutsideSystem;
