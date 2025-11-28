import { ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'useMagicTagString';

type Options = [
    {
        /** Known tag constants to allow */
        allowedTags?: string[];
    },
];

/**
 * Convert tag string to suggested constant name
 */
function toConstantName(tag: string): string {
    return tag.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

/**
 * Rule: no-magic-tag-strings
 *
 * Discourages using string literals directly in tag methods.
 * Instead, encourage defining tag constants for better maintainability.
 */
export const noMagicTagStrings = createRule<Options, MessageIds>({
    name: 'no-magic-tag-strings',
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Discourage magic string literals in tag methods, prefer constants',
        },
        messages: {
            useMagicTagString:
                'Avoid using magic string "{{tagValue}}" directly. Define a constant like `const TAGS = { {{suggestedName}}: \'{{tagValue}}\' }` instead.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    allowedTags: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Tag strings that are allowed as literals',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            allowedTags: [],
        },
    ],
    create(context, [options]) {
        const allowedTags = new Set(options.allowedTags || []);

        // Methods that use tags
        const tagMethods = new Set(['addTag', 'removeTag', 'hasTag', 'getEntitiesByTag']);

        return {
            CallExpression(node) {
                if (node.callee.type !== 'MemberExpression') return;
                if (node.callee.property.type !== 'Identifier') return;

                const methodName = node.callee.property.name;

                if (!tagMethods.has(methodName)) return;

                // Check each argument that's a string literal
                for (const arg of node.arguments) {
                    if (arg.type === 'Literal' && typeof arg.value === 'string') {
                        const tagValue = arg.value;

                        // Skip allowed tags
                        if (allowedTags.has(tagValue)) continue;

                        context.report({
                            node: arg,
                            messageId: 'useMagicTagString',
                            data: {
                                tagValue,
                                suggestedName: toConstantName(tagValue),
                            },
                        });
                    }
                }
            },
        };
    },
});

export default noMagicTagStrings;
