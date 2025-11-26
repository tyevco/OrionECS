/**
 * Decision Tree Plugin
 *
 * Provides ECS-native decision trees that evaluate predicates and mutate
 * entity components. Behaviors are implemented by separate ECS systems.
 */

import type {
  EnginePlugin,
  PluginContext,
  EntityDef,
  ComponentIdentifier,
} from '@orion-ecs/plugin-api';

import {
  type TreeDefinition,
  type DecisionNode,
  type DecisionTreePluginOptions,
  type PredicateContext,
  
  PredicateRegistry,
} from './types';

import { DecisionTree } from './components';

// =============================================================================
// Plugin API
// =============================================================================

export interface DecisionTreeAPI {
  /** Register a tree definition */
  register(tree: TreeDefinition): void;

  /** Unregister a tree */
  unregister(treeId: string): void;

  /** Get a registered tree */
  get(treeId: string): TreeDefinition | undefined;

  /** List all registered tree IDs */
  list(): string[];

  /** Assign a tree to an entity */
  assign(entity: EntityDef, treeId: string): void;

  /** Remove tree from an entity */
  unassign(entity: EntityDef): void;

  /** Enable/disable tree for an entity */
  setEnabled(entity: EntityDef, enabled: boolean): void;

  /** Check if entity has a tree */
  hasTree(entity: EntityDef): boolean;

  /** Get tree ID for an entity */
  getTreeId(entity: EntityDef): string | undefined;

  /** Get last decision path (debug) */
  getLastPath(entity: EntityDef): string[];

  /** Manually evaluate (debug) */
  evaluate(entity: EntityDef): boolean;

  /** Get the predicate registry for registering predicates */
  readonly predicates: PredicateRegistry<unknown>;
}

// =============================================================================
// Plugin Implementation
// =============================================================================

export class DecisionTreePlugin
  implements EnginePlugin<{ decisions: DecisionTreeAPI }>
{
  name = 'DecisionTreePlugin';
  version = '1.0.0';

  declare readonly __extensions: { decisions: DecisionTreeAPI };

  private trees = new Map<string, TreeDefinition>();
  private predicateRegistry = new PredicateRegistry();
  private context: PluginContext | null = null;
  private predicateContext: PredicateContext | null = null;
  private options: DecisionTreePluginOptions;

  constructor(options: DecisionTreePluginOptions = {}) {
    this.options = options;
  }

  install(context: PluginContext): void {
    this.context = context;

    context.registerComponent(DecisionTree);
    this.createDecisionSystem(context);
    context.extend('decisions', this.createAPI());
  }

  uninstall(): void {
    this.trees.clear();
    this.context = null;
    this.predicateContext = null;
  }

  // ===========================================================================
  // System
  // ===========================================================================

  private createDecisionSystem(context: PluginContext): void {
    const plugin = this;

    context.createSystem(
      'DecisionTreeSystem',
      { all: [DecisionTree] },
      {
        priority: this.options.systemPriority ?? 100,

        act: (entity: EntityDef, dt: DecisionTree) => {
          if (!dt.enabled) return;

          const tree = plugin.trees.get(dt.treeId);
          if (!tree) {
            if (plugin.options.enableTracing) {
              console.warn(`DecisionTree: Unknown tree "${dt.treeId}"`);
            }
            return;
          }

          dt.lastPath = [];
          dt.lastResult = plugin.evaluateNode(entity, tree.root, dt.lastPath);
        },
      },
      this.options.useFixedUpdate ?? false
    );
  }

  // ===========================================================================
  // Tree Evaluation
  // ===========================================================================

  private evaluateNode(entity: EntityDef, node: DecisionNode, path: string[]): boolean {
    switch (node.type) {
      case 'selector':
        if (node.name && this.options.enableTracing) path.push(`sel:${node.name}`);
        for (const child of node.children) {
          if (this.evaluateNode(entity, child, path)) return true;
        }
        return false;

      case 'sequence':
        if (node.name && this.options.enableTracing) path.push(`seq:${node.name}`);
        for (const child of node.children) {
          if (!this.evaluateNode(entity, child, path)) return false;
        }
        return true;

      case 'predicate': {
        const result = this.predicateRegistry.evaluate(
          node.name,
          entity,
          node.args ?? {},
          this.getPredicateContext()
        );
        const finalResult = node.negate ? !result : result;
        if (this.options.enableTracing) {
          path.push(`${node.name}=${finalResult}`);
        }
        return finalResult;
      }

      case 'add': {
        const args = node.args ?? [];
        if (!entity.hasComponent(node.component)) {
          entity.addComponent(node.component, ...args);
        }
        if (this.options.enableTracing) {
          path.push(`+${this.getComponentName(node.component)}`);
        }
        return true;
      }

      case 'remove': {
        if (entity.hasComponent(node.component)) {
          entity.removeComponent(node.component);
        }
        if (this.options.enableTracing) {
          path.push(`-${this.getComponentName(node.component)}`);
        }
        return true;
      }

      default:
        return false;
    }
  }

  private getComponentName(component: ComponentIdentifier<unknown>): string {
    return typeof component === 'function' ? component.name || 'Component' : String(component);
  }

  private getPredicateContext(): PredicateContext {
    if (!this.predicateContext) {
      const engine = this.context?.getEngine() as unknown;
      this.predicateContext = {
        getSingleton: (type) => engine?.getSingleton?.(type),
        getEntity: (id) => engine?.getEntity?.(id),
        deltaTime: 1 / 60,
      };
    }
    return this.predicateContext;
  }

  // ===========================================================================
  // API
  // ===========================================================================

  private createAPI(): DecisionTreeAPI {
    const plugin = this;

    return {
      register(tree: TreeDefinition): void {
        plugin.trees.set(tree.id, tree);
      },

      unregister(treeId: string): void {
        plugin.trees.delete(treeId);
      },

      get(treeId: string): TreeDefinition | undefined {
        return plugin.trees.get(treeId);
      },

      list(): string[] {
        return Array.from(plugin.trees.keys());
      },

      assign(entity: EntityDef, treeId: string): void {
        if (!plugin.trees.has(treeId)) {
          throw new Error(`DecisionTree: Unknown tree "${treeId}"`);
        }
        if (entity.hasComponent(DecisionTree)) {
          const dt = entity.getComponent(DecisionTree)!;
          dt.treeId = treeId;
          dt.enabled = true;
          dt.lastPath = [];
        } else {
          entity.addComponent(DecisionTree, treeId);
        }
      },

      unassign(entity: EntityDef): void {
        entity.removeComponent(DecisionTree);
      },

      setEnabled(entity: EntityDef, enabled: boolean): void {
        const dt = entity.getComponent(DecisionTree);
        if (dt) dt.enabled = enabled;
      },

      hasTree(entity: EntityDef): boolean {
        return entity.hasComponent(DecisionTree);
      },

      getTreeId(entity: EntityDef): string | undefined {
        return entity.getComponent(DecisionTree)?.treeId;
      },

      getLastPath(entity: EntityDef): string[] {
        return entity.getComponent(DecisionTree)?.lastPath ?? [];
      },

      evaluate(entity: EntityDef): boolean {
        const dt = entity.getComponent(DecisionTree);
        if (!dt) return false;
        const tree = plugin.trees.get(dt.treeId);
        if (!tree) return false;
        dt.lastPath = [];
        dt.lastResult = plugin.evaluateNode(entity, tree.root, dt.lastPath);
        return dt.lastResult;
      },

      get predicates() {
        return plugin.predicateRegistry;
      },
    };
  }
}
