/**
 * Entity Hierarchy Example
 * Demonstrates parent-child relationships, transform propagation, and scene graphs
 */

import type { EntityDef } from '../../core/src/definitions';
import { EngineBuilder } from '../../core/src/engine';

// Transform Components
class Transform {
    constructor(
        public localX: number = 0,
        public localY: number = 0,
        public localRotation: number = 0,
        public localScale: number = 1
    ) {}
}

class WorldTransform {
    constructor(
        public x: number = 0,
        public y: number = 0,
        public rotation: number = 0,
        public scale: number = 1
    ) {}
}

class Velocity {
    constructor(
        public linear: number = 0,
        public angular: number = 0
    ) {}
}

class Orbit {
    constructor(
        public radius: number = 100,
        public speed: number = 1,
        public angle: number = 0
    ) {}
}

class Visual {
    constructor(
        public shape: 'circle' | 'square' | 'triangle' | 'star' = 'circle',
        public size: number = 20,
        public color: string = '#ffffff',
        public label?: string
    ) {}
}

class Joint {
    constructor(
        public type: 'fixed' | 'rotating' | 'sliding' = 'fixed',
        public minAngle: number = -Math.PI,
        public maxAngle: number = Math.PI,
        public springStrength: number = 0
    ) {}
}

// Initialize engine
const game = new EngineBuilder().withDebugMode(true).withFixedUpdateFPS(60).build();

// Transform Propagation System - updates world transforms based on hierarchy
game.createSystem(
    'TransformPropagationSystem',
    {
        all: [Transform, WorldTransform],
    },
    {
        priority: 100,
        act: (entity, transform, worldTransform) => {
            if (!entity.parent) {
                // Root entities - world transform equals local transform
                worldTransform.x = transform.localX;
                worldTransform.y = transform.localY;
                worldTransform.rotation = transform.localRotation;
                worldTransform.scale = transform.localScale;
            } else {
                // Child entities - combine with parent's world transform
                const parent = entity.parent;
                if (parent.hasComponent(WorldTransform)) {
                    const parentWorld = parent.getComponent(WorldTransform);

                    // Apply parent's transformation
                    const cos = Math.cos(parentWorld.rotation);
                    const sin = Math.sin(parentWorld.rotation);

                    // Rotate and scale local position by parent
                    worldTransform.x =
                        parentWorld.x +
                        (transform.localX * cos - transform.localY * sin) * parentWorld.scale;
                    worldTransform.y =
                        parentWorld.y +
                        (transform.localX * sin + transform.localY * cos) * parentWorld.scale;

                    // Combine rotations and scales
                    worldTransform.rotation = parentWorld.rotation + transform.localRotation;
                    worldTransform.scale = parentWorld.scale * transform.localScale;
                }
            }

            // Update children recursively
            for (const child of entity.children) {
                if (child.hasComponent(Transform) && child.hasComponent(WorldTransform)) {
                    // Children will be updated in their own system iteration
                }
            }
        },
    }
);

// Movement System - moves entities with velocity
game.createSystem(
    'MovementSystem',
    {
        all: [Transform, Velocity],
    },
    {
        priority: 90,
        act: (_entity, transform, velocity) => {
            if (velocity.linear !== 0) {
                transform.localX += Math.cos(transform.localRotation) * velocity.linear * 0.016;
                transform.localY += Math.sin(transform.localRotation) * velocity.linear * 0.016;
            }

            if (velocity.angular !== 0) {
                transform.localRotation += velocity.angular * 0.016;
            }
        },
    }
);

// Orbit System - makes entities orbit around their parent
game.createSystem(
    'OrbitSystem',
    {
        all: [Transform, Orbit],
    },
    {
        priority: 85,
        act: (_entity, transform, orbit) => {
            orbit.angle += orbit.speed * 0.016;
            transform.localX = Math.cos(orbit.angle) * orbit.radius;
            transform.localY = Math.sin(orbit.angle) * orbit.radius;
        },
    }
);

// Joint Constraint System
game.createSystem(
    'JointSystem',
    {
        all: [Transform, Joint],
    },
    {
        priority: 80,
        act: (_entity, transform, joint) => {
            if (joint.type === 'rotating') {
                // Constrain rotation to limits
                transform.localRotation = Math.max(
                    joint.minAngle,
                    Math.min(joint.maxAngle, transform.localRotation)
                );

                // Apply spring force if enabled
                if (joint.springStrength > 0) {
                    const centerAngle = (joint.minAngle + joint.maxAngle) / 2;
                    const diff = centerAngle - transform.localRotation;
                    transform.localRotation += diff * joint.springStrength * 0.016;
                }
            }
        },
    }
);

// Visualization System - logs hierarchy structure
let visualizationTimer = 0;
game.createSystem(
    'VisualizationSystem',
    {
        all: [WorldTransform, Visual],
    },
    {
        priority: 10,
        act: (entity, _worldTransform, _visual) => {
            visualizationTimer += 0.016;

            // Log every 2 seconds
            if (visualizationTimer > 2 && entity.name === 'SolarSystem') {
                visualizationTimer = 0;
                console.log('\n=== Scene Hierarchy ===');
                printHierarchy(entity, 0);
                console.log('');
            }
        },
    }
);

function printHierarchy(entity: EntityDef, depth: number) {
    const indent = '  '.repeat(depth);
    const visual = entity.hasComponent(Visual) ? entity.getComponent(Visual) : null;
    const worldTransform = entity.hasComponent(WorldTransform)
        ? entity.getComponent(WorldTransform)
        : null;

    let info = `${indent}${entity.name}`;
    if (visual?.label) {
        info += ` (${visual.label})`;
    }
    if (worldTransform) {
        info += ` [${worldTransform.x.toFixed(1)}, ${worldTransform.y.toFixed(1)}]`;
    }

    console.log(info);

    for (const child of entity.children) {
        printHierarchy(child, depth + 1);
    }
}

// Create a solar system hierarchy
const solarSystem = game.createEntity('SolarSystem');
solarSystem
    .addComponent(Transform, 400, 300, 0, 1)
    .addComponent(WorldTransform)
    .addComponent(Visual, 'star', 40, '#ffff00', 'Sun')
    .addTag('root');

// Create planets
const mercury = game.createEntity('Mercury');
mercury
    .addComponent(Transform, 60, 0, 0, 0.5)
    .addComponent(WorldTransform)
    .addComponent(Visual, 'circle', 8, '#8b7355', 'Mercury')
    .addComponent(Orbit, 60, 4, 0)
    .setParent(solarSystem);

const earth = game.createEntity('Earth');
earth
    .addComponent(Transform, 150, 0, 0, 1)
    .addComponent(WorldTransform)
    .addComponent(Visual, 'circle', 16, '#4169e1', 'Earth')
    .addComponent(Orbit, 150, 1, 0)
    .addComponent(Velocity, 0, 0.5) // Earth rotates
    .setParent(solarSystem);

// Moon orbits Earth
const moon = game.createEntity('Moon');
moon.addComponent(Transform, 30, 0, 0, 0.3)
    .addComponent(WorldTransform)
    .addComponent(Visual, 'circle', 6, '#c0c0c0', 'Moon')
    .addComponent(Orbit, 30, 3, 0)
    .setParent(earth);

const mars = game.createEntity('Mars');
mars.addComponent(Transform, 220, 0, 0, 0.8)
    .addComponent(WorldTransform)
    .addComponent(Visual, 'circle', 12, '#cd5c5c', 'Mars')
    .addComponent(Orbit, 220, 0.8, Math.PI)
    .setParent(solarSystem);

// Mars moons
const phobos = game.createEntity('Phobos');
phobos
    .addComponent(Transform, 20, 0, 0, 0.2)
    .addComponent(WorldTransform)
    .addComponent(Visual, 'circle', 4, '#a0a0a0', 'Phobos')
    .addComponent(Orbit, 20, 5, 0)
    .setParent(mars);

const deimos = game.createEntity('Deimos');
deimos
    .addComponent(Transform, 30, 0, 0, 0.15)
    .addComponent(WorldTransform)
    .addComponent(Visual, 'circle', 3, '#808080', 'Deimos')
    .addComponent(Orbit, 30, 3, Math.PI)
    .setParent(mars);

// Create a robotic arm hierarchy
const robotBase = game.createEntity('RobotBase');
robotBase
    .addComponent(Transform, 200, 450, 0, 1)
    .addComponent(WorldTransform)
    .addComponent(Visual, 'square', 40, '#333333', 'Base')
    .addTag('robot');

const robotArm1 = game.createEntity('RobotArm1');
robotArm1
    .addComponent(Transform, 0, -30, 0, 1)
    .addComponent(WorldTransform)
    .addComponent(Visual, 'square', 60, '#666666', 'Upper Arm')
    .addComponent(Joint, 'rotating', -Math.PI / 2, Math.PI / 2, 0.1)
    .addComponent(Velocity, 0, 0.5)
    .setParent(robotBase);

const robotArm2 = game.createEntity('RobotArm2');
robotArm2
    .addComponent(Transform, 0, -60, 0, 0.8)
    .addComponent(WorldTransform)
    .addComponent(Visual, 'square', 50, '#999999', 'Lower Arm')
    .addComponent(Joint, 'rotating', -Math.PI / 3, Math.PI / 3, 0.2)
    .addComponent(Velocity, 0, -0.8)
    .setParent(robotArm1);

const robotGripper = game.createEntity('RobotGripper');
robotGripper
    .addComponent(Transform, 0, -40, 0, 0.6)
    .addComponent(WorldTransform)
    .addComponent(Visual, 'triangle', 20, '#cccccc', 'Gripper')
    .addComponent(Joint, 'rotating', -Math.PI / 4, Math.PI / 4, 0.3)
    .addComponent(Velocity, 0, 1.2)
    .setParent(robotArm2);

// Create a character with animated parts
const character = game.createEntity('Character');
character
    .addComponent(Transform, 600, 200, 0, 1)
    .addComponent(WorldTransform)
    .addComponent(Visual, 'circle', 30, '#fdbcb4', 'Body')
    .addComponent(Velocity, 50, 0)
    .addTag('character');

// Animated limbs
for (let i = 0; i < 4; i++) {
    const limb = game.createEntity(`Limb${i}`);
    const angle = (i / 4) * Math.PI * 2;
    limb.addComponent(Transform, Math.cos(angle) * 20, Math.sin(angle) * 20, angle, 0.5)
        .addComponent(WorldTransform)
        .addComponent(Visual, 'square', 10, '#8b4513', `Limb ${i}`)
        .addComponent(Orbit, 20, 2 + i * 0.5, angle)
        .setParent(character);
}

// Detach/Attach System - demonstrates dynamic hierarchy changes
let detachTimer = 0;
game.createSystem(
    'DetachAttachSystem',
    {
        tags: ['character'],
    },
    {
        priority: 50,
        act: (entity) => {
            detachTimer += 0.016;

            // Every 5 seconds, detach and reattach a random limb
            if (detachTimer > 5) {
                detachTimer = 0;

                const limbs = entity.children.filter((child) => child.name?.startsWith('Limb'));
                if (limbs.length > 0) {
                    const randomLimb = limbs[Math.floor(Math.random() * limbs.length)];

                    if (randomLimb.parent) {
                        console.log(`Detaching ${randomLimb.name} from ${entity.name}`);
                        randomLimb.setParent(null);

                        // Give it some velocity when detached
                        if (!randomLimb.hasComponent(Velocity)) {
                            randomLimb.addComponent(Velocity, 100, 2);
                        }
                    } else {
                        console.log(`Reattaching ${randomLimb.name} to ${entity.name}`);
                        randomLimb.setParent(entity);
                        randomLimb.removeComponent(Velocity);
                    }
                }
            }
        },
    }
);

// Hierarchy Statistics System
game.createSystem(
    'HierarchyStatsSystem',
    {
        all: [],
    },
    {
        priority: 5,
        before: () => {
            const allEntities = game.getAllEntities();
            const roots = allEntities.filter((e) => !e.parent);
            const withChildren = allEntities.filter((e) => e.children.length > 0);

            let maxDepth = 0;
            function calculateDepth(entity: EntityDef, depth: number = 0) {
                maxDepth = Math.max(maxDepth, depth);
                for (const child of entity.children) {
                    calculateDepth(child, depth + 1);
                }
            }

            for (const root of roots) {
                calculateDepth(root);
            }

            if (Math.random() < 0.05) {
                // Log occasionally
                console.log('\n=== Hierarchy Statistics ===');
                console.log(`Total Entities: ${allEntities.length}`);
                console.log(`Root Entities: ${roots.length}`);
                console.log(`Parent Entities: ${withChildren.length}`);
                console.log(`Max Hierarchy Depth: ${maxDepth}`);
            }
        },
    }
);

// Performance monitoring for hierarchy operations
setInterval(() => {
    const profiles = game.getSystemProfiles();
    console.log('\n=== Hierarchy Performance ===');
    profiles.forEach((profile) => {
        if (profile.callCount > 0) {
            console.log(`${profile.name}: ${profile.averageTime.toFixed(2)}ms avg`);
        }
    });
}, 10000);

// Run the example
console.log('Starting Entity Hierarchy Example...');
console.log('Features demonstrated:');
console.log('- Parent-child entity relationships');
console.log('- Transform propagation through hierarchy');
console.log('- Solar system with orbiting bodies');
console.log('- Robotic arm with joint constraints');
console.log('- Dynamic hierarchy modification');
console.log('- Character with animated limbs');
console.log('- Efficient transform calculations\n');

game.run();

// Stop after 45 seconds
setTimeout(() => {
    game.stop();
    console.log('\nHierarchy example stopped.');

    // Show final hierarchy state
    console.log('\n=== Final Hierarchy ===');
    const roots = game.getAllEntities().filter((e) => !e.parent);
    for (const root of roots) {
        printHierarchy(root, 0);
    }
}, 45000);
