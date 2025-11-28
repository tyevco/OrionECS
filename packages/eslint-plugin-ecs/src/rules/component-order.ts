import {
    ESLintUtils,
    type ParserServicesWithTypeInformation,
    type TSESTree,
} from '@typescript-eslint/utils';
import type * as ts from 'typescript';
import {
    type ComponentRegistry,
    getComponentRegistry,
    hasTypeInformation,
    resolveTypeInfo,
} from '../utils/component-registry';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds =
    | 'missingDependency'
    | 'conflictingComponent'
    | 'prefabMissingDependency'
    | 'prefabConflictingComponent';

type Options = [
    {
        /** Known component dependencies - maps component name to required dependencies */
        dependencies?: Record<string, string[]>;
        /** Known component conflicts - maps component name to conflicting components */
        conflicts?: Record<string, string[]>;
    },
];

/**
 * Extract component name from a node (simple AST-based extraction)
 */
function getComponentName(node: TSESTree.Node | undefined): string | null {
    if (!node) return null;
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'MemberExpression' && node.property.type === 'Identifier') {
        return node.property.name;
    }
    return null;
}

/**
 * Type-aware context for resolving component names
 */
interface TypeAwareContext {
    parserServices: ParserServicesWithTypeInformation;
    checker: ts.TypeChecker;
}

/**
 * Resolve component name using TypeScript type checker.
 * This handles imports, type aliases, and external packages.
 */
function resolveComponentNameWithTypes(
    node: TSESTree.Node | undefined,
    typeContext: TypeAwareContext | null
): string | null {
    if (!node) return null;

    // If we have type information, use it
    if (typeContext) {
        try {
            const tsNode = typeContext.parserServices.esTreeNodeToTSNodeMap.get(node);
            if (tsNode) {
                const typeInfo = resolveTypeInfo(tsNode, typeContext.checker);
                if (typeInfo) {
                    return typeInfo.name;
                }
            }
        } catch {
            // Fall back to AST-based extraction if type resolution fails
        }
    }

    // Fall back to simple name extraction
    return getComponentName(node);
}

/**
 * Get the entity variable name from a call expression
 */
function getEntityName(node: TSESTree.CallExpression): string | null {
    if (node.callee.type !== 'MemberExpression') return null;
    if (node.callee.object.type === 'Identifier') {
        return node.callee.object.name;
    }
    return null;
}

/**
 * Find a property in an object expression
 */
function findProperty(
    obj: TSESTree.ObjectExpression,
    propName: string
): TSESTree.Property | undefined {
    for (const prop of obj.properties) {
        if (
            prop.type === 'Property' &&
            prop.key.type === 'Identifier' &&
            prop.key.name === propName
        ) {
            return prop;
        }
    }
    return undefined;
}

/**
 * Extract component type from a prefab component entry like { type: Position, args: [...] }
 * Uses type-aware resolution when context is provided.
 */
function getComponentTypeFromPrefabEntry(
    node: TSESTree.Node,
    typeCtx: TypeAwareContext | null
): string | null {
    if (node.type !== 'ObjectExpression') return null;

    for (const prop of node.properties) {
        if (
            prop.type === 'Property' &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'type'
        ) {
            // Use type-aware resolution for the component type
            return resolveComponentNameWithTypes(prop.value, typeCtx);
        }
    }
    return null;
}

/**
 * Rule: component-order
 *
 * Ensures components are added to entities in the correct order based on their dependencies.
 * When a component has dependencies declared via registerComponentValidator, those
 * dependencies must be added to the entity before the dependent component.
 *
 * Also checks for conflicts - if a component conflicts with another, they shouldn't
 * both be added to the same entity.
 *
 * Additionally validates prefabs registered via registerPrefab to ensure their
 * component arrays respect dependency order and don't contain conflicting components.
 */
export const componentOrder = createRule<Options, MessageIds>({
    name: 'component-order',
    meta: {
        type: 'problem',
        docs: {
            description: 'Ensure components are added in correct order based on dependencies',
        },
        messages: {
            missingDependency:
                'Component "{{componentName}}" requires "{{dependencyName}}" to be added first. Add {{dependencyName}} before {{componentName}}.',
            conflictingComponent:
                'Component "{{componentName}}" conflicts with "{{conflictName}}" which was already added to this entity.',
            prefabMissingDependency:
                'Prefab "{{prefabName}}": Component "{{componentName}}" requires "{{dependencyName}}" to appear earlier in the components array.',
            prefabConflictingComponent:
                'Prefab "{{prefabName}}": Component "{{componentName}}" conflicts with "{{conflictName}}". These components cannot be in the same prefab.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    dependencies: {
                        type: 'object',
                        description: 'Map of component names to their required dependencies',
                        additionalProperties: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                    },
                    conflicts: {
                        type: 'object',
                        description: 'Map of component names to their conflicting components',
                        additionalProperties: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            dependencies: {},
            conflicts: {},
        },
    ],
    create(context, [options]) {
        // Dependencies can come from options, cross-file scanning, or local registerComponentValidator calls
        const componentDependencies = new Map<string, Set<string>>(
            Object.entries(options.dependencies || {}).map(([k, v]) => [k, new Set(v)])
        );
        const componentConflicts = new Map<string, Set<string>>(
            Object.entries(options.conflicts || {}).map(([k, v]) => [k, new Set(v)])
        );

        // Set up type-aware context if type information is available
        let typeContext: TypeAwareContext | null = null;
        let crossFileRegistry: ComponentRegistry | null = null;
        const parserServices = context.sourceCode.parserServices;

        if (hasTypeInformation(parserServices)) {
            // Create type-aware context for resolving component names
            typeContext = {
                parserServices,
                checker: parserServices.program.getTypeChecker(),
            };

            // Get cross-file component registry
            crossFileRegistry = getComponentRegistry(parserServices);

            // Merge cross-file metadata into our local maps
            for (const [componentName, metadata] of crossFileRegistry.components) {
                // Merge dependencies
                if (metadata.dependencies.size > 0) {
                    const existing = componentDependencies.get(componentName) || new Set();
                    for (const dep of metadata.dependencies) {
                        existing.add(dep);
                    }
                    componentDependencies.set(componentName, existing);
                }
                // Merge conflicts
                if (metadata.conflicts.size > 0) {
                    const existing = componentConflicts.get(componentName) || new Set();
                    for (const conflict of metadata.conflicts) {
                        existing.add(conflict);
                    }
                    componentConflicts.set(componentName, existing);
                }
            }
        }

        // Track components added to each entity (by variable name)
        // Reset for each statement/block to handle scoping
        const entityComponents = new Map<string, Set<string>>();

        /**
         * Extract component names from an array, using type-aware resolution when available
         */
        function getComponentNamesTypeAware(node: TSESTree.Node | undefined): string[] {
            if (!node || node.type !== 'ArrayExpression') return [];

            const names: string[] = [];
            for (const element of node.elements) {
                if (!element) continue;
                const name = resolveComponentNameWithTypes(element, typeContext);
                if (name) names.push(name);
            }
            return names;
        }

        /**
         * Process a registerComponentValidator call to extract dependencies/conflicts
         */
        function processValidatorRegistration(node: TSESTree.CallExpression): void {
            if (node.callee.type !== 'MemberExpression') return;
            if (node.callee.property.type !== 'Identifier') return;
            if (node.callee.property.name !== 'registerComponentValidator') return;

            const componentArg = node.arguments[0];
            // Use type-aware resolution for the component name
            const componentName = resolveComponentNameWithTypes(componentArg, typeContext);
            if (!componentName) return;

            const optionsArg = node.arguments[1];
            if (!optionsArg || optionsArg.type !== 'ObjectExpression') return;

            // Extract dependencies using type-aware resolution
            const dependenciesProp = findProperty(optionsArg, 'dependencies');
            if (dependenciesProp) {
                const deps = getComponentNamesTypeAware(dependenciesProp.value);
                if (deps.length > 0) {
                    const existing = componentDependencies.get(componentName) || new Set();
                    for (const dep of deps) {
                        existing.add(dep);
                    }
                    componentDependencies.set(componentName, existing);
                }
            }

            // Extract conflicts using type-aware resolution
            const conflictsProp = findProperty(optionsArg, 'conflicts');
            if (conflictsProp) {
                const conflicts = getComponentNamesTypeAware(conflictsProp.value);
                if (conflicts.length > 0) {
                    const existing = componentConflicts.get(componentName) || new Set();
                    for (const conflict of conflicts) {
                        existing.add(conflict);
                    }
                    componentConflicts.set(componentName, existing);
                }
            }
        }

        /**
         * Process an addComponent call
         */
        function processAddComponent(node: TSESTree.CallExpression): void {
            if (node.callee.type !== 'MemberExpression') return;
            if (node.callee.property.type !== 'Identifier') return;
            if (node.callee.property.name !== 'addComponent') return;

            const entityName = getEntityName(node);
            if (!entityName) return;

            const componentArg = node.arguments[0];
            // Use type-aware resolution to properly resolve imported components
            const componentName = resolveComponentNameWithTypes(componentArg, typeContext);
            if (!componentName) return;

            // Get the set of components already added to this entity
            const addedComponents = entityComponents.get(entityName) || new Set<string>();

            // Check if dependencies are satisfied
            const deps = componentDependencies.get(componentName);
            if (deps) {
                for (const dep of deps) {
                    if (!addedComponents.has(dep)) {
                        context.report({
                            node,
                            messageId: 'missingDependency',
                            data: {
                                componentName,
                                dependencyName: dep,
                            },
                        });
                    }
                }
            }

            // Check for conflicts
            const conflicts = componentConflicts.get(componentName);
            if (conflicts) {
                for (const conflict of conflicts) {
                    if (addedComponents.has(conflict)) {
                        context.report({
                            node,
                            messageId: 'conflictingComponent',
                            data: {
                                componentName,
                                conflictName: conflict,
                            },
                        });
                    }
                }
            }

            // Add this component to the entity's set
            addedComponents.add(componentName);
            entityComponents.set(entityName, addedComponents);
        }

        /**
         * Process a registerPrefab call to validate component order and conflicts
         */
        function processPrefabRegistration(node: TSESTree.CallExpression): void {
            if (node.callee.type !== 'MemberExpression') return;
            if (node.callee.property.type !== 'Identifier') return;
            if (node.callee.property.name !== 'registerPrefab') return;

            // Get prefab name (first argument)
            const prefabNameArg = node.arguments[0];
            let prefabName = 'unknown';
            if (
                prefabNameArg &&
                prefabNameArg.type === 'Literal' &&
                typeof prefabNameArg.value === 'string'
            ) {
                prefabName = prefabNameArg.value;
            }

            // Get prefab object (second argument)
            const prefabArg = node.arguments[1];
            if (!prefabArg || prefabArg.type !== 'ObjectExpression') return;

            // Find the components array
            const componentsProp = findProperty(prefabArg, 'components');
            if (!componentsProp || componentsProp.value.type !== 'ArrayExpression') return;

            const componentsArray = componentsProp.value;
            const addedComponents = new Set<string>();

            // Process each component entry in order
            for (const element of componentsArray.elements) {
                if (!element) continue;

                // Use type-aware resolution for prefab component types
                const componentName = getComponentTypeFromPrefabEntry(element, typeContext);
                if (!componentName) continue;

                // Check if dependencies are satisfied (must appear earlier in array)
                const deps = componentDependencies.get(componentName);
                if (deps) {
                    for (const dep of deps) {
                        if (!addedComponents.has(dep)) {
                            context.report({
                                node: element,
                                messageId: 'prefabMissingDependency',
                                data: {
                                    prefabName,
                                    componentName,
                                    dependencyName: dep,
                                },
                            });
                        }
                    }
                }

                // Check for conflicts with already added components
                const conflicts = componentConflicts.get(componentName);
                if (conflicts) {
                    for (const conflict of conflicts) {
                        if (addedComponents.has(conflict)) {
                            context.report({
                                node: element,
                                messageId: 'prefabConflictingComponent',
                                data: {
                                    prefabName,
                                    componentName,
                                    conflictName: conflict,
                                },
                            });
                        }
                    }
                }

                addedComponents.add(componentName);
            }
        }

        /**
         * Reset entity tracking when entering a new function scope
         * This prevents false positives across different functions
         */
        function resetEntityTracking(): void {
            entityComponents.clear();
        }

        return {
            // Detect dependencies from registerComponentValidator and validate usage
            CallExpression(node) {
                processValidatorRegistration(node);
                processAddComponent(node);
                processPrefabRegistration(node);
            },

            // Reset tracking on function boundaries
            FunctionDeclaration: resetEntityTracking,
            FunctionExpression: resetEntityTracking,
            ArrowFunctionExpression: resetEntityTracking,
        };
    },
});

export default componentOrder;
