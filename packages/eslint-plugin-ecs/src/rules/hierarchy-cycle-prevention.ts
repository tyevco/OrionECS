import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'potentialCycle' | 'selfReference' | 'reverseRelationship';

type Options = [
    {
        /** Whether to check for reverse relationships */
        checkReverseRelationships?: boolean;
    },
];

/**
 * Get the entity variable name from a node
 */
function getEntityVarName(node: TSESTree.Node): string | null {
    if (node.type === 'Identifier') {
        return node.name;
    }
    return null;
}

/**
 * Represents a parent-child relationship
 */
interface Relationship {
    parent: string;
    child: string;
    node: TSESTree.Node;
    method: 'addChild' | 'setParent';
}

/**
 * Rule: hierarchy-cycle-prevention
 *
 * Detects potential circular parent-child relationships in entity hierarchies.
 */
export const hierarchyCyclePrevention = createRule<Options, MessageIds>({
    name: 'hierarchy-cycle-prevention',
    meta: {
        type: 'problem',
        docs: {
            description:
                'Detect potential circular parent-child relationships in entity hierarchies',
        },
        messages: {
            potentialCycle:
                'Potential circular hierarchy detected: "{{path}}". This will cause infinite loops or runtime errors.',
            selfReference:
                'Entity "{{entity}}" cannot be its own parent or child. Self-referencing hierarchies are invalid.',
            reverseRelationship:
                'Entities "{{entity1}}" and "{{entity2}}" have a reverse parent-child relationship. "{{entity1}}" is both parent and child of "{{entity2}}".',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    checkReverseRelationships: {
                        type: 'boolean',
                        description: 'Check for A→B and B→A relationships (default: true)',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            checkReverseRelationships: true,
        },
    ],
    create(context, [options]) {
        const checkReverseRelationships = options.checkReverseRelationships ?? true;

        // Track relationships
        const relationships: Relationship[] = [];

        function addRelationship(
            parent: string,
            child: string,
            node: TSESTree.Node,
            method: 'addChild' | 'setParent'
        ): void {
            relationships.push({ parent, child, node, method });
        }

        return {
            CallExpression(node) {
                if (node.callee.type !== 'MemberExpression') return;

                const property = node.callee.property;
                if (property.type !== 'Identifier') return;

                const methodName = property.name;

                // Check addChild(child)
                if (methodName === 'addChild') {
                    const parentVar = getEntityVarName(node.callee.object);
                    if (!parentVar || node.arguments.length === 0) return;

                    const childArg = node.arguments[0];
                    const childVar = getEntityVarName(childArg);
                    if (!childVar) return;

                    // Check for self-reference
                    if (parentVar === childVar) {
                        context.report({
                            node,
                            messageId: 'selfReference',
                            data: { entity: parentVar },
                        });
                        return;
                    }

                    addRelationship(parentVar, childVar, node, 'addChild');
                }

                // Check setParent(parent)
                if (methodName === 'setParent') {
                    const childVar = getEntityVarName(node.callee.object);
                    if (!childVar || node.arguments.length === 0) return;

                    const parentArg = node.arguments[0];
                    // null is valid (removing parent)
                    if (parentArg.type === 'Literal' && parentArg.value === null) {
                        return;
                    }

                    const parentVar = getEntityVarName(parentArg);
                    if (!parentVar) return;

                    // Check for self-reference
                    if (parentVar === childVar) {
                        context.report({
                            node,
                            messageId: 'selfReference',
                            data: { entity: childVar },
                        });
                        return;
                    }

                    addRelationship(parentVar, childVar, node, 'setParent');
                }
            },

            'Program:exit'() {
                // Build adjacency list for cycle detection
                const adjacency = new Map<string, Set<string>>();

                for (const rel of relationships) {
                    if (!adjacency.has(rel.parent)) {
                        adjacency.set(rel.parent, new Set());
                    }
                    adjacency.get(rel.parent)?.add(rel.child);
                }

                // Track pairs that have reverse relationships (to avoid duplicate cycle reports)
                const reverseRelationshipPairs = new Set<string>();

                // Check for reverse relationships (A→B and B→A)
                if (checkReverseRelationships) {
                    const reported = new Set<string>();

                    for (const rel of relationships) {
                        // Check if reverse exists
                        const reverseKey = `${rel.child}->${rel.parent}`;
                        const forwardKey = `${rel.parent}->${rel.child}`;

                        if (reported.has(forwardKey) || reported.has(reverseKey)) continue;

                        const reverseChildren = adjacency.get(rel.child);
                        if (reverseChildren?.has(rel.parent)) {
                            // Find the reverse relationship node
                            const reverseRel = relationships.find(
                                (r) => r.parent === rel.child && r.child === rel.parent
                            );

                            if (reverseRel) {
                                reported.add(forwardKey);
                                reported.add(reverseKey);

                                // Mark this pair to avoid duplicate cycle reports
                                const pairKey = [rel.parent, rel.child].toSorted().join('-');
                                reverseRelationshipPairs.add(pairKey);

                                context.report({
                                    node: reverseRel.node,
                                    messageId: 'reverseRelationship',
                                    data: {
                                        entity1: rel.parent,
                                        entity2: rel.child,
                                    },
                                });
                            }
                        }
                    }
                }

                // Detect longer cycles (A→B→C→A) - skip 2-node cycles as they're handled above
                function findCycle(
                    start: string,
                    visited: Set<string>,
                    path: string[]
                ): string[] | null {
                    if (visited.has(start)) {
                        // Found cycle - return path from cycle start
                        const cycleStart = path.indexOf(start);
                        if (cycleStart !== -1) {
                            return [...path.slice(cycleStart), start];
                        }
                        return null;
                    }

                    visited.add(start);
                    path.push(start);

                    const children = adjacency.get(start);
                    if (children) {
                        for (const child of children) {
                            const cycle = findCycle(child, visited, path);
                            if (cycle) return cycle;
                        }
                    }

                    path.pop();
                    return null;
                }

                // Check for cycles starting from each node
                const reportedCycles = new Set<string>();

                for (const [start] of adjacency) {
                    const cycle = findCycle(start, new Set(), []);

                    // cycle.length includes the repeated start node, so length 3 means A→B→A (2 unique nodes)
                    // Only report cycles with 3+ unique nodes (length > 3) to avoid duplicating reverse relationship reports
                    if (cycle && cycle.length > 3) {
                        // Get unique nodes in the cycle (excluding the repeated last element)
                        const uniqueNodes = cycle.slice(0, -1);

                        // Normalize cycle for deduplication (sort the nodes as a set)
                        // This ensures a→b→c→a and b→c→a→b and c→a→b→c all have the same key
                        const sortedNodes = [...uniqueNodes].toSorted();
                        const cycleKey = sortedNodes.join('-');

                        if (!reportedCycles.has(cycleKey)) {
                            reportedCycles.add(cycleKey);

                            // Find a node in the cycle to report on
                            const cycleRel = relationships.find(
                                (r) =>
                                    uniqueNodes.includes(r.parent) && uniqueNodes.includes(r.child)
                            );

                            if (cycleRel) {
                                context.report({
                                    node: cycleRel.node,
                                    messageId: 'potentialCycle',
                                    data: {
                                        path: cycle.join(' → '),
                                    },
                                });
                            }
                        }
                    }
                }
            },
        };
    },
});

export default hierarchyCyclePrevention;
