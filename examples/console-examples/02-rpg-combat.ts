/**
 * RPG Combat Example
 * Demonstrates combat mechanics, status effects, abilities, and component validation
 */

import { EngineBuilder } from '../../core/src/engine';

// ============================================================================
// COMPONENTS (Pure data - no business logic)
// ============================================================================

class Stats {
    constructor(
        public attack: number = 10,
        public defense: number = 5,
        public speed: number = 10,
        public critChance: number = 0.1
    ) {}
}

class Health {
    constructor(
        public current: number = 100,
        public max: number = 100
    ) {}
}

class Mana {
    constructor(
        public current: number = 50,
        public max: number = 50
    ) {}
}

class CombatState {
    constructor(
        public inCombat: boolean = false,
        public target?: symbol,
        public lastAttackTime: number = 0,
        public attackCooldown: number = 1000
    ) {}
}

class StatusEffect {
    constructor(
        public type: 'poison' | 'burn' | 'freeze' | 'stun' | 'regeneration',
        public damage: number = 0,
        public duration: number = 0,
        public tickInterval: number = 1000,
        public lastTick: number = Date.now()
    ) {}
}

class Ability {
    constructor(
        public name: string,
        public manaCost: number,
        public cooldown: number,
        public damage: number = 0,
        public heal: number = 0,
        public effect?: StatusEffect,
        public lastUsed: number = 0
    ) {}
}

class Level {
    constructor(
        public level: number = 1,
        public experience: number = 0,
        public requiredExp: number = 100
    ) {}
}

// ============================================================================
// HELPER FUNCTIONS (Pure functions for component calculations)
// ============================================================================

function getHealthPercentage(health: Health): number {
    return health.current / health.max;
}

function isHealthDead(health: Health): boolean {
    return health.current <= 0;
}

function getManaPercentage(mana: Mana): number {
    return mana.current / mana.max;
}

function isAbilityReady(ability: Ability): boolean {
    return Date.now() - ability.lastUsed >= ability.cooldown;
}

// Initialize engine with validation
const game = new EngineBuilder().withDebugMode(true).withFixedUpdateFPS(60).build();

// Register component validators
game.registerComponentValidator(Health, {
    validate: (component) => {
        if (component.current < 0) return 'Health cannot be negative';
        if (component.current > component.max) return 'Current health cannot exceed max';
        return true;
    },
});

game.registerComponentValidator(Stats, {
    validate: (component) => {
        if (component.attack < 0) return 'Attack cannot be negative';
        if (component.defense < 0) return 'Defense cannot be negative';
        if (component.critChance < 0 || component.critChance > 1)
            return 'Crit chance must be between 0 and 1';
        return true;
    },
    dependencies: [Health], // Stats require Health component
});

game.registerComponentValidator(CombatState, {
    validate: () => true,
    dependencies: [Stats, Health],
});

// Combat System - handles basic attacks
game.createSystem(
    'CombatSystem',
    {
        all: [CombatState, Stats, Health],
        withoutTags: ['dead', 'stunned'],
    },
    {
        priority: 100,
        act: (entity, combatState, stats, _health) => {
            if (!combatState.inCombat || !combatState.target) return;

            const now = Date.now();
            if (now - combatState.lastAttackTime < combatState.attackCooldown) return;

            // Find target
            const target = game.getAllEntities().find((e) => e.id === combatState.target);
            if (!target || !target.hasComponent(Health) || !target.hasComponent(Stats)) return;

            const targetHealth = target.getComponent(Health);
            const targetStats = target.getComponent(Stats);

            // Calculate damage
            let damage = Math.max(1, stats.attack - targetStats.defense);

            // Critical hit chance
            if (Math.random() < stats.critChance) {
                damage *= 2;
                game.messageBus.publish(
                    'critical-hit',
                    {
                        attacker: entity,
                        target: target,
                        damage,
                    },
                    'CombatSystem'
                );
            }

            // Apply damage
            targetHealth.current = Math.max(0, targetHealth.current - damage);
            combatState.lastAttackTime = now;

            // Publish combat event
            game.messageBus.publish(
                'combat-damage',
                {
                    attacker: entity,
                    target: target,
                    damage,
                    remainingHealth: targetHealth.current,
                },
                'CombatSystem'
            );

            // Check for death
            if (isHealthDead(targetHealth)) {
                target.addTag('dead');
                combatState.inCombat = false;
                combatState.target = undefined;

                game.messageBus.publish(
                    'entity-death',
                    {
                        entity: target,
                        killer: entity,
                    },
                    'CombatSystem'
                );
            }
        },
    }
);

// Status Effect System
game.createSystem(
    'StatusEffectSystem',
    {
        all: [StatusEffect, Health],
    },
    {
        priority: 90,
        act: (entity, effect, health) => {
            const now = Date.now();

            // Check if effect should tick
            if (now - effect.lastTick >= effect.tickInterval) {
                effect.lastTick = now;

                switch (effect.type) {
                    case 'poison':
                    case 'burn':
                        health.current = Math.max(0, health.current - effect.damage);
                        break;
                    case 'regeneration':
                        health.current = Math.min(health.max, health.current + effect.damage);
                        break;
                    case 'freeze':
                        // Slows attack speed (handled by modifying cooldown)
                        if (entity.hasComponent(CombatState)) {
                            const combat = entity.getComponent(CombatState);
                            combat.attackCooldown = 2000; // Doubled cooldown
                        }
                        break;
                    case 'stun':
                        entity.addTag('stunned');
                        break;
                }

                // Reduce duration
                effect.duration -= effect.tickInterval;

                // Remove effect if expired
                if (effect.duration <= 0) {
                    entity.removeComponent(StatusEffect);
                    if (effect.type === 'stun') {
                        entity.removeTag('stunned');
                    }
                    if (effect.type === 'freeze' && entity.hasComponent(CombatState)) {
                        const combat = entity.getComponent(CombatState);
                        combat.attackCooldown = 1000; // Reset cooldown
                    }
                }
            }
        },
    }
);

// Ability System
game.createSystem(
    'AbilitySystem',
    {
        all: [Ability, Mana],
        withoutTags: ['dead', 'stunned'],
    },
    {
        priority: 95,
        before: () => {
            // Check for ability activation (simulated input)
            const players = game.getEntitiesByTag('player');
            if (players.length === 0) return;

            const player = players[0];
            if (!player.hasComponent(Ability)) return;

            const ability = player.getComponent(Ability);
            const mana = player.getComponent(Mana);

            // Simulate ability use every 3 seconds
            if (
                isAbilityReady(ability) &&
                mana.current >= ability.manaCost &&
                Math.random() < 0.3
            ) {
                // Find target
                const enemies = game.getEntitiesByTag('enemy');
                if (enemies.length > 0) {
                    const target = enemies[Math.floor(Math.random() * enemies.length)];

                    // Use ability
                    mana.current -= ability.manaCost;
                    ability.lastUsed = Date.now();

                    // Apply effects
                    if (ability.damage > 0 && target.hasComponent(Health)) {
                        const health = target.getComponent(Health);
                        health.current = Math.max(0, health.current - ability.damage);
                    }

                    if (ability.heal > 0 && player.hasComponent(Health)) {
                        const health = player.getComponent(Health);
                        health.current = Math.min(health.max, health.current + ability.heal);
                    }

                    if (ability.effect && !target.hasComponent(StatusEffect)) {
                        target.addComponent(
                            StatusEffect,
                            ability.effect.type,
                            ability.effect.damage,
                            ability.effect.duration,
                            ability.effect.tickInterval
                        );
                    }

                    game.messageBus.publish(
                        'ability-used',
                        {
                            caster: player,
                            target: target,
                            ability: ability.name,
                        },
                        'AbilitySystem'
                    );
                }
            }
        },
    }
);

// Experience and Leveling System
game.messageBus.subscribe('entity-death', (message) => {
    const { entity, killer } = message.data;

    if (killer.hasComponent(Level)) {
        const level = killer.getComponent(Level);

        // Award experience based on enemy level
        const expGain = entity.hasComponent(Level) ? entity.getComponent(Level).level * 50 : 25;

        level.experience += expGain;

        // Check for level up
        while (level.experience >= level.requiredExp) {
            level.experience -= level.requiredExp;
            level.level += 1;
            level.requiredExp = level.level * 100;

            // Increase stats on level up
            if (killer.hasComponent(Stats)) {
                const stats = killer.getComponent(Stats);
                stats.attack += 2;
                stats.defense += 1;
                stats.speed += 1;
            }

            if (killer.hasComponent(Health)) {
                const health = killer.getComponent(Health);
                health.max += 10;
                health.current = health.max; // Full heal on level up
            }

            if (killer.hasComponent(Mana)) {
                const mana = killer.getComponent(Mana);
                mana.max += 5;
                mana.current = mana.max;
            }

            game.messageBus.publish(
                'level-up',
                {
                    entity: killer,
                    newLevel: level.level,
                },
                'ExperienceSystem'
            );
        }
    }
});

// Mana Regeneration System
game.createSystem(
    'ManaRegenerationSystem',
    {
        all: [Mana],
        withoutTags: ['dead'],
    },
    {
        priority: 50,
        act: (_entity, mana) => {
            // Regenerate 1 mana per second
            mana.current = Math.min(mana.max, mana.current + 0.016);
        },
    }
);

// Create player character
const player = game.createEntity('Hero');
player
    .addComponent(Health, 100, 100)
    .addComponent(Mana, 50, 50)
    .addComponent(Stats, 15, 8, 12, 0.15)
    .addComponent(CombatState)
    .addComponent(Level, 1, 0, 100)
    .addComponent(Ability, 'Fireball', 10, 3000, 25, 0, {
        type: 'burn',
        damage: 5,
        duration: 5000,
        tickInterval: 1000,
        lastTick: Date.now(),
    })
    .addTag('player')
    .addTag('hero');

// Create enemy prefabs
const goblinPrefab = {
    name: 'Goblin',
    components: [
        { type: Health, args: [50, 50] },
        { type: Stats, args: [8, 3, 15, 0.05] },
        { type: CombatState, args: [] },
        { type: Level, args: [1, 0, 0] },
    ],
    tags: ['enemy', 'monster'],
};

const orcPrefab = {
    name: 'Orc',
    components: [
        { type: Health, args: [80, 80] },
        { type: Stats, args: [12, 5, 8, 0.1] },
        { type: CombatState, args: [] },
        { type: Level, args: [3, 0, 0] },
    ],
    tags: ['enemy', 'monster'],
};

game.registerPrefab('Goblin', goblinPrefab);
game.registerPrefab('Orc', orcPrefab);

// Spawn enemies
for (let i = 0; i < 3; i++) {
    const goblin = game.createFromPrefab('Goblin', `Goblin${i}`);
    if (goblin) {
        const combat = goblin.getComponent(CombatState);
        combat.inCombat = true;
        combat.target = player.id;
    }
}

for (let i = 0; i < 2; i++) {
    const orc = game.createFromPrefab('Orc', `Orc${i}`);
    if (orc) {
        const combat = orc.getComponent(CombatState);
        combat.inCombat = true;
        combat.target = player.id;
    }
}

// Set player to attack first enemy
const enemies = game.getEntitiesByTag('enemy');
if (enemies.length > 0) {
    const playerCombat = player.getComponent(CombatState);
    playerCombat.inCombat = true;
    playerCombat.target = enemies[0].id;
}

// Combat log system
game.messageBus.subscribe('combat-damage', (message) => {
    const { attacker, target, damage, remainingHealth } = message.data;
    console.log(
        `${attacker.name} deals ${damage} damage to ${target.name} (${remainingHealth} HP remaining)`
    );
});

game.messageBus.subscribe('critical-hit', (_message) => {
    console.log(`💥 CRITICAL HIT!`);
});

game.messageBus.subscribe('entity-death', (message) => {
    const { entity, killer } = message.data;
    console.log(`☠️ ${entity.name} was defeated by ${killer.name}!`);
});

game.messageBus.subscribe('level-up', (message) => {
    const { entity, newLevel } = message.data;
    console.log(`🎉 ${entity.name} reached level ${newLevel}!`);
});

game.messageBus.subscribe('ability-used', (message) => {
    const { caster, target, ability } = message.data;
    console.log(`✨ ${caster.name} casts ${ability} on ${target.name}!`);
});

// Status display system
let displayTimer = 0;
game.createSystem(
    'StatusDisplaySystem',
    {
        tags: ['player'],
        all: [Health, Mana, Level],
    },
    {
        priority: 10,
        act: (entity, health, mana, level) => {
            displayTimer += 0.016;
            if (displayTimer > 2) {
                // Display every 2 seconds
                displayTimer = 0;
                console.log(`\n=== ${entity.name} Status ===`);
                console.log(`Level ${level.level} (${level.experience}/${level.requiredExp} XP)`);
                console.log(
                    `Health: ${health.current}/${health.max} (${Math.round(getHealthPercentage(health) * 100)}%)`
                );
                console.log(
                    `Mana: ${Math.round(mana.current)}/${mana.max} (${Math.round(getManaPercentage(mana) * 100)}%)`
                );

                if (entity.hasComponent(Stats)) {
                    const stats = entity.getComponent(Stats);
                    console.log(
                        `ATK: ${stats.attack} | DEF: ${stats.defense} | SPD: ${stats.speed} | CRIT: ${Math.round(stats.critChance * 100)}%`
                    );
                }

                const remainingEnemies = game
                    .getEntitiesByTag('enemy')
                    .filter((e) => !e.hasTag('dead')).length;
                console.log(`Enemies remaining: ${remainingEnemies}\n`);
            }
        },
    }
);

// Run the game
console.log('Starting RPG Combat Example...');
console.log('Features demonstrated:');
console.log('- Complex combat mechanics with stats');
console.log('- Status effects (poison, burn, freeze, stun)');
console.log('- Ability system with mana costs');
console.log('- Experience and leveling system');
console.log('- Component validation and dependencies');
console.log('- Event-driven combat logging\n');

game.run();

// Stop after 60 seconds
setTimeout(() => {
    game.stop();
    console.log('\nCombat simulation ended.');

    const profiles = game.getSystemProfiles();
    console.log('\n=== System Performance ===');
    profiles.forEach((profile) => {
        console.log(`${profile.name}: ${profile.averageTime.toFixed(2)}ms avg`);
    });
}, 60000);
