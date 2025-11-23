/**
 * Browser wrapper for Space Shooter game
 * Adds canvas rendering and keyboard input to the core game logic
 */

import {
    Background,
    Bullet,
    Collider,
    Enemy,
    engine,
    gameLoop,
    Health,
    InputState,
    initGame,
    Player,
    Position,
    PowerUp,
    Renderable,
    Velocity,
    waveManager,
} from './space-shooter';

// Constants
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

// Canvas setup
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// UI elements
const scoreEl = document.getElementById('score')!;
const livesEl = document.getElementById('lives')!;
const healthEl = document.getElementById('health')!;
const waveEl = document.getElementById('wave')!;
const powerLevelEl = document.getElementById('power-level')!;
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
            input.up = keys['arrowup'] || keys['w'];
            input.down = keys['arrowdown'] || keys['s'];
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
            input.up = keys['arrowup'] || keys['w'];
            input.down = keys['arrowdown'] || keys['s'];
            input.shoot = keys[' '] || keys['space'];
        }
    }
});

// Background star field
interface Star {
    x: number;
    y: number;
    size: number;
    speed: number;
    brightness: number;
}

const stars: Star[] = [];
for (let i = 0; i < 100; i++) {
    stars.push({
        x: Math.random() * SCREEN_WIDTH,
        y: Math.random() * SCREEN_HEIGHT,
        size: Math.random() * 2,
        speed: Math.random() * 50 + 25,
        brightness: Math.random() * 0.5 + 0.5,
    });
}

function updateStars(dt: number) {
    for (const star of stars) {
        star.y += star.speed * dt;
        if (star.y > SCREEN_HEIGHT) {
            star.y = 0;
            star.x = Math.random() * SCREEN_WIDTH;
        }
    }
}

function renderStars() {
    ctx.fillStyle = '#FFF';
    for (const star of stars) {
        ctx.globalAlpha = star.brightness;
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
}

// Rendering
function render() {
    // Clear canvas with dark space background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Render star field
    renderStars();

    // Render all entities with Position and Renderable components
    const entities = engine.getEntitiesWithComponent(Position);

    // Sort entities by layer (background first, then game objects)
    const sortedEntities = entities.sort((a, b) => {
        const aBackground = a.hasComponent(Background);
        const bBackground = b.hasComponent(Background);
        if (aBackground && !bBackground) return -1;
        if (!aBackground && bBackground) return 1;
        return 0;
    });

    for (const entity of sortedEntities) {
        const position = entity.getComponent(Position);
        const renderable = entity.getComponent(Renderable);

        if (!position || !renderable) continue;

        ctx.save();
        ctx.translate(position.x, position.y);

        // Draw based on sprite type
        ctx.strokeStyle = renderable.color;
        ctx.fillStyle = renderable.color;
        ctx.lineWidth = 2;

        // Check if player is invulnerable and add flashing effect
        if (entity.hasComponent(Player)) {
            const player = entity.getComponent(Player)!;
            if (player.invulnerable > 0) {
                ctx.globalAlpha = Math.sin(Date.now() / 50) * 0.3 + 0.7;
            }
        }

        switch (renderable.sprite) {
            case 'player-ship': {
                // Draw player ship as a triangle/arrow
                const w = renderable.width / 2;
                const h = renderable.height / 2;

                ctx.beginPath();
                ctx.moveTo(0, -h);
                ctx.lineTo(-w, h);
                ctx.lineTo(0, h * 0.6);
                ctx.lineTo(w, h);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Draw engine glow
                ctx.fillStyle = '#4444FF';
                ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.5;
                ctx.beginPath();
                ctx.arc(0, h * 0.7, w * 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;
            }

            case 'enemy-basic': {
                // Draw basic enemy as inverted triangle
                const w = renderable.width / 2;
                const h = renderable.height / 2;

                ctx.beginPath();
                ctx.moveTo(0, h);
                ctx.lineTo(-w, -h);
                ctx.lineTo(w, -h);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
            }

            case 'enemy-fast': {
                // Draw fast enemy as diamond
                const w = renderable.width / 2;
                const h = renderable.height / 2;

                ctx.beginPath();
                ctx.moveTo(0, -h);
                ctx.lineTo(w, 0);
                ctx.lineTo(0, h);
                ctx.lineTo(-w, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
            }

            case 'enemy-tank': {
                // Draw tank enemy as hexagon
                const w = renderable.width / 2;
                const h = renderable.height / 2;

                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    const x = Math.cos(angle) * w;
                    const y = Math.sin(angle) * h;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
            }

            case 'boss': {
                // Draw boss as large octagon with details
                const w = renderable.width / 2;
                const h = renderable.height / 2;

                // Outer shape
                ctx.lineWidth = 3;
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI / 4) * i;
                    const x = Math.cos(angle) * w;
                    const y = Math.sin(angle) * h;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Inner details
                ctx.strokeStyle = '#FF00AA';
                ctx.beginPath();
                ctx.arc(0, 0, w * 0.5, 0, Math.PI * 2);
                ctx.stroke();

                // Pulsing core
                ctx.fillStyle = '#FFFFFF';
                ctx.globalAlpha = Math.sin(Date.now() / 200) * 0.3 + 0.7;
                ctx.beginPath();
                ctx.arc(0, 0, w * 0.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;

                // Health bar for boss
                if (entity.hasComponent(Health)) {
                    const health = entity.getComponent(Health)!;
                    const barWidth = renderable.width;
                    const barHeight = 8;
                    const barY = -renderable.height / 2 - 15;

                    // Background
                    ctx.fillStyle = '#333';
                    ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

                    // Health
                    ctx.fillStyle = '#FF0000';
                    const healthPercent = health.current / health.max;
                    ctx.fillRect(-barWidth / 2, barY, barWidth * healthPercent, barHeight);

                    // Border
                    ctx.strokeStyle = '#FFF';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(-barWidth / 2, barY, barWidth, barHeight);
                }
                break;
            }

            case 'bullet': {
                // Draw player bullet as elongated rectangle
                ctx.fillRect(
                    -renderable.width / 2,
                    -renderable.height / 2,
                    renderable.width,
                    renderable.height
                );

                // Add glow effect
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(
                    -renderable.width / 2 - 1,
                    -renderable.height / 2 - 1,
                    renderable.width + 2,
                    renderable.height + 2
                );
                ctx.globalAlpha = 1;
                break;
            }

            case 'enemy-bullet': {
                // Draw enemy bullet as circle
                ctx.beginPath();
                ctx.arc(0, 0, renderable.width / 2, 0, Math.PI * 2);
                ctx.fill();

                // Add glow
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = '#FF8888';
                ctx.beginPath();
                ctx.arc(0, 0, renderable.width / 2 + 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;
            }

            case 'powerup-health': {
                // Draw health power-up as cross
                const size = renderable.width / 2;
                const thickness = size / 3;

                ctx.fillRect(-thickness / 2, -size, thickness, size * 2);
                ctx.fillRect(-size, -thickness / 2, size * 2, thickness);

                // Pulsing effect
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1;
                ctx.globalAlpha = Math.sin(Date.now() / 150) * 0.3 + 0.7;
                ctx.strokeRect(-size, -size, size * 2, size * 2);
                ctx.globalAlpha = 1;
                break;
            }

            case 'powerup-weapon': {
                // Draw weapon power-up as star
                const size = renderable.width / 2;
                const spikes = 5;

                ctx.beginPath();
                for (let i = 0; i < spikes * 2; i++) {
                    const angle = (Math.PI / spikes) * i - Math.PI / 2;
                    const radius = i % 2 === 0 ? size : size / 2;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Rotation effect
                ctx.globalAlpha = 0.5;
                ctx.rotate(Date.now() / 500);
                ctx.strokeStyle = '#FFFF88';
                ctx.stroke();
                ctx.globalAlpha = 1;
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
        const health = player.getComponent(Health);

        if (playerComp && health) {
            scoreEl.textContent = playerComp.score.toString();
            livesEl.textContent = playerComp.lives.toString();
            healthEl.textContent = `${Math.max(0, health.current)}/${health.max}`;
            powerLevelEl.textContent = playerComp.powerLevel.toString();

            // Update wave number
            if (waveManager) {
                waveEl.textContent = waveManager.currentWave.toString();
            }

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
    gameOverEl.style.display = 'flex';
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
let lastTime = performance.now();

function browserGameLoop(currentTime: number) {
    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    if (!isGameOver) {
        gameLoop();
        updateStars(dt);
        render();
        updateUI();
    } else {
        // Still render even when game is over
        render();
    }

    requestAnimationFrame(browserGameLoop);
}

// Start the game
requestAnimationFrame(browserGameLoop);

console.log('🚀 Space Shooter game started!');
console.log('Controls:');
console.log('  - Arrow Keys / WASD: Move');
console.log('  - Space: Shoot');
console.log('');
console.log('Features:');
console.log('  - Wave-based enemy spawning');
console.log('  - Boss battles every 5 waves');
console.log('  - Power-ups (health, weapons)');
console.log('  - Multiple enemy types');
console.log('  - Score tracking and lives system');
