/**
 * Decision Tree Types and Registry
 *
 * Uses the same pattern as EngineBuilder.use() to accumulate predicate
 * definitions at compile time. Each .register() call returns a new registry
 * type with the added predicate, providing full type safety.
 */

import type { ComponentIdentifier, EntityDef } from '@orion-ecs/plugin-api';

// =============================================================================
// Utility Types
// =============================================================================

/** Extract constructor parameter types from a component class */
export type ConstructorArgs<T> = T extends new (...args: infer A) => unknown ? A : never;

/** Check if args object has required keys */
type RequiresArgs<T> = keyof T extends never ? false : true;

// =============================================================================
// Predicate Types
// =============================================================================

/** Context available to predicates */
export interface PredicateContext {
  /** Get a singleton component */
  getSingleton: <T>(type: ComponentIdentifier<T>) => T | undefined;
  /** Get an entity by ID */
  getEntity: (id: symbol) => EntityDef | undefined;
  /** Current frame delta time */
  deltaTime: number;
}

/** A predicate function with typed arguments */
export type PredicateFn<TArgs extends Record<string, unknown> = Record<string, unknown>> = (
  entity: EntityDef,
  args: TArgs,
  context: PredicateContext
) => boolean;

/** Built-in predicates always available */
export interface BuiltInPredicates {
  hasComponent: { component: ComponentIdentifier<unknown> };
  notHasComponent: { component: ComponentIdentifier<unknown> };
  hasTag: { tag: string };
  hasAllTags: { tags: string[] };
  hasAnyTag: { tags: string[] };
  random: { chance?: number };
  always: Record<string, never>;
  never: Record<string, never>;
  [key: string]: Record<string, unknown>;
}

// =============================================================================
// Tree Definition Types
// =============================================================================

export interface TreeDefinition {
  id: string;
  name?: string;
  description?: string;
  root: DecisionNode;
}

export type DecisionNode =
  | SelectorNode
  | SequenceNode
  | PredicateNode
  | AddComponentNode
  | RemoveComponentNode;

export interface SelectorNode {
  type: 'selector';
  name?: string;
  children: DecisionNode[];
}

export interface SequenceNode {
  type: 'sequence';
  name?: string;
  children: DecisionNode[];
}

export interface PredicateNode {
  type: 'predicate';
  name: string;
  args?: Record<string, unknown>;
  negate?: boolean;
}

export interface AddComponentNode {
  type: 'add';
  component: ComponentIdentifier<unknown>;
  args?: unknown[];
}

export interface RemoveComponentNode {
  type: 'remove';
  component: ComponentIdentifier<unknown>;
}

// =============================================================================
// Plugin Options
// =============================================================================

export interface DecisionTreePluginOptions {
  /** Priority of DecisionTreeSystem (default: 100, runs early) */
  systemPriority?: number;
  /** Use fixed update instead of variable update */
  useFixedUpdate?: boolean;
  /** Enable debug tracing of decision paths */
  enableTracing?: boolean;
}

// =============================================================================
// JSON Types (for serialization)
// =============================================================================

export interface TreeDefinitionJSON {
  id: string;
  name?: string;
  description?: string;
  root: DecisionNodeJSON;
}

export interface DecisionNodeJSON {
  type: 'selector' | 'sequence' | 'predicate' | 'add' | 'remove';
  name?: string;
  children?: DecisionNodeJSON[];
  args?: Record<string, unknown>;
  negate?: boolean;
  component?: string;
}

// =============================================================================
// Predicate Registry (Type Accumulation)
// =============================================================================

/**
 * Type-safe predicate registry that accumulates types as predicates are registered.
 *
 * Uses the same pattern as EngineBuilder.use():
 * - Each .register() returns a new type with the predicate added
 * - The builder created from the registry knows all registered predicates
 *
 * @example
 * ```typescript
 * const predicates = new PredicateRegistry()
 *   .register('target.inRange', (e, args: { range: number }) => ...)
 *   .register('health.below', (e, args: { threshold: number }) => ...);
 *
 * // Builder validates predicates at compile time
 * predicates.builder('AI')
 *   .predicate('target.inRange', { range: 50 })  // ✅ Type checked
 *   .predicate('target.inRange', { ragne: 50 }) // ❌ Compile error
 * ```
 */
export class PredicateRegistry<
  TPredicates extends Record<string, Record<string, unknown>> = BuiltInPredicates
> {
  private predicates = new Map<string, PredicateFn<any>>();

  constructor() {
    this.registerBuiltIns();
  }

  private registerBuiltIns(): void {
    this.predicates.set('hasComponent', (entity, args: BuiltInPredicates['hasComponent']) =>
      entity.hasComponent(args.component)
    );
    this.predicates.set('notHasComponent', (entity, args: BuiltInPredicates['notHasComponent']) =>
      !entity.hasComponent(args.component)
    );
    this.predicates.set('hasTag', (entity, args: BuiltInPredicates['hasTag']) =>
      entity.hasTag(args.tag)
    );
    this.predicates.set('hasAllTags', (entity, args: BuiltInPredicates['hasAllTags']) =>
      args.tags.every((tag) => entity.hasTag(tag))
    );
    this.predicates.set('hasAnyTag', (entity, args: BuiltInPredicates['hasAnyTag']) =>
      args.tags.some((tag) => entity.hasTag(tag))
    );
    this.predicates.set('random', (_entity, args: BuiltInPredicates['random']) =>
      Math.random() < (args.chance ?? 0.5)
    );
    this.predicates.set('always', () => true);
    this.predicates.set('never', () => false);
  }

  /**
   * Register a predicate with type-safe arguments.
   * Returns a new registry type that includes this predicate.
   */
  register<K extends string, TArgs extends Record<string, unknown>>(
    name: K,
    fn: PredicateFn<TArgs>
  ): PredicateRegistry<TPredicates & { [P in K]: TArgs }> {
    this.predicates.set(name, fn as PredicateFn<any>);
    return this as unknown as PredicateRegistry<TPredicates & { [P in K]: TArgs }>;
  }

  /** Get a predicate function by name */
  get<K extends keyof TPredicates>(name: K): PredicateFn<TPredicates[K]> | undefined {
    return this.predicates.get(name as string);
  }

  /** Check if a predicate is registered */
  has(name: string): boolean {
    return this.predicates.has(name);
  }

  /** Get all registered predicate names */
  list(): string[] {
    return Array.from(this.predicates.keys());
  }

  /** Create a type-safe decision tree builder */
  builder(id: string): DecisionTreeBuilder<TPredicates> {
    return new DecisionTreeBuilder<TPredicates>(id, this);
  }

  /** Evaluate a predicate by name (runtime) */
  evaluate(name: string, entity: EntityDef, args: Record<string, unknown>, context: PredicateContext): boolean {
    const fn = this.predicates.get(name);
    if (!fn) {
      console.warn(`Unknown predicate: ${name}`);
      return false;
    }
    return fn(entity, args, context);
  }
}

// =============================================================================
// Decision Tree Builder
// =============================================================================

interface BuilderContext {
  node: SelectorNode | SequenceNode;
  parent: BuilderContext | null;
}

/**
 * Type-safe decision tree builder.
 *
 * Validates:
 * - Predicate names against registered predicates
 * - Predicate arguments against their definitions
 * - Component constructor arguments
 */
export class DecisionTreeBuilder<
  TPredicates extends Record<string, Record<string, unknown>>
> {
  private root: DecisionNode | null = null;
  private current: BuilderContext | null = null;
  private treeName?: string;
  private treeDescription?: string;

  constructor(
    private treeId: string,
    private registry: PredicateRegistry<TPredicates>
  ) {}

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
  // Predicate Nodes (Type-Safe)
  // ---------------------------------------------------------------------------

  /**
   * Add a predicate with type-safe name and arguments.
   *
   * @example
   * .predicate('target.inRange', { range: 50 })  // ✅ Validated
   * .predicate('target.inRange', { ragne: 50 }) // ❌ Compile error
   * .predicate('unknownPredicate')               // ❌ Compile error
   */
  predicate<K extends keyof TPredicates & string>(
    name: K,
    ...rest: RequiresArgs<TPredicates[K]> extends true
      ? [args: TPredicates[K]]
      : [args?: TPredicates[K]]
  ): this {
    const [args] = rest;
    return this.addNode({
      type: 'predicate',
      name,
      args: args as Record<string, unknown>,
    });
  }

  /** Add a negated predicate */
  not<K extends keyof TPredicates & string>(
    name: K,
    ...rest: RequiresArgs<TPredicates[K]> extends true
      ? [args: TPredicates[K]]
      : [args?: TPredicates[K]]
  ): this {
    const [args] = rest;
    return this.addNode({
      type: 'predicate',
      name,
      args: args as Record<string, unknown>,
      negate: true,
    });
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
  // Component Mutations (Type-Safe)
  // ---------------------------------------------------------------------------

  /**
   * Add a component with type-safe constructor arguments.
   *
   * @example
   * class Chasing { constructor(public targetId: symbol) {} }
   * .add(Chasing, mySymbol)    // ✅ Correct
   * .add(Chasing, "string")    // ❌ Compile error
   */
  add<T extends ComponentIdentifier<unknown>>(
    component: T,
    ...args: ConstructorArgs<T>
  ): this {
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

  /** Get the registry (for plugin integration) */
  getRegistry(): PredicateRegistry<TPredicates> {
    return this.registry;
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
