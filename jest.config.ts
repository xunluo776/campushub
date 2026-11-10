import type { Config } from 'jest';

// Backend tests only (the React client in client/ is not part of this suite).
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Starts the in-memory MongoDB before each test file and wipes it between tests.
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  // The first run downloads a MongoDB binary, so give hooks more than the 5s default.
  testTimeout: 30000,

  // Coverage is measured on the layers the lab grades: services and controllers.
  collectCoverageFrom: ['src/services/**/*.ts', 'src/controllers/**/*.ts'],
  coverageReporters: ['text', 'text-summary', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
    },
  },
};

// CommonJS export on purpose: this package is "type": "commonjs", and Node 24 loads .ts
// config files natively, so `export default` here makes it print a load warning.
module.exports = config;
