/**
 * Entity Archetype System
 * Groups entities by component composition for improved cache locality and performance
 * Follows Unity DOTS and Bevy ECS patterns
 */

import type { Entity } from './core';
import type { ComponentIdentifier, QueryOptions } from './definitions';

/**
 * Registry for assigning unique identifiers to component types.
 *
 * This solves the archetype ID collision problem where components from different
 * modules might share the same name. Each component class gets a unique numeric ID
 * that's used in archetype ID generation.
 *
 * @internal
 */
class ComponentTypeRegistry {
    private static instance: ComponentTypeRegistry;
    private typeIds: WeakMap<ComponentIdentifier, number> = new WeakMap();
    private nextId: number = 1;

    private constructor() {}

    static getInstance(): ComponentTypeRegistry {
        if (!ComponentTypeRegistry.instance) {
            ComponentTypeRegistry.instance = new ComponentTypeRegistry();
        }
        return ComponentTypeRegistry.instance;
    }

    /**
     * Get or assign a unique ID for a component type.
     * Uses the component class reference itself as the key, ensuring uniqueness
     * even if multiple components have the same name property.
     */
    getTypeId(type: ComponentIdentifier): number {
        let id = this.typeIds.get(type);
        if (id === undefined) {
            id = this.nextId++;
            this.typeIds.set(type, id);
        }
        return id;
    }

    /**
     * Generate a unique key for a component type that includes both
     * the human-readable name and a unique ID to prevent collisions.
     */
    getTypeKey(type: ComponentIdentifier): string {
        const id = this.getTypeId(type);
        return `${type.name}#${id}`;
    }
}

// Export singleton accessor for use in Archetype classes
const componentTypeRegistry = ComponentTypeRegistry.getInstance();

/**
 * Configuration for memory estimation values.
 * These can be adjusted for different JavaScript engines and platforms.
 *
 * @example Customizing for a specific environment
 * ```typescript
 * import { MemoryEstimationConfig } from '@orion-ecs/core';
 *
 * // Adjust for 32-bit environment
 * MemoryEstimationConfig.POINTER_SIZE = 4;
 * MemoryEstimationConfig.MAP_ENTRY_OVERHEAD = 12;
 * ```
 *
 * @public
 */
export const MemoryEstimationConfig = {
    /**
     * Size of a reference/pointer in bytes.
     * - 64-bit: 8 bytes (default)
     * - 32-bit: 4 bytes
     */
    POINTER_SIZE: 8,

    /**
     * Estimated average size of a component instance in bytes.
     * This varies based on component complexity:
     * - Simple (2-3 properties): ~24 bytes
     * - Medium (4-6 properties): ~32 bytes (default)
     * - Complex (7+ properties): ~48+ bytes
     */
    COMPONENT_SIZE_ESTIMATE: 32,

    /**
     * Overhead per entry in Map/Set data structures.
     * Varies by engine:
     * - V8 (Chrome/Node.js): ~16 bytes
     * - SpiderMonkey (Firefox): ~24 bytes
     * - JavaScriptCore (Safari): ~16 bytes
     */
    MAP_ENTRY_OVERHEAD: 16,

    /**
     * Get estimated values based on detected environment.
     * Call this once at startup to auto-configure for the current platform.
     *
     * @returns Object with detected configuration values
     */
    detectEnvironment(): { engine: string; is64Bit: boolean } {
        let engine = 'unknown';
        let is64Bit = true;

        // Detect JavaScript engine
        if (typeof process !== 'undefined' && process.versions?.v8) {
            engine = 'V8';
        } else if (typeof navigator !== 'undefined') {
            const ua = navigator.userAgent;
            if (ua.includes('Firefox')) {
                engine = 'SpiderMonkey';
                // SpiderMonkey has higher Map overhead
                this.MAP_ENTRY_OVERHEAD = 24;
            } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
                engine = 'JavaScriptCore';
            } else if (ua.includes('Chrome')) {
                engine = 'V8';
            }
        }

        // Detect architecture (heuristic - not always accurate)
        // In Node.js we can check process.arch
        if (typeof process !== 'undefined' && process.arch) {
            is64Bit = !process.arch.includes('32');
            if (!is64Bit) {
                this.POINTER_SIZE = 4;
                this.MAP_ENTRY_OVERHEAD = Math.round(this.MAP_ENTRY_OVERHEAD * 0.75);
            }
        }

        return { engine, is64Bit };
    },
};

/**
 * Represents a unique combination of component types
 * Stores entities with the same component composition in dense arrays
 */
export class Archetype {
    // Unique identifier for this archetype (e.g., "Position,Velocity")
    public readonly id: string;

    // Component types in this archetype (sorted for consistency)
    public readonly componentTypes: ComponentIdentifier[];

    // Dense array of entities in this archetype
    private entities: Entity[] = [];

    // Dense arrays of components, one per component type
    private componentArrays: Map<ComponentIdentifier, any[]> = new Map();

    // Map from entity ID to index in dense arrays
    private entityToIndex: Map<symbol, number> = new Map();

    // Cache of component type names for faster lookups
    private componentTypeNames: Set<string> = new Set();

    // Iteration protection: track active iteration count to prevent concurrent modifications
    private _iterationDepth: number = 0;

    // Pending entity removals to process after iteration completes
    private _pendingRemovals: Set<Entity> = new Set();

    constructor(componentTypes: ComponentIdentifier[]) {
        // Sort component types for consistent archetype IDs
        // Use the unique type key for sorting to ensure consistent ordering
        this.componentTypes = componentTypes.toSorted((a, b) =>
            componentTypeRegistry.getTypeKey(a).localeCompare(componentTypeRegistry.getTypeKey(b))
        );

        // Generate unique ID from sorted component type keys
        // Uses unique IDs to prevent collisions when same-named components exist across modules
        this.id = this.componentTypes.map((type) => componentTypeRegistry.getTypeKey(type)).join(',');

        // Initialize component arrays
        for (const type of this.componentTypes) {
            this.componentArrays.set(type, []);
            this.componentTypeNames.add(type.name);
        }
    }

    /**
     * Check if this archetype has a specific component type
     */
    hasComponentType(type: ComponentIdentifier): boolean {
        return this.componentTypeNames.has(type.name);
    }

    /**
     * Check if this archetype matches a query
     * @param queryOptions - Query options to match against
     * @returns true if archetype matches the query
     */
    matches(queryOptions: QueryOptions): boolean {
        const { all = [], any = [], none = [] } = queryOptions;

        // Check ALL: archetype must have all specified components
        if (all.length > 0) {
            for (const type of all) {
                if (!this.hasComponentType(type)) {
                    return false;
                }
            }
        }

        // Check ANY: archetype must have at least one of the specified components
        if (any.length > 0) {
            let hasAny = false;
            for (const type of any) {
                if (this.hasComponentType(type)) {
                    hasAny = true;
                    break;
                }
            }
            if (!hasAny) {
                return false;
            }
        }

        // Check NONE: archetype must not have any of the specified components
        if (none.length > 0) {
            for (const type of none) {
                if (this.hasComponentType(type)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Add an entity to this archetype
     * @param entity - Entity to add
     * @param components - Map of component type to component instance
     */
    addEntity(entity: Entity, components: Map<ComponentIdentifier, any>): void {
        const index = this.entities.length;

        // Add entity to dense array
        this.entities.push(entity);
        this.entityToIndex.set(entity.id, index);

        // Add components to their respective dense arrays
        for (const type of this.componentTypes) {
            const component = components.get(type);
            if (component === undefined) {
                throw new Error(
                    `Component ${type.name} not found when adding entity to archetype ${this.id}`
                );
            }
            const array = this.componentArrays.get(type);
            array?.push(component);
        }
    }

    /**
     * Remove an entity from this archetype
     * Uses swap-and-pop for O(1) removal
     *
     * Thread Safety: If called during iteration (forEach), the removal is deferred
     * until iteration completes to prevent data corruption.
     *
     * @param entity - Entity to remove
     * @returns Map of component type to component instance (for moving to new archetype)
     */
    removeEntity(entity: Entity): Map<ComponentIdentifier, any> | null {
        const index = this.entityToIndex.get(entity.id);
        if (index === undefined) {
            return null;
        }

        // If we're currently iterating, defer the removal to prevent corruption
        if (this._iterationDepth > 0) {
            this._pendingRemovals.add(entity);
            // Return components now for the caller, but don't actually remove yet
            const components = new Map<ComponentIdentifier, any>();
            for (const type of this.componentTypes) {
                const array = this.componentArrays.get(type);
                if (array && index < array.length) {
                    components.set(type, array[index]);
                }
            }
            return components;
        }

        return this._removeEntityImmediate(entity);
    }

    /**
     * Internal method to perform immediate entity removal (not deferred)
     * @internal
     */
    private _removeEntityImmediate(entity: Entity): Map<ComponentIdentifier, any> | null {
        const index = this.entityToIndex.get(entity.id);
        if (index === undefined) {
            return null;
        }

        const lastIndex = this.entities.length - 1;
        const components = new Map<ComponentIdentifier, any>();

        // Validate bounds before accessing arrays
        if (index < 0 || index > lastIndex) {
            // Stale index - entity was already removed or index is invalid
            this.entityToIndex.delete(entity.id);
            return null;
        }

        // Save components before removal (for potential archetype move)
        for (const type of this.componentTypes) {
            const array = this.componentArrays.get(type);
            if (array && index < array.length) {
                components.set(type, array[index]);
            }
        }

        // Swap with last entity and pop (O(1) removal)
        if (index !== lastIndex) {
            const lastEntity = this.entities[lastIndex];

            // Validate lastEntity exists before swapping
            if (lastEntity) {
                // Swap entities
                this.entities[index] = lastEntity;
                this.entityToIndex.set(lastEntity.id, index);

                // Swap components in all arrays
                for (const type of this.componentTypes) {
                    const array = this.componentArrays.get(type);
                    if (array && lastIndex < array.length) {
                        array[index] = array[lastIndex];
                    }
                }
            }
        }

        // Remove last element
        this.entities.pop();
        this.entityToIndex.delete(entity.id);

        // Pop from all component arrays
        for (const array of this.componentArrays.values()) {
            array.pop();
        }

        return components;
    }

    /**
     * Process all pending entity removals that were deferred during iteration.
     * Called automatically after forEach completes.
     * @internal
     */
    private _processPendingRemovals(): void {
        if (this._pendingRemovals.size === 0) {
            return;
        }

        // Process all pending removals
        for (const entity of this._pendingRemovals) {
            this._removeEntityImmediate(entity);
        }
        this._pendingRemovals.clear();
    }

    /**
     * Check if an entity has a pending removal (deferred during iteration)
     */
    hasPendingRemoval(entity: Entity): boolean {
        return this._pendingRemovals.has(entity);
    }

    /**
     * Get component for an entity
     * @param entity - Entity to get component for
     * @param type - Component type
     * @returns Component instance or null
     */
    getComponent<T>(entity: Entity, type: ComponentIdentifier<T>): T | null {
        const index = this.entityToIndex.get(entity.id);
        if (index === undefined) {
            return null;
        }

        // Validate array bounds to handle stale indices from concurrent modifications
        if (index < 0 || index >= this.entities.length) {
            return null;
        }

        const array = this.componentArrays.get(type);
        if (!array) {
            return null;
        }

        // Additional bounds check on component array
        if (index >= array.length) {
            return null;
        }

        return array[index] as T;
    }

    /**
     * Set component for an entity
     * @param entity - Entity to set component for
     * @param type - Component type
     * @param component - Component instance
     */
    setComponent<T>(entity: Entity, type: ComponentIdentifier<T>, component: T): void {
        const index = this.entityToIndex.get(entity.id);
        if (index === undefined) {
            throw new Error(
                `Entity ${entity.name || entity.numericId} not found in archetype ${this.id}`
            );
        }

        // Validate array bounds to handle stale indices from concurrent modifications
        if (index < 0 || index >= this.entities.length) {
            throw new Error(
                `Entity ${entity.name || entity.numericId} has stale index ${index} in archetype ${this.id} (size: ${this.entities.length})`
            );
        }

        const array = this.componentArrays.get(type);
        if (!array) {
            throw new Error(`Component type ${type.name} not found in archetype ${this.id}`);
        }

        // Additional bounds check on component array
        if (index >= array.length) {
            throw new Error(
                `Component array for ${type.name} has stale index ${index} in archetype ${this.id} (array size: ${array.length})`
            );
        }

        array[index] = component;
    }

    /**
     * Check if entity is in this archetype
     */
    hasEntity(entity: Entity): boolean {
        return this.entityToIndex.has(entity.id);
    }

    /**
     * Get all entities in this archetype
     */
    getEntities(): Entity[] {
        return this.entities;
    }

    /**
     * Get entity count
     */
    get entityCount(): number {
        return this.entities.length;
    }

    /**
     * Iterate over entities with direct component access
     * Optimized for cache locality - components are accessed sequentially
     *
     * Thread Safety: During iteration, entity removals are automatically deferred
     * until iteration completes to prevent data corruption from concurrent modifications.
     */
    forEach(callback: (entity: Entity, ...components: any[]) => void): void {
        const componentArraysArray: any[][] = [];

        // Pre-fetch component arrays for better performance
        for (const type of this.componentTypes) {
            const array = this.componentArrays.get(type);
            if (array) {
                componentArraysArray.push(array);
            }
        }

        // Mark that we're iterating to defer removals
        this._iterationDepth++;

        try {
            // Iterate with direct array access for maximum performance
            // Cache length to avoid issues if entities are marked for removal
            const length = this.entities.length;
            for (let i = 0; i < length; i++) {
                const entity = this.entities[i];
                // Skip entities that are pending removal
                if (entity && !this._pendingRemovals.has(entity)) {
                    const components = componentArraysArray.map((arr) => arr[i]);
                    callback(entity, ...components);
                }
            }
        } finally {
            // Restore iteration depth
            this._iterationDepth--;

            // Process pending removals if we're no longer iterating
            if (this._iterationDepth === 0) {
                this._processPendingRemovals();
            }
        }
    }

    /**
     * Get components for iteration (optimized for queries)
     * @param componentTypes - Component types to retrieve
     * @param debugMode - If true, logs warnings for missing component types
     * @returns Arrays of components in the same order as requested types
     */
    getComponentArrays(componentTypes: ComponentIdentifier[], debugMode = false): any[][] {
        return componentTypes.map((type) => {
            const array = this.componentArrays.get(type);
            if (!array && debugMode) {
                console.warn(
                    `[ECS Debug] Archetype "${this.id}" does not contain component type "${type.name}". ` +
                        'This may indicate a query/archetype mismatch.'
                );
            }
            return array || [];
        });
    }

    /**
     * Get memory usage statistics.
     *
     * Note: Memory estimates are **approximate** and platform-dependent.
     * The estimatedBytes value uses configurable heuristics from MemoryEstimationConfig.
     * By default, values are based on typical JavaScript object sizes in V8 (64-bit)
     * and may vary significantly across:
     * - Different JavaScript engines (V8, SpiderMonkey, JavaScriptCore)
     * - 32-bit vs 64-bit environments
     * - Component complexity and property count
     *
     * To improve accuracy, call `MemoryEstimationConfig.detectEnvironment()` at startup
     * or manually configure the estimation values for your target platform.
     *
     * For accurate memory profiling, use browser DevTools or Node.js --inspect.
     */
    getMemoryStats(): {
        entityCount: number;
        componentTypeCount: number;
        /** Approximate memory usage in bytes (see method docs for accuracy notes) */
        estimatedBytes: number;
    } {
        // Use configurable values from MemoryEstimationConfig
        // These can be adjusted for different JS engines and platforms
        const entityCount = this.entities.length;
        const componentTypeCount = this.componentTypes.length;
        const estimatedBytes =
            entityCount * MemoryEstimationConfig.POINTER_SIZE + // Entity array
            entityCount * componentTypeCount * MemoryEstimationConfig.COMPONENT_SIZE_ESTIMATE + // Component arrays
            entityCount * MemoryEstimationConfig.MAP_ENTRY_OVERHEAD; // Index map overhead

        return {
            entityCount,
            componentTypeCount,
            estimatedBytes,
        };
    }
}

/**
 * Manages all archetypes and entity movement between them
 */
export class ArchetypeManager {
    // Map from archetype ID to archetype
    private archetypes: Map<string, Archetype> = new Map();

    // Map from entity ID to its current archetype
    private entityToArchetype: Map<symbol, Archetype> = new Map();

    // Empty archetype for entities with no components
    private emptyArchetype: Archetype;

    // Performance tracking
    private _archetypeCreationCount: number = 0;
    private _entityMovementCount: number = 0;

    constructor() {
        // Create empty archetype for entities with no components
        this.emptyArchetype = new Archetype([]);
        this.archetypes.set(this.emptyArchetype.id, this.emptyArchetype);
    }

    /**
     * Generate archetype ID from component types
     *
     * Uses unique type keys from ComponentTypeRegistry to prevent collisions
     * when same-named components exist across different modules.
     */
    private generateArchetypeId(componentTypes: ComponentIdentifier[]): string {
        if (componentTypes.length === 0) {
            return '';
        }
        // Sort by unique type key for consistent ID
        // This ensures components with the same name from different modules
        // generate different archetype IDs
        return componentTypes
            .toSorted((a, b) =>
                componentTypeRegistry.getTypeKey(a).localeCompare(componentTypeRegistry.getTypeKey(b))
            )
            .map((type) => componentTypeRegistry.getTypeKey(type))
            .join(',');
    }

    /**
     * Get or create an archetype for a set of component types
     * @param componentTypes - Component types for the archetype
     * @returns Archetype instance
     */
    getOrCreateArchetype(componentTypes: ComponentIdentifier[]): Archetype {
        if (componentTypes.length === 0) {
            return this.emptyArchetype;
        }

        const id = this.generateArchetypeId(componentTypes);
        let archetype = this.archetypes.get(id);

        if (!archetype) {
            archetype = new Archetype(componentTypes);
            this.archetypes.set(id, archetype);
            this._archetypeCreationCount++;
        }

        return archetype;
    }

    /**
     * Add entity to an archetype
     * @param entity - Entity to add
     * @param archetype - Target archetype
     * @param components - Map of component type to component instance
     */
    addEntityToArchetype(
        entity: Entity,
        archetype: Archetype,
        components: Map<ComponentIdentifier, any>
    ): void {
        // Remove from old archetype if exists
        const oldArchetype = this.entityToArchetype.get(entity.id);
        if (oldArchetype) {
            oldArchetype.removeEntity(entity);
        }

        // Add to new archetype
        archetype.addEntity(entity, components);
        this.entityToArchetype.set(entity.id, archetype);

        if (oldArchetype) {
            this._entityMovementCount++;
        }
    }

    /**
     * Move entity to a new archetype (when components are added/removed)
     * @param entity - Entity to move
     * @param newComponentTypes - New set of component types
     * @param components - Map of component type to component instance
     */
    moveEntity(
        entity: Entity,
        newComponentTypes: ComponentIdentifier[],
        components: Map<ComponentIdentifier, any>
    ): void {
        const newArchetype = this.getOrCreateArchetype(newComponentTypes);
        this.addEntityToArchetype(entity, newArchetype, components);
    }

    /**
     * Remove entity from its archetype
     * @param entity - Entity to remove
     * @returns Components from the archetype (for cleanup)
     */
    removeEntity(entity: Entity): Map<ComponentIdentifier, any> | null {
        const archetype = this.entityToArchetype.get(entity.id);
        if (!archetype) {
            return null;
        }

        const components = archetype.removeEntity(entity);
        this.entityToArchetype.delete(entity.id);

        return components;
    }

    /**
     * Get entity's current archetype
     * @param entity - Entity to look up
     * @returns Archetype or undefined
     */
    getEntityArchetype(entity: Entity): Archetype | undefined {
        return this.entityToArchetype.get(entity.id);
    }

    /**
     * Get component from entity's archetype
     * @param entity - Entity to get component from
     * @param type - Component type
     * @returns Component instance or null
     */
    getComponent<T>(entity: Entity, type: ComponentIdentifier<T>): T | null {
        const archetype = this.entityToArchetype.get(entity.id);
        if (!archetype) {
            return null;
        }
        return archetype.getComponent(entity, type);
    }

    /**
     * Set component in entity's archetype
     * @param entity - Entity to set component for
     * @param type - Component type
     * @param component - Component instance
     */
    setComponent<T>(entity: Entity, type: ComponentIdentifier<T>, component: T): void {
        const archetype = this.entityToArchetype.get(entity.id);
        if (!archetype) {
            throw new Error(`Entity ${entity.name || entity.numericId} not found in any archetype`);
        }
        archetype.setComponent(entity, type, component);
    }

    /**
     * Get all archetypes that match a query
     * @param queryOptions - Query options
     * @returns Array of matching archetypes
     */
    getMatchingArchetypes(queryOptions: QueryOptions): Archetype[] {
        const matching: Archetype[] = [];

        for (const archetype of this.archetypes.values()) {
            if (archetype.matches(queryOptions)) {
                matching.push(archetype);
            }
        }

        return matching;
    }

    /**
     * Get all archetypes
     */
    getAllArchetypes(): Archetype[] {
        return Array.from(this.archetypes.values());
    }

    /**
     * Get archetype count
     */
    get archetypeCount(): number {
        return this.archetypes.size;
    }

    /**
     * Get performance statistics
     */
    getStats(): {
        archetypeCount: number;
        archetypeCreationCount: number;
        entityMovementCount: number;
        archetypes: Array<{
            id: string;
            entityCount: number;
            componentTypeCount: number;
        }>;
    } {
        return {
            archetypeCount: this.archetypes.size,
            archetypeCreationCount: this._archetypeCreationCount,
            entityMovementCount: this._entityMovementCount,
            archetypes: Array.from(this.archetypes.values()).map((archetype) => ({
                id: archetype.id,
                entityCount: archetype.entityCount,
                componentTypeCount: archetype.componentTypes.length,
            })),
        };
    }

    /**
     * Get total memory usage across all archetypes
     */
    getMemoryStats(): {
        totalEntities: number;
        totalArchetypes: number;
        estimatedBytes: number;
        archetypeBreakdown: Array<{
            id: string;
            entityCount: number;
            estimatedBytes: number;
        }>;
    } {
        let totalEntities = 0;
        let estimatedBytes = 0;
        const archetypeBreakdown: Array<{
            id: string;
            entityCount: number;
            estimatedBytes: number;
        }> = [];

        for (const archetype of this.archetypes.values()) {
            const stats = archetype.getMemoryStats();
            totalEntities += stats.entityCount;
            estimatedBytes += stats.estimatedBytes;
            archetypeBreakdown.push({
                id: archetype.id,
                entityCount: stats.entityCount,
                estimatedBytes: stats.estimatedBytes,
            });
        }

        return {
            totalEntities,
            totalArchetypes: this.archetypes.size,
            estimatedBytes,
            archetypeBreakdown,
        };
    }

    /**
     * Clear all archetypes (for cleanup/reset)
     */
    clear(): void {
        this.archetypes.clear();
        this.entityToArchetype.clear();
        // Recreate empty archetype
        this.emptyArchetype = new Archetype([]);
        this.archetypes.set(this.emptyArchetype.id, this.emptyArchetype);
        this._archetypeCreationCount = 0;
        this._entityMovementCount = 0;
    }
}
