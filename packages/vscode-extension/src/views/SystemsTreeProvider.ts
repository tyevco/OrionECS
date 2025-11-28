import * as vscode from 'vscode';
import { type SystemInfo, scanForSystems } from '../utils/ecsScanner';

export class SystemsTreeProvider implements vscode.TreeDataProvider<SystemItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SystemItem | undefined | null | void> =
        new vscode.EventEmitter<SystemItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SystemItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private systems: SystemInfo[] = [];

    constructor() {
        this.scanWorkspace();
    }

    refresh(): void {
        this.scanWorkspace();
        this._onDidChangeTreeData.fire();
    }

    private async scanWorkspace(): Promise<void> {
        this.systems = await scanForSystems();
    }

    getTreeItem(element: SystemItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SystemItem): Promise<SystemItem[]> {
        if (element) {
            // Return system details
            const items: SystemItem[] = [];

            if (element.systemInfo.queryComponents.length > 0) {
                items.push(
                    new SystemItem(
                        `Query: ${element.systemInfo.queryComponents.join(', ')}`,
                        vscode.TreeItemCollapsibleState.None,
                        element.systemInfo,
                        'query'
                    )
                );
            }

            if (element.systemInfo.priority !== undefined) {
                items.push(
                    new SystemItem(
                        `Priority: ${element.systemInfo.priority}`,
                        vscode.TreeItemCollapsibleState.None,
                        element.systemInfo,
                        'priority'
                    )
                );
            }

            if (element.systemInfo.isFixedUpdate) {
                items.push(
                    new SystemItem(
                        'Type: Fixed Update',
                        vscode.TreeItemCollapsibleState.None,
                        element.systemInfo,
                        'type'
                    )
                );
            }

            return items;
        }

        // Return top-level systems
        if (this.systems.length === 0) {
            await this.scanWorkspace();
        }

        // Sort by priority (higher first)
        const sortedSystems = this.systems.toSorted(
            (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
        );

        return sortedSystems.map(
            (sys) =>
                new SystemItem(sys.name, vscode.TreeItemCollapsibleState.Collapsed, sys, 'system')
        );
    }
}

export class SystemItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly systemInfo: SystemInfo,
        public readonly itemType: 'system' | 'query' | 'priority' | 'type'
    ) {
        super(label, collapsibleState);

        if (itemType === 'system') {
            this.tooltip = `${systemInfo.name}\n${systemInfo.filePath}:${systemInfo.line}`;
            this.description = systemInfo.isFixedUpdate ? 'fixed' : 'variable';
            this.iconPath = new vscode.ThemeIcon('symbol-method');
            this.contextValue = 'system';

            this.command = {
                command: 'vscode.open',
                title: 'Open System',
                arguments: [
                    vscode.Uri.file(systemInfo.filePath),
                    {
                        selection: new vscode.Range(systemInfo.line - 1, 0, systemInfo.line - 1, 0),
                    },
                ],
            };
        } else if (itemType === 'query') {
            this.iconPath = new vscode.ThemeIcon('filter');
        } else if (itemType === 'priority') {
            this.iconPath = new vscode.ThemeIcon('arrow-up');
        } else {
            this.iconPath = new vscode.ThemeIcon('clock');
        }
    }
}
