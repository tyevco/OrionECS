import * as vscode from 'vscode';
import { DebugBridge } from '../debugging/debugBridge';
import type {
    ExtensionToWebviewMessage,
    RuntimeMessage,
    WebviewMessage,
} from '../debugging/debugProtocol';

/**
 * Manages the Archetype Visualizer webview panel.
 * Displays archetype composition, entity counts, and performance metrics.
 */
export class ArchetypeVisualizerPanel {
    public static currentPanel: ArchetypeVisualizerPanel | undefined;
    private static readonly viewType = 'orionArchetypeVisualizer';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private readonly debugBridge: DebugBridge;
    private readonly outputChannel: vscode.OutputChannel;
    private disposables: vscode.Disposable[] = [];
    private selectedArchetypeId: string | null = null;

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
        if (ArchetypeVisualizerPanel.currentPanel) {
            ArchetypeVisualizerPanel.currentPanel.panel.reveal(column);
            return;
        }

        // Create a new panel
        const panel = vscode.window.createWebviewPanel(
            ArchetypeVisualizerPanel.viewType,
            'Archetype Visualizer',
            column || vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
            }
        );

        ArchetypeVisualizerPanel.currentPanel = new ArchetypeVisualizerPanel(
            panel,
            extensionUri,
            outputChannel
        );
        outputChannel.appendLine('Archetype Visualizer panel created');
    }

    private postMessage(message: ExtensionToWebviewMessage): void {
        this.panel.webview.postMessage(message);
    }

    private handleWebviewMessage(message: WebviewMessage): void {
        switch (message.type) {
            case 'refreshArchetypes':
                this.debugBridge.send({ type: 'requestArchetypes' });
                this.debugBridge.send({ type: 'requestPerformanceMetrics' });
                break;

            case 'selectArchetype':
                this.selectedArchetypeId = message.archetypeId;
                // Find the archetype and send details
                const archetypes = this.debugBridge.getArchetypes();
                const selected = archetypes.find((a) => a.id === message.archetypeId);
                this.postMessage({
                    type: 'archetypeSelected',
                    archetype: selected || null,
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
                // Send initial archetype data
                setTimeout(() => {
                    this.postMessage({
                        type: 'archetypesUpdated',
                        archetypes: this.debugBridge.getArchetypes(),
                    });
                }, 100);
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
                // Request archetypes when we get a snapshot
                this.debugBridge.send({ type: 'requestArchetypes' });
                break;

            case 'archetypeList':
                this.postMessage({
                    type: 'archetypesUpdated',
                    archetypes: message.archetypes,
                });
                break;

            case 'performanceMetrics':
                this.postMessage({
                    type: 'performanceUpdated',
                    metrics: message.metrics,
                });
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
    <title>Archetype Visualizer</title>
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
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        .toolbar {
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

        .content {
            flex: 1;
            display: grid;
            grid-template-columns: 1fr 350px;
            gap: 1px;
            background-color: var(--border);
            overflow: hidden;
        }

        .archetypes-panel {
            background-color: var(--bg-primary);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .details-panel {
            background-color: var(--bg-secondary);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .panel-header {
            padding: 12px 16px;
            font-weight: 600;
            font-size: 13px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .panel-content {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
        }

        .sort-controls {
            display: flex;
            gap: 4px;
        }

        .sort-btn {
            padding: 2px 8px;
            font-size: 11px;
            background-color: transparent;
            border: 1px solid var(--border);
            color: var(--text-secondary);
        }

        .sort-btn.active {
            background-color: var(--accent);
            border-color: var(--accent);
            color: var(--button-fg);
        }

        .archetype-card {
            background-color: var(--bg-secondary);
            border-radius: 6px;
            margin-bottom: 8px;
            overflow: hidden;
            border: 1px solid var(--border);
            cursor: pointer;
            transition: border-color 0.2s;
        }

        .archetype-card:hover {
            border-color: var(--accent);
        }

        .archetype-card.selected {
            border-color: var(--accent);
            box-shadow: 0 0 0 1px var(--accent);
        }

        .archetype-header {
            display: flex;
            align-items: center;
            padding: 12px;
            gap: 12px;
        }

        .archetype-info {
            flex: 1;
            min-width: 0;
        }

        .archetype-title {
            font-weight: 600;
            font-size: 13px;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .component-count-badge {
            font-size: 10px;
            padding: 2px 6px;
            background-color: var(--accent);
            color: var(--button-fg);
            border-radius: 10px;
        }

        .archetype-components {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }

        .component-tag {
            padding: 2px 6px;
            background-color: var(--bg-primary);
            border-radius: 4px;
            font-size: 11px;
            color: var(--text-secondary);
        }

        .archetype-stats {
            text-align: right;
        }

        .stat-value {
            font-size: 18px;
            font-weight: 600;
            font-family: var(--vscode-editor-font-family);
        }

        .stat-label {
            font-size: 10px;
            color: var(--text-secondary);
        }

        .archetype-metrics {
            display: flex;
            padding: 8px 12px;
            gap: 16px;
            border-top: 1px solid var(--border);
            font-size: 11px;
            color: var(--text-secondary);
        }

        .metric-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .metric-icon {
            opacity: 0.7;
        }

        .cache-rate {
            color: var(--success);
        }

        .cache-rate.warning {
            color: var(--warning);
        }

        .cache-rate.bad {
            color: var(--error);
        }

        .summary-card {
            background-color: var(--bg-primary);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
        }

        .summary-title {
            font-size: 11px;
            color: var(--text-secondary);
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .summary-value {
            font-size: 28px;
            font-weight: 600;
            font-family: var(--vscode-editor-font-family);
        }

        .summary-unit {
            font-size: 12px;
            color: var(--text-secondary);
            margin-left: 4px;
        }

        .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px solid var(--border);
            font-size: 12px;
        }

        .summary-row:last-child {
            border-bottom: none;
        }

        .detail-section {
            margin-bottom: 16px;
        }

        .detail-section-title {
            font-size: 11px;
            color: var(--text-secondary);
            text-transform: uppercase;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid var(--border);
        }

        .entity-list {
            max-height: 200px;
            overflow-y: auto;
        }

        .entity-item {
            display: flex;
            align-items: center;
            padding: 4px 8px;
            gap: 8px;
            border-radius: 4px;
            font-size: 12px;
        }

        .entity-item:hover {
            background-color: var(--bg-hover);
        }

        .entity-icon {
            opacity: 0.7;
        }

        .progress-bar-container {
            margin-top: 8px;
        }

        .progress-bar-label {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 4px;
        }

        .progress-bar {
            height: 8px;
            background-color: var(--bg-primary);
            border-radius: 4px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background-color: var(--accent);
            transition: width 0.3s;
        }

        .progress-fill.success {
            background-color: var(--success);
        }

        .progress-fill.warning {
            background-color: var(--warning);
        }

        .progress-fill.error {
            background-color: var(--error);
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

        .no-data {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-secondary);
            text-align: center;
            padding: 24px;
        }

        .no-selection {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: var(--text-secondary);
            text-align: center;
        }

        .hidden {
            display: none !important;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="toolbar">
            <span class="toolbar-title">Archetype Visualizer</span>
            <div class="status-indicator">
                <span class="status-dot" id="statusDot"></span>
                <span id="statusText">Disconnected</span>
            </div>
            <button id="connectBtn">Connect</button>
            <button id="refreshBtn" class="secondary" disabled>Refresh</button>
        </div>

        <div class="content">
            <div class="archetypes-panel">
                <div class="panel-header">
                    <span>Archetypes</span>
                    <div class="sort-controls">
                        <button class="sort-btn active" data-sort="entityCount">Entities</button>
                        <button class="sort-btn" data-sort="memory">Memory</button>
                        <button class="sort-btn" data-sort="components">Components</button>
                    </div>
                </div>
                <div class="panel-content" id="archetypesList">
                    <div class="no-data">Connect to view archetypes</div>
                </div>
            </div>

            <div class="details-panel">
                <div class="panel-header">Details</div>
                <div class="panel-content" id="detailsPanel">
                    <div class="summary-card">
                        <div class="summary-title">Total Archetypes</div>
                        <div class="summary-value" id="totalArchetypes">--</div>
                    </div>

                    <div class="summary-card">
                        <div class="summary-title">Total Memory</div>
                        <div class="summary-value" id="totalMemory">--<span class="summary-unit">KB</span></div>
                    </div>

                    <div class="summary-card">
                        <div class="summary-title">Average Cache Hit Rate</div>
                        <div class="summary-value" id="avgCacheRate">--%</div>
                    </div>

                    <div id="archetypeDetails" class="hidden">
                        <div class="detail-section">
                            <div class="detail-section-title">Selected Archetype</div>
                            <div id="selectedArchetypeName" style="font-weight: 600; margin-bottom: 8px;"></div>
                            <div id="selectedArchetypeComponents"></div>
                        </div>

                        <div class="detail-section">
                            <div class="detail-section-title">Cache Hit Rate</div>
                            <div class="progress-bar-container">
                                <div class="progress-bar-label">
                                    <span>Cache Efficiency</span>
                                    <span id="cacheRateValue">0%</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill" id="cacheRateFill" style="width: 0%"></div>
                                </div>
                            </div>
                        </div>

                        <div class="detail-section">
                            <div class="detail-section-title">Entities in Archetype</div>
                            <div class="entity-list" id="entityList"></div>
                        </div>
                    </div>

                    <div id="noSelection" class="no-selection">
                        <div style="font-size: 24px; margin-bottom: 8px;">&#128202;</div>
                        <div>Select an archetype to view details</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="connection-overlay hidden" id="connectionOverlay">
        <div class="connection-dialog">
            <h2>Connect to OrionECS</h2>
            <p>
                The Archetype Visualizer requires a connection to a running OrionECS application
                with the debug server enabled.
            </p>
            <p>
                For testing, you can use <strong>Demo Mode</strong> to explore the visualizer
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
        let archetypes = [];
        let selectedArchetypeId = null;
        let connectionStatus = 'disconnected';
        let sortBy = 'entityCount';

        // Elements
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const connectBtn = document.getElementById('connectBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const archetypesList = document.getElementById('archetypesList');
        const detailsPanel = document.getElementById('detailsPanel');
        const connectionOverlay = document.getElementById('connectionOverlay');
        const cancelConnectBtn = document.getElementById('cancelConnectBtn');
        const demoModeBtn = document.getElementById('demoModeBtn');

        // Summary elements
        const totalArchetypes = document.getElementById('totalArchetypes');
        const totalMemory = document.getElementById('totalMemory');
        const avgCacheRate = document.getElementById('avgCacheRate');

        // Detail elements
        const archetypeDetails = document.getElementById('archetypeDetails');
        const noSelection = document.getElementById('noSelection');
        const selectedArchetypeName = document.getElementById('selectedArchetypeName');
        const selectedArchetypeComponents = document.getElementById('selectedArchetypeComponents');
        const cacheRateValue = document.getElementById('cacheRateValue');
        const cacheRateFill = document.getElementById('cacheRateFill');
        const entityList = document.getElementById('entityList');

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
            vscode.postMessage({ type: 'refreshArchetypes' });
        });

        // Sort buttons
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                sortBy = btn.dataset.sort;
                renderArchetypes();
            });
        });

        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;

            switch (message.type) {
                case 'connectionStatus':
                    updateConnectionStatus(message.status);
                    break;

                case 'archetypesUpdated':
                    archetypes = message.archetypes;
                    renderArchetypes();
                    renderSummary();
                    break;

                case 'archetypeSelected':
                    if (message.archetype) {
                        selectedArchetypeId = message.archetype.id;
                        renderArchetypeDetails(message.archetype);
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

        function renderArchetypes() {
            if (archetypes.length === 0) {
                archetypesList.innerHTML = '<div class="no-data">No archetypes found</div>';
                return;
            }

            // Sort archetypes
            const sortedArchetypes = [...archetypes].sort((a, b) => {
                switch (sortBy) {
                    case 'entityCount':
                        return b.entityCount - a.entityCount;
                    case 'memory':
                        return b.memoryUsageBytes - a.memoryUsageBytes;
                    case 'components':
                        return b.componentTypes.length - a.componentTypes.length;
                    default:
                        return 0;
                }
            });

            archetypesList.innerHTML = sortedArchetypes.map(archetype => {
                const cacheClass = getCacheRateClass(archetype.cacheHitRate);
                const memoryKB = (archetype.memoryUsageBytes / 1024).toFixed(1);
                const isSelected = archetype.id === selectedArchetypeId;

                return \`
                    <div class="archetype-card \${isSelected ? 'selected' : ''}" data-id="\${archetype.id}">
                        <div class="archetype-header">
                            <div class="archetype-info">
                                <div class="archetype-title">
                                    Archetype
                                    <span class="component-count-badge">\${archetype.componentTypes.length} components</span>
                                </div>
                                <div class="archetype-components">
                                    \${archetype.componentTypes.slice(0, 5).map(c =>
                                        \`<span class="component-tag">\${c}</span>\`
                                    ).join('')}
                                    \${archetype.componentTypes.length > 5 ?
                                        \`<span class="component-tag">+\${archetype.componentTypes.length - 5} more</span>\` : ''}
                                </div>
                            </div>
                            <div class="archetype-stats">
                                <div class="stat-value">\${archetype.entityCount}</div>
                                <div class="stat-label">entities</div>
                            </div>
                        </div>
                        <div class="archetype-metrics">
                            <div class="metric-item">
                                <span class="metric-icon">&#128190;</span>
                                <span>\${memoryKB} KB</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-icon">&#9889;</span>
                                <span class="cache-rate \${cacheClass}">\${(archetype.cacheHitRate * 100).toFixed(0)}% cache</span>
                            </div>
                        </div>
                    </div>
                \`;
            }).join('');

            // Add click handlers
            archetypesList.querySelectorAll('.archetype-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.dataset.id;
                    selectedArchetypeId = id;
                    vscode.postMessage({ type: 'selectArchetype', archetypeId: id });
                    renderArchetypes();
                });
            });
        }

        function renderSummary() {
            totalArchetypes.textContent = archetypes.length;

            const totalBytes = archetypes.reduce((sum, a) => sum + a.memoryUsageBytes, 0);
            totalMemory.innerHTML = (totalBytes / 1024).toFixed(1) + '<span class="summary-unit">KB</span>';

            const avgCache = archetypes.length > 0
                ? archetypes.reduce((sum, a) => sum + a.cacheHitRate, 0) / archetypes.length
                : 0;
            avgCacheRate.textContent = (avgCache * 100).toFixed(0) + '%';
        }

        function renderArchetypeDetails(archetype) {
            noSelection.classList.add('hidden');
            archetypeDetails.classList.remove('hidden');

            selectedArchetypeName.textContent = \`Archetype \${archetype.id}\`;

            selectedArchetypeComponents.innerHTML = archetype.componentTypes.map(c =>
                \`<span class="component-tag">\${c}</span>\`
            ).join(' ');

            const cachePercent = (archetype.cacheHitRate * 100).toFixed(0);
            cacheRateValue.textContent = cachePercent + '%';
            cacheRateFill.style.width = cachePercent + '%';
            cacheRateFill.className = 'progress-fill ' + getCacheRateFillClass(archetype.cacheHitRate);

            entityList.innerHTML = archetype.entityIds.map(id =>
                \`<div class="entity-item">
                    <span class="entity-icon">&#128230;</span>
                    <span>\${id}</span>
                </div>\`
            ).join('');
        }

        function getCacheRateClass(rate) {
            if (rate >= 0.9) return '';
            if (rate >= 0.7) return 'warning';
            return 'bad';
        }

        function getCacheRateFillClass(rate) {
            if (rate >= 0.9) return 'success';
            if (rate >= 0.7) return 'warning';
            return 'error';
        }
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
        ArchetypeVisualizerPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
