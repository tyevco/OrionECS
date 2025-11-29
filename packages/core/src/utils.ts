/**
 * Utility functions for OrionECS
 */

import type { ComponentIdentifier, StrictComponentClass } from './definitions';

/**
 * Type helper to extract writable properties from a type.
 * Excludes methods and readonly properties.
 * @internal
 */
type WritableProps<T> = {
    [K in keyof T as T[K] extends (...args: unknown[]) => unknown ? never : K]: T[K];
};

/**
 * Type helper to make all properties optional for building.
 * @internal
 */
type PartialProps<T> = Partial<WritableProps<T>>;

/**
 * Builder class for type-safe component initialization.
 *
 * ComponentBuilder provides a fluent API for constructing component instances
 * with full TypeScript type inference. This is especially useful for components
 * with many optional properties or complex initialization requirements.
 *
 * @typeParam T - The component instance type being built
 *
 * @example Basic usage
 * ```typescript
 * class Position {
 *   x: number = 0;
 *   y: number = 0;
 *   z: number = 0;
 * }
 *
 * // Using ComponentBuilder for type-safe initialization
 * const position = ComponentBuilder.for(Position)
 *   .set('x', 100)
 *   .set('y', 200)
 *   .build();
 * // position is Position { x: 100, y: 200, z: 0 }
 * ```
 *
 * @example With complex components
 * ```typescript
 * class NetworkedEntity {
 *   ownerId: string = '';
 *   syncRate: number = 60;
 *   interpolation: boolean = true;
 *   authority: 'server' | 'client' = 'server';
 *   lastUpdate: number = 0;
 * }
 *
 * const networked = ComponentBuilder.for(NetworkedEntity)
 *   .set('ownerId', 'player-123')
 *   .set('authority', 'client')
 *   .set('syncRate', 30)
 *   .build();
 * ```
 *
 * @example Adding to entity with builder
 * ```typescript
 * // Direct instantiation then add
 * const health = ComponentBuilder.for(Health)
 *   .set('current', 100)
 *   .set('max', 100)
 *   .build();
 * entity.addComponent(Health, health.current, health.max);
 *
 * // Or use with command buffer
 * engine.commands.entity(entityId)
 *   .addComponent(Health, 100, 100);
 * ```
 *
 * @public
 */
export class ComponentBuilder<T extends object> {
    private props: Partial<T> = {};
    private readonly ComponentClass: new () => T;

    private constructor(ComponentClass: new () => T) {
        this.ComponentClass = ComponentClass;
    }

    /**
     * Create a new ComponentBuilder for a component class.
     *
     * @typeParam T - The component instance type
     * @param ComponentClass - The component class to build
     * @returns A new ComponentBuilder instance
     */
    static for<T extends object>(ComponentClass: new () => T): ComponentBuilder<T> {
        return new ComponentBuilder(ComponentClass);
    }

    /**
     * Set a property value on the component being built.
     * Provides full type inference for both property names and values.
     *
     * @typeParam K - The property key type
     * @param key - The property name
     * @param value - The property value (must match the property's type)
     * @returns This builder for method chaining
     */
    set<K extends keyof WritableProps<T>>(key: K, value: T[K]): this {
        this.props[key] = value;
        return this;
    }

    /**
     * Set multiple properties at once using an object.
     *
     * @param props - Object containing property key-value pairs
     * @returns This builder for method chaining
     */
    setAll(props: PartialProps<T>): this {
        Object.assign(this.props, props);
        return this;
    }

    /**
     * Build and return the component instance with all configured properties.
     *
     * @returns A new instance of the component with configured properties
     */
    build(): T {
        const instance = new this.ComponentClass();
        Object.assign(instance, this.props);
        return instance;
    }

    /**
     * Reset the builder to start fresh with the same component class.
     *
     * @returns This builder for method chaining
     */
    reset(): this {
        this.props = {};
        return this;
    }
}

/**
 * Factory function to create a type-safe component factory.
 *
 * This creates a reusable factory function that builds component instances
 * with validated properties. Unlike ComponentBuilder which is used once,
 * a factory can be called multiple times with different configurations.
 *
 * @typeParam T - The component instance type
 * @typeParam D - The default properties type
 * @param ComponentClass - The component class
 * @param defaults - Default property values
 * @returns A factory function that creates component instances
 *
 * @example
 * ```typescript
 * class Velocity {
 *   x: number = 0;
 *   y: number = 0;
 *   maxSpeed: number = 100;
 * }
 *
 * // Create a factory with defaults
 * const createVelocity = createComponentFactory(Velocity, {
 *   maxSpeed: 50
 * });
 *
 * // Use the factory
 * const vel1 = createVelocity({ x: 10, y: 20 });
 * // vel1 = { x: 10, y: 20, maxSpeed: 50 }
 *
 * const vel2 = createVelocity({ x: 5 });
 * // vel2 = { x: 5, y: 0, maxSpeed: 50 }
 * ```
 *
 * @public
 */
export function createComponentFactory<T extends object, D extends PartialProps<T>>(
    ComponentClass: new () => T,
    defaults?: D
): (overrides?: PartialProps<T>) => T {
    return (overrides?: PartialProps<T>): T => {
        const instance = new ComponentClass();
        if (defaults) {
            Object.assign(instance, defaults);
        }
        if (overrides) {
            Object.assign(instance, overrides);
        }
        return instance;
    };
}

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
