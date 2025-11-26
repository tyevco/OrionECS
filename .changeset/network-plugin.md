---
"@orion-ecs/network": minor
---

Add comprehensive multiplayer networking plugin with transport-agnostic architecture

- Transport Abstraction Layer: Pluggable transport interface supporting WebSocket, Socket.IO, WebRTC, and custom implementations
- WebSocket Transports: Production-ready server (using 'ws' library) and client (browser native + Node.js) implementations
- Client-Side Prediction: Immediate response to player input with input buffering and sequence tracking
- Server Reconciliation: Automatic correction of client state when server authoritative position differs
- Entity Interpolation: Smooth movement for remote entities using snapshot interpolation with configurable delay
- Authoritative Server Architecture: Server validates all actions and maintains game state authority
- Automatic Latency Measurement: Built-in ping/pong for latency tracking and clock synchronization
- Network Components: NetworkId, NetworkPosition, NetworkVelocity, NetworkInput, InputBuffer, ServerState, InterpolationBuffer
- Configurable Settings: Tick rate, snapshot rate, interpolation delay, reconciliation window, debug mode
- Event Callbacks: onPlayerJoin, onPlayerLeave, onConnected, onDisconnected, onError
- Bouncy Box Example: Complete multiplayer demo with server and browser client
