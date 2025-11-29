import { templates, getTemplateInfo, getTemplateChoices, isValidTemplate } from '../templates.js';
import type { TemplateType } from '../types.js';

describe('templates', () => {
    describe('templates object', () => {
        it('should have all expected templates', () => {
            const expectedTemplates: TemplateType[] = [
                'vanilla',
                'canvas2d',
                'pixi',
                'three',
                'multiplayer',
                'vite',
                'webpack',
            ];

            for (const template of expectedTemplates) {
                expect(templates[template]).toBeDefined();
            }
        });

        it('should have required properties for each template', () => {
            for (const [id, template] of Object.entries(templates)) {
                expect(template.id).toBe(id);
                expect(template.name).toBeTruthy();
                expect(template.description).toBeTruthy();
                expect(template.dependencies).toBeDefined();
                expect(template.devDependencies).toBeDefined();
                expect(template.tags).toBeInstanceOf(Array);
            }
        });

        it('should include @orion-ecs/core in all template dependencies', () => {
            for (const template of Object.values(templates)) {
                expect(template.dependencies['@orion-ecs/core']).toBeDefined();
            }
        });
    });

    describe('getTemplateInfo', () => {
        it('should return template info for valid template', () => {
            const info = getTemplateInfo('vanilla');
            expect(info).toBeDefined();
            expect(info?.id).toBe('vanilla');
            expect(info?.name).toBe('Vanilla');
        });

        it('should return undefined for invalid template', () => {
            const info = getTemplateInfo('invalid' as TemplateType);
            expect(info).toBeUndefined();
        });
    });

    describe('getTemplateChoices', () => {
        it('should return array of choices', () => {
            const choices = getTemplateChoices();
            expect(Array.isArray(choices)).toBe(true);
            expect(choices.length).toBe(Object.keys(templates).length);
        });

        it('should have title, value, and description for each choice', () => {
            const choices = getTemplateChoices();
            for (const choice of choices) {
                expect(choice.title).toBeTruthy();
                expect(choice.value).toBeTruthy();
                expect(choice.description).toBeTruthy();
            }
        });
    });

    describe('isValidTemplate', () => {
        it('should return true for valid templates', () => {
            expect(isValidTemplate('vanilla')).toBe(true);
            expect(isValidTemplate('pixi')).toBe(true);
            expect(isValidTemplate('three')).toBe(true);
        });

        it('should return false for invalid templates', () => {
            expect(isValidTemplate('invalid')).toBe(false);
            expect(isValidTemplate('')).toBe(false);
            expect(isValidTemplate('VANILLA')).toBe(false);
        });
    });
});
