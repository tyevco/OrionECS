import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'missingPriority';

type Options = [
    {
        /** Default priority value to suggest */
        suggestedDefault?: number;
    },
];

/**
 * Find a property in an object expression
 */
function findProperty(
    obj: TSESTree.ObjectExpression,
    propName: string
): TSESTree.Property | undefined {
    for (const prop of obj.properties) {
        if (
            prop.type === 'Property' &&
            prop.key.type === 'Identifier' &&
            prop.key.name === propName
        ) {
            return prop;
        }
    }
    return undefined;
}

/**
 * Rule: system-priority-explicit
 *
 * Requires system creation to explicitly specify a priority value.
 * Implicit priority (defaulting to 0) can lead to unclear system
 * execution order. Explicit priorities make the intended order clear.
 */
export const systemPriorityExplicit = createRule<Options, MessageIds>({
    name: 'system-priority-explicit',
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Require explicit priority when creating systems',
        },
        messages: {
            missingPriority:
                'System "{{systemName}}" is missing an explicit priority. Add "priority: {{suggestedDefault}}" to specify execution order.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    suggestedDefault: {
                        type: 'number',
                        description: 'Default priority value to suggest',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            suggestedDefault: 0,
        },
    ],
    create(context, [options]) {
        return {
            CallExpression(node) {
                // Check for engine.createSystem calls
                if (node.callee.type !== 'MemberExpression') return;
                if (node.callee.property.type !== 'Identifier') return;
                if (node.callee.property.name !== 'createSystem') return;

                // Only check when called on 'engine' or common engine variable names
                const obj = node.callee.object;
                if (obj.type === 'Identifier') {
                    const name = obj.name.toLowerCase();
                    if (!['engine', 'game', 'world', 'ecs'].includes(name)) {
                        return; // Skip non-engine objects
                    }
                }

                // Get system name (first argument)
                let systemName = 'System';
                const nameArg = node.arguments[0];
                if (nameArg?.type === 'Literal' && typeof nameArg.value === 'string') {
                    systemName = nameArg.value;
                }

                // Get options object (third argument)
                const optionsArg = node.arguments[2];
                if (!optionsArg || optionsArg.type !== 'ObjectExpression') {
                    // No options object provided
                    context.report({
                        node,
                        messageId: 'missingPriority',
                        data: {
                            systemName,
                            suggestedDefault: options.suggestedDefault,
                        },
                    });
                    return;
                }

                // Check if priority is specified
                const priorityProp = findProperty(optionsArg, 'priority');
                if (!priorityProp) {
                    context.report({
                        node: optionsArg,
                        messageId: 'missingPriority',
                        data: {
                            systemName,
                            suggestedDefault: options.suggestedDefault,
                        },
                    });
                }
            },
        };
    },
});

export default systemPriorityExplicit;
