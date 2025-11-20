module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Jest-bench need its own test environment to function
  "testEnvironment": "jest-bench/environment",
  "testEnvironmentOptions": {
    // still Jest-bench environment will run your environment if you specify it here
    "testEnvironment": "jest-environment-node",
    "testEnvironmentOptions": {
      // specify any option for your environment
    }
  },
  // always include "default" reporter along with Jest-bench reporter
  // for error reporting
  "reporters": ["default", ["jest-bench/reporter", {withOpsPerSecond: true}]],
  // will pick up "*.bench.js" files or files in "__benchmarks__" folder.
  "testRegex": "(/benchmarks/.*|\\.bench)\\.(ts|tsx|js)$",
};