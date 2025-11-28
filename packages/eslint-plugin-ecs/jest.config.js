/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js'],
    moduleDirectories: ['node_modules', '../../node_modules'],
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                isolatedModules: true,
                tsconfig: {
                    target: 'ES2023',
                    module: 'CommonJS',
                    lib: ['ES2023'],
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    moduleResolution: 'node',
                },
            },
        ],
    },
    collectCoverageFrom: ['src/**/*.ts', '!src/**/__tests__/**'],
};
