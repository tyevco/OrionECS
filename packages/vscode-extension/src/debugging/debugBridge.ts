import * as vscode from 'vscode';
import type {
    ConnectionStatus,
    EntitySnapshot,
    ExtensionMessage,
    PerformanceMetrics,
    RuntimeMessage,
    SystemSnapshot,
} from './debugProtocol';

/**
 * Debug bridge manages communication between VS Code extension and OrionECS runtime.
 * Supports both real connections (via WebSocket) and demo mode for testing.
 */
export class DebugBridge {
    private static instance: DebugBridge | null = null;
    private _status: ConnectionStatus = 'disconnected';
    private _onStatusChange = new vscode.EventEmitter<ConnectionStatus>();
    private _onMessage = new vscode.EventEmitter<RuntimeMessage>();
    private demoInterval: ReturnType<typeof setInterval> | null = null;
    private demoEntities: EntitySnapshot[] = [];
    private demoSystems: SystemSnapshot[] = [];
    private outputChannel: vscode.OutputChannel;

    readonly onStatusChange = this._onStatusChange.event;
    readonly onMessage = this._onMessage.event;

    private constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.initializeDemoData();
    }

    static getInstance(outputChannel?: vscode.OutputChannel): DebugBridge {
        if (!DebugBridge.instance) {
            if (!outputChannel) {
                throw new Error('DebugBridge requires outputChannel on first initialization');
            }
            DebugBridge.instance = new DebugBridge(outputChannel);
        }
        return DebugBridge.instance;
    }

    get status(): ConnectionStatus {
        return this._status;
    }

    private setStatus(status: ConnectionStatus): void {
        this._status = status;
        this._onStatusChange.fire(status);
    }

    /**
     * Connect to a running OrionECS instance
     */
    async connect(port: number = 9229): Promise<boolean> {
        this.outputChannel.appendLine(
            `Attempting to connect to OrionECS debug server on port ${port}`
        );
        this.setStatus('connecting');

        // TODO: Implement actual WebSocket connection
        // For now, we'll show a message about demo mode
        vscode.window
            .showInformationMessage(
                'Real-time debugging requires OrionECS debug server. Starting demo mode instead.',
                'Learn More'
            )
            .then((selection) => {
                if (selection === 'Learn More') {
                    return vscode.env.openExternal(
                        vscode.Uri.parse(
                            'https://github.com/tyevco/OrionECS/blob/main/docs/debugging.md'
                        )
                    );
                }
                return undefined;
            });

        // Start demo mode automatically
        this.startDemoMode();
        return true;
    }

    /**
     * Disconnect from the debug server
     */
    disconnect(): void {
        this.stopDemoMode();
        this.setStatus('disconnected');
        this.outputChannel.appendLine('Disconnected from debug server');
    }

    /**
     * Send a message to the runtime
     */
    send(message: ExtensionMessage): void {
        if (this._status === 'connected') {
            // In demo mode, handle messages locally
            this.handleDemoMessage(message);
        }
    }

    /**
     * Start demo mode with simulated data
     */
    startDemoMode(): void {
        this.outputChannel.appendLine('Starting demo mode');
        this.setStatus('connected');

        // Send initial snapshot
        this._onMessage.fire({
            type: 'snapshot',
            entities: this.demoEntities,
            systems: this.demoSystems,
        });

        // Update demo data periodically
        this.demoInterval = setInterval(() => {
            this.updateDemoData();
            this._onMessage.fire({
                type: 'performanceMetrics',
                metrics: this.generateDemoMetrics(),
            });
        }, 1000);
    }

    /**
     * Stop demo mode
     */
    stopDemoMode(): void {
        if (this.demoInterval) {
            clearInterval(this.demoInterval);
            this.demoInterval = null;
        }
    }

    /**
     * Get current entities (for demo mode)
     */
    getEntities(): EntitySnapshot[] {
        return [...this.demoEntities];
    }

    /**
     * Get current systems (for demo mode)
     */
    getSystems(): SystemSnapshot[] {
        return [...this.demoSystems];
    }

    private handleDemoMessage(message: ExtensionMessage): void {
        switch (message.type) {
            case 'requestSnapshot':
                this._onMessage.fire({
                    type: 'snapshot',
                    entities: this.demoEntities,
                    systems: this.demoSystems,
                });
                break;

            case 'requestEntityDetails':
                const entity = this.demoEntities.find((e) => e.id === message.entityId);
                this._onMessage.fire({
                    type: 'entityDetails',
                    entity: entity || null,
                });
                break;

            case 'requestSystemList':
                this._onMessage.fire({
                    type: 'systemList',
                    systems: this.demoSystems,
                });
                break;

            case 'requestPerformanceMetrics':
                this._onMessage.fire({
                    type: 'performanceMetrics',
                    metrics: this.generateDemoMetrics(),
                });
                break;

            case 'toggleSystem':
                const system = this.demoSystems.find((s) => s.name === message.systemName);
                if (system) {
                    system.enabled = message.enabled;
                    this._onMessage.fire({
                        type: 'systemToggled',
                        systemName: message.systemName,
                        enabled: message.enabled,
                    });
                }
                break;

            case 'modifyComponent':
                this.handleDemoComponentModify(message);
                break;
        }
    }

    private handleDemoComponentModify(message: {
        entityId: string;
        componentName: string;
        property: string;
        value: unknown;
    }): void {
        const entity = this.demoEntities.find((e) => e.id === message.entityId);
        if (entity) {
            const component = entity.components.find((c) => c.name === message.componentName);
            if (component) {
                component.properties[message.property] = message.value;
                this._onMessage.fire({
                    type: 'componentModified',
                    entityId: message.entityId,
                    componentName: message.componentName,
                    success: true,
                });
            }
        }
    }

    private initializeDemoData(): void {
        // Create demo entities
        this.demoEntities = [
            {
                id: 'entity-1',
                name: 'Player',
                tags: ['player', 'controllable', 'active'],
                parentId: null,
                childIds: ['entity-2', 'entity-3'],
                components: [
                    {
                        name: 'Position',
                        properties: { x: 100, y: 200, z: 0 },
                        isTag: false,
                    },
                    {
                        name: 'Velocity',
                        properties: { x: 5, y: 0, z: 0 },
                        isTag: false,
                    },
                    {
                        name: 'Health',
                        properties: { current: 100, max: 100 },
                        isTag: false,
                    },
                    {
                        name: 'Sprite',
                        properties: { texture: 'player.png', width: 32, height: 48 },
                        isTag: false,
                    },
                ],
            },
            {
                id: 'entity-2',
                name: 'PlayerWeapon',
                tags: ['weapon'],
                parentId: 'entity-1',
                childIds: [],
                components: [
                    {
                        name: 'Position',
                        properties: { x: 110, y: 195, z: 1 },
                        isTag: false,
                    },
                    {
                        name: 'Weapon',
                        properties: { damage: 25, range: 50, cooldown: 0.5 },
                        isTag: false,
                    },
                ],
            },
            {
                id: 'entity-3',
                name: 'PlayerShield',
                tags: ['shield', 'active'],
                parentId: 'entity-1',
                childIds: [],
                components: [
                    {
                        name: 'Position',
                        properties: { x: 90, y: 200, z: 1 },
                        isTag: false,
                    },
                    {
                        name: 'Shield',
                        properties: { absorption: 50, active: true },
                        isTag: false,
                    },
                ],
            },
            {
                id: 'entity-4',
                name: 'Enemy_Goblin',
                tags: ['enemy', 'hostile', 'active'],
                parentId: null,
                childIds: [],
                components: [
                    {
                        name: 'Position',
                        properties: { x: 300, y: 250, z: 0 },
                        isTag: false,
                    },
                    {
                        name: 'Velocity',
                        properties: { x: -2, y: 0, z: 0 },
                        isTag: false,
                    },
                    {
                        name: 'Health',
                        properties: { current: 30, max: 30 },
                        isTag: false,
                    },
                    {
                        name: 'AI',
                        properties: { state: 'patrol', targetId: null, aggroRange: 100 },
                        isTag: false,
                    },
                ],
            },
            {
                id: 'entity-5',
                name: 'Enemy_Skeleton',
                tags: ['enemy', 'hostile', 'undead'],
                parentId: null,
                childIds: [],
                components: [
                    {
                        name: 'Position',
                        properties: { x: 450, y: 180, z: 0 },
                        isTag: false,
                    },
                    {
                        name: 'Velocity',
                        properties: { x: 1, y: 0, z: 0 },
                        isTag: false,
                    },
                    {
                        name: 'Health',
                        properties: { current: 20, max: 20 },
                        isTag: false,
                    },
                    {
                        name: 'AI',
                        properties: { state: 'chase', targetId: 'entity-1', aggroRange: 150 },
                        isTag: false,
                    },
                ],
            },
            {
                id: 'entity-6',
                name: 'Collectible_Coin',
                tags: ['collectible', 'coin'],
                parentId: null,
                childIds: [],
                components: [
                    {
                        name: 'Position',
                        properties: { x: 200, y: 220, z: 0 },
                        isTag: false,
                    },
                    {
                        name: 'Collider',
                        properties: { radius: 8, trigger: true },
                        isTag: false,
                    },
                    {
                        name: 'Value',
                        properties: { amount: 10 },
                        isTag: false,
                    },
                ],
            },
            {
                id: 'entity-7',
                name: 'Platform_1',
                tags: ['platform', 'static'],
                parentId: null,
                childIds: [],
                components: [
                    {
                        name: 'Position',
                        properties: { x: 0, y: 300, z: 0 },
                        isTag: false,
                    },
                    {
                        name: 'Collider',
                        properties: { width: 800, height: 32, trigger: false },
                        isTag: false,
                    },
                ],
            },
        ];

        // Create demo systems
        this.demoSystems = [
            {
                name: 'InputSystem',
                enabled: true,
                priority: 1000,
                isFixedUpdate: false,
                queryComponents: { all: ['PlayerController'], any: [], none: [] },
                matchingEntityCount: 1,
                lastExecutionTime: 0.12,
                averageExecutionTime: 0.15,
                totalExecutions: 5420,
            },
            {
                name: 'AISystem',
                enabled: true,
                priority: 900,
                isFixedUpdate: false,
                queryComponents: { all: ['AI', 'Position'], any: [], none: ['Dead'] },
                matchingEntityCount: 2,
                lastExecutionTime: 0.45,
                averageExecutionTime: 0.52,
                totalExecutions: 5420,
            },
            {
                name: 'PhysicsSystem',
                enabled: true,
                priority: 800,
                isFixedUpdate: true,
                queryComponents: { all: ['Position', 'Velocity'], any: [], none: [] },
                matchingEntityCount: 4,
                lastExecutionTime: 0.78,
                averageExecutionTime: 0.82,
                totalExecutions: 10840,
            },
            {
                name: 'CollisionSystem',
                enabled: true,
                priority: 700,
                isFixedUpdate: true,
                queryComponents: { all: ['Position', 'Collider'], any: [], none: [] },
                matchingEntityCount: 5,
                lastExecutionTime: 1.23,
                averageExecutionTime: 1.35,
                totalExecutions: 10840,
            },
            {
                name: 'CombatSystem',
                enabled: true,
                priority: 600,
                isFixedUpdate: false,
                queryComponents: { all: ['Weapon'], any: ['Health'], none: [] },
                matchingEntityCount: 1,
                lastExecutionTime: 0.08,
                averageExecutionTime: 0.1,
                totalExecutions: 5420,
            },
            {
                name: 'HealthSystem',
                enabled: true,
                priority: 500,
                isFixedUpdate: false,
                queryComponents: { all: ['Health'], any: [], none: [] },
                matchingEntityCount: 4,
                lastExecutionTime: 0.05,
                averageExecutionTime: 0.06,
                totalExecutions: 5420,
            },
            {
                name: 'AnimationSystem',
                enabled: true,
                priority: 200,
                isFixedUpdate: false,
                queryComponents: { all: ['Sprite', 'Animation'], any: [], none: [] },
                matchingEntityCount: 3,
                lastExecutionTime: 0.32,
                averageExecutionTime: 0.35,
                totalExecutions: 5420,
            },
            {
                name: 'RenderSystem',
                enabled: true,
                priority: 100,
                isFixedUpdate: false,
                queryComponents: { all: ['Position', 'Sprite'], any: [], none: ['Hidden'] },
                matchingEntityCount: 6,
                lastExecutionTime: 2.15,
                averageExecutionTime: 2.25,
                totalExecutions: 5420,
            },
            {
                name: 'DebugRenderSystem',
                enabled: false,
                priority: 50,
                isFixedUpdate: false,
                queryComponents: { all: ['Position', 'Collider'], any: [], none: [] },
                matchingEntityCount: 5,
                lastExecutionTime: 0,
                averageExecutionTime: 0.95,
                totalExecutions: 0,
            },
        ];
    }

    private updateDemoData(): void {
        // Simulate entity movement
        for (const entity of this.demoEntities) {
            const position = entity.components.find((c) => c.name === 'Position');
            const velocity = entity.components.find((c) => c.name === 'Velocity');

            if (position && velocity) {
                position.properties.x =
                    (position.properties.x as number) + (velocity.properties.x as number) * 0.016;
                position.properties.y =
                    (position.properties.y as number) + (velocity.properties.y as number) * 0.016;

                // Bounce off screen edges
                if (
                    (position.properties.x as number) > 800 ||
                    (position.properties.x as number) < 0
                ) {
                    velocity.properties.x = -(velocity.properties.x as number);
                }
            }
        }

        // Update system execution times with slight variation
        for (const system of this.demoSystems) {
            if (system.enabled) {
                system.lastExecutionTime =
                    system.averageExecutionTime * (0.8 + Math.random() * 0.4);
                system.totalExecutions++;
            }
        }
    }

    private generateDemoMetrics(): PerformanceMetrics {
        const systemTimes: Record<string, number> = {};
        for (const system of this.demoSystems) {
            systemTimes[system.name] = system.lastExecutionTime;
        }

        return {
            fps: 58 + Math.random() * 4,
            frameTime: 16.5 + Math.random() * 2,
            entityCount: this.demoEntities.length,
            componentCount: this.demoEntities.reduce((sum, e) => sum + e.components.length, 0),
            systemExecutionTimes: systemTimes,
            memoryUsage: 45 + Math.random() * 10,
        };
    }

    dispose(): void {
        this.stopDemoMode();
        this._onStatusChange.dispose();
        this._onMessage.dispose();
        DebugBridge.instance = null;
    }
}
