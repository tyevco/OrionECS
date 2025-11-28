/**
 * Debug protocol for communication between VS Code extension and OrionECS runtime
 */

// Entity data structures
export interface EntitySnapshot {
    id: string;
    name: string;
    tags: string[];
    parentId: string | null;
    childIds: string[];
    components: ComponentSnapshot[];
}

export interface ComponentSnapshot {
    name: string;
    properties: Record<string, unknown>;
    isTag: boolean;
}

// Archetype data structures
export interface ArchetypeSnapshot {
    id: string;
    componentTypes: string[];
    entityCount: number;
    entityIds: string[];
    memoryUsageBytes: number;
    cacheHitRate: number;
    lastAccessTime: number;
    createdAt: number;
}

// System data structures
export interface SystemSnapshot {
    name: string;
    enabled: boolean;
    priority: number;
    isFixedUpdate: boolean;
    queryComponents: {
        all: string[];
        any: string[];
        none: string[];
    };
    matchingEntityCount: number;
    lastExecutionTime: number;
    averageExecutionTime: number;
    totalExecutions: number;
}

// Performance metrics
export interface PerformanceMetrics {
    fps: number;
    frameTime: number;
    entityCount: number;
    componentCount: number;
    systemExecutionTimes: Record<string, number>;
    memoryUsage?: number;
}

// Message types from extension to runtime
export type ExtensionMessage =
    | { type: 'requestSnapshot' }
    | { type: 'requestEntityDetails'; entityId: string }
    | { type: 'requestSystemList' }
    | { type: 'requestPerformanceMetrics' }
    | { type: 'requestArchetypes' }
    | { type: 'toggleSystem'; systemName: string; enabled: boolean }
    | {
          type: 'modifyComponent';
          entityId: string;
          componentName: string;
          property: string;
          value: unknown;
      }
    | { type: 'subscribe'; events: DebugEventType[] }
    | { type: 'unsubscribe'; events: DebugEventType[] };

// Message types from runtime to extension
export type RuntimeMessage =
    | { type: 'snapshot'; entities: EntitySnapshot[]; systems: SystemSnapshot[] }
    | { type: 'entityDetails'; entity: EntitySnapshot | null }
    | { type: 'systemList'; systems: SystemSnapshot[] }
    | { type: 'performanceMetrics'; metrics: PerformanceMetrics }
    | { type: 'archetypeList'; archetypes: ArchetypeSnapshot[] }
    | { type: 'systemToggled'; systemName: string; enabled: boolean }
    | { type: 'componentModified'; entityId: string; componentName: string; success: boolean }
    | { type: 'entityCreated'; entity: EntitySnapshot }
    | { type: 'entityDestroyed'; entityId: string }
    | { type: 'componentAdded'; entityId: string; component: ComponentSnapshot }
    | { type: 'componentRemoved'; entityId: string; componentName: string }
    | { type: 'error'; message: string };

// Debug event types for subscriptions
export type DebugEventType =
    | 'entityCreated'
    | 'entityDestroyed'
    | 'componentAdded'
    | 'componentRemoved'
    | 'performanceUpdate';

// Connection status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Webview message types
export type WebviewMessage =
    // Entity Inspector messages
    | { type: 'selectEntity'; entityId: string }
    | { type: 'refreshEntities' }
    | {
          type: 'modifyProperty';
          entityId: string;
          componentName: string;
          property: string;
          value: unknown;
      }
    | { type: 'expandHierarchy'; entityId: string }
    | { type: 'collapseHierarchy'; entityId: string }
    // System Visualizer messages
    | { type: 'toggleSystem'; systemName: string; enabled: boolean }
    | { type: 'refreshSystems' }
    | { type: 'sortSystems'; by: 'priority' | 'name' | 'executionTime' }
    // Archetype Visualizer messages
    | { type: 'refreshArchetypes' }
    | { type: 'selectArchetype'; archetypeId: string }
    | { type: 'sortArchetypes'; by: 'entityCount' | 'memory' | 'components' }
    // Connection messages
    | { type: 'connect'; port?: number }
    | { type: 'disconnect' }
    // Demo mode messages
    | { type: 'startDemoMode' }
    | { type: 'stopDemoMode' };

// Messages from extension to webview
export type ExtensionToWebviewMessage =
    | { type: 'connectionStatus'; status: ConnectionStatus; message?: string }
    | { type: 'entitiesUpdated'; entities: EntitySnapshot[] }
    | { type: 'entitySelected'; entity: EntitySnapshot | null }
    | { type: 'systemsUpdated'; systems: SystemSnapshot[] }
    | { type: 'performanceUpdated'; metrics: PerformanceMetrics }
    | { type: 'archetypesUpdated'; archetypes: ArchetypeSnapshot[] }
    | { type: 'archetypeSelected'; archetype: ArchetypeSnapshot | null }
    | { type: 'error'; message: string }
    | { type: 'demoModeActive'; active: boolean };
