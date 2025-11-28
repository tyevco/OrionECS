import {
    ESLintUtils,
    type ParserServicesWithTypeInformation,
    type TSESTree,
} from '@typescript-eslint/utils';
import type * as ts from 'typescript';
import {
    getComponentRegistry,
    hasTypeInformation,
    resolveTypeInfo,
} from '../utils/component-registry';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds =
    | 'selfDependency'
    | 'selfConflict'
    | 'dependencyConflictContradiction'
    | 'duplicateDependency'
    | 'duplicateConflict'
    | 'circularDependency';

type Options = [
    {
        checkCircularDependencies?: boolean;
    },
];

interface ValidatorInfo {
    componentName: string;
    dependencies: Set<string>;
    conflicts: Set<string>;
    node: TSESTree.CallExpression | null; // null for cross-file validators
}

/**
 * Type-aware context for resolving component names
 */
interface TypeAwareContext {
    parserServices: ParserServicesWithTypeInformation;
    checker: ts.TypeChecker;
}

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
 * Rule: component-validator
 *
 * Catches common issues with component validation configuration:
 * - Self-referencing dependencies or conflicts
 * - Components that both depend on AND conflict with the same component
 * - Duplicate entries in dependencies or conflicts arrays
 * - Circular dependencies between components (optional, requires full-file analysis)
 */
export const componentValidator = createRule<Options, MessageIds>({
    name: 'component-validator',
    meta: {
        type: 'problem',
        docs: {
            description: 'Detect issues in component validation configuration',
        },
        messages: {
            selfDependency:
                'Component "{{componentName}}" cannot depend on itself. Remove it from dependencies.',
            selfConflict:
                'Component "{{componentName}}" cannot conflict with itself. Remove it from conflicts.',
            dependencyConflictContradiction:
                'Component "{{componentName}}" both depends on and conflicts with "{{targetName}}". This is contradictory - a component cannot require and forbid the same component.',
            duplicateDependency:
                '"{{targetName}}" appears multiple times in dependencies array. Remove the duplicate.',
            duplicateConflict:
                '"{{targetName}}" appears multiple times in conflicts array. Remove the duplicate.',
            circularDependency:
                'Circular dependency detected: {{cycle}}. This will cause validation to fail.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    checkCircularDependencies: {
                        type: 'boolean',
                        description:
                            'If true, check for circular dependencies across multiple registerComponentValidator calls',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            checkCircularDependencies: true,
        },
    ],
    create(context, [options]) {
        const checkCircularDependencies = options.checkCircularDependencies ?? true;

        // Track all validators for circular dependency detection
        const validators = new Map<string, ValidatorInfo>();

        // Set up type-aware context if type information is available
        let typeContext: TypeAwareContext | null = null;
        const parserServices = context.sourceCode.parserServices;

        if (hasTypeInformation(parserServices)) {
            // Create type-aware context for resolving component names
            typeContext = {
                parserServices,
                checker: parserServices.program.getTypeChecker(),
            };

            // Load cross-file validators from the registry for circular dependency detection
            if (checkCircularDependencies) {
                const registry = getComponentRegistry(parserServices);
                for (const [componentName, metadata] of registry.components) {
                    // Only add if not already in local validators (local takes precedence)
                    if (!validators.has(componentName)) {
                        validators.set(componentName, {
                            componentName,
                            dependencies: metadata.dependencies,
                            conflicts: metadata.conflicts,
                            node: null, // Cross-file validators don't have local nodes
                        });
                    }
                }
            }
        }

        /**
         * Extract component names from an array expression using type-aware resolution
         */
        function getComponentNames(node: TSESTree.Node | undefined): string[] {
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
         * Check for circular dependencies using DFS
         */
        function findCircularDependencies(): void {
            const visited = new Set<string>();
            const recursionStack = new Set<string>();
            const cycles: string[][] = [];

            function dfs(componentName: string, path: string[]): boolean {
                if (recursionStack.has(componentName)) {
                    // Found a cycle - extract it from the path
                    const cycleStart = path.indexOf(componentName);
                    const cycle = [...path.slice(cycleStart), componentName];
                    cycles.push(cycle);
                    return true;
                }

                if (visited.has(componentName)) {
                    return false;
                }

                visited.add(componentName);
                recursionStack.add(componentName);

                const validator = validators.get(componentName);
                if (validator) {
                    for (const dep of validator.dependencies) {
                        dfs(dep, [...path, componentName]);
                    }
                }

                recursionStack.delete(componentName);
                return false;
            }

            // Run DFS from each validator
            for (const componentName of validators.keys()) {
                if (!visited.has(componentName)) {
                    dfs(componentName, []);
                }
            }

            // Report all cycles found
            for (const cycle of cycles) {
                const cycleStr = cycle.join(' → ');
                // Report on the first component in the cycle that we have a validator for
                for (const componentName of cycle) {
                    const validator = validators.get(componentName);
                    if (validator) {
                        context.report({
                            node: validator.node,
                            messageId: 'circularDependency',
                            data: { cycle: cycleStr },
                        });
                        break;
                    }
                }
            }
        }

        /**
         * Check a registerComponentValidator call
         */
        function checkValidatorCall(node: TSESTree.CallExpression): void {
            // Verify it's a registerComponentValidator call
            if (node.callee.type !== 'MemberExpression') return;
            if (node.callee.property.type !== 'Identifier') return;
            if (node.callee.property.name !== 'registerComponentValidator') return;

            // Get the component being validated using type-aware resolution
            const componentArg = node.arguments[0];
            const componentName = resolveComponentNameWithTypes(componentArg, typeContext);
            if (!componentName) return;

            // Get the validator options object
            const optionsArg = node.arguments[1];
            if (!optionsArg || optionsArg.type !== 'ObjectExpression') return;

            // Extract dependencies and conflicts
            const dependenciesProp = findProperty(optionsArg, 'dependencies');
            const conflictsProp = findProperty(optionsArg, 'conflicts');

            const dependencies = dependenciesProp ? getComponentNames(dependenciesProp.value) : [];
            const conflicts = conflictsProp ? getComponentNames(conflictsProp.value) : [];

            // Check for self-referencing
            if (dependenciesProp && dependencies.includes(componentName)) {
                context.report({
                    node: dependenciesProp,
                    messageId: 'selfDependency',
                    data: { componentName },
                });
            }

            if (conflictsProp && conflicts.includes(componentName)) {
                context.report({
                    node: conflictsProp,
                    messageId: 'selfConflict',
                    data: { componentName },
                });
            }

            // Check for dependency-conflict contradiction
            const conflictSet = new Set(conflicts);

            for (const dep of dependencies) {
                if (conflictSet.has(dep)) {
                    context.report({
                        node: optionsArg,
                        messageId: 'dependencyConflictContradiction',
                        data: { componentName, targetName: dep },
                    });
                }
            }

            // Check for duplicates in dependencies
            if (dependenciesProp) {
                const seenDeps = new Set<string>();
                for (const dep of dependencies) {
                    if (seenDeps.has(dep)) {
                        context.report({
                            node: dependenciesProp,
                            messageId: 'duplicateDependency',
                            data: { targetName: dep },
                        });
                    }
                    seenDeps.add(dep);
                }
            }

            // Check for duplicates in conflicts
            if (conflictsProp) {
                const seenConflicts = new Set<string>();
                for (const conflict of conflicts) {
                    if (seenConflicts.has(conflict)) {
                        context.report({
                            node: conflictsProp,
                            messageId: 'duplicateConflict',
                            data: { targetName: conflict },
                        });
                    }
                    seenConflicts.add(conflict);
                }
            }

            // Store for circular dependency detection
            // Filter out self-references since they're already reported as selfDependency
            if (checkCircularDependencies) {
                const filteredDeps = new Set(dependencies.filter((d) => d !== componentName));
                validators.set(componentName, {
                    componentName,
                    dependencies: filteredDeps,
                    conflicts: conflictSet,
                    node,
                });
            }
        }

        return {
            CallExpression: checkValidatorCall,

            'Program:exit'() {
                if (checkCircularDependencies && validators.size > 0) {
                    findCircularDependencies();
                }
            },
        };
    },
});

export default componentValidator;
