import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'shouldUseFixedUpdate' | 'inconsistentPhysics';

type Options = [
    {
        /** Component names that indicate physics simulation */
        physicsComponents?: string[];
        /** System name patterns that indicate physics */
        physicsSystemPatterns?: string[];
    },
];

/**
 * Get property from an object expression by name
 */
function getProperty(obj: TSESTree.ObjectExpression, name: string): TSESTree.Property | null {
    for (const prop of obj.properties) {
        if (prop.type === 'Property' && prop.key.type === 'Identifier' && prop.key.name === name) {
            return prop;
        }
    }
    return null;
}

/**
 * Get component names from query options
 */
function getQueryComponents(queryOptions: TSESTree.ObjectExpression): string[] {
    const components: string[] = [];

    const allProp = getProperty(queryOptions, 'all');
    if (allProp?.value.type === 'ArrayExpression') {
        for (const element of allProp.value.elements) {
            if (element?.type === 'Identifier') {
                components.push(element.name);
            }
        }
    }

    const anyProp = getProperty(queryOptions, 'any');
    if (anyProp?.value.type === 'ArrayExpression') {
        for (const element of anyProp.value.elements) {
            if (element?.type === 'Identifier') {
                components.push(element.name);
            }
        }
    }

    return components;
}

/**
 * Check if a component name indicates physics
 */
function isPhysicsComponent(componentName: string, physicsComponents: Set<string>): boolean {
    if (physicsComponents.has(componentName)) {
        return true;
    }

    const lowerName = componentName.toLowerCase();
    return (
        lowerName.includes('rigidbody') ||
        lowerName.includes('rigid_body') ||
        lowerName.includes('collider') ||
        lowerName.includes('physics') ||
        lowerName.includes('gravity') ||
        lowerName.includes('force') ||
        lowerName.includes('impulse') ||
        lowerName.includes('mass') ||
        lowerName.includes('friction') ||
        lowerName.includes('restitution')
    );
}

/**
 * Check if a system name indicates physics
 */
function isPhysicsSystemName(systemName: string, physicsPatterns: RegExp[]): boolean {
    for (const pattern of physicsPatterns) {
        if (pattern.test(systemName)) {
            return true;
        }
    }

    const lowerName = systemName.toLowerCase();
    return (
        lowerName.includes('physics') ||
        lowerName.includes('collision') ||
        lowerName.includes('gravity') ||
        lowerName.includes('rigidbody') ||
        lowerName.includes('movement') ||
        lowerName.includes('integration')
    );
}

/**
 * Rule: fixed-update-for-physics
 *
 * Ensures physics-related systems use fixed update for deterministic simulation.
 */
export const fixedUpdateForPhysics = createRule<Options, MessageIds>({
    name: 'fixed-update-for-physics',
    meta: {
        type: 'problem',
        docs: {
            description:
                'Ensure physics-related systems use fixed update for consistent simulation',
        },
        messages: {
            shouldUseFixedUpdate:
                'System "{{systemName}}" queries physics component(s) ({{components}}) but uses variable update. Physics systems should use fixed update (pass `true` as the 4th argument) for deterministic behavior.',
            inconsistentPhysics:
                'Physics system "{{systemName}}" should use fixed update. Variable timesteps cause inconsistent physics simulation.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    physicsComponents: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Component names that indicate physics',
                    },
                    physicsSystemPatterns: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'System name patterns (regex) that indicate physics',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            physicsComponents: [
                'RigidBody',
                'Collider',
                'BoxCollider',
                'CircleCollider',
                'PhysicsBody',
                'Gravity',
                'Force',
                'Impulse',
                'Mass',
                'Friction',
                'Restitution',
                'AngularVelocity',
            ],
            physicsSystemPatterns: [],
        },
    ],
    create(context, [options]) {
        const physicsComponents = new Set(options.physicsComponents ?? []);
        const physicsPatterns = (options.physicsSystemPatterns ?? []).map(
            (p) => new RegExp(p, 'i')
        );

        return {
            CallExpression(node) {
                // Check for createSystem calls
                if (
                    node.callee.type !== 'MemberExpression' ||
                    node.callee.property.type !== 'Identifier' ||
                    node.callee.property.name !== 'createSystem'
                ) {
                    return;
                }

                // createSystem(name, queryOptions, systemOptions, isFixedUpdate?)
                if (node.arguments.length < 3) {
                    return;
                }

                // Get system name
                let systemName = 'Unknown';
                if (node.arguments[0].type === 'Literal') {
                    systemName = String(node.arguments[0].value);
                }

                // Get query options
                if (node.arguments[1].type !== 'ObjectExpression') {
                    return;
                }
                const queryOptions = node.arguments[1] as TSESTree.ObjectExpression;
                const queryComponents = getQueryComponents(queryOptions);

                // Check if it's a physics system by components
                const physicsComponentsFound = queryComponents.filter((c) =>
                    isPhysicsComponent(c, physicsComponents)
                );

                // Check if it's a physics system by name
                const isPhysicsName = isPhysicsSystemName(systemName, physicsPatterns);

                // Determine if this is a physics system
                const isPhysicsSystem = physicsComponentsFound.length > 0 || isPhysicsName;

                if (!isPhysicsSystem) {
                    return;
                }

                // Check the 4th argument (isFixedUpdate)
                const isFixedUpdateArg = node.arguments[3];

                // If no 4th argument, it defaults to false (variable update)
                if (!isFixedUpdateArg) {
                    if (physicsComponentsFound.length > 0) {
                        context.report({
                            node,
                            messageId: 'shouldUseFixedUpdate',
                            data: {
                                systemName,
                                components: physicsComponentsFound.join(', '),
                            },
                        });
                    } else {
                        context.report({
                            node,
                            messageId: 'inconsistentPhysics',
                            data: { systemName },
                        });
                    }
                    return;
                }

                // Check if the argument is false
                if (isFixedUpdateArg.type === 'Literal' && isFixedUpdateArg.value === false) {
                    if (physicsComponentsFound.length > 0) {
                        context.report({
                            node: isFixedUpdateArg,
                            messageId: 'shouldUseFixedUpdate',
                            data: {
                                systemName,
                                components: physicsComponentsFound.join(', '),
                            },
                        });
                    } else {
                        context.report({
                            node: isFixedUpdateArg,
                            messageId: 'inconsistentPhysics',
                            data: { systemName },
                        });
                    }
                }
            },
        };
    },
});

export default fixedUpdateForPhysics;
