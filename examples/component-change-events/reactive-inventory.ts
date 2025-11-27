/**
 * Reactive Inventory Example
 *
 * Demonstrates how to use component change events to create
 * an inventory system with UI synchronization.
 *
 * Shows how to detect specific changes (item added/removed)
 * and animate UI updates accordingly.
 */

import { EngineBuilder } from '../../packages/core/src/index';

// ============================================================================
// COMPONENTS
// ============================================================================

class Item {
    constructor(
        public name: string,
        public value: number,
        public stackSize: number = 1,
        public icon: string = '📦'
    ) {}
}

// Pure data component - no business logic
class Inventory {
    items: Item[] = [];
    maxSlots: number = 10;
    gold: number = 0;
}

// Animation types for UI feedback
interface InventoryAnimation {
    type: 'add' | 'remove' | 'gold';
    slotIndex?: number;
    item?: Item;
    oldGold?: number;
    newGold?: number;
}

// Pure data component - UI state only, no behavior
class InventoryUI {
    updateCount: number = 0;
    visible: boolean = false;
    pendingAnimations: InventoryAnimation[] = [];
}

// Command types for inventory operations
type InventoryCommandType = 'add' | 'remove' | 'add_gold';

// Command component for inventory operations
class InventoryCommand {
    constructor(
        public commandType: InventoryCommandType,
        public item?: Item,
        public index?: number,
        public goldAmount?: number
    ) {}
}

class Position {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

// ============================================================================
// HELPER FUNCTIONS (Pure functions for inventory queries)
// ============================================================================

function findItemIndex(inventory: Inventory, name: string): number {
    return inventory.items.findIndex((item) => item.name === name);
}

// ============================================================================
// UI RENDER HELPERS (Pure functions for console output)
// ============================================================================

function renderInventoryPanel(inventory: Inventory, ui: InventoryUI): void {
    ui.updateCount++;
    console.log(`\n📋 InventoryUI: Refreshing display (Update #${ui.updateCount})`);
    console.log(`   Slots: ${inventory.items.length}/${inventory.maxSlots}`);
    console.log(`   Gold: ${inventory.gold}`);
    console.log(`   Items:`);

    if (inventory.items.length === 0) {
        console.log('     (empty)');
    } else {
        inventory.items.forEach((item, index) => {
            console.log(
                `     [${index}] ${item.icon} ${item.name} (${item.value}g) x${item.stackSize}`
            );
        });
    }
}

function playAddAnimation(item: Item, slotIndex: number): void {
    console.log(`✨ InventoryUI: Playing add animation for slot ${slotIndex}`);
    console.log(`   "${item.icon} ${item.name}" appears with sparkle effect`);
}

function playRemoveAnimation(slotIndex: number): void {
    console.log(`💨 InventoryUI: Playing remove animation for slot ${slotIndex}`);
    console.log(`   Item fades out with puff of smoke`);
}

function playGoldAnimation(oldGold: number, newGold: number): void {
    const diff = newGold - oldGold;
    const sign = diff > 0 ? '+' : '';
    console.log(`💰 InventoryUI: Gold changed ${sign}${diff} (${oldGold} → ${newGold})`);
    console.log(`   Playing coin animation`);
}

// ============================================================================
// EXAMPLE 1: EVENT-DRIVEN INVENTORY UI
// ============================================================================

function createReactiveInventoryExample(): void {
    console.log(`\n${'='.repeat(70)}`);
    console.log('EXAMPLE 1: EVENT-DRIVEN INVENTORY UI');
    console.log(`${'='.repeat(70)}\n`);

    const engine = new EngineBuilder().withDebugMode(false).build();

    // System 1: Process inventory commands (business logic in System)
    engine.createSystem(
        'InventoryCommandSystem',
        { all: [Inventory, InventoryCommand] },
        {
            priority: 100, // Run before UI system
            act: (entity, inventory, command) => {
                switch (command.commandType) {
                    case 'add':
                        if (command.item && inventory.items.length < inventory.maxSlots) {
                            inventory.items.push(command.item);
                            engine.markComponentDirty(entity, Inventory);
                        }
                        break;
                    case 'remove':
                        if (
                            command.index !== undefined &&
                            command.index >= 0 &&
                            command.index < inventory.items.length
                        ) {
                            inventory.items.splice(command.index, 1);
                            engine.markComponentDirty(entity, Inventory);
                        }
                        break;
                    case 'add_gold':
                        if (command.goldAmount !== undefined) {
                            inventory.gold += command.goldAmount;
                            engine.markComponentDirty(entity, Inventory);
                        }
                        break;
                }
                // Remove command after processing
                entity.removeComponent(InventoryCommand);
            },
        }
    );

    // System 2: Reactive UI system (responds to inventory changes)
    engine.createSystem(
        'ReactiveInventoryUISystem',
        { all: [Inventory, InventoryUI] },
        {
            priority: 50, // Run after command system
            watchComponents: [Inventory],

            onComponentAdded: (event) => {
                const inventory = event.component;
                const ui = event.entity.getComponent(InventoryUI);
                ui.visible = true;
                console.log('🎒 InventoryUI: Opening inventory panel');
                renderInventoryPanel(inventory, ui);
            },

            onComponentRemoved: (event) => {
                const ui = event.entity.getComponent(InventoryUI);
                ui.visible = false;
                console.log('🎒 InventoryUI: Closing inventory panel');
            },

            onComponentChanged: (event) => {
                const oldInv = event.oldValue;
                const newInv = event.newValue;
                const ui = event.entity.getComponent(InventoryUI);

                console.log('\n🔔 Inventory changed event received!');

                // Queue animations based on changes
                if (oldInv) {
                    // Check for added items
                    for (let i = 0; i < newInv.items.length; i++) {
                        if (!oldInv.items[i] && newInv.items[i]) {
                            ui.pendingAnimations.push({
                                type: 'add',
                                slotIndex: i,
                                item: newInv.items[i],
                            });
                        }
                    }

                    // Check for removed items
                    for (let i = 0; i < oldInv.items.length; i++) {
                        if (
                            oldInv.items[i] &&
                            (!newInv.items[i] || oldInv.items[i] !== newInv.items[i])
                        ) {
                            ui.pendingAnimations.push({
                                type: 'remove',
                                slotIndex: i,
                            });
                        }
                    }

                    // Check gold change
                    if (oldInv.gold !== newInv.gold) {
                        ui.pendingAnimations.push({
                            type: 'gold',
                            oldGold: oldInv.gold,
                            newGold: newInv.gold,
                        });
                    }
                }
            },

            // Process pending animations and render
            act: (_entity, inventory, ui) => {
                // Process any pending animations
                for (const anim of ui.pendingAnimations) {
                    switch (anim.type) {
                        case 'add':
                            if (anim.item && anim.slotIndex !== undefined) {
                                playAddAnimation(anim.item, anim.slotIndex);
                            }
                            break;
                        case 'remove':
                            if (anim.slotIndex !== undefined) {
                                playRemoveAnimation(anim.slotIndex);
                            }
                            break;
                        case 'gold':
                            if (anim.oldGold !== undefined && anim.newGold !== undefined) {
                                playGoldAnimation(anim.oldGold, anim.newGold);
                            }
                            break;
                    }
                }

                // Clear processed animations and render if there were any
                if (ui.pendingAnimations.length > 0) {
                    ui.pendingAnimations = [];
                    renderInventoryPanel(inventory, ui);
                }
            },
        }
    );

    // Create player with inventory
    const player = engine.createEntity('Player');
    player.addComponent(Inventory);
    player.addComponent(InventoryUI);
    player.addComponent(Position, 100, 100);

    const inventory = player.getComponent(Inventory);
    const ui = player.getComponent(InventoryUI);

    console.log('\n--- Inventory Operations (Command-Based) ---');

    // Operation 1: Add potion via command
    console.log('\n▶ Operation 1: Player finds a health potion');
    player.addComponent(InventoryCommand, 'add', new Item('Health Potion', 50, 1, '🧪'));
    engine.update(16);

    // Operation 2: Add sword via command
    console.log('\n▶ Operation 2: Player finds a sword');
    player.addComponent(InventoryCommand, 'add', new Item('Iron Sword', 150, 1, '⚔️'));
    engine.update(16);

    // Operation 3: Add multiple items at once (batch with multiple commands)
    console.log('\n▶ Operation 3: Player loots a chest (multiple items)');
    engine.batch(() => {
        // Add items by directly modifying and marking dirty (for batch demo)
        inventory.items.push(new Item('Shield', 100, 1, '🛡️'));
        inventory.items.push(new Item('Bread', 5, 3, '🍞'));
        inventory.gold += 50;
        engine.markComponentDirty(player, Inventory);
    });
    engine.update(16);

    // Operation 4: No changes (idle frame)
    console.log('\n▶ Operation 4: Player walks around (no inventory changes)');
    for (let i = 0; i < 5; i++) {
        engine.update(16);
    }
    console.log('(No UI updates - nothing changed!)');

    // Operation 5: Remove item via command
    console.log('\n▶ Operation 5: Player uses health potion');
    const potionIndex = findItemIndex(inventory, 'Health Potion');
    if (potionIndex >= 0) {
        player.addComponent(InventoryCommand, 'remove', undefined, potionIndex);
    }
    engine.update(16);

    // Operation 6: Sell item (remove + add gold)
    console.log('\n▶ Operation 6: Player sells iron sword');
    const swordIndex = findItemIndex(inventory, 'Iron Sword');
    if (swordIndex >= 0) {
        const sword = inventory.items[swordIndex];
        // Use batch to combine remove and gold operations
        engine.batch(() => {
            inventory.items.splice(swordIndex, 1);
            inventory.gold += sword.value;
            engine.markComponentDirty(player, Inventory);
        });
    }
    engine.update(16);

    console.log(`\n📊 RESULT: UI updated ${ui.updateCount} times for 5 inventory changes`);
    console.log('✅ Only updated when inventory actually changed!');
    console.log(`ℹ️  Skipped 5 idle frames without any updates`);
}

// ============================================================================
// EXAMPLE 2: BATCH OPERATIONS
// ============================================================================

function createBatchOperationsExample(): void {
    console.log(`\n${'='.repeat(70)}`);
    console.log('EXAMPLE 2: BATCH OPERATIONS (LEVEL LOADING)');
    console.log(`${'='.repeat(70)}\n`);

    const engine = new EngineBuilder().withDebugMode(false).build();

    let eventCount = 0;

    // System that counts events
    engine.createSystem(
        'EventCounterSystem',
        { all: [Inventory, InventoryUI] },
        {
            watchComponents: [Inventory],

            onComponentChanged: (_event) => {
                eventCount++;
                console.log(`🔔 Event #${eventCount}: Inventory changed`);
            },
        }
    );

    // Create player
    const player = engine.createEntity('Player');
    player.addComponent(Inventory);
    player.addComponent(InventoryUI);

    const inventory = player.getComponent(Inventory);

    console.log('--- Without Batch Mode (Many Events) ---\n');

    // Add items one by one without batching (direct data modification)
    console.log('Adding 5 items individually...');
    for (let i = 0; i < 5; i++) {
        inventory.items.push(new Item(`Item ${i + 1}`, 10, 1, '📦'));
        engine.markComponentDirty(player, Inventory);
    }
    console.log(`Result: ${eventCount} events emitted\n`);

    // Reset
    inventory.items = [];
    eventCount = 0;

    console.log('--- With Batch Mode (One Event) ---\n');

    // Add items in batch mode (direct data modification)
    console.log('Adding 5 items in batch mode...');
    engine.batch(() => {
        for (let i = 0; i < 5; i++) {
            inventory.items.push(new Item(`Item ${i + 6}`, 10, 1, '📦'));
            engine.markComponentDirty(player, Inventory);
        }
    });

    console.log(`Result: ${eventCount} events emitted`);
    console.log('\n✅ Batch mode prevented event spam!');
    console.log('Use batch mode for level loading, network sync, etc.');
}

// ============================================================================
// EXAMPLE 3: MULTIPLE SYSTEMS WATCHING SAME COMPONENT
// ============================================================================

function createMultipleListenersExample(): void {
    console.log(`\n${'='.repeat(70)}`);
    console.log('EXAMPLE 3: MULTIPLE SYSTEMS WATCHING INVENTORY');
    console.log(`${'='.repeat(70)}\n`);

    const engine = new EngineBuilder().withDebugMode(false).build();

    // System 1: UI Updates (uses pure render function)
    engine.createSystem(
        'InventoryUISystem',
        { all: [Inventory, InventoryUI] },
        {
            watchComponents: [Inventory],
            onComponentChanged: (event) => {
                const inv = event.newValue;
                const ui = event.entity.getComponent(InventoryUI);
                console.log('🎨 InventoryUISystem: Updating UI display');
                renderInventoryPanel(inv, ui);
            },
        }
    );

    // System 2: Achievement Tracking
    engine.createSystem(
        'AchievementSystem',
        { all: [Inventory] },
        {
            watchComponents: [Inventory],
            onComponentChanged: (event) => {
                const inv = event.newValue;
                console.log('🏆 AchievementSystem: Checking achievements');

                if (inv.items.length >= 5) {
                    console.log('   ✨ Achievement unlocked: "Pack Rat" (5+ items)');
                }
                if (inv.gold >= 100) {
                    console.log('   ✨ Achievement unlocked: "Wealthy" (100+ gold)');
                }
            },
        }
    );

    // System 3: Audio Feedback
    engine.createSystem(
        'AudioSystem',
        { all: [Inventory] },
        {
            watchComponents: [Inventory],
            onComponentChanged: (event) => {
                const oldInv = event.oldValue;
                const newInv = event.newValue;
                console.log('🔊 AudioSystem: Playing sound effects');

                if (oldInv) {
                    if (newInv.items.length > oldInv.items.length) {
                        console.log('   🎵 Playing "item_pickup.wav"');
                    } else if (newInv.gold > oldInv.gold) {
                        console.log('   🎵 Playing "coin_jingle.wav"');
                    }
                }
            },
        }
    );

    // Create player and add items
    const player = engine.createEntity('Player');
    player.addComponent(Inventory);
    player.addComponent(InventoryUI);

    const inventory = player.getComponent(Inventory);

    console.log('--- Adding Items (All Systems Notified) ---\n');

    // Add items (direct data modification - components are pure data)
    inventory.items.push(new Item('Sword', 50, 1, '⚔️'));
    inventory.items.push(new Item('Shield', 40, 1, '🛡️'));
    inventory.items.push(new Item('Potion', 10, 3, '🧪'));
    inventory.items.push(new Item('Bread', 5, 2, '🍞'));
    inventory.items.push(new Item('Gem', 100, 1, '💎'));
    inventory.gold = 150;

    engine.markComponentDirty(player, Inventory);
    engine.update(16);

    console.log('\n✅ All three systems received the same event!');
    console.log('Each system can react independently to inventory changes');
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
    console.log(`\n${'█'.repeat(70)}`);
    console.log('REACTIVE INVENTORY EXAMPLES');
    console.log('█'.repeat(70));

    // Example 1: Basic reactive inventory
    createReactiveInventoryExample();

    // Example 2: Batch operations
    createBatchOperationsExample();

    // Example 3: Multiple listeners
    createMultipleListenersExample();

    console.log(`\n${'█'.repeat(70)}`);
    console.log('SUMMARY');
    console.log('█'.repeat(70));
    console.log('\n✅ Key Benefits:');
    console.log('   - UI only updates when inventory changes');
    console.log('   - Can detect specific changes (add/remove/gold)');
    console.log('   - Easy to add animations for each change type');
    console.log('   - Multiple systems can react to same change');
    console.log('   - Batch mode prevents event spam during loading');
    console.log('\n💡 Use Cases:');
    console.log('   - Inventory UI synchronization');
    console.log('   - Achievement tracking');
    console.log('   - Sound effects');
    console.log('   - Network synchronization');
    console.log('   - Analytics and logging');
    console.log('\n');
}

main();
