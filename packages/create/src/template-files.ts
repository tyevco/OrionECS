import type { ProjectConfig, TemplateFile } from './types.js';
import { getTemplateInfo } from './templates.js';

/**
 * Generate all template files for the project
 */
export function generateTemplateFiles(config: ProjectConfig): TemplateFile[] {
    const files: TemplateFile[] = [];
    const isTS = config.language === 'typescript';
    const ext = isTS ? 'ts' : 'js';

    // Common files
    files.push(generatePackageJson(config));
    files.push(generateGitignore());
    files.push(generateReadme(config));

    if (isTS) {
        files.push(generateTsConfig(config));
    }

    // Template-specific files
    switch (config.template) {
        case 'vanilla':
            files.push(...generateVanillaFiles(config, ext));
            break;
        case 'canvas2d':
            files.push(...generateCanvas2dFiles(config, ext));
            break;
        case 'pixi':
            files.push(...generatePixiFiles(config, ext));
            break;
        case 'three':
            files.push(...generateThreeFiles(config, ext));
            break;
        case 'multiplayer':
            files.push(...generateMultiplayerFiles(config, ext));
            break;
        case 'vite':
            files.push(...generateViteFiles(config, ext));
            break;
        case 'webpack':
            files.push(...generateWebpackFiles(config, ext));
            break;
    }

    return files;
}

/**
 * Generate package.json
 */
function generatePackageJson(config: ProjectConfig): TemplateFile {
    const templateInfo = getTemplateInfo(config.template);
    const isTS = config.language === 'typescript';

    const scripts: Record<string, string> = {};

    // Add scripts based on template
    switch (config.template) {
        case 'vanilla':
            scripts.build = isTS ? 'tsc' : 'echo "No build step for JavaScript"';
            scripts.dev = isTS ? 'tsx watch src/index.ts' : 'node src/index.js';
            scripts.start = isTS ? 'tsx src/index.ts' : 'node src/index.js';
            break;
        case 'canvas2d':
        case 'pixi':
        case 'three':
        case 'vite':
            scripts.dev = 'vite';
            scripts.build = isTS ? 'tsc && vite build' : 'vite build';
            scripts.preview = 'vite preview';
            break;
        case 'multiplayer':
            scripts.dev = 'tsx watch src/server.ts';
            scripts['dev:client'] = 'vite';
            scripts.build = isTS ? 'tsc && vite build' : 'vite build';
            scripts.start = isTS ? 'tsx src/server.ts' : 'node src/server.js';
            break;
        case 'webpack':
            scripts.dev = 'webpack serve --mode development';
            scripts.build = 'webpack --mode production';
            break;
    }

    const packageJson = {
        name: config.name,
        version: '0.1.0',
        private: true,
        description: `${config.name} - OrionECS game`,
        type: 'module',
        main: isTS ? 'dist/index.js' : 'src/index.js',
        scripts,
        keywords: ['orion-ecs', 'game'],
        dependencies: templateInfo?.dependencies ?? {},
        devDependencies: {
            ...templateInfo?.devDependencies,
            ...(config.template === 'vanilla' && isTS ? { tsx: '^4.0.0' } : {}),
        },
    };

    return {
        path: 'package.json',
        content: JSON.stringify(packageJson, null, 2) + '\n',
    };
}

/**
 * Generate .gitignore
 */
function generateGitignore(): TemplateFile {
    return {
        path: '.gitignore',
        content: `# Dependencies
node_modules/

# Build output
dist/
build/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Environment
.env
.env.local
.env.*.local
`,
    };
}

/**
 * Generate README.md
 */
function generateReadme(config: ProjectConfig): TemplateFile {
    const templateInfo = getTemplateInfo(config.template);

    return {
        path: 'README.md',
        content: `# ${config.name}

${templateInfo?.description ?? 'An OrionECS game project.'}

## Getting Started

\`\`\`bash
# Install dependencies
${config.packageManager} install

# Start development server
${config.packageManager} run dev

# Build for production
${config.packageManager} run build
\`\`\`

## Project Structure

\`\`\`
${config.name}/
├── src/
│   ├── components/     # ECS components
│   ├── systems/        # ECS systems
│   └── index.${config.language === 'typescript' ? 'ts' : 'js'}
├── package.json
└── README.md
\`\`\`

## Learn More

- [OrionECS Documentation](https://github.com/tyevco/orionecs)
- [OrionECS API Reference](https://github.com/tyevco/orionecs/blob/main/docs/API.md)
`,
    };
}

/**
 * Generate tsconfig.json
 */
function generateTsConfig(config: ProjectConfig): TemplateFile {
    const isBrowser = ['canvas2d', 'pixi', 'three', 'vite', 'webpack', 'multiplayer'].includes(
        config.template
    );

    const tsconfig = {
        compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            lib: isBrowser ? ['ES2022', 'DOM', 'DOM.Iterable'] : ['ES2022'],
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            declaration: true,
            declarationMap: true,
            sourceMap: true,
            outDir: './dist',
            rootDir: './src',
            noUnusedLocals: true,
            noUnusedParameters: true,
            noImplicitReturns: true,
            resolveJsonModule: true,
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist'],
    };

    return {
        path: 'tsconfig.json',
        content: JSON.stringify(tsconfig, null, 2) + '\n',
    };
}

/**
 * Generate vanilla template files
 */
function generateVanillaFiles(config: ProjectConfig, ext: string): TemplateFile[] {
    const isTS = ext === 'ts';

    return [
        {
            path: `src/index.${ext}`,
            content: `/**
 * ${config.name} - OrionECS Game
 */

import { EngineBuilder } from '@orion-ecs/core';
import { Position, Velocity } from './components/transform.${ext.replace('.ts', '')}${isTS ? '.js' : ''}';
import { MovementSystem } from './systems/movement.${ext.replace('.ts', '')}${isTS ? '.js' : ''}';

// Create the ECS engine
const engine = new EngineBuilder()
    .withDebugMode(true)
    .withFixedUpdateFPS(60)
    .build();

// Register systems
engine.registerSystem(new MovementSystem(engine));

// Create a player entity
const player = engine.createEntity('Player');
player
    .addComponent(Position, 0, 0)
    .addComponent(Velocity, 1, 1)
    .addTag('player');

console.log('Game started!');
console.log('Player entity created:', player.name);

// Run the game loop
engine.run();

// Log entity state periodically
setInterval(() => {
    const pos = player.getComponent(Position);
    console.log(\`Player position: (\${pos.x.toFixed(2)}, \${pos.y.toFixed(2)})\`);
}, 1000);
`,
        },
        {
            path: `src/components/transform.${ext}`,
            content: `/**
 * Transform components
 */

export class Position {
    constructor(
        public x${isTS ? ': number' : ''} = 0,
        public y${isTS ? ': number' : ''} = 0
    ) {}
}

export class Velocity {
    constructor(
        public x${isTS ? ': number' : ''} = 0,
        public y${isTS ? ': number' : ''} = 0
    ) {}
}
`,
        },
        {
            path: `src/systems/movement.${ext}`,
            content: `/**
 * Movement System
 */

import { Position, Velocity } from '../components/transform.${isTS ? 'js' : ext}';
${isTS ? "import type { Engine, Entity } from '@orion-ecs/core';" : ''}

export class MovementSystem {
    constructor(private engine${isTS ? ': Engine' : ''}) {
        this.engine.createSystem(
            'MovementSystem',
            { all: [Position, Velocity] },
            {
                priority: 100,
                act: this.act.bind(this),
            }
        );
    }

    act(_entity${isTS ? ': Entity' : ''}, position${isTS ? ': Position' : ''}, velocity${isTS ? ': Velocity' : ''})${isTS ? ': void' : ''} {
        const deltaTime = 1 / 60; // Fixed timestep
        position.x += velocity.x * deltaTime;
        position.y += velocity.y * deltaTime;
    }
}
`,
        },
    ];
}

/**
 * Generate Canvas2D template files
 */
function generateCanvas2dFiles(config: ProjectConfig, ext: string): TemplateFile[] {
    const isTS = ext === 'ts';

    return [
        {
            path: 'index.html',
            content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.name}</title>
    <style>
        body {
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #1a1a2e;
        }
        canvas {
            border: 2px solid #16213e;
            background: #0f0f23;
        }
    </style>
</head>
<body>
    <canvas id="game" width="800" height="600"></canvas>
    <script type="module" src="/src/index.${ext}"></script>
</body>
</html>
`,
        },
        {
            path: `src/index.${ext}`,
            content: `/**
 * ${config.name} - Canvas2D Game
 */

import { EngineBuilder } from '@orion-ecs/core';
import { Position, Velocity, Sprite } from './components/transform.${isTS ? 'js' : ext}';
import { MovementSystem } from './systems/movement.${isTS ? 'js' : ext}';
import { RenderSystem } from './systems/render.${isTS ? 'js' : ext}';

// Get canvas and context
const canvas = document.getElementById('game')${isTS ? ' as HTMLCanvasElement' : ''};
const ctx = canvas.getContext('2d')${isTS ? '!' : ''};

// Create the ECS engine
const engine = new EngineBuilder()
    .withDebugMode(true)
    .withFixedUpdateFPS(60)
    .build();

// Register systems
new MovementSystem(engine);
new RenderSystem(engine, ctx);

// Create player entity
const player = engine.createEntity('Player');
player
    .addComponent(Position, 400, 300)
    .addComponent(Velocity, 100, 50)
    .addComponent(Sprite, 32, 32, '#00ff88')
    .addTag('player');

// Create some bouncing entities
for (let i = 0; i < 5; i++) {
    const entity = engine.createEntity(\`Ball\${i}\`);
    entity
        .addComponent(Position, Math.random() * 700 + 50, Math.random() * 500 + 50)
        .addComponent(Velocity, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200)
        .addComponent(Sprite, 20, 20, \`hsl(\${Math.random() * 360}, 70%, 60%)\`)
        .addTag('ball');
}

console.log('Game started!');
engine.run();
`,
        },
        {
            path: `src/components/transform.${ext}`,
            content: `/**
 * Transform and visual components
 */

export class Position {
    constructor(
        public x${isTS ? ': number' : ''} = 0,
        public y${isTS ? ': number' : ''} = 0
    ) {}
}

export class Velocity {
    constructor(
        public x${isTS ? ': number' : ''} = 0,
        public y${isTS ? ': number' : ''} = 0
    ) {}
}

export class Sprite {
    constructor(
        public width${isTS ? ': number' : ''} = 32,
        public height${isTS ? ': number' : ''} = 32,
        public color${isTS ? ': string' : ''} = '#ffffff'
    ) {}
}
`,
        },
        {
            path: `src/systems/movement.${ext}`,
            content: `/**
 * Movement System with boundary bouncing
 */

import { Position, Velocity } from '../components/transform.${isTS ? 'js' : ext}';
${isTS ? "import type { Engine, Entity } from '@orion-ecs/core';" : ''}

export class MovementSystem {
    constructor(private engine${isTS ? ': Engine' : ''}) {
        this.engine.createSystem(
            'MovementSystem',
            { all: [Position, Velocity] },
            {
                priority: 100,
                act: this.act.bind(this),
            }
        );
    }

    act(_entity${isTS ? ': Entity' : ''}, position${isTS ? ': Position' : ''}, velocity${isTS ? ': Velocity' : ''})${isTS ? ': void' : ''} {
        const deltaTime = 1 / 60;
        position.x += velocity.x * deltaTime;
        position.y += velocity.y * deltaTime;

        // Bounce off walls
        if (position.x < 0 || position.x > 800) {
            velocity.x *= -1;
            position.x = Math.max(0, Math.min(800, position.x));
        }
        if (position.y < 0 || position.y > 600) {
            velocity.y *= -1;
            position.y = Math.max(0, Math.min(600, position.y));
        }
    }
}
`,
        },
        {
            path: `src/systems/render.${ext}`,
            content: `/**
 * Canvas2D Render System
 */

import { Position, Sprite } from '../components/transform.${isTS ? 'js' : ext}';
${isTS ? "import type { Engine, Entity } from '@orion-ecs/core';" : ''}

export class RenderSystem {
    constructor(
        private engine${isTS ? ': Engine' : ''},
        private ctx${isTS ? ': CanvasRenderingContext2D' : ''}
    ) {
        this.engine.createSystem(
            'RenderSystem',
            { all: [Position, Sprite] },
            {
                priority: 10, // Run after movement
                beforeAll: this.clear.bind(this),
                act: this.render.bind(this),
            }
        );
    }

    clear()${isTS ? ': void' : ''} {
        this.ctx.fillStyle = '#0f0f23';
        this.ctx.fillRect(0, 0, 800, 600);
    }

    render(_entity${isTS ? ': Entity' : ''}, position${isTS ? ': Position' : ''}, sprite${isTS ? ': Sprite' : ''})${isTS ? ': void' : ''} {
        this.ctx.fillStyle = sprite.color;
        this.ctx.fillRect(
            position.x - sprite.width / 2,
            position.y - sprite.height / 2,
            sprite.width,
            sprite.height
        );
    }
}
`,
        },
        generateViteConfig(config),
    ];
}

/**
 * Generate Pixi.js template files
 */
function generatePixiFiles(config: ProjectConfig, ext: string): TemplateFile[] {
    const isTS = ext === 'ts';

    return [
        {
            path: 'index.html',
            content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.name}</title>
    <style>
        body {
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #1a1a2e;
        }
        canvas {
            border: 2px solid #16213e;
        }
    </style>
</head>
<body>
    <script type="module" src="/src/index.${ext}"></script>
</body>
</html>
`,
        },
        {
            path: `src/index.${ext}`,
            content: `/**
 * ${config.name} - Pixi.js Game
 */

import { Application, Graphics } from 'pixi.js';
import { EngineBuilder } from '@orion-ecs/core';
import { Position, Velocity, PixiRenderable } from './components/transform.${isTS ? 'js' : ext}';
import { MovementSystem } from './systems/movement.${isTS ? 'js' : ext}';
import { PixiRenderSystem } from './systems/render.${isTS ? 'js' : ext}';

async function main() {
    // Create Pixi Application
    const app = new Application();
    await app.init({
        width: 800,
        height: 600,
        backgroundColor: 0x0f0f23,
    });
    document.body.appendChild(app.canvas);

    // Create the ECS engine
    const engine = new EngineBuilder()
        .withDebugMode(true)
        .withFixedUpdateFPS(60)
        .build();

    // Register systems
    new MovementSystem(engine);
    new PixiRenderSystem(engine, app);

    // Create player entity
    const player = engine.createEntity('Player');
    const playerGraphics = new Graphics()
        .rect(-16, -16, 32, 32)
        .fill(0x00ff88);
    app.stage.addChild(playerGraphics);

    player
        .addComponent(Position, 400, 300)
        .addComponent(Velocity, 100, 50)
        .addComponent(PixiRenderable, playerGraphics)
        .addTag('player');

    // Create some bouncing entities
    for (let i = 0; i < 5; i++) {
        const entity = engine.createEntity(\`Ball\${i}\`);
        const graphics = new Graphics()
            .circle(0, 0, 10)
            .fill(Math.random() * 0xffffff);
        app.stage.addChild(graphics);

        entity
            .addComponent(Position, Math.random() * 700 + 50, Math.random() * 500 + 50)
            .addComponent(Velocity, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200)
            .addComponent(PixiRenderable, graphics)
            .addTag('ball');
    }

    console.log('Game started!');
    engine.run();
}

main().catch(console.error);
`,
        },
        {
            path: `src/components/transform.${ext}`,
            content: `/**
 * Transform and visual components
 */
${isTS ? "import type { Container } from 'pixi.js';" : ''}

export class Position {
    constructor(
        public x${isTS ? ': number' : ''} = 0,
        public y${isTS ? ': number' : ''} = 0
    ) {}
}

export class Velocity {
    constructor(
        public x${isTS ? ': number' : ''} = 0,
        public y${isTS ? ': number' : ''} = 0
    ) {}
}

export class PixiRenderable {
    constructor(public displayObject${isTS ? ': Container' : ''}) {}
}
`,
        },
        {
            path: `src/systems/movement.${ext}`,
            content: `/**
 * Movement System with boundary bouncing
 */

import { Position, Velocity } from '../components/transform.${isTS ? 'js' : ext}';
${isTS ? "import type { Engine, Entity } from '@orion-ecs/core';" : ''}

export class MovementSystem {
    constructor(private engine${isTS ? ': Engine' : ''}) {
        this.engine.createSystem(
            'MovementSystem',
            { all: [Position, Velocity] },
            {
                priority: 100,
                act: this.act.bind(this),
            }
        );
    }

    act(_entity${isTS ? ': Entity' : ''}, position${isTS ? ': Position' : ''}, velocity${isTS ? ': Velocity' : ''})${isTS ? ': void' : ''} {
        const deltaTime = 1 / 60;
        position.x += velocity.x * deltaTime;
        position.y += velocity.y * deltaTime;

        // Bounce off walls
        if (position.x < 0 || position.x > 800) {
            velocity.x *= -1;
            position.x = Math.max(0, Math.min(800, position.x));
        }
        if (position.y < 0 || position.y > 600) {
            velocity.y *= -1;
            position.y = Math.max(0, Math.min(600, position.y));
        }
    }
}
`,
        },
        {
            path: `src/systems/render.${ext}`,
            content: `/**
 * Pixi.js Render System
 */

import { Position, PixiRenderable } from '../components/transform.${isTS ? 'js' : ext}';
${isTS ? "import type { Application } from 'pixi.js';\nimport type { Engine, Entity } from '@orion-ecs/core';" : ''}

export class PixiRenderSystem {
    constructor(
        private engine${isTS ? ': Engine' : ''},
        private app${isTS ? ': Application' : ''}
    ) {
        this.engine.createSystem(
            'PixiRenderSystem',
            { all: [Position, PixiRenderable] },
            {
                priority: 10,
                act: this.render.bind(this),
            }
        );
    }

    render(_entity${isTS ? ': Entity' : ''}, position${isTS ? ': Position' : ''}, renderable${isTS ? ': PixiRenderable' : ''})${isTS ? ': void' : ''} {
        renderable.displayObject.x = position.x;
        renderable.displayObject.y = position.y;
    }
}
`,
        },
        generateViteConfig(config),
    ];
}

/**
 * Generate Three.js template files
 */
function generateThreeFiles(config: ProjectConfig, ext: string): TemplateFile[] {
    const isTS = ext === 'ts';

    return [
        {
            path: 'index.html',
            content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.name}</title>
    <style>
        body { margin: 0; overflow: hidden; }
        canvas { display: block; }
    </style>
</head>
<body>
    <script type="module" src="/src/index.${ext}"></script>
</body>
</html>
`,
        },
        {
            path: `src/index.${ext}`,
            content: `/**
 * ${config.name} - Three.js 3D Game
 */

import * as THREE from 'three';
import { EngineBuilder } from '@orion-ecs/core';
import { Position3D, Velocity3D, ThreeRenderable } from './components/transform.${isTS ? 'js' : ext}';
import { MovementSystem } from './systems/movement.${isTS ? 'js' : ext}';
import { ThreeRenderSystem } from './systems/render.${isTS ? 'js' : ext}';

// Create Three.js scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Create the ECS engine
const engine = new EngineBuilder()
    .withDebugMode(true)
    .withFixedUpdateFPS(60)
    .build();

// Register systems
new MovementSystem(engine);
new ThreeRenderSystem(engine);

// Create player cube
const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff88 });
const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
scene.add(playerMesh);

const player = engine.createEntity('Player');
player
    .addComponent(Position3D, 0, 0, 0)
    .addComponent(Velocity3D, 0.5, 0.3, 0)
    .addComponent(ThreeRenderable, playerMesh)
    .addTag('player');

// Create some floating cubes
for (let i = 0; i < 10; i++) {
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const entity = engine.createEntity(\`Cube\${i}\`);
    entity
        .addComponent(Position3D, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 5)
        .addComponent(Velocity3D, (Math.random() - 0.5), (Math.random() - 0.5), 0)
        .addComponent(ThreeRenderable, mesh)
        .addTag('cube');
}

console.log('Game started!');
engine.run();

// Three.js render loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
`,
        },
        {
            path: `src/components/transform.${ext}`,
            content: `/**
 * 3D Transform components
 */
${isTS ? "import type { Object3D } from 'three';" : ''}

export class Position3D {
    constructor(
        public x${isTS ? ': number' : ''} = 0,
        public y${isTS ? ': number' : ''} = 0,
        public z${isTS ? ': number' : ''} = 0
    ) {}
}

export class Velocity3D {
    constructor(
        public x${isTS ? ': number' : ''} = 0,
        public y${isTS ? ': number' : ''} = 0,
        public z${isTS ? ': number' : ''} = 0
    ) {}
}

export class ThreeRenderable {
    constructor(public object${isTS ? ': Object3D' : ''}) {}
}
`,
        },
        {
            path: `src/systems/movement.${ext}`,
            content: `/**
 * 3D Movement System with boundary bouncing
 */

import { Position3D, Velocity3D } from '../components/transform.${isTS ? 'js' : ext}';
${isTS ? "import type { Engine, Entity } from '@orion-ecs/core';" : ''}

export class MovementSystem {
    constructor(private engine${isTS ? ': Engine' : ''}) {
        this.engine.createSystem(
            'MovementSystem',
            { all: [Position3D, Velocity3D] },
            {
                priority: 100,
                act: this.act.bind(this),
            }
        );
    }

    act(_entity${isTS ? ': Entity' : ''}, position${isTS ? ': Position3D' : ''}, velocity${isTS ? ': Velocity3D' : ''})${isTS ? ': void' : ''} {
        const deltaTime = 1 / 60;
        position.x += velocity.x * deltaTime;
        position.y += velocity.y * deltaTime;
        position.z += velocity.z * deltaTime;

        // Bounce off boundaries
        const bound = 5;
        if (Math.abs(position.x) > bound) {
            velocity.x *= -1;
            position.x = Math.sign(position.x) * bound;
        }
        if (Math.abs(position.y) > bound) {
            velocity.y *= -1;
            position.y = Math.sign(position.y) * bound;
        }
    }
}
`,
        },
        {
            path: `src/systems/render.${ext}`,
            content: `/**
 * Three.js Render System
 */

import { Position3D, ThreeRenderable } from '../components/transform.${isTS ? 'js' : ext}';
${isTS ? "import type { Engine, Entity } from '@orion-ecs/core';" : ''}

export class ThreeRenderSystem {
    constructor(private engine${isTS ? ': Engine' : ''}) {
        this.engine.createSystem(
            'ThreeRenderSystem',
            { all: [Position3D, ThreeRenderable] },
            {
                priority: 10,
                act: this.render.bind(this),
            }
        );
    }

    render(_entity${isTS ? ': Entity' : ''}, position${isTS ? ': Position3D' : ''}, renderable${isTS ? ': ThreeRenderable' : ''})${isTS ? ': void' : ''} {
        renderable.object.position.set(position.x, position.y, position.z);
        renderable.object.rotation.x += 0.01;
        renderable.object.rotation.y += 0.01;
    }
}
`,
        },
        generateViteConfig(config),
    ];
}

/**
 * Generate Multiplayer template files
 */
function generateMultiplayerFiles(config: ProjectConfig, ext: string): TemplateFile[] {
    const isTS = ext === 'ts';

    return [
        {
            path: `src/server.${ext}`,
            content: `/**
 * ${config.name} - Multiplayer Server
 */

import { WebSocketServer } from 'ws';
import { EngineBuilder } from '@orion-ecs/core';
import { Position, Velocity, NetworkId } from './shared/components.${isTS ? 'js' : ext}';

const PORT = process.env.PORT || 8080;

// Create the ECS engine for server
const engine = new EngineBuilder()
    .withDebugMode(true)
    .withFixedUpdateFPS(60)
    .build();

// WebSocket server
const wss = new WebSocketServer({ port: Number(PORT) });
const clients${isTS ? ': Map<string, any>' : ''} = new Map();
let nextPlayerId = 1;

console.log(\`Server running on ws://localhost:\${PORT}\`);

wss.on('connection', (ws) => {
    const playerId = \`player_\${nextPlayerId++}\`;
    clients.set(playerId, ws);
    console.log(\`Player connected: \${playerId}\`);

    // Create entity for this player
    const entity = engine.createEntity(playerId);
    entity
        .addComponent(Position, Math.random() * 700 + 50, Math.random() * 500 + 50)
        .addComponent(Velocity, 0, 0)
        .addComponent(NetworkId, playerId)
        .addTag('player');

    // Send initial state
    ws.send(JSON.stringify({
        type: 'init',
        playerId,
        state: getGameState(),
    }));

    // Broadcast new player to others
    broadcast({
        type: 'player_joined',
        playerId,
        position: { x: entity.getComponent(Position).x, y: entity.getComponent(Position).y },
    }, playerId);

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            handleMessage(playerId, message);
        } catch (e) {
            console.error('Invalid message:', e);
        }
    });

    ws.on('close', () => {
        console.log(\`Player disconnected: \${playerId}\`);
        const entity = engine.getEntityByName(playerId);
        if (entity) {
            engine.destroyEntity(entity);
        }
        clients.delete(playerId);
        broadcast({ type: 'player_left', playerId });
    });
});

function handleMessage(playerId${isTS ? ': string' : ''}, message${isTS ? ': any' : ''}) {
    if (message.type === 'input') {
        const entity = engine.getEntityByName(playerId);
        if (entity) {
            const velocity = entity.getComponent(Velocity);
            velocity.x = message.x * 200;
            velocity.y = message.y * 200;
        }
    }
}

function getGameState()${isTS ? ': any[]' : ''} {
    const state${isTS ? ': any[]' : ''} = [];
    const query = engine.createQuery({ all: [Position, NetworkId] });
    for (const entity of query.getEntities()) {
        const pos = entity.getComponent(Position);
        const netId = entity.getComponent(NetworkId);
        state.push({
            id: netId.id,
            x: pos.x,
            y: pos.y,
        });
    }
    return state;
}

function broadcast(message${isTS ? ': any' : ''}, excludeId${isTS ? '?: string' : ''} = undefined) {
    const data = JSON.stringify(message);
    for (const [id, ws] of clients) {
        if (id !== excludeId) {
            ws.send(data);
        }
    }
}

// Movement system
engine.createSystem(
    'MovementSystem',
    { all: [Position, Velocity] },
    {
        priority: 100,
        act: (_entity, position, velocity) => {
            const dt = 1 / 60;
            position.x += velocity.x * dt;
            position.y += velocity.y * dt;
            position.x = Math.max(0, Math.min(800, position.x));
            position.y = Math.max(0, Math.min(600, position.y));
        },
    }
);

// Broadcast state periodically
setInterval(() => {
    broadcast({ type: 'state', state: getGameState() });
}, 50);

engine.run();
`,
        },
        {
            path: `src/shared/components.${ext}`,
            content: `/**
 * Shared components for client and server
 */

export class Position {
    constructor(
        public x${isTS ? ': number' : ''} = 0,
        public y${isTS ? ': number' : ''} = 0
    ) {}
}

export class Velocity {
    constructor(
        public x${isTS ? ': number' : ''} = 0,
        public y${isTS ? ': number' : ''} = 0
    ) {}
}

export class NetworkId {
    constructor(public id${isTS ? ': string' : ''} = '') {}
}
`,
        },
        {
            path: 'index.html',
            content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.name}</title>
    <style>
        body {
            margin: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            background: #1a1a2e;
            color: white;
            font-family: sans-serif;
        }
        canvas {
            border: 2px solid #16213e;
            background: #0f0f23;
        }
        #status {
            margin-bottom: 10px;
            color: #888;
        }
    </style>
</head>
<body>
    <div id="status">Connecting...</div>
    <canvas id="game" width="800" height="600"></canvas>
    <script type="module" src="/src/client.${ext}"></script>
</body>
</html>
`,
        },
        {
            path: `src/client.${ext}`,
            content: `/**
 * ${config.name} - Multiplayer Client
 */

const canvas = document.getElementById('game')${isTS ? ' as HTMLCanvasElement' : ''};
const ctx = canvas.getContext('2d')${isTS ? '!' : ''};
const status = document.getElementById('status')${isTS ? '!' : ''};

let playerId${isTS ? ': string | null' : ''} = null;
let gameState${isTS ? ': any[]' : ''} = [];
const input = { x: 0, y: 0 };

// Connect to server
const ws = new WebSocket(\`ws://\${window.location.hostname}:8080\`);

ws.onopen = () => {
    status.textContent = 'Connected!';
    status.style.color = '#00ff88';
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    switch (message.type) {
        case 'init':
            playerId = message.playerId;
            gameState = message.state;
            break;
        case 'state':
            gameState = message.state;
            break;
        case 'player_joined':
            console.log(\`Player joined: \${message.playerId}\`);
            break;
        case 'player_left':
            console.log(\`Player left: \${message.playerId}\`);
            break;
    }
};

ws.onclose = () => {
    status.textContent = 'Disconnected';
    status.style.color = '#ff4444';
};

// Handle input
window.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
            input.y = -1;
            break;
        case 'ArrowDown':
        case 's':
            input.y = 1;
            break;
        case 'ArrowLeft':
        case 'a':
            input.x = -1;
            break;
        case 'ArrowRight':
        case 'd':
            input.x = 1;
            break;
    }
    sendInput();
});

window.addEventListener('keyup', (e) => {
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'ArrowDown':
        case 's':
            input.y = 0;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'ArrowRight':
        case 'd':
            input.x = 0;
            break;
    }
    sendInput();
});

function sendInput() {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', ...input }));
    }
}

// Render loop
function render() {
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, 800, 600);

    for (const player of gameState) {
        const isMe = player.id === playerId;
        ctx.fillStyle = isMe ? '#00ff88' : '#ff6b6b';
        ctx.fillRect(player.x - 16, player.y - 16, 32, 32);

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(player.id, player.x, player.y - 24);
    }

    requestAnimationFrame(render);
}

render();
`,
        },
        generateViteConfig(config),
    ];
}

/**
 * Generate Vite template files
 */
function generateViteFiles(config: ProjectConfig, ext: string): TemplateFile[] {
    return [...generateCanvas2dFiles(config, ext)];
}

/**
 * Generate Webpack template files
 */
function generateWebpackFiles(config: ProjectConfig, ext: string): TemplateFile[] {
    const isTS = ext === 'ts';
    const baseFiles = generateCanvas2dFiles(config, ext);

    // Replace vite.config with webpack.config
    const filesWithoutVite = baseFiles.filter((f) => !f.path.includes('vite.config'));

    return [
        ...filesWithoutVite,
        {
            path: `webpack.config.${ext}`,
            content: isTS
                ? `import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import type { Configuration } from 'webpack';

const config: Configuration = {
    entry: './src/index.ts',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './index.html',
        }),
    ],
    devServer: {
        static: './dist',
        hot: true,
    },
};

export default config;
`
                : `const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './index.html',
        }),
    ],
    devServer: {
        static: './dist',
        hot: true,
    },
};
`,
        },
    ];
}

/**
 * Generate vite.config.ts
 */
function generateViteConfig(config: ProjectConfig): TemplateFile {
    const isTS = config.language === 'typescript';

    return {
        path: `vite.config.${isTS ? 'ts' : 'js'}`,
        content: `import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 3000,
        open: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});
`,
    };
}
