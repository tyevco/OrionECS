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
    | 'noStaticPropertyInSystem'
    | 'noStaticMethodInSystem'
    | 'noStaticPropertyInPlugin'
    | 'noStaticMethodInPlugin'
    | 'noModuleLevelMutableState';

type Options = [
    {
        componentPattern?: string;
        systemPattern?: string;
        pluginPattern?: string;
        detectFromUsage?: boolean;
        checkComponents?: boolean;
        checkSystems?: boolean;
        checkPlugins?: boolean;
        checkModuleLevelState?: boolean;
        allowedStaticProperties?: string[];
        allowedModuleLevelPatterns?: string[];
    },
];

/**
 * Rule: no-static-state
 *
 * Prevents the use of static state in ECS components, systems, and plugins.
 * Static state breaks entity isolation, interferes with serialization,
 * causes issues with entity pooling, and makes testing difficult.
 *
 * Detection targets:
 * 1. Static properties/methods on component classes
 * 2. Static properties/methods on system classes
 * 3. Static properties/methods on plugin classes
 * 4. Module-level mutable state (let/var declarations at top scope)
 *
 * This enforces the ECS principle that all state should be stored
 * in components or managed through proper ECS patterns, not shared globally.
 */
export const noStaticState = createRule<Options, MessageIds>({
    name: 'no-static-state',
    meta: {
        type: 'problem',
        docs: {
            description:
                'Disallow static state in ECS components, systems, and plugins to maintain proper ECS patterns',
        },
        messages: {
            noStaticPropertyInComponent:
                'Static property "{{propertyName}}" in component "{{className}}" breaks entity isolation. Store state in component instances instead.',
            noStaticMethodInComponent:
                'Static method "{{methodName}}" in component "{{className}}" may indicate shared state. Consider moving to a utility module.',
            noStaticPropertyInSystem:
                'Static property "{{propertyName}}" in system "{{className}}" creates hidden global state. Use singleton components or the engine context instead.',
            noStaticMethodInSystem:
                'Static method "{{methodName}}" in system "{{className}}" may indicate shared state. Consider using engine services or singleton components.',
            noStaticPropertyInPlugin:
                'Static property "{{propertyName}}" in plugin "{{className}}" creates hidden global state. Use PluginContext.extend() or singleton components instead.',
            noStaticMethodInPlugin:
                'Static method "{{methodName}}" in plugin "{{className}}" may indicate shared state. Consider using instance methods or engine services.',
            noModuleLevelMutableState:
                'Module-level mutable variable "{{variableName}}" can cause issues with ECS patterns. Use singleton components for global state instead.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    componentPattern: {
                        type: 'string',
                        description: 'Regex pattern to identify component classes by name',
                    },
                    systemPattern: {
                        type: 'string',
                        description: 'Regex pattern to identify system classes by name',
                    },
                    pluginPattern: {
                        type: 'string',
                        description: 'Regex pattern to identify plugin classes by name',
                    },
                    detectFromUsage: {
                        type: 'boolean',
                        description:
                            'If true, detect components by tracking addComponent, createSystem, etc. calls',
                    },
                    checkComponents: {
                        type: 'boolean',
                        description:
                            'If true, check component classes for static state (default: true)',
                    },
                    checkSystems: {
                        type: 'boolean',
                        description:
                            'If true, check system classes for static state (default: true)',
                    },
                    checkPlugins: {
                        type: 'boolean',
                        description:
                            'If true, check plugin classes for static state (default: true)',
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
            systemPattern: 'System$',
            pluginPattern: 'Plugin$',
            detectFromUsage: false,
            checkComponents: true,
            checkSystems: true,
            checkPlugins: true,
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
        const systemPattern = new RegExp(options.systemPattern || 'System$');
        const pluginPattern = new RegExp(options.pluginPattern || 'Plugin$');
        const detectFromUsage = options.detectFromUsage ?? false;
        const checkComponents = options.checkComponents ?? true;
        const checkSystems = options.checkSystems ?? true;
        const checkPlugins = options.checkPlugins ?? true;
        const checkModuleLevelState = options.checkModuleLevelState ?? false;
        const allowedStaticProperties = new Set(options.allowedStaticProperties || []);
        const allowedModuleLevelPatterns = (options.allowedModuleLevelPatterns || []).map(
            (p) => new RegExp(p)
        );

        // For usage-based detection
        const detectionResult: ComponentDetectionResult = createDetectionResult();
        const classDeclarations = new Map<string, TSESTree.ClassDeclaration>();

        type ClassType = 'component' | 'system' | 'plugin' | null;

        /**
         * Check if a class implements EnginePlugin interface
         */
        function implementsEnginePlugin(node: TSESTree.ClassDeclaration): boolean {
            if (!node.implements) return false;

            for (const impl of node.implements) {
                if (impl.expression.type === 'Identifier') {
                    if (impl.expression.name === 'EnginePlugin') {
                        return true;
                    }
                }
            }

            return false;
        }

        /**
         * Determine the class type (component, system, plugin, or null)
         * @param node The class declaration node
         * @param useDetectionResult If true, also check detection result for usage-based detection
         */
        function getClassType(
            node: TSESTree.ClassDeclaration,
            useDetectionResult = true
        ): ClassType {
            if (!node.id) return null;

            const className = node.id.name;

            // Check for plugin first (can implement interface, match pattern, or detected from usage)
            if (checkPlugins) {
                const detectedAsPlugin =
                    useDetectionResult &&
                    detectFromUsage &&
                    detectionResult.pluginClasses.has(className);
                if (
                    implementsEnginePlugin(node) ||
                    pluginPattern.test(className) ||
                    detectedAsPlugin
                ) {
                    return 'plugin';
                }
            }

            // Check for system
            if (checkSystems && systemPattern.test(className)) {
                return 'system';
            }

            // Check for component (pattern-based or usage-based)
            if (checkComponents) {
                const matchesPattern = componentPattern.test(className);
                const detectedFromUsage =
                    useDetectionResult && detectionResult.componentClasses.has(className);

                if (matchesPattern || detectedFromUsage) {
                    return 'component';
                }
            }

            return null;
        }

        function isAllowedModuleLevelVariable(name: string): boolean {
            return allowedModuleLevelPatterns.some((pattern) => pattern.test(name));
        }

        function checkStaticMembers(node: TSESTree.ClassDeclaration, classType: ClassType): void {
            if (!classType) return;

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

                    const messageId =
                        classType === 'component'
                            ? 'noStaticPropertyInComponent'
                            : classType === 'system'
                              ? 'noStaticPropertyInSystem'
                              : 'noStaticPropertyInPlugin';

                    context.report({
                        node: member,
                        messageId,
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

                    const messageId =
                        classType === 'component'
                            ? 'noStaticMethodInComponent'
                            : classType === 'system'
                              ? 'noStaticMethodInSystem'
                              : 'noStaticMethodInPlugin';

                    context.report({
                        node: member,
                        messageId,
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
                const classType = getClassType(classNode);
                if (classType) {
                    checkStaticMembers(classNode, classType);
                }
            };
        } else {
            // With detection enabled, use two-pass approach
            // Track what we've already checked to avoid duplicates
            const checkedClasses = new Set<string>();

            visitors.ClassDeclaration = (node: TSESTree.Node) => {
                const classNode = node as TSESTree.ClassDeclaration;
                if (classNode.id) {
                    classDeclarations.set(classNode.id.name, classNode);
                }

                // Check systems immediately (they use pattern-based detection only)
                // Don't use detection result yet since we're still collecting
                const classType = getClassType(classNode, false);
                if (classType === 'system') {
                    checkStaticMembers(classNode, classType);
                    if (classNode.id) {
                        checkedClasses.add(classNode.id.name);
                    }
                }
                // Check plugins that match pattern or implement interface immediately
                if (classType === 'plugin') {
                    checkStaticMembers(classNode, classType);
                    if (classNode.id) {
                        checkedClasses.add(classNode.id.name);
                    }
                }
            };

            visitors.CallExpression = (node: TSESTree.Node) => {
                detectComponentsFromCall(node as TSESTree.CallExpression, detectionResult);
            };

            visitors['Program:exit'] = () => {
                // Check detected component classes
                for (const className of detectionResult.componentClasses) {
                    if (checkedClasses.has(className)) continue;
                    const classNode = classDeclarations.get(className);
                    if (classNode) {
                        checkStaticMembers(classNode, 'component');
                        checkedClasses.add(className);
                    }
                }

                // Check detected plugin classes (from engine.use())
                for (const className of detectionResult.pluginClasses) {
                    if (checkedClasses.has(className)) continue;
                    const classNode = classDeclarations.get(className);
                    if (classNode) {
                        checkStaticMembers(classNode, 'plugin');
                        checkedClasses.add(className);
                    }
                }

                // Also check pattern-matched classes that weren't detected
                for (const [className, classNode] of classDeclarations) {
                    if (checkedClasses.has(className)) continue;

                    // Check pattern-matched components
                    if (componentPattern.test(className)) {
                        // Make sure it's not a system/plugin
                        if (!systemPattern.test(className) && !pluginPattern.test(className)) {
                            checkStaticMembers(classNode, 'component');
                            checkedClasses.add(className);
                        }
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
