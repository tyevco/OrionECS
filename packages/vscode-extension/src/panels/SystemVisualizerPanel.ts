import * as vscode from 'vscode';
import { DebugBridge } from '../debugging/debugBridge';
import type {
    ExtensionToWebviewMessage,
    RuntimeMessage,
    WebviewMessage,
} from '../debugging/debugProtocol';

/**
 * Manages the System Visualizer webview panel
 */
export class SystemVisualizerPanel {
    public static currentPanel: SystemVisualizerPanel | undefined;
    private static readonly viewType = 'orionSystemVisualizer';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private readonly debugBridge: DebugBridge;
    private readonly outputChannel: vscode.OutputChannel;
    private disposables: vscode.Disposable[] = [];

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
        if (SystemVisualizerPanel.currentPanel) {
            SystemVisualizerPanel.currentPanel.panel.reveal(column);
            return;
        }

        // Create a new panel
        const panel = vscode.window.createWebviewPanel(
            SystemVisualizerPanel.viewType,
            'System Visualizer',
            column || vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
            }
        );

        SystemVisualizerPanel.currentPanel = new SystemVisualizerPanel(
            panel,
            extensionUri,
            outputChannel
        );
        outputChannel.appendLine('System Visualizer panel created');
    }

    private postMessage(message: ExtensionToWebviewMessage): void {
        this.panel.webview.postMessage(message);
    }

    private handleWebviewMessage(message: WebviewMessage): void {
        switch (message.type) {
            case 'toggleSystem':
                this.debugBridge.send({
                    type: 'toggleSystem',
                    systemName: message.systemName,
                    enabled: message.enabled,
                });
                break;

            case 'refreshSystems':
                this.debugBridge.send({ type: 'requestSystemList' });
                this.debugBridge.send({ type: 'requestPerformanceMetrics' });
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
                    type: 'systemsUpdated',
                    systems: message.systems,
                });
                break;

            case 'systemList':
                this.postMessage({
                    type: 'systemsUpdated',
                    systems: message.systems,
                });
                break;

            case 'performanceMetrics':
                this.postMessage({
                    type: 'performanceUpdated',
                    metrics: message.metrics,
                });
                break;

            case 'systemToggled':
                // Request updated system list
                this.debugBridge.send({ type: 'requestSystemList' });
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
    <title>System Visualizer</title>
    <style>
        :root {
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-sideBar-background);
            --bg-hover: var(--vscode-list-hoverBackground);
            --bg-selected: var(--vscode-list-activeSelectionBackground);
            --text-primary: var(--vscode-foreground);
            --text-secondary: var(--vscode-descriptionForeground);
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
            grid-template-columns: 1fr 320px;
            gap: 1px;
            background-color: var(--border);
            overflow: hidden;
        }

        .systems-panel {
            background-color: var(--bg-primary);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .metrics-panel {
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

        .system-card {
            background-color: var(--bg-secondary);
            border-radius: 6px;
            margin-bottom: 8px;
            overflow: hidden;
            border: 1px solid var(--border);
        }

        .system-card.disabled {
            opacity: 0.6;
        }

        .system-header {
            display: flex;
            align-items: center;
            padding: 10px 12px;
            gap: 10px;
        }

        .system-toggle {
            position: relative;
            width: 36px;
            height: 20px;
            background-color: var(--bg-primary);
            border-radius: 10px;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .system-toggle.enabled {
            background-color: var(--success);
        }

        .system-toggle::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 16px;
            height: 16px;
            background-color: white;
            border-radius: 50%;
            transition: transform 0.2s;
        }

        .system-toggle.enabled::after {
            transform: translateX(16px);
        }

        .system-info {
            flex: 1;
            min-width: 0;
        }

        .system-name {
            font-weight: 600;
            font-size: 13px;
            margin-bottom: 2px;
        }

        .system-meta {
            font-size: 11px;
            color: var(--text-secondary);
            display: flex;
            gap: 12px;
        }

        .system-timing {
            text-align: right;
        }

        .system-time {
            font-family: var(--vscode-editor-font-family);
            font-size: 14px;
            font-weight: 600;
        }

        .system-time.slow {
            color: var(--warning);
        }

        .system-time.very-slow {
            color: var(--error);
        }

        .system-time-label {
            font-size: 10px;
            color: var(--text-secondary);
        }

        .system-body {
            padding: 8px 12px;
            border-top: 1px solid var(--border);
            font-size: 12px;
        }

        .query-section {
            margin-bottom: 8px;
        }

        .query-label {
            font-size: 10px;
            color: var(--text-secondary);
            text-transform: uppercase;
            margin-bottom: 4px;
        }

        .query-components {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }

        .component-badge {
            padding: 2px 8px;
            background-color: var(--bg-primary);
            border-radius: 10px;
            font-size: 11px;
        }

        .component-badge.all {
            border-left: 2px solid var(--success);
        }

        .component-badge.any {
            border-left: 2px solid var(--warning);
        }

        .component-badge.none {
            border-left: 2px solid var(--error);
        }

        .progress-bar {
            height: 4px;
            background-color: var(--bg-primary);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 8px;
        }

        .progress-fill {
            height: 100%;
            background-color: var(--accent);
            transition: width 0.3s;
        }

        .metric-card {
            background-color: var(--bg-primary);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 8px;
        }

        .metric-label {
            font-size: 11px;
            color: var(--text-secondary);
            text-transform: uppercase;
            margin-bottom: 4px;
        }

        .metric-value {
            font-size: 24px;
            font-weight: 600;
            font-family: var(--vscode-editor-font-family);
        }

        .metric-value.good {
            color: var(--success);
        }

        .metric-value.warning {
            color: var(--warning);
        }

        .metric-value.bad {
            color: var(--error);
        }

        .metric-unit {
            font-size: 12px;
            color: var(--text-secondary);
            margin-left: 4px;
        }

        .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px solid var(--border);
        }

        .metric-row:last-child {
            border-bottom: none;
        }

        .execution-order {
            margin-top: 12px;
        }

        .execution-order-title {
            font-size: 11px;
            color: var(--text-secondary);
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .execution-item {
            display: flex;
            align-items: center;
            padding: 4px 0;
            gap: 8px;
            font-size: 12px;
        }

        .execution-order-num {
            width: 20px;
            height: 20px;
            background-color: var(--accent);
            color: var(--button-fg);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 600;
        }

        .execution-item.disabled {
            opacity: 0.5;
        }

        .execution-item.disabled .execution-order-num {
            background-color: var(--text-secondary);
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

        .hidden {
            display: none !important;
        }

        .section-divider {
            height: 1px;
            background-color: var(--border);
            margin: 16px 0;
        }

        .fixed-badge {
            font-size: 10px;
            padding: 2px 6px;
            background-color: var(--accent);
            color: var(--button-fg);
            border-radius: 2px;
            margin-left: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="toolbar">
            <span class="toolbar-title">System Visualizer</span>
            <div class="status-indicator">
                <span class="status-dot" id="statusDot"></span>
                <span id="statusText">Disconnected</span>
            </div>
            <button id="connectBtn">Connect</button>
            <button id="refreshBtn" class="secondary" disabled>Refresh</button>
        </div>

        <div class="content">
            <div class="systems-panel">
                <div class="panel-header">
                    <span>Systems</span>
                    <div class="sort-controls">
                        <button class="sort-btn active" data-sort="priority">Priority</button>
                        <button class="sort-btn" data-sort="name">Name</button>
                        <button class="sort-btn" data-sort="time">Time</button>
                    </div>
                </div>
                <div class="panel-content" id="systemsList">
                    <div class="no-data">Connect to view systems</div>
                </div>
            </div>

            <div class="metrics-panel">
                <div class="panel-header">Performance</div>
                <div class="panel-content" id="metricsPanel">
                    <div class="metric-card">
                        <div class="metric-label">FPS</div>
                        <div class="metric-value" id="fpsValue">--</div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-label">Frame Time</div>
                        <div class="metric-value" id="frameTimeValue">--<span class="metric-unit">ms</span></div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-label">Entities</div>
                        <div class="metric-value" id="entityCountValue">--</div>
                    </div>

                    <div class="metric-card">
                        <div class="metric-label">Components</div>
                        <div class="metric-value" id="componentCountValue">--</div>
                    </div>

                    <div class="section-divider"></div>

                    <div class="execution-order" id="executionOrder">
                        <div class="execution-order-title">Execution Order</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="connection-overlay hidden" id="connectionOverlay">
        <div class="connection-dialog">
            <h2>Connect to OrionECS</h2>
            <p>
                The System Visualizer requires a connection to a running OrionECS application
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
        let systems = [];
        let metrics = null;
        let connectionStatus = 'disconnected';
        let sortBy = 'priority';

        // Elements
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const connectBtn = document.getElementById('connectBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const systemsList = document.getElementById('systemsList');
        const executionOrder = document.getElementById('executionOrder');
        const connectionOverlay = document.getElementById('connectionOverlay');
        const cancelConnectBtn = document.getElementById('cancelConnectBtn');
        const demoModeBtn = document.getElementById('demoModeBtn');

        // Metric elements
        const fpsValue = document.getElementById('fpsValue');
        const frameTimeValue = document.getElementById('frameTimeValue');
        const entityCountValue = document.getElementById('entityCountValue');
        const componentCountValue = document.getElementById('componentCountValue');

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
            vscode.postMessage({ type: 'refreshSystems' });
        });

        // Sort buttons
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                sortBy = btn.dataset.sort;
                renderSystems();
            });
        });

        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;

            switch (message.type) {
                case 'connectionStatus':
                    updateConnectionStatus(message.status);
                    break;

                case 'systemsUpdated':
                    systems = message.systems;
                    renderSystems();
                    renderExecutionOrder();
                    break;

                case 'performanceUpdated':
                    metrics = message.metrics;
                    renderMetrics();
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

        function renderSystems() {
            if (systems.length === 0) {
                systemsList.innerHTML = '<div class="no-data">No systems found</div>';
                return;
            }

            // Sort systems
            const sortedSystems = [...systems].sort((a, b) => {
                switch (sortBy) {
                    case 'priority':
                        return b.priority - a.priority;
                    case 'name':
                        return a.name.localeCompare(b.name);
                    case 'time':
                        return b.lastExecutionTime - a.lastExecutionTime;
                    default:
                        return 0;
                }
            });

            // Calculate max time for progress bar
            const maxTime = Math.max(...systems.map(s => s.lastExecutionTime), 0.1);

            systemsList.innerHTML = sortedSystems.map(system => {
                const timeClass = getTimeClass(system.lastExecutionTime);
                const queryHtml = renderQuery(system.queryComponents);
                const progressWidth = (system.lastExecutionTime / maxTime) * 100;

                return \`
                    <div class="system-card \${system.enabled ? '' : 'disabled'}">
                        <div class="system-header">
                            <div class="system-toggle \${system.enabled ? 'enabled' : ''}"
                                 data-system="\${system.name}"
                                 data-enabled="\${system.enabled}">
                            </div>
                            <div class="system-info">
                                <div class="system-name">
                                    \${system.name}
                                    \${system.isFixedUpdate ? '<span class="fixed-badge">Fixed</span>' : ''}
                                </div>
                                <div class="system-meta">
                                    <span>Priority: \${system.priority}</span>
                                    <span>Entities: \${system.matchingEntityCount}</span>
                                </div>
                            </div>
                            <div class="system-timing">
                                <div class="system-time \${timeClass}">
                                    \${system.enabled ? system.lastExecutionTime.toFixed(2) : '--'}
                                </div>
                                <div class="system-time-label">ms</div>
                            </div>
                        </div>
                        <div class="system-body">
                            \${queryHtml}
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: \${system.enabled ? progressWidth : 0}%"></div>
                            </div>
                        </div>
                    </div>
                \`;
            }).join('');

            // Add toggle handlers
            systemsList.querySelectorAll('.system-toggle').forEach(toggle => {
                toggle.addEventListener('click', () => {
                    const systemName = toggle.dataset.system;
                    const currentlyEnabled = toggle.dataset.enabled === 'true';
                    vscode.postMessage({
                        type: 'toggleSystem',
                        systemName,
                        enabled: !currentlyEnabled
                    });
                });
            });
        }

        function renderQuery(queryComponents) {
            const sections = [];

            if (queryComponents.all && queryComponents.all.length > 0) {
                sections.push(\`
                    <div class="query-section">
                        <div class="query-label">Required (ALL)</div>
                        <div class="query-components">
                            \${queryComponents.all.map(c => \`<span class="component-badge all">\${c}</span>\`).join('')}
                        </div>
                    </div>
                \`);
            }

            if (queryComponents.any && queryComponents.any.length > 0) {
                sections.push(\`
                    <div class="query-section">
                        <div class="query-label">Optional (ANY)</div>
                        <div class="query-components">
                            \${queryComponents.any.map(c => \`<span class="component-badge any">\${c}</span>\`).join('')}
                        </div>
                    </div>
                \`);
            }

            if (queryComponents.none && queryComponents.none.length > 0) {
                sections.push(\`
                    <div class="query-section">
                        <div class="query-label">Excluded (NONE)</div>
                        <div class="query-components">
                            \${queryComponents.none.map(c => \`<span class="component-badge none">\${c}</span>\`).join('')}
                        </div>
                    </div>
                \`);
            }

            return sections.join('');
        }

        function getTimeClass(time) {
            if (time > 2) return 'very-slow';
            if (time > 1) return 'slow';
            return '';
        }

        function renderMetrics() {
            if (!metrics) return;

            // FPS
            const fps = Math.round(metrics.fps);
            fpsValue.textContent = fps;
            fpsValue.className = 'metric-value ' + (fps >= 55 ? 'good' : fps >= 30 ? 'warning' : 'bad');

            // Frame time
            frameTimeValue.innerHTML = metrics.frameTime.toFixed(1) + '<span class="metric-unit">ms</span>';

            // Entity count
            entityCountValue.textContent = metrics.entityCount;

            // Component count
            componentCountValue.textContent = metrics.componentCount;
        }

        function renderExecutionOrder() {
            // Sort by priority for execution order
            const orderedSystems = [...systems].sort((a, b) => b.priority - a.priority);

            const orderHtml = orderedSystems.map((system, index) => \`
                <div class="execution-item \${system.enabled ? '' : 'disabled'}">
                    <span class="execution-order-num">\${index + 1}</span>
                    <span>\${system.name}</span>
                </div>
            \`).join('');

            executionOrder.innerHTML = \`
                <div class="execution-order-title">Execution Order</div>
                \${orderHtml || '<div style="color: var(--text-secondary); font-size: 12px;">No systems</div>'}
            \`;
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
        SystemVisualizerPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
