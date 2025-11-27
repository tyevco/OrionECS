/**
 * Void Vanguard - State Machine Example
 *
 * A Galaga-style space shooter demonstrating the ECS-native State Machine plugin.
 *
 * This example showcases:
 * - States as component presence (ECS-native pattern)
 * - Type-safe condition factories (when.hasComponent, when.componentValue, etc.)
 * - Declarative transition rules with priorities
 * - State change events for game logic hooks
 * - Custom predicates for complex conditions
 * - Multiple FSM definitions for different entity types
 */

import { EngineBuilder, type EntityDef } from '@orion-ecs/core';
import { StateMachine, StateMachinePlugin, transition, when } from '@orion-ecs/state-machine';

// ============================================================================
// Components - Core Data
// ============================================================================

/** Position in 2D space */
export class Position {
    constructor(
        public x: number = 0,
        public y: number = 0
    ) {}
}

/** Velocity for movement */
export class Velocity {
    constructor(
        public dx: number = 0,
        public dy: number = 0
    ) {}
}

/** Health points */
export class Health {
    constructor(
        public current: number = 1,
        public max: number = 1
    ) {}
}

/** Formation slot for enemies */
export class FormationSlot {
    constructor(
        public row: number = 0,
        public col: number = 0
    ) {}
}

/** Dive attack target position */
export class DiveTarget {
    constructor(
        public targetX: number = 0,
        public targetY: number = 0,
        public returnX: number = 0,
        public returnY: number = 0
    ) {}
}

/** Player-specific data */
export class PlayerData {
    shootCooldown: number = 0;
    score: number = 0;
    lives: number = 3;
}

/** Enemy-specific data */
export class EnemyData {
    constructor(
        public type: 'grunt' | 'elite' | 'boss' = 'grunt',
        public points: number = 100
    ) {}
}

/** Bullet data */
export class BulletData {
    constructor(
        public owner: 'player' | 'enemy' = 'player',
        public damage: number = 1,
        public lifetime: number = 2.0
    ) {}
}

/** Renderable sprite data */
export class Renderable {
    constructor(
        public sprite:
            | 'player'
            | 'enemy-grunt'
            | 'enemy-elite'
            | 'enemy-boss'
            | 'bullet'
            | 'explosion' = 'player',
        public color: string = '#FFFFFF'
    ) {}
}

/** Input state for player */
export class InputState {
    left: boolean = false;
    right: boolean = false;
    shoot: boolean = false;
}

// ============================================================================
// State Components - Enemy States
// ============================================================================

/** Enemy is in formation, bobbing gently */
export class FormationState {
    timeInFormation: number = 0;
}

/** Enemy is diving down to attack */
export class DivingState {
    diveProgress: number = 0;
}

/** Enemy is returning to formation after dive */
export class ReturningState {
    returnProgress: number = 0;
}

/** Enemy is dying (explosion animation) */
export class DyingState {
    deathTimer: number = 0.5;
}

// ============================================================================
// State Components - Player States
// ============================================================================

/** Player is in normal state, can be hit */
export class NormalState {}

/** Player was just hit, brief stun */
export class HitState {
    hitTimer: number = 0.3;
}

/** Player is invincible (after being hit) */
export class InvincibleState {
    invincibleTimer: number = 2.0;
}

// ============================================================================
// Tag Components
// ============================================================================

export class PlayerTag {
    readonly __tag = 'PlayerTag' as const;
}
export class EnemyTag {
    readonly __tag = 'EnemyTag' as const;
}
export class BulletTag {
    readonly __tag = 'BulletTag' as const;
}

// ============================================================================
// Game Configuration
// ============================================================================

export const SCREEN_WIDTH = 800;
export const SCREEN_HEIGHT = 600;
export const FORMATION_ROWS = 4;
export const FORMATION_COLS = 10;
export const ENEMY_SPACING_X = 60;
export const ENEMY_SPACING_Y = 50;
export const FORMATION_START_X = 100;
export const FORMATION_START_Y = 60;
export const DIVE_CHANCE = 0.003; // Lower chance for smoother gameplay
export const PLAYER_START_X = SCREEN_WIDTH / 2;
export const PLAYER_START_Y = SCREEN_HEIGHT - 60;
export const PLAYER_SPEED = 300;
export const BULLET_SPEED = 500;

// ============================================================================
// State Machine Plugin Setup
// ============================================================================

const stateMachinePlugin = new StateMachinePlugin()
    .predicate('random.diveChance', (_entity: EntityDef, args: { chance: number }) => {
        return Math.random() < args.chance;
    })
    .predicate('dive.reachedTarget', (entity: EntityDef, _args: object) => {
        if (!entity.hasComponent(Position) || !entity.hasComponent(DiveTarget)) return false;
        const pos = entity.getComponent(Position);
        const target = entity.getComponent(DiveTarget);
        const dist = Math.abs(pos.x - target.targetX) + Math.abs(pos.y - target.targetY);
        return dist < 5;
    })
    .predicate('dive.returnedToFormation', (entity: EntityDef, _args: object) => {
        if (!entity.hasComponent(Position) || !entity.hasComponent(DiveTarget)) return false;
        const pos = entity.getComponent(Position);
        const target = entity.getComponent(DiveTarget);
        const dist = Math.abs(pos.x - target.returnX) + Math.abs(pos.y - target.returnY);
        return dist < 5;
    })
    .predicate('timer.expired', (entity: EntityDef, args: { component: string; field: string }) => {
        type TimerComponent = { hitTimer?: number; invincibleTimer?: number; deathTimer?: number };
        let component: TimerComponent | null = null;
        if (args.component === 'HitState' && entity.hasComponent(HitState)) {
            component = entity.getComponent(HitState);
        } else if (args.component === 'InvincibleState' && entity.hasComponent(InvincibleState)) {
            component = entity.getComponent(InvincibleState);
        } else if (args.component === 'DyingState' && entity.hasComponent(DyingState)) {
            component = entity.getComponent(DyingState);
        }
        if (!component) return false;
        const value = component[args.field as keyof TimerComponent];
        return typeof value === 'number' && value <= 0;
    });

// ============================================================================
// Engine Setup
// ============================================================================

export const engine = new EngineBuilder()
    .withDebugMode(false)
    .withFixedUpdateFPS(60)
    .use(stateMachinePlugin)
    .build();

// Get the state machine API - type is inferred from the plugin
const fsm = (
    engine as unknown as {
        stateMachine: (typeof stateMachinePlugin)['__extensions']['stateMachine'];
    }
).stateMachine;

// ============================================================================
// State Machine Definitions
// ============================================================================

fsm.define('EnemyAI', {
    states: [FormationState, DivingState, ReturningState, DyingState],
    transitions: [
        transition(FormationState, DyingState, when.componentValue(Health, 'current', 'lte', 0), {
            priority: 1000,
        }),
        transition(
            FormationState,
            DivingState,
            fsm.when.predicate('random.diveChance', { chance: DIVE_CHANCE }),
            { priority: 10 }
        ),
        transition(DivingState, DyingState, when.componentValue(Health, 'current', 'lte', 0), {
            priority: 1000,
        }),
        transition(DivingState, ReturningState, fsm.when.predicate('dive.reachedTarget', {}), {
            priority: 100,
        }),
        transition(ReturningState, DyingState, when.componentValue(Health, 'current', 'lte', 0), {
            priority: 1000,
        }),
        transition(
            ReturningState,
            FormationState,
            fsm.when.predicate('dive.returnedToFormation', {}),
            { priority: 100 }
        ),
    ],
    initialState: FormationState,
});

fsm.define('PlayerFSM', {
    states: [NormalState, HitState, InvincibleState],
    transitions: [
        transition(
            HitState,
            InvincibleState,
            fsm.when.predicate('timer.expired', { component: 'HitState', field: 'hitTimer' }),
            { priority: 100 }
        ),
        transition(
            InvincibleState,
            NormalState,
            fsm.when.predicate('timer.expired', {
                component: 'InvincibleState',
                field: 'invincibleTimer',
            }),
            { priority: 100 }
        ),
    ],
    initialState: NormalState,
});

// ============================================================================
// Delta Time Tracking
// ============================================================================

let currentDeltaTime = 1 / 60;

export function setDeltaTime(dt: number): void {
    currentDeltaTime = dt;
}

// ============================================================================
// Systems
// ============================================================================

// Timer Update System
engine.createSystem(
    'TimerUpdateSystem',
    { all: [StateMachine] },
    {
        priority: 950,
        act: (entity: EntityDef) => {
            if (entity.hasComponent(HitState)) {
                const hit = entity.getComponent(HitState);
                hit.hitTimer -= currentDeltaTime;
            }
            if (entity.hasComponent(InvincibleState)) {
                const inv = entity.getComponent(InvincibleState);
                inv.invincibleTimer -= currentDeltaTime;
            }
            if (entity.hasComponent(DyingState)) {
                const dying = entity.getComponent(DyingState);
                dying.deathTimer -= currentDeltaTime;
            }
            if (entity.hasComponent(FormationState)) {
                const formation = entity.getComponent(FormationState);
                formation.timeInFormation += currentDeltaTime;
            }
        },
    },
    false
);

// Player Input System
engine.createSystem(
    'PlayerInputSystem',
    { all: [PlayerTag, Position, Velocity, InputState] },
    {
        priority: 900,
        act: (entity: EntityDef) => {
            const vel = entity.getComponent(Velocity);
            const input = entity.getComponent(InputState);

            vel.dx = 0;
            if (input.left) vel.dx = -PLAYER_SPEED;
            if (input.right) vel.dx = PLAYER_SPEED;
        },
    },
    false
);

// Player Shooting System
engine.createSystem(
    'PlayerShootingSystem',
    { all: [PlayerTag, Position, PlayerData, InputState] },
    {
        priority: 850,
        act: (entity: EntityDef) => {
            const pos = entity.getComponent(Position);
            const data = entity.getComponent(PlayerData);
            const input = entity.getComponent(InputState);

            data.shootCooldown -= currentDeltaTime;
            if (input.shoot && data.shootCooldown <= 0) {
                createBullet(pos.x, pos.y - 20, 'player');
                data.shootCooldown = 0.2;
            }
        },
    },
    false
);

// Formation Movement System
engine.createSystem(
    'FormationMovementSystem',
    { all: [FormationState, Position, FormationSlot] },
    {
        priority: 100,
        act: (entity: EntityDef) => {
            const pos = entity.getComponent(Position);
            const slot = entity.getComponent(FormationSlot);

            const time = Date.now() / 1000;
            const baseX = FORMATION_START_X + slot.col * ENEMY_SPACING_X;
            const baseY = FORMATION_START_Y + slot.row * ENEMY_SPACING_Y;

            pos.x = baseX + Math.sin(time * 2 + slot.col * 0.3) * 15;
            pos.y = baseY + Math.sin(time * 1.5 + slot.row * 0.5) * 5;
        },
    },
    false
);

// Dive Movement System
engine.createSystem(
    'DiveMovementSystem',
    { all: [DivingState, Position, DiveTarget, Velocity] },
    {
        priority: 100,
        act: (entity: EntityDef) => {
            const pos = entity.getComponent(Position);
            const target = entity.getComponent(DiveTarget);
            const vel = entity.getComponent(Velocity);

            const speed = 250;
            const dx = target.targetX - pos.x;
            const dy = target.targetY - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 1) {
                vel.dx = (dx / dist) * speed;
                vel.dy = (dy / dist) * speed;
            } else {
                vel.dx = 0;
                vel.dy = 0;
            }
        },
    },
    false
);

// Return Movement System
engine.createSystem(
    'ReturnMovementSystem',
    { all: [ReturningState, Position, DiveTarget, Velocity] },
    {
        priority: 100,
        act: (entity: EntityDef) => {
            const pos = entity.getComponent(Position);
            const target = entity.getComponent(DiveTarget);
            const vel = entity.getComponent(Velocity);

            const speed = 180;
            const dx = target.returnX - pos.x;
            const dy = target.returnY - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 1) {
                vel.dx = (dx / dist) * speed;
                vel.dy = (dy / dist) * speed;
            } else {
                vel.dx = 0;
                vel.dy = 0;
            }
        },
    },
    false
);

// Death System
engine.createSystem(
    'DeathSystem',
    { all: [DyingState] },
    {
        priority: 50,
        act: (entity: EntityDef) => {
            const dying = entity.getComponent(DyingState);
            if (dying.deathTimer <= 0) {
                entity.queueFree();
            }
        },
    },
    false
);

// Movement System
engine.createSystem(
    'MovementSystem',
    { all: [Position, Velocity] },
    {
        priority: 200,
        act: (entity: EntityDef) => {
            const pos = entity.getComponent(Position);
            const vel = entity.getComponent(Velocity);

            pos.x += vel.dx * currentDeltaTime;
            pos.y += vel.dy * currentDeltaTime;

            // Keep player in bounds
            if (entity.hasComponent(PlayerTag)) {
                pos.x = Math.max(30, Math.min(SCREEN_WIDTH - 30, pos.x));
            }
        },
    },
    false
);

// Bullet Lifetime System
engine.createSystem(
    'BulletLifetimeSystem',
    { all: [BulletTag, BulletData, Position] },
    {
        priority: 150,
        act: (entity: EntityDef) => {
            const bullet = entity.getComponent(BulletData);
            const pos = entity.getComponent(Position);

            bullet.lifetime -= currentDeltaTime;
            if (bullet.lifetime <= 0 || pos.y < -10 || pos.y > SCREEN_HEIGHT + 10) {
                entity.queueFree();
            }
        },
    },
    false
);

// Collision System
engine.createSystem(
    'CollisionSystem',
    { all: [Position, BulletTag, BulletData] },
    {
        priority: 300,
        act: (bullet: EntityDef) => {
            const bulletPos = bullet.getComponent(Position);
            const bulletData = bullet.getComponent(BulletData);

            if (bulletData.owner === 'player') {
                const enemies = engine.createQuery({ all: [Position, EnemyTag, Health] });
                enemies.forEach((enemy: EntityDef) => {
                    if (enemy.hasComponent(DyingState)) return;

                    const enemyPos = enemy.getComponent(Position);

                    const dx = bulletPos.x - enemyPos.x;
                    const dy = bulletPos.y - enemyPos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 25) {
                        const health = enemy.getComponent(Health);
                        health.current -= bulletData.damage;
                        bullet.queueFree();

                        const players = engine.createQuery({ all: [PlayerTag, PlayerData] });
                        players.forEach((player: EntityDef) => {
                            const data = player.getComponent(PlayerData);
                            if (enemy.hasComponent(EnemyData)) {
                                const enemyData = enemy.getComponent(EnemyData);
                                data.score += enemyData.points;
                            }
                        });
                    }
                });
            }
        },
    },
    false
);

// ============================================================================
// Event Handlers
// ============================================================================

engine.on(
    'stateEnter',
    (event: { entity: EntityDef; stateType: unknown; previousStateType: unknown }) => {
        if (event.stateType === DivingState) {
            if (!event.entity.hasComponent(Position) || !event.entity.hasComponent(FormationSlot)) {
                return;
            }
            const _pos = event.entity.getComponent(Position);
            const slot = event.entity.getComponent(FormationSlot);

            const targetX = PLAYER_START_X + (Math.random() - 0.5) * 300;
            const targetY = SCREEN_HEIGHT - 100;
            const returnX = FORMATION_START_X + slot.col * ENEMY_SPACING_X;
            const returnY = FORMATION_START_Y + slot.row * ENEMY_SPACING_Y;

            if (!event.entity.hasComponent(DiveTarget)) {
                event.entity.addComponent(DiveTarget, targetX, targetY, returnX, returnY);
            } else {
                const target = event.entity.getComponent(DiveTarget);
                target.targetX = targetX;
                target.targetY = targetY;
                target.returnX = returnX;
                target.returnY = returnY;
            }
        }
    }
);

engine.on('stateEnter', (event: { entity: EntityDef; stateType: unknown }) => {
    if (event.stateType === FormationState) {
        if (event.entity.hasComponent(Velocity)) {
            const vel = event.entity.getComponent(Velocity);
            vel.dx = 0;
            vel.dy = 0;
        }
    }
});

engine.on('stateEnter', (event: { entity: EntityDef; stateType: unknown }) => {
    if (event.stateType === DyingState) {
        if (event.entity.hasComponent(Renderable)) {
            const renderable = event.entity.getComponent(Renderable);
            renderable.sprite = 'explosion';
            renderable.color = '#FF6600';
        }
    }
});

// ============================================================================
// Entity Creation Functions
// ============================================================================

export function createPlayer(): EntityDef {
    const player = engine.createEntity('Player');
    player.addComponent(Position, PLAYER_START_X, PLAYER_START_Y);
    player.addComponent(Velocity, 0, 0);
    player.addComponent(Health, 3, 3);
    player.addComponent(PlayerData);
    player.addComponent(PlayerTag);
    player.addComponent(InputState);
    player.addComponent(Renderable, 'player', '#00FF88');
    player.addComponent(NormalState);
    player.addComponent(StateMachine, NormalState, 'PlayerFSM');
    return player;
}

export function createEnemy(row: number, col: number): EntityDef {
    const enemy = engine.createEntity(`Enemy_${row}_${col}`);

    const x = FORMATION_START_X + col * ENEMY_SPACING_X;
    const y = FORMATION_START_Y + row * ENEMY_SPACING_Y;

    enemy.addComponent(Position, x, y);
    enemy.addComponent(Velocity, 0, 0);
    enemy.addComponent(Health, 1, 1);
    enemy.addComponent(FormationSlot, row, col);
    enemy.addComponent(EnemyTag);

    const type = row === 0 ? 'boss' : row === 1 ? 'elite' : 'grunt';
    const points = type === 'boss' ? 500 : type === 'elite' ? 200 : 100;
    const color = type === 'boss' ? '#FF0066' : type === 'elite' ? '#FFAA00' : '#00AAFF';
    enemy.addComponent(EnemyData, type, points);
    enemy.addComponent(
        Renderable,
        `enemy-${type}` as 'enemy-grunt' | 'enemy-elite' | 'enemy-boss',
        color
    );

    enemy.addComponent(FormationState);
    enemy.addComponent(StateMachine, FormationState, 'EnemyAI');
    return enemy;
}

export function createBullet(x: number, y: number, owner: 'player' | 'enemy'): EntityDef {
    const bullet = engine.createEntity('Bullet');
    bullet.addComponent(Position, x, y);
    bullet.addComponent(Velocity, 0, owner === 'player' ? -BULLET_SPEED : BULLET_SPEED);
    bullet.addComponent(BulletTag);
    bullet.addComponent(BulletData, owner, 1, 2.0);
    bullet.addComponent(Renderable, 'bullet', owner === 'player' ? '#00FF00' : '#FF0000');
    return bullet;
}

// ============================================================================
// Game Initialization
// ============================================================================

export function initGame(): void {
    createPlayer();
    for (let row = 0; row < FORMATION_ROWS; row++) {
        for (let col = 0; col < FORMATION_COLS; col++) {
            createEnemy(row, col);
        }
    }
}

// ============================================================================
// Game Loop
// ============================================================================

export function gameLoop(deltaTime: number): void {
    setDeltaTime(deltaTime);
    engine.update(deltaTime);
}

// Re-export StateMachine for browser access
export { StateMachine };
