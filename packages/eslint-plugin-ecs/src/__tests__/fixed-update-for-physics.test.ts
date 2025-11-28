import { RuleTester } from '@typescript-eslint/rule-tester';

import { fixedUpdateForPhysics } from '../rules/fixed-update-for-physics';

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
        },
    },
});

ruleTester.run('fixed-update-for-physics', fixedUpdateForPhysics, {
    valid: [
        // Physics system with fixed update
        {
            code: `
                engine.createSystem('PhysicsSystem', { all: [RigidBody, Position] }, {
                    act: (entity, rb, pos) => {
                        pos.y += rb.velocity.y;
                    }
                }, true);
            `,
        },
        // Collision system with fixed update
        {
            code: `
                engine.createSystem('CollisionSystem', { all: [Collider, Position] }, {
                    act: (entity, collider, pos) => {}
                }, true);
            `,
        },
        // Non-physics system with variable update
        {
            code: `
                engine.createSystem('RenderSystem', { all: [Position, Sprite] }, {
                    act: (entity, pos, sprite) => {
                        render(sprite, pos);
                    }
                }, false);
            `,
        },
        // Non-physics system without 4th argument
        {
            code: `
                engine.createSystem('InputSystem', { all: [Input] }, {
                    act: (entity, input) => {
                        processInput(input);
                    }
                });
            `,
        },
        // Physics by name with fixed update
        {
            code: `
                engine.createSystem('GravitySystem', { all: [Position, Velocity] }, {
                    act: (entity, pos, vel) => {
                        vel.y += 9.8;
                    }
                }, true);
            `,
        },
        // MovementSystem with fixed update (physics by name)
        {
            code: `
                engine.createSystem('MovementSystem', { all: [Position, Velocity] }, {
                    act: (entity, pos, vel) => {
                        pos.x += vel.x;
                        pos.y += vel.y;
                    }
                }, true);
            `,
        },
        // Custom component with fixed update
        {
            code: `
                engine.createSystem('CustomPhysics', { all: [Mass, Force] }, {
                    act: (entity, mass, force) => {}
                }, true);
            `,
        },
        // Box collider with fixed update
        {
            code: `
                engine.createSystem('BoxColliderSystem', { all: [BoxCollider] }, {
                    act: (entity, collider) => {}
                }, true);
            `,
        },
    ],
    invalid: [
        // Physics system without fixed update flag
        {
            code: `
                engine.createSystem('PhysicsSystem', { all: [RigidBody, Position] }, {
                    act: (entity, rb, pos) => {}
                });
            `,
            errors: [{ messageId: 'shouldUseFixedUpdate' }],
        },
        // Physics system with explicit false
        {
            code: `
                engine.createSystem('PhysicsSystem', { all: [RigidBody] }, {
                    act: (entity, rb) => {}
                }, false);
            `,
            errors: [{ messageId: 'shouldUseFixedUpdate' }],
        },
        // Collider system without fixed update
        {
            code: `
                engine.createSystem('CollisionDetection', { all: [Collider, Position] }, {
                    act: (entity, collider, pos) => {}
                });
            `,
            errors: [{ messageId: 'shouldUseFixedUpdate' }],
        },
        // Gravity system (name-based detection) without fixed update
        {
            code: `
                engine.createSystem('GravitySystem', { all: [Position, Velocity] }, {
                    act: (entity, pos, vel) => {
                        vel.y += 9.8;
                    }
                });
            `,
            errors: [{ messageId: 'inconsistentPhysics' }],
        },
        // Movement system without fixed update
        {
            code: `
                engine.createSystem('MovementSystem', { all: [Position, Velocity] }, {
                    act: (entity, pos, vel) => {}
                }, false);
            `,
            errors: [{ messageId: 'inconsistentPhysics' }],
        },
        // PhysicsBody component
        {
            code: `
                engine.createSystem('BodySystem', { all: [PhysicsBody] }, {
                    act: (entity, body) => {}
                });
            `,
            errors: [{ messageId: 'shouldUseFixedUpdate' }],
        },
        // Force component
        {
            code: `
                engine.createSystem('ForceSystem', { all: [Force, Position] }, {
                    act: (entity, force, pos) => {}
                });
            `,
            errors: [{ messageId: 'shouldUseFixedUpdate' }],
        },
        // Multiple physics components
        {
            code: `
                engine.createSystem('FullPhysics', { all: [RigidBody, Collider, Mass] }, {
                    act: (entity, rb, col, mass) => {}
                });
            `,
            errors: [{ messageId: 'shouldUseFixedUpdate' }],
        },
        // CircleCollider
        {
            code: `
                engine.createSystem('CircleCollision', { all: [CircleCollider] }, {
                    act: (entity, collider) => {}
                });
            `,
            errors: [{ messageId: 'shouldUseFixedUpdate' }],
        },
        // AngularVelocity
        {
            code: `
                engine.createSystem('RotationSystem', { all: [AngularVelocity] }, {
                    act: (entity, angVel) => {}
                }, false);
            `,
            errors: [{ messageId: 'shouldUseFixedUpdate' }],
        },
    ],
});
