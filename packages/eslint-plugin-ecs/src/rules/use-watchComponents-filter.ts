import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'missingWatchComponents' | 'suggestFilter';

type Options = [
    {
        /** Callback names that benefit from watchComponents filter */
        callbacksToCheck?: string[];
    },
];

/**
 * Get property from an object expression by name
 */
function getProperty(obj: TSESTree.ObjectExpression, name: string): TSESTree.Property | null {
    for (const prop of obj.properties) {
        if (prop.type === 'Property' && prop.key.type === 'Identifier' && prop.key.name === name) {
            return prop;
        }
    }
    return null;
}

/**
 * Get component names from query options
 */
function getQueryComponents(queryOptions: TSESTree.ObjectExpression): string[] {
    const components: string[] = [];

    const allProp = getProperty(queryOptions, 'all');
    if (allProp?.value.type === 'ArrayExpression') {
        for (const element of allProp.value.elements) {
            if (element?.type === 'Identifier') {
                components.push(element.name);
            }
        }
    }

    const anyProp = getProperty(queryOptions, 'any');
    if (anyProp?.value.type === 'ArrayExpression') {
        for (const element of anyProp.value.elements) {
            if (element?.type === 'Identifier') {
                components.push(element.name);
            }
        }
    }

    return components;
}

/**
 * Rule: use-watchComponents-filter
 *
 * Ensures systems with component change callbacks specify watchComponents
 * to filter which components trigger the callbacks.
 */
export const useWatchComponentsFilter = createRule<Options, MessageIds>({
    name: 'use-watchComponents-filter',
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Ensure systems with component change callbacks specify watchComponents for filtering',
        },
        messages: {
            missingWatchComponents:
                'System "{{systemName}}" has {{callback}} but no watchComponents filter. This callback will be triggered for ALL component changes, not just the queried components.',
            suggestFilter:
                'Add watchComponents: [{{components}}] to filter which component changes trigger the callback.',
        },
        hasSuggestions: true,
        schema: [
            {
                type: 'object',
                properties: {
                    callbacksToCheck: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Callbacks that need watchComponents filter',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            callbacksToCheck: ['onComponentAdded', 'onComponentRemoved', 'onComponentChanged'],
        },
    ],
    create(context, [options]) {
        const callbacksToCheck = new Set(
            options.callbacksToCheck ?? [
                'onComponentAdded',
                'onComponentRemoved',
                'onComponentChanged',
            ]
        );

        return {
            CallExpression(node) {
                // Check for createSystem calls
                if (
                    node.callee.type !== 'MemberExpression' ||
                    node.callee.property.type !== 'Identifier' ||
                    node.callee.property.name !== 'createSystem'
                ) {
                    return;
                }

                // Get system name
                let systemName = 'Unknown';
                if (node.arguments.length > 0 && node.arguments[0].type === 'Literal') {
                    systemName = String(node.arguments[0].value);
                }

                // Get query options
                if (node.arguments.length < 2 || node.arguments[1].type !== 'ObjectExpression') {
                    return;
                }
                const queryOptions = node.arguments[1] as TSESTree.ObjectExpression;
                const queryComponents = getQueryComponents(queryOptions);

                // Get system options
                if (node.arguments.length < 3 || node.arguments[2].type !== 'ObjectExpression') {
                    return;
                }
                const systemOptions = node.arguments[2] as TSESTree.ObjectExpression;

                // Check if any component change callbacks are present
                const foundCallbacks: string[] = [];
                for (const prop of systemOptions.properties) {
                    if (prop.type === 'Property' && prop.key.type === 'Identifier') {
                        if (callbacksToCheck.has(prop.key.name)) {
                            foundCallbacks.push(prop.key.name);
                        }
                    }
                }

                if (foundCallbacks.length === 0) {
                    return;
                }

                // Check if watchComponents is specified
                const watchComponentsProp = getProperty(systemOptions, 'watchComponents');
                if (watchComponentsProp) {
                    // Has watchComponents - OK
                    return;
                }

                // Report missing watchComponents
                for (const callback of foundCallbacks) {
                    context.report({
                        node: systemOptions,
                        messageId: 'missingWatchComponents',
                        data: {
                            systemName,
                            callback,
                        },
                        suggest: [
                            {
                                desc: `Add watchComponents filter with query components`,
                                fix: (fixer) => {
                                    // Find a good insertion point (after first property)
                                    const firstProp = systemOptions.properties[0];
                                    if (firstProp) {
                                        const componentsStr =
                                            queryComponents.length > 0
                                                ? queryComponents.join(', ')
                                                : '/* specify components */';
                                        return fixer.insertTextAfter(
                                            firstProp,
                                            `,\n    watchComponents: [${componentsStr}]`
                                        );
                                    }
                                    return null;
                                },
                            },
                        ],
                    });
                    // Only report once per system
                    break;
                }
            },
        };
    },
});

export default useWatchComponentsFilter;
