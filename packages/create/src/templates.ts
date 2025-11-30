import type { TemplateInfo, TemplateType } from './types.js';

/**
 * Available project templates
 */
export const templates: Record<TemplateType, TemplateInfo> = {
    vanilla: {
        id: 'vanilla',
        name: 'Vanilla',
        description: 'Minimal setup with just OrionECS core',
        dependencies: {
            '@orion-ecs/core': '^0.4.0',
        },
        devDependencies: {
            typescript: '^5.9.3',
            tsup: '^8.5.1',
            '@types/node': '^22.14.0',
        },
        tags: ['minimal', 'basic', 'console'],
    },
    canvas2d: {
        id: 'canvas2d',
        name: 'Canvas 2D',
        description: 'Browser-based 2D game with Canvas API',
        dependencies: {
            '@orion-ecs/core': '^0.4.0',
            '@orion-ecs/canvas2d-renderer': '^0.4.0',
        },
        devDependencies: {
            typescript: '^5.9.3',
            vite: '^6.0.7',
        },
        tags: ['browser', '2d', 'canvas'],
    },
    pixi: {
        id: 'pixi',
        name: 'Pixi.js',
        description: '2D game with Pixi.js rendering engine',
        dependencies: {
            '@orion-ecs/core': '^0.4.0',
            'pixi.js': '^8.0.0',
        },
        devDependencies: {
            typescript: '^5.9.3',
            vite: '^6.0.7',
        },
        tags: ['browser', '2d', 'pixi', 'webgl'],
    },
    three: {
        id: 'three',
        name: 'Three.js',
        description: '3D game with Three.js rendering engine',
        dependencies: {
            '@orion-ecs/core': '^0.4.0',
            three: '^0.170.0',
        },
        devDependencies: {
            typescript: '^5.9.3',
            '@types/three': '^0.170.0',
            vite: '^6.0.7',
        },
        tags: ['browser', '3d', 'three', 'webgl'],
    },
    multiplayer: {
        id: 'multiplayer',
        name: 'Multiplayer',
        description: 'Networked multiplayer game with server and client',
        dependencies: {
            '@orion-ecs/core': '^0.4.0',
            '@orion-ecs/network': '^0.4.0',
            ws: '^8.18.0',
        },
        devDependencies: {
            typescript: '^5.9.3',
            '@types/ws': '^8.5.10',
            vite: '^6.0.7',
            tsx: '^4.0.0',
        },
        tags: ['network', 'multiplayer', 'server', 'client'],
    },
    vite: {
        id: 'vite',
        name: 'Vite',
        description: 'Modern browser setup with Vite bundler',
        dependencies: {
            '@orion-ecs/core': '^0.4.0',
        },
        devDependencies: {
            typescript: '^5.9.3',
            vite: '^6.0.7',
        },
        tags: ['browser', 'vite', 'modern'],
    },
    webpack: {
        id: 'webpack',
        name: 'Webpack',
        description: 'Browser setup with Webpack bundler',
        dependencies: {
            '@orion-ecs/core': '^0.4.0',
        },
        devDependencies: {
            typescript: '^5.9.3',
            webpack: '^5.97.0',
            'webpack-cli': '^6.0.0',
            'webpack-dev-server': '^5.2.0',
            'ts-loader': '^9.5.0',
            'html-webpack-plugin': '^5.6.0',
        },
        tags: ['browser', 'webpack'],
    },
};

/**
 * Get all template options for prompts
 */
export function getTemplateChoices(): Array<{
    title: string;
    value: TemplateType;
    description: string;
}> {
    return Object.values(templates).map((template) => ({
        title: template.name,
        value: template.id,
        description: template.description,
    }));
}

/**
 * Get template info by ID
 */
export function getTemplateInfo(id: TemplateType): TemplateInfo | undefined {
    return templates[id];
}

/**
 * Check if template ID is valid
 */
export function isValidTemplate(id: string): id is TemplateType {
    return id in templates;
}
