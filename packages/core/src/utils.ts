/**
 * Utility functions for OrionECS
 */

import type { ComponentIdentifier, StrictComponentClass } from './definitions';

/**
 * Define a component class with typed constructor parameters.
 *
 * This utility helps create component classes that have proper TypeScript
 * inference for constructor parameters while still working with the ECS
 * `addComponent` method.
 *
 * @typeParam Props - Object type defining the component's properties
 * @param name - The component class name
 * @param defaultProps - Default values for all properties
 * @returns A component class with typed constructor
 *
 * @example
 * ```typescript
 * // Define a component with typed properties
 * const Health = defineComponent('Health', {
 *   current: 100,
 *   max: 100,
 *   regenRate: 1,
 *   isInvulnerable: false
 * });
 *
 * // Full type inference when adding
 * entity.addComponent(Health, {
 *   current: 50,
 *   max: 100
 * });
 *
 * // Access with full typing
 * const health = entity.getComponent(Health);
 * health.current; // number
 * health.isInvulnerable; // boolean
 * ```
 *
 * @public
 */
export function defineComponent<Props extends Record<string, unknown>>(
    name: string,
    defaultProps: Props
): StrictComponentClass<Props, [Partial<Props>?]> {
    const ComponentClass = class {
        constructor(props?: Partial<Props>) {
            Object.assign(this, defaultProps);
            if (props) {
                Object.assign(this, props);
            }
        }
    } as unknown as StrictComponentClass<Props, [Partial<Props>?]>;

    Object.defineProperty(ComponentClass, 'name', {
        value: name,
        writable: false,
        configurable: true,
    });

    return ComponentClass;
}

/**
 * Deep clone a component object, properly handling edge cases that JSON.parse(JSON.stringify())
 * misses such as Date objects, undefined values, and nested objects.
 *
 * This function uses structuredClone when available (modern environments) and falls back
 * to a manual implementation for older environments.
 *
 * Limitations (by design for component data):
 * - Functions are not cloned (components should be data-only)
 * - Symbols are not cloned (use numeric/string identifiers instead)
 * - Circular references are detected and handled
 *
 * @param obj - The object to clone
 * @param visited - Internal tracking for circular references
 * @returns A deep copy of the object
 *
 * @example
 * ```typescript
 * const position = { x: 10, y: 20, metadata: { created: new Date() } };
 * const cloned = deepCloneComponent(position);
 * // cloned.metadata.created is a new Date instance
 * ```
 *
 * @public
 */
export function deepCloneComponent<T>(obj: T, visited = new WeakMap()): T {
    // Handle primitives and null
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Handle circular references
    if (visited.has(obj as object)) {
        return visited.get(obj as object);
    }

    // Try structuredClone first (available in Node.js 17+ and modern browsers)
    // This handles Date, Map, Set, ArrayBuffer, TypedArrays, etc.
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(obj);
        } catch {
            // Fall through to manual implementation if structuredClone fails
            // (e.g., for objects with functions or symbols)
        }
    }

    // Handle Date
    if (obj instanceof Date) {
        return new Date(obj.getTime()) as T;
    }

    // Handle RegExp
    if (obj instanceof RegExp) {
        return new RegExp(obj.source, obj.flags) as T;
    }

    // Handle Map
    if (obj instanceof Map) {
        const clone = new Map();
        visited.set(obj, clone);
        for (const [key, value] of obj) {
            clone.set(deepCloneComponent(key, visited), deepCloneComponent(value, visited));
        }
        return clone as T;
    }

    // Handle Set
    if (obj instanceof Set) {
        const clone = new Set();
        visited.set(obj, clone);
        for (const value of obj) {
            clone.add(deepCloneComponent(value, visited));
        }
        return clone as T;
    }

    // Handle TypedArrays
    if (ArrayBuffer.isView(obj) && !(obj instanceof DataView)) {
        const TypedArrayConstructor = obj.constructor as new (buffer: ArrayBuffer) => T;
        return new TypedArrayConstructor(
            (obj as unknown as { buffer: ArrayBuffer }).buffer.slice(0)
        ) as T;
    }

    // Handle ArrayBuffer
    if (obj instanceof ArrayBuffer) {
        return obj.slice(0) as T;
    }

    // Handle Array
    if (Array.isArray(obj)) {
        const clone: unknown[] = [];
        visited.set(obj, clone);
        for (let i = 0; i < obj.length; i++) {
            clone[i] = deepCloneComponent(obj[i], visited);
        }
        return clone as T;
    }

    // Handle plain objects
    const clone = Object.create(Object.getPrototypeOf(obj));
    visited.set(obj as object, clone);

    for (const key of Object.keys(obj as object)) {
        const value = (obj as Record<string, unknown>)[key];
        // Skip functions (components should be data-only)
        if (typeof value !== 'function') {
            clone[key] = deepCloneComponent(value, visited);
        }
    }

    return clone;
}

/**
 * Create a tag component class for entity categorization
 * Tag components are marker components with no data, used for filtering entities in queries
 *
 * @param name - The name of the tag component
 * @returns A component class that can be used with entity.addComponent()
 *
 * @example
 * ```typescript
 * const PlayerTag = createTagComponent('Player');
 * const EnemyTag = createTagComponent('Enemy');
 *
 * const entity = engine.createEntity();
 * entity.addComponent(PlayerTag);
 * entity.addComponent(EnemyTag);
 *
 * // Use in queries
 * engine.createSystem('PlayerSystem',
 *   { all: [PlayerTag] },
 *   { act: (entity) => { // Only processes entities with PlayerTag } }
 * );
 * ```
 */
export function createTagComponent(name: string): ComponentIdentifier<any> {
    // Create a unique class for this tag
    // Using class expression with a computed name
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Tag components are marker classes by design
    const TagClass = {
        // biome-ignore lint/complexity/noStaticOnlyClass: Tag components are marker classes by design
        [name]: class {
            static readonly __tagName = name;
        },
    }[name];

    // Set the class name for debugging and type checking
    Object.defineProperty(TagClass, 'name', {
        value: name,
        writable: false,
        configurable: true,
    });

    return TagClass as ComponentIdentifier<any>;
}
