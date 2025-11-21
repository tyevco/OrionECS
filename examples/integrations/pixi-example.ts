/**
 * Pixi.js Integration Example for OrionECS
 *
 * This example demonstrates how to integrate OrionECS with Pixi.js for 2D rendering.
 * It shows how to synchronize ECS entities with Pixi display objects, handle lifecycle,
 * and create a complete rendering pipeline.
 *
 * To run this example:
 * 1. Install Pixi.js: npm install pixi.js
 * 2. Uncomment the Pixi.js imports and code below
 * 3. Set up a browser environment with a canvas element
 * 4. Initialize and run the game loop
 */

import { EngineBuilder } from '../../core/src/engine';
import type { EntityDef } from '../../core/src/definitions';

// ============================================================================
// Pixi.js Imports (uncomment when pixi.js is installed)
// ============================================================================

/*
import * as PIXI from 'pixi.js';

// Alternative for Pixi.js v7+:
// import { Application, Sprite, Container, Texture, Graphics } from 'pixi.js';
*/

// ============================================================================
// Components
// ============================================================================

/**
 * Position in 2D space
 */
class Position {
  constructor(public x: number = 0, public y: number = 0) {}
}

/**
 * Velocity for movement
 */
class Velocity {
  constructor(public dx: number = 0, public dy: number = 0) {}
}

/**
 * Rotation angle (in radians)
 */
class Rotation {
  constructor(public angle: number = 0) {}
}

/**
 * Scale for sprite size
 */
class Scale {
  constructor(public x: number = 1, public y: number = 1) {}
}

/**
 * Pixi.js sprite component
 * Manages the display object lifecycle
 */
class PixiSprite {
  sprite: any = null; // PIXI.Sprite when pixi.js is available
  textureName: string;
  tint: number;
  anchor: { x: number; y: number };
  zIndex: number;

  constructor(
    textureName: string = 'default',
    tint: number = 0xFFFFFF,
    anchorX: number = 0.5,
    anchorY: number = 0.5,
    zIndex: number = 0
  ) {
    this.textureName = textureName;
    this.tint = tint;
    this.anchor = { x: anchorX, y: anchorY };
    this.zIndex = zIndex;
  }

  /**
   * Component lifecycle hook - called when component is added to entity
   */
  onCreate(entity: EntityDef): void {
    console.log(`[PixiSprite] Creating sprite for entity: ${entity.name}`);
    // Sprite creation happens in the PixiSetupSystem
  }

  /**
   * Component lifecycle hook - called when component is removed from entity
   */
  onDestroy(entity: EntityDef): void {
    console.log(`[PixiSprite] Destroying sprite for entity: ${entity.name}`);
    // Cleanup happens in the PixiCleanupSystem
  }
}

/**
 * Pixi.js graphics component for procedural shapes
 */
class PixiGraphics {
  graphics: any = null; // PIXI.Graphics when pixi.js is available
  drawFunction: (graphics: any) => void;
  zIndex: number;

  constructor(
    drawFunction: (graphics: any) => void,
    zIndex: number = 0
  ) {
    this.drawFunction = drawFunction;
    this.zIndex = zIndex;
  }
}

/**
 * Pixi.js container for grouping display objects
 */
class PixiContainer {
  container: any = null; // PIXI.Container when pixi.js is available
  zIndex: number;

  constructor(zIndex: number = 0) {
    this.zIndex = zIndex;
  }
}

/**
 * Opacity/alpha value
 */
class Opacity {
  constructor(public alpha: number = 1.0) {}
}

/**
 * Visible flag
 */
class Visible {
  constructor(public value: boolean = true) {}
}

// ============================================================================
// Pixi Application Manager
// ============================================================================

/**
 * Manages the Pixi.js application and rendering context
 */
class PixiAppManager {
  app: any = null; // PIXI.Application when available
  stage: any = null; // PIXI.Container when available
  textures: Map<string, any> = new Map(); // Map<string, PIXI.Texture>
  isInitialized: boolean = false;

  /**
   * Initialize Pixi.js application
   */
  async initialize(width: number = 800, height: number = 600): Promise<void> {
    console.log('[PixiAppManager] Initializing...');

    /*
    // Uncomment when pixi.js is available:

    this.app = new PIXI.Application({
      width,
      height,
      backgroundColor: 0x1a1a1a,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    // Add canvas to DOM
    document.body.appendChild(this.app.view as HTMLCanvasElement);

    this.stage = this.app.stage;

    // Load textures
    await this.loadTextures();

    this.isInitialized = true;
    console.log('[PixiAppManager] Initialized successfully');
    */

    // For this example without pixi.js installed:
    this.isInitialized = true;
    console.log('[PixiAppManager] Simulated initialization (install pixi.js for actual rendering)');
  }

  /**
   * Load textures for sprites
   */
  async loadTextures(): Promise<void> {
    /*
    // Uncomment when pixi.js is available:

    // Load texture atlas or individual textures
    await PIXI.Assets.load([
      { alias: 'player', src: 'assets/player.png' },
      { alias: 'enemy', src: 'assets/enemy.png' },
      { alias: 'bullet', src: 'assets/bullet.png' }
    ]);

    // Store textures
    this.textures.set('player', PIXI.Texture.from('player'));
    this.textures.set('enemy', PIXI.Texture.from('enemy'));
    this.textures.set('bullet', PIXI.Texture.from('bullet'));

    // Default white texture
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0xFFFFFF);
    graphics.drawRect(0, 0, 32, 32);
    graphics.endFill();
    this.textures.set('default', this.app.renderer.generateTexture(graphics));
    */

    console.log('[PixiAppManager] Textures loaded (simulated)');
  }

  /**
   * Get texture by name
   */
  getTexture(name: string): any {
    return this.textures.get(name) || this.textures.get('default');
  }

  /**
   * Add display object to stage
   */
  addToStage(displayObject: any): void {
    if (this.stage && displayObject) {
      this.stage.addChild(displayObject);
    }
  }

  /**
   * Remove display object from stage
   */
  removeFromStage(displayObject: any): void {
    if (this.stage && displayObject) {
      this.stage.removeChild(displayObject);
    }
  }

  /**
   * Get the Pixi renderer for advanced use
   */
  getRenderer(): any {
    return this.app?.renderer;
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
    }
    this.isInitialized = false;
  }
}

// ============================================================================
// Engine and Pixi Setup
// ============================================================================

const pixiManager = new PixiAppManager();

const engine = new EngineBuilder()
  .withDebugMode(true)
  .withFixedUpdateFPS(60)
  .build();

// ============================================================================
// Pixi Setup System
// ============================================================================

/**
 * Sets up Pixi sprites for entities that need them
 */
engine.createSystem('PixiSetupSystem',
  { all: [PixiSprite], none: [] },
  {
    priority: 1000,
    act: (entity: EntityDef, pixiSprite: PixiSprite) => {
      // Skip if sprite already created
      if (pixiSprite.sprite) return;

      /*
      // Uncomment when pixi.js is available:

      // Create sprite
      const texture = pixiManager.getTexture(pixiSprite.textureName);
      pixiSprite.sprite = new PIXI.Sprite(texture);

      // Set properties
      pixiSprite.sprite.anchor.set(pixiSprite.anchor.x, pixiSprite.anchor.y);
      pixiSprite.sprite.tint = pixiSprite.tint;
      pixiSprite.sprite.zIndex = pixiSprite.zIndex;

      // Add to stage
      pixiManager.addToStage(pixiSprite.sprite);

      console.log(`[PixiSetupSystem] Created sprite for ${entity.name}`);
      */

      // Simulated sprite creation
      pixiSprite.sprite = {
        x: 0,
        y: 0,
        rotation: 0,
        scale: { x: 1, y: 1 },
        alpha: 1,
        visible: true
      };
      console.log(`[PixiSetupSystem] Created simulated sprite for ${entity.name}`);
    }
  },
  false // Variable update
);

/**
 * Sets up Pixi graphics for entities
 */
engine.createSystem('PixiGraphicsSetupSystem',
  { all: [PixiGraphics] },
  {
    priority: 1000,
    act: (entity: EntityDef, pixiGraphics: PixiGraphics) => {
      // Skip if graphics already created
      if (pixiGraphics.graphics) return;

      /*
      // Uncomment when pixi.js is available:

      pixiGraphics.graphics = new PIXI.Graphics();
      pixiGraphics.graphics.zIndex = pixiGraphics.zIndex;

      // Execute draw function
      pixiGraphics.drawFunction(pixiGraphics.graphics);

      // Add to stage
      pixiManager.addToStage(pixiGraphics.graphics);
      */

      console.log(`[PixiGraphicsSetupSystem] Created graphics for ${entity.name}`);
    }
  },
  false
);

// ============================================================================
// Pixi Sync System
// ============================================================================

/**
 * Synchronizes ECS component data with Pixi sprite properties
 */
engine.createSystem('PixiSyncSystem',
  { all: [PixiSprite] },
  {
    priority: -100, // Run late (after game logic)
    act: (entity: EntityDef, pixiSprite: PixiSprite) => {
      if (!pixiSprite.sprite) return;

      // Sync position
      if (entity.hasComponent(Position)) {
        const position = entity.getComponent(Position);
        pixiSprite.sprite.x = position.x;
        pixiSprite.sprite.y = position.y;
      }

      // Sync rotation
      if (entity.hasComponent(Rotation)) {
        const rotation = entity.getComponent(Rotation);
        pixiSprite.sprite.rotation = rotation.angle;
      }

      // Sync scale
      if (entity.hasComponent(Scale)) {
        const scale = entity.getComponent(Scale);
        pixiSprite.sprite.scale.x = scale.x;
        pixiSprite.sprite.scale.y = scale.y;
      }

      // Sync opacity
      if (entity.hasComponent(Opacity)) {
        const opacity = entity.getComponent(Opacity);
        pixiSprite.sprite.alpha = opacity.alpha;
      }

      // Sync visibility
      if (entity.hasComponent(Visible)) {
        const visible = entity.getComponent(Visible);
        pixiSprite.sprite.visible = visible.value;
      }
    }
  },
  false // Variable update (rendering)
);

/**
 * Synchronizes graphics objects
 */
engine.createSystem('PixiGraphicsSyncSystem',
  { all: [PixiGraphics] },
  {
    priority: -100,
    act: (entity: EntityDef, pixiGraphics: PixiGraphics) => {
      if (!pixiGraphics.graphics) return;

      // Sync position
      if (entity.hasComponent(Position)) {
        const position = entity.getComponent(Position);
        pixiGraphics.graphics.x = position.x;
        pixiGraphics.graphics.y = position.y;
      }

      // Sync rotation
      if (entity.hasComponent(Rotation)) {
        const rotation = entity.getComponent(Rotation);
        pixiGraphics.graphics.rotation = rotation.angle;
      }

      // Sync opacity
      if (entity.hasComponent(Opacity)) {
        const opacity = entity.getComponent(Opacity);
        pixiGraphics.graphics.alpha = opacity.alpha;
      }

      // Sync visibility
      if (entity.hasComponent(Visible)) {
        const visible = entity.getComponent(Visible);
        pixiGraphics.graphics.visible = visible.value;
      }
    }
  },
  false
);

// ============================================================================
// Pixi Cleanup System
// ============================================================================

/**
 * Cleans up Pixi display objects when entities are destroyed
 */
engine.createSystem('PixiCleanupSystem',
  { all: [] }, // Runs globally
  {
    priority: -1000, // Run last
    after: () => {
      // Find entities marked for deletion with Pixi components
      const allEntities = engine.getAllEntities();

      for (const entity of allEntities) {
        if (!entity.isMarkedForDeletion) continue;

        // Cleanup sprite
        if (entity.hasComponent(PixiSprite)) {
          const pixiSprite = entity.getComponent(PixiSprite);
          if (pixiSprite.sprite) {
            pixiManager.removeFromStage(pixiSprite.sprite);
            /*
            // Uncomment when pixi.js is available:
            pixiSprite.sprite.destroy({ children: true, texture: false });
            */
            pixiSprite.sprite = null;
            console.log(`[PixiCleanupSystem] Destroyed sprite for ${entity.name}`);
          }
        }

        // Cleanup graphics
        if (entity.hasComponent(PixiGraphics)) {
          const pixiGraphics = entity.getComponent(PixiGraphics);
          if (pixiGraphics.graphics) {
            pixiManager.removeFromStage(pixiGraphics.graphics);
            /*
            // Uncomment when pixi.js is available:
            pixiGraphics.graphics.destroy({ children: true });
            */
            pixiGraphics.graphics = null;
            console.log(`[PixiCleanupSystem] Destroyed graphics for ${entity.name}`);
          }
        }
      }
    }
  },
  false
);

// ============================================================================
// Example: Simple Game with Pixi Rendering
// ============================================================================

/**
 * Create a simple example scene
 */
async function createExampleScene(): Promise<void> {
  console.log('[Example] Creating scene...');

  // Initialize Pixi
  await pixiManager.initialize(800, 600);

  // Create player entity with sprite
  const player = engine.createEntity('Player');
  player.addComponent(Position, 400, 300);
  player.addComponent(Velocity, 0, 0);
  player.addComponent(Rotation, 0);
  player.addComponent(Scale, 1, 1);
  player.addComponent(PixiSprite, 'player', 0x00FF00); // Green tint
  player.addTag('player');

  console.log('[Example] Created player entity');

  // Create enemy entities
  for (let i = 0; i < 5; i++) {
    const enemy = engine.createEntity(`Enemy${i}`);
    enemy.addComponent(Position, Math.random() * 800, Math.random() * 600);
    enemy.addComponent(Velocity, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
    enemy.addComponent(Rotation, Math.random() * Math.PI * 2);
    enemy.addComponent(PixiSprite, 'enemy', 0xFF0000); // Red tint
    enemy.addTag('enemy');
  }

  console.log('[Example] Created 5 enemy entities');

  // Create a graphics entity (procedural circle)
  const circle = engine.createEntity('Circle');
  circle.addComponent(Position, 100, 100);
  circle.addComponent(PixiGraphics, (graphics: any) => {
    /*
    // Uncomment when pixi.js is available:
    graphics.beginFill(0x0000FF);
    graphics.drawCircle(0, 0, 20);
    graphics.endFill();
    */
  });

  console.log('[Example] Created graphics entity');
}

/**
 * Simple movement system for the example
 */
engine.createSystem('SimpleMovementSystem',
  { all: [Position, Velocity] },
  {
    priority: 500,
    act: (entity: EntityDef, position: Position, velocity: Velocity) => {
      const dt = 1 / 60; // Fixed timestep

      position.x += velocity.dx * dt;
      position.y += velocity.dy * dt;

      // Bounce off screen edges
      if (position.x < 0 || position.x > 800) {
        velocity.dx *= -1;
        position.x = Math.max(0, Math.min(800, position.x));
      }
      if (position.y < 0 || position.y > 600) {
        velocity.dy *= -1;
        position.y = Math.max(0, Math.min(600, position.y));
      }
    }
  },
  true // Fixed update
);

/**
 * Rotation animation system
 */
engine.createSystem('RotationAnimationSystem',
  { all: [Rotation], tags: ['enemy'] },
  {
    priority: 500,
    act: (entity: EntityDef, rotation: Rotation) => {
      rotation.angle += 0.02; // Rotate enemies
    }
  },
  true // Fixed update
);

// ============================================================================
// Game Loop
// ============================================================================

/**
 * Initialize and start the example
 */
async function init(): Promise<void> {
  console.log('[Example] Initializing Pixi-ECS example...');

  await createExampleScene();

  engine.start();

  console.log('[Example] Engine started');
  console.log('[Example] To run with actual rendering, install pixi.js and uncomment the code');
}

/**
 * Main game loop
 */
function gameLoop(): void {
  engine.update();

  /*
  // Uncomment when pixi.js is available:
  // Pixi automatically renders via PIXI.Ticker
  // Or manually render:
  // pixiManager.getRenderer().render(pixiManager.stage);
  */

  // Continue loop
  // requestAnimationFrame(gameLoop);
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Components
  Position,
  Velocity,
  Rotation,
  Scale,
  PixiSprite,
  PixiGraphics,
  PixiContainer,
  Opacity,
  Visible,

  // Manager
  PixiAppManager,
  pixiManager,

  // Engine
  engine,

  // Functions
  init,
  gameLoop,
  createExampleScene
};

// ============================================================================
// Usage Example
// ============================================================================

/*
// Browser usage:

import { init, gameLoop } from './examples/integrations/pixi-example';

// Initialize
await init();

// Start game loop
function loop() {
  gameLoop();
  requestAnimationFrame(loop);
}
loop();

*/

// ============================================================================
// Advanced Patterns
// ============================================================================

/*

1. SPRITE POOLING:
   Similar to entity pooling, you can pool Pixi sprites for better performance:

   class SpritePool {
     private pool: PIXI.Sprite[] = [];

     acquire(texture: PIXI.Texture): PIXI.Sprite {
       let sprite = this.pool.pop();
       if (!sprite) {
         sprite = new PIXI.Sprite(texture);
       }
       return sprite;
     }

     release(sprite: PIXI.Sprite): void {
       sprite.visible = false;
       this.pool.push(sprite);
     }
   }

2. SPRITE BATCHING:
   Use PIXI.ParticleContainer for rendering many similar sprites efficiently:

   const particleContainer = new PIXI.ParticleContainer(10000, {
     scale: true,
     position: true,
     rotation: true,
     alpha: true
   });

   pixiManager.addToStage(particleContainer);

3. TEXTURE ATLASES:
   Use texture atlases for better performance:

   await PIXI.Assets.load('spritesheet.json');
   const texture = PIXI.Texture.from('sprite_name');

4. CULLING:
   Implement frustum culling to skip rendering off-screen entities:

   engine.createSystem('CullingSystem',
     { all: [Position, Visible] },
     {
       act: (entity, position, visible) => {
         const onScreen = position.x > -50 && position.x < 850 &&
                         position.y > -50 && position.y < 650;
         visible.value = onScreen;
       }
     }
   );

5. CAMERA SYSTEM:
   Implement a camera to follow the player:

   class Camera {
     constructor(public x = 0, public y = 0) {}
   }

   engine.createSystem('CameraSystem',
     { all: [Position], tags: ['player'] },
     {
       act: (entity, position) => {
         const camera = engine.getEntityByTag('camera')?.getComponent(Camera);
         if (camera) {
           camera.x = position.x - 400; // Center on player
           camera.y = position.y - 300;
           pixiManager.stage.x = -camera.x;
           pixiManager.stage.y = -camera.y;
         }
       }
     }
   );

6. LAYERS AND Z-INDEX:
   Use containers for different rendering layers:

   const backgroundLayer = new PIXI.Container();
   const gameLayer = new PIXI.Container();
   const uiLayer = new PIXI.Container();

   pixiManager.stage.addChild(backgroundLayer);
   pixiManager.stage.addChild(gameLayer);
   pixiManager.stage.addChild(uiLayer);

   // Sort children by zIndex
   gameLayer.sortableChildren = true;

*/
