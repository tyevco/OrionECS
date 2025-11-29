import prompts from 'prompts';
import pc from 'picocolors';
import type { ProjectConfig, CliOptions } from './types.js';
import { getTemplateChoices, isValidTemplate } from './templates.js';

/**
 * Validate project name
 */
function validateProjectName(name: string): boolean | string {
    if (!name) {
        return 'Project name is required';
    }
    if (!/^[a-z0-9-_]+$/i.test(name)) {
        return 'Project name can only contain letters, numbers, dashes, and underscores';
    }
    if (name.startsWith('-') || name.startsWith('_')) {
        return 'Project name cannot start with a dash or underscore';
    }
    return true;
}

/**
 * Run interactive prompts to gather project configuration
 */
export async function runPrompts(options: CliOptions): Promise<ProjectConfig | null> {
    const results: Partial<ProjectConfig> = {};

    // Handle cancellation
    const onCancel = () => {
        console.log(pc.red('\nProject creation cancelled.'));
        process.exit(0);
    };

    try {
        // Project name
        if (options.projectName) {
            const validation = validateProjectName(options.projectName);
            if (validation !== true) {
                console.log(pc.red(`Invalid project name: ${validation}`));
                return null;
            }
            results.name = options.projectName;
        } else if (!options.yes) {
            const response = await prompts(
                {
                    type: 'text',
                    name: 'name',
                    message: 'Project name:',
                    initial: 'my-orion-game',
                    validate: validateProjectName,
                },
                { onCancel }
            );
            results.name = response.name;
        } else {
            results.name = 'my-orion-game';
        }

        // Template selection
        if (options.template && isValidTemplate(options.template)) {
            results.template = options.template;
        } else if (!options.yes) {
            const response = await prompts(
                {
                    type: 'select',
                    name: 'template',
                    message: 'Select a template:',
                    choices: getTemplateChoices(),
                    initial: 0,
                },
                { onCancel }
            );
            results.template = response.template;
        } else {
            results.template = 'vanilla';
        }

        // Language preference (TypeScript or JavaScript)
        if (options.javascript !== undefined) {
            results.language = options.javascript ? 'javascript' : 'typescript';
        } else if (!options.yes) {
            const response = await prompts(
                {
                    type: 'select',
                    name: 'language',
                    message: 'Select language:',
                    choices: [
                        { title: 'TypeScript', value: 'typescript', description: 'Recommended' },
                        { title: 'JavaScript', value: 'javascript' },
                    ],
                    initial: 0,
                },
                { onCancel }
            );
            results.language = response.language;
        } else {
            results.language = 'typescript';
        }

        // Package manager
        if (options.packageManager) {
            results.packageManager = options.packageManager;
        } else if (!options.yes) {
            const response = await prompts(
                {
                    type: 'select',
                    name: 'packageManager',
                    message: 'Select package manager:',
                    choices: [
                        { title: 'npm', value: 'npm' },
                        { title: 'yarn', value: 'yarn' },
                        { title: 'pnpm', value: 'pnpm' },
                    ],
                    initial: 0,
                },
                { onCancel }
            );
            results.packageManager = response.packageManager;
        } else {
            results.packageManager = 'npm';
        }

        // Install dependencies
        if (options.skipInstall !== undefined) {
            results.installDeps = !options.skipInstall;
        } else if (!options.yes) {
            const response = await prompts(
                {
                    type: 'confirm',
                    name: 'installDeps',
                    message: 'Install dependencies?',
                    initial: true,
                },
                { onCancel }
            );
            results.installDeps = response.installDeps;
        } else {
            results.installDeps = true;
        }

        // Initialize git
        if (options.skipGit !== undefined) {
            results.initGit = !options.skipGit;
        } else if (!options.yes) {
            const response = await prompts(
                {
                    type: 'confirm',
                    name: 'initGit',
                    message: 'Initialize git repository?',
                    initial: true,
                },
                { onCancel }
            );
            results.initGit = response.initGit;
        } else {
            results.initGit = true;
        }

        return results as ProjectConfig;
    } catch {
        return null;
    }
}
