import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import pc from 'picocolors';
import type { ProjectConfig } from './types.js';
import { getTemplateInfo } from './templates.js';
import { generateTemplateFiles } from './template-files.js';

/**
 * Create a new OrionECS project
 */
export async function createProject(config: ProjectConfig): Promise<boolean> {
    const targetDir = config.targetDir || config.name;
    const projectPath = path.resolve(process.cwd(), targetDir);

    console.log();
    console.log(pc.cyan(`Creating project in ${pc.bold(projectPath)}...`));
    console.log();

    // Check if directory already exists
    if (fs.existsSync(projectPath)) {
        const files = fs.readdirSync(projectPath);
        if (files.length > 0) {
            console.log(pc.red(`Error: Directory ${targetDir} is not empty.`));
            console.log(pc.dim('Please choose a different name or delete the directory.'));
            return false;
        }
    } else {
        fs.mkdirSync(projectPath, { recursive: true });
    }

    // Get template info
    const templateInfo = getTemplateInfo(config.template);
    if (!templateInfo) {
        console.log(pc.red(`Error: Unknown template "${config.template}"`));
        return false;
    }

    try {
        // Generate template files
        console.log(pc.dim('Generating project files...'));
        const files = generateTemplateFiles(config);

        for (const file of files) {
            const filePath = path.join(projectPath, file.path);
            const fileDir = path.dirname(filePath);

            // Create directory if needed
            if (!fs.existsSync(fileDir)) {
                fs.mkdirSync(fileDir, { recursive: true });
            }

            // Write file
            fs.writeFileSync(filePath, file.content);
            console.log(pc.green('  ✓') + pc.dim(` ${file.path}`));
        }

        // Initialize git repository
        if (config.initGit) {
            console.log();
            console.log(pc.dim('Initializing git repository...'));
            try {
                execSync('git init', { cwd: projectPath, stdio: 'ignore' });
                console.log(pc.green('  ✓') + pc.dim(' Git repository initialized'));
            } catch {
                console.log(pc.yellow('  ⚠') + pc.dim(' Failed to initialize git repository'));
            }
        }

        // Install dependencies
        if (config.installDeps) {
            console.log();
            console.log(pc.dim(`Installing dependencies with ${config.packageManager}...`));

            try {
                const installCmd = getInstallCommand(config.packageManager);
                execSync(installCmd, { cwd: projectPath, stdio: 'inherit' });
                console.log(pc.green('  ✓') + pc.dim(' Dependencies installed'));
            } catch {
                console.log(pc.yellow('  ⚠') + pc.dim(' Failed to install dependencies'));
                console.log(
                    pc.dim(`    Run "${config.packageManager} install" manually to install dependencies`)
                );
            }
        }

        // Success message
        console.log();
        console.log(pc.green('✓ Project created successfully!'));
        console.log();
        console.log(pc.cyan('Next steps:'));
        console.log();
        console.log(pc.dim(`  cd ${targetDir}`));
        if (!config.installDeps) {
            console.log(pc.dim(`  ${config.packageManager} install`));
        }
        console.log(pc.dim(`  ${config.packageManager} run dev`));
        console.log();

        return true;
    } catch (error) {
        console.log(pc.red('Error creating project:'));
        console.log(pc.dim(error instanceof Error ? error.message : String(error)));
        return false;
    }
}

/**
 * Get the install command for the package manager
 */
function getInstallCommand(packageManager: 'npm' | 'yarn' | 'pnpm'): string {
    switch (packageManager) {
        case 'yarn':
            return 'yarn';
        case 'pnpm':
            return 'pnpm install';
        default:
            return 'npm install';
    }
}
