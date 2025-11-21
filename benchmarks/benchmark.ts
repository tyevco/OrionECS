import { benchmarkSuite } from "jest-bench";
import { EngineBuilder } from '../src/engine';

// Test components for benchmarks
class Position {
    constructor(public x: number = 0, public y: number = 0) {}
}

class Velocity {
    constructor(public x: number = 0, public y: number = 0) {}
}

class Health {
    constructor(public current: number = 100, public max: number = 100) {}
}

class Damage {
    constructor(public value: number = 10) {}
}

class Armor {
    constructor(public value: number = 5) {}
}

class Transform {
    constructor(
        public x: number = 0, 
        public y: number = 0, 
        public rotation: number = 0,
        public scaleX: number = 1,
        public scaleY: number = 1
    ) {}
}

class Renderable {
    constructor(public sprite: string = 'default', public visible: boolean = true) {}
}

class AI {
    constructor(public state: string = 'idle', public targetId?: symbol) {}
}

// Seeded random for consistent benchmarks
function seededRandom(seed: number) {
    let m = 0x80000000;
    let a = 1103515245;
    let c = 12345;

    return function () {
        seed = (a * seed + c) % m;
        return seed / m;
    };
}

const random = seededRandom(42);

benchmarkSuite("Enhanced ECS Performance Benchmarks", {
    
    // Entity Creation and Component Management
    "Entity Creation (1000 entities)": () => {
        const engine = new EngineBuilder().withDebugMode(false).build();
        
        for (let i = 0; i < 1000; i++) {
            const entity = engine.createEntity(`Entity_${i}`);
            entity.addComponent(Position, random() * 1000, random() * 1000);
            entity.addComponent(Health, 100, 100);
        }
    },

    "Bulk Entity Creation (1000 entities)": () => {
        const engine = new EngineBuilder().withDebugMode(false).build();
        const prefab = {
            name: 'TestEntity',
            components: [
                { type: Position, args: [0, 0] },
                { type: Health, args: [100, 100] }
            ],
            tags: ['test']
        };

        // Register prefab first
        engine.registerPrefab('TestEntity', prefab);

        // Create bulk entities from prefab
        engine.createEntities(1000, 'TestEntity');
    },

    "Component Addition (10000 operations)": () => {
        const engine = new EngineBuilder().withDebugMode(false).build();
        const entities = [];
        
        // Create entities first
        for (let i = 0; i < 1000; i++) {
            entities.push(engine.createEntity());
        }
        
        // Add components (benchmark this part)
        for (let i = 0; i < 10; i++) {
            for (const entity of entities) {
                entity.addComponent(Velocity, random() * 10, random() * 10);
                entity.removeComponent(Velocity);
            }
        }
    },

    // Query System Performance
    "Simple Query Performance (1000 entities)": () => {
        const engine = new EngineBuilder().withDebugMode(false).build();
        
        // Create diverse entity population
        for (let i = 0; i < 1000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, random() * 1000, random() * 1000);
            
            if (i % 2 === 0) entity.addComponent(Velocity, random() * 10, random() * 10);
            if (i % 3 === 0) entity.addComponent(Health, 100, 100);
            if (i % 5 === 0) entity.addTag('player');
        }
        
        // Create and execute query-based system
        engine.createSystem('MovementSystem', {
            all: [Position, Velocity]
        }, {
            act: (entity, position, velocity) => {
                position.x += velocity.x;
                position.y += velocity.y;
            }
        });
        
        // Run 100 updates
        for (let i = 0; i < 100; i++) {
            engine.update(16);
        }
    },

    "Complex Query Performance (ALL/ANY/NOT)": () => {
        const engine = new EngineBuilder().withDebugMode(false).build();
        
        // Create diverse entity population
        for (let i = 0; i < 1000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, random() * 1000, random() * 1000);
            
            if (i % 2 === 0) entity.addComponent(Velocity, random() * 10, random() * 10);
            if (i % 3 === 0) entity.addComponent(Health, 100, 100);
            if (i % 4 === 0) entity.addComponent(Damage, 25);
            if (i % 5 === 0) entity.addComponent(Armor, 10);
            if (i % 7 === 0) entity.addTag('enemy');
            if (i % 11 === 0) entity.addTag('frozen');
        }
        
        // Complex query: entities with Position AND (Health OR Damage), but NOT frozen
        engine.createSystem('CombatSystem', {
            all: [Position],
            any: [Health, Damage],
            withoutTags: ['frozen']
        }, {
            act: (entity, position) => {
                // Simulate combat calculations
                position.x += Math.sin(Date.now() * 0.001) * 0.1;
                position.y += Math.cos(Date.now() * 0.001) * 0.1;
            }
        });
        
        // Run 100 updates
        for (let i = 0; i < 100; i++) {
            engine.update(16);
        }
    },

    "Tag Query Performance": () => {
        const engine = new EngineBuilder().withDebugMode(false).build();
        
        // Create entities with various tag combinations
        for (let i = 0; i < 1000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, random() * 1000, random() * 1000);
            
            const tags = ['player', 'enemy', 'npc', 'projectile', 'pickup'];
            for (let j = 0; j < 3; j++) {
                if (random() > 0.5) {
                    entity.addTag(tags[Math.floor(random() * tags.length)]);
                }
            }
        }
        
        // Tag-based system
        engine.createSystem('PlayerSystem', {
            tags: ['player'],
            withoutTags: ['dead']
        }, {
            act: (entity) => {
                // Player-specific logic
                if (entity.hasComponent(Position)) {
                    const pos = entity.getComponent(Position);
                    pos.x += Math.sin(Date.now() * 0.002);
                }
            }
        });
        
        // Run 100 updates
        for (let i = 0; i < 100; i++) {
            engine.update(16);
        }
    },

    // System Execution Performance
    "Multi-System Execution (5 systems, 1000 entities)": () => {
        const engine = new EngineBuilder().withDebugMode(false).build();
        
        // Create game-like entity population
        for (let i = 0; i < 1000; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, random() * 1000, random() * 1000);
            entity.addComponent(Transform, random() * 1000, random() * 1000, random() * Math.PI * 2);
            
            if (i % 2 === 0) {
                entity.addComponent(Velocity, (random() - 0.5) * 20, (random() - 0.5) * 20);
            }
            if (i % 3 === 0) {
                entity.addComponent(Health, 100, 100);
                entity.addComponent(Damage, 25);
            }
            if (i % 4 === 0) {
                entity.addComponent(Renderable, `sprite_${i % 10}`);
            }
            if (i % 5 === 0) {
                entity.addComponent(AI, 'patrol');
            }
        }
        
        // Movement System (Priority 100)
        engine.createSystem('MovementSystem', {
            all: [Position, Velocity]
        }, {
            priority: 100,
            act: (entity, position, velocity) => {
                position.x += velocity.x * 0.016;
                position.y += velocity.y * 0.016;
            }
        });
        
        // Combat System (Priority 90)
        engine.createSystem('CombatSystem', {
            all: [Health, Damage]
        }, {
            priority: 90,
            act: (entity, health, damage) => {
                if (health.current > 0) {
                    health.current = Math.max(0, health.current - damage.value * 0.01);
                }
            }
        });
        
        // Transform Update System (Priority 80)
        engine.createSystem('TransformSystem', {
            all: [Position, Transform]
        }, {
            priority: 80,
            act: (entity, position, transform) => {
                transform.x = position.x;
                transform.y = position.y;
                transform.rotation += 0.01;
            }
        });
        
        // AI System (Priority 70)
        engine.createSystem('AISystem', {
            all: [AI, Position]
        }, {
            priority: 70,
            act: (entity, ai, position) => {
                switch (ai.state) {
                    case 'patrol':
                        if (entity.hasComponent(Velocity)) {
                            const vel = entity.getComponent(Velocity);
                            vel.x += (random() - 0.5) * 0.1;
                            vel.y += (random() - 0.5) * 0.1;
                        }
                        break;
                }
            }
        });
        
        // Render System (Priority 10)
        engine.createSystem('RenderSystem', {
            all: [Transform, Renderable]
        }, {
            priority: 10,
            act: (entity, transform, renderable) => {
                if (renderable.visible) {
                    // Simulate render calculations
                    const distance = Math.sqrt(transform.x * transform.x + transform.y * transform.y);
                    renderable.visible = distance < 2000;
                }
            }
        });
        
        // Run 100 updates with all systems
        for (let i = 0; i < 100; i++) {
            engine.update(16);
        }
    },

    // Entity Hierarchy Performance
    "Entity Hierarchy Operations": () => {
        const engine = new EngineBuilder().withDebugMode(false).build();
        
        // Create hierarchical structure: 100 parents, each with 10 children
        const parents = [];
        for (let i = 0; i < 100; i++) {
            const parent = engine.createEntity(`Parent_${i}`);
            parent.addComponent(Position, random() * 1000, random() * 1000);
            parent.addTag('parent');
            parents.push(parent);
            
            for (let j = 0; j < 10; j++) {
                const child = engine.createEntity(`Child_${i}_${j}`);
                child.addComponent(Position, 0, 0);
                child.addTag('child');
                parent.addChild(child);
            }
        }
        
        // System that affects parent and propagates to children
        engine.createSystem('HierarchySystem', {
            tags: ['parent']
        }, {
            act: (entity) => {
                if (entity.hasComponent(Position)) {
                    const pos = entity.getComponent(Position);
                    pos.x += Math.sin(Date.now() * 0.001);
                    pos.y += Math.cos(Date.now() * 0.001);
                    
                    // Update all children relative to parent
                    for (const child of entity.children) {
                        if (child.hasComponent(Position)) {
                            const childPos = child.getComponent(Position);
                            childPos.x = pos.x + Math.sin(Date.now() * 0.01) * 50;
                            childPos.y = pos.y + Math.cos(Date.now() * 0.01) * 50;
                        }
                    }
                }
            }
        });
        
        // Run 50 updates
        for (let i = 0; i < 50; i++) {
            engine.update(16);
        }
    },

    // Component Validation Performance
    "Component Validation Overhead": () => {
        const engine = new EngineBuilder().withDebugMode(false).build();
        
        // Register validators
        engine.registerComponentValidator(Health, {
            validate: (component) => component.current >= 0 && component.current <= component.max,
            dependencies: [Position]
        });
        
        engine.registerComponentValidator(Damage, {
            validate: (component) => component.value > 0,
            conflicts: [Health] // Unrealistic but tests conflict checking
        });
        
        // Create entities with validation
        const entities = [];
        for (let i = 0; i < 500; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Position, random() * 1000, random() * 1000);
            entities.push(entity);
        }
        
        // Add validated components
        for (const entity of entities) {
            entity.addComponent(Health, Math.floor(random() * 100), 100);
        }
    },

    // Memory and Pooling Performance
    "Entity Lifecycle (Create/Destroy)": () => {
        const engine = new EngineBuilder().withDebugMode(false).build();
        
        // Simulate game loop with entity creation/destruction
        for (let cycle = 0; cycle < 100; cycle++) {
            const entities = [];
            
            // Create entities
            for (let i = 0; i < 100; i++) {
                const entity = engine.createEntity();
                entity.addComponent(Position, random() * 1000, random() * 1000);
                entity.addComponent(Velocity, (random() - 0.5) * 10, (random() - 0.5) * 10);
                entity.addTag('temporary');
                entities.push(entity);
            }
            
            // Use entities for a few updates
            for (let update = 0; update < 5; update++) {
                for (const entity of entities) {
                    if (entity.hasComponent(Position) && entity.hasComponent(Velocity)) {
                        const pos = entity.getComponent(Position);
                        const vel = entity.getComponent(Velocity);
                        pos.x += vel.x;
                        pos.y += vel.y;
                    }
                }
            }
            
            // Destroy entities (tests pooling)
            for (const entity of entities) {
                entity.queueFree();
            }
            
            // Clean up
            engine.update(16);
        }
    },

    // Serialization Performance
    "World Serialization": () => {
        const engine = new EngineBuilder().withDebugMode(false).build();
        
        // Create complex world state
        for (let i = 0; i < 500; i++) {
            const entity = engine.createEntity(`Entity_${i}`);
            entity.addComponent(Position, random() * 1000, random() * 1000);
            entity.addComponent(Health, Math.floor(random() * 100), 100);
            entity.addComponent(Transform, random() * 1000, random() * 1000, random() * Math.PI * 2);
            
            if (i % 2 === 0) entity.addComponent(Velocity, random() * 10, random() * 10);
            if (i % 3 === 0) entity.addTag('player');
            if (i % 5 === 0) entity.addTag('enemy');
            if (i % 7 === 0) entity.addTag('npc');
        }
        
        // Serialize world state 10 times
        for (let i = 0; i < 10; i++) {
            const serialized = engine.serialize();
            // Simulate processing serialized data
            JSON.stringify(serialized);
        }
    },

    // Message Bus Performance
    "Inter-System Messaging": () => {
        const engine = new EngineBuilder().withDebugMode(false).build();
        let messageCount = 0;
        
        // Set up message subscribers
        engine.messageBus.subscribe('entity-spawn', () => messageCount++);
        engine.messageBus.subscribe('entity-damage', () => messageCount++);
        engine.messageBus.subscribe('entity-death', () => messageCount++);
        
        // Create entities
        for (let i = 0; i < 100; i++) {
            const entity = engine.createEntity();
            entity.addComponent(Health, 100, 100);
            entity.addComponent(Position, random() * 1000, random() * 1000);
        }
        
        // System that publishes messages
        engine.createSystem('EventSystem', {
            all: [Health]
        }, {
            act: (entity, health) => {
                // Simulate various events
                if (random() > 0.95) {
                    engine.messageBus.publish('entity-spawn', { entityId: entity.id });
                }
                if (random() > 0.9) {
                    engine.messageBus.publish('entity-damage', { 
                        entityId: entity.id, 
                        damage: Math.floor(random() * 10) 
                    });
                }
                if (health.current <= 0) {
                    engine.messageBus.publish('entity-death', { entityId: entity.id });
                }
                
                health.current -= random() * 2;
            }
        });
        
        // Run simulation
        for (let i = 0; i < 100; i++) {
            engine.update(16);
        }
    }
});