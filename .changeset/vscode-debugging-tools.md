---
"orion-ecs-vscode": minor
---

Add debugging tools (Entity Inspector, System Visualizer)

Entity Inspector Panel:
- WebView panel for deep entity inspection
- Live component data visualization with JSON formatting
- Tag list display and management
- Parent/child hierarchy navigation
- Real-time updates via debug bridge
- Demo mode for testing without live engine

System Visualizer Panel:
- Comprehensive system performance analysis
- Execution time tracking and profiling
- Query match statistics (entities processed per update)
- System priority visualization
- Enable/disable system controls
- Sortable by execution time or priority

Debug Bridge:
- WebSocket-based communication between extension and engine
- Entity snapshot protocol for live inspection
- System profiling data aggregation
- Extensible command/response architecture
