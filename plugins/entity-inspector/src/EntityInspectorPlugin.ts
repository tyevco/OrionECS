/**
 * Entity Inspector Plugin for OrionECS
 *
 * Provides a web-based debugging interface for real-time visualization
 * and editing of entities, components, and systems. Similar to inspector
 * panels found in Unity and Godot game engines.
 *
 * Features:
 * - WebSocket server for live data streaming
 * - Entity hierarchy visualization
 * - Component property viewing and editing
 * - System execution profiling
 * - Real-time state updates
 * - Pause/resume/step debugging
 *
 * @example
 * ```typescript
 * import { EngineBuilder } from '@orion-ecs/core';
 * import { EntityInspectorPlugin } from '@orion-ecs/entity-inspector';
 *
 * const inspectorPlugin = new EntityInspectorPlugin({
 *   port: 8765,
 *   debug: true
 * });
 *
 * const engine = new EngineBuilder()
 *   .withDebugMode(true)
 *   .use(inspectorPlugin)
 *   .build();
 *
 * // Start the inspector server
 * await engine.inspector.start();
 * console.log(`Inspector running at ${engine.inspector.serverUrl}`);
 *
 * // Open http://localhost:8765 in your browser
 * ```
 */

import type {
    EnginePlugin,
    EntityDef,
    Logger,
    PluginContext,
    SystemProfile,
} from '@orion-ecs/plugin-api';
import type {
    ClientMessage,
    ComponentProperty,
    ConnectionInfo,
    EngineStats,
    EntityInspectorConfig,
    EntityQueryParams,
    IEntityInspectorAPI,
    InspectorEvent,
    ProfilingData,
    PropertyTypeHint,
    QueryInfo,
    SerializedComponent,
    SerializedInspectorEntity,
    ServerMessage,
    SingletonInfo,
    SystemInfo,
    UpdateResult,
} from './types';
import { DEFAULT_INSPECTOR_CONFIG } from './types';

// =============================================================================
// Engine Reference Interface
// =============================================================================

/**
 * Minimal engine interface for the Entity Inspector.
 * Defines the engine methods required for introspection.
 */
interface EngineRef {
    /** Map of entity IDs to entities */
    entities?: Map<symbol, EntityDef>;
    /** Map of system names to systems */
    systems?: Map<string, SystemDef>;
    /** Map of query IDs to queries */
    queries?: Map<string, QueryDef>;
    /** Singleton components */
    singletons?: Map<unknown, unknown>;
    /** Get system performance profiles */
    getSystemProfiles?(): SystemProfile[];
    /** Get memory statistics */
    getMemoryStats?(): {
        totalEntities?: number;
        activeEntities?: number;
        componentArrays?: Record<string, number>;
        totalMemoryEstimate?: number;
    };
    /** Get registered component classes */
    getComponentRegistry?(): Map<string, ComponentClass>;
    /** Get archetype statistics */
    getArchetypeStats?(): { count: number; entityCounts: Record<string, number> };
    /** Create entity */
    createEntity?(name?: string): EntityDef;
    /** Get frame number */
    frameNumber?: number;
}

interface SystemDef {
    name: string;
    priority?: number;
    isFixedUpdate?: boolean;
    tags?: string[];
    query?: QueryDef;
}

interface QueryDef {
    options?: {
        all?: ComponentClass[];
        any?: ComponentClass[];
        none?: ComponentClass[];
        tags?: string[];
    };
    entities?: EntityDef[];
}

type ComponentClass = new (...args: unknown[]) => unknown;

// =============================================================================
// WebSocket Server Abstraction
// =============================================================================

/**
 * WebSocket abstraction to support both Node.js and browser environments.
 */
interface WebSocketLike {
    send(data: string): void;
    close(): void;
    readyState: number;
}

interface WebSocketServerLike {
    on(event: string, callback: (...args: unknown[]) => void): void;
    close(callback?: () => void): void;
    clients: Set<WebSocketLike>;
}

// =============================================================================
// Entity Inspector API Implementation
// =============================================================================

/**
 * Implementation of the Entity Inspector API.
 */
export class EntityInspectorAPI implements IEntityInspectorAPI {
    private plugin: EntityInspectorPlugin;
    private engine: EngineRef;
    private _isPaused: boolean = false;
    private _isRunning: boolean = false;
    private server: WebSocketServerLike | null = null;
    private clients: Set<WebSocketLike> = new Set();
    private config: EntityInspectorConfig;
    private logger: Logger;
    private componentRegistry: Map<string, ComponentClass> = new Map();
    private lastFrameTime: number = 0;
    private frameStartTime: number = 0;
    private pendingStep: boolean = false;

    constructor(
        plugin: EntityInspectorPlugin,
        engine: EngineRef,
        config: EntityInspectorConfig,
        logger: Logger
    ) {
        this.plugin = plugin;
        this.engine = engine;
        this.config = config;
        this.logger = logger;
    }

    // =========================================================================
    // Server Lifecycle
    // =========================================================================

    async start(): Promise<void> {
        if (this._isRunning) {
            this.logger.warn('Inspector server is already running');
            return;
        }

        try {
            // Dynamic import of ws module for Node.js environments
            const { WebSocketServer } = await import('ws');

            this.server = new WebSocketServer({
                port: this.config.port,
                host: this.config.host,
            }) as unknown as WebSocketServerLike;

            this.server.on('connection', (...args: unknown[]) => {
                const ws = args[0] as WebSocketLike;
                this.handleConnection(ws);
            });

            this.server.on('error', (...args: unknown[]) => {
                const error = args[0] as Error;
                this.logger.error('WebSocket server error:', error.message);
            });

            this._isRunning = true;
            this.logger.info(
                `Inspector server started at ws://${this.config.host}:${this.config.port}`
            );
        } catch (error) {
            this.logger.error('Failed to start inspector server:', (error as Error).message);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this._isRunning || !this.server) {
            return;
        }

        return new Promise((resolve) => {
            // Close all client connections
            for (const client of this.clients) {
                client.close();
            }
            this.clients.clear();

            // Close the server
            if (this.server) {
                this.server.close(() => {
                    this._isRunning = false;
                    this.server = null;
                    this.logger.info('Inspector server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    get isRunning(): boolean {
        return this._isRunning;
    }

    get serverUrl(): string {
        return `ws://${this.config.host}:${this.config.port}`;
    }

    get connectionCount(): number {
        return this.clients.size;
    }

    // =========================================================================
    // Pause/Resume/Step
    // =========================================================================

    pause(): void {
        this._isPaused = true;
        this.broadcast({ eventType: 'frame_update', data: { isPaused: true } });
        this.logger.debug('Engine paused for inspection');
    }

    resume(): void {
        this._isPaused = false;
        this.broadcast({ eventType: 'frame_update', data: { isPaused: false } });
        this.logger.debug('Engine resumed');
    }

    step(): void {
        if (!this._isPaused) {
            this.logger.warn('Cannot step while not paused');
            return;
        }
        this.pendingStep = true;
        this.logger.debug('Stepping one frame');
    }

    get isPaused(): boolean {
        return this._isPaused;
    }

    /**
     * Called by the plugin during each frame to check if update should proceed.
     */
    shouldUpdate(): boolean {
        if (!this._isPaused) {
            return true;
        }
        if (this.pendingStep) {
            this.pendingStep = false;
            return true;
        }
        return false;
    }

    /**
     * Record frame timing for profiling.
     */
    recordFrameStart(): void {
        this.frameStartTime = performance.now();
    }

    /**
     * Record frame end timing.
     */
    recordFrameEnd(): void {
        this.lastFrameTime = performance.now() - this.frameStartTime;
    }

    // =========================================================================
    // Entity Introspection
    // =========================================================================

    getEntities(params?: EntityQueryParams): SerializedInspectorEntity[] {
        const entities = this.engine.entities || new Map();
        let result: SerializedInspectorEntity[] = [];

        const limit = params?.limit ?? this.config.maxEntities;
        const offset = params?.offset ?? 0;

        for (const entity of entities.values()) {
            // Apply filters
            if (
                params?.name &&
                entity.name &&
                !entity.name.toLowerCase().includes(params.name.toLowerCase())
            ) {
                continue;
            }

            if (params?.tags && params.tags.length > 0) {
                const hasAllTags = params.tags.every((tag) => entity.tags.has(tag));
                if (!hasAllTags) continue;
            }

            if (params?.components && params.components.length > 0) {
                const hasAllComponents = params.components.every((compName) => {
                    const compClass = this.componentRegistry.get(compName);
                    return compClass && entity.hasComponent(compClass);
                });
                if (!hasAllComponents) continue;
            }

            // Skip children if not requested
            if (!params?.includeChildren && entity.parent) {
                continue;
            }

            result.push(this.serializeEntity(entity));
        }

        // Apply pagination
        result = result.slice(offset, offset + limit);

        return result;
    }

    getEntity(entityId: string): SerializedInspectorEntity | null {
        const entities = this.engine.entities || new Map();

        for (const entity of entities.values()) {
            if (this.getEntityIdString(entity) === entityId) {
                return this.serializeEntity(entity);
            }
        }

        return null;
    }

    getSystems(): SystemInfo[] {
        const systems = this.engine.systems || new Map();
        const profiles = this.engine.getSystemProfiles?.() || [];
        const profileMap = new Map(profiles.map((p) => [p.name, p]));
        const result: SystemInfo[] = [];

        for (const [name, system] of systems) {
            const profile = profileMap.get(name);
            result.push({
                name,
                priority: system.priority ?? 0,
                isFixedUpdate: system.isFixedUpdate ?? false,
                tags: system.tags ?? [],
                queryOptions: this.serializeQueryOptions(system.query?.options),
                profile: profile
                    ? {
                          executionTime: profile.executionTime,
                          entityCount: profile.entityCount,
                          callCount: profile.callCount,
                          averageTime: profile.averageTime,
                      }
                    : undefined,
            });
        }

        // Sort by priority (descending)
        result.sort((a, b) => b.priority - a.priority);

        return result;
    }

    getQueries(): QueryInfo[] {
        const queries = this.engine.queries || new Map();
        const result: QueryInfo[] = [];

        let id = 0;
        for (const [_key, query] of queries) {
            result.push({
                id: `query_${id++}`,
                options: this.serializeQueryOptions(query.options),
                entityCount: query.entities?.length ?? 0,
            });
        }

        return result;
    }

    getSingletons(): SingletonInfo[] {
        const singletons = this.engine.singletons || new Map();
        const result: SingletonInfo[] = [];

        for (const [type, instance] of singletons) {
            const typeName = (type as ComponentClass).name ?? String(type);
            result.push({
                type: typeName,
                component: this.serializeComponentInstance(typeName, instance),
            });
        }

        return result;
    }

    getStats(): EngineStats {
        const memoryStats = this.engine.getMemoryStats?.() || {};
        const archetypeStats = this.engine.getArchetypeStats?.();
        const systems = this.engine.systems || new Map();
        const queries = this.engine.queries || new Map();

        return {
            totalEntities: memoryStats.totalEntities ?? 0,
            activeEntities: memoryStats.activeEntities ?? 0,
            systemCount: systems.size,
            queryCount: queries.size,
            componentTypeCount: Object.keys(memoryStats.componentArrays || {}).length,
            componentCounts: memoryStats.componentArrays || {},
            archetypeStats: archetypeStats
                ? {
                      count: archetypeStats.count,
                      entityCounts: archetypeStats.entityCounts,
                  }
                : undefined,
            memory: memoryStats.totalMemoryEstimate
                ? {
                      totalMemoryEstimate: memoryStats.totalMemoryEstimate,
                      componentArrays: memoryStats.componentArrays || {},
                  }
                : undefined,
            frameNumber: this.engine.frameNumber,
            isPaused: this._isPaused,
        };
    }

    getProfiling(): ProfilingData {
        const profiles = this.engine.getSystemProfiles?.() || [];
        const totalSystemTime = profiles.reduce((sum, p) => sum + p.executionTime, 0);

        return {
            timestamp: Date.now(),
            frameTime: this.lastFrameTime,
            systems: profiles.map((p) => ({
                name: p.name,
                executionTime: p.executionTime,
                entityCount: p.entityCount,
                callCount: p.callCount,
                averageTime: p.averageTime,
            })),
            totalSystemTime,
            fps: this.lastFrameTime > 0 ? 1000 / this.lastFrameTime : 0,
            breakdown: {
                systems: totalSystemTime,
                queries: 0, // Could be tracked separately
                other: Math.max(0, this.lastFrameTime - totalSystemTime),
            },
        };
    }

    broadcast(event: InspectorEvent): void {
        const message: ServerMessage = {
            type: 'event',
            timestamp: Date.now(),
            data: event,
        };

        this.broadcastMessage(message);
    }

    // =========================================================================
    // Component Registry Management
    // =========================================================================

    /**
     * Update the component registry from the engine.
     */
    updateComponentRegistry(): void {
        const registry = this.engine.getComponentRegistry?.();
        if (registry) {
            this.componentRegistry = registry;
        }
    }

    /**
     * Get available component type names.
     */
    getComponentTypes(): string[] {
        return Array.from(this.componentRegistry.keys());
    }

    // =========================================================================
    // Entity Modification
    // =========================================================================

    updateComponent(
        entityId: string,
        componentType: string,
        propertyName: string,
        value: unknown
    ): UpdateResult {
        try {
            const entity = this.findEntityById(entityId);
            if (!entity) {
                return { success: false, error: `Entity not found: ${entityId}` };
            }

            const compClass = this.componentRegistry.get(componentType);
            if (!compClass) {
                return { success: false, error: `Component type not found: ${componentType}` };
            }

            if (!entity.hasComponent(compClass)) {
                return {
                    success: false,
                    error: `Entity does not have component: ${componentType}`,
                };
            }

            const component = entity.getComponent(compClass) as Record<string, unknown>;
            if (!(propertyName in component)) {
                return { success: false, error: `Property not found: ${propertyName}` };
            }

            // Update the property
            component[propertyName] = value;

            // Broadcast the change
            this.broadcast({
                eventType: 'component_changed',
                entityId,
                componentType,
                data: { propertyName, value },
            });

            return { success: true, entity: this.serializeEntity(entity) };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    addComponent(
        entityId: string,
        componentType: string,
        initialValues?: Record<string, unknown>
    ): UpdateResult {
        try {
            const entity = this.findEntityById(entityId);
            if (!entity) {
                return { success: false, error: `Entity not found: ${entityId}` };
            }

            const compClass = this.componentRegistry.get(componentType);
            if (!compClass) {
                return { success: false, error: `Component type not found: ${componentType}` };
            }

            if (entity.hasComponent(compClass)) {
                return { success: false, error: `Entity already has component: ${componentType}` };
            }

            // Add the component with default values
            entity.addComponent(compClass);

            // Apply initial values if provided
            if (initialValues) {
                const component = entity.getComponent(compClass) as Record<string, unknown>;
                for (const [key, val] of Object.entries(initialValues)) {
                    if (key in component) {
                        component[key] = val;
                    }
                }
            }

            // Broadcast the change
            this.broadcast({
                eventType: 'component_added',
                entityId,
                componentType,
            });

            return { success: true, entity: this.serializeEntity(entity) };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    removeComponent(entityId: string, componentType: string): UpdateResult {
        try {
            const entity = this.findEntityById(entityId);
            if (!entity) {
                return { success: false, error: `Entity not found: ${entityId}` };
            }

            const compClass = this.componentRegistry.get(componentType);
            if (!compClass) {
                return { success: false, error: `Component type not found: ${componentType}` };
            }

            if (!entity.hasComponent(compClass)) {
                return {
                    success: false,
                    error: `Entity does not have component: ${componentType}`,
                };
            }

            entity.removeComponent(compClass);

            // Broadcast the change
            this.broadcast({
                eventType: 'component_removed',
                entityId,
                componentType,
            });

            return { success: true, entity: this.serializeEntity(entity) };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    addTag(entityId: string, tag: string): UpdateResult {
        try {
            const entity = this.findEntityById(entityId);
            if (!entity) {
                return { success: false, error: `Entity not found: ${entityId}` };
            }

            entity.addTag(tag);

            this.broadcast({
                eventType: 'tag_added',
                entityId,
                tag,
            });

            return { success: true, entity: this.serializeEntity(entity) };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    removeTag(entityId: string, tag: string): UpdateResult {
        try {
            const entity = this.findEntityById(entityId);
            if (!entity) {
                return { success: false, error: `Entity not found: ${entityId}` };
            }

            entity.removeTag(tag);

            this.broadcast({
                eventType: 'tag_removed',
                entityId,
                tag,
            });

            return { success: true, entity: this.serializeEntity(entity) };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    createEntity(name?: string, tags?: string[], parentId?: string): UpdateResult {
        try {
            if (!this.engine.createEntity) {
                return { success: false, error: 'Engine does not support entity creation' };
            }

            const entity = this.engine.createEntity(name);

            if (tags) {
                for (const tag of tags) {
                    entity.addTag(tag);
                }
            }

            if (parentId) {
                const parent = this.findEntityById(parentId);
                if (parent) {
                    entity.setParent(parent);
                }
            }

            const entityId = this.getEntityIdString(entity);

            this.broadcast({
                eventType: 'entity_created',
                entityId,
                data: { name, tags },
            });

            return { success: true, entity: this.serializeEntity(entity) };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    deleteEntity(entityId: string): UpdateResult {
        try {
            const entity = this.findEntityById(entityId);
            if (!entity) {
                return { success: false, error: `Entity not found: ${entityId}` };
            }

            entity.queueFree();

            this.broadcast({
                eventType: 'entity_deleted',
                entityId,
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    // =========================================================================
    // WebSocket Message Handling
    // =========================================================================

    private handleConnection(ws: WebSocketLike): void {
        this.clients.add(ws);
        this.logger.debug(`Inspector client connected (${this.clients.size} total)`);

        // Send connection info
        const connectionInfo: ConnectionInfo = {
            version: '1.0.0',
            config: {
                updateInterval: this.config.updateInterval,
                maxEntities: this.config.maxEntities,
            },
            componentTypes: this.getComponentTypes(),
            systems: Array.from((this.engine.systems || new Map()).keys()),
            isPaused: this._isPaused,
        };

        this.sendMessage(ws, {
            type: 'connected',
            timestamp: Date.now(),
            data: connectionInfo,
        });

        // Set up message handling
        (ws as unknown as { on: (event: string, callback: (data: unknown) => void) => void }).on(
            'message',
            (data: unknown) => {
                try {
                    const message = JSON.parse(
                        typeof data === 'string' ? data : (data as Buffer).toString()
                    ) as ClientMessage;
                    this.handleMessage(ws, message);
                } catch (error) {
                    this.logger.error('Failed to parse message:', (error as Error).message);
                }
            }
        );

        (ws as unknown as { on: (event: string, callback: () => void) => void }).on('close', () => {
            this.clients.delete(ws);
            this.logger.debug(`Inspector client disconnected (${this.clients.size} remaining)`);
        });

        (ws as unknown as { on: (event: string, callback: (error: Error) => void) => void }).on(
            'error',
            (error: Error) => {
                this.logger.error('WebSocket client error:', error.message);
            }
        );
    }

    private handleMessage(ws: WebSocketLike, message: ClientMessage): void {
        const { type, id, timestamp: _timestamp } = message;

        try {
            switch (type) {
                case 'ping':
                    this.sendMessage(ws, { type: 'pong', id, timestamp: Date.now() });
                    break;

                case 'get_entities':
                    this.sendMessage(ws, {
                        type: 'entities',
                        id,
                        timestamp: Date.now(),
                        data: {
                            entities: this.getEntities(message.data),
                            totalCount: (this.engine.entities || new Map()).size,
                            offset: message.data?.offset ?? 0,
                            limit: message.data?.limit ?? this.config.maxEntities,
                        },
                    });
                    break;

                case 'get_entity':
                    this.sendMessage(ws, {
                        type: 'entity',
                        id,
                        timestamp: Date.now(),
                        data: this.getEntity(message.data.entityId),
                    });
                    break;

                case 'get_systems':
                    this.sendMessage(ws, {
                        type: 'systems',
                        id,
                        timestamp: Date.now(),
                        data: this.getSystems(),
                    });
                    break;

                case 'get_queries':
                    this.sendMessage(ws, {
                        type: 'queries',
                        id,
                        timestamp: Date.now(),
                        data: this.getQueries(),
                    });
                    break;

                case 'get_singletons':
                    this.sendMessage(ws, {
                        type: 'singletons',
                        id,
                        timestamp: Date.now(),
                        data: this.getSingletons(),
                    });
                    break;

                case 'get_stats':
                    this.sendMessage(ws, {
                        type: 'stats',
                        id,
                        timestamp: Date.now(),
                        data: this.getStats(),
                    });
                    break;

                case 'get_profiling':
                    this.sendMessage(ws, {
                        type: 'profiling',
                        id,
                        timestamp: Date.now(),
                        data: this.getProfiling(),
                    });
                    break;

                case 'update_component':
                    this.sendMessage(ws, {
                        type: 'update_result',
                        id,
                        timestamp: Date.now(),
                        data: this.updateComponent(
                            message.data.entityId,
                            message.data.componentType,
                            message.data.propertyName,
                            message.data.value
                        ),
                    });
                    break;

                case 'add_component':
                    this.sendMessage(ws, {
                        type: 'update_result',
                        id,
                        timestamp: Date.now(),
                        data: this.addComponent(
                            message.data.entityId,
                            message.data.componentType,
                            message.data.initialValues
                        ),
                    });
                    break;

                case 'remove_component':
                    this.sendMessage(ws, {
                        type: 'update_result',
                        id,
                        timestamp: Date.now(),
                        data: this.removeComponent(
                            message.data.entityId,
                            message.data.componentType
                        ),
                    });
                    break;

                case 'add_tag':
                    this.sendMessage(ws, {
                        type: 'update_result',
                        id,
                        timestamp: Date.now(),
                        data: this.addTag(message.data.entityId, message.data.tag),
                    });
                    break;

                case 'remove_tag':
                    this.sendMessage(ws, {
                        type: 'update_result',
                        id,
                        timestamp: Date.now(),
                        data: this.removeTag(message.data.entityId, message.data.tag),
                    });
                    break;

                case 'create_entity':
                    this.sendMessage(ws, {
                        type: 'update_result',
                        id,
                        timestamp: Date.now(),
                        data: this.createEntity(
                            message.data?.name,
                            message.data?.tags,
                            message.data?.parentId
                        ),
                    });
                    break;

                case 'delete_entity':
                    this.sendMessage(ws, {
                        type: 'update_result',
                        id,
                        timestamp: Date.now(),
                        data: this.deleteEntity(message.data.entityId),
                    });
                    break;

                case 'pause':
                    this.pause();
                    this.sendMessage(ws, {
                        type: 'update_result',
                        id,
                        timestamp: Date.now(),
                        data: { success: true },
                    });
                    break;

                case 'resume':
                    this.resume();
                    this.sendMessage(ws, {
                        type: 'update_result',
                        id,
                        timestamp: Date.now(),
                        data: { success: true },
                    });
                    break;

                case 'step':
                    this.step();
                    this.sendMessage(ws, {
                        type: 'update_result',
                        id,
                        timestamp: Date.now(),
                        data: { success: true },
                    });
                    break;

                default:
                    this.sendMessage(ws, {
                        type: 'error',
                        id,
                        timestamp: Date.now(),
                        data: { message: `Unknown message type: ${type}` },
                    });
            }
        } catch (error) {
            this.sendMessage(ws, {
                type: 'error',
                id,
                timestamp: Date.now(),
                data: { message: (error as Error).message },
            });
        }
    }

    private sendMessage(ws: WebSocketLike, message: ServerMessage): void {
        if (ws.readyState === 1) {
            // WebSocket.OPEN
            ws.send(JSON.stringify(message));
        }
    }

    private broadcastMessage(message: ServerMessage): void {
        const data = JSON.stringify(message);
        for (const client of this.clients) {
            if (client.readyState === 1) {
                // WebSocket.OPEN
                client.send(data);
            }
        }
    }

    // =========================================================================
    // Serialization Helpers
    // =========================================================================

    private serializeEntity(entity: EntityDef): SerializedInspectorEntity {
        const components: SerializedComponent[] = [];

        // Get all components from the entity
        for (const [typeName, compClass] of this.componentRegistry) {
            try {
                if (entity.hasComponent(compClass)) {
                    const instance = entity.getComponent(compClass);
                    components.push(this.serializeComponentInstance(typeName, instance));
                }
            } catch {
                // Component access failed, skip
            }
        }

        return {
            id: this.getEntityIdString(entity),
            name: entity.name,
            tags: Array.from(entity.tags),
            components,
            parentId: entity.parent ? this.getEntityIdString(entity.parent) : undefined,
            childIds: entity.children.map((child) => this.getEntityIdString(child)),
            isMarkedForDeletion: entity.isMarkedForDeletion,
            isDirty: entity.isDirty,
        };
    }

    private serializeComponentInstance(typeName: string, instance: unknown): SerializedComponent {
        const properties: ComponentProperty[] = [];

        if (instance && typeof instance === 'object') {
            for (const [key, value] of Object.entries(instance)) {
                // Skip private properties and functions
                if (key.startsWith('_') || typeof value === 'function') {
                    continue;
                }

                properties.push({
                    name: key,
                    value: this.serializeValue(value),
                    typeHint: this.getTypeHint(value),
                    editable: true,
                });
            }
        }

        return {
            type: typeName,
            properties,
        };
    }

    private serializeValue(value: unknown): unknown {
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof value === 'symbol') {
            return value.description ?? String(value);
        }

        if (typeof value === 'function') {
            return '[Function]';
        }

        if (value instanceof Map) {
            return Object.fromEntries(value);
        }

        if (value instanceof Set) {
            return Array.from(value);
        }

        if (Array.isArray(value)) {
            return value.map((v) => this.serializeValue(v));
        }

        if (typeof value === 'object') {
            const result: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(value)) {
                if (!k.startsWith('_') && typeof v !== 'function') {
                    result[k] = this.serializeValue(v);
                }
            }
            return result;
        }

        return value;
    }

    private getTypeHint(value: unknown): PropertyTypeHint {
        if (value === null || value === undefined) {
            return 'unknown';
        }

        if (typeof value === 'string') {
            // Check for color format
            if (/^#[0-9A-Fa-f]{6}$/.test(value) || value.startsWith('rgb(')) {
                return 'color';
            }
            return 'string';
        }

        if (typeof value === 'number') {
            return 'number';
        }

        if (typeof value === 'boolean') {
            return 'boolean';
        }

        if (Array.isArray(value)) {
            return 'array';
        }

        if (typeof value === 'object') {
            // Check for vector-like objects
            if ('x' in value && 'y' in value) {
                if ('z' in value) {
                    return 'vector3';
                }
                return 'vector2';
            }
            return 'object';
        }

        return 'unknown';
    }

    private serializeQueryOptions(options?: QueryDef['options']): SystemInfo['queryOptions'] {
        if (!options) {
            return {};
        }

        return {
            all: options.all?.map((c) => c.name ?? String(c)),
            any: options.any?.map((c) => c.name ?? String(c)),
            none: options.none?.map((c) => c.name ?? String(c)),
            tags: options.tags,
        };
    }

    private getEntityIdString(entity: EntityDef): string {
        return entity.id.description ?? String(entity.id);
    }

    private findEntityById(entityId: string): EntityDef | undefined {
        const entities = this.engine.entities || new Map();

        for (const entity of entities.values()) {
            if (this.getEntityIdString(entity) === entityId) {
                return entity;
            }
        }

        return undefined;
    }
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Entity Inspector Plugin for OrionECS.
 *
 * Provides a web-based debugging interface for real-time visualization
 * and editing of entities, components, and systems.
 */
export class EntityInspectorPlugin implements EnginePlugin<{ inspector: IEntityInspectorAPI }> {
    name = 'EntityInspectorPlugin';
    version = '1.0.0';

    /** Type brand for compile-time type inference */
    declare readonly __extensions: { inspector: IEntityInspectorAPI };

    private config: EntityInspectorConfig;
    private api?: EntityInspectorAPI;
    private unsubscribeEvents: Array<() => void> = [];

    constructor(options?: Partial<EntityInspectorConfig>) {
        this.config = { ...DEFAULT_INSPECTOR_CONFIG, ...options };
    }

    install(context: PluginContext): void {
        const engine = context.getEngine();
        const logger = context.logger.withTag('EntityInspector');

        // Create the API
        this.api = new EntityInspectorAPI(this, engine, this.config, logger);

        // Update component registry
        this.api.updateComponentRegistry();

        // Subscribe to engine events for real-time updates
        this.unsubscribeEvents.push(
            context.on('onEntityCreated', (entity: EntityDef) => {
                this.api?.broadcast({
                    eventType: 'entity_created',
                    entityId: entity.id.description ?? String(entity.id),
                });
            })
        );

        this.unsubscribeEvents.push(
            context.on('onEntityDestroyed', (entity: EntityDef) => {
                this.api?.broadcast({
                    eventType: 'entity_deleted',
                    entityId: entity.id.description ?? String(entity.id),
                });
            })
        );

        this.unsubscribeEvents.push(
            context.on('onComponentAdded', (entity: EntityDef, componentType: unknown) => {
                this.api?.broadcast({
                    eventType: 'component_added',
                    entityId: entity.id.description ?? String(entity.id),
                    componentType:
                        (componentType as { name?: string }).name ?? String(componentType),
                });
            })
        );

        this.unsubscribeEvents.push(
            context.on('onComponentRemoved', (entity: EntityDef, componentType: unknown) => {
                this.api?.broadcast({
                    eventType: 'component_removed',
                    entityId: entity.id.description ?? String(entity.id),
                    componentType:
                        (componentType as { name?: string }).name ?? String(componentType),
                });
            })
        );

        this.unsubscribeEvents.push(
            context.on('onTagChanged', (entity: EntityDef, tag: string, added: boolean) => {
                this.api?.broadcast({
                    eventType: added ? 'tag_added' : 'tag_removed',
                    entityId: entity.id.description ?? String(entity.id),
                    tag,
                });
            })
        );

        this.unsubscribeEvents.push(
            context.on('onSingletonSet', (event: { componentType: unknown }) => {
                this.api?.broadcast({
                    eventType: 'singleton_set',
                    componentType:
                        (event.componentType as { name?: string }).name ??
                        String(event.componentType),
                });
            })
        );

        this.unsubscribeEvents.push(
            context.on('onSingletonRemoved', (event: { componentType: unknown }) => {
                this.api?.broadcast({
                    eventType: 'singleton_removed',
                    componentType:
                        (event.componentType as { name?: string }).name ??
                        String(event.componentType),
                });
            })
        );

        // Create a system to track frame timing and handle pause/step
        context.createSystem(
            'EntityInspectorFrameSystem',
            { all: [] },
            {
                priority: Number.MAX_SAFE_INTEGER, // Run first
                before: () => {
                    this.api?.recordFrameStart();
                    // If paused and no pending step, skip update
                    // Note: actual frame blocking would need engine support
                },
                after: () => {
                    this.api?.recordFrameEnd();
                    this.api?.updateComponentRegistry();
                },
            },
            false
        );

        // Extend the engine with the inspector API
        context.extend('inspector', this.api);

        logger.info('EntityInspectorPlugin installed');
        if (this.config.debug) {
            logger.debug('Configuration:', this.config);
        }
    }

    uninstall(): void {
        // Stop the server if running
        if (this.api?.isRunning) {
            this.api.stop();
        }

        // Unsubscribe from events
        for (const unsubscribe of this.unsubscribeEvents) {
            unsubscribe();
        }
        this.unsubscribeEvents = [];
    }
}
