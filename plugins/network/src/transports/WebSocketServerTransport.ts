/**
 * WebSocket Server Transport for OrionECS Network Plugin
 *
 * Uses the 'ws' library for Node.js server-side WebSocket connections.
 *
 * @example
 * ```typescript
 * import { WebSocketServerTransport } from '@orion-ecs/network';
 *
 * const transport = new WebSocketServerTransport();
 * await transport.listen(8080);
 *
 * transport.onConnect((clientId) => {
 *   console.log(`Client ${clientId} connected`);
 * });
 *
 * transport.onMessage((message, senderId) => {
 *   console.log(`Received from ${senderId}:`, message);
 * });
 * ```
 */

import type { ConnectionState, NetworkMessage, ServerTransport } from '../types';

// Type definitions for the 'ws' library (avoids hard dependency)
interface WebSocketLike {
    readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
    removeAllListeners(): void;
}

interface WebSocketServerLike {
    on(event: string, listener: (...args: unknown[]) => void): void;
    close(callback?: () => void): void;
    clients: Set<WebSocketLike>;
}

// WebSocket ready states
const WS_OPEN = 1;

/**
 * WebSocket server transport implementation using the 'ws' library
 */
export class WebSocketServerTransport implements ServerTransport {
    private server: WebSocketServerLike | null = null;
    private clients: Map<string, WebSocketLike> = new Map();
    private clientIdCounter = 0;
    private socketToId: Map<WebSocketLike, string> = new Map();

    private messageHandler: ((message: NetworkMessage, senderId?: string) => void) | null = null;
    private connectHandler: ((connectionId: string) => void) | null = null;
    private disconnectHandler: ((connectionId: string, reason?: string) => void) | null = null;
    private errorHandler: ((error: Error) => void) | null = null;

    private _state: ConnectionState = 'disconnected';
    private _connectionId?: string;

    constructor(
        private readonly WebSocketServer: new (options: {
            port?: number;
            host?: string;
            noServer?: boolean;
        }) => WebSocketServerLike,
        private readonly debug: boolean = false
    ) {}

    get state(): ConnectionState {
        return this._state;
    }

    get connectionId(): string | undefined {
        return this._connectionId;
    }

    // Server lifecycle

    async listen(port: number, host: string = '0.0.0.0'): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this._state = 'connecting';

                this.server = new this.WebSocketServer({ port, host });

                this.server.on('connection', (...args: unknown[]) => {
                    this.handleConnection(args[0] as WebSocketLike);
                });

                this.server.on('error', (...args: unknown[]) => {
                    this._state = 'disconnected';
                    const error = args[0] as Error;
                    if (this.errorHandler) {
                        this.errorHandler(error);
                    }
                    reject(error);
                });

                this.server.on('listening', () => {
                    this._state = 'connected';
                    this.log(`Server listening on ${host}:${port}`);
                    resolve();
                });
            } catch (error) {
                this._state = 'disconnected';
                reject(error);
            }
        });
    }

    async close(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.server) {
                resolve();
                return;
            }

            // Disconnect all clients
            for (const [clientId, socket] of this.clients) {
                socket.close(1001, 'Server shutting down');
                if (this.disconnectHandler) {
                    this.disconnectHandler(clientId, 'Server shutting down');
                }
            }

            this.clients.clear();
            this.socketToId.clear();

            this.server.close(() => {
                this._state = 'disconnected';
                this.server = null;
                this.log('Server closed');
                resolve();
            });
        });
    }

    // Not used for server
    async connect(_url: string): Promise<void> {
        throw new Error(
            'WebSocketServerTransport does not support connect(). Use listen() instead.'
        );
    }

    disconnect(): void {
        this.close();
    }

    // Messaging

    send(message: NetworkMessage): void {
        this.broadcast(message);
    }

    sendTo(connectionId: string, message: NetworkMessage): void {
        const socket = this.clients.get(connectionId);
        if (socket && socket.readyState === WS_OPEN) {
            try {
                socket.send(JSON.stringify(message));
                this.log(`Sent to ${this.sanitizeLog(connectionId)}:`, message.type);
            } catch (error) {
                this.log(`Error sending to ${this.sanitizeLog(connectionId)}:`, error);
                if (this.errorHandler) {
                    this.errorHandler(error as Error);
                }
            }
        }
    }

    broadcast(message: NetworkMessage): void {
        const data = JSON.stringify(message);
        for (const [clientId, socket] of this.clients) {
            if (socket.readyState === WS_OPEN) {
                try {
                    socket.send(data);
                } catch (error) {
                    this.log(`Error broadcasting to ${this.sanitizeLog(clientId)}:`, error);
                }
            }
        }
        this.log('Broadcast:', message.type);
    }

    broadcastExcept(excludeId: string, message: NetworkMessage): void {
        const data = JSON.stringify(message);
        for (const [clientId, socket] of this.clients) {
            if (clientId !== excludeId && socket.readyState === WS_OPEN) {
                try {
                    socket.send(data);
                } catch (error) {
                    this.log(`Error broadcasting to ${this.sanitizeLog(clientId)}:`, error);
                }
            }
        }
    }

    // Client management

    getConnectedClients(): string[] {
        return Array.from(this.clients.keys());
    }

    disconnectClient(connectionId: string, reason?: string): void {
        const socket = this.clients.get(connectionId);
        if (socket) {
            socket.close(1000, reason || 'Disconnected by server');
            this.clients.delete(connectionId);
            this.socketToId.delete(socket);
            if (this.disconnectHandler) {
                this.disconnectHandler(connectionId, reason);
            }
        }
    }

    // Event handlers

    onMessage(handler: (message: NetworkMessage, senderId?: string) => void): void {
        this.messageHandler = handler;
    }

    onConnect(handler: (connectionId: string) => void): void {
        this.connectHandler = handler;
    }

    onDisconnect(handler: (connectionId: string, reason?: string) => void): void {
        this.disconnectHandler = handler;
    }

    onError(handler: (error: Error) => void): void {
        this.errorHandler = handler;
    }

    // Cleanup

    destroy(): void {
        this.close();
        this.messageHandler = null;
        this.connectHandler = null;
        this.disconnectHandler = null;
        this.errorHandler = null;
    }

    // Private methods

    private handleConnection(socket: WebSocketLike): void {
        const clientId = `client_${++this.clientIdCounter}_${Date.now()}`;
        this.clients.set(clientId, socket);
        this.socketToId.set(socket, clientId);

        this.log(`Client connected: ${this.sanitizeLog(clientId)}`);

        if (this.connectHandler) {
            this.connectHandler(clientId);
        }

        socket.on('message', (data: unknown) => {
            try {
                const message = JSON.parse(String(data)) as NetworkMessage;
                if (this.messageHandler) {
                    this.messageHandler(message, clientId);
                }
            } catch (error) {
                this.log(`Error parsing message from ${this.sanitizeLog(clientId)}:`, error);
            }
        });

        socket.on('close', (...args: unknown[]) => {
            const code = args[0] as number;
            const reason = args[1] as string;
            this.log(
                `Client disconnected: ${this.sanitizeLog(clientId)}, code: ${code}, reason: ${this.sanitizeLog(reason)}`
            );
            this.clients.delete(clientId);
            this.socketToId.delete(socket);
            if (this.disconnectHandler) {
                this.disconnectHandler(clientId, reason || `Code: ${code}`);
            }
        });

        socket.on('error', (...args: unknown[]) => {
            const error = args[0] as Error;
            this.log(`Socket error for ${this.sanitizeLog(clientId)}:`, error);
            if (this.errorHandler) {
                this.errorHandler(error);
            }
        });
    }

    private log(...args: unknown[]): void {
        if (this.debug) {
            console.log('[WebSocketServerTransport]', ...args);
        }
    }

    /**
     * Sanitize string for safe logging to prevent log injection attacks.
     * Removes newlines, ANSI escape sequences, and control characters.
     */
    private sanitizeLog(str: string): string {
        if (typeof str !== 'string') return String(str);
        let result = '';
        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            // Skip ANSI escape sequences (ESC [ ... letter)
            if (code === 0x1b && str[i + 1] === '[') {
                let j = i + 2;
                while (j < str.length && ((str[j]! >= '0' && str[j]! <= '9') || str[j] === ';')) {
                    j++;
                }
                if (j < str.length && str[j]! >= 'A' && str[j]! <= 'z') {
                    i = j;
                    continue;
                }
            }
            // Skip control characters (0x00-0x1f and 0x7f)
            if (code < 0x20 || code === 0x7f) {
                continue;
            }
            result += str[i]!;
        }
        return result;
    }
}

/**
 * Create a WebSocket server transport with the 'ws' library
 *
 * @example
 * ```typescript
 * import { WebSocketServer } from 'ws';
 * import { createWebSocketServerTransport } from '@orion-ecs/network';
 *
 * const transport = createWebSocketServerTransport(WebSocketServer, { debug: true });
 * await transport.listen(8080);
 * ```
 */
export function createWebSocketServerTransport(
    WebSocketServer: new (options: {
        port?: number;
        host?: string;
        noServer?: boolean;
    }) => WebSocketServerLike,
    options: { debug?: boolean } = {}
): WebSocketServerTransport {
    return new WebSocketServerTransport(WebSocketServer, options.debug);
}
