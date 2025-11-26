---
"@orion-ecs/core": minor
---

Add comprehensive Entity Hierarchy Query Methods and Observer Events

## Hierarchy Query Methods (Phase 1)

New methods on Entity class for traversing and querying the hierarchy:

- `getDescendants(maxDepth?)` - Get all descendants with optional depth limit
- `getAncestors()` - Get all ancestors ordered from nearest to furthest
- `findChild(predicate, recursive?)` - Find first child matching predicate
- `findChildren(predicate, recursive?)` - Find all children matching predicate
- `getRoot()` - Get the root entity of the hierarchy
- `getDepth()` - Get depth level (0 = root)
- `isAncestorOf(entity)` - Check if this entity is an ancestor of another
- `isDescendantOf(entity)` - Check if this entity is a descendant of another
- `getSiblings(includeSelf?)` - Get all sibling entities
- `getChildCount()` - Get number of direct children
- `hasChildren()` - Check if entity has any children
- `hasParent()` - Check if entity has a parent

## Hierarchy Observer Events (Phase 2)

Enhanced hierarchy event system with granular events:

- `onChildAdded` - Emitted when a child is added to a parent
- `onChildRemoved` - Emitted when a child is removed from a parent
- `onParentChanged` - Emitted when an entity's parent changes (with previous/new parent info)

System integration via `SystemOptions`:
- `watchHierarchy` - Enable hierarchy event callbacks for systems
- `onChildAdded`, `onChildRemoved`, `onParentChanged` callbacks

Backward compatible with existing `onEntityHierarchyChanged` event.

## Related Issue

Implements GitHub Issue #66: Entity Relationships - Parent-Child Propagation & Observers
