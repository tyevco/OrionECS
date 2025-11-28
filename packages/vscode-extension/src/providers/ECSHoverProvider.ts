import * as vscode from 'vscode';

/**
 * Provides hover documentation for ECS patterns and APIs
 */
export class ECSHoverProvider implements vscode.HoverProvider {
    private readonly apiDocs: Map<string, ApiDocumentation> = new Map();

    constructor() {
        this.initializeApiDocs();
    }

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.Hover | undefined {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        const lineText = document.lineAt(position).text;

        // Check for ECS API methods
        const apiDoc = this.apiDocs.get(word);
        if (apiDoc && this.isInEcsContext(lineText)) {
            return new vscode.Hover(this.formatApiDoc(apiDoc), wordRange);
        }

        // Check for ECS patterns
        const patternDoc = this.getPatternDocumentation(word, lineText);
        if (patternDoc) {
            return new vscode.Hover(patternDoc, wordRange);
        }

        return undefined;
    }

    private isInEcsContext(lineText: string): boolean {
        return (
            lineText.includes('engine.') ||
            lineText.includes('entity.') ||
            lineText.includes('createSystem') ||
            lineText.includes('createEntity') ||
            lineText.includes('EngineBuilder')
        );
    }

    private formatApiDoc(doc: ApiDocumentation): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendCodeblock(doc.signature, 'typescript');
        md.appendMarkdown(`\n\n${doc.description}\n\n`);

        if (doc.parameters && doc.parameters.length > 0) {
            md.appendMarkdown('**Parameters:**\n');
            for (const param of doc.parameters) {
                md.appendMarkdown(`- \`${param.name}\`: ${param.description}\n`);
            }
            md.appendMarkdown('\n');
        }

        if (doc.returns) {
            md.appendMarkdown(`**Returns:** ${doc.returns}\n\n`);
        }

        if (doc.example) {
            md.appendMarkdown('**Example:**\n');
            md.appendCodeblock(doc.example, 'typescript');
        }

        return md;
    }

    private getPatternDocumentation(
        word: string,
        lineText: string
    ): vscode.MarkdownString | undefined {
        // Query patterns
        if (word === 'all' && lineText.includes(':')) {
            return this.createMarkdown(
                '**ALL Query**',
                'Matches entities that have ALL of the specified components.',
                '{ all: [Position, Velocity] }'
            );
        }

        if (word === 'any' && lineText.includes(':')) {
            return this.createMarkdown(
                '**ANY Query**',
                'Matches entities that have ANY of the specified components.',
                '{ any: [Flying, Swimming] }'
            );
        }

        if (word === 'none' && lineText.includes(':')) {
            return this.createMarkdown(
                '**NONE Query**',
                'Matches entities that do NOT have any of the specified components.',
                '{ none: [Frozen, Dead] }'
            );
        }

        // System options
        if (word === 'priority') {
            return this.createMarkdown(
                '**System Priority**',
                'Higher priority systems execute first. Default is 0.',
                '{ priority: 100 }'
            );
        }

        if (word === 'act') {
            return this.createMarkdown(
                '**System Action**',
                'The main function that processes each entity matching the query.',
                'act: (entity, position, velocity) => {\n  position.x += velocity.x;\n}'
            );
        }

        if (word === 'before') {
            return this.createMarkdown(
                '**Before Hook**',
                'Called once before the system processes any entities.',
                "before: () => {\n  console.log('Starting system');\n}"
            );
        }

        if (word === 'after') {
            return this.createMarkdown(
                '**After Hook**',
                'Called once after the system has processed all entities.',
                "after: () => {\n  console.log('System complete');\n}"
            );
        }

        return undefined;
    }

    private createMarkdown(
        title: string,
        description: string,
        example: string
    ): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`${title}\n\n${description}\n\n`);
        md.appendMarkdown('**Example:**\n');
        md.appendCodeblock(example, 'typescript');
        return md;
    }

    private initializeApiDocs(): void {
        // Entity methods
        this.apiDocs.set('addComponent', {
            signature:
                'entity.addComponent<T>(Component: ComponentClass<T>, ...args: any[]): Entity',
            description: 'Adds a component to this entity.',
            parameters: [
                { name: 'Component', description: 'The component class to add' },
                {
                    name: '...args',
                    description: 'Arguments passed to the component constructor',
                },
            ],
            returns: 'The entity (for chaining)',
            example:
                'entity.addComponent(Position, 100, 200);\nentity.addComponent(Velocity, 5, 0);',
        });

        this.apiDocs.set('getComponent', {
            signature: 'entity.getComponent<T>(Component: ComponentClass<T>): T | undefined',
            description: 'Gets a component from this entity.',
            parameters: [{ name: 'Component', description: 'The component class to retrieve' }],
            returns: 'The component instance or undefined if not found',
            example: 'const pos = entity.getComponent(Position);\nif (pos) {\n  pos.x += 10;\n}',
        });

        this.apiDocs.set('hasComponent', {
            signature: 'entity.hasComponent(Component: ComponentClass<any>): boolean',
            description: 'Checks if this entity has a specific component.',
            parameters: [{ name: 'Component', description: 'The component class to check for' }],
            returns: 'True if the entity has the component',
            example: 'if (entity.hasComponent(Health)) {\n  // Entity can take damage\n}',
        });

        this.apiDocs.set('removeComponent', {
            signature: 'entity.removeComponent(Component: ComponentClass<any>): Entity',
            description: 'Removes a component from this entity.',
            parameters: [{ name: 'Component', description: 'The component class to remove' }],
            returns: 'The entity (for chaining)',
            example: 'entity.removeComponent(Frozen);',
        });

        this.apiDocs.set('queueFree', {
            signature: 'entity.queueFree(): void',
            description:
                'Marks this entity for deletion. The entity will be removed after the current frame completes.',
            returns: 'void',
            example: 'if (health.current <= 0) {\n  entity.queueFree();\n}',
        });

        this.apiDocs.set('addTag', {
            signature: 'entity.addTag(tag: string): Entity',
            description: 'Adds a tag to this entity.',
            parameters: [{ name: 'tag', description: 'The tag string to add' }],
            returns: 'The entity (for chaining)',
            example: "entity.addTag('player').addTag('active');",
        });

        this.apiDocs.set('hasTag', {
            signature: 'entity.hasTag(tag: string): boolean',
            description: 'Checks if this entity has a specific tag.',
            parameters: [{ name: 'tag', description: 'The tag to check for' }],
            returns: 'True if the entity has the tag',
            example: "if (entity.hasTag('enemy')) {\n  // Handle enemy\n}",
        });

        // Engine methods
        this.apiDocs.set('createEntity', {
            signature: 'engine.createEntity(name?: string): Entity',
            description: 'Creates a new entity.',
            parameters: [
                {
                    name: 'name',
                    description: 'Optional name for the entity (for debugging)',
                },
            ],
            returns: 'The newly created entity',
            example:
                "const player = engine.createEntity('Player');\nplayer.addComponent(Position, 0, 0);",
        });

        this.apiDocs.set('createSystem', {
            signature:
                'engine.createSystem(name: string, query: QueryDef, options: SystemOptions, fixed?: boolean): System',
            description: 'Creates and registers a new system.',
            parameters: [
                { name: 'name', description: 'Unique name for the system' },
                {
                    name: 'query',
                    description: 'Query defining which entities this system processes',
                },
                {
                    name: 'options',
                    description: 'System options including act, before, after, priority',
                },
                {
                    name: 'fixed',
                    description:
                        'If true, runs at fixed timestep (default: false, variable update)',
                },
            ],
            returns: 'The created system',
            example:
                "engine.createSystem('Movement', {\n  all: [Position, Velocity]\n}, {\n  priority: 100,\n  act: (entity, pos, vel) => {\n    pos.x += vel.x;\n    pos.y += vel.y;\n  }\n});",
        });

        this.apiDocs.set('update', {
            signature: 'engine.update(deltaTime: number): void',
            description: 'Runs one update cycle of all systems. Call this in your game loop.',
            parameters: [
                {
                    name: 'deltaTime',
                    description: 'Time elapsed since last update (in seconds)',
                },
            ],
            returns: 'void',
            example:
                'function gameLoop(timestamp: number) {\n  const delta = (timestamp - lastTime) / 1000;\n  engine.update(delta);\n  lastTime = timestamp;\n  requestAnimationFrame(gameLoop);\n}',
        });

        this.apiDocs.set('setSingleton', {
            signature: 'engine.setSingleton<T>(Component: ComponentClass<T>, ...args: any[]): T',
            description:
                'Sets a singleton component. Singletons are global state not tied to entities.',
            parameters: [
                { name: 'Component', description: 'The singleton component class' },
                {
                    name: '...args',
                    description: 'Arguments passed to the component constructor',
                },
            ],
            returns: 'The singleton instance',
            example:
                'engine.setSingleton(GameTime, 0, 0);\n\nconst time = engine.getSingleton(GameTime);\ntime.elapsed += deltaTime;',
        });

        this.apiDocs.set('createFromPrefab', {
            signature: 'engine.createFromPrefab(prefabName: string, entityName?: string): Entity',
            description: 'Creates an entity from a registered prefab template.',
            parameters: [
                { name: 'prefabName', description: 'Name of the registered prefab' },
                { name: 'entityName', description: 'Optional name for the new entity' },
            ],
            returns: 'The newly created entity with prefab components',
            example:
                "engine.registerPrefab('Enemy', enemyPrefab);\nconst enemy = engine.createFromPrefab('Enemy', 'Enemy1');",
        });

        // EngineBuilder methods
        this.apiDocs.set('EngineBuilder', {
            signature: 'new EngineBuilder()',
            description: 'Fluent builder for configuring and creating an Engine instance.',
            returns: 'An EngineBuilder instance',
            example:
                'const engine = new EngineBuilder()\n  .withDebugMode(true)\n  .withFixedUpdateFPS(60)\n  .withArchetypes(true)\n  .build();',
        });
    }
}

interface ApiDocumentation {
    signature: string;
    description: string;
    parameters?: { name: string; description: string }[];
    returns?: string;
    example?: string;
}
