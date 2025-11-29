/**
 * @orion-ecs/create
 *
 * Create OrionECS projects with a single command.
 */

export { createProject } from './generator.js';
export { runPrompts } from './prompts.js';
export { templates, getTemplateInfo, getTemplateChoices, isValidTemplate } from './templates.js';
export { generateTemplateFiles } from './template-files.js';
export type {
    ProjectConfig,
    TemplateType,
    TemplateInfo,
    TemplateFile,
    CliOptions,
} from './types.js';
