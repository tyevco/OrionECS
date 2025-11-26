/**
 * Network Transport Implementations
 *
 * This module exports the transport layer implementations for the Network Plugin.
 * Additional transports (Socket.IO, WebRTC, etc.) can be added here.
 */

export {
    createWebSocketClientTransport,
    type WebSocketClientOptions,
    WebSocketClientTransport,
} from './WebSocketClientTransport';
export {
    createWebSocketServerTransport,
    WebSocketServerTransport,
} from './WebSocketServerTransport';
