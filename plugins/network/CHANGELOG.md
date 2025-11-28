# @orion-ecs/network

## 0.4.0

### Minor Changes

- [#212](https://github.com/tyevco/OrionECS/pull/212) [`bea2843`](https://github.com/tyevco/OrionECS/commit/bea2843884b2f46ae23a1ac1199b6580502bf406) Thanks [@tyevco](https://github.com/tyevco)! - Add comprehensive multiplayer networking plugin with transport-agnostic architecture

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

### Patch Changes

- [#263](https://github.com/tyevco/OrionECS/pull/263) [`e4a40d8`](https://github.com/tyevco/OrionECS/commit/e4a40d8c192688f1c767a10e1089e939b3f95e39) Thanks [@tyevco](https://github.com/tyevco)! - Fix log injection vulnerability with centralized Logger

  - Add Logger interface to @orion-ecs/plugin-api for secure, structured logging
  - Create EngineLogger implementation with automatic sanitization of ANSI escape sequences and control characters
  - Update NetworkPlugin to use centralized logger via PluginContext
  - Plugins now import types from @orion-ecs/plugin-api for lighter dependencies
