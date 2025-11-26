/**
 * Debug Visualizer Plugin for Orion ECS
 *
 * Provides tools for visualizing and analyzing engine state.
 * This plugin demonstrates:
 * - Entity hierarchy visualization
 * - Component usage statistics
 * - System execution timeline
 * - Query performance analysis
 */

import type { EnginePlugin, PluginContext } from '@orion-ecs/plugin-api';

// Local type definitions for entities and profiles
interface EntityDef {
    id: symbol;
    name?: string;
    tags: Set<string>;
    children: Set<EntityDef>;
    parent?: EntityDef;
    hasComponent?: (type: any) => boolean;
}

interface SystemProfile {
    name: string;
    executionTime: number;
    entityCount: number;
    callCount: number;
    averageTime: number;
}

// =============================================================================
// Debug API Interface
// =============================================================================

/**
 * Debug API interface for type-safe engine extension.
 */
export interface IDebugAPI {
    /** Print entity hierarchy as a tree structure */
    printHierarchy(rootEntity?: EntityDef): string;
    /** Print component usage statistics */
    printComponentStats(): string;
    /** Get system execution timeline for analysis */
    getSystemTimeline(): any[];
    /** Export timeline to Chrome DevTools trace format */
    exportChromeTrace(): string;
    /** Analyze query performance */
    analyzeQuery(query: any): string;
    /** Get detailed debug information about the engine state */
    getDebugInfo(): {
        entityCount: number;
        systemCount: number;
        queryCount: number;
        componentTypes: number;
        memoryStats: any;
    };
    /** Print comprehensive debug summary */
    printDebugSummary(): string;
}

// =============================================================================
// Debug API Implementation
// =============================================================================

/**
 * Debug API implementation class.
 */
export class DebugAPI implements IDebugAPI {
    private engine: any;

    constructor(engine: any) {
        this.engine = engine;
    }

    /**
     * Print entity hierarchy as a tree structure
     */
    printHierarchy(rootEntity?: EntityDef): string {
        const output: string[] = [];
        const entities = rootEntity ? [rootEntity] : this.getAllRootEntities();

        const printEntity = (entity: EntityDef, indent: string = '', isLast: boolean = true) => {
            const prefix = indent + (isLast ? '└─ ' : '├─ ');
            const name = entity.name || `Entity(${entity.id.toString()})`;
            const tags = entity.tags.size > 0 ? ` [${Array.from(entity.tags).join(', ')}]` : '';
            const components = this.getEntityComponents(entity);
            const componentInfo = components.length > 0 ? ` (${components.join(', ')})` : '';

            output.push(`${prefix}${name}${tags}${componentInfo}`);

            const children = Array.from(entity.children);
            children.forEach((child, index) => {
                const childIndent = indent + (isLast ? '    ' : '│   ');
                printEntity(child, childIndent, index === children.length - 1);
            });
        };

        if (entities.length === 0) {
            output.push('(No root entities)');
        } else {
            output.push('Entity Hierarchy:');
            entities.forEach((entity, index) => {
                printEntity(entity, '', index === entities.length - 1);
            });
        }

        const result = output.join('\n');
        console.log(result);
        return result;
    }

    /**
     * Print component usage statistics
     */
    printComponentStats(): string {
        const output: string[] = [];
        const stats = this.getComponentUsageStats();

        output.push('Component Statistics:');
        output.push('─'.repeat(50));

        if (stats.length === 0) {
            output.push('(No components registered)');
        } else {
            const maxNameLength = Math.max(...stats.map(s => s.name.length));

            stats.forEach(stat => {
                const name = stat.name.padEnd(maxNameLength);
                const count = stat.count.toString().padStart(6);
                const percentage = ((stat.count / stat.totalEntities) * 100).toFixed(1).padStart(5);
                output.push(`  ${name}: ${count} entities (${percentage}%)`);
            });

            output.push('─'.repeat(50));
            output.push(`Total entities: ${stats[0]?.totalEntities || 0}`);
        }

        const result = output.join('\n');
        console.log(result);
        return result;
    }

    /**
     * Get system execution timeline for analysis
     * Returns data in Chrome DevTools trace format
     */
    getSystemTimeline(): any[] {
        const timeline: any[] = [];
        const profiles = this.engine.getSystemProfiles?.() || [];
        let timestamp = 0;

        profiles.forEach((profile: SystemProfile) => {
            // Add trace event for Chrome DevTools
            timeline.push({
                name: profile.name,
                cat: 'system',
                ph: 'X', // Complete event
                ts: timestamp * 1000, // Microseconds
                dur: profile.executionTime * 1000, // Microseconds
                pid: 1,
                tid: 1,
                args: {
                    entityCount: profile.entityCount,
                    callCount: profile.callCount,
                    averageTime: profile.averageTime,
                }
            });

            timestamp += profile.executionTime;
        });

        return timeline;
    }

    /**
     * Export timeline to Chrome DevTools trace format
     */
    exportChromeTrace(): string {
        const timeline = this.getSystemTimeline();
        const trace = {
            traceEvents: timeline,
            displayTimeUnit: 'ms',
            systemTraceEvents: 'SystemTimeline',
            otherData: {
                version: 'OrionECS Debug Trace'
            }
        };

        return JSON.stringify(trace, null, 2);
    }

    /**
     * Analyze query performance
     */
    analyzeQuery(query: any): string {
        const output: string[] = [];

        output.push('Query Performance Analysis:');
        output.push('─'.repeat(50));

        // Get entities matching the query
        const entities = query.entities || [];
        const matchCount = entities.length;

        // Measure query execution time
        const startTime = performance.now();
        query.entities; // Access entities to trigger query
        const executionTime = performance.now() - startTime;

        output.push(`  Matching entities: ${matchCount}`);
        output.push(`  Execution time: ${executionTime.toFixed(3)}ms`);

        // Analyze query options
        const options = query.options || {};
        if (options.all && options.all.length > 0) {
            output.push(`  Required components (ALL): ${options.all.map((c: any) => c.name).join(', ')}`);
        }
        if (options.any && options.any.length > 0) {
            output.push(`  Optional components (ANY): ${options.any.map((c: any) => c.name).join(', ')}`);
        }
        if (options.none && options.none.length > 0) {
            output.push(`  Excluded components (NONE): ${options.none.map((c: any) => c.name).join(', ')}`);
        }
        if (options.tags && options.tags.length > 0) {
            output.push(`  Required tags: ${options.tags.join(', ')}`);
        }

        // Performance suggestions
        output.push('');
        output.push('Optimization Suggestions:');
        if (matchCount === 0) {
            output.push('  ⚠ Query matches no entities - consider removing if unused');
        } else if (matchCount > 1000) {
            output.push('  ⚠ Query matches many entities (>1000) - consider more specific constraints');
        }
        if (executionTime > 1) {
            output.push('  ⚠ Query execution time is high - consider caching results');
        }
        if (!options.all && !options.any) {
            output.push('  ℹ Query has no component constraints - will match all entities');
        }

        output.push('─'.repeat(50));

        const result = output.join('\n');
        console.log(result);
        return result;
    }

    /**
     * Get detailed debug information about the engine state
     */
    getDebugInfo(): {
        entityCount: number;
        systemCount: number;
        queryCount: number;
        componentTypes: number;
        memoryStats: any;
    } {
        const memoryStats = this.engine.getMemoryStats?.() || {};

        return {
            entityCount: memoryStats.totalEntities || 0,
            systemCount: this.engine.systems?.size || 0,
            queryCount: this.engine.queries?.size || 0,
            componentTypes: Object.keys(memoryStats.componentArrays || {}).length,
            memoryStats,
        };
    }

    /**
     * Print comprehensive debug summary
     */
    printDebugSummary(): string {
        const output: string[] = [];
        const info = this.getDebugInfo();

        output.push('');
        output.push('═'.repeat(60));
        output.push('  ORION ECS DEBUG SUMMARY');
        output.push('═'.repeat(60));
        output.push('');
        output.push(`  Total Entities: ${info.entityCount}`);
        output.push(`  Active Systems: ${info.systemCount}`);
        output.push(`  Registered Queries: ${info.queryCount}`);
        output.push(`  Component Types: ${info.componentTypes}`);
        output.push('');
        output.push('═'.repeat(60));
        output.push('');

        const result = output.join('\n');
        console.log(result);
        return result;
    }

    // Helper methods

    private getAllRootEntities(): EntityDef[] {
        const allEntities = this.engine.entities || new Map();
        const rootEntities: EntityDef[] = [];

        for (const entity of allEntities.values()) {
            if (!entity.parent) {
                rootEntities.push(entity);
            }
        }

        return rootEntities;
    }

    private getEntityComponents(entity: EntityDef): string[] {
        const components: string[] = [];
        const memoryStats = this.engine.getMemoryStats?.() || {};
        const componentArrays = memoryStats.componentArrays || {};

        for (const componentName in componentArrays) {
            if (entity.hasComponent) {
                // Try to check if entity has this component
                // This is a simplified check - actual implementation may vary
                try {
                    const componentClass = (this.engine as any)[componentName];
                    if (componentClass && entity.hasComponent(componentClass)) {
                        components.push(componentName);
                    }
                } catch (e) {
                    // Component check failed, skip
                }
            }
        }

        return components;
    }

    private getComponentUsageStats(): Array<{
        name: string;
        count: number;
        totalEntities: number;
    }> {
        const stats: Array<{ name: string; count: number; totalEntities: number }> = [];
        const memoryStats = this.engine.getMemoryStats?.() || {};
        const componentArrays = memoryStats.componentArrays || {};
        const totalEntities = memoryStats.activeEntities || 0;

        for (const [componentName, count] of Object.entries(componentArrays)) {
            stats.push({
                name: componentName,
                count: count as number,
                totalEntities,
            });
        }

        // Sort by count descending
        stats.sort((a, b) => b.count - a.count);

        return stats;
    }
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Debug Visualizer Plugin with type-safe engine extension.
 */
export class DebugVisualizerPlugin implements EnginePlugin<{ debug: IDebugAPI }> {
    name = 'DebugVisualizerPlugin';
    version = '1.0.0';

    /** Type brand for compile-time type inference */
    declare readonly __extensions: { debug: IDebugAPI };

    private debugAPI?: DebugAPI;

    install(context: PluginContext): void {
        const engine = context.getEngine();

        // Create debug API with engine reference
        this.debugAPI = new DebugAPI(engine);

        // Extend the engine with debug visualization API
        context.extend('debug', this.debugAPI);

        console.log('[DebugVisualizerPlugin] Installed successfully');
    }

    uninstall(): void {
        console.log('[DebugVisualizerPlugin] Uninstalled successfully');
    }
}

/**
 * Usage example:
 *
 * import { EngineBuilder } from '../../../packages/core/src/index';
 * import { DebugVisualizerPlugin } from './examples/DebugVisualizerPlugin';
 *
 * const engine = new EngineBuilder()
 *   .withDebugMode(true)
 *   .use(new DebugVisualizerPlugin())
 *   .build();
 *
 * // Create some test entities
 * const player = engine.createEntity('Player');
 * player.addTag('player');
 *
 * const weapon = engine.createEntity('Sword');
 * weapon.setParent(player);
 *
 * const enemy = engine.createEntity('Goblin');
 * enemy.addTag('enemy');
 *
 * // Visualize entity hierarchy
 * engine.debug.printHierarchy();
 * // Output:
 * // Entity Hierarchy:
 * // └─ Player [player]
 * //     └─ Sword
 * // └─ Goblin [enemy]
 *
 * // Show component statistics
 * engine.debug.printComponentStats();
 * // Output:
 * // Component Statistics:
 * // ──────────────────────────────────────────────────
 * //   Position:    150 entities ( 75.0%)
 * //   Velocity:    120 entities ( 60.0%)
 * //   Health  :     50 entities ( 25.0%)
 * // ──────────────────────────────────────────────────
 * // Total entities: 200
 *
 * // Analyze a query
 * const query = engine.createQuery({ all: [Position, Velocity] });
 * engine.debug.analyzeQuery(query);
 *
 * // Export system timeline for Chrome DevTools
 * const trace = engine.debug.exportChromeTrace();
 * // Save to file and load in chrome://tracing
 *
 * // Get debug summary
 * engine.debug.printDebugSummary();
 */
