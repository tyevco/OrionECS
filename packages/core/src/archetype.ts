/**
 * Entity Archetype System
 * Groups entities by component composition for improved cache locality and performance
 * Follows Unity DOTS and Bevy ECS patterns
 */

import type { Entity } from './core';
import type { ComponentIdentifier, QueryOptions } from './definitions';

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

    constructor(componentTypes: ComponentIdentifier[]) {
        // Sort component types for consistent archetype IDs
        this.componentTypes = componentTypes.toSorted((a, b) => a.name.localeCompare(b.name));

        // Generate unique ID from sorted component names
        this.id = this.componentTypes.map((type) => type.name).join(',');

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
     * @param entity - Entity to remove
     * @returns Map of component type to component instance (for moving to new archetype)
     */
    removeEntity(entity: Entity): Map<ComponentIdentifier, any> | null {
        const index = this.entityToIndex.get(entity.id);
        if (index === undefined) {
            return null;
        }

        const lastIndex = this.entities.length - 1;
        const components = new Map<ComponentIdentifier, any>();

        // Save components before removal (for potential archetype move)
        for (const type of this.componentTypes) {
            const array = this.componentArrays.get(type);
            if (array) {
                components.set(type, array[index]);
            }
        }

        // Swap with last entity and pop (O(1) removal)
        if (index !== lastIndex) {
            const lastEntity = this.entities[lastIndex];

            // Swap entities
            this.entities[index] = lastEntity;
            this.entityToIndex.set(lastEntity.id, index);

            // Swap components in all arrays
            for (const type of this.componentTypes) {
                const array = this.componentArrays.get(type);
                if (array) {
                    array[index] = array[lastIndex];
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

        const array = this.componentArrays.get(type);
        if (!array) {
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

        const array = this.componentArrays.get(type);
        if (!array) {
            throw new Error(`Component type ${type.name} not found in archetype ${this.id}`);
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

        // Iterate with direct array access for maximum performance
        for (let i = 0; i < this.entities.length; i++) {
            const entity = this.entities[i];
            const components = componentArraysArray.map((arr) => arr[i]);
            callback(entity, ...components);
        }
    }

    /**
     * Get components for iteration (optimized for queries)
     * @param componentTypes - Component types to retrieve
     * @returns Arrays of components in the same order as requested types
     */
    getComponentArrays(componentTypes: ComponentIdentifier[]): any[][] {
        return componentTypes.map((type) => this.componentArrays.get(type) || []);
    }

    /**
     * Get memory usage statistics.
     *
     * Note: Memory estimates are **approximate** and platform-dependent.
     * The estimatedBytes value uses heuristics based on typical JavaScript
     * object sizes in V8 and may vary significantly across:
     * - Different JavaScript engines (V8, SpiderMonkey, JavaScriptCore)
     * - 32-bit vs 64-bit environments
     * - Component complexity and property count
     *
     * For accurate memory profiling, use browser DevTools or Node.js --inspect.
     */
    getMemoryStats(): {
        entityCount: number;
        componentTypeCount: number;
        /** Approximate memory usage in bytes (see method docs for accuracy notes) */
        estimatedBytes: number;
    } {
        // These are estimates for V8 in 64-bit environments
        // Actual sizes vary by engine and platform
        const ENTITY_REFERENCE_SIZE = 8; // Pointer size (64-bit)
        const COMPONENT_SIZE_ESTIMATE = 32; // Average component with ~3-4 properties
        const MAP_ENTRY_OVERHEAD = 16; // Map/Set entry overhead per item

        const entityCount = this.entities.length;
        const componentTypeCount = this.componentTypes.length;
        const estimatedBytes =
            entityCount * ENTITY_REFERENCE_SIZE + // Entity array
            entityCount * componentTypeCount * COMPONENT_SIZE_ESTIMATE + // Component arrays
            entityCount * MAP_ENTRY_OVERHEAD; // Index map overhead

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
     */
    private generateArchetypeId(componentTypes: ComponentIdentifier[]): string {
        if (componentTypes.length === 0) {
            return '';
        }
        // Sort by name for consistent ID
        return componentTypes
            .toSorted((a, b) => a.name.localeCompare(b.name))
            .map((type) => type.name)
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
