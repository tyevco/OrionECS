/**
 * Three.js Integration Example for OrionECS
 *
 * This example demonstrates how to integrate OrionECS with Three.js for 3D rendering.
 * It shows 3D transforms, camera management, mesh synchronization, lighting, and scene graphs.
 *
 * To run this example:
 * 1. Install Three.js: npm install three @types/three
 * 2. Uncomment the Three.js imports and code below
 * 3. Set up a browser environment with a canvas element
 * 4. Initialize and run the game loop
 */

import { EngineBuilder } from '../../core/src/engine';
import type { Engine } from '../../core/src/engine';
import type { EntityDef } from '../../core/src/definitions';

// ============================================================================
// Three.js Imports (uncomment when three is installed)
// ============================================================================

/*
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// For custom shaders or effects:
// import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
// import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
*/

// ============================================================================
// Components - 3D Transform
// ============================================================================

/**
 * 3D Position component
 */
class Transform3D {
  position: any; // THREE.Vector3 when available
  rotation: any; // THREE.Euler when available
  scale: any; // THREE.Vector3 when available

  constructor(
    x: number = 0,
    y: number = 0,
    z: number = 0,
    rotX: number = 0,
    rotY: number = 0,
    rotZ: number = 0,
    scaleX: number = 1,
    scaleY: number = 1,
    scaleZ: number = 1,
  ) {
    /*
    // Uncomment when THREE is available:
    this.position = new THREE.Vector3(x, y, z);
    this.rotation = new THREE.Euler(rotX, rotY, rotZ);
    this.scale = new THREE.Vector3(scaleX, scaleY, scaleZ);
    */

    // Mock objects for this example
    this.position = { x, y, z, set: (nx: number, ny: number, nz: number) => {} };
    this.rotation = { x: rotX, y: rotY, z: rotZ };
    this.scale = { x: scaleX, y: scaleY, z: scaleZ };
  }

  setPosition(x: number, y: number, z: number): void {
    this.position.x = x;
    this.position.y = y;
    this.position.z = z;
  }

  setRotation(x: number, y: number, z: number): void {
    this.rotation.x = x;
    this.rotation.y = y;
    this.rotation.z = z;
  }

  setScale(x: number, y: number, z: number): void {
    this.scale.x = x;
    this.scale.y = y;
    this.scale.z = z;
  }
}

/**
 * Velocity in 3D space
 */
class Velocity3D {
  constructor(
    public dx: number = 0,
    public dy: number = 0,
    public dz: number = 0,
  ) {}
}

/**
 * Angular velocity (rotation speed)
 */
class AngularVelocity {
  constructor(
    public rx: number = 0,
    public ry: number = 0,
    public rz: number = 0,
  ) {}
}

// ============================================================================
// Components - Three.js Objects
// ============================================================================

/**
 * Three.js Mesh component
 */
class ThreeMesh {
  mesh: any = null; // THREE.Mesh when available
  geometry: string;
  material: string;
  castShadow: boolean;
  receiveShadow: boolean;

  constructor(
    geometry: string = 'box',
    material: string = 'standard',
    castShadow: boolean = true,
    receiveShadow: boolean = true,
  ) {
    this.geometry = geometry;
    this.material = material;
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;
  }

  onCreate(entity: EntityDef): void {
    console.log(`[ThreeMesh] Creating mesh for entity: ${entity.name}`);
  }

  onDestroy(entity: EntityDef): void {
    console.log(`[ThreeMesh] Destroying mesh for entity: ${entity.name}`);
    // Cleanup happens in ThreeCleanupSystem
  }
}

/**
 * Three.js Light component
 */
class ThreeLight {
  light: any = null; // THREE.Light when available
  lightType: 'directional' | 'point' | 'spot' | 'ambient';
  color: number;
  intensity: number;
  distance: number = 0;
  decay: number = 2;

  constructor(
    lightType: 'directional' | 'point' | 'spot' | 'ambient' = 'point',
    color: number = 0xffffff,
    intensity: number = 1,
  ) {
    this.lightType = lightType;
    this.color = color;
    this.intensity = intensity;
  }
}

/**
 * Three.js Camera component
 */
class ThreeCamera {
  camera: any = null; // THREE.Camera when available
  cameraType: 'perspective' | 'orthographic';
  fov: number;
  near: number = 0.1;
  far: number = 1000;
  isActive: boolean = false;

  constructor(
    cameraType: 'perspective' | 'orthographic' = 'perspective',
    fov: number = 75,
  ) {
    this.cameraType = cameraType;
    this.fov = fov;
  }
}

/**
 * Material properties
 */
class MaterialProperties {
  color: number = 0xffffff;
  emissive: number = 0x000000;
  roughness: number = 0.5;
  metalness: number = 0.5;
  opacity: number = 1;
  transparent: boolean = false;

  constructor(
    color: number = 0xffffff,
    roughness: number = 0.5,
    metalness: number = 0.5,
  ) {
    this.color = color;
    this.roughness = roughness;
    this.metalness = metalness;
  }
}

/**
 * Visible flag for culling
 */
class Visible {
  constructor(public value: boolean = true) {}
}

// ============================================================================
// Three.js Scene Manager
// ============================================================================

/**
 * Manages the Three.js scene, renderer, and resources
 */
class ThreeSceneManager {
  scene: any = null; // THREE.Scene
  renderer: any = null; // THREE.WebGLRenderer
  activeCamera: any = null; // THREE.Camera
  controls: any = null; // OrbitControls
  canvas: HTMLCanvasElement | null = null;

  geometries: Map<string, any> = new Map(); // Map<string, THREE.BufferGeometry>
  materials: Map<string, any> = new Map(); // Map<string, THREE.Material>
  textures: Map<string, any> = new Map(); // Map<string, THREE.Texture>

  isInitialized: boolean = false;

  /**
   * Initialize Three.js scene and renderer
   */
  async initialize(canvasId: string = 'game-canvas'): Promise<void> {
    console.log('[ThreeSceneManager] Initializing...');

    /*
    // Uncomment when THREE is available:

    // Get canvas
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 50, 200);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Create default camera
    this.activeCamera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.activeCamera.position.set(0, 10, 20);
    this.activeCamera.lookAt(0, 0, 0);

    // Add orbit controls
    this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Handle window resize
    window.addEventListener('resize', this.handleResize.bind(this));

    // Create default geometries
    this.createDefaultGeometries();

    // Create default materials
    this.createDefaultMaterials();

    this.isInitialized = true;
    console.log('[ThreeSceneManager] Initialized successfully');
    */

    // For this example without THREE installed:
    this.isInitialized = true;
    console.log('[ThreeSceneManager] Simulated initialization (install three for actual rendering)');
  }

  /**
   * Create default geometries
   */
  private createDefaultGeometries(): void {
    /*
    // Uncomment when THREE is available:

    this.geometries.set('box', new THREE.BoxGeometry(1, 1, 1));
    this.geometries.set('sphere', new THREE.SphereGeometry(0.5, 32, 32));
    this.geometries.set('cylinder', new THREE.CylinderGeometry(0.5, 0.5, 1, 32));
    this.geometries.set('cone', new THREE.ConeGeometry(0.5, 1, 32));
    this.geometries.set('torus', new THREE.TorusGeometry(0.5, 0.2, 16, 100));
    this.geometries.set('plane', new THREE.PlaneGeometry(10, 10));
    */

    console.log('[ThreeSceneManager] Created default geometries');
  }

  /**
   * Create default materials
   */
  private createDefaultMaterials(): void {
    /*
    // Uncomment when THREE is available:

    this.materials.set('standard', new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.5,
    }));

    this.materials.set('phong', new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 100,
    }));

    this.materials.set('basic', new THREE.MeshBasicMaterial({
      color: 0xffffff,
    }));

    this.materials.set('wireframe', new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
    }));
    */

    console.log('[ThreeSceneManager] Created default materials');
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    /*
    // Uncomment when THREE is available:

    if (!this.activeCamera || !this.renderer) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.activeCamera.aspect = width / height;
    this.activeCamera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    */
  }

  /**
   * Get geometry by name
   */
  getGeometry(name: string): any {
    return this.geometries.get(name) || this.geometries.get('box');
  }

  /**
   * Get material by name
   */
  getMaterial(name: string): any {
    return this.materials.get(name) || this.materials.get('standard');
  }

  /**
   * Add object to scene
   */
  addToScene(object: any): void {
    if (this.scene && object) {
      this.scene.add(object);
    }
  }

  /**
   * Remove object from scene
   */
  removeFromScene(object: any): void {
    if (this.scene && object) {
      this.scene.remove(object);
    }
  }

  /**
   * Render the scene
   */
  render(): void {
    /*
    // Uncomment when THREE is available:

    if (this.controls) {
      this.controls.update();
    }

    if (this.renderer && this.scene && this.activeCamera) {
      this.renderer.render(this.scene, this.activeCamera);
    }
    */
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    /*
    // Uncomment when THREE is available:

    window.removeEventListener('resize', this.handleResize.bind(this));

    if (this.controls) {
      this.controls.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    // Dispose geometries
    for (const geometry of this.geometries.values()) {
      geometry.dispose();
    }

    // Dispose materials
    for (const material of this.materials.values()) {
      material.dispose();
    }

    // Dispose textures
    for (const texture of this.textures.values()) {
      texture.dispose();
    }
    */

    this.isInitialized = false;
    console.log('[ThreeSceneManager] Destroyed');
  }
}

// ============================================================================
// Engine Setup
// ============================================================================

const threeManager = new ThreeSceneManager();

const engine = new EngineBuilder()
  .withDebugMode(true)
  .withFixedUpdateFPS(60)
  .build();

// ============================================================================
// Three.js Systems
// ============================================================================

/**
 * Setup system for creating Three.js meshes
 */
engine.createSystem(
  'ThreeMeshSetupSystem',
  { all: [ThreeMesh, Transform3D] },
  {
    priority: 1000,
    act: (entity: EntityDef, threeMesh: ThreeMesh, transform: Transform3D) => {
      // Skip if mesh already created
      if (threeMesh.mesh) return;

      /*
      // Uncomment when THREE is available:

      const geometry = threeManager.getGeometry(threeMesh.geometry);
      const material = threeManager.getMaterial(threeMesh.material);

      threeMesh.mesh = new THREE.Mesh(geometry, material);
      threeMesh.mesh.castShadow = threeMesh.castShadow;
      threeMesh.mesh.receiveShadow = threeMesh.receiveShadow;

      // Set initial transform
      threeMesh.mesh.position.copy(transform.position);
      threeMesh.mesh.rotation.copy(transform.rotation);
      threeMesh.mesh.scale.copy(transform.scale);

      // Add to scene
      threeManager.addToScene(threeMesh.mesh);

      console.log(`[ThreeMeshSetupSystem] Created mesh for ${entity.name}`);
      */

      // Simulated mesh creation
      threeMesh.mesh = {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        visible: true,
      };
      console.log(`[ThreeMeshSetupSystem] Created simulated mesh for ${entity.name}`);
    },
  },
  false,
);

/**
 * Setup system for creating Three.js lights
 */
engine.createSystem(
  'ThreeLightSetupSystem',
  { all: [ThreeLight, Transform3D] },
  {
    priority: 1000,
    act: (entity: EntityDef, threeLight: ThreeLight, transform: Transform3D) => {
      // Skip if light already created
      if (threeLight.light) return;

      /*
      // Uncomment when THREE is available:

      switch (threeLight.lightType) {
        case 'directional':
          threeLight.light = new THREE.DirectionalLight(threeLight.color, threeLight.intensity);
          threeLight.light.castShadow = true;
          break;
        case 'point':
          threeLight.light = new THREE.PointLight(
            threeLight.color,
            threeLight.intensity,
            threeLight.distance,
            threeLight.decay
          );
          break;
        case 'spot':
          threeLight.light = new THREE.SpotLight(threeLight.color, threeLight.intensity);
          threeLight.light.castShadow = true;
          break;
        case 'ambient':
          threeLight.light = new THREE.AmbientLight(threeLight.color, threeLight.intensity);
          break;
      }

      threeLight.light.position.copy(transform.position);
      threeManager.addToScene(threeLight.light);

      console.log(`[ThreeLightSetupSystem] Created ${threeLight.lightType} light for ${entity.name}`);
      */

      console.log(`[ThreeLightSetupSystem] Created ${threeLight.lightType} light for ${entity.name}`);
    },
  },
  false,
);

/**
 * Movement system - applies velocity to transform
 */
engine.createSystem(
  'Movement3DSystem',
  { all: [Transform3D, Velocity3D] },
  {
    priority: 900,
    act: (entity: EntityDef, transform: Transform3D, velocity: Velocity3D) => {
      const dt = 1 / 60;

      transform.position.x += velocity.dx * dt;
      transform.position.y += velocity.dy * dt;
      transform.position.z += velocity.dz * dt;
    },
  },
  true, // Fixed update
);

/**
 * Rotation system - applies angular velocity to transform
 */
engine.createSystem(
  'Rotation3DSystem',
  { all: [Transform3D, AngularVelocity] },
  {
    priority: 900,
    act: (entity: EntityDef, transform: Transform3D, angularVel: AngularVelocity) => {
      const dt = 1 / 60;

      transform.rotation.x += angularVel.rx * dt;
      transform.rotation.y += angularVel.ry * dt;
      transform.rotation.z += angularVel.rz * dt;
    },
  },
  true, // Fixed update
);

/**
 * Sync system - synchronizes ECS transforms with Three.js objects
 */
engine.createSystem(
  'ThreeSyncSystem',
  { all: [Transform3D] },
  {
    priority: -100, // Run late
    act: (entity: EntityDef, transform: Transform3D) => {
      // Sync mesh
      if (entity.hasComponent(ThreeMesh)) {
        const threeMesh = entity.getComponent(ThreeMesh);
        if (threeMesh.mesh) {
          /*
          // Uncomment when THREE is available:
          threeMesh.mesh.position.copy(transform.position);
          threeMesh.mesh.rotation.copy(transform.rotation);
          threeMesh.mesh.scale.copy(transform.scale);
          */

          // Simulated sync
          threeMesh.mesh.position = { ...transform.position };
          threeMesh.mesh.rotation = { ...transform.rotation };
          threeMesh.mesh.scale = { ...transform.scale };

          // Sync visibility
          if (entity.hasComponent(Visible)) {
            threeMesh.mesh.visible = entity.getComponent(Visible).value;
          }

          // Sync material properties
          if (entity.hasComponent(MaterialProperties)) {
            const matProps = entity.getComponent(MaterialProperties);
            /*
            // Uncomment when THREE is available:
            if (threeMesh.mesh.material) {
              threeMesh.mesh.material.color.setHex(matProps.color);
              threeMesh.mesh.material.roughness = matProps.roughness;
              threeMesh.mesh.material.metalness = matProps.metalness;
              threeMesh.mesh.material.opacity = matProps.opacity;
              threeMesh.mesh.material.transparent = matProps.transparent;
            }
            */
          }
        }
      }

      // Sync light
      if (entity.hasComponent(ThreeLight)) {
        const threeLight = entity.getComponent(ThreeLight);
        if (threeLight.light) {
          /*
          // Uncomment when THREE is available:
          threeLight.light.position.copy(transform.position);
          */
        }
      }
    },
  },
  false, // Variable update
);

/**
 * Cleanup system for destroying Three.js objects
 */
engine.createSystem(
  'ThreeCleanupSystem',
  { all: [] },
  {
    priority: -1000,
    after: () => {
      const allEntities = engine.getAllEntities();

      for (const entity of allEntities) {
        if (!entity.isMarkedForDeletion) continue;

        // Cleanup mesh
        if (entity.hasComponent(ThreeMesh)) {
          const threeMesh = entity.getComponent(ThreeMesh);
          if (threeMesh.mesh) {
            threeManager.removeFromScene(threeMesh.mesh);
            /*
            // Uncomment when THREE is available:
            // Geometry and material are shared, don't dispose
            threeMesh.mesh = null;
            */
            console.log(`[ThreeCleanupSystem] Destroyed mesh for ${entity.name}`);
          }
        }

        // Cleanup light
        if (entity.hasComponent(ThreeLight)) {
          const threeLight = entity.getComponent(ThreeLight);
          if (threeLight.light) {
            threeManager.removeFromScene(threeLight.light);
            /*
            // Uncomment when THREE is available:
            threeLight.light = null;
            */
            console.log(`[ThreeCleanupSystem] Destroyed light for ${entity.name}`);
          }
        }
      }
    },
  },
  false,
);

/**
 * Render system - renders the scene
 */
engine.createSystem(
  'ThreeRenderSystem',
  { all: [] },
  {
    priority: -10000, // Run last
    after: () => {
      threeManager.render();
    },
  },
  false, // Variable update
);

// ============================================================================
// Example Scene Setup
// ============================================================================

/**
 * Create example 3D scene
 */
async function createExampleScene(): Promise<void> {
  console.log('[Example] Creating 3D scene...');

  // Initialize Three.js
  await threeManager.initialize();

  // Create ground plane
  const ground = engine.createEntity('Ground');
  ground.addComponent(Transform3D, 0, 0, 0, -Math.PI / 2, 0, 0, 20, 20, 1);
  ground.addComponent(ThreeMesh, 'plane', 'standard', false, true);
  ground.addComponent(MaterialProperties, 0x2d5016, 0.8, 0.2);
  ground.addTag('ground');

  // Create spinning cubes
  for (let i = 0; i < 5; i++) {
    const cube = engine.createEntity(`Cube_${i}`);
    const x = (i - 2) * 3;
    const y = 1;
    const z = 0;

    cube.addComponent(Transform3D, x, y, z);
    cube.addComponent(Velocity3D, 0, Math.sin(i) * 0.5, 0); // Floating motion
    cube.addComponent(AngularVelocity, 0.5, 1.0, 0.3); // Spinning
    cube.addComponent(ThreeMesh, 'box', 'standard');
    cube.addComponent(MaterialProperties, 0x00ff00 + i * 0x001100, 0.3, 0.7);
    cube.addComponent(Visible, true);
    cube.addTag('cube');
  }

  // Create spheres
  for (let i = 0; i < 3; i++) {
    const sphere = engine.createEntity(`Sphere_${i}`);
    const angle = (i / 3) * Math.PI * 2;
    const radius = 5;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    sphere.addComponent(Transform3D, x, 1, z, 0, 0, 0, 0.5, 0.5, 0.5);
    sphere.addComponent(ThreeMesh, 'sphere', 'standard');
    sphere.addComponent(MaterialProperties, 0xff0000 + i * 0x002200, 0.1, 0.9);
    sphere.addTag('sphere');
  }

  // Create directional light (sun)
  const sun = engine.createEntity('Sun');
  sun.addComponent(Transform3D, 10, 20, 10);
  sun.addComponent(ThreeLight, 'directional', 0xffffff, 1);

  // Create ambient light
  const ambient = engine.createEntity('AmbientLight');
  ambient.addComponent(Transform3D, 0, 0, 0);
  ambient.addComponent(ThreeLight, 'ambient', 0x404040, 0.5);

  // Create point lights
  const colors = [0xff0000, 0x00ff00, 0x0000ff];
  for (let i = 0; i < 3; i++) {
    const light = engine.createEntity(`PointLight_${i}`);
    const angle = (i / 3) * Math.PI * 2;
    const radius = 8;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    light.addComponent(Transform3D, x, 3, z);
    light.addComponent(ThreeLight, 'point', colors[i], 2);
    light.addComponent(Velocity3D, 0, 0.5, 0); // Moving lights
  }

  console.log('[Example] 3D scene created');
}

// ============================================================================
// Game Loop
// ============================================================================

/**
 * Initialize and start the example
 */
async function init(): Promise<void> {
  console.log('[Example] Initializing Three.js-ECS example...');

  await createExampleScene();

  engine.start();

  console.log('[Example] Engine started');
  console.log('[Example] To run with actual rendering, install three and uncomment the code');
}

/**
 * Main game loop
 */
function gameLoop(): void {
  engine.update();
  // requestAnimationFrame(gameLoop);
}

// ============================================================================
// Exports
// ============================================================================

export {
  // Components
  Transform3D,
  Velocity3D,
  AngularVelocity,
  ThreeMesh,
  ThreeLight,
  ThreeCamera,
  MaterialProperties,
  Visible,
  // Manager
  ThreeSceneManager,
  threeManager,
  // Engine
  engine,
  // Functions
  init,
  gameLoop,
  createExampleScene,
};

// ============================================================================
// Usage Example
// ============================================================================

/*

// In your browser app:

import { init, gameLoop } from './examples/integrations/threejs-example';

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

1. CAMERA FOLLOWING:
   Create a camera that follows the player entity:

   engine.createSystem('CameraFollowSystem',
     { all: [Transform3D], tags: ['player'] },
     {
       act: (entity, transform) => {
         if (threeManager.activeCamera) {
           const offset = new THREE.Vector3(0, 5, 10);
           const targetPos = transform.position.clone().add(offset);
           threeManager.activeCamera.position.lerp(targetPos, 0.1);
           threeManager.activeCamera.lookAt(transform.position);
         }
       }
     }
   );

2. INSTANCED RENDERING:
   For many similar objects, use InstancedMesh:

   const geometry = new THREE.BoxGeometry(1, 1, 1);
   const material = new THREE.MeshStandardMaterial();
   const instancedMesh = new THREE.InstancedMesh(geometry, material, 1000);

   engine.createSystem('InstancedRenderSystem',
     { all: [Transform3D], tags: ['instanced'] },
     {
       before: () => { instancedMesh.count = 0; },
       act: (entity, transform) => {
         const matrix = new THREE.Matrix4();
         matrix.compose(transform.position, new THREE.Quaternion(), transform.scale);
         instancedMesh.setMatrixAt(instancedMesh.count++, matrix);
       },
       after: () => { instancedMesh.instanceMatrix.needsUpdate = true; }
     }
   );

3. LOD (Level of Detail):
   Switch between different detail levels based on distance:

   class LOD {
     levels: Array<{ distance: number; mesh: THREE.Mesh }> = [];
   }

   engine.createSystem('LODSystem',
     { all: [Transform3D, LOD] },
     {
       act: (entity, transform, lod) => {
         const distance = transform.position.distanceTo(threeManager.activeCamera.position);

         for (let i = 0; i < lod.levels.length; i++) {
           const level = lod.levels[i];
           level.mesh.visible = i === 0 || distance >= level.distance;
         }
       }
     }
   );

4. POST-PROCESSING:
   Add effects using EffectComposer:

   import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
   import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
   import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

   const composer = new EffectComposer(threeManager.renderer);
   composer.addPass(new RenderPass(threeManager.scene, threeManager.activeCamera));
   composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85));

   // In render system:
   composer.render();

5. RAYCASTING FOR INTERACTION:
   Detect clicks on 3D objects:

   class Clickable {
     onClick: (entity: EntityDef) => void;
   }

   const raycaster = new THREE.Raycaster();
   const mouse = new THREE.Vector2();

   canvas.addEventListener('click', (event) => {
     mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
     mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

     raycaster.setFromCamera(mouse, threeManager.activeCamera);

     const entities = engine.getAllEntities().filter(e => e.hasComponent(ThreeMesh));
     const meshes = entities.map(e => e.getComponent(ThreeMesh).mesh);
     const intersects = raycaster.intersectObjects(meshes);

     if (intersects.length > 0) {
       const entity = entities.find(e => e.getComponent(ThreeMesh).mesh === intersects[0].object);
       if (entity?.hasComponent(Clickable)) {
         entity.getComponent(Clickable).onClick(entity);
       }
     }
   });

*/
