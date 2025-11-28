import * as vscode from 'vscode';
import { type PrefabInfo, scanForPrefabs } from '../utils/ecsScanner';

export class EntitiesTreeProvider implements vscode.TreeDataProvider<EntityItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<EntityItem | undefined | null | void> =
        new vscode.EventEmitter<EntityItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<EntityItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private prefabs: PrefabInfo[] = [];

    constructor() {
        this.scanWorkspace();
    }

    refresh(): void {
        this.scanWorkspace();
        this._onDidChangeTreeData.fire();
    }

    private async scanWorkspace(): Promise<void> {
        this.prefabs = await scanForPrefabs();
    }

    getTreeItem(element: EntityItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: EntityItem): Promise<EntityItem[]> {
        if (element) {
            // Return prefab details
            const items: EntityItem[] = [];

            if (element.prefabInfo.components.length > 0) {
                for (const comp of element.prefabInfo.components) {
                    items.push(
                        new EntityItem(
                            comp,
                            vscode.TreeItemCollapsibleState.None,
                            element.prefabInfo,
                            'component'
                        )
                    );
                }
            }

            if (element.prefabInfo.tags.length > 0) {
                items.push(
                    new EntityItem(
                        `Tags: ${element.prefabInfo.tags.join(', ')}`,
                        vscode.TreeItemCollapsibleState.None,
                        element.prefabInfo,
                        'tags'
                    )
                );
            }

            return items;
        }

        // Return top-level prefabs
        if (this.prefabs.length === 0) {
            await this.scanWorkspace();
        }

        if (this.prefabs.length === 0) {
            return [
                new EntityItem(
                    'No prefabs found',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        name: '',
                        filePath: '',
                        line: 0,
                        components: [],
                        tags: [],
                    },
                    'empty'
                ),
            ];
        }

        return this.prefabs.map(
            (prefab) =>
                new EntityItem(
                    prefab.name,
                    prefab.components.length > 0 || prefab.tags.length > 0
                        ? vscode.TreeItemCollapsibleState.Collapsed
                        : vscode.TreeItemCollapsibleState.None,
                    prefab,
                    'prefab'
                )
        );
    }
}

export class EntityItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly prefabInfo: PrefabInfo,
        public readonly itemType: 'prefab' | 'component' | 'tags' | 'empty'
    ) {
        super(label, collapsibleState);

        switch (itemType) {
            case 'prefab':
                this.tooltip = `${prefabInfo.name}\n${prefabInfo.filePath}:${prefabInfo.line}`;
                this.description = `${prefabInfo.components.length} components`;
                this.iconPath = new vscode.ThemeIcon('package');
                this.contextValue = 'prefab';

                if (prefabInfo.filePath) {
                    this.command = {
                        command: 'vscode.open',
                        title: 'Open Prefab',
                        arguments: [
                            vscode.Uri.file(prefabInfo.filePath),
                            {
                                selection: new vscode.Range(
                                    prefabInfo.line - 1,
                                    0,
                                    prefabInfo.line - 1,
                                    0
                                ),
                            },
                        ],
                    };
                }
                break;

            case 'component':
                this.iconPath = new vscode.ThemeIcon('symbol-class');
                this.contextValue = 'prefabComponent';
                break;

            case 'tags':
                this.iconPath = new vscode.ThemeIcon('tag');
                this.contextValue = 'prefabTags';
                break;

            case 'empty':
                this.iconPath = new vscode.ThemeIcon('info');
                this.contextValue = 'empty';
                break;
        }
    }
}
