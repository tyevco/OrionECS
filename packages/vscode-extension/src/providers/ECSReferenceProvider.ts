import * as vscode from 'vscode';
import {
    type ComponentInfo,
    type PrefabInfo,
    type SystemInfo,
    scanForComponents,
    scanForPrefabs,
    scanForSystems,
} from '../utils/ecsScanner';

/**
 * Reference information with context about how the element is used
 */
export interface ECSReference {
    location: vscode.Location;
    context: ReferenceContext;
}

/**
 * Context types for how an ECS element is referenced
 */
export type ReferenceContext =
    | 'definition' // Where the element is defined
    | 'system-query' // Used in a system query (all/any/none)
    | 'entity-add' // Used in entity.addComponent
    | 'entity-get' // Used in entity.getComponent
    | 'entity-has' // Used in entity.hasComponent
    | 'entity-remove' // Used in entity.removeComponent
    | 'prefab-type' // Used in prefab definition
    | 'singleton' // Used as singleton
    | 'system-reference' // System referenced by name
    | 'prefab-reference' // Prefab referenced by name
    | 'import' // Import statement
    | 'other'; // Other usage

/**
 * Provides Find All References support for ECS elements:
 * - Components used in systems, entities, prefabs
 * - Systems referenced across the codebase
 * - Prefabs referenced across the codebase
 */
export class ECSReferenceProvider implements vscode.ReferenceProvider {
    private componentCache: Map<string, ComponentInfo> = new Map();
    private systemCache: Map<string, SystemInfo> = new Map();
    private prefabCache: Map<string, PrefabInfo> = new Map();
    private cacheTimestamp = 0;
    private readonly cacheTimeout = 30000; // 30 seconds

    async provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.Location[]> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return [];
        }

        const word = document.getText(wordRange);
        const lineText = document.lineAt(position).text;

        // Refresh cache if stale
        await this.ensureCacheFresh();

        // Determine what type of element this is
        const elementType = this.determineElementType(word, lineText);

        if (elementType === 'component') {
            return this.findComponentReferences(word, context.includeDeclaration);
        }

        if (elementType === 'system') {
            return this.findSystemReferences(word, context.includeDeclaration);
        }

        if (elementType === 'prefab') {
            return this.findPrefabReferences(word, context.includeDeclaration);
        }

        return [];
    }

    /**
     * Determines what type of ECS element the word represents
     */
    private determineElementType(
        word: string,
        lineText: string
    ): 'component' | 'system' | 'prefab' | null {
        // Check caches first for exact matches
        if (this.componentCache.has(word)) {
            return 'component';
        }

        if (this.systemCache.has(word)) {
            return 'system';
        }

        if (this.prefabCache.has(word)) {
            return 'prefab';
        }

        // Check context clues
        if (this.isComponentContext(lineText)) {
            return 'component';
        }

        if (this.isSystemContext(lineText)) {
            return 'system';
        }

        if (this.isPrefabContext(lineText)) {
            return 'prefab';
        }

        return null;
    }

    /**
     * Finds all references to a component
     */
    public async findComponentReferences(
        componentName: string,
        includeDeclaration = true
    ): Promise<vscode.Location[]> {
        const locations: vscode.Location[] = [];

        try {
            const files = await vscode.workspace.findFiles('**/*.{ts,js}', '**/node_modules/**');

            for (const file of files) {
                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const text = document.getText();
                    const lines = text.split('\n');

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        const references = this.findComponentInLine(line, componentName, i);

                        for (const ref of references) {
                            // Skip definition if not including declarations
                            if (!includeDeclaration && ref.context === 'definition') {
                                continue;
                            }

                            const position = new vscode.Position(i, ref.column);
                            locations.push(new vscode.Location(file, position));
                        }
                    }
                } catch {
                    // Skip unreadable files
                }
            }
        } catch {
            // Return empty on error
        }

        return locations;
    }

    /**
     * Finds component references in a single line
     */
    private findComponentInLine(
        line: string,
        componentName: string,
        _lineIndex: number
    ): Array<{ column: number; context: ReferenceContext }> {
        const references: Array<{ column: number; context: ReferenceContext }> = [];

        // Create a regex to find all occurrences of the component name as a word
        const regex = new RegExp(`\\b${this.escapeRegExp(componentName)}\\b`, 'g');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(line)) !== null) {
            const column = match.index;
            const context = this.determineReferenceContext(line, column, componentName);
            references.push({ column, context });
        }

        return references;
    }

    /**
     * Determines the context of a reference based on the line content
     */
    private determineReferenceContext(
        line: string,
        column: number,
        name: string
    ): ReferenceContext {
        const beforeMatch = line.substring(0, column);
        const afterMatch = line.substring(column + name.length);

        // Check for class definition
        if (line.match(new RegExp(`class\\s+${this.escapeRegExp(name)}\\b`))) {
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
        if (beforeMatch.includes('type:') || afterMatch.match(/^\s*[,\]]/)) {
            return 'prefab-type';
        }

        return 'other';
    }

    /**
     * Finds all references to a system
     */
    public async findSystemReferences(
        systemName: string,
        includeDeclaration = true
    ): Promise<vscode.Location[]> {
        const locations: vscode.Location[] = [];

        try {
            const files = await vscode.workspace.findFiles('**/*.{ts,js}', '**/node_modules/**');

            for (const file of files) {
                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const text = document.getText();
                    const lines = text.split('\n');

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];

                        // Find system name in string literals
                        const stringPatterns = [
                            new RegExp(
                                `createSystem\\s*\\(\\s*['"\`]${this.escapeRegExp(systemName)}['"\`]`
                            ),
                            new RegExp(
                                `getSystem\\s*\\(\\s*['"\`]${this.escapeRegExp(systemName)}['"\`]`
                            ),
                            new RegExp(
                                `enableSystem\\s*\\(\\s*['"\`]${this.escapeRegExp(systemName)}['"\`]`
                            ),
                            new RegExp(
                                `disableSystem\\s*\\(\\s*['"\`]${this.escapeRegExp(systemName)}['"\`]`
                            ),
                            new RegExp(
                                `removeSystem\\s*\\(\\s*['"\`]${this.escapeRegExp(systemName)}['"\`]`
                            ),
                        ];

                        for (const pattern of stringPatterns) {
                            const match = line.match(pattern);
                            if (match) {
                                const isDefinition = line.includes('createSystem');
                                if (!includeDeclaration && isDefinition) {
                                    continue;
                                }

                                // Find the actual position of the system name
                                const nameIndex = line.indexOf(systemName);
                                if (nameIndex !== -1) {
                                    const position = new vscode.Position(i, nameIndex);
                                    locations.push(new vscode.Location(file, position));
                                }
                            }
                        }
                    }
                } catch {
                    // Skip unreadable files
                }
            }
        } catch {
            // Return empty on error
        }

        return locations;
    }

    /**
     * Finds all references to a prefab
     */
    public async findPrefabReferences(
        prefabName: string,
        includeDeclaration = true
    ): Promise<vscode.Location[]> {
        const locations: vscode.Location[] = [];

        try {
            const files = await vscode.workspace.findFiles('**/*.{ts,js}', '**/node_modules/**');

            for (const file of files) {
                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const text = document.getText();
                    const lines = text.split('\n');

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];

                        // Find prefab name in string literals
                        const stringPatterns = [
                            new RegExp(
                                `registerPrefab\\s*\\(\\s*['"\`]${this.escapeRegExp(prefabName)}['"\`]`
                            ),
                            new RegExp(
                                `createFromPrefab\\s*\\(\\s*['"\`]${this.escapeRegExp(prefabName)}['"\`]`
                            ),
                            new RegExp(`name\\s*:\\s*['"\`]${this.escapeRegExp(prefabName)}['"\`]`),
                        ];

                        for (const pattern of stringPatterns) {
                            const match = line.match(pattern);
                            if (match) {
                                const isDefinition =
                                    line.includes('registerPrefab') ||
                                    (line.includes('name:') && !line.includes('createFromPrefab'));
                                if (!includeDeclaration && isDefinition) {
                                    continue;
                                }

                                // Find the actual position of the prefab name
                                const nameIndex = line.indexOf(prefabName);
                                if (nameIndex !== -1) {
                                    const position = new vscode.Position(i, nameIndex);
                                    locations.push(new vscode.Location(file, position));
                                }
                            }
                        }
                    }
                } catch {
                    // Skip unreadable files
                }
            }
        } catch {
            // Return empty on error
        }

        return locations;
    }

    /**
     * Ensures the cache is fresh, refreshing if needed
     */
    private async ensureCacheFresh(): Promise<void> {
        const now = Date.now();
        if (now - this.cacheTimestamp > this.cacheTimeout) {
            await this.refreshCache();
            this.cacheTimestamp = now;
        }
    }

    /**
     * Refreshes all caches
     */
    private async refreshCache(): Promise<void> {
        const [components, systems, prefabs] = await Promise.all([
            scanForComponents(),
            scanForSystems(),
            scanForPrefabs(),
        ]);

        this.componentCache.clear();
        for (const component of components) {
            this.componentCache.set(component.name, component);
        }

        this.systemCache.clear();
        for (const system of systems) {
            this.systemCache.set(system.name, system);
        }

        this.prefabCache.clear();
        for (const prefab of prefabs) {
            this.prefabCache.set(prefab.name, prefab);
        }
    }

    /**
     * Checks if the context suggests this is a component reference
     */
    private isComponentContext(lineText: string): boolean {
        return (
            lineText.includes('all:') ||
            lineText.includes('any:') ||
            lineText.includes('none:') ||
            lineText.includes('addComponent') ||
            lineText.includes('getComponent') ||
            lineText.includes('hasComponent') ||
            lineText.includes('removeComponent') ||
            lineText.includes('type:') ||
            lineText.includes('setSingleton') ||
            lineText.includes('getSingleton')
        );
    }

    /**
     * Checks if the context suggests this is a system reference
     */
    private isSystemContext(lineText: string): boolean {
        return (
            lineText.includes('createSystem') ||
            lineText.includes('getSystem') ||
            lineText.includes('enableSystem') ||
            lineText.includes('disableSystem') ||
            lineText.includes('removeSystem')
        );
    }

    /**
     * Checks if the context suggests this is a prefab reference
     */
    private isPrefabContext(lineText: string): boolean {
        return lineText.includes('createFromPrefab') || lineText.includes('registerPrefab');
    }

    /**
     * Escapes special regex characters in a string
     */
    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Forces a cache refresh (useful for testing or manual refresh)
     */
    public async forceRefresh(): Promise<void> {
        await this.refreshCache();
        this.cacheTimestamp = Date.now();
    }
}
