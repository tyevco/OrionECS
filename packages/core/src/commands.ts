/**
 * Entity Commands / Deferred Operations System
 *
 * This module provides a command buffer system for safe, deferred entity operations
 * during system execution. Commands are queued and executed in batches, preventing
 * issues with iterator invalidation, archetype transitions during iteration, and
 * ensuring consistent entity state throughout update cycles.
 *
 * @packageDocumentation
 * @module Commands
 */

import type { Entity } from './core';
import type { ComponentIdentifier, EntityDef, Logger } from './definitions';
import { deepCloneComponent } from './utils';

/**
 * Minimal interface for Engine to avoid circular dependencies.
 * @internal
 */
interface EngineInterface {
    createEntity(name?: string): Entity;
    getEntity(id: symbol): Entity | undefined;
}

/**
 * Types of commands that can be queued in the command buffer.
 * @internal
 */
export type CommandType =
    | 'spawn'
    | 'despawn'
    | 'add_component'
    | 'remove_component'
    | 'add_tag'
    | 'remove_tag'
    | 'set_parent'
    | 'add_child'
    | 'remove_child';

/**
 * Base interface for all commands.
 * @internal
 */
interface BaseCommand {
    type: CommandType;
    timestamp: number;
}

/**
 * Command to spawn a new entity.
 * @internal
 */
export interface SpawnCommand extends BaseCommand {
    type: 'spawn';
    name?: string;
    components: Array<{ type: ComponentIdentifier; args: unknown[] }>;
    tags: string[];
    parentId?: symbol;
    childIds?: symbol[];
    callback?: (entity: Entity) => void;
    /** Placeholder ID used to reference this entity in subsequent commands before execution */
    placeholderId: symbol;
}

/**
 * Command to despawn (destroy) an entity.
 * @internal
 */
export interface DespawnCommand extends BaseCommand {
    type: 'despawn';
    entityId: symbol;
}

/**
 * Command to add a component to an entity.
 * @internal
 */
export interface AddComponentCommand extends BaseCommand {
    type: 'add_component';
    entityId: symbol;
    componentType: ComponentIdentifier;
    args: unknown[];
}

/**
 * Command to remove a component from an entity.
 * @internal
 */
export interface RemoveComponentCommand extends BaseCommand {
    type: 'remove_component';
    entityId: symbol;
    componentType: ComponentIdentifier;
}

/**
 * Command to add a tag to an entity.
 * @internal
 */
export interface AddTagCommand extends BaseCommand {
    type: 'add_tag';
    entityId: symbol;
    tag: string;
}

/**
 * Command to remove a tag from an entity.
 * @internal
 */
export interface RemoveTagCommand extends BaseCommand {
    type: 'remove_tag';
    entityId: symbol;
    tag: string;
}

/**
 * Command to set an entity's parent.
 * @internal
 */
export interface SetParentCommand extends BaseCommand {
    type: 'set_parent';
    entityId: symbol;
    parentId: symbol | null;
}

/**
 * Command to add a child to an entity.
 * @internal
 */
export interface AddChildCommand extends BaseCommand {
    type: 'add_child';
    entityId: symbol;
    childId: symbol;
}

/**
 * Command to remove a child from an entity.
 * @internal
 */
export interface RemoveChildCommand extends BaseCommand {
    type: 'remove_child';
    entityId: symbol;
    childId: symbol;
}

/**
 * Union type of all command types.
 * @internal
 */
export type EntityCommand =
    | SpawnCommand
    | DespawnCommand
    | AddComponentCommand
    | RemoveComponentCommand
    | AddTagCommand
    | RemoveTagCommand
    | SetParentCommand
    | AddChildCommand
    | RemoveChildCommand;

/**
 * Result of command execution containing statistics.
 * @public
 */
export interface CommandExecutionResult {
    /** Total commands executed */
    commandsExecuted: number;
    /** Entities spawned */
    entitiesSpawned: number;
    /** Entities despawned */
    entitiesDespawned: number;
    /** Components added */
    componentsAdded: number;
    /** Components removed */
    componentsRemoved: number;
    /** Tags added */
    tagsAdded: number;
    /** Tags removed */
    tagsRemoved: number;
    /** Execution time in milliseconds */
    executionTimeMs: number;
    /** Any errors that occurred during execution */
    errors: Error[];
    /** Whether rollback was performed */
    rolledBack: boolean;
}

/**
 * Fluent builder for constructing a spawn command.
 *
 * SpawnEntityBuilder allows you to define a new entity with components, tags,
 * and hierarchy relationships using a chainable API. The entity is not created
 * immediately but queued for creation when the command buffer is executed.
 *
 * @example Basic Usage
 * ```typescript
 * engine.commands.spawn()
 *   .named('Player')
 *   .with(Position, 100, 200)
 *   .with(Health, 100, 100)
 *   .withTag('player')
 *   .withTag('controllable');
 * ```
 *
 * @example With Callback
 * ```typescript
 * let playerEntity: Entity;
 * engine.commands.spawn()
 *   .named('Player')
 *   .with(Position, 0, 0)
 *   .onCreate(entity => {
 *     playerEntity = entity;
 *   });
 * ```
 *
 * @public
 */
export class SpawnEntityBuilder {
    private spawnCommand: SpawnCommand;

    constructor(private commandBuffer: CommandBuffer) {
        this.spawnCommand = {
            type: 'spawn',
            components: [],
            tags: [],
            timestamp: Date.now(),
            placeholderId: Symbol('spawn-placeholder'),
        };
        // Register this command immediately when builder is created
        this.commandBuffer['addCommand'](this.spawnCommand);
    }

    /**
     * Set the name of the entity to be created.
     *
     * @param name - Human-readable name for the entity
     * @returns This builder for method chaining
     */
    named(name: string): this {
        this.spawnCommand.name = name;
        return this;
    }

    /**
     * Add a component to the entity.
     *
     * @typeParam T - The component type
     * @param type - Component class/constructor
     * @param args - Arguments to pass to the component constructor
     * @returns This builder for method chaining
     *
     * @example
     * ```typescript
     * engine.commands.spawn()
     *   .with(Position, 100, 200)
     *   .with(Velocity, 5, 0)
     *   .with(Health, 100, 100);
     * ```
     */
    with<T>(
        type: ComponentIdentifier<T>,
        ...args: ConstructorParameters<ComponentIdentifier<T>>
    ): this {
        this.spawnCommand.components.push({ type, args });
        return this;
    }

    /**
     * Add a tag to the entity.
     *
     * @param tag - Tag string to add
     * @returns This builder for method chaining
     */
    withTag(tag: string): this {
        this.spawnCommand.tags.push(tag);
        return this;
    }

    /**
     * Add multiple tags to the entity.
     *
     * @param tags - Tag strings to add
     * @returns This builder for method chaining
     */
    withTags(...tags: string[]): this {
        this.spawnCommand.tags.push(...tags);
        return this;
    }

    /**
     * Set the parent entity.
     *
     * @param parent - Parent entity or its symbol ID
     * @returns This builder for method chaining
     */
    withParent(parent: EntityDef | symbol): this {
        this.spawnCommand.parentId = typeof parent === 'symbol' ? parent : parent.id;
        return this;
    }

    /**
     * Register a callback to be invoked after the entity is created.
     *
     * @param callback - Function to call with the newly created entity
     * @returns This builder for method chaining
     */
    onCreate(callback: (entity: Entity) => void): this {
        this.spawnCommand.callback = callback;
        return this;
    }

    /**
     * Get the placeholder ID for this spawn command.
     * This ID can be used to reference the entity in subsequent commands
     * before it's actually created.
     *
     * @returns The placeholder symbol ID
     */
    get id(): symbol {
        return this.spawnCommand.placeholderId;
    }
}

/**
 * Fluent builder for modifying an existing entity.
 *
 * EntityCommandBuilder allows you to queue modifications to an existing entity
 * including adding/removing components, tags, and hierarchy changes. All
 * changes are deferred until the command buffer is executed.
 *
 * @example
 * ```typescript
 * engine.commands.entity(playerEntity)
 *   .addComponent(Stunned, 5)
 *   .removeComponent(Velocity)
 *   .addTag('debuffed');
 *
 * // Changes are applied when commands are executed
 * ```
 *
 * @public
 */
export class EntityCommandBuilder {
    constructor(
        private commandBuffer: CommandBuffer,
        private entityId: symbol
    ) {}

    /**
     * Queue adding a component to this entity.
     *
     * @typeParam T - The component type
     * @param type - Component class/constructor
     * @param args - Arguments to pass to the component constructor
     * @returns This builder for method chaining
     */
    addComponent<T>(
        type: ComponentIdentifier<T>,
        ...args: ConstructorParameters<ComponentIdentifier<T>>
    ): this {
        this.commandBuffer['addCommand']({
            type: 'add_component',
            entityId: this.entityId,
            componentType: type,
            args,
            timestamp: Date.now(),
        } as AddComponentCommand);
        return this;
    }

    /**
     * Queue removing a component from this entity.
     *
     * @typeParam T - The component type
     * @param type - Component class/constructor
     * @returns This builder for method chaining
     */
    removeComponent<T>(type: ComponentIdentifier<T>): this {
        this.commandBuffer['addCommand']({
            type: 'remove_component',
            entityId: this.entityId,
            componentType: type,
            timestamp: Date.now(),
        } as RemoveComponentCommand);
        return this;
    }

    /**
     * Queue adding a tag to this entity.
     *
     * @param tag - Tag string to add
     * @returns This builder for method chaining
     */
    addTag(tag: string): this {
        this.commandBuffer['addCommand']({
            type: 'add_tag',
            entityId: this.entityId,
            tag,
            timestamp: Date.now(),
        } as AddTagCommand);
        return this;
    }

    /**
     * Queue removing a tag from this entity.
     *
     * @param tag - Tag string to remove
     * @returns This builder for method chaining
     */
    removeTag(tag: string): this {
        this.commandBuffer['addCommand']({
            type: 'remove_tag',
            entityId: this.entityId,
            tag,
            timestamp: Date.now(),
        } as RemoveTagCommand);
        return this;
    }

    /**
     * Queue setting this entity's parent.
     *
     * @param parent - Parent entity, its symbol ID, or null to clear parent
     * @returns This builder for method chaining
     */
    setParent(parent: EntityDef | symbol | null): this {
        const parentId = parent === null ? null : typeof parent === 'symbol' ? parent : parent.id;
        this.commandBuffer['addCommand']({
            type: 'set_parent',
            entityId: this.entityId,
            parentId,
            timestamp: Date.now(),
        } as SetParentCommand);
        return this;
    }

    /**
     * Queue adding a child entity to this entity.
     *
     * @param child - Child entity or its symbol ID
     * @returns This builder for method chaining
     */
    addChild(child: EntityDef | symbol): this {
        const childId = typeof child === 'symbol' ? child : child.id;
        this.commandBuffer['addCommand']({
            type: 'add_child',
            entityId: this.entityId,
            childId,
            timestamp: Date.now(),
        } as AddChildCommand);
        return this;
    }

    /**
     * Queue removing a child entity from this entity.
     *
     * @param child - Child entity or its symbol ID
     * @returns This builder for method chaining
     */
    removeChild(child: EntityDef | symbol): this {
        const childId = typeof child === 'symbol' ? child : child.id;
        this.commandBuffer['addCommand']({
            type: 'remove_child',
            entityId: this.entityId,
            childId,
            timestamp: Date.now(),
        } as RemoveChildCommand);
        return this;
    }

    /**
     * Queue destruction of this entity.
     *
     * @returns void (no chaining after despawn)
     */
    despawn(): void {
        this.commandBuffer['addCommand']({
            type: 'despawn',
            entityId: this.entityId,
            timestamp: Date.now(),
        } as DespawnCommand);
    }
}

/**
 * Command buffer for queueing and executing deferred entity operations.
 *
 * The CommandBuffer provides a safe way to perform entity operations during system
 * execution without causing iterator invalidation or archetype transition issues.
 * Commands are queued and executed in order at the end of the update cycle or
 * manually via `execute()`.
 *
 * @remarks
 * Commands are processed in FIFO order, maintaining the sequence in which they
 * were queued. Spawn commands create placeholder IDs that can be referenced in
 * subsequent commands before execution.
 *
 * @example Basic Usage
 * ```typescript
 * // During system execution
 * engine.commands.spawn()
 *   .named('Bullet')
 *   .with(Position, player.x, player.y)
 *   .with(Velocity, 100, 0);
 *
 * engine.commands.entity(enemy)
 *   .removeComponent(Shield);
 *
 * engine.commands.despawn(deadEnemy);
 *
 * // Commands are executed automatically at end of update
 * ```
 *
 * @example Manual Execution
 * ```typescript
 * // Queue some commands
 * engine.commands.spawn().with(Position, 0, 0);
 * engine.commands.spawn().with(Position, 10, 10);
 *
 * // Execute immediately
 * const result = engine.commands.execute();
 * console.log(`Created ${result.entitiesSpawned} entities`);
 * ```
 *
 * @example Batch Spawning
 * ```typescript
 * engine.commands.spawnBatch(100, (builder, index) => {
 *   builder
 *     .named(`Particle_${index}`)
 *     .with(Position, Math.random() * 100, Math.random() * 100)
 *     .with(Lifetime, 5);
 * });
 * ```
 *
 * @public
 */
export class CommandBuffer {
    private commands: EntityCommand[] = [];
    private _isExecuting: boolean = false;
    private _debugMode: boolean = false;

    /** Map of placeholder IDs to actual entity IDs after execution */
    private placeholderToEntity: Map<symbol, Entity> = new Map();

    /** Engine reference for entity operations - uses interface to avoid circular deps */
    private engine: EngineInterface;

    /** Logger for command buffer operations */
    private logger?: Logger;

    constructor(engine: EngineInterface, debugMode: boolean = false, logger?: Logger) {
        this.engine = engine;
        this._debugMode = debugMode;
        this.logger = logger?.withTag('Commands');
    }

    /**
     * Check if the command buffer is currently executing.
     */
    get isExecuting(): boolean {
        return this._isExecuting;
    }

    /**
     * Get the number of pending commands.
     */
    get pendingCount(): number {
        return this.commands.length;
    }

    /**
     * Check if there are pending commands.
     */
    get hasPendingCommands(): boolean {
        return this.commands.length > 0;
    }

    /**
     * Add a command to the buffer.
     * @internal
     */
    private addCommand(command: EntityCommand): void {
        this.commands.push(command);
    }

    /**
     * Begin building a spawn command for a new entity.
     *
     * @returns A SpawnEntityBuilder for configuring the new entity
     *
     * @example
     * ```typescript
     * engine.commands.spawn()
     *   .named('Enemy')
     *   .with(Position, 100, 50)
     *   .with(Health, 50, 50)
     *   .withTag('hostile');
     * ```
     */
    spawn(): SpawnEntityBuilder {
        return new SpawnEntityBuilder(this);
    }

    /**
     * Begin building commands for an existing entity.
     *
     * @param entity - The entity or its symbol ID
     * @returns An EntityCommandBuilder for queueing modifications
     *
     * @example
     * ```typescript
     * engine.commands.entity(player)
     *   .addComponent(Buff, 'speed', 1.5)
     *   .addTag('buffed');
     * ```
     */
    entity(entity: EntityDef | symbol): EntityCommandBuilder {
        const entityId = typeof entity === 'symbol' ? entity : entity.id;
        return new EntityCommandBuilder(this, entityId);
    }

    /**
     * Queue an entity for destruction.
     *
     * @param entity - The entity or its symbol ID to destroy
     *
     * @example
     * ```typescript
     * engine.commands.despawn(enemy);
     * ```
     */
    despawn(entity: EntityDef | symbol): void {
        const entityId = typeof entity === 'symbol' ? entity : entity.id;
        this.addCommand({
            type: 'despawn',
            entityId,
            timestamp: Date.now(),
        } as DespawnCommand);
    }

    /**
     * Spawn multiple entities efficiently using a batch operation.
     *
     * @param count - Number of entities to spawn
     * @param configureFn - Function to configure each entity builder
     * @returns Array of spawn builders (for advanced reference)
     *
     * @example
     * ```typescript
     * // Spawn 100 particles
     * engine.commands.spawnBatch(100, (builder, index) => {
     *   builder
     *     .named(`Particle_${index}`)
     *     .with(Position, Math.random() * 800, Math.random() * 600)
     *     .with(Velocity, Math.random() * 10 - 5, Math.random() * 10 - 5)
     *     .with(Lifetime, Math.random() * 3 + 1);
     * });
     * ```
     */
    spawnBatch(
        count: number,
        configureFn: (builder: SpawnEntityBuilder, index: number) => void
    ): SpawnEntityBuilder[] {
        const builders: SpawnEntityBuilder[] = [];
        for (let i = 0; i < count; i++) {
            const builder = this.spawn();
            configureFn(builder, i);
            builders.push(builder);
        }
        return builders;
    }

    /**
     * Execute all pending commands immediately.
     *
     * Commands are executed in FIFO order. If rollback is enabled (default)
     * and an error occurs, all changes made during this execution batch
     * will be reverted.
     *
     * @param options - Execution options
     * @param options.rollbackOnError - Whether to rollback on errors (default: true)
     * @returns Execution result with statistics
     *
     * @example
     * ```typescript
     * const result = engine.commands.execute();
     * console.log(`Executed ${result.commandsExecuted} commands`);
     * console.log(`Spawned ${result.entitiesSpawned} entities`);
     * ```
     */
    execute(options: { rollbackOnError?: boolean } = {}): CommandExecutionResult {
        const { rollbackOnError = true } = options;
        const startTime = performance.now();

        const result: CommandExecutionResult = {
            commandsExecuted: 0,
            entitiesSpawned: 0,
            entitiesDespawned: 0,
            componentsAdded: 0,
            componentsRemoved: 0,
            tagsAdded: 0,
            tagsRemoved: 0,
            executionTimeMs: 0,
            errors: [],
            rolledBack: false,
        };

        if (this.commands.length === 0) {
            result.executionTimeMs = performance.now() - startTime;
            return result;
        }

        this._isExecuting = true;

        // Store commands for potential rollback
        const commandsToExecute = [...this.commands];
        this.commands = [];

        // Track changes for rollback
        const rollbackState: RollbackState = {
            spawnedEntities: [],
            componentChanges: [],
            tagChanges: [],
            hierarchyChanges: [],
        };

        try {
            // Execute commands in order
            for (const command of commandsToExecute) {
                try {
                    this.executeCommand(command, result, rollbackState);
                    result.commandsExecuted++;
                } catch (error) {
                    result.errors.push(error instanceof Error ? error : new Error(String(error)));

                    if (this._debugMode && this.logger) {
                        this.logger.error(`Error executing command ${command.type}:`, error);
                    }

                    if (rollbackOnError) {
                        this.rollback(rollbackState);
                        result.rolledBack = true;
                        break;
                    }
                }
            }

            // Execute any spawn callbacks after all spawns are complete
            if (!result.rolledBack) {
                for (const command of commandsToExecute) {
                    if (command.type === 'spawn' && command.callback) {
                        const entity = this.placeholderToEntity.get(command.placeholderId);
                        if (entity) {
                            try {
                                command.callback(entity);
                            } catch (error) {
                                if (this._debugMode && this.logger) {
                                    this.logger.error('Error in spawn callback:', error);
                                }
                            }
                        }
                    }
                }
            }
        } finally {
            this._isExecuting = false;
            this.placeholderToEntity.clear();
        }

        result.executionTimeMs = performance.now() - startTime;

        if (this._debugMode && this.logger) {
            this.logger.debug(
                `Executed ${result.commandsExecuted} commands in ${result.executionTimeMs.toFixed(2)}ms`
            );
        }

        return result;
    }

    /**
     * Clear all pending commands without executing them.
     */
    clear(): void {
        this.commands = [];
        if (this._debugMode && this.logger) {
            this.logger.debug('Cleared all pending commands');
        }
    }

    /**
     * Get a copy of pending commands (for debugging/inspection).
     */
    getPendingCommands(): ReadonlyArray<EntityCommand> {
        return [...this.commands];
    }

    /**
     * Resolve a placeholder ID to the actual entity (only valid during/after execution).
     * @internal
     */
    resolveEntity(placeholderOrEntityId: symbol): Entity | undefined {
        // First check if it's a placeholder from a spawn command
        const fromPlaceholder = this.placeholderToEntity.get(placeholderOrEntityId);
        if (fromPlaceholder) {
            return fromPlaceholder;
        }
        // Otherwise try to get it from the engine
        return this.engine.getEntity(placeholderOrEntityId);
    }

    /**
     * Execute a single command.
     * @internal
     */
    private executeCommand(
        command: EntityCommand,
        result: CommandExecutionResult,
        rollbackState: RollbackState
    ): void {
        switch (command.type) {
            case 'spawn':
                this.executeSpawnCommand(command, result, rollbackState);
                break;
            case 'despawn':
                this.executeDespawnCommand(command, result, rollbackState);
                break;
            case 'add_component':
                this.executeAddComponentCommand(command, result, rollbackState);
                break;
            case 'remove_component':
                this.executeRemoveComponentCommand(command, result, rollbackState);
                break;
            case 'add_tag':
                this.executeAddTagCommand(command, result, rollbackState);
                break;
            case 'remove_tag':
                this.executeRemoveTagCommand(command, result, rollbackState);
                break;
            case 'set_parent':
                this.executeSetParentCommand(command, rollbackState);
                break;
            case 'add_child':
                this.executeAddChildCommand(command, rollbackState);
                break;
            case 'remove_child':
                this.executeRemoveChildCommand(command, rollbackState);
                break;
        }
    }

    private executeSpawnCommand(
        command: SpawnCommand,
        result: CommandExecutionResult,
        rollbackState: RollbackState
    ): void {
        const entity = this.engine.createEntity(command.name);

        // Map placeholder to actual entity
        this.placeholderToEntity.set(command.placeholderId, entity);

        // Track for rollback
        rollbackState.spawnedEntities.push(entity);

        // Add components
        for (const comp of command.components) {
            entity.addComponent(comp.type, ...comp.args);
        }
        result.componentsAdded += command.components.length;

        // Add tags
        for (const tag of command.tags) {
            entity.addTag(tag);
        }
        result.tagsAdded += command.tags.length;

        // Set parent if specified
        if (command.parentId) {
            const parent = this.resolveEntity(command.parentId);
            if (parent) {
                entity.setParent(parent);
                rollbackState.hierarchyChanges.push({
                    entityId: entity.id,
                    oldParentId: undefined,
                    newParentId: parent.id,
                });
            }
        }

        result.entitiesSpawned++;
    }

    private executeDespawnCommand(
        command: DespawnCommand,
        result: CommandExecutionResult,
        _rollbackState: RollbackState
    ): void {
        const entity = this.resolveEntity(command.entityId);
        if (entity) {
            entity.queueFree();
            result.entitiesDespawned++;
        }
    }

    private executeAddComponentCommand(
        command: AddComponentCommand,
        result: CommandExecutionResult,
        rollbackState: RollbackState
    ): void {
        const entity = this.resolveEntity(command.entityId);
        if (entity && !entity.hasComponent(command.componentType)) {
            entity.addComponent(command.componentType, ...command.args);
            rollbackState.componentChanges.push({
                entityId: command.entityId,
                componentType: command.componentType,
                action: 'added',
            });
            result.componentsAdded++;
        }
    }

    private executeRemoveComponentCommand(
        command: RemoveComponentCommand,
        result: CommandExecutionResult,
        rollbackState: RollbackState
    ): void {
        const entity = this.resolveEntity(command.entityId);
        if (entity && entity.hasComponent(command.componentType)) {
            // Store component data for rollback
            const componentData = entity.getComponent(command.componentType);
            rollbackState.componentChanges.push({
                entityId: command.entityId,
                componentType: command.componentType,
                action: 'removed',
                componentData: deepCloneComponent(componentData) as Record<string, unknown>,
            });
            entity.removeComponent(command.componentType);
            result.componentsRemoved++;
        }
    }

    private executeAddTagCommand(
        command: AddTagCommand,
        result: CommandExecutionResult,
        rollbackState: RollbackState
    ): void {
        const entity = this.resolveEntity(command.entityId);
        if (entity && !entity.hasTag(command.tag)) {
            entity.addTag(command.tag);
            rollbackState.tagChanges.push({
                entityId: command.entityId,
                tag: command.tag,
                action: 'added',
            });
            result.tagsAdded++;
        }
    }

    private executeRemoveTagCommand(
        command: RemoveTagCommand,
        result: CommandExecutionResult,
        rollbackState: RollbackState
    ): void {
        const entity = this.resolveEntity(command.entityId);
        if (entity && entity.hasTag(command.tag)) {
            entity.removeTag(command.tag);
            rollbackState.tagChanges.push({
                entityId: command.entityId,
                tag: command.tag,
                action: 'removed',
            });
            result.tagsRemoved++;
        }
    }

    private executeSetParentCommand(command: SetParentCommand, rollbackState: RollbackState): void {
        const entity = this.resolveEntity(command.entityId);
        if (entity) {
            const oldParent = entity.parent;
            const newParent = command.parentId ? this.resolveEntity(command.parentId) : null;

            rollbackState.hierarchyChanges.push({
                entityId: command.entityId,
                oldParentId: oldParent?.id,
                newParentId: newParent?.id,
            });

            // Only set parent if it was explicitly null or we found the entity
            entity.setParent(newParent ?? null);
        }
    }

    private executeAddChildCommand(command: AddChildCommand, rollbackState: RollbackState): void {
        const entity = this.resolveEntity(command.entityId);
        const child = this.resolveEntity(command.childId);
        if (entity && child) {
            const oldParent = child.parent;
            rollbackState.hierarchyChanges.push({
                entityId: command.childId,
                oldParentId: oldParent?.id,
                newParentId: entity.id,
            });
            entity.addChild(child);
        }
    }

    private executeRemoveChildCommand(
        command: RemoveChildCommand,
        rollbackState: RollbackState
    ): void {
        const entity = this.resolveEntity(command.entityId);
        const child = this.resolveEntity(command.childId);
        if (entity && child) {
            rollbackState.hierarchyChanges.push({
                entityId: command.childId,
                oldParentId: entity.id,
                newParentId: undefined,
            });
            entity.removeChild(child);
        }
    }

    /**
     * Rollback all changes made during execution.
     * @internal
     */
    private rollback(state: RollbackState): void {
        if (this._debugMode && this.logger) {
            this.logger.debug('Rolling back changes...');
        }

        let failedOperations = 0;

        // Rollback hierarchy changes in reverse order
        for (const change of state.hierarchyChanges.toReversed()) {
            const entity = this.engine.getEntity(change.entityId);
            if (entity) {
                const oldParent = change.oldParentId
                    ? this.engine.getEntity(change.oldParentId)
                    : null;
                entity.setParent(oldParent ?? null);
            } else {
                failedOperations++;
                if (this._debugMode && this.logger) {
                    this.logger.warn('Rollback skipped: entity not found for hierarchy change');
                }
            }
        }

        // Rollback tag changes in reverse order
        for (const change of state.tagChanges.toReversed()) {
            const entity = this.engine.getEntity(change.entityId);
            if (entity) {
                if (change.action === 'added') {
                    entity.removeTag(change.tag);
                } else {
                    entity.addTag(change.tag);
                }
            } else {
                failedOperations++;
                if (this._debugMode && this.logger) {
                    this.logger.warn(
                        `Rollback skipped: entity not found for tag change (${change.tag})`
                    );
                }
            }
        }

        // Rollback component changes in reverse order
        for (const change of state.componentChanges.toReversed()) {
            const entity = this.engine.getEntity(change.entityId);
            if (entity) {
                if (change.action === 'added') {
                    entity.removeComponent(change.componentType);
                } else if (change.action === 'removed' && change.componentData) {
                    // Re-add the component with its original data
                    const componentData = change.componentData;
                    const dataKeys = Object.keys(componentData);
                    const dataValues = dataKeys.map((key) => componentData[key]);
                    try {
                        entity.addComponent(change.componentType, ...dataValues);
                    } catch {
                        // If constructor args don't match, try creating empty and assigning
                        entity.addComponent(change.componentType);
                        const component = entity.getComponent(change.componentType);
                        Object.assign(component as object, componentData);
                    }
                }
            } else {
                failedOperations++;
                if (this._debugMode && this.logger) {
                    this.logger.warn(
                        `Rollback skipped: entity not found for component change (${change.componentType.name})`
                    );
                }
            }
        }

        // Rollback spawned entities (mark for deletion)
        for (const entity of state.spawnedEntities.toReversed()) {
            entity.queueFree();
        }

        if (this._debugMode && this.logger) {
            if (failedOperations > 0) {
                this.logger.warn(
                    `Rollback partially complete: ${failedOperations} operation(s) skipped due to missing entities`
                );
            } else {
                this.logger.debug('Rollback complete');
            }
        }
    }
}

/**
 * State tracked for rollback purposes.
 * @internal
 */
interface RollbackState {
    spawnedEntities: Entity[];
    componentChanges: Array<{
        entityId: symbol;
        componentType: ComponentIdentifier;
        action: 'added' | 'removed';
        componentData?: Record<string, unknown>;
    }>;
    tagChanges: Array<{
        entityId: symbol;
        tag: string;
        action: 'added' | 'removed';
    }>;
    hierarchyChanges: Array<{
        entityId: symbol;
        oldParentId?: symbol;
        newParentId?: symbol;
    }>;
}
