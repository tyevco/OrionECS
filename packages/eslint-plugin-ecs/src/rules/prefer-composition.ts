import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import {
    type ComponentDetectionResult,
    createDetectionResult,
    detectComponentsFromCall,
} from '../utils/component-detection';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'noComponentInheritance' | 'noDeepInheritance';

type Options = [
    {
        componentPattern?: string;
        allowedBaseClasses?: string[];
        detectFromUsage?: boolean;
    },
];

/**
 * Rule: prefer-composition
 *
 * Discourages inheritance between ECS components, encouraging composition instead.
 * In ECS, entities gain behavior by composing multiple components, not through
 * class inheritance hierarchies.
 *
 * This rule warns when:
 * 1. A component extends another component class
 * 2. Deep inheritance chains are detected
 */
export const preferComposition = createRule<Options, MessageIds>({
    name: 'prefer-composition',
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Discourage inheritance between ECS components, prefer composition',
        },
        messages: {
            noComponentInheritance:
                'Component "{{className}}" extends "{{baseClassName}}". In ECS, prefer composition over inheritance. Create separate components and compose them on entities instead.',
            noDeepInheritance:
                'Deep inheritance detected. ECS components should be flat data structures. Consider breaking this into separate components.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    componentPattern: {
                        type: 'string',
                        description: 'Regex pattern to identify component classes',
                    },
                    allowedBaseClasses: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Base classes that components are allowed to extend',
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
            allowedBaseClasses: [],
            detectFromUsage: false,
        },
    ],
    create(context, [options]) {
        const componentPattern = new RegExp(
            options.componentPattern ||
                '(Component|Position|Velocity|Health|Transform|Sprite|Collider|State|Data)$'
        );
        const allowedBaseClasses = new Set(options.allowedBaseClasses || []);
        const detectFromUsage = options.detectFromUsage || false;

        // For usage-based detection
        const detectionResult: ComponentDetectionResult = createDetectionResult();
        const classDeclarations = new Map<string, TSESTree.ClassDeclaration>();

        function isComponentName(name: string): boolean {
            const matchesPattern = componentPattern.test(name);
            const detectedFromUsage = detectFromUsage && detectionResult.componentClasses.has(name);
            return matchesPattern || detectedFromUsage;
        }

        function getClassName(
            node: TSESTree.ClassDeclaration | TSESTree.ClassExpression
        ): string | null {
            if (node.type === 'ClassDeclaration' && node.id) {
                return node.id.name;
            }
            return null;
        }

        function getBaseClassName(
            superClass: TSESTree.LeftHandSideExpression | null
        ): string | null {
            if (!superClass) {
                return null;
            }
            if (superClass.type === 'Identifier') {
                return superClass.name;
            }
            if (
                superClass.type === 'MemberExpression' &&
                superClass.property.type === 'Identifier'
            ) {
                return superClass.property.name;
            }
            return null;
        }

        function checkClassInheritance(node: TSESTree.ClassDeclaration): void {
            const className = getClassName(node);
            if (!className) return;

            // Only check classes that are components
            if (!isComponentName(className)) return;

            const baseClassName = getBaseClassName(node.superClass);
            if (!baseClassName) return; // No inheritance, that's good

            // Allow certain base classes
            if (allowedBaseClasses.has(baseClassName)) return;

            // Check if extending another component
            if (isComponentName(baseClassName)) {
                context.report({
                    node,
                    messageId: 'noComponentInheritance',
                    data: {
                        className,
                        baseClassName,
                    },
                });
            }
        }

        // If not using detection, use the simple single-pass approach
        if (!detectFromUsage) {
            return {
                ClassDeclaration: checkClassInheritance,
            };
        }

        // With detection enabled, use two-pass approach
        return {
            ClassDeclaration(node) {
                if (node.id) {
                    classDeclarations.set(node.id.name, node);
                }
            },

            CallExpression(node) {
                detectComponentsFromCall(node, detectionResult);
            },

            'Program:exit'() {
                // Check all classes for inheritance violations
                for (const classNode of classDeclarations.values()) {
                    checkClassInheritance(classNode);
                }
            },
        };
    },
});

export default preferComposition;
