/**
 * Browser wrapper for Tower Defense game
 * Adds canvas rendering and mouse input to the core game logic
 */

import {
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    ENEMY_SPAWN_INTERVAL,
    Enemy,
    engine,
    GameTimer,
    gameLoop,
    Health,
    initGame,
    Position,
    Projectile,
    Renderable,
    spawnEnemy,
    Tower,
} from './tower-defense';

// Canvas setup
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
if (!canvas) {
    throw new Error('Canvas element with id "game-canvas" not found');
}

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const ctx = canvas.getContext('2d')!;

// UI elements
const scoreEl = document.getElementById('score')!;
const waveEl = document.getElementById('wave')!;
const gameOverEl = document.getElementById('game-over')!;
const restartBtn = document.getElementById('restart')!;

// Game state
let isGameOver = false;
let enemyCount = 0;
let enemiesKilled = 0;
let enemiesEscaped = 0;
let enemySpawnTimer: number | null = null;

// Initialize the game
initGame();

// Start spawning enemies
function startEnemySpawning() {
    enemySpawnTimer = window.setInterval(() => {
        spawnEnemy();
        enemyCount++;
        updateUI();
    }, ENEMY_SPAWN_INTERVAL);
}

// Update UI elements
function updateUI() {
    if (scoreEl) {
        scoreEl.textContent = `Enemies Killed: ${enemiesKilled}`;
    }
    if (waveEl) {
        waveEl.textContent = `Enemies Spawned: ${enemyCount} | Escaped: ${enemiesEscaped}`;
    }
}

// Message bus subscriptions for score tracking
engine.messageBus.subscribe('enemy-killed', () => {
    enemiesKilled++;
    updateUI();
});

engine.messageBus.subscribe('enemy-escaped', () => {
    enemiesEscaped++;
    updateUI();

    // Game over condition: too many enemies escaped
    if (enemiesEscaped >= 10) {
        handleGameOver();
    }
});

// Handle game over
function handleGameOver() {
    if (isGameOver) return;

    isGameOver = true;
    engine.stop();

    if (enemySpawnTimer !== null) {
        window.clearInterval(enemySpawnTimer);
        enemySpawnTimer = null;
    }

    if (gameOverEl) {
        gameOverEl.style.display = 'block';
        const finalScore = gameOverEl.querySelector('.final-score');
        if (finalScore) {
            finalScore.textContent = `Final Score: ${enemiesKilled} enemies killed`;
        }
    }
}

// Restart game
function restartGame() {
    isGameOver = false;
    enemyCount = 0;
    enemiesKilled = 0;
    enemiesEscaped = 0;

    // Clear all entities
    const allEntities = engine.getAllEntities();
    for (const entity of allEntities) {
        entity.queueFree();
    }
    engine.update(); // Process deletions

    // Reinitialize
    initGame();
    startEnemySpawning();
    updateUI();

    if (gameOverEl) {
        gameOverEl.style.display = 'none';
    }

    // Restart render loop
    requestAnimationFrame(renderLoop);
}

if (restartBtn) {
    restartBtn.addEventListener('click', restartGame);
}

// Rendering
function render() {
    // Clear canvas with background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid for visual reference
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
    }

    // Render towers with range indicators
    const towers = engine.getEntitiesByTag('tower');
    for (const tower of towers) {
        const position = tower.getComponent(Position);
        const renderable = tower.getComponent(Renderable);
        const towerComp = tower.getComponent(Tower);

        if (!position || !renderable || !towerComp) continue;

        // Draw range circle
        ctx.strokeStyle = 'rgba(100, 100, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(position.x, position.y, towerComp.range, 0, Math.PI * 2);
        ctx.stroke();

        // Draw tower
        ctx.fillStyle = renderable.color;
        ctx.fillRect(
            position.x - renderable.size / 2,
            position.y - renderable.size / 2,
            renderable.size,
            renderable.size
        );

        // Draw tower top (triangle)
        ctx.fillStyle = '#6060ff';
        ctx.beginPath();
        ctx.moveTo(position.x, position.y - renderable.size / 2 - 5);
        ctx.lineTo(position.x - 7, position.y - renderable.size / 2);
        ctx.lineTo(position.x + 7, position.y - renderable.size / 2);
        ctx.closePath();
        ctx.fill();
    }

    // Render enemies
    const enemies = engine.getEntitiesByTag('enemy');
    for (const enemy of enemies) {
        const position = enemy.getComponent(Position);
        const renderable = enemy.getComponent(Renderable);
        const health = enemy.getComponent(Health);

        if (!position || !renderable) continue;

        // Draw enemy
        ctx.fillStyle = renderable.color;
        ctx.beginPath();
        ctx.arc(position.x, position.y, renderable.size / 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw health bar
        if (health) {
            const healthBarWidth = 30;
            const healthBarHeight = 4;
            const healthPercent = health.current / health.max;

            // Background
            ctx.fillStyle = '#333';
            ctx.fillRect(
                position.x - healthBarWidth / 2,
                position.y - renderable.size / 2 - 10,
                healthBarWidth,
                healthBarHeight
            );

            // Health
            ctx.fillStyle = healthPercent > 0.5 ? '#0f0' : healthPercent > 0.25 ? '#ff0' : '#f00';
            ctx.fillRect(
                position.x - healthBarWidth / 2,
                position.y - renderable.size / 2 - 10,
                healthBarWidth * healthPercent,
                healthBarHeight
            );
        }
    }

    // Render projectiles
    const projectiles = engine.getEntitiesByTag('projectile');
    for (const projectile of projectiles) {
        const position = projectile.getComponent(Position);
        const renderable = projectile.getComponent(Renderable);

        if (!position || !renderable) continue;

        // Draw projectile as a small circle
        ctx.fillStyle = renderable.color;
        ctx.beginPath();
        ctx.arc(position.x, position.y, renderable.size / 2, 0, Math.PI * 2);
        ctx.fill();

        // Add glow effect
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Draw path line showing enemy path
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.2)';
    ctx.lineWidth = 40;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT / 2);
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    ctx.stroke();
}

// Main render loop
function renderLoop() {
    if (!isGameOver) {
        // Update game logic
        gameLoop();

        // Render
        render();

        // Continue loop
        requestAnimationFrame(renderLoop);
    }
}

// Mouse interaction (optional: could be used for tower placement)
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    console.log(`Clicked at: (${mouseX.toFixed(0)}, ${mouseY.toFixed(0)})`);
    // Could implement tower placement here
});

// Start the game
updateUI();
startEnemySpawning();
requestAnimationFrame(renderLoop);

console.log('Tower Defense game started in browser!');

// Export for debugging
(window as any).towerDefense = {
    engine,
    restart: restartGame,
    spawnEnemy,
    gameState: () => ({
        enemyCount,
        enemiesKilled,
        enemiesEscaped,
        isGameOver,
    }),
};
