/**
 * Utility functions for OrionECS
 */

import type { ComponentIdentifier } from './definitions';

/**
 * Create a tag component class for entity categorization
 * Tag components are marker components with no data, used for filtering entities in queries
 *
 * @param name - The name of the tag component
 * @returns A component class that can be used with entity.addComponent()
 *
 * @example
 * ```typescript
 * const PlayerTag = createTagComponent('Player');
 * const EnemyTag = createTagComponent('Enemy');
 *
 * const entity = engine.createEntity();
 * entity.addComponent(PlayerTag);
 * entity.addComponent(EnemyTag);
 *
 * // Use in queries
 * engine.createSystem('PlayerSystem',
 *   { all: [PlayerTag] },
 *   { act: (entity) => { // Only processes entities with PlayerTag } }
 * );
 * ```
 */
export function createTagComponent(name: string): ComponentIdentifier<any> {
    // Create a unique class for this tag
    // Using class expression with a computed name
    const TagClass = {
        [name]: class {
            static readonly __tagName = name;
            constructor() {}
        }
    }[name];

    // Set the class name for debugging and type checking
    Object.defineProperty(TagClass, 'name', {
        value: name,
        writable: false,
        configurable: true
    });

    return TagClass as ComponentIdentifier<any>;
}
