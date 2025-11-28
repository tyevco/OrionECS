import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import {
    type ComponentRegistry,
    getComponentRegistry,
    hasTypeInformation,
} from '../utils/component-registry';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds =
    | 'componentInAllAndNone'
    | 'tagInBothTagArrays'
    | 'duplicateComponentInAll'
    | 'duplicateComponentInNone'
    | 'duplicateTag'
    | 'duplicateWithoutTag'
    | 'conflictingComponentsInAll';

type Options = [
    {
        /** Known component conflicts - maps component name to conflicting components */
        conflicts?: Record<string, string[]>;
    },
];

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
 * Extract string value from a node (for tags)
 */
function getStringValue(node: TSESTree.Node | undefined): string | null {
    if (!node) return null;
    if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
    }
    return null;
}

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
 * Extract string values from an array expression (for tags)
 */
function getStringValues(node: TSESTree.Node | undefined): string[] {
    if (!node || node.type !== 'ArrayExpression') return [];

    const values: string[] = [];
    for (const element of node.elements) {
        if (!element) continue;
        const value = getStringValue(element);
        if (value) values.push(value);
    }
    return values;
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
 * Rule: query-validator
 *
 * Validates system queries (createSystem) and fluent queries to catch logical errors:
 * - Components in both `all` and `none` (impossible to match)
 * - Tags in both `tags` and `withoutTags` (impossible to match)
 * - Duplicate components or tags
 * - Conflicting components both required in `all` (no entities can match)
 */
export const queryValidator = createRule<Options, MessageIds>({
    name: 'query-validator',
    meta: {
        type: 'problem',
        docs: {
            description: 'Validate system queries for logical errors and contradictions',
        },
        messages: {
            componentInAllAndNone:
                'Component "{{componentName}}" is in both "all" and "none". This query will never match any entities.',
            tagInBothTagArrays:
                'Tag "{{tagName}}" is in both "tags" and "withoutTags". This query will never match any entities.',
            duplicateComponentInAll:
                'Component "{{componentName}}" appears multiple times in "all" array. Remove the duplicate.',
            duplicateComponentInNone:
                'Component "{{componentName}}" appears multiple times in "none" array. Remove the duplicate.',
            duplicateTag:
                'Tag "{{tagName}}" appears multiple times in "tags" array. Remove the duplicate.',
            duplicateWithoutTag:
                'Tag "{{tagName}}" appears multiple times in "withoutTags" array. Remove the duplicate.',
            conflictingComponentsInAll:
                'Components "{{componentA}}" and "{{componentB}}" conflict with each other. Having both in "all" means no entities can match this query.',
        },
        schema: [
            {
                type: 'object',
                properties: {
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
            conflicts: {},
        },
    ],
    create(context, [options]) {
        // Conflicts can come from options, cross-file scanning, or local registerComponentValidator calls
        const componentConflicts = new Map<string, Set<string>>(
            Object.entries(options.conflicts || {}).map(([k, v]) => [k, new Set(v)])
        );

        // Try to get cross-file component registry if type information is available
        let crossFileRegistry: ComponentRegistry | null = null;
        const parserServices = context.sourceCode.parserServices;
        if (hasTypeInformation(parserServices)) {
            crossFileRegistry = getComponentRegistry(parserServices);
            // Merge cross-file conflicts into our local map
            for (const [componentName, metadata] of crossFileRegistry.components) {
                if (metadata.conflicts.size > 0) {
                    const existing = componentConflicts.get(componentName) || new Set();
                    for (const conflict of metadata.conflicts) {
                        existing.add(conflict);
                    }
                    componentConflicts.set(componentName, existing);
                }
            }
        }

        /**
         * Process a registerComponentValidator call to extract conflicts
         */
        function processValidatorRegistration(node: TSESTree.CallExpression): void {
            if (node.callee.type !== 'MemberExpression') return;
            if (node.callee.property.type !== 'Identifier') return;
            if (node.callee.property.name !== 'registerComponentValidator') return;

            const componentArg = node.arguments[0];
            const componentName = getComponentName(componentArg);
            if (!componentName) return;

            const optionsArg = node.arguments[1];
            if (!optionsArg || optionsArg.type !== 'ObjectExpression') return;

            // Extract conflicts
            const conflictsProp = findProperty(optionsArg, 'conflicts');
            if (conflictsProp) {
                const conflicts = getComponentNames(conflictsProp.value);
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
         * Validate a query object (from createSystem or fluent query builder)
         */
        function validateQueryObject(queryObj: TSESTree.ObjectExpression): void {
            // Extract all component arrays
            const allProp = findProperty(queryObj, 'all');
            const noneProp = findProperty(queryObj, 'none');
            const tagsProp = findProperty(queryObj, 'tags');
            const withoutTagsProp = findProperty(queryObj, 'withoutTags');

            const allComponents = allProp ? getComponentNames(allProp.value) : [];
            const noneComponents = noneProp ? getComponentNames(noneProp.value) : [];
            const tags = tagsProp ? getStringValues(tagsProp.value) : [];
            const withoutTags = withoutTagsProp ? getStringValues(withoutTagsProp.value) : [];

            const noneSet = new Set(noneComponents);
            const withoutTagsSet = new Set(withoutTags);

            // Check for components in both all and none
            for (const component of allComponents) {
                if (noneSet.has(component)) {
                    context.report({
                        node: queryObj,
                        messageId: 'componentInAllAndNone',
                        data: { componentName: component },
                    });
                }
            }

            // Check for tags in both tags and withoutTags
            for (const tag of tags) {
                if (withoutTagsSet.has(tag)) {
                    context.report({
                        node: queryObj,
                        messageId: 'tagInBothTagArrays',
                        data: { tagName: tag },
                    });
                }
            }

            // Check for duplicate components in all
            if (allProp) {
                const seenAll = new Set<string>();
                for (const component of allComponents) {
                    if (seenAll.has(component)) {
                        context.report({
                            node: allProp,
                            messageId: 'duplicateComponentInAll',
                            data: { componentName: component },
                        });
                    }
                    seenAll.add(component);
                }
            }

            // Check for duplicate components in none
            if (noneProp) {
                const seenNone = new Set<string>();
                for (const component of noneComponents) {
                    if (seenNone.has(component)) {
                        context.report({
                            node: noneProp,
                            messageId: 'duplicateComponentInNone',
                            data: { componentName: component },
                        });
                    }
                    seenNone.add(component);
                }
            }

            // Check for duplicate tags
            if (tagsProp) {
                const seenTags = new Set<string>();
                for (const tag of tags) {
                    if (seenTags.has(tag)) {
                        context.report({
                            node: tagsProp,
                            messageId: 'duplicateTag',
                            data: { tagName: tag },
                        });
                    }
                    seenTags.add(tag);
                }
            }

            // Check for duplicate withoutTags
            if (withoutTagsProp) {
                const seenWithoutTags = new Set<string>();
                for (const tag of withoutTags) {
                    if (seenWithoutTags.has(tag)) {
                        context.report({
                            node: withoutTagsProp,
                            messageId: 'duplicateWithoutTag',
                            data: { tagName: tag },
                        });
                    }
                    seenWithoutTags.add(tag);
                }
            }

            // Check for conflicting components both in 'all'
            if (allProp) {
                const checkedPairs = new Set<string>();
                for (const componentA of allComponents) {
                    const conflicts = componentConflicts.get(componentA);
                    if (conflicts) {
                        for (const componentB of allComponents) {
                            if (componentA === componentB) continue;
                            // Avoid reporting the same pair twice
                            const pairKey = [componentA, componentB].sort().join('|');
                            if (checkedPairs.has(pairKey)) continue;
                            checkedPairs.add(pairKey);

                            if (conflicts.has(componentB)) {
                                context.report({
                                    node: allProp,
                                    messageId: 'conflictingComponentsInAll',
                                    data: { componentA, componentB },
                                });
                            }
                        }
                    }
                }
            }
        }

        /**
         * Process a createSystem call
         */
        function processCreateSystem(node: TSESTree.CallExpression): void {
            if (node.callee.type !== 'MemberExpression') return;
            if (node.callee.property.type !== 'Identifier') return;
            if (node.callee.property.name !== 'createSystem') return;

            // Get query object (second argument)
            const queryArg = node.arguments[1];
            if (!queryArg || queryArg.type !== 'ObjectExpression') return;

            validateQueryObject(queryArg);
        }

        return {
            CallExpression(node) {
                processValidatorRegistration(node);
                processCreateSystem(node);
            },
        };
    },
});

export default queryValidator;
