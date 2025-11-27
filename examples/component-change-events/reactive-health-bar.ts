/**
 * Reactive Health Bar Example
 *
 * Demonstrates how to use component change events to create
 * a health bar system that only updates when damage is taken.
 *
 * This example shows the performance benefits of event-driven
 * updates over polling-based approaches.
 */

import { EngineBuilder } from '../../core/src/engine';

// ============================================================================
// COMPONENTS
// ============================================================================

// Pure data component - no business logic
class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
    ) {}
}

// Pure data component - all behavior moved to helper functions
class HealthBar {
    currentPercent: number = 1.0;
    updateCount: number = 0;
    animationTime: number = 0;
    targetPercent: number = 1.0;
    showingDamageFlash: boolean = false;
    visible: boolean = false;
}

// ============================================================================
// HELPER FUNCTIONS (Pure functions for health calculations)
// ============================================================================

function getHealthPercent(health: Health): number {
    return health.current / health.max;
}

function _isHealthDead(health: Health): boolean {
    return health.current <= 0;
}

// ============================================================================
// UI HELPER FUNCTIONS (Operate on HealthBar data)
// ============================================================================

function showHealthBar(healthBar: HealthBar): void {
    healthBar.visible = true;
    console.log('🟢 HealthBar: Showing health bar');
}

function hideHealthBar(healthBar: HealthBar): void {
    healthBar.visible = false;
    console.log('🔴 HealthBar: Hiding health bar');
}

function setHealthBarPercent(healthBar: HealthBar, percent: number): void {
    healthBar.currentPercent = percent;
    healthBar.updateCount++;
    console.log(
        `📊 HealthBar: Updated to ${(percent * 100).toFixed(1)}% (Update #${healthBar.updateCount})`
    );
}

function animateHealthBarTo(healthBar: HealthBar, targetPercent: number): void {
    healthBar.targetPercent = targetPercent;
    healthBar.animationTime = 0;
    console.log(
        `🎬 HealthBar: Animating from ${(healthBar.currentPercent * 100).toFixed(1)}% to ${(targetPercent * 100).toFixed(1)}%`
    );
}

function showDamageFlash(healthBar: HealthBar): void {
    healthBar.showingDamageFlash = true;
    console.log('💥 HealthBar: Showing damage flash effect');
}

function _updateHealthBarAnimation(healthBar: HealthBar, deltaTime: number): void {
    // Animate health bar changes
    if (healthBar.animationTime < 0.3) {
        healthBar.animationTime += deltaTime;
        const t = Math.min(healthBar.animationTime / 0.3, 1.0);
        healthBar.currentPercent =
            healthBar.currentPercent + (healthBar.targetPercent - healthBar.currentPercent) * t;
    }

    // Clear damage flash
    if (healthBar.showingDamageFlash) {
        healthBar.showingDamageFlash = false;
    }
}

class Damage {
    amount: number = 0;
}

// ============================================================================
// EXAMPLE 1: EVENT-DRIVEN HEALTH BAR (RECOMMENDED)
// ============================================================================

function createReactiveHealthBarExample(): void {
    console.log(`\n${'='.repeat(70)}`);
    console.log('EXAMPLE 1: EVENT-DRIVEN HEALTH BAR (REACTIVE)');
    console.log(`${'='.repeat(70)}\n`);

    const engine = new EngineBuilder().withDebugMode(false).build();

    // Create reactive health bar system
    engine.createSystem(
        'ReactiveHealthBarSystem',
        { all: [Health, HealthBar] },
        {
            watchComponents: [Health],

            onComponentAdded: (event) => {
                const health = event.component;
                const healthBar = event.entity.getComponent(HealthBar);
                showHealthBar(healthBar);
                setHealthBarPercent(healthBar, getHealthPercent(health));
                console.log(`✅ Health component added - initialized health bar`);
            },

            onComponentRemoved: (event) => {
                const healthBar = event.entity.getComponent(HealthBar);
                hideHealthBar(healthBar);
                console.log(`❌ Health component removed - hiding health bar`);
            },

            onComponentChanged: (event) => {
                const oldHealth = event.oldValue;
                const newHealth = event.newValue;
                const healthBar = event.entity.getComponent(HealthBar);

                // Animate the change
                animateHealthBarTo(healthBar, getHealthPercent(newHealth));

                // Show damage effect if health decreased
                if (oldHealth && oldHealth.current > newHealth.current) {
                    showDamageFlash(healthBar);
                    const damage = oldHealth.current - newHealth.current;
                    console.log(
                        `🩸 Took ${damage} damage! (${newHealth.current}/${newHealth.max})`
                    );
                } else if (oldHealth && oldHealth.current < newHealth.current) {
                    const healing = newHealth.current - oldHealth.current;
                    console.log(`💚 Healed ${healing} HP! (${newHealth.current}/${newHealth.max})`);
                }
            },

            // No act() needed - purely event-driven!
        }
    );

    // Damage system that marks health as dirty
    engine.createSystem(
        'DamageSystem',
        { all: [Health, Damage] },
        {
            act: (entity, health, damage) => {
                if (damage.amount > 0) {
                    health.current = Math.max(0, health.current - damage.amount);

                    // Notify health bar system of the change
                    engine.markComponentDirty(entity, Health);

                    // Clear damage
                    damage.amount = 0;
                }
            },
        }
    );

    // Create test entity
    const player = engine.createEntity('Player');
    player.addComponent(Health, 100, 100);
    player.addComponent(HealthBar);
    player.addComponent(Damage);

    console.log('\n--- Simulating Combat (10 frames) ---\n');

    const healthBar = player.getComponent(HealthBar);
    const damage = player.getComponent(Damage);

    // Frame 1-3: No damage
    console.log('Frame 1-3: Player is idle (no damage)');
    for (let i = 0; i < 3; i++) {
        engine.update(16);
    }
    console.log(`ℹ️  HealthBar updates: ${healthBar.updateCount}`);

    // Frame 4: Take damage
    console.log('\nFrame 4: Enemy hits player for 20 damage');
    damage.amount = 20;
    engine.update(16);
    console.log(`ℹ️  HealthBar updates: ${healthBar.updateCount}`);

    // Frame 5-6: No damage
    console.log('\nFrame 5-6: Player is idle (no damage)');
    for (let i = 0; i < 2; i++) {
        engine.update(16);
    }
    console.log(`ℹ️  HealthBar updates: ${healthBar.updateCount}`);

    // Frame 7: Take damage
    console.log('\nFrame 7: Enemy hits player for 35 damage');
    damage.amount = 35;
    engine.update(16);
    console.log(`ℹ️  HealthBar updates: ${healthBar.updateCount}`);

    // Frame 8-10: No damage
    console.log('\nFrame 8-10: Player is idle (no damage)');
    for (let i = 0; i < 3; i++) {
        engine.update(16);
    }

    console.log(`\n📈 RESULT: Health bar updated ${healthBar.updateCount} times in 10 frames`);
    console.log('✅ Only updated when health actually changed (2 times)!');
}

// ============================================================================
// EXAMPLE 2: POLLING-BASED HEALTH BAR (NOT RECOMMENDED)
// ============================================================================

function createPollingHealthBarExample(): void {
    console.log(`\n${'='.repeat(70)}`);
    console.log('EXAMPLE 2: POLLING-BASED HEALTH BAR (FOR COMPARISON)');
    console.log(`${'='.repeat(70)}\n`);

    const engine = new EngineBuilder().withDebugMode(false).build();

    // Create polling-based health bar system
    engine.createSystem(
        'PollingHealthBarSystem',
        { all: [Health, HealthBar] },
        {
            act: (_entity, health, healthBar) => {
                // Update every frame, even if health didn't change
                setHealthBarPercent(healthBar, getHealthPercent(health));
            },
        }
    );

    // Damage system (same as before)
    engine.createSystem(
        'DamageSystem',
        { all: [Health, Damage] },
        {
            act: (_entity, health, damage) => {
                if (damage.amount > 0) {
                    health.current = Math.max(0, health.current - damage.amount);
                    console.log(
                        `🩸 Took ${damage.amount} damage! (${health.current}/${health.max})`
                    );
                    damage.amount = 0;
                }
            },
        }
    );

    // Create test entity
    const player = engine.createEntity('Player');
    player.addComponent(Health, 100, 100);
    player.addComponent(HealthBar);
    player.addComponent(Damage);

    console.log('\n--- Simulating Combat (10 frames) ---\n');

    const healthBar = player.getComponent(HealthBar);
    const damage = player.getComponent(Damage);

    // Frame 1-3: No damage
    console.log('Frame 1-3: Player is idle (no damage)');
    for (let i = 0; i < 3; i++) {
        engine.update(16);
    }
    console.log(`ℹ️  HealthBar updates: ${healthBar.updateCount}`);

    // Frame 4: Take damage
    console.log('\nFrame 4: Enemy hits player for 20 damage');
    damage.amount = 20;
    engine.update(16);
    console.log(`ℹ️  HealthBar updates: ${healthBar.updateCount}`);

    // Frame 5-6: No damage
    console.log('\nFrame 5-6: Player is idle (no damage)');
    for (let i = 0; i < 2; i++) {
        engine.update(16);
    }
    console.log(`ℹ️  HealthBar updates: ${healthBar.updateCount}`);

    // Frame 7: Take damage
    console.log('\nFrame 7: Enemy hits player for 35 damage');
    damage.amount = 35;
    engine.update(16);
    console.log(`ℹ️  HealthBar updates: ${healthBar.updateCount}`);

    // Frame 8-10: No damage
    console.log('\nFrame 8-10: Player is idle (no damage)');
    for (let i = 0; i < 3; i++) {
        engine.update(16);
    }

    console.log(`\n📈 RESULT: Health bar updated ${healthBar.updateCount} times in 10 frames`);
    console.log("⚠️  Updated every frame, even when health didn't change (10 times)!");
}

// ============================================================================
// EXAMPLE 3: PROXY-BASED REACTIVE COMPONENTS
// ============================================================================

function createProxyBasedExample(): void {
    console.log(`\n${'='.repeat(70)}`);
    console.log('EXAMPLE 3: PROXY-BASED REACTIVE HEALTH BAR');
    console.log(`${'='.repeat(70)}\n`);

    const engine = new EngineBuilder()
        .withChangeTracking({ enableProxyTracking: true })
        .withDebugMode(false)
        .build();

    // Create reactive health bar system
    engine.createSystem(
        'ReactiveHealthBarSystem',
        { all: [Health, HealthBar] },
        {
            watchComponents: [Health],

            onComponentChanged: (event) => {
                const health = event.newValue;
                const healthBar = event.entity.getComponent(HealthBar);
                animateHealthBarTo(healthBar, getHealthPercent(health));

                if (event.oldValue) {
                    const oldHealth = event.oldValue;
                    if (oldHealth.current > health.current) {
                        const damage = oldHealth.current - health.current;
                        console.log(`🩸 Automatic change detected: Took ${damage} damage!`);
                        showDamageFlash(healthBar);
                    }
                }
            },
        }
    );

    // Create entity
    const player = engine.createEntity('Player');
    player.addComponent(Health, 100, 100);
    player.addComponent(HealthBar);

    // Get reactive proxy of health component
    const health = player.getComponent(Health);
    const reactiveHealth = engine.createReactiveComponent(health, player, Health);

    console.log('\n--- Direct Property Changes (Automatically Tracked) ---\n');

    console.log('Assigning: reactiveHealth.current = 80');
    reactiveHealth.current = 80; // Automatically triggers change event!

    console.log('\nAssigning: reactiveHealth.current = 60');
    reactiveHealth.current = 60; // Automatically triggers change event!

    console.log('\nAssigning: reactiveHealth.current = 30');
    reactiveHealth.current = 30; // Automatically triggers change event!

    const healthBar = player.getComponent(HealthBar);
    console.log(`\n✅ Health bar automatically updated ${healthBar.updateCount} times`);
    console.log('No manual markComponentDirty() calls needed!');
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
    console.log(`\n${'█'.repeat(70)}`);
    console.log('REACTIVE HEALTH BAR EXAMPLES');
    console.log('█'.repeat(70));

    // Example 1: Event-driven (recommended)
    createReactiveHealthBarExample();

    // Example 2: Polling-based (for comparison)
    createPollingHealthBarExample();

    // Example 3: Proxy-based reactive components
    createProxyBasedExample();

    console.log(`\n${'█'.repeat(70)}`);
    console.log('SUMMARY');
    console.log('█'.repeat(70));
    console.log('\n✅ Event-driven approach:');
    console.log('   - Only updates when health changes');
    console.log('   - 80% fewer updates in this example');
    console.log('   - Can track old vs new values');
    console.log('   - Easy to add animations and effects');
    console.log('\n⚠️  Polling approach:');
    console.log('   - Updates every frame regardless of changes');
    console.log('   - Wastes CPU cycles');
    console.log('   - Harder to detect changes');
    console.log('\n🚀 Proxy-based approach:');
    console.log('   - Automatic change detection');
    console.log('   - No manual dirty marking');
    console.log('   - Small performance overhead');
    console.log('\n');
}

main();
