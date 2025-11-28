import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import {
    type ComponentDetectionResult,
    createDetectionResult,
    detectComponentsFromCall,
} from '../utils/component-detection';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds =
    | 'noStaticPropertyInComponent'
    | 'noStaticMethodInComponent'
    | 'noModuleLevelMutableState'
    | 'noStaticStateReference';

type Options = [
    {
        componentPattern?: string;
        detectFromUsage?: boolean;
        checkModuleLevelState?: boolean;
        allowedStaticProperties?: string[];
        allowedModuleLevelPatterns?: string[];
    },
];

/**
 * Rule: no-static-state
 *
 * Prevents the use of static state in ECS components and systems.
 * Static state breaks entity isolation, interferes with serialization,
 * causes issues with entity pooling, and makes testing difficult.
 *
 * Detection targets:
 * 1. Static properties on component classes
 * 2. Static methods on component classes (except pure utilities)
 * 3. Module-level mutable state (let/var declarations at top scope)
 *
 * This enforces the ECS principle that all state should be stored
 * in components, not shared globally.
 */
export const noStaticState = createRule<Options, MessageIds>({
    name: 'no-static-state',
    meta: {
        type: 'problem',
        docs: {
            description:
                'Disallow static state in ECS components to maintain entity isolation and proper ECS patterns',
        },
        messages: {
            noStaticPropertyInComponent:
                'Static property "{{propertyName}}" in component "{{className}}" breaks entity isolation. Store state in component instances instead.',
            noStaticMethodInComponent:
                'Static method "{{methodName}}" in component "{{className}}" may indicate shared state. Consider moving to a utility module or system.',
            noModuleLevelMutableState:
                'Module-level mutable variable "{{variableName}}" can cause issues with ECS patterns. Use singleton components for global state instead.',
            noStaticStateReference:
                'Reference to static property "{{propertyName}}" may indicate shared state anti-pattern. Consider using singleton components instead.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    componentPattern: {
                        type: 'string',
                        description: 'Regex pattern to identify component classes by name',
                    },
                    detectFromUsage: {
                        type: 'boolean',
                        description:
                            'If true, detect components by tracking addComponent, createSystem, etc. calls',
                    },
                    checkModuleLevelState: {
                        type: 'boolean',
                        description:
                            'If true, also warn about module-level mutable variables (let/var)',
                    },
                    allowedStaticProperties: {
                        type: 'array',
                        items: { type: 'string' },
                        description:
                            'Static property names that are allowed (e.g., "schema", "componentType")',
                    },
                    allowedModuleLevelPatterns: {
                        type: 'array',
                        items: { type: 'string' },
                        description:
                            'Regex patterns for allowed module-level variable names (e.g., "^_" for private)',
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
            checkModuleLevelState: false,
            allowedStaticProperties: ['schema', 'componentType', 'type', 'name'],
            allowedModuleLevelPatterns: [],
        },
    ],
    create(context, [options]) {
        const componentPattern = new RegExp(
            options.componentPattern ||
                '(Component|Position|Velocity|Health|Transform|Sprite|Collider|State|Data)$'
        );
        const detectFromUsage = options.detectFromUsage || false;
        const checkModuleLevelState = options.checkModuleLevelState || false;
        const allowedStaticProperties = new Set(options.allowedStaticProperties || []);
        const allowedModuleLevelPatterns = (options.allowedModuleLevelPatterns || []).map(
            (p) => new RegExp(p)
        );

        // For usage-based detection
        const detectionResult: ComponentDetectionResult = createDetectionResult();
        const classDeclarations = new Map<string, TSESTree.ClassDeclaration>();

        function isComponentClass(node: TSESTree.ClassDeclaration): boolean {
            if (!node.id) return false;

            const className = node.id.name;
            const matchesPattern = componentPattern.test(className);
            const detectedFromUsage =
                detectFromUsage && detectionResult.componentClasses.has(className);

            return matchesPattern || detectedFromUsage;
        }

        function isAllowedModuleLevelVariable(name: string): boolean {
            return allowedModuleLevelPatterns.some((pattern) => pattern.test(name));
        }

        function checkStaticMembers(node: TSESTree.ClassDeclaration): void {
            const className = node.id?.name || '<anonymous>';

            for (const member of node.body.body) {
                // Check for static properties
                if (member.type === 'PropertyDefinition' && member.static) {
                    const propertyName =
                        member.key.type === 'Identifier' ? member.key.name : '<computed>';

                    // Skip allowed static properties
                    if (allowedStaticProperties.has(propertyName)) {
                        continue;
                    }

                    context.report({
                        node: member,
                        messageId: 'noStaticPropertyInComponent',
                        data: { propertyName, className },
                    });
                }

                // Check for static methods
                if (member.type === 'MethodDefinition' && member.static) {
                    const methodName =
                        member.key.type === 'Identifier' ? member.key.name : '<computed>';

                    // Skip allowed static properties/methods
                    if (allowedStaticProperties.has(methodName)) {
                        continue;
                    }

                    context.report({
                        node: member,
                        messageId: 'noStaticMethodInComponent',
                        data: { methodName, className },
                    });
                }
            }
        }

        function checkModuleLevelVariables(node: TSESTree.VariableDeclaration): void {
            // Only check if at program level
            const parent = node.parent;
            if (parent?.type !== 'Program' && parent?.type !== 'ExportNamedDeclaration') {
                return;
            }

            // Only check let and var (const is immutable)
            if (node.kind === 'const') {
                return;
            }

            for (const declarator of node.declarations) {
                if (declarator.id.type === 'Identifier') {
                    const variableName = declarator.id.name;

                    // Skip allowed patterns
                    if (isAllowedModuleLevelVariable(variableName)) {
                        continue;
                    }

                    context.report({
                        node: declarator,
                        messageId: 'noModuleLevelMutableState',
                        data: { variableName },
                    });
                }
            }
        }

        // Build visitor object based on options
        const visitors: { [key: string]: (node: TSESTree.Node) => void } = {};

        // If not using detection, use the simple single-pass approach
        if (!detectFromUsage) {
            visitors.ClassDeclaration = (node: TSESTree.Node) => {
                const classNode = node as TSESTree.ClassDeclaration;
                if (isComponentClass(classNode)) {
                    checkStaticMembers(classNode);
                }
            };
        } else {
            // With detection enabled, use two-pass approach
            visitors.ClassDeclaration = (node: TSESTree.Node) => {
                const classNode = node as TSESTree.ClassDeclaration;
                if (classNode.id) {
                    classDeclarations.set(classNode.id.name, classNode);
                }
            };

            visitors.CallExpression = (node: TSESTree.Node) => {
                detectComponentsFromCall(node as TSESTree.CallExpression, detectionResult);
            };

            visitors['Program:exit'] = () => {
                // Check detected component classes
                for (const className of detectionResult.componentClasses) {
                    const classNode = classDeclarations.get(className);
                    if (classNode) {
                        checkStaticMembers(classNode);
                    }
                }

                // Also check pattern-matched classes
                for (const [className, classNode] of classDeclarations) {
                    if (
                        !detectionResult.componentClasses.has(className) &&
                        componentPattern.test(className)
                    ) {
                        checkStaticMembers(classNode);
                    }
                }
            };
        }

        // Add module-level state checking if enabled
        if (checkModuleLevelState) {
            visitors.VariableDeclaration = (node: TSESTree.Node) => {
                checkModuleLevelVariables(node as TSESTree.VariableDeclaration);
            };
        }

        return visitors;
    },
});

export default noStaticState;
