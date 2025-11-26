module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    testMatch: ['**/*.spec.ts'],
    moduleNameMapper: {
        '^@orion-ecs/testing$': '<rootDir>/../../packages/testing/src/index.ts',
        '^@orion-ecs/core$': '<rootDir>/../../packages/core/src/index.ts',
    },
};
