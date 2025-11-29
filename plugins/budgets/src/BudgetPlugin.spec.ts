/**
 * BudgetPlugin Test Suite
 *
 * Comprehensive tests covering:
 * - Plugin installation and API extension
 * - Time budget configuration and monitoring
 * - Memory budget configuration and monitoring
 * - Entity count budget configuration
 * - Frame time budget monitoring
 * - Enforcement modes (warning, strict, adaptive)
 * - Violation detection and reporting
 * - Dashboard and telemetry
 */

import { TestEngineBuilder } from '@orion-ecs/testing';
import type { Engine } from '../../../packages/core/src/index';
import { BudgetReportGenerator, JsonDashboardRenderer, TextDashboard } from './BudgetDashboard';
import type { EngineRef } from './BudgetManager';
import { BudgetManager } from './BudgetManager';
import type { IBudgetAPI } from './BudgetPlugin';
import { BudgetPlugin } from './BudgetPlugin';
import type { BudgetEvent, BudgetViolation } from './types';

// Type extensions for testing
interface EngineWithBudgets extends Engine {
    budgets: IBudgetAPI;
}

// Test components
class Position {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

class Velocity {
    constructor(
        public dx: number = 0,
        public dy: number = 0
    ) {}
}

class Health {
    constructor(public value: number = 100) {}
}

// =============================================================================
// BudgetPlugin Tests
// =============================================================================

describe('BudgetPlugin', () => {
    let engine: Engine;
    let plugin: BudgetPlugin;

    beforeEach(() => {
        plugin = new BudgetPlugin({
            autoCheck: true,
            defaultEnforcementMode: 'warning',
        });
        engine = new TestEngineBuilder().use(plugin).build();

        engine.registerComponent(Position);
        engine.registerComponent(Velocity);
        engine.registerComponent(Health);
    });

    afterEach(() => {
        engine.stop();
    });

    describe('Plugin Metadata', () => {
        test('should have correct name and version', () => {
            expect(plugin.name).toBe('BudgetPlugin');
            expect(plugin.version).toBe('1.0.0');
        });
    });

    describe('Plugin Installation', () => {
        test('should install successfully', () => {
            expect(engine).toBeDefined();
        });

        test('should extend engine with budgets API', () => {
            const engineWithBudgets = engine as EngineWithBudgets;
            expect(engineWithBudgets.budgets).toBeDefined();
        });

        test('should provide all API methods', () => {
            const api = (engine as EngineWithBudgets).budgets;

            expect(typeof api.addTimeBudget).toBe('function');
            expect(typeof api.addMemoryBudget).toBe('function');
            expect(typeof api.addEntityCountBudget).toBe('function');
            expect(typeof api.addFrameTimeBudget).toBe('function');
            expect(typeof api.addQueryTimeBudget).toBe('function');
            expect(typeof api.removeBudget).toBe('function');
            expect(typeof api.getBudget).toBe('function');
            expect(typeof api.getAllBudgets).toBe('function');
            expect(typeof api.getMetrics).toBe('function');
            expect(typeof api.onEvent).toBe('function');
            expect(typeof api.printSummary).toBe('function');
        });
    });

    describe('Time Budget', () => {
        let api: IBudgetAPI;

        beforeEach(() => {
            api = (engine as EngineWithBudgets).budgets;
        });

        test('should add time budget with default options', () => {
            const budgetId = api.addTimeBudget('TestSystem', 5.0);

            expect(budgetId).toBeDefined();
            expect(budgetId).toContain('budget_time_');

            const budget = api.getBudget(budgetId);
            expect(budget).toBeDefined();
            expect(budget?.config.type).toBe('time');
            expect(budget?.config.name).toContain('TestSystem');
        });

        test('should add time budget with custom options', () => {
            const budgetId = api.addTimeBudget('PhysicsSystem', 10.0, {
                name: 'Custom Physics Budget',
                enforcementMode: 'strict',
                warningThreshold: 0.75,
                useAverageWindow: true,
                averageWindowSize: 20,
                tags: ['physics', 'critical'],
            });

            const budget = api.getBudget(budgetId);
            expect(budget?.config.name).toBe('Custom Physics Budget');
            expect(budget?.config.enforcementMode).toBe('strict');
            expect(budget?.config.warningThreshold).toBe(0.75);
        });

        test('should remove time budget', () => {
            const budgetId = api.addTimeBudget('TestSystem', 5.0);
            expect(api.getBudget(budgetId)).toBeDefined();

            const removed = api.removeBudget(budgetId);
            expect(removed).toBe(true);
            expect(api.getBudget(budgetId)).toBeUndefined();
        });
    });

    describe('Memory Budget', () => {
        let api: IBudgetAPI;

        beforeEach(() => {
            api = (engine as EngineWithBudgets).budgets;
        });

        test('should add total memory budget', () => {
            const budgetId = api.addMemoryBudget(100 * 1024 * 1024); // 100 MB

            const budget = api.getBudget(budgetId);
            expect(budget).toBeDefined();
            expect(budget?.config.type).toBe('memory');
        });

        test('should add component-specific memory budget', () => {
            const budgetId = api.addMemoryBudget(10 * 1024 * 1024, 'Position');

            const budget = api.getBudget(budgetId);
            expect(budget).toBeDefined();
            expect(budget?.config.name).toContain('Position');
        });
    });

    describe('Entity Count Budget', () => {
        let api: IBudgetAPI;

        beforeEach(() => {
            api = (engine as EngineWithBudgets).budgets;
        });

        test('should add entity count budget', () => {
            const budgetId = api.addEntityCountBudget(10000);

            const budget = api.getBudget(budgetId);
            expect(budget).toBeDefined();
            expect(budget?.config.type).toBe('entityCount');
        });

        test('should add entity count budget with tag filter', () => {
            const budgetId = api.addEntityCountBudget(1000, {
                tagFilter: 'enemy',
                name: 'Enemy Count Budget',
            });

            const budget = api.getBudget(budgetId);
            expect(budget?.config.name).toBe('Enemy Count Budget');
        });
    });

    describe('Frame Time Budget', () => {
        let api: IBudgetAPI;

        beforeEach(() => {
            api = (engine as EngineWithBudgets).budgets;
        });

        test('should add 60 FPS frame time budget', () => {
            const budgetId = api.addFrameTimeBudget(16.67);

            const budget = api.getBudget(budgetId);
            expect(budget).toBeDefined();
            expect(budget?.config.type).toBe('frameTime');
            expect(budget?.config.name).toContain('60 FPS');
        });

        test('should add 30 FPS frame time budget', () => {
            const budgetId = api.addFrameTimeBudget(33.33);

            const budget = api.getBudget(budgetId);
            expect(budget?.config.name).toContain('30 FPS');
        });
    });

    describe('Query Time Budget', () => {
        let api: IBudgetAPI;

        beforeEach(() => {
            api = (engine as EngineWithBudgets).budgets;
        });

        test('should add query time budget', () => {
            const budgetId = api.addQueryTimeBudget(1.0);

            const budget = api.getBudget(budgetId);
            expect(budget).toBeDefined();
            expect(budget?.config.type).toBe('queryTime');
        });
    });

    describe('Budget Management', () => {
        let api: IBudgetAPI;

        beforeEach(() => {
            api = (engine as EngineWithBudgets).budgets;
        });

        test('should get all budgets', () => {
            api.addTimeBudget('System1', 5.0);
            api.addTimeBudget('System2', 10.0);
            api.addEntityCountBudget(5000);

            const budgets = api.getAllBudgets();
            expect(budgets.length).toBe(3);
        });

        test('should get budgets by type', () => {
            api.addTimeBudget('System1', 5.0);
            api.addTimeBudget('System2', 10.0);
            api.addEntityCountBudget(5000);
            api.addMemoryBudget(50 * 1024 * 1024);

            const timeBudgets = api.getBudgetsByType('time');
            expect(timeBudgets.length).toBe(2);

            const entityBudgets = api.getBudgetsByType('entityCount');
            expect(entityBudgets.length).toBe(1);
        });

        test('should enable and disable budgets', () => {
            const budgetId = api.addTimeBudget('TestSystem', 5.0);

            let budget = api.getBudget(budgetId);
            expect(budget?.config.enabled).toBe(true);

            api.setBudgetEnabled(budgetId, false);
            budget = api.getBudget(budgetId);
            expect(budget?.config.enabled).toBe(false);

            api.setBudgetEnabled(budgetId, true);
            budget = api.getBudget(budgetId);
            expect(budget?.config.enabled).toBe(true);
        });

        test('should enable all budgets', () => {
            const id1 = api.addTimeBudget('System1', 5.0);
            const id2 = api.addTimeBudget('System2', 10.0);

            api.setBudgetEnabled(id1, false);
            api.setBudgetEnabled(id2, false);

            api.enableAll();

            expect(api.getBudget(id1)?.config.enabled).toBe(true);
            expect(api.getBudget(id2)?.config.enabled).toBe(true);
        });

        test('should disable all budgets', () => {
            const id1 = api.addTimeBudget('System1', 5.0);
            const id2 = api.addTimeBudget('System2', 10.0);

            api.disableAll();

            expect(api.getBudget(id1)?.config.enabled).toBe(false);
            expect(api.getBudget(id2)?.config.enabled).toBe(false);
        });

        test('should change enforcement mode', () => {
            const budgetId = api.addTimeBudget('TestSystem', 5.0, {
                enforcementMode: 'warning',
            });

            api.setEnforcementMode(budgetId, 'strict');

            const budget = api.getBudget(budgetId);
            expect(budget?.config.enforcementMode).toBe('strict');
        });
    });

    describe('Metrics', () => {
        let api: IBudgetAPI;

        beforeEach(() => {
            api = (engine as EngineWithBudgets).budgets;
        });

        test('should return initial metrics', () => {
            const metrics = api.getMetrics();

            expect(metrics).toBeDefined();
            expect(metrics.totalBudgets).toBe(0);
            expect(metrics.violatedBudgets).toBe(0);
            expect(metrics.warningBudgets).toBe(0);
            expect(metrics.healthScore).toBe(100);
            expect(metrics.timestamp).toBeDefined();
        });

        test('should track budget count in metrics', () => {
            api.addTimeBudget('System1', 5.0);
            api.addTimeBudget('System2', 10.0);
            api.addEntityCountBudget(5000);

            const metrics = api.getMetrics();
            expect(metrics.totalBudgets).toBe(3);
        });

        test('should reset stats', () => {
            api.addTimeBudget('TestSystem', 5.0);
            engine.update(16);

            api.resetStats();

            const budgets = api.getAllBudgets();
            for (const budget of budgets) {
                expect(budget.violationStats.totalViolations).toBe(0);
            }
        });
    });

    describe('Event Handling', () => {
        let api: IBudgetAPI;

        beforeEach(() => {
            api = (engine as EngineWithBudgets).budgets;
        });

        test('should subscribe to events', () => {
            const events: BudgetEvent[] = [];
            const unsubscribe = api.onEvent((event) => {
                events.push(event);
            });

            expect(typeof unsubscribe).toBe('function');
        });

        test('should unsubscribe from events', () => {
            const events: BudgetEvent[] = [];
            const unsubscribe = api.onEvent((event) => {
                events.push(event);
            });

            unsubscribe();
            // After unsubscribing, no new events should be captured
            expect(events.length).toBe(0);
        });

        test('should subscribe to violation events', () => {
            const violations: BudgetViolation[] = [];
            const unsubscribe = api.onViolation((event) => {
                violations.push(event.violation);
            });

            expect(typeof unsubscribe).toBe('function');
        });

        test('should subscribe to warning events', () => {
            const warnings: BudgetEvent[] = [];
            const unsubscribe = api.onWarning((event) => {
                warnings.push(event);
            });

            expect(typeof unsubscribe).toBe('function');
        });
    });

    describe('Dashboard', () => {
        let api: IBudgetAPI;

        beforeEach(() => {
            api = (engine as EngineWithBudgets).budgets;
        });

        test('should get dashboard data', () => {
            api.addTimeBudget('TestSystem', 5.0);
            api.addEntityCountBudget(10000);

            const data = api.getDashboardData();

            expect(data).toBeDefined();
            expect(data.metrics).toBeDefined();
            expect(data.budgets).toBeDefined();
            expect(data.budgets.length).toBe(2);
            expect(data.recentViolations).toBeDefined();
            expect(data.timestamp).toBeDefined();
        });

        test('should configure dashboard', () => {
            expect(() => {
                api.configureDashboard({
                    enabled: true,
                    updateIntervalMs: 1000,
                    position: 'bottom-left',
                });
            }).not.toThrow();
        });
    });

    describe('Print Summary', () => {
        test('should print summary without errors', () => {
            const api = (engine as EngineWithBudgets).budgets;

            api.addTimeBudget('TestSystem', 5.0);
            api.addEntityCountBudget(10000);

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            expect(() => {
                api.printSummary();
            }).not.toThrow();

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});

// =============================================================================
// BudgetManager Tests
// =============================================================================

// Mock type for test engine
interface MockEngineRef {
    getSystemProfiles: jest.Mock;
    getMemoryStats: jest.Mock;
    getPerformanceStats: jest.Mock;
    getEntityCount: jest.Mock;
    getEntitiesWithTag: jest.Mock;
    getQueryStats: jest.Mock;
    disableSystem?: jest.Mock;
    enableSystem?: jest.Mock;
}

describe('BudgetManager', () => {
    let manager: BudgetManager;
    let mockEngine: MockEngineRef;

    beforeEach(() => {
        mockEngine = {
            getSystemProfiles: jest.fn().mockReturnValue([
                {
                    name: 'TestSystem',
                    executionTime: 2.0,
                    entityCount: 100,
                    callCount: 1,
                    averageTime: 2.0,
                },
            ]),
            getMemoryStats: jest.fn().mockReturnValue({
                totalEntities: 500,
                activeEntities: 450,
                componentArrays: { Position: 500, Velocity: 300 },
                totalMemoryEstimate: 50000,
            }),
            getPerformanceStats: jest.fn().mockReturnValue({
                averageFrameTime: 16.0,
                minFrameTime: 14.0,
                maxFrameTime: 18.0,
            }),
            getEntityCount: jest.fn().mockReturnValue(500),
            getEntitiesWithTag: jest.fn().mockReturnValue([]),
            getQueryStats: jest.fn().mockReturnValue([{ averageTimeMs: 0.5 }]),
        };

        manager = new BudgetManager(mockEngine as EngineRef);
    });

    describe('Budget Registration', () => {
        test('should add and retrieve time budget', () => {
            const id = manager.addTimeBudget('TestSystem', 5.0);

            const budget = manager.getBudget(id);
            expect(budget).toBeDefined();
            expect(budget?.config.type).toBe('time');
        });

        test('should add and retrieve memory budget', () => {
            const id = manager.addMemoryBudget(100000);

            const budget = manager.getBudget(id);
            expect(budget).toBeDefined();
            expect(budget?.config.type).toBe('memory');
        });

        test('should add and retrieve entity count budget', () => {
            const id = manager.addEntityCountBudget(1000);

            const budget = manager.getBudget(id);
            expect(budget).toBeDefined();
            expect(budget?.config.type).toBe('entityCount');
        });

        test('should add and retrieve frame time budget', () => {
            const id = manager.addFrameTimeBudget(16.67);

            const budget = manager.getBudget(id);
            expect(budget).toBeDefined();
            expect(budget?.config.type).toBe('frameTime');
        });

        test('should generate unique IDs', () => {
            const id1 = manager.addTimeBudget('System1', 5.0);
            const id2 = manager.addTimeBudget('System2', 10.0);

            expect(id1).not.toBe(id2);
        });
    });

    describe('Budget Checking', () => {
        test('should check all budgets without error', () => {
            manager.addTimeBudget('TestSystem', 5.0);
            manager.addEntityCountBudget(1000);

            expect(() => {
                manager.checkBudgets();
            }).not.toThrow();
        });

        test('should update budget state after check', () => {
            const id = manager.addTimeBudget('TestSystem', 5.0);

            manager.checkBudgets();

            const budget = manager.getBudget(id);
            expect(budget?.lastCheckTime).toBeGreaterThan(0);
            expect(budget?.currentValue).toBeDefined();
        });

        test('should detect time budget violation', () => {
            // Mock system that exceeds budget
            mockEngine.getSystemProfiles.mockReturnValue([
                {
                    name: 'SlowSystem',
                    executionTime: 10.0,
                    entityCount: 100,
                    callCount: 1,
                    averageTime: 10.0,
                },
            ]);

            const id = manager.addTimeBudget('SlowSystem', 5.0);

            manager.checkBudgets();

            const budget = manager.getBudget(id);
            expect(budget?.isViolated).toBe(true);
        });

        test('should detect entity count violation', () => {
            mockEngine.getEntityCount.mockReturnValue(1500);

            const id = manager.addEntityCountBudget(1000);

            manager.checkBudgets();

            const budget = manager.getBudget(id);
            expect(budget?.isViolated).toBe(true);
        });

        test('should skip disabled budgets', () => {
            const id = manager.addTimeBudget('TestSystem', 5.0);
            manager.setBudgetEnabled(id, false);

            manager.checkBudgets();

            const budget = manager.getBudget(id);
            expect(budget?.lastCheckTime).toBe(0);
        });
    });

    describe('Enforcement Modes', () => {
        test('should log warning in warning mode', () => {
            mockEngine.getSystemProfiles.mockReturnValue([
                {
                    name: 'SlowSystem',
                    executionTime: 10.0,
                    entityCount: 100,
                    callCount: 1,
                    averageTime: 10.0,
                },
            ]);

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            manager.addTimeBudget('SlowSystem', 5.0, { enforcementMode: 'warning' });
            manager.checkBudgets();

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('exceeded'));
            consoleSpy.mockRestore();
        });

        test('should throw error in strict mode', () => {
            mockEngine.getSystemProfiles.mockReturnValue([
                {
                    name: 'SlowSystem',
                    executionTime: 10.0,
                    entityCount: 100,
                    callCount: 1,
                    averageTime: 10.0,
                },
            ]);

            manager.addTimeBudget('SlowSystem', 5.0, { enforcementMode: 'strict' });

            expect(() => {
                manager.checkBudgets();
            }).toThrow('Budget violation');
        });

        test('should handle adaptive mode', () => {
            mockEngine.getSystemProfiles.mockReturnValue([
                {
                    name: 'SlowSystem',
                    executionTime: 10.0,
                    entityCount: 100,
                    callCount: 1,
                    averageTime: 10.0,
                },
            ]);

            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            manager.addTimeBudget('SlowSystem', 5.0, { enforcementMode: 'adaptive' });

            // Multiple violations to trigger escalation
            manager.checkBudgets();
            manager.checkBudgets();
            manager.checkBudgets();

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('Event System', () => {
        test('should emit violation events', () => {
            mockEngine.getSystemProfiles.mockReturnValue([
                {
                    name: 'SlowSystem',
                    executionTime: 10.0,
                    entityCount: 100,
                    callCount: 1,
                    averageTime: 10.0,
                },
            ]);

            const events: BudgetEvent[] = [];
            manager.onBudgetEvent((event) => events.push(event));

            manager.addTimeBudget('SlowSystem', 5.0);
            manager.checkBudgets();

            const violationEvents = events.filter((e) => e.type === 'budgetViolation');
            expect(violationEvents.length).toBeGreaterThan(0);
        });

        test('should emit warning events', () => {
            // Set up value that triggers warning but not violation
            mockEngine.getSystemProfiles.mockReturnValue([
                {
                    name: 'WarnSystem',
                    executionTime: 4.5,
                    entityCount: 100,
                    callCount: 1,
                    averageTime: 4.5,
                },
            ]);

            const events: BudgetEvent[] = [];
            manager.onBudgetEvent((event) => events.push(event));

            manager.addTimeBudget('WarnSystem', 5.0, { warningThreshold: 0.8 });
            manager.checkBudgets();

            const warningEvents = events.filter((e) => e.type === 'budgetWarning');
            expect(warningEvents.length).toBeGreaterThan(0);
        });

        test('should allow unsubscribing', () => {
            const events: BudgetEvent[] = [];
            const unsubscribe = manager.onBudgetEvent((event) => events.push(event));

            unsubscribe();

            mockEngine.getSystemProfiles.mockReturnValue([
                {
                    name: 'SlowSystem',
                    executionTime: 10.0,
                    entityCount: 100,
                    callCount: 1,
                    averageTime: 10.0,
                },
            ]);

            manager.addTimeBudget('SlowSystem', 5.0);
            manager.checkBudgets();

            expect(events.length).toBe(0);
        });
    });

    describe('Metrics', () => {
        test('should calculate health score correctly', () => {
            // No violations - should be 100%
            manager.addTimeBudget('FastSystem', 5.0);

            const metrics = manager.getMetrics();
            expect(metrics.healthScore).toBe(100);
        });

        test('should reduce health score with violations', () => {
            mockEngine.getSystemProfiles.mockReturnValue([
                {
                    name: 'SlowSystem',
                    executionTime: 10.0,
                    entityCount: 100,
                    callCount: 1,
                    averageTime: 10.0,
                },
            ]);

            manager.addTimeBudget('SlowSystem', 5.0);
            manager.checkBudgets();

            const metrics = manager.getMetrics();
            expect(metrics.healthScore).toBeLessThan(100);
            expect(metrics.violatedBudgets).toBe(1);
        });

        test('should track overhead', () => {
            manager.addTimeBudget('System1', 5.0);
            manager.addTimeBudget('System2', 10.0);
            manager.addEntityCountBudget(1000);

            manager.checkBudgets();

            const metrics = manager.getMetrics();
            expect(metrics.overheadMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Print Summary', () => {
        test('should print without errors', () => {
            manager.addTimeBudget('System1', 5.0);
            manager.addEntityCountBudget(1000);

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            expect(() => {
                manager.printSummary();
            }).not.toThrow();

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});

// =============================================================================
// Dashboard Renderer Tests
// =============================================================================

describe('Dashboard Renderers', () => {
    const mockDashboardData = {
        metrics: {
            totalBudgets: 3,
            violatedBudgets: 1,
            warningBudgets: 1,
            totalViolations: 5,
            violationsLastMinute: 2,
            healthScore: 70,
            overheadMs: 0.5,
            timestamp: Date.now(),
        },
        budgets: [
            {
                config: {
                    id: 'budget_1',
                    name: 'Test Budget',
                    type: 'time' as const,
                    maxTimeMs: 5.0,
                    systemName: 'TestSystem',
                    enforcementMode: 'warning' as const,
                    enabled: true,
                },
                isViolated: false,
                isWarning: false,
                currentValue: 2.0,
                recentValues: [2.0, 2.1, 2.0],
                maxHistorySize: 60,
                violationStats: {
                    budgetId: 'budget_1',
                    totalViolations: 0,
                    recentViolations: 0,
                    recentWindowMs: 60000,
                    averageOverageRatio: 0,
                    maxOverageRatio: 0,
                    violationRate: 0,
                    trend: 'stable' as const,
                },
                lastCheckTime: Date.now(),
            },
        ],
        recentViolations: [],
        timestamp: Date.now(),
    };

    describe('TextDashboard', () => {
        test('should render dashboard as text', () => {
            const dashboard = new TextDashboard();
            const output = dashboard.render(mockDashboardData);

            expect(output).toContain('PERFORMANCE BUDGET DASHBOARD');
            expect(output).toContain('Health');
            expect(output).toContain('Test Budget');
        });

        test('should handle custom width', () => {
            const dashboard = new TextDashboard(50);
            const output = dashboard.render(mockDashboardData);

            expect(output).toBeDefined();
        });
    });

    describe('JsonDashboardRenderer', () => {
        test('should render dashboard as JSON', () => {
            const renderer = new JsonDashboardRenderer();
            const output = renderer.render(mockDashboardData);

            expect(() => JSON.parse(output)).not.toThrow();

            const parsed = JSON.parse(output);
            expect(parsed.metrics).toBeDefined();
            expect(parsed.budgets).toBeDefined();
        });

        test('should render pretty JSON', () => {
            const renderer = new JsonDashboardRenderer();
            const output = renderer.render(mockDashboardData, true);

            expect(output).toContain('\n');
        });
    });

    describe('BudgetReportGenerator', () => {
        test('should generate report', () => {
            const generator = new BudgetReportGenerator();
            const report = generator.generateReport(mockDashboardData);

            expect(report).toContain('PERFORMANCE BUDGET REPORT');
            expect(report).toContain('EXECUTIVE SUMMARY');
            expect(report).toContain('RECOMMENDATIONS');
        });
    });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Budget System Integration', () => {
    let engine: Engine;
    let plugin: BudgetPlugin;

    beforeEach(() => {
        plugin = new BudgetPlugin({ autoCheck: true });
        engine = new TestEngineBuilder().withProfiling(true).use(plugin).build();

        engine.registerComponent(Position);
        engine.registerComponent(Velocity);

        // Create a system for testing
        engine.createSystem(
            'MovementSystem',
            { all: [Position] },
            {
                act: (_entity, pos: Position) => {
                    pos.x += 1;
                    pos.y += 1;
                },
            }
        );
    });

    afterEach(() => {
        engine.stop();
    });

    test('should monitor system performance over multiple frames', () => {
        const api = (engine as EngineWithBudgets).budgets;

        // Create some entities
        for (let i = 0; i < 100; i++) {
            engine
                .createEntity(`Entity${i}`)
                .addComponent(Position, i, i)
                .addComponent(Velocity, 1, 1);
        }

        // Add budget
        api.addTimeBudget('MovementSystem', 10.0);

        // Run several frames
        for (let i = 0; i < 10; i++) {
            engine.update(16);
        }

        // Check metrics
        const metrics = api.getMetrics();
        expect(metrics.totalBudgets).toBe(1);
    });

    test('should work with multiple budget types', () => {
        const api = (engine as EngineWithBudgets).budgets;

        api.addTimeBudget('MovementSystem', 10.0);
        api.addFrameTimeBudget(16.67);
        api.addEntityCountBudget(1000);

        // Create entities
        for (let i = 0; i < 50; i++) {
            engine.createEntity().addComponent(Position);
        }

        engine.update(16);

        const metrics = api.getMetrics();
        expect(metrics.totalBudgets).toBe(3);
    });
});
