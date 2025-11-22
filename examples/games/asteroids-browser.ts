/**
 * Browser wrapper for Asteroids game
 * Adds canvas rendering and keyboard input to the core game logic
 */

import {
    Asteroid,
    engine,
    gameLoop,
    InputState,
    initGame,
    Player,
    Position,
    Renderable,
    Rotation,
} from './asteroids';

// Constants
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

// Canvas setup
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// UI elements
const scoreEl = document.getElementById('score')!;
const livesEl = document.getElementById('lives')!;
const gameOverEl = document.getElementById('game-over')!;
const finalScoreEl = document.getElementById('final-score')!;
const restartBtn = document.getElementById('restart')!;

// Game state
let isGameOver = false;

// Initialize the game
initGame();

// Get player entity for UI updates
function getPlayer() {
    const entities = engine.getEntitiesWithComponent(Player);
    return entities.length > 0 ? entities[0] : null;
}

// Keyboard input handling
const keys: { [key: string]: boolean } = {};

window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;

    const player = getPlayer();
    if (player) {
        const input = player.getComponent(InputState);
        if (input) {
            input.left = keys['arrowleft'] || keys['a'];
            input.right = keys['arrowright'] || keys['d'];
            input.thrust = keys['arrowup'] || keys['w'];
            input.shoot = keys[' '] || keys['space'];
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;

    const player = getPlayer();
    if (player) {
        const input = player.getComponent(InputState);
        if (input) {
            input.left = keys['arrowleft'] || keys['a'];
            input.right = keys['arrowright'] || keys['d'];
            input.thrust = keys['arrowup'] || keys['w'];
            input.shoot = keys[' '] || keys['space'];
        }
    }
});

// Rendering
function render() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Render all entities with Position and Renderable components
    const entities = engine.getEntitiesWithComponent(Position);

    for (const entity of entities) {
        const position = entity.getComponent(Position);
        const renderable = entity.getComponent(Renderable);

        if (!position || !renderable) continue;

        const rotation = entity.getComponent(Rotation);
        const angle = rotation ? rotation.angle : 0;

        ctx.save();
        ctx.translate(position.x, position.y);
        ctx.rotate(angle);

        // Draw based on sprite type
        ctx.strokeStyle = renderable.color;
        ctx.fillStyle = renderable.color;
        ctx.lineWidth = 2;

        switch (renderable.sprite) {
            case 'player': {
                // Draw ship as triangle
                const size = renderable.size * 15;
                ctx.beginPath();
                ctx.moveTo(size, 0);
                ctx.lineTo(-size, size);
                ctx.lineTo(-size * 0.5, 0);
                ctx.lineTo(-size, -size);
                ctx.closePath();
                ctx.stroke();

                // Draw thrust flame if thrusting
                if (entity.hasComponent(InputState)) {
                    const input = entity.getComponent(InputState)!;
                    if (input.thrust) {
                        ctx.fillStyle = '#FFA500';
                        ctx.beginPath();
                        ctx.moveTo(-size, size * 0.5);
                        ctx.lineTo(-size * 1.5, 0);
                        ctx.lineTo(-size, -size * 0.5);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
                break;
            }
            case 'asteroid': {
                // Draw asteroid as irregular polygon
                const asteroid = entity.getComponent(Asteroid);
                const size = asteroid ? asteroid.size * 15 : 30;
                const sides = 8;
                ctx.beginPath();
                for (let i = 0; i <= sides; i++) {
                    const angle = (Math.PI * 2 * i) / sides;
                    const radius = size * (0.8 + Math.random() * 0.4);
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.stroke();
                break;
            }
            case 'bullet': {
                // Draw bullet as small circle
                const size = renderable.size * 3;
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
        }

        ctx.restore();
    }
}

// Update UI
function updateUI() {
    const player = getPlayer();

    if (player) {
        const playerComp = player.getComponent(Player);
        if (playerComp) {
            scoreEl.textContent = playerComp.score.toString();
            livesEl.textContent = playerComp.lives.toString();

            // Check for game over
            if (playerComp.lives <= 0 && !isGameOver) {
                isGameOver = true;
                showGameOver(playerComp.score);
            }
        }
    }
}

// Show game over screen
function showGameOver(score: number) {
    finalScoreEl.textContent = score.toString();
    gameOverEl.style.display = 'block';
}

// Restart game
restartBtn.addEventListener('click', () => {
    // Clear all entities
    const allEntities = engine.getAllEntities();
    for (const entity of allEntities) {
        entity.queueFree();
    }

    // Re-initialize
    initGame();
    isGameOver = false;
    gameOverEl.style.display = 'none';
});

// Main game loop
function browserGameLoop() {
    if (!isGameOver) {
        gameLoop();
        render();
        updateUI();
    }
    requestAnimationFrame(browserGameLoop);
}

// Start the game
browserGameLoop();

console.log('🎮 Asteroids game started!');
console.log('Controls: Arrow Keys / WASD to move, Space to shoot');
