---
"@orion-ecs/entity-inspector": minor
---

Add Entity Inspector plugin for web-based runtime debugging

New plugin providing real-time visualization and editing of entities, components, and systems through a browser-based interface:

- WebSocket server for live data streaming with sub-100ms latency
- Entity hierarchy tree view with search and filtering capabilities
- Component property viewing and live editing with type-specific inputs
- System execution timeline and profiling data
- Performance metrics including FPS, frame time chart, and memory statistics
- Pause/resume/step debugging controls for frame-by-frame inspection
- Support for 1000+ entities without UI lag
- Production-safe design: easily disabled in production builds
