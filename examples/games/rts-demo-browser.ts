/**
 * Browser wrapper for RTS Demo
 * Adds canvas rendering, mouse input, and UI for the RTS game
 */

import {
  engine,
  init,
  update,
  Position,
  Health,
  Owner,
  Unit,
  Building,
  ResourceNode,
  Selectable,
  selectInRect,
  selectAt,
  issueCommand,
  selectedEntities,
  playerResources,
  RTS_CONFIG,
  getStats,
  spatialGrid,
} from './rts-demo';

// Canvas setup
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

canvas.width = RTS_CONFIG.worldSize.width;
canvas.height = RTS_CONFIG.worldSize.height;

// UI elements
const statsEl = document.getElementById('stats')!;
const selectionEl = document.getElementById('selection-info')!;
const helpEl = document.getElementById('help')!;

// Camera
const camera = {
  x: 0,
  y: 0,
  zoom: 1,
  targetZoom: 1,
};

// Mouse state
const mouse = {
  x: 0,
  y: 0,
  worldX: 0,
  worldY: 0,
  isDown: false,
  dragStartX: 0,
  dragStartY: 0,
  isDragging: false,
};

// Initialize game
init();

// Mouse event handlers
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  mouse.worldX = mouse.x / camera.zoom + camera.x;
  mouse.worldY = mouse.y / camera.zoom + camera.y;
  mouse.isDown = true;
  mouse.dragStartX = mouse.worldX;
  mouse.dragStartY = mouse.worldY;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  mouse.worldX = mouse.x / camera.zoom + camera.x;
  mouse.worldY = mouse.y / camera.zoom + camera.y;

  if (mouse.isDown) {
    const dx = Math.abs(mouse.worldX - mouse.dragStartX);
    const dy = Math.abs(mouse.worldY - mouse.dragStartY);
    if (dx > 5 || dy > 5) {
      mouse.isDragging = true;
    }
  }
});

canvas.addEventListener('mouseup', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  mouse.worldX = mouse.x / camera.zoom + camera.x;
  mouse.worldY = mouse.y / camera.zoom + camera.y;

  if (mouse.isDragging) {
    // Box selection
    const minX = Math.min(mouse.dragStartX, mouse.worldX);
    const minY = Math.min(mouse.dragStartY, mouse.worldY);
    const maxX = Math.max(mouse.dragStartX, mouse.worldX);
    const maxY = Math.max(mouse.dragStartY, mouse.worldY);

    selectInRect(minX, minY, maxX, maxY, !e.shiftKey);
  } else {
    // Click selection
    selectAt(mouse.worldX, mouse.worldY, 20, !e.shiftKey);
  }

  mouse.isDown = false;
  mouse.isDragging = false;
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  mouse.worldX = mouse.x / camera.zoom + camera.x;
  mouse.worldY = mouse.y / camera.zoom + camera.y;

  // Right click - issue move command
  issueCommand({
    type: 'move',
    target: { x: mouse.worldX, y: mouse.worldY, clone: () => ({ x: mouse.worldX, y: mouse.worldY }) } as any,
  });
});

// Zoom with mouse wheel
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomSpeed = 0.1;
  camera.targetZoom += e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
  camera.targetZoom = Math.max(0.5, Math.min(2, camera.targetZoom));
});

// Keyboard camera pan
const keys: { [key: string]: boolean } = {};

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// Render function
function render() {
  // Clear canvas
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();

  // Apply camera transform
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // Draw grid
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 1;
  const gridSize = 100;

  for (let x = 0; x < RTS_CONFIG.worldSize.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, RTS_CONFIG.worldSize.height);
    ctx.stroke();
  }

  for (let y = 0; y < RTS_CONFIG.worldSize.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(RTS_CONFIG.worldSize.width, y);
    ctx.stroke();
  }

  // Draw entities
  const entities = engine.getAllEntities();

  // Sort by type for rendering order (resources, buildings, units)
  const resources = entities.filter((e) => e.hasTag('resource'));
  const buildings = entities.filter((e) => e.hasTag('building'));
  const units = entities.filter((e) => e.hasTag('unit'));

  // Draw resources
  for (const entity of resources) {
    const pos = entity.getComponent(Position);
    const resource = entity.getComponent(ResourceNode);

    ctx.fillStyle = resource.resourceType === 'minerals' ? '#4a9eff' : '#ff4a9e';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
    ctx.fill();

    // Amount text
    ctx.fillStyle = 'white';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(resource.amount).toString(), pos.x, pos.y - 20);
  }

  // Draw buildings
  for (const entity of buildings) {
    const pos = entity.getComponent(Position);
    const building = entity.getComponent(Building);
    const owner = entity.getComponent(Owner);
    const selectable = entity.getComponent(Selectable);

    const size = building.buildingType === 'base' ? 60 : 40;

    ctx.fillStyle = owner.playerId === 1 ? '#4aff4a' : '#ff4a4a';
    ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);

    // Selection
    if (selectable.isSelected) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(pos.x - size / 2, pos.y - size / 2, size, size);
    }

    // Health bar
    if (entity.hasComponent(Health)) {
      const health = entity.getComponent(Health);
      const barWidth = size;
      const barHeight = 4;
      const barY = pos.y - size / 2 - 10;

      ctx.fillStyle = '#333';
      ctx.fillRect(pos.x - barWidth / 2, barY, barWidth, barHeight);

      ctx.fillStyle = health.percentage > 60 ? '#4aff4a' : health.percentage > 30 ? '#ffff4a' : '#ff4a4a';
      ctx.fillRect(pos.x - barWidth / 2, barY, (barWidth * health.percentage) / 100, barHeight);
    }
  }

  // Draw units
  for (const entity of units) {
    const pos = entity.getComponent(Position);
    const unit = entity.getComponent(Unit);
    const owner = entity.getComponent(Owner);
    const selectable = entity.getComponent(Selectable);

    const radius = unit.unitType === 'worker' ? 6 : unit.unitType === 'tank' ? 10 : 8;

    ctx.fillStyle = owner.playerId === 1 ? '#4aff4a' : '#ff4a4a';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Selection
    if (selectable.isSelected) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Health bar
    if (entity.hasComponent(Health)) {
      const health = entity.getComponent(Health);
      const barWidth = radius * 3;
      const barHeight = 3;
      const barY = pos.y - radius - 8;

      ctx.fillStyle = '#333';
      ctx.fillRect(pos.x - barWidth / 2, barY, barWidth, barHeight);

      ctx.fillStyle = health.percentage > 60 ? '#4aff4a' : health.percentage > 30 ? '#ffff4a' : '#ff4a4a';
      ctx.fillRect(pos.x - barWidth / 2, barY, (barWidth * health.percentage) / 100, barHeight);
    }
  }

  // Draw selection box
  if (mouse.isDragging) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      mouse.dragStartX,
      mouse.dragStartY,
      mouse.worldX - mouse.dragStartX,
      mouse.worldY - mouse.dragStartY,
    );
    ctx.setLineDash([]);
  }

  ctx.restore();

  // Update UI
  updateUI();
}

// Update UI elements
function updateUI() {
  const stats = getStats();

  statsEl.innerHTML = `
    <div><strong>Entities:</strong> ${stats.entities.total} (${stats.entities.units} units, ${stats.entities.buildings} buildings, ${stats.entities.resources} resources)</div>
    <div><strong>Spatial Grid:</strong> ${stats.spatialGrid.occupiedCells} / ${stats.spatialGrid.totalCells} cells</div>
    <div><strong>Player 1:</strong> ${stats.players[0]?.minerals || 0} minerals, ${stats.players[0]?.gas || 0} gas</div>
    <div><strong>Player 2:</strong> ${stats.players[1]?.minerals || 0} minerals, ${stats.players[1]?.gas || 0} gas</div>
  `;

  if (selectedEntities.size > 0) {
    const selected = Array.from(selectedEntities)
      .map((id) => engine.getAllEntities().find((e) => e.id === id))
      .filter((e) => e);

    selectionEl.innerHTML = `
      <div><strong>Selected:</strong> ${selected.length} units</div>
      <div style="font-size: 0.9em; margin-top: 5px;">
        ${selected.map((e) => {
          if (!e) return '';
          const unit = e.hasComponent(Unit) ? e.getComponent(Unit) : null;
          const building = e.hasComponent(Building) ? e.getComponent(Building) : null;
          const health = e.hasComponent(Health) ? e.getComponent(Health) : null;

          if (unit) {
            return `${unit.unitType}: ${health ? Math.floor(health.current) : 0}/${health ? health.max : 0} HP`;
          } else if (building) {
            return `${building.buildingType}: ${health ? Math.floor(health.current) : 0}/${health ? health.max : 0} HP`;
          }
          return '';
        }).filter((s) => s).join('<br>')}
      </div>
    `;
  } else {
    selectionEl.innerHTML = '<div>No units selected</div>';
  }
}

// Update camera
function updateCamera() {
  const panSpeed = 5;

  if (keys['w'] || keys['arrowup']) camera.y -= panSpeed;
  if (keys['s'] || keys['arrowdown']) camera.y += panSpeed;
  if (keys['a'] || keys['arrowleft']) camera.x -= panSpeed;
  if (keys['d'] || keys['arrowright']) camera.x += panSpeed;

  // Smooth zoom
  camera.zoom += (camera.targetZoom - camera.zoom) * 0.1;

  // Clamp camera
  camera.x = Math.max(0, Math.min(RTS_CONFIG.worldSize.width - canvas.width / camera.zoom, camera.x));
  camera.y = Math.max(0, Math.min(RTS_CONFIG.worldSize.height - canvas.height / camera.zoom, camera.y));
}

// Game loop
function gameLoop() {
  update();
  updateCamera();
  render();
  requestAnimationFrame(gameLoop);
}

// Start game loop
gameLoop();

console.log('[RTS Browser] Started');
console.log('[RTS Browser] Controls:');
console.log('  - Left click: Select unit');
console.log('  - Left drag: Box select');
console.log('  - Right click: Move command');
console.log('  - Shift + Click: Add to selection');
console.log('  - WASD/Arrows: Pan camera');
console.log('  - Mouse wheel: Zoom');
