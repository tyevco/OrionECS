import { parseArgs } from '../args.js';

describe('parseArgs', () => {
    it('should parse project name', () => {
        const result = parseArgs(['my-project']);
        expect(result.projectName).toBe('my-project');
    });

    it('should parse help flag', () => {
        expect(parseArgs(['-h']).help).toBe(true);
        expect(parseArgs(['--help']).help).toBe(true);
    });

    it('should parse version flag', () => {
        expect(parseArgs(['-v']).version).toBe(true);
        expect(parseArgs(['--version']).version).toBe(true);
    });

    it('should parse yes flag', () => {
        expect(parseArgs(['-y']).yes).toBe(true);
        expect(parseArgs(['--yes']).yes).toBe(true);
    });

    it('should parse skip-install flag', () => {
        expect(parseArgs(['--skip-install']).skipInstall).toBe(true);
    });

    it('should parse skip-git flag', () => {
        expect(parseArgs(['--skip-git']).skipGit).toBe(true);
    });

    it('should parse javascript flag', () => {
        expect(parseArgs(['--javascript']).javascript).toBe(true);
        expect(parseArgs(['--js']).javascript).toBe(true);
    });

    it('should parse template option', () => {
        expect(parseArgs(['-t', 'pixi']).template).toBe('pixi');
        expect(parseArgs(['--template', 'three']).template).toBe('three');
    });

    it('should ignore invalid template', () => {
        expect(parseArgs(['-t', 'invalid']).template).toBeUndefined();
    });

    it('should parse package-manager option', () => {
        expect(parseArgs(['-p', 'yarn']).packageManager).toBe('yarn');
        expect(parseArgs(['--package-manager', 'pnpm']).packageManager).toBe('pnpm');
    });

    it('should ignore invalid package manager', () => {
        expect(parseArgs(['-p', 'invalid']).packageManager).toBeUndefined();
    });

    it('should handle multiple options', () => {
        const result = parseArgs([
            'my-game',
            '-t',
            'canvas2d',
            '-p',
            'yarn',
            '--skip-install',
            '-y',
        ]);

        expect(result.projectName).toBe('my-game');
        expect(result.template).toBe('canvas2d');
        expect(result.packageManager).toBe('yarn');
        expect(result.skipInstall).toBe(true);
        expect(result.yes).toBe(true);
    });

    it('should return empty options for empty args', () => {
        const result = parseArgs([]);
        expect(result.projectName).toBeUndefined();
        expect(result.template).toBeUndefined();
    });
});
