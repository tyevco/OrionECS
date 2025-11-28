import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

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
    node: TSESTree.CallExpression;
}

/**
 * Extract component name from a node
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

        /**
         * Extract component names from an array expression
         */
        function getComponentNames(node: TSESTree.Node | undefined): string[] {
            if (!node || node.type !== 'ArrayExpression') return [];

            const names: string[] = [];
            for (const element of node.elements) {
                if (!element) continue;
                const name = getComponentName(element);
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

            // Get the component being validated
            const componentArg = node.arguments[0];
            const componentName = getComponentName(componentArg);
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
            if (dependencies.includes(componentName)) {
                context.report({
                    node: dependenciesProp!,
                    messageId: 'selfDependency',
                    data: { componentName },
                });
            }

            if (conflicts.includes(componentName)) {
                context.report({
                    node: conflictsProp!,
                    messageId: 'selfConflict',
                    data: { componentName },
                });
            }

            // Check for dependency-conflict contradiction
            const dependencySet = new Set(dependencies);
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
            const seenDeps = new Set<string>();
            for (const dep of dependencies) {
                if (seenDeps.has(dep)) {
                    context.report({
                        node: dependenciesProp!,
                        messageId: 'duplicateDependency',
                        data: { targetName: dep },
                    });
                }
                seenDeps.add(dep);
            }

            // Check for duplicates in conflicts
            const seenConflicts = new Set<string>();
            for (const conflict of conflicts) {
                if (seenConflicts.has(conflict)) {
                    context.report({
                        node: conflictsProp!,
                        messageId: 'duplicateConflict',
                        data: { targetName: conflict },
                    });
                }
                seenConflicts.add(conflict);
            }

            // Store for circular dependency detection
            if (checkCircularDependencies) {
                validators.set(componentName, {
                    componentName,
                    dependencies: dependencySet,
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
