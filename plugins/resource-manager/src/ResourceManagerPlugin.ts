/**
 * Resource Manager Plugin for Orion ECS
 *
 * Provides shared resource management with reference counting.
 * This plugin demonstrates:
 * - Automatic resource loading and caching
 * - Reference counting for memory management
 * - Automatic cleanup when resources are no longer used
 * - Resource usage statistics and monitoring
 */

import type { EnginePlugin, PluginContext } from '@orion-ecs/plugin-api';

/**
 * Base resource interface
 */
export interface Resource {
    readonly key: string;
    load(): void | Promise<void>;
    unload(): void | Promise<void>;
}

/**
 * Resource type definition
 */
export interface ResourceType<T extends Resource> {
    new (key: string, ...args: any[]): T;
    resourceTypeName: string;
}

/**
 * Resource entry with reference counting
 */
interface ResourceEntry<T extends Resource> {
    resource: T;
    refCount: number;
    loadedAt: number;
    lastAccessed: number;
}

/**
 * Example texture resource
 */
export class TextureResource implements Resource {
    static resourceTypeName = 'Texture';

    private _loaded = false;
    private _data: any = null;

    constructor(public readonly key: string) {}

    async load(): Promise<void> {
        if (this._loaded) return;

        console.log(`[TextureResource] Loading texture: ${this.key}`);
        // Simulate async loading
        await new Promise((resolve) => setTimeout(resolve, 10));
        this._data = { width: 256, height: 256, url: this.key };
        this._loaded = true;
    }

    async unload(): Promise<void> {
        if (!this._loaded) return;

        console.log(`[TextureResource] Unloading texture: ${this.key}`);
        this._data = null;
        this._loaded = false;
    }

    get data(): any {
        return this._data;
    }

    get isLoaded(): boolean {
        return this._loaded;
    }
}

/**
 * Example audio resource
 */
export class AudioResource implements Resource {
    static resourceTypeName = 'Audio';

    private _loaded = false;
    private _buffer: any = null;

    constructor(public readonly key: string) {}

    async load(): Promise<void> {
        if (this._loaded) return;

        console.log(`[AudioResource] Loading audio: ${this.key}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
        this._buffer = { duration: 3.5, url: this.key };
        this._loaded = true;
    }

    async unload(): Promise<void> {
        if (!this._loaded) return;

        console.log(`[AudioResource] Unloading audio: ${this.key}`);
        this._buffer = null;
        this._loaded = false;
    }

    get buffer(): any {
        return this._buffer;
    }

    get isLoaded(): boolean {
        return this._loaded;
    }
}

// =============================================================================
// Resource Manager API Interface
// =============================================================================

/**
 * Resource Manager API interface for type-safe engine extension.
 */
export interface IResourceManagerAPI {
    /** Register a resource type */
    register<T extends Resource>(resourceType: ResourceType<T>): void;
    /** Get a resource with automatic loading and reference counting */
    get<T extends Resource>(resourceType: ResourceType<T>, key: string, ...args: any[]): Promise<T>;
    /** Get a resource synchronously (must be already loaded) */
    getSync<T extends Resource>(resourceType: ResourceType<T>, key: string): T | null;
    /** Release a resource (decrement reference count) */
    release<T extends Resource>(resource: T): Promise<void>;
    /** Preload resources without incrementing reference count */
    preload<T extends Resource>(
        resourceType: ResourceType<T>,
        keys: string[],
        ...args: any[]
    ): Promise<void>;
    /** Get resource usage statistics */
    getStats(): {
        totalTypes: number;
        totalResources: number;
        byType: Array<{
            type: string;
            count: number;
            totalRefs: number;
            averageRefs: number;
        }>;
    };
    /** Print resource statistics */
    printStats(): void;
    /** Clear all resources (force unload) */
    clearAll(): Promise<void>;
    /** Cleanup unused resources (with refCount = 0) */
    cleanupUnused(): Promise<number>;
}

// =============================================================================
// Resource Manager API Implementation
// =============================================================================

/**
 * Resource Manager API implementation class.
 */
export class ResourceManagerAPI implements IResourceManagerAPI {
    private resources = new Map<string, Map<string, ResourceEntry<any>>>();
    private registeredTypes = new Map<string, ResourceType<any>>();
    /** Track in-progress loads to prevent race conditions */
    private loadingPromises = new Map<string, Promise<void>>();

    /**
     * Register a resource type
     */
    register<T extends Resource>(resourceType: ResourceType<T>): void {
        const typeName = resourceType.resourceTypeName;

        if (this.registeredTypes.has(typeName)) {
            console.warn(`[ResourceManager] Type already registered: ${typeName}`);
            return;
        }

        this.registeredTypes.set(typeName, resourceType);
        this.resources.set(typeName, new Map());
        console.log(`[ResourceManager] Registered resource type: ${typeName}`);
    }

    /**
     * Get a resource with automatic loading and reference counting
     */
    async get<T extends Resource>(
        resourceType: ResourceType<T>,
        key: string,
        ...args: any[]
    ): Promise<T> {
        const typeName = resourceType.resourceTypeName;

        if (!this.registeredTypes.has(typeName)) {
            throw new Error(`Resource type not registered: ${typeName}`);
        }

        const typeMap = this.resources.get(typeName)!;
        const loadingKey = `${typeName}/${key}`;

        // Check if resource is already loaded
        let entry = typeMap.get(key);

        if (!entry) {
            // Check if load is already in progress (prevents race condition)
            const existingLoad = this.loadingPromises.get(loadingKey);
            if (existingLoad) {
                // Wait for existing load to complete
                await existingLoad;
                const loadedEntry = typeMap.get(key);
                if (!loadedEntry) {
                    throw new Error(`Resource failed to load: ${typeName}/${key}`);
                }
                entry = loadedEntry;
            } else {
                // Create new resource and track the loading promise
                const resource = new resourceType(key, ...args);
                entry = {
                    resource,
                    refCount: 0,
                    loadedAt: Date.now(),
                    lastAccessed: Date.now(),
                };
                typeMap.set(key, entry);

                // Load the resource and track the promise
                const loadResult = resource.load();
                const loadPromise = Promise.resolve(loadResult).finally(() => {
                    this.loadingPromises.delete(loadingKey);
                });
                this.loadingPromises.set(loadingKey, loadPromise);

                await loadPromise;
                console.log(`[ResourceManager] Loaded new resource: ${typeName}/${key}`);
            }
        }

        // Increment reference count
        entry.refCount++;
        entry.lastAccessed = Date.now();

        console.log(`[ResourceManager] Get resource: ${typeName}/${key} (refs: ${entry.refCount})`);

        return entry.resource as T;
    }

    /**
     * Get a resource synchronously (must be already loaded)
     */
    getSync<T extends Resource>(resourceType: ResourceType<T>, key: string): T | null {
        const typeName = resourceType.resourceTypeName;
        const typeMap = this.resources.get(typeName);

        if (!typeMap) return null;

        const entry = typeMap.get(key);
        if (!entry) return null;

        entry.refCount++;
        entry.lastAccessed = Date.now();

        console.log(
            `[ResourceManager] Get resource (sync): ${typeName}/${key} (refs: ${entry.refCount})`
        );

        return entry.resource as T;
    }

    /**
     * Release a resource (decrement reference count)
     */
    async release<T extends Resource>(resource: T): Promise<void> {
        // Find the resource entry
        for (const [typeName, typeMap] of this.resources.entries()) {
            const entry = typeMap.get(resource.key);

            if (entry && entry.resource === resource) {
                entry.refCount = Math.max(0, entry.refCount - 1);

                console.log(
                    `[ResourceManager] Release resource: ${typeName}/${resource.key} (refs: ${entry.refCount})`
                );

                // Unload if no more references
                if (entry.refCount === 0) {
                    await entry.resource.unload();
                    typeMap.delete(resource.key);
                    console.log(`[ResourceManager] Unloaded resource: ${typeName}/${resource.key}`);
                }

                return;
            }
        }

        console.warn(`[ResourceManager] Tried to release unknown resource: ${resource.key}`);
    }

    /**
     * Preload resources without incrementing reference count
     */
    async preload<T extends Resource>(
        resourceType: ResourceType<T>,
        keys: string[],
        ...args: any[]
    ): Promise<void> {
        const promises = keys.map(async (key) => {
            await this.get(resourceType, key, ...args);
            // Don't release - keep in cache with refCount = 1
        });

        await Promise.all(promises);
        console.log(
            `[ResourceManager] Preloaded ${keys.length} resources of type ${resourceType.resourceTypeName}`
        );
    }

    /**
     * Get resource usage statistics
     */
    getStats(): {
        totalTypes: number;
        totalResources: number;
        byType: Array<{
            type: string;
            count: number;
            totalRefs: number;
            averageRefs: number;
        }>;
    } {
        const byType: Array<{
            type: string;
            count: number;
            totalRefs: number;
            averageRefs: number;
        }> = [];

        let totalResources = 0;

        for (const [typeName, typeMap] of this.resources.entries()) {
            let totalRefs = 0;
            for (const entry of typeMap.values()) {
                totalRefs += entry.refCount;
            }

            const count = typeMap.size;
            totalResources += count;

            byType.push({
                type: typeName,
                count,
                totalRefs,
                averageRefs: count > 0 ? totalRefs / count : 0,
            });
        }

        return {
            totalTypes: this.registeredTypes.size,
            totalResources,
            byType,
        };
    }

    /**
     * Print resource statistics
     */
    printStats(): void {
        const stats = this.getStats();

        console.log('');
        console.log('═'.repeat(60));
        console.log('  RESOURCE MANAGER STATISTICS');
        console.log('═'.repeat(60));
        console.log(`  Total Resource Types: ${stats.totalTypes}`);
        console.log(`  Total Resources Loaded: ${stats.totalResources}`);
        console.log('');

        if (stats.byType.length > 0) {
            console.log('  By Type:');
            stats.byType.forEach((typeStats) => {
                console.log(`    ${typeStats.type}:`);
                console.log(`      Count: ${typeStats.count}`);
                console.log(`      Total References: ${typeStats.totalRefs}`);
                console.log(`      Average References: ${typeStats.averageRefs.toFixed(2)}`);
            });
        }

        console.log('═'.repeat(60));
        console.log('');
    }

    /**
     * Clear all resources (force unload)
     */
    async clearAll(): Promise<void> {
        console.log('[ResourceManager] Clearing all resources...');

        for (const typeMap of this.resources.values()) {
            for (const entry of typeMap.values()) {
                await entry.resource.unload();
            }
            typeMap.clear();
        }

        console.log('[ResourceManager] All resources cleared');
    }

    /**
     * Cleanup unused resources (with refCount = 0)
     */
    async cleanupUnused(): Promise<number> {
        let cleaned = 0;

        for (const typeMap of this.resources.values()) {
            const toDelete: string[] = [];

            for (const [key, entry] of typeMap.entries()) {
                if (entry.refCount === 0) {
                    await entry.resource.unload();
                    toDelete.push(key);
                    cleaned++;
                }
            }

            for (const key of toDelete) {
                typeMap.delete(key);
            }
        }

        console.log(`[ResourceManager] Cleaned up ${cleaned} unused resources`);
        return cleaned;
    }
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Resource Manager Plugin with type-safe engine extension.
 */
export class ResourceManagerPlugin implements EnginePlugin<{ resources: IResourceManagerAPI }> {
    name = 'ResourceManagerPlugin';
    version = '1.0.0';

    /** Type brand for compile-time type inference */
    declare readonly __extensions: { resources: IResourceManagerAPI };

    private resourceAPI = new ResourceManagerAPI();

    install(context: PluginContext): void {
        // Register common resource types
        this.resourceAPI.register(TextureResource);
        this.resourceAPI.register(AudioResource);

        // Extend the engine with resource management API
        context.extend('resources', this.resourceAPI);

        console.log('[ResourceManagerPlugin] Installed successfully');
    }

    async uninstall(): Promise<void> {
        // Clean up all resources
        await this.resourceAPI.clearAll();

        console.log('[ResourceManagerPlugin] Uninstalled successfully');
    }
}

/**
 * Usage example:
 *
 * import { EngineBuilder } from '../../../packages/core/src/index';
 * import { ResourceManagerPlugin, TextureResource, AudioResource } from './examples/ResourceManagerPlugin';
 *
 * const engine = new EngineBuilder()
 *   .withDebugMode(true)
 *   .use(new ResourceManagerPlugin())
 *   .build();
 *
 * // Get resources (automatically loaded and cached)
 * const texture1 = await engine.resources.get(TextureResource, 'player.png');
 * const texture2 = await engine.resources.get(TextureResource, 'player.png'); // Same instance
 * const audio = await engine.resources.get(AudioResource, 'music.mp3');
 *
 * // Use the resources
 * console.log(texture1.data); // { width: 256, height: 256, url: 'player.png' }
 * console.log(audio.buffer); // { duration: 3.5, url: 'music.mp3' }
 *
 * // Release resources when done
 * await engine.resources.release(texture1);
 * await engine.resources.release(texture2); // Unloaded when refCount reaches 0
 *
 * // Preload resources
 * await engine.resources.preload(TextureResource, [
 *   'enemy1.png',
 *   'enemy2.png',
 *   'background.png'
 * ]);
 *
 * // View statistics
 * engine.resources.printStats();
 *
 * // Custom resource type example:
 * class ModelResource implements Resource {
 *   static resourceTypeName = 'Model';
 *   constructor(public readonly key: string) {}
 *   async load() { console.log('Loading model:', this.key); }
 *   async unload() { console.log('Unloading model:', this.key); }
 * }
 *
 * engine.resources.register(ModelResource);
 * const model = await engine.resources.get(ModelResource, 'character.obj');
 */
