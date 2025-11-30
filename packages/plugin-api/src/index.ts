/**
 * OrionECS Plugin API
 *
 * Lightweight package for plugin authors to implement OrionECS plugins.
 * This package provides the interfaces and types needed to create plugins
 * without requiring the full core engine as a dependency.
 *
 * @packageDocumentation
 * @module PluginAPI
 */

// =============================================================================
// Logging Types
// =============================================================================

/**
 * Log level for filtering log output.
 *
 * @public
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger interface for structured logging with automatic sanitization.
 *
 * The logger provides a centralized, secure logging mechanism that:
 * - Automatically sanitizes user-controlled input to prevent log injection attacks
 * - Supports structured logging with tags/namespaces
 * - Provides variadic methods for different log levels
 *
 * @remarks
 * All string arguments passed to the logger are automatically sanitized to remove:
 * - ANSI escape sequences (terminal manipulation prevention)
 * - Control characters (0x00-0x1F and 0x7F)
 *
 * @example
 * ```typescript
 * class MyPlugin implements EnginePlugin {
 *   install(context: PluginContext): void {
 *     const logger = context.logger.withTag('MyPlugin');
 *
 *     logger.debug('Plugin initializing...');
 *     logger.info('Connected to server:', serverName);
 *     logger.warn('Connection slow, latency:', latencyMs, 'ms');
 *     logger.error('Failed to connect:', error);
 *   }
 * }
 * ```
 *
 * @public
 */
export interface Logger {
    /**
     * Log a debug message (only visible when debug mode is enabled).
     *
     * @param args - Values to log (strings are automatically sanitized)
     */
    debug(...args: unknown[]): void;

    /**
     * Log an informational message.
     *
     * @param args - Values to log (strings are automatically sanitized)
     */
    info(...args: unknown[]): void;

    /**
     * Log a warning message.
     *
     * @param args - Values to log (strings are automatically sanitized)
     */
    warn(...args: unknown[]): void;

    /**
     * Log an error message.
     *
     * @param args - Values to log (strings are automatically sanitized)
     */
    error(...args: unknown[]): void;

    /**
     * Create a new logger instance with a tag prefix.
     *
     * Tags help identify the source of log messages, making it easier
     * to filter and debug specific components.
     *
     * @param tag - Tag to prefix log messages with (e.g., plugin name)
     * @returns A new Logger instance with the tag applied
     *
     * @example
     * ```typescript
     * const logger = context.logger.withTag('NetworkPlugin');
     * logger.info('Connected'); // Output: [NetworkPlugin] Connected
     * ```
     */
    withTag(tag: string): Logger;

    /**
     * Check if a log level is enabled.
     *
     * Useful for avoiding expensive string operations when the log
     * level is disabled.
     *
     * @param level - The log level to check
     * @returns True if the log level is enabled
     *
     * @example
     * ```typescript
     * if (logger.isEnabled('debug')) {
     *   logger.debug('Expensive computation:', computeDebugInfo());
     * }
     * ```
     */
    isEnabled(level: LogLevel): boolean;
}

/**
 * A log entry containing all information about a single log message.
 *
 * Used by log providers to receive structured log data from the engine.
 *
 * @public
 */
export interface LogEntry {
    /** The log level (debug, info, warn, error) */
    level: LogLevel;
    /** The log message arguments (already sanitized) */
    args: unknown[];
    /** Optional tag/namespace for the log message */
    tag?: string;
    /** Timestamp when the log entry was created */
    timestamp: number;
}

/**
 * Interface for log providers that handle log output.
 *
 * Log providers are responsible for writing log entries to their destination,
 * whether that's the console, a file, a remote service, or memory for testing.
 * Implement this interface to create custom logging destinations.
 *
 * @example Console provider
 * ```typescript
 * class ConsoleLogProvider implements LogProvider {
 *   write(entry: LogEntry): void {
 *     const prefix = entry.tag ? `[${entry.tag}]` : '[ECS]';
 *     switch (entry.level) {
 *       case 'debug':
 *       case 'info':
 *         console.log(prefix, ...entry.args);
 *         break;
 *       case 'warn':
 *         console.warn(prefix, ...entry.args);
 *         break;
 *       case 'error':
 *         console.error(prefix, ...entry.args);
 *         break;
 *     }
 *   }
 * }
 * ```
 *
 * @example Memory provider for testing
 * ```typescript
 * class MemoryLogProvider implements LogProvider {
 *   readonly entries: LogEntry[] = [];
 *
 *   write(entry: LogEntry): void {
 *     this.entries.push(entry);
 *   }
 *
 *   clear(): void {
 *     this.entries.length = 0;
 *   }
 * }
 * ```
 *
 * @example Remote error tracking provider
 * ```typescript
 * class SentryLogProvider implements LogProvider {
 *   write(entry: LogEntry): void {
 *     if (entry.level === 'error') {
 *       Sentry.captureMessage(entry.args.join(' '), {
 *         level: 'error',
 *         tags: { source: entry.tag }
 *       });
 *     }
 *   }
 *
 *   flush(): Promise<void> {
 *     return Sentry.flush(2000);
 *   }
 * }
 * ```
 *
 * @public
 */
export interface LogProvider {
    /**
     * Write a log entry to the provider's destination.
     *
     * This method should handle errors gracefully - a failing provider
     * should not crash the engine or prevent other providers from receiving logs.
     *
     * @param entry - The log entry to write
     */
    write(entry: LogEntry): void;

    /**
     * Optional method to flush any buffered log entries.
     *
     * Called when the engine wants to ensure all logs are written,
     * such as before shutdown or error reporting.
     */
    flush?(): void | Promise<void>;

    /**
     * Optional method to clean up resources when the provider is removed.
     *
     * Called when the provider is unregistered or when the engine is destroyed.
     */
    dispose?(): void | Promise<void>;
}

// =============================================================================
// Entity Types
// =============================================================================

/**
 * Serialized entity data for snapshots and persistence.
 *
 * @public
 */
export interface SerializedEntity {
    id: string;
    name?: string;
    tags: string[];
    components: Array<{ type: string; data: any }>;
    children: SerializedEntity[];
}

/**
 * Entity interface representing a game object in the ECS.
 *
 * Entities are containers for components and can form hierarchies.
 * They support tagging for categorization and querying.
 *
 * @public
 */
export interface EntityDef {
    /** Unique identifier for this entity */
    id: symbol;
    /** Optional human-readable name */
    name?: string;
    /** Parent entity in the hierarchy */
    parent?: EntityDef;
    /** Child entities */
    children: EntityDef[];
    /** Tags for categorization and querying */
    tags: Set<string>;
    /** Queue this entity for deletion at end of frame */
    queueFree(): void;
    /** Add a component to this entity */
    addComponent<T>(
        type: new (...args: any[]) => T,
        ...args: ConstructorParameters<typeof type>
    ): this;
    /** Remove a component from this entity */
    removeComponent<T>(type: new (...args: any[]) => T): this;
    /** Check if entity has a component */
    hasComponent<T>(type: new (...args: any[]) => T): boolean;
    /** Get a component from this entity */
    getComponent<T>(type: new (...args: any[]) => T): T;
    /** Add a tag to this entity */
    addTag(tag: string): this;
    /** Remove a tag from this entity */
    removeTag(tag: string): this;
    /** Check if entity has a tag */
    hasTag(tag: string): boolean;
    /** Set the parent entity */
    setParent(parent: EntityDef | null): this;
    /** Add a child entity */
    addChild(child: EntityDef): this;
    /** Remove a child entity */
    removeChild(child: EntityDef): this;
    /** Whether this entity has pending changes */
    get isDirty(): boolean;
    /** Whether this entity is queued for deletion */
    get isMarkedForDeletion(): boolean;
    /** Serialize this entity to a plain object */
    serialize(): SerializedEntity;
}

// =============================================================================
// Performance Monitoring Types
// =============================================================================

/**
 * Performance profile data for a system.
 *
 * Contains timing and execution statistics collected during system execution.
 * Used by profiling and debugging tools to analyze performance.
 *
 * @public
 */
export interface SystemProfile {
    /** System name */
    name: string;
    /** Total execution time in milliseconds */
    executionTime: number;
    /** Number of entities processed in the last execution */
    entityCount: number;
    /** Total number of times this system has been called */
    callCount: number;
    /** Average execution time per call in milliseconds */
    averageTime: number;
}

// =============================================================================
// Component Types (simplified for plugin authors)
// =============================================================================

/**
 * Identifies a component type. Can be a class constructor or any unique identifier.
 * Plugin authors typically use their own component classes here.
 *
 * @typeParam T - The component instance type
 *
 * @example
 * ```typescript
 * class Position {
 *   constructor(public x: number = 0, public y: number = 0) {}
 * }
 *
 * // Position is a ComponentIdentifier<Position>
 * context.registerComponent(Position);
 * ```
 *
 * @public
 */
export type ComponentIdentifier<T = unknown> = new (...args: any[]) => T;

/**
 * Component validator for runtime validation of component data.
 *
 * @typeParam T - The component type being validated
 *
 * @public
 */
export interface ComponentValidator<T = unknown> {
    /** Validate the component, returning true or an error message */
    validate(component: T): boolean | string;
    /** Other components that must be present on the entity */
    dependencies?: ComponentIdentifier[];
    /** Components that cannot coexist with this one */
    conflicts?: ComponentIdentifier[];
}

// =============================================================================
// System Types (simplified for plugin authors)
// =============================================================================

/**
 * Options for creating a query to match entities.
 *
 * @public
 */
export interface QueryOptions<
    All extends readonly ComponentIdentifier[] = readonly ComponentIdentifier[],
> {
    /** Components the entity must have (AND condition) */
    all?: All;
    /** Components where entity must have at least one (OR condition) */
    any?: readonly ComponentIdentifier[];
    /** Components the entity must NOT have */
    none?: readonly ComponentIdentifier[];
    /** Tags the entity must have */
    tags?: readonly string[];
}

/**
 * System configuration options.
 *
 * @public
 */
export interface SystemOptions<TComponents extends any[] = any[]> {
    /** System execution priority (higher = runs first) */
    priority?: number;
    /** System tags for categorization */
    tags?: string[];
    /** Called before system processes entities */
    before?: () => void;
    /** Called for each matching entity */
    act?: (entity: any, ...components: TComponents) => void;
    /** Called after system processes all entities */
    after?: () => void;
    /** Singleton component types to watch for changes */
    watchSingletons?: ComponentIdentifier[];
    /** Called when a watched singleton is set or updated */
    onSingletonSet?: (event: any) => void;
    /** Called when a watched singleton is removed */
    onSingletonRemoved?: (event: any) => void;
}

// =============================================================================
// Prefab Types
// =============================================================================

/**
 * Component definition for prefabs.
 *
 * @public
 */
export interface ComponentDef {
    /** The component class/constructor */
    type: ComponentIdentifier;
    /** Constructor arguments for the component */
    args?: any[];
}

/**
 * Entity prefab definition for creating entities from templates.
 *
 * @public
 */
export interface EntityPrefab {
    /** Unique name for the prefab */
    name: string;
    /** Components to add to entities created from this prefab */
    components?: ComponentDef[];
    /** Tags to add to entities created from this prefab */
    tags?: string[];
    /** Child entity prefabs for hierarchical entities */
    children?: EntityPrefab[];
}

/**
 * Factory function for creating prefabs programmatically.
 *
 * @public
 */
export type EntityPrefabFactory = () => Omit<EntityPrefab, 'name'>;

// =============================================================================
// Message System
// =============================================================================

/**
 * Inter-system message for the message bus.
 *
 * @public
 */
export interface SystemMessage {
    /** Message type identifier */
    type: string;
    /** Message payload data */
    data: any;
    /** Optional sender system name */
    sender?: string;
    /** Message creation timestamp */
    timestamp: number;
}

// =============================================================================
// Plugin Context
// =============================================================================

/**
 * Context object providing sandboxed access to engine features for plugins.
 *
 * The PluginContext is passed to plugins during installation and provides a
 * safe, controlled interface for plugins to interact with the engine without
 * requiring direct access to the Engine instance.
 *
 * @remarks
 * Plugins should use the PluginContext exclusively for engine interaction
 * rather than storing references to the Engine instance. This ensures
 * proper encapsulation and allows the engine to control plugin behavior.
 *
 * @example
 * ```typescript
 * class MyPlugin implements EnginePlugin {
 *   name = 'MyPlugin';
 *
 *   install(context: PluginContext): void {
 *     // Register custom component
 *     context.registerComponent(MyComponent);
 *
 *     // Create a system
 *     context.createSystem('MySystem', {
 *       all: [MyComponent]
 *     }, {
 *       act: (entity, component) => {
 *         // System logic
 *       }
 *     });
 *
 *     // Extend engine API
 *     context.extend('myFeature', {
 *       doSomething: () => { }
 *     });
 *   }
 * }
 * ```
 *
 * @public
 */
export interface PluginContext {
    // =========================================================================
    // Component Registration
    // =========================================================================

    /**
     * Register a component type with the engine.
     *
     * @param type - The component class to register
     */
    registerComponent<T>(type: ComponentIdentifier<T>): void;

    /**
     * Register a validator for a component type.
     *
     * @param type - The component class to validate
     * @param validator - Validation rules for the component
     */
    registerComponentValidator<T>(
        type: ComponentIdentifier<T>,
        validator: ComponentValidator<T>
    ): void;

    // =========================================================================
    // Singleton Components
    // =========================================================================

    /**
     * Set a singleton component (global state not tied to entities).
     *
     * @param type - The singleton component class
     * @param args - Constructor arguments
     * @returns The created singleton instance
     */
    setSingleton<T>(type: ComponentIdentifier<T>, ...args: any[]): T;

    /**
     * Get a singleton component.
     *
     * @param type - The singleton component class
     * @returns The singleton instance or undefined
     */
    getSingleton<T>(type: ComponentIdentifier<T>): T | undefined;

    /**
     * Check if a singleton component exists.
     *
     * @param type - The singleton component class
     */
    hasSingleton<T>(type: ComponentIdentifier<T>): boolean;

    /**
     * Remove a singleton component.
     *
     * @param type - The singleton component class
     * @returns The removed singleton or undefined
     */
    removeSingleton<T>(type: ComponentIdentifier<T>): T | undefined;

    // =========================================================================
    // System Creation
    // =========================================================================

    /**
     * Create a new system that processes entities matching the query.
     *
     * @param name - Unique system name
     * @param queryOptions - Entity matching criteria
     * @param options - System configuration
     * @param isFixedUpdate - If true, runs at fixed timestep
     * @returns The created system
     */
    createSystem<All extends readonly ComponentIdentifier[]>(
        name: string,
        queryOptions: QueryOptions<All>,
        options: SystemOptions,
        isFixedUpdate?: boolean
    ): any;

    // =========================================================================
    // Query Creation
    // =========================================================================

    /**
     * Create a query for matching entities.
     *
     * @param options - Query criteria
     * @returns The created query
     */
    createQuery<All extends readonly ComponentIdentifier[]>(options: QueryOptions<All>): any;

    // =========================================================================
    // Prefab Management
    // =========================================================================

    /**
     * Register an entity prefab template.
     *
     * @param name - Unique prefab name
     * @param prefab - Prefab definition
     */
    registerPrefab(name: string, prefab: EntityPrefab): void;

    /**
     * Define a prefab using a factory function.
     *
     * @param name - Unique prefab name
     * @param factory - Factory function that returns prefab definition
     * @returns The created prefab
     */
    definePrefab(name: string, factory: EntityPrefabFactory): EntityPrefab;

    /**
     * Create a new prefab by extending an existing one.
     *
     * @param baseName - Name of the prefab to extend
     * @param overrides - Properties to override
     * @param newName - Optional name for the new prefab
     * @returns The extended prefab
     */
    extendPrefab(
        baseName: string,
        overrides: Partial<EntityPrefab>,
        newName?: string
    ): EntityPrefab;

    /**
     * Create a variant of an existing prefab with component overrides.
     *
     * @param baseName - Name of the base prefab
     * @param overrides - Component, tag, and children overrides
     * @param newName - Optional name for the variant
     * @returns The variant prefab
     */
    variantOfPrefab(
        baseName: string,
        overrides: {
            components?: { [componentName: string]: any };
            tags?: string[];
            children?: EntityPrefab[];
        },
        newName?: string
    ): EntityPrefab;

    // =========================================================================
    // Event System
    // =========================================================================

    /**
     * Subscribe to an engine event.
     *
     * @param event - Event name
     * @param callback - Handler function
     * @returns Unsubscribe function
     */
    on(event: string, callback: (...args: any[]) => void): () => void;

    /**
     * Emit an engine event.
     *
     * @param event - Event name
     * @param args - Event arguments
     */
    emit(event: string, ...args: any[]): void;

    // =========================================================================
    // Message Bus
    // =========================================================================

    /**
     * Inter-system messaging bus for decoupled communication.
     */
    messageBus: {
        /**
         * Subscribe to a message type.
         *
         * @param messageType - Message type to subscribe to
         * @param callback - Handler for received messages
         * @returns Unsubscribe function
         */
        subscribe(messageType: string, callback: (message: SystemMessage) => void): () => void;

        /**
         * Publish a message.
         *
         * @param messageType - Message type
         * @param data - Message payload
         * @param sender - Optional sender identifier
         */
        publish(messageType: string, data: any, sender?: string): void;
    };

    // =========================================================================
    // Engine Extension
    // =========================================================================

    /**
     * Extend the engine with a custom API.
     *
     * The API will be accessible as a property on the engine instance.
     * Use the TExtensions generic on EnginePlugin to get type-safe access.
     *
     * @param extensionName - Property name for the extension
     * @param api - The API object to add
     *
     * @example
     * ```typescript
     * context.extend('physics', {
     *   setGravity: (x, y) => { ... },
     *   applyForce: (entity, force) => { ... }
     * });
     *
     * // Later: engine.physics.setGravity(0, 9.8)
     * ```
     */
    extend<T extends object>(extensionName: string, api: T): void;

    // =========================================================================
    // Logging
    // =========================================================================

    /**
     * Logger instance for secure, structured logging.
     *
     * The logger automatically sanitizes string arguments to prevent log injection
     * attacks. Use `logger.withTag()` to create a tagged logger for your plugin.
     *
     * @example
     * ```typescript
     * class MyPlugin implements EnginePlugin {
     *   install(context: PluginContext): void {
     *     const logger = context.logger.withTag('MyPlugin');
     *     logger.info('Plugin initialized');
     *     logger.debug('Debug details:', someValue);
     *   }
     * }
     * ```
     */
    logger: Logger;

    // =========================================================================
    // Advanced
    // =========================================================================

    /**
     * Get the engine instance for advanced use cases.
     *
     * @remarks
     * Prefer using the PluginContext methods over direct engine access
     * when possible. Direct engine access should only be used for
     * functionality not exposed through the context.
     *
     * @returns The engine instance
     */
    getEngine(): any;
}

// =============================================================================
// Plugin Interface
// =============================================================================

/**
 * Type helper to extract the extension type from a plugin.
 * Used internally by EngineBuilder to accumulate plugin types.
 *
 * @typeParam TPlugin - The plugin type to extract extensions from
 *
 * @example
 * ```typescript
 * type PhysicsExt = ExtractPluginExtensions<PhysicsPlugin>;
 * // Result: { physics: PhysicsAPI }
 * ```
 *
 * @public
 */
export type ExtractPluginExtensions<TPlugin> = TPlugin extends EnginePlugin<infer E> ? E : object;

/**
 * Interface for creating plugins that extend the OrionECS engine.
 *
 * Plugins provide a clean way to add functionality to the engine without modifying
 * core code. They can register components, create systems, extend the engine API,
 * and integrate with external libraries.
 *
 * @typeParam TExtensions - Object type describing the APIs this plugin adds to the engine.
 *   Each key becomes a property on the engine instance after the plugin is installed.
 *
 * @remarks
 * Plugins are registered during engine construction using `EngineBuilder.use()`.
 * The install() method is called once during engine build, and the optional
 * uninstall() method is called if the plugin needs cleanup.
 *
 * When a plugin uses `context.extend()` to add APIs, it should declare those
 * types in the TExtensions generic parameter for full TypeScript intellisense support.
 *
 * @example Basic Plugin (no extensions)
 * ```typescript
 * class LoggingPlugin implements EnginePlugin {
 *   name = 'LoggingPlugin';
 *   version = '1.0.0';
 *
 *   install(context: PluginContext): void {
 *     context.on('onEntityCreated', (entity) => {
 *       console.log(`Entity created: ${entity.name}`);
 *     });
 *   }
 * }
 * ```
 *
 * @example Plugin with Type Extensions
 * ```typescript
 * interface PhysicsAPI {
 *   applyForce: (entity: Entity, force: Vector2) => void;
 *   setGravity: (x: number, y: number) => void;
 * }
 *
 * class PhysicsPlugin implements EnginePlugin<{ physics: PhysicsAPI }> {
 *   name = 'PhysicsPlugin';
 *   version = '2.0.0';
 *
 *   // Type brand for compile-time type inference
 *   declare readonly __extensions: { physics: PhysicsAPI };
 *
 *   install(context: PluginContext): void {
 *     context.extend('physics', {
 *       applyForce: (entity, force) => { ... },
 *       setGravity: (x, y) => { ... }
 *     });
 *   }
 * }
 *
 * // Full intellisense when building!
 * const engine = new EngineBuilder()
 *   .use(new PhysicsPlugin())
 *   .build();
 *
 * engine.physics.setGravity(0, 9.8);  // TypeScript knows this exists
 * ```
 *
 * @public
 */
export interface EnginePlugin<TExtensions extends object = object> {
    /**
     * Unique name identifying this plugin.
     * Used to prevent duplicate installations.
     */
    name: string;

    /**
     * Optional semantic version string (e.g., "1.0.0").
     * Useful for debugging and dependency management.
     */
    version?: string;

    /**
     * Type brand for compile-time type inference.
     *
     * This property is never actually set at runtime - it exists only to carry
     * the TExtensions type for TypeScript's type inference system.
     *
     * @remarks
     * Use `declare readonly __extensions: TExtensions;` in your plugin class
     * to enable type inference without runtime overhead.
     *
     * @internal
     */
    readonly __extensions?: TExtensions;

    /**
     * Called during engine construction to install the plugin.
     *
     * This method receives a PluginContext for safe engine interaction.
     * Can be async if the plugin needs to load external resources.
     *
     * @param context - Sandboxed context for engine interaction
     */
    install(context: PluginContext): void | Promise<void>;

    /**
     * Optional cleanup method called when the plugin is uninstalled.
     *
     * Use this to remove event listeners, clean up resources, or
     * perform other teardown operations.
     */
    uninstall?(): void | Promise<void>;
}

/**
 * Information about an installed plugin.
 *
 * @public
 */
export interface InstalledPlugin {
    /** The plugin instance */
    plugin: EnginePlugin;
    /** Timestamp when the plugin was installed */
    installedAt: number;
}
