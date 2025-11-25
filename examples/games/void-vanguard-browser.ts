/**
 * Browser wrapper for Void Vanguard game
 * Adds canvas rendering and keyboard input to the core game logic
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
    DivingState,
    DyingState,
    EnemyTag,
    engine,
    FormationState,
    gameLoop,
    InputState,
    initGame,
    PlayerData,
    PlayerTag,
    Position,
    Renderable,
    ReturningState,
    SCREEN_HEIGHT,
    SCREEN_WIDTH,
    StateMachine,
} from './void-vanguard';

// Canvas setup
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// UI elements
const scoreEl = document.getElementById('score')!;
const livesEl = document.getElementById('lives')!;
const gameOverEl = document.getElementById('game-over')!;
const finalScoreEl = document.getElementById('final-score')!;
const restartBtn = document.getElementById('restart')!;
const stateInfoEl = document.getElementById('state-info')!;

// Game state
let isGameOver = false;
let lastTime = performance.now();

// Initialize the game
initGame();
engine.start();

// Get player entity
function getPlayer() {
    const entities = engine.getEntitiesWithComponent(PlayerTag);
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
            input.shoot = keys[' '];
        }
    }

    // Prevent space from scrolling
    if (e.key === ' ') {
        e.preventDefault();
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
            input.shoot = keys[' '];
        }
    }
});

// Draw a spaceship shape
function drawShip(x: number, y: number, color: string, scale: number = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(12, 15);
    ctx.lineTo(0, 8);
    ctx.lineTo(-12, 15);
    ctx.closePath();
    ctx.fill();

    // Engine glow
    ctx.fillStyle = '#FF6600';
    ctx.beginPath();
    ctx.moveTo(-5, 10);
    ctx.lineTo(0, 20);
    ctx.lineTo(5, 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// Draw an enemy ship
function drawEnemy(x: number, y: number, color: string, type: string) {
    ctx.save();
    ctx.translate(x, y);

    const scale = type === 'enemy-boss' ? 1.5 : type === 'enemy-elite' ? 1.2 : 1;
    ctx.scale(scale, scale);

    ctx.fillStyle = color;

    // Wing shape
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(15, -8);
    ctx.lineTo(8, -12);
    ctx.lineTo(0, -5);
    ctx.lineTo(-8, -12);
    ctx.lineTo(-15, -8);
    ctx.closePath();
    ctx.fill();

    // Center
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Draw explosion
function drawExplosion(x: number, y: number, timer: number) {
    ctx.save();
    ctx.translate(x, y);

    const progress = 1 - timer / 0.5;
    const radius = 10 + progress * 30;
    const alpha = 1 - progress;

    ctx.globalAlpha = alpha;

    // Outer explosion
    ctx.fillStyle = '#FF6600';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner explosion
    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Draw bullet
function drawBullet(x: number, y: number, color: string) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.ellipse(x, y, 3, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
}

// Rendering
function render() {
    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
    gradient.addColorStop(0, '#000011');
    gradient.addColorStop(1, '#001133');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Draw stars
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 50; i++) {
        const starX = (i * 137 + Date.now() / 100) % SCREEN_WIDTH;
        const starY = (i * 97) % SCREEN_HEIGHT;
        const size = (i % 3) + 1;
        ctx.globalAlpha = 0.3 + (i % 5) * 0.1;
        ctx.fillRect(starX, starY, size, size);
    }
    ctx.globalAlpha = 1;

    // Render all entities
    const entities = engine.getEntitiesWithComponent(Position);

    for (const entity of entities) {
        const position = entity.getComponent(Position);
        const renderable = entity.getComponent(Renderable);

        if (!position || !renderable) continue;

        // Draw based on sprite type
        if (renderable.sprite === 'player') {
            drawShip(position.x, position.y, renderable.color);
        } else if (renderable.sprite.startsWith('enemy-')) {
            drawEnemy(position.x, position.y, renderable.color, renderable.sprite);
        } else if (renderable.sprite === 'explosion') {
            const dying = entity.getComponent(DyingState);
            if (dying) {
                drawExplosion(position.x, position.y, dying.deathTimer);
            }
        } else if (renderable.sprite === 'bullet') {
            drawBullet(position.x, position.y, renderable.color);
        }
    }

    // Draw state indicators on enemies
    const enemies = engine.getEntitiesWithComponent(EnemyTag);
    for (const enemy of enemies) {
        const pos = enemy.getComponent(Position);
        if (!pos) continue;

        // Draw state indicator
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';

        if (enemy.hasComponent(DivingState)) {
            ctx.fillStyle = '#FF0000';
            ctx.fillText('DIVE', pos.x, pos.y - 25);
        } else if (enemy.hasComponent(ReturningState)) {
            ctx.fillStyle = '#00FF00';
            ctx.fillText('RTN', pos.x, pos.y - 25);
        }
    }
}

// Update UI
function updateUI() {
    const player = getPlayer();

    if (player) {
        const data = player.getComponent(PlayerData);
        if (data) {
            scoreEl.textContent = data.score.toString();
            livesEl.textContent = data.lives.toString();

            // Check for game over
            if (data.lives <= 0 && !isGameOver) {
                isGameOver = true;
                gameOverEl.style.display = 'block';
                finalScoreEl.textContent = data.score.toString();
            }
        }
    }

    // Update state info panel
    if (stateInfoEl) {
        const enemyEntities = engine.getEntitiesWithComponent(EnemyTag);
        let formation = 0;
        let diving = 0;
        let returning = 0;
        let dying = 0;

        enemyEntities.forEach((enemy: any) => {
            if (enemy.hasComponent(FormationState)) formation++;
            else if (enemy.hasComponent(DivingState)) diving++;
            else if (enemy.hasComponent(ReturningState)) returning++;
            else if (enemy.hasComponent(DyingState)) dying++;
        });

        // Count total transitions
        let totalTransitions = 0;
        enemyEntities.forEach((enemy: any) => {
            const sm = enemy.getComponent(StateMachine);
            if (sm) totalTransitions += sm.transitionCount;
        });

        stateInfoEl.innerHTML = `
            <div><span class="state-formation">Formation:</span> ${formation}</div>
            <div><span class="state-diving">Diving:</span> ${diving}</div>
            <div><span class="state-returning">Returning:</span> ${returning}</div>
            <div><span class="state-dying">Dying:</span> ${dying}</div>
            <div style="margin-top: 0.5rem; border-top: 1px solid #333; padding-top: 0.5rem;">
                <span>Transitions:</span> ${totalTransitions}
            </div>
        `;
    }
}

// Check for all enemies destroyed
function checkWinCondition() {
    const enemies = engine.getEntitiesWithComponent(EnemyTag);
    let aliveCount = 0;

    enemies.forEach((enemy: any) => {
        if (!enemy.hasComponent(DyingState)) {
            aliveCount++;
        }
    });

    if (aliveCount === 0 && !isGameOver) {
        // Player wins! Show game over with win message
        isGameOver = true;
        gameOverEl.style.display = 'block';
        const player = getPlayer();
        const data = player?.getComponent(PlayerData);
        finalScoreEl.textContent = (data?.score ?? 0).toString();
        (gameOverEl.querySelector('h2') as HTMLElement).textContent = 'Victory!';
    }
}

// Game loop
function loop() {
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    if (!isGameOver) {
        gameLoop(deltaTime);
        checkWinCondition();
    }

    render();
    updateUI();

    requestAnimationFrame(loop);
}

// Restart game
restartBtn.addEventListener('click', () => {
    window.location.reload();
});

// Start the game loop
loop();
