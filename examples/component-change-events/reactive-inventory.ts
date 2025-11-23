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

class Inventory {
    items: Item[] = [];
    maxSlots: number = 10;
    gold: number = 0;

    addItem(item: Item): boolean {
        if (this.items.length >= this.maxSlots) {
            return false;
        }
        this.items.push(item);
        return true;
    }

    removeItem(index: number): Item | null {
        if (index < 0 || index >= this.items.length) {
            return null;
        }
        const item = this.items[index];
        this.items.splice(index, 1);
        return item;
    }

    findItem(name: string): number {
        return this.items.findIndex((item) => item.name === name);
    }

    getItemCount(): number {
        return this.items.length;
    }
}

class InventoryUI {
    private updateCount: number = 0;
    private visible: boolean = false;

    show(): void {
        this.visible = true;
        console.log('🎒 InventoryUI: Opening inventory panel');
    }

    hide(): void {
        this.visible = false;
        console.log('🎒 InventoryUI: Closing inventory panel');
    }

    refresh(inventory: Inventory): void {
        this.updateCount++;
        console.log(`\n📋 InventoryUI: Refreshing display (Update #${this.updateCount})`);
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

    addItemAnimation(item: Item, slotIndex: number): void {
        console.log(`✨ InventoryUI: Playing add animation for slot ${slotIndex}`);
        console.log(`   "${item.icon} ${item.name}" appears with sparkle effect`);
    }

    removeItemAnimation(slotIndex: number): void {
        console.log(`💨 InventoryUI: Playing remove animation for slot ${slotIndex}`);
        console.log(`   Item fades out with puff of smoke`);
    }

    goldChangeAnimation(oldGold: number, newGold: number): void {
        const diff = newGold - oldGold;
        const sign = diff > 0 ? '+' : '';
        console.log(`💰 InventoryUI: Gold changed ${sign}${diff} (${oldGold} → ${newGold})`);
        console.log(`   Playing coin animation`);
    }

    getUpdateCount(): number {
        return this.updateCount;
    }
}

class Position {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

// ============================================================================
// EXAMPLE 1: EVENT-DRIVEN INVENTORY UI
// ============================================================================

function createReactiveInventoryExample(): void {
    console.log('\n' + '='.repeat(70));
    console.log('EXAMPLE 1: EVENT-DRIVEN INVENTORY UI');
    console.log('='.repeat(70) + '\n');

    const engine = new EngineBuilder().withDebugMode(false).build();

    // Create reactive inventory UI system
    engine.createSystem(
        'ReactiveInventoryUISystem',
        { all: [Inventory, InventoryUI] },
        {
            watchComponents: [Inventory],

            onComponentAdded: (event) => {
                const inventory = event.component;
                const ui = event.entity.getComponent(InventoryUI);
                ui.show();
                ui.refresh(inventory);
            },

            onComponentRemoved: (event) => {
                const ui = event.entity.getComponent(InventoryUI);
                ui.hide();
            },

            onComponentChanged: (event) => {
                const oldInv = event.oldValue;
                const newInv = event.newValue;
                const ui = event.entity.getComponent(InventoryUI);

                console.log('\n🔔 Inventory changed event received!');

                // Find what changed and animate it
                if (oldInv) {
                    // Check for added items
                    for (let i = 0; i < newInv.items.length; i++) {
                        if (!oldInv.items[i] && newInv.items[i]) {
                            ui.addItemAnimation(newInv.items[i], i);
                        }
                    }

                    // Check for removed items
                    for (let i = 0; i < oldInv.items.length; i++) {
                        if (
                            oldInv.items[i] &&
                            (!newInv.items[i] || oldInv.items[i] !== newInv.items[i])
                        ) {
                            ui.removeItemAnimation(i);
                        }
                    }

                    // Check gold change
                    if (oldInv.gold !== newInv.gold) {
                        ui.goldChangeAnimation(oldInv.gold, newInv.gold);
                    }
                }

                ui.refresh(newInv);
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

    console.log('\n--- Inventory Operations ---');

    // Operation 1: Add potion
    console.log('\n▶ Operation 1: Player finds a health potion');
    inventory.addItem(new Item('Health Potion', 50, 1, '🧪'));
    engine.markComponentDirty(player, Inventory);
    engine.update(16);

    // Operation 2: Add sword
    console.log('\n▶ Operation 2: Player finds a sword');
    inventory.addItem(new Item('Iron Sword', 150, 1, '⚔️'));
    engine.markComponentDirty(player, Inventory);
    engine.update(16);

    // Operation 3: Add multiple items at once (batch)
    console.log('\n▶ Operation 3: Player loots a chest (multiple items)');
    engine.batch(() => {
        inventory.addItem(new Item('Shield', 100, 1, '🛡️'));
        inventory.addItem(new Item('Bread', 5, 3, '🍞'));
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

    // Operation 5: Remove item
    console.log('\n▶ Operation 5: Player uses health potion');
    const potionIndex = inventory.findItem('Health Potion');
    if (potionIndex >= 0) {
        inventory.removeItem(potionIndex);
        engine.markComponentDirty(player, Inventory);
    }
    engine.update(16);

    // Operation 6: Buy/sell with gold change
    console.log('\n▶ Operation 6: Player sells iron sword');
    const swordIndex = inventory.findItem('Iron Sword');
    if (swordIndex >= 0) {
        const sword = inventory.removeItem(swordIndex);
        if (sword) {
            inventory.gold += sword.value;
        }
        engine.markComponentDirty(player, Inventory);
    }
    engine.update(16);

    console.log(`\n📊 RESULT: UI updated ${ui.getUpdateCount()} times for 5 inventory changes`);
    console.log('✅ Only updated when inventory actually changed!');
    console.log(`ℹ️  Skipped 5 idle frames without any updates`);
}

// ============================================================================
// EXAMPLE 2: BATCH OPERATIONS
// ============================================================================

function createBatchOperationsExample(): void {
    console.log('\n' + '='.repeat(70));
    console.log('EXAMPLE 2: BATCH OPERATIONS (LEVEL LOADING)');
    console.log('='.repeat(70) + '\n');

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

    // Add items one by one without batching
    console.log('Adding 5 items individually...');
    for (let i = 0; i < 5; i++) {
        inventory.addItem(new Item(`Item ${i + 1}`, 10, 1, '📦'));
        engine.markComponentDirty(player, Inventory);
    }
    console.log(`Result: ${eventCount} events emitted\n`);

    // Reset
    inventory.items = [];
    eventCount = 0;

    console.log('--- With Batch Mode (One Event) ---\n');

    // Add items in batch mode
    console.log('Adding 5 items in batch mode...');
    engine.batch(() => {
        for (let i = 0; i < 5; i++) {
            inventory.addItem(new Item(`Item ${i + 6}`, 10, 1, '📦'));
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
    console.log('\n' + '='.repeat(70));
    console.log('EXAMPLE 3: MULTIPLE SYSTEMS WATCHING INVENTORY');
    console.log('='.repeat(70) + '\n');

    const engine = new EngineBuilder().withDebugMode(false).build();

    // System 1: UI Updates
    engine.createSystem(
        'InventoryUISystem',
        { all: [Inventory, InventoryUI] },
        {
            watchComponents: [Inventory],
            onComponentChanged: (event) => {
                const inv = event.newValue;
                const ui = event.entity.getComponent(InventoryUI);
                console.log('🎨 InventoryUISystem: Updating UI display');
                ui.refresh(inv);
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

    // Add items
    inventory.addItem(new Item('Sword', 50, 1, '⚔️'));
    inventory.addItem(new Item('Shield', 40, 1, '🛡️'));
    inventory.addItem(new Item('Potion', 10, 3, '🧪'));
    inventory.addItem(new Item('Bread', 5, 2, '🍞'));
    inventory.addItem(new Item('Gem', 100, 1, '💎'));
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
    console.log('\n' + '█'.repeat(70));
    console.log('REACTIVE INVENTORY EXAMPLES');
    console.log('█'.repeat(70));

    // Example 1: Basic reactive inventory
    createReactiveInventoryExample();

    // Example 2: Batch operations
    createBatchOperationsExample();

    // Example 3: Multiple listeners
    createMultipleListenersExample();

    console.log('\n' + '█'.repeat(70));
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
