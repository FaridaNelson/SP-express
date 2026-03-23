export default {
  testEnvironment: "node",
  transform: {},
  testMatch: ["**/tests/**/*.test.js"],
  globalSetup: "<rootDir>/tests/globalSetup.js",
  globalTeardown: "<rootDir>/tests/globalTeardown.js",
  setupFilesAfterEnv: ["<rootDir>/tests/dbSetup.js"],
  testTimeout: 30000,
};
