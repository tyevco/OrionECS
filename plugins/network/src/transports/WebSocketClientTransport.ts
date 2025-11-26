/**
 * WebSocket Client Transport for OrionECS Network Plugin
 *
 * Works in both browser (native WebSocket) and Node.js (with 'ws' library).
 *
 * @example Browser:
 * ```typescript
 * import { WebSocketClientTransport } from '@orion-ecs/network';
 *
 * const transport = new WebSocketClientTransport();
 * await transport.connect('ws://localhost:8080');
 *
 * transport.onMessage((message) => {
 *   console.log('Received:', message);
 * });
 *
 * transport.send({ type: 'join', timestamp: Date.now(), data: { playerName: 'Player1' } });
 * ```
 *
 * @example Node.js:
 * ```typescript
 * import WebSocket from 'ws';
 * import { WebSocketClientTransport } from '@orion-ecs/network';
 *
 * const transport = new WebSocketClientTransport({ WebSocket });
 * await transport.connect('ws://localhost:8080');
 * ```
 */

import type { ClientTransport, ConnectionState, NetworkMessage } from '../types';

// Type for WebSocket (works with both browser and 'ws' library)
interface WebSocketLike {
    readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    onopen: ((event: unknown) => void) | null;
    onclose: ((event: { code: number; reason: string }) => void) | null;
    onmessage: ((event: { data: unknown }) => void) | null;
    onerror: ((event: { error?: Error }) => void) | null;
}

type WebSocketConstructor = new (url: string) => WebSocketLike;

// WebSocket ready states
const WS_CONNECTING = 0;
const WS_OPEN = 1;

export interface WebSocketClientOptions {
    /** WebSocket constructor (browser native or 'ws' library) */
    WebSocket?: WebSocketConstructor;

    /** Enable debug logging */
    debug?: boolean;

    /** Auto-reconnect on disconnect */
    autoReconnect?: boolean;

    /** Reconnection delay in ms */
    reconnectDelay?: number;

    /** Maximum reconnection attempts */
    maxReconnectAttempts?: number;

    /** Ping interval in ms (0 to disable) */
    pingInterval?: number;
}

/**
 * WebSocket client transport implementation
 */
export class WebSocketClientTransport implements ClientTransport {
    private socket: WebSocketLike | null = null;
    private url: string = '';
    private reconnectAttempts = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private pingTimer: ReturnType<typeof setInterval> | null = null;

    // Latency tracking
    private _latency = 0;
    private _serverTimeOffset = 0;
    private lastPingTime = 0;
    private pingSequence = 0;

    // Event handlers
    private messageHandler: ((message: NetworkMessage, senderId?: string) => void) | null = null;
    private connectHandler: ((connectionId: string) => void) | null = null;
    private disconnectHandler: ((connectionId: string, reason?: string) => void) | null = null;
    private errorHandler: ((error: Error) => void) | null = null;

    private _state: ConnectionState = 'disconnected';
    private _connectionId?: string;

    // Options
    private readonly WebSocketImpl: WebSocketConstructor;
    private readonly debug: boolean;
    private readonly autoReconnect: boolean;
    private readonly reconnectDelay: number;
    private readonly maxReconnectAttempts: number;
    private readonly pingInterval: number;

    constructor(options: WebSocketClientOptions = {}) {
        // Use browser WebSocket if available, otherwise require it to be passed
        this.WebSocketImpl =
            options.WebSocket ??
            ((typeof WebSocket !== 'undefined'
                ? WebSocket
                : null) as unknown as WebSocketConstructor);

        if (!this.WebSocketImpl) {
            throw new Error(
                'WebSocket not available. In Node.js, pass the WebSocket constructor: new WebSocketClientTransport({ WebSocket })'
            );
        }

        this.debug = options.debug ?? false;
        this.autoReconnect = options.autoReconnect ?? true;
        this.reconnectDelay = options.reconnectDelay ?? 1000;
        this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
        this.pingInterval = options.pingInterval ?? 5000;
    }

    get state(): ConnectionState {
        return this._state;
    }

    get connectionId(): string | undefined {
        return this._connectionId;
    }

    get latency(): number {
        return this._latency;
    }

    get serverTimeOffset(): number {
        return this._serverTimeOffset;
    }

    // Lifecycle

    async connect(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._state === 'connected' || this._state === 'connecting') {
                reject(new Error('Already connected or connecting'));
                return;
            }

            this.url = url;
            this._state = 'connecting';
            this.log(`Connecting to ${url}`);

            try {
                this.socket = new this.WebSocketImpl(url);

                this.socket.onopen = () => {
                    this._state = 'connected';
                    this.reconnectAttempts = 0;
                    this.log('Connected');

                    // Start ping timer
                    if (this.pingInterval > 0) {
                        this.startPingTimer();
                    }

                    // Generate connection ID (will be replaced by server's assigned ID)
                    this._connectionId = `local_${Date.now()}`;

                    if (this.connectHandler) {
                        this.connectHandler(this._connectionId);
                    }

                    resolve();
                };

                this.socket.onclose = (event) => {
                    const wasConnected = this._state === 'connected';
                    this._state = 'disconnected';
                    this.stopPingTimer();

                    this.log(
                        `Disconnected: code=${event.code}, reason=${this.sanitizeLog(event.reason || '')}`
                    );

                    if (this.disconnectHandler) {
                        this.disconnectHandler(
                            this._connectionId || '',
                            event.reason || `Code: ${event.code}`
                        );
                    }

                    // Auto-reconnect if enabled and was previously connected
                    if (
                        wasConnected &&
                        this.autoReconnect &&
                        this.reconnectAttempts < this.maxReconnectAttempts
                    ) {
                        this.scheduleReconnect();
                    }
                };

                this.socket.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.socket.onerror = (event) => {
                    const error = event.error ?? new Error('WebSocket error');
                    this.log('Error:', error);

                    if (this.errorHandler) {
                        this.errorHandler(error);
                    }

                    // If we were still connecting, reject the promise
                    if (this._state === 'connecting') {
                        this._state = 'disconnected';
                        reject(error);
                    }
                };
            } catch (error) {
                this._state = 'disconnected';
                reject(error);
            }
        });
    }

    disconnect(): void {
        // Prevent auto-reconnect
        if (this.autoReconnect) {
            this.reconnectAttempts = this.maxReconnectAttempts;
        }
        this.stopPingTimer();
        this.cancelReconnect();

        if (this.socket) {
            if (this.socket.readyState === WS_OPEN || this.socket.readyState === WS_CONNECTING) {
                this.socket.close(1000, 'Client disconnect');
            }
            this.socket = null;
        }

        this._state = 'disconnected';
    }

    // Messaging

    send(message: NetworkMessage): void {
        if (!this.socket || this.socket.readyState !== WS_OPEN) {
            this.log('Cannot send: not connected');
            return;
        }

        try {
            this.socket.send(JSON.stringify(message));
            this.log('Sent:', message.type);
        } catch (error) {
            this.log('Send error:', error);
            if (this.errorHandler) {
                this.errorHandler(error as Error);
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
        this.disconnect();
        this.messageHandler = null;
        this.connectHandler = null;
        this.disconnectHandler = null;
        this.errorHandler = null;
    }

    // Latency measurement

    /**
     * Send a ping to measure latency
     */
    sendPing(): void {
        this.lastPingTime = Date.now();
        this.send({
            type: 'ping',
            timestamp: this.lastPingTime,
            data: {
                clientTime: this.lastPingTime,
                sequence: ++this.pingSequence,
            },
        });
    }

    /**
     * Update connection ID (called when server assigns an ID)
     */
    setConnectionId(id: string): void {
        this._connectionId = id;
    }

    // Private methods

    private handleMessage(data: unknown): void {
        try {
            const message = JSON.parse(String(data)) as NetworkMessage;

            // Handle pong messages for latency calculation
            if (message.type === 'pong') {
                const pongData = message.data as { clientTime: number; serverTime: number };
                const now = Date.now();
                this._latency = now - pongData.clientTime;
                this._serverTimeOffset = pongData.serverTime - now + this._latency / 2;
                this.log(`Latency: ${this._latency}ms, Server offset: ${this._serverTimeOffset}ms`);
            }

            // Handle join_accepted to get our connection ID
            if (message.type === 'join_accepted') {
                const joinData = message.data as { clientId: string };
                this._connectionId = joinData.clientId;
                this.log(`Assigned connection ID: ${this.sanitizeLog(this._connectionId)}`);
            }

            if (this.messageHandler) {
                this.messageHandler(message);
            }
        } catch (error) {
            this.log('Error parsing message:', error);
        }
    }

    private startPingTimer(): void {
        this.stopPingTimer();
        this.pingTimer = setInterval(() => {
            if (this._state === 'connected') {
                this.sendPing();
            }
        }, this.pingInterval);
    }

    private stopPingTimer(): void {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * 2 ** (this.reconnectAttempts - 1); // Exponential backoff

        this.log(
            `Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
        );
        this._state = 'reconnecting';

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            try {
                await this.connect(this.url);
            } catch (error) {
                this.log('Reconnect failed:', error);
            }
        }, delay);
    }

    private cancelReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private log(...args: unknown[]): void {
        if (this.debug) {
            console.log('[WebSocketClientTransport]', ...args);
        }
    }

    /**
     * Sanitize string for safe logging (remove newlines to prevent log injection)
     */
    private sanitizeLog(str: string): string {
        return str.replace(/[\r\n]/g, '');
    }
}

/**
 * Create a WebSocket client transport
 *
 * @example Browser:
 * ```typescript
 * const transport = createWebSocketClientTransport({ debug: true });
 * await transport.connect('ws://localhost:8080');
 * ```
 *
 * @example Node.js:
 * ```typescript
 * import WebSocket from 'ws';
 * const transport = createWebSocketClientTransport({ WebSocket, debug: true });
 * await transport.connect('ws://localhost:8080');
 * ```
 */
export function createWebSocketClientTransport(
    options: WebSocketClientOptions = {}
): WebSocketClientTransport {
    return new WebSocketClientTransport(options);
}
