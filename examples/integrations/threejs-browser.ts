/**
 * Browser wrapper for Three.js Integration Example
 * This example is already browser-ready, just needs initialization
 */

import { init, gameLoop } from './threejs-example';

// UI elements
const statsEl = document.getElementById('stats')!;
const instructionsEl = document.getElementById('instructions')!;

// Initialize Three.js example
async function start() {
  console.log('[Three.js Browser] Initializing...');

  await init();

  // Update stats display
  setInterval(() => {
    if (statsEl) {
      // In a real implementation, you'd get stats from the engine
      statsEl.innerHTML = `
        <div>Three.js + OrionECS Integration</div>
        <div style="margin-top: 8px; font-size: 0.9em; color: #94a3b8;">
          Install three.js to see actual 3D rendering:<br>
          <code style="color: #667eea;">npm install three</code>
        </div>
      `;
    }
  }, 1000);

  // Start game loop
  function loop() {
    gameLoop();
    requestAnimationFrame(loop);
  }
  loop();

  console.log('[Three.js Browser] Started');
}

// Show instructions
if (instructionsEl) {
  instructionsEl.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <strong>About this example:</strong>
    </div>
    <div style="font-size: 0.9em; line-height: 1.6; color: #94a3b8;">
      This example demonstrates how to integrate OrionECS with Three.js for 3D rendering.
      The example includes all the necessary code but requires the Three.js library to be installed.
    </div>
    <div style="margin-top: 1rem; padding: 1rem; background: #1e293b; border-radius: 6px; font-size: 0.85em;">
      <div style="color: #f59e0b; margin-bottom: 0.5rem;"><strong>⚠️ Installation Required</strong></div>
      <div style="color: #94a3b8; margin-bottom: 0.5rem;">
        To run this example with actual 3D rendering:
      </div>
      <div style="font-family: monospace; background: #0f172a; padding: 0.5rem; border-radius: 4px; color: #22d3ee;">
        npm install three @types/three
      </div>
      <div style="margin-top: 0.5rem; color: #94a3b8; font-size: 0.9em;">
        Then uncomment the Three.js import statements in the source code.
      </div>
    </div>
    <div style="margin-top: 1rem;">
      <strong>Features Demonstrated:</strong>
    </div>
    <ul style="margin-top: 0.5rem; margin-left: 1.5rem; font-size: 0.9em; line-height: 1.8; color: #94a3b8;">
      <li>3D Transform components (position, rotation, scale)</li>
      <li>Mesh and material synchronization</li>
      <li>Camera and lighting management</li>
      <li>Scene graph integration</li>
      <li>Component lifecycle hooks</li>
      <li>Advanced patterns (LOD, instancing, raycasting)</li>
    </ul>
    <div style="margin-top: 1rem; padding: 1rem; background: #064e3b; border-left: 3px solid #10b981; font-size: 0.85em;">
      <div style="color: #10b981; margin-bottom: 0.5rem;"><strong>💡 Code Ready</strong></div>
      <div style="color: #d1fae5;">
        The source code at <code>examples/integrations/threejs-example.ts</code>
        contains a complete, production-ready integration that you can use as a template
        for your own Three.js + OrionECS projects.
      </div>
    </div>
  `;
}

start();
