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
 * Provides Go to Definition support for ECS elements:
 * - Component classes
 * - System definitions
 * - Entity prefabs
 */
export class ECSDefinitionProvider implements vscode.DefinitionProvider {
    private componentCache: Map<string, ComponentInfo> = new Map();
    private systemCache: Map<string, SystemInfo> = new Map();
    private prefabCache: Map<string, PrefabInfo> = new Map();
    private cacheTimestamp = 0;
    private readonly cacheTimeout = 30000; // 30 seconds

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Definition | vscode.LocationLink[] | undefined> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        const lineText = document.lineAt(position).text;

        // Refresh cache if stale
        await this.ensureCacheFresh();

        // Try to find component definition
        const componentDef = await this.findComponentDefinition(word, lineText);
        if (componentDef) {
            return componentDef;
        }

        // Try to find system definition
        const systemDef = await this.findSystemDefinition(word, lineText);
        if (systemDef) {
            return systemDef;
        }

        // Try to find prefab definition
        const prefabDef = await this.findPrefabDefinition(word, lineText);
        if (prefabDef) {
            return prefabDef;
        }

        return undefined;
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
     * Finds a component class definition
     */
    private async findComponentDefinition(
        word: string,
        lineText: string
    ): Promise<vscode.Location | undefined> {
        // Check if this looks like a component reference
        if (!this.isComponentContext(lineText, word)) {
            return undefined;
        }

        const component = this.componentCache.get(word);
        if (component) {
            const uri = vscode.Uri.file(component.filePath);
            const position = new vscode.Position(component.line - 1, 0);
            return new vscode.Location(uri, position);
        }

        return undefined;
    }

    /**
     * Finds a system definition
     */
    private async findSystemDefinition(
        word: string,
        lineText: string
    ): Promise<vscode.Location | undefined> {
        // Check if this looks like a system reference
        if (!this.isSystemContext(lineText)) {
            return undefined;
        }

        const system = this.systemCache.get(word);
        if (system) {
            const uri = vscode.Uri.file(system.filePath);
            const position = new vscode.Position(system.line - 1, 0);
            return new vscode.Location(uri, position);
        }

        return undefined;
    }

    /**
     * Finds a prefab definition
     */
    private async findPrefabDefinition(
        word: string,
        lineText: string
    ): Promise<vscode.Location | undefined> {
        // Check if this looks like a prefab reference
        if (!this.isPrefabContext(lineText)) {
            return undefined;
        }

        const prefab = this.prefabCache.get(word);
        if (prefab) {
            const uri = vscode.Uri.file(prefab.filePath);
            const position = new vscode.Position(prefab.line - 1, 0);
            return new vscode.Location(uri, position);
        }

        return undefined;
    }

    /**
     * Checks if the context suggests this is a component reference
     */
    private isComponentContext(lineText: string, word: string): boolean {
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

        // Check if word is in component cache (could be a direct reference)
        if (this.componentCache.has(word)) {
            return true;
        }

        return false;
    }

    /**
     * Checks if the context suggests this is a system reference
     */
    private isSystemContext(lineText: string): boolean {
        // System name in string (getSystem, enableSystem, disableSystem, etc.)
        return (
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
     * Forces a cache refresh (useful for testing or manual refresh)
     */
    public async forceRefresh(): Promise<void> {
        await this.refreshCache();
        this.cacheTimestamp = Date.now();
    }

    /**
     * Gets cached components (for use by other providers)
     */
    public getComponentCache(): Map<string, ComponentInfo> {
        return this.componentCache;
    }

    /**
     * Gets cached systems (for use by other providers)
     */
    public getSystemCache(): Map<string, SystemInfo> {
        return this.systemCache;
    }

    /**
     * Gets cached prefabs (for use by other providers)
     */
    public getPrefabCache(): Map<string, PrefabInfo> {
        return this.prefabCache;
    }
}
