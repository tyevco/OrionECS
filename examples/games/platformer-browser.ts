/**
 * Browser wrapper for Platformer game
 * Adds canvas rendering and keyboard input to the core game logic
 */

import {
    BoxCollider,
    Camera,
    Collectible,
    EnemyAI,
    engine,
    gameLoop,
    Input,
    initGame,
    Platform,
    PlayerController,
    PlayerStats,
    Position,
    Sprite,
} from './platformer';

// Constants
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

// Canvas setup
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// UI elements
const coinsEl = document.getElementById('coins')!;
const totalCoinsEl = document.getElementById('total-coins')!;
const timeEl = document.getElementById('time')!;

// Game state
let gameTime = 0;

// Initialize the game
initGame();

// Count total coins
const totalCoins = engine.getEntitiesWithComponent(Collectible).length;
totalCoinsEl.textContent = totalCoins.toString();

// Get player entity
function getPlayer() {
    const entities = engine.getEntitiesWithComponent(PlayerController);
    return entities.length > 0 ? entities[0] : null;
}

// Get camera
function getCamera() {
    const entities = engine.getEntitiesWithComponent(Camera);
    return entities.length > 0 ? entities[0].getComponent(Camera) : null;
}

// Keyboard input handling
const keys: { [key: string]: boolean } = {};
let previousJumpState = false;

window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    updatePlayerInput();
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    updatePlayerInput();
});

function updatePlayerInput() {
    const player = getPlayer();
    if (player) {
        const input = player.getComponent(Input);
        if (input) {
            input.left = keys['arrowleft'] || keys['a'];
            input.right = keys['arrowright'] || keys['d'];
            const jumpDown = keys[' '] || keys['space'] || keys['arrowup'] || keys['w'];
            input.jumpPressed = jumpDown && !previousJumpState;
            input.jump = jumpDown;
            input.down = keys['arrowdown'] || keys['s'];
            previousJumpState = jumpDown;
        }
    }
}

// Rendering
function render() {
    const camera = getCamera();
    const cameraX = camera ? camera.x : 0;
    const cameraY = camera ? camera.y : 0;

    // Clear canvas with sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    ctx.save();
    ctx.translate(-cameraX + SCREEN_WIDTH / 2, -cameraY + SCREEN_HEIGHT / 2);

    // Render platforms
    const platforms = engine.getEntitiesWithComponent(Platform);
    for (const entity of platforms) {
        const position = entity.getComponent(Position);
        const collider = entity.getComponent(BoxCollider);
        const platform = entity.getComponent(Platform);

        if (!position || !collider) continue;

        ctx.fillStyle = platform?.isOneWay ? '#8B7355' : '#654321';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;

        const x = position.x + collider.offsetX - collider.width / 2;
        const y = position.y + collider.offsetY - collider.height / 2;

        ctx.fillRect(x, y, collider.width, collider.height);
        ctx.strokeRect(x, y, collider.width, collider.height);

        // Add texture for one-way platforms
        if (platform?.isOneWay) {
            ctx.fillStyle = '#A0826D';
            for (let i = 0; i < collider.width; i += 8) {
                ctx.fillRect(x + i, y, 4, collider.height);
            }
        }
    }

    // Render collectibles
    const collectibles = engine.getEntitiesWithComponent(Collectible);
    for (const entity of collectibles) {
        const position = entity.getComponent(Position);
        if (!position) continue;

        // Draw coin
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(position.x, position.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Add shine effect
        ctx.fillStyle = '#FFEB3B';
        ctx.beginPath();
        ctx.arc(position.x - 3, position.y - 3, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Render enemies
    const enemies = engine.getEntitiesWithComponent(EnemyAI);
    for (const entity of enemies) {
        const position = entity.getComponent(Position);
        const collider = entity.getComponent(BoxCollider);

        if (!position || !collider) continue;

        // Draw enemy as red rectangle with angry face
        ctx.fillStyle = '#FF4444';
        ctx.strokeStyle = '#CC0000';
        ctx.lineWidth = 2;

        const x = position.x + collider.offsetX - collider.width / 2;
        const y = position.y + collider.offsetY - collider.height / 2;

        ctx.fillRect(x, y, collider.width, collider.height);
        ctx.strokeRect(x, y, collider.width, collider.height);

        // Draw eyes
        ctx.fillStyle = '#FFF';
        ctx.fillRect(position.x - 8, position.y - 8, 6, 6);
        ctx.fillRect(position.x + 2, position.y - 8, 6, 6);

        // Draw pupils
        ctx.fillStyle = '#000';
        ctx.fillRect(position.x - 6, position.y - 6, 3, 3);
        ctx.fillRect(position.x + 4, position.y - 6, 3, 3);
    }

    // Render player
    const player = getPlayer();
    if (player) {
        const position = player.getComponent(Position);
        const collider = player.getComponent(BoxCollider);
        const sprite = player.getComponent(Sprite);

        if (position && collider) {
            ctx.fillStyle = '#4444FF';
            ctx.strokeStyle = '#0000CC';
            ctx.lineWidth = 2;

            const x = position.x + collider.offsetX - collider.width / 2;
            const y = position.y + collider.offsetY - collider.height / 2;

            // Flip if needed
            if (sprite?.flipX) {
                ctx.save();
                ctx.translate(position.x, 0);
                ctx.scale(-1, 1);
                ctx.translate(-position.x, 0);
            }

            ctx.fillRect(x, y, collider.width, collider.height);
            ctx.strokeRect(x, y, collider.width, collider.height);

            // Draw simple face
            ctx.fillStyle = '#FFF';
            ctx.fillRect(position.x - 8, position.y - 8, 5, 5);
            ctx.fillRect(position.x + 3, position.y - 8, 5, 5);

            // Draw pupils
            ctx.fillStyle = '#000';
            ctx.fillRect(position.x - 6, position.y - 6, 2, 2);
            ctx.fillRect(position.x + 5, position.y - 6, 2, 2);

            // Draw smile
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(position.x, position.y, 8, 0.2 * Math.PI, 0.8 * Math.PI);
            ctx.stroke();

            if (sprite?.flipX) {
                ctx.restore();
            }
        }
    }

    ctx.restore();
}

// Update UI
function updateUI(deltaTime: number) {
    gameTime += deltaTime;
    timeEl.textContent = gameTime.toFixed(1);

    const player = getPlayer();
    if (player) {
        const stats = player.getComponent(PlayerStats);
        if (stats) {
            coinsEl.textContent = stats.coinsCollected.toString();
        }
    }
}

// Main game loop
let lastTime = performance.now();

function browserGameLoop() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;

    gameLoop();
    render();
    updateUI(deltaTime);

    requestAnimationFrame(browserGameLoop);
}

// Start the game
browserGameLoop();

console.log('🏃 Platformer game started!');
console.log('Controls: Arrow Keys / A & D to move, Space / W to jump');
