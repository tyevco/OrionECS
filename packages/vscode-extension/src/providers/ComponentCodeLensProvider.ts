import * as vscode from 'vscode';

/**
 * Provides CodeLens for component classes showing usage information
 */
export class ComponentCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    private componentUsageCache: Map<string, { systemCount: number; entityCount: number }> =
        new Map();

    constructor() {
        // Refresh CodeLenses when documents change
        vscode.workspace.onDidChangeTextDocument(() => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    async provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
        const config = vscode.workspace.getConfiguration('orion-ecs');
        if (!config.get('enableCodeLens', true)) {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Find component class definitions
            const classMatch = line.match(/^(?:export\s+)?class\s+(\w+)/);
            if (classMatch && this.isLikelyComponent(classMatch[1])) {
                const range = new vscode.Range(i, 0, i, line.length);
                const componentName = classMatch[1];

                // Get usage info (async, but we'll use cached values)
                const usage = await this.getComponentUsage(componentName);

                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `$(symbol-class) ${usage.systemCount} systems | $(pulse) ${usage.entityCount} prefabs`,
                        command: 'orion-ecs.findComponentReferences',
                        arguments: [componentName],
                        tooltip: `Click to find all references to ${componentName}`,
                    })
                );
            }

            // Find system definitions
            if (line.includes('.createSystem')) {
                const systemMatch = line.match(/\.createSystem\s*\(\s*['"`](\w+)['"`]/);
                if (systemMatch) {
                    const range = new vscode.Range(i, 0, i, line.length);
                    const systemName = systemMatch[1];

                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: '$(symbol-method) System',
                            command: 'orion-ecs.showSystemInfo',
                            arguments: [systemName],
                            tooltip: `View details for ${systemName}`,
                        })
                    );
                }
            }

            // Find prefab definitions
            if (line.includes('.registerPrefab')) {
                const prefabMatch = line.match(/\.registerPrefab\s*\(\s*['"`](\w+)['"`]/);
                if (prefabMatch) {
                    const range = new vscode.Range(i, 0, i, line.length);
                    const prefabName = prefabMatch[1];

                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: '$(package) Prefab',
                            command: 'orion-ecs.showPrefabInfo',
                            arguments: [prefabName],
                            tooltip: `View details for ${prefabName}`,
                        })
                    );
                }
            }
        }

        return codeLenses;
    }

    resolveCodeLens(codeLens: vscode.CodeLens, _token: vscode.CancellationToken): vscode.CodeLens {
        return codeLens;
    }

    /**
     * Gets the usage count for a component across systems and prefabs
     */
    private async getComponentUsage(
        componentName: string
    ): Promise<{ systemCount: number; entityCount: number }> {
        // Check cache first
        const cached = this.componentUsageCache.get(componentName);
        if (cached) {
            return cached;
        }

        let systemCount = 0;
        let entityCount = 0;

        try {
            const files = await vscode.workspace.findFiles('**/*.{ts,js}', '**/node_modules/**');

            for (const file of files) {
                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const text = document.getText();

                    // Count systems using this component
                    const systemMatches = text.match(
                        new RegExp(
                            `\\.createSystem\\s*\\([^)]*all\\s*:\\s*\\[[^\\]]*${componentName}[^\\]]*\\]`,
                            'g'
                        )
                    );
                    if (systemMatches) {
                        systemCount += systemMatches.length;
                    }

                    // Count prefabs using this component
                    const prefabMatches = text.match(
                        new RegExp(`type\\s*:\\s*${componentName}`, 'g')
                    );
                    if (prefabMatches) {
                        entityCount += prefabMatches.length;
                    }
                } catch {
                    // Skip unreadable files
                }
            }
        } catch {
            // Return zeros on error
        }

        const result = { systemCount, entityCount };
        this.componentUsageCache.set(componentName, result);

        // Clear cache after 30 seconds
        setTimeout(() => {
            this.componentUsageCache.delete(componentName);
        }, 30000);

        return result;
    }

    /**
     * Determines if a class name is likely a component
     */
    private isLikelyComponent(className: string): boolean {
        const nonComponentPatterns = [
            /System$/,
            /Manager$/,
            /Service$/,
            /Controller$/,
            /Provider$/,
            /Factory$/,
            /Builder$/,
            /Handler$/,
            /Plugin$/,
            /Engine$/,
            /Query$/,
        ];

        for (const pattern of nonComponentPatterns) {
            if (pattern.test(className)) {
                return false;
            }
        }

        return true;
    }
}
