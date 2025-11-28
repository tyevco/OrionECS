import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'suggestPooling' | 'frequentComponent';

type Options = [
    {
        /** Minimum usage count to suggest pooling */
        threshold?: number;
        /** Known high-frequency components that should always be pooled */
        alwaysPoolComponents?: string[];
    },
];

/**
 * Rule: prefer-component-pooling
 *
 * Suggests registering component pools for frequently allocated components
 * to reduce garbage collection pressure.
 */
export const preferComponentPooling = createRule<Options, MessageIds>({
    name: 'prefer-component-pooling',
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Suggest using registerComponentPool() for frequently allocated components to reduce GC pressure',
        },
        messages: {
            suggestPooling:
                'Component "{{componentName}}" is used {{count}} times without pooling. Consider using engine.registerComponentPool({{componentName}}) for better performance.',
            frequentComponent:
                'High-frequency component "{{componentName}}" should use pooling. Add engine.registerComponentPool({{componentName}}) during initialization.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    threshold: {
                        type: 'number',
                        description: 'Minimum usages to suggest pooling (default: 10)',
                    },
                    alwaysPoolComponents: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Components that should always be pooled',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            threshold: 10,
            alwaysPoolComponents: ['Particle', 'Bullet', 'Projectile', 'Effect', 'VFX'],
        },
    ],
    create(context, [options]) {
        const threshold = options.threshold ?? 10;
        const alwaysPoolComponents = new Set(options.alwaysPoolComponents ?? []);

        // Track component usage
        const componentUsage = new Map<string, { count: number; nodes: TSESTree.Node[] }>();
        // Track registered pools
        const registeredPools = new Set<string>();
        // Track first usage for reporting
        const firstUsage = new Map<string, TSESTree.Node>();

        function trackComponentUsage(componentName: string, node: TSESTree.Node): void {
            const existing = componentUsage.get(componentName);
            if (existing) {
                existing.count++;
                existing.nodes.push(node);
            } else {
                componentUsage.set(componentName, { count: 1, nodes: [node] });
                firstUsage.set(componentName, node);
            }
        }

        return {
            CallExpression(node) {
                if (node.callee.type !== 'MemberExpression') return;

                const property = node.callee.property;
                if (property.type !== 'Identifier') return;

                const methodName = property.name;

                // Track registerComponentPool calls
                if (methodName === 'registerComponentPool') {
                    if (node.arguments.length > 0 && node.arguments[0].type === 'Identifier') {
                        registeredPools.add(node.arguments[0].name);
                    }
                    return;
                }

                // Track addComponent calls
                if (methodName === 'addComponent') {
                    if (node.arguments.length > 0 && node.arguments[0].type === 'Identifier') {
                        trackComponentUsage(node.arguments[0].name, node);
                    }
                    return;
                }

                // Track createFromPrefab (prefab components are implicitly used)
                // Note: We can't easily track prefab component usage without type info
            },

            'Program:exit'() {
                // Check for high-frequency components that should always be pooled
                for (const componentName of alwaysPoolComponents) {
                    const usage = componentUsage.get(componentName);
                    if (usage && !registeredPools.has(componentName)) {
                        const firstNode = firstUsage.get(componentName);
                        if (firstNode) {
                            context.report({
                                node: firstNode,
                                messageId: 'frequentComponent',
                                data: {
                                    componentName,
                                },
                            });
                        }
                    }
                }

                // Check for components used frequently without pooling
                for (const [componentName, usage] of componentUsage) {
                    // Skip if already reported as high-frequency
                    if (alwaysPoolComponents.has(componentName)) continue;

                    // Skip if already pooled
                    if (registeredPools.has(componentName)) continue;

                    // Report if usage exceeds threshold
                    if (usage.count >= threshold) {
                        const firstNode = firstUsage.get(componentName);
                        if (firstNode) {
                            context.report({
                                node: firstNode,
                                messageId: 'suggestPooling',
                                data: {
                                    componentName,
                                    count: String(usage.count),
                                },
                            });
                        }
                    }
                }
            },
        };
    },
});

export default preferComponentPooling;
