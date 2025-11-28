import { ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'preferQueueFree';

type Options = [
    {
        /** Methods to suggest queueFree instead of */
        unsafeMethods?: string[];
    },
];

/**
 * Rule: prefer-queueFree
 *
 * Suggests using entity.queueFree() for safe deferred entity deletion
 * instead of potentially unsafe direct removal methods.
 */
export const preferQueueFree = createRule<Options, MessageIds>({
    name: 'prefer-queueFree',
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Prefer entity.queueFree() for safe deferred entity deletion',
        },
        messages: {
            preferQueueFree:
                'Prefer "entity.queueFree()" instead of "{{methodName}}" for safe deferred entity deletion. queueFree ensures proper cleanup after system iteration.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    unsafeMethods: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Methods to suggest queueFree instead of',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            unsafeMethods: ['destroy', 'remove'],
        },
    ],
    create(context, [options]) {
        const unsafeMethods = new Set(['destroy', 'remove', ...(options.unsafeMethods || [])]);

        return {
            CallExpression(node) {
                if (node.callee.type !== 'MemberExpression') return;
                if (node.callee.property.type !== 'Identifier') return;

                const methodName = node.callee.property.name;

                if (!unsafeMethods.has(methodName)) return;

                // Check if this is likely an entity method call
                // We look for patterns like entity.destroy() or this.entity.destroy()
                const obj = node.callee.object;

                let isLikelyEntity = false;

                if (obj.type === 'Identifier') {
                    const name = obj.name.toLowerCase();
                    isLikelyEntity = name.includes('entity') || name === 'e' || name === 'ent';
                }

                if (obj.type === 'MemberExpression' && obj.property.type === 'Identifier') {
                    const name = obj.property.name.toLowerCase();
                    isLikelyEntity = name.includes('entity') || name === 'e';
                }

                if (isLikelyEntity) {
                    context.report({
                        node,
                        messageId: 'preferQueueFree',
                        data: { methodName },
                    });
                }
            },
        };
    },
});

export default preferQueueFree;
