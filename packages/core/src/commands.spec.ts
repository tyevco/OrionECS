/**
 * Tests for Entity Commands / Deferred Operations System
 */

import type { Entity } from './core';
import { type Engine, EngineBuilder } from './engine';

// Test components
class Position {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

class Velocity {
    constructor(
        public vx: number = 0,
        public vy: number = 0
    ) {}
}

class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
    ) {}
}

class Damage {
    constructor(public amount: number = 10) {}
}

class Shield {
    constructor(public value: number = 50) {}
}

describe('CommandBuffer', () => {
    let engine: Engine;

    beforeEach(() => {
        engine = new EngineBuilder().withDebugMode(false).withArchetypes(true).build();
    });

    describe('spawn()', () => {
        it('should spawn an entity with name', () => {
            engine.commands.spawn().named('TestEntity');

            expect(engine.commands.pendingCount).toBe(1);

            const result = engine.commands.execute();

            expect(result.entitiesSpawned).toBe(1);
            expect(result.commandsExecuted).toBe(1);
            expect(engine.getEntityByName('TestEntity')).toBeDefined();
        });

        it('should spawn an entity with components', () => {
            engine.commands.spawn().named('Player').with(Position, 100, 200).with(Health, 80, 100);

            const result = engine.commands.execute();

            expect(result.entitiesSpawned).toBe(1);
            expect(result.componentsAdded).toBe(2);

            const player = engine.getEntityByName('Player');
            expect(player).toBeDefined();
            expect(player!.hasComponent(Position)).toBe(true);
            expect(player!.hasComponent(Health)).toBe(true);

            const pos = player!.getComponent(Position);
            expect(pos.x).toBe(100);
            expect(pos.y).toBe(200);

            const health = player!.getComponent(Health);
            expect(health.current).toBe(80);
            expect(health.max).toBe(100);
        });

        it('should spawn an entity with tags', () => {
            engine.commands.spawn().named('Enemy').withTag('hostile').withTags('enemy', 'spawned');

            engine.commands.execute();

            const enemy = engine.getEntityByName('Enemy');
            expect(enemy).toBeDefined();
            expect(enemy!.hasTag('hostile')).toBe(true);
            expect(enemy!.hasTag('enemy')).toBe(true);
            expect(enemy!.hasTag('spawned')).toBe(true);
        });

        it('should invoke onCreate callback after spawn', () => {
            let callbackEntity: Entity | null = null;

            engine.commands
                .spawn()
                .named('CallbackTest')
                .with(Position, 50, 50)
                .onCreate((entity) => {
                    callbackEntity = entity;
                });

            engine.commands.execute();

            expect(callbackEntity).not.toBeNull();
            expect(callbackEntity!.name).toBe('CallbackTest');
            expect(callbackEntity!.hasComponent(Position)).toBe(true);
        });

        it('should spawn entity with parent relationship', () => {
            const parent = engine.createEntity('Parent');

            engine.commands.spawn().named('Child').withParent(parent);

            engine.commands.execute();

            const child = engine.getEntityByName('Child');
            expect(child).toBeDefined();
            expect(child!.parent).toBe(parent);
            expect(parent.children).toContain(child);
        });
    });

    describe('entity()', () => {
        let testEntity: Entity;

        beforeEach(() => {
            testEntity = engine.createEntity('TestEntity');
            testEntity.addComponent(Position, 0, 0);
        });

        it('should add component to existing entity', () => {
            engine.commands.entity(testEntity).addComponent(Health, 75, 100);

            expect(testEntity.hasComponent(Health)).toBe(false);

            engine.commands.execute();

            expect(testEntity.hasComponent(Health)).toBe(true);
            const health = testEntity.getComponent(Health);
            expect(health.current).toBe(75);
        });

        it('should remove component from existing entity', () => {
            testEntity.addComponent(Velocity, 5, 10);
            expect(testEntity.hasComponent(Velocity)).toBe(true);

            engine.commands.entity(testEntity).removeComponent(Velocity);

            expect(testEntity.hasComponent(Velocity)).toBe(true);

            engine.commands.execute();

            expect(testEntity.hasComponent(Velocity)).toBe(false);
        });

        it('should add tag to existing entity', () => {
            engine.commands.entity(testEntity).addTag('marked');

            expect(testEntity.hasTag('marked')).toBe(false);

            engine.commands.execute();

            expect(testEntity.hasTag('marked')).toBe(true);
        });

        it('should remove tag from existing entity', () => {
            testEntity.addTag('toRemove');
            expect(testEntity.hasTag('toRemove')).toBe(true);

            engine.commands.entity(testEntity).removeTag('toRemove');

            engine.commands.execute();

            expect(testEntity.hasTag('toRemove')).toBe(false);
        });

        it('should chain multiple operations', () => {
            engine.commands
                .entity(testEntity)
                .addComponent(Health, 100, 100)
                .addComponent(Shield, 50)
                .addTag('buffed')
                .addTag('active');

            const result = engine.commands.execute();

            expect(result.componentsAdded).toBe(2);
            expect(result.tagsAdded).toBe(2);
            expect(testEntity.hasComponent(Health)).toBe(true);
            expect(testEntity.hasComponent(Shield)).toBe(true);
            expect(testEntity.hasTag('buffed')).toBe(true);
            expect(testEntity.hasTag('active')).toBe(true);
        });

        it('should set parent relationship', () => {
            const parent = engine.createEntity('Parent');

            engine.commands.entity(testEntity).setParent(parent);

            expect(testEntity.parent).toBeUndefined();

            engine.commands.execute();

            expect(testEntity.parent).toBe(parent);
        });

        it('should add child relationship', () => {
            const child = engine.createEntity('Child');

            engine.commands.entity(testEntity).addChild(child);

            engine.commands.execute();

            expect(child.parent).toBe(testEntity);
            expect(testEntity.children).toContain(child);
        });
    });

    describe('despawn()', () => {
        it('should mark entity for deletion', () => {
            const entity = engine.createEntity('ToDelete');
            expect(entity.isMarkedForDeletion).toBe(false);

            engine.commands.despawn(entity);
            engine.commands.execute();

            expect(entity.isMarkedForDeletion).toBe(true);
        });

        it('should work with entity ID symbol', () => {
            const entity = engine.createEntity('ToDelete');
            const entityId = entity.id;

            engine.commands.despawn(entityId);
            engine.commands.execute();

            expect(entity.isMarkedForDeletion).toBe(true);
        });

        it('should despawn via entity builder', () => {
            const entity = engine.createEntity('ToDelete');

            engine.commands.entity(entity).despawn();
            const result = engine.commands.execute();

            expect(result.entitiesDespawned).toBe(1);
            expect(entity.isMarkedForDeletion).toBe(true);
        });
    });

    describe('spawnBatch()', () => {
        it('should spawn multiple entities efficiently', () => {
            engine.commands.spawnBatch(10, (builder, index) => {
                builder.named(`Entity_${index}`).with(Position, index * 10, index * 20);
            });

            expect(engine.commands.pendingCount).toBe(10);

            const result = engine.commands.execute();

            expect(result.entitiesSpawned).toBe(10);
            expect(result.commandsExecuted).toBe(10);

            for (let i = 0; i < 10; i++) {
                const entity = engine.getEntityByName(`Entity_${i}`);
                expect(entity).toBeDefined();

                const pos = entity!.getComponent(Position);
                expect(pos.x).toBe(i * 10);
                expect(pos.y).toBe(i * 20);
            }
        });

        it('should return array of spawn builders', () => {
            const builders = engine.commands.spawnBatch(5, (builder, index) => {
                builder.named(`Batch_${index}`);
            });

            expect(builders).toHaveLength(5);
        });
    });

    describe('execute()', () => {
        it('should execute commands in order (FIFO)', () => {
            const executionOrder: string[] = [];

            // Spawn entity first
            engine.commands
                .spawn()
                .named('First')
                .onCreate(() => executionOrder.push('spawn'));

            // Then modify via entity builder
            const existing = engine.createEntity('Existing');
            engine.commands.entity(existing).addTag('modified');

            // Then despawn another
            const toDelete = engine.createEntity('ToDelete');
            engine.commands.despawn(toDelete);

            const result = engine.commands.execute();

            expect(result.commandsExecuted).toBe(3);
            expect(result.entitiesSpawned).toBe(1);
            expect(result.entitiesDespawned).toBe(1);
            expect(result.tagsAdded).toBe(1);
        });

        it('should return execution statistics', () => {
            engine.commands
                .spawn()
                .named('Test')
                .with(Position, 0, 0)
                .with(Health, 100, 100)
                .withTag('test');

            const result = engine.commands.execute();

            expect(result.commandsExecuted).toBe(1);
            expect(result.entitiesSpawned).toBe(1);
            expect(result.componentsAdded).toBe(2);
            expect(result.tagsAdded).toBe(1);
            expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
            expect(result.errors).toHaveLength(0);
            expect(result.rolledBack).toBe(false);
        });

        it('should clear pending commands after execution', () => {
            engine.commands.spawn().named('Test');

            expect(engine.commands.pendingCount).toBe(1);

            engine.commands.execute();

            expect(engine.commands.pendingCount).toBe(0);
        });
    });

    describe('rollback', () => {
        it('should rollback spawned entities on error', () => {
            // Create a scenario where an error will occur
            const entity = engine.createEntity('Existing');

            // Register a validator that will fail
            engine.registerComponentValidator(Damage, {
                validate: (component) => {
                    if (component.amount > 100) {
                        return 'Damage amount too high';
                    }
                    return true;
                },
            });

            // Spawn entity successfully first
            engine.commands.spawn().named('WillBeRolledBack').with(Position, 0, 0);

            // Then try to add invalid component which should fail
            engine.commands.entity(entity).addComponent(Damage, 200); // Will fail validation

            const result = engine.commands.execute({ rollbackOnError: true });

            expect(result.rolledBack).toBe(true);
            expect(result.errors.length).toBeGreaterThan(0);

            // The spawned entity should be marked for deletion due to rollback
            const rolledBackEntity = engine.getEntityByName('WillBeRolledBack');
            if (rolledBackEntity) {
                expect(rolledBackEntity.isMarkedForDeletion).toBe(true);
            }
        });

        it('should continue without rollback when disabled', () => {
            engine.registerComponentValidator(Damage, {
                validate: (component) => {
                    if (component.amount > 100) {
                        throw new Error('Damage amount too high');
                    }
                    return true;
                },
            });

            // First command will succeed
            engine.commands.spawn().named('WillSucceed').with(Position, 0, 0);

            // Second command will fail
            const existing = engine.createEntity('Existing');
            engine.commands.entity(existing).addComponent(Damage, 200); // Will fail

            const result = engine.commands.execute({ rollbackOnError: false });

            expect(result.rolledBack).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);

            // First spawned entity should still exist
            const succeeded = engine.getEntityByName('WillSucceed');
            expect(succeeded).toBeDefined();
            expect(succeeded!.isMarkedForDeletion).toBe(false);
        });
    });

    describe('auto-execute during update', () => {
        it('should automatically execute commands during update', () => {
            engine.commands.spawn().named('AutoSpawn').with(Position, 0, 0);

            expect(engine.commands.pendingCount).toBe(1);

            engine.update(16);

            expect(engine.commands.pendingCount).toBe(0);

            const entity = engine.getEntityByName('AutoSpawn');
            expect(entity).toBeDefined();
        });

        it('should not auto-execute when disabled', () => {
            engine.setAutoExecuteCommands(false);

            engine.commands.spawn().named('ManualOnly').with(Position, 0, 0);

            engine.update(16);

            expect(engine.commands.pendingCount).toBe(1);
            expect(engine.getEntityByName('ManualOnly')).toBeUndefined();

            // Manual execute
            engine.commands.execute();

            expect(engine.commands.pendingCount).toBe(0);
            expect(engine.getEntityByName('ManualOnly')).toBeDefined();
        });

        it('should report auto-execute status', () => {
            expect(engine.isAutoExecuteCommandsEnabled()).toBe(true);

            engine.setAutoExecuteCommands(false);
            expect(engine.isAutoExecuteCommandsEnabled()).toBe(false);

            engine.setAutoExecuteCommands(true);
            expect(engine.isAutoExecuteCommandsEnabled()).toBe(true);
        });
    });

    describe('system integration', () => {
        it('should allow spawning entities during system execution', () => {
            // Create spawner entities
            for (let i = 0; i < 3; i++) {
                const spawner = engine.createEntity(`Spawner_${i}`);
                spawner.addComponent(Position, i * 10, 0);
                spawner.addTag('spawner');
            }

            // Create a system that spawns an entity for each spawner
            engine.createSystem(
                'SpawnerSystem',
                { all: [Position], tags: ['spawner'] },
                {
                    act: (entity, position) => {
                        engine.commands
                            .spawn()
                            .named(`Spawned_from_${entity.name}`)
                            .with(Position, position.x, position.y + 100);
                    },
                }
            );

            // Run update to execute system
            engine.update(16);

            // Spawned entities should now exist
            expect(engine.getEntityByName('Spawned_from_Spawner_0')).toBeDefined();
            expect(engine.getEntityByName('Spawned_from_Spawner_1')).toBeDefined();
            expect(engine.getEntityByName('Spawned_from_Spawner_2')).toBeDefined();

            // Verify positions
            const spawned0 = engine.getEntityByName('Spawned_from_Spawner_0')!;
            expect(spawned0.getComponent(Position).y).toBe(100);
        });

        it('should allow despawning entities during system iteration', () => {
            // Create entities to despawn
            for (let i = 0; i < 5; i++) {
                const entity = engine.createEntity(`Target_${i}`);
                entity.addComponent(Health, 0, 100); // 0 health = should die
                entity.addTag('enemy');
            }

            // Create cleanup system
            engine.createSystem(
                'CleanupSystem',
                { all: [Health], tags: ['enemy'] },
                {
                    act: (entity, health) => {
                        if (health.current <= 0) {
                            engine.commands.despawn(entity);
                        }
                    },
                }
            );

            engine.update(16);
            engine.update(16); // Second update to actually clean up

            // All entities should be gone
            for (let i = 0; i < 5; i++) {
                expect(engine.getEntityByName(`Target_${i}`)).toBeUndefined();
            }
        });
    });

    describe('clear()', () => {
        it('should clear all pending commands', () => {
            engine.commands.spawn().named('Test1');
            engine.commands.spawn().named('Test2');
            engine.commands.spawn().named('Test3');

            expect(engine.commands.pendingCount).toBe(3);

            engine.commands.clear();

            expect(engine.commands.pendingCount).toBe(0);

            engine.commands.execute();

            expect(engine.getEntityByName('Test1')).toBeUndefined();
            expect(engine.getEntityByName('Test2')).toBeUndefined();
            expect(engine.getEntityByName('Test3')).toBeUndefined();
        });
    });

    describe('getPendingCommands()', () => {
        it('should return copy of pending commands', () => {
            engine.commands.spawn().named('Test1');
            engine.commands.spawn().named('Test2');

            const pending = engine.commands.getPendingCommands();

            expect(pending).toHaveLength(2);
            expect(pending[0].type).toBe('spawn');
            expect(pending[1].type).toBe('spawn');

            // Should be a copy, not the internal array
            engine.commands.clear();
            expect(pending).toHaveLength(2);
        });
    });

    describe('hasPendingCommands', () => {
        it('should return true when commands are pending', () => {
            expect(engine.commands.hasPendingCommands).toBe(false);

            engine.commands.spawn().named('Test');

            expect(engine.commands.hasPendingCommands).toBe(true);

            engine.commands.execute();

            expect(engine.commands.hasPendingCommands).toBe(false);
        });
    });

    describe('isExecuting', () => {
        it('should return false when not executing', () => {
            expect(engine.commands.isExecuting).toBe(false);
        });

        it('should return true during execution (observable via callback)', () => {
            let wasExecuting = false;

            engine.commands
                .spawn()
                .named('Test')
                .onCreate(() => {
                    wasExecuting = engine.commands.isExecuting;
                });

            engine.commands.execute();

            expect(wasExecuting).toBe(true);
            expect(engine.commands.isExecuting).toBe(false);
        });
    });

    describe('Engine.executeCommands()', () => {
        it('should be a convenience method for commands.execute()', () => {
            engine.commands.spawn().named('Test').with(Position, 0, 0);

            const result = engine.executeCommands();

            expect(result.entitiesSpawned).toBe(1);
            expect(engine.getEntityByName('Test')).toBeDefined();
        });

        it('should pass options to command buffer', () => {
            engine.registerComponentValidator(Damage, {
                validate: (component) => {
                    if (component.amount > 100) {
                        throw new Error('Too high');
                    }
                    return true;
                },
            });

            const entity = engine.createEntity('Test');
            engine.commands.entity(entity).addComponent(Damage, 200);

            const result = engine.executeCommands({ rollbackOnError: false });

            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.rolledBack).toBe(false);
        });
    });
});

describe('CommandBuffer with archetypes disabled', () => {
    let engine: Engine;

    beforeEach(() => {
        engine = new EngineBuilder().withArchetypes(false).build();
    });

    it('should work correctly without archetypes', () => {
        engine.commands.spawn().named('NoArchetype').with(Position, 10, 20).with(Health, 50, 100);

        const result = engine.commands.execute();

        expect(result.entitiesSpawned).toBe(1);
        expect(result.componentsAdded).toBe(2);

        const entity = engine.getEntityByName('NoArchetype');
        expect(entity).toBeDefined();
        expect(entity!.getComponent(Position).x).toBe(10);
        expect(entity!.getComponent(Health).current).toBe(50);
    });
});
