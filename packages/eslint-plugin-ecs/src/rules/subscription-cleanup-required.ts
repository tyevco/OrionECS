import { ESLintUtils, type TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://github.com/tyevco/OrionECS/blob/main/docs/eslint-rules/${name}.md`
);

type MessageIds = 'subscriptionNotStored' | 'subscriptionNotCleanedUp' | 'missingUninstallMethod';

type Options = [
    {
        /** Pattern to identify plugin classes */
        pluginPattern?: string;
        /** Additional subscription method names */
        subscriptionMethods?: string[];
    },
];

interface SubscriptionInfo {
    node: TSESTree.CallExpression;
    methodName: string;
    isStored: boolean;
    storedFieldName?: string;
}

interface PluginInfo {
    className: string;
    classNode: TSESTree.ClassDeclaration;
    subscriptions: SubscriptionInfo[];
    hasUninstall: boolean;
    cleanedUpFields: Set<string>;
}

/**
 * Check if a call is inside an 'install' method
 */
function isInsideInstallMethod(node: TSESTree.Node): boolean {
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        if (current.type === 'MethodDefinition') {
            if (current.key.type === 'Identifier' && current.key.name === 'install') {
                return true;
            }
        }
        current = current.parent;
    }

    return false;
}

/**
 * Check if a call result is being stored
 */
function isCallResultStored(node: TSESTree.CallExpression): {
    stored: boolean;
    fieldName?: string;
} {
    const parent = node.parent;

    // Check for assignment to this.field
    if (parent?.type === 'AssignmentExpression' && parent.left.type === 'MemberExpression') {
        if (
            parent.left.object.type === 'ThisExpression' &&
            parent.left.property.type === 'Identifier'
        ) {
            return { stored: true, fieldName: parent.left.property.name };
        }
    }

    // Check for variable declaration
    if (parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        return { stored: true, fieldName: parent.id.name };
    }

    // Check for property in object pattern (destructuring)
    if (parent?.type === 'Property') {
        return { stored: true };
    }

    return { stored: false };
}

/**
 * Check if a class implements EnginePlugin
 */
function isPluginClass(node: TSESTree.ClassDeclaration, pluginPattern: RegExp): boolean {
    if (!node.id) return false;

    // Check pattern match
    if (pluginPattern.test(node.id.name)) {
        return true;
    }

    // Check implements clause
    if (node.implements) {
        for (const impl of node.implements) {
            if (impl.expression.type === 'Identifier') {
                if (impl.expression.name === 'EnginePlugin') {
                    return true;
                }
            }
        }
    }

    return false;
}

/**
 * Walk all nodes in a tree
 */
function walkNode(node: TSESTree.Node, callback: (node: TSESTree.Node) => void): void {
    callback(node);

    for (const key of Object.keys(node)) {
        if (key === 'parent') continue;

        const child = (node as Record<string, unknown>)[key];
        if (child && typeof child === 'object') {
            if (Array.isArray(child)) {
                for (const item of child) {
                    if (item && typeof item === 'object' && 'type' in item) {
                        walkNode(item as TSESTree.Node, callback);
                    }
                }
            } else if ('type' in child) {
                walkNode(child as TSESTree.Node, callback);
            }
        }
    }
}

/**
 * Find fields accessed in uninstall method
 */
function findCleanedUpFieldsInUninstall(classNode: TSESTree.ClassDeclaration): Set<string> {
    const cleanedFields = new Set<string>();

    for (const member of classNode.body.body) {
        if (
            member.type === 'MethodDefinition' &&
            member.key.type === 'Identifier' &&
            member.key.name === 'uninstall'
        ) {
            // Walk the method body to find this.field() or this.field?.() calls
            const body = (member.value as TSESTree.FunctionExpression).body;
            if (body) {
                walkNode(body, (node) => {
                    // Look for this.field() or this.field?.()
                    if (node.type === 'CallExpression') {
                        let callee = node.callee;

                        // Handle optional chaining
                        if (callee.type === 'ChainExpression') {
                            callee = callee.expression;
                        }

                        if (callee.type === 'MemberExpression') {
                            if (
                                callee.object.type === 'ThisExpression' &&
                                callee.property.type === 'Identifier'
                            ) {
                                cleanedFields.add(callee.property.name);
                            }
                        }
                    }

                    // Look for this.field?.unsubscribe()
                    if (
                        node.type === 'MemberExpression' &&
                        node.object.type === 'ThisExpression' &&
                        node.property.type === 'Identifier'
                    ) {
                        // Check if parent is a call or member access to unsubscribe
                        const parent = node.parent;
                        if (parent?.type === 'MemberExpression') {
                            cleanedFields.add(node.property.name);
                        }
                    }
                });
            }
            break;
        }
    }

    return cleanedFields;
}

/**
 * Check if class has uninstall method
 */
function hasUninstallMethod(classNode: TSESTree.ClassDeclaration): boolean {
    for (const member of classNode.body.body) {
        if (
            member.type === 'MethodDefinition' &&
            member.key.type === 'Identifier' &&
            member.key.name === 'uninstall'
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Get the enclosing class
 */
function getEnclosingClass(node: TSESTree.Node): TSESTree.ClassDeclaration | null {
    let current: TSESTree.Node | undefined = node.parent;

    while (current) {
        if (current.type === 'ClassDeclaration') {
            return current;
        }
        current = current.parent;
    }

    return null;
}

/**
 * Rule: subscription-cleanup-required
 *
 * Ensures that event subscriptions in plugin classes are properly stored
 * and cleaned up in the uninstall method. This prevents memory leaks.
 */
export const subscriptionCleanupRequired = createRule<Options, MessageIds>({
    name: 'subscription-cleanup-required',
    meta: {
        type: 'problem',
        docs: {
            description:
                'Require event subscriptions in plugins to be stored and cleaned up in uninstall',
        },
        messages: {
            subscriptionNotStored:
                'Subscription from "{{methodName}}" is not stored. Store the unsubscribe function to clean it up in uninstall().',
            subscriptionNotCleanedUp:
                'Subscription stored in "{{fieldName}}" is not cleaned up in uninstall(). Call "this.{{fieldName}}?.()" or "this.{{fieldName}}?.unsubscribe()" in uninstall().',
            missingUninstallMethod:
                'Plugin class "{{className}}" has subscriptions but no uninstall() method. Add an uninstall() method to clean up subscriptions.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    pluginPattern: {
                        type: 'string',
                        description: 'Regex pattern to identify plugin classes',
                    },
                    subscriptionMethods: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Additional subscription method names',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            pluginPattern: 'Plugin$',
            subscriptionMethods: [],
        },
    ],
    create(context, [options]) {
        const pluginPattern = new RegExp(options.pluginPattern || 'Plugin$');

        // Subscription methods that return unsubscribe functions
        const subscriptionMethods = new Set([
            'on', // context.on, engine.on
            'subscribe', // messageBus.subscribe
            'addEventListener',
            ...(options.subscriptionMethods || []),
        ]);

        // Track plugins in this file
        const plugins = new Map<string, PluginInfo>();

        return {
            ClassDeclaration(node) {
                if (!isPluginClass(node, pluginPattern) || !node.id) return;

                plugins.set(node.id.name, {
                    className: node.id.name,
                    classNode: node,
                    subscriptions: [],
                    hasUninstall: hasUninstallMethod(node),
                    cleanedUpFields: findCleanedUpFieldsInUninstall(node),
                });
            },

            CallExpression(node) {
                if (node.callee.type !== 'MemberExpression') return;
                if (node.callee.property.type !== 'Identifier') return;

                const methodName = node.callee.property.name;

                if (!subscriptionMethods.has(methodName)) return;
                if (!isInsideInstallMethod(node)) return;

                const enclosingClass = getEnclosingClass(node);
                if (!enclosingClass || !enclosingClass.id) return;

                const plugin = plugins.get(enclosingClass.id.name);
                if (!plugin) return;

                const { stored, fieldName } = isCallResultStored(node);

                plugin.subscriptions.push({
                    node,
                    methodName,
                    isStored: stored,
                    storedFieldName: fieldName,
                });
            },

            'Program:exit'() {
                for (const plugin of plugins.values()) {
                    if (plugin.subscriptions.length === 0) continue;

                    // Check for missing uninstall method
                    if (!plugin.hasUninstall) {
                        context.report({
                            node: plugin.classNode,
                            messageId: 'missingUninstallMethod',
                            data: { className: plugin.className },
                        });
                        continue;
                    }

                    // Check each subscription
                    for (const sub of plugin.subscriptions) {
                        if (!sub.isStored) {
                            context.report({
                                node: sub.node,
                                messageId: 'subscriptionNotStored',
                                data: { methodName: sub.methodName },
                            });
                        } else if (
                            sub.storedFieldName &&
                            !plugin.cleanedUpFields.has(sub.storedFieldName)
                        ) {
                            context.report({
                                node: sub.node,
                                messageId: 'subscriptionNotCleanedUp',
                                data: { fieldName: sub.storedFieldName },
                            });
                        }
                    }
                }
            },
        };
    },
});

export default subscriptionCleanupRequired;
