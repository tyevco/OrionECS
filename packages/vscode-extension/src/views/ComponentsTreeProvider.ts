import * as vscode from 'vscode';
import { type ComponentInfo, scanForComponents } from '../utils/ecsScanner';

export class ComponentsTreeProvider implements vscode.TreeDataProvider<ComponentItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ComponentItem | undefined | null | void> =
        new vscode.EventEmitter<ComponentItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ComponentItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private components: ComponentInfo[] = [];

    constructor() {
        this.scanWorkspace();
    }

    refresh(): void {
        this.scanWorkspace();
        this._onDidChangeTreeData.fire();
    }

    private async scanWorkspace(): Promise<void> {
        this.components = await scanForComponents();
    }

    getTreeItem(element: ComponentItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ComponentItem): Promise<ComponentItem[]> {
        if (element) {
            // Return component properties
            return element.componentInfo.properties.map(
                (prop) =>
                    new ComponentItem(
                        `${prop.name}: ${prop.type}`,
                        vscode.TreeItemCollapsibleState.None,
                        element.componentInfo,
                        'property'
                    )
            );
        }

        // Return top-level components
        if (this.components.length === 0) {
            await this.scanWorkspace();
        }

        return this.components.map(
            (comp) =>
                new ComponentItem(
                    comp.name,
                    comp.properties.length > 0
                        ? vscode.TreeItemCollapsibleState.Collapsed
                        : vscode.TreeItemCollapsibleState.None,
                    comp,
                    'component'
                )
        );
    }
}

export class ComponentItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly componentInfo: ComponentInfo,
        public readonly itemType: 'component' | 'property'
    ) {
        super(label, collapsibleState);

        if (itemType === 'component') {
            this.tooltip = `${componentInfo.name}\n${componentInfo.filePath}:${componentInfo.line}`;
            this.description = componentInfo.filePath.split('/').pop();
            this.iconPath = new vscode.ThemeIcon('symbol-class');
            this.contextValue = 'component';

            this.command = {
                command: 'vscode.open',
                title: 'Open Component',
                arguments: [
                    vscode.Uri.file(componentInfo.filePath),
                    {
                        selection: new vscode.Range(
                            componentInfo.line - 1,
                            0,
                            componentInfo.line - 1,
                            0
                        ),
                    },
                ],
            };
        } else {
            this.iconPath = new vscode.ThemeIcon('symbol-field');
            this.contextValue = 'property';
        }
    }
}
