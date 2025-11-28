/**
 * Spatial Partition Plugin for Orion ECS
 *
 * Provides efficient spatial data structures for proximity queries in large worlds.
 * This plugin demonstrates:
 * - Grid-based spatial partitioning
 * - Efficient range and radius queries
 * - Dynamic entity updates as they move
 * - Custom API extension for spatial operations
 */

import type { EnginePlugin, EntityDef, PluginContext } from '@orion-ecs/plugin-api';

// Spatial components
export class SpatialPosition {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

export class SpatialCell {
    constructor(
        public gridX: number = 0,
        public gridY: number = 0
    ) {}
}

// Spatial partition configuration
export interface SpatialPartitionOptions {
    type: 'grid';
    cellSize: number;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

// Grid cell data structure
interface GridCell {
    entities: Set<EntityDef>;
}

// =============================================================================
// Spatial API Interface
// =============================================================================

/**
 * Spatial API interface for type-safe engine extension.
 */
export interface ISpatialAPI {
    /** Create or update spatial partition configuration */
    createPartition(options: SpatialPartitionOptions): void;
    /** Update entity position in spatial grid */
    updateEntity(entity: EntityDef, x: number, y: number): void;
    /** Remove entity from spatial grid */
    removeEntity(entity: EntityDef): void;
    /** Query entities within a radius of a point */
    queryRadius(position: { x: number; y: number }, radius: number): EntityDef[];
    /** Query entities within a rectangular area */
    queryRect(x: number, y: number, width: number, height: number): EntityDef[];
    /** Get statistics about the spatial partition */
    getStats(): {
        totalCells: number;
        occupiedCells: number;
        totalEntities: number;
        averageEntitiesPerCell: number;
    };
}

// =============================================================================
// Spatial API Implementation
// =============================================================================

/**
 * Spatial API implementation class.
 */
export class SpatialAPI implements ISpatialAPI {
    private grid: Map<string, GridCell> = new Map();
    private cellSize: number = 100;
    private bounds = { x: 0, y: 0, width: 10000, height: 10000 };
    private entities: Map<symbol, { x: number; y: number }> = new Map();

    /**
     * Create or update spatial partition configuration
     */
    createPartition(options: SpatialPartitionOptions): void {
        this.cellSize = options.cellSize;
        this.bounds = options.bounds;
        this.grid.clear();
        console.log(
            `[SpatialAPI] Partition created: cellSize=${this.cellSize}, bounds=${JSON.stringify(this.bounds)}`
        );
    }

    /**
     * Get grid cell key for position
     */
    private getCellKey(x: number, y: number): string {
        const gridX = Math.floor(x / this.cellSize);
        const gridY = Math.floor(y / this.cellSize);
        return `${gridX},${gridY}`;
    }

    /**
     * Get or create a grid cell
     */
    private getCell(key: string): GridCell {
        let cell = this.grid.get(key);
        if (!cell) {
            cell = { entities: new Set() };
            this.grid.set(key, cell);
        }
        return cell;
    }

    /**
     * Update entity position in spatial grid
     */
    updateEntity(entity: EntityDef, x: number, y: number): void {
        const oldPos = this.entities.get(entity.id);
        const newKey = this.getCellKey(x, y);

        // Remove from old cell if position changed
        if (oldPos) {
            const oldKey = this.getCellKey(oldPos.x, oldPos.y);
            if (oldKey !== newKey) {
                const oldCell = this.grid.get(oldKey);
                if (oldCell) {
                    oldCell.entities.delete(entity);
                }
            }
        }

        // Add to new cell
        const newCell = this.getCell(newKey);
        newCell.entities.add(entity);
        this.entities.set(entity.id, { x, y });
    }

    /**
     * Remove entity from spatial grid
     */
    removeEntity(entity: EntityDef): void {
        const pos = this.entities.get(entity.id);
        if (pos) {
            const key = this.getCellKey(pos.x, pos.y);
            const cell = this.grid.get(key);
            if (cell) {
                cell.entities.delete(entity);
            }
            this.entities.delete(entity.id);
        }
    }

    /**
     * Query entities within a radius of a point
     */
    queryRadius(position: { x: number; y: number }, radius: number): EntityDef[] {
        const results: EntityDef[] = [];
        const radiusSquared = radius * radius;

        // Calculate grid cell range to check
        const minGridX = Math.floor((position.x - radius) / this.cellSize);
        const maxGridX = Math.floor((position.x + radius) / this.cellSize);
        const minGridY = Math.floor((position.y - radius) / this.cellSize);
        const maxGridY = Math.floor((position.y + radius) / this.cellSize);

        // Check all cells in range
        for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
            for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
                const key = `${gridX},${gridY}`;
                const cell = this.grid.get(key);
                if (!cell) continue;

                // Check each entity in the cell
                for (const entity of cell.entities) {
                    const entityPos = this.entities.get(entity.id);
                    if (!entityPos) continue;

                    const dx = entityPos.x - position.x;
                    const dy = entityPos.y - position.y;
                    const distSquared = dx * dx + dy * dy;

                    if (distSquared <= radiusSquared) {
                        results.push(entity);
                    }
                }
            }
        }

        return results;
    }

    /**
     * Query entities within a rectangular area
     */
    queryRect(x: number, y: number, width: number, height: number): EntityDef[] {
        const results: EntityDef[] = [];

        // Calculate grid cell range to check
        const minGridX = Math.floor(x / this.cellSize);
        const maxGridX = Math.floor((x + width) / this.cellSize);
        const minGridY = Math.floor(y / this.cellSize);
        const maxGridY = Math.floor((y + height) / this.cellSize);

        // Check all cells in range
        for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
            for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
                const key = `${gridX},${gridY}`;
                const cell = this.grid.get(key);
                if (!cell) continue;

                // Check each entity in the cell
                for (const entity of cell.entities) {
                    const entityPos = this.entities.get(entity.id);
                    if (!entityPos) continue;

                    // Check if entity is within rectangle (exclusive upper bound)
                    if (
                        entityPos.x >= x &&
                        entityPos.x < x + width &&
                        entityPos.y >= y &&
                        entityPos.y < y + height
                    ) {
                        results.push(entity);
                    }
                }
            }
        }

        return results;
    }

    /**
     * Get statistics about the spatial partition
     */
    getStats(): {
        totalCells: number;
        occupiedCells: number;
        totalEntities: number;
        averageEntitiesPerCell: number;
    } {
        let occupiedCells = 0;
        let totalEntities = 0;

        for (const cell of this.grid.values()) {
            if (cell.entities.size > 0) {
                occupiedCells++;
                totalEntities += cell.entities.size;
            }
        }

        return {
            totalCells: this.grid.size,
            occupiedCells,
            totalEntities,
            averageEntitiesPerCell: occupiedCells > 0 ? totalEntities / occupiedCells : 0,
        };
    }
}

// =============================================================================
// Plugin Implementation
// =============================================================================

/**
 * Spatial Partition Plugin with type-safe engine extension.
 */
export class SpatialPartitionPlugin implements EnginePlugin<{ spatial: ISpatialAPI }> {
    name = 'SpatialPartitionPlugin';
    version = '1.0.0';

    /** Type brand for compile-time type inference */
    declare readonly __extensions: { spatial: ISpatialAPI };

    private spatialAPI = new SpatialAPI();
    private unsubscribe?: () => void;

    install(context: PluginContext): void {
        // Register spatial components
        context.registerComponent(SpatialPosition);
        context.registerComponent(SpatialCell);

        // Create default partition
        this.spatialAPI.createPartition({
            type: 'grid',
            cellSize: 100,
            bounds: { x: 0, y: 0, width: 10000, height: 10000 },
        });

        // Create spatial indexing system that updates the grid as entities move
        context.createSystem(
            'SpatialIndexSystem',
            {
                all: [SpatialPosition],
            },
            {
                priority: 200,
                act: (entity, position: SpatialPosition) => {
                    this.spatialAPI.updateEntity(entity, position.x, position.y);
                },
            },
            false // Variable update
        );

        // Subscribe to entity deletion events to clean up spatial index
        this.unsubscribe = context.on('onEntityReleased', (entity: EntityDef) => {
            this.spatialAPI.removeEntity(entity);
        });

        // Extend the engine with spatial API
        context.extend('spatial', this.spatialAPI);

        console.log('[SpatialPartitionPlugin] Installed successfully');
    }

    uninstall(): void {
        // Clean up subscriptions
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        console.log('[SpatialPartitionPlugin] Uninstalled successfully');
    }
}

/**
 * Usage example:
 *
 * import { EngineBuilder } from '../../../packages/core/src/index';
 * import { SpatialPartitionPlugin, SpatialPosition } from './examples/SpatialPartitionPlugin';
 *
 * const engine = new EngineBuilder()
 *   .withDebugMode(true)
 *   .use(new SpatialPartitionPlugin())
 *   .build();
 *
 * // Configure spatial partition
 * engine.spatial.createPartition({
 *   type: 'grid',
 *   cellSize: 50,
 *   bounds: { x: 0, y: 0, width: 5000, height: 5000 }
 * });
 *
 * // Create entities with spatial positions
 * for (let i = 0; i < 1000; i++) {
 *   const entity = engine.createEntity(`Entity${i}`);
 *   entity.addComponent(SpatialPosition, Math.random() * 5000, Math.random() * 5000);
 * }
 *
 * // Query entities near a point
 * const nearby = engine.spatial.queryRadius({ x: 100, y: 100 }, 50);
 * console.log(`Found ${nearby.length} entities within 50 units`);
 *
 * // Query entities in a rectangle
 * const inArea = engine.spatial.queryRect(0, 0, 200, 200);
 * console.log(`Found ${inArea.length} entities in rectangle`);
 *
 * // Get statistics
 * const stats = engine.spatial.getStats();
 * console.log(`Spatial grid stats:`, stats);
 *
 * // Use cases:
 * // - Collision detection: find entities near a position for collision checks
 * // - AI perception: find what entities an AI can "see"
 * // - Rendering culling: only render entities in viewport
 * // - Network relevance: determine what to send to clients
 */
