/**
 * Decision Tree Components
 *
 * The plugin only requires ONE component - DecisionTree.
 * All "intent" components (Chasing, Attacking, etc.) are user-defined.
 */

// =============================================================================
// Core Component
// =============================================================================

/**
 * Links an entity to a decision tree definition.
 *
 * This is the ONLY component required by the plugin.
 * Add this to any entity that should have AI decision-making.
 *
 * @example
 * ```typescript
 * const guard = engine.createEntity('Guard');
 * guard.addComponent(DecisionTree, 'GuardAI');
 * // or use: engine.decisions.assign(guard, 'GuardAI');
 * ```
 */
export class DecisionTree {
  constructor(
    /** ID of the registered tree definition */
    public treeId: string,
    /** Whether this tree is enabled */
    public enabled: boolean = true,
    /** Debug: path taken in last evaluation */
    public lastPath: string[] = [],
    /** Debug: result of last evaluation */
    public lastResult: boolean = true
  ) {}
}

// =============================================================================
// Example Intent Components
// =============================================================================

// These are NOT part of the plugin - they're examples of user-defined intents.
// Users should define their own intent components based on their game's needs.

/*
// Simple intents (tag-like, no data)
export class Patrolling {}
export class Idle {}
export class Stunned {}
export class Searching {}

// Intents with target data
export class Chasing {
  constructor(public targetId: symbol) {}
}

export class Attacking {
  constructor(
    public targetId: symbol,
    public damage: number = 10
  ) {}
}

export class Fleeing {
  constructor(public fromId?: symbol) {}
}

// Intents with position data
export class MovingTo {
  constructor(public x: number, public y: number) {}
}

export class Returning {
  constructor(public homeX: number, public homeY: number) {}
}

// Complex intents
export class Following {
  constructor(
    public targetId: symbol,
    public distance: number = 5,
    public matchSpeed: boolean = true
  ) {}
}

export class Guarding {
  constructor(
    public areaX: number,
    public areaY: number,
    public radius: number = 50
  ) {}
}
*/
