import pc from 'picocolors';
import { templates } from './templates.js';

// Package version (will be replaced at build time)
const VERSION = '0.1.0';

/**
 * Print the CLI banner
 */
export function printBanner(): void {
    console.log();
    console.log(pc.cyan(pc.bold('  OrionECS Project Creator')));
    console.log(pc.dim(`  v${VERSION}`));
    console.log();
}

/**
 * Print help text
 */
export function printHelp(): void {
    console.log(`
${pc.cyan(pc.bold('OrionECS Project Creator'))}

${pc.bold('Usage:')}
  ${pc.dim('$')} npm create @orion-ecs [project-name] [options]
  ${pc.dim('$')} npx @orion-ecs/create [project-name] [options]

${pc.bold('Options:')}
  ${pc.cyan('-h, --help')}              Show this help message
  ${pc.cyan('-v, --version')}           Show version number
  ${pc.cyan('-y, --yes')}               Skip prompts and use defaults
  ${pc.cyan('-t, --template')} <name>   Use a specific template
  ${pc.cyan('-p, --package-manager')} <pm>  Use npm, yarn, or pnpm
  ${pc.cyan('--skip-install')}          Skip dependency installation
  ${pc.cyan('--skip-git')}              Skip git initialization
  ${pc.cyan('--javascript, --js')}      Use JavaScript instead of TypeScript

${pc.bold('Templates:')}
${Object.values(templates)
    .map((t) => `  ${pc.cyan(t.id.padEnd(12))} ${pc.dim(t.description)}`)
    .join('\n')}

${pc.bold('Examples:')}
  ${pc.dim('$')} npm create @orion-ecs my-game
  ${pc.dim('$')} npm create @orion-ecs my-game -t pixi
  ${pc.dim('$')} npm create @orion-ecs my-game -t three --skip-install
  ${pc.dim('$')} npm create @orion-ecs my-game -y -t canvas2d

${pc.bold('Documentation:')}
  ${pc.cyan('https://github.com/tyevco/orionecs')}
`);
}

/**
 * Print version number
 */
export function printVersion(): void {
    console.log(`@orion-ecs/create v${VERSION}`);
}
