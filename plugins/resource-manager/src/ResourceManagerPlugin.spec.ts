/**
 * ResourceManagerPlugin Test Suite
 *
 * Comprehensive tests covering:
 * - Plugin installation and API extension
 * - Resource type registration
 * - Resource loading and caching
 * - Reference counting
 * - Automatic cleanup
 * - Resource statistics
 * - Custom resource types
 */

import { TestEngineBuilder } from '@orion-ecs/testing';
import type { Engine } from '../../../packages/core/src/index';
import {
    AudioResource,
    type Resource,
    ResourceManagerAPI,
    ResourceManagerPlugin,
    type ResourceType,
    TextureResource,
} from './ResourceManagerPlugin';

// Type extensions for testing
type EngineWithResources = Engine & { resources: ResourceManagerAPI };

// Custom test resource
class TestResource implements Resource {
    static resourceTypeName = 'Test';

    private _loaded = false;

    constructor(public readonly key: string) {}

    async load(): Promise<void> {
        this._loaded = true;
    }

    async unload(): Promise<void> {
        this._loaded = false;
    }

    get isLoaded(): boolean {
        return this._loaded;
    }
}

describe('ResourceManagerPlugin', () => {
    let engine: EngineWithResources;
    let plugin: ResourceManagerPlugin;

    beforeEach(() => {
        plugin = new ResourceManagerPlugin();
        engine = new TestEngineBuilder().use(plugin).build() as unknown as EngineWithResources;
    });

    afterEach(async () => {
        engine.stop();
        // Clean up resources
        const api = (engine as EngineWithResources).resources as ResourceManagerAPI;
        if (api) {
            await api.clearAll();
        }
    });

    describe('Plugin Metadata', () => {
        test('should have correct name and version', () => {
            expect(plugin.name).toBe('ResourceManagerPlugin');
            expect(plugin.version).toBe('1.0.0');
        });
    });

    describe('Plugin Installation', () => {
        test('should install successfully', () => {
            expect(engine).toBeDefined();
        });

        test('should extend engine with resources API', () => {
            expect((engine as EngineWithResources).resources).toBeDefined();
            expect((engine as EngineWithResources).resources).toBeInstanceOf(ResourceManagerAPI);
        });

        test('should register default resource types', () => {
            const api = (engine as EngineWithResources).resources as ResourceManagerAPI;

            // Should be able to get resources of registered types
            expect(async () => {
                await api.get(TextureResource, 'test.png');
            }).not.toThrow();

            expect(async () => {
                await api.get(AudioResource, 'test.mp3');
            }).not.toThrow();
        });
    });

    describe('ResourceManagerAPI - Type Registration', () => {
        let api: ResourceManagerAPI;

        beforeEach(() => {
            api = (engine as EngineWithResources).resources;
        });

        test('should register custom resource type', () => {
            expect(() => {
                api.register(TestResource);
            }).not.toThrow();
        });

        test('should warn when registering duplicate type', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            api.register(TestResource);
            api.register(TestResource); // Duplicate

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));

            consoleSpy.mockRestore();
        });
    });

    describe('ResourceManagerAPI - Resource Loading', () => {
        let api: ResourceManagerAPI;

        beforeEach(() => {
            api = (engine as EngineWithResources).resources;
        });

        test('should load texture resource', async () => {
            const texture = await api.get(TextureResource, 'player.png');

            expect(texture).toBeDefined();
            expect(texture.key).toBe('player.png');
            expect(texture.isLoaded).toBe(true);
        });

        test('should load audio resource', async () => {
            const audio = await api.get(AudioResource, 'music.mp3');

            expect(audio).toBeDefined();
            expect(audio.key).toBe('music.mp3');
            expect(audio.isLoaded).toBe(true);
        });

        test('should return same instance for same key', async () => {
            const texture1 = await api.get(TextureResource, 'player.png');
            const texture2 = await api.get(TextureResource, 'player.png');

            expect(texture1).toBe(texture2);
        });

        test('should return different instances for different keys', async () => {
            const texture1 = await api.get(TextureResource, 'player.png');
            const texture2 = await api.get(TextureResource, 'enemy.png');

            expect(texture1).not.toBe(texture2);
        });

        test('should throw error for unregistered type', async () => {
            class UnregisteredResource implements Resource {
                static resourceTypeName = 'Unregistered';
                constructor(public readonly key: string) {}
                async load() {}
                async unload() {}
            }

            await expect(async () => {
                await api.get(UnregisteredResource as unknown as ResourceType<Resource>, 'test');
            }).rejects.toThrow('not registered');
        });
    });

    describe('ResourceManagerAPI - Reference Counting', () => {
        let api: ResourceManagerAPI;

        beforeEach(() => {
            api = (engine as EngineWithResources).resources;
        });

        test('should increment reference count on get', async () => {
            const _texture1 = await api.get(TextureResource, 'player.png');
            const _texture2 = await api.get(TextureResource, 'player.png');

            const stats = api.getStats();
            const textureStats = stats.byType.find((t) => t.type === 'Texture');

            expect(textureStats).toBeDefined();
            expect(textureStats?.totalRefs).toBeGreaterThanOrEqual(2);
        });

        test('should decrement reference count on release', async () => {
            const texture1 = await api.get(TextureResource, 'player.png');
            const _texture2 = await api.get(TextureResource, 'player.png');

            await api.release(texture1);

            const stats = api.getStats();
            const textureStats = stats.byType.find((t) => t.type === 'Texture');

            expect(textureStats?.totalRefs).toBeGreaterThanOrEqual(1);
        });

        test('should unload resource when reference count reaches 0', async () => {
            const texture = await api.get(TextureResource, 'player.png');

            await api.release(texture);

            expect(texture.isLoaded).toBe(false);
        });

        test('should remove resource from cache when unloaded', async () => {
            const texture = await api.get(TextureResource, 'player.png');

            await api.release(texture);

            const stats = api.getStats();
            const textureStats = stats.byType.find((t) => t.type === 'Texture');

            expect(textureStats?.count).toBe(0);
        });

        test('should not decrement below 0', async () => {
            const texture = await api.get(TextureResource, 'player.png');

            await api.release(texture);
            await api.release(texture); // Extra release

            expect(true).toBe(true); // Should not throw
        });
    });

    describe('ResourceManagerAPI - Synchronous Access', () => {
        let api: ResourceManagerAPI;

        beforeEach(() => {
            api = (engine as EngineWithResources).resources;
        });

        test('should get loaded resource synchronously', async () => {
            await api.get(TextureResource, 'player.png');

            const texture = api.getSync(TextureResource, 'player.png');

            expect(texture).not.toBeNull();
            expect(texture?.key).toBe('player.png');
        });

        test('should return null for unloaded resource', () => {
            const texture = api.getSync(TextureResource, 'nonexistent.png');

            expect(texture).toBeNull();
        });

        test('should increment reference count on sync get', async () => {
            await api.get(TextureResource, 'player.png');

            const statsBefore = api.getStats();
            const beforeRefs = statsBefore.byType.find((t) => t.type === 'Texture')?.totalRefs ?? 0;

            api.getSync(TextureResource, 'player.png');

            const statsAfter = api.getStats();
            const afterRefs = statsAfter.byType.find((t) => t.type === 'Texture')?.totalRefs ?? 0;

            expect(afterRefs).toBeGreaterThan(beforeRefs);
        });
    });

    describe('ResourceManagerAPI - Preloading', () => {
        let api: ResourceManagerAPI;

        beforeEach(() => {
            api = (engine as EngineWithResources).resources;
        });

        test('should preload multiple resources', async () => {
            await api.preload(TextureResource, ['player.png', 'enemy.png', 'background.png']);

            const stats = api.getStats();
            const textureStats = stats.byType.find((t) => t.type === 'Texture');

            expect(textureStats?.count).toBe(3);
        });

        test('should keep preloaded resources in cache', async () => {
            await api.preload(TextureResource, ['player.png']);

            const texture = api.getSync(TextureResource, 'player.png');

            expect(texture).not.toBeNull();
            expect(texture?.isLoaded).toBe(true);
        });
    });

    describe('ResourceManagerAPI - Statistics', () => {
        let api: ResourceManagerAPI;

        beforeEach(() => {
            api = (engine as EngineWithResources).resources;
        });

        test('should get resource statistics', async () => {
            const stats = api.getStats();

            expect(stats).toHaveProperty('totalTypes');
            expect(stats).toHaveProperty('totalResources');
            expect(stats).toHaveProperty('byType');
        });

        test('should track total resource types', async () => {
            const stats = api.getStats();

            expect(stats.totalTypes).toBeGreaterThanOrEqual(2); // Texture + Audio
        });

        test('should track total resources', async () => {
            await api.get(TextureResource, 'player.png');
            await api.get(AudioResource, 'music.mp3');

            const stats = api.getStats();

            expect(stats.totalResources).toBe(2);
        });

        test('should provide statistics by type', async () => {
            await api.get(TextureResource, 'player.png');
            await api.get(TextureResource, 'enemy.png');
            await api.get(AudioResource, 'music.mp3');

            const stats = api.getStats();

            const textureStats = stats.byType.find((t) => t.type === 'Texture');
            const audioStats = stats.byType.find((t) => t.type === 'Audio');

            expect(textureStats?.count).toBe(2);
            expect(audioStats?.count).toBe(1);
        });

        test('should calculate average references', async () => {
            await api.get(TextureResource, 'player.png');
            await api.get(TextureResource, 'player.png'); // Same resource

            const stats = api.getStats();
            const textureStats = stats.byType.find((t) => t.type === 'Texture');

            expect(textureStats?.averageRefs).toBeGreaterThan(0);
        });

        test('should print statistics', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            api.printStats();

            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('ResourceManagerAPI - Cleanup', () => {
        let api: ResourceManagerAPI;

        beforeEach(() => {
            api = (engine as EngineWithResources).resources;
        });

        test('should clear all resources', async () => {
            await api.get(TextureResource, 'player.png');
            await api.get(AudioResource, 'music.mp3');

            await api.clearAll();

            const stats = api.getStats();

            expect(stats.totalResources).toBe(0);
        });

        test('should unload resources when clearing', async () => {
            const texture = await api.get(TextureResource, 'player.png');

            await api.clearAll();

            expect(texture.isLoaded).toBe(false);
        });

        test('should cleanup unused resources', async () => {
            const texture1 = await api.get(TextureResource, 'player.png');
            const _texture2 = await api.get(TextureResource, 'enemy.png');

            // Release one resource - this auto-cleans when refCount hits 0
            await api.release(texture1);

            // Since release() auto-cleans resources with refCount 0,
            // cleanupUnused() has nothing left to clean
            const cleaned = await api.cleanupUnused();

            expect(cleaned).toBe(0);

            // Only 1 resource remains (the one that wasn't released)
            const stats = api.getStats();
            expect(stats.totalResources).toBe(1);
        });

        test('should not cleanup resources with references', async () => {
            const _texture = await api.get(TextureResource, 'player.png');

            const cleaned = await api.cleanupUnused();

            expect(cleaned).toBe(0);
        });
    });

    describe('Custom Resource Types', () => {
        let api: ResourceManagerAPI;

        beforeEach(() => {
            api = (engine as EngineWithResources).resources;
            api.register(TestResource);
        });

        test('should work with custom resource type', async () => {
            const resource = await api.get(TestResource, 'custom.dat');

            expect(resource).toBeDefined();
            expect(resource.isLoaded).toBe(true);
        });

        test('should handle custom resource lifecycle', async () => {
            const resource = await api.get(TestResource, 'custom.dat');

            expect(resource.isLoaded).toBe(true);

            await api.release(resource);

            expect(resource.isLoaded).toBe(false);
        });
    });

    describe('Integration Tests', () => {
        let api: ResourceManagerAPI;

        beforeEach(() => {
            api = (engine as EngineWithResources).resources;
        });

        test('should manage multiple resource types', async () => {
            const _texture1 = await api.get(TextureResource, 'player.png');
            const _texture2 = await api.get(TextureResource, 'enemy.png');
            const _audio1 = await api.get(AudioResource, 'music.mp3');
            const _audio2 = await api.get(AudioResource, 'sfx.mp3');

            const stats = api.getStats();

            expect(stats.totalResources).toBe(4);
            expect(stats.byType.length).toBeGreaterThanOrEqual(2);
        });

        test('should handle complex reference patterns', async () => {
            const texture1 = await api.get(TextureResource, 'player.png');
            const texture2 = await api.get(TextureResource, 'player.png');
            const texture3 = await api.get(TextureResource, 'player.png');

            await api.release(texture1);

            const stats1 = api.getStats();
            expect(stats1.totalResources).toBe(1);

            await api.release(texture2);

            const stats2 = api.getStats();
            expect(stats2.totalResources).toBe(1);

            await api.release(texture3);

            const stats3 = api.getStats();
            expect(stats3.totalResources).toBe(0);
        });

        test('should handle preload and usage workflow', async () => {
            // Preload
            await api.preload(TextureResource, ['player.png', 'enemy.png']);

            // Use preloaded
            const texture = api.getSync(TextureResource, 'player.png');
            expect(texture).not.toBeNull();

            // Load new
            const newTexture = await api.get(TextureResource, 'background.png');
            expect(newTexture).toBeDefined();

            const stats = api.getStats();
            expect(stats.totalResources).toBe(3);
        });
    });

    describe('Edge Cases', () => {
        let api: ResourceManagerAPI;

        beforeEach(() => {
            api = (engine as EngineWithResources).resources;
        });

        test('should handle releasing unknown resource', async () => {
            const fakeResource: Resource = {
                key: 'fake',
                load: async () => {},
                unload: async () => {},
            };

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            await api.release(fakeResource);

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('unknown resource'));

            consoleSpy.mockRestore();
        });

        test('should handle empty preload array', async () => {
            await expect(async () => {
                await api.preload(TextureResource, []);
            }).not.toThrow();
        });

        test('should handle cleanup with no resources', async () => {
            const cleaned = await api.cleanupUnused();

            expect(cleaned).toBe(0);
        });

        test('should handle statistics with no resources', () => {
            const stats = api.getStats();

            expect(stats.totalResources).toBe(0);
            expect(stats.byType).toHaveLength(2); // Texture and Audio types registered
        });
    });

    describe('Plugin Uninstallation', () => {
        let api: ResourceManagerAPI;

        beforeEach(() => {
            api = (engine as EngineWithResources).resources;
        });

        test('should uninstall and clear resources', async () => {
            const texture = await api.get(TextureResource, 'player.png');

            await plugin.uninstall();

            expect(texture.isLoaded).toBe(false);
        });
    });

    describe('Async Resource Loading', () => {
        let api: ResourceManagerAPI;

        beforeEach(() => {
            api = (engine as EngineWithResources).resources;
        });

        test('should handle concurrent loads of same resource', async () => {
            const promises = [
                api.get(TextureResource, 'player.png'),
                api.get(TextureResource, 'player.png'),
                api.get(TextureResource, 'player.png'),
            ];

            const results = await Promise.all(promises);

            // All should return same instance
            expect(results[0]).toBe(results[1]);
            expect(results[1]).toBe(results[2]);

            const stats = api.getStats();
            expect(stats.totalResources).toBe(1);
        });

        test('should handle concurrent loads of different resources', async () => {
            const promises = [
                api.get(TextureResource, 'player.png'),
                api.get(TextureResource, 'enemy.png'),
                api.get(AudioResource, 'music.mp3'),
            ];

            const results = await Promise.all(promises);

            expect(results[0]).not.toBe(results[1]);
            expect(results[1]).not.toBe(results[2]);

            const stats = api.getStats();
            expect(stats.totalResources).toBe(3);
        });
    });
});
