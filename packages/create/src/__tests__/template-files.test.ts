import { generateTemplateFiles } from '../template-files.js';
import type { ProjectConfig, TemplateType, TemplateFile } from '../types.js';

function createConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
    return {
        name: 'test-project',
        template: 'vanilla',
        language: 'typescript',
        packageManager: 'npm',
        installDeps: false,
        initGit: false,
        ...overrides,
    };
}

function findFile(files: TemplateFile[], path: string): TemplateFile {
    const file = files.find((f) => f.path === path);
    if (!file) {
        throw new Error(`File not found: ${path}`);
    }
    return file;
}

describe('generateTemplateFiles', () => {
    describe('common files', () => {
        it('should generate package.json', () => {
            const config = createConfig();
            const files = generateTemplateFiles(config);
            const packageJson = findFile(files, 'package.json');

            const parsed = JSON.parse(packageJson.content);
            expect(parsed.name).toBe('test-project');
            expect(parsed.dependencies['@orion-ecs/core']).toBeDefined();
        });

        it('should generate .gitignore', () => {
            const config = createConfig();
            const files = generateTemplateFiles(config);
            const gitignore = findFile(files, '.gitignore');

            expect(gitignore.content).toContain('node_modules');
            expect(gitignore.content).toContain('dist');
        });

        it('should generate README.md', () => {
            const config = createConfig();
            const files = generateTemplateFiles(config);
            const readme = findFile(files, 'README.md');

            expect(readme.content).toContain('test-project');
        });

        it('should generate tsconfig.json for TypeScript projects', () => {
            const config = createConfig({ language: 'typescript' });
            const files = generateTemplateFiles(config);
            const tsconfig = findFile(files, 'tsconfig.json');

            const parsed = JSON.parse(tsconfig.content);
            expect(parsed.compilerOptions.strict).toBe(true);
        });

        it('should not generate tsconfig.json for JavaScript projects', () => {
            const config = createConfig({ language: 'javascript' });
            const files = generateTemplateFiles(config);

            const tsconfig = files.find((f) => f.path === 'tsconfig.json');
            expect(tsconfig).toBeUndefined();
        });
    });

    describe('vanilla template', () => {
        it('should generate entry point', () => {
            const config = createConfig({ template: 'vanilla' });
            const files = generateTemplateFiles(config);
            const entry = findFile(files, 'src/index.ts');

            expect(entry.content).toContain('EngineBuilder');
        });

        it('should generate components', () => {
            const config = createConfig({ template: 'vanilla' });
            const files = generateTemplateFiles(config);
            const components = findFile(files, 'src/components/transform.ts');

            expect(components.content).toContain('class Position');
            expect(components.content).toContain('class Velocity');
        });

        it('should generate systems', () => {
            const config = createConfig({ template: 'vanilla' });
            const files = generateTemplateFiles(config);
            const movement = findFile(files, 'src/systems/movement.ts');

            expect(movement.content).toContain('MovementSystem');
        });
    });

    describe('canvas2d template', () => {
        it('should generate index.html', () => {
            const config = createConfig({ template: 'canvas2d' });
            const files = generateTemplateFiles(config);
            const html = findFile(files, 'index.html');

            expect(html.content).toContain('canvas');
        });

        it('should generate vite.config.ts', () => {
            const config = createConfig({ template: 'canvas2d' });
            const files = generateTemplateFiles(config);
            const viteConfig = findFile(files, 'vite.config.ts');

            expect(viteConfig.content).toContain('defineConfig');
        });

        it('should generate render system', () => {
            const config = createConfig({ template: 'canvas2d' });
            const files = generateTemplateFiles(config);
            const render = findFile(files, 'src/systems/render.ts');

            expect(render.content).toContain('RenderSystem');
        });
    });

    describe('pixi template', () => {
        it('should include pixi.js dependency', () => {
            const config = createConfig({ template: 'pixi' });
            const files = generateTemplateFiles(config);
            const packageJson = findFile(files, 'package.json');

            const parsed = JSON.parse(packageJson.content);
            expect(parsed.dependencies['pixi.js']).toBeDefined();
        });

        it('should generate PixiRenderable component', () => {
            const config = createConfig({ template: 'pixi' });
            const files = generateTemplateFiles(config);
            const components = findFile(files, 'src/components/transform.ts');

            expect(components.content).toContain('PixiRenderable');
        });
    });

    describe('three template', () => {
        it('should include three dependency', () => {
            const config = createConfig({ template: 'three' });
            const files = generateTemplateFiles(config);
            const packageJson = findFile(files, 'package.json');

            const parsed = JSON.parse(packageJson.content);
            expect(parsed.dependencies['three']).toBeDefined();
        });

        it('should generate 3D components', () => {
            const config = createConfig({ template: 'three' });
            const files = generateTemplateFiles(config);
            const components = findFile(files, 'src/components/transform.ts');

            expect(components.content).toContain('Position3D');
            expect(components.content).toContain('ThreeRenderable');
        });
    });

    describe('multiplayer template', () => {
        it('should include ws dependency', () => {
            const config = createConfig({ template: 'multiplayer' });
            const files = generateTemplateFiles(config);
            const packageJson = findFile(files, 'package.json');

            const parsed = JSON.parse(packageJson.content);
            expect(parsed.dependencies['ws']).toBeDefined();
        });

        it('should generate server file', () => {
            const config = createConfig({ template: 'multiplayer' });
            const files = generateTemplateFiles(config);
            const server = findFile(files, 'src/server.ts');

            expect(server.content).toContain('WebSocketServer');
        });

        it('should generate client file', () => {
            const config = createConfig({ template: 'multiplayer' });
            const files = generateTemplateFiles(config);
            const client = findFile(files, 'src/client.ts');

            expect(client.content).toContain('WebSocket');
        });

        it('should generate shared components', () => {
            const config = createConfig({ template: 'multiplayer' });
            const files = generateTemplateFiles(config);
            const shared = findFile(files, 'src/shared/components.ts');

            expect(shared.content).toContain('NetworkId');
        });
    });

    describe('webpack template', () => {
        it('should include webpack dependencies', () => {
            const config = createConfig({ template: 'webpack' });
            const files = generateTemplateFiles(config);
            const packageJson = findFile(files, 'package.json');

            const parsed = JSON.parse(packageJson.content);
            expect(parsed.devDependencies['webpack']).toBeDefined();
            expect(parsed.devDependencies['webpack-cli']).toBeDefined();
        });

        it('should generate webpack.config.ts', () => {
            const config = createConfig({ template: 'webpack' });
            const files = generateTemplateFiles(config);
            const webpackConfig = findFile(files, 'webpack.config.ts');

            expect(webpackConfig.content).toContain('HtmlWebpackPlugin');
        });
    });

    describe('JavaScript output', () => {
        it('should use .js extensions', () => {
            const config = createConfig({ template: 'vanilla', language: 'javascript' });
            const files = generateTemplateFiles(config);
            const entry = findFile(files, 'src/index.js');

            expect(entry).toBeDefined();
        });

        it('should not include type annotations', () => {
            const config = createConfig({ template: 'vanilla', language: 'javascript' });
            const files = generateTemplateFiles(config);
            const entry = findFile(files, 'src/index.js');

            // JavaScript files should have simpler constructor params
            expect(entry.content).not.toContain(': number');
        });
    });

    describe('all templates', () => {
        const allTemplates: TemplateType[] = [
            'vanilla',
            'canvas2d',
            'pixi',
            'three',
            'multiplayer',
            'vite',
            'webpack',
        ];

        for (const template of allTemplates) {
            it(`should generate valid files for ${template} template`, () => {
                const config = createConfig({ template });
                const files = generateTemplateFiles(config);

                // Should have at least package.json, .gitignore, README
                expect(files.length).toBeGreaterThanOrEqual(3);

                // All paths should be valid
                for (const file of files) {
                    expect(file.path).toBeTruthy();
                    expect(file.content).toBeTruthy();
                    expect(file.path).not.toContain('undefined');
                }
            });
        }
    });
});
