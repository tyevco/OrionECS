---
"orion-ecs-vscode": minor
---

Add visualization tools (Entity Hierarchy Tree, Archetype Visualizer)

Entity Hierarchy Tree:
- New EntityHierarchyTreeProvider for runtime hierarchy visualization
- Parent-child relationship tree with expand/collapse navigation
- Component count and tag information per entity
- Interactive selection with Entity Inspector integration
- Real-time updates via debug bridge
- Visual indicators for entity state and composition

Archetype Visualizer Panel:
- WebView panel displaying all engine archetypes
- Component composition breakdown per archetype
- Entity count statistics per archetype
- Performance metrics:
  - Cache hit rate tracking
  - Memory consumption per archetype
  - Query match efficiency
- Sortable views (by entity count, memory, component count)
- Color-coded memory usage indicators
- Demo mode with simulated archetype data

Enhanced Debug Protocol:
- ArchetypeSnapshot type for archetype metadata
- Memory profiling data structures
- Performance statistics aggregation
- Extended debug bridge commands for visualization

New Commands:
- `orion-ecs.showEntityHierarchy`: Open hierarchy tree view
- `orion-ecs.showArchetypeVisualizer`: Open archetype panel
- `orion-ecs.refreshHierarchy`: Refresh hierarchy data
