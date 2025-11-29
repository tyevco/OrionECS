/**
 * Project configuration options
 */
export interface ProjectConfig {
    /** Project name (also used as directory name) */
    name: string;
    /** Template to use */
    template: TemplateType;
    /** Language preference */
    language: 'typescript' | 'javascript';
    /** Package manager to use */
    packageManager: 'npm' | 'yarn' | 'pnpm';
    /** Whether to install dependencies */
    installDeps: boolean;
    /** Whether to initialize git */
    initGit: boolean;
    /** Target directory (defaults to project name) */
    targetDir?: string;
}

/**
 * Available project templates
 */
export type TemplateType =
    | 'vanilla'
    | 'canvas2d'
    | 'pixi'
    | 'three'
    | 'multiplayer'
    | 'vite'
    | 'webpack';

/**
 * Template metadata
 */
export interface TemplateInfo {
    /** Template identifier */
    id: TemplateType;
    /** Display name */
    name: string;
    /** Template description */
    description: string;
    /** Additional dependencies */
    dependencies: Record<string, string>;
    /** Dev dependencies */
    devDependencies: Record<string, string>;
    /** Tags for filtering */
    tags: string[];
}

/**
 * File entry in a template
 */
export interface TemplateFile {
    /** Relative path to file */
    path: string;
    /** File content (can be template string with placeholders) */
    content: string;
}

/**
 * CLI options from command line arguments
 */
export interface CliOptions {
    /** Project name */
    projectName?: string;
    /** Template to use */
    template?: TemplateType;
    /** Skip prompts, use defaults */
    yes?: boolean;
    /** Show help */
    help?: boolean;
    /** Show version */
    version?: boolean;
    /** Skip dependency installation */
    skipInstall?: boolean;
    /** Skip git initialization */
    skipGit?: boolean;
    /** Use JavaScript instead of TypeScript */
    javascript?: boolean;
    /** Package manager to use */
    packageManager?: 'npm' | 'yarn' | 'pnpm';
}
