import * as vscode from 'vscode';
import { DebugBridge } from '../debugging/debugBridge';
import type { EntitySnapshot, RuntimeMessage } from '../debugging/debugProtocol';

/**
 * Tree data provider for runtime entity hierarchy visualization.
 * Shows parent-child relationships between entities from a running OrionECS instance.
 */
export class EntityHierarchyTreeProvider implements vscode.TreeDataProvider<EntityHierarchyItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<
        EntityHierarchyItem | undefined | null | void
    >();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private entities: EntitySnapshot[] = [];
    private debugBridge: DebugBridge | null = null;
    private disposables: vscode.Disposable[] = [];
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
    }

    /**
     * Initialize connection to the debug bridge
     */
    initialize(): void {
        try {
            this.debugBridge = DebugBridge.getInstance(this.outputChannel);

            // Listen for entity updates
            this.disposables.push(
                this.debugBridge.onMessage((message: RuntimeMessage) => {
                    this.handleRuntimeMessage(message);
                })
            );

            // Listen for connection status changes
            this.disposables.push(
                this.debugBridge.onStatusChange((status) => {
                    if (status === 'connected') {
                        // Request initial snapshot
                        this.debugBridge?.send({ type: 'requestSnapshot' });
                    } else if (status === 'disconnected') {
                        this.entities = [];
                        this._onDidChangeTreeData.fire();
                    }
                })
            );

            // If already connected, get current entities
            if (this.debugBridge.status === 'connected') {
                this.entities = this.debugBridge.getEntities();
                this._onDidChangeTreeData.fire();
            }
        } catch {
            // DebugBridge not yet initialized, that's okay
        }
    }

    private handleRuntimeMessage(message: RuntimeMessage): void {
        switch (message.type) {
            case 'snapshot':
                this.entities = message.entities;
                this._onDidChangeTreeData.fire();
                break;

            case 'entityCreated':
            case 'entityDestroyed':
                // Request full snapshot to update
                this.debugBridge?.send({ type: 'requestSnapshot' });
                break;
        }
    }

    refresh(): void {
        if (this.debugBridge?.status === 'connected') {
            this.debugBridge.send({ type: 'requestSnapshot' });
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: EntityHierarchyItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: EntityHierarchyItem): Promise<EntityHierarchyItem[]> {
        if (!element) {
            // Return root entities (no parent)
            if (this.entities.length === 0) {
                return [
                    new EntityHierarchyItem(
                        {
                            id: '',
                            name: 'Connect to view entities',
                            tags: [],
                            parentId: null,
                            childIds: [],
                            components: [],
                        },
                        vscode.TreeItemCollapsibleState.None,
                        'empty'
                    ),
                ];
            }

            const rootEntities = this.entities.filter((e) => !e.parentId);
            return rootEntities.map(
                (entity) =>
                    new EntityHierarchyItem(
                        entity,
                        entity.childIds.length > 0
                            ? vscode.TreeItemCollapsibleState.Collapsed
                            : vscode.TreeItemCollapsibleState.None,
                        'entity'
                    )
            );
        }

        // Return children of the given entity
        const childEntities = this.entities.filter((e) => e.parentId === element.entity.id);
        return childEntities.map(
            (entity) =>
                new EntityHierarchyItem(
                    entity,
                    entity.childIds.length > 0
                        ? vscode.TreeItemCollapsibleState.Collapsed
                        : vscode.TreeItemCollapsibleState.None,
                    'entity'
                )
        );
    }

    /**
     * Get parent of an entity for reveal functionality
     */
    getParent(element: EntityHierarchyItem): EntityHierarchyItem | undefined {
        if (!element.entity.parentId) {
            return undefined;
        }

        const parent = this.entities.find((e) => e.id === element.entity.parentId);
        if (!parent) {
            return undefined;
        }

        return new EntityHierarchyItem(
            parent,
            parent.childIds.length > 0
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.None,
            'entity'
        );
    }

    dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}

export class EntityHierarchyItem extends vscode.TreeItem {
    constructor(
        public readonly entity: EntitySnapshot,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'entity' | 'empty'
    ) {
        super(entity.name || entity.id, collapsibleState);

        if (itemType === 'empty') {
            this.iconPath = new vscode.ThemeIcon('info');
            this.contextValue = 'empty';
            return;
        }

        // Build description with component count and tags
        const componentCount = entity.components.length;
        const tagText = entity.tags.length > 0 ? ` | ${entity.tags.slice(0, 3).join(', ')}` : '';
        this.description = `${componentCount} components${tagText}${entity.tags.length > 3 ? '...' : ''}`;

        // Build detailed tooltip
        const tooltipLines = [
            `**${entity.name}**`,
            `ID: \`${entity.id}\``,
            '',
            `**Components (${componentCount}):**`,
            ...entity.components.map((c) => `- ${c.name}${c.isTag ? ' (tag)' : ''}`),
        ];

        if (entity.tags.length > 0) {
            tooltipLines.push('', `**Tags:** ${entity.tags.join(', ')}`);
        }

        if (entity.childIds.length > 0) {
            tooltipLines.push('', `**Children:** ${entity.childIds.length}`);
        }

        this.tooltip = new vscode.MarkdownString(tooltipLines.join('\n'));

        // Set icon based on entity characteristics
        if (entity.childIds.length > 0) {
            this.iconPath = new vscode.ThemeIcon('symbol-namespace');
        } else if (entity.parentId) {
            this.iconPath = new vscode.ThemeIcon('symbol-field');
        } else {
            this.iconPath = new vscode.ThemeIcon('symbol-class');
        }

        this.contextValue = 'runtimeEntity';

        // Command to select entity in inspector
        this.command = {
            command: 'orion-ecs.selectEntityInHierarchy',
            title: 'Select Entity',
            arguments: [entity.id],
        };
    }
}
