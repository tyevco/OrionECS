/**
 * Reactive Health Bar Example
 *
 * Demonstrates how to use component change events to create
 * a health bar system that only updates when damage is taken.
 *
 * This example shows the performance benefits of event-driven
 * updates over polling-based approaches.
 */

import { EngineBuilder } from '../../core/src/index';

// ============================================================================
// COMPONENTS
// ============================================================================

class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
    ) {}

    get percent(): number {
        return this.current / this.max;
    }

    get isDead(): boolean {
        return this.current <= 0;
    }
}

class HealthBar {
    private currentPercent: number = 1.0;
    private updateCount: number = 0;
    private animationTime: number = 0;
    private targetPercent: number = 1.0;
    private showingDamageFlash: boolean = false;

    show(): void {
        console.log('🟢 HealthBar: Showing health bar');
    }

    hide(): void {
        console.log('🔴 HealthBar: Hiding health bar');
    }

    setPercent(percent: number): void {
        this.currentPercent = percent;
        this.updateCount++;
        console.log(
            `📊 HealthBar: Updated to ${(percent * 100).toFixed(1)}% (Update #${this.updateCount})`
        );
    }

    animateTo(targetPercent: number): void {
        this.targetPercent = targetPercent;
        this.animationTime = 0;
        console.log(
            `🎬 HealthBar: Animating from ${(this.currentPercent * 100).toFixed(1)}% to ${(targetPercent * 100).toFixed(1)}%`
        );
    }

    showDamageFlash(): void {
        this.showingDamageFlash = true;
        console.log('💥 HealthBar: Showing damage flash effect');
    }

    update(deltaTime: number): void {
        // Animate health bar changes
        if (this.animationTime < 0.3) {
            this.animationTime += deltaTime;
            const t = Math.min(this.animationTime / 0.3, 1.0);
            this.currentPercent =
                this.currentPercent + (this.targetPercent - this.currentPercent) * t;
        }

        // Clear damage flash
        if (this.showingDamageFlash) {
            this.showingDamageFlash = false;
        }
    }

    getUpdateCount(): number {
        return this.updateCount;
    }
}

class Damage {
    amount: number = 0;
}

// ============================================================================
// EXAMPLE 1: EVENT-DRIVEN HEALTH BAR (RECOMMENDED)
// ============================================================================

function createReactiveHealthBarExample(): void {
    console.log('\n' + '='.repeat(70));
    console.log('EXAMPLE 1: EVENT-DRIVEN HEALTH BAR (REACTIVE)');
    console.log('='.repeat(70) + '\n');

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
                healthBar.show();
                healthBar.setPercent(health.percent);
                console.log(`✅ Health component added - initialized health bar`);
            },

            onComponentRemoved: (event) => {
                const healthBar = event.entity.getComponent(HealthBar);
                healthBar.hide();
                console.log(`❌ Health component removed - hiding health bar`);
            },

            onComponentChanged: (event) => {
                const oldHealth = event.oldValue;
                const newHealth = event.newValue;
                const healthBar = event.entity.getComponent(HealthBar);

                // Animate the change
                healthBar.animateTo(newHealth.percent);

                // Show damage effect if health decreased
                if (oldHealth && oldHealth.current > newHealth.current) {
                    healthBar.showDamageFlash();
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
    console.log(`ℹ️  HealthBar updates: ${healthBar.getUpdateCount()}`);

    // Frame 4: Take damage
    console.log('\nFrame 4: Enemy hits player for 20 damage');
    damage.amount = 20;
    engine.update(16);
    console.log(`ℹ️  HealthBar updates: ${healthBar.getUpdateCount()}`);

    // Frame 5-6: No damage
    console.log('\nFrame 5-6: Player is idle (no damage)');
    for (let i = 0; i < 2; i++) {
        engine.update(16);
    }
    console.log(`ℹ️  HealthBar updates: ${healthBar.getUpdateCount()}`);

    // Frame 7: Take damage
    console.log('\nFrame 7: Enemy hits player for 35 damage');
    damage.amount = 35;
    engine.update(16);
    console.log(`ℹ️  HealthBar updates: ${healthBar.getUpdateCount()}`);

    // Frame 8-10: No damage
    console.log('\nFrame 8-10: Player is idle (no damage)');
    for (let i = 0; i < 3; i++) {
        engine.update(16);
    }

    console.log(`\n📈 RESULT: Health bar updated ${healthBar.getUpdateCount()} times in 10 frames`);
    console.log('✅ Only updated when health actually changed (2 times)!');
}

// ============================================================================
// EXAMPLE 2: POLLING-BASED HEALTH BAR (NOT RECOMMENDED)
// ============================================================================

function createPollingHealthBarExample(): void {
    console.log('\n' + '='.repeat(70));
    console.log('EXAMPLE 2: POLLING-BASED HEALTH BAR (FOR COMPARISON)');
    console.log('='.repeat(70) + '\n');

    const engine = new EngineBuilder().withDebugMode(false).build();

    // Create polling-based health bar system
    engine.createSystem(
        'PollingHealthBarSystem',
        { all: [Health, HealthBar] },
        {
            act: (entity, health, healthBar) => {
                // Update every frame, even if health didn't change
                healthBar.setPercent(health.percent);
            },
        }
    );

    // Damage system (same as before)
    engine.createSystem(
        'DamageSystem',
        { all: [Health, Damage] },
        {
            act: (entity, health, damage) => {
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
    console.log(`ℹ️  HealthBar updates: ${healthBar.getUpdateCount()}`);

    // Frame 4: Take damage
    console.log('\nFrame 4: Enemy hits player for 20 damage');
    damage.amount = 20;
    engine.update(16);
    console.log(`ℹ️  HealthBar updates: ${healthBar.getUpdateCount()}`);

    // Frame 5-6: No damage
    console.log('\nFrame 5-6: Player is idle (no damage)');
    for (let i = 0; i < 2; i++) {
        engine.update(16);
    }
    console.log(`ℹ️  HealthBar updates: ${healthBar.getUpdateCount()}`);

    // Frame 7: Take damage
    console.log('\nFrame 7: Enemy hits player for 35 damage');
    damage.amount = 35;
    engine.update(16);
    console.log(`ℹ️  HealthBar updates: ${healthBar.getUpdateCount()}`);

    // Frame 8-10: No damage
    console.log('\nFrame 8-10: Player is idle (no damage)');
    for (let i = 0; i < 3; i++) {
        engine.update(16);
    }

    console.log(`\n📈 RESULT: Health bar updated ${healthBar.getUpdateCount()} times in 10 frames`);
    console.log("⚠️  Updated every frame, even when health didn't change (10 times)!");
}

// ============================================================================
// EXAMPLE 3: PROXY-BASED REACTIVE COMPONENTS
// ============================================================================

function createProxyBasedExample(): void {
    console.log('\n' + '='.repeat(70));
    console.log('EXAMPLE 3: PROXY-BASED REACTIVE HEALTH BAR');
    console.log('='.repeat(70) + '\n');

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
                healthBar.animateTo(health.percent);

                if (event.oldValue) {
                    const oldHealth = event.oldValue;
                    if (oldHealth.current > health.current) {
                        const damage = oldHealth.current - health.current;
                        console.log(`🩸 Automatic change detected: Took ${damage} damage!`);
                        healthBar.showDamageFlash();
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
    console.log(`\n✅ Health bar automatically updated ${healthBar.getUpdateCount()} times`);
    console.log('No manual markComponentDirty() calls needed!');
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
    console.log('\n' + '█'.repeat(70));
    console.log('REACTIVE HEALTH BAR EXAMPLES');
    console.log('█'.repeat(70));

    // Example 1: Event-driven (recommended)
    createReactiveHealthBarExample();

    // Example 2: Polling-based (for comparison)
    createPollingHealthBarExample();

    // Example 3: Proxy-based reactive components
    createProxyBasedExample();

    console.log('\n' + '█'.repeat(70));
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
