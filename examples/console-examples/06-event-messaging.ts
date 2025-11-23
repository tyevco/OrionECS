/**
 * Event Messaging Example
 * Demonstrates inter-system communication, event-driven gameplay, and decoupled architecture
 */

import { Engine } from '../src/engine';

// Components
class Position {
    constructor(public x: number = 0, public y: number = 0) {}
}

class Health {
    constructor(public current: number = 100, public max: number = 100) {}
}

class Score {
    constructor(
        public points: number = 0,
        public combo: number = 0,
        public multiplier: number = 1
    ) {}
}

class Collectible {
    constructor(
        public type: 'coin' | 'gem' | 'powerup' | 'health' = 'coin',
        public value: number = 10
    ) {}
}

class PowerUp {
    constructor(
        public type: 'speed' | 'shield' | 'double_points' | 'magnet' = 'speed',
        public duration: number = 5000,
        public strength: number = 1.5,
        public activatedAt: number = 0
    ) {}
    
    get isActive() { return Date.now() - this.activatedAt < this.duration; }
    get remainingTime() { return Math.max(0, this.duration - (Date.now() - this.activatedAt)); }
}

class Achievement {
    constructor(
        public id: string,
        public name: string,
        public description: string,
        public unlocked: boolean = false,
        public progress: number = 0,
        public target: number = 1
    ) {}
}

class GameState {
    constructor(
        public wave: number = 1,
        public enemiesKilled: number = 0,
        public coinsCollected: number = 0,
        public totalPlayTime: number = 0,
        public gameMode: 'playing' | 'paused' | 'gameover' = 'playing'
    ) {}
}

// Initialize engine with message bus
const game = new Engine(60, true);

// Event definitions
interface GameEvents {
    'entity-spawned': { entity: any, type: string };
    'entity-killed': { entity: any, killer?: any, method?: string };
    'item-collected': { collector: any, item: any, type: string, value: number };
    'powerup-activated': { entity: any, powerup: string };
    'powerup-expired': { entity: any, powerup: string };
    'achievement-unlocked': { achievement: Achievement };
    'achievement-progress': { achievementId: string, progress: number };
    'wave-complete': { wave: number, enemies: number };
    'game-over': { finalScore: number, wave: number };
    'combo-update': { combo: number, entity: any };
    'damage-dealt': { source: any, target: any, damage: number };
    'score-update': { entity: any, points: number, reason: string };
}

// Achievement definitions
const achievements = [
    new Achievement('first_blood', 'First Blood', 'Kill your first enemy'),
    new Achievement('collector', 'Collector', 'Collect 100 coins', false, 0, 100),
    new Achievement('powerup_master', 'Power-Up Master', 'Use 10 power-ups', false, 0, 10),
    new Achievement('survivor', 'Survivor', 'Survive 5 waves', false, 0, 5),
    new Achievement('combo_king', 'Combo King', 'Reach a 10x combo', false, 0, 10),
    new Achievement('untouchable', 'Untouchable', 'Complete a wave without taking damage'),
    new Achievement('speed_demon', 'Speed Demon', 'Collect 50 items in 30 seconds', false, 0, 50)
];

// Store achievements globally
const achievementMap = new Map(achievements.map(a => [a.id, a]));

// Score System - listens for various events and updates score
class ScoreSystem {
    constructor(private engine: Engine) {
        // Subscribe to scoring events
        engine.messageBus.subscribe('entity-killed', (msg) => {
            const player = engine.getEntitiesByTag('player')[0];
            if (player && player.hasComponent(Score)) {
                const score = player.getComponent(Score);
                const points = 100 * score.multiplier;
                score.points += points;
                score.combo++;
                
                engine.messageBus.publish('score-update', {
                    entity: player,
                    points,
                    reason: 'enemy kill'
                }, 'ScoreSystem');
                
                engine.messageBus.publish('combo-update', {
                    combo: score.combo,
                    entity: player
                }, 'ScoreSystem');
            }
        });
        
        engine.messageBus.subscribe('item-collected', (msg) => {
            const { collector, value, type } = msg.data;
            if (collector.hasComponent(Score)) {
                const score = collector.getComponent(Score);
                const points = value * score.multiplier;
                score.points += points;
                
                engine.messageBus.publish('score-update', {
                    entity: collector,
                    points,
                    reason: `${type} collection`
                }, 'ScoreSystem');
            }
        });
    }
}

// Achievement System - tracks progress and unlocks
class AchievementSystem {
    constructor(private engine: Engine) {
        // Track various achievements
        engine.messageBus.subscribe('entity-killed', (msg) => {
            this.updateProgress('first_blood', 1, 1);
        });
        
        engine.messageBus.subscribe('item-collected', (msg) => {
            if (msg.data.type === 'coin') {
                this.updateProgress('collector', 1);
            }
        });
        
        engine.messageBus.subscribe('powerup-activated', (msg) => {
            this.updateProgress('powerup_master', 1);
        });
        
        engine.messageBus.subscribe('wave-complete', (msg) => {
            this.updateProgress('survivor', 1);
        });
        
        engine.messageBus.subscribe('combo-update', (msg) => {
            if (msg.data.combo >= 10) {
                this.updateProgress('combo_king', msg.data.combo, 10);
            }
        });
    }
    
    private updateProgress(achievementId: string, progress: number, max?: number) {
        const achievement = achievementMap.get(achievementId);
        if (!achievement || achievement.unlocked) return;
        
        achievement.progress = Math.min(achievement.progress + progress, max || achievement.target);
        
        this.engine.messageBus.publish('achievement-progress', {
            achievementId,
            progress: achievement.progress
        }, 'AchievementSystem');
        
        if (achievement.progress >= achievement.target) {
            achievement.unlocked = true;
            this.engine.messageBus.publish('achievement-unlocked', {
                achievement
            }, 'AchievementSystem');
        }
    }
}

// PowerUp Management System
game.createSystem('PowerUpSystem', {
    all: [PowerUp]
}, {
    priority: 90,
    act: (entity, powerup) => {
        if (powerup.isActive && powerup.remainingTime <= 100 && powerup.remainingTime > 0) {
            // About to expire
            game.messageBus.publish('powerup-expired', {
                entity,
                powerup: powerup.type
            }, 'PowerUpSystem');
            
            entity.removeComponent(PowerUp);
        }
    }
});

// Collection System
game.createSystem('CollectionSystem', {
    all: [Position, Collectible]
}, {
    priority: 80,
    act: (entity, position, collectible) => {
        // Check collision with player
        const players = game.getEntitiesByTag('player');
        for (const player of players) {
            if (!player.hasComponent(Position)) continue;
            
            const playerPos = player.getComponent(Position);
            const distance = Math.sqrt(
                Math.pow(position.x - playerPos.x, 2) + 
                Math.pow(position.y - playerPos.y, 2)
            );
            
            if (distance < 30) { // Collection radius
                // Publish collection event
                game.messageBus.publish('item-collected', {
                    collector: player,
                    item: entity,
                    type: collectible.type,
                    value: collectible.value
                }, 'CollectionSystem');
                
                // Handle special collectibles
                if (collectible.type === 'powerup') {
                    const powerupTypes: Array<PowerUp['type']> = ['speed', 'shield', 'double_points', 'magnet'];
                    const randomPowerup = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
                    
                    player.addComponent(PowerUp, randomPowerup, 5000, 1.5, Date.now());
                    
                    game.messageBus.publish('powerup-activated', {
                        entity: player,
                        powerup: randomPowerup
                    }, 'CollectionSystem');
                } else if (collectible.type === 'health' && player.hasComponent(Health)) {
                    const health = player.getComponent(Health);
                    health.current = Math.min(health.max, health.current + collectible.value);
                }
                
                // Remove collected item
                entity.queueFree();
            }
        }
    }
});

// Event Logger System - demonstrates message bus usage
const eventLog: Array<{time: number, event: string, data: any}> = [];

game.messageBus.subscribe('entity-spawned', (msg) => {
    eventLog.push({ time: Date.now(), event: 'spawn', data: msg.data });
    console.log(`🌟 Spawned: ${msg.data.type}`);
});

game.messageBus.subscribe('entity-killed', (msg) => {
    eventLog.push({ time: Date.now(), event: 'kill', data: msg.data });
    console.log(`💀 Killed: ${msg.data.entity.name}`);
});

game.messageBus.subscribe('item-collected', (msg) => {
    eventLog.push({ time: Date.now(), event: 'collect', data: msg.data });
    console.log(`✨ Collected: ${msg.data.type} (+${msg.data.value})`);
});

game.messageBus.subscribe('powerup-activated', (msg) => {
    console.log(`🚀 Power-up activated: ${msg.data.powerup}`);
});

game.messageBus.subscribe('achievement-unlocked', (msg) => {
    console.log(`🏆 Achievement Unlocked: ${msg.data.achievement.name}`);
    console.log(`   ${msg.data.achievement.description}`);
});

game.messageBus.subscribe('wave-complete', (msg) => {
    console.log(`🌊 Wave ${msg.data.wave} Complete! Enemies: ${msg.data.enemies}`);
});

game.messageBus.subscribe('score-update', (msg) => {
    if (msg.data.points > 100) {
        console.log(`💯 Big score! +${msg.data.points} (${msg.data.reason})`);
    }
});

// Initialize systems
const scoreSystem = new ScoreSystem(game);
const achievementSystem = new AchievementSystem(game);

// Create player
const player = game.createEntity('Player');
player.addComponent(Position, 400, 300)
      .addComponent(Health, 100, 100)
      .addComponent(Score, 0, 0, 1)
      .addTag('player');

// Create game state manager
const gameStateEntity = game.createEntity('GameState');
gameStateEntity.addComponent(GameState);

// Wave spawning system
let waveTimer = 0;
const WAVE_DURATION = 20; // seconds

game.createSystem('WaveSystem', {
    all: [GameState]
}, {
    priority: 100,
    act: (entity, gameState) => {
        waveTimer += 0.016;
        gameState.totalPlayTime += 0.016;
        
        if (waveTimer >= WAVE_DURATION) {
            waveTimer = 0;
            
            // Complete current wave
            game.messageBus.publish('wave-complete', {
                wave: gameState.wave,
                enemies: gameState.enemiesKilled
            }, 'WaveSystem');
            
            gameState.wave++;
            gameState.enemiesKilled = 0;
            
            // Spawn new wave items
            spawnWave(gameState.wave);
        }
        
        // Spawn items periodically
        if (Math.random() < 0.02) {
            spawnRandomItem();
        }
    }
});

function spawnWave(waveNumber: number) {
    const itemCount = 5 + waveNumber * 2;
    
    for (let i = 0; i < itemCount; i++) {
        const x = Math.random() * 800;
        const y = Math.random() * 600;
        const types: Collectible['type'][] = ['coin', 'gem', 'powerup', 'health'];
        const type = types[Math.floor(Math.random() * types.length)];
        const value = type === 'gem' ? 50 : type === 'coin' ? 10 : 20;
        
        const item = game.createEntity(`Item_${Date.now()}_${i}`);
        item.addComponent(Position, x, y)
            .addComponent(Collectible, type, value)
            .addTag('item');
        
        game.messageBus.publish('entity-spawned', {
            entity: item,
            type: type
        }, 'WaveSystem');
    }
}

function spawnRandomItem() {
    const x = Math.random() * 800;
    const y = Math.random() * 600;
    const type: Collectible['type'] = Math.random() < 0.8 ? 'coin' : 'gem';
    
    const item = game.createEntity(`RandomItem_${Date.now()}`);
    item.addComponent(Position, x, y)
        .addComponent(Collectible, type, type === 'gem' ? 50 : 10)
        .addTag('item');
}

// Enemy simulation (for kill events)
let enemySpawnTimer = 0;
game.createSystem('EnemySimulation', {
    all: []
}, {
    priority: 70,
    before: () => {
        enemySpawnTimer += 0.016;
        
        if (enemySpawnTimer > 3) {
            enemySpawnTimer = 0;
            
            // Simulate enemy death
            const enemy = { name: `Enemy_${Date.now()}` };
            game.messageBus.publish('entity-killed', {
                entity: enemy,
                killer: player,
                method: 'simulated'
            }, 'EnemySimulation');
            
            const gameState = game.getEntitiesByTag('gamestate')[0];
            if (gameState && gameState.hasComponent(GameState)) {
                gameState.getComponent(GameState).enemiesKilled++;
            }
        }
    }
});

// Status display system
let displayTimer = 0;
game.createSystem('StatusDisplaySystem', {
    all: []
}, {
    priority: 10,
    before: () => {
        displayTimer += 0.016;
        
        if (displayTimer > 3) {
            displayTimer = 0;
            
            const player = game.getEntitiesByTag('player')[0];
            const gameState = gameStateEntity.getComponent(GameState);
            
            if (player && player.hasComponent(Score)) {
                const score = player.getComponent(Score);
                const health = player.getComponent(Health);
                
                console.log('\n=== Game Status ===');
                console.log(`Wave: ${gameState.wave} | Time: ${(gameState.totalPlayTime / 60).toFixed(1)}m`);
                console.log(`Score: ${score.points} | Combo: ${score.combo}x | Multiplier: ${score.multiplier}x`);
                console.log(`Health: ${health.current}/${health.max}`);
                
                // Show active powerups
                if (player.hasComponent(PowerUp)) {
                    const powerup = player.getComponent(PowerUp);
                    console.log(`Active Power-up: ${powerup.type} (${(powerup.remainingTime / 1000).toFixed(1)}s)`);
                }
                
                // Show unlocked achievements
                const unlocked = Array.from(achievementMap.values()).filter(a => a.unlocked);
                console.log(`Achievements: ${unlocked.length}/${achievements.length}`);
            }
        }
    }
});

// Event history analysis
setInterval(() => {
    const recentEvents = eventLog.filter(e => Date.now() - e.time < 10000);
    const eventCounts = recentEvents.reduce((acc, e) => {
        acc[e.event] = (acc[e.event] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    console.log('\n=== Event Statistics (last 10s) ===');
    console.log(`Total Events: ${recentEvents.length}`);
    for (const [event, count] of Object.entries(eventCounts)) {
        console.log(`${event}: ${count}`);
    }
    
    // Message bus stats
    const messageHistory = game.messageBus.getMessageHistory();
    console.log(`Total Messages: ${messageHistory.length}`);
}, 10000);

// Run the example
console.log('Starting Event Messaging Example...');
console.log('Features demonstrated:');
console.log('- Inter-system communication via message bus');
console.log('- Event-driven gameplay mechanics');
console.log('- Achievement system with progress tracking');
console.log('- Score and combo system');
console.log('- Power-up management');
console.log('- Wave-based spawning');
console.log('- Decoupled architecture with events\n');

game.run();

// Stop after 60 seconds
setTimeout(() => {
    game.stop();
    console.log('\nEvent messaging example stopped.');
    
    // Show final achievements
    console.log('\n=== Final Achievements ===');
    for (const achievement of achievementMap.values()) {
        const status = achievement.unlocked ? '✅' : `${achievement.progress}/${achievement.target}`;
        console.log(`${achievement.name}: ${status}`);
    }
    
    // Show message bus statistics
    const allMessages = game.messageBus.getMessageHistory();
    const messageCounts = allMessages.reduce((acc, msg) => {
        acc[msg.type] = (acc[msg.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    console.log('\n=== Message Bus Statistics ===');
    console.log(`Total Messages: ${allMessages.length}`);
    for (const [type, count] of Object.entries(messageCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`${type}: ${count}`);
    }
}, 60000);