import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'noMethodsInComponent' | 'noGettersSettersInComponent';

type Options = [
    {
        componentPattern?: string;
        allowedMethods?: string[];
        checkAllClasses?: boolean;
    },
];

/**
 * Rule: data-only-components
 *
 * Enforces that ECS components are data-only structures without methods.
 * This is a core ECS best practice - components should hold data,
 * while systems contain the logic.
 *
 * By default, this rule checks classes that:
 * 1. Are named with common component suffixes (Component, Data, State, etc.)
 * 2. Match a configurable regex pattern
 * 3. Or all classes if checkAllClasses is enabled
 */
export const dataOnlyComponents = createRule<Options, MessageIds>({
    name: 'data-only-components',
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Enforce that ECS components contain only data (no methods except constructor)',
        },
        messages: {
            noMethodsInComponent:
                'ECS components should be data-only. Move method "{{methodName}}" to a System instead.',
            noGettersSettersInComponent:
                'ECS components should be data-only. Move getter/setter "{{propertyName}}" logic to a System instead.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    componentPattern: {
                        type: 'string',
                        description: 'Regex pattern to identify component classes by name',
                    },
                    allowedMethods: {
                        type: 'array',
                        items: { type: 'string' },
                        description:
                            'Method names that are allowed in components (e.g., "clone", "reset")',
                    },
                    checkAllClasses: {
                        type: 'boolean',
                        description:
                            'If true, check all classes, not just those matching the pattern',
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
            allowedMethods: ['clone', 'reset', 'toString', 'toJSON'],
            checkAllClasses: false,
        },
    ],
    create(context, [options]) {
        const componentPattern = new RegExp(
            options.componentPattern ||
                '(Component|Position|Velocity|Health|Transform|Sprite|Collider|State|Data)$'
        );
        const allowedMethods = new Set(options.allowedMethods || []);
        const checkAllClasses = options.checkAllClasses || false;

        function isComponentClass(node: TSESTree.ClassDeclaration): boolean {
            if (checkAllClasses) {
                return true;
            }

            if (!node.id) {
                return false;
            }

            return componentPattern.test(node.id.name);
        }

        function checkClassBody(node: TSESTree.ClassDeclaration): void {
            if (!isComponentClass(node)) {
                return;
            }

            for (const member of node.body.body) {
                // Check for regular methods (excluding constructor)
                if (member.type === 'MethodDefinition') {
                    if (member.kind === 'constructor') {
                        continue;
                    }

                    if (member.kind === 'get' || member.kind === 'set') {
                        const propertyName =
                            member.key.type === 'Identifier' ? member.key.name : '<computed>';

                        context.report({
                            node: member,
                            messageId: 'noGettersSettersInComponent',
                            data: { propertyName },
                        });
                        continue;
                    }

                    const methodName =
                        member.key.type === 'Identifier' ? member.key.name : '<computed>';

                    if (!allowedMethods.has(methodName)) {
                        context.report({
                            node: member,
                            messageId: 'noMethodsInComponent',
                            data: { methodName },
                        });
                    }
                }

                // Check for arrow function properties
                if (
                    member.type === 'PropertyDefinition' &&
                    member.value?.type === 'ArrowFunctionExpression'
                ) {
                    const propertyName =
                        member.key.type === 'Identifier' ? member.key.name : '<computed>';

                    if (!allowedMethods.has(propertyName)) {
                        context.report({
                            node: member,
                            messageId: 'noMethodsInComponent',
                            data: { methodName: propertyName },
                        });
                    }
                }
            }
        }

        return {
            ClassDeclaration: checkClassBody,
        };
    },
});

export default dataOnlyComponents;
