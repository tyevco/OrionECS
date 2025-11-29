#!/usr/bin/env node

/**
 * @orion-ecs/create CLI
 *
 * Create OrionECS projects with a single command:
 *   npm create @orion-ecs
 *   npx @orion-ecs/create my-game
 */

import pc from 'picocolors';
import { parseArgs } from './args.js';
import { runPrompts } from './prompts.js';
import { createProject } from './generator.js';
import { printHelp, printVersion, printBanner } from './help.js';

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));

    // Handle help and version flags
    if (options.help) {
        printHelp();
        process.exit(0);
    }

    if (options.version) {
        printVersion();
        process.exit(0);
    }

    // Print banner
    printBanner();

    // Run interactive prompts
    const config = await runPrompts(options);

    if (!config) {
        console.log(pc.red('Failed to gather project configuration.'));
        process.exit(1);
    }

    // Create the project
    const success = await createProject(config);

    if (!success) {
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(pc.red('Unexpected error:'));
    console.error(error);
    process.exit(1);
});
