import type { CliOptions, TemplateType } from './types.js';
import { isValidTemplate } from './templates.js';

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): CliOptions {
    const options: CliOptions = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        // Handle flags
        if (arg.startsWith('-')) {
            switch (arg) {
                case '-h':
                case '--help':
                    options.help = true;
                    break;
                case '-v':
                case '--version':
                    options.version = true;
                    break;
                case '-y':
                case '--yes':
                    options.yes = true;
                    break;
                case '--skip-install':
                    options.skipInstall = true;
                    break;
                case '--skip-git':
                    options.skipGit = true;
                    break;
                case '--javascript':
                case '--js':
                    options.javascript = true;
                    break;
                case '-t':
                case '--template': {
                    const templateArg = args[++i];
                    if (templateArg && isValidTemplate(templateArg)) {
                        options.template = templateArg as TemplateType;
                    }
                    break;
                }
                case '-p':
                case '--package-manager': {
                    const pm = args[++i];
                    if (pm === 'npm' || pm === 'yarn' || pm === 'pnpm') {
                        options.packageManager = pm;
                    }
                    break;
                }
            }
        } else if (!options.projectName) {
            // First non-flag argument is the project name
            options.projectName = arg;
        }
    }

    return options;
}
