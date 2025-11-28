// Tests for ECS Definition and Reference providers
// Since these providers depend heavily on vscode APIs, these tests verify
// the core logic of context detection and pattern matching

// Helper functions moved to module scope to avoid recreating on every call
const isComponentContext = (lineText: string): boolean => {
    // Component in query definition
    if (lineText.includes('all:') || lineText.includes('any:') || lineText.includes('none:')) {
        return true;
    }

    // Component in addComponent/getComponent/hasComponent/removeComponent
    if (
        lineText.includes('addComponent') ||
        lineText.includes('getComponent') ||
        lineText.includes('hasComponent') ||
        lineText.includes('removeComponent')
    ) {
        return true;
    }

    // Component in prefab type definition
    if (lineText.includes('type:')) {
        return true;
    }

    // Component in singleton methods
    if (
        lineText.includes('setSingleton') ||
        lineText.includes('getSingleton') ||
        lineText.includes('hasSingleton')
    ) {
        return true;
    }

    return false;
};

const isSystemContext = (lineText: string): boolean => {
    return (
        lineText.includes('getSystem') ||
        lineText.includes('enableSystem') ||
        lineText.includes('disableSystem') ||
        lineText.includes('removeSystem')
    );
};

const isPrefabContext = (lineText: string): boolean => {
    return lineText.includes('createFromPrefab') || lineText.includes('registerPrefab');
};

const escapeRegExp = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const determineReferenceContext = (line: string, column: number, name: string): string => {
    const beforeMatch = line.substring(0, column);

    // Check for class definition
    const classRegex = new RegExp(`class\\s+${escapeRegExp(name)}\\b`);
    if (classRegex.test(line)) {
        return 'definition';
    }

    // Check for import
    if (line.includes('import ') || line.includes('from ')) {
        return 'import';
    }

    // Check for system query usage
    if (line.includes('all:') || line.includes('any:') || line.includes('none:')) {
        return 'system-query';
    }

    // Check for entity methods
    if (beforeMatch.includes('addComponent')) {
        return 'entity-add';
    }
    if (beforeMatch.includes('getComponent')) {
        return 'entity-get';
    }
    if (beforeMatch.includes('hasComponent')) {
        return 'entity-has';
    }
    if (beforeMatch.includes('removeComponent')) {
        return 'entity-remove';
    }

    // Check for singleton usage
    if (beforeMatch.includes('setSingleton') || beforeMatch.includes('getSingleton')) {
        return 'singleton';
    }

    // Check for prefab type
    if (beforeMatch.includes('type:')) {
        return 'prefab-type';
    }

    return 'other';
};

const findComponentInLine = (line: string, componentName: string): number[] => {
    const positions: number[] = [];
    const regex = new RegExp(`\\b${componentName}\\b`, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
        positions.push(match.index);
    }
    return positions;
};

describe('ECSDefinitionProvider', () => {
    describe('Component Context Detection', () => {
        it('should detect component usage in system queries', () => {
            const queryLines = [
                '{ all: [Position, Velocity] }',
                '{ any: [Flying, Swimming] }',
                '{ none: [Frozen] }',
            ];

            for (const line of queryLines) {
                expect(isComponentContext(line)).toBe(true);
            }
        });

        it('should detect component usage in entity methods', () => {
            const entityMethodLines = [
                'entity.addComponent(Position, 0, 0)',
                'entity.getComponent(Health)',
                'entity.hasComponent(Velocity)',
                'entity.removeComponent(Frozen)',
            ];

            for (const line of entityMethodLines) {
                expect(isComponentContext(line)).toBe(true);
            }
        });

        it('should detect component usage in prefab definitions', () => {
            const prefabLines = ['{ type: Position, args: [0, 0] }', '{ type: Health }'];

            for (const line of prefabLines) {
                expect(isComponentContext(line)).toBe(true);
            }
        });

        it('should detect component usage in singleton methods', () => {
            const singletonLines = [
                'engine.setSingleton(GameTime, 0, 0)',
                'engine.getSingleton(GameTime)',
                'engine.hasSingleton(GameState)',
            ];

            for (const line of singletonLines) {
                expect(isComponentContext(line)).toBe(true);
            }
        });

        it('should not detect component context in unrelated code', () => {
            // Only test lines that should NOT be component context
            // Import lines are excluded as they might contain component names but aren't usage context
            const unrelatedLines = ['const x = 5;', 'function foo() {}'];

            for (const line of unrelatedLines) {
                expect(isComponentContext(line)).toBe(false);
            }
        });
    });

    describe('System Context Detection', () => {
        it('should detect system references', () => {
            const systemLines = [
                "engine.getSystem('Movement')",
                "engine.enableSystem('Physics')",
                "engine.disableSystem('Render')",
                "engine.removeSystem('AI')",
            ];

            for (const line of systemLines) {
                expect(isSystemContext(line)).toBe(true);
            }
        });

        it('should not detect non-system contexts', () => {
            const nonSystemLines = [
                'const system = new System()',
                'class MySystem extends Base {}',
                'import { System } from "ecs"',
            ];

            for (const line of nonSystemLines) {
                expect(isSystemContext(line)).toBe(false);
            }
        });
    });

    describe('Prefab Context Detection', () => {
        it('should detect prefab references', () => {
            const prefabLines = [
                "engine.createFromPrefab('Player')",
                "engine.registerPrefab('Enemy', enemyPrefab)",
            ];

            for (const line of prefabLines) {
                expect(isPrefabContext(line)).toBe(true);
            }
        });

        it('should not detect non-prefab contexts', () => {
            const nonPrefabLines = [
                'const prefab = {}',
                'class Prefab {}',
                'import { Prefab } from "ecs"',
            ];

            for (const line of nonPrefabLines) {
                expect(isPrefabContext(line)).toBe(false);
            }
        });
    });
});

describe('ECSReferenceProvider', () => {
    describe('Reference Context Detection', () => {
        it('should identify component definitions', () => {
            const line = 'export class Position {';
            expect(determineReferenceContext(line, 13, 'Position')).toBe('definition');
        });

        it('should identify imports', () => {
            const line = "import { Position } from './components';";
            expect(determineReferenceContext(line, 9, 'Position')).toBe('import');
        });

        it('should identify system query usage', () => {
            const line = '{ all: [Position, Velocity] }';
            expect(determineReferenceContext(line, 8, 'Position')).toBe('system-query');
        });

        it('should identify entity method usage', () => {
            const lines = [
                { line: 'entity.addComponent(Position, 0, 0)', context: 'entity-add' },
                { line: 'entity.getComponent(Position)', context: 'entity-get' },
                { line: 'entity.hasComponent(Position)', context: 'entity-has' },
                { line: 'entity.removeComponent(Position)', context: 'entity-remove' },
            ];

            for (const { line, context } of lines) {
                const column = line.indexOf('Position');
                expect(determineReferenceContext(line, column, 'Position')).toBe(context);
            }
        });

        it('should identify singleton usage', () => {
            const lines = ['engine.setSingleton(GameTime, 0, 0)', 'engine.getSingleton(GameTime)'];

            for (const line of lines) {
                const column = line.indexOf('GameTime');
                expect(determineReferenceContext(line, column, 'GameTime')).toBe('singleton');
            }
        });

        it('should identify prefab type usage', () => {
            const line = '{ type: Position, args: [] }';
            expect(determineReferenceContext(line, 8, 'Position')).toBe('prefab-type');
        });

        it('should return other for unclassified usage', () => {
            const line = 'const pos: Position = new Position()';
            expect(determineReferenceContext(line, 11, 'Position')).toBe('other');
        });
    });

    describe('System Reference Pattern Matching', () => {
        it('should match system references in various contexts', () => {
            const systemName = 'Movement';
            const patterns = [
                { line: ".createSystem('Movement', {", isDefinition: true },
                { line: ".getSystem('Movement')", isDefinition: false },
                { line: ".enableSystem('Movement')", isDefinition: false },
                { line: ".disableSystem('Movement')", isDefinition: false },
                { line: ".removeSystem('Movement')", isDefinition: false },
            ];

            for (const { line, isDefinition } of patterns) {
                const regex = new RegExp(`['"\`]${systemName}['"\`]`);
                expect(regex.test(line)).toBe(true);
                expect(line.includes('createSystem')).toBe(isDefinition);
            }
        });
    });

    describe('Prefab Reference Pattern Matching', () => {
        it('should match prefab definition references', () => {
            const prefabName = 'Player';
            const definitionPatterns = [".registerPrefab('Player', {", "name: 'Player',"];

            for (const line of definitionPatterns) {
                const regex = new RegExp(`['"\`]${prefabName}['"\`]`);
                expect(regex.test(line)).toBe(true);
                expect(line.includes('registerPrefab') || line.includes('name:')).toBe(true);
            }
        });

        it('should match prefab usage references', () => {
            const prefabName = 'Player';
            const line = ".createFromPrefab('Player')";
            const regex = new RegExp(`['"\`]${prefabName}['"\`]`);
            expect(regex.test(line)).toBe(true);
            expect(line.includes('createFromPrefab')).toBe(true);
        });
    });

    describe('Component Reference Finding', () => {
        it('should find component occurrences in a line', () => {
            const line = 'entity.addComponent(Position).getComponent(Position)';
            const positions = findComponentInLine(line, 'Position');

            expect(positions).toHaveLength(2);
            expect(positions[0]).toBe(20); // First Position
            expect(positions[1]).toBe(43); // Second Position
        });

        it('should not match partial word occurrences', () => {
            const line = 'PositionComponent, Position2D, Position';
            const positions = findComponentInLine(line, 'Position');

            // Should only match the standalone "Position" at the end
            expect(positions).toHaveLength(1);
            expect(positions[0]).toBe(31);
        });
    });
});

describe('Regex Escape', () => {
    it('should escape special regex characters', () => {
        // Special regex characters that need escaping
        const specialChars = '.*+?^${}()|[]\\';
        const escaped = escapeRegExp(specialChars);

        // Each special char should be preceded by a backslash
        expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });

    it('should leave normal characters unchanged', () => {
        const normal = 'Position123_Test';
        expect(escapeRegExp(normal)).toBe(normal);
    });
});
