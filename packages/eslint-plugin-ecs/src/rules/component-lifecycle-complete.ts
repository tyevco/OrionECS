import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import {
    type ComponentDetectionResult,
    createDetectionResult,
    detectComponentsFromCall,
} from '../utils/component-detection';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'missingOnDestroy' | 'missingOnCreate';

type Options = [
    {
        /** Regex pattern to identify component classes */
        componentPattern?: string;
        /** Detect components from usage */
        detectFromUsage?: boolean;
    },
];

/**
 * Find a method in a class
 */
function findMethod(node: TSESTree.ClassDeclaration, name: string): boolean {
    for (const member of node.body.body) {
        if (
            member.type === 'MethodDefinition' &&
            member.key.type === 'Identifier' &&
            member.key.name === name
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Rule: component-lifecycle-complete
 *
 * Ensures that components with onCreate also have onDestroy,
 * and vice versa. This helps prevent resource leaks where
 * setup code in onCreate doesn't have corresponding cleanup.
 */
export const componentLifecycleComplete = createRule<Options, MessageIds>({
    name: 'component-lifecycle-complete',
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Require components with onCreate to also have onDestroy (and vice versa)',
        },
        messages: {
            missingOnDestroy:
                'Component "{{className}}" has onCreate but is missing onDestroy. Add onDestroy to clean up resources.',
            missingOnCreate:
                'Component "{{className}}" has onDestroy but is missing onCreate. Consider adding onCreate for symmetry.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    componentPattern: {
                        type: 'string',
                        description: 'Regex pattern to identify component classes',
                    },
                    detectFromUsage: {
                        type: 'boolean',
                        description: 'Detect components from usage patterns',
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
            detectFromUsage: false,
        },
    ],
    create(context, [options]) {
        const componentPattern = new RegExp(
            options.componentPattern ||
                '(Component|Position|Velocity|Health|Transform|Sprite|Collider|State|Data)$'
        );
        const detectFromUsage = options.detectFromUsage || false;

        // For usage-based detection
        const detectionResult: ComponentDetectionResult = createDetectionResult();
        const classDeclarations = new Map<
            string,
            {
                node: TSESTree.ClassDeclaration;
                hasOnCreate: boolean;
                hasOnDestroy: boolean;
            }
        >();

        function isComponentClass(className: string): boolean {
            const matchesPattern = componentPattern.test(className);
            const detectedFromUsage =
                detectFromUsage && detectionResult.componentClasses.has(className);
            return matchesPattern || detectedFromUsage;
        }

        return {
            ClassDeclaration(node) {
                if (!node.id) return;

                const className = node.id.name;
                const hasOnCreate = findMethod(node, 'onCreate');
                const hasOnDestroy = findMethod(node, 'onDestroy');

                classDeclarations.set(className, {
                    node,
                    hasOnCreate,
                    hasOnDestroy,
                });
            },

            CallExpression(node) {
                if (detectFromUsage) {
                    detectComponentsFromCall(node, detectionResult);
                }
            },

            'Program:exit'() {
                for (const [className, info] of classDeclarations) {
                    if (!isComponentClass(className)) continue;

                    // Check for imbalanced lifecycle methods
                    if (info.hasOnCreate && !info.hasOnDestroy) {
                        context.report({
                            node: info.node,
                            messageId: 'missingOnDestroy',
                            data: { className },
                        });
                    }

                    // Note: missingOnCreate is less severe, just a suggestion
                    // Uncomment if you want strict symmetry:
                    // if (info.hasOnDestroy && !info.hasOnCreate) {
                    //     context.report({
                    //         node: info.node,
                    //         messageId: 'missingOnCreate',
                    //         data: { className },
                    //     });
                    // }
                }
            },
        };
    },
});

export default componentLifecycleComplete;
