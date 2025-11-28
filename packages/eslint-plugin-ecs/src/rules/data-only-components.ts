import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import {
    type ComponentDetectionResult,
    createDetectionResult,
    detectComponentsFromCall,
} from '../utils/component-detection';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'noMethodsInComponent' | 'noGettersSettersInComponent';

type Options = [
    {
        componentPattern?: string;
        allowedMethods?: string[];
        checkAllClasses?: boolean;
        detectFromUsage?: boolean;
    },
];

/**
 * Rule: data-only-components
 *
 * Enforces that ECS components are data-only structures without methods.
 * This is a core ECS best practice - components should hold data,
 * while systems contain the logic.
 *
 * Detection modes:
 * 1. Pattern-based (default): Check classes matching componentPattern regex
 * 2. Usage-based (detectFromUsage: true): Detect components by tracking calls to
 *    addComponent, createSystem, registerComponent, etc.
 * 3. Both: Use both pattern matching AND usage detection
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
                    detectFromUsage: {
                        type: 'boolean',
                        description:
                            'If true, detect components by tracking addComponent, createSystem, etc. calls',
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
            detectFromUsage: false,
        },
    ],
    create(context, [options]) {
        const componentPattern = new RegExp(
            options.componentPattern ||
                '(Component|Position|Velocity|Health|Transform|Sprite|Collider|State|Data)$'
        );
        const allowedMethods = new Set(options.allowedMethods || []);
        const checkAllClasses = options.checkAllClasses || false;
        const detectFromUsage = options.detectFromUsage || false;

        // For usage-based detection
        const detectionResult: ComponentDetectionResult = createDetectionResult();
        const classDeclarations = new Map<string, TSESTree.ClassDeclaration>();

        function isComponentClass(node: TSESTree.ClassDeclaration): boolean {
            if (checkAllClasses) {
                return true;
            }

            if (!node.id) {
                return false;
            }

            const className = node.id.name;

            // Check pattern match
            const matchesPattern = componentPattern.test(className);

            // Check usage detection
            const detectedFromUsage =
                detectFromUsage && detectionResult.componentClasses.has(className);

            return matchesPattern || detectedFromUsage;
        }

        function checkClassBody(node: TSESTree.ClassDeclaration): void {
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

        // If not using detection, use the simple single-pass approach
        if (!detectFromUsage) {
            return {
                ClassDeclaration(node) {
                    if (isComponentClass(node)) {
                        checkClassBody(node);
                    }
                },
            };
        }

        // With detection enabled, we need two passes:
        // 1. First pass: Collect component usages and class declarations
        // 2. Second pass (Program:exit): Check detected component classes
        return {
            // Collect class declarations
            ClassDeclaration(node) {
                if (node.id) {
                    classDeclarations.set(node.id.name, node);
                }

                // Still check pattern-matched classes immediately
                if (!detectFromUsage && isComponentClass(node)) {
                    checkClassBody(node);
                }
            },

            // Detect component usage from API calls
            CallExpression(node) {
                detectComponentsFromCall(node, detectionResult);
            },

            // After traversing the entire program, check detected components
            'Program:exit'() {
                // Check all classes that were detected as components
                for (const className of detectionResult.componentClasses) {
                    const classNode = classDeclarations.get(className);
                    if (classNode) {
                        checkClassBody(classNode);
                    }
                }

                // Also check pattern-matched classes that weren't detected
                for (const [className, classNode] of classDeclarations) {
                    if (
                        !detectionResult.componentClasses.has(className) &&
                        componentPattern.test(className)
                    ) {
                        checkClassBody(classNode);
                    }
                }
            },
        };
    },
});

export default dataOnlyComponents;
