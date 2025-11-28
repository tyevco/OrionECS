import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'missingSingletonDirtyMark';

type Options = [
    {
        /** Whether to check for markSingletonDirty after property modifications */
        strictMode?: boolean;
    },
];

interface SingletonAccess {
    node: TSESTree.CallExpression;
    singletonType: string;
    variableName: string | null;
}

interface SingletonModification {
    node: TSESTree.AssignmentExpression;
    variableName: string;
}

/**
 * Get the singleton type from getSingleton argument
 */
function getSingletonType(node: TSESTree.CallExpression): string | null {
    const arg = node.arguments[0];
    if (arg?.type === 'Identifier') {
        return arg.name;
    }
    return null;
}

/**
 * Get the variable name from an assignment
 */
function getAssignedVariableName(node: TSESTree.CallExpression): string | null {
    const parent = node.parent;

    // const x = getSingleton(...)
    if (parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        return parent.id.name;
    }

    // x = getSingleton(...)
    if (parent?.type === 'AssignmentExpression' && parent.left.type === 'Identifier') {
        return parent.left.name;
    }

    return null;
}

/**
 * Check if a node modifies a singleton variable
 */
function isSingletonModification(node: TSESTree.AssignmentExpression): {
    modified: boolean;
    variableName: string | null;
} {
    // x.property = value
    if (node.left.type === 'MemberExpression') {
        const obj = node.left.object;
        if (obj.type === 'Identifier') {
            return { modified: true, variableName: obj.name };
        }
    }
    return { modified: false, variableName: null };
}

/**
 * Rule: singleton-mark-dirty
 *
 * Ensures that after modifying a singleton's properties,
 * markSingletonDirty is called to notify listeners of the change.
 * Without this call, systems watching for singleton changes won't be notified.
 */
export const singletonMarkDirty = createRule<Options, MessageIds>({
    name: 'singleton-mark-dirty',
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Require markSingletonDirty after modifying singleton properties',
        },
        messages: {
            missingSingletonDirtyMark:
                'Singleton "{{singletonType}}" was modified but markSingletonDirty({{singletonType}}) was not called. Listeners won\'t be notified of the change.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    strictMode: {
                        type: 'boolean',
                        description: 'Whether to check for markSingletonDirty after modifications',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            strictMode: true,
        },
    ],
    create(context) {
        // Track getSingleton calls and their variable assignments
        const singletonAccesses = new Map<string, SingletonAccess>();
        // Track modifications to singleton variables
        const modifications: SingletonModification[] = [];
        // Track markSingletonDirty calls
        const dirtyMarks = new Set<string>();

        return {
            // Track getSingleton calls
            CallExpression(node) {
                if (node.callee.type !== 'MemberExpression') return;
                if (node.callee.property.type !== 'Identifier') return;

                const methodName = node.callee.property.name;

                if (methodName === 'getSingleton') {
                    const singletonType = getSingletonType(node);
                    const variableName = getAssignedVariableName(node);

                    if (singletonType && variableName) {
                        singletonAccesses.set(variableName, {
                            node,
                            singletonType,
                            variableName,
                        });
                    }
                }

                if (methodName === 'markSingletonDirty') {
                    const singletonType = getSingletonType(node);
                    if (singletonType) {
                        dirtyMarks.add(singletonType);
                    }
                }
            },

            // Track modifications to singleton variables
            AssignmentExpression(node) {
                const { modified, variableName } = isSingletonModification(node);
                if (modified && variableName) {
                    modifications.push({ node, variableName });
                }
            },

            // Check at end of program
            'Program:exit'() {
                for (const mod of modifications) {
                    const access = singletonAccesses.get(mod.variableName);
                    if (!access) continue;

                    // Check if markSingletonDirty was called for this singleton type
                    if (!dirtyMarks.has(access.singletonType)) {
                        context.report({
                            node: mod.node,
                            messageId: 'missingSingletonDirtyMark',
                            data: { singletonType: access.singletonType },
                        });
                    }
                }
            },
        };
    },
});

export default singletonMarkDirty;
