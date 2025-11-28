import * as vscode from 'vscode';
import { scanForComponents, scanForSystems } from '../utils/ecsScanner';

/**
 * Provides intelligent code completion for ECS patterns
 */
export class ECSCompletionProvider implements vscode.CompletionItemProvider {
    private componentCache: string[] = [];
    private systemCache: string[] = [];
    private lastCacheUpdate = 0;
    private readonly CACHE_TTL = 30000; // 30 seconds

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList | undefined> {
        const linePrefix = document.lineAt(position).text.slice(0, position.character);

        // Refresh cache if needed
        await this.refreshCacheIfNeeded();

        const items: vscode.CompletionItem[] = [];

        // Completion for query component arrays: all: [|], any: [|], none: [|]
        if (this.isInQueryArray(linePrefix)) {
            items.push(...this.getComponentCompletions());
        }

        // Completion for addComponent, getComponent, hasComponent, removeComponent
        if (this.isInComponentMethod(linePrefix)) {
            items.push(...this.getComponentCompletions());
        }

        // Completion for getSystem
        if (this.isInGetSystem(linePrefix)) {
            items.push(...this.getSystemCompletions());
        }

        // Completion for entity methods
        if (this.isInEntityMethod(linePrefix)) {
            items.push(...this.getEntityMethodCompletions());
        }

        // Completion for engine methods
        if (this.isInEngineMethod(linePrefix)) {
            items.push(...this.getEngineMethodCompletions());
        }

        // Completion for tags
        if (this.isInTagContext(linePrefix)) {
            items.push(...this.getCommonTagCompletions());
        }

        return items;
    }

    private async refreshCacheIfNeeded(): Promise<void> {
        const now = Date.now();
        if (now - this.lastCacheUpdate > this.CACHE_TTL) {
            const components = await scanForComponents();
            this.componentCache = components.map((c) => c.name);

            const systems = await scanForSystems();
            this.systemCache = systems.map((s) => s.name);

            this.lastCacheUpdate = now;
        }
    }

    private isInQueryArray(linePrefix: string): boolean {
        // Match patterns like: all: [, any: [, none: [
        return /(?:all|any|none)\s*:\s*\[[^\]]*$/.test(linePrefix);
    }

    private isInComponentMethod(linePrefix: string): boolean {
        // Match patterns like: .addComponent(, .getComponent(, etc.
        return /\.(addComponent|getComponent|hasComponent|removeComponent)\s*\(\s*$/.test(
            linePrefix
        );
    }

    private isInGetSystem(linePrefix: string): boolean {
        return /\.getSystem\s*\(\s*['"`]?$/.test(linePrefix);
    }

    private isInEntityMethod(linePrefix: string): boolean {
        return /entity\.\s*$/.test(linePrefix);
    }

    private isInEngineMethod(linePrefix: string): boolean {
        return /engine\.\s*$/.test(linePrefix);
    }

    private isInTagContext(linePrefix: string): boolean {
        // Match patterns like: .addTag(', tags: [', .hasTag('
        return /(?:\.addTag|\.hasTag|\.removeTag|tags\s*:\s*\[)\s*\(\s*['"`]?$/.test(linePrefix);
    }

    private getComponentCompletions(): vscode.CompletionItem[] {
        return this.componentCache.map((name) => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
            item.detail = 'Component';
            item.documentation = new vscode.MarkdownString(`Component class \`${name}\``);
            item.sortText = '0' + name; // Prioritize components
            return item;
        });
    }

    private getSystemCompletions(): vscode.CompletionItem[] {
        return this.systemCache.map((name) => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Method);
            item.detail = 'System';
            item.documentation = new vscode.MarkdownString(`System \`${name}\``);
            item.insertText = `'${name}'`;
            return item;
        });
    }

    private getEntityMethodCompletions(): vscode.CompletionItem[] {
        const methods = [
            {
                name: 'addComponent',
                signature: '(Component, ...args)',
                doc: 'Add a component to this entity',
            },
            {
                name: 'getComponent',
                signature: '(Component)',
                doc: 'Get a component from this entity',
            },
            {
                name: 'hasComponent',
                signature: '(Component)',
                doc: 'Check if entity has a component',
            },
            {
                name: 'removeComponent',
                signature: '(Component)',
                doc: 'Remove a component from this entity',
            },
            {
                name: 'addTag',
                signature: '(tag: string)',
                doc: 'Add a tag to this entity',
            },
            {
                name: 'hasTag',
                signature: '(tag: string)',
                doc: 'Check if entity has a tag',
            },
            {
                name: 'removeTag',
                signature: '(tag: string)',
                doc: 'Remove a tag from this entity',
            },
            { name: 'queueFree', signature: '()', doc: 'Mark entity for deletion' },
            {
                name: 'setParent',
                signature: '(parent: Entity | null)',
                doc: 'Set the parent entity',
            },
            {
                name: 'addChild',
                signature: '(child: Entity)',
                doc: 'Add a child entity',
            },
            {
                name: 'removeChild',
                signature: '(child: Entity)',
                doc: 'Remove a child entity',
            },
            {
                name: 'getChildren',
                signature: '()',
                doc: 'Get all child entities',
            },
            { name: 'getParent', signature: '()', doc: 'Get the parent entity' },
            {
                name: 'getDescendants',
                signature: '(maxDepth?)',
                doc: 'Get all descendants',
            },
            { name: 'getAncestors', signature: '()', doc: 'Get all ancestors' },
            { name: 'getRoot', signature: '()', doc: 'Get the root entity' },
            { name: 'getDepth', signature: '()', doc: 'Get hierarchy depth' },
            { name: 'getSiblings', signature: '()', doc: 'Get sibling entities' },
        ];

        return methods.map((m) => {
            const item = new vscode.CompletionItem(m.name, vscode.CompletionItemKind.Method);
            item.detail = m.signature;
            item.documentation = new vscode.MarkdownString(m.doc);
            return item;
        });
    }

    private getEngineMethodCompletions(): vscode.CompletionItem[] {
        const methods = [
            {
                name: 'createEntity',
                signature: '(name?: string)',
                doc: 'Create a new entity',
            },
            {
                name: 'createEntities',
                signature: '(count, prefab?)',
                doc: 'Create multiple entities',
            },
            {
                name: 'createFromPrefab',
                signature: '(prefabName, entityName?)',
                doc: 'Create entity from prefab',
            },
            {
                name: 'createSystem',
                signature: '(name, query, options, fixed?)',
                doc: 'Create a new system',
            },
            {
                name: 'registerPrefab',
                signature: '(name, prefab)',
                doc: 'Register an entity prefab',
            },
            {
                name: 'getEntity',
                signature: '(id)',
                doc: 'Get entity by ID',
            },
            {
                name: 'getEntityByName',
                signature: '(name)',
                doc: 'Get entity by name',
            },
            {
                name: 'getSystem',
                signature: '(name)',
                doc: 'Get system by name',
            },
            {
                name: 'getAllSystems',
                signature: '()',
                doc: 'Get all registered systems',
            },
            {
                name: 'removeSystem',
                signature: '(name)',
                doc: 'Remove a system',
            },
            { name: 'update', signature: '(deltaTime)', doc: 'Run one update cycle' },
            { name: 'start', signature: '()', doc: 'Start the engine' },
            { name: 'stop', signature: '()', doc: 'Stop the engine' },
            { name: 'destroy', signature: '()', doc: 'Destroy the engine' },
            {
                name: 'setSingleton',
                signature: '(Component, ...args)',
                doc: 'Set a singleton component',
            },
            {
                name: 'getSingleton',
                signature: '(Component)',
                doc: 'Get a singleton component',
            },
            {
                name: 'hasSingleton',
                signature: '(Component)',
                doc: 'Check if singleton exists',
            },
            {
                name: 'removeSingleton',
                signature: '(Component)',
                doc: 'Remove a singleton',
            },
            {
                name: 'createSnapshot',
                signature: '()',
                doc: 'Create world state snapshot',
            },
            {
                name: 'restoreSnapshot',
                signature: '()',
                doc: 'Restore world state',
            },
            {
                name: 'beginTransaction',
                signature: '()',
                doc: 'Begin batch transaction',
            },
            {
                name: 'commitTransaction',
                signature: '()',
                doc: 'Commit batch transaction',
            },
            {
                name: 'query',
                signature: '()',
                doc: 'Create a fluent query builder',
            },
            {
                name: 'getDebugInfo',
                signature: '()',
                doc: 'Get debug information',
            },
            {
                name: 'getMemoryStats',
                signature: '()',
                doc: 'Get memory statistics',
            },
            {
                name: 'getSystemProfiles',
                signature: '()',
                doc: 'Get system profiling data',
            },
        ];

        return methods.map((m) => {
            const item = new vscode.CompletionItem(m.name, vscode.CompletionItemKind.Method);
            item.detail = m.signature;
            item.documentation = new vscode.MarkdownString(m.doc);
            return item;
        });
    }

    private getCommonTagCompletions(): vscode.CompletionItem[] {
        const commonTags = [
            'player',
            'enemy',
            'active',
            'inactive',
            'visible',
            'hidden',
            'solid',
            'trigger',
            'interactive',
            'static',
            'dynamic',
            'ui',
            'world',
            'debug',
        ];

        return commonTags.map((tag) => {
            const item = new vscode.CompletionItem(tag, vscode.CompletionItemKind.Constant);
            item.detail = 'Common tag';
            item.insertText = `'${tag}'`;
            return item;
        });
    }
}
