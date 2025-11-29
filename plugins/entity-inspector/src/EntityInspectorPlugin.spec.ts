/**
 * Unit tests for EntityInspectorPlugin
 */

import { EntityInspectorPlugin } from './EntityInspectorPlugin';
import type { EntityInspectorConfig } from './types';
import { DEFAULT_INSPECTOR_CONFIG } from './types';

// Mock PluginContext
const createMockContext = () => {
    const events = new Map<string, Set<(...args: unknown[]) => void>>();

    return {
        logger: {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            withTag: jest.fn().mockReturnThis(),
            isEnabled: jest.fn().mockReturnValue(true),
        },
        on: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
            if (!events.has(event)) {
                events.set(event, new Set());
            }
            events.get(event)?.add(callback);
            return () => {
                events.get(event)?.delete(callback);
            };
        }),
        emit: jest.fn((event: string, ...args: unknown[]) => {
            events.get(event)?.forEach((cb) => cb(...args));
        }),
        extend: jest.fn(),
        createSystem: jest.fn(),
        registerComponent: jest.fn(),
        getEngine: jest.fn(() => ({
            entities: new Map(),
            systems: new Map(),
            queries: new Map(),
            singletons: new Map(),
            getSystemProfiles: jest.fn(() => []),
            getMemoryStats: jest.fn(() => ({
                totalEntities: 0,
                activeEntities: 0,
                componentArrays: {},
            })),
            getComponentRegistry: jest.fn(() => new Map()),
            createEntity: jest.fn((name?: string) => ({
                id: Symbol(name || 'test-entity'),
                name,
                tags: new Set<string>(),
                children: [],
                isMarkedForDeletion: false,
                isDirty: false,
                parent: undefined,
                queueFree: jest.fn(),
                addComponent: jest.fn().mockReturnThis(),
                removeComponent: jest.fn().mockReturnThis(),
                hasComponent: jest.fn().mockReturnValue(false),
                getComponent: jest.fn(),
                addTag: jest.fn().mockReturnThis(),
                removeTag: jest.fn().mockReturnThis(),
                hasTag: jest.fn().mockReturnValue(false),
                setParent: jest.fn().mockReturnThis(),
                addChild: jest.fn().mockReturnThis(),
                removeChild: jest.fn().mockReturnThis(),
                serialize: jest.fn(),
            })),
        })),
        messageBus: {
            subscribe: jest.fn(() => jest.fn()),
            publish: jest.fn(),
        },
        registerComponentValidator: jest.fn(),
        setSingleton: jest.fn(),
        getSingleton: jest.fn(),
        hasSingleton: jest.fn(),
        removeSingleton: jest.fn(),
        createQuery: jest.fn(),
        registerPrefab: jest.fn(),
        definePrefab: jest.fn(),
        extendPrefab: jest.fn(),
        variantOfPrefab: jest.fn(),
    };
};

describe('EntityInspectorPlugin', () => {
    let plugin: EntityInspectorPlugin;
    let mockContext: ReturnType<typeof createMockContext>;

    beforeEach(() => {
        plugin = new EntityInspectorPlugin();
        mockContext = createMockContext();
    });

    afterEach(() => {
        // Clean up
        plugin.uninstall?.();
    });

    describe('constructor', () => {
        it('should use default configuration', () => {
            const defaultPlugin = new EntityInspectorPlugin();
            expect(defaultPlugin.name).toBe('EntityInspectorPlugin');
            expect(defaultPlugin.version).toBe('1.0.0');
        });

        it('should accept custom configuration', () => {
            const customConfig: Partial<EntityInspectorConfig> = {
                port: 9000,
                host: '0.0.0.0',
                debug: true,
            };
            const customPlugin = new EntityInspectorPlugin(customConfig);
            expect(customPlugin.name).toBe('EntityInspectorPlugin');
        });
    });

    describe('install', () => {
        it('should install successfully', () => {
            plugin.install(mockContext);

            expect(mockContext.extend).toHaveBeenCalledWith('inspector', expect.any(Object));
            expect(mockContext.createSystem).toHaveBeenCalled();
            expect(mockContext.logger.info).toHaveBeenCalledWith('EntityInspectorPlugin installed');
        });

        it('should subscribe to engine events', () => {
            plugin.install(mockContext);

            expect(mockContext.on).toHaveBeenCalledWith('onEntityCreated', expect.any(Function));
            expect(mockContext.on).toHaveBeenCalledWith('onEntityDestroyed', expect.any(Function));
            expect(mockContext.on).toHaveBeenCalledWith('onComponentAdded', expect.any(Function));
            expect(mockContext.on).toHaveBeenCalledWith('onComponentRemoved', expect.any(Function));
            expect(mockContext.on).toHaveBeenCalledWith('onTagChanged', expect.any(Function));
            expect(mockContext.on).toHaveBeenCalledWith('onSingletonSet', expect.any(Function));
            expect(mockContext.on).toHaveBeenCalledWith('onSingletonRemoved', expect.any(Function));
        });

        it('should create inspector frame system', () => {
            plugin.install(mockContext);

            expect(mockContext.createSystem).toHaveBeenCalledWith(
                'EntityInspectorFrameSystem',
                { all: [] },
                expect.objectContaining({
                    priority: Number.MAX_SAFE_INTEGER,
                    before: expect.any(Function),
                    after: expect.any(Function),
                }),
                false
            );
        });
    });

    describe('uninstall', () => {
        it('should clean up subscriptions', () => {
            // Track unsubscribe functions
            const unsubscribeFns: jest.Mock[] = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (mockContext as any).on = jest.fn((_event: string, _callback: unknown) => {
                const unsubscribe = jest.fn();
                unsubscribeFns.push(unsubscribe);
                return unsubscribe;
            });

            plugin.install(mockContext);
            plugin.uninstall?.();

            // All unsubscribe functions should have been called
            unsubscribeFns.forEach((fn) => {
                expect(fn).toHaveBeenCalled();
            });
        });
    });
});

describe('EntityInspectorAPI', () => {
    let plugin: EntityInspectorPlugin;
    let mockContext: ReturnType<typeof createMockContext>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let api: { inspector: any };

    beforeEach(() => {
        plugin = new EntityInspectorPlugin({ debug: true });
        mockContext = createMockContext();

        // Capture the API when extend is called
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mockContext as any).extend = jest.fn((name: string, apiObj: unknown) => {
            api = { inspector: null };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (api as any)[name] = apiObj;
        });

        plugin.install(mockContext);
    });

    afterEach(() => {
        plugin.uninstall?.();
    });

    describe('getEntities', () => {
        it('should return empty array when no entities', () => {
            const inspectorApi = api.inspector as { getEntities: () => unknown[] };
            const entities = inspectorApi.getEntities();
            expect(entities).toEqual([]);
        });

        it('should return an array type', () => {
            const inspectorApi = api.inspector as { getEntities: () => unknown[] };
            const entities = inspectorApi.getEntities();
            expect(Array.isArray(entities)).toBe(true);
        });
    });

    describe('getSystems', () => {
        it('should return an array of systems', () => {
            const inspectorApi = api.inspector as {
                getSystems: () => unknown[];
            };
            const systems = inspectorApi.getSystems();

            expect(Array.isArray(systems)).toBe(true);
        });
    });

    describe('getStats', () => {
        it('should return an object with stats properties', () => {
            const inspectorApi = api.inspector as {
                getStats: () => {
                    totalEntities: number;
                    activeEntities: number;
                    isPaused: boolean;
                };
            };
            const stats = inspectorApi.getStats();

            expect(typeof stats.totalEntities).toBe('number');
            expect(typeof stats.activeEntities).toBe('number');
            expect(typeof stats.isPaused).toBe('boolean');
        });
    });

    describe('pause/resume/step', () => {
        it('should track pause state', () => {
            const inspectorApi = api.inspector as {
                pause: () => void;
                resume: () => void;
                isPaused: boolean;
            };

            expect(inspectorApi.isPaused).toBe(false);

            inspectorApi.pause();
            expect(inspectorApi.isPaused).toBe(true);

            inspectorApi.resume();
            expect(inspectorApi.isPaused).toBe(false);
        });
    });

    describe('server lifecycle', () => {
        it('should report not running initially', () => {
            const inspectorApi = api.inspector as { isRunning: boolean };
            expect(inspectorApi.isRunning).toBe(false);
        });

        it('should return correct server URL', () => {
            const inspectorApi = api.inspector as { serverUrl: string };
            expect(inspectorApi.serverUrl).toBe('ws://localhost:8765');
        });
    });
});

describe('DEFAULT_INSPECTOR_CONFIG', () => {
    it('should have expected default values', () => {
        expect(DEFAULT_INSPECTOR_CONFIG.port).toBe(8765);
        expect(DEFAULT_INSPECTOR_CONFIG.host).toBe('localhost');
        expect(DEFAULT_INSPECTOR_CONFIG.updateInterval).toBe(100);
        expect(DEFAULT_INSPECTOR_CONFIG.maxEntities).toBe(1000);
        expect(DEFAULT_INSPECTOR_CONFIG.enableProfiling).toBe(true);
        expect(DEFAULT_INSPECTOR_CONFIG.enableMemoryStats).toBe(true);
        expect(DEFAULT_INSPECTOR_CONFIG.debug).toBe(false);
    });
});
