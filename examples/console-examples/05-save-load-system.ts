/**
 * Save/Load System Example
 * Demonstrates world serialization, snapshots, and game state persistence
 */

import { Engine } from '../src/engine';

// Game Components
class Position {
    constructor(public x: number = 0, public y: number = 0) {}
}

class Health {
    constructor(public current: number = 100, public max: number = 100) {}
}

class Inventory {
    constructor(
        public items: Map<string, number> = new Map(),
        public maxSlots: number = 10
    ) {}
    
    addItem(item: string, count: number = 1) {
        const current = this.items.get(item) || 0;
        this.items.set(item, current + count);
    }
    
    removeItem(item: string, count: number = 1): boolean {
        const current = this.items.get(item) || 0;
        if (current >= count) {
            if (current === count) {
                this.items.delete(item);
            } else {
                this.items.set(item, current - count);
            }
            return true;
        }
        return false;
    }
}

class PlayerStats {
    constructor(
        public level: number = 1,
        public experience: number = 0,
        public gold: number = 0,
        public playTime: number = 0
    ) {}
}

class QuestProgress {
    constructor(
        public activeQuests: Set<string> = new Set(),
        public completedQuests: Set<string> = new Set(),
        public questVariables: Map<string, any> = new Map()
    ) {}
}

class SaveMetadata {
    constructor(
        public version: number = 1,
        public timestamp: number = Date.now(),
        public playTime: number = 0,
        public location: string = 'Unknown'
    ) {}
}

// Custom serialization for complex components
class SerializationHelper {
    static serializeInventory(inventory: Inventory): any {
        return {
            items: Array.from(inventory.items.entries()),
            maxSlots: inventory.maxSlots
        };
    }
    
    static deserializeInventory(data: any): Inventory {
        const inventory = new Inventory();
        inventory.maxSlots = data.maxSlots;
        inventory.items = new Map(data.items);
        return inventory;
    }
    
    static serializeQuestProgress(progress: QuestProgress): any {
        return {
            activeQuests: Array.from(progress.activeQuests),
            completedQuests: Array.from(progress.completedQuests),
            questVariables: Array.from(progress.questVariables.entries())
        };
    }
    
    static deserializeQuestProgress(data: any): QuestProgress {
        const progress = new QuestProgress();
        progress.activeQuests = new Set(data.activeQuests);
        progress.completedQuests = new Set(data.completedQuests);
        progress.questVariables = new Map(data.questVariables);
        return progress;
    }
}

// Initialize engine
const game = new Engine(60, true);

// Auto-save system
let autoSaveTimer = 0;
const AUTO_SAVE_INTERVAL = 10; // seconds

game.createSystem('AutoSaveSystem', {
    all: []
}, {
    priority: 10,
    before: () => {
        autoSaveTimer += 0.016;
        
        if (autoSaveTimer >= AUTO_SAVE_INTERVAL) {
            autoSaveTimer = 0;
            
            // Create auto-save snapshot
            game.createSnapshot();
            console.log('⏰ Auto-save created');
            
            // Also save to "file" (simulated)
            saveToFile('autosave.json');
        }
    }
});

// Play time tracking
game.createSystem('PlayTimeSystem', {
    all: [PlayerStats]
}, {
    priority: 5,
    act: (entity, stats) => {
        stats.playTime += 0.016;
    }
});

// Save game state to file (simulated)
function saveToFile(filename: string): void {
    const worldData = game.serialize();
    
    // Create save data with metadata
    const saveData = {
        metadata: {
            version: 1,
            timestamp: Date.now(),
            engineVersion: '1.0.0',
            totalEntities: worldData.entities.length
        },
        world: worldData,
        customData: {} as any
    };
    
    // Find player and add custom serialization
    const player = game.getEntitiesByTag('player')[0];
    if (player) {
        if (player.hasComponent(Inventory)) {
            saveData.customData.inventory = SerializationHelper.serializeInventory(
                player.getComponent(Inventory)
            );
        }
        if (player.hasComponent(QuestProgress)) {
            saveData.customData.questProgress = SerializationHelper.serializeQuestProgress(
                player.getComponent(QuestProgress)
            );
        }
        if (player.hasComponent(PlayerStats)) {
            const stats = player.getComponent(PlayerStats);
            saveData.metadata.playTime = stats.playTime;
        }
    }
    
    // Simulate file write
    const jsonData = JSON.stringify(saveData, null, 2);
    console.log(`💾 Saved game to ${filename} (${(jsonData.length / 1024).toFixed(2)} KB)`);
    
    // Store in simulated filesystem
    simulatedFileSystem.set(filename, jsonData);
}

// Load game state from file (simulated)
function loadFromFile(filename: string): boolean {
    const jsonData = simulatedFileSystem.get(filename);
    if (!jsonData) {
        console.log(`❌ Save file ${filename} not found`);
        return false;
    }
    
    try {
        const saveData = JSON.parse(jsonData);
        
        // Verify save version
        if (saveData.metadata.version !== 1) {
            console.log(`❌ Incompatible save version: ${saveData.metadata.version}`);
            return false;
        }
        
        // Clear current world
        game.getAllEntities().forEach(entity => entity.queueFree());
        game.update(0); // Process deletions
        
        // Recreate entities from save data
        const entityMap = new Map<string, any>();
        
        for (const entityData of saveData.world.entities) {
            const entity = game.createEntity(entityData.name);
            entityMap.set(entityData.id, entity);
            
            // Restore tags
            for (const tag of entityData.tags || []) {
                entity.addTag(tag);
            }
            
            // Restore components
            for (const [componentName, componentData] of Object.entries(entityData.components)) {
                // Map component names to classes
                switch (componentName) {
                    case 'Position':
                        entity.addComponent(Position, componentData.x, componentData.y);
                        break;
                    case 'Health':
                        entity.addComponent(Health, componentData.current, componentData.max);
                        break;
                    case 'PlayerStats':
                        entity.addComponent(PlayerStats, 
                            componentData.level,
                            componentData.experience,
                            componentData.gold,
                            componentData.playTime
                        );
                        break;
                    // Add more component mappings as needed
                }
            }
            
            // Restore custom components
            if (entity.hasTag('player') && saveData.customData) {
                if (saveData.customData.inventory) {
                    const inventory = SerializationHelper.deserializeInventory(saveData.customData.inventory);
                    entity.addComponent(Inventory);
                    const comp = entity.getComponent(Inventory);
                    comp.items = inventory.items;
                    comp.maxSlots = inventory.maxSlots;
                }
                if (saveData.customData.questProgress) {
                    const progress = SerializationHelper.deserializeQuestProgress(saveData.customData.questProgress);
                    entity.addComponent(QuestProgress);
                    const comp = entity.getComponent(QuestProgress);
                    comp.activeQuests = progress.activeQuests;
                    comp.completedQuests = progress.completedQuests;
                    comp.questVariables = progress.questVariables;
                }
            }
        }
        
        // Restore entity hierarchies
        for (const entityData of saveData.world.entities) {
            if (entityData.children && entityData.children.length > 0) {
                const parent = entityMap.get(entityData.id);
                for (const childData of entityData.children) {
                    const child = entityMap.get(childData.id);
                    if (parent && child) {
                        parent.addChild(child);
                    }
                }
            }
        }
        
        console.log(`✅ Loaded game from ${filename}`);
        console.log(`   Restored ${saveData.world.entities.length} entities`);
        console.log(`   Save time: ${new Date(saveData.metadata.timestamp).toLocaleString()}`);
        console.log(`   Play time: ${(saveData.metadata.playTime / 60).toFixed(1)} minutes`);
        
        return true;
    } catch (error) {
        console.log(`❌ Failed to load save: ${error}`);
        return false;
    }
}

// Simulated file system
const simulatedFileSystem = new Map<string, string>();

// Create game world
const player = game.createEntity('Player');
player.addComponent(Position, 100, 100)
      .addComponent(Health, 75, 100)
      .addComponent(PlayerStats, 5, 2500, 150, 0)
      .addComponent(Inventory)
      .addComponent(QuestProgress)
      .addTag('player')
      .addTag('saveable');

// Add items to inventory
const inventory = player.getComponent(Inventory);
inventory.addItem('Sword', 1);
inventory.addItem('Potion', 5);
inventory.addItem('Gold Coin', 50);

// Add quest progress
const quests = player.getComponent(QuestProgress);
quests.activeQuests.add('Find the Lost Artifact');
quests.activeQuests.add('Defeat the Dragon');
quests.completedQuests.add('Tutorial');
quests.completedQuests.add('First Steps');
quests.questVariables.set('dragonsKilled', 2);
quests.questVariables.set('artifactsFound', 1);

// Create NPCs
for (let i = 0; i < 5; i++) {
    const npc = game.createEntity(`NPC_${i}`);
    npc.addComponent(Position, 200 + i * 50, 200)
       .addComponent(Health, 50, 50)
       .addTag('npc')
       .addTag('saveable');
}

// Create world objects
const chest = game.createEntity('TreasureChest');
chest.addComponent(Position, 300, 300)
     .addComponent(Inventory)
     .addTag('container')
     .addTag('saveable');

const chestInv = chest.getComponent(Inventory);
chestInv.addItem('Gold Coin', 100);
chestInv.addItem('Magic Ring', 1);

// Save/Load command system (simulated input)
let commandTimer = 0;
const commands = [
    { time: 3, action: 'save', slot: 'save1.json' },
    { time: 8, action: 'save', slot: 'save2.json' },
    { time: 15, action: 'load', slot: 'save1.json' },
    { time: 20, action: 'snapshot' },
    { time: 25, action: 'restore' },
    { time: 30, action: 'save', slot: 'final.json' }
];

game.createSystem('SaveLoadCommandSystem', {
    all: []
}, {
    priority: 1,
    before: () => {
        commandTimer += 0.016;
        
        for (const command of commands) {
            if (Math.abs(commandTimer - command.time) < 0.1) {
                switch (command.action) {
                    case 'save':
                        console.log(`\n📝 Manual save to ${command.slot}`);
                        saveToFile(command.slot!);
                        break;
                    case 'load':
                        console.log(`\n📂 Loading from ${command.slot}`);
                        loadFromFile(command.slot!);
                        break;
                    case 'snapshot':
                        console.log(`\n📸 Creating snapshot`);
                        game.createSnapshot();
                        break;
                    case 'restore':
                        console.log(`\n🔄 Restoring from snapshot`);
                        game.restoreSnapshot();
                        break;
                }
            }
        }
    }
});

// Progress monitoring system
game.createSystem('ProgressMonitorSystem', {
    all: [PlayerStats],
    tags: ['player']
}, {
    priority: 20,
    act: (entity, stats) => {
        // Simulate gameplay progress
        stats.experience += 10 * 0.016;
        stats.gold += 1 * 0.016;
        
        // Level up check
        const requiredExp = stats.level * 1000;
        if (stats.experience >= requiredExp) {
            stats.experience -= requiredExp;
            stats.level++;
            console.log(`🎉 Level up! Now level ${stats.level}`);
        }
    }
});

// Status display
let statusTimer = 0;
game.createSystem('StatusDisplaySystem', {
    all: []
}, {
    priority: 15,
    before: () => {
        statusTimer += 0.016;
        
        if (statusTimer > 5) {
            statusTimer = 0;
            
            const player = game.getEntitiesByTag('player')[0];
            if (player && player.hasComponent(PlayerStats) && player.hasComponent(Inventory)) {
                const stats = player.getComponent(PlayerStats);
                const inv = player.getComponent(Inventory);
                const quests = player.getComponent(QuestProgress);
                
                console.log('\n=== Game Status ===');
                console.log(`Level: ${stats.level} | EXP: ${stats.experience.toFixed(0)} | Gold: ${stats.gold.toFixed(0)}`);
                console.log(`Play Time: ${(stats.playTime / 60).toFixed(1)} minutes`);
                console.log(`Inventory: ${Array.from(inv.items.entries()).map(([k,v]) => `${k}(${v})`).join(', ')}`);
                console.log(`Active Quests: ${quests.activeQuests.size} | Completed: ${quests.completedQuests.size}`);
                console.log(`Total Entities: ${game.getAllEntities().length}`);
            }
        }
    }
});

// Save statistics
setInterval(() => {
    const saveFiles = Array.from(simulatedFileSystem.keys());
    const totalSize = Array.from(simulatedFileSystem.values())
        .reduce((sum, data) => sum + data.length, 0);
    
    console.log('\n=== Save System Statistics ===');
    console.log(`Save Files: ${saveFiles.join(', ')}`);
    console.log(`Total Save Data: ${(totalSize / 1024).toFixed(2)} KB`);
    console.log(`Snapshots Available: ${game.getDebugInfo().snapshots}`);
}, 15000);

// Run the example
console.log('Starting Save/Load System Example...');
console.log('Features demonstrated:');
console.log('- World state serialization');
console.log('- Custom component serialization');
console.log('- Save file management');
console.log('- Snapshot creation and restoration');
console.log('- Auto-save functionality');
console.log('- Complex data structure persistence');
console.log('- Save metadata and versioning\n');
console.log('Scheduled commands:');
console.log('- 3s: Save to save1.json');
console.log('- 8s: Save to save2.json');
console.log('- 15s: Load from save1.json');
console.log('- 20s: Create snapshot');
console.log('- 25s: Restore snapshot');
console.log('- 30s: Save to final.json\n');

game.run();

// Stop after 40 seconds
setTimeout(() => {
    game.stop();
    console.log('\nSave/Load example stopped.');
    
    // Final save
    saveToFile('exit_save.json');
    
    console.log('\nFinal save files:');
    for (const [filename, data] of simulatedFileSystem.entries()) {
        console.log(`- ${filename}: ${(data.length / 1024).toFixed(2)} KB`);
    }
}, 40000);