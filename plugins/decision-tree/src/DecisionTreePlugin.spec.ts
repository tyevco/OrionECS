/**
 * DecisionTreePlugin Test Suite
 *
 * Comprehensive tests covering:
 * - Plugin metadata and lifecycle
 * - DecisionTree component
 * - PredicateRegistry (built-in and custom predicates)
 * - DecisionTreeBuilder (fluent API)
 * - Tree evaluation (selector, sequence, predicate, add, remove nodes)
 * - API functionality
 * - JSON parsing
 * - Edge cases and error scenarios
 */

import { TestEngineBuilder } from '@orion-ecs/testing';
import type { EntityDef } from '../../../packages/core/src/index';
import { DecisionTreeBuilder, decide, parseTreeJSON } from './builder';
import { DecisionTree } from './components';
import type { DecisionTreeAPI } from './DecisionTreePlugin';
import { DecisionTreePlugin } from './DecisionTreePlugin';
import type { TreeDefinition, TreeDefinitionJSON } from './types';
import { PredicateRegistry } from './types';

// Type for test engine with decisions extension
type TestEngine = ReturnType<typeof TestEngineBuilder.prototype.build> & {
    decisions: DecisionTreeAPI;
};

// Test components for decision tree actions
class Attacking {
    constructor(public damage: number = 10) {}
}

class Chasing {
    constructor(public speed: number = 5) {}
}

class Patrolling {}

class Idle {}

class Fleeing {
    constructor(public direction: number = 0) {}
}

class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
    ) {}
}

class Target {
    constructor(public entityId: symbol | null = null) {}
}

describe('DecisionTreePlugin', () => {
    let engine: TestEngine;
    let plugin: DecisionTreePlugin;

    beforeEach(() => {
        plugin = new DecisionTreePlugin();
        engine = new TestEngineBuilder().use(plugin).build() as TestEngine;
    });

    afterEach(() => {
        engine.stop();
    });

    // =========================================================================
    // Plugin Metadata
    // =========================================================================

    describe('Plugin Metadata', () => {
        test('should have correct name and version', () => {
            expect(plugin.name).toBe('DecisionTreePlugin');
            expect(plugin.version).toBe('1.0.0');
        });
    });

    // =========================================================================
    // Plugin Installation
    // =========================================================================

    describe('Plugin Installation', () => {
        test('should install successfully', () => {
            expect(engine).toBeDefined();
        });

        test('should extend engine with decisions API', () => {
            expect(engine.decisions).toBeDefined();
        });

        test('should register DecisionTree component', () => {
            const entity = engine.createEntity('TestEntity');
            expect(() => entity.addComponent(DecisionTree, 'testTree')).not.toThrow();
        });

        test('should create DecisionTreeSystem', () => {
            const systems = engine.getSystemProfiles();
            const systemNames = systems.map((s: { name: string }) => s.name);
            expect(systemNames).toContain('DecisionTreeSystem');
        });

        test('should use custom system priority', () => {
            const customPlugin = new DecisionTreePlugin({ systemPriority: 200 });
            const customEngine = new TestEngineBuilder().use(customPlugin).build() as TestEngine;

            const systems = customEngine.getSystemProfiles();
            const decisionSystem = systems.find(
                (s: { name: string }) => s.name === 'DecisionTreeSystem'
            );
            expect(decisionSystem).toBeDefined();

            customEngine.stop();
        });

        test('should support fixed update mode', () => {
            const fixedPlugin = new DecisionTreePlugin({ useFixedUpdate: true });
            const fixedEngine = new TestEngineBuilder().use(fixedPlugin).build() as TestEngine;

            expect(fixedEngine.decisions).toBeDefined();
            fixedEngine.stop();
        });
    });

    // =========================================================================
    // Plugin Uninstallation
    // =========================================================================

    describe('Plugin Uninstallation', () => {
        test('should clear trees on uninstall', () => {
            const tree = decide('TestTree').selector().predicate('always').end().build();
            engine.decisions.register(tree);

            expect(engine.decisions.list()).toContain('TestTree');

            plugin.uninstall();

            // After uninstall, internal state should be cleared
            // Re-install to verify
            const newEngine = new TestEngineBuilder().use(plugin).build() as TestEngine;
            expect(newEngine.decisions.list()).not.toContain('TestTree');
            newEngine.stop();
        });
    });

    // =========================================================================
    // DecisionTree Component
    // =========================================================================

    describe('DecisionTree Component', () => {
        test('should create with required treeId', () => {
            const dt = new DecisionTree('myTree');
            expect(dt.treeId).toBe('myTree');
            expect(dt.enabled).toBe(true);
            expect(dt.lastPath).toEqual([]);
            expect(dt.lastResult).toBe(true);
        });

        test('should create with custom enabled state', () => {
            const dt = new DecisionTree('myTree', false);
            expect(dt.enabled).toBe(false);
        });

        test('should add component to entity', () => {
            const entity = engine.createEntity('TestEntity');
            entity.addComponent(DecisionTree, 'testTree');

            const dt = entity.getComponent(DecisionTree);
            expect(dt).toBeDefined();
            expect(dt!.treeId).toBe('testTree');
        });
    });

    // =========================================================================
    // PredicateRegistry
    // =========================================================================

    describe('PredicateRegistry', () => {
        describe('Built-in Predicates', () => {
            test('should have hasComponent predicate', () => {
                const registry = new PredicateRegistry();
                expect(registry.has('hasComponent')).toBe(true);
            });

            test('should have notHasComponent predicate', () => {
                const registry = new PredicateRegistry();
                expect(registry.has('notHasComponent')).toBe(true);
            });

            test('should have hasTag predicate', () => {
                const registry = new PredicateRegistry();
                expect(registry.has('hasTag')).toBe(true);
            });

            test('should have hasAllTags predicate', () => {
                const registry = new PredicateRegistry();
                expect(registry.has('hasAllTags')).toBe(true);
            });

            test('should have hasAnyTag predicate', () => {
                const registry = new PredicateRegistry();
                expect(registry.has('hasAnyTag')).toBe(true);
            });

            test('should have random predicate', () => {
                const registry = new PredicateRegistry();
                expect(registry.has('random')).toBe(true);
            });

            test('should have always predicate', () => {
                const registry = new PredicateRegistry();
                expect(registry.has('always')).toBe(true);
            });

            test('should have never predicate', () => {
                const registry = new PredicateRegistry();
                expect(registry.has('never')).toBe(true);
            });

            test('should list all built-in predicates', () => {
                const registry = new PredicateRegistry();
                const predicates = registry.list();

                expect(predicates).toContain('hasComponent');
                expect(predicates).toContain('notHasComponent');
                expect(predicates).toContain('hasTag');
                expect(predicates).toContain('hasAllTags');
                expect(predicates).toContain('hasAnyTag');
                expect(predicates).toContain('random');
                expect(predicates).toContain('always');
                expect(predicates).toContain('never');
            });
        });

        describe('Custom Predicate Registration', () => {
            test('should register custom predicate', () => {
                const registry = new PredicateRegistry();
                registry.register('customPredicate', () => true);

                expect(registry.has('customPredicate')).toBe(true);
            });

            test('should register predicate with arguments', () => {
                const registry = new PredicateRegistry();
                registry.register('inRange', (_entity, args: { range: number }) => args.range > 0);

                expect(registry.has('inRange')).toBe(true);
            });

            test('should chain predicate registrations', () => {
                const registry = new PredicateRegistry()
                    .register('pred1', () => true)
                    .register('pred2', () => false);

                expect(registry.has('pred1')).toBe(true);
                expect(registry.has('pred2')).toBe(true);
            });

            test('should get registered predicate function', () => {
                const registry = new PredicateRegistry();
                const fn = () => true;
                registry.register('myPred', fn);

                const retrieved = registry.get('myPred');
                expect(retrieved).toBeDefined();
            });
        });

        describe('Predicate Evaluation', () => {
            test('should evaluate always predicate as true', () => {
                const entity = engine.createEntity('TestEntity');
                const registry = new PredicateRegistry();
                const context = {
                    getSingleton: () => undefined,
                    getEntity: () => undefined,
                    deltaTime: 1 / 60,
                };

                const result = registry.evaluate('always', entity, {}, context);
                expect(result).toBe(true);
            });

            test('should evaluate never predicate as false', () => {
                const entity = engine.createEntity('TestEntity');
                const registry = new PredicateRegistry();
                const context = {
                    getSingleton: () => undefined,
                    getEntity: () => undefined,
                    deltaTime: 1 / 60,
                };

                const result = registry.evaluate('never', entity, {}, context);
                expect(result).toBe(false);
            });

            test('should evaluate hasComponent correctly', () => {
                const entity = engine.createEntity('TestEntity');
                entity.addComponent(Health, 100, 100);

                const registry = new PredicateRegistry();
                const context = {
                    getSingleton: () => undefined,
                    getEntity: () => undefined,
                    deltaTime: 1 / 60,
                };

                const hasHealth = registry.evaluate(
                    'hasComponent',
                    entity,
                    { component: Health },
                    context
                );
                expect(hasHealth).toBe(true);

                const hasTarget = registry.evaluate(
                    'hasComponent',
                    entity,
                    { component: Target },
                    context
                );
                expect(hasTarget).toBe(false);
            });

            test('should evaluate notHasComponent correctly', () => {
                const entity = engine.createEntity('TestEntity');
                entity.addComponent(Health, 100, 100);

                const registry = new PredicateRegistry();
                const context = {
                    getSingleton: () => undefined,
                    getEntity: () => undefined,
                    deltaTime: 1 / 60,
                };

                const notHasTarget = registry.evaluate(
                    'notHasComponent',
                    entity,
                    { component: Target },
                    context
                );
                expect(notHasTarget).toBe(true);

                const notHasHealth = registry.evaluate(
                    'notHasComponent',
                    entity,
                    { component: Health },
                    context
                );
                expect(notHasHealth).toBe(false);
            });

            test('should evaluate hasTag correctly', () => {
                const entity = engine.createEntity('TestEntity');
                entity.addTag('enemy');

                const registry = new PredicateRegistry();
                const context = {
                    getSingleton: () => undefined,
                    getEntity: () => undefined,
                    deltaTime: 1 / 60,
                };

                const hasEnemy = registry.evaluate('hasTag', entity, { tag: 'enemy' }, context);
                expect(hasEnemy).toBe(true);

                const hasPlayer = registry.evaluate('hasTag', entity, { tag: 'player' }, context);
                expect(hasPlayer).toBe(false);
            });

            test('should evaluate hasAllTags correctly', () => {
                const entity = engine.createEntity('TestEntity');
                entity.addTag('enemy').addTag('aggressive');

                const registry = new PredicateRegistry();
                const context = {
                    getSingleton: () => undefined,
                    getEntity: () => undefined,
                    deltaTime: 1 / 60,
                };

                const hasAll = registry.evaluate(
                    'hasAllTags',
                    entity,
                    { tags: ['enemy', 'aggressive'] },
                    context
                );
                expect(hasAll).toBe(true);

                const hasMissing = registry.evaluate(
                    'hasAllTags',
                    entity,
                    { tags: ['enemy', 'boss'] },
                    context
                );
                expect(hasMissing).toBe(false);
            });

            test('should evaluate hasAnyTag correctly', () => {
                const entity = engine.createEntity('TestEntity');
                entity.addTag('enemy');

                const registry = new PredicateRegistry();
                const context = {
                    getSingleton: () => undefined,
                    getEntity: () => undefined,
                    deltaTime: 1 / 60,
                };

                const hasAny = registry.evaluate(
                    'hasAnyTag',
                    entity,
                    { tags: ['player', 'enemy'] },
                    context
                );
                expect(hasAny).toBe(true);

                const hasNone = registry.evaluate(
                    'hasAnyTag',
                    entity,
                    { tags: ['player', 'npc'] },
                    context
                );
                expect(hasNone).toBe(false);
            });

            test('should evaluate random predicate with chance', () => {
                const entity = engine.createEntity('TestEntity');
                const registry = new PredicateRegistry();
                const context = {
                    getSingleton: () => undefined,
                    getEntity: () => undefined,
                    deltaTime: 1 / 60,
                };

                // chance: 1 should always return true
                const alwaysTrue = registry.evaluate('random', entity, { chance: 1 }, context);
                expect(alwaysTrue).toBe(true);

                // chance: 0 should always return false
                const alwaysFalse = registry.evaluate('random', entity, { chance: 0 }, context);
                expect(alwaysFalse).toBe(false);
            });

            test('should return false for unknown predicate', () => {
                const entity = engine.createEntity('TestEntity');
                const registry = new PredicateRegistry();
                const context = {
                    getSingleton: () => undefined,
                    getEntity: () => undefined,
                    deltaTime: 1 / 60,
                };

                // Should log warning and return false
                const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
                const result = registry.evaluate('unknownPredicate', entity, {}, context);

                expect(result).toBe(false);
                expect(consoleSpy).toHaveBeenCalledWith('Unknown predicate: unknownPredicate');
                consoleSpy.mockRestore();
            });

            test('should evaluate custom predicate with args', () => {
                const entity = engine.createEntity('TestEntity');
                entity.addComponent(Health, 50, 100);

                const registry = new PredicateRegistry();
                registry.register('health.below', (e, args: { threshold: number }) => {
                    const health = e.getComponent(Health);
                    return health !== undefined && health.current < args.threshold;
                });

                const context = {
                    getSingleton: () => undefined,
                    getEntity: () => undefined,
                    deltaTime: 1 / 60,
                };

                const below75 = registry.evaluate(
                    'health.below',
                    entity,
                    { threshold: 75 },
                    context
                );
                expect(below75).toBe(true);

                const below25 = registry.evaluate(
                    'health.below',
                    entity,
                    { threshold: 25 },
                    context
                );
                expect(below25).toBe(false);
            });
        });

        describe('Type-Safe Builder', () => {
            test('should create builder from registry', () => {
                const registry = new PredicateRegistry();
                const builder = registry.builder('TestTree');

                expect(builder).toBeInstanceOf(Object);
            });
        });
    });

    // =========================================================================
    // DecisionTreeBuilder (Standalone)
    // =========================================================================

    describe('DecisionTreeBuilder (Standalone)', () => {
        test('should create tree with decide factory', () => {
            const tree = decide('TestTree').selector().predicate('always').end().build();

            expect(tree.id).toBe('TestTree');
            expect(tree.root).toBeDefined();
        });

        test('should set name and description', () => {
            const tree = decide('TestTree')
                .name('Test Tree Name')
                .description('Test description')
                .selector()
                .predicate('always')
                .end()
                .build();

            expect(tree.name).toBe('Test Tree Name');
            expect(tree.description).toBe('Test description');
        });

        test('should build selector node', () => {
            const tree = decide('TestTree')
                .selector('MainSelector')
                .predicate('always')
                .end()
                .build();

            expect(tree.root.type).toBe('selector');
            expect((tree.root as { name?: string }).name).toBe('MainSelector');
        });

        test('should build sequence node', () => {
            const tree = decide('TestTree')
                .sequence('MainSequence')
                .predicate('always')
                .end()
                .build();

            expect(tree.root.type).toBe('sequence');
            expect((tree.root as { name?: string }).name).toBe('MainSequence');
        });

        test('should build nested composites', () => {
            const tree = decide('TestTree')
                .selector()
                .sequence('Inner')
                .predicate('always')
                .end()
                .end()
                .build();

            expect(tree.root.type).toBe('selector');
            const children = (tree.root as { children: unknown[] }).children;
            expect(children.length).toBe(1);
            expect((children[0] as { type: string }).type).toBe('sequence');
        });

        test('should build predicate node', () => {
            const tree = decide('TestTree')
                .selector()
                .predicate('hasTag', { tag: 'enemy' })
                .end()
                .build();

            const children = (tree.root as { children: unknown[] }).children;
            expect(children.length).toBe(1);
            expect((children[0] as { type: string }).type).toBe('predicate');
            expect((children[0] as { name: string }).name).toBe('hasTag');
        });

        test('should build negated predicate with not()', () => {
            const tree = decide('TestTree').selector().not('hasTag', { tag: 'dead' }).end().build();

            const children = (tree.root as { children: unknown[] }).children;
            expect((children[0] as { negate: boolean }).negate).toBe(true);
        });

        test('should build has() shorthand', () => {
            const tree = decide('TestTree').selector().has(Health).end().build();

            const children = (tree.root as { children: unknown[] }).children;
            expect((children[0] as { name: string }).name).toBe('hasComponent');
            expect((children[0] as { args: { component: unknown } }).args.component).toBe(Health);
        });

        test('should build hasNo() shorthand', () => {
            const tree = decide('TestTree').selector().hasNo(Target).end().build();

            const children = (tree.root as { children: unknown[] }).children;
            expect((children[0] as { name: string }).name).toBe('notHasComponent');
        });

        test('should build add component node', () => {
            const tree = decide('TestTree').selector().add(Attacking, 25).end().build();

            const children = (tree.root as { children: unknown[] }).children;
            expect((children[0] as { type: string }).type).toBe('add');
            expect((children[0] as { component: unknown }).component).toBe(Attacking);
            expect((children[0] as { args: unknown[] }).args).toEqual([25]);
        });

        test('should build add component node without args', () => {
            const tree = decide('TestTree').selector().add(Patrolling).end().build();

            const children = (tree.root as { children: unknown[] }).children;
            expect((children[0] as { type: string }).type).toBe('add');
            expect((children[0] as { args: unknown[] | undefined }).args).toBeUndefined();
        });

        test('should build remove component node', () => {
            const tree = decide('TestTree').selector().remove(Chasing).end().build();

            const children = (tree.root as { children: unknown[] }).children;
            expect((children[0] as { type: string }).type).toBe('remove');
            expect((children[0] as { component: unknown }).component).toBe(Chasing);
        });

        test('should throw when building without root', () => {
            const builder = new DecisionTreeBuilder('TestTree');
            expect(() => builder.build()).toThrow('Tree has no root');
        });

        test('should throw when building with unclosed composite', () => {
            expect(() => decide('TestTree').selector().predicate('always').build()).toThrow(
                'Unclosed composite'
            );
        });

        test('should throw when adding node without composite', () => {
            const builder = new DecisionTreeBuilder('TestTree');
            expect(() => builder.predicate('always')).toThrow('Add selector() or sequence() first');
        });

        test('should throw when ending without composite', () => {
            const builder = new DecisionTreeBuilder('TestTree');
            expect(() => builder.end()).toThrow('No composite to end');
        });
    });

    // =========================================================================
    // JSON Parsing
    // =========================================================================

    describe('JSON Parsing', () => {
        test('should parse simple selector tree', () => {
            const json: TreeDefinitionJSON = {
                id: 'TestTree',
                root: {
                    type: 'selector',
                    children: [{ type: 'predicate', name: 'always' }],
                },
            };

            const tree = parseTreeJSON(json, {});
            expect(tree.id).toBe('TestTree');
            expect(tree.root.type).toBe('selector');
        });

        test('should parse tree with name and description', () => {
            const json: TreeDefinitionJSON = {
                id: 'TestTree',
                name: 'Test Tree',
                description: 'A test tree',
                root: {
                    type: 'sequence',
                    children: [],
                },
            };

            const tree = parseTreeJSON(json, {});
            expect(tree.name).toBe('Test Tree');
            expect(tree.description).toBe('A test tree');
        });

        test('should parse nested composites', () => {
            const json: TreeDefinitionJSON = {
                id: 'TestTree',
                root: {
                    type: 'selector',
                    children: [
                        {
                            type: 'sequence',
                            name: 'Inner',
                            children: [{ type: 'predicate', name: 'always' }],
                        },
                    ],
                },
            };

            const tree = parseTreeJSON(json, {});
            const children = (tree.root as { children: unknown[] }).children;
            expect((children[0] as { type: string }).type).toBe('sequence');
        });

        test('should parse predicate with args', () => {
            const json: TreeDefinitionJSON = {
                id: 'TestTree',
                root: {
                    type: 'selector',
                    children: [{ type: 'predicate', name: 'hasTag', args: { tag: 'enemy' } }],
                },
            };

            const tree = parseTreeJSON(json, {});
            const children = (tree.root as { children: unknown[] }).children;
            expect((children[0] as { args: { tag: string } }).args).toEqual({ tag: 'enemy' });
        });

        test('should parse negated predicate', () => {
            const json: TreeDefinitionJSON = {
                id: 'TestTree',
                root: {
                    type: 'selector',
                    children: [{ type: 'predicate', name: 'hasTag', negate: true }],
                },
            };

            const tree = parseTreeJSON(json, {});
            const children = (tree.root as { children: unknown[] }).children;
            expect((children[0] as { negate: boolean }).negate).toBe(true);
        });

        test('should parse add component node', () => {
            const json: TreeDefinitionJSON = {
                id: 'TestTree',
                root: {
                    type: 'selector',
                    children: [{ type: 'add', component: 'Attacking', args: { damage: 25 } }],
                },
            };

            const componentMap = { Attacking };
            const tree = parseTreeJSON(json, componentMap);

            const children = (tree.root as { children: unknown[] }).children;
            expect((children[0] as { component: unknown }).component).toBe(Attacking);
        });

        test('should parse remove component node', () => {
            const json: TreeDefinitionJSON = {
                id: 'TestTree',
                root: {
                    type: 'selector',
                    children: [{ type: 'remove', component: 'Chasing' }],
                },
            };

            const componentMap = { Chasing };
            const tree = parseTreeJSON(json, componentMap);

            const children = (tree.root as { children: unknown[] }).children;
            expect((children[0] as { component: unknown }).component).toBe(Chasing);
        });

        test('should throw for unknown component in add', () => {
            const json: TreeDefinitionJSON = {
                id: 'TestTree',
                root: {
                    type: 'selector',
                    children: [{ type: 'add', component: 'Unknown' }],
                },
            };

            expect(() => parseTreeJSON(json, {})).toThrow('Unknown component: Unknown');
        });

        test('should throw for unknown component in remove', () => {
            const json: TreeDefinitionJSON = {
                id: 'TestTree',
                root: {
                    type: 'selector',
                    children: [{ type: 'remove', component: 'Unknown' }],
                },
            };

            expect(() => parseTreeJSON(json, {})).toThrow('Unknown component: Unknown');
        });

        test('should throw for unknown node type', () => {
            const json: TreeDefinitionJSON = {
                id: 'TestTree',
                root: {
                    // @ts-expect-error Testing invalid type
                    type: 'invalid',
                    children: [],
                },
            };

            expect(() => parseTreeJSON(json, {})).toThrow('Unknown node type: invalid');
        });
    });

    // =========================================================================
    // Decision Tree API
    // =========================================================================

    describe('DecisionTreeAPI', () => {
        describe('Tree Registration', () => {
            test('should register a tree', () => {
                const tree = decide('TestTree').selector().predicate('always').end().build();

                engine.decisions.register(tree);

                expect(engine.decisions.list()).toContain('TestTree');
            });

            test('should get registered tree', () => {
                const tree = decide('TestTree').selector().predicate('always').end().build();

                engine.decisions.register(tree);
                const retrieved = engine.decisions.get('TestTree');

                expect(retrieved).toBe(tree);
            });

            test('should return undefined for unregistered tree', () => {
                expect(engine.decisions.get('NonExistent')).toBeUndefined();
            });

            test('should unregister a tree', () => {
                const tree = decide('TestTree').selector().predicate('always').end().build();

                engine.decisions.register(tree);
                engine.decisions.unregister('TestTree');

                expect(engine.decisions.list()).not.toContain('TestTree');
            });

            test('should list all registered trees', () => {
                const tree1 = decide('Tree1').selector().predicate('always').end().build();
                const tree2 = decide('Tree2').sequence().predicate('always').end().build();

                engine.decisions.register(tree1);
                engine.decisions.register(tree2);

                const list = engine.decisions.list();
                expect(list).toContain('Tree1');
                expect(list).toContain('Tree2');
            });
        });

        describe('Entity Assignment', () => {
            test('should assign tree to entity', () => {
                const tree = decide('TestTree').selector().predicate('always').end().build();
                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                engine.decisions.assign(entity, 'TestTree');

                expect(engine.decisions.hasTree(entity)).toBe(true);
                expect(engine.decisions.getTreeId(entity)).toBe('TestTree');
            });

            test('should throw when assigning unknown tree', () => {
                const entity = engine.createEntity('TestEntity');

                expect(() => engine.decisions.assign(entity, 'NonExistent')).toThrow(
                    'Unknown tree "NonExistent"'
                );
            });

            test('should update existing tree assignment', () => {
                const tree1 = decide('Tree1').selector().predicate('always').end().build();
                const tree2 = decide('Tree2').sequence().predicate('never').end().build();

                engine.decisions.register(tree1);
                engine.decisions.register(tree2);

                const entity = engine.createEntity('TestEntity');
                engine.decisions.assign(entity, 'Tree1');
                engine.decisions.assign(entity, 'Tree2');

                expect(engine.decisions.getTreeId(entity)).toBe('Tree2');
            });

            test('should unassign tree from entity', () => {
                const tree = decide('TestTree').selector().predicate('always').end().build();
                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                engine.decisions.assign(entity, 'TestTree');
                engine.decisions.unassign(entity);

                expect(engine.decisions.hasTree(entity)).toBe(false);
            });

            test('should check if entity has tree', () => {
                const entity = engine.createEntity('TestEntity');

                expect(engine.decisions.hasTree(entity)).toBe(false);

                const tree = decide('TestTree').selector().predicate('always').end().build();
                engine.decisions.register(tree);
                engine.decisions.assign(entity, 'TestTree');

                expect(engine.decisions.hasTree(entity)).toBe(true);
            });

            test('should get tree ID from entity', () => {
                const entity = engine.createEntity('TestEntity');
                expect(engine.decisions.getTreeId(entity)).toBeUndefined();

                const tree = decide('TestTree').selector().predicate('always').end().build();
                engine.decisions.register(tree);
                engine.decisions.assign(entity, 'TestTree');

                expect(engine.decisions.getTreeId(entity)).toBe('TestTree');
            });
        });

        describe('Enable/Disable', () => {
            test('should enable tree for entity', () => {
                const tree = decide('TestTree').selector().predicate('always').end().build();
                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                engine.decisions.assign(entity, 'TestTree');
                engine.decisions.setEnabled(entity, false);

                const dt = entity.getComponent(DecisionTree);
                expect(dt!.enabled).toBe(false);

                engine.decisions.setEnabled(entity, true);
                expect(dt!.enabled).toBe(true);
            });

            test('should handle setEnabled on entity without tree', () => {
                const entity = engine.createEntity('TestEntity');
                // Should not throw
                expect(() => engine.decisions.setEnabled(entity, true)).not.toThrow();
            });
        });

        describe('Debug Functions', () => {
            test('should get last path from entity', () => {
                const entity = engine.createEntity('TestEntity');
                expect(engine.decisions.getLastPath(entity)).toEqual([]);

                const tree = decide('TestTree').selector().predicate('always').end().build();
                engine.decisions.register(tree);
                engine.decisions.assign(entity, 'TestTree');

                expect(engine.decisions.getLastPath(entity)).toEqual([]);
            });

            test('should manually evaluate tree', () => {
                const tree = decide('TestTree').selector().add(Patrolling).end().build();
                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                engine.decisions.assign(entity, 'TestTree');

                const result = engine.decisions.evaluate(entity);
                expect(result).toBe(true);
                expect(entity.hasComponent(Patrolling)).toBe(true);
            });

            test('should return false when evaluating entity without tree', () => {
                const entity = engine.createEntity('TestEntity');
                expect(engine.decisions.evaluate(entity)).toBe(false);
            });

            test('should return false when evaluating with unknown tree', () => {
                const entity = engine.createEntity('TestEntity');
                entity.addComponent(DecisionTree, 'NonExistent');

                expect(engine.decisions.evaluate(entity)).toBe(false);
            });
        });

        describe('Predicate Registry Access', () => {
            test('should provide access to predicate registry', () => {
                expect(engine.decisions.predicates).toBeDefined();
                expect(engine.decisions.predicates).toBeInstanceOf(PredicateRegistry);
            });

            test('should allow registering custom predicates', () => {
                engine.decisions.predicates.register('custom', () => true);
                expect(engine.decisions.predicates.has('custom')).toBe(true);
            });
        });
    });

    // =========================================================================
    // Tree Evaluation
    // =========================================================================

    describe('Tree Evaluation', () => {
        describe('Selector Node', () => {
            test('should succeed on first successful child', () => {
                const tree = decide('TestTree')
                    .selector()
                    .sequence()
                    .predicate('never')
                    .add(Attacking)
                    .end()
                    .sequence()
                    .predicate('always')
                    .add(Patrolling)
                    .end()
                    .end()
                    .build();

                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                engine.decisions.assign(entity, 'TestTree');
                engine.update(1 / 60);

                expect(entity.hasComponent(Patrolling)).toBe(true);
                expect(entity.hasComponent(Attacking)).toBe(false);
            });

            test('should fail if all children fail', () => {
                const tree = decide('TestTree')
                    .selector()
                    .sequence()
                    .predicate('never')
                    .add(Attacking)
                    .end()
                    .sequence()
                    .predicate('never')
                    .add(Patrolling)
                    .end()
                    .end()
                    .build();

                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                engine.decisions.assign(entity, 'TestTree');
                engine.update(1 / 60);

                expect(entity.hasComponent(Patrolling)).toBe(false);
                expect(entity.hasComponent(Attacking)).toBe(false);
            });
        });

        describe('Sequence Node', () => {
            test('should succeed only if all children succeed', () => {
                const tree = decide('TestTree')
                    .sequence()
                    .predicate('always')
                    .predicate('always')
                    .add(Patrolling)
                    .end()
                    .build();

                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                engine.decisions.assign(entity, 'TestTree');
                engine.update(1 / 60);

                expect(entity.hasComponent(Patrolling)).toBe(true);
            });

            test('should fail on first failing child', () => {
                const tree = decide('TestTree')
                    .sequence()
                    .predicate('always')
                    .predicate('never')
                    .add(Patrolling)
                    .end()
                    .build();

                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                engine.decisions.assign(entity, 'TestTree');
                engine.update(1 / 60);

                expect(entity.hasComponent(Patrolling)).toBe(false);
            });
        });

        describe('Predicate Node', () => {
            test('should evaluate predicate correctly', () => {
                engine.decisions.predicates.register('hasHealth', (e: EntityDef) =>
                    e.hasComponent(Health)
                );

                // Use sequence so predicate AND add both execute
                const tree = decide('TestTree')
                    .sequence()
                    .predicate('hasHealth')
                    .add(Idle)
                    .end()
                    .build();

                engine.decisions.register(tree);

                const entityWithHealth = engine.createEntity('WithHealth');
                entityWithHealth.addComponent(Health);
                engine.decisions.assign(entityWithHealth, 'TestTree');

                const entityWithoutHealth = engine.createEntity('WithoutHealth');
                engine.decisions.assign(entityWithoutHealth, 'TestTree');

                engine.update(1 / 60);

                expect(entityWithHealth.hasComponent(Idle)).toBe(true);
                expect(entityWithoutHealth.hasComponent(Idle)).toBe(false);
            });

            test('should handle negated predicate', () => {
                // Use sequence so not() AND add both execute
                const tree = decide('TestTree')
                    .sequence()
                    .not('hasTag', { tag: 'dead' })
                    .add(Idle)
                    .end()
                    .build();

                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                engine.decisions.assign(entity, 'TestTree');
                engine.update(1 / 60);

                expect(entity.hasComponent(Idle)).toBe(true);
            });
        });

        describe('Add Component Node', () => {
            test('should add component to entity', () => {
                const tree = decide('TestTree').selector().add(Attacking, 50).end().build();

                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                engine.decisions.assign(entity, 'TestTree');
                engine.update(1 / 60);

                const attacking = entity.getComponent(Attacking);
                expect(attacking).toBeDefined();
                expect(attacking!.damage).toBe(50);
            });

            test('should not add component if already present', () => {
                const tree = decide('TestTree').selector().add(Attacking, 100).end().build();

                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                entity.addComponent(Attacking, 25);
                engine.decisions.assign(entity, 'TestTree');
                engine.update(1 / 60);

                const attacking = entity.getComponent(Attacking);
                expect(attacking!.damage).toBe(25); // Original value preserved
            });
        });

        describe('Remove Component Node', () => {
            test('should remove component from entity', () => {
                const tree = decide('TestTree').selector().remove(Chasing).end().build();

                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                entity.addComponent(Chasing);
                engine.decisions.assign(entity, 'TestTree');
                engine.update(1 / 60);

                expect(entity.hasComponent(Chasing)).toBe(false);
            });

            test('should handle remove on entity without component', () => {
                // Use sequence so remove AND add both execute
                const tree = decide('TestTree').sequence().remove(Chasing).add(Idle).end().build();

                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                engine.decisions.assign(entity, 'TestTree');

                // Should not throw
                expect(() => engine.update(1 / 60)).not.toThrow();
                expect(entity.hasComponent(Idle)).toBe(true);
            });
        });

        describe('Disabled Trees', () => {
            test('should not evaluate disabled tree', () => {
                const tree = decide('TestTree').selector().add(Patrolling).end().build();

                engine.decisions.register(tree);

                const entity = engine.createEntity('TestEntity');
                engine.decisions.assign(entity, 'TestTree');
                engine.decisions.setEnabled(entity, false);
                engine.update(1 / 60);

                expect(entity.hasComponent(Patrolling)).toBe(false);
            });
        });

        describe('Unknown Tree Handling', () => {
            test('should skip entity with unknown tree', () => {
                const entity = engine.createEntity('TestEntity');
                entity.addComponent(DecisionTree, 'NonExistent');

                // Should not throw
                expect(() => engine.update(1 / 60)).not.toThrow();
            });
        });
    });

    // =========================================================================
    // Tracing
    // =========================================================================

    describe('Tracing', () => {
        test('should record path when tracing enabled', () => {
            const tracingPlugin = new DecisionTreePlugin({ enableTracing: true });
            const tracingEngine = new TestEngineBuilder().use(tracingPlugin).build() as TestEngine;

            const tree = decide('TestTree')
                .selector('MainSelector')
                .sequence('AttackSequence')
                .predicate('always')
                .add(Attacking, 10)
                .end()
                .end()
                .build();

            tracingEngine.decisions.register(tree);

            const entity = tracingEngine.createEntity('TestEntity');
            tracingEngine.decisions.assign(entity, 'TestTree');
            tracingEngine.update(1 / 60);

            const path = tracingEngine.decisions.getLastPath(entity);
            expect(path.length).toBeGreaterThan(0);

            tracingEngine.stop();
        });

        test('should not record path when tracing disabled', () => {
            // Default is tracing disabled
            const tree = decide('TestTree')
                .selector('MainSelector')
                .predicate('always')
                .add(Attacking, 10)
                .end()
                .build();

            engine.decisions.register(tree);

            const entity = engine.createEntity('TestEntity');
            engine.decisions.assign(entity, 'TestTree');
            engine.update(1 / 60);

            const path = engine.decisions.getLastPath(entity);
            expect(path).toEqual([]);
        });
    });

    // =========================================================================
    // Complex Tree Scenarios
    // =========================================================================

    describe('Complex Tree Scenarios', () => {
        test('should handle AI decision tree with multiple branches', () => {
            // Register custom predicates
            engine.decisions.predicates.register('hasTarget', (e: EntityDef) =>
                e.hasComponent(Target)
            );
            engine.decisions.predicates.register('isLowHealth', (e: EntityDef) => {
                const health = e.getComponent(Health);
                return health !== undefined && health.current < 30;
            });

            const aiTree = decide('EnemyAI')
                .selector()
                // Flee if low health
                .sequence('Flee')
                .predicate('isLowHealth')
                .remove(Attacking)
                .remove(Chasing)
                .add(Fleeing)
                .end()
                // Attack if has target
                .sequence('Attack')
                .predicate('hasTarget')
                .remove(Patrolling)
                .add(Attacking)
                .end()
                // Default: patrol
                .sequence('Patrol')
                .add(Patrolling)
                .end()
                .end()
                .build();

            engine.decisions.register(aiTree);

            // Entity with low health should flee
            const lowHealthEntity = engine.createEntity('LowHealth');
            lowHealthEntity.addComponent(Health, 20, 100);
            engine.decisions.assign(lowHealthEntity, 'EnemyAI');

            // Entity with target should attack
            const attackEntity = engine.createEntity('Attacker');
            attackEntity.addComponent(Health, 100, 100);
            attackEntity.addComponent(Target, Symbol('target'));
            engine.decisions.assign(attackEntity, 'EnemyAI');

            // Entity without target should patrol
            const patrolEntity = engine.createEntity('Patroller');
            patrolEntity.addComponent(Health, 100, 100);
            engine.decisions.assign(patrolEntity, 'EnemyAI');

            engine.update(1 / 60);

            expect(lowHealthEntity.hasComponent(Fleeing)).toBe(true);
            expect(attackEntity.hasComponent(Attacking)).toBe(true);
            expect(patrolEntity.hasComponent(Patrolling)).toBe(true);
        });

        test('should handle tree with mixed component mutations', () => {
            const tree = decide('TestTree')
                .sequence()
                .add(Health, 100, 100)
                .add(Patrolling)
                .remove(Idle)
                .end()
                .build();

            engine.decisions.register(tree);

            const entity = engine.createEntity('TestEntity');
            entity.addComponent(Idle);
            engine.decisions.assign(entity, 'TestTree');
            engine.update(1 / 60);

            expect(entity.hasComponent(Health)).toBe(true);
            expect(entity.hasComponent(Patrolling)).toBe(true);
            expect(entity.hasComponent(Idle)).toBe(false);
        });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================

    describe('Edge Cases', () => {
        test('should handle empty selector children', () => {
            const tree: TreeDefinition = {
                id: 'EmptySelector',
                root: { type: 'selector', children: [] },
            };

            engine.decisions.register(tree);

            const entity = engine.createEntity('TestEntity');
            engine.decisions.assign(entity, 'EmptySelector');

            expect(() => engine.update(1 / 60)).not.toThrow();
        });

        test('should handle empty sequence children', () => {
            const tree: TreeDefinition = {
                id: 'EmptySequence',
                root: { type: 'sequence', children: [] },
            };

            engine.decisions.register(tree);

            const entity = engine.createEntity('TestEntity');
            engine.decisions.assign(entity, 'EmptySequence');

            expect(() => engine.update(1 / 60)).not.toThrow();
        });

        test('should handle deeply nested tree', () => {
            const tree = decide('DeepTree')
                .selector()
                .selector()
                .selector()
                .sequence()
                .predicate('always')
                .add(Idle)
                .end()
                .end()
                .end()
                .end()
                .build();

            engine.decisions.register(tree);

            const entity = engine.createEntity('TestEntity');
            engine.decisions.assign(entity, 'DeepTree');
            engine.update(1 / 60);

            expect(entity.hasComponent(Idle)).toBe(true);
        });

        test('should handle multiple entities with same tree', () => {
            const tree = decide('SharedTree').selector().add(Patrolling).end().build();

            engine.decisions.register(tree);

            const entities = [];
            for (let i = 0; i < 10; i++) {
                const entity = engine.createEntity(`Entity${i}`);
                engine.decisions.assign(entity, 'SharedTree');
                entities.push(entity);
            }

            engine.update(1 / 60);

            for (const entity of entities) {
                expect(entity.hasComponent(Patrolling)).toBe(true);
            }
        });

        test('should handle rapid tree reassignment', () => {
            const tree1 = decide('Tree1').selector().add(Idle).end().build();
            const tree2 = decide('Tree2').selector().add(Patrolling).end().build();

            engine.decisions.register(tree1);
            engine.decisions.register(tree2);

            const entity = engine.createEntity('TestEntity');

            engine.decisions.assign(entity, 'Tree1');
            engine.decisions.assign(entity, 'Tree2');
            engine.decisions.assign(entity, 'Tree1');

            engine.update(1 / 60);

            expect(entity.hasComponent(Idle)).toBe(true);
        });
    });
});
