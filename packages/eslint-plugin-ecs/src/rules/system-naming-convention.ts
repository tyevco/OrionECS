import { ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'systemNamingSuffix' | 'systemNamingCase';

type Options = [
    {
        /** Required suffix for system names */
        requiredSuffix?: string;
        /** Require PascalCase naming */
        requirePascalCase?: boolean;
    },
];

/**
 * Check if a string is PascalCase
 */
function isPascalCase(str: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(str);
}

/**
 * Rule: system-naming-convention
 *
 * Enforces consistent naming for systems, typically requiring
 * names to end with 'System' suffix and use PascalCase.
 */
export const systemNamingConvention = createRule<Options, MessageIds>({
    name: 'system-naming-convention',
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Enforce consistent system naming conventions',
        },
        messages: {
            systemNamingSuffix:
                'System name "{{systemName}}" should end with "{{requiredSuffix}}". Consider renaming to "{{suggestedName}}".',
            systemNamingCase:
                'System name "{{systemName}}" should use PascalCase (e.g., "MovementSystem").',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    requiredSuffix: {
                        type: 'string',
                        description: 'Required suffix for system names',
                    },
                    requirePascalCase: {
                        type: 'boolean',
                        description: 'Require PascalCase naming',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            requiredSuffix: 'System',
            requirePascalCase: true,
        },
    ],
    create(context, [options]) {
        const requiredSuffix = options.requiredSuffix ?? 'System';
        const requirePascalCase = options.requirePascalCase ?? true;

        return {
            CallExpression(node) {
                // Check for engine.createSystem calls
                if (node.callee.type !== 'MemberExpression') return;
                if (node.callee.property.type !== 'Identifier') return;
                if (node.callee.property.name !== 'createSystem') return;

                // Get system name (first argument)
                const nameArg = node.arguments[0];
                if (!nameArg) return;
                if (nameArg.type !== 'Literal') return;
                if (typeof nameArg.value !== 'string') return;

                const systemName = nameArg.value;

                // Check suffix
                if (!systemName.endsWith(requiredSuffix)) {
                    const suggestedName = systemName + requiredSuffix;
                    context.report({
                        node: nameArg,
                        messageId: 'systemNamingSuffix',
                        data: {
                            systemName,
                            requiredSuffix,
                            suggestedName,
                        },
                    });
                }

                // Check PascalCase
                if (requirePascalCase && !isPascalCase(systemName)) {
                    context.report({
                        node: nameArg,
                        messageId: 'systemNamingCase',
                        data: { systemName },
                    });
                }
            },
        };
    },
});

export default systemNamingConvention;
