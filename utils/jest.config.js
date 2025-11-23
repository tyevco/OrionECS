module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    testMatch: ['<rootDir>/src/**/*.spec.ts'],
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
            tsconfig: '<rootDir>/tsconfig.json',
        }],
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
