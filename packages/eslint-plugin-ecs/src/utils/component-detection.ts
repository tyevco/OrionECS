import type { TSESTree } from '@typescript-eslint/utils';

/**
 * Utility for detecting component and plugin classes by tracking their usage in ECS APIs.
 *
 * Detects components used in:
 * - entity.addComponent(ClassName, ...)
 * - engine.registerComponent(ClassName)
 * - engine.createSystem('name', { all: [A, B], any: [C], none: [D] }, ...)
 * - Query definitions with component arrays
 *
 * Detects plugins used in:
 * - engine.use(new PluginClass())
 * - new EngineBuilder().use(new PluginClass())
 */

export interface ComponentDetectionResult {
    /** Set of class names detected as components */
    componentClasses: Set<string>;
    /** Map from class name to the node where it was detected */
    componentNodes: Map<string, TSESTree.Node>;
    /** Set of class names detected as plugins */
    pluginClasses: Set<string>;
    /** Map from plugin class name to the node where it was detected */
    pluginNodes: Map<string, TSESTree.Node>;
}

/**
 * Extract component class names from a node that might be a component reference
 */
function extractComponentName(node: TSESTree.Node | undefined): string | null {
    if (!node) return null;

    // Direct identifier: Position
    if (node.type === 'Identifier') {
        return node.name;
    }

    // Member expression: Components.Position
    if (node.type === 'MemberExpression' && node.property.type === 'Identifier') {
        return node.property.name;
    }

    return null;
}

/**
 * Extract class name from a new expression like `new PluginClass()`
 */
function extractClassNameFromNew(node: TSESTree.Node | undefined): string | null {
    if (!node) return null;

    // new PluginClass() or new PluginClass(args)
    if (node.type === 'NewExpression') {
        if (node.callee.type === 'Identifier') {
            return node.callee.name;
        }
        // new Plugins.MyPlugin()
        if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier') {
            return node.callee.property.name;
        }
    }

    // Direct identifier reference (rare but possible): engine.use(MyPlugin)
    if (node.type === 'Identifier') {
        return node.name;
    }

    return null;
}

/**
 * Extract component names from an array expression like [Position, Velocity]
 */
function extractComponentsFromArray(
    node: TSESTree.Node | undefined,
    result: ComponentDetectionResult
): void {
    if (!node || node.type !== 'ArrayExpression') return;

    for (const element of node.elements) {
        if (!element) continue;
        const name = extractComponentName(element);
        if (name) {
            result.componentClasses.add(name);
            result.componentNodes.set(name, element);
        }
    }
}

/**
 * Extract components from a query object like { all: [A, B], any: [C], none: [D] }
 */
function extractComponentsFromQueryObject(
    node: TSESTree.Node | undefined,
    result: ComponentDetectionResult
): void {
    if (!node || node.type !== 'ObjectExpression') return;

    for (const prop of node.properties) {
        if (prop.type !== 'Property') continue;
        if (prop.key.type !== 'Identifier') continue;

        const keyName = prop.key.name;
        // Check for query properties: all, any, none, with, without
        if (['all', 'any', 'none', 'with', 'without'].includes(keyName)) {
            extractComponentsFromArray(prop.value, result);
        }
    }
}

/**
 * Check if a call expression is a component-related API call and extract component names
 */
export function detectComponentsFromCall(
    node: TSESTree.CallExpression,
    result: ComponentDetectionResult
): void {
    const callee = node.callee;

    if (callee.type !== 'MemberExpression') return;
    if (callee.property.type !== 'Identifier') return;

    const methodName = callee.property.name;

    switch (methodName) {
        // entity.addComponent(ClassName, ...args)
        // entity.getComponent(ClassName)
        // entity.hasComponent(ClassName)
        // entity.removeComponent(ClassName)
        case 'addComponent':
        case 'getComponent':
        case 'hasComponent':
        case 'removeComponent': {
            const componentArg = node.arguments[0];
            const name = extractComponentName(componentArg);
            if (name) {
                result.componentClasses.add(name);
                result.componentNodes.set(name, componentArg);
            }
            break;
        }

        // engine.registerComponent(ClassName)
        // engine.registerComponentPool(ClassName, options)
        case 'registerComponent':
        case 'registerComponentPool': {
            const componentArg = node.arguments[0];
            const name = extractComponentName(componentArg);
            if (name) {
                result.componentClasses.add(name);
                result.componentNodes.set(name, componentArg);
            }
            break;
        }

        // engine.createSystem('name', { all: [...], any: [...], none: [...] }, options)
        case 'createSystem': {
            const queryArg = node.arguments[1];
            extractComponentsFromQueryObject(queryArg, result);
            break;
        }

        // engine.createQuery({ all: [...] }) or query().withAll(...).build()
        case 'createQuery': {
            const queryArg = node.arguments[0];
            extractComponentsFromQueryObject(queryArg, result);
            break;
        }

        // Fluent query builder: query.withAll(A, B), query.withAny(C), query.withNone(D)
        case 'withAll':
        case 'withAny':
        case 'withNone': {
            for (const arg of node.arguments) {
                const name = extractComponentName(arg);
                if (name) {
                    result.componentClasses.add(name);
                    result.componentNodes.set(name, arg);
                }
            }
            break;
        }

        // engine.registerComponentValidator(ClassName, validator)
        case 'registerComponentValidator': {
            const componentArg = node.arguments[0];
            const name = extractComponentName(componentArg);
            if (name) {
                result.componentClasses.add(name);
                result.componentNodes.set(name, componentArg);
            }
            break;
        }

        // Singleton components: engine.setSingleton(ClassName, ...args)
        case 'setSingleton':
        case 'getSingleton':
        case 'hasSingleton':
        case 'removeSingleton': {
            const componentArg = node.arguments[0];
            const name = extractComponentName(componentArg);
            if (name) {
                result.componentClasses.add(name);
                result.componentNodes.set(name, componentArg);
            }
            break;
        }

        // Plugin registration: engine.use(new PluginClass()) or builder.use(new PluginClass())
        case 'use': {
            const pluginArg = node.arguments[0];
            const name = extractClassNameFromNew(pluginArg);
            if (name) {
                result.pluginClasses.add(name);
                result.pluginNodes.set(name, pluginArg);
            }
            break;
        }
    }
}

/**
 * Create a fresh detection result
 */
export function createDetectionResult(): ComponentDetectionResult {
    return {
        componentClasses: new Set(),
        componentNodes: new Map(),
        pluginClasses: new Set(),
        pluginNodes: new Map(),
    };
}

/**
 * Find a class declaration by name in the current scope
 */
export function findClassDeclaration(
    programBody: TSESTree.Statement[],
    className: string
): TSESTree.ClassDeclaration | null {
    for (const statement of programBody) {
        if (statement.type === 'ClassDeclaration' && statement.id?.name === className) {
            return statement;
        }
        // Also check for exported classes
        if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
            if (
                statement.declaration.type === 'ClassDeclaration' &&
                statement.declaration.id?.name === className
            ) {
                return statement.declaration;
            }
        }
    }
    return null;
}
