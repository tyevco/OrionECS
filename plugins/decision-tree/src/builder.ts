/**
 * Decision Tree Builder Helpers
 *
 * Provides convenient factory functions for building decision trees.
 */

import type { ComponentIdentifier } from '@orion-ecs/plugin-api';
import type { TreeDefinition, DecisionNodeJSON, TreeDefinitionJSON } from './types';

// =============================================================================
// Standalone Builder (No Registry)
// =============================================================================

/**
 * Simple decision tree builder for use without a registry.
 *
 * For type-safe predicate validation, use `PredicateRegistry.builder()` instead.
 *
 * @example
 * ```typescript
 * const tree = decide('GuardAI')
 *   .selector()
 *     .sequence('Attack')
 *       .predicate('hasTarget')
 *       .predicate('target.inRange', { range: 50 })
 *       .add(Attacking)
 *     .end()
 *     .sequence('Patrol')
 *       .add(Patrolling)
 *     .end()
 *   .end()
 *   .build();
 * ```
 */
export class DecisionTreeBuilder {
  private root: SelectorNode | SequenceNode | null = null;
  private current: BuilderContext | null = null;
  private treeName?: string;
  private treeDescription?: string;

  constructor(private treeId: string) {}

  /** Set tree name */
  name(name: string): this {
    this.treeName = name;
    return this;
  }

  /** Set tree description */
  description(desc: string): this {
    this.treeDescription = desc;
    return this;
  }

  // ---------------------------------------------------------------------------
  // Composite Nodes
  // ---------------------------------------------------------------------------

  /** Start a selector (try children until one succeeds) */
  selector(name?: string): this {
    return this.pushComposite({ type: 'selector', name, children: [] });
  }

  /** Start a sequence (run children until one fails) */
  sequence(name?: string): this {
    return this.pushComposite({ type: 'sequence', name, children: [] });
  }

  /** End current composite */
  end(): this {
    if (!this.current) throw new Error('No composite to end');
    this.current = this.current.parent;
    return this;
  }

  // ---------------------------------------------------------------------------
  // Predicate Nodes
  // ---------------------------------------------------------------------------

  /** Add a predicate */
  predicate(name: string, args?: Record<string, unknown>): this {
    return this.addNode({ type: 'predicate', name, args });
  }

  /** Add a negated predicate */
  not(name: string, args?: Record<string, unknown>): this {
    return this.addNode({ type: 'predicate', name, args, negate: true });
  }

  /** Shorthand: Check if entity has a component */
  has<T>(component: ComponentIdentifier<T>): this {
    return this.addNode({
      type: 'predicate',
      name: 'hasComponent',
      args: { component },
    });
  }

  /** Shorthand: Check if entity does NOT have a component */
  hasNo<T>(component: ComponentIdentifier<T>): this {
    return this.addNode({
      type: 'predicate',
      name: 'notHasComponent',
      args: { component },
    });
  }

  // ---------------------------------------------------------------------------
  // Component Mutations
  // ---------------------------------------------------------------------------

  /** Add a component */
  add<T extends ComponentIdentifier<unknown>>(component: T, ...args: unknown[]): this {
    return this.addNode({
      type: 'add',
      component,
      args: args.length > 0 ? args : undefined,
    });
  }

  /** Remove a component */
  remove<T>(component: ComponentIdentifier<T>): this {
    return this.addNode({ type: 'remove', component });
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  /** Build the tree definition */
  build(): TreeDefinition {
    if (!this.root) {
      throw new Error('Tree has no root. Start with selector() or sequence().');
    }
    if (this.current) {
      throw new Error('Unclosed composite. Call end() for each selector/sequence.');
    }
    return {
      id: this.treeId,
      name: this.treeName,
      description: this.treeDescription,
      root: this.root,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private pushComposite(node: SelectorNode | SequenceNode): this {
    if (!this.current) {
      this.root = node;
    } else {
      this.current.node.children.push(node);
    }
    this.current = { node, parent: this.current };
    return this;
  }

  private addNode(node: DecisionNode): this {
    if (!this.current) {
      throw new Error('Add selector() or sequence() first');
    }
    this.current.node.children.push(node);
    return this;
  }
}

// Internal types for builder
interface BuilderContext {
  node: SelectorNode | SequenceNode;
  parent: BuilderContext | null;
}

interface SelectorNode {
  type: 'selector';
  name?: string;
  children: DecisionNode[];
}

interface SequenceNode {
  type: 'sequence';
  name?: string;
  children: DecisionNode[];
}

type DecisionNode =
  | SelectorNode
  | SequenceNode
  | { type: 'predicate'; name: string; args?: Record<string, unknown>; negate?: boolean }
  | { type: 'add'; component: ComponentIdentifier<unknown>; args?: unknown[] }
  | { type: 'remove'; component: ComponentIdentifier<unknown> };

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new decision tree builder.
 *
 * @example
 * ```typescript
 * const tree = decide('MyAI')
 *   .selector()
 *     .predicate('condition')
 *     .add(SomeComponent)
 *   .end()
 *   .build();
 * ```
 */
export function decide(id: string): DecisionTreeBuilder {
  return new DecisionTreeBuilder(id);
}

// =============================================================================
// JSON Parser
// =============================================================================

/**
 * Parse a JSON tree definition into a TreeDefinition.
 *
 * Components must be resolved from a component map.
 *
 * @example
 * ```typescript
 * const json = {
 *   id: 'GuardAI',
 *   root: {
 *     type: 'selector',
 *     children: [
 *       { type: 'predicate', name: 'hasTarget' },
 *       { type: 'add', component: 'Attacking' }
 *     ]
 *   }
 * };
 *
 * const tree = parseTreeJSON(json, {
 *   'Attacking': Attacking,
 *   'Patrolling': Patrolling
 * });
 * ```
 */
export function parseTreeJSON(
  json: TreeDefinitionJSON,
  componentMap: Record<string, ComponentIdentifier<unknown>>
): TreeDefinition {
  function parseNode(node: DecisionNodeJSON): DecisionNode {
    switch (node.type) {
      case 'selector':
      case 'sequence':
        return {
          type: node.type,
          name: node.name,
          children: node.children?.map(parseNode) ?? [],
        };

      case 'predicate':
        return {
          type: 'predicate',
          name: node.name!,
          args: node.args,
          negate: node.negate,
        };

      case 'add': {
        const component = componentMap[node.component!];
        if (!component) {
          throw new Error(`Unknown component: ${node.component}`);
        }
        return {
          type: 'add',
          component,
          args: node.args as unknown as unknown[],
        };
      }

      case 'remove': {
        const component = componentMap[node.component!];
        if (!component) {
          throw new Error(`Unknown component: ${node.component}`);
        }
        return { type: 'remove', component };
      }

      default:
        throw new Error(`Unknown node type: ${(node as unknown).type}`);
    }
  }

  return {
    id: json.id,
    name: json.name,
    description: json.description,
    root: parseNode(json.root),
  };
}
