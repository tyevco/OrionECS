import * as vscode from 'vscode';
import { DebugBridge } from '../debugging/debugBridge';
import type {
    ExtensionToWebviewMessage,
    RuntimeMessage,
    WebviewMessage,
} from '../debugging/debugProtocol';

/**
 * Manages the Entity Inspector webview panel
 */
export class EntityInspectorPanel {
    public static currentPanel: EntityInspectorPanel | undefined;
    private static readonly viewType = 'orionEntityInspector';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private readonly debugBridge: DebugBridge;
    private readonly outputChannel: vscode.OutputChannel;
    private disposables: vscode.Disposable[] = [];
    private selectedEntityId: string | null = null;

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        outputChannel: vscode.OutputChannel
    ) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.outputChannel = outputChannel;
        this.debugBridge = DebugBridge.getInstance(outputChannel);

        // Set the webview's initial html content
        this.panel.webview.html = this.getHtmlContent();

        // Listen for when the panel is disposed
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            (message: WebviewMessage) => this.handleWebviewMessage(message),
            null,
            this.disposables
        );

        // Listen for debug bridge messages
        this.debugBridge.onMessage(
            (message: RuntimeMessage) => this.handleRuntimeMessage(message),
            null,
            this.disposables
        );

        // Listen for connection status changes
        this.debugBridge.onStatusChange(
            (status) => {
                this.postMessage({
                    type: 'connectionStatus',
                    status,
                });
            },
            null,
            this.disposables
        );
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        outputChannel: vscode.OutputChannel
    ): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (EntityInspectorPanel.currentPanel) {
            EntityInspectorPanel.currentPanel.panel.reveal(column);
            return;
        }

        // Create a new panel
        const panel = vscode.window.createWebviewPanel(
            EntityInspectorPanel.viewType,
            'Entity Inspector',
            column || vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
            }
        );

        EntityInspectorPanel.currentPanel = new EntityInspectorPanel(
            panel,
            extensionUri,
            outputChannel
        );
        outputChannel.appendLine('Entity Inspector panel created');
    }

    private postMessage(message: ExtensionToWebviewMessage): void {
        this.panel.webview.postMessage(message);
    }

    private handleWebviewMessage(message: WebviewMessage): void {
        switch (message.type) {
            case 'selectEntity':
                this.selectedEntityId = message.entityId;
                this.debugBridge.send({ type: 'requestEntityDetails', entityId: message.entityId });
                break;

            case 'refreshEntities':
                this.debugBridge.send({ type: 'requestSnapshot' });
                break;

            case 'modifyProperty':
                this.debugBridge.send({
                    type: 'modifyComponent',
                    entityId: message.entityId,
                    componentName: message.componentName,
                    property: message.property,
                    value: message.value,
                });
                break;

            case 'connect':
                this.debugBridge.connect(message.port);
                break;

            case 'disconnect':
                this.debugBridge.disconnect();
                break;

            case 'startDemoMode':
                this.debugBridge.startDemoMode();
                this.postMessage({ type: 'demoModeActive', active: true });
                break;

            case 'stopDemoMode':
                this.debugBridge.stopDemoMode();
                this.postMessage({ type: 'demoModeActive', active: false });
                break;
        }
    }

    private handleRuntimeMessage(message: RuntimeMessage): void {
        switch (message.type) {
            case 'snapshot':
                this.postMessage({
                    type: 'entitiesUpdated',
                    entities: message.entities,
                });
                break;

            case 'entityDetails':
                this.postMessage({
                    type: 'entitySelected',
                    entity: message.entity,
                });
                break;

            case 'entityCreated':
                // Request full snapshot to update list
                this.debugBridge.send({ type: 'requestSnapshot' });
                break;

            case 'entityDestroyed':
                // Request full snapshot to update list
                this.debugBridge.send({ type: 'requestSnapshot' });
                if (this.selectedEntityId === message.entityId) {
                    this.selectedEntityId = null;
                    this.postMessage({ type: 'entitySelected', entity: null });
                }
                break;

            case 'componentModified':
                if (message.success && this.selectedEntityId === message.entityId) {
                    // Refresh the selected entity
                    this.debugBridge.send({
                        type: 'requestEntityDetails',
                        entityId: this.selectedEntityId,
                    });
                }
                break;

            case 'error':
                this.postMessage({ type: 'error', message: message.message });
                break;
        }
    }

    private getHtmlContent(): string {
        const nonce = this.getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Entity Inspector</title>
    <style>
        :root {
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-sideBar-background);
            --bg-hover: var(--vscode-list-hoverBackground);
            --bg-selected: var(--vscode-list-activeSelectionBackground);
            --text-primary: var(--vscode-foreground);
            --text-secondary: var(--vscode-descriptionForeground);
            --text-selected: var(--vscode-list-activeSelectionForeground);
            --border: var(--vscode-panel-border);
            --accent: var(--vscode-focusBorder);
            --success: var(--vscode-testing-iconPassed);
            --warning: var(--vscode-editorWarning-foreground);
            --error: var(--vscode-errorForeground);
            --input-bg: var(--vscode-input-background);
            --input-border: var(--vscode-input-border);
            --button-bg: var(--vscode-button-background);
            --button-fg: var(--vscode-button-foreground);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--text-primary);
            background-color: var(--bg-primary);
            height: 100vh;
            overflow: hidden;
        }

        .container {
            display: grid;
            grid-template-columns: 280px 1fr;
            grid-template-rows: auto 1fr;
            height: 100vh;
            gap: 1px;
            background-color: var(--border);
        }

        .toolbar {
            grid-column: 1 / -1;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background-color: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
        }

        .toolbar-title {
            font-weight: 600;
            margin-right: auto;
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--error);
        }

        .status-dot.connected {
            background-color: var(--success);
        }

        .status-dot.connecting {
            background-color: var(--warning);
            animation: pulse 1s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        button {
            padding: 4px 12px;
            background-color: var(--button-bg);
            color: var(--button-fg);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }

        button:hover {
            opacity: 0.9;
        }

        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        button.secondary {
            background-color: transparent;
            color: var(--text-primary);
            border: 1px solid var(--border);
        }

        .entity-list-panel {
            background-color: var(--bg-secondary);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .panel-header {
            padding: 8px 12px;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .search-box {
            padding: 8px;
            border-bottom: 1px solid var(--border);
        }

        .search-box input {
            width: 100%;
            padding: 6px 8px;
            background-color: var(--input-bg);
            border: 1px solid var(--input-border);
            color: var(--text-primary);
            border-radius: 2px;
            font-size: 12px;
        }

        .search-box input:focus {
            outline: none;
            border-color: var(--accent);
        }

        .entity-list {
            flex: 1;
            overflow-y: auto;
            padding: 4px 0;
        }

        .entity-item {
            display: flex;
            align-items: center;
            padding: 4px 12px;
            cursor: pointer;
            gap: 8px;
        }

        .entity-item:hover {
            background-color: var(--bg-hover);
        }

        .entity-item.selected {
            background-color: var(--bg-selected);
            color: var(--text-selected);
        }

        .entity-item.child {
            padding-left: 28px;
        }

        .entity-item.grandchild {
            padding-left: 44px;
        }

        .entity-icon {
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }

        .expand-icon {
            width: 16px;
            text-align: center;
            font-size: 10px;
            color: var(--text-secondary);
        }

        .entity-name {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .entity-count {
            font-size: 11px;
            color: var(--text-secondary);
            padding: 2px 6px;
            background-color: var(--bg-primary);
            border-radius: 10px;
        }

        .inspector-panel {
            background-color: var(--bg-primary);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .inspector-content {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
        }

        .no-selection {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-secondary);
            text-align: center;
            padding: 24px;
        }

        .no-selection-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }

        .entity-header {
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border);
        }

        .entity-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .entity-id {
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }

        .entity-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }

        .tag {
            padding: 2px 8px;
            background-color: var(--bg-secondary);
            border-radius: 10px;
            font-size: 11px;
            color: var(--text-secondary);
        }

        .section {
            margin-bottom: 16px;
        }

        .section-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 0;
            cursor: pointer;
            user-select: none;
        }

        .section-header:hover {
            color: var(--accent);
        }

        .section-title {
            font-weight: 600;
            font-size: 13px;
        }

        .section-toggle {
            font-size: 10px;
            color: var(--text-secondary);
        }

        .component-card {
            background-color: var(--bg-secondary);
            border-radius: 4px;
            margin-bottom: 8px;
            overflow: hidden;
        }

        .component-header {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            cursor: pointer;
            gap: 8px;
        }

        .component-header:hover {
            background-color: var(--bg-hover);
        }

        .component-icon {
            font-size: 14px;
        }

        .component-name {
            font-weight: 500;
            flex: 1;
        }

        .component-tag-badge {
            font-size: 10px;
            padding: 2px 6px;
            background-color: var(--accent);
            color: var(--button-fg);
            border-radius: 2px;
        }

        .component-body {
            padding: 8px 12px;
            border-top: 1px solid var(--border);
        }

        .property-row {
            display: flex;
            align-items: center;
            padding: 4px 0;
            gap: 8px;
        }

        .property-name {
            flex: 0 0 120px;
            font-size: 12px;
            color: var(--text-secondary);
        }

        .property-value {
            flex: 1;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }

        .property-input {
            width: 100%;
            padding: 4px 8px;
            background-color: var(--input-bg);
            border: 1px solid var(--input-border);
            color: var(--text-primary);
            border-radius: 2px;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }

        .property-input:focus {
            outline: none;
            border-color: var(--accent);
        }

        .property-input.number {
            width: 80px;
        }

        .hierarchy-section {
            padding: 8px 0;
        }

        .hierarchy-item {
            display: flex;
            align-items: center;
            padding: 4px 8px;
            gap: 8px;
            cursor: pointer;
            border-radius: 2px;
        }

        .hierarchy-item:hover {
            background-color: var(--bg-hover);
        }

        .hierarchy-label {
            font-size: 11px;
            color: var(--text-secondary);
            width: 60px;
        }

        .connection-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100;
        }

        .connection-dialog {
            background-color: var(--bg-secondary);
            padding: 24px;
            border-radius: 8px;
            max-width: 400px;
            width: 90%;
        }

        .connection-dialog h2 {
            margin-bottom: 16px;
        }

        .connection-dialog p {
            color: var(--text-secondary);
            margin-bottom: 16px;
            line-height: 1.5;
        }

        .connection-dialog .button-row {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 16px;
        }

        .hidden {
            display: none !important;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="toolbar">
            <span class="toolbar-title">Entity Inspector</span>
            <div class="status-indicator">
                <span class="status-dot" id="statusDot"></span>
                <span id="statusText">Disconnected</span>
            </div>
            <button id="connectBtn">Connect</button>
            <button id="refreshBtn" class="secondary" disabled>Refresh</button>
        </div>

        <div class="entity-list-panel">
            <div class="panel-header">
                Entities
                <span class="entity-count" id="entityCount">0</span>
            </div>
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Search entities...">
            </div>
            <div class="entity-list" id="entityList">
                <div class="no-selection">
                    <div>Connect to view entities</div>
                </div>
            </div>
        </div>

        <div class="inspector-panel">
            <div class="panel-header">Inspector</div>
            <div class="inspector-content" id="inspectorContent">
                <div class="no-selection">
                    <div class="no-selection-icon">&#128269;</div>
                    <div>Select an entity to inspect</div>
                </div>
            </div>
        </div>
    </div>

    <div class="connection-overlay hidden" id="connectionOverlay">
        <div class="connection-dialog">
            <h2>Connect to OrionECS</h2>
            <p>
                The Entity Inspector requires a connection to a running OrionECS application
                with the debug server enabled.
            </p>
            <p>
                For testing, you can use <strong>Demo Mode</strong> to explore the inspector
                with simulated data.
            </p>
            <div class="button-row">
                <button class="secondary" id="cancelConnectBtn">Cancel</button>
                <button id="demoModeBtn">Start Demo Mode</button>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        // State
        let entities = [];
        let selectedEntityId = null;
        let expandedEntities = new Set();
        let connectionStatus = 'disconnected';
        let searchTerm = '';

        // Elements
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const connectBtn = document.getElementById('connectBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const entityList = document.getElementById('entityList');
        const entityCount = document.getElementById('entityCount');
        const inspectorContent = document.getElementById('inspectorContent');
        const searchInput = document.getElementById('searchInput');
        const connectionOverlay = document.getElementById('connectionOverlay');
        const cancelConnectBtn = document.getElementById('cancelConnectBtn');
        const demoModeBtn = document.getElementById('demoModeBtn');

        // Event listeners
        connectBtn.addEventListener('click', () => {
            connectionOverlay.classList.remove('hidden');
        });

        cancelConnectBtn.addEventListener('click', () => {
            connectionOverlay.classList.add('hidden');
        });

        demoModeBtn.addEventListener('click', () => {
            connectionOverlay.classList.add('hidden');
            vscode.postMessage({ type: 'startDemoMode' });
        });

        refreshBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'refreshEntities' });
        });

        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value.toLowerCase();
            renderEntityList();
        });

        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;

            switch (message.type) {
                case 'connectionStatus':
                    updateConnectionStatus(message.status);
                    break;

                case 'entitiesUpdated':
                    entities = message.entities;
                    entityCount.textContent = entities.length;
                    renderEntityList();
                    break;

                case 'entitySelected':
                    if (message.entity) {
                        selectedEntityId = message.entity.id;
                        renderInspector(message.entity);
                    } else {
                        selectedEntityId = null;
                        renderNoSelection();
                    }
                    break;

                case 'demoModeActive':
                    if (message.active) {
                        updateConnectionStatus('connected');
                    }
                    break;

                case 'error':
                    console.error('Error:', message.message);
                    break;
            }
        });

        function updateConnectionStatus(status) {
            connectionStatus = status;
            statusDot.className = 'status-dot ' + status;

            const statusLabels = {
                'disconnected': 'Disconnected',
                'connecting': 'Connecting...',
                'connected': 'Connected',
                'error': 'Error'
            };

            statusText.textContent = statusLabels[status] || status;
            connectBtn.textContent = status === 'connected' ? 'Disconnect' : 'Connect';
            refreshBtn.disabled = status !== 'connected';

            if (status === 'connected') {
                connectBtn.onclick = () => {
                    vscode.postMessage({ type: 'disconnect' });
                };
            } else {
                connectBtn.onclick = () => {
                    connectionOverlay.classList.remove('hidden');
                };
            }
        }

        function renderEntityList() {
            if (entities.length === 0) {
                entityList.innerHTML = '<div class="no-selection">No entities found</div>';
                return;
            }

            // Build hierarchy
            const rootEntities = entities.filter(e => !e.parentId);
            let html = '';

            function renderEntity(entity, level = 0) {
                // Filter by search
                if (searchTerm && !entity.name.toLowerCase().includes(searchTerm) &&
                    !entity.tags.some(t => t.toLowerCase().includes(searchTerm))) {
                    return '';
                }

                const levelClass = level === 1 ? 'child' : level >= 2 ? 'grandchild' : '';
                const selected = entity.id === selectedEntityId ? 'selected' : '';
                const hasChildren = entity.childIds && entity.childIds.length > 0;
                const isExpanded = expandedEntities.has(entity.id);

                let itemHtml = \`
                    <div class="entity-item \${levelClass} \${selected}" data-id="\${entity.id}">
                        <span class="expand-icon" data-expand="\${entity.id}">
                            \${hasChildren ? (isExpanded ? '&#9660;' : '&#9654;') : ''}
                        </span>
                        <span class="entity-icon">&#128230;</span>
                        <span class="entity-name">\${entity.name}</span>
                    </div>
                \`;

                // Render children if expanded
                if (hasChildren && isExpanded) {
                    const children = entities.filter(e => e.parentId === entity.id);
                    children.forEach(child => {
                        itemHtml += renderEntity(child, level + 1);
                    });
                }

                return itemHtml;
            }

            rootEntities.forEach(entity => {
                html += renderEntity(entity);
            });

            entityList.innerHTML = html || '<div class="no-selection">No matching entities</div>';

            // Add click handlers
            entityList.querySelectorAll('.entity-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const id = item.dataset.id;

                    // Check if clicking expand icon
                    if (e.target.dataset.expand) {
                        if (expandedEntities.has(id)) {
                            expandedEntities.delete(id);
                        } else {
                            expandedEntities.add(id);
                        }
                        renderEntityList();
                        return;
                    }

                    selectedEntityId = id;
                    vscode.postMessage({ type: 'selectEntity', entityId: id });
                    renderEntityList();
                });
            });
        }

        function renderNoSelection() {
            inspectorContent.innerHTML = \`
                <div class="no-selection">
                    <div class="no-selection-icon">&#128269;</div>
                    <div>Select an entity to inspect</div>
                </div>
            \`;
        }

        function renderInspector(entity) {
            const tagsHtml = entity.tags.map(tag =>
                \`<span class="tag">\${tag}</span>\`
            ).join('');

            const componentsHtml = entity.components.map(comp => \`
                <div class="component-card">
                    <div class="component-header">
                        <span class="component-icon">\${comp.isTag ? '&#127991;' : '&#128230;'}</span>
                        <span class="component-name">\${comp.name}</span>
                        \${comp.isTag ? '<span class="component-tag-badge">Tag</span>' : ''}
                    </div>
                    \${!comp.isTag ? \`
                        <div class="component-body">
                            \${renderProperties(entity.id, comp.name, comp.properties)}
                        </div>
                    \` : ''}
                </div>
            \`).join('');

            // Hierarchy section
            let hierarchyHtml = '';
            if (entity.parentId) {
                const parent = entities.find(e => e.id === entity.parentId);
                if (parent) {
                    hierarchyHtml += \`
                        <div class="hierarchy-item" data-id="\${parent.id}">
                            <span class="hierarchy-label">Parent:</span>
                            <span class="entity-icon">&#128230;</span>
                            <span>\${parent.name}</span>
                        </div>
                    \`;
                }
            }

            if (entity.childIds && entity.childIds.length > 0) {
                entity.childIds.forEach(childId => {
                    const child = entities.find(e => e.id === childId);
                    if (child) {
                        hierarchyHtml += \`
                            <div class="hierarchy-item" data-id="\${child.id}">
                                <span class="hierarchy-label">Child:</span>
                                <span class="entity-icon">&#128230;</span>
                                <span>\${child.name}</span>
                            </div>
                        \`;
                    }
                });
            }

            inspectorContent.innerHTML = \`
                <div class="entity-header">
                    <div class="entity-title">\${entity.name}</div>
                    <div class="entity-id">ID: \${entity.id}</div>
                    <div class="entity-tags">\${tagsHtml || '<span class="tag">No tags</span>'}</div>
                </div>

                \${hierarchyHtml ? \`
                    <div class="section">
                        <div class="section-header">
                            <span class="section-title">Hierarchy</span>
                        </div>
                        <div class="hierarchy-section">
                            \${hierarchyHtml}
                        </div>
                    </div>
                \` : ''}

                <div class="section">
                    <div class="section-header">
                        <span class="section-title">Components (\${entity.components.length})</span>
                    </div>
                    \${componentsHtml}
                </div>
            \`;

            // Add click handlers for hierarchy items
            inspectorContent.querySelectorAll('.hierarchy-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    selectedEntityId = id;
                    vscode.postMessage({ type: 'selectEntity', entityId: id });
                    renderEntityList();
                });
            });
        }

        function renderProperties(entityId, componentName, properties) {
            return Object.entries(properties).map(([key, value]) => {
                const inputType = typeof value === 'number' ? 'number' : 'text';
                const inputClass = typeof value === 'number' ? 'number' : '';

                return \`
                    <div class="property-row">
                        <span class="property-name">\${key}</span>
                        <input
                            type="\${inputType}"
                            class="property-input \${inputClass}"
                            value="\${value}"
                            data-entity="\${entityId}"
                            data-component="\${componentName}"
                            data-property="\${key}"
                        >
                    </div>
                \`;
            }).join('');
        }

        // Handle property changes
        inspectorContent.addEventListener('change', (e) => {
            if (e.target.classList.contains('property-input')) {
                const entityId = e.target.dataset.entity;
                const componentName = e.target.dataset.component;
                const property = e.target.dataset.property;
                let value = e.target.value;

                // Convert to number if needed
                if (e.target.type === 'number') {
                    value = parseFloat(value);
                }

                vscode.postMessage({
                    type: 'modifyProperty',
                    entityId,
                    componentName,
                    property,
                    value
                });
            }
        });
    </script>
</body>
</html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    public dispose(): void {
        EntityInspectorPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
