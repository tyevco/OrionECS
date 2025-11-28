/**
 * Tests for refactoring utilities and providers
 */

import { generateExtractedComponent } from '../providers/ExtractComponentCodeActionProvider';
import {
    type ComponentReference,
    ComponentReferenceType,
    findReferencesInDocument,
    isLikelyComponentClass,
    isValidComponentName,
    summarizeReferences,
} from '../utils/refactoringUtils';

// Type for mock document that matches what findReferencesInDocument expects
interface MockDocument {
    getText: () => string;
    lineAt: (line: number) => { text: string };
    uri: { fsPath: string; toString: () => string };
}

// Mock document helper
function createMockDocument(content: string): MockDocument {
    const lines = content.split('\n');
    return {
        getText: () => content,
        lineAt: (line: number) => ({ text: lines[line] }),
        uri: { fsPath: '/test/file.ts', toString: () => '/test/file.ts' },
    };
}

describe('Refactoring Utilities', () => {
    describe('isValidComponentName', () => {
        it('should accept valid component names', () => {
            expect(isValidComponentName('Position')).toBe(true);
            expect(isValidComponentName('Velocity')).toBe(true);
            expect(isValidComponentName('Transform2D')).toBe(true);
            expect(isValidComponentName('PlayerHealth')).toBe(true);
        });

        it('should reject invalid component names', () => {
            expect(isValidComponentName('position')).toBe(false);
            expect(isValidComponentName('123Position')).toBe(false);
            expect(isValidComponentName('Player_Health')).toBe(false);
            expect(isValidComponentName('')).toBe(false);
            expect(isValidComponentName('Position-Value')).toBe(false);
        });
    });

    describe('isLikelyComponentClass', () => {
        it('should identify component class names', () => {
            expect(isLikelyComponentClass('Position')).toBe(true);
            expect(isLikelyComponentClass('Velocity')).toBe(true);
            expect(isLikelyComponentClass('Health')).toBe(true);
            expect(isLikelyComponentClass('Transform')).toBe(true);
            expect(isLikelyComponentClass('RigidBody')).toBe(true);
        });

        it('should reject non-component patterns', () => {
            expect(isLikelyComponentClass('MovementSystem')).toBe(false);
            expect(isLikelyComponentClass('EntityManager')).toBe(false);
            expect(isLikelyComponentClass('GameService')).toBe(false);
            expect(isLikelyComponentClass('PhysicsController')).toBe(false);
            expect(isLikelyComponentClass('ComponentProvider')).toBe(false);
            expect(isLikelyComponentClass('EntityFactory')).toBe(false);
            expect(isLikelyComponentClass('EngineBuilder')).toBe(false);
            expect(isLikelyComponentClass('InputHandler')).toBe(false);
            expect(isLikelyComponentClass('PhysicsPlugin')).toBe(false);
            expect(isLikelyComponentClass('SpatialQuery')).toBe(false);
        });
    });

    describe('findReferencesInDocument', () => {
        it('should find class definition references', () => {
            const doc = createMockDocument(`
export class Position {
  constructor(public x = 0, public y = 0) {}
}
`);
            const refs = findReferencesInDocument(
                doc as unknown as Parameters<typeof findReferencesInDocument>[0],
                'Position'
            );
            const classDef = refs.find((r) => r.type === ComponentReferenceType.ClassDefinition);
            expect(classDef).toBeDefined();
        });

        it('should find import references', () => {
            const doc = createMockDocument(`
import { Position, Velocity } from './components';
`);
            const refs = findReferencesInDocument(
                doc as unknown as Parameters<typeof findReferencesInDocument>[0],
                'Position'
            );
            const importRef = refs.find((r) => r.type === ComponentReferenceType.Import);
            expect(importRef).toBeDefined();
        });

        it('should find system query references', () => {
            const doc = createMockDocument(`
engine.createSystem('Movement', {
  all: [Position, Velocity],
  none: [Frozen]
}, {
  act: (entity, pos, vel) => {}
});
`);
            const refs = findReferencesInDocument(
                doc as unknown as Parameters<typeof findReferencesInDocument>[0],
                'Position'
            );
            const queryRef = refs.find((r) => r.type === ComponentReferenceType.SystemQueryAll);
            expect(queryRef).toBeDefined();
        });

        it('should find entity method references', () => {
            const doc = createMockDocument(`
entity.addComponent(Position, 100, 200);
const pos = entity.getComponent(Position);
if (entity.hasComponent(Position)) {}
entity.removeComponent(Position);
`);
            const refs = findReferencesInDocument(
                doc as unknown as Parameters<typeof findReferencesInDocument>[0],
                'Position'
            );
            expect(refs.length).toBeGreaterThanOrEqual(4);
        });

        it('should find singleton references', () => {
            const doc = createMockDocument(`
engine.setSingleton(GameTime, 0, 0);
const time = engine.getSingleton(GameTime);
`);
            const refs = findReferencesInDocument(
                doc as unknown as Parameters<typeof findReferencesInDocument>[0],
                'GameTime'
            );
            const setRef = refs.find((r) => r.type === ComponentReferenceType.SingletonSet);
            const getRef = refs.find((r) => r.type === ComponentReferenceType.SingletonGet);
            expect(setRef).toBeDefined();
            expect(getRef).toBeDefined();
        });

        it('should find prefab references', () => {
            const doc = createMockDocument(`
const playerPrefab = {
  components: [
    { type: Position, args: [0, 0] },
    { type: Health, args: [100] }
  ]
};
`);
            const refs = findReferencesInDocument(
                doc as unknown as Parameters<typeof findReferencesInDocument>[0],
                'Position'
            );
            const prefabRef = refs.find((r) => r.type === ComponentReferenceType.PrefabDefinition);
            expect(prefabRef).toBeDefined();
        });
    });

    describe('summarizeReferences', () => {
        it('should summarize reference counts correctly', () => {
            const mockUri = { fsPath: '/test.ts', toString: () => '/test.ts' };
            const mockRange = { start: { line: 0 }, end: { line: 0 } };

            const refs = [
                {
                    type: ComponentReferenceType.ClassDefinition,
                    uri: mockUri,
                    range: mockRange,
                    componentName: 'Position',
                    lineText: '',
                },
                {
                    type: ComponentReferenceType.Import,
                    uri: mockUri,
                    range: mockRange,
                    componentName: 'Position',
                    lineText: '',
                },
                {
                    type: ComponentReferenceType.Import,
                    uri: mockUri,
                    range: mockRange,
                    componentName: 'Position',
                    lineText: '',
                },
                {
                    type: ComponentReferenceType.EntityAddComponent,
                    uri: mockUri,
                    range: mockRange,
                    componentName: 'Position',
                    lineText: '',
                },
                {
                    type: ComponentReferenceType.SystemQueryAll,
                    uri: mockUri,
                    range: mockRange,
                    componentName: 'Position',
                    lineText: '',
                },
            ];

            const summary = summarizeReferences(refs as ComponentReference[]);

            expect(summary).toContain('1 definition');
            expect(summary).toContain('2 import');
            expect(summary).toContain('1 entity method');
            expect(summary).toContain('1 system query');
        });
    });
});

describe('Extract Component', () => {
    describe('generateExtractedComponent', () => {
        it('should generate empty component class', () => {
            const result = generateExtractedComponent('Empty', []);
            expect(result).toContain('export class Empty');
            expect(result).toContain('constructor()');
        });

        it('should generate component with public properties', () => {
            const result = generateExtractedComponent('Position', [
                { name: 'x', type: 'number', defaultValue: '0', modifier: 'public' },
                { name: 'y', type: 'number', defaultValue: '0', modifier: 'public' },
            ]);

            expect(result).toContain('export class Position');
            expect(result).toContain('public x: number = 0');
            expect(result).toContain('public y: number = 0');
        });

        it('should handle properties without default values', () => {
            const result = generateExtractedComponent('Health', [
                { name: 'current', type: 'number' },
                { name: 'max', type: 'number' },
            ]);

            expect(result).toContain('public current: number');
            expect(result).toContain('public max: number');
            expect(result).not.toContain('=');
        });

        it('should handle mixed modifiers', () => {
            const result = generateExtractedComponent('Config', [
                { name: 'name', type: 'string', modifier: 'public' },
                { name: 'id', type: 'number', modifier: 'readonly' },
            ]);

            expect(result).toContain('public name: string');
            expect(result).toContain('readonly id: number');
        });

        it('should default modifier to public', () => {
            const result = generateExtractedComponent('Simple', [
                { name: 'value', type: 'number' },
            ]);

            expect(result).toContain('public value: number');
        });
    });
});

describe('Component Rename Patterns', () => {
    describe('Reference Detection Patterns', () => {
        it('should match class definition patterns', () => {
            const patterns = [
                'class Position {',
                'export class Position {',
                'export class Position extends Base {',
            ];

            for (const pattern of patterns) {
                const match = pattern.match(/^(?:export\s+)?class\s+Position\b/);
                expect(match).not.toBeNull();
            }
        });

        it('should match entity method patterns', () => {
            const patterns = [
                'entity.addComponent(Position, 0, 0)',
                'entity.getComponent(Position)',
                'entity.hasComponent(Position)',
                'entity.removeComponent(Position)',
            ];

            for (const pattern of patterns) {
                const match = pattern.match(/\.(add|get|has|remove)Component\s*\(\s*Position/);
                expect(match).not.toBeNull();
            }
        });

        it('should match system query patterns', () => {
            const pattern = `{
        all: [Position, Velocity],
        any: [Flying, Swimming],
        none: [Frozen]
      }`;

            const allMatch = pattern.match(/all\s*:\s*\[[^\]]*Position[^\]]*\]/);
            expect(allMatch).not.toBeNull();
        });

        it('should match import patterns', () => {
            const patterns = [
                "import { Position } from './components';",
                "import { Position, Velocity } from './components';",
                "import Position from './Position';",
            ];

            for (const pattern of patterns) {
                const match = pattern.match(/import.*Position/);
                expect(match).not.toBeNull();
            }
        });

        it('should match singleton patterns', () => {
            const patterns = [
                'engine.setSingleton(Position, 0, 0)',
                'engine.getSingleton(Position)',
                'engine.hasSingleton(Position)',
            ];

            for (const pattern of patterns) {
                const match = pattern.match(/\.(set|get|has)Singleton\s*\(\s*Position/);
                expect(match).not.toBeNull();
            }
        });

        it('should match prefab type patterns', () => {
            const pattern = '{ type: Position, args: [0, 0] }';
            const match = pattern.match(/type\s*:\s*Position/);
            expect(match).not.toBeNull();
        });
    });

    describe('Word Boundary Detection', () => {
        it('should not match partial names', () => {
            const text = 'PositionComponent PositionalData MyPosition';
            const pattern = /\bPosition\b/g;
            const matches = text.match(pattern);

            // Should not match PositionComponent or PositionalData or MyPosition
            expect(matches).toBeNull();
        });

        it('should match exact names', () => {
            const text = 'Position, Velocity, Position';
            const pattern = /\bPosition\b/g;
            const matches = text.match(pattern);

            expect(matches).toHaveLength(2);
        });
    });
});
