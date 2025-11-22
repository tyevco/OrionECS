/**
 * Browser wrapper for Pixi.js integration example
 * Initializes Pixi.js and demonstrates ECS-Pixi integration
 */

import { Application } from 'pixi.js';
import {
    createExampleScene,
    engine,
    gameLoop,
    init,
    PixiAppManager,
    pixiManager,
} from './pixi-example';

// UI elements
const entityCountEl = document.getElementById('entity-count')!;
const fpsEl = document.getElementById('fps')!;
const canvasContainer = document.getElementById('pixi-canvas')!;

// FPS tracking
let frameCount = 0;
let lastFpsTime = performance.now();
let currentFps = 60;

// Initialize Pixi Application
const app = new Application();

async function initPixi() {
    await app.init({
        width: 800,
        height: 600,
        backgroundColor: 0x1e3c72,
    });

    // Append canvas to container
    canvasContainer.appendChild(app.canvas);

    // Set up the Pixi manager with the application
    if (pixiManager instanceof PixiAppManager) {
        pixiManager.app = app;

        // Load textures (if any)
        // For this example, we'll use procedural graphics
        // In a real app, you would load sprite textures here:
        // await Assets.load(['player.png', 'enemy.png']);
        // pixiManager.textures['player'] = Assets.get('player');

        console.log('✓ Pixi.js initialized');
    }

    // Initialize the ECS systems
    await init();

    // Create example scene
    createExampleScene();

    console.log('✓ Example scene created');
}

// Update UI stats
function updateStats() {
    // Update entity count
    const entityCount = engine.getAllEntities().length;
    entityCountEl.textContent = entityCount.toString();

    // Update FPS
    frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - lastFpsTime;

    if (deltaTime >= 1000) {
        currentFps = Math.round((frameCount * 1000) / deltaTime);
        fpsEl.textContent = currentFps.toString();
        frameCount = 0;
        lastFpsTime = currentTime;
    }
}

// Main game loop
function browserGameLoop() {
    gameLoop();
    updateStats();
    requestAnimationFrame(browserGameLoop);
}

// Start the application
initPixi()
    .then(() => {
        console.log('🎨 Pixi.js integration example started!');
        browserGameLoop();
    })
    .catch((error) => {
        console.error('Failed to initialize Pixi.js:', error);
    });
